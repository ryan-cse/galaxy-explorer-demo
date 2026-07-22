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

  // Maximum number of items that can be compared side by side at once.
  const COMPARE_MAX = 3;

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

  // Feature: "Compare starships" — selection state.
  // Toggle an id in the compare selection, preserving selection order and
  // enforcing a hard cap. Pure: returns a NEW array, never mutates input.
  //   • already selected      → removed
  //   • not selected, < cap    → appended
  //   • not selected, at cap   → returned unchanged (4th selection prevented)
  function toggleCompare(selected, id, max) {
    const cap = max == null ? COMPARE_MAX : max;
    const key = String(id);
    const list = (selected || []).map(String);
    const i = list.indexOf(key);
    if (i >= 0) { list.splice(i, 1); return list; }
    if (list.length >= cap) return list; // cap reached — ignore the new selection
    list.push(key);
    return list;
  }

  // Feature: "Compare starships" — table model.
  // Build a side-by-side comparison from the item list + selected ids.
  // Returns { columns, rows }:
  //   columns = [{ id, name }]                 one per selected ship, in selection order
  //   rows    = [{ key, label, unit, values }] values aligned to columns; missing → null
  // Selected ids not present in `items` are skipped. `fields` is [[key, label, unit?]].
  function buildComparison(items, selectedIds, fields) {
    const byId = {};
    (items || []).forEach((it) => { byId[String(it.id)] = it; });
    const columns = (selectedIds || [])
      .map((id) => byId[String(id)])
      .filter(Boolean)
      .map((it) => ({ id: String(it.id), name: it.name }));
    const rows = (fields || []).map((f) => {
      const key = f[0], label = f[1], unit = f[2] || '';
      return {
        key: key,
        label: label,
        unit: unit,
        values: columns.map((col) => {
          const v = byId[col.id][key];
          return (v == null || v === '') ? null : v;
        }),
      };
    });
    return { columns: columns, rows: rows };
  }

  return { num, shortNum, favKey, filterFavoritesOnly, toggleCompare, buildComparison, COMPARE_MAX };
});
