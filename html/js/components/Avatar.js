/* <mw-avatar :contact="c" size="md" /> — colored circle with the contact-type glyph.
   Color is derived from the pubkey so each contact has a stable identity hue. */

(function () {
  window.MW = window.MW || {};
  MW.components = MW.components || {};

  function hueFromKey(key) {
    var h = 0;
    for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
    return h;
  }

  MW.components.Avatar = {
    name: "MwAvatar",
    props: {
      contact: { type: Object, required: true },
      size: { type: String, default: "md" }, // sm | md | lg
      online: { type: Boolean, default: false },
    },
    computed: {
      typeInfo: function () {
        return MW.store.contactType(this.contact);
      },
      style: function () {
        var h = hueFromKey(this.contact.public_key);
        return {
          background:
            "linear-gradient(135deg, hsl(" + h + ", 45%, 38%), hsl(" + ((h + 40) % 360) + ", 50%, 28%))",
        };
      },
      iconSize: function () {
        return this.size === "lg" ? 30 : this.size === "sm" ? 16 : 20;
      },
      cls: function () {
        return "avatar" + (this.size !== "md" ? " avatar--" + this.size : "");
      },
    },
    template:
      '<div :class="cls" :style="style">' +
      '<mw-icon :name="typeInfo.icon" :size="iconSize" />' +
      '<span v-if="online" class="avatar__dot"></span>' +
      "</div>",
  };
})();
