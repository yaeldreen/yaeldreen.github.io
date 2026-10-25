import { ChangeDetectionStrategy, Component, computed, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card } from '../../shared/ui/card';
import { NumberInput } from '../../shared/ui/number-input';
import { SegmentedControl, SegmentOption } from '../../shared/ui/segmented-control';
import { toLocalIsoSeconds } from '../../shared/utils/format';
import { computeDistance, computeReturnRows, Coordinate, DistanceMode } from './travel.logic';

/** Niveau du centre mis en évidence dans le tableau. */
const HIGHLIGHTED_LEVEL = 5;

@Component({
  selector: 'app-travel-page',
  imports: [FormsModule, Card, NumberInput, SegmentedControl],
  templateUrl: './travel-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TravelPage {
  protected readonly highlightedLevel = HIGHLIGHTED_LEVEL;
  protected readonly axes = ['x', 'y'] as const;
  protected readonly modeOptions: readonly SegmentOption<DistanceMode>[] = [
    { id: 'manual', label: 'Saisie km directe' },
    { id: 'coords', label: 'Coordonnées (Village 1 / 2)' },
  ];

  protected readonly distanceMode = signal<DistanceMode>('manual');
  protected readonly manualDistance = signal<number | null>(5);
  protected readonly departureTime = signal(toLocalIsoSeconds(new Date()));

  private readonly origin = signal<Coordinate>({ x: 8194, y: -15 });
  private readonly target = signal<Coordinate>({ x: 8199, y: -11 });
  protected readonly villages = [
    { n: 1, label: 'Village 1 (Départ / Source)', labelClass: 'text-indigo-300', point: this.origin },
    { n: 2, label: 'Village 2 (Cible / Arrivée)', labelClass: 'text-emerald-300', point: this.target },
  ];

  protected readonly distance = computed(() =>
    computeDistance(this.distanceMode(), this.manualDistance(), this.origin(), this.target()),
  );

  protected readonly rows = computed(() => {
    const departure = this.departureTime();
    return computeReturnRows(this.distance(), departure ? new Date(departure).getTime() : Date.now());
  });

  protected setCoordinate(point: WritableSignal<Coordinate>, axis: 'x' | 'y', value: number | null): void {
    point.update((p) => ({ ...p, [axis]: value }));
  }

  protected setNow(): void {
    this.departureTime.set(toLocalIsoSeconds(new Date()));
  }
}
