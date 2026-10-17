/* Service worker — precaches the app shell so the dashboard installs and
   runs fully offline. Bump CACHE when shipping asset changes. */

const CACHE = "meshwarden-v8";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/tokens.css",
  "./css/base.css",
  "./css/app.css",
  "./vendor/vue.global.prod.js",
  "./vendor/vue-router.global.prod.js",
  "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/leaflet.css",
  "./js/icons.js",
  "./js/data/mock.js",
  "./js/store.js",
  "./js/components/Icon.js",
  "./js/components/Avatar.js",
  "./js/components/Badge.js",
  "./js/components/EmptyState.js",
  "./js/components/ContactListItem.js",
  "./js/components/ConversationView.js",
  "./js/components/Modal.js",
  "./js/components/PathEditor.js",
  "./js/components/SideNav.js",
  "./js/components/BottomNav.js",
  "./js/components/TopBar.js",
  "./js/components/AppShell.js",
  "./js/views/MapView.js",
  "./js/views/ContactsView.js",
  "./js/views/ContactHome.js",
  "./js/views/ContactDetailView.js",
  "./js/views/RoomAuthView.js",
  "./js/views/ManageView.js",
  "./js/views/ChannelsView.js",
  "./js/views/SettingsView.js",
  "./js/router.js",
  "./js/app.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Cache-first for shell assets; network fallback. API calls (later) will
// bypass this handler by path.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(event.request).then((res) => {
          if (res.ok && new URL(event.request.url).origin === location.origin) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
    )
  );
});
