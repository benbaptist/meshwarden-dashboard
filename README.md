# meshwarden-dashboard

Web dashboard for [meshwarden-daemon](https://github.com/benbaptist/meshwarden-daemon).
A single Go binary that serves the dashboard PWA and bridges it to the
daemon's gRPC API: a JSON REST API for commands and queries, and a WebSocket
for live events.

```
browser (PWA) ──HTTP/WS──▶ meshwarden-dashboard ──gRPC──▶ meshwarden-daemon ──▶ MeshCore node
```

## Running

### With Docker

```sh
cp .env.example .env   # optional; set MESHWARDEN_DASHBOARD_TOKEN at least
docker compose up -d --build
```

Compose points the dashboard at the daemon on the Docker host
(`host.docker.internal:50051`). If the daemon runs as the `meshcored`
container on a shared network, set `MESHWARDEN_HOST=meshcored`.

### Without Docker

```sh
make build && bin/meshwarden-dashboard   # or: go run ./cmd/meshwarden-dashboard
```

Configuration is environment-only, optionally from a `.env` file in the
working directory; see [.env.example](.env.example). The daemon connection
uses the same `MESHWARDEN_HOST` / `MESHWARDEN_PORT` / `MESHWARDEN_TLS`
variables as meshwarden-cli.

## Documentation

API reference, PWA build notes and development instructions are in
[DEVELOPMENT.md](DEVELOPMENT.md).

## Vibecoded

This project was mostly written by AI coding agents as an experiment in
vibecoding. It works for me, but it hasn't had careful human review, so treat
it accordingly and read the code before trusting it with anything important.
