import { computed, Injectable, signal } from '@angular/core';

/** Événement du navigateur (Android) qui permet d'ouvrir sa fenêtre d'installation. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Marche à suivre quand le navigateur ne propose pas de fenêtre d'installation (iPhone, Safari, Firefox…). */
export function installHelp(userAgent: string, touch = false): string {
  // Sur iPad, Safari se présente comme un Mac : seul l'écran tactile les distingue.
  const apple = /iPad|iPhone|iPod/.test(userAgent) || (touch && /Macintosh/.test(userAgent));
  if (apple) return 'Dans Safari, touchez le bouton Partager, puis « Sur l’écran d’accueil ».';
  if (/Macintosh/.test(userAgent) && /Safari/.test(userAgent) && !/Chrome|Chromium|Edg|Firefox/.test(userAgent)) {
    return 'Dans Safari, ouvrez le menu Fichier, puis « Ajouter au Dock ».';
  }
  if (/Firefox/.test(userAgent) && !/Android/.test(userAgent)) return 'Firefox ne propose pas l’installation sur ordinateur : ouvrez le site dans Chrome ou Edge.';
  return 'Ouvrez le menu ⋮ du navigateur, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».';
}

/** Installation du site comme application, sur téléphone et sur ordinateur : son icône et sa propre fenêtre. */
@Injectable({ providedIn: 'root' })
export class AppInstall {
  private readonly promptEvent = signal<InstallPromptEvent | null>(null);
  private readonly installed = signal(
    window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
  );

  /** Le bouton disparaît une fois l'application installée ou ouverte. */
  readonly available = computed(() => !this.installed());
  readonly help = signal<string | null>(null);

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.promptEvent.set(event as InstallPromptEvent);
    });
    window.addEventListener('appinstalled', () => this.installed.set(true));
  }

  async install(): Promise<void> {
    const event = this.promptEvent();
    if (!event) {
      this.help.set(installHelp(navigator.userAgent, navigator.maxTouchPoints > 1));
      return;
    }
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Le navigateur n'accepte d'ouvrir cette fenêtre qu'une fois par événement.
    this.promptEvent.set(null);
    if (outcome === 'accepted') this.installed.set(true);
  }
}
