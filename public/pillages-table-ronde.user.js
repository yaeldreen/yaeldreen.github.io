// ==UserScript==
// @name         La Table Ronde - relevé des pillages
// @namespace    tsukuyomi-hub
// @version      1.0.0
// @description  Ouvert par « Actualiser les pillages » dans le Radar : relève l'historique des attaques des villages neutres et le renvoie à La Table Ronde.
// @match        https://worldofshinobi.com/joueur.html*
// @run-at       document-idle
// @grant        none
// @sandbox      DOM
// @inject-into  content
// ==/UserScript==

(function () {
  'use strict';

  // Seule l'ouverture depuis l'appli (joueur.html?id=…#table-ronde-pillages=-68,-12,…) déclenche le relevé.
  const match = /^#table-ronde-pillages=(-?\d+(?:,-?\d+)*)$/.exec(location.hash);
  if (!match) return;

  const MESSAGE = 'table-ronde:pillages';
  /** Pause entre deux villages, pour ne pas charger le serveur du jeu. */
  const PAUSE_MS = 400;
  const MAX_VILLAGES = 300;
  const ids = match[1].split(',').map(Number).slice(0, MAX_VILLAGES);

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

  /** Lecture seule : l'historique ne consomme pas de surveillance (seul « Surveiller » en utilise une). */
  async function history(id) {
    const response = await fetch('/api/neutral-surveillance?targetId=' + encodeURIComponent(id), { cache: 'no-store', credentials: 'same-origin' });
    if (response.status === 401) throw new Error('connectez-vous au jeu puis recommencez depuis l’appli.');
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data.history) ? data.history : null;
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
    const villages = [];
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      banner('La Table Ronde : pillages des villages neutres, ' + (i + 1) + ' / ' + ids.length + '…');
      const list = await history(ids[i]);
      if (list) villages.push({ id: ids[i], name: list[0] ? list[0].target : '', history: list });
      else failed++;
      if (i < ids.length - 1) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
    const payload = { type: MESSAGE, takenAt: new Date().toISOString(), villages };
    const attacks = villages.reduce((sum, v) => sum + v.history.length, 0);
    const summary = villages.length + ' villages relevés, ' + attacks + ' attaques' + (failed ? ', ' + failed + ' villages illisibles' : '') + '.';
    const box = banner(summary);
    if (window.opener) {
      // L'historique est visible de tous les joueurs : il est remis à la fenêtre qui a ouvert la page, l'appli vérifie qu'il vient du jeu.
      window.opener.postMessage(payload, '*');
      banner(summary + ' Envoyé à La Table Ronde, vous pouvez fermer cet onglet.');
      setTimeout(() => window.close(), 1500);
    } else {
      offerCopy(box, payload);
    }
  }

  run().catch((error) => banner('La Table Ronde : relevé impossible, ' + error.message));
})();
