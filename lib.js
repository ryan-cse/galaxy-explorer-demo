/* ───────────────────────────────────────────────────────────────
   Galaxy Explorer — pure logic library (UMD)

   Framework-free, side-effect-free functions extracted from app.js so
   they can be unit-tested in isolation (Vitest) AND reused by the
   browser app without a build step.

   Loads two ways:
     • Browser  — <script src="lib.js"></script> exposes window.GalaxyLib
     • Vitest   — require('../lib.js') returns the same API object
   ─────────────────────────────────────────────────────────────── */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node / Vitest
  if (root) root.GalaxyLib = api;                                            // browser global
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Parse a numeric-ish string ("1,000", "172 cm") to a Number.
  // Non-numeric / unknown values sort last, so they map to -Infinity.
  function num(v) {
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? -Infinity : n;
  }

  // Compact large numbers: 1500 → "1.5K", 2_000_000 → "2M".
  // Non-numeric input is returned unchanged.
  function shortNum(v) {
    const n = num(v);
    if (n === -Infinity) return v;
    if (n >= 1e12) return (n / 1e12) + 'T';
    if (n >= 1e9) return (n / 1e9) + 'B';
    if (n >= 1e6) return (n / 1e6) + 'M';
    if (n >= 1e3) return (n / 1e3) + 'K';
    return String(n);
  }

  // Stable identity key for a favorited item ("people:1").
  function favKey(cat, id) {
    return cat + ':' + id;
  }

  // Feature: "Show favorites only" filter.
  // When enabled, keep only items in the current category that appear in
  // the favorites list; when disabled, pass the list through untouched.
  function filterFavoritesOnly(items, favs, category, enabled) {
    if (!enabled) return items;
    const favSet = new Set((favs || []).map((f) => favKey(f.category, f.id)));
    return (items || []).filter((it) => favSet.has(favKey(category, it.id)));
  }

  return { num, shortNum, favKey, filterFavoritesOnly };
});
