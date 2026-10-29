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
  {
    path: 'combat',
    title: 'Simulation de Combat',
    loadComponent: () => import('./features/combat/combat-page').then((m) => m.CombatPage),
  },
  {
    path: 'secondes',
    title: 'Calcul seconde',
    loadComponent: () => import('./features/production/production-page').then((m) => m.ProductionPage),
  },
  {
    path: 'proches',
    title: 'Qui est le plus proche',
    loadComponent: () => import('./features/nearest/nearest-page').then((m) => m.NearestPage),
  },
  {
    path: 'ennemis',
    title: 'Infos Ennemis',
    loadComponent: () => import('./features/enemies/enemies-page').then((m) => m.EnemiesPage),
  },
  {
    path: 'joueurs',
    title: 'MAJ joueurs',
    loadComponent: () => import('./features/players-update/players-update-page').then((m) => m.PlayersUpdatePage),
  },
  { path: '**', redirectTo: 'retour' },
];
