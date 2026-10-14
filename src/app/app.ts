import { ChangeDetectionStrategy, Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased selection:bg-indigo-500 selection:text-white flex flex-col justify-between">
      <!-- En-tête -->
      <header class="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <i class="fa-solid fa-bolt text-white text-lg"></i>
            </div>
            <div>
              <h1 class="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Calculateur Stratégique</h1>
              <p class="text-xs text-slate-400">Calcul Retour, Pillage & Guide Complet des Bâtiments</p>
            </div>
          </div>

          <!-- Onglets de navigation -->
          <div class="flex items-center space-x-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/50 flex-wrap justify-center">
            <button (click)="activeTab.set('travel')" [class]="activeTab() === 'travel' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'" class="px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center">
              <i class="fa-solid fa-route mr-1.5"></i> Calcul Retour
            </button>
            <button (click)="activeTab.set('plunder')" [class]="activeTab() === 'plunder' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'" class="px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center">
              <i class="fa-solid fa-coins mr-1.5"></i> Pillage Ressources
            </button>
            <button (click)="activeTab.set('buildings')" [class]="activeTab() === 'buildings' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'" class="px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center">
              <i class="fa-solid fa-hammer mr-1.5"></i> Guide Bâtiments
            </button>
          </div>
        </div>
      </header>

      <!-- Contenu principal -->
      <main class="max-w-7xl mx-auto px-4 py-8 w-full flex-grow space-y-6">
        <!-- ONGLET 1: CALCUL RETOUR -->
        @if (activeTab() === 'travel') {
          <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-6">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 class="font-semibold text-slate-200 flex items-center">
                <i class="fa-solid fa-sliders text-indigo-400 mr-2"></i> Mode de calcul de la distance
              </h2>
              <div class="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button (click)="distanceMode.set('manual')" [class]="distanceMode() === 'manual' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer">
                  Saisie km directe
                </button>
                <button (click)="distanceMode.set('coords')" [class]="distanceMode() === 'coords' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer">
                  Coordonnées (Village 1 / 2)
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              @if (distanceMode() === 'manual') {
                <div>
                  <div class="flex justify-between items-center mb-2">
                    <label class="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                      <i class="fa-solid fa-route text-indigo-400 mr-1.5"></i> Distance à parcourir (km)
                    </label>
                    <span class="text-xs text-indigo-400 font-mono font-semibold">{{ distance() }} km</span>
                  </div>
                  <div class="relative">
                    <input type="number" step="0.5" min="0" [ngModel]="manualDistance()" (ngModelChange)="manualDistance.set($event)" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono" placeholder="Ex: 5">
                  </div>
                </div>
              } @else {
                <div class="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                  <div class="space-y-3">
                    <span class="text-xs font-bold text-indigo-300 block uppercase tracking-wider">Village 1 (Départ / Source)</span>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-[11px] text-slate-400 mb-1">Position X1</label>
                        <input type="number" [ngModel]="x1()" (ngModelChange)="x1.set($event)" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-sm focus:outline-none focus:border-indigo-500" placeholder="8194">
                      </div>
                      <div>
                        <label class="block text-[11px] text-slate-400 mb-1">Position Y1</label>
                        <input type="number" [ngModel]="y1()" (ngModelChange)="y1.set($event)" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-sm focus:outline-none focus:border-indigo-500" placeholder="-15">
                      </div>
                    </div>
                  </div>

                  <div class="space-y-3">
                    <span class="text-xs font-bold text-emerald-300 block uppercase tracking-wider">Village 2 (Cible / Arrivée)</span>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-[11px] text-slate-400 mb-1">Position X2</label>
                        <input type="number" [ngModel]="x2()" (ngModelChange)="x2.set($event)" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-sm focus:outline-none focus:border-indigo-500" placeholder="8199">
                      </div>
                      <div>
                        <label class="block text-[11px] text-slate-400 mb-1">Position Y2</label>
                        <input type="number" [ngModel]="y2()" (ngModelChange)="y2.set($event)" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-sm focus:outline-none focus:border-indigo-500" placeholder="-11">
                      </div>
                    </div>
                  </div>

                  <div class="sm:col-span-2 flex justify-between items-center bg-slate-900 px-4 py-3 rounded-xl border border-slate-800">
                    <span class="text-xs text-slate-300">Distance calculée (arrondie à X ou X,5) :</span>
                    <span class="font-mono font-bold text-indigo-400 text-sm">{{ distance() }} km</span>
                  </div>
                </div>
              }

              <div class="md:col-span-2">
                <div class="flex justify-between items-center mb-2">
                  <label class="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                    <i class="fa-solid fa-clock text-indigo-400 mr-1.5"></i> Heure d'Attaque (avec secondes)
                  </label>
                  <button (click)="setCurrentTime()" class="text-xs text-indigo-400 hover:text-indigo-300 underline transition cursor-pointer">
                    Maintenant
                  </button>
                </div>
                <div class="relative">
                  <input type="datetime-local" step="1" [ngModel]="departureTime()" (ngModelChange)="departureTime.set($event)" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-sm">
                </div>
                <div class="text-xs text-slate-500 mt-3">
                  * Vitesses officielles de déplacement par kilomètre (Niveaux 1 à 20).
                </div>
              </div>
            </div>
          </div>

          <!-- Tableau des résultats -->
          <div class="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-sm overflow-hidden">
            <div class="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 class="font-semibold text-slate-200 flex items-center">
                <i class="fa-solid fa-table-list text-indigo-400 mr-2"></i> Tableau Calcul Retour (Niveaux 1 à 20)
              </h2>
              <span class="text-xs text-slate-400 font-mono">Distance : {{ distance() || 0 }} km</span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider bg-slate-950/40">
                    <th class="py-3 px-5">Niveau du Centre</th>
                    <th class="py-3 px-5">Vitesse de déplacement / Km</th>
                    <th class="py-3 px-5">Heure de retour</th>
                    <th class="py-3 px-5 text-right">Heure de retour - ticket</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60 font-mono text-sm">
                  @for (item of computedLevelsResults(); track item.level) {
                    <tr [class]="item.level === 5 ? 'bg-indigo-950/40 border-l-4 border-indigo-500' : 'hover:bg-indigo-950/20 transition'">
                      <td class="py-3 px-5 font-bold text-indigo-300">
                        <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs mr-2">
                          {{ item.level }}
                        </span>
                        Niveau {{ item.level }}
                      </td>
                      <td class="py-3 px-5 text-slate-300">
                        {{ item.speedPerKmFormatted }}
                      </td>
                      <td class="py-3 px-5 font-bold text-emerald-400">
                        {{ item.arrivalTimeString }}
                        <span class="block text-xs font-normal text-slate-500">{{ item.arrivalDateString }}</span>
                      </td>
                      <td class="py-3 px-5 text-right font-bold text-violet-400">
                        {{ item.ticketArrivalTimeString }}
                        <span class="block text-xs font-normal text-slate-500">{{ item.ticketArrivalDateString }}</span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- ONGLET 2: PILLAGE RESSOURCES -->
        @if (activeTab() === 'plunder') {
          <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div class="md:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-5">
              <div class="border-b border-slate-800 pb-3">
                <h2 class="font-semibold text-slate-200 flex items-center">
                  <i class="fa-solid fa-users-gear text-indigo-400 mr-2"></i> Composition des Troupes
                </h2>
                <p class="text-xs text-slate-400 mt-1">Indiquez le nombre de combattants.</p>
              </div>

              <div>
                <div class="flex justify-between items-center mb-1.5">
                  <label class="text-xs font-medium text-slate-300 flex items-center">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2"></span> Genins <span class="text-slate-500 ml-1 text-[11px]">(cap: 13)</span>
                  </label>
                  <span class="text-xs font-mono text-emerald-400">{{ geninCount() * 13 | number }} max</span>
                </div>
                <input type="number" min="0" [ngModel]="geninCount()" (ngModelChange)="geninCount.set($event < 0 ? 0 : $event)" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-sm" placeholder="0">
              </div>

              <div>
                <div class="flex justify-between items-center mb-1.5">
                  <label class="text-xs font-medium text-slate-300 flex items-center">
                    <span class="w-2.5 h-2.5 rounded-full bg-blue-500 mr-2"></span> Chunins <span class="text-slate-500 ml-1 text-[11px]">(cap: 26)</span>
                  </label>
                  <span class="text-xs font-mono text-blue-400">{{ chuninCount() * 26 | number }} max</span>
                </div>
                <input type="number" min="0" [ngModel]="chuninCount()" (ngModelChange)="chuninCount.set($event < 0 ? 0 : $event)" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-sm" placeholder="0">
              </div>

              <div>
                <div class="flex justify-between items-center mb-1.5">
                  <label class="text-xs font-medium text-slate-300 flex items-center">
                    <span class="w-2.5 h-2.5 rounded-full bg-purple-500 mr-2"></span> Jounins <span class="text-slate-500 ml-1 text-[11px]">(cap: 53)</span>
                  </label>
                  <span class="text-xs font-mono text-purple-400">{{ jouninCount() * 53 | number }} max</span>
                </div>
                <input type="number" min="0" [ngModel]="jouninCount()" (ngModelChange)="jouninCount.set($event < 0 ? 0 : $event)" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-sm" placeholder="0">
              </div>

              <div class="pt-2">
                <button (click)="geninCount.set(0); chuninCount.set(0); jouninCount.set(0)" class="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs font-medium transition border border-slate-700 cursor-pointer">
                  Réinitialiser les troupes
                </button>
              </div>
            </div>

            <div class="md:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between space-y-6">
              <div>
                <div class="flex justify-between items-center border-b border-slate-800 pb-3 mb-6">
                  <h2 class="font-semibold text-slate-200 flex items-center">
                    <i class="fa-solid fa-boxes-stacked text-indigo-400 mr-2"></i> Capacité Totale de Pillage
                  </h2>
                  <span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-xl text-sm font-mono font-bold">
                    {{ totalPlunderCapacity() | number }} unités max
                  </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl">
                      <i class="fa-solid fa-mountain"></i>
                    </div>
                    <div>
                      <span class="text-xs text-slate-400 block uppercase tracking-wider font-medium">Pierre</span>
                      <span class="text-xl font-bold font-mono text-amber-300">{{ totalPlunderCapacity() | number }}</span>
                    </div>
                  </div>

                  <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl">
                      <i class="fa-solid fa-tree"></i>
                    </div>
                    <div>
                      <span class="text-xs text-slate-400 block uppercase tracking-wider font-medium">Bois</span>
                      <span class="text-xl font-bold font-mono text-emerald-300">{{ totalPlunderCapacity() | number }}</span>
                    </div>
                  </div>

                  <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-xl bg-slate-400/10 border border-slate-400/30 flex items-center justify-center text-slate-300 text-xl">
                      <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    <div>
                      <span class="text-xs text-slate-400 block uppercase tracking-wider font-medium">Fer</span>
                      <span class="text-xl font-bold font-mono text-slate-100">{{ totalPlunderCapacity() | number }}</span>
                    </div>
                  </div>

                  <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-xl">
                      <i class="fa-solid fa-bowl-food"></i>
                    </div>
                    <div>
                      <span class="text-xs text-slate-400 block uppercase tracking-wider font-medium">Nourriture</span>
                      <span class="text-xl font-bold font-mono text-rose-300">{{ totalPlunderCapacity() | number }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-3.5 text-xs text-indigo-300 flex items-center space-x-3">
                <i class="fa-solid fa-circle-info text-indigo-400 text-base"></i>
                <span>Formule : (Genin × 13) + (Chunin × 26) + (Jounin × 53) pour chaque ressource.</span>
              </div>
            </div>
          </div>
        }

        <!-- ONGLET 3: CONSTRUCTIONS & BATIMENTS -->
        @if (activeTab() === 'buildings') {
          <div class="space-y-6">
            <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
              <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 class="font-semibold text-slate-200 text-lg flex items-center">
                    <i class="fa-solid fa-hammer text-indigo-400 mr-2.5"></i> Guide des Bâtiments & Structures
                  </h2>
                  <p class="text-xs text-slate-400 mt-1">Données officielles tirées des grilles de coûts, temps et prérequis.</p>
                </div>

                <!-- Sélecteur de sous-tableaux -->
                <div class="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex-wrap gap-1">
                  <button (click)="subTable.set('depot')" [class]="subTable() === 'depot' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center">
                    <i class="fa-solid fa-bowl-food mr-1.5 text-rose-400"></i> Dépôt Nourriture
                  </button>
                  <button (click)="subTable.set('reserve')" [class]="subTable() === 'reserve' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center">
                    <i class="fa-solid fa-box-archive mr-1.5 text-amber-400"></i> Réserve
                  </button>
                  <button (click)="subTable.set('rapaces')" [class]="subTable() === 'rapaces' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center">
                    <i class="fa-solid fa-feather mr-1.5 text-emerald-400"></i> Élevage Rapaces
                  </button>
                  <button (click)="subTable.set('conseil')" [class]="subTable() === 'conseil' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center">
                    <i class="fa-solid fa-building-columns mr-1.5 text-violet-400"></i> Haut Conseil
                  </button>
                  <button (click)="subTable.set('recrutement')" [class]="subTable() === 'recrutement' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center">
                    <i class="fa-solid fa-user-plus mr-1.5 text-sky-400"></i> Recrutement
                  </button>
                </div>
              </div>

              <!-- TABLEAU: DEPOT DE NOURRITURE -->
              @if (subTable() === 'depot') {
                <div class="mt-6 overflow-x-auto">
                  <div class="flex justify-between items-center mb-3">
                    <h3 class="text-sm font-bold text-rose-300 flex items-center">
                      <i class="fa-solid fa-bowl-food mr-2"></i> Dépôt de nourriture (Niveaux 1 à 20)
                    </h3>
                    <span class="text-xs text-slate-400">Capacité & Coûts de passage</span>
                  </div>
                  <table class="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr class="border-b border-slate-800 text-slate-400 uppercase bg-slate-950/60">
                        <th class="py-3 px-3">Niveau</th>
                        <th class="py-3 px-3 text-emerald-400">Capacité</th>
                        <th class="py-3 px-3">Temps de construction</th>
                        <th class="py-3 px-3 text-center">Habitants</th>
                        <th class="py-3 px-3 text-amber-300">Pierre</th>
                        <th class="py-3 px-3 text-emerald-300">Bois</th>
                        <th class="py-3 px-3 text-slate-300">Fer</th>
                        <th class="py-3 px-3 text-rose-300 text-right">Nourriture</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/60">
                      @for (row of depotData; track row.niveau) {
                        <tr class="hover:bg-indigo-950/20 transition">
                          <td class="py-2.5 px-3 font-bold text-indigo-300">Niv {{ row.niveau }}</td>
                          <td class="py-2.5 px-3 font-bold text-emerald-400">{{ row.capacite }}</td>
                          <td class="py-2.5 px-3 text-slate-300">{{ row.temps }}</td>
                          <td class="py-2.5 px-3 text-center text-slate-400">{{ row.habitants }}</td>
                          <td class="py-2.5 px-3 text-amber-300/90">{{ row.pierre }}</td>
                          <td class="py-2.5 px-3 text-emerald-300/90">{{ row.bois }}</td>
                          <td class="py-2.5 px-3 text-slate-300/90">{{ row.fer }}</td>
                          <td class="py-2.5 px-3 text-rose-300/90 text-right">{{ row.nourriture }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              <!-- TABLEAU: RESERVE -->
              @if (subTable() === 'reserve') {
                <div class="mt-6 overflow-x-auto">
                  <div class="flex justify-between items-center mb-3">
                    <h3 class="text-sm font-bold text-amber-300 flex items-center">
                      <i class="fa-solid fa-box-archive mr-2"></i> Réserve (Niveaux 1 à 20)
                    </h3>
                    <span class="text-xs text-slate-400">Capacité & Coûts de passage</span>
                  </div>
                  <table class="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr class="border-b border-slate-800 text-slate-400 uppercase bg-slate-950/60">
                        <th class="py-3 px-3">Niveau</th>
                        <th class="py-3 px-3 text-emerald-400">Capacité</th>
                        <th class="py-3 px-3">Temps de construction</th>
                        <th class="py-3 px-3 text-center">Habitants</th>
                        <th class="py-3 px-3 text-amber-300">Pierre</th>
                        <th class="py-3 px-3 text-emerald-300">Bois</th>
                        <th class="py-3 px-3 text-slate-300">Fer</th>
                        <th class="py-3 px-3 text-rose-300 text-right">Nourriture</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/60">
                      @for (row of reserveData; track row.niveau) {
                        <tr class="hover:bg-indigo-950/20 transition">
                          <td class="py-2.5 px-3 font-bold text-indigo-300">Niv {{ row.niveau }}</td>
                          <td class="py-2.5 px-3 font-bold text-emerald-400">{{ row.capacite }}</td>
                          <td class="py-2.5 px-3 text-slate-300">{{ row.temps }}</td>
                          <td class="py-2.5 px-3 text-center text-slate-400">{{ row.habitants }}</td>
                          <td class="py-2.5 px-3 text-amber-300/90">{{ row.pierre }}</td>
                          <td class="py-2.5 px-3 text-emerald-300/90">{{ row.bois }}</td>
                          <td class="py-2.5 px-3 text-slate-300/90">{{ row.fer }}</td>
                          <td class="py-2.5 px-3 text-rose-300/90 text-right">{{ row.nourriture }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              <!-- TABLEAU: ELEVAGE DE RAPACES -->
              @if (subTable() === 'rapaces') {
                <div class="mt-6 overflow-x-auto">
                  <div class="flex justify-between items-center mb-3">
                    <h3 class="text-sm font-bold text-emerald-300 flex items-center">
                      <i class="fa-solid fa-feather mr-2"></i> Elevage de Rapaces (Niveaux 1 à 5)
                    </h3>
                    <span class="text-xs text-slate-400">Exigences & Coûts de passage</span>
                  </div>
                  <table class="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr class="border-b border-slate-800 text-slate-400 uppercase bg-slate-950/60">
                        <th class="py-3 px-4">Niveau du Centre</th>
                        <th class="py-3 px-4">Temps de construction</th>
                        <th class="py-3 px-4 text-center">Habitants</th>
                        <th class="py-3 px-4 text-amber-300">Pierre</th>
                        <th class="py-3 px-4 text-emerald-300">Bois</th>
                        <th class="py-3 px-4 text-slate-300">Fer</th>
                        <th class="py-3 px-4 text-rose-300 text-right">Nourriture</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/60">
                      @for (row of rapacesData; track row.niveau) {
                        <tr class="hover:bg-indigo-950/20 transition">
                          <td class="py-3 px-4 font-bold text-indigo-300">Niveau {{ row.niveau }}</td>
                          <td class="py-3 px-4 text-slate-300">{{ row.temps }}</td>
                          <td class="py-3 px-4 text-center text-slate-400">{{ row.habitants }}</td>
                          <td class="py-3 px-4 text-amber-300/90">{{ row.pierre }}</td>
                          <td class="py-3 px-4 text-emerald-300/90">{{ row.bois }}</td>
                          <td class="py-3 px-4 text-slate-300/90">{{ row.fer }}</td>
                          <td class="py-3 px-4 text-rose-300/90 text-right">{{ row.nourriture }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              <!-- TABLEAU: HAUT CONSEIL -->
              @if (subTable() === 'conseil') {
                <div class="mt-6 overflow-x-auto">
                  <div class="flex justify-between items-center mb-3">
                    <h3 class="text-sm font-bold text-violet-300 flex items-center">
                      <i class="fa-solid fa-building-columns mr-2"></i> Haut Conseil (Niveaux 1 à 20)
                    </h3>
                    <span class="text-xs text-slate-400">Membres disponibles & Coûts</span>
                  </div>
                  <table class="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr class="border-b border-slate-800 text-slate-400 uppercase bg-slate-950/60">
                        <th class="py-3 px-3">Niveau du Centre</th>
                        <th class="py-3 px-3 text-violet-400">Membres dispo</th>
                        <th class="py-3 px-3">Temps de construction</th>
                        <th class="py-3 px-3 text-center">Habitants</th>
                        <th class="py-3 px-3 text-amber-300">Pierre</th>
                        <th class="py-3 px-3 text-emerald-300">Bois</th>
                        <th class="py-3 px-3 text-slate-300">Fer</th>
                        <th class="py-3 px-3 text-rose-300 text-right">Nourriture</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/60">
                      @for (row of conseilData; track row.niveau) {
                        <tr class="hover:bg-indigo-950/20 transition">
                          <td class="py-2.5 px-3 font-bold text-indigo-300">Niveau {{ row.niveau }}</td>
                          <td class="py-2.5 px-3 font-bold text-violet-400">{{ row.membres }}</td>
                          <td class="py-2.5 px-3 text-slate-300">{{ row.temps }}</td>
                          <td class="py-2.5 px-3 text-center text-slate-400">{{ row.habitants }}</td>
                          <td class="py-2.5 px-3 text-amber-300/90">{{ row.pierre }}</td>
                          <td class="py-2.5 px-3 text-emerald-300/90">{{ row.bois }}</td>
                          <td class="py-2.5 px-3 text-slate-300/90">{{ row.fer }}</td>
                          <td class="py-2.5 px-3 text-rose-300/90 text-right">{{ row.nourriture }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              <!-- TABLEAU: CENTRE DE RECRUTEMENT -->
              @if (subTable() === 'recrutement') {
                <div class="mt-6 overflow-x-auto">
                  <div class="flex justify-between items-center mb-3">
                    <h3 class="text-sm font-bold text-sky-300 flex items-center">
                      <i class="fa-solid fa-user-plus mr-2"></i> Centre de Recrutement (Niveaux 1 à 20)
                    </h3>
                    <span class="text-xs text-slate-400">Vitesse & Coûts</span>
                  </div>
                  <table class="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr class="border-b border-slate-800 text-slate-400 uppercase bg-slate-950/60">
                        <th class="py-3 px-3">Niveau</th>
                        <th class="py-3 px-3 text-sky-400">Réduction Temps</th>
                        <th class="py-3 px-3">Temps de construction</th>
                        <th class="py-3 px-3 text-center">Habitants</th>
                        <th class="py-3 px-3 text-amber-300">Pierre</th>
                        <th class="py-3 px-3 text-emerald-300">Bois</th>
                        <th class="py-3 px-3 text-slate-300">Fer</th>
                        <th class="py-3 px-3 text-rose-300 text-right">Nourriture</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/60">
                      @for (row of recrutementData; track row.niveau) {
                        <tr class="hover:bg-indigo-950/20 transition">
                          <td class="py-2.5 px-3 font-bold text-indigo-300">Niv {{ row.niveau }}</td>
                          <td class="py-2.5 px-3 font-bold text-sky-400">{{ row.bonus }}</td>
                          <td class="py-2.5 px-3 text-slate-300">{{ row.temps }}</td>
                          <td class="py-2.5 px-3 text-center text-slate-400">{{ row.habitants }}</td>
                          <td class="py-2.5 px-3 text-amber-300/90">{{ row.pierre }}</td>
                          <td class="py-2.5 px-3 text-emerald-300/90">{{ row.bois }}</td>
                          <td class="py-2.5 px-3 text-slate-300/90">{{ row.fer }}</td>
                          <td class="py-2.5 px-3 text-rose-300/90 text-right">{{ row.nourriture }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        }
      </main>

      <footer class="border-t border-slate-800 py-4 text-center text-xs text-slate-500 bg-slate-900/40">
        <p>Calculateur Stratégique & Guide des Bâtiments</p>
      </footer>
    </div>
  `
})
export class App implements OnInit {
  activeTab = signal<string>('travel');
  subTable = signal<string>('depot');

  distanceMode = signal<'manual' | 'coords'>('manual');
  manualDistance = signal<number>(5.0);
  
  x1 = signal<number>(8194);
  y1 = signal<number>(-15);
  x2 = signal<number>(8199);
  y2 = signal<number>(-11);

  departureTime = signal<string>('');

  geninCount = signal<number>(0);
  chuninCount = signal<number>(0);
  jouninCount = signal<number>(0);

  distance = computed(() => {
    let rawDist = 0;
    if (this.distanceMode() === 'manual') {
      rawDist = Number(this.manualDistance()) || 0;
    } else {
      const dx = (Number(this.x2()) || 0) - (Number(this.x1()) || 0);
      const dy = (Number(this.y2()) || 0) - (Number(this.y1()) || 0);
      rawDist = Math.sqrt(dx * dx + dy * dy);
    }
    const rounded = Math.round(rawDist * 2) / 2;
    return Number(rounded.toFixed(1));
  });

  totalPlunderCapacity = computed(() => {
    const g = Number(this.geninCount()) || 0;
    const c = Number(this.chuninCount()) || 0;
    const j = Number(this.jouninCount()) || 0;
    return (g * 13) + (c * 26) + (j * 53);
  });

  computedLevelsResults = computed(() => {
    const dist = Number(this.distance()) || 0;
    const startMs = this.departureTime() ? new Date(this.departureTime()).getTime() : Date.now();

    const exactData = [
      { level: 1, min: 3, sec: 17, cs: 82 },
      { level: 2, min: 3, sec: 7, cs: 41 },
      { level: 3, min: 2, sec: 57, cs: 0 },
      { level: 4, min: 2, sec: 46, cs: 59 },
      { level: 5, min: 2, sec: 36, cs: 18 },
      { level: 6, min: 2, sec: 25, cs: 76 },
      { level: 7, min: 2, sec: 15, cs: 35 },
      { level: 8, min: 2, sec: 4, cs: 94 },
      { level: 9, min: 1, sec: 54, cs: 53 },
      { level: 10, min: 1, sec: 44, cs: 12 },
      { level: 11, min: 1, sec: 33, cs: 71 },
      { level: 12, min: 1, sec: 23, cs: 29 },
      { level: 13, min: 1, sec: 12, cs: 88 },
      { level: 14, min: 1, sec: 2, cs: 47 },
      { level: 15, min: 0, sec: 52, cs: 6 },
      { level: 16, min: 0, sec: 41, cs: 65 },
      { level: 17, min: 0, sec: 31, cs: 24 },
      { level: 18, min: 0, sec: 20, cs: 82 },
      { level: 19, min: 0, sec: 10, cs: 41 },
      { level: 20, min: 0, sec: 5, cs: 0 }
    ];

    return exactData.map(item => {
      const secondsPerKm = (item.min * 60) + item.sec + (item.cs / 100);
      const totalSeconds = dist * secondsPerKm;
      const ticketTotalSeconds = totalSeconds / 2;

      const mStr = String(item.min).padStart(2, '0');
      const sStr = String(item.sec).padStart(2, '0');
      const csStr = String(item.cs).padStart(2, '0');
      const speedPerKmFormatted = `${mStr}:${sStr},${csStr}`;

      const arrivalMs = startMs + (totalSeconds * 1000);
      const arrivalDate = new Date(arrivalMs);
      const arrivalTimeString = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const arrivalDateString = arrivalDate.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

      const ticketArrivalMs = startMs + (ticketTotalSeconds * 1000);
      const ticketArrivalDate = new Date(ticketArrivalMs);
      const ticketArrivalTimeString = ticketArrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const ticketArrivalDateString = ticketArrivalDate.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

      return {
        level: item.level,
        speedPerKmFormatted,
        arrivalTimeString,
        arrivalDateString,
        ticketArrivalTimeString,
        ticketArrivalDateString
      };
    });
  });

  depotData = [
    { niveau: 1, capacite: '900', temps: '55 sec', habitants: 2, pierre: '60', bois: '75', fer: '40', nourriture: '55' },
    { niveau: 2, capacite: '1 305', temps: '4 min', habitants: 2, pierre: '124', bois: '155', fer: '82', nourriture: '114' },
    { niveau: 3, capacite: '1 827', temps: '10 min', habitants: 2, pierre: '510', bois: '510', fer: '166', nourriture: '235' },
    { niveau: 4, capacite: '2 400', temps: '22 min', habitants: 2, pierre: '910', bois: '910', fer: '339', nourriture: '510' },
    { niveau: 5, capacite: '3 208', temps: '41 min', habitants: 3, pierre: '1 310', bois: '1 357', fer: '691', nourriture: '1 008' },
    { niveau: 6, capacite: '4 098', temps: '1 h 9 min', habitants: 3, pierre: '1 830', bois: '1 830', fer: '910', nourriture: '1 310' },
    { niveau: 7, capacite: '5 010', temps: '1 h 56 min', habitants: 3, pierre: '2 470', bois: '2 470', fer: '1 310', nourriture: '1 830' },
    { niveau: 8, capacite: '6 283', temps: '3 h 15 min', habitants: 3, pierre: '3 210', bois: '3 210', fer: '1 830', nourriture: '2 410' },
    { niveau: 9, capacite: '7 829', temps: '5 h 30 min', habitants: 3, pierre: '4 100', bois: '4 100', fer: '2 470', nourriture: '3 210' },
    { niveau: 10, capacite: '9 786', temps: '11 h', habitants: 3, pierre: '5 020', bois: '5 020', fer: '3 210', nourriture: '4 100' }
  ];

  reserveData = [
    { niveau: 1, capacite: '201', temps: '3 min', habitants: 2, pierre: '70', bois: '80', fer: '45', nourriture: '40' },
    { niveau: 2, capacite: '303', temps: '4 min 31 s', habitants: 2, pierre: '142', bois: '163', fer: '92', nourriture: '81' },
    { niveau: 3, capacite: '435', temps: '6 min 49 s', habitants: 2, pierre: '288', bois: '510', fer: '190', nourriture: '164' },
    { niveau: 4, capacite: '609', temps: '10 min 16 s', habitants: 2, pierre: '585', bois: '910', fer: '390', nourriture: '333' },
    { niveau: 5, capacite: '822', temps: '15 min 27 s', habitants: 3, pierre: '1 186', bois: '1 371', fer: '802', nourriture: '675' }
  ];

  rapacesData = [
    { niveau: 1, temps: '1 min 12 s', habitants: 2, pierre: '140', bois: '160', fer: '155', nourriture: '105' },
    { niveau: 2, temps: '1 min 50 s', habitants: 3, pierre: '241', bois: '275', fer: '268', nourriture: '182' },
    { niveau: 3, temps: '3 min', habitants: 3, pierre: '416', bois: '510', fer: '510', nourriture: '315' },
    { niveau: 4, temps: '4 min 54 s', habitants: 4, pierre: '717', bois: '910', fer: '910', nourriture: '546' },
    { niveau: 5, temps: '8 min', habitants: 4, pierre: '1 235', bois: '1 397', fer: '1 375', nourriture: '945' }
  ];

  conseilData = [
    { niveau: 1, membres: '0', temps: '1 min', habitants: 2, pierre: '180', bois: '200', fer: '140', nourriture: '110' },
    { niveau: 2, membres: '0', temps: '4 min 50s', habitants: 2, pierre: '900', bois: '900', fer: '510', nourriture: '198' },
    { niveau: 3, membres: '0', temps: '8 min 54s', habitants: 2, pierre: '1 305', bois: '1 305', fer: '910', nourriture: '510' }
  ];

  recrutementData = [
    { niveau: 1, bonus: '100%', temps: '2 min', habitants: 2, pierre: '150', bois: '180', fer: '100', nourriture: '90' },
    { niveau: 2, bonus: '90%', temps: '4 min', habitants: 2, pierre: '310', bois: '372', fer: '206', nourriture: '186' },
    { niveau: 3, bonus: '81%', temps: '9 min', habitants: 2, pierre: '641', bois: '769', fer: '427', nourriture: '385' }
  ];

  ngOnInit(): void {
    this.setCurrentTime();
  }

  setCurrentTime(): void {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 19);
    this.departureTime.set(localISOTime);
  }
}