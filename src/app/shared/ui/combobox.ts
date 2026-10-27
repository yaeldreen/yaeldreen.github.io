import { ChangeDetectionStrategy, Component, computed, input, model, OnDestroy, signal } from '@angular/core';

export interface ComboboxOption {
  value: string;
  /** Texte secondaire affiché à droite (et cherché aussi). */ hint?: string;
}

const MAX_SHOWN = 50;

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Champ texte avec liste de suggestions filtrée pendant la saisie.
 * Remplace `<datalist>`, mal pris en charge sur iPhone : la liste est dessinée par la page elle-même.
 */
@Component({
  selector: 'app-combobox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <input
        type="text"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        [value]="value()"
        [placeholder]="placeholder()"
        (input)="onInput($any($event.target).value)"
        (focus)="open.set(true)"
        (blur)="closeSoon()"
        (keydown)="onKey($event)"
        class="w-full bg-stone-950 border border-stone-700 rounded-xl px-4 py-2.5 text-stone-100 text-sm focus:outline-none focus:border-red-700"
      />
      @if (open() && matches().length) {
        <ul class="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-stone-900 border border-stone-700 rounded-xl shadow-xl py-1">
          @for (option of matches(); track option.value; let i = $index) {
            <li>
              <button
                type="button"
                (mousedown)="$event.preventDefault()"
                (click)="pick(option.value)"
                class="w-full text-left px-4 py-2.5 text-sm flex justify-between gap-3 cursor-pointer hover:bg-red-950/40"
                [class.bg-red-950]="i === active()"
              >
                <span class="text-stone-100 truncate">{{ option.value }}</span>
                @if (option.hint) {
                  <span class="text-stone-500 text-xs truncate">{{ option.hint }}</span>
                }
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class Combobox implements OnDestroy {
  readonly value = model('');
  readonly options = input.required<readonly ComboboxOption[]>();
  readonly placeholder = input('');

  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  /** Options contenant le texte saisi (dans la valeur ou l'indication), accents et casse ignorés. */
  protected readonly matches = computed(() => {
    const query = norm(this.value());
    const found = query
      ? this.options().filter((o) => norm(o.value).includes(query) || norm(o.hint ?? '').includes(query))
      : this.options();
    return found.slice(0, MAX_SHOWN);
  });

  protected onInput(text: string): void {
    this.value.set(text);
    this.open.set(true);
    this.active.set(-1);
  }

  protected pick(value: string): void {
    clearTimeout(this.closeTimer);
    this.value.set(value);
    this.open.set(false);
  }

  /** Laisse le temps au toucher sur une suggestion d'arriver avant de fermer la liste (mobile). */
  protected closeSoon(): void {
    this.closeTimer = setTimeout(() => this.open.set(false), 200);
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.matches().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open.set(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.set(count ? (this.active() + step + count) % count : -1);
    } else if (event.key === 'Enter' && this.open() && this.active() >= 0) {
      event.preventDefault();
      this.pick(this.matches()[this.active()].value);
    } else if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.closeTimer);
  }
}
