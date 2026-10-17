// Package daemon wraps the gRPC connection to meshwarden-daemon.
package daemon

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"

	"github.com/benbaptist/meshwarden-dashboard/internal/config"
	"github.com/benbaptist/meshwarden-dashboard/internal/pb"
)

// DeviceHealthService is the health service name the daemon reports as
// SERVING while the MeshCore node is connected.
const DeviceHealthService = "meshcored.v1.Device"

// Client is one shared connection to the daemon, exposing the daemon API
// and the standard gRPC health service.
type Client struct {
	pb.MeshCoreDaemonClient
	Health healthpb.HealthClient
	conn   *grpc.ClientConn
}

func New(conn *grpc.ClientConn) *Client {
	return &Client{
		MeshCoreDaemonClient: pb.NewMeshCoreDaemonClient(conn),
		Health:               healthpb.NewHealthClient(conn),
		conn:                 conn,
	}
}

// Dial creates a lazily-connecting client; it does not wait for the daemon.
func Dial(cfg config.Daemon) (*Client, error) {
	creds := insecure.NewCredentials()
	if cfg.TLS {
		tlsCfg, err := tlsConfig(cfg)
		if err != nil {
			return nil, err
		}
		creds = credentials.NewTLS(tlsCfg)
	}
	conn, err := grpc.NewClient(cfg.Target(), grpc.WithTransportCredentials(creds))
	if err != nil {
		return nil, fmt.Errorf("dial daemon %s: %w", cfg.Target(), err)
	}
	return New(conn), nil
}

func (c *Client) Close() error { return c.conn.Close() }

func tlsConfig(cfg config.Daemon) (*tls.Config, error) {
	out := &tls.Config{MinVersion: tls.VersionTLS12}
	if cfg.CA != "" {
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM([]byte(cfg.CA)) {
			return nil, errors.New("MESHWARDEN_CA: no PEM certificates found")
		}
		out.RootCAs = pool
	}
	if cfg.Cert != "" {
		pair, err := tls.X509KeyPair([]byte(cfg.Cert), []byte(cfg.Key))
		if err != nil {
			return nil, fmt.Errorf("MESHWARDEN_CERT/MESHWARDEN_KEY: %w", err)
		}
		out.Certificates = []tls.Certificate{pair}
	}
	return out, nil
}
