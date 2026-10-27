import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card } from '../../shared/ui/card';
import { NumberInput } from '../../shared/ui/number-input';
import { SegmentedControl, SegmentOption } from '../../shared/ui/segmented-control';
import { formatNumber } from '../../shared/utils/format';
import { findVillage, MAP_VILLAGES } from '../../core/game-data/map-villages';
import { findPlayer, groupByClan, NO_CLAN, OWN_CLAN, Player, PlayerMatch } from './clans.data';
import { EnemiesStore } from './enemies-store';
import { EnemyRecord, playerKey, ReportSide, survivors, TroopCounts, TROOPS, TroopKey } from './enemies.model';
import { readClipboardImage } from '../../shared/utils/clipboard';
import { ocrErrorDetail, readReportImage } from './report-ocr';
import { ParsedReport, PartialCounts } from './report-parser';

type StatKey = 'points' | 'inhabitants' | 'ce';
type DraftStats = Record<StatKey, number | null>;

interface Draft {
  /** Nom lu après « Ninjas de » (village) */ village: string;
  player: string;
  side: ReportSide | null;
  ninjas: PartialCounts;
  killed: PartialCounts;
  /** Infos saisies à la main : seules les valeurs renseignées sont enregistrées. */
  stats: DraftStats;
}

const EMPTY_STATS: DraftStats = { points: null, inhabitants: null, ce: null };
const STAT_MAX: Record<StatKey, number> = { points: Infinity, inhabitants: Infinity, ce: 20 };

interface TableRow {
  player: string;
  village: string;
  /** Clan actuel (`null` = sans clan) ; `undefined` = joueur absent des listes. */
  clan: string | null | undefined;
  record: EnemyRecord | undefined;
  /** Saisis à la main (null = non renseigné). */
  points: number | null;
  inhabitants: number | null;
  /** Camp d'entraînement estimé, saisi à la main. */ ce: number | null;
}

interface PlayerForm {
  /** Tableau (clan) où le joueur est ajouté. */ table: string;
  name: string;
  village: string;
}

/** Retrait d'un joueur de son clan : '' = vers « Sans Clans ». */
interface Transfer {
  player: string;
  target: string;
}

const EMPTY_COUNTS: PartialCounts = { genin: null, chuunin: null, jounin: null };
const toCounts = (c: PartialCounts): TroopCounts => ({
  genin: Number(c.genin) || 0,
  chuunin: Number(c.chuunin) || 0,
  jounin: Number(c.jounin) || 0,
});

const ALL = 'Tous les clans';
const UNLISTED = 'Non classés';

const byName = (a: TableRow, b: TableRow): number => a.player.localeCompare(b.player, 'fr');

const toRow = (
  player: Pick<Player, 'name' | 'village' | 'points' | 'inhabitants' | 'ce'>,
  clan: string | null | undefined,
  record: EnemyRecord | undefined,
): TableRow => ({
  player: player.name,
  village: player.village,
  clan,
  record,
  points: player.points ?? null,
  inhabitants: player.inhabitants ?? null,
  ce: player.ce ?? null,
});

@Component({
  selector: 'app-enemies-page',
  imports: [Card, NumberInput, FormsModule, SegmentedControl],
  templateUrl: './enemies-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:paste)': 'onPaste($event)' },
})
export class EnemiesPage implements OnDestroy {
  protected readonly store = inject(EnemiesStore);
  protected readonly troops = TROOPS;
  protected readonly formatNumber = formatNumber;
  protected readonly statFields: readonly { key: StatKey; label: string; max: number | null }[] = [
    { key: 'points', label: 'Points', max: null },
    { key: 'inhabitants', label: 'Habitants', max: null },
    { key: 'ce', label: 'CE estimé', max: 20 },
  ];

  protected readonly draft = signal<Draft | null>(null);
  /** Sections lues dans la capture (Assaillant, Défenseur…) et celle en cours d'édition. */
  protected readonly sections = signal<ParsedReport[]>([]);
  protected readonly sectionIndex = signal(0);
  protected readonly imageUrl = signal<string | null>(null);
  protected readonly reading = signal(false);
  /** Message affiché quand la capture n'a pas pu être lue entièrement. */
  protected readonly readWarning = signal<string | null>(null);
  protected readonly dragging = signal(false);
  protected readonly pasteError = signal<string | null>(null);

