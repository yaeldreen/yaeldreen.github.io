import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { hasCoordinates } from '../../core/game-data/map-villages';
import { Card } from '../../shared/ui/card';
import { LevelInput } from '../../shared/ui/level-input';
import { NumberInput } from '../../shared/ui/number-input';
import { formatNumber } from '../../shared/utils/format';
import { NO_CLAN, OWN_CLAN, PLAYER_STATS, PlayerStatKey } from '../enemies/clans.data';
import { EnemiesStore } from '../enemies/enemies-store';
import { TROOPS, TroopCounts, TroopKey } from '../enemies/enemies.model';
import { gameLinks } from '../radar/radar.logic';
import { ageInDays, hasChanges, isCreatedAtValid, isDefaultPhoto, playerSheet, profilePhotoUrl, SheetForm, sheetChanges, sheetForm } from './player.logic';

/** Fiche d'un joueur : ce qui est renseigné dans la base. */
@Component({
  selector: 'app-player-page',
  imports: [Card, LevelInput, NumberInput, RouterLink],
  templateUrl: './player-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerPage {
  protected readonly store = inject(EnemiesStore);
  protected readonly formatNumber = formatNumber;
  protected readonly noClan = NO_CLAN;
  protected readonly levelFields = PLAYER_STATS.filter((f) => f.max);
  protected readonly countFields = PLAYER_STATS.filter((f) => !f.max);
  protected readonly troops = TROOPS;

  protected readonly name = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('nom') ?? '')), { initialValue: '' });
  protected readonly loading = computed(() => this.store.status() === 'loading');
  protected readonly sheet = computed(() =>
    playerSheet(this.name(), this.store.players(), this.store.villageRecords(), this.store.records(), this.store.snapshots()),
  );
  protected readonly links = computed(() => {
    const village = this.sheet()?.village;
    return village ? gameLinks(village) : [];
  });
  protected readonly coordinates = computed(() => {
    const village = this.sheet()?.village;
    return village && hasCoordinates(village) ? village : null;
  });
  protected readonly armyAge = computed(() => {
    const record = this.sheet()?.record;
    return record ? ageInDays(record.updatedAt, Date.now()) : null;
  });

  /** Adresse sans vraie photo (erreur ou image par défaut du jeu) : on n'affiche alors rien à sa place. */
  protected readonly failedPhoto = signal<string | null>(null);
  protected readonly photo = computed(() => {
    const url = profilePhotoUrl(this.sheet()?.village?.gameId);
    return url === this.failedPhoto() ? null : url;
  });

  protected onPhotoLoad(image: HTMLImageElement, url: string): void {
    if (isDefaultPhoto(image.naturalWidth, image.naturalHeight)) this.failedPhoto.set(url);
  }

  // --- Modification ---

  /** Formulaire ouvert, sinon `null`. */
  protected readonly form = signal<SheetForm | null>(null);
  /** Notre clan n'a pas d'armée enregistrée : les imports la retireraient. */
  protected readonly armyEditable = computed(() => this.sheet()?.player.clan !== OWN_CLAN);
  private readonly changes = computed(() => {
    const [sheet, form] = [this.sheet(), this.form()];
    return sheet && form ? sheetChanges(sheet, form) : null;
  });
  protected readonly createdAtValid = computed(() => isCreatedAtValid(this.form()?.createdAt ?? ''));
  protected readonly canSave = computed(() => {
    const changes = this.changes();
    return !!changes && hasChanges(changes) && this.createdAtValid();
  });

  protected edit(): void {
    const sheet = this.sheet();
    if (sheet) this.form.set(sheetForm(sheet));
  }

  protected setStat(key: PlayerStatKey, value: number | null): void {
    this.form.update((f) => f && { ...f, stats: { ...f.stats, [key]: value } });
  }

  protected setTroop(key: TroopKey, value: number | null): void {
    this.form.update((f) => f && { ...f, troops: { ...f.troops, [key]: value } });
  }

  protected setCreatedAt(createdAt: string): void {
    this.form.update((f) => f && { ...f, createdAt });
  }

  protected setComment(comment: string): void {
    this.form.update((f) => f && { ...f, comment });
  }

  protected save(): void {
    const [sheet, changes] = [this.sheet(), this.changes()];
    if (!sheet || !changes) return;
    const name = sheet.player.name;
    if (Object.keys(changes.stats).length) this.store.setPlayerStats(name, changes.stats);
    if (changes.troops && this.armyEditable()) {
      this.store.upsert({ player: name, troops: changes.troops, side: sheet.record?.side ?? null, updatedAt: new Date().toISOString() });
    }
    if (changes.createdAt !== null) this.store.setPlayerCreatedAt(name, changes.createdAt);
    if (changes.comment !== null) this.store.setPlayerComment(name, changes.comment);
    this.form.set(null);
  }

  protected removeArmy(): void {
    const name = this.sheet()?.player.name;
    if (name && confirm(`Effacer l'armée de ${name} ?`)) {
      this.store.remove(name);
      this.form.set(null);
    }
  }

  protected troopsLine(troops: TroopCounts): string {
    return TROOPS.map((t) => formatNumber(troops[t.key])).join(' / ');
  }

  protected signed(n: number): string {
    return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatNumber(Math.abs(n))}`;
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
