/* Reusable conversation view — used for companion chats, room-server chats
   (scope="contact") and channel conversations (scope="channel"). */

(function () {
  window.MW = window.MW || {};
  MW.components = MW.components || {};

  MW.components.ConversationView = {
    name: "MwConversation",
    props: {
      scope: { type: String, required: true }, // 'contact' | 'channel'
      peer: { type: String, required: true },  // pubkey prefix or channel id
    },
    data: function () {
      return { store: MW.store, draft: "" };
    },
    computed: {
      entity: function () {
        return this.scope === "channel"
          ? this.store.getChannel(this.peer)
          : this.store.getContact(this.peer);
      },
      title: function () {
        if (!this.entity) return "Unknown";
        return this.scope === "channel" ? "# " + this.entity.name : this.entity.adv_name;
      },
      subtitle: function () {
        if (!this.entity) return "";
        if (this.scope === "channel") return "Channel slot " + this.entity.slot;
        var t = this.store.contactType(this.entity);
        return t.label + " · seen " + this.store.timeAgo(this.entity.last_seen);
      },
      items: function () {
        var store = this.store;
        var msgs = this.store.messagesFor(this.scope, this.peer);
        // Interleave day separators; keys must be stable so Vue patches in
        // place instead of re-creating every bubble (which replayed the
        // entrance animation on each send).
        var out = [], lastDay = null;
        msgs.forEach(function (m, i) {
          var day = store.dayLabel(m.ts);
          if (day !== lastDay) {
            out.push({ kind: "day", label: day, key: "d-" + day + "-" + i });
            lastDay = day;
          }
          out.push({ kind: "msg", msg: m, key: "m-" + m.ts + "-" + i });
        });
        return out;
      },
      msgCount: function () {
        return this.store.messagesFor(this.scope, this.peer).length;
      },
      avatarContact: function () {
        // Channel avatars reuse the avatar component with a synthetic contact.
        return this.scope === "channel"
          ? { public_key: this.peer, adv_name: this.title, type: 3 }
          : this.entity;
      },
    },
    watch: {
      peer: function () {
        this.draft = "";
        this.scrollToEnd();
        if (this.scope === "channel") this.store.markChannelRead(this.peer);
      },
      // Only jump to the bottom when a message arrives — not on unrelated
      // re-renders like typing in the composer.
      msgCount: function () {
        this.scrollToEnd();
      },
    },
    mounted: function () {
      this.scrollToEnd();
      if (this.scope === "channel") this.store.markChannelRead(this.peer);
    },
    methods: {
      senderColor: function (sender) {
        var h = 0;
        for (var i = 0; i < sender.length; i++) h = (h * 31 + sender.charCodeAt(i)) | 0;
        h = Math.round((h % 360) * 137.508) % 360; // golden-angle spread
        return { color: "hsl(" + h + ", 75%, 72%)" };
      },
      send: function () {
        var text = this.draft.trim();
        if (!text) return;
        this.store.sendMessage(this.scope, this.peer, text);
        this.draft = "";
      },
      scrollToEnd: function () {
        var self = this;
        this.$nextTick(function () {
          var el = self.$refs.scroll;
          if (el) el.scrollTop = el.scrollHeight;
        });
      },
    },
    template:
      '<div class="convo">' +
      '  <div class="convo__header">' +
      '    <button class="icon-btn only-mobile" style="margin-right:-4px" @click="$router.push(scope === \'channel\' ? \'/channels\' : \'/contacts\')" aria-label="Back">' +
      '      <mw-icon name="arrow-left" :size="20" />' +
      '    </button>' +
      '    <mw-avatar v-if="entity" :contact="avatarContact" size="sm" />' +
      '    <div class="convo__header-meta">' +
      '      <div class="convo__header-name">{{ title }}</div>' +
      '      <div class="convo__header-sub">{{ subtitle }}</div>' +
      '    </div>' +
      '    <button v-if="scope === \'contact\'" class="icon-btn" title="Contact details"' +
      '      @click="$router.push(\'/contacts/\' + peer + \'/info\')" aria-label="Contact details">' +
      '      <mw-icon name="info" :size="19" />' +
      '    </button>' +
      '  </div>' +
      '  <div class="convo__scroll" ref="scroll">' +
      '    <template v-for="item in items" :key="item.key">' +
      '      <div v-if="item.kind === \'day\'" class="convo__day">{{ item.label }}</div>' +
      '      <div v-else class="msg" :class="\'msg--\' + item.msg.dir">' +
      '        <span v-if="item.msg.dir === \'in\' && item.msg.sender" class="msg__sender" :style="senderColor(item.msg.sender)">{{ item.msg.sender }}</span>' +
      '        {{ item.msg.text }}' +
      '        <span class="msg__time">{{ store.timeOfDay(item.msg.ts) }}</span>' +
      '      </div>' +
      '    </template>' +
      '    <mw-empty v-if="!items.length" icon="message-circle" title="No messages yet" subtitle="Say hello — the mesh is listening." />' +
      '  </div>' +
      '  <div class="convo__composer">' +
      '    <textarea class="convo__input" rows="1" v-model="draft" placeholder="Message…"' +
      '      @keydown.enter.exact.prevent="send"></textarea>' +
      '    <button class="convo__send" :disabled="!draft.trim()" @click="send" aria-label="Send">' +
      '      <mw-icon name="send" :size="18" />' +
      '    </button>' +
      '  </div>' +
      "</div>",
  };
})();
