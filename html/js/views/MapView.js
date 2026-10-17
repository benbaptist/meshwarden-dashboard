/* Map view — placeholder scatter map plotting contacts by advertised lat/lon
   on a simple linear projection. Real tiles arrive with the API wiring.
   Dots are HTML (not SVG) so they stay circular at any aspect ratio. */

(function () {
  window.MW = window.MW || {};
  MW.views = MW.views || {};

  MW.views.MapView = {
    name: "MwMapView",
    data: function () {
      return { store: MW.store, selected: null };
    },
    computed: {
      points: function () {
        var cs = this.store.contacts.filter(function (c) { return c.adv_lat && c.adv_lon; });
        if (!cs.length) return [];
        var lats = cs.map(function (c) { return c.adv_lat; });
        var lons = cs.map(function (c) { return c.adv_lon; });
        var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
        var minLon = Math.min.apply(null, lons), maxLon = Math.max.apply(null, lons);
        var pad = 8; // percent padding
        return cs.map(function (c) {
          var x = pad + ((c.adv_lon - minLon) / (maxLon - minLon || 1)) * (100 - 2 * pad);
          var y = pad + (1 - (c.adv_lat - minLat) / (maxLat - minLat || 1)) * (100 - 2 * pad);
          return { contact: c, x: x, y: y };
        });
      },
    },
    methods: {
      typeColor: function (c) {
        return this.store.contactType(c).color;
      },
      dotStyle: function (p) {
        var c = this.typeColor(p.contact);
        return {
          left: p.x + "%",
          top: p.y + "%",
          background: c,
          boxShadow: "0 0 0 6px " + c + "2e, 0 0 18px " + c + "66",
        };
      },
      labelStyle: function (p) {
        return { left: p.x + "%", top: p.y + "%" };
      },
      select: function (p) {
        this.selected = this.selected === p ? null : p;
      },
      open: function (p) {
        this.$router.push("/contacts/" + p.contact.public_key);
      },
    },
    template:
      '<div class="map-view">' +
      '  <svg class="map-view__canvas" preserveAspectRatio="none" viewBox="0 0 100 100">' +
      '    <defs>' +
      '      <pattern id="grid" width="6" height="6" patternUnits="userSpaceOnUse">' +
      '        <path d="M 6 0 L 0 0 0 6" fill="none" stroke="var(--border-soft)" stroke-width="0.15" />' +
      '      </pattern>' +
      '    </defs>' +
      '    <rect width="100" height="100" fill="url(#grid)" />' +
      '  </svg>' +
      '  <button v-for="p in points" :key="p.contact.public_key" class="map-dot"' +
      '          :style="dotStyle(p)" :title="p.contact.adv_name"' +
      '          @click="select(p)" @dblclick="open(p)"></button>' +
      '  <div v-if="selected" class="map-label" :style="labelStyle(selected)">' +
      '    <button class="btn btn--ghost" style="padding:6px 14px;font-size:13px" @click="open(selected)">' +
      '      {{ selected.contact.adv_name }}' +
      '    </button>' +
      '  </div>' +
      '  <div class="map-view__hint">Placeholder map · {{ points.length }} nodes · real tiles coming with API wiring</div>' +
      "</div>",
  };
})();
