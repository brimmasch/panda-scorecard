import { useState } from 'react';
import { Mic } from 'lucide-react';
import { DiceInputModal } from './components/DiceInputModal';
import { COLUMNS, BLACK_COLUMN, calcRowTotal, calcGrandTotal, formatTimestamp, sum } from './gameLogic';
import { useGameHistory } from './hooks/useGameHistory';
import { useSpeechInput } from './hooks/useSpeechInput';
import type { CellData, DiceColor } from './types';

export default function App() {
  const { rounds, setRounds, history, currentId, expansion, setExpansion, handleNewGame, handleRestoreGame } = useGameHistory();
  const { listening, interimTranscript, handleVoiceInput } = useSpeechInput(rounds, setRounds, expansion);
  const [editing, setEditing] = useState<{ roundIndex: number; color: DiceColor } | null>(null);
  const [confirmClearRound, setConfirmClearRound] = useState<number | null>(null);

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

  // Save current cell and move to the adjacent non-disabled column (mobile swipe)
  function handleSwipeNavigate(direction: 'left' | 'right', data: CellData | null) {
    if (!editing) return;
    setRounds((prev) => {
      const next = [...prev];
      const round = { ...next[editing.roundIndex] };
      if (data === null || data.values.length === 0) {
        delete round[editing.color];
      } else {
        round[editing.color] = data;
      }
      next[editing.roundIndex] = round;
      return next;
    });
    const navCols = expansion ? [...COLUMNS, BLACK_COLUMN] : COLUMNS;
    const currentIndex = navCols.findIndex((c) => c.key === editing.color);
    const step = direction === 'left' ? 1 : -1;
    for (let i = currentIndex + step; i >= 0 && i < navCols.length; i += step) {
      const col = navCols[i];
      if (editing.roundIndex === 0 && col.key !== 'yellow') continue;
      setEditing({ roundIndex: editing.roundIndex, color: col.key });
      return;
    }
    setEditing(null);
  }

  function getDefaultDiceCount(roundIndex: number, color: DiceColor): number {
    for (let i = roundIndex - 1; i >= 0; i--) {
      const cell = rounds[i][color];
      if (cell && cell.values.length > 0) return cell.values.length;
    }
    return 1;
  }

  function getPreviousRedMimic(roundIndex: number): boolean[] | undefined {
    for (let i = roundIndex - 1; i >= 0; i--) {
      const cell = rounds[i]['red'];
      if (cell && cell.mimic) return cell.mimic;
    }
    return undefined;
  }

  function getPreviousBlack(roundIndex: number): CellData | null {
    for (let i = roundIndex - 1; i >= 0; i--) {
      const cell = rounds[i]['black'];
      if (cell && cell.values.length > 0) return cell;
    }
    return null;
  }

  function getDefaultGlitter(roundIndex: number): boolean {
    for (let i = roundIndex - 1; i >= 0; i--) {
      const cell = rounds[i]['blue'];
      if (cell) return cell.glitter ?? false;
    }
    return false;
  }

  const grandTotal = calcGrandTotal(rounds);
  const editingColumn = editing
    ? (editing.color === 'black' ? BLACK_COLUMN : COLUMNS.find((c) => c.key === editing.color)!)
    : null;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 flex justify-start">
            <button
              onClick={() => setExpansion((e) => !e)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg border-2 border-slate-800 transition-colors ${
                expansion
                  ? 'bg-slate-800 text-white hover:bg-slate-700'
                  : 'bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              Expansion
            </button>
          </div>
          <h1 className="text-4xl font-black tracking-widest uppercase text-slate-800 text-center flex-1 sm:whitespace-nowrap">
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
          <table className="w-full table-fixed border-collapse bg-white text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border border-slate-200 px-2 py-3 bg-slate-100 text-slate-600 text-center w-14 font-semibold">
                  Rnd
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`border border-slate-200 px-1 sm:px-2 py-2 ${col.headerBg} text-center`}
                  >
                    <div className="font-bold text-slate-800">
                      <span className="sm:hidden">{col.shortLabel}</span>
                      <span className="hidden sm:inline">{col.label}</span>
                    </div>
                    <div className="hidden sm:block text-xs font-normal text-slate-600 mt-0.5 leading-tight">
                      {col.rule}
                    </div>
                  </th>
                ))}
                {expansion && (
                  <th className="border border-slate-200 px-1 sm:px-2 py-2 bg-slate-800 text-center">
                    <div className="font-bold text-white">
                      <span className="sm:hidden">Bk</span>
                      <span className="hidden sm:inline">Black</span>
                    </div>
                    <div className="hidden sm:block text-xs font-normal text-slate-300 mt-0.5 leading-tight">
                      Number of Rerolls
                    </div>
                  </th>
                )}
                <th className="border border-slate-200 px-1 py-3 bg-slate-200 text-slate-700 text-center font-semibold w-16">
                  =
                </th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round, roundIndex) => {
                const rowTotal = calcRowTotal(round);
                const hasAnyEntry = COLUMNS.some((col) => round[col.key] !== undefined);
                const totalDice = COLUMNS.reduce((n, col) => n + (round[col.key]?.values.length ?? 0), 0)
                  + (expansion ? (round['black']?.values.length ?? 0) : 0);
                const pinkDiceCount = round['pink']?.values.length ?? 0;
                // Dice count rules: round 1 = exactly n, rounds 2-10 = n or n+1, rounds 6-10 (expansion only) = n, n+1, or n+2
                // Bonus dice (n+1 or n+2) require matching pink dice count
                const expectedDice = roundIndex + 1;
                const maxDice = expansion && roundIndex >= 5 ? expectedDice + 2 : roundIndex >= 1 ? expectedDice + 1 : expectedDice;
                const diceCountOk = hasAnyEntry && totalDice >= expectedDice && totalDice <= maxDice;
                const bonusDice = diceCountOk ? totalDice - expectedDice : 0;
                const pinkOk = bonusDice === 0 || pinkDiceCount === bonusDice;
                const invalid = hasAnyEntry && (!diceCountOk || !pinkOk);
                // Rainbow row animation: slow for n+1, fast+pulsing for n+2
                const rainbowClass = !invalid && bonusDice === 2 ? 'rainbow-row-fast' : !invalid && bonusDice === 1 ? 'rainbow-row' : '';
                return (
                  <tr key={roundIndex} className={`group${rainbowClass ? ` ${rainbowClass}` : ''}`}>
                    <td
                      className={`sticky left-0 z-10 border border-slate-200 px-2 py-2.5 text-center font-semibold text-slate-500 ${rainbowClass ? '' : invalid ? 'bg-pink-50' : 'bg-slate-50'} ${hasAnyEntry ? 'cursor-pointer hover:bg-red-50 hover:text-red-400' : ''}`}
                      style={rainbowClass ? { background: 'transparent' } : undefined}
                      onClick={() => {
                        if (!hasAnyEntry) return;
                        setConfirmClearRound(roundIndex);
                      }}
                      title={hasAnyEntry ? `Clear Round ${roundIndex + 1}` : undefined}
                    >
                      {roundIndex + 1}
                    </td>
                    {COLUMNS.map((col) => {
                      const cell = round[col.key];
                      const score = cell !== undefined ? col.score(cell) : null;
                      const disabled = roundIndex === 0 && col.key !== 'yellow';
                      return (
                        <td
                          key={col.key}
                          className={`border border-slate-200 px-1 sm:px-2 py-2.5 text-center transition-colors ${disabled
                            ? `${invalid ? 'bg-pink-100' : 'bg-slate-100'} cursor-not-allowed`
                            : `cursor-pointer ${invalid ? 'bg-pink-50 hover:bg-pink-100' : col.cellBg}`
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
                    {expansion && (() => {
                      const blackDisabled = roundIndex === 0;
                      return (
                        <td
                          className={`border border-slate-200 px-1 sm:px-2 py-2.5 text-center transition-colors ${
                            blackDisabled
                              ? `${invalid ? 'bg-pink-100' : 'bg-slate-100'} cursor-not-allowed`
                              : `cursor-pointer ${invalid ? 'bg-pink-50 hover:bg-pink-100' : 'hover:bg-slate-100 bg-slate-50'}`
                          }`}
                          onClick={blackDisabled ? undefined : () => setEditing({ roundIndex, color: 'black' })}
                          title={blackDisabled ? 'Not available in Round 1' : `Round ${roundIndex + 1} — Black`}
                        >
                          {blackDisabled ? (
                            <span className="text-slate-300 text-xs select-none">✕</span>
                          ) : round['black'] ? (
                            <span className="font-semibold text-slate-800">{sum(round['black'].values)}</span>
                          ) : (
                            <span className="text-slate-300 text-xs select-none">—</span>
                          )}
                        </td>
                      );
                    })()}
                    <td className={`border border-slate-200 px-1 py-2.5 text-center font-bold w-16 ${invalid ? 'bg-pink-50' : 'bg-slate-50'}`}>
                      {invalid ? (
                        <span className="text-xs font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {`🎲${!diceCountOk
                            ? totalDice > maxDice ? `+${totalDice - maxDice}` : `${totalDice - expectedDice}`
                            : `+${bonusDice}`}`}
                        </span>
                      ) : hasAnyEntry ? (
                        <span className="text-slate-800">{rowTotal}</span>
                      ) : ''}
                    </td>
                  </tr>
                );
              })}

              {/* Grand total row */}
              <tr className="bg-slate-100 border-t-2 border-slate-300">
                <td
                  colSpan={COLUMNS.length + 1 + (expansion ? 1 : 0)}
                  className="border border-slate-200 px-4 py-3 font-bold text-slate-600 uppercase tracking-wide text-sm"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleVoiceInput}
                      title="Voice input — say e.g. 'yellow 5 purple 3 green 2'"
                      className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors ${listening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-slate-300 text-slate-600 hover:bg-slate-400'
                        }`}
                    >
                      <Mic size={14} />
                    </button>
                    {(listening || interimTranscript) && (
                      <span className="text-xs font-normal text-slate-500 normal-case tracking-normal truncate">
                        {interimTranscript || 'Listening…'}
                      </span>
                    )}
                    <span className={`text-right ${listening ? 'ml-auto' : 'flex-1'}`}>
                      Grand Total
                    </span>
                  </div>
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

        {/* Voice input help */}
        <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="font-bold text-slate-700 mb-2 text-sm uppercase tracking-wide flex items-center gap-2">
            <Mic size={14} className="text-slate-500" /> Voice Input
          </h2>
          <p className="text-sm text-slate-600 mb-2">
            Tap the mic button in the Grand Total row to fill the next empty round by voice. Say each die's color and value — repeat a color for multiple dice:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
            <li><span className="font-mono bg-slate-100 px-1 rounded">yellow 6 yellow 5 purple 1 red -4</span></li>
            <li><span className="font-mono bg-slate-100 px-1 rounded">6 yellow 5 yellow 1 purple -4 red</span></li>
          </ul>
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
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center justify-between gap-4 ${isCurrent
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

      {/* Confirm Clear Round Modal */}
      {confirmClearRound !== null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setConfirmClearRound(null)}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="bg-slate-100 rounded-t-xl px-5 py-3">
              <h2 className="text-lg font-bold text-slate-800">Clear Round {confirmClearRound + 1}</h2>
              <p className="text-xs text-slate-500 mt-0.5">This will remove all dice values for this round.</p>
            </div>
            <div className="px-5 pb-5 pt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmClearRound(null)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setRounds((prev) => {
                    const next = [...prev];
                    next[confirmClearRound] = {};
                    return next;
                  });
                  setConfirmClearRound(null);
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {editing && editingColumn && (
        <DiceInputModal
          key={`${editing.roundIndex}-${editing.color}`}
          roundIndex={editing.roundIndex}
          existing={rounds[editing.roundIndex][editing.color] ?? (editing.color === 'black' ? getPreviousBlack(editing.roundIndex) : null)}
          defaultDiceCount={getDefaultDiceCount(editing.roundIndex, editing.color)}
          defaultGlitter={getDefaultGlitter(editing.roundIndex)}
          defaultMimic={editing.color === 'red' ? getPreviousRedMimic(editing.roundIndex) : undefined}
          columnConfig={editingColumn}
          expansion={expansion}
          onSave={(data) => handleSave(editing.roundIndex, editing.color, data)}
          onClose={() => setEditing(null)}
          onSwipe={handleSwipeNavigate}
        />
      )}
    </div>
  );
}
