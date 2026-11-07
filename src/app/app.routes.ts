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
    path: 'raz',
    title: 'Simu raz',
    loadComponent: () => import('./features/raz/raz-page').then((m) => m.RazPage),
  },
  {
    path: 'secondes',
    title: 'Calcul seconde',
    loadComponent: () => import('./features/production/production-page').then((m) => m.ProductionPage),
  },
  {
    path: 'radar',
    title: 'Radar du jeu',
    loadComponent: () => import('./features/radar/radar-page').then((m) => m.RadarPage),
  },
  {
    path: 'ennemis',
    title: 'Infos Ennemis',
    loadComponent: () => import('./features/enemies/enemies-page').then((m) => m.EnemiesPage),
  },
  {
    path: 'joueur',
    title: 'Fiche joueur',
    loadComponent: () => import('./features/player/player-page').then((m) => m.PlayerPage),
  },
  {
    path: 'joueurs',
    title: 'MAJ joueurs',
    loadComponent: () => import('./features/players-update/players-update-page').then((m) => m.PlayersUpdatePage),
  },
  { path: '**', redirectTo: 'retour' },
];
