export type DiceColor = 'yellow' | 'purple' | 'blue' | 'red' | 'green' | 'clear' | 'pink';

export interface CellData {
  values: number[];
  glitter?: boolean;
}

export type RoundData = Partial<Record<DiceColor, CellData>>;
