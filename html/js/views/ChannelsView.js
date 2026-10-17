/* Channels layout — same master-detail pattern as Contacts, reusing the
   shared ConversationView with scope="channel". */

(function () {
  window.MW = window.MW || {};
  MW.views = MW.views || {};

  MW.views.ChannelsView = {
    name: "MwChannelsView",
    data: function () {
      return {
        store: MW.store,
        modal: "",
        channelName: "",
        channelSecret: "",
        createdSecret: "",
        channelError: "",
        copied: false,
      };
    },
    computed: {
      hasPublicChannel: function () {
        return this.store.channels.some(function (c) {
          return c.type !== "private" && c.name.toLowerCase() === "public";
        });
      },
      modalTitle: function () {
        return {
          menu: "Add channel",
          create: "Create private channel",
          private: "Join private channel",
          public: "Join hashtag channel",
          created: "Private channel created",
        }[this.modal] || "Add channel";
      },
      modalIcon: function () {
        return { menu: "hash", create: "lock", private: "key-round", public: "hash", created: "key-round" }[this.modal] || "hash";
      },
    },
    methods: {
      startAddChannel: function () {
        this.channelError = "";
        this.modal = "menu";
      },
      backToMenu: function () {
        this.channelError = "";
        this.modal = "menu";
      },
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
      makeSecret: function () {
        var bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
      },
      createPrivate: function () {
        this.channelError = "";
        var name = this.channelName.trim();
        if (!name) { this.channelError = "Enter a channel name."; return; }
        var secret = this.makeSecret();
        var id = this.store.addPrivateChannel(name, secret);
        this.channelName = "";
        this.createdSecret = secret;
        this.modal = "created";
        this.open(this.store.getChannel(id));
      },
      joinPrivate: function () {
        this.channelError = "";
        var secret = this.channelSecret.trim().replace(/\s+/g, "").toLowerCase();
        var name = this.channelName.trim();
        if (!/^[0-9a-f]{32}$/.test(secret)) { this.channelError = "Enter a 32-character hexadecimal channel secret."; return; }
        if (!name) { this.channelError = "Enter a local channel name."; return; }
        var duplicate = this.store.channels.find(function (c) { return c.secret === secret; });
        if (duplicate) { this.channelError = "You have already joined this private channel."; return; }
        var id = this.store.addPrivateChannel(name, secret);
        this.channelName = "";
        this.channelSecret = "";
        this.modal = "";
        this.open(this.store.getChannel(id));
      },
      joinPublic: function () {
        this.channelError = "";
        var id = this.store.joinPublicChannel(this.channelName);
        if (!id) { this.channelError = "Enter a hashtag channel name."; return; }
        this.channelName = "";
        this.modal = "";
        this.open(this.store.getChannel(id));
      },
      rejoinPublic: function () {
        var id = this.store.joinPublicChannel("Public");
        this.open(this.store.getChannel(id));
      },
      copySecret: function (secret) {
        var self = this;
        navigator.clipboard.writeText(secret).then(function () {
          self.copied = true;
          setTimeout(function () { self.copied = false; }, 1800);
        }, function () { self.channelError = "Could not copy the channel secret."; });
      },
    },
    template:
      '<div class="md-layout" :class="{ \'detail-open\': $route.params.id }">' +
      '  <div class="md-list">' +
      '    <div class="page-header" style="padding:var(--sp-3);display:flex;gap:var(--sp-2);flex-wrap:wrap">' +
      '      <button class="btn btn--primary btn--sm" @click="startAddChannel"><mw-icon name="plus" :size="16" /> Add channel</button>' +
      '    </div>' +
      '    <div class="list-section">Channels</div>' +
      '    <div v-for="c in store.channels" :key="c.id" class="contact-item"' +
      '         :class="{ \'is-active\': isActive(c) }" role="button" tabindex="0"' +
      '         @click="open(c)" @keydown.enter="open(c)">' +
      '      <mw-avatar :contact="{ public_key: c.id, adv_name: c.name, type: 3 }" />' +
      '      <div class="contact-item__meta">' +
      '        <div class="contact-item__name-row">' +
      '          <span class="contact-item__name">{{ c.name === "Public" ? "Public" : (c.type === "private" ? c.name : "# " + c.name) }}</span>' +
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
      '  <mw-modal v-if="modal" :title="modalTitle" :icon="modalIcon" @close="modal = \'\'">' +
      '    <transition name="modal-step" mode="out-in">' +
      '      <div :key="modal">' +
      '        <template v-if="modal === \'menu\'">' +
      '          <p>Choose how you want to add a channel.</p>' +
      '          <div class="channel-add-options">' +
      '            <button class="channel-add-option" @click="modal = \'create\'"><mw-icon name="lock" :size="20" /><span><strong>Create private channel</strong><small>Generate a new secret and join</small></span><mw-icon name="chevron-right" :size="18" /></button>' +
      '            <button class="channel-add-option" @click="modal = \'private\'"><mw-icon name="key-round" :size="20" /><span><strong>Join private channel</strong><small>Enter a shared secret and local name</small></span><mw-icon name="chevron-right" :size="18" /></button>' +
      '            <button class="channel-add-option" @click="modal = \'public\'"><mw-icon name="hash" :size="20" /><span><strong>Join hashtag channel</strong><small>Join a public channel by name</small></span><mw-icon name="chevron-right" :size="18" /></button>' +
      '            <button class="channel-add-option" :disabled="hasPublicChannel" @click="rejoinPublic"><mw-icon name="refresh-cw" :size="20" /><span><strong>Re-join Public</strong><small>{{ hasPublicChannel ? "Public is already on this node" : "Restore the default public channel" }}</small></span><mw-icon name="chevron-right" :size="18" /></button>' +
      '          </div>' +
      '        </template>' +
      '        <template v-else-if="modal === \'create\'">' +
      '          <p>A new secret will be generated and this node will join the channel.</p>' +
      '          <label class="form-label">Local channel name<input class="input" v-model="channelName" placeholder="e.g. Field Team" /></label>' +
      '          <p v-if="channelError" class="text-danger">{{ channelError }}</p>' +
      '          <div class="modal__actions"><button class="btn btn--ghost" @click="backToMenu">Back</button><button class="btn btn--primary" @click="createPrivate">Create and join</button></div>' +
      '        </template>' +
      '        <template v-else-if="modal === \'private\'">' +
      '          <label class="form-label">Channel secret<input class="input mono" v-model="channelSecret" autocomplete="off" placeholder="32 hexadecimal characters" /></label>' +
      '          <label class="form-label">Local channel name<input class="input" v-model="channelName" placeholder="Any name for your own list" /></label>' +
      '          <p v-if="channelError" class="text-danger">{{ channelError }}</p>' +
      '          <div class="modal__actions"><button class="btn btn--ghost" @click="backToMenu">Back</button><button class="btn btn--primary" @click="joinPrivate">Join channel</button></div>' +
      '        </template>' +
      '        <template v-else-if="modal === \'created\'">' +
      '          <p>Save this secret. Other members need the same secret to communicate; the channel name is local to each node.</p>' +
      '          <input class="input mono" readonly :value="createdSecret" />' +
      '          <p v-if="copied">Secret copied.</p><p v-if="channelError" class="text-danger">{{ channelError }}</p>' +
      '          <div class="modal__actions"><button class="btn btn--ghost" @click="copySecret(createdSecret)">Copy secret</button><button class="btn btn--primary" @click="modal = \'\'">Done</button></div>' +
      '        </template>' +
      '        <template v-else>' +
      '          <label class="form-label">Channel name<input class="input" v-model="channelName" placeholder="#community" /></label>' +
      '          <p>Public channels do not require a secret key.</p>' +
      '          <p v-if="channelError" class="text-danger">{{ channelError }}</p>' +
      '          <div class="modal__actions"><button class="btn btn--ghost" @click="backToMenu">Back</button><button class="btn btn--primary" @click="joinPublic">Join channel</button></div>' +
      '        </template>' +
      '      </div>' +
      '    </transition>' +
      '  </mw-modal>' +
      "</div>",
  };
})();
