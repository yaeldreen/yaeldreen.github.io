import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-number-input',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      type="number"
      [attr.min]="min() ?? null"
      [attr.max]="max() ?? null"
      [attr.step]="step()"
      [placeholder]="placeholder()"
      [ngModel]="value()"
      (ngModelChange)="value.set($event)"
      class="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 font-mono text-sm focus:outline-none focus:border-indigo-500"
    />
  `,
})
export class NumberInput {
  /** `null` quand le champ est vidé : à l'appelant de le traiter comme 0. */
  readonly value = model<number | null>(null);
  readonly min = input<number>();
  readonly max = input<number>();
  readonly step = input(1);
  readonly placeholder = input('');
}
