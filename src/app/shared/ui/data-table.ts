import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface Column<T> {
  header: string;
  headerClass?: string;
  cellClass?: string;
  // Syntaxe "méthode" volontaire : permet d'affecter un Column<Sous-type> à un Column<Type>.
  value(row: T): string | number;
}

@Component({
  selector: 'app-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse font-mono text-xs">
        <thead>
          <tr class="border-b border-slate-800 text-slate-400 uppercase bg-slate-950/60">
            @for (col of columns(); track col.header) {
              <th class="py-3 px-3" [class]="col.headerClass ?? ''">{{ col.header }}</th>
            }
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          @for (row of rows(); track row.level) {
            <tr class="hover:bg-indigo-950/20 transition">
              @for (col of columns(); track col.header) {
                <td class="py-2.5 px-3" [class]="col.cellClass ?? ''">{{ col.value(row) }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class DataTable<T extends { level: number }> {
  readonly columns = input.required<readonly Column<T>[]>();
  readonly rows = input.required<readonly T[]>();
}
