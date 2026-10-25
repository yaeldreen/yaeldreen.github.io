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
    { path: '/retour', label: 'Retours', icon: 'fa-route' },
    { path: '/pillage', label: 'Pillages', icon: 'fa-coins' },
    { path: '/batiments', label: 'BuildGuide', icon: 'fa-hammer' },
    { path: '/simulation', label: 'Simu constru', icon: 'fa-helmet-safety' },
    { path: '/combat', label: 'Simu combat', icon: 'fa-khanda' },
    { path: '/ennemis', label: 'infos enemis', icon: 'fa-user-secret' },
  ];
}
