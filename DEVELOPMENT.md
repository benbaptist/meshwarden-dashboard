# Development

## API

All routes live under `/api/v1`. When `MESHWARDEN_DASHBOARD_TOKEN` is set,
send `Authorization: Bearer <token>` (the WebSocket also accepts
`?access_token=<token>`, since browsers can't set handshake headers).

| Method | Path | Daemon RPC |
|---|---|---|
| GET | `/status` | GetStatus |
| GET | `/device/info` | GetDeviceInfo |
| GET | `/device/self` | GetSelfInfo |
| GET | `/device/battery` | GetBattery |
| GET | `/device/stats` | GetDeviceStats |
| PUT | `/device/name` | SetName |
| PUT | `/device/radio` | SetRadio |
| PUT | `/device/tx-power` | SetTxPower |
| PUT | `/device/coords` | SetCoords |
| PUT | `/device/time` | SetTime |
| POST | `/device/advert` | SendAdvert |
| POST | `/device/reboot` | Reboot |
| POST | `/device/raw` | SendRawCommand |
| GET | `/contacts` | ListContacts |
| POST | `/contacts/sync` | SyncContacts |
| DELETE | `/contacts/{publicKey}` | RemoveContact |
| POST | `/contacts/{publicKey}/ping` | Ping |
| GET | `/messages` | ListMessages |
| POST | `/messages` | SendMessage |
| GET | `/channels` | ListChannels |
| POST | `/channels/{channelIdx}/messages` | SendChannelMessage |
| POST | `/channels/backfill` | BackfillMessageChannels |
| GET | `/packets` | QueryPackets |
| GET | `/packets/stats` | GetPacketStats |
| GET | `/proxy` | GetProxyStatus |
| GET | `/health` | dashboard version + live daemon/device status |
| GET | `/ws` | WebSocket (StreamEvents + status) |

`GET /healthz` (outside `/api`, unauthenticated) is a liveness probe for the
dashboard process itself.

**Requests.** Each route takes the RPC's request message, as query
parameters, a JSON body, or both. Path wildcards fill the field of the same
name. Field names are the proto JSON names (`channelIdx`; `channel_idx` is
also accepted). Unknown fields are rejected. For example,
`GET /api/v1/messages?peer=80992e&limit=50` or
`POST /api/v1/channels/0/messages` with `{"text": "hello"}`.

**Responses.** The RPC's response message as JSON, with camelCase field names
and every field present (unset `optional` fields are omitted). Two
differences from the standard proto JSON mapping make it easier for browsers:
64-bit integers are numbers, and string fields carrying JSON (`json`,
`payloadJson`) are inlined as JSON values (or `null`). Device commands report
failure in-band (`{"ok": false, "error": "..."}`) with HTTP 200.

**Errors.** `{"code": "<gRPC code>", "message": "..."}` with a matching HTTP
status. For example, `Unavailable` returns 503 when the daemon or device is
down, `InvalidArgument` returns 400, and `DeadlineExceeded` returns 504.

### WebSocket `/api/v1/ws`

The dashboard keeps one event stream open to the daemon and fans it out to
every client. Messages are JSON objects with a `type`:

| Direction | Message |
|---|---|
| server → client | `{"type":"status","status":{"daemon":bool,"device":bool}}`, sent on connect and on every change |
| server → client | `{"type":"event","event":{"type":"...","ts":0,"payloadJson":{...}}}` |
| client → server | `{"type":"subscribe","types":["contact_message", ...]}`. Empty or omitted means all events, which is the default |
| server → client | `{"type":"subscribed","types":[...]}` |
| server → client | `{"type":"error","error":"..."}` |

Events that happen while the daemon is unreachable are lost. When `status`
goes back to `daemon: true`, refetch state over REST. A client that falls too
far behind is disconnected and should reconnect.

### Browser origins

Same-origin requests are always allowed. Other origins must be listed in
`MESHWARDEN_DASHBOARD_ALLOWED_ORIGINS`. They get CORS headers, and the
WebSocket accepts them. Requests to `/api/` from any other origin are rejected.

## PWA

The PWA build output goes in `web/dist/`, which is embedded into the binary
(it currently holds a placeholder page). Unknown extension-less paths fall
back to `index.html` for client-side routing. During development, set
`MESHWARDEN_DASHBOARD_WEB_DIR` to serve a build directory from disk instead.

## Development

The gRPC definition lives in the shared `meshwarden-protos` repo, included as
a git submodule at `protos/`. Clone with `--recurse-submodules` (or run
`git submodule update --init`). After changing the proto, regenerate the
committed Go stubs in `internal/pb`:

```sh
make proto   # needs protoc; or PROTOC="python -m grpc_tools.protoc" make proto
```

Every unary RPC needs a route in [internal/api/routes.go](internal/api/routes.go).
`make test` fails otherwise.

```sh
make test     # go vet + go test -race
make docker   # build the image
```
