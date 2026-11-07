// ==UserScript==
// @name         La Table Ronde - relevé du classement
// @namespace    tsukuyomi-hub
// @version      1.0.0
// @description  Ouvert par « Actualiser » dans MAJ joueurs : relève toutes les pages du classement des joueurs et les renvoie à La Table Ronde.
// @match        https://worldofshinobi.com/classements.html*
// @run-at       document-idle
// @grant        none
// @sandbox      DOM
// @inject-into  content
// ==/UserScript==

(function () {
  'use strict';

  // Seule l'ouverture depuis l'appli (classements.html?vue=joueurs#table-ronde) déclenche le relevé.
  if (location.hash !== '#table-ronde') return;

  const MESSAGE = 'table-ronde:classement';
  /** Pause entre deux pages, pour ne pas charger le serveur du jeu. */
  const PAUSE_MS = 400;
  const MAX_PAGES = 200;

  function banner(text) {
    let box = document.getElementById('table-ronde-banner');
    if (!box) {
      box = document.createElement('div');
      box.id = 'table-ronde-banner';
      box.style.cssText =
        'position:fixed;left:12px;right:12px;top:12px;z-index:99999;display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 14px;' +
        'border:1px solid #b88f32;border-radius:10px;background:#182034;color:#f1e9d6;font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px #0008';
      box.append(document.createElement('span'));
      document.body.append(box);
    }
    box.firstChild.textContent = text;
    return box;
  }

  async function page(number) {
    const query = new URLSearchParams({ vue: 'joueurs', page: String(number), tri: 'points', ordre: 'desc', q: '' });
    const response = await fetch('/api/classements?' + query, { credentials: 'same-origin' });
    if (response.status === 401) throw new Error('connectez-vous au jeu puis recommencez depuis l’appli.');
    if (!response.ok) throw new Error('le jeu a répondu ' + response.status + '.');
    const data = await response.json();
    return { players: data.players || [], total: Math.min(MAX_PAGES, (data.pages && data.pages.joueurs && data.pages.joueurs.total) || 1) };
  }

  /** Copie de secours, quand l'appli n'est pas joignable (ouverte depuis l'écran d'accueil d'un téléphone, par exemple). */
  function offerCopy(box, payload) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Copier pour La Table Ronde';
    button.style.cssText = 'padding:6px 12px;border-radius:8px;border:0;background:#8a1f20;color:#fff;font:inherit;cursor:pointer';
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(payload));
        banner('Copié. Revenez dans La Table Ronde et touchez « Coller le relevé ».');
        button.remove();
      } catch {
        banner('Copie refusée par le navigateur : réessayez.');
      }
    });
    box.append(button);
  }

  async function run() {
    const byId = new Map();
    let total = 1;
    for (let number = 1; number <= total; number++) {
      banner('La Table Ronde : relevé du classement, page ' + number + (total > 1 ? ' / ' + total : '') + '…');
      const result = await page(number);
      total = result.total;
      // Le classement peut bouger pendant le relevé : un joueur vu deux fois n'est gardé qu'une fois.
      for (const player of result.players) byId.set(player.id, player);
      if (number < total) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
    const payload = { type: MESSAGE, takenAt: new Date().toISOString(), players: [...byId.values()] };
    const box = banner(payload.players.length + ' joueurs relevés.');
    if (window.opener) {
      // Le classement n'est pas secret : il est remis à la fenêtre qui a ouvert la page, l'appli vérifie qu'il vient du jeu.
      window.opener.postMessage(payload, '*');
      banner(payload.players.length + ' joueurs envoyés à La Table Ronde. Vous pouvez fermer cet onglet.');
      setTimeout(() => window.close(), 1500);
    } else {
      offerCopy(box, payload);
    }
  }

  run().catch((error) => banner('La Table Ronde : relevé impossible, ' + error.message));
})();
