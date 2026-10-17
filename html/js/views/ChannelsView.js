/* Channels layout — same master-detail pattern as Contacts, reusing the
   shared ConversationView with scope="channel". */

(function () {
  window.MW = window.MW || {};
  MW.views = MW.views || {};

  MW.views.ChannelsView = {
    name: "MwChannelsView",
    data: function () {
      return { store: MW.store };
    },
    methods: {
      isActive: function (c) {
        return this.$route.params.id === c.id;
      },
      open: function (c) {
        this.$router.push("/channels/" + c.id);
      },
      preview: function (c) {
        var m = this.store.lastMessage("channel", c.id);
        return m ? m.text : "No messages yet";
      },
    },
    template:
      '<div class="md-layout" :class="{ \'detail-open\': $route.params.id }">' +
      '  <div class="md-list">' +
      '    <div class="list-section">Channels</div>' +
      '    <div v-for="c in store.channels" :key="c.id" class="contact-item"' +
      '         :class="{ \'is-active\': isActive(c) }" role="button" tabindex="0"' +
      '         @click="open(c)" @keydown.enter="open(c)">' +
      '      <mw-avatar :contact="{ public_key: c.id, adv_name: c.name, type: 3 }" />' +
      '      <div class="contact-item__meta">' +
      '        <div class="contact-item__name-row">' +
      '          <span class="contact-item__name"># {{ c.name }}</span>' +
      '          <span v-if="c.unread" class="badge badge--repeater">{{ c.unread }}</span>' +
      '        </div>' +
      '        <div class="contact-item__sub">' +
      '          <span class="preview">{{ preview(c) }}</span>' +
      '          <span class="contact-item__seen mono">slot {{ c.slot }}</span>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="md-detail">' +
      '    <router-view />' +
      '  </div>' +
      "</div>",
  };
})();
