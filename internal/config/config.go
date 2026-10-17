// Package config loads dashboard settings from the environment.
package config

import (
	"fmt"
	"log/slog"
	"net"
	"os"
	"strconv"
	"strings"
	"time"
)

// Daemon holds the gRPC connection settings. The variable names are shared
// with meshwarden-cli so one environment configures both.
type Daemon struct {
	Host string
	Port int
	TLS  bool
	// PEM contents (not paths), matching the CLI.
	CA, Cert, Key string
}

// Target is the gRPC dial target (host:port).
func (d Daemon) Target() string {
	return net.JoinHostPort(d.Host, strconv.Itoa(d.Port))
}

type Config struct {
	Listen string
	// Bearer token required on /api/ when non-empty.
	Token string
	// Cross-origin browser origins allowed for the API and WebSocket
	// ("*" for any). Same-origin requests are always allowed.
	AllowedOrigins []string
	// Serve the PWA from this directory instead of the embedded build.
	WebDir     string
	RPCTimeout time.Duration
	LogLevel   slog.Level
	Daemon     Daemon
}

func Load() (Config, error) {
	cfg := Config{
		Listen:         env("MESHWARDEN_DASHBOARD_LISTEN", ":8080"),
		Token:          os.Getenv("MESHWARDEN_DASHBOARD_TOKEN"),
		AllowedOrigins: list(os.Getenv("MESHWARDEN_DASHBOARD_ALLOWED_ORIGINS")),
		WebDir:         os.Getenv("MESHWARDEN_DASHBOARD_WEB_DIR"),
		Daemon: Daemon{
			Host: env("MESHWARDEN_HOST", "127.0.0.1"),
			TLS:  truthy(os.Getenv("MESHWARDEN_TLS")),
			CA:   os.Getenv("MESHWARDEN_CA"),
			Cert: os.Getenv("MESHWARDEN_CERT"),
			Key:  os.Getenv("MESHWARDEN_KEY"),
		},
	}

	port, err := strconv.Atoi(env("MESHWARDEN_PORT", "50051"))
	if err != nil || port <= 0 || port > 65535 {
		return cfg, fmt.Errorf("MESHWARDEN_PORT: invalid port %q", os.Getenv("MESHWARDEN_PORT"))
	}
	cfg.Daemon.Port = port

	cfg.RPCTimeout, err = time.ParseDuration(env("MESHWARDEN_DASHBOARD_RPC_TIMEOUT", "30s"))
	if err != nil || cfg.RPCTimeout <= 0 {
		return cfg, fmt.Errorf("MESHWARDEN_DASHBOARD_RPC_TIMEOUT: invalid duration %q", os.Getenv("MESHWARDEN_DASHBOARD_RPC_TIMEOUT"))
	}

	if err := cfg.LogLevel.UnmarshalText([]byte(env("MESHWARDEN_DASHBOARD_LOG_LEVEL", "info"))); err != nil {
		return cfg, fmt.Errorf("MESHWARDEN_DASHBOARD_LOG_LEVEL: %w", err)
	}

	if (cfg.Daemon.Cert == "") != (cfg.Daemon.Key == "") {
		return cfg, fmt.Errorf("MESHWARDEN_CERT and MESHWARDEN_KEY must be set together")
	}
	return cfg, nil
}

// LocalURL is the loopback base URL of the listen address, used by the
// container health probe.
func (c Config) LocalURL() (string, error) {
	host, port, err := net.SplitHostPort(c.Listen)
	if err != nil {
		return "", fmt.Errorf("MESHWARDEN_DASHBOARD_LISTEN: %w", err)
	}
	if ip := net.ParseIP(host); host == "" || (ip != nil && ip.IsUnspecified()) {
		host = "127.0.0.1"
	}
	return "http://" + net.JoinHostPort(host, port), nil
}

func env(name, def string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return def
}

// truthy mirrors the CLI's accepted values for MESHWARDEN_TLS.
func truthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes":
		return true
	}
	return false
}

func list(v string) []string {
	var out []string
	for _, s := range strings.Split(v, ",") {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	return out
}
