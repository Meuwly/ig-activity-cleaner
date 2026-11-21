// ==UserScript==
// @name         Instagram - Supprimer tous mes commentaires
// @namespace    ig-cleaner
// @version      1.2
// @description  Supprime automatiquement tous tes commentaires depuis "Votre activité".
// @match        https://www.instagram.com/your_activity/interactions/comments*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    batchSize: 20, // éléments sélectionnés par tour
    pauseBetweenBatches: [8000, 15000], // pause aléatoire (ms) entre deux tours
    selectLabels: ['Sélectionner', 'Select'],
    actionLabels: ['Supprimer', 'Delete'],
    title: 'Supprimer les commentaires',
  };

  // Pause sauvegardée (en secondes)
  const PAUSE_KEY = 'igcleaner_comments_pause';
  try {
    const saved = JSON.parse(localStorage.getItem(PAUSE_KEY));
    if (Array.isArray(saved) && saved.length === 2) {
      CONFIG.pauseBetweenBatches = saved.map((sec) => sec * 1000);
    }
  } catch (e) { /* réglage illisible : on garde la valeur par défaut */ }

  // ---------- Outils ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = ([a, b]) => Math.floor(a + Math.random() * (b - a));
  let running = false;
  let total = 0;

  const log = (...a) => console.log('[IG Cleaner]', ...a);

  // Texte normalisé : minuscules, apostrophes et espaces unifiés
  const norm = (t) => (t || '')
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
        found = n.closest('button, [role="button"]') || n;
        // On garde le dernier trouvé : la barre du bas / la fenêtre est en fin de page
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

  // ---------- Un tour ----------
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
      const b = findByText(CONFIG.actionLabels);
      return b && !isDisabled(b) ? b : null;
    });
    if (!actionBtn) {
      log("Bouton d'action introuvable. Textes cherchés :", CONFIG.actionLabels);
      return 0;
    }
    log("Clic sur le bouton d'action", actionBtn);
    realClick(actionBtn);

    // 4. Confirmation dans la nouvelle fenêtre
    const dialog = await waitFor(() => {
      const all = document.querySelectorAll('div[role="dialog"]');
      return all.length > dialogsBefore || lastDialog() ? lastDialog() : null;
    }, 6000);
    if (!dialog) {
      log('Aucune fenêtre de confirmation trouvée.');
      return 0;
    }
    const confirm = await waitFor(() => {
      const b = findByText(CONFIG.actionLabels, dialog);
      return b && b !== actionBtn ? b : null;
    }, 6000);
    if (!confirm) {
      log('Bouton de confirmation introuvable dans la fenêtre :', dialog.innerText);
      return 0;
    }
    log('Clic sur la confirmation', confirm);
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
        setStatus(`${total} supprimés. Pause…`);
        await sleep(rand(CONFIG.pauseBetweenBatches));
      } else {
        empty++;
        if (empty >= 3) {
          // On recharge la page pour voir s'il en reste
          setStatus('Rechargement…');
          sessionStorage.setItem('igcleaner_comments_autostart', '1');
          location.reload();
          return;
        }
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(3000);
      }
    }
    setStatus(`Arrêté. ${total} supprimés.`);
  }

  // ---------- Petit panneau ----------
  let statusEl, btn;
  function setStatus(t) { if (statusEl) statusEl.textContent = t; }

  function buildPanel() {
    const box = document.createElement('div');
    box.style.cssText =
      'position:fixed;bottom:20px;right:20px;z-index:99999;background:#111;color:#fff;' +
      'padding:12px;border-radius:10px;font:14px sans-serif;box-shadow:0 2px 10px #0008;width:220px';
    const [pMin, pMax] = CONFIG.pauseBetweenBatches.map((ms) => Math.round(ms / 1000));
    const inputCss = 'width:50px;padding:2px;border-radius:4px;border:0';
    box.innerHTML =
      `<b>${CONFIG.title}</b>` +
      '<div style="margin:6px 0">Pause entre 2 tours (secondes) :<br>' +
      `de <input id="igc-min" type="number" min="1" value="${pMin}" style="${inputCss}"> ` +
      `à <input id="igc-max" type="number" min="1" value="${pMax}" style="${inputCss}"></div>` +
      '<div style="margin:6px 0" id="igc-status">Prêt.</div>';
    btn = document.createElement('button');
    btn.textContent = 'Démarrer';
    btn.style.cssText = 'width:100%;padding:6px;border:0;border-radius:6px;cursor:pointer';
    btn.onclick = toggle;
    box.appendChild(btn);
    document.body.appendChild(box);
    statusEl = box.querySelector('#igc-status');

    const minEl = box.querySelector('#igc-min');
    const maxEl = box.querySelector('#igc-max');
    const savePause = () => {
      let a = Math.max(1, Number(minEl.value) || 1);
      let b = Math.max(1, Number(maxEl.value) || a);
      if (b < a) [a, b] = [b, a];
      minEl.value = a;
      maxEl.value = b;
      CONFIG.pauseBetweenBatches = [a * 1000, b * 1000];
      try { localStorage.setItem(PAUSE_KEY, JSON.stringify([a, b])); } catch (e) { /* stockage indisponible */ }
      setStatus(`Pause réglée : ${a} à ${b} s.`);
    };
    minEl.onchange = savePause;
    maxEl.onchange = savePause;
  }

  function toggle() {
    running = !running;
    btn.textContent = running ? 'Arrêter' : 'Démarrer';
    if (running) { setStatus('En cours…'); loop(); }
    else sessionStorage.removeItem('igcleaner_comments_autostart');
  }

  buildPanel();
  if (sessionStorage.getItem('igcleaner_comments_autostart') === '1') {
    setTimeout(toggle, 4000);
  }
})();