  /** Armée restante, ou null si aucun nombre de ninjas n'est saisi (l'armée n'est alors pas modifiée). */
  protected readonly draftSurvivors = computed(() => {
    const d = this.draft();
    if (!d || Object.values(d.ninjas).every((n) => n === null)) return null;
    return survivors(toCounts(d.ninjas), toCounts(d.killed));
  });

  /** Infos renseignées dans le formulaire (les champs vides ne sont pas modifiés). */
  protected readonly draftStats = computed(() => {
    const stats = this.draft()?.stats ?? EMPTY_STATS;
    return Object.fromEntries(
      (Object.keys(stats) as StatKey[])
        .filter((k) => stats[k] !== null)
        .map((k) => [k, Math.min(STAT_MAX[k], Math.max(0, Math.floor(Number(stats[k]))))]),
    ) as Partial<Record<StatKey, number>>;
  });

  protected readonly canSave = computed(() => {
    const d = this.draft();
    return !!d?.player.trim() && !this.isOwnClan() && (!!this.draftSurvivors() || Object.keys(this.draftStats()).length > 0);
  });

  protected readonly noClan = NO_CLAN;
  protected readonly unlisted = UNLISTED;

  /** Tous les clans, le nôtre compris (pour reconnaître ses membres dans les rapports). */
  private readonly allClans = computed(() => groupByClan(this.store.players(), this.store.clanNames()));
  private readonly enemyClans = computed(() => this.allClans().filter((c) => c.name !== OWN_CLAN));

  protected readonly knownPlayers = computed(() => this.enemyClans().flatMap((c) => c.players));
  /** Choix de clan pour un joueur : tous les clans existants, triés. */
  protected readonly clanChoices = computed(() => [...this.store.clanNames()].sort((a, b) => a.localeCompare(b, 'fr')));

  /** Joueur des listes correspondant au nom saisi (nom ou village). */
  protected readonly draftMatch = computed(() => this.match(this.draft()?.player ?? ''));
  /** Un membre de notre clan ne s'enregistre pas dans les infos ennemis. */
  protected readonly isOwnClan = computed(() => this.draftMatch()?.clan === OWN_CLAN);

  protected readonly clanFilter = signal(ALL);

  protected readonly tables = computed(() => {
    const records = this.store.records();
    // Notre clan compte comme « listé » : ses membres ne tombent pas dans « Non classés ».
    const listed = new Set(this.store.players().map((p) => playerKey(p.name)));
    const clanTables = this.enemyClans().map((clan) => ({
      name: clan.name,
      rows: clan.players
        .map((p) => toRow(p, p.clan, records[playerKey(p.name)]))
        .sort(byName),
    }));
    const unlisted = Object.entries(records)
      .filter(([key]) => !listed.has(key))
      .map(([, record]) => toRow({ name: record.player, village: '' }, undefined, record))
      .sort(byName);
    return unlisted.length ? [...clanTables, { name: UNLISTED, rows: unlisted }] : clanTables;
  });

  protected readonly clanOptions = computed((): SegmentOption<string>[] =>
    [ALL, ...this.tables().map((t) => t.name)].map((name) => ({ id: name, label: name })),
  );

  protected readonly visibleTables = computed(() => {
    const filter = this.clanFilter();
    return filter === ALL ? this.tables() : this.tables().filter((t) => t.name === filter);
  });

