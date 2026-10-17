/* Settings — appearance, account, about. Placeholder sections until the
   daemon API is wired. */

(function () {
  window.MW = window.MW || {};
  MW.views = MW.views || {};

  MW.views.SettingsView = {
    name: "MwSettingsView",
    data: function () {
      return { store: MW.store, loggedOut: false };
    },
    methods: {
      logout: function () {
        var self = this;
        this.loggedOut = true;
        setTimeout(function () {
          self.loggedOut = false;
          self.store.logout();
        }, 800);
      },
    },
    template:
      '<div class="page">' +
      '  <h1 class="page__title">Settings</h1>' +
      '  <div class="settings-grid">' +
      '    <div>' +
      '      <div class="card">' +
      '        <div class="card__title">Appearance</div>' +
      '        <div class="theme-toggle">' +
      '          <button class="theme-toggle__opt" :class="{ \'is-active\': store.theme === \'dark\' }" @click="store.setTheme(\'dark\')">' +
      '            <mw-icon name="moon" :size="16" /> Dark' +
      '          </button>' +
      '          <button class="theme-toggle__opt" :class="{ \'is-active\': store.theme === \'light\' }" @click="store.setTheme(\'light\')">' +
      '            <mw-icon name="sun" :size="16" /> Light' +
      '          </button>' +
      '        </div>' +
      '      </div>' +
      '      <div class="card">' +
      '        <div class="card__title">Node</div>' +
      '        <div class="kv"><span class="kv__k">Daemon</span><span class="kv__v">meshwarden-daemon 0.1.0</span></div>' +
      '        <div class="kv"><span class="kv__k">Connection</span><span class="kv__v" style="color:var(--ok)">Connected (mock)</span></div>' +
      '        <div class="kv"><span class="kv__k">Radio</span><span class="kv__v">915 MHz · SF7 · BW250</span></div>' +
      '      </div>' +
      '    </div>' +
      '    <div>' +
      '      <div class="card">' +
      '        <div class="card__title">Account</div>' +
      '        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
      '          <mw-avatar :contact="{ public_key: store.account.public_key, adv_name: store.account.name, type: 1 }" />' +
      '          <div>' +
      '            <div style="font-weight:650">{{ store.account.name }}</div>' +
      '            <div class="mono" style="color:var(--text-2);font-size:12px">{{ store.account.public_key }}</div>' +
      '          </div>' +
      '        </div>' +
      '        <button class="btn btn--danger btn--block" @click="logout" :disabled="loggedOut">' +
      '          <mw-icon name="log-out" :size="18" />' +
      '          {{ loggedOut ? "Logged out (mock)" : "Log out" }}' +
      '        </button>' +
      '      </div>' +
      '      <div class="card">' +
      '        <div class="card__title">About</div>' +
      '        <p style="color:var(--text-1);font-size:14px">' +
      '          MeshWarden dashboard — a PWA front end for your MeshCore companion node.' +
      '          Currently running entirely on placeholder data.' +
      '        </p>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      "</div>",
  };
})();
