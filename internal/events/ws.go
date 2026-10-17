package events

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	sendBuffer   = 256
	writeTimeout = 10 * time.Second
	pongTimeout  = 60 * time.Second
	pingInterval = pongTimeout * 9 / 10
	maxInbound   = 64 << 10
)

// Handler upgrades requests to WebSocket connections fed by the hub.
// checkOrigin decides which browser origins may connect.
func (h *Hub) Handler(checkOrigin func(*http.Request) bool) http.Handler {
	upgrader := websocket.Upgrader{CheckOrigin: checkOrigin}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return // Upgrade has already written the HTTP error
		}
		c := &client{conn: conn, send: make(chan []byte, sendBuffer), done: make(chan struct{})}
		h.add(c)
		go func() {
			c.writeLoop()
			h.remove(c)
		}()
		c.readLoop()
	})
}

type client struct {
	conn *websocket.Conn
	send chan []byte
	done chan struct{}
	once sync.Once

	mu    sync.RWMutex
	types map[string]struct{} // nil = every event type
}

func (c *client) close() { c.once.Do(func() { close(c.done) }) }

// enqueue never blocks the hub: a client too slow to keep up is
// disconnected, and should reconnect and refetch state.
func (c *client) enqueue(b []byte) {
	select {
	case c.send <- b:
	default:
		c.close()
	}
}

func (c *client) wants(eventType string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.types == nil {
		return true
	}
	_, ok := c.types[eventType]
	return ok
}

func (c *client) subscribe(types []string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(types) == 0 {
		c.types = nil
		return
	}
	c.types = make(map[string]struct{}, len(types))
	for _, t := range types {
		c.types[t] = struct{}{}
	}
}

// writeLoop owns all writes to conn and closes it on exit.
func (c *client) writeLoop() {
	ticker := time.NewTicker(pingInterval)
	defer func() {
		ticker.Stop()
		c.close()
		_ = c.conn.Close()
	}()
	for {
		select {
		case b := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeTimeout))
			if err := c.conn.WriteMessage(websocket.TextMessage, b); err != nil {
				return
			}
		case <-ticker.C:
			if err := c.conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(writeTimeout)); err != nil {
				return
			}
		case <-c.done:
			_ = c.conn.WriteControl(websocket.CloseMessage,
				websocket.FormatCloseMessage(websocket.CloseGoingAway, ""), time.Now().Add(writeTimeout))
			return
		}
	}
}

// readLoop handles client messages until the connection fails.
func (c *client) readLoop() {
	defer c.close()
	c.conn.SetReadLimit(maxInbound)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongTimeout))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongTimeout))
	})
	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var in message
		if err := json.Unmarshal(data, &in); err != nil {
			c.enqueue(encode(message{Type: MsgError, Error: "invalid message: " + err.Error()}))
			continue
		}
		switch in.Type {
		case MsgSubscribe:
			c.subscribe(in.Types)
			c.enqueue(encode(message{Type: MsgSubscribed, Types: in.Types}))
		default:
			c.enqueue(encode(message{Type: MsgError, Error: fmt.Sprintf("unknown message type %q", in.Type)}))
		}
	}
}
