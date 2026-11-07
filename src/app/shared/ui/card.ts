import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Conteneur visuel commun. Ajoutez padding/espacement via `class` sur <app-card>. */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block card-frame bg-stone-900/85 border border-stone-800 border-t-or-600/50 rounded-2xl backdrop-blur-sm' },
  template: `<ng-content />`,
})
export class Card {}
