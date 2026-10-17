package server_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/proto"

	"github.com/benbaptist/meshwarden-dashboard/internal/api"
	"github.com/benbaptist/meshwarden-dashboard/internal/config"
	"github.com/benbaptist/meshwarden-dashboard/internal/daemon"
	"github.com/benbaptist/meshwarden-dashboard/internal/events"
	"github.com/benbaptist/meshwarden-dashboard/internal/pb"
	"github.com/benbaptist/meshwarden-dashboard/internal/server"
)

type fakeDaemon struct {
	pb.UnimplementedMeshCoreDaemonServer
	events chan *pb.DaemonEvent
}

func (f *fakeDaemon) GetStatus(context.Context, *pb.Empty) (*pb.StatusResponse, error) {
	return &pb.StatusResponse{DeviceConnected: true, ConnectedSince: 1 << 33, DaemonVersion: "1.2.3"}, nil
}

func (f *fakeDaemon) GetDeviceInfo(context.Context, *pb.Empty) (*pb.JsonResponse, error) {
	return &pb.JsonResponse{Json: `{"model":"T-Beam"}`}, nil
}

func (f *fakeDaemon) ListMessages(context.Context, *pb.ListMessagesRequest) (*pb.ListMessagesResponse, error) {
	return &pb.ListMessagesResponse{Total: 0}, nil
}

func (f *fakeDaemon) RemoveContact(context.Context, *pb.RemoveContactRequest) (*pb.CommandResult, error) {
	return &pb.CommandResult{Ok: true}, nil
}

func (f *fakeDaemon) SendChannelMessage(context.Context, *pb.SendChannelMessageRequest) (*pb.SendMessageResponse, error) {
	return &pb.SendMessageResponse{Ok: true, MessageId: 9}, nil
}

func (f *fakeDaemon) GetBattery(context.Context, *pb.Empty) (*pb.JsonResponse, error) {
	return nil, status.Error(codes.Unavailable, "device not connected")
}

func (f *fakeDaemon) StreamEvents(_ *pb.StreamEventsRequest, stream pb.MeshCoreDaemon_StreamEventsServer) error {
	for {
		select {
		case ev := <-f.events:
			if err := stream.Send(ev); err != nil {
				return err
			}
		case <-stream.Context().Done():
			return nil
		}
	}
}

// calls records the last request seen for each gRPC method.
type calls struct {
	mu   sync.Mutex
	last map[string]proto.Message
}

func (c *calls) intercept(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	c.mu.Lock()
	c.last[info.FullMethod] = proto.Clone(req.(proto.Message))
	c.mu.Unlock()
	return handler(ctx, req)
}

func (c *calls) get(method string) proto.Message {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.last["/meshcored.v1.MeshCoreDaemon/"+method]
}

type harness struct {
	url    string
	fake   *fakeDaemon
	calls  *calls
	daemon *daemon.Client
}

