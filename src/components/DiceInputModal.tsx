import { useState, useEffect, useRef } from 'react';
import type { CellData, DiceColor } from '../types';

const DICE_RANGES: Record<DiceColor, { min: number; max: number }> = {
  yellow: { min: 1, max: 8 },
  purple: { min: 1, max: 12 },
  blue:   { min: 1, max: 12 },
  red:    { min: -8, max: 8 },
  green:  { min: 1, max: 20 },
  clear:  { min: 1, max: 6 },
  pink:   { min: 1, max: 12 },
  black:  { min: 1, max: 6 },
};

// Pink max: 102 in expansion mode for rounds 6–10, otherwise 12
function getPinkMax(expansion: boolean, roundIndex: number): number {
  return expansion && roundIndex >= 5 ? 102 : 12;
}

function isValidDieValue(color: DiceColor, raw: string, expansion: boolean, roundIndex: number): boolean {
  if (raw === '' || raw === '-') return true; // still typing
  const n = Number(raw);
  if (!Number.isInteger(n)) return false;
  const range = { ...DICE_RANGES[color] };
  if (color === 'pink') range.max = getPinkMax(expansion, roundIndex);
  return n >= range.min && n <= range.max;
}

interface ColumnConfig {
  key: DiceColor;
  label: string;
  rule: string;
  headerBg: string;
  score: (cell: CellData) => number;
}

interface Props {
  roundIndex: number;
  existing: CellData | null;
  defaultDiceCount: number;
  defaultGlitter: boolean;
  defaultMimic?: boolean[];
  columnConfig: ColumnConfig;
  expansion: boolean;
  onSave: (data: CellData | null) => void;
  onClose: () => void;
  onSwipe?: (direction: 'left' | 'right', data: CellData | null) => void;
}

export function DiceInputModal({ roundIndex, existing, defaultDiceCount, defaultGlitter, defaultMimic, columnConfig, expansion, onSave, onClose, onSwipe }: Props) {
  const [values, setValues] = useState<string[]>(
    existing?.values.length
      ? [...existing.values.map(String), '']
      : Array(defaultDiceCount).fill('')
  );
  const [glitter, setGlitter] = useState(existing?.glitter ?? defaultGlitter);
  const [mimic, setMimic] = useState<boolean[]>(
    existing?.values.length
      ? [...(existing.mimic ?? existing.values.map(() => false)), false]
      : defaultMimic?.length
        ? [...defaultMimic.slice(0, defaultDiceCount), ...Array(Math.max(0, defaultDiceCount - defaultMimic.length)).fill(false)]
        : Array(defaultDiceCount).fill(false)
  );
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prevLength = useRef(values.length);
  const touchStartX = useRef<number | null>(null);
  const handleSaveRef = useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Android back button → treat as Save
  useEffect(() => {
    history.pushState({ modal: true }, '');
    const handler = () => handleSaveRef.current();
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  useEffect(() => {
    if (values.length > prevLength.current) {
      inputRefs.current[values.length - 1]?.focus();
    }
    prevLength.current = values.length;
  }, [values.length]);

  const parsedEntries = values
    .map((v, i) => ({ v: parseFloat(v), m: mimic[i] ?? false }))
    .filter(({ v }) => !isNaN(v) && (columnConfig.key === 'red' || v > 0));
  const parsedValues = parsedEntries.map(({ v }) => v);
  const parsedMimic = parsedEntries.map(({ m }) => m);

  const hasInvalidValue = values.some(
    (v) => v !== '' && !isValidDieValue(columnConfig.key, v, expansion, roundIndex)
  );

  const previewData: CellData = { values: parsedValues, glitter, mimic: parsedMimic.some(Boolean) ? parsedMimic : undefined };
  const previewScore = parsedValues.length > 0 ? columnConfig.score(previewData) : null;

  function addDie() {
    setValues((prev) => [...prev, '']);
    setMimic((prev) => [...prev, false]);
  }

  function removeDie(index: number) {
    setValues((prev) => prev.filter((_, i) => i !== index));
    setMimic((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMimic(index: number, val: boolean) {
    setMimic((prev) => { const next = [...prev]; next[index] = val; return next; });
  }

  function updateDie(index: number, val: string) {
    setValues((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  }

  function currentData(): CellData | null {
    if (parsedValues.length === 0) return null;
    return {
      values: parsedValues,
      glitter: columnConfig.key === 'blue' ? glitter : undefined,
      mimic: columnConfig.key === 'red' && parsedMimic.some(Boolean) ? parsedMimic : undefined,
    };
  }

  function handleSave() {
    onSave(currentData());
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    onSwipe?.(delta < 0 ? 'left' : 'right', currentData());
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && handleSave()}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className={`${columnConfig.headerBg} rounded-t-xl px-5 py-3`}>
          <h2 className="text-lg font-bold">
            Round {roundIndex + 1} — {columnConfig.label}
          </h2>
          <p className="text-xs opacity-75 mt-0.5">{columnConfig.rule}</p>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Dice Rolled</label>
            {values.map((val, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-14 shrink-0">Die {i + 1}:</span>
                {expansion && columnConfig.key === 'red' && (
                  <label className="flex items-center gap-1 cursor-pointer select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={mimic[i] ?? false}
                      onChange={(e) => updateMimic(i, e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-red-500"
                    />
                    <span className="text-xs text-gray-500">Mimic</span>
                  </label>
                )}
                <input
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="number"
                  min={columnConfig.key === 'red' ? undefined : 1}
                  value={val}
                  onChange={(e) => updateDie(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === '.' || e.key === ',') { e.preventDefault(); return; }
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      onSwipe?.(e.shiftKey ? 'right' : 'left', currentData());
                      return;
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (i < values.length - 1) {
                        inputRefs.current[i + 1]?.focus();
                      } else {
                        addDie();
                      }
                    }
                  }}
                  className={`border rounded-md px-3 py-1.5 w-24 text-center focus:outline-none focus:ring-2 focus:border-transparent ${
                    !isValidDieValue(columnConfig.key, val, expansion, roundIndex)
                      ? 'border-red-400 focus:ring-red-400 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-400'
                  }`}
                  placeholder="—"
                  autoFocus={i === values.length - 1 && !!existing || i === 0 && !existing}
                />
                {values.length > 1 && (
                  <button
                    onClick={() => removeDie(i)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="Remove die"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addDie}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors mt-1"
            >
              + Add die
            </button>
          </div>

          {/* Glitter checkbox — blue only */}
          {columnConfig.key === 'blue' && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={glitter}
                onChange={(e) => setGlitter(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">✨ Glitter die (doubles score)</span>
            </label>
          )}

          {/* Score preview */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-center min-h-[56px] flex items-center justify-center">
            {previewScore !== null ? (
              <>
                <span className="text-sm text-gray-500 mr-2">Score:</span>
                <span className="text-2xl font-bold text-gray-900">{previewScore}</span>
              </>
            ) : (
              <span className="text-sm text-gray-400">Enter dice values above</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-between gap-2">
          <div>
            {existing && (
              <button
                onClick={() => onSave(null)}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={hasInvalidValue}
              className="px-4 py-2 text-sm bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
