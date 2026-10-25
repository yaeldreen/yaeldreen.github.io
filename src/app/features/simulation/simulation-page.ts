import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RESOURCES } from '../../core/game-data/resources';
import { Card } from '../../shared/ui/card';
import { NumberInput } from '../../shared/ui/number-input';
import { formatDuration, formatNumber } from '../../shared/utils/format';
import { BUILDING_GUIDES, BuildingId } from '../buildings/buildings.guides';
import { simulateUpgrades } from './simulation.logic';

const DEPOT_MAX = 20;

/** Ramène une saisie (éventuellement vide) dans [min, max]. */
const clamp = (value: number | null, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.floor(Number(value) || 0)));

@Component({
  selector: 'app-simulation-page',
  imports: [Card, NumberInput, FormsModule],
  templateUrl: './simulation-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationPage {
  protected readonly guides = BUILDING_GUIDES;
  protected readonly resources = RESOURCES;
  protected readonly formatNumber = formatNumber;
  protected readonly formatDuration = formatDuration;
  protected readonly depotMax = DEPOT_MAX;

  protected readonly buildingId = signal<BuildingId>('hq');
  protected readonly currentLevel = signal<number | null>(10);
  protected readonly targetLevel = signal<number | null>(15);
  protected readonly resourceDepotLevel = signal<number | null>(8);
  protected readonly foodDepotLevel = signal<number | null>(8);

  protected readonly maxLevel = computed(() => {
    const rows = BUILDING_GUIDES.find((g) => g.id === this.buildingId())!.rows;
    return rows[rows.length - 1].level;
  });

  /** Le dépôt choisi comme bâtiment cible prend son niveau dans « niveau actuel ». */
  protected readonly isResourceDepot = computed(() => this.buildingId() === 'resourceDepot');
  protected readonly isFoodDepot = computed(() => this.buildingId() === 'foodDepot');

  protected readonly input = computed(() => {
    const current = clamp(this.currentLevel(), 0, this.maxLevel() - 1);
    return {
      buildingId: this.buildingId(),
      currentLevel: current,
      targetLevel: clamp(this.targetLevel(), current + 1, this.maxLevel()),
      resourceDepotLevel: clamp(this.resourceDepotLevel(), 1, DEPOT_MAX),
      foodDepotLevel: clamp(this.foodDepotLevel(), 1, DEPOT_MAX),
    };
  });

  protected readonly plan = computed(() => simulateUpgrades(this.input()));
  protected readonly storageStepCount = computed(() => this.plan().steps.filter((s) => s.isStorage).length);
}
