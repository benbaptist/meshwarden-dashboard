/* <mw-badge :type="3" /> — contact-type pill (Companion / Repeater / Room / Sensor). */

(function () {
  window.MW = window.MW || {};
  MW.components = MW.components || {};

  MW.components.Badge = {
    name: "MwBadge",
    props: { type: { type: Number, required: true } },
    computed: {
      info: function () {
        return MW.store.contactType({ type: this.type });
      },
    },
    template:
      '<span class="badge" :class="\'badge--\' + info.key">' +
      '<mw-icon :name="info.icon" :size="12" />{{ info.label }}' +
      "</span>",
  };
})();
