import type { CellData, DiceColor, GameRecord, RoundData } from './types';

export const sum = (vals: number[]) => vals.reduce((a, b) => a + b, 0);

export const COLUMNS: Array<{
  key: DiceColor;
  label: string;
  shortLabel: string;
  rule: string;
  headerBg: string;
  cellBg: string;
  score: (cell: CellData) => number;
}> = [
  {
    key: 'yellow',
    label: 'Yellow',
    shortLabel: 'Y',
    rule: 'Sum of Yellow',
    headerBg: 'bg-yellow-300',
    cellBg: 'hover:bg-yellow-50',
    score: (c) => sum(c.values),
  },
  {
    key: 'purple',
    label: 'Purple',
    shortLabel: 'Pu',
    rule: 'Sum of Purple ×2',
    headerBg: 'bg-purple-300',
    cellBg: 'hover:bg-purple-50',
    score: (c) => sum(c.values) * 2,
  },
  {
    key: 'blue',
    label: 'Blue',
    shortLabel: 'B',
    rule: 'Sum of Blue (×2 if Glitter)',
    headerBg: 'bg-blue-300',
    cellBg: 'hover:bg-blue-50',
    score: (c) => sum(c.values) * (c.glitter ? 2 : 1),
  },
  {
    key: 'red',
    label: 'Red',
    shortLabel: 'R',
    rule: 'Sum of Red × # of Red',
    headerBg: 'bg-red-300',
    cellBg: 'hover:bg-red-50',
    score: (c) => sum(c.values) * c.values.filter((_, i) => !c.mimic?.[i]).length,
  },
  {
    key: 'green',
    label: 'Green',
    shortLabel: 'G',
    rule: 'Sum of Green',
    headerBg: 'bg-green-300',
    cellBg: 'hover:bg-green-50',
    score: (c) => sum(c.values),
  },
  {
    key: 'clear',
    label: 'Clear',
    shortLabel: 'C',
    rule: 'Sum of Clear',
    headerBg: 'bg-gray-200',
    cellBg: 'hover:bg-gray-50',
    score: (c) => sum(c.values),
  },
  {
    key: 'pink',
    label: 'Pink',
    shortLabel: 'Pk',
    rule: 'Sum of Pink',
    headerBg: 'bg-pink-200',
    cellBg: 'hover:bg-pink-50',
    score: (c) => sum(c.values),
  },
];

// Expansion-only column — does not appear in COLUMNS, not scored in totals
export const BLACK_COLUMN = {
  key: 'black' as const,
  label: 'Black',
  shortLabel: 'Bk',
  rule: 'Number of Rerolls',
  headerBg: 'bg-slate-800',
  cellBg: 'hover:bg-slate-100',
  score: (c: CellData) => sum(c.values),
};

export function emptyRounds(): RoundData[] {
  return Array.from({ length: 10 }, () => ({}));
}

export function hasData(rounds: RoundData[]): boolean {
  return rounds.some((round) => COLUMNS.some((col) => round[col.key] !== undefined));
}

export function calcRowTotal(round: RoundData): number {
  return COLUMNS.reduce((total, col) => {
    const cell = round[col.key];
    return total + (cell ? col.score(cell) : 0);
  }, 0);
}

export function calcGrandTotal(rounds: RoundData[]): number {
  return rounds.reduce((total, round) => total + calcRowTotal(round), 0);
}

export function formatTimestamp(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Saves current rounds into history (create or update). Returns updated history.
export function commitToHistory(
  rounds: RoundData[],
  currentId: string | null,
  history: GameRecord[]
): GameRecord[] {
  if (!hasData(rounds)) return history;
  if (currentId !== null) {
    return history.map((e) => (e.id === currentId ? { ...e, rounds } : e));
  }
  return [...history, { id: crypto.randomUUID(), timestamp: new Date(), rounds }];
}
