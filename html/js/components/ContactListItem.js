/* Rich contact list row with quick actions.
   Quick actions (Ping / Settings / Fav) appear when the viewport is wide enough
   (CSS-controlled). Tapping anywhere else routes by contact type. */

(function () {
  window.MW = window.MW || {};
  MW.components = MW.components || {};

  MW.components.ContactListItem = {
    name: "MwContactListItem",
    props: {
      contact: { type: Object, required: true },
      active: { type: Boolean, default: false },
    },
    data: function () {
      return { store: MW.store };
    },
    computed: {
      isFav: function () {
        return this.store.isFav(this.contact.public_key);
      },
      pingable: function () {
        return this.store.canPing(this.contact);
      },
      ping: function () {
        return this.store.pings[this.contact.public_key] || { state: "idle", ms: null };
      },
      online: function () {
        return Date.now() / 1000 - this.contact.last_seen < 3600;
      },
      lastMsg: function () {
        return this.store.lastMessage("contact", this.contact.public_key);
      },
    },
    methods: {
      open: function () {
        var c = this.contact;
        // Tap-through depends on contact kind (see router contract in plan).
        this.$router.push("/contacts/" + c.public_key);
      },
      openSettings: function () {
        this.$router.push("/contacts/" + this.contact.public_key + "/info");
      },
      doPing: function () {
        if (this.ping.state !== "busy") this.store.ping(this.contact.public_key);
      },
      toggleFav: function () {
        this.store.toggleFav(this.contact.public_key);
      },
    },
    template:
      '<div class="contact-item" :class="{ \'is-active\': active }" role="button" tabindex="0"' +
      '     @click="open" @keydown.enter="open">' +
      '  <mw-avatar :contact="contact" :online="online" />' +
      '  <div class="contact-item__meta">' +
      '    <div class="contact-item__name-row">' +
      '      <span class="contact-item__name">{{ contact.adv_name }}</span>' +
      '    </div>' +
      '    <div class="contact-item__sub">' +
      '      <span class="mono">{{ contact.public_key }}</span>' +
      '      <span v-if="lastMsg" class="preview">· {{ lastMsg.text }}</span>' +
      '      <span class="contact-item__seen">{{ store.timeAgo(contact.last_seen) }}</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="contact-item__actions" @click.stop>' +
      '    <button v-if="pingable" class="icon-btn" :title="ping.state === \'done\' ? ping.ms + \' ms\' : \'Ping\'" @click="doPing">' +
      '      <span v-if="ping.state === \'done\'" class="mono" style="font-size:11px;color:var(--ok)">{{ ping.ms }}ms</span>' +
      '      <mw-icon v-else name="satellite-dish" :size="18" :class="{ shake: ping.state === \'busy\' }" />' +
      '    </button>' +
      '    <button v-if="pingable" class="icon-btn" title="Settings" @click="openSettings">' +
      '      <mw-icon name="settings" :size="18" />' +
      '    </button>' +
      '    <button class="icon-btn" :class="{ \'is-active\': isFav }" :title="isFav ? \'Unfavorite\' : \'Favorite\'" @click="toggleFav">' +
      '      <mw-icon name="star" :size="18" />' +
      '    </button>' +
      '  </div>' +
      "</div>",
  };
})();
