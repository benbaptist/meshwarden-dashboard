// Package events relays the daemon's live event stream and connectivity
// status to WebSocket clients.
//
// The hub holds a single upstream StreamEvents call (all event types) and a
// gRPC health watch on the device service, both reconnecting with backoff,
// and fans them out to every connected client.
package events

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"github.com/benbaptist/meshwarden-dashboard/internal/daemon"
	"github.com/benbaptist/meshwarden-dashboard/internal/pb"
	"github.com/benbaptist/meshwarden-dashboard/internal/wire"
)

// Status is the dashboard's live view of upstream connectivity.
type Status struct {
	Daemon bool `json:"daemon"` // daemon reachable over gRPC
	Device bool `json:"device"` // daemon reports the MeshCore node connected
}

// Server -> client message types.
const (
	MsgStatus     = "status"     // {"type","status":Status}; sent on connect and on change
	MsgEvent      = "event"      // {"type","event":DaemonEvent}
	MsgSubscribed = "subscribed" // {"type","types":[...]}; reply to subscribe
	MsgError      = "error"      // {"type","error":"..."}
)

// Client -> server message types.
const (
	MsgSubscribe = "subscribe" // {"type","types":[...]}; empty = all events
)

type message struct {
	Type   string         `json:"type"`
	Status *Status        `json:"status,omitempty"`
	Event  map[string]any `json:"event,omitempty"`
	Types  []string       `json:"types,omitempty"`
	Error  string         `json:"error,omitempty"`
}

func encode(m message) []byte {
	b, err := json.Marshal(m)
	if err != nil {
		panic(err) // message only holds JSON-safe values
	}
	return b
}

type Hub struct {
	daemon *daemon.Client
	log    *slog.Logger

	mu      sync.RWMutex
	clients map[*client]struct{}
	status  Status
}

func NewHub(d *daemon.Client, log *slog.Logger) *Hub {
	return &Hub{daemon: d, log: log, clients: map[*client]struct{}{}}
}

// Run maintains the upstream streams until ctx is done, then disconnects
// every client.
func (h *Hub) Run(ctx context.Context) {
	var wg sync.WaitGroup
	wg.Go(func() { retry(ctx, h.log, "health", h.watchHealth) })
	wg.Go(func() { retry(ctx, h.log, "events", h.streamEvents) })
	wg.Wait()

	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		c.close()
	}
}

func (h *Hub) Status() Status {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.status
}

func (h *Hub) setStatus(s Status) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if s == h.status {
		return
	}
	h.status = s
	h.log.Info("upstream status", "daemon", s.Daemon, "device", s.Device)
	b := encode(message{Type: MsgStatus, Status: &s})
	for c := range h.clients {
		c.enqueue(b)
	}
}

func (h *Hub) broadcastEvent(ev *pb.DaemonEvent) {
	b := encode(message{Type: MsgEvent, Event: wire.Value(ev)})
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if c.wants(ev.GetType()) {
			c.enqueue(b)
		}
	}
}

// add registers c and queues the current status as its first message; both
// happen under the lock so no status change can slip in between.
func (h *Hub) add(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = struct{}{}
	s := h.status
	c.enqueue(encode(message{Type: MsgStatus, Status: &s}))
}

func (h *Hub) remove(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, c)
}

func (h *Hub) watchHealth(ctx context.Context) error {
	defer h.setStatus(Status{})
	stream, err := h.daemon.Health.Watch(ctx, &healthpb.HealthCheckRequest{Service: daemon.DeviceHealthService})
	if err != nil {
		return err
	}
	for {
		resp, err := stream.Recv()
		if err != nil {
			return err
		}
		h.setStatus(Status{Daemon: true, Device: resp.GetStatus() == healthpb.HealthCheckResponse_SERVING})
	}
}

func (h *Hub) streamEvents(ctx context.Context) error {
	stream, err := h.daemon.StreamEvents(ctx, &pb.StreamEventsRequest{})
	if err != nil {
		return err
	}
	for {
		ev, err := stream.Recv()
		if err != nil {
			return err
		}
		h.broadcastEvent(ev)
	}
}

const (
	minBackoff = time.Second
	maxBackoff = 30 * time.Second
)

// retry runs fn until ctx is done, backing off exponentially between
// failures. A run that lasted longer than maxBackoff resets the backoff.
func retry(ctx context.Context, log *slog.Logger, name string, fn func(context.Context) error) {
	backoff := minBackoff
	for {
		started := time.Now()
		err := fn(ctx)
		if ctx.Err() != nil {
			return
		}
		if time.Since(started) > maxBackoff {
			backoff = minBackoff
		}
		log.Warn("upstream stream ended", "stream", name, "err", err, "retry_in", backoff)
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, maxBackoff)
	}
}
