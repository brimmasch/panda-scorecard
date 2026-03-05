export type DiceColor = 'yellow' | 'purple' | 'blue' | 'red' | 'green' | 'clear' | 'pink' | 'black';

export interface CellData {
  values: number[];
  glitter?: boolean;
  mimic?: boolean[]; // per-die: true = counts toward sum but NOT toward red die count
}

export type RoundData = Partial<Record<DiceColor, CellData>>;
