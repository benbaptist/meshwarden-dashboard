/* <mw-icon name="map" :size="20" /> — renders from the injected Lucide sprite. */

(function () {
  window.MW = window.MW || {};
  MW.components = MW.components || {};

  MW.components.Icon = {
    name: "MwIcon",
    props: {
      name: { type: String, required: true },
      size: { type: [Number, String], default: 20 },
    },
    template:
      '<svg class="icon" :width="size" :height="size" aria-hidden="true">' +
      '<use :href="\'#i-\' + name"></use>' +
      "</svg>",
  };
})();
