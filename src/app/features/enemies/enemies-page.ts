import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card } from '../../shared/ui/card';
import { NumberInput } from '../../shared/ui/number-input';
import { SegmentedControl, SegmentOption } from '../../shared/ui/segmented-control';
import { formatNumber } from '../../shared/utils/format';
import { findPlayer, groupByClan, NO_CLAN, OWN_CLAN, Player, PlayerMatch } from './clans.data';
import { EnemiesStore } from './enemies-store';
import { EnemyRecord, playerKey, ReportSide, survivors, TroopCounts, TROOPS, TroopKey } from './enemies.model';
import { readClipboardImage } from '../../shared/utils/clipboard';
import { ocrErrorDetail, readReportImage } from './report-ocr';
import { ParsedReport, PartialCounts } from './report-parser';

interface Draft {
  /** Nom lu après « Ninjas de » (village) */ village: string;
  player: string;
  side: ReportSide | null;
  ninjas: PartialCounts;
  killed: PartialCounts;
}

interface TableRow {
  player: string;
  village: string;
  /** Clan actuel (`null` = sans clan) ; `undefined` = joueur absent des listes. */
  clan: string | null | undefined;
  record: EnemyRecord | undefined;
}

interface PlayerForm {
  name: string;
  village: string;
  /** '' = sans clan */ clan: string;
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

  protected readonly draftSurvivors = computed(() => {
    const d = this.draft();
    return d ? survivors(toCounts(d.ninjas), toCounts(d.killed)) : null;
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
        .map((p): TableRow => ({ player: p.name, village: p.village, clan: p.clan, record: records[playerKey(p.name)] }))
        .sort(byName),
    }));
    const unlisted = Object.entries(records)
      .filter(([key]) => !listed.has(key))
      .map(([, record]): TableRow => ({ player: record.player, village: '', clan: undefined, record }))
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

  protected save(): void {
    const d = this.draft();
    const troops = this.draftSurvivors();
    if (!d || !troops || !d.player.trim() || this.isOwnClan()) return;
    // Garde l'orthographe des listes de clans quand le joueur y figure.
    const player = this.draftMatch()?.player.name ?? d.player.trim();
    this.store.upsert({ player, troops, side: d.side, updatedAt: new Date().toISOString() });
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
      killed: { genin: 0, chuunin: 0, jounin: 0 },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected removeArmy(player: string): void {
    if (confirm(`Effacer l'armée de ${player} ?`)) this.store.remove(player);
  }

  // --- Gestion des clans et joueurs ---

  protected readonly newClan = signal('');
  protected readonly newPlayer = signal<PlayerForm>({ name: '', village: '', clan: '' });
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
    this.manageError.set(null);
  }

  protected removeClan(name: string): void {
    if (confirm(`Supprimer le clan « ${name} » ? Ses joueurs passeront dans « ${NO_CLAN} ».`)) this.store.removeClan(name);
  }

  protected setNewPlayer(field: keyof PlayerForm, value: string): void {
    this.newPlayer.update((p) => ({ ...p, [field]: value }));
  }

  protected addPlayer(): void {
    const form = this.newPlayer();
    const player: Player = { name: form.name.trim(), village: form.village.trim(), clan: form.clan || null };
    if (!player.name) return;
    if (this.store.players().some((p) => playerKey(p.name) === playerKey(player.name))) {
      this.manageError.set(`${player.name} est déjà dans la liste : changez son clan depuis son tableau.`);
      return;
    }
    this.store.addPlayer(player);
    this.newPlayer.set({ name: '', village: '', clan: form.clan });
    this.manageError.set(null);
  }

  protected movePlayer(player: string, clan: string): void {
    this.store.setPlayerClan(player, clan || null);
  }

  protected removePlayer(player: string): void {
    if (confirm(`Supprimer ${player} de la liste (avec son armée) ?`)) this.store.removePlayer(player);
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
    const draft: Draft = { ...section, player: this.match(section.village)?.player.name ?? section.village };
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
    return { village: '', player: '', side: null, ninjas: { ...EMPTY_COUNTS }, killed: { ...EMPTY_COUNTS } };
  }

  private setImage(url: string | null): void {
    const previous = this.imageUrl();
    if (previous) URL.revokeObjectURL(previous);
    this.imageUrl.set(url);
  }
}
