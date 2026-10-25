import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

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
})
export class App {
  protected readonly tabs: readonly NavTab[] = [
    { path: '/retour', label: 'Calcul Retour', icon: 'fa-route' },
    { path: '/pillage', label: 'Pillage Ressources', icon: 'fa-coins' },
    { path: '/batiments', label: 'Guide Bâtiments', icon: 'fa-hammer' },
    { path: '/simulation', label: 'Simulation Construction', icon: 'fa-helmet-safety' },
    { path: '/combat', label: 'Simulation de Combat', icon: 'fa-khanda' },
    { path: '/ennemis', label: 'Infos Ennemis', icon: 'fa-user-secret' },
  ];
}
