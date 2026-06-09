/* ───────────────────────────────────────────────────────────────
   Galaxy Explorer — app logic (vanilla JS, hash-routed)
   Routes:
     #/browse/:category        catalog grid (search · sort · paginate)
     #/item/:category/:id      detail view
     #/favorites               saved items
     #/signin                  sign-in form (validation + states)
   ─────────────────────────────────────────────────────────────── */
(function () {
  const { load, SCHEMA, cap, categories } = window.GalaxyData;
  const PAGE_SIZE = 6;
  const FAV_KEY = 'galaxy.favorites';

  // Per-category UI state (search / sort / page) persists during the session.
  const ui = {};
  categories.forEach((c) => { ui[c] = { q: '', sort: 'name-asc', page: 1 }; });

  const cache = {};
  const planetNames = {};
  let planetMapReady = false;
  const view = document.getElementById('view');

  async function getCategory(category) {
    if (cache[category]) return cache[category];
    const res = await load(category);
    cache[category] = res;
    if (category === 'people') await resolveHomeworlds(res.items);
    return res;
  }
  async function resolveHomeworlds(items) {
    if (!planetMapReady) {
      try {
        const p = await getCategory('planets');
        p.items.forEach((pl) => { planetNames[pl.id] = pl.name; });
      } catch (e) { /* leave map empty */ }
      planetMapReady = true;
    }
    items.forEach((it) => {
      const m = String(it.homeworld || '').match(/\/(\d+)\/?$/);
      if (m) it.homeworld = planetNames[m[1]] || 'Unknown';
    });
  }

  const SORTS = {
    people: [
      ['name-asc', 'Name (A–Z)'], ['name-desc', 'Name (Z–A)'],
      ['height-desc', 'Tallest'], ['mass-desc', 'Heaviest'],
    ],
    planets: [
      ['name-asc', 'Name (A–Z)'], ['name-desc', 'Name (Z–A)'],
      ['population-desc', 'Most populated'], ['diameter-desc', 'Largest'],
    ],
    starships: [
      ['name-asc', 'Name (A–Z)'], ['name-desc', 'Name (Z–A)'],
      ['cost_in_credits-desc', 'Most expensive'], ['crew-desc', 'Largest crew'],
    ],
  };

  // ── Favorites (localStorage) ───────────────────────────────────
  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; }
    catch (e) { return []; }
  }
  function setFavs(arr) { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); updateFavCount(); }
  function favKey(cat, id) { return cat + ':' + id; }
  function isFav(cat, id) { return getFavs().some((f) => favKey(f.category, f.id) === favKey(cat, id)); }
  function toggleFav(cat, id, name, sub) {
    const favs = getFavs();
    const k = favKey(cat, id);
    const i = favs.findIndex((f) => favKey(f.category, f.id) === k);
    if (i >= 0) favs.splice(i, 1);
    else favs.push({ category: cat, id, name, sub });
    setFavs(favs);
    return i < 0;
  }
  function updateFavCount() {
    const el = document.querySelector('[data-testid="fav-count"]');
    const n = getFavs().length;
    el.textContent = n;
    el.hidden = n === 0;
  }

  // ── Helpers ────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function num(v) {
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? -Infinity : n;
  }
  function fmt(v) {
    if (v == null || v === '' || /^(unknown|n\/a|none|na)$/i.test(v)) return '—';
    return cap(String(v).replace(/,/g, ', ').replace(/\s+/g, ' ').trim());
  }
  function setActiveNav(category) {
    document.querySelectorAll('[data-nav]').forEach((b) => {
      b.classList.toggle('active', b.dataset.nav === category);
    });
  }

  function sourcePill(data) {
    const titles = {
      live: 'Loaded live from SWAPI',
      seed: 'Using seeded demo data — deterministic for CI testing',
      fallback: 'Live API unavailable — showing bundled data',
    };
    const icons = { live: 'cloud_done', seed: 'dataset', fallback: 'cloud_off' };
    return `<span class="source-pill ${data.source}" data-testid="data-source" title="${titles[data.source] || ''}">
      <span class="material-symbols-rounded">${icons[data.source] || 'cloud_off'}</span>${data.source}</span>`;
  }

  function applyQuerySort(items, category) {
    const s = ui[category];
    let out = items;
    if (s.q.trim()) {
      const q = s.q.trim().toLowerCase();
      out = out.filter((it) => {
        const hay = [it.name, it.model, it.homeworld, it.terrain, it.climate, it.starship_class, it.manufacturer]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    const [field, dir] = s.sort.split(/-(asc|desc)$/);
    out = out.slice().sort((a, b) => {
      let r;
      if (field === 'name') r = String(a.name).localeCompare(String(b.name));
      else r = num(a[field]) - num(b[field]);
      return dir === 'desc' ? -r : r;
    });
    return out;
  }

  // ── Card / attr markup ─────────────────────────────────────────
  function cardHTML(item, category) {
    const sc = SCHEMA[category];
    const sub = sc.subtitle(item);
    const fav = isFav(category, item.id);
    const chips = chipFor(item, category);
    return `
      <article class="card" data-testid="card" data-category="${category}" data-id="${esc(item.id)}"
               role="button" tabindex="0" aria-label="${esc(item.name)}"
               onclick="GalaxyApp.go('#/item/${category}/${esc(item.id)}')"
               onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();GalaxyApp.go('#/item/${category}/${esc(item.id)}')}">
        <button class="fav-btn ${fav ? 'on' : ''}" data-testid="fav-toggle" aria-pressed="${fav}"
                aria-label="${fav ? 'Remove from favorites' : 'Add to favorites'}"
                onclick="event.stopPropagation();GalaxyApp.fav(this,'${category}','${esc(item.id)}')">
          <span class="material-symbols-rounded">favorite</span>
        </button>
        <div class="card-head">
          <div class="card-avatar"><span class="material-symbols-rounded">${sc.icon}</span></div>
          <div>
            <h3 class="card-title">${esc(item.name)}</h3>
            <p class="card-sub">${esc(sub)}</p>
          </div>
        </div>
        <div class="card-meta">${chips}</div>
      </article>`;
  }

  function chipFor(item, category) {
    const map = {
      people: [['Born', item.birth_year], ['Height', item.height && item.height + ' cm']],
      planets: [['Pop.', shortNum(item.population)], ['Climate', item.climate]],
      starships: [['Class', item.starship_class], ['Crew', item.crew]],
    };
    return map[category].filter(([, v]) => v && !/unknown|n\/a/i.test(v)).map(([k, v]) =>
      `<span class="chip">${k} <b>${esc(fmt(v))}</b></span>`).join('');
  }
  function shortNum(v) {
    const n = num(v);
    if (n === -Infinity) return v;
    if (n >= 1e12) return (n / 1e12) + 'T';
    if (n >= 1e9) return (n / 1e9) + 'B';
    if (n >= 1e6) return (n / 1e6) + 'M';
    if (n >= 1e3) return (n / 1e3) + 'K';
    return String(n);
  }

  // ── Renderers ──────────────────────────────────────────────────
  function skeleton() {
    let cards = '';
    for (let i = 0; i < 6; i++) {
      cards += `<div class="skeleton-card">
        <div class="sk sk-row" style="width:60%;height:18px"></div>
        <div class="sk sk-row" style="width:85%"></div>
        <div class="sk sk-row" style="width:40%"></div>
      </div>`;
    }
    return `<div class="grid" data-testid="loading">${cards}</div>`;
  }

  async function renderBrowse(category) {
    if (!categories.includes(category)) category = 'people';
    setActiveNav(category);
    const sc = SCHEMA[category];
    const s = ui[category];

    const toolbar = `
      <div class="hero" data-testid="hero">
        <div class="hero-text">
          <div class="eyebrow">Star Wars catalog</div>
          <h1 data-testid="hero-title">${sc.label}</h1>
          <p>Search, sort, and dive into ${sc.label.toLowerCase()} sourced live from the Star Wars API — a sample app for practising browser-test automation with mabl.</p>
        </div>
        <div class="hero-mark"><span class="material-symbols-rounded">${sc.icon}</span></div>
      </div>
      <div class="tabs" data-testid="tabs" role="tablist">
        ${categories.map((c) => `<button class="tab ${c === category ? 'active' : ''}" role="tab"
          aria-selected="${c === category}" data-testid="tab-${c}"
          onclick="GalaxyApp.go('#/browse/${c}')">
          <span class="material-symbols-rounded">${SCHEMA[c].icon}</span>${SCHEMA[c].label}</button>`).join('')}
      </div>
      <div class="toolbar">
        <div class="search">
          <span class="material-symbols-rounded">search</span>
          <input type="search" data-testid="search-input" placeholder="Search ${sc.label.toLowerCase()}…"
                 value="${esc(s.q)}" aria-label="Search ${sc.label.toLowerCase()}"
                 oninput="GalaxyApp.search(this.value)">
        </div>
        <div class="sort-wrap">
          <label for="sort">Sort</label>
          <select class="select" id="sort" data-testid="sort-select" onchange="GalaxyApp.setSort(this.value)">
            ${SORTS[category].map(([v, l]) => `<option value="${v}" ${v === s.sort ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <span class="result-count" data-testid="result-meta"></span>
      </div>
      <div id="grid-region"></div>`;

    view.innerHTML = toolbar;
    const region = document.getElementById('grid-region');
    region.innerHTML = skeleton();

    let data;
    try {
      data = await getCategory(category);
    } catch (e) {
      region.innerHTML = errorState();
      return;
    }
    if (parseRoute().category !== category || parseRoute().name !== 'browse') return;

    const filtered = applyQuerySort(data.items, category);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (s.page > pages) s.page = pages;
    const start = (s.page - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    const meta = document.querySelector('[data-testid="result-meta"]');
    meta.innerHTML = `${filtered.length} ${filtered.length === 1 ? sc.singular.toLowerCase() : sc.label.toLowerCase()} &nbsp; ${sourcePill(data)}`;

    if (!filtered.length) {
      region.innerHTML = `<div class="state" data-testid="empty">
        <span class="material-symbols-rounded">search_off</span>
        <h3>No ${sc.label.toLowerCase()} match "${esc(s.q)}"</h3>
        <p>Try a different search term, or clear the search to see everything.</p>
        <button class="btn btn-secondary" data-testid="clear-search" onclick="GalaxyApp.search('')">Clear search</button>
      </div>`;
      return;
    }

    region.innerHTML = `<div class="grid" data-testid="results">${pageItems.map((it) => cardHTML(it, category)).join('')}</div>${pagerHTML(s.page, pages)}`;
  }

  function pagerHTML(page, pages) {
    if (pages <= 1) return '';
    let btns = '';
    for (let p = 1; p <= pages; p++) {
      btns += `<button class="page-btn ${p === page ? 'active' : ''}" data-testid="page-${p}"
        aria-label="Page ${p}" aria-current="${p === page}" onclick="GalaxyApp.setPage(${p})">${p}</button>`;
    }
    return `<nav class="pager" data-testid="pager" aria-label="Pagination">
      <button class="page-btn" data-testid="page-prev" ${page === 1 ? 'disabled' : ''} aria-label="Previous page" onclick="GalaxyApp.setPage(${page - 1})"><span class="material-symbols-rounded">chevron_left</span></button>
      <div class="pages">${btns}</div>
      <button class="page-btn" data-testid="page-next" ${page === pages ? 'disabled' : ''} aria-label="Next page" onclick="GalaxyApp.setPage(${page + 1})"><span class="material-symbols-rounded">chevron_right</span></button>
    </nav>`;
  }

  function errorState() {
    return `<div class="state" data-testid="error">
      <span class="material-symbols-rounded">error</span>
      <h3>We couldn't load this catalog</h3>
      <p>Something went wrong reaching the data source. Check your connection and try again.</p>
      <button class="btn btn-primary" data-testid="retry" onclick="GalaxyApp.retry()">Try again</button>
    </div>`;
  }

  async function renderDetail(category, id) {
    if (!categories.includes(category)) return GalaxyApp.go('#/browse/people');
    setActiveNav(category);
    const sc = SCHEMA[category];
    view.innerHTML = `<div class="state" data-testid="loading"><div class="spinner"></div><p>Loading…</p></div>`;

    let data;
    try { data = await getCategory(category); }
    catch (e) { view.innerHTML = errorState(); return; }

    const item = data.items.find((x) => String(x.id) === String(id));
    if (!item) {
      view.innerHTML = `<div class="state" data-testid="not-found">
        <span class="material-symbols-rounded">help</span>
        <h3>${sc.singular} not found</h3>
        <p>We couldn't find that ${sc.singular.toLowerCase()} in the current data source.</p>
        <button class="btn btn-secondary" onclick="GalaxyApp.go('#/browse/${category}')">Back to ${sc.label.toLowerCase()}</button>
      </div>`;
      return;
    }

    const fav = isFav(category, item.id);
    const attrs = sc.fields.map(([key, label, unit]) => {
      const raw = item[key];
      const val = fmt(raw);
      const showUnit = unit && val !== '—';
      return `<div class="attr"><dt>${esc(label)}</dt><dd data-testid="attr-${key}">${esc(val)}${showUnit ? `<span class="unit">${esc(unit)}</span>` : ''}</dd></div>`;
    }).join('');

    view.innerHTML = `
      <div class="breadcrumb" data-testid="breadcrumb">
        <button onclick="GalaxyApp.go('#/browse/${category}')">${sc.label}</button>
        <span class="material-symbols-rounded">chevron_right</span>
        <span class="current">${esc(item.name)}</span>
      </div>
      <div class="detail" data-testid="detail" data-id="${esc(item.id)}">
        <div class="detail-head">
          <div class="detail-avatar"><span class="material-symbols-rounded">${sc.icon}</span></div>
          <div>
            <h1 data-testid="detail-name">${esc(item.name)}</h1>
            <p class="detail-sub">${esc(sc.subtitle(item))}</p>
          </div>
          <span class="spacer"></span>
          <button class="btn ${fav ? 'btn-primary' : 'btn-secondary'}" data-testid="detail-fav"
                  style="${fav ? '' : 'background:#fff'}" aria-pressed="${fav}"
                  onclick="GalaxyApp.favDetail(this,'${category}','${esc(item.id)}')">
            <span class="material-symbols-rounded">favorite</span>
            <span data-testid="detail-fav-label">${fav ? 'Saved' : 'Add to favorites'}</span>
          </button>
        </div>
        <dl class="attr-grid">${attrs}</dl>
      </div>`;
  }

  function renderFavorites() {
    setActiveNav(null);
    const favs = getFavs();
    if (!favs.length) {
      view.innerHTML = `<div class="state" data-testid="favorites-empty">
        <span class="material-symbols-rounded">favorite_border</span>
        <h3>No favorites yet</h3>
        <p>Tap the heart on any character, planet, or starship to pin it here for later.</p>
        <button class="btn btn-primary" onclick="GalaxyApp.go('#/browse/people')">Browse characters</button>
      </div>`;
      return;
    }
    const cards = favs.map((f) => {
      const sc = SCHEMA[f.category];
      return `<article class="card" data-testid="card" data-category="${f.category}" data-id="${esc(f.id)}"
                role="button" tabindex="0"
                onclick="GalaxyApp.go('#/item/${f.category}/${esc(f.id)}')"
                onkeydown="if(event.key==='Enter'){GalaxyApp.go('#/item/${f.category}/${esc(f.id)}')}">
        <button class="fav-btn on" data-testid="fav-toggle" aria-pressed="true" aria-label="Remove from favorites"
                onclick="event.stopPropagation();GalaxyApp.favFromList(this,'${f.category}','${esc(f.id)}')">
          <span class="material-symbols-rounded">favorite</span>
        </button>
        <div class="card-head">
          <div class="card-avatar"><span class="material-symbols-rounded">${sc.icon}</span></div>
          <div>
            <h3 class="card-title">${esc(f.name)}</h3>
            <p class="card-sub">${esc(sc.singular)}${f.sub ? ' · ' + esc(f.sub) : ''}</p>
          </div>
        </div>
      </article>`;
    }).join('');
    view.innerHTML = `
      <div class="breadcrumb"><span class="current" style="font-weight:700;color:var(--fg-primary)">Favorites</span></div>
      <h1 style="margin:0 0 var(--spacing-xs)">Your favorites</h1>
      <p style="color:var(--fg-secondary);margin:0 0 var(--spacing-lg)" data-testid="fav-summary">${favs.length} saved ${favs.length === 1 ? 'item' : 'items'}.</p>
      <div class="grid" data-testid="results">${cards}</div>`;
  }

  function renderSignin() {
    setActiveNav(null);
    view.innerHTML = `
      <div class="form-wrap">
        <div class="form-card">
          <h1>Sign in</h1>
          <p class="lede">Access your saved catalogs and crew manifests.</p>
          <div class="form-alert" data-testid="form-alert" role="alert"><span class="material-symbols-rounded"></span><span data-testid="form-alert-text"></span></div>
          <form id="signin-form" data-testid="signin-form" novalidate>
            <div class="field" data-field="email">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" data-testid="email" placeholder="you@rebellion.org" autocomplete="username">
              <div class="err-msg" data-testid="email-error">Enter a valid email address.</div>
            </div>
            <div class="field" data-field="password">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" data-testid="password" placeholder="••••••••" autocomplete="current-password">
              <div class="err-msg" data-testid="password-error">Password must be at least 6 characters.</div>
            </div>
            <button type="submit" class="btn btn-primary btn-block" data-testid="signin-submit">Sign in</button>
          </form>
          <p class="hint-row">Demo login: <code>rebel@hoth.io</code> / <code>echobase</code></p>
        </div>
      </div>`;
    document.getElementById('signin-form').addEventListener('submit', handleSignin);
  }

  function handleSignin(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value.trim();
    const pw = form.password.value;
    const alert = document.querySelector('[data-testid="form-alert"]');
    alert.className = 'form-alert';

    let ok = true;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setFieldError('email', !emailOk); if (!emailOk) ok = false;
    const pwOk = pw.length >= 6;
    setFieldError('password', !pwOk); if (!pwOk) ok = false;
    if (!ok) return;

    if (email === 'rebel@hoth.io' && pw === 'echobase') {
      showAlert('success', 'check_circle', 'Signed in. Welcome back, Commander.');
      form.querySelector('[data-testid="signin-submit"]').disabled = true;
    } else {
      showAlert('error', 'error', 'That email and password don’t match. Try the demo credentials below.');
    }
  }
  function setFieldError(name, on) {
    document.querySelector(`[data-field="${name}"]`).classList.toggle('error', on);
  }
  function showAlert(kind, icon, msg) {
    const a = document.querySelector('[data-testid="form-alert"]');
    a.className = 'form-alert show ' + kind;
    a.querySelector('.material-symbols-rounded').textContent = icon;
    a.querySelector('[data-testid="form-alert-text"]').textContent = msg;
  }

  // ── Router ─────────────────────────────────────────────────────
  function parseRoute() {
    const h = (location.hash || '#/browse/people').replace(/^#\/?/, '');
    const parts = h.split('/').filter(Boolean);
    if (parts[0] === 'item') return { name: 'item', category: parts[1], id: parts[2] };
    if (parts[0] === 'favorites') return { name: 'favorites' };
    if (parts[0] === 'signin') return { name: 'signin' };
    return { name: 'browse', category: parts[1] || 'people' };
  }
  function route() {
    const r = parseRoute();
    window.scrollTo(0, 0);
    if (r.name === 'item') return renderDetail(r.category, r.id);
    if (r.name === 'favorites') return renderFavorites();
    if (r.name === 'signin') return renderSignin();
    return renderBrowse(r.category);
  }

  // ── Public API ─────────────────────────────────────────────────
  window.GalaxyApp = {
    go(hash) { if (location.hash === hash) route(); else location.hash = hash; },
    retry() { const c = parseRoute().category; delete cache[c]; route(); },
    search(v) {
      const c = parseRoute().category; ui[c].q = v; ui[c].page = 1;
      const input = document.querySelector('[data-testid="search-input"]');
      const focused = document.activeElement === input;
      rerenderGrid(c);
      if (focused) { const ni = document.querySelector('[data-testid="search-input"]'); ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
    },
    setSort(v) { const c = parseRoute().category; ui[c].sort = v; ui[c].page = 1; rerenderGrid(c); },
    setPage(p) { const c = parseRoute().category; ui[c].page = p; rerenderGrid(c); },
    fav(btn, cat, id) {
      const card = btn.closest('.card');
      const name = card.querySelector('.card-title').textContent;
      const on = toggleFav(cat, id, name, '');
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on);
      btn.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites');
    },
    favDetail(btn, cat, id) {
      const name = document.querySelector('[data-testid="detail-name"]').textContent;
      const sub = document.querySelector('.detail-sub').textContent;
      const on = toggleFav(cat, id, name, sub);
      btn.classList.toggle('btn-primary', on);
      btn.classList.toggle('btn-secondary', !on);
      btn.style.background = on ? '' : '#fff';
      btn.setAttribute('aria-pressed', on);
      btn.querySelector('[data-testid="detail-fav-label"]').textContent = on ? 'Saved' : 'Add to favorites';
    },
    favFromList(btn, cat, id) { toggleFav(cat, id); renderFavorites(); },
  };

  function rerenderGrid(category) {
    if (!document.getElementById('grid-region')) return renderBrowse(category);
    const data = cache[category];
    if (!data) return renderBrowse(category);
    const s = ui[category], sc = SCHEMA[category];
    const filtered = applyQuerySort(data.items, category);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (s.page > pages) s.page = pages;
    const pageItems = filtered.slice((s.page - 1) * PAGE_SIZE, (s.page - 1) * PAGE_SIZE + PAGE_SIZE);
    const region = document.getElementById('grid-region');
    const meta = document.querySelector('[data-testid="result-meta"]');
    if (meta) meta.innerHTML = `${filtered.length} ${filtered.length === 1 ? sc.singular.toLowerCase() : sc.label.toLowerCase()} &nbsp; ${sourcePill(data)}`;
    if (!filtered.length) {
      region.innerHTML = `<div class="state" data-testid="empty">
        <span class="material-symbols-rounded">search_off</span>
        <h3>No ${sc.label.toLowerCase()} match "${esc(s.q)}"</h3>
        <p>Try a different search term, or clear the search to see everything.</p>
        <button class="btn btn-secondary" data-testid="clear-search" onclick="GalaxyApp.search('')">Clear search</button></div>`;
      return;
    }
    region.innerHTML = `<div class="grid" data-testid="results">${pageItems.map((it) => cardHTML(it, category)).join('')}</div>${pagerHTML(s.page, pages)}`;
  }

  // Live "Galactic Standard Time" clock (UTC). The datetime attr is ISO-formatted
  // so mabl can read and compare it against local time for clock accuracy tests.
  function startClock() {
    const el = document.querySelector('[data-testid="clock-time"]');
    if (!el) return;
    const tick = () => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      el.textContent = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
      el.setAttribute('datetime', d.toISOString());
    };
    tick();
    setInterval(tick, 1000);
  }

  window.addEventListener('hashchange', route);
  updateFavCount();
  startClock();
  route();
})();
