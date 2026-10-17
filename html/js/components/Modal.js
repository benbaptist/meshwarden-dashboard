/* Reusable modal dialog — overlay click or the X emits `close`. */

(function () {
  window.MW = window.MW || {};
  MW.components = MW.components || {};

  MW.components.Modal = {
    name: "MwModal",
    props: {
      title: { type: String, required: true },
      icon: { type: String, default: "" },
    },
    emits: ["close"],
    template:
      '<div class="modal-overlay" @click.self="$emit(\'close\')">' +
      '  <div class="modal" role="dialog" :aria-label="title">' +
      '    <div class="modal__head">' +
      '      <div class="modal__title">' +
      '        <mw-icon v-if="icon" :name="icon" :size="18" />' +
      '        {{ title }}' +
      '      </div>' +
      '      <button class="icon-btn" @click="$emit(\'close\')" aria-label="Close">' +
      '        <mw-icon name="x" :size="18" />' +
      '      </button>' +
      '    </div>' +
      '    <div class="modal__body"><slot /></div>' +
      '  </div>' +
      "</div>",
  };
})();
