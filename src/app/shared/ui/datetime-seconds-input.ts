import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';

const pad = (n: number): string => String(n).padStart(2, '0');
const MAX = [23, 59, 59] as const;
const LABELS = ['heures', 'minutes', 'secondes'] as const;

/**
 * Date + heure à la seconde ("YYYY-MM-DDTHH:MM:SS", heure locale).
 * Remplace `<input type="datetime-local" step="1">`, dont le sélecteur iPhone ne propose pas les secondes :
 * un champ date, puis trois cases heures / minutes / secondes au clavier numérique.
 */
@Component({
  selector: 'app-datetime-seconds-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-2">
      <input
        type="date"
        [value]="date()"
        (change)="setDate($any($event.target).value)"
        aria-label="Date"
        class="flex-1 min-w-36 bg-stone-950 border border-stone-700 rounded-xl px-3 py-3 text-stone-100 focus:outline-none focus:border-red-700 font-mono text-sm"
      />
      <div class="flex items-center gap-1 font-mono text-sm">
        @for (part of parts(); track $index; let i = $index) {
          @if (i > 0) {
            <span class="text-stone-500">:</span>
          }
          <input
            #box
            type="text"
            inputmode="numeric"
            maxlength="2"
            autocomplete="off"
            [value]="part"
            [attr.aria-label]="labels[i]"
            (focus)="box.select()"
            (input)="onInput(i, box, $any(box.nextElementSibling?.nextElementSibling))"
            (blur)="commit(i, box)"
            class="w-12 text-center bg-stone-950 border border-stone-700 rounded-xl px-1 py-3 text-stone-100 focus:outline-none focus:border-red-700"
          />
        }
      </div>
    </div>
  `,
})
export class DateTimeSecondsInput {
  readonly value = model.required<string>();
  protected readonly labels = LABELS;

  protected readonly date = computed(() => this.value().slice(0, 10));
  private readonly time = computed(() => {
    const [h, m, s] = this.value().slice(11, 19).split(':').map((v) => Number(v) || 0);
    return [h ?? 0, m ?? 0, s ?? 0];
  });
  protected readonly parts = computed(() => this.time().map(pad));

  protected setDate(date: string): void {
    if (!date) return;
    this.value.set(`${date}T${this.parts().join(':')}`);
  }

  /** Deux chiffres saisis : on enregistre et on passe à la case suivante. */
  protected onInput(index: number, box: HTMLInputElement, next: HTMLInputElement | null): void {
    box.value = box.value.replace(/\D/g, '').slice(0, 2);
    if (box.value.length < 2) return;
    this.commit(index, box);
    if (next instanceof HTMLInputElement) next.focus();
  }

  protected commit(index: number, box: HTMLInputElement): void {
    const digits = box.value.replace(/\D/g, '');
    box.value = this.parts()[index];
    if (!digits) return;
    const time = [...this.time()];
    time[index] = Math.min(MAX[index], Number(digits));
    box.value = pad(time[index]);
    this.value.set(`${this.date()}T${time.map(pad).join(':')}`);
  }
}
