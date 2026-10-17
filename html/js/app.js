/* App bootstrap. */

(function () {
  window.MW = window.MW || {};

  MW.injectIconSprite();

  var app = Vue.createApp(MW.components.AppShell);

  // Globally registered shared components
  app.component("mw-icon", MW.components.Icon);
  app.component("mw-avatar", MW.components.Avatar);
  app.component("mw-badge", MW.components.Badge);
  app.component("mw-empty", MW.components.EmptyState);
  app.component("mw-contact-list-item", MW.components.ContactListItem);
  app.component("mw-conversation", MW.components.ConversationView);
  app.component("mw-side-nav", MW.components.SideNav);
  app.component("mw-bottom-nav", MW.components.BottomNav);
  app.component("mw-top-bar", MW.components.TopBar);
  app.component("mw-modal", MW.components.Modal);
  app.component("mw-path-editor", MW.components.PathEditor);
  app.component("mw-contact-detail", MW.views.ContactDetailView);
  app.component("mw-room-auth", MW.views.RoomAuthView);
  app.component("mw-manage", MW.views.ManageView);

  app.use(MW.router);
  app.mount("#app");

  // PWA service worker (skipped on file://)
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function (err) {
        console.warn("SW registration failed:", err);
      });
    });
  }
})();
