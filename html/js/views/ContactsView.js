/* Contacts layout: list on the left, detail/conversation panel on the right
   (wide viewports) or drill-in navigation (narrow). */

(function () {
  window.MW = window.MW || {};
  MW.views = MW.views || {};

  MW.views.ContactsView = {
    name: "MwContactsView",
    data: function () {
      return {
        store: MW.store,
        addOpen: false,
        advertOpen: false,
        contactKey: "",
        contactName: "",
        contactType: 1,
        contactError: "",
        copied: false,
        notice: "",
      };
    },
    computed: {
      sorted: function () {
        return this.store.contacts
          .slice()
          .sort(function (a, b) { return b.last_seen - a.last_seen; });
      },
      favorites: function () {
        var store = this.store;
        return this.sorted.filter(function (c) { return store.isFav(c.public_key); });
      },
      rest: function () {
        var store = this.store;
        return this.sorted.filter(function (c) { return !store.isFav(c.public_key); });
      },
    },
    methods: {
      isActive: function (c) {
        return this.$route.params.key === c.public_key;
      },
      addContact: function () {
        this.contactError = "";
        var key = this.contactKey.trim().toLowerCase();
        if (!/^[0-9a-f]{12,128}$/.test(key)) {
          this.contactError = "Enter a valid hexadecimal public key.";
          return;
        }
        if (this.store.getContact(key)) {
          this.contactError = "This contact is already in your list.";
          return;
        }
        this.store.addContact(key, this.contactName.trim(), Number(this.contactType));
        this.contactKey = "";
        this.contactName = "";
        this.addOpen = false;
      },
      advertise: function (mode) {
        this.store.advertise(mode);
        this.advertOpen = false;
        this.notice = "Advert queued via " + (mode === "direct" ? "Zero Hop" : "Flood Routed") + ".";
        var self = this;
        setTimeout(function () { self.notice = ""; }, 3000);
      },
      openAdvert: function () {
        this.contactError = "";
        this.advertOpen = true;
      },
      copyOwnUri: function () {
        var self = this;
        var uri = "meshcore://" + this.store.account.public_key;
        function copied() {
          self.copied = true;
          setTimeout(function () { self.copied = false; }, 2000);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(uri).then(copied, function () {
            self.contactError = "Could not copy to clipboard.";
          });
        } else {
          var field = document.createElement("textarea");
          field.value = uri;
          document.body.appendChild(field);
          field.select();
          var ok = document.execCommand("copy");
          document.body.removeChild(field);
          if (ok) copied();
          else this.contactError = "Could not copy to clipboard.";
        }
      },
    },
    template:
      '<div class="md-layout" :class="{ \'detail-open\': $route.params.key }">' +
      '  <div class="md-list">' +
      '    <div class="page-header" style="padding:var(--sp-3);display:flex;gap:var(--sp-2);flex-wrap:wrap">' +
      '      <button class="btn btn--primary btn--sm" @click="addOpen = true"><mw-icon name="plus" :size="16" /> Add contact</button>' +
      '      <button class="btn btn--ghost btn--sm" @click="openAdvert"><mw-icon name="radio" :size="16" /> Advert</button>' +
      '    </div>' +
      '    <div v-if="notice" class="list-section">{{ notice }}</div>' +
      '    <template v-if="favorites.length">' +
      '      <div class="list-section">Favorites</div>' +
      '      <mw-contact-list-item v-for="c in favorites" :key="c.public_key" :contact="c" :active="isActive(c)" />' +
      '    </template>' +
      '    <div class="list-section">All contacts</div>' +
      '    <mw-contact-list-item v-for="c in rest" :key="c.public_key" :contact="c" :active="isActive(c)" />' +
      '  </div>' +
      '  <div class="md-detail">' +
      '    <router-view />' +
      '  </div>' +
      '  <mw-modal v-if="addOpen" title="Add contact" icon="plus" @close="addOpen = false">' +
      '    <form @submit.prevent="addContact">' +
      '      <label class="form-label">Public key<input class="input" v-model="contactKey" autocomplete="off" placeholder="Paste hexadecimal public key" required /></label>' +
      '      <label class="form-label">Type<select class="input" v-model="contactType"><option value="1">Companion</option><option value="2">Repeater</option><option value="3">Room Server</option><option value="4">Sensor</option></select></label>' +
      '      <label class="form-label">Name (optional)<input class="input" v-model="contactName" placeholder="Until an advert provides a name" /></label>' +
      '      <p v-if="contactError" class="text-danger">{{ contactError }}</p>' +
      '      <div class="modal__actions"><button type="button" class="btn btn--ghost" @click="addOpen = false">Cancel</button><button class="btn btn--primary">Add contact</button></div>' +
      '    </form>' +
      '  </mw-modal>' +
      '  <mw-modal v-if="advertOpen" title="Advertise contact" icon="radio" @close="advertOpen = false">' +
      '    <p class="advert-intro">Choose how your contact advert is routed.</p>' +
      '    <div class="advert-route-options">' +
      '      <button class="advert-route-option" @click="advertise(\'flood\')"><mw-icon name="radio-tower" :size="26" /><span>Flood</span></button>' +
      '      <button class="advert-route-option" @click="advertise(\'direct\')"><mw-icon name="send" :size="26" /><span>Zero Hop</span></button>' +
      '    </div>' +
      '    <div class="advert-uri">' +
      '      <div class="advert-uri__heading"><span>Your contact URI</span><span>Share to connect</span></div>' +
      '      <div class="advert-uri__value"><code class="mono">meshcore://{{ store.account.public_key }}</code><button class="icon-btn" @click="copyOwnUri" :aria-label="copied ? \'Copied\' : \'Copy URI\'"><mw-icon :name="copied ? \'check\' : \'copy\'" :size="17" /></button></div>' +
      '      <p v-if="contactError" class="text-danger">{{ contactError }}</p>' +
      '    </div>' +
      '  </mw-modal>' +
      "</div>",
  };
})();
