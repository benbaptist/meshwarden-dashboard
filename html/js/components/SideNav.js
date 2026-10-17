/* Left sidebar — full labeled nav on desktop, icon rail on tablet.
   Account/logout block is pinned to the bottom. */

(function () {
  window.MW = window.MW || {};
  MW.components = MW.components || {};

  MW.components.SideNav = {
    name: "MwSideNav",
    data: function () {
      return {
        store: MW.store,
        items: [
          { to: "/map", icon: "map", label: "Map" },
          { to: "/contacts", icon: "users", label: "Contacts" },
          { to: "/channels", icon: "hash", label: "Channels" },
          { to: "/settings", icon: "settings", label: "Settings" },
        ],
      };
    },
    methods: {
      isActive: function (to) {
        return this.$route.path.startsWith(to);
      },
    },
    template:
      '<nav class="side-nav">' +
      '  <div class="side-nav__brand">' +
      '    <div class="side-nav__logo"><mw-icon name="radio-tower" :size="20" /></div>' +
      '    <div class="side-nav__brand-meta">' +
      '      <div class="side-nav__title">MeshWarden</div>' +
      '      <div class="side-nav__subtitle">Node Dashboard</div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="side-nav__items">' +
      '    <router-link v-for="item in items" :key="item.to" :to="to_of(item)" custom v-slot="{ navigate }">' +
      '      <button class="nav-item" :class="{ \'is-active\': isActive(item.to) }" @click="navigate">' +
      '        <mw-icon :name="item.icon" :size="21" />' +
      '        <span class="nav-item__label">{{ item.label }}</span>' +
      '      </button>' +
      '    </router-link>' +
      '  </div>' +
      '  <div class="side-nav__account">' +
      '    <mw-avatar :contact="{ public_key: store.account.public_key, adv_name: store.account.name, type: 1 }" size="sm" />' +
      '    <div class="side-nav__account-meta">' +
      '      <div class="side-nav__account-name">{{ store.account.name }}</div>' +
      '      <div class="side-nav__account-sub">{{ store.account.role }}</div>' +
      '    </div>' +
      '    <button class="icon-btn" title="Log out" @click="store.logout()">' +
      '      <mw-icon name="log-out" :size="18" />' +
      '    </button>' +
      '  </div>' +
      "</nav>",
    computed: {},
    // helper so template stays tidy
    created: function () {
      this.to_of = function (item) { return item.to; };
    },
  };
})();
