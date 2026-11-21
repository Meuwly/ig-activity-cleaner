// ==UserScript==
// @name         Instagram Activity Cleaner
// @name:fr      Instagram Activity Cleaner
// @namespace    ig-cleaner
// @version      3.0
// @description  Automatically unlike all your posts & reels and delete all your comments from the "Your activity" page.
// @description:fr Retire automatiquement tous tes J'aime et supprime tous tes commentaires depuis la page « Votre activité ».
// @author       Timothée Meuwly
// @match        https://www.instagram.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---------- Réglages ----------
  // Les deux modes : un par page "Votre activité"
  const MODES = {
    likes: {
      path: '/your_activity/interactions/likes',
      key: 'igcleaner',
      icon: '♥',
      actionLabels: ["Je n'aime plus", 'Unlike'],
      texts: {
        fr: { title: "Retirer les J'aime", count: "J'aime retirés", done: 'retirés', tab: "J'aime" },
        en: { title: 'Unlike everything', count: 'likes removed', done: 'removed', tab: 'Likes' },
      },
    },
    comments: {
      path: '/your_activity/interactions/comments',
      key: 'igcleaner_comments',
      icon: '💬',
      actionLabels: ['Supprimer', 'Delete'],
      texts: {
        fr: { title: 'Supprimer les commentaires', count: 'commentaires supprimés', done: 'supprimés', tab: 'Commentaires' },
        en: { title: 'Delete comments', count: 'comments deleted', done: 'deleted', tab: 'Comments' },
      },
    },
  };

  const CONFIG = {
    batchSize: 20, // éléments sélectionnés par lot
    pauseBetweenBatches: [8000, 15000], // pause aléatoire (ms) entre deux lots
    selectLabels: ['Sélectionner', 'Select'],
  };
  const DEFAULT_PAUSE = CONFIG.pauseBetweenBatches;
  const LANG_KEY = 'igcleaner_lang';

  // Mode de la page actuelle (ou null si on n'est pas sur une page gérée)
  const detectMode = () =>
    Object.keys(MODES).find((m) => location.pathname.startsWith(MODES[m].path)) || null;

  let mode = detectMode();
  const M = () => MODES[mode];
  const storageKey = (name) => M().key + '_' + name;

  // ---------- Langues ----------
  const I18N = {
    fr: {
      ready: 'Prêt à démarrer',
      running: 'En cours…',
      batchDone: '{n} {done} · pause avant le prochain lot…',
      searching: "Recherche d'autres éléments…",
      reloading: 'Rechargement de la page…',
      resuming: 'Reprise dans 4 secondes…',
      stopped: 'Arrêté',
      pauseSet: 'Pause réglée : {a} à {b} s',
      pauseLabel: 'Pause entre deux lots',
      to: 'à',
      seconds: 'secondes',
      start: '▶ Démarrer',
      stop: '■ Arrêter',
      keepOpen: 'Garde cet onglet ouvert pendant le nettoyage',
      minimize: 'Réduire',
      expand: 'Agrandir',
      language: 'Langue',
      credit: 'Développé avec ❤ par Timothée Meuwly',
    },
    en: {
      ready: 'Ready to start',
      running: 'Running…',
      batchDone: '{n} {done} · pausing before next batch…',
      searching: 'Looking for more items…',
      reloading: 'Reloading the page…',
      resuming: 'Resuming in 4 seconds…',
      stopped: 'Stopped',
      pauseSet: 'Pause set: {a} to {b} s',
      pauseLabel: 'Pause between batches',
      to: 'to',
      seconds: 'seconds',
      start: '▶ Start',
      stop: '■ Stop',
      keepOpen: 'Keep this tab open while cleaning',
      minimize: 'Minimize',
      expand: 'Expand',
      language: 'Language',
      credit: 'Made with ❤ by Timothée Meuwly',
    },
  };

  const store = {
    get: (area, k) => { try { return area.getItem(k); } catch (e) { return null; } },
    set: (area, k, v) => { try { area.setItem(k, v); } catch (e) { /* stockage indisponible */ } },
    del: (area, k) => { try { area.removeItem(k); } catch (e) { /* stockage indisponible */ } },
  };

  let lang = store.get(localStorage, LANG_KEY)
    || ((navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en');
  if (!I18N[lang]) lang = 'en';

  function t(key, params = {}) {
    const all = { ...I18N[lang], ...(mode ? M().texts[lang] : {}), ...params };
    return (all[key] || key).replace(/\{(\w+)\}/g, (_, k) => (all[k] !== undefined ? all[k] : ''));
  }

  // Pause sauvegardée (en secondes), une par mode
  function loadPause() {
    CONFIG.pauseBetweenBatches = DEFAULT_PAUSE;
    try {
      const saved = JSON.parse(store.get(localStorage, storageKey('pause')));
      if (Array.isArray(saved) && saved.length === 2) {
        CONFIG.pauseBetweenBatches = saved.map((sec) => sec * 1000);
      }
    } catch (e) { /* réglage illisible : on garde la valeur par défaut */ }
  }

  // ---------- Outils ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = ([a, b]) => Math.floor(a + Math.random() * (b - a));
  let running = false;
  let total = 0;

  const log = (...a) => console.log('[IG Cleaner]', ...a);

  // Texte normalisé : minuscules, apostrophes et espaces unifiés
  const norm = (txt) => (txt || '')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // Visible à l'écran (marche aussi pour les barres "fixed")
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };

  const isDisabled = (el) =>
    el.disabled || el.getAttribute('aria-disabled') === 'true';

  function findByText(labels, root = document) {
    const wanted = labels.map(norm);
    const nodes = root.querySelectorAll('button, [role="button"], [aria-label], span, div');
    let found = null;
    for (const n of nodes) {
      const txt = norm(n.textContent);
      const aria = norm(n.getAttribute('aria-label'));
      if ((wanted.includes(txt) || wanted.includes(aria)) && isVisible(n)) {
        // On garde le dernier trouvé : la barre du bas / la fenêtre est en fin de page
        found = n.closest('button, [role="button"]') || n;
      }
    }
    return found;
  }

  // Clic "complet" (certains boutons React ignorent un simple .click())
  function realClick(el) {
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();
  }

  function lastDialog() {
    const d = [...document.querySelectorAll('div[role="dialog"]')].filter(isVisible);
    return d[d.length - 1] || null;
  }

  function getCheckboxes() {
    const sel = [
      '[data-testid="bulk_action_checkbox"]',
      '[aria-label="Toggle checkbox"]',
      '[aria-label*="case à cocher"]',
    ].join(',');
    return [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null);
  }

  async function waitFor(fn, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const r = fn();
      if (r && (!Array.isArray(r) || r.length)) return r;
      await sleep(300);
    }
    return null;
  }

  // ---------- Un lot ----------
  async function runBatch() {
    // 1. Mode sélection
    if (!getCheckboxes().length) {
      const selectBtn = await waitFor(() => findByText(CONFIG.selectLabels));
      if (!selectBtn) return 0;
      realClick(selectBtn);
    }

    // 2. Cocher les éléments
    const boxes = await waitFor(getCheckboxes);
    if (!boxes) return 0;
    let count = 0;
    for (const box of boxes.slice(0, CONFIG.batchSize)) {
      if (!running) return count;
      realClick(box);
      count++;
      await sleep(rand([150, 400]));
    }

    // 3. Bouton d'action en bas (on attend qu'il soit actif)
    const dialogsBefore = document.querySelectorAll('div[role="dialog"]').length;
    const actionBtn = await waitFor(() => {
      const b = findByText(M().actionLabels);
      return b && !isDisabled(b) ? b : null;
    });
    if (!actionBtn) {
      log('Action button not found. Labels:', M().actionLabels);
      return 0;
    }
    log('Clicking action button', actionBtn);
    realClick(actionBtn);

    // 4. Confirmation dans la nouvelle fenêtre
    const dialog = await waitFor(() => {
      const all = document.querySelectorAll('div[role="dialog"]');
      return all.length > dialogsBefore || lastDialog() ? lastDialog() : null;
    }, 6000);
    if (!dialog) {
      log('No confirmation dialog found.');
      return 0;
    }
    const confirm = await waitFor(() => {
      const b = findByText(M().actionLabels, dialog);
      return b && b !== actionBtn ? b : null;
    }, 6000);
    if (!confirm) {
      log('Confirm button not found in dialog:', dialog.innerText);
      return 0;
    }
    log('Clicking confirm button', confirm);
    realClick(confirm);

    // 5. Attendre que la fenêtre se ferme
    await waitFor(() => (!document.body.contains(dialog) || !isVisible(dialog) ? true : null), 15000);
    await sleep(2000);
    return count;
  }

  async function loop() {
    let empty = 0;
    while (running) {
      const n = await runBatch();
      if (n > 0) {
        total += n;
        empty = 0;
        setStatus('batchDone', 'wait', { n });
        await sleep(rand(CONFIG.pauseBetweenBatches));
      } else {
        empty++;
        if (empty >= 3) {
          // On recharge la page pour voir s'il en reste
          setStatus('reloading', 'wait');
          store.set(sessionStorage, storageKey('autostart'), '1');
          location.reload();
          return;
        }
        setStatus('searching', 'run');
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(3000);
      }
    }
    setStatus('stopped', 'idle');
  }

  // ---------- Menu ----------
  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .card {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; width: 280px;
      background: rgba(18, 18, 22, 0.92); color: #f5f5f5;
      border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 18px; overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      animation: pop .25s ease-out;
    }
    @keyframes pop { from { opacity: 0; transform: translateY(10px) scale(.97); } }
    .head {
      display: flex; align-items: center; gap: 10px; padding: 12px 14px; cursor: move; user-select: none;
      background: linear-gradient(120deg, #feda75, #fa7e1e 25%, #d62976 50%, #962fbf 75%, #4f5bd5);
    }
    .logo {
      width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; flex: none;
      background: rgba(255, 255, 255, 0.22); font-size: 15px;
    }
    .title { flex: 1; font-weight: 700; font-size: 14px; text-shadow: 0 1px 2px rgba(0, 0, 0, .25); }
    .icon-btn {
      width: 26px; height: 26px; border: 0; border-radius: 8px; cursor: pointer; flex: none;
      background: rgba(255, 255, 255, 0.2); color: #fff; font-size: 16px; line-height: 1;
    }
    .icon-btn:hover { background: rgba(255, 255, 255, 0.35); }
    .body { padding: 16px; display: grid; gap: 14px; }
    .card.mini .body { display: none; }
    .card.hidden { display: none; }
    .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: rgba(255, 255, 255, 0.07); border-radius: 12px; padding: 4px; }
    .tabs button {
      border: 0; background: transparent; color: #a8a8b3; font-size: 12px; font-weight: 700;
      padding: 7px 6px; border-radius: 9px; cursor: pointer;
    }
    .tabs button:hover:not(:disabled) { color: #fff; }
    .tabs button.on { background: rgba(255, 255, 255, 0.14); color: #fff; }
    .tabs button:disabled:not(.on) { opacity: .4; cursor: not-allowed; }
    .counter { text-align: center; }
    .count { font-size: 38px; font-weight: 800; line-height: 1; }
    .count-label { font-size: 12px; color: #a8a8b3; margin-top: 4px; }
    .status {
      display: flex; align-items: center; gap: 8px; font-size: 13px; color: #d4d4dc;
      background: rgba(255, 255, 255, 0.05); padding: 8px 10px; border-radius: 10px;
    }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: #71717a; flex: none; }
    .dot.run { background: #22c55e; animation: pulse 1.2s infinite; }
    .dot.wait { background: #f59e0b; }
    @keyframes pulse { 50% { box-shadow: 0 0 0 5px rgba(34, 197, 94, .25); } }
    .label { font-size: 12px; color: #a8a8b3; margin-bottom: 6px; }
    .pause { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #d4d4dc; }
    .pause input {
      width: 64px; padding: 7px 8px; border-radius: 9px; color: #fff; font-size: 13px; text-align: center;
      background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.12); outline: none;
    }
    .pause input:focus { border-color: #d62976; }
    .main-btn {
      width: 100%; padding: 11px; border: 0; border-radius: 12px; cursor: pointer;
      font-size: 14px; font-weight: 700; color: #fff; transition: transform .1s, filter .2s;
      background: linear-gradient(90deg, #fa7e1e, #d62976, #962fbf);
    }
    .main-btn:hover { filter: brightness(1.1); }
    .main-btn:active { transform: scale(.98); }
    .main-btn.stop { background: #3f3f46; }
    .row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #a8a8b3; }
    .lang { display: flex; background: rgba(255, 255, 255, 0.07); border-radius: 9px; padding: 3px; gap: 3px; }
    .lang button {
      border: 0; background: transparent; color: #a8a8b3; font-size: 12px; font-weight: 700;
      padding: 4px 10px; border-radius: 7px; cursor: pointer;
    }
    .lang button.on { background: linear-gradient(90deg, #d62976, #962fbf); color: #fff; }
    .foot { font-size: 11px; color: #71717a; text-align: center; line-height: 1.5; }
    .credit { color: #a8a8b3; }
    .heart { color: #ef4466; }
  `;

  let ui = {};
  let lastStatus = { key: 'ready', state: 'idle', params: {} };

  function setStatus(key, state = 'idle', params = {}) {
    lastStatus = { key, state, params };
    if (mode) store.set(sessionStorage, storageKey('total'), String(total));
    if (!ui.status) return;
    ui.status.textContent = t(key, params);
    ui.dot.className = 'dot' + (state === 'idle' ? '' : ' ' + state);
    ui.count.textContent = total;
  }

  // Met tous les textes du menu dans la langue choisie
  function applyLang() {
    ui.tabs.forEach((b) => {
      b.lastChild.textContent = ' ' + MODES[b.dataset.mode].texts[lang].tab;
    });
    ui.root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    ui.credit.innerHTML = '';
    const [before, after] = t('credit').split('❤');
    const heart = document.createElement('span');
    heart.className = 'heart';
    heart.textContent = '❤';
    ui.credit.append(before, heart, after || '');
    ui.btn.textContent = t(running ? 'stop' : 'start');
    const mini = ui.card.classList.contains('mini');
    ui.mini.title = t(mini ? 'expand' : 'minimize');
    ui.root.querySelectorAll('.lang button').forEach((b) => {
      b.classList.toggle('on', b.dataset.lang === lang);
    });
    setStatus(lastStatus.key, lastStatus.state, lastStatus.params);
  }

  function makeDraggable(card, handle) {
    let sx, sy, ox, oy;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = card.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (sx === undefined) return;
      const x = Math.min(Math.max(0, ox + e.clientX - sx), innerWidth - card.offsetWidth);
      const y = Math.min(Math.max(0, oy + e.clientY - sy), innerHeight - 40);
      Object.assign(card.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
    });
    handle.addEventListener('pointerup', () => { sx = undefined; });
  }

  function buildPanel() {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${CSS}</style>
      <div class="card">
        <div class="head">
          <div class="logo" id="logo"></div>
          <div class="title" data-i18n="title"></div>
          <button class="icon-btn" id="mini">–</button>
        </div>
        <div class="body">
          <div class="tabs">
            <button data-mode="likes">♥<span></span></button>
            <button data-mode="comments">💬<span></span></button>
          </div>
          <div class="counter">
            <div class="count" id="count">0</div>
            <div class="count-label" data-i18n="count"></div>
          </div>
          <div class="status"><span class="dot" id="dot"></span><span id="status"></span></div>
          <div>
            <div class="label" data-i18n="pauseLabel"></div>
            <div class="pause">
              <input id="min" type="number" min="1">
              <span data-i18n="to"></span>
              <input id="max" type="number" min="1">
              <span data-i18n="seconds"></span>
            </div>
          </div>
          <button class="main-btn" id="go"></button>
          <div class="row">
            <span data-i18n="language"></span>
            <div class="lang">
              <button data-lang="fr">FR</button>
              <button data-lang="en">EN</button>
            </div>
          </div>
          <div class="foot">
            <div data-i18n="keepOpen"></div>
            <div class="credit" id="credit"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(host);

    const $ = (id) => root.getElementById(id);
    ui = {
      root,
      card: root.querySelector('.card'),
      status: $('status'),
      dot: $('dot'),
      count: $('count'),
      btn: $('go'),
      mini: $('mini'),
      credit: $('credit'),
      logo: $('logo'),
      min: $('min'),
      max: $('max'),
      tabs: [...root.querySelectorAll('.tabs button')],
    };

    // Onglets : on recharge la page de l'autre mode
    ui.tabs.forEach((b) => {
      b.onclick = () => {
        if (running || b.dataset.mode === mode) return;
        location.href = MODES[b.dataset.mode].path + '/';
      };
    });

    ui.btn.onclick = toggle;
    ui.mini.onclick = () => {
      const mini = ui.card.classList.toggle('mini');
      ui.mini.textContent = mini ? '+' : '–';
      ui.mini.title = t(mini ? 'expand' : 'minimize');
    };
    makeDraggable(ui.card, root.querySelector('.head'));

    root.querySelectorAll('.lang button').forEach((b) => {
      b.onclick = () => {
        lang = b.dataset.lang;
        store.set(localStorage, LANG_KEY, lang);
        applyLang();
      };
    });

    const minEl = $('min');
    const maxEl = $('max');
    const savePause = () => {
      let a = Math.max(1, Number(minEl.value) || 1);
      let b = Math.max(1, Number(maxEl.value) || a);
      if (b < a) [a, b] = [b, a];
      minEl.value = a;
      maxEl.value = b;
      CONFIG.pauseBetweenBatches = [a * 1000, b * 1000];
      store.set(localStorage, storageKey('pause'), JSON.stringify([a, b]));
      setStatus('pauseSet', running ? 'run' : 'idle', { a, b });
    };
    minEl.onchange = savePause;
    maxEl.onchange = savePause;
  }

  // Affiche le menu pour le mode de la page (ou le cache)
  function refreshMode() {
    const newMode = detectMode();
    if (newMode !== mode && running) {
      // On a quitté la page pendant le nettoyage : on arrête
      toggle();
    }
    mode = newMode;
    ui.card.classList.toggle('hidden', !mode);
    if (!mode) return;

    loadPause();
    const [pMin, pMax] = CONFIG.pauseBetweenBatches.map((ms) => Math.round(ms / 1000));
    ui.min.value = pMin;
    ui.max.value = pMax;
    total = Number(store.get(sessionStorage, storageKey('total'))) || 0;
    ui.logo.textContent = M().icon;
    ui.tabs.forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    lastStatus = { key: 'ready', state: 'idle', params: {} };
    applyLang();
  }

  function toggle() {
    running = !running;
    ui.btn.textContent = t(running ? 'stop' : 'start');
    ui.btn.classList.toggle('stop', running);
    ui.tabs.forEach((b) => { b.disabled = running; });
    if (running) {
      setStatus('running', 'run');
      loop();
    } else {
      if (mode) store.del(sessionStorage, storageKey('autostart'));
    }
  }

  buildPanel();
  refreshMode();

  // Instagram change de page sans recharger : on surveille l'adresse
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      refreshMode();
    }
  }, 1000);

  if (mode && store.get(sessionStorage, storageKey('autostart')) === '1') {
    setStatus('resuming', 'wait');
    setTimeout(() => { if (!running && mode) toggle(); }, 4000);
  }
})();
