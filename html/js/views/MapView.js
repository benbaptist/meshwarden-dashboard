/* Map view — real OpenStreetMap base map via vendored Leaflet. Tiles come
   from the standard OSM tile server; in the dark theme a CSS filter (in
   app.css) darkens them so the map blends into the UI. Contacts plot as
   colored div-icon markers by advertised lat/lon; tapping a marker opens a
   themed info bubble with a link to the contact detail page, tapping blank
   map dismisses it (Leaflet's closePopupOnClick). Leaflet handles mouse
   drag/wheel/double-click and touch drag/pinch out of the box.
   Deep link: /map?focus=<public_key> jumps to that node and opens its
   bubble (used by the contact detail page's Map action). */

(function () {
  window.MW = window.MW || {};
  MW.views = MW.views || {};

  var TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  var ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function icon(name, size) {
    return (
      '<svg class="icon" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<use href="#i-' + name + '"></use></svg>'
    );
  }

  MW.views.MapView = {
    name: "MwMapView",
    data: function () {
      return { store: MW.store };
    },
    computed: {
      located: function () {
        return this.store.contacts.filter(function (c) {
          return typeof c.adv_lat === "number" && typeof c.adv_lon === "number";
        });
      },
    },
    watch: {
      // Deep links from the contact detail page: /map?focus=<public_key>
      "$route.query.focus": function (key) {
        if (key && this.focusOn(key, true)) return;
        if (this._map) this._map.closePopup();
      },
      located: {
        deep: true,
        handler: function () {
          this.renderMarkers();
        },
      },
    },
    mounted: function () {
      var self = this;
      this._map = L.map(this.$refs.map, {
        minZoom: 2,
        maxZoom: 19,
        zoomSnap: 0.25, // smooth trackpad/pinch zoom; wheel steps stay whole
        zoomControl: true,
        worldCopyJump: true,
        closePopupOnClick: true, // tap/click blank map dismisses the bubble
      });
      this._markers = {}; // public_key -> L.Marker
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(this._map);
      this.renderMarkers();
      this.$nextTick(function () {
        self._map.invalidateSize();
        var focusKey = self.$route.query.focus;
        if (!focusKey || !self.focusOn(focusKey, false)) self.fitToNodes(false);
      });
    },
    unmounted: function () {
      if (this._map) {
        this._map.remove();
        this._map = null;
      }
    },
    methods: {
      markerIcon: function (contact) {
        var t = this.store.contactType(contact);
        return L.divIcon({
          className: "map-marker",
          html:
            '<span class="map-marker__dot" style="--marker-color:' + t.color + '">' +
            icon(t.icon, 16) +
            "</span>",
          iconSize: [40, 40], // generous hit target for touch
          iconAnchor: [20, 20],
          popupAnchor: [0, -18],
        });
      },

      popupHtml: function (contact) {
        var t = this.store.contactType(contact);
        var seen = this.store.timeAgo(contact.last_seen);
        return (
          '<div class="map-popup">' +
          '  <div class="map-popup__head">' +
          '    <span class="map-popup__chip" style="--marker-color:' + t.color + '">' + icon(t.icon, 15) + "</span>" +
          '    <div class="map-popup__title">' +
          '      <div class="map-popup__name">' + esc(contact.adv_name) + "</div>" +
          '      <div class="map-popup__type">' + esc(t.label) + "</div>" +
          "    </div>" +
          "  </div>" +
          '  <div class="map-popup__meta">' +
          "    <span>" + icon("history", 13) + " Seen " + esc(seen === "now" ? "just now" : seen + " ago") + "</span>" +
          "    <span>" + icon("waypoints", 13) + " " + esc(this.store.pathLabel(contact)) + "</span>" +
          "  </div>" +
          '  <a class="map-popup__open" href="#/contacts/' + encodeURIComponent(contact.public_key) + '/info">' +
          icon("info", 15) + " Details</a>" +
          "</div>"
        );
      },

      renderMarkers: function () {
        var self = this;
        if (!this._map) return;
        var seen = {};
        this.located.forEach(function (c) {
          seen[c.public_key] = true;
          var ll = [c.adv_lat, c.adv_lon];
          var marker = self._markers[c.public_key];
          if (marker) {
            marker.setLatLng(ll);
            marker.setIcon(self.markerIcon(c));
          } else {
            marker = L.marker(ll, {
              icon: self.markerIcon(c),
              title: c.adv_name,
              keyboard: true,
              riseOnHover: true,
            });
            marker.bindPopup(
              function () {
                return self.popupHtml(c);
              },
              { className: "mw-popup", maxWidth: 280, minWidth: 220 }
            );
            marker.addTo(self._map);
            self._markers[c.public_key] = marker;
          }
        });
        Object.keys(this._markers).forEach(function (key) {
          if (!seen[key]) {
            self._map.removeLayer(self._markers[key]);
            delete self._markers[key];
          }
        });
      },

      // Jump to a located contact and open its bubble. Returns false when
      // the contact is unknown or has no position.
      focusOn: function (key, animate) {
        if (!this._map) return false;
        var c = null;
        for (var i = 0; i < this.located.length; i++) {
          if (this.located[i].public_key === key) {
            c = this.located[i];
            break;
          }
        }
        if (!c) return false;
        var ll = [c.adv_lat, c.adv_lon];
        var marker = this._markers[c.public_key];
        if (marker) {
          // Register before setView: its moveend fires synchronously.
          this._map.once("moveend", function () {
            // Defer: on the very first setView, the marker's layer add is
            // still queued until the map 'load' that follows moveend, and
            // openPopup() before that silently no-ops.
            setTimeout(function () {
              marker.openPopup();
            }, 0);
          });
        }
        if (animate) this._map.flyTo(ll, 15);
        else this._map.setView(ll, 15, { animate: false });
        return true;
      },

      fitToNodes: function (animate) {
        if (!this._map) return;
        if (!this.located.length) {
          this._map.setView([30, 0], 2, { animate: !!animate });
          return;
        }
        if (this.located.length === 1) {
          var c = this.located[0];
          this._map.setView([c.adv_lat, c.adv_lon], 14, { animate: !!animate });
          return;
        }
        var bounds = L.latLngBounds(
          this.located.map(function (c) {
            return [c.adv_lat, c.adv_lon];
          })
        );
        this._map.fitBounds(bounds, {
          padding: [48, 48],
          maxZoom: 14,
          animate: !!animate,
        });
      },
    },
    template:
      '<div class="map-view">' +
      '  <div ref="map" class="map-view__map"></div>' +
      '  <button class="map-view__fit" type="button" title="Fit map to nodes" aria-label="Fit map to nodes" @click="fitToNodes(true)">' +
      '    <mw-icon name="crosshair" :size="18" />' +
      "  </button>" +
      '  <div v-if="!located.length" class="map-view__hint">No nodes report a position yet</div>' +
      "</div>",
  };
})();
