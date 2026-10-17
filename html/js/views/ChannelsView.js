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
      '      <button class="btn btn--primary btn--sm" @click="modal = \'create\'">Create private</button>' +
      '      <button class="btn btn--ghost btn--sm" @click="modal = \'private\'">Join private</button>' +
      '      <button class="btn btn--ghost btn--sm" @click="modal = \'public\'">Join hashtag</button>' +
      '      <button class="btn btn--ghost btn--sm" @click="rejoinPublic">Re-join Public</button>' +
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
      '  <mw-modal v-if="modal === \'create\'" title="Create private channel" icon="lock" @close="modal = \'\'">' +
      '    <p>A new secret will be generated and this node will join the channel.</p>' +
      '    <label class="form-label">Local channel name<input class="input" v-model="channelName" placeholder="e.g. Field Team" /></label>' +
      '    <p v-if="channelError" class="text-danger">{{ channelError }}</p>' +
      '    <div class="modal__actions"><button class="btn btn--ghost" @click="modal = \'\'">Cancel</button><button class="btn btn--primary" @click="createPrivate">Create and join</button></div>' +
      '  </mw-modal>' +
      '  <mw-modal v-if="modal === \'private\'" title="Join private channel" icon="key-round" @close="modal = \'\'">' +
      '    <label class="form-label">Channel secret<input class="input mono" v-model="channelSecret" autocomplete="off" placeholder="32 hexadecimal characters" /></label>' +
      '    <label class="form-label">Local channel name<input class="input" v-model="channelName" placeholder="Any name for your own list" /></label>' +
      '    <p v-if="channelError" class="text-danger">{{ channelError }}</p>' +
      '    <div class="modal__actions"><button class="btn btn--ghost" @click="modal = \'\'">Cancel</button><button class="btn btn--primary" @click="joinPrivate">Join channel</button></div>' +
      '  </mw-modal>' +
      '  <mw-modal v-if="modal === \'created\'" title="Private channel created" icon="key-round" @close="modal = \'\'">' +
      '    <p>Save this secret. Other members need the same secret to communicate; the channel name is local to each node.</p>' +
      '    <input class="input mono" readonly :value="createdSecret" />' +
      '    <p v-if="copied">Secret copied.</p><p v-if="channelError" class="text-danger">{{ channelError }}</p>' +
      '    <div class="modal__actions"><button class="btn btn--ghost" @click="copySecret(createdSecret)">Copy secret</button><button class="btn btn--primary" @click="modal = \'\'">Done</button></div>' +
      '  </mw-modal>' +
      '  <mw-modal v-if="modal === \'public\'" title="Join hashtag channel" icon="hash" @close="modal = \'\'">' +
      '    <label class="form-label">Channel name<input class="input" v-model="channelName" placeholder="#community" /></label>' +
      '    <p>Public channels do not require a secret key.</p>' +
      '    <p v-if="channelError" class="text-danger">{{ channelError }}</p>' +
      '    <div class="modal__actions"><button class="btn btn--ghost" @click="modal = \'\'">Cancel</button><button class="btn btn--primary" @click="joinPublic">Join channel</button></div>' +
      '  </mw-modal>' +
      "</div>",
  };
})();
