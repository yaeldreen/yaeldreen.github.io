export type ResourceKey = 'stone' | 'wood' | 'iron' | 'food';

export interface Resource {
  key: ResourceKey;
  label: string;
  icon: string;
  /** Pastille d'icône (cartes) */ iconBoxClass: string;
  /** Valeur (cartes) */ valueClass: string;
  /** En-tête de colonne (tableaux) */ headerClass: string;
  /** Cellule (tableaux) */ cellClass: string;
}

// Classes écrites en entier pour que Tailwind puisse les détecter.
export const RESOURCES: readonly Resource[] = [
  { key: 'stone', label: 'Pierre', icon: 'fa-mountain',
    iconBoxClass: 'bg-amber-500/10 border-amber-500/30 text-amber-400', valueClass: 'text-amber-300',
    headerClass: 'text-amber-300', cellClass: 'text-amber-300/90' },
  { key: 'wood', label: 'Bois', icon: 'fa-tree',
    iconBoxClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', valueClass: 'text-emerald-300',
    headerClass: 'text-emerald-300', cellClass: 'text-emerald-300/90' },
  { key: 'iron', label: 'Fer', icon: 'fa-shield-halved',
    iconBoxClass: 'bg-stone-400/10 border-stone-400/30 text-stone-300', valueClass: 'text-stone-100',
    headerClass: 'text-stone-300', cellClass: 'text-stone-300/90' },
  { key: 'food', label: 'Nourriture', icon: 'fa-bowl-food',
    iconBoxClass: 'bg-rose-500/10 border-rose-500/30 text-rose-400', valueClass: 'text-rose-300',
    headerClass: 'text-rose-300', cellClass: 'text-rose-300/90' },
];
