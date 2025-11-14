# Dockerfile
FROM alpine:3.18

# Install required packages and debugging tools
RUN apk add --no-cache \
    openvpn \
    tinyproxy \
    iproute2 \
    curl \
    bash \
    sudo \
    iptables \
    procps \
    net-tools \
    iputils \
    tcpdump \
    && rm -rf /var/cache/apk/*

# Create non-root user with passwordless sudo
RUN adduser -D -u 1000 vpnuser && \
    echo 'vpnuser ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/vpnuser && \
    chmod 0440 /etc/sudoers.d/vpnuser

# Create necessary directories and set permissions
RUN mkdir -p /var/log/tinyproxy /var/log/openvpn /run/openvpn /var/run/tinyproxy /dev/net && \
    touch /dev/net/tun && \
    chmod 666 /dev/net/tun && \
    chown -R vpnuser:vpnuser /var/log/tinyproxy /var/log/openvpn /run/openvpn /var/run/tinyproxy && \
    chmod 755 /var/log/openvpn /run/openvpn

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose tinyproxy port
EXPOSE 8888

# VPN config mountpoint
VOLUME ["/vpn"]

# Switch to non-root user
USER vpnuser

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:8888/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
