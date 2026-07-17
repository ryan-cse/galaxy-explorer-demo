/* Unit tests for Galaxy Explorer pure logic (lib.js).
   Run with: npm test   (Vitest, globals enabled — no imports needed). */
const { num, shortNum, favKey, filterFavoritesOnly } = require('../lib.js');

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
