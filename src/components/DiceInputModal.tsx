import { useState } from 'react';
import type { CellData, DiceColor } from '../types';

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
  columnConfig: ColumnConfig;
  onSave: (data: CellData | null) => void;
  onClose: () => void;
}

export function DiceInputModal({ roundIndex, existing, defaultDiceCount, defaultGlitter, columnConfig, onSave, onClose }: Props) {
  const [values, setValues] = useState<string[]>(
    existing?.values.map(String) ?? Array(defaultDiceCount).fill('')
  );
  const [glitter, setGlitter] = useState(existing?.glitter ?? defaultGlitter);

  const parsedValues = values
    .map((v) => parseFloat(v))
    .filter((v) => !isNaN(v) && (columnConfig.key === 'red' || v > 0));

  const previewData: CellData = { values: parsedValues, glitter };
  const previewScore = parsedValues.length > 0 ? columnConfig.score(previewData) : null;

  function addDie() {
    setValues((prev) => [...prev, '']);
  }

  function removeDie(index: number) {
    setValues((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDie(index: number, val: string) {
    setValues((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  }

  function handleSave() {
    if (parsedValues.length === 0) {
      onSave(null);
    } else {
      onSave({
        values: parsedValues,
        glitter: columnConfig.key === 'blue' ? glitter : undefined,
      });
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && handleSave()}
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
                <input
                  type="number"
                  min={columnConfig.key === 'red' ? undefined : 1}
                  value={val}
                  onChange={(e) => updateDie(i, e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 w-24 text-center focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  placeholder="—"
                  autoFocus={i === 0 && !existing}
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
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
