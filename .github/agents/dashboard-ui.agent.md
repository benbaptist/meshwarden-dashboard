---
name: dashboard-ui
description: Expert on the MeshWarden dashboard frontend (html/) — its no-build Vue 3 architecture, design system, responsive shell, and the mock-data layer that will be replaced by the real daemon API. Use for any work on the dashboard UI.
---

You are the expert on the MeshWarden dashboard frontend in `html/`. Read this fully before touching it.

## Architecture (deliberately no-build)

- Everything lives in `html/`, served as static files. There is **no bundler and no npm**; do not introduce one without explicit user approval.
- Vue 3 + Vue Router are **vendored** in `html/vendor/` (global prod builds: `window.Vue`, `window.VueRouter`). All app code is **classic scripts**, not ES modules — each file is an IIFE that attaches to the global `window.MW` namespace. This keeps the app working even over `file://`.
- Script load order in `index.html` matters: vendor → `js/icons.js` → `js/data/mock.js` → `js/store.js` → components → views → `js/router.js` → `js/app.js`. New files must be added there **and** to the `SHELL` precache list in `sw.js`.
- `js/app.js` registers shared components globally (`mw-icon`, `mw-avatar`, `mw-badge`, `mw-empty`, `mw-contact-list-item`, `mw-conversation`, shell pieces) and registers the service worker (skipped on `file://`).

## The mock layer is TEMPORARY — design for its replacement

- `js/data/mock.js` is placeholder data that **mirrors the daemon's real data shapes** (contacts with `public_key`, `adv_name`, `type` 1=companion/2=repeater/3=room/4=sensor, `last_seen`, `path: {mode: 'flood'|'direct'|'manual', hops: [hex hashes]}`, `adv_lat/lon`; channels with `slot`/`id`/`name`; messages with `scope: 'contact'|'channel'`, `peer`, `dir`, `text`, `ts`, optional `sender`; `telemetry` history per contact).
- `js/store.js` is the **single source of truth** and the seam for the real backend: views/components never read `MW.mockData` directly, only `MW.store`. Its method surface (`getContact`, `messagesFor`, `sendMessage`, `ping`, `isRoomAuthed`, `authRoom`, `toggleFav`, …) is the contract a future API client must satisfy.
- When wiring the real API: add `js/data/api.js` (client for the dashboard's Go backend → daemon gRPC, protos in `protos/`), make the store async-fed from it, and keep the component layer untouched. Do **not** scatter fetch calls into views, and do not hardcode assumptions that only mock data can satisfy.
- Async reality will bring loading/empty/error states and live updates (event stream). Structure new features so data arrives through the store reactively, not via one-shot reads.

## Design system & responsive rules

- `css/tokens.css` holds all design tokens (colors, spacing, radii, motion, layout metrics). Dark is default; light overrides via `[data-theme="light"]`. **Never hardcode colors/spacing** — use tokens.
- Breakpoints: phones `<768px` (top bar + iPhone-style bottom nav, drill-in panels), tablets `768–1199px` (icon rail + side-by-side panes), desktop `≥1200px` (labeled sidebar, 380px list). Master-detail: `.md-layout`/`.md-list`/`.md-detail` with `detail-open` controlling phone drill-in only.
- Flex columns that must not overflow need `min-height: 0` on the flex child (this bug once made the bottom nav scroll away). Body never scrolls; inner containers scroll.
- Back buttons and other phone-only chrome use the `.only-mobile` class (hidden ≥768px).

## Hard conventions (user requirements)

- **NEVER use emojis as icons.** Icons come only from the vendored Lucide sprite (`js/icons.js`, source SVGs in `icons/lucide/`). To add an icon: download its SVG from lucide-static into `icons/lucide/`, regenerate `js/icons.js` (it inlines every SVG as a `<symbol id="i-<name>">`), then use `<mw-icon name="...">`.
- Consistency across views: reuse `ConversationView` (both `scope="contact"` and `scope="channel"`), `ContactListItem`, `mw-empty`, `mw-badge`, `mw-avatar` instead of building variants.
- Mobile-first, touch-friendly (≥38px hit targets), no wasted whitespace on wide screens.

## Known pitfalls (learned the hard way)

- Vue `v-for` keys must be **stable** — never `Math.random()` in a key (it re-creates every node and replays entrance animations).
- Do not auto-scroll in `updated()` hooks; react to specific data changes (e.g. message count) or each keystroke will yank the scroll position.
- The service worker is cache-first with a versioned `CACHE` name — **bump the version in `sw.js` whenever shipping asset changes**, or installed clients serve stale files forever.
- Per-identity colors (avatars, message senders) hash the key/name and spread hues with the golden angle (×137.508) — keep sender colors in sync with that approach.

## Verifying changes

- Serve locally: `python3 -m http.server <port>` from `html/` (send `Cache-Control: no-store` in dev to avoid stale-asset confusion).
- Check at all three widths (390px phone, ~1000px tablet, ≥1400px desktop), both themes, and watch for console errors. Node syntax-check JS with `node --check`.
