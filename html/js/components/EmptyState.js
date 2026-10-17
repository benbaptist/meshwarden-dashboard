/* <mw-empty icon="map" title="..." subtitle="..." /> */

(function () {
  window.MW = window.MW || {};
  MW.components = MW.components || {};

  MW.components.EmptyState = {
    name: "MwEmpty",
    props: {
      icon: { type: String, default: "info" },
      title: { type: String, default: "" },
      subtitle: { type: String, default: "" },
    },
    template:
      '<div class="empty-state">' +
      '<div class="empty-state__icon"><mw-icon :name="icon" :size="32" /></div>' +
      '<h3 v-if="title">{{ title }}</h3>' +
      '<p v-if="subtitle">{{ subtitle }}</p>' +
      "</div>",
  };
})();
