import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'retour' },
  {
    path: 'retour',
    title: 'Calcul Retour',
    loadComponent: () => import('./features/travel/travel-page').then((m) => m.TravelPage),
  },
  {
    path: 'pillage',
    title: 'Pillage Ressources',
    loadComponent: () => import('./features/plunder/plunder-page').then((m) => m.PlunderPage),
  },
  {
    path: 'batiments',
    title: 'Guide Bâtiments',
    loadComponent: () => import('./features/buildings/buildings-page').then((m) => m.BuildingsPage),
  },
  {
    path: 'simulation',
    title: 'Simulation Construction',
    loadComponent: () => import('./features/simulation/simulation-page').then((m) => m.SimulationPage),
  },
  { path: '**', redirectTo: 'retour' },
];
