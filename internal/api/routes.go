// Package api exposes the daemon's unary gRPC methods as a JSON REST API.
// Live events (the StreamEvents RPC) are served over WebSocket by package
// events.
package api

import (
	"context"
	"net/http"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/protobuf/proto"

	"github.com/benbaptist/meshwarden-dashboard/internal/daemon"
)

// Prefix is the root of every API route.
const Prefix = "/api/v1"

// Route is one REST endpoint bound to one daemon RPC.
type Route struct {
	Pattern string // http.ServeMux pattern, e.g. "GET /api/v1/status"
	Handler http.Handler
}

// Routes returns the REST endpoints. Path wildcards are named after the
// request message's json field names so bind can fill them generically.
func Routes(c *daemon.Client, timeout time.Duration) []Route {
	r := func(pattern string, h http.Handler) Route { return Route{pattern, h} }
	return []Route{
		// Daemon & device status
		r("GET "+Prefix+"/status", rpc(timeout, c.GetStatus)),
		r("GET "+Prefix+"/device/info", rpc(timeout, c.GetDeviceInfo)),
		r("GET "+Prefix+"/device/self", rpc(timeout, c.GetSelfInfo)),
		r("GET "+Prefix+"/device/battery", rpc(timeout, c.GetBattery)),
		r("GET "+Prefix+"/device/stats", rpc(timeout, c.GetDeviceStats)),

		// Device configuration
		r("PUT "+Prefix+"/device/name", rpc(timeout, c.SetName)),
		r("PUT "+Prefix+"/device/radio", rpc(timeout, c.SetRadio)),
		r("PUT "+Prefix+"/device/tx-power", rpc(timeout, c.SetTxPower)),
		r("PUT "+Prefix+"/device/coords", rpc(timeout, c.SetCoords)),
		r("PUT "+Prefix+"/device/time", rpc(timeout, c.SetTime)),
		r("POST "+Prefix+"/device/advert", rpc(timeout, c.SendAdvert)),
		r("POST "+Prefix+"/device/reboot", rpc(timeout, c.Reboot)),
		r("POST "+Prefix+"/device/raw", rpc(timeout, c.SendRawCommand)),

		// Contacts
		r("GET "+Prefix+"/contacts", rpc(timeout, c.ListContacts)),
		r("POST "+Prefix+"/contacts/sync", rpc(timeout, c.SyncContacts)),
		r("DELETE "+Prefix+"/contacts/{publicKey}", rpc(timeout, c.RemoveContact)),
		r("POST "+Prefix+"/contacts/{publicKey}/ping", rpc(timeout, c.Ping)),

		// Messaging
		r("GET "+Prefix+"/messages", rpc(timeout, c.ListMessages)),
		r("POST "+Prefix+"/messages", rpc(timeout, c.SendMessage)),
		r("GET "+Prefix+"/channels", rpc(timeout, c.ListChannels)),
		r("POST "+Prefix+"/channels/{channelIdx}/messages", rpc(timeout, c.SendChannelMessage)),
		r("POST "+Prefix+"/channels/backfill", rpc(timeout, c.BackfillMessageChannels)),

		// Packet log & statistics
		r("GET "+Prefix+"/packets", rpc(timeout, c.QueryPackets)),
		r("GET "+Prefix+"/packets/stats", rpc(timeout, c.GetPacketStats)),

		// Proxy introspection
		r("GET "+Prefix+"/proxy", rpc(timeout, c.GetProxyStatus)),
	}
}

// rpc adapts a generated unary client method to an HTTP handler: bind the
// request, call the daemon, encode the response.
func rpc[Req any, PReq interface {
	*Req
	proto.Message
}, Resp proto.Message](timeout time.Duration, call func(context.Context, PReq, ...grpc.CallOption) (Resp, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := PReq(new(Req))
		if err := bind(w, r, req); err != nil {
			WriteError(w, codes.InvalidArgument, err.Error())
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		resp, err := call(ctx, req)
		if err != nil {
			writeRPCError(w, err)
			return
		}
		writeMessage(w, resp)
	}
}
