import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Card } from '../../shared/ui/card';
import { DataTable } from '../../shared/ui/data-table';
import { SegmentedControl, SegmentOption } from '../../shared/ui/segmented-control';
import { BUILDING_GUIDES, BuildingId } from './buildings.guides';

@Component({
  selector: 'app-buildings-page',
  imports: [Card, DataTable, SegmentedControl],
  templateUrl: './buildings-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildingsPage {
  protected readonly options: readonly SegmentOption<BuildingId>[] = BUILDING_GUIDES.map(
    ({ id, label, icon }) => ({ id, label, icon }),
  );

  protected readonly selectedId = signal<BuildingId>('hq');
  protected readonly guide = computed(() => BUILDING_GUIDES.find((g) => g.id === this.selectedId())!);
}
