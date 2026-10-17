/* /contacts/:key — resolves the right panel by contact kind:
     repeater/sensor → detail page
     companion       → conversation
     room server     → conversation if authed, else password gate
   /contacts/:key/info forces the detail page (used by the Settings quick action). */

(function () {
  window.MW = window.MW || {};
  MW.views = MW.views || {};

  MW.views.ContactHome = {
    name: "MwContactHome",
    data: function () {
      return { store: MW.store };
    },
    computed: {
      key_: function () {
        return this.$route.params.key;
      },
      contact: function () {
        return this.store.getContact(this.key_);
      },
      forceInfo: function () {
        return this.$route.params.mode === "info";
      },
      mode: function () {
        var c = this.contact;
        if (!c) return "missing";
        if (this.forceInfo) return "detail";
        if (c.type === 1) return "chat";
        if (c.type === 3) return this.store.isRoomAuthed(c.public_key) ? "chat" : "auth";
        return "detail"; // repeater (2), sensor (4)
      },
    },
    template:
      '<mw-empty v-if="mode === \'missing\'" icon="search" title="Contact not found" subtitle="It may have been pruned from the archive." />' +
      '<mw-conversation v-else-if="mode === \'chat\'" scope="contact" :peer="key_" />' +
      '<mw-room-auth v-else-if="mode === \'auth\'" :contact="contact" />' +
      '<mw-contact-detail v-else :contact="contact" />',
  };
})();
