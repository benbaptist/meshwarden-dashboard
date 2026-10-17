/* Routes. ConversationView is shared between contact and channel scopes. */

(function () {
  window.MW = window.MW || {};

  var V = MW.views, C = MW.components;

  var PickContact = {
    template:
      '<mw-empty icon="users" title="Pick a contact" subtitle="Select someone from the list to view details or start a conversation." />',
  };
  var PickChannel = {
    template:
      '<mw-empty icon="hash" title="Pick a channel" subtitle="Select a channel to follow the conversation." />',
  };

  MW.router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(), // hash mode: works over file:// and any static host
    routes: [
      { path: "/", redirect: "/map" },
      { path: "/map", component: V.MapView, meta: { title: "Map" } },
      {
        path: "/contacts",
        component: V.ContactsView,
        meta: { title: "Contacts" },
        children: [
          { path: "", component: PickContact },
          { path: ":key/:mode(info|manage)?", component: V.ContactHome },
        ],
      },
      {
        path: "/channels",
        component: V.ChannelsView,
        meta: { title: "Channels" },
        children: [
          { path: "", component: PickChannel },
          {
            path: ":id",
            component: C.ConversationView,
            props: function (route) {
              return { scope: "channel", peer: route.params.id };
            },
          },
        ],
      },
      { path: "/settings", component: V.SettingsView, meta: { title: "Settings" } },
      { path: "/:pathMatch(.*)*", redirect: "/map" },
    ],
  });
})();
