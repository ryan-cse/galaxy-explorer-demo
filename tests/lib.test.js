/* Unit tests for Galaxy Explorer pure logic (lib.js).
   Run with: npm test   (Vitest, globals enabled — no imports needed). */
const { num, shortNum, favKey, filterFavoritesOnly, toggleCompare, buildComparison, parseHashRoute, COMPARE_MAX,
        CLOCK_ZONES, CLOCK_DEFAULTS, isKnownZone, normalizeClockPrefs, formatClockTime, clockZoneLabel } = require('../lib.js');

describe('num', () => {
  it('parses plain integers', () => {
    expect(num('172')).toBe(172);
  });
  it('strips units and separators', () => {
    expect(num('1,000,000')).toBe(1000000);
    expect(num('172 cm')).toBe(172);
  });
  it('maps unknown / non-numeric to -Infinity so it sorts last', () => {
    expect(num('unknown')).toBe(-Infinity);
    expect(num('n/a')).toBe(-Infinity);
    expect(num('')).toBe(-Infinity);
  });
});

describe('shortNum', () => {
  it('compacts thousands / millions / billions / trillions', () => {
    expect(shortNum('1500')).toBe('1.5K');
    expect(shortNum('2000000')).toBe('2M');
    expect(shortNum('4500000000')).toBe('4.5B');
    expect(shortNum('1000000000000')).toBe('1T');
  });
  it('leaves small numbers as plain strings', () => {
    expect(shortNum('200')).toBe('200');
  });
  it('returns non-numeric input unchanged', () => {
    expect(shortNum('unknown')).toBe('unknown');
  });
});

describe('favKey', () => {
  it('builds a stable category:id key', () => {
    expect(favKey('people', '1')).toBe('people:1');
    expect(favKey('starships', '9')).toBe('starships:9');
  });
});

describe('filterFavoritesOnly', () => {
  const people = [
    { id: '1', name: 'Luke Skywalker' },
    { id: '4', name: 'Darth Vader' },
    { id: '5', name: 'Leia Organa' },
  ];
  const favs = [
    { category: 'people', id: '1' },
    { category: 'people', id: '5' },
    { category: 'starships', id: '9' }, // different category — must be ignored
  ];

  it('returns the full list unchanged when the filter is off', () => {
    expect(filterFavoritesOnly(people, favs, 'people', false)).toBe(people);
  });

  it('keeps only favorited items of the current category when on', () => {
    const out = filterFavoritesOnly(people, favs, 'people', true);
    expect(out.map((p) => p.id)).toEqual(['1', '5']);
  });

  it('does not match favorites from other categories', () => {
    const starships = [{ id: '9', name: 'Death Star' }, { id: '10', name: 'Millennium Falcon' }];
    const out = filterFavoritesOnly(starships, favs, 'starships', true);
    expect(out.map((s) => s.id)).toEqual(['9']);
  });

  it('returns an empty array when nothing in the category is favorited', () => {
    expect(filterFavoritesOnly(people, [], 'people', true)).toEqual([]);
  });

  it('is safe when items or favs are missing', () => {
    expect(filterFavoritesOnly(undefined, favs, 'people', true)).toEqual([]);
    expect(filterFavoritesOnly(people, undefined, 'people', true)).toEqual([]);
  });
});

describe('toggleCompare', () => {
  it('adds an id to an empty selection', () => {
    expect(toggleCompare([], '10', 3)).toEqual(['10']);
  });

  it('removes an id that is already selected', () => {
    expect(toggleCompare(['10'], '10', 3)).toEqual([]);
  });

  it('appends new ids preserving selection order', () => {
    expect(toggleCompare(['2', '3'], '10', 3)).toEqual(['2', '3', '10']);
  });

  it('enforces the cap — a 4th selection is ignored', () => {
    expect(toggleCompare(['2', '3', '10'], '12', 3)).toEqual(['2', '3', '10']);
  });

  it('still allows removing an item when at the cap', () => {
    expect(toggleCompare(['2', '3', '10'], '3', 3)).toEqual(['2', '10']);
  });

  it('defaults the cap to COMPARE_MAX when none is passed', () => {
    expect(COMPARE_MAX).toBe(3);
    const four = toggleCompare(['1', '2', '3'], '4');
    expect(four).toEqual(['1', '2', '3']);
  });

  it('does not mutate the input array', () => {
    const orig = ['2', '3'];
    toggleCompare(orig, '10', 3);
    expect(orig).toEqual(['2', '3']);
  });

  it('coerces ids to strings so numeric ids match', () => {
    expect(toggleCompare([], 10, 3)).toEqual(['10']);
    expect(toggleCompare(['10'], 10, 3)).toEqual([]);
  });
});

