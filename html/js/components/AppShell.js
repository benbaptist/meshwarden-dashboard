/* Root layout: sidebar (tablet/desktop) or top bar + bottom nav (mobile),
   with the routed view in between. Consistent across all views. */

(function () {
  window.MW = window.MW || {};
  MW.components = MW.components || {};

  MW.components.AppShell = {
    name: "MwAppShell",
    template:
      '<div class="app-shell">' +
      '  <mw-side-nav />' +
      '  <div class="app-main">' +
      '    <mw-top-bar />' +
      '    <main class="app-view">' +
      '      <router-view />' +
      '    </main>' +
      '  </div>' +
      '  <mw-bottom-nav />' +
      "</div>",
  };
})();
