/* Reactive store — single source of truth for UI state.
   Loads from mock data today; the API client will plug in here later. */

(function () {
  window.MW = window.MW || {};
  var reactive = Vue.reactive;

  var CONTACT_TYPE = {
    1: { key: "companion", label: "Companion", icon: "message-circle", color: "#60a5fa" },
    2: { key: "repeater",  label: "Repeater",  icon: "radio-tower",    color: "#2dd4bf" },
    3: { key: "room",      label: "Room Server", icon: "server",       color: "#a78bfa" },
    4: { key: "sensor",    label: "Sensor",    icon: "thermometer",    color: "#fbbf24" },
  };

  var store = reactive({
    account: MW.mockData.account,
    contacts: MW.mockData.contacts,
    channels: MW.mockData.channels,
    messages: MW.mockData.messages,

    // UI state
    theme: localStorage.getItem("mw-theme") || "dark",
    favorites: new Set(MW.mockData.contacts.filter(function (c) { return c.fav; }).map(function (c) { return c.public_key; })),
    roomAuth: {}, // public_key -> true once "authenticated" (mock)
    pings: {},    // public_key -> { state: 'idle'|'busy'|'done', ms: number|null }

    // Path config: MeshCore networks use 1-, 2-, or 4-byte pubkey hashes in
    // paths. The daemon will report this; mocked here so the path editor can
    // validate typed hashes against it.
    pathHashBytes: 1,

    // Telemetry: public_key -> { password: string|null, history: [{ts, ok, battery?, snr?}] }
    telemetry: Object.keys(MW.mockData.telemetry).reduce(function (acc, key) {
      acc[key] = { password: null, history: MW.mockData.telemetry[key] };
      return acc;
    }, {}),

    contactType: function (contact) {
      return CONTACT_TYPE[contact.type] || CONTACT_TYPE[1];
    },

    getContact: function (publicKey) {
      return this.contacts.find(function (c) { return c.public_key === publicKey; }) || null;
    },

    getChannel: function (id) {
      return this.channels.find(function (c) { return c.id === id; }) || null;
    },

    isFav: function (publicKey) {
      return this.favorites.has(publicKey);
    },

    toggleFav: function (publicKey) {
      if (this.favorites.has(publicKey)) this.favorites.delete(publicKey);
      else this.favorites.add(publicKey);
    },

    canPing: function (contact) {
      return contact.type === 2 || contact.type === 3;
    },

    ping: function (publicKey) {
      var self = this;
      this.pings[publicKey] = { state: "busy", ms: null };
      // Mock latency; real impl will issue a device ping via the API.
      setTimeout(function () {
        self.pings[publicKey] = { state: "done", ms: 120 + Math.floor(Math.random() * 900) };
        setTimeout(function () {
          self.pings[publicKey] = { state: "idle", ms: null };
        }, 4000);
      }, 700 + Math.random() * 900);
    },

    /* ---------- Paths ---------- */

    setPathHashBytes: function (n) {
      this.pathHashBytes = n;
    },

    // Hash a contact contributes when used as a path hop.
    hopHash: function (publicKey) {
      return publicKey.slice(0, this.pathHashBytes * 2);
    },

    // Resolve a hop hash to a known contact (prefix match, any hash width).
    resolveHop: function (hash) {
      var h = hash.toLowerCase();
      return this.contacts.find(function (c) { return c.public_key.indexOf(h) === 0; }) || null;
    },

    pathLabel: function (contact) {
      var p = contact.path;
      if (!p || p.mode === "direct" || (p.mode === "manual" && !p.hops.length)) return "Direct";
      if (p.mode === "flood") return "Flood";
      return p.hops.length + (p.hops.length === 1 ? " hop" : " hops");
    },

    setPath: function (publicKey, path) {
      var c = this.getContact(publicKey);
      if (c) c.path = path;
    },

    /* ---------- Telemetry ---------- */

    telemetryFor: function (publicKey) {
      if (!this.telemetry[publicKey]) this.telemetry[publicKey] = { password: null, history: [] };
      return this.telemetry[publicKey];
    },

    lastTelemetry: function (publicKey) {
      var h = this.telemetryFor(publicKey).history;
      return h.length ? h[0] : null;
    },

    forgetTelemetryPassword: function (publicKey) {
      this.telemetryFor(publicKey).password = null;
    },

    // Mock pull: latency + ~30% failure (MeshCore can't tell a wrong
    // password from a dead node). Real impl will go through the API.
    fetchTelemetry: function (publicKey, password, remember, done) {
      var self = this;
      setTimeout(function () {
        var ok = Math.random() >= 0.3;
        var t = self.telemetryFor(publicKey);
        var entry = { ts: Math.floor(Date.now() / 1000), ok: ok };
        if (ok) {
          var c = self.getContact(publicKey);
          if (c) {
            if (c.battery != null) c.battery = Math.max(0, Math.min(100, c.battery + Math.round(Math.random() * 6 - 4)));
            if (c.snr != null) c.snr = Math.round((c.snr + (Math.random() - 0.5)) * 10) / 10;
            entry.battery = c.battery;
            entry.snr = c.snr;
          }
          t.password = remember ? password : null;
        }
        t.history.unshift(entry);
        done(ok);
      }, 900 + Math.random() * 600);
    },

    /* ---------- Contacts ---------- */

    removeContact: function (publicKey) {
      var i = this.contacts.findIndex(function (c) { return c.public_key === publicKey; });
      if (i !== -1) this.contacts.splice(i, 1);
      this.favorites.delete(publicKey);
      delete this.pings[publicKey];
      delete this.roomAuth[publicKey];
      delete this.telemetry[publicKey];
    },

    isRoomAuthed: function (publicKey) {
      var c = this.getContact(publicKey);
      return !!(c && (c.authed || this.roomAuth[publicKey]));
    },

    authRoom: function (publicKey, password) {
      // Mock auth: any non-empty password succeeds.
      if (!password) return false;
      this.roomAuth[publicKey] = true;
      return true;
    },

    messagesFor: function (scope, peer) {
      return this.messages
        .filter(function (m) { return m.scope === scope && m.peer === peer; })
        .sort(function (a, b) { return a.ts - b.ts; });
    },

    sendMessage: function (scope, peer, text) {
      this.messages.push({ scope: scope, peer: peer, dir: "out", text: text, ts: Math.floor(Date.now() / 1000) });
      var channel = scope === "channel" ? this.getChannel(peer) : null;
      if (channel) channel.unread = 0;
    },

    markChannelRead: function (id) {
      var c = this.getChannel(id);
      if (c) c.unread = 0;
    },

    lastMessage: function (scope, peer) {
      var list = this.messagesFor(scope, peer);
      return list.length ? list[list.length - 1] : null;
    },

    setTheme: function (theme) {
      this.theme = theme;
      localStorage.setItem("mw-theme", theme);
      document.documentElement.dataset.theme = theme;
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", theme === "dark" ? "#0a0e17" : "#eef1f8");
    },

    logout: function () {
      // Mock: real impl will clear the session token and bounce to a login screen.
      MW.router.push("/settings");
    },
  });

  // Relative time helper shared across views
  store.timeAgo = function (ts) {
    var s = Math.max(1, Math.floor(Date.now() / 1000) - ts);
    if (s < 60) return "now";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    return Math.floor(s / 86400) + "d";
  };

  store.timeOfDay = function (ts) {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  store.dayLabel = function (ts) {
    var d = new Date(ts * 1000), today = new Date();
    var sameDay = d.toDateString() === today.toDateString();
    if (sameDay) return "Today";
    var y = new Date(today); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  MW.store = store;
  document.documentElement.dataset.theme = store.theme;
})();
