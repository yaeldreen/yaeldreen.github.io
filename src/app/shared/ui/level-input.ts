import { ChangeDetectionStrategy, Component, computed, input, model, OnDestroy, signal } from '@angular/core';

/**
 * Niveau de bâtiment : liste déroulante des niveaux possibles, ou saisie directe au clavier.
 * Le texte saisi filtre la liste ; la valeur est ramenée entre `min` et `max` en quittant le champ.
 */
@Component({
  selector: 'app-level-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <input
        type="text"
        inputmode="numeric"
        autocomplete="off"
        [value]="value() ?? ''"
        [placeholder]="placeholder()"
        (input)="onInput($any($event.target).value)"
        (focus)="open.set(true)"
        (blur)="closeSoon()"
        (keydown)="onKey($event)"
        class="w-full bg-stone-950 border border-stone-700 rounded-xl pl-4 pr-9 py-2.5 text-stone-100 font-mono text-sm focus:outline-none focus:border-red-700"
      />
      <button
        type="button"
        tabindex="-1"
        (mousedown)="$event.preventDefault()"
        (click)="open.set(!open())"
        aria-label="Choisir un niveau"
        class="absolute inset-y-0 right-0 w-9 flex items-center justify-center text-stone-500 hover:text-stone-200 cursor-pointer"
      >
        ▾
      </button>
      @if (open() && levels().length) {
        <ul class="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-stone-900 border border-stone-700 rounded-xl shadow-xl py-1">
          @for (level of levels(); track level; let i = $index) {
            <li>
              <button
                type="button"
                (mousedown)="$event.preventDefault()"
                (click)="pick(level)"
                class="w-full text-left px-4 py-2 text-sm font-mono cursor-pointer hover:bg-red-950/40"
                [class.bg-red-950]="i === active()"
                [class.text-red-300]="level === value()"
                [class.text-stone-100]="level !== value()"
              >
                {{ level }}
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class LevelInput implements OnDestroy {
  /** `null` quand le champ est vide. */
  readonly value = model<number | null>(null);
  readonly min = input(0);
  readonly max = input(20);
  readonly placeholder = input('');

  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  /** Vrai tant que l'utilisateur tape : la liste est alors filtrée par le début du nombre. */
  private readonly typing = signal(false);
  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly levels = computed(() => {
    const all = Array.from({ length: Math.max(0, this.max() - this.min() + 1) }, (_, i) => this.min() + i);
    const typed = this.value();
    return this.typing() && typed !== null ? all.filter((l) => String(l).startsWith(String(typed))) : all;
  });

  protected onInput(text: string): void {
    const digits = text.replace(/\D/g, '');
    this.value.set(digits ? Number(digits) : null);
    this.typing.set(true);
    this.open.set(true);
    this.active.set(-1);
  }

  protected pick(level: number): void {
    clearTimeout(this.closeTimer);
    this.value.set(level);
    this.typing.set(false);
    this.open.set(false);
  }

  /** Laisse le temps au toucher sur un niveau d'arriver avant de fermer la liste (mobile). */
  protected closeSoon(): void {
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      this.open.set(false);
      this.typing.set(false);
      const v = this.value();
      if (v !== null) this.value.set(Math.min(this.max(), Math.max(this.min(), v)));
    }, 200);
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.levels().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open.set(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active.set(count ? (this.active() + step + count) % count : -1);
    } else if (event.key === 'Enter' && this.open() && this.active() >= 0) {
      event.preventDefault();
      this.pick(this.levels()[this.active()]);
    } else if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.closeTimer);
  }
}
