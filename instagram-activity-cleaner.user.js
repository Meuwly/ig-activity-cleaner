// ==UserScript==
// @name         Instagram Activity Cleaner
// @name:fr      Instagram Activity Cleaner
// @namespace    ig-cleaner
// @version      4.0
// @description  Unlike all posts & reels, delete all your comments, unsend your DMs and delete chats on your side.
// @description:fr Retire tes J'aime, supprime tes commentaires, annule l'envoi de tes messages privés et supprime des discussions de ton côté.
// @author       Timothée Meuwly
// @match        https://www.instagram.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // =====================================================================
  // SÉCURITÉ : le script ne clique JAMAIS sur un élément qui contient
  // un de ces mots. S'il en croise un, il s'arrête immédiatement.
  // =====================================================================
  const FORBIDDEN_WORDS = [
    'signaler', 'signalement', 'report',
    'bloquer', 'block',
    'restreindre', 'restrict',
  ];

  // ---------- Modes ----------
  // group "activity" : pages « Votre activité » (un onglet = une page)
  // group "dm"       : une discussion privée ouverte (onglets sur la même page)
  const MODES = {
    likes: {
      group: 'activity',
      path: '/your_activity/interactions/likes',
      key: 'igcleaner',
      icon: '♥',
      actionLabels: ["Je n'aime plus", 'Unlike'],
      reloadWhenEmpty: true,
      texts: {
        fr: { title: "Retirer les J'aime", count: "J'aime retirés", done: 'retirés', tab: "♥ J'aime",
          hint: "Retire tous tes J'aime sur les posts et les réels." },
        en: { title: 'Unlike everything', count: 'likes removed', done: 'removed', tab: '♥ Likes',
          hint: 'Removes all your likes on posts and reels.' },
      },
    },
    comments: {
      group: 'activity',
      path: '/your_activity/interactions/comments',
      key: 'igcleaner_comments',
      icon: '💬',
      actionLabels: ['Supprimer', 'Delete'],
      reloadWhenEmpty: true,
      texts: {
        fr: { title: 'Supprimer les commentaires', count: 'commentaires supprimés', done: 'supprimés', tab: '💬 Commentaires',
          hint: 'Supprime tous les commentaires que tu as écrits.' },
        en: { title: 'Delete comments', count: 'comments deleted', done: 'deleted', tab: '💬 Comments',
          hint: 'Deletes every comment you wrote.' },
      },
    },
    unsend: {
      group: 'dm',
      key: 'igcleaner_unsend',
      icon: '↩',
      reloadWhenEmpty: false,
      texts: {
        fr: { title: "Annuler l'envoi", count: 'messages retirés', done: 'retirés', tab: '↩ Mes messages',
          hint: "Retire TES messages de cette discussion, pour toi ET pour l'autre personne. Ne touche jamais à « Signaler »." },
        en: { title: 'Unsend my messages', count: 'messages unsent', done: 'unsent', tab: '↩ Unsend',
          hint: 'Unsends YOUR messages in this chat, for you AND the other person. Never touches "Report".' },
      },
    },
    deleteChat: {
      group: 'dm',
      key: 'igcleaner_deletechat',
      icon: '🗑',
      reloadWhenEmpty: false,
      danger: true,
      texts: {
        fr: { title: 'Supprimer la discussion', count: 'discussion supprimée', done: 'supprimée', tab: '🗑 Discussion',
          hint: "Efface toute la discussion (aussi les messages de l'autre) de TON côté seulement. L'autre personne garde tout. Instagram ne permet pas d'effacer ses messages chez lui." },
        en: { title: 'Delete chat (for me)', count: 'chat deleted', done: 'deleted', tab: '🗑 Delete chat',
          hint: "Deletes the whole chat (their messages too) on YOUR side only. The other person keeps everything. Instagram can't delete their messages on their side." },
      },
    },
  };

  // Textes d'Instagram que le script cherche (FR + EN)
  const LABELS = {
    select: ['Sélectionner', 'Select'],
    dmMore: ['More', 'Plus', "Plus d'options", 'More options', 'See more options', "Voir plus d'options", 'Autres options'],
    unsend: ["Annuler l'envoi", 'Unsend', 'Retirer'],
    chatInfo: [
      'Conversation information', 'Conversation info', 'Informations sur la conversation',
      'Infos sur la conversation', 'Informations de la conversation', 'Détails de la conversation',
    ],
    deleteChat: ['Supprimer la discussion', 'Supprimer la conversation', 'Delete chat', 'Delete conversation'],
    deleteConfirm: ['Supprimer', 'Delete'],
  };

  const CONFIG = {
    batchSize: 20, // éléments par lot
    pauseBetweenBatches: [8000, 15000], // pause aléatoire (ms) entre deux lots
    pauseBetweenMessages: [1500, 3000], // pause (ms) entre deux messages retirés
  };
  const DEFAULT_PAUSE = CONFIG.pauseBetweenBatches;
  const LANG_KEY = 'igcleaner_lang';
  const DM_MODE_KEY = 'igcleaner_dm_mode';

  // ---------- Langues ----------
  const I18N = {
    fr: {
      ready: 'Prêt à démarrer',
      running: 'En cours…',
      batchDone: '{n} {done} · pause avant le prochain lot…',
      searching: "Recherche d'autres éléments…",
      loadingOlder: 'Chargement des anciens messages…',
      reloading: 'Rechargement de la page…',
      resuming: 'Reprise dans 4 secondes…',
      stopped: 'Arrêté',
      finished: 'Terminé ✔',
      chatDeleted: 'Discussion supprimée de ton côté ✔',
      chatFailed: 'Impossible de supprimer la discussion. Regarde la console (F12).',
      safetyStop: 'Arrêt de sécurité : bouton interdit détecté. Rien n\'a été cliqué.',
      confirmDeleteChat: 'Supprimer toute cette discussion de ton côté ?\n\nL\'autre personne gardera tous les messages. Ça ne peut pas être annulé.',
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
      loadingOlder: 'Loading older messages…',
      reloading: 'Reloading the page…',
      resuming: 'Resuming in 4 seconds…',
      stopped: 'Stopped',
      finished: 'Done ✔',
      chatDeleted: 'Chat deleted on your side ✔',
      chatFailed: 'Could not delete the chat. Check the console (F12).',
      safetyStop: 'Safety stop: forbidden button detected. Nothing was clicked.',
      confirmDeleteChat: 'Delete this whole chat on your side?\n\nThe other person will keep all messages. This cannot be undone.',
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

  // Mode de la page actuelle (ou null si la page n'est pas gérée)
  function detectMode() {
    if (location.pathname.startsWith('/direct/t/')) {
      const saved = store.get(localStorage, DM_MODE_KEY);
      return MODES[saved] && MODES[saved].group === 'dm' ? saved : 'unsend';
    }
    return Object.keys(MODES).find((m) => MODES[m].path && location.pathname.startsWith(MODES[m].path)) || null;
  }

  let mode = detectMode();
  const M = () => MODES[mode];
  const storageKey = (name) => M().key + '_' + name;

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

  // Tous les textes d'un élément : texte visible + aria-label (lui et ses enfants)
  function allTextOf(el) {
    const parts = [el.textContent, el.getAttribute('aria-label'), el.getAttribute('title')];
    el.querySelectorAll('[aria-label], [title]').forEach((c) => {
      parts.push(c.getAttribute('aria-label'), c.getAttribute('title'));
    });
    return norm(parts.filter(Boolean).join(' '));
  }

  const hasForbiddenWord = (el) => {
    const txt = allTextOf(el);
    return FORBIDDEN_WORDS.some((w) => txt.includes(w));
  };

  class SafetyStop extends Error {}

  // Clic "complet" + contrôle de sécurité AVANT chaque clic
  function realClick(el) {
    if (!el || hasForbiddenWord(el)) {
      log('⛔ SAFETY STOP — refused to click:', el, el && allTextOf(el));
      throw new SafetyStop('forbidden');
    }
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();
  }

  // Survol (ne clique jamais) : fait apparaître les boutons d'un message
  function hover(el) {
    const targets = [el, ...el.querySelectorAll('div')].slice(0, 40);
    for (const n of targets) {
      const opts = { bubbles: true, cancelable: true, view: window, relatedTarget: document.body };
      n.dispatchEvent(new PointerEvent('pointerover', opts));
      n.dispatchEvent(new PointerEvent('pointerenter', { ...opts, bubbles: false }));
      n.dispatchEvent(new MouseEvent('mouseover', opts));
      n.dispatchEvent(new MouseEvent('mouseenter', { ...opts, bubbles: false }));
      n.dispatchEvent(new MouseEvent('mousemove', opts));
    }
  }

  function pressEscape() {
    const opts = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true };
    (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', opts));
    document.dispatchEvent(new KeyboardEvent('keydown', opts));
  }

  // Cherche un élément dont le texte OU l'aria-label est EXACTEMENT un des libellés.
  // Renvoie l'élément cliquable le plus proche, sauf s'il contient un mot interdit :
  // dans ce cas on garde l'élément exact (jamais un conteneur plus large).
  function findByText(labels, root = document, { last = true, ariaOnly = false } = {}) {
    const wanted = labels.map(norm);
    const nodes = root.querySelectorAll('button, [role="button"], [role="menuitem"], [aria-label], span, div');
    let found = null;
    for (const n of nodes) {
      const txt = norm(n.textContent);
      const aria = norm(n.getAttribute('aria-label'));
      const match = wanted.includes(aria) || (!ariaOnly && wanted.includes(txt));
      if (match && isVisible(n)) {
        const clickable = n.closest('button, [role="button"], [role="menuitem"], a');
        let target = n;
        if (clickable && root.contains(clickable) && !hasForbiddenWord(clickable)) {
          const ctext = norm(clickable.textContent);
          if (!ctext || wanted.includes(ctext)) target = clickable;
        }
        if (!last) return target;
        found = target;
      }
    }
    return found;
  }

  function lastDialog() {
    const d = [...document.querySelectorAll('div[role="dialog"]')].filter(isVisible);
    return d[d.length - 1] || null;
  }

  function openMenu() {
    const menus = [...document.querySelectorAll('[role="menu"], div[role="dialog"]')].filter(isVisible);
    return menus[menus.length - 1] || null;
  }

  async function waitFor(fn, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const r = fn();
      if (r && (!Array.isArray(r) || r.length)) return r;
      await sleep(250);
    }
    return null;
  }

  // =====================================================================
  // MODE « Votre activité » : J'aime / commentaires
  // =====================================================================
  function getCheckboxes() {
    const sel = [
      '[data-testid="bulk_action_checkbox"]',
      '[aria-label="Toggle checkbox"]',
      '[aria-label*="case à cocher"]',
    ].join(',');
    return [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null);
  }

  async function activityBatch() {
    // 1. Mode sélection
    if (!getCheckboxes().length) {
      const selectBtn = await waitFor(() => findByText(LABELS.select));
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

  // =====================================================================
  // MODE « Annuler l'envoi » : retire MES messages d'une discussion
  // Clics autorisés : bouton « Plus » d'un message, « Annuler l'envoi »,
  // et la confirmation « Annuler l'envoi ». RIEN d'autre.
  // =====================================================================
  const DONE_ATTR = 'data-igc-done';

  function getMessageRows() {
    return [...document.querySelectorAll('div[role="row"]')]
      .filter((r) => isVisible(r) && !r.hasAttribute(DONE_ATTR));
  }

  function scrollableParent(el) {
    for (let n = el && el.parentElement; n; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
    }
    return null;
  }

  async function unsendOne(row) {
    row.setAttribute(DONE_ATTR, '1');
    row.scrollIntoView({ block: 'center' });
    await sleep(200);
    hover(row);

    // 1. Bouton « Plus » qui apparaît au survol du message
    const more = await waitFor(() => findByText(LABELS.dmMore, row, { last: false, ariaOnly: true }), 1500);
    if (!more) return false;
    realClick(more);

    // 2. Le menu doit contenir « Annuler l'envoi » (= c'est MON message)
    const menu = await waitFor(openMenu, 2000);
    const unsendItem = menu && await waitFor(() => findByText(LABELS.unsend, menu, { last: false }), 1500);
    if (!unsendItem) {
      // Message de l'autre personne (ou menu inconnu) : on referme SANS cliquer
      pressEscape();
      await sleep(400);
      return false;
    }
    log('Unsending message', row);
    realClick(unsendItem);

    // 3. Confirmation « Annuler l'envoi »
    const dialog = await waitFor(() => {
      const d = lastDialog();
      return d && findByText(LABELS.unsend, d) ? d : null;
    }, 4000);
    if (dialog) {
      const confirm = findByText(LABELS.unsend, dialog);
      if (confirm && confirm !== unsendItem) {
        realClick(confirm);
        await waitFor(() => (!document.body.contains(dialog) || !isVisible(dialog) ? true : null), 8000);
      }
    }
    await sleep(rand(CONFIG.pauseBetweenMessages));
    return true;
  }

  async function unsendBatch() {
    let count = 0;
    let rows = getMessageRows();
    if (!rows.length) {
      // Plus rien à l'écran : on remonte pour charger les anciens messages
      setStatus('loadingOlder', 'run');
      const all = document.querySelectorAll('div[role="row"]');
      const scroller = scrollableParent(all[0]);
      if (scroller) scroller.scrollTop = 0;
      await sleep(2500);
      return 0;
    }
    // Du plus récent (en bas) au plus ancien (en haut)
    rows = rows.reverse();
    for (const row of rows) {
      if (!running || count >= CONFIG.batchSize) break;
      if (!document.body.contains(row)) continue;
      if (await unsendOne(row)) {
        count++;
        total++;
        setStatus('running', 'run');
      }
    }
    total -= count; // la boucle principale additionne le lot
    return count;
  }

  // =====================================================================
  // MODE « Supprimer la discussion » (de MON côté seulement)
  // Clics autorisés : « Informations sur la conversation »,
  // « Supprimer la discussion », puis « Supprimer ». RIEN d'autre.
  // =====================================================================
  async function deleteChatOnce() {
    const info = await waitFor(() => findByText(LABELS.chatInfo, document, { last: false }), 5000);
    if (!info) {
      log('Chat info button not found. Labels:', LABELS.chatInfo);
      return -1;
    }
    realClick(info);

    const del = await waitFor(() => findByText(LABELS.deleteChat), 5000);
    if (!del) {
      log('"Delete chat" button not found. Labels:', LABELS.deleteChat);
      return -1;
    }
    realClick(del);

    const confirm = await waitFor(() => {
      const d = lastDialog();
      const b = d && findByText(LABELS.deleteConfirm, d);
      return b && b !== del ? b : null;
    }, 5000);
    if (!confirm) {
      log('Delete confirmation not found.');
      return -1;
    }
    realClick(confirm);
    await sleep(2000);
    return 1;
  }

  // =====================================================================
  // Boucle principale
  // =====================================================================
  async function loop() {
    let empty = 0;
    try {
      if (mode === 'deleteChat') {
        const r = await deleteChatOnce();
        if (r > 0) total += r;
        stopRunning(r > 0 ? 'chatDeleted' : 'chatFailed', r > 0 ? 'idle' : 'err');
        return;
      }

      while (running) {
        const n = mode === 'unsend' ? await unsendBatch() : await activityBatch();
        if (n > 0) {
          total += n;
          empty = 0;
          setStatus('batchDone', 'wait', { n });
          await sleep(rand(CONFIG.pauseBetweenBatches));
        } else {
          empty++;
          if (M().reloadWhenEmpty && empty >= 3) {
            // On recharge la page pour voir s'il en reste
            setStatus('reloading', 'wait');
            store.set(sessionStorage, storageKey('autostart'), '1');
            location.reload();
            return;
          }
          if (!M().reloadWhenEmpty && empty >= 6) {
            stopRunning('finished', 'idle');
            return;
          }
          if (mode !== 'unsend') {
            setStatus('searching', 'run');
            window.scrollTo(0, document.body.scrollHeight);
            await sleep(3000);
          }
        }
      }
      setStatus('stopped', 'idle');
    } catch (e) {
      if (e instanceof SafetyStop) {
        pressEscape();
        stopRunning('safetyStop', 'err');
      } else {
        log('Unexpected error', e);
        stopRunning('stopped', 'err');
      }
    }
  }

  // ---------- Menu ----------
  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .card {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; width: 300px;
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
    .card.danger .head { background: linear-gradient(120deg, #f87171, #dc2626 60%, #991b1b); }
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
    .tabs button[hidden] { display: none; }
    .tabs button:hover:not(:disabled) { color: #fff; }
    .tabs button.on { background: rgba(255, 255, 255, 0.14); color: #fff; }
    .tabs button.on.danger { background: rgba(220, 38, 38, 0.35); }
    .tabs button:disabled:not(.on) { opacity: .4; cursor: not-allowed; }
    .hint {
      font-size: 12px; line-height: 1.45; color: #d4d4dc; padding: 9px 11px; border-radius: 10px;
      background: rgba(255, 255, 255, 0.05); border-left: 3px solid #962fbf;
    }
    .card.danger .hint { border-left-color: #dc2626; background: rgba(220, 38, 38, 0.1); }
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
    .dot.err { background: #ef4444; }
    @keyframes pulse { 50% { box-shadow: 0 0 0 5px rgba(34, 197, 94, .25); } }
    .label { font-size: 12px; color: #a8a8b3; margin-bottom: 6px; }
    .pause-box.hidden { display: none; }
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
    .card.danger .main-btn { background: linear-gradient(90deg, #ef4444, #b91c1c); }
    .main-btn:hover { filter: brightness(1.1); }
    .main-btn:active { transform: scale(.98); }
    .card .main-btn.stop { background: #3f3f46; }
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
      b.textContent = MODES[b.dataset.mode].texts[lang].tab;
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
            <button data-mode="likes"></button>
            <button data-mode="comments"></button>
            <button data-mode="unsend"></button>
            <button data-mode="deleteChat" class="danger"></button>
          </div>
          <div class="hint" data-i18n="hint"></div>
          <div class="counter">
            <div class="count" id="count">0</div>
            <div class="count-label" data-i18n="count"></div>
          </div>
          <div class="status"><span class="dot" id="dot"></span><span id="status"></span></div>
          <div class="pause-box" id="pause-box">
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
      pauseBox: $('pause-box'),
      tabs: [...root.querySelectorAll('.tabs button')],
    };

    ui.tabs.forEach((b) => {
      b.onclick = () => {
        const target = b.dataset.mode;
        if (running || target === mode) return;
        if (MODES[target].group === 'activity') {
          // Autre page « Votre activité » : on y va
          location.href = MODES[target].path + '/';
        } else {
          // Onglets des messages privés : même page
          store.set(localStorage, DM_MODE_KEY, target);
          refreshMode();
        }
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

    const savePause = () => {
      let a = Math.max(1, Number(ui.min.value) || 1);
      let b = Math.max(1, Number(ui.max.value) || a);
      if (b < a) [a, b] = [b, a];
      ui.min.value = a;
      ui.max.value = b;
      CONFIG.pauseBetweenBatches = [a * 1000, b * 1000];
      store.set(localStorage, storageKey('pause'), JSON.stringify([a, b]));
      setStatus('pauseSet', running ? 'run' : 'idle', { a, b });
    };
    ui.min.onchange = savePause;
    ui.max.onchange = savePause;
  }

  // Affiche le menu pour le mode de la page (ou le cache)
  function refreshMode() {
    if (running) stopRunning('stopped', 'idle');
    mode = detectMode();
    ui.card.classList.toggle('hidden', !mode);
    if (!mode) return;

    const group = M().group;
    ui.tabs.forEach((b) => {
      b.hidden = MODES[b.dataset.mode].group !== group;
      b.classList.toggle('on', b.dataset.mode === mode);
    });
    ui.card.classList.toggle('danger', !!M().danger);
    ui.pauseBox.classList.toggle('hidden', mode === 'deleteChat');

    loadPause();
    const [pMin, pMax] = CONFIG.pauseBetweenBatches.map((ms) => Math.round(ms / 1000));
    ui.min.value = pMin;
    ui.max.value = pMax;
    total = Number(store.get(sessionStorage, storageKey('total'))) || 0;
    ui.logo.textContent = M().icon;
    lastStatus = { key: 'ready', state: 'idle', params: {} };
    applyLang();
  }

  function setRunningUI() {
    ui.btn.textContent = t(running ? 'stop' : 'start');
    ui.btn.classList.toggle('stop', running);
    ui.tabs.forEach((b) => { b.disabled = running; });
  }

  function stopRunning(statusKey, state) {
    running = false;
    if (mode) store.del(sessionStorage, storageKey('autostart'));
    setRunningUI();
    setStatus(statusKey, state);
  }

  function toggle() {
    if (running) {
      stopRunning('stopped', 'idle');
      return;
    }
    if (mode === 'deleteChat' && !window.confirm(t('confirmDeleteChat'))) return;
    running = true;
    setRunningUI();
    setStatus('running', 'run');
    loop();
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

  if (mode && M().reloadWhenEmpty && store.get(sessionStorage, storageKey('autostart')) === '1') {
    setStatus('resuming', 'wait');
    setTimeout(() => { if (!running && mode) toggle(); }, 4000);
  }
})();
