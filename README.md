# Play with Docker

A collection of Docker-based playgrounds for experimenting with different stacks and workflows. Each playground lives in its own top-level directory so multiple projects can coexist side by side.

## Repository layout

```
.
├── vpn/        # OpenVPN + tinyproxy playground (described below)
└── README.md
```

## Available playgrounds

| Directory | Description |
|-----------|-------------|
| `vpn/`    | Runs an OpenVPN client and exposes tinyproxy so local applications can send traffic through the VPN tunnel. |


## Workflow

1. Pick or create a playground directory at the repository root.
2. Read that playground’s README section for prerequisites.
3. Build and run the Docker resources defined inside the playground.
4. Iterate freely—each playground is isolated from the others.

---

## VPN playground

The `vpn/` directory contains a containerised OpenVPN client paired with tinyproxy, enabling HTTP(S) traffic to exit through your VPN provider.

### Prerequisites

- macOS / Linux host with Docker Engine + Compose v2 (Docker Desktop includes both).
- Permission to access `/dev/net/tun` (the compose file adds `NET_ADMIN` and mounts the TUN device).
- An OpenVPN profile and credentials from your provider (tested with Proton VPN):
  - Rename the profile you want to use to `client.ovpn`.
  - Optionally create `auth.txt` with username on line 1 and password on line 2 when the profile references `auth-user-pass`.

### Image and package rationale

- **Base image – `alpine:3.18`:** lightweight, security-focused distribution with musl libc, keeping the final image small while giving access to OpenVPN packages maintained by Alpine.
- **Core services:**
  - `openvpn` provides the VPN client.
  - `tinyproxy` exposes an HTTP/HTTPS proxy that rides the tunnel.
- **Networking & diagnostics:** `iproute2`, `net-tools`, `iputils`, and `tcpdump` aid in routing inspection and packet captures when debugging connectivity.

### Prepare configuration files

Place provider assets inside the VPN playground’s config mount:

```
vpn/config/
├── client.ovpn   # required
└── auth.txt      # optional (if the profile references auth-user-pass)
```

> Sensitive files under `config/` are gitignored by default.

### Build and start the proxy container

```bash
cd vpn
docker compose up --build -d
# or use the helper script:
./scripts/start-vpn-proxy.sh
```

- The compose file defaults to `network_mode: "host"` so OpenVPN can adjust host routes and tinyproxy listens directly on port `8888`.
- Logs are written to `vpn/logs/` inside the container and exposed via `docker compose logs vpn-proxy`.

### Verifying the tunnel

1. Tail logs until you see `Initialization Sequence Completed` and `[vpn-entrypoint] tun0 detected`.
2. Confirm the tunnel interface and routing rules:
   ```bash
   docker exec vpn-proxy ip addr show tun0
   docker exec vpn-proxy ip route
   ```
3. Check the egress IP from inside the container:
   ```bash
   docker exec vpn-proxy curl --silent https://ifconfig.me
   ```
4. Compare to the host’s IP without the proxy to verify traffic is being tunnelled.

### Using the proxy

- **CLI:**
  ```bash
  curl --proxy http://127.0.0.1:8888 https://ifconfig.me
  ```
- **Safari / macOS browsers:** System Settings → Network → Details → Proxies → enable **Web Proxy (HTTP)** and **Secure Web Proxy (HTTPS)** pointing to `127.0.0.1` port `8888`. Remember to disable these checkboxes when you stop the container.
- **Other browsers:** configure an HTTP proxy at `127.0.0.1:8888`; HTTPS typically reuses the same proxy.

### Stopping and cleaning up

```bash
docker compose down
```

Stopping the container tears down OpenVPN and tinyproxy, but any proxy settings you toggled in macOS or your browser remain active until you turn them off.

### Troubleshooting

- **`tun0` never appears:** ensure `/dev/net/tun` is accessible and your `client.ovpn` is valid. The entrypoint will emit `[vpn-entrypoint] ERROR` messages and dump diagnostics if the tunnel fails to initialise.
- **Still seeing the same public IP:** your host may already be routed through the VPN (expected when running in host network mode) or the provider’s endpoint is geographically close to you. Swap profiles if you need a different egress region.
- **No traffic when the container is down:** remove or disable system/browser proxy settings so apps stop pointing at `127.0.0.1:8888`.