describe('buildComparison', () => {
  const ships = [
    { id: '10', name: 'Millennium Falcon', starship_class: 'Light freighter', crew: '4', cost_in_credits: '100000' },
    { id: '12', name: 'X-wing', starship_class: 'Starfighter', crew: '1', cost_in_credits: '149999' },
    { id: '13', name: 'TIE Advanced x1', starship_class: 'Starfighter', crew: '1', cost_in_credits: 'unknown' },
  ];
  const fields = [['starship_class', 'Class'], ['crew', 'Crew'], ['cost_in_credits', 'Cost', 'credits']];

  it('builds one column per selected id, in selection order', () => {
    const m = buildComparison(ships, ['12', '10'], fields);
    expect(m.columns).toEqual([
      { id: '12', name: 'X-wing' },
      { id: '10', name: 'Millennium Falcon' },
    ]);
  });

  it('builds one row per field with values aligned to the columns', () => {
    const m = buildComparison(ships, ['12', '10'], fields);
    expect(m.rows[0]).toEqual({ key: 'starship_class', label: 'Class', unit: '', values: ['Starfighter', 'Light freighter'] });
    expect(m.rows[2]).toEqual({ key: 'cost_in_credits', label: 'Cost', unit: 'credits', values: ['149999', '100000'] });
  });

  it('passes through non-empty values (e.g. "unknown") as raw — the UI formats them', () => {
    const m = buildComparison(ships, ['13'], [['cost_in_credits', 'Cost', 'credits']]);
    expect(m.rows[0].values).toEqual(['unknown']);
  });

  it('maps missing / empty fields to null', () => {
    const m = buildComparison(ships, ['12'], [['passengers', 'Passengers']]);
    expect(m.rows[0].values).toEqual([null]);
  });

  it('skips selected ids that are not present in the item list', () => {
    const m = buildComparison(ships, ['999', '10'], fields);
    expect(m.columns).toEqual([{ id: '10', name: 'Millennium Falcon' }]);
  });

  it('is safe with empty / missing inputs', () => {
    expect(buildComparison([], [], [])).toEqual({ columns: [], rows: [] });
    expect(buildComparison(undefined, undefined, undefined)).toEqual({ columns: [], rows: [] });
  });
});

describe('parseHashRoute', () => {
  it('routes the base URL (empty / missing hash) to Home, not a category', () => {
    expect(parseHashRoute('')).toEqual({ name: 'home' });
    expect(parseHashRoute(null)).toEqual({ name: 'home' });
    expect(parseHashRoute(undefined)).toEqual({ name: 'home' });
    expect(parseHashRoute('#')).toEqual({ name: 'home' });
    expect(parseHashRoute('#/')).toEqual({ name: 'home' });
  });

  it('routes #/home to Home', () => {
    expect(parseHashRoute('#/home')).toEqual({ name: 'home' });
  });

  it('routes #/browse/:category to browse with that category', () => {
    expect(parseHashRoute('#/browse/people')).toEqual({ name: 'browse', category: 'people' });
    expect(parseHashRoute('#/browse/planets')).toEqual({ name: 'browse', category: 'planets' });
    expect(parseHashRoute('#/browse/starships')).toEqual({ name: 'browse', category: 'starships' });
  });

  it('defaults a bare #/browse to people', () => {
    expect(parseHashRoute('#/browse')).toEqual({ name: 'browse', category: 'people' });
  });

  it('routes #/item/:category/:id to a detail view', () => {
    expect(parseHashRoute('#/item/people/1')).toEqual({ name: 'item', category: 'people', id: '1' });
    expect(parseHashRoute('#/item/starships/10')).toEqual({ name: 'item', category: 'starships', id: '10' });
  });

  it('routes #/favorites and #/signin unchanged', () => {
    expect(parseHashRoute('#/favorites')).toEqual({ name: 'favorites' });
    expect(parseHashRoute('#/signin')).toEqual({ name: 'signin' });
  });

  it('falls back to Home for unrecognised routes', () => {
    expect(parseHashRoute('#/nope')).toEqual({ name: 'home' });
    expect(parseHashRoute('#/garbage/path')).toEqual({ name: 'home' });
  });
});

/* ── SUP-19: clock timezone + display format ─────────────────── */

// Fixed instants, so none of these assertions depend on the wall clock.
const SUMMER = new Date(Date.UTC(2026, 8, 2, 18, 23, 7));   // 2026-09-02 18:23:07Z — US DST in effect
const WINTER = new Date(Date.UTC(2026, 0, 15, 18, 23, 7));  // 2026-01-15 18:23:07Z — US standard time
const ET_MIDNIGHT = new Date(Date.UTC(2026, 8, 2, 4, 14, 0));  // 00:14 in New York
const ET_NOON = new Date(Date.UTC(2026, 8, 2, 16, 14, 0));     // 12:14 in New York

