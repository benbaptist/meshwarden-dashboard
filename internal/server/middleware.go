package server

import (
	"bufio"
	"crypto/subtle"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"google.golang.org/grpc/codes"

	"github.com/benbaptist/meshwarden-dashboard/internal/api"
)

func isAPI(r *http.Request) bool { return strings.HasPrefix(r.URL.Path, "/api/") }

// requireToken enforces the bearer token on /api/ when token is set.
// Browsers can't set headers on WebSocket handshakes, so the WebSocket path
// also accepts ?access_token=.
func requireToken(token string, next http.Handler) http.Handler {
	if token == "" {
		return next
	}
	want := []byte(token)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isAPI(r) {
			next.ServeHTTP(w, r)
			return
		}
		got, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok && r.URL.Path == WSPath {
			got = r.URL.Query().Get("access_token")
		}
		if subtle.ConstantTimeCompare([]byte(got), want) != 1 {
			api.WriteError(w, codes.Unauthenticated, "missing or invalid bearer token")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// originPolicy decides which browser origins may use the API and WebSocket.
// Same-origin is always allowed; others must be configured.
type originPolicy struct {
	any     bool
	origins map[string]bool
}

func newOriginPolicy(origins []string) originPolicy {
	p := originPolicy{origins: map[string]bool{}}
	for _, o := range origins {
		if o == "*" {
			p.any = true
		}
		p.origins[strings.TrimSuffix(o, "/")] = true
	}
	return p
}

// allowed also serves as the WebSocket upgrader's CheckOrigin.
func (p originPolicy) allowed(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true // not a browser cross-origin request
	}
	if u, err := url.Parse(origin); err == nil && strings.EqualFold(u.Host, r.Host) {
		return true
	}
	return p.any || p.origins[origin]
}

// middleware rejects /api/ requests from disallowed origins (which also
// blocks cross-site request forgery when no token is configured) and adds
// CORS headers for allowed cross-origin callers.
func (p originPolicy) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if !isAPI(r) || origin == "" {
			next.ServeHTTP(w, r)
			return
		}
		if !p.allowed(r) {
			api.WriteError(w, codes.PermissionDenied, "origin "+origin+" is not allowed")
			return
		}
		h := w.Header()
		h.Add("Vary", "Origin")
		h.Set("Access-Control-Allow-Origin", origin)
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
			h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			h.Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// logRequests logs API requests at info and everything else at debug.
func logRequests(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &recorder{ResponseWriter: w}
		next.ServeHTTP(rec, r)
		level := slog.LevelDebug
		if isAPI(r) {
			level = slog.LevelInfo
		}
		log.Log(r.Context(), level, "http",
			"method", r.Method, "path", r.URL.Path, "status", rec.status,
			"duration", time.Since(start).Round(time.Millisecond), "remote", r.RemoteAddr)
	})
}

type recorder struct {
	http.ResponseWriter
	status int
}

func (r *recorder) WriteHeader(status int) {
	if r.status == 0 {
		r.status = status
	}
	r.ResponseWriter.WriteHeader(status)
}

func (r *recorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	return r.ResponseWriter.Write(b)
}

// Hijack is required by the WebSocket upgrader.
func (r *recorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	r.status = http.StatusSwitchingProtocols
	return http.NewResponseController(r.ResponseWriter).Hijack()
}

func (r *recorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }
