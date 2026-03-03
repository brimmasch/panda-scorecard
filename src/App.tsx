import { useState } from 'react';
import { DiceInputModal } from './components/DiceInputModal';
import type { CellData, DiceColor, RoundData } from './types';

const sum = (vals: number[]) => vals.reduce((a, b) => a + b, 0);

const COLUMNS: Array<{
  key: DiceColor;
  label: string;
  rule: string;
  headerBg: string;
  cellBg: string;
  score: (cell: CellData) => number;
}> = [
  {
    key: 'yellow',
    label: 'Yellow',
    rule: 'Sum of Yellow',
    headerBg: 'bg-yellow-300',
    cellBg: 'hover:bg-yellow-50',
    score: (c) => sum(c.values),
  },
  {
    key: 'purple',
    label: 'Purple',
    rule: 'Sum of Purple ×2',
    headerBg: 'bg-purple-300',
    cellBg: 'hover:bg-purple-50',
    score: (c) => sum(c.values) * 2,
  },
  {
    key: 'blue',
    label: 'Blue',
    rule: 'Sum of Blue (×2 if Glitter)',
    headerBg: 'bg-blue-300',
    cellBg: 'hover:bg-blue-50',
    score: (c) => sum(c.values) * (c.glitter ? 2 : 1),
  },
  {
    key: 'red',
    label: 'Red',
    rule: 'Sum of Red × # of Red',
    headerBg: 'bg-red-300',
    cellBg: 'hover:bg-red-50',
    score: (c) => sum(c.values) * c.values.length,
  },
  {
    key: 'green',
    label: 'Green',
    rule: 'Sum of Green',
    headerBg: 'bg-green-300',
    cellBg: 'hover:bg-green-50',
    score: (c) => sum(c.values),
  },
  {
    key: 'clear',
    label: 'Clear',
    rule: 'Sum of Clear',
    headerBg: 'bg-gray-200',
    cellBg: 'hover:bg-gray-50',
    score: (c) => sum(c.values),
  },
  {
    key: 'pink',
    label: 'Pink',
    rule: 'Sum of Pink',
    headerBg: 'bg-pink-200',
    cellBg: 'hover:bg-pink-50',
    score: (c) => sum(c.values),
  },
];

type GameRecord = {
  id: string;
  timestamp: Date;
  rounds: RoundData[];
};

function emptyRounds(): RoundData[] {
  return Array.from({ length: 10 }, () => ({}));
}

function hasData(rounds: RoundData[]): boolean {
  return rounds.some((round) => COLUMNS.some((col) => round[col.key] !== undefined));
}

function calcRowTotal(round: RoundData): number {
  return COLUMNS.reduce((total, col) => {
    const cell = round[col.key];
    return total + (cell ? col.score(cell) : 0);
  }, 0);
}

function calcGrandTotal(rounds: RoundData[]): number {
  return rounds.reduce((total, round) => total + calcRowTotal(round), 0);
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Saves current rounds into history (create or update). Returns updated history.
function commitToHistory(
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

export default function App() {
  const [rounds, setRounds] = useState<RoundData[]>(emptyRounds());
  const [history, setHistory] = useState<GameRecord[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ roundIndex: number; color: DiceColor } | null>(null);

  function handleSave(roundIndex: number, color: DiceColor, data: CellData | null) {
    setRounds((prev) => {
      const next = [...prev];
      const round = { ...next[roundIndex] };
      if (data === null || data.values.length === 0) {
        delete round[color];
      } else {
        round[color] = data;
      }
      next[roundIndex] = round;
      return next;
    });
    setEditing(null);
  }

  function handleNewGame() {
    setHistory((prev) => commitToHistory(rounds, currentId, prev));
    setRounds(emptyRounds());
    setCurrentId(null);
  }

  function handleRestoreGame(record: GameRecord) {
    if (record.id === currentId) return;
    setHistory((prev) => commitToHistory(rounds, currentId, prev));
    setRounds(record.rounds);
    setCurrentId(record.id);
  }

  function getDefaultDiceCount(roundIndex: number, color: DiceColor): number {
    for (let i = roundIndex - 1; i >= 0; i--) {
      const cell = rounds[i][color];
      if (cell && cell.values.length > 0) return cell.values.length;
    }
    return 1;
  }

  function getDefaultGlitter(roundIndex: number): boolean {
    for (let i = roundIndex - 1; i >= 0; i--) {
      const cell = rounds[i]['blue'];
      if (cell) return cell.glitter ?? false;
    }
    return false;
  }

  const grandTotal = calcGrandTotal(rounds);
  const editingColumn = editing ? COLUMNS.find((c) => c.key === editing.color)! : null;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1" />
          <h1 className="text-4xl font-black tracking-widest uppercase text-slate-800 text-center flex-1">
            🐼 Panda Royale
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleNewGame}
              className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors"
            >
              New Game
            </button>
          </div>
        </div>

        {/* Scorecard */}
        <div className="overflow-x-auto rounded-xl shadow-lg border border-slate-200">
          <table className="w-full border-collapse bg-white text-sm">
            <thead>
              <tr>
                <th className="border border-slate-200 px-3 py-3 bg-slate-100 text-slate-600 text-center w-12 font-semibold">
                  Rnd
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`border border-slate-200 px-2 py-2 ${col.headerBg} text-center`}
                  >
                    <div className="font-bold text-slate-800">{col.label}</div>
                    <div className="text-xs font-normal text-slate-600 mt-0.5 leading-tight">
                      {col.rule}
                    </div>
                  </th>
                ))}
                <th className="border border-slate-200 px-3 py-3 bg-slate-200 text-slate-700 text-center font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round, roundIndex) => {
                const rowTotal = calcRowTotal(round);
                const hasAnyEntry = COLUMNS.some((col) => round[col.key] !== undefined);
                return (
                  <tr key={roundIndex} className="group">
                    <td className="border border-slate-200 px-3 py-2.5 text-center font-semibold text-slate-500 bg-slate-50">
                      {roundIndex + 1}
                    </td>
                    {COLUMNS.map((col) => {
                      const cell = round[col.key];
                      const score = cell !== undefined ? col.score(cell) : null;
                      const disabled = roundIndex === 0 && col.key !== 'yellow';
                      return (
                        <td
                          key={col.key}
                          className={`border border-slate-200 px-2 py-2.5 text-center transition-colors ${
                            disabled
                              ? 'bg-slate-100 cursor-not-allowed'
                              : `cursor-pointer ${col.cellBg}`
                          }`}
                          onClick={disabled ? undefined : () => setEditing({ roundIndex, color: col.key })}
                          title={disabled ? 'Not available in Round 1' : `Round ${roundIndex + 1} — ${col.label}`}
                        >
                          {disabled ? (
                            <span className="text-slate-300 text-xs select-none">✕</span>
                          ) : score !== null ? (
                            <span className="font-semibold text-slate-800">{score}</span>
                          ) : (
                            <span className="text-slate-300 text-xs select-none">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-slate-200 px-3 py-2.5 text-center font-bold text-slate-800 bg-slate-50">
                      {hasAnyEntry ? rowTotal : ''}
                    </td>
                  </tr>
                );
              })}

              {/* Grand total row */}
              <tr className="bg-slate-100 border-t-2 border-slate-300">
                <td
                  colSpan={COLUMNS.length + 1}
                  className="border border-slate-200 px-4 py-3 text-right font-bold text-slate-600 uppercase tracking-wide text-sm"
                >
                  Grand Total
                </td>
                <td className="border border-slate-200 px-3 py-3 text-center font-black text-xl text-slate-900 bg-slate-200">
                  {grandTotal > 0 ? grandTotal : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Rules reference */}
        <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="font-bold text-slate-700 mb-2 text-sm uppercase tracking-wide">Turn Order</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
            <li>Roll dice and calculate score</li>
            <li>Determine which players earn the pity die</li>
            <li>Trade dice</li>
            <li>Choose a new die</li>
          </ol>
        </div>

        {/* Game history */}
        {history.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">Game History</h2>
            <ul className="space-y-2">
              {[...history].reverse().map((record) => {
                const isCurrent = record.id === currentId;
                return (
                  <li key={record.id}>
                    <button
                      onClick={() => handleRestoreGame(record)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center justify-between gap-4 ${
                        isCurrent
                          ? 'border-slate-400 bg-slate-50 cursor-default'
                          : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-sm text-slate-600">{formatTimestamp(record.timestamp)}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-800">
                          Score: {calcGrandTotal(record.rounds)}
                        </span>
                        {isCurrent && (
                          <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                            current
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Modal */}
      {editing && editingColumn && (
        <DiceInputModal
          roundIndex={editing.roundIndex}
          existing={rounds[editing.roundIndex][editing.color] ?? null}
          defaultDiceCount={getDefaultDiceCount(editing.roundIndex, editing.color)}
          defaultGlitter={getDefaultGlitter(editing.roundIndex)}
          columnConfig={editingColumn}
          onSave={(data) => handleSave(editing.roundIndex, editing.color, data)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