describe('CLOCK_ZONES / isKnownZone', () => {
  it('offers UTC plus the four US zones, UTC first', () => {
    expect(CLOCK_ZONES.map((z) => z.id)).toEqual([
      'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    ]);
  });
  it('defaults to UTC in 24-hour', () => {
    expect(CLOCK_DEFAULTS).toEqual({ zone: 'UTC', hour12: false });
  });
  it('recognises listed zones and rejects everything else', () => {
    expect(isKnownZone('America/New_York')).toBe(true);
    expect(isKnownZone('Europe/Paris')).toBe(false);
    expect(isKnownZone(undefined)).toBe(false);
  });
});

describe('formatClockTime', () => {
  it('renders 24-hour time zero-padded with no meridiem', () => {
    expect(formatClockTime(SUMMER, 'UTC', false)).toBe('18:23:07');
    expect(formatClockTime(SUMMER, 'America/New_York', false)).toBe('14:23:07');
  });
  it('applies the zone offset, not a fixed one, across DST', () => {
    expect(formatClockTime(SUMMER, 'America/New_York', false)).toBe('14:23:07'); // UTC-4
    expect(formatClockTime(WINTER, 'America/New_York', false)).toBe('13:23:07'); // UTC-5
  });
  it('renders 12-hour time with a plain-space meridiem', () => {
    expect(formatClockTime(SUMMER, 'America/New_York', true)).toBe('2:23:07 PM');
    expect(formatClockTime(SUMMER, 'America/Los_Angeles', true)).toBe('11:23:07 AM');
  });
  it('uses 12, not 0, at both midnight and noon', () => {
    expect(formatClockTime(ET_MIDNIGHT, 'America/New_York', true)).toBe('12:14:00 AM');
    expect(formatClockTime(ET_NOON, 'America/New_York', true)).toBe('12:14:00 PM');
  });
  it('zero-pads the midnight hour in 24-hour mode', () => {
    expect(formatClockTime(ET_MIDNIGHT, 'America/New_York', false)).toBe('00:14:00');
  });
  it('falls back to UTC for an unknown zone instead of throwing', () => {
    expect(formatClockTime(SUMMER, 'Europe/Paris', false)).toBe('18:23:07');
    expect(formatClockTime(SUMMER, undefined, false)).toBe('18:23:07');
  });
});

describe('clockZoneLabel', () => {
  it('labels UTC as UTC', () => {
    expect(clockZoneLabel(SUMMER, 'UTC')).toBe('UTC');
  });
  it('tracks daylight vs standard time in the abbreviation', () => {
    expect(clockZoneLabel(SUMMER, 'America/New_York')).toBe('EDT');
    expect(clockZoneLabel(WINTER, 'America/New_York')).toBe('EST');
  });
  it('falls back to UTC for an unknown zone', () => {
    expect(clockZoneLabel(SUMMER, 'Europe/Paris')).toBe('UTC');
  });
});

describe('normalizeClockPrefs', () => {
  it('passes a valid object through', () => {
    expect(normalizeClockPrefs({ zone: 'America/Denver', hour12: true }))
      .toEqual({ zone: 'America/Denver', hour12: true });
  });
  it('parses a stored JSON string', () => {
    expect(normalizeClockPrefs('{"zone":"America/Chicago","hour12":true}'))
      .toEqual({ zone: 'America/Chicago', hour12: true });
  });
  it('falls back to defaults on corrupt or missing storage', () => {
    expect(normalizeClockPrefs('not json at all')).toEqual({ zone: 'UTC', hour12: false });
    expect(normalizeClockPrefs(null)).toEqual({ zone: 'UTC', hour12: false });
    expect(normalizeClockPrefs(undefined)).toEqual({ zone: 'UTC', hour12: false });
    expect(normalizeClockPrefs(42)).toEqual({ zone: 'UTC', hour12: false });
  });
  it('rejects an unknown zone but keeps the valid half of the object', () => {
    expect(normalizeClockPrefs({ zone: 'Europe/Paris', hour12: true }))
      .toEqual({ zone: 'UTC', hour12: true });
  });
  it('treats any non-true hour12 as 24-hour', () => {
    expect(normalizeClockPrefs({ zone: 'UTC', hour12: 'yes' }).hour12).toBe(false);
    expect(normalizeClockPrefs({ zone: 'UTC' }).hour12).toBe(false);
  });
});
