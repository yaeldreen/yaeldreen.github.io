// ==UserScript==
// @name         Tsukuyomi HUB - préremplissage et envoi des attaques
// @namespace    tsukuyomi-hub
// @version      1.3.0
// @description  Remplit les troupes et le mode d'attaque reçus depuis le Radar du jeu, puis envoie après 5 à 10 secondes, sauf si le joueur annule.
// @match        https://worldofshinobi.com/attaque.html*
// @run-at       document-idle
// @grant        none
// @sandbox      DOM
// @inject-into  content
// ==/UserScript==

(function () {
  'use strict';

  // Lien du radar : attaque.html?id=141#radar=genins,chuunins,jounins,pillage
  const match = /^#radar=(\d{1,7}),(\d{1,7}),(\d{1,7}),(combat|pillage)$/.exec(location.hash);
  // Page de soutien : rien à préremplir.
  if (!match || new URLSearchParams(location.search).get('mode') === 'support') return;

  const FIELDS = { 'send-genin': match[1], 'send-chunin': match[2], 'send-jounin': match[3] };
  const MAX_WAIT_MS = 20000;
  const MIN_DELAY_MS = 5000;
  const MAX_DELAY_MS = 10000;
  const started = Date.now();

  function showBanner(form, text) {
    let banner = document.getElementById('tsukuyomi-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'tsukuyomi-banner';
      banner.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;padding:10px 12px;border:1px solid #b91c1c;border-radius:8px;background:#1c1917;color:#f5f5f4;font-weight:600';
      banner.append(document.createElement('span'));
      form.querySelector('#send-army').before(banner);
    }
    banner.firstChild.textContent = text;
    return banner;
  }

  /** Envoie après une attente aléatoire. Modifier le formulaire ou cliquer sur Annuler arrête l'envoi. */
  function scheduleSend(form) {
    const sendAt = Date.now() + MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    const banner = showBanner(form, '');
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Annuler';
    banner.append(cancelButton);

    let timer = 0;
    const stop = (message) => {
      clearInterval(timer);
      form.removeEventListener('input', onEdit);
      form.removeEventListener('submit', onSubmit);
      cancelButton.remove();
      if (message) showBanner(form, message);
      else banner.remove();
    };
    const onEdit = () => stop('Envoi automatique annulé : le formulaire a été modifié.');
    const onSubmit = () => stop('');
    cancelButton.addEventListener('click', () => stop('Envoi automatique annulé.'));
    form.addEventListener('input', onEdit);
    form.addEventListener('submit', onSubmit);

    const tick = () => {
      const left = sendAt - Date.now();
      if (left > 0) {
        showBanner(form, 'Envoi automatique dans ' + Math.ceil(left / 1000) + ' s');
        return;
      }
      form.requestSubmit(form.querySelector('#send-army'));
    };
    timer = setInterval(tick, 200);
    tick();
  }

  function fill() {
    const form = document.getElementById('attack-form');
    if (!form || form.hidden) return false;
    // Retiré tout de suite : recharger la page ou revenir en arrière ne renverra pas de troupes.
    history.replaceState(null, '', location.pathname + location.search);

    let complete = true;
    let total = 0;
    for (const [id, value] of Object.entries(FIELDS)) {
      if (Number(value) === 0) continue;
      total += Number(value);
      const input = document.getElementById(id);
      if (!input || input.disabled) {
        complete = false;
        continue;
      }
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const mode = form.querySelector('input[name="mode"][value="' + match[4] + '"]');
    if (mode) mode.checked = true;

    // Armée incomplète (troupes pas motivées) ou mode absent : le joueur décide lui-même.
    if (!total || !complete || !mode) showBanner(form, 'Envoi automatique annulé : armée incomplète, à vérifier.');
    else scheduleSend(form);
    return true;
  }

  // Le formulaire reste caché jusqu'à ce que la page ait chargé les infos du joueur.
  const timer = setInterval(() => {
    if (fill() || Date.now() - started > MAX_WAIT_MS) clearInterval(timer);
  }, 200);
})();