func newHarness(t *testing.T, cfg config.Config) *harness {
	t.Helper()
	lis := bufconn.Listen(1 << 20)
	rec := &calls{last: map[string]proto.Message{}}
	gs := grpc.NewServer(grpc.UnaryInterceptor(rec.intercept))
	fake := &fakeDaemon{events: make(chan *pb.DaemonEvent)}
	pb.RegisterMeshCoreDaemonServer(gs, fake)
	hs := health.NewServer()
	hs.SetServingStatus(daemon.DeviceHealthService, healthpb.HealthCheckResponse_SERVING)
	healthpb.RegisterHealthServer(gs, hs)
	go func() { _ = gs.Serve(lis) }()

	conn, err := grpc.NewClient("passthrough:///bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) { return lis.DialContext(ctx) }),
		grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	d := daemon.New(conn)
	log := slog.New(slog.DiscardHandler)
	hub := events.NewHub(d, log)
	ctx, cancel := context.WithCancel(context.Background())
	hubDone := make(chan struct{})
	go func() { hub.Run(ctx); close(hubDone) }()

	if cfg.RPCTimeout == 0 {
		cfg.RPCTimeout = 5 * time.Second
	}
	cfg.Daemon = config.Daemon{Host: "bufnet", Port: 1}
	h, err := server.New(cfg, d, hub, "test", log)
	if err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(h)
	t.Cleanup(func() {
		cancel()
		<-hubDone
		ts.Close()
		_ = d.Close()
		gs.Stop()
	})
	return &harness{url: ts.URL, fake: fake, calls: rec, daemon: d}
}

func do(t *testing.T, method, url, body string, hdr map[string]string) (int, map[string]any, http.Header) {
	t.Helper()
	req, err := http.NewRequest(method, url, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var out map[string]any
	if strings.HasPrefix(resp.Header.Get("Content-Type"), "application/json") {
		if err := json.Unmarshal(raw, &out); err != nil {
			t.Fatalf("%s %s: bad JSON %q", method, url, raw)
		}
	}
	return resp.StatusCode, out, resp.Header
}

// Every unary RPC must be reachable through a REST route, and every
// streaming RPC through the WebSocket.
func TestRoutesCoverEveryRPC(t *testing.T) {
	h := newHarness(t, config.Config{})
	wildcard := regexp.MustCompile(`\{[^}]+\}`)
	for _, rt := range api.Routes(h.daemon, time.Second) {
		method, path, _ := strings.Cut(rt.Pattern, " ")
		do(t, method, h.url+wildcard.ReplaceAllString(path, "1"), "", nil)
	}
	for _, m := range pb.MeshCoreDaemon_ServiceDesc.Methods {
		if h.calls.get(m.MethodName) == nil {
			t.Errorf("RPC %s has no REST route", m.MethodName)
		}
	}
	for _, s := range pb.MeshCoreDaemon_ServiceDesc.Streams {
		if s.StreamName != "StreamEvents" {
			t.Errorf("streaming RPC %s is not exposed", s.StreamName)
		}
	}
}

func TestREST(t *testing.T) {
	h := newHarness(t, config.Config{})

	st, body, _ := do(t, "GET", h.url+"/api/v1/status", "", nil)
	if st != 200 || body["connectedSince"] != float64(1<<33) || body["daemonVersion"] != "1.2.3" || body["proxyClients"] != float64(0) {
		t.Errorf("status: %d %v", st, body)
	}

	_, body, _ = do(t, "GET", h.url+"/api/v1/device/info", "", nil)
	if inner, _ := body["json"].(map[string]any); inner["model"] != "T-Beam" {
		t.Errorf("device info JSON should be inlined: %v", body)
	}

	st, _, _ = do(t, "GET", h.url+"/api/v1/messages?peer=ab&channelIdx=0&limit=5", "", nil)
	got := h.calls.get("ListMessages").(*pb.ListMessagesRequest)
	if st != 200 || got.Peer != "ab" || got.ChannelIdx == nil || *got.ChannelIdx != 0 || got.Limit != 5 || got.ChannelId != nil {
		t.Errorf("query binding: %d %v", st, got)
	}

	do(t, "DELETE", h.url+"/api/v1/contacts/abcdef", "", nil)
	if got := h.calls.get("RemoveContact").(*pb.RemoveContactRequest); got.PublicKey != "abcdef" {
		t.Errorf("path binding: %v", got)
	}

	st, body, _ = do(t, "POST", h.url+"/api/v1/channels/3/messages", `{"text":"hello"}`, nil)
	if got := h.calls.get("SendChannelMessage").(*pb.SendChannelMessageRequest); st != 200 || got.ChannelIdx != 3 || got.Text != "hello" || body["messageId"] != float64(9) {
		t.Errorf("body+path binding: %d %v %v", st, got, body)
	}
}

func TestErrors(t *testing.T) {
	h := newHarness(t, config.Config{})
	for _, tc := range []struct {
		method, path, body string
		status             int
		code               string
	}{
		{"GET", "/api/v1/device/battery", "", 503, "Unavailable"},
		{"GET", "/api/v1/messages?bogus=1", "", 400, "InvalidArgument"},
		{"POST", "/api/v1/messages", `{"nope":1}`, 400, "InvalidArgument"},
		{"POST", "/api/v1/messages", `not json`, 400, "InvalidArgument"},
		{"GET", "/api/v1/contacts?limit=-1", "", 400, "InvalidArgument"},
		{"GET", "/api/v1/nope", "", 404, "NotFound"},
	} {
		st, body, _ := do(t, tc.method, h.url+tc.path, tc.body, nil)
		if st != tc.status || body["code"] != tc.code || body["message"] == "" {
			t.Errorf("%s %s: got %d %v, want %d %s", tc.method, tc.path, st, body, tc.status, tc.code)
		}
	}
}

func TestAuth(t *testing.T) {
	h := newHarness(t, config.Config{Token: "s3cret"})
	if st, body, _ := do(t, "GET", h.url+"/api/v1/status", "", nil); st != 401 || body["code"] != "Unauthenticated" {
		t.Errorf("no token: %d %v", st, body)
	}
	if st, _, _ := do(t, "GET", h.url+"/api/v1/status", "", map[string]string{"Authorization": "Bearer wrong"}); st != 401 {
		t.Errorf("wrong token: %d", st)
	}
	if st, _, _ := do(t, "GET", h.url+"/api/v1/status", "", map[string]string{"Authorization": "Bearer s3cret"}); st != 200 {
		t.Errorf("good token: %d", st)
	}
	if st, _, _ := do(t, "GET", h.url+"/api/v1/status?access_token=s3cret", "", nil); st != 401 {
		t.Errorf("query token must only work for the WebSocket: %d", st)
	}
	if st, _, _ := do(t, "GET", h.url+"/", "", nil); st != 200 {
		t.Errorf("static files are public: %d", st)
	}
	if st, _, _ := do(t, "GET", h.url+"/healthz", "", nil); st != 200 {
		t.Errorf("liveness is public: %d", st)
	}

	wsURL := "ws" + strings.TrimPrefix(h.url, "http") + server.WSPath
	if _, resp, err := websocket.DefaultDialer.Dial(wsURL, nil); err == nil || resp.StatusCode != 401 {
		t.Errorf("ws without token should be rejected")
	}
	conn, _, err := websocket.DefaultDialer.Dial(wsURL+"?access_token=s3cret", nil)
	if err != nil {
		t.Fatalf("ws with token: %v", err)
	}
	conn.Close()
}

func TestOrigins(t *testing.T) {
	h := newHarness(t, config.Config{AllowedOrigins: []string{"https://app.example"}})

	if st, body, _ := do(t, "POST", h.url+"/api/v1/device/reboot", "", map[string]string{"Origin": "https://evil.example"}); st != 403 || body["code"] != "PermissionDenied" {
		t.Errorf("foreign origin: %d %v", st, body)
	}
	if st, _, _ := do(t, "GET", h.url+"/api/v1/status", "", map[string]string{"Origin": h.url}); st != 200 {
		t.Errorf("same origin: %d", st)
	}
	st, _, hdr := do(t, "OPTIONS", h.url+"/api/v1/messages", "", map[string]string{
		"Origin": "https://app.example", "Access-Control-Request-Method": "POST",
	})
	if st != 204 || hdr.Get("Access-Control-Allow-Origin") != "https://app.example" || !strings.Contains(hdr.Get("Access-Control-Allow-Headers"), "Authorization") {
		t.Errorf("preflight: %d %v", st, hdr)
	}

	wsURL := "ws" + strings.TrimPrefix(h.url, "http") + server.WSPath
	if _, _, err := websocket.DefaultDialer.Dial(wsURL, http.Header{"Origin": {"https://evil.example"}}); err == nil {
		t.Errorf("ws from foreign origin should be rejected")
	}
}

func TestHealth(t *testing.T) {
	h := newHarness(t, config.Config{})
	deadline := time.Now().Add(5 * time.Second)
	for {
		_, body, _ := do(t, "GET", h.url+server.HealthPath, "", nil)
		s, _ := body["status"].(map[string]any)
		if s["daemon"] == true && s["device"] == true {
			if body["version"] != "test" || body["daemonTarget"] != "bufnet:1" {
				t.Errorf("health: %v", body)
			}
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("daemon never reported healthy: %v", body)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

type wsMsg struct {
	Type   string         `json:"type"`
	Status *events.Status `json:"status"`
	Event  map[string]any `json:"event"`
	Types  []string       `json:"types"`
	Error  string         `json:"error"`
}

func read(t *testing.T, conn *websocket.Conn) wsMsg {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	var m wsMsg
	if err := conn.ReadJSON(&m); err != nil {
		t.Fatal(err)
	}
	return m
}

func TestWebSocket(t *testing.T) {
	h := newHarness(t, config.Config{})
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(h.url, "http")+server.WSPath, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	// The current status arrives first, then updates until the device is up.
	for {
		m := read(t, conn)
		if m.Type != events.MsgStatus {
			t.Fatalf("expected status, got %+v", m)
		}
		if m.Status.Daemon && m.Status.Device {
			break
		}
	}

	if err := conn.WriteJSON(map[string]any{"type": events.MsgSubscribe, "types": []string{"contact_message"}}); err != nil {
		t.Fatal(err)
	}
	if m := read(t, conn); m.Type != events.MsgSubscribed || len(m.Types) != 1 {
		t.Fatalf("expected subscribed, got %+v", m)
	}

	h.fake.events <- &pb.DaemonEvent{Type: "advertisement", Ts: 1, PayloadJson: `{}`}
	h.fake.events <- &pb.DaemonEvent{Type: "contact_message", Ts: 1 << 33, PayloadJson: `{"text":"hi"}`}
	m := read(t, conn)
	if m.Type != events.MsgEvent || m.Event["type"] != "contact_message" || m.Event["ts"] != float64(1<<33) {
		t.Fatalf("expected filtered contact_message event, got %+v", m)
	}
	if p, _ := m.Event["payloadJson"].(map[string]any); p["text"] != "hi" {
		t.Errorf("payload should be inlined: %+v", m.Event)
	}

	if err := conn.WriteJSON(map[string]any{"type": "bogus"}); err != nil {
		t.Fatal(err)
	}
	if m := read(t, conn); m.Type != events.MsgError || m.Error == "" {
		t.Errorf("expected error, got %+v", m)
	}
}

func TestStatic(t *testing.T) {
	h := newHarness(t, config.Config{})
	for path, want := range map[string]int{
		"/":                200,
		"/contacts/abc":    200, // SPA route falls back to index.html
		"/missing.js":      404,
		"/healthz":         200,
		"/api/v1/whatever": 404,
	} {
		resp, err := http.Get(h.url + path)
		if err != nil {
			t.Fatal(err)
		}
		b, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != want {
			t.Errorf("%s: got %d, want %d", path, resp.StatusCode, want)
		}
		if want == 200 && path != "/healthz" && !strings.Contains(string(b), "Meshwarden Dashboard") {
			t.Errorf("%s: expected index.html, got %q", path, b)
		}
	}
}
