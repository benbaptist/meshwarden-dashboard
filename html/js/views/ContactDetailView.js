/* Contact detail panel — identity, radio info, and actions for
   repeaters / room servers / sensors (opened directly for repeaters,
   via the Settings quick action for rooms). */

(function () {
  window.MW = window.MW || {};
  MW.views = MW.views || {};

  MW.views.ContactDetailView = {
    name: "MwContactDetail",
    props: { contact: { type: Object, required: true } },
    data: function () {
      return { store: MW.store };
    },
    computed: {
      ping: function () {
        return this.store.pings[this.contact.public_key] || { state: "idle", ms: null };
      },
      pingable: function () {
        return this.store.canPing(this.contact);
      },
      isFav: function () {
        return this.store.isFav(this.contact.public_key);
      },
      coords: function () {
        if (this.contact.adv_lat == null) return "—";
        return this.contact.adv_lat.toFixed(4) + ", " + this.contact.adv_lon.toFixed(4);
      },
    },
    methods: {
      doPing: function () {
        if (this.ping.state !== "busy") this.store.ping(this.contact.public_key);
      },
    },
    template:
      '<div class="page">' +
      '  <button class="icon-btn only-mobile" @click="$router.push(\'/contacts\')" aria-label="Back to contacts">' +
      '    <mw-icon name="arrow-left" :size="20" />' +
      '  </button>' +
      '  <div class="detail-hero">' +
      '    <mw-avatar :contact="contact" size="lg" />' +
      '    <div class="detail-hero__name">{{ contact.adv_name }}</div>' +
      '    <mw-badge :type="contact.type" />' +
      '    <div class="detail-hero__key mono">{{ contact.public_key }}</div>' +
      '  </div>' +
      '  <div style="max-width:520px;margin:0 auto">' +
      '    <div class="card">' +
      '      <div class="card__title">Node</div>' +
      '      <div class="kv"><span class="kv__k">Last heard</span><span class="kv__v">{{ store.timeAgo(contact.last_seen) }} ago</span></div>' +
      '      <div class="kv"><span class="kv__k">Path</span><span class="kv__v">{{ contact.out_path || "—" }}</span></div>' +
      '      <div class="kv"><span class="kv__k">Location</span><span class="kv__v mono">{{ coords }}</span></div>' +
      '      <div class="kv" v-if="contact.model"><span class="kv__k">Hardware</span><span class="kv__v">{{ contact.model }}</span></div>' +
      '      <div class="kv" v-if="contact.firmware"><span class="kv__k">Firmware</span><span class="kv__v">{{ contact.firmware }}</span></div>' +
      '    </div>' +
      '    <div class="card">' +
      '      <div class="card__title">Radio</div>' +
      '      <div class="kv"><span class="kv__k">SNR</span><span class="kv__v">{{ contact.snr != null ? contact.snr + " dB" : "—" }}</span></div>' +
      '      <div class="kv"><span class="kv__k">Battery</span><span class="kv__v">{{ contact.battery != null ? contact.battery + "%" : "Mains" }}</span></div>' +
      '    </div>' +
      '    <div style="display:flex;gap:12px;flex-wrap:wrap">' +
      '      <button v-if="pingable" class="btn btn--primary" style="flex:1" @click="doPing">' +
      '        <mw-icon name="satellite-dish" :size="18" />' +
      '        {{ ping.state === "busy" ? "Pinging…" : ping.state === "done" ? ping.ms + " ms" : "Ping" }}' +
      '      </button>' +
      '      <button class="btn btn--ghost" style="flex:1" @click="store.toggleFav(contact.public_key)">' +
      '        <mw-icon name="star" :size="18" />' +
      '        {{ isFav ? "Unfavorite" : "Favorite" }}' +
      '      </button>' +
      '    </div>' +
      '  </div>' +
      "</div>",
  };
})();
