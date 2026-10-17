// Command meshwarden-dashboard serves the Meshwarden PWA and bridges it to
// meshwarden-daemon over gRPC (REST for commands, WebSocket for live events).
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/benbaptist/meshwarden-dashboard/internal/config"
	"github.com/benbaptist/meshwarden-dashboard/internal/daemon"
	"github.com/benbaptist/meshwarden-dashboard/internal/events"
	"github.com/benbaptist/meshwarden-dashboard/internal/server"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	healthcheck := flag.Bool("healthcheck", false, "probe the local "+server.LivenessPath+" endpoint and exit (container HEALTHCHECK)")
	flag.Parse()

	if err := run(*healthcheck); err != nil {
		fmt.Fprintln(os.Stderr, "meshwarden-dashboard:", err)
		os.Exit(1)
	}
}

func run(healthcheck bool) error {
	// .env is optional; variables already in the environment take precedence.
	if err := godotenv.Load(); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf(".env: %w", err)
	}
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	if healthcheck {
		return probe(cfg)
	}

	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: cfg.LogLevel}))
	if cfg.Token == "" {
		log.Warn("MESHWARDEN_DASHBOARD_TOKEN is not set; the API is open to anyone who can reach " + cfg.Listen)
	}

	d, err := daemon.Dial(cfg.Daemon)
	if err != nil {
		return err
	}
	defer d.Close()

	hub := events.NewHub(d, log)
	handler, err := server.New(cfg, d, hub, version, log)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	hubDone := make(chan struct{})
	go func() {
		hub.Run(ctx)
		close(hubDone)
	}()

	srv := &http.Server{Addr: cfg.Listen, Handler: handler, ReadHeaderTimeout: 10 * time.Second}
	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.ListenAndServe() }()
	log.Info("meshwarden-dashboard started", "version", version, "listen", cfg.Listen, "daemon", cfg.Daemon.Target())

	select {
	case err := <-serveErr:
		stop()
		<-hubDone
		return err
	case <-ctx.Done():
	}

	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	err = srv.Shutdown(shutdownCtx)
	<-hubDone
	return err
}

func probe(cfg config.Config) error {
	base, err := cfg.LocalURL()
	if err != nil {
		return err
	}
	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(base + server.LivenessPath)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s returned %s", server.LivenessPath, resp.Status)
	}
	return nil
}
