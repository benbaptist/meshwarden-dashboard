// Package server assembles the dashboard's HTTP handler: REST API,
// WebSocket events, health endpoints and the PWA.
package server

import (
	"log/slog"
	"net/http"

	"google.golang.org/grpc/codes"

	"github.com/benbaptist/meshwarden-dashboard/internal/api"
	"github.com/benbaptist/meshwarden-dashboard/internal/config"
	"github.com/benbaptist/meshwarden-dashboard/internal/daemon"
	"github.com/benbaptist/meshwarden-dashboard/internal/events"
	"github.com/benbaptist/meshwarden-dashboard/web"
)

const (
	WSPath     = api.Prefix + "/ws"
	HealthPath = api.Prefix + "/health"
	// LivenessPath is unauthenticated and independent of the daemon, for
	// container health checks.
	LivenessPath = "/healthz"
)

// Health is the body of GET /api/v1/health.
type Health struct {
	Version      string        `json:"version"`
	DaemonTarget string        `json:"daemonTarget"`
	Status       events.Status `json:"status"`
}

func New(cfg config.Config, d *daemon.Client, hub *events.Hub, version string, log *slog.Logger) (http.Handler, error) {
	files, err := web.Files(cfg.WebDir)
	if err != nil {
		return nil, err
	}
	origins := newOriginPolicy(cfg.AllowedOrigins)

	mux := http.NewServeMux()
	for _, rt := range api.Routes(d, cfg.RPCTimeout) {
		mux.Handle(rt.Pattern, rt.Handler)
	}
	mux.Handle("GET "+WSPath, hub.Handler(origins.allowed))
	mux.HandleFunc("GET "+HealthPath, func(w http.ResponseWriter, r *http.Request) {
		api.WriteJSON(w, http.StatusOK, Health{
			Version:      version,
			DaemonTarget: cfg.Daemon.Target(),
			Status:       hub.Status(),
		})
	})
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		api.WriteError(w, codes.NotFound, "no route for "+r.Method+" "+r.URL.Path)
	})
	mux.HandleFunc("GET "+LivenessPath, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok\n"))
	})
	mux.Handle("/", web.Handler(files))

	return logRequests(log, origins.middleware(requireToken(cfg.Token, mux))), nil
}
