/* Path editor modal — Flood / Direct / Manual routing for a contact.
   Manual mode supports typing hashes (validated against the network's
   hash width: 1/2/4 bytes) and picking known repeaters; chips can be
   drag-reordered. Emits `close` on save or dismiss. */

(function () {
  window.MW = window.MW || {};
  MW.components = MW.components || {};

  MW.components.PathEditor = {
    name: "MwPathEditor",
    props: { contact: { type: Object, required: true } },
    emits: ["close"],
    data: function () {
      var p = this.contact.path || { mode: "direct", hops: [] };
      return {
        store: MW.store,
        mode: p.mode,
        hops: p.hops.slice(),
        typed: p.hops.join(" "),
        dragFrom: null,
      };
    },
    computed: {
      hashBytes: function () {
        return this.store.pathHashBytes;
      },
      hexLen: function () {
        return this.hashBytes * 2;
      },
      knownRepeaters: function () {
        var self = this;
        return this.store.contacts.filter(function (c) {
          return c.type === 2 && c.public_key !== self.contact.public_key;
        });
      },
      typedTokens: function () {
        return this.typed.toLowerCase().split(/[\s,]+/).filter(Boolean);
      },
      typedError: function () {
        var len = this.hexLen;
        var bad = this.typedTokens.filter(function (t) {
          return !/^[0-9a-f]+$/.test(t) || t.length !== len;
        });
        if (!bad.length) return "";
        return "Each hop must be " + len + " hex chars (" + this.hashBytes + "-byte hash) — check: " + bad.join(" ");
      },
      hopsView: function () {
        var store = this.store;
        return this.hops.map(function (h) {
          var c = store.resolveHop(h);
          return { hash: h, name: c ? c.adv_name : null };
        });
      },
      typedPlaceholder: function () {
        var store = this.store;
        return this.knownRepeaters.slice(0, 3).map(function (c) {
          return store.hopHash(c.public_key);
        }).join(" ") || "ab cd ef";
      },
    },
    watch: {
      typed: function () {
        if (!this.typedError) this.hops = this.typedTokens;
      },
      // Re-map hashes of known relays to the new width when the network
      // hash size changes; unknown hashes are left as entered.
      hashBytes: function () {
        var store = this.store;
        this.hops = this.hops.map(function (h) {
          var c = store.resolveHop(h);
          return c ? store.hopHash(c.public_key) : h;
        });
        this.syncTyped();
      },
    },
    methods: {
      syncTyped: function () {
        this.typed = this.hops.join(" ");
      },
      repeaterHash: function (c) {
        return this.store.hopHash(c.public_key);
      },
      inPath: function (c) {
        var h = this.repeaterHash(c);
        return this.hops.indexOf(h) !== -1;
      },
      toggleRepeater: function (c) {
        var h = this.repeaterHash(c);
        var i = this.hops.indexOf(h);
        if (i === -1) this.hops.push(h);
        else this.hops.splice(i, 1);
        this.syncTyped();
      },
      removeHop: function (i) {
        this.hops.splice(i, 1);
        this.syncTyped();
      },
      dropAt: function (i) {
        if (this.dragFrom === null || this.dragFrom === i) return;
        var moved = this.hops.splice(this.dragFrom, 1)[0];
        this.hops.splice(i, 0, moved);
        this.dragFrom = null;
        this.syncTyped();
      },
      save: function () {
        this.store.setPath(this.contact.public_key, {
          mode: this.mode,
          hops: this.mode === "manual" ? this.hops.slice() : [],
        });
        this.$emit("close");
      },
    },
    template:
      '<mw-modal title="Edit path" icon="waypoints" @close="$emit(\'close\')">' +
      '  <div class="seg" role="tablist">' +
      '    <button v-for="m in [\'flood\', \'direct\', \'manual\']" :key="m" class="seg__opt"' +
      '      :class="{ \'is-active\': mode === m }" @click="mode = m">{{ m[0].toUpperCase() + m.slice(1) }}</button>' +
      '  </div>' +
      '  <p v-if="mode === \'flood\'" class="path-desc">Packets are flooded to every node in earshot — best reach, most airtime.</p>' +
      '  <p v-else-if="mode === \'direct\'" class="path-desc">No relays. Only works while {{ contact.adv_name }} is in direct radio range.</p>' +
      '  <template v-else>' +
      '    <label class="field-label" for="path-hashes">Hops — {{ hashBytes }}-byte hashes ({{ hexLen }} hex chars each), in order</label>' +
      '    <input id="path-hashes" class="input mono" v-model="typed" :placeholder="typedPlaceholder" spellcheck="false" autocomplete="off" />' +
      '    <p v-if="typedError" class="path-hint path-hint--err">{{ typedError }}</p>' +
      '    <div v-if="hopsView.length" class="path-hops">' +
      '      <span v-for="(hop, i) in hopsView" :key="i" class="hop-chip" :class="{ \'hop-chip--unknown\': !hop.name }"' +
      '        draggable="true" @dragstart="dragFrom = i" @dragend="dragFrom = null" @dragover.prevent @drop="dropAt(i)"' +
      '        :title="hop.name || \'Unknown relay\'">' +
      '        <mw-icon name="grip-vertical" :size="14" class="hop-chip__grip" />' +
      '        <span class="mono">{{ hop.hash }}</span>' +
      '        <span v-if="hop.name" class="hop-chip__name">{{ hop.name }}</span>' +
      '        <button class="hop-chip__x" @click="removeHop(i)" aria-label="Remove hop"><mw-icon name="x" :size="12" /></button>' +
      '      </span>' +
      '    </div>' +
      '    <p v-else class="path-hint">No hops — this behaves like Direct. Drag chips to reorder.</p>' +
      '    <div class="list-section" style="padding-left:0;padding-right:0">Known repeaters — tap to add</div>' +
      '    <div class="repeater-pick">' +
      '      <button v-for="r in knownRepeaters" :key="r.public_key" class="repeater-pick__row"' +
      '        :class="{ \'is-in-path\': inPath(r) }" @click="toggleRepeater(r)">' +
      '        <mw-icon name="radio-tower" :size="16" />' +
      '        <span class="repeater-pick__name">{{ r.adv_name }}</span>' +
      '        <span class="mono" style="color:var(--text-2)">{{ repeaterHash(r) }}</span>' +
      '        <mw-icon v-if="inPath(r)" name="check" :size="16" style="color:var(--accent)" />' +
      '      </button>' +
      '      <p v-if="!knownRepeaters.length" class="path-hint">No other repeaters discovered yet.</p>' +
      '    </div>' +
      '  </template>' +
      '  <div class="modal__actions">' +
      '    <div class="seg seg--sm" title="Network path hash size">' +
      '      <button v-for="n in [1, 2, 4]" :key="n" class="seg__opt" :class="{ \'is-active\': hashBytes === n }"' +
      '        @click="store.setPathHashBytes(n)">{{ n }}B</button>' +
      '    </div>' +
      '    <span style="flex:1"></span>' +
      '    <button class="btn btn--ghost" @click="$emit(\'close\')">Cancel</button>' +
      '    <button class="btn btn--primary" :disabled="mode === \'manual\' && !!typedError" @click="save">' +
      '      <mw-icon name="check" :size="18" /> Save path' +
      '    </button>' +
      '  </div>' +
      '</mw-modal>',
  };
})();
