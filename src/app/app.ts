import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

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
    { path: '/retour', label: 'Retours', icon: 'fa-route' },
    { path: '/pillage', label: 'Pillages', icon: 'fa-coins' },
    { path: '/batiments', label: 'BuildGuide', icon: 'fa-hammer' },
    { path: '/simulation', label: 'Simu constru', icon: 'fa-helmet-safety' },
    { path: '/combat', label: 'Simu combat', icon: 'fa-khanda' },
    { path: '/secondes', label: 'Calcul seconde', icon: 'fa-stopwatch' },
    { path: '/proches', label: 'Qui est le plus proche', icon: 'fa-location-crosshairs' },
    { path: '/ennemis', label: 'infos enemis', icon: 'fa-user-secret' },
    { path: '/joueurs', label: 'MAJ joueurs', icon: 'fa-people-group' },
  ];

  protected readonly menuOpen = signal(false);

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