  protected onPaste(event: ClipboardEvent): void {
    const file = [...(event.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile();
    if (file) {
      event.preventDefault();
      void this.analyze(file);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file?.type.startsWith('image/')) void this.analyze(file);
  }

  /** Bouton « Coller » : indispensable sur iPhone, où le collage clavier n'atteint pas la page. */
  protected async pasteFromClipboard(): Promise<void> {
    this.pasteError.set(null);
    try {
      const image = await readClipboardImage();
      if (image) void this.analyze(image);
      else this.pasteError.set("Le presse-papiers ne contient pas d'image : copiez d'abord la capture du rapport.");
    } catch {
      this.pasteError.set('Accès au presse-papiers impossible : touchez la zone pour choisir la capture dans vos photos.');
    }
  }

  protected onFilePicked(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.analyze(file);
  }

  protected setPlayer(player: string): void {
    this.draft.update((d) => d && { ...d, player });
  }

  protected setCount(row: 'ninjas' | 'killed', key: TroopKey, value: number | null): void {
    this.draft.update((d) => d && { ...d, [row]: { ...d[row], [key]: value } });
  }

  protected setStat(key: StatKey, value: number | null): void {
    this.draft.update((d) => d && { ...d, stats: { ...d.stats, [key]: value } });
  }

  /** Enregistre seulement ce qui est rempli : l'armée si des ninjas sont saisis, et chaque info renseignée. */
  protected save(): void {
    const d = this.draft();
    if (!d || !this.canSave()) return;
    const match = this.draftMatch();
    // Garde l'orthographe des listes de clans quand le joueur y figure.
    const player = match?.player.name ?? d.player.trim();

    const troops = this.draftSurvivors();
    const current = this.store.records()[playerKey(player)];
    const unchanged = current && troops && TROOPS.every((t) => current.troops[t.key] === troops[t.key]);
    if (troops && !unchanged) this.store.upsert({ player, troops, side: d.side, updatedAt: new Date().toISOString() });

    const stats = this.draftStats();
    if (Object.keys(stats).length) {
      if (match) this.store.setPlayerStats(player, stats);
      // Joueur absent des listes : il faut une fiche pour garder ses infos, rangée dans « Sans Clans ».
      else this.store.addPlayer({ name: player, village: d.village, clan: null, ...stats });
    }
    this.cancel();
  }

  protected cancel(): void {
    this.draft.set(null);
    this.sections.set([]);
    this.readWarning.set(null);
    this.setImage(null);
  }

  /** Saisie d'une armée sans capture. */
  protected manualEntry(): void {
    this.cancel();
    this.draft.set(this.emptyDraft());
  }

  /** Pré-remplit le formulaire avec l'armée connue du joueur (Tués à 0). */
  protected editArmy(row: TableRow): void {
    this.cancel();
    const troops = row.record?.troops;
    this.draft.set({
      ...this.emptyDraft(),
      player: row.player,
      side: row.record?.side ?? null,
      ninjas: troops ? { ...troops } : { ...EMPTY_COUNTS },
      killed: troops ? { genin: 0, chuunin: 0, jounin: 0 } : { ...EMPTY_COUNTS },
      stats: { points: row.points, inhabitants: row.inhabitants, ce: row.ce },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected removeArmy(player: string): void {
    if (confirm(`Effacer l'armée de ${player} ?`)) this.store.remove(player);
  }

  // --- Volets des clans ---

  /** Clans dont le volet est ouvert (tous fermés au départ). */
  protected readonly openTables = signal<ReadonlySet<string>>(new Set());

  protected toggleTable(name: string): void {
    this.openTables.update((open) => {
      const next = new Set(open);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  }

  private openTable(name: string): void {
    if (!this.openTables().has(name)) this.toggleTable(name);
  }

  /** Un tableau de clan réel : ni « Sans Clans », ni « Non classés ». */
  protected isRealClan(name: string): boolean {
    return name !== NO_CLAN && name !== UNLISTED;
  }

  // --- Gestion des clans et joueurs ---

  protected readonly mapVillageNames = MAP_VILLAGES.map((v) => v.name).sort((a, b) => a.localeCompare(b, 'fr'));
  protected readonly addingClan = signal(false);
  protected readonly newClan = signal('');
  protected readonly playerForm = signal<PlayerForm | null>(null);
  protected readonly transfer = signal<Transfer | null>(null);
  protected readonly manageError = signal<string | null>(null);

  protected addClan(): void {
    const name = this.newClan().trim();
    if (!name) return;
    if (name === NO_CLAN || this.store.clanNames().some((c) => playerKey(c) === playerKey(name))) {
      this.manageError.set(`Le clan « ${name} » existe déjà.`);
      return;
    }
    this.store.addClan(name);
    this.newClan.set('');
    this.addingClan.set(false);
    this.manageError.set(null);
  }

  protected removeClan(name: string): void {
    if (confirm(`Supprimer le clan « ${name} » ? Ses joueurs passeront dans « ${NO_CLAN} ».`)) this.store.removeClan(name);
  }

  protected startAddPlayer(table: string): void {
    this.openTable(table);
    this.transfer.set(null);
    this.manageError.set(null);
    this.playerForm.set({ table, name: '', village: '' });
  }

  /** Un village de la carte choisi : le nom du joueur (kage) est pré-rempli. */
  protected setPlayerFormVillage(village: string): void {
    const onMap = findVillage(village);
    this.playerForm.update((f) => f && { ...f, village, name: f.name || (onMap?.name === village ? onMap.kage : '') });
  }

  protected setPlayerFormName(name: string): void {
    this.playerForm.update((f) => f && { ...f, name });
  }

  protected addPlayer(): void {
    const form = this.playerForm();
    if (!form?.name.trim()) return;
    const clan = form.table === NO_CLAN ? null : form.table;
    const existing = this.store.players().find((p) => playerKey(p.name) === playerKey(form.name));
    if (existing) {
      const from = existing.clan ?? NO_CLAN;
      if (from === form.table) {
        this.manageError.set(`${existing.name} est déjà dans « ${form.table} ».`);
        return;
      }
      if (!confirm(`${existing.name} est dans « ${from} ». Le transférer dans « ${form.table} » ?`)) return;
      this.store.setPlayerClan(existing.name, clan);
    } else {
      this.store.addPlayer({ name: form.name.trim(), village: form.village.trim(), clan });
    }
    this.playerForm.set(null);
    this.manageError.set(null);
  }

  /** « Retirer » : propose un transfert vers un autre clan (« Sans Clans » par défaut) ou la suppression. */
  protected startTransfer(row: TableRow): void {
    this.playerForm.set(null);
    this.transfer.set({ player: row.player, target: row.clan ? '' : (this.otherClans(null)[0] ?? '') });
  }

  protected setTransferTarget(target: string): void {
    this.transfer.update((t) => t && { ...t, target });
  }

  /** Destinations possibles pour un joueur du clan `current`. */
  protected otherClans(current: string | null | undefined): string[] {
    return this.clanChoices().filter((c) => c !== current);
  }

  protected confirmTransfer(): void {
    const t = this.transfer();
    if (!t) return;
    this.store.setPlayerClan(t.player, t.target || null);
    this.transfer.set(null);
  }

  protected removePlayer(player: string): void {
    if (confirm(`Supprimer ${player} de la liste (avec son armée) ?`)) {
      this.store.removePlayer(player);
      this.transfer.set(null);
    }
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  ngOnDestroy(): void {
    this.setImage(null);
  }

  private async analyze(file: Blob): Promise<void> {
    this.pasteError.set(null);
    this.setImage(URL.createObjectURL(file));
    this.reading.set(true);
    this.readWarning.set(null);
    this.draft.set(null);
    this.sections.set([]);
    try {
      const { sections } = await readReportImage(file);
      this.sections.set(sections);
      if (!sections.length) {
        this.readWarning.set('Rapport non reconnu : complétez les champs à la main.');
        this.draft.set(this.emptyDraft());
        return;
      }
      // Par défaut, la première section qui n'est pas de notre clan.
      const enemy = sections.findIndex((s) => this.match(s.village)?.clan !== OWN_CLAN);
      this.selectSection(enemy < 0 ? 0 : enemy);
    } catch (e) {
      this.readWarning.set(
        `La lecture a échoué (connexion nécessaire au premier usage) : saisissez les valeurs à la main. Détail : ${ocrErrorDetail(e)}`,
      );
      this.draft.set(this.emptyDraft());
    } finally {
      this.reading.set(false);
    }
  }

  protected selectSection(index: number): void {
    const section = this.sections()[index];
    this.sectionIndex.set(index);
    const draft: Draft = {
      ...section,
      player: this.match(section.village)?.player.name ?? section.village,
      // Infos à saisir à la main : vides au départ.
      stats: { ...EMPTY_STATS },
    };
    const missing = !draft.player || [draft.ninjas, draft.killed].some((c) => Object.values(c).includes(null));
    this.readWarning.set(missing ? 'Certaines valeurs n’ont pas pu être lues : complétez les champs vides.' : null);
    this.draft.set(draft);
  }

  protected sectionLabel(section: ParsedReport): string {
    const name = this.match(section.village)?.player.name ?? section.village;
    return `${section.side ?? 'Section'} : ${name || '?'}`;
  }

  private match(name: string): PlayerMatch | null {
    return findPlayer(this.store.players(), name);
  }

  private emptyDraft(): Draft {
    return { village: '', player: '', side: null, ninjas: { ...EMPTY_COUNTS }, killed: { ...EMPTY_COUNTS }, stats: { ...EMPTY_STATS } };
  }

  private setImage(url: string | null): void {
    const previous = this.imageUrl();
    if (previous) URL.revokeObjectURL(previous);
    this.imageUrl.set(url);
  }
}
