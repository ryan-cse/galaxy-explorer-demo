/* Unit tests for Galaxy Explorer pure logic (lib.js).
   Run with: npm test   (Vitest, globals enabled — no imports needed). */
const { num, shortNum, favKey, filterFavoritesOnly, toggleCompare, buildComparison, parseHashRoute, COMPARE_MAX } = require('../lib.js');

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
