import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: string;
}

@Component({
  selector: 'app-segmented-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex bg-stone-950 p-1 rounded-xl border border-stone-800 flex-wrap gap-1">
      @for (option of options(); track option.id) {
        <button
          type="button"
          (click)="value.set(option.id)"
          [class]="value() === option.id ? 'bg-red-800 text-white shadow' : 'text-stone-400 hover:text-stone-200'"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center"
        >
          @if (option.icon) {
            <i class="fa-solid {{ option.icon }} mr-1.5 text-red-400"></i>
          }
          {{ option.label }}
        </button>
      }
    </div>
  `,
})
export class SegmentedControl<T extends string> {
  readonly options = input.required<readonly SegmentOption<T>[]>();
  readonly value = model.required<T>();
}
