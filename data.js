/* ───────────────────────────────────────────────────────────────
   Galaxy Explorer — data layer
   Live source: SWAPI (https://swapi.info/api) — returns full arrays,
   CORS-enabled. If the network call fails (offline / blocked / down),
   we fall back to the bundled snapshot below so the demo never breaks.

   ?demo=true  URL parameter forces the bundled seed data — used by
   CI/mabl tests so results are deterministic regardless of SWAPI state.
   ─────────────────────────────────────────────────────────────── */
(function () {
  const API = 'https://swapi.info/api';

  // ── Bundled fallback / seed snapshot ──────────────────────────────
  const FALLBACK = {
    people: [
      { id: '1', name: 'Luke Skywalker', height: '172', mass: '77', hair_color: 'blond', eye_color: 'blue', birth_year: '19BBY', gender: 'male', homeworld: 'Tatooine' },
      { id: '2', name: 'C-3PO', height: '167', mass: '75', hair_color: 'n/a', eye_color: 'yellow', birth_year: '112BBY', gender: 'n/a', homeworld: 'Tatooine' },
      { id: '3', name: 'R2-D2', height: '96', mass: '32', hair_color: 'n/a', eye_color: 'red', birth_year: '33BBY', gender: 'n/a', homeworld: 'Naboo' },
      { id: '4', name: 'Darth Vader', height: '202', mass: '136', hair_color: 'none', eye_color: 'yellow', birth_year: '41.9BBY', gender: 'male', homeworld: 'Tatooine' },
      { id: '5', name: 'Leia Organa', height: '150', mass: '49', hair_color: 'brown', eye_color: 'brown', birth_year: '19BBY', gender: 'female', homeworld: 'Alderaan' },
      { id: '10', name: 'Obi-Wan Kenobi', height: '182', mass: '77', hair_color: 'auburn, white', eye_color: 'blue-gray', birth_year: '57BBY', gender: 'male', homeworld: 'Stewjon' },
      { id: '13', name: 'Chewbacca', height: '228', mass: '112', hair_color: 'brown', eye_color: 'blue', birth_year: '200BBY', gender: 'male', homeworld: 'Kashyyyk' },
      { id: '14', name: 'Han Solo', height: '180', mass: '80', hair_color: 'brown', eye_color: 'brown', birth_year: '29BBY', gender: 'male', homeworld: 'Corellia' },
      { id: '20', name: 'Yoda', height: '66', mass: '17', hair_color: 'white', eye_color: 'brown', birth_year: '896BBY', gender: 'male', homeworld: 'unknown' },
      { id: '11', name: 'Anakin Skywalker', height: '188', mass: '84', hair_color: 'blond', eye_color: 'blue', birth_year: '41.9BBY', gender: 'male', homeworld: 'Tatooine' },
      { id: '22', name: 'Boba Fett', height: '183', mass: '78.2', hair_color: 'black', eye_color: 'brown', birth_year: '31.5BBY', gender: 'male', homeworld: 'Kamino' },
      { id: '21', name: 'Palpatine', height: '170', mass: '75', hair_color: 'grey', eye_color: 'yellow', birth_year: '82BBY', gender: 'male', homeworld: 'Naboo' },
      { id: '35', name: 'Padmé Amidala', height: '165', mass: '45', hair_color: 'brown', eye_color: 'brown', birth_year: '46BBY', gender: 'female', homeworld: 'Naboo' },
      { id: '44', name: 'Mace Windu', height: '188', mass: '84', hair_color: 'none', eye_color: 'brown', birth_year: '72BBY', gender: 'male', homeworld: 'Haruun Kal' },
    ],
    planets: [
      { id: '1', name: 'Tatooine', climate: 'arid', terrain: 'desert', population: '200000', diameter: '10465', gravity: '1 standard', rotation_period: '23', orbital_period: '304' },
      { id: '2', name: 'Alderaan', climate: 'temperate', terrain: 'grasslands, mountains', population: '2000000000', diameter: '12500', gravity: '1 standard', rotation_period: '24', orbital_period: '364' },
      { id: '3', name: 'Yavin IV', climate: 'temperate, tropical', terrain: 'jungle, rainforests', population: '1000', diameter: '10200', gravity: '1 standard', rotation_period: '24', orbital_period: '4818' },
      { id: '4', name: 'Hoth', climate: 'frozen', terrain: 'tundra, ice caves', population: 'unknown', diameter: '7200', gravity: '1.1 standard', rotation_period: '23', orbital_period: '549' },
      { id: '5', name: 'Dagobah', climate: 'murky', terrain: 'swamp, jungles', population: 'unknown', diameter: '8900', gravity: 'N/A', rotation_period: '23', orbital_period: '341' },
      { id: '8', name: 'Naboo', climate: 'temperate', terrain: 'grassy hills, swamps, forests', population: '4500000000', diameter: '12120', gravity: '1 standard', rotation_period: '26', orbital_period: '312' },
      { id: '9', name: 'Coruscant', climate: 'temperate', terrain: 'cityscape, mountains', population: '1000000000000', diameter: '12240', gravity: '1 standard', rotation_period: '24', orbital_period: '368' },
      { id: '10', name: 'Kamino', climate: 'temperate', terrain: 'ocean', population: '1000000000', diameter: '19720', gravity: '1 standard', rotation_period: '27', orbital_period: '463' },
    ],
    starships: [
      { id: '2', name: 'CR90 corvette', model: 'CR90 corvette', manufacturer: 'Corellian Engineering Corporation', crew: '30-165', passengers: '600', cost_in_credits: '3500000', starship_class: 'corvette', hyperdrive_rating: '2.0', max_atmosphering_speed: '950' },
      { id: '3', name: 'Star Destroyer', model: 'Imperial I-class Star Destroyer', manufacturer: 'Kuat Drive Yards', crew: '47060', passengers: 'n/a', cost_in_credits: '150000000', starship_class: 'Star Destroyer', hyperdrive_rating: '2.0', max_atmosphering_speed: '975' },
      { id: '10', name: 'Millennium Falcon', model: 'YT-1300 light freighter', manufacturer: 'Corellian Engineering Corporation', crew: '4', passengers: '6', cost_in_credits: '100000', starship_class: 'Light freighter', hyperdrive_rating: '0.5', max_atmosphering_speed: '1050' },
      { id: '11', name: 'Y-wing', model: 'BTL Y-wing', manufacturer: 'Koensayr Manufacturing', crew: '2', passengers: '0', cost_in_credits: '134999', starship_class: 'assault starfighter', hyperdrive_rating: '1.0', max_atmosphering_speed: '1000km' },
      { id: '12', name: 'X-wing', model: 'T-65 X-wing', manufacturer: 'Incom Corporation', crew: '1', passengers: '0', cost_in_credits: '149999', starship_class: 'Starfighter', hyperdrive_rating: '1.0', max_atmosphering_speed: '1050' },
      { id: '13', name: 'TIE Advanced x1', model: 'Twin Ion Engine Advanced x1', manufacturer: 'Sienar Fleet Systems', crew: '1', passengers: '0', cost_in_credits: 'unknown', starship_class: 'Starfighter', hyperdrive_rating: '1.0', max_atmosphering_speed: '1200' },
      { id: '15', name: 'Executor', model: 'Executor-class star dreadnought', manufacturer: 'Kuat Drive Yards', crew: '279144', passengers: '38000', cost_in_credits: '1143350000', starship_class: 'Star dreadnought', hyperdrive_rating: '2.0', max_atmosphering_speed: 'n/a' },
      { id: '17', name: 'Slave 1', model: 'Firespray-31-class patrol and attack', manufacturer: 'Kuat Systems Engineering', crew: '1', passengers: '6', cost_in_credits: 'unknown', starship_class: 'Patrol craft', hyperdrive_rating: '3.0', max_atmosphering_speed: '1000' },
    ],
  };

  const SCHEMA = {
    people: {
      label: 'Characters', singular: 'Character', icon: 'person',
      subtitle: (d) => `${d.gender !== 'n/a' && d.gender !== 'unknown' ? cap(d.gender) : 'Droid / unknown'} · ${d.homeworld}`,
      fields: [
        ['birth_year', 'Birth year'], ['height', 'Height', 'cm'], ['mass', 'Mass', 'kg'],
        ['gender', 'Gender'], ['eye_color', 'Eye color'], ['hair_color', 'Hair color'],
        ['skin_color', 'Skin color'], ['homeworld', 'Homeworld'],
      ],
    },
    planets: {
      label: 'Planets', singular: 'Planet', icon: 'public',
      subtitle: (d) => `${cap(d.climate)} · ${cap(d.terrain)}`,
      fields: [
        ['climate', 'Climate'], ['terrain', 'Terrain'], ['population', 'Population'],
        ['diameter', 'Diameter', 'km'], ['gravity', 'Gravity'],
        ['rotation_period', 'Rotation period', 'h'], ['orbital_period', 'Orbital period', 'days'],
      ],
    },
    starships: {
      label: 'Starships', singular: 'Starship', icon: 'rocket_launch',
      subtitle: (d) => `${d.starship_class ? cap(d.starship_class) : 'Starship'} · ${d.manufacturer}`,
      fields: [
        ['model', 'Model'], ['manufacturer', 'Manufacturer'], ['starship_class', 'Class'],
        ['crew', 'Crew'], ['passengers', 'Passengers'], ['cost_in_credits', 'Cost', 'credits'],
        ['hyperdrive_rating', 'Hyperdrive rating'], ['max_atmosphering_speed', 'Max speed'],
      ],
    },
  };

  function cap(s) {
    if (!s) return '—';
    return String(s).charAt(0).toUpperCase() + String(s).slice(1);
  }

  function idFromUrl(url) {
    const m = String(url || '').match(/\/(\d+)\/?$/);
    return m ? m[1] : url;
  }

  function normalise(rec) {
    const out = Object.assign({}, rec);
    out.id = idFromUrl(rec.url || rec.id);
    return out;
  }

  async function fetchCategory(category) {
    const res = await fetch(`${API}/${category}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (data.results || []);
    if (!arr.length) throw new Error('Empty response');
    return arr.map(normalise);
  }

  // Public API: returns { items, source: 'live' | 'seed' | 'fallback' }
  async function load(category) {
    // ?demo=true forces seed data — deterministic for CI/mabl testing
    if (new URLSearchParams(window.location.search).get('demo') === 'true') {
      return { items: FALLBACK[category].slice(), source: 'seed' };
    }
    try {
      const items = await fetchCategory(category);
      return { items, source: 'live' };
    } catch (err) {
      console.warn(`[Galaxy Explorer] Live SWAPI unavailable for "${category}" (${err.message}); using bundled data.`);
      return { items: FALLBACK[category].slice(), source: 'fallback' };
    }
  }

  window.GalaxyData = { load, SCHEMA, cap, categories: ['people', 'planets', 'starships'] };
})();
