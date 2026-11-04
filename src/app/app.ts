import { ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AccessGate } from './core/access';

interface NavTab {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'menuOpen.set(false)' },
})
export class App {
  protected readonly tabs: readonly NavTab[] = [
    { path: '/retour', label: 'Retours', icon: '🗺️' },
    { path: '/pillage', label: 'Pillages', icon: '💰' },
    { path: '/batiments', label: 'BuildGuide', icon: '🔨' },
    { path: '/simulation', label: 'Simu constru', icon: '🏗️' },
    { path: '/combat', label: 'Simu combat', icon: '⚔️' },
    { path: '/raz', label: 'Simu raz', icon: '💥' },
    { path: '/secondes', label: 'Calcul seconde', icon: '⏱️' },
    { path: '/proches', label: 'Qui est le plus proche', icon: '📍' },
    { path: '/radar', label: 'Radar du jeu', icon: '📡' },
    { path: '/ennemis', label: 'infos enemis', icon: '🕵️' },
    { path: '/joueurs', label: 'MAJ joueurs', icon: '👥' },
  ];

  protected readonly menuOpen = signal(false);

  protected readonly access = inject(AccessGate);

  constructor() {
    // Dès l'ouverture : les niveaux de la base servent aux calculs de toutes les pages. Chargé à part pour ne pas alourdir le démarrage.
    const injector = inject(Injector);
    void import('./features/buildings/building-levels-store').then((m) => injector.get(m.BuildingLevelsStore));
  }
  protected readonly password = signal('');
  protected readonly unlocking = signal(false);

  protected async unlock(): Promise<void> {
    if (!this.password()) return;
    this.unlocking.set(true);
    const ok = await this.access.unlock(this.password());
    this.unlocking.set(false);
    if (ok) this.password.set('');
  }

  private readonly url = toSignal(
    inject(Router).events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: '' },
  );

  /** Onglet affiché sous le titre, à côté du burger. */
  protected readonly currentTab = computed(() => this.tabs.find((t) => this.url().startsWith(t.path)) ?? null);
}
