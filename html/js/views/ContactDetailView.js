/* Contact detail page — shown for every contact type. For companions and
   room servers it's reached via the chat header's info icon (or the room
   login screen); for repeaters and sensors it's the default panel.

   Actions live directly under the hero: Ping (repeaters/rooms only),
   Manage (repeaters only, placeholder), Favorite, Share, Delete.
   Path and Telemetry get their own cards below the identity card. */

(function () {
  window.MW = window.MW || {};
  MW.views = MW.views || {};

  MW.views.ContactDetailView = {
    name: "MwContactDetail",
    props: { contact: { type: Object, required: true } },
    data: function () {
      return {
        store: MW.store,
        editingPath: false,
        confirmDelete: false,
        shared: false,
        // telemetry fetch modal
        telePrompt: false,
        telePassword: "",
        teleRemember: true,
        teleBusy: false,
        teleFailed: false,
        tick: 0, // bumped periodically so "updated Xm ago" stays fresh
        timer: null,
      };
    },
    computed: {
      ping: function () {
        return this.store.pings[this.contact.public_key] || { state: "idle", ms: null };
      },
      pingable: function () {
        return this.store.canPing(this.contact);
      },
      manageable: function () {
        return this.contact.type === 2;
      },
      isFav: function () {
        return this.store.isFav(this.contact.public_key);
      },
      coords: function () {
        if (this.contact.adv_lat == null) return "—";
        return this.contact.adv_lat.toFixed(4) + ", " + this.contact.adv_lon.toFixed(4);
      },
      backTarget: function () {
        // Companions/rooms open this page on top of their chat (or login
        // gate); repeaters/sensors are leaf pages under the contact list.
        var chatty = this.contact.type === 1 || this.contact.type === 3;
        return chatty ? "/contacts/" + this.contact.public_key : "/contacts";
      },
      pathLabel: function () {
        return this.store.pathLabel(this.contact);
      },
      pathHops: function () {
        var store = this.store;
        var p = this.contact.path;
        if (!p || p.mode !== "manual") return [];
        return p.hops.map(function (h) {
          var c = store.resolveHop(h);
          return { hash: h, name: c ? c.adv_name : null };
        });
      },
      tele: function () {
        return this.store.telemetryFor(this.contact.public_key);
      },
      teleHistory: function () {
        return this.tele.history.slice(0, 5);
      },
      lastTele: function () {
        return this.store.lastTelemetry(this.contact.public_key);
      },
      refreshChip: function () {
        void this.tick; // re-evaluate on timer
        var last = this.lastTele;
        if (!last) return { text: "Never fetched", fresh: false, failed: false };
        var ago = this.store.timeAgo(last.ts);
        if (!last.ok) return { text: "Last attempt failed · " + (ago === "now" ? "just now" : ago + " ago"), fresh: false, failed: true };
        return {
          text: "Updated " + (ago === "now" ? "just now" : ago + " ago"),
          fresh: Date.now() / 1000 - last.ts < 300,
          failed: false,
        };
      },
    },
    mounted: function () {
      var self = this;
      this.timer = setInterval(function () { self.tick++; }, 30000);
    },
    unmounted: function () {
      clearInterval(this.timer);
    },
    methods: {
      doPing: function () {
        if (this.ping.state !== "busy") this.store.ping(this.contact.public_key);
      },
      doShare: function () {
        var self = this;
        var text = this.contact.adv_name + " — meshcore:" + this.contact.public_key;
        var done = function () {
          self.shared = true;
          setTimeout(function () { self.shared = false; }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, done);
        } else {
          var ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); } catch (e) { /* mock phase */ }
          document.body.removeChild(ta);
          done();
        }
      },
      doDelete: function () {
        this.confirmDelete = false;
        this.store.removeContact(this.contact.public_key);
        this.$router.push("/contacts");
      },
      /* ---------- telemetry fetch ---------- */
      startFetch: function () {
        var saved = this.tele.password;
        if (saved != null) this.runFetch(saved, true, true);
        else this.openTelePrompt(false);
      },
      openTelePrompt: function (failed) {
        this.teleFailed = failed;
        this.teleBusy = false;
        this.telePrompt = true;
      },
      submitTele: function () {
        // Blank password is valid — many nodes expose guest telemetry.
        this.runFetch(this.telePassword, this.teleRemember, false);
      },
      runFetch: function (password, remember, wasStored) {
        var self = this;
        this.teleBusy = true;
        this.store.fetchTelemetry(this.contact.public_key, password, remember, function (ok) {
          self.teleBusy = false;
          if (ok) {
            self.telePrompt = false;
            self.teleFailed = false;
            self.telePassword = "";
          } else if (wasStored) {
            // Saved password no longer works (or node is dark) — re-prompt.
            self.openTelePrompt(true);
          } else {
            self.teleFailed = true;
          }
        });
      },
    },
    template:
      '<div class="page">' +
      '  <button class="icon-btn only-mobile" @click="$router.push(backTarget)" aria-label="Back">' +
      '    <mw-icon name="arrow-left" :size="20" />' +
      '  </button>' +
      '  <div class="detail-hero">' +
      '    <mw-avatar :contact="contact" size="lg" />' +
      '    <div class="detail-hero__name">{{ contact.adv_name }}</div>' +
      '    <mw-badge :type="contact.type" />' +
      '    <div class="detail-hero__key mono">{{ contact.public_key }}</div>' +
      '  </div>' +

      '  <div style="max-width:520px;margin:0 auto">' +
      '    <div class="action-row">' +
      '      <button v-if="pingable" class="action-btn" @click="doPing">' +
      '        <mw-icon name="satellite-dish" :size="19" :class="{ pinging: ping.state === \'busy\' }" />' +
      '        <span>{{ ping.state === "busy" ? "Pinging…" : ping.state === "done" ? ping.ms + " ms" : "Ping" }}</span>' +
      '      </button>' +
      '      <button v-if="manageable" class="action-btn" @click="$router.push(\'/contacts/\' + contact.public_key + \'/manage\')">' +
      '        <mw-icon name="sliders-horizontal" :size="19" /><span>Manage</span>' +
      '      </button>' +
      '      <button class="action-btn" :class="{ \'is-active\': isFav }" @click="store.toggleFav(contact.public_key)">' +
      '        <mw-icon name="star" :size="19" /><span>{{ isFav ? "Faved" : "Favorite" }}</span>' +
      '      </button>' +
      '      <button class="action-btn" :class="{ \'is-active\': shared }" @click="doShare">' +
      '        <mw-icon :name="shared ? \'check\' : \'share-2\'" :size="19" /><span>{{ shared ? "Copied" : "Share" }}</span>' +
      '      </button>' +
      '      <button class="action-btn action-btn--danger" @click="confirmDelete = true">' +
      '        <mw-icon name="trash-2" :size="19" /><span>Delete</span>' +
      '      </button>' +
      '    </div>' +

      '    <div class="card">' +
      '      <div class="card__title">Node</div>' +
      '      <div class="kv"><span class="kv__k">Last heard</span><span class="kv__v">{{ store.timeAgo(contact.last_seen) }} ago</span></div>' +
      '      <div class="kv"><span class="kv__k">Location</span><span class="kv__v mono">{{ coords }}</span></div>' +
      '      <div class="kv" v-if="contact.model"><span class="kv__k">Hardware</span><span class="kv__v">{{ contact.model }}</span></div>' +
      '      <div class="kv" v-if="contact.firmware"><span class="kv__k">Firmware</span><span class="kv__v">{{ contact.firmware }}</span></div>' +
      '    </div>' +

      '    <div class="card">' +
      '      <div class="card__head">' +
      '        <div class="card__title">Path</div>' +
      '        <button class="btn btn--ghost btn--sm" @click="editingPath = true">' +
      '          <mw-icon name="pencil" :size="14" /> Edit' +
      '        </button>' +
      '      </div>' +
      '      <div class="kv"><span class="kv__k">Mode</span><span class="kv__v">{{ pathLabel }}</span></div>' +
      '      <div v-if="pathHops.length" class="path-hops" style="margin-top:8px">' +
      '        <span v-for="(hop, i) in pathHops" :key="i" class="hop-chip hop-chip--static"' +
      '          :class="{ \'hop-chip--unknown\': !hop.name }" :title="hop.name || \'Unknown relay\'">' +
      '          <span class="mono">{{ hop.hash }}</span>' +
      '          <span v-if="hop.name" class="hop-chip__name">{{ hop.name }}</span>' +
      '        </span>' +
      '      </div>' +
      '    </div>' +

      '    <div class="card">' +
      '      <div class="card__head">' +
      '        <div class="card__title">Telemetry</div>' +
      '        <span class="refresh-chip" :class="{ \'is-fresh\': refreshChip.fresh, \'is-failed\': refreshChip.failed }">' +
      '          <mw-icon name="clock" :size="12" /> {{ refreshChip.text }}' +
      '        </span>' +
      '      </div>' +
      '      <div class="kv"><span class="kv__k">Battery</span><span class="kv__v">{{ contact.battery != null ? contact.battery + "%" : "Mains" }}</span></div>' +
      '      <div class="kv"><span class="kv__k">SNR</span><span class="kv__v">{{ contact.snr != null ? contact.snr + " dB" : "—" }}</span></div>' +
      '      <div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap">' +
      '        <button class="btn btn--primary" @click="startFetch" :disabled="teleBusy">' +
      '          <mw-icon name="refresh-cw" :size="16" :class="{ pinging: teleBusy }" />' +
      '          {{ teleBusy ? "Fetching…" : "Fetch telemetry" }}' +
      '        </button>' +
      '        <button v-if="tele.password != null" class="auth-reset" @click="store.forgetTelemetryPassword(contact.public_key)">' +
      '          Password saved — forget' +
      '        </button>' +
      '      </div>' +
      '      <template v-if="teleHistory.length">' +
      '        <div class="tele-history__title"><mw-icon name="history" :size="13" /> History</div>' +
      '        <div v-for="(h, i) in teleHistory" :key="h.ts + \'-\' + i" class="tele-row">' +
      '          <mw-icon :name="h.ok ? \'check\' : \'x\'" :size="14" :style="{ color: h.ok ? \'var(--ok)\' : \'var(--danger)\' }" />' +
      '          <span class="tele-row__vals">{{ h.ok ? (h.battery != null ? h.battery + "%" : "Mains") + " · " + (h.snr != null ? h.snr + " dB" : "—") : "No response" }}</span>' +
      '          <span class="tele-row__time">{{ store.dayLabel(h.ts) }} · {{ store.timeOfDay(h.ts) }}</span>' +
      '        </div>' +
      '      </template>' +
      '    </div>' +
      '  </div>' +

      '  <mw-path-editor v-if="editingPath" :contact="contact" @close="editingPath = false" />' +

      '  <mw-modal v-if="confirmDelete" title="Delete contact" icon="trash-2" @close="confirmDelete = false">' +
      '    <p style="color:var(--text-1);font-size:14px;margin:0 0 4px">' +
      '      Remove <strong>{{ contact.adv_name }}</strong> from this device? Past messages are kept, but the node will be forgotten.' +
      '    </p>' +
      '    <div class="modal__actions">' +
      '      <span style="flex:1"></span>' +
      '      <button class="btn btn--ghost" @click="confirmDelete = false">Cancel</button>' +
      '      <button class="btn btn--danger" @click="doDelete"><mw-icon name="trash-2" :size="16" /> Delete</button>' +
      '    </div>' +
      '  </mw-modal>' +

      '  <mw-modal v-if="telePrompt" title="Telemetry password" icon="lock" @close="telePrompt = false">' +
      '    <form @submit.prevent="submitTele" :class="{ shake: teleFailed && !teleBusy }" style="display:flex;flex-direction:column;gap:12px">' +
      '      <p v-if="teleFailed" class="path-hint path-hint--err" style="margin:0">' +
      '        No response — the password may be wrong, or the node is out of range. MeshCore can’t tell the two apart; try again.' +
      '      </p>' +
      '      <p v-else style="color:var(--text-1);font-size:13.5px;margin:0">' +
      '        {{ contact.adv_name }} may require a password for telemetry. Many nodes allow guest access with a blank password.' +
      '      </p>' +
      '      <div>' +
      '        <label class="field-label" for="tele-pw">Password</label>' +
      '        <input id="tele-pw" class="input" type="password" v-model="telePassword" placeholder="Blank = guest access" autocomplete="off" />' +
      '      </div>' +
      '      <label class="check-row">' +
      '        <input type="checkbox" v-model="teleRemember" />' +
      '        <span>Remember password on this device</span>' +
      '      </label>' +
      '      <div class="modal__actions">' +
      '        <span style="flex:1"></span>' +
      '        <button type="button" class="btn btn--ghost" @click="telePrompt = false">Cancel</button>' +
      '        <button type="submit" class="btn btn--primary" :disabled="teleBusy">' +
      '          <mw-icon name="refresh-cw" :size="16" :class="{ pinging: teleBusy }" />' +
      '          {{ teleBusy ? "Fetching…" : "Fetch" }}' +
      '        </button>' +
      '      </div>' +
      '    </form>' +
      '  </mw-modal>' +
      "</div>",
  };
})();
