/* Placeholder data mirroring the daemon's real shapes (contacts/channels/messages
   tables + gRPC payloads). When the API wiring lands, only this module and
   store.js's loading paths should need to change.

   Contact types follow MeshCore: 1=companion, 2=repeater, 3=room server, 4=sensor. */

(function () {
  window.MW = window.MW || {};

  var now = Math.floor(Date.now() / 1000);
  var MIN = 60, HOUR = 3600, DAY = 86400;

  function key(hex) {
    // 12-char pubkey prefix, like the daemon's shortened keys
    return hex;
  }

  MW.mockData = {
    account: {
      name: "Warden-Prime",
      public_key: key("9f3ac41bd2e7"),
      role: "Owner",
    },

    /* path: { mode: 'flood'|'direct'|'manual', hops: [hex hash per hop] }.
       Hop hashes are the first pathHashBytes of each relay's pubkey, so
       "a1" resolves to Hilltop Repeater ("a1b2…"). Hashes with no local
       match (e.g. "3f", "77") stand in for relays we haven't discovered. */
    contacts: [
      { public_key: key("a1b2c3d4e5f6"), adv_name: "Hilltop Repeater",    type: 2, last_seen: now - 3 * MIN,  path: { mode: "manual", hops: ["d0"] },                   adv_lat: 45.4215, adv_lon: -75.6972, battery: 87, snr: 9.5,  fav: true,  model: "RAK4631",  firmware: "v1.8.2" },
      { public_key: key("b7e89f0a1c2d"), adv_name: "Downtown Room",       type: 3, last_seen: now - 12 * MIN, path: { mode: "direct", hops: [] },                     adv_lat: 45.4272, adv_lon: -75.7003, battery: null, snr: 11.2, fav: true,  authed: true,  firmware: "v1.8.0" },
      { public_key: key("c4d5e6f7a8b9"), adv_name: "Maya's T-Deck",       type: 1, last_seen: now - 25 * MIN, path: { mode: "manual", hops: ["a1", "d0"] },           adv_lat: 45.4189, adv_lon: -75.6820, battery: 64, snr: 7.8,  fav: true },
      { public_key: key("d0e1f2a3b4c5"), adv_name: "Ridge Relay North",   type: 2, last_seen: now - 41 * MIN, path: { mode: "manual", hops: ["a1", "2c", "0e"] },     adv_lat: 45.4601, adv_lon: -75.7108, battery: 92, snr: 6.1,  fav: false, model: "Heltec V3", firmware: "v1.7.4" },
      { public_key: key("e6f7a8b9c0d1"), adv_name: "Lakeside Room",       type: 3, last_seen: now - 2 * HOUR,  path: { mode: "manual", hops: ["a1", "6f"] },           adv_lat: 45.3920, adv_lon: -75.7240, battery: null, snr: 5.4,  fav: false, authed: false, firmware: "v1.8.0" },
      { public_key: key("f2a3b4c5d6e7"), adv_name: "Jon (Companion)",     type: 1, last_seen: now - 3 * HOUR,  path: { mode: "direct", hops: [] },                     adv_lat: 45.4240, adv_lon: -75.6901, battery: 78, snr: 10.9, fav: false },
      { public_key: key("0a1b2c3d4e5f"), adv_name: "Garage Sensor",       type: 4, last_seen: now - 5 * HOUR,  path: { mode: "direct", hops: [] },                     adv_lat: 45.4201, adv_lon: -75.6955, battery: 95, snr: 12.0, fav: false },
      { public_key: key("6f7a8b9c0d1e"), adv_name: "Westend Repeater",    type: 2, last_seen: now - 8 * HOUR,  path: { mode: "manual", hops: ["a1", "d0", "2c", "0e"] }, adv_lat: 45.3867, adv_lon: -75.7590, battery: 41, snr: 4.2,  fav: false, model: "RAK4631", firmware: "v1.8.1" },
      { public_key: key("8b9c0d1e2f3a"), adv_name: "Priya's Node",        type: 1, last_seen: now - 1 * DAY,   path: { mode: "manual", hops: ["a1", "d0"] },           adv_lat: 45.4350, adv_lon: -75.6690, battery: 55, snr: 8.3,  fav: false },
      { public_key: key("2c3d4e5f6a7b"), adv_name: "Summit Repeater",     type: 2, last_seen: now - 1 * DAY - 4 * HOUR, path: { mode: "manual", hops: ["a1", "d0", "3f", "6f", "0e"] }, adv_lat: 45.5020, adv_lon: -75.6330, battery: 73, snr: 3.9, fav: false, model: "T-Echo", firmware: "v1.6.9" },
      { public_key: key("4e5f6a7b8c9d"), adv_name: "Harbour Room",        type: 3, last_seen: now - 2 * DAY,   path: { mode: "manual", hops: ["a1", "0e", "6f"] },     adv_lat: 45.4080, adv_lon: -75.7310, battery: null, snr: 6.6,  fav: false, authed: false, firmware: "v1.7.9" },
      { public_key: key("6a7b8c9d0e1f"), adv_name: "Weather Station SE",  type: 4, last_seen: now - 2 * DAY,   path: { mode: "manual", hops: ["a1", "2c"] },           adv_lat: 45.3990, adv_lon: -75.6450, battery: 88, snr: 7.1,  fav: false },
      { public_key: key("8c9d0e1f2a3b"), adv_name: "Sam's Heltec",        type: 1, last_seen: now - 3 * DAY,   path: { mode: "manual", hops: ["d0"] },                 adv_lat: 45.4420, adv_lon: -75.7050, battery: 33, snr: 9.9,  fav: false },
      { public_key: key("0e1f2a3b4c5d"), adv_name: "Valley Repeater",     type: 2, last_seen: now - 4 * DAY,   path: { mode: "manual", hops: ["a1", "d0", "2c", "3f", "6f", "77"] }, adv_lat: 45.3650, adv_lon: -75.7800, battery: 61, snr: 2.8,  fav: false, model: "Heltec V3", firmware: "v1.8.2" },
      { public_key: key("1f2a3b4c5d6e"), adv_name: "Backup Room",         type: 3, last_seen: now - 6 * DAY,   path: { mode: "flood", hops: [] },                     adv_lat: 45.4510, adv_lon: -75.6600, battery: null, snr: 4.7,  fav: false, authed: false, firmware: "v1.8.0" },
    ],

    /* Past telemetry pulls per contact (newest first), incl. failures —
       MeshCore can't distinguish "wrong password" from "no signal". */
    telemetry: {
      "a1b2c3d4e5f6": [
        { ts: now - 26 * MIN, ok: true,  battery: 87, snr: 9.5 },
        { ts: now - 3 * HOUR, ok: true,  battery: 84, snr: 8.9 },
        { ts: now - 7 * HOUR, ok: false },
      ],
      "6f7a8b9c0d1e": [
        { ts: now - 2 * HOUR, ok: true, battery: 43, snr: 4.0 },
        { ts: now - 1 * DAY,  ok: true, battery: 58, snr: 5.1 },
      ],
      "0a1b2c3d4e5f": [
        { ts: now - 45 * MIN, ok: true, battery: 95, snr: 12.0 },
      ],
    },

    channels: [
      { slot: 0, id: "ch-public",  name: "Public",      unread: 3 },
      { slot: 1, id: "ch-ops",     name: "Ops Crew",    unread: 0 },
      { slot: 2, id: "ch-alerts",  name: "WX Alerts",   unread: 1 },
      { slot: 3, id: "ch-testing", name: "Test Bench",  unread: 0 },
    ],

    /* scope: 'contact' (peer = pubkey prefix) or 'channel' (peer = channel id) */
    messages: [
      { scope: "contact", peer: "c4d5e6f7a8b9", dir: "in",  text: "Are you seeing the new repeater on the ridge?", ts: now - 3 * HOUR - 900 },
      { scope: "contact", peer: "c4d5e6f7a8b9", dir: "out", text: "Yep! Came online last night. Path looks clean.", ts: now - 3 * HOUR - 700 },
      { scope: "contact", peer: "c4d5e6f7a8b9", dir: "in",  text: "Nice. SNR is way better than the old westend link.", ts: now - 25 * MIN },
      { scope: "contact", peer: "f2a3b4c5d6e7", dir: "in",  text: "Field test Saturday still on?", ts: now - 3 * HOUR },
      { scope: "contact", peer: "f2a3b4c5d6e7", dir: "out", text: "Yes — meet at the usual spot at 10.", ts: now - 3 * HOUR + 300 },
      { scope: "contact", peer: "8b9c0d1e2f3a", dir: "in",  text: "Finally got the antenna up on the mast!", ts: now - 1 * DAY },
      { scope: "contact", peer: "8c9d0e1f2a3b", dir: "out", text: "Battery's dying, going dark for a bit.", ts: now - 3 * DAY },
      { scope: "contact", peer: "b7e89f0a1c2d", dir: "in",  text: "Anyone up for a range test this weekend?", ts: now - 40 * MIN, sender: "Maya's T-Deck" },
      { scope: "contact", peer: "b7e89f0a1c2d", dir: "in",  text: "I'm in. Bringing the new yagi.", ts: now - 31 * MIN, sender: "Jon (Companion)" },
      { scope: "contact", peer: "b7e89f0a1c2d", dir: "out", text: "Nice — I'll log results in the ops channel.", ts: now - 13 * MIN },
      { scope: "contact", peer: "b7e89f0a1c2d", dir: "in",  text: "Room uptime now 32 days, for the record.", ts: now - 12 * MIN, sender: "Priya's Node" },

      { scope: "channel", peer: "ch-public",  dir: "in", text: "Welcome to the mesh, new nodes popping up weekly.", ts: now - 6 * HOUR, sender: "Hilltop Repeater" },
      { scope: "channel", peer: "ch-public",  dir: "in", text: "Anyone got eyes on the valley path? It's been flaky.", ts: now - 50 * MIN, sender: "Jon (Companion)" },
      { scope: "channel", peer: "ch-public",  dir: "in", text: "Valley repeater is at 61% battery, solar might be shaded.", ts: now - 44 * MIN, sender: "Maya's T-Deck" },
      { scope: "channel", peer: "ch-ops",     dir: "in", text: "Reminder: firmware v1.8.2 rolls out this weekend.", ts: now - 1 * DAY, sender: "Warden-Prime" },
      { scope: "channel", peer: "ch-alerts",  dir: "in", text: "Freeze warning tonight, expect reduced battery performance.", ts: now - 2 * HOUR, sender: "Weather Station SE" },
      { scope: "channel", peer: "ch-testing", dir: "out", text: "ping test 42", ts: now - 2 * DAY },
    ],
  };
})();
