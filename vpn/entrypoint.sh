#!/bin/bash
set -euo pipefail

# Expected files in /vpn/config/:
# - client.ovpn    (required)
# - auth.txt       (optional, username on first line, password on second)
# Tinyproxy will listen on port 8888.

VPN_CONF="/vpn/config/client.ovpn"
AUTH="/vpn/config/auth.txt"

log() {
    echo "[vpn-entrypoint] $*"
}

if [ ! -f "$VPN_CONF" ]; then
  log "ERROR: Missing $VPN_CONF. Mount an OpenVPN profile at /vpn/config/client.ovpn"
  ls -la /vpn/config/ 2>/dev/null || log "No files found in /vpn/config/"
  exit 1
fi

# Ensure log and runtime directories exist
mkdir -p /var/log/openvpn /run/openvpn
chmod 755 /var/log/openvpn /run/openvpn
chown -R vpnuser:vpnuser /var/log/openvpn /run/openvpn

sudo mkdir -p /dev/net
if [ ! -c /dev/net/tun ]; then
    log "Creating /dev/net/tun"
    sudo mknod /dev/net/tun c 10 200 || {
        log "Failed to create TUN device"
        exit 1
    }
    sudo chmod 666 /dev/net/tun || {
        log "Failed to set permissions on TUN device"
        exit 1
    }
fi

# Function to check if tun0 exists
check_tun0() {
    ip link show tun0 >/dev/null 2>&1
}

# Start OpenVPN in the background
start_openvpn() {
    log "Starting OpenVPN"
    if [ -f "$AUTH" ]; then
        log "Using auth file: $AUTH"
        sudo openvpn \
            --config "$VPN_CONF" \
            --auth-user-pass "$AUTH" \
            --log /var/log/openvpn/openvpn.log \
            --verb 4 \
            --daemon
    else
        sudo openvpn \
            --config "$VPN_CONF" \
            --log /var/log/openvpn/openvpn.log \
            --verb 4 \
            --daemon
    fi
    return $?
}

# Start OpenVPN and wait for tun0
if start_openvpn; then
    log "OpenVPN started"
    log "Waiting for tun0 (timeout 30s)"

    TRIES=0
    MAX=30  # Increased from 20 to 30
    while [ $TRIES -lt $MAX ]; do
        if check_tun0; then
            log "tun0 detected"
            break
        fi
        sleep 1
        TRIES=$((TRIES + 1))
    done

    if ! check_tun0; then
        log "ERROR: tun0 did not appear after ${MAX} seconds"
        log "--- OpenVPN log ---"
        cat /var/log/openvpn/openvpn.log 2>/dev/null || echo "No OpenVPN log file found"

        echo "\n--- Network interfaces ---"
        ip link show 2>/dev/null || echo "Failed to list network interfaces"

        echo "\n--- Routing table ---"
        ip route 2>/dev/null || echo "Failed to show routing table"

        echo "\n--- TUN device status ---"
        ls -la /dev/net/ 2>/dev/null || echo "Failed to list /dev/net/"

        echo "\n--- Process list ---"
        ps aux 2>/dev/null || echo "Failed to list processes"

        exit 1
    fi
else
    log "ERROR: Failed to start OpenVPN"
    cat /var/log/openvpn/openvpn.log 2>/dev/null || echo "No OpenVPN log file found"
    exit 1
fi

log "Configuring tinyproxy"

# Ensure log directory exists and has correct permissions
sudo mkdir -p /var/log/tinyproxy
sudo chown -R vpnuser:vpnuser /var/log/tinyproxy
sudo chmod -R 755 /var/log/tinyproxy

# Configure tinyproxy
cat > /tmp/tinyproxy.conf <<'EOF'
User vpnuser
Group vpnuser
Port 8888
Listen 0.0.0.0
Timeout 600
DefaultErrorFile "/usr/share/tinyproxy/default.html"
LogLevel Info
LogFile "/var/log/tinyproxy/tinyproxy.log"
ConnectPort 443
ConnectPort 80
Allow 0.0.0.0/0
EOF

# Move config to correct location with proper permissions
sudo mv /tmp/tinyproxy.conf /etc/tinyproxy/tinyproxy.conf
sudo chown vpnuser:vpnuser /etc/tinyproxy/tinyproxy.conf

# Run tinyproxy
log "Starting tinyproxy on port 8888"
exec tinyproxy -d -c /etc/tinyproxy/tinyproxy.conf
