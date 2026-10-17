/* Contacts layout: list on the left, detail/conversation panel on the right
   (wide viewports) or drill-in navigation (narrow). */

(function () {
  window.MW = window.MW || {};
  MW.views = MW.views || {};

  MW.views.ContactsView = {
    name: "MwContactsView",
    data: function () {
      return { store: MW.store };
    },
    computed: {
      sorted: function () {
        return this.store.contacts
          .slice()
          .sort(function (a, b) { return b.last_seen - a.last_seen; });
      },
      favorites: function () {
        var store = this.store;
        return this.sorted.filter(function (c) { return store.isFav(c.public_key); });
      },
      rest: function () {
        var store = this.store;
        return this.sorted.filter(function (c) { return !store.isFav(c.public_key); });
      },
    },
    methods: {
      isActive: function (c) {
        return this.$route.params.key === c.public_key;
      },
    },
    template:
      '<div class="md-layout" :class="{ \'detail-open\': $route.params.key }">' +
      '  <div class="md-list">' +
      '    <template v-if="favorites.length">' +
      '      <div class="list-section">Favorites</div>' +
      '      <mw-contact-list-item v-for="c in favorites" :key="c.public_key" :contact="c" :active="isActive(c)" />' +
      '    </template>' +
      '    <div class="list-section">All contacts</div>' +
      '    <mw-contact-list-item v-for="c in rest" :key="c.public_key" :contact="c" :active="isActive(c)" />' +
      '  </div>' +
      '  <div class="md-detail">' +
      '    <router-view />' +
      '  </div>' +
      "</div>",
  };
})();
