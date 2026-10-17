/* Mobile top bar — view title + account shortcut (desktop hides it via CSS). */

(function () {
  window.MW = window.MW || {};
  MW.components = MW.components || {};

  MW.components.TopBar = {
    name: "MwTopBar",
    data: function () {
      return { store: MW.store };
    },
    computed: {
      title: function () {
        return this.$route.meta.title || "MeshWarden";
      },
    },
    template:
      '<header class="top-bar top-bar--mobile-only">' +
      '  <div class="side-nav__logo" style="width:32px;height:32px"><mw-icon name="radio-tower" :size="16" /></div>' +
      '  <div class="top-bar__title">{{ title }}</div>' +
      '  <router-link to="/settings" custom v-slot="{ navigate }">' +
      '    <button class="icon-btn" title="Account" @click="navigate">' +
      '      <mw-avatar :contact="{ public_key: store.account.public_key, adv_name: store.account.name, type: 1 }" size="sm" />' +
      '    </button>' +
      '  </router-link>' +
      "</header>",
  };
})();
