/* iPhone-style bottom nav — mobile only (CSS hides it ≥768px). */

(function () {
  window.MW = window.MW || {};
  MW.components = MW.components || {};

  MW.components.BottomNav = {
    name: "MwBottomNav",
    data: function () {
      return {
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
      '<nav class="bottom-nav">' +
      '  <router-link v-for="item in items" :key="item.to" :to="item.to" custom v-slot="{ navigate }">' +
      '    <button class="bottom-nav__item" :class="{ \'is-active\': isActive(item.to) }" @click="navigate">' +
      '      <mw-icon :name="item.icon" :size="23" />' +
      '      <span>{{ item.label }}</span>' +
      '    </button>' +
      '  </router-link>' +
      "</nav>",
  };
})();
