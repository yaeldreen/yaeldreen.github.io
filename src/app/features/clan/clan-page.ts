import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { findVillage, MapVillage, parseMapExport, villageOptions } from '../../core/game-data/map-villages';
import { Card } from '../../shared/ui/card';
import { Combobox, ComboboxOption } from '../../shared/ui/combobox';
import { formatNumber } from '../../shared/utils/format';
import { NO_CLAN, OWN_CLAN, Player, PLAYER_STATS, PlayerStatKey } from '../enemies/clans.data';
import { EnemiesStore, MapImportSummary } from '../enemies/enemies-store';
import { EnemyRecord, playerKey, TROOPS, TroopKey } from '../enemies/enemies.model';
import { NumberInput } from '../../shared/ui/number-input';

type Stats = Record<PlayerStatKey, number | null>;

interface MemberRow {
  name: string;
  village: string;
  /** Village retrouvé sur la carte (coordonnées), sinon null. */ onMap: MapVillage | null;
  /** Infos enregistrées (null = inconnue). */ stats: Stats;
  /** Dernière armée enregistrée. */ record: EnemyRecord | undefined;
}

/** Formulaire « Modifier » d'un membre : seules les cases remplies sont enregistrées. */
interface MemberForm {
  name: string;
  troops: Record<TroopKey, number | null>;
  stats: Stats;
}

const statsOf = (p: Player): Stats => Object.fromEntries(PLAYER_STATS.map((f) => [f.key, p[f.key] ?? null])) as Stats;

/**
 * Membres de notre clan : la liste partagée (Firestore) qui sert aussi à « Qui es-tu ? » (Retours)
 * et à « Qui est le plus proche ».
 */
@Component({
  selector: 'app-clan-page',
  imports: [FormsModule, Card, Combobox, NumberInput],
  templateUrl: './clan-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClanPage {
  protected readonly store = inject(EnemiesStore);
  protected readonly clan = OWN_CLAN;
  protected readonly noClan = NO_CLAN;
  protected readonly formatNumber = formatNumber;
  protected readonly villageOptions = computed((): ComboboxOption[] => villageOptions(this.store.villages()));
  private readonly findVillage = (name: string) => findVillage(this.store.villages(), name);

  protected readonly members = computed((): MemberRow[] =>
    this.store
      .players()
      .filter((p) => p.clan === OWN_CLAN)
      .map((p) => ({
        name: p.name,
        village: p.village,
        onMap: this.findVillage(p.village) ?? this.findVillage(p.name),
        stats: statsOf(p),
        record: this.store.records()[playerKey(p.name)],
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  );

  /** Villages marqués Tsukuyomi sur la carte mais absents de la liste : ajout en un clic. */
  protected readonly suggestions = computed(() => {
    const listed = new Set(this.members().flatMap((m) => [playerKey(m.name), playerKey(m.village)]));
    return this.store.villages().filter((v) => v.clan === OWN_CLAN && !listed.has(playerKey(v.kage)) && !listed.has(playerKey(v.name)));
  });

  protected readonly newVillage = signal('');
  protected readonly newName = signal('');
  protected readonly error = signal<string | null>(null);

  /** Choisir un village de la carte pré-remplit le nom du joueur. */
  protected setNewVillage(village: string): void {
    this.newVillage.set(village);
    const onMap = this.findVillage(village);
    if (onMap?.name === village && !this.newName()) this.newName.set(onMap.kage);
  }

  protected add(name = this.newName().trim(), village = this.newVillage().trim()): void {
    if (!name) return;
    const existing = this.store.players().find((p) => playerKey(p.name) === playerKey(name));
    if (existing?.clan === OWN_CLAN) {
      this.error.set(`${existing.name} est déjà membre de ${OWN_CLAN}.`);
      return;
    }
    // Un joueur déjà connu (infos enemis) change simplement de clan.
    if (existing) this.store.setPlayerClan(existing.name, OWN_CLAN);
    else this.store.addPlayer({ name, village, clan: OWN_CLAN });
    this.newName.set('');
    this.newVillage.set('');
    this.error.set(null);
  }

  // --- Import de la carte (export JSON du jeu) ---

  protected readonly mapText = signal('');
  protected readonly importing = signal(false);
  protected readonly importResult = signal<MapImportSummary | null>(null);
  protected readonly importError = signal<string | null>(null);

  protected async importMap(): Promise<void> {
    this.importResult.set(null);
    this.importError.set(null);
    let villages: MapVillage[];
    try {
      villages = parseMapExport(this.mapText());
    } catch (e) {
      this.importError.set((e as Error).message);
      return;
    }
    this.importing.set(true);
    try {
      this.importResult.set(await this.store.importMap(villages));
      this.mapText.set('');
    } catch (e) {
      this.importError.set(`Import refusé : ${(e as Error).message}. Vérifiez que les règles Firestore sont publiées.`);
    } finally {
      this.importing.set(false);
    }
  }

  // --- Infos d'un membre (armée, points, niveaux), reprises par Simu combat ---

  protected readonly troopTypes = TROOPS;
  protected readonly statFields = PLAYER_STATS;
  protected readonly editing = signal<MemberForm | null>(null);

  protected edit(member: MemberRow): void {
    const troops = member.record?.troops;
    this.editing.set({
      name: member.name,
      troops: troops ? { ...troops } : { genin: null, chuunin: null, jounin: null },
      stats: { ...member.stats },
    });
  }

  protected setEditTroop(key: TroopKey, value: number | null): void {
    this.editing.update((f) => f && { ...f, troops: { ...f.troops, [key]: value } });
  }

  protected setEditStat(key: PlayerStatKey, value: number | null): void {
    this.editing.update((f) => f && { ...f, stats: { ...f.stats, [key]: value } });
  }

  /** Comme dans « infos enemis » : l'armée si des ninjas sont saisis, puis chaque info renseignée. */
  protected saveEdit(): void {
    const f = this.editing();
    if (!f) return;
    if (Object.values(f.troops).some((n) => n !== null)) {
      const troops = Object.fromEntries(TROOPS.map((t) => [t.key, Math.max(0, Math.floor(Number(f.troops[t.key]) || 0))])) as Record<TroopKey, number>;
      const current = this.store.records()[playerKey(f.name)];
      if (!current || TROOPS.some((t) => current.troops[t.key] !== troops[t.key])) {
        this.store.upsert({ player: f.name, troops, side: null, updatedAt: new Date().toISOString() });
      }
    }
    const stats = Object.fromEntries(
      PLAYER_STATS.filter((s) => f.stats[s.key] !== null).map((s) => [
        s.key,
        Math.min(s.max ?? Infinity, Math.max(0, Math.floor(Number(f.stats[s.key])))),
      ]),
    );
    if (Object.keys(stats).length) this.store.setPlayerStats(f.name, stats);
    this.editing.set(null);
  }

  /** Le joueur reste connu dans « infos enemis », rangé dans « Sans Clans ». */
  protected remove(member: MemberRow): void {
    if (confirm(`Retirer ${member.name} de ${OWN_CLAN} ? Il passera dans « ${NO_CLAN} ».`)) {
      this.store.setPlayerClan(member.name, null);
    }
  }
}
