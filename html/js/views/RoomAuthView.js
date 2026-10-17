/* Password gate shown before entering a room-server conversation
   when the session isn't authenticated yet. */

(function () {
  window.MW = window.MW || {};
  MW.views = MW.views || {};

  MW.views.RoomAuthView = {
    name: "MwRoomAuth",
    props: { contact: { type: Object, required: true } },
    data: function () {
      return { password: "", failed: false, busy: false };
    },
    methods: {
      submit: function () {
        var self = this;
        if (!this.password) {
          this.fail();
          return;
        }
        this.busy = true;
        // Mock latency; real impl will authenticate against the room via the API.
        setTimeout(function () {
          self.busy = false;
          var ok = MW.store.authRoom(self.contact.public_key, self.password);
          if (!ok) self.fail();
        }, 500);
      },
      fail: function () {
        var self = this;
        this.failed = true;
        setTimeout(function () { self.failed = false; }, 500);
      },
    },
    template:
      '<div class="page">' +
      '  <button class="icon-btn only-mobile" @click="$router.push(\'/contacts\')" aria-label="Back to contacts">' +
      '    <mw-icon name="arrow-left" :size="20" />' +
      '  </button>' +
      '  <div class="auth-card">' +
      '    <div class="auth-card__icon"><mw-icon name="lock" :size="30" /></div>' +
      '    <div>' +
      '      <h2>{{ contact.adv_name }}</h2>' +
      '      <p style="color:var(--text-1);margin-top:4px">This room server requires a password.</p>' +
      '    </div>' +
      '    <form @submit.prevent="submit" :class="{ shake: failed }" style="display:flex;flex-direction:column;gap:12px">' +
      '      <div style="text-align:left">' +
      '        <label class="field-label" for="room-pw">Room password</label>' +
      '        <input id="room-pw" class="input" type="password" v-model="password" autocomplete="current-password" placeholder="••••••••" />' +
      '      </div>' +
      '      <button class="btn btn--primary btn--block" type="submit" :disabled="busy">' +
      '        <mw-icon name="key-round" :size="18" />' +
      '        {{ busy ? "Authenticating…" : "Authenticate" }}' +
      '      </button>' +
      '    </form>' +
      '    <p style="font-size:12.5px;color:var(--text-2)">Mock auth — any password works until the API is wired.</p>' +
      '  </div>' +
      "</div>",
  };
})();
