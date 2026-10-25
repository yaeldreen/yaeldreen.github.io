import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Conteneur visuel commun. Ajoutez padding/espacement via `class` sur <app-card>. */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block bg-stone-900/80 border border-stone-800 rounded-2xl shadow-xl backdrop-blur-sm' },
  template: `<ng-content />`,
})
export class Card {}
