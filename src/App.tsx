import { useState, useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';
import { DiceInputModal } from './components/DiceInputModal';
import type { CellData, DiceColor, RoundData } from './types';

// ─── Voice input: color/number lookup tables ─────────────────────────────────

const COLOR_NAMES: Record<string, DiceColor> = {
  yellow: 'yellow', purple: 'purple', blue: 'blue', red: 'red',
  green: 'green', clear: 'clear', pink: 'pink',
};

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const NEGATIVE_WORDS = new Set(['negative', 'minus']);

// Common speech-recognition mishearings → canonical form
const WORD_REPLACEMENTS: Record<string, string> = {
  // color homophones
  read: 'red',
  // number homophones
  to: 'two', too: 'two',
  for: 'four', fore: 'four',
  won: 'one',
  ate: 'eight',
  tree: 'three', free: 'three',
  sex: 'six',
};

// Resolve a token to a number, returning NaN if not a number
function resolveNum(token: string): number {
  if (WORD_NUMBERS[token] !== undefined) return WORD_NUMBERS[token];
  return parseFloat(token);
}

// Apply word replacements and convert number-words to digits for display
function applyReplacements(text: string): string {
  const words = text.split(/\s+/).map((w) => {
    const key = w.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return WORD_REPLACEMENTS[key] ?? key;
  });
  const result: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // "negative/minus N" → "-N"
    if (NEGATIVE_WORDS.has(w) && i + 1 < words.length) {
      const mag = resolveNum(words[i + 1]);
      if (!isNaN(mag) && mag >= 0) { result.push(String(-mag)); i++; continue; }
    }
    const num = WORD_NUMBERS[w];
    result.push(num !== undefined ? String(num) : w);
  }
  return result.join(' ');
}

// Parse a spoken transcript into a map of color → [values].
// Supports "color number", "number color", and "color negative/minus number" patterns.
// Repeated colors accumulate multiple values (e.g. "yellow 6 yellow 5").
function parseSpeechTranscript(transcript: string): Partial<Record<DiceColor, number[]>> {
  const result: Partial<Record<DiceColor, number[]>> = {};
  const push = (color: DiceColor, num: number) => {
    if (!result[color]) result[color] = [];
    result[color]!.push(num);
  };
  const tokens = transcript.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/)
    .map((t) => WORD_REPLACEMENTS[t] ?? t);
  let i = 0;
  while (i < tokens.length) {
    const color = COLOR_NAMES[tokens[i]];
    if (color) {
      // "color [negative/minus] number" pattern
      if (i + 1 < tokens.length) {
        let num: number;
        let consumed: number;
        if (NEGATIVE_WORDS.has(tokens[i + 1]) && i + 2 < tokens.length) {
          const mag = resolveNum(tokens[i + 2]);
          num = !isNaN(mag) ? -Math.abs(mag) : NaN;
          consumed = 2;
        } else {
          num = resolveNum(tokens[i + 1]);
          consumed = 1;
        }
        if (!isNaN(num)) { push(color, num); i += 1 + consumed; continue; }
      }
    } else {
      // "number color" pattern
      const num = resolveNum(tokens[i]);
      if (!isNaN(num) && i + 1 < tokens.length) {
        const nextColor = COLOR_NAMES[tokens[i + 1]];
        if (nextColor) { push(nextColor, num); i += 2; continue; }
      }
    }
    i++;
  }
  return result;
}

const sum = (vals: number[]) => vals.reduce((a, b) => a + b, 0);

const COLUMNS: Array<{
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
      score: (c) => sum(c.values) * c.values.length,
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

// ─── Persistence ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'panda-royale';

// Load rounds, history, and currentId from localStorage on startup
function loadState(): { rounds: RoundData[]; history: GameRecord[]; currentId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rounds: emptyRounds(), history: [], currentId: null };
    const parsed = JSON.parse(raw);
    return {
      rounds: parsed.rounds ?? emptyRounds(),
      history: (parsed.history ?? []).map((e: GameRecord & { timestamp: string }) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })),
      currentId: parsed.currentId ?? null,
    };
  } catch {
    return { rounds: emptyRounds(), history: [], currentId: null };
  }
}

export default function App() {
  const saved = loadState();
  const [rounds, setRounds] = useState<RoundData[]>(saved.rounds);
  const [history, setHistory] = useState<GameRecord[]>(saved.history);
  const [currentId, setCurrentId] = useState<string | null>(saved.currentId);
  const [editing, setEditing] = useState<{ roundIndex: number; color: DiceColor } | null>(null);
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confirmClearRound, setConfirmClearRound] = useState<number | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rounds, history, currentId }));
  }, [rounds, history, currentId]);

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
    const currentIndex = COLUMNS.findIndex((c) => c.key === editing.color);
    const step = direction === 'left' ? 1 : -1;
    for (let i = currentIndex + step; i >= 0 && i < COLUMNS.length; i += step) {
      const col = COLUMNS[i];
      if (editing.roundIndex === 0 && col.key !== 'yellow') continue;
      setEditing({ roundIndex: editing.roundIndex, color: col.key });
      return;
    }
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

  // ─── Voice input ───────────────────────────────────────────────────────────
  // Starts Web Speech API recognition; restarts automatically until 2s of silence.
  // Uses continuous=false + manual restart for Android compatibility.
  // Fills the next empty round with parsed color/value pairs.
  function handleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Speech recognition is not supported in this browser.'); return; }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    setInterimTranscript('');

    const targetIndex = rounds.findIndex((round) => !COLUMNS.some((col) => round[col.key] !== undefined));
    if (targetIndex === -1) { alert('All rounds are filled in.'); return; }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    let shouldContinue = true;
    let lastSpeechTime = 0;

    const finish = () => {
      shouldContinue = false;
      recognition.stop();
    };

    // Poll every 250ms — stops when 2s have elapsed since last onresult
    const silencePoller = setInterval(() => {
      if (lastSpeechTime > 0 && Date.now() - lastSpeechTime >= 2000) {
        clearInterval(silencePoller);
        finish();
      }
    }, 250);

    recognition.onstart = () => setListening(true);

    recognition.onend = () => {
      if (shouldContinue) {
        recognition.start();
        return;
      }
      clearInterval(silencePoller);
      setListening(false);
      const parsed = parseSpeechTranscript(finalTranscript);
      if (Object.keys(parsed).length === 0) return;
      setRounds((prev) => {
        const next = [...prev];
        const round = { ...next[targetIndex] };
        for (const [colorKey, values] of Object.entries(parsed) as [DiceColor, number[]][]) {
          if (targetIndex === 0 && colorKey !== 'yellow') continue;
          round[colorKey] = { values };
        }
        next[targetIndex] = round;
        return next;
      });
    };

    recognition.onerror = () => {
      shouldContinue = false;
      clearInterval(silencePoller);
      setListening(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      lastSpeechTime = Date.now();
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimTranscript(applyReplacements(finalTranscript + interim));
    };

    recognition.start();
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
                <th className="border border-slate-200 px-1 py-3 bg-slate-200 text-slate-700 text-center font-semibold w-16">
                  =
                </th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round, roundIndex) => {
                const rowTotal = calcRowTotal(round);
                const hasAnyEntry = COLUMNS.some((col) => round[col.key] !== undefined);
                const totalDice = COLUMNS.reduce((n, col) => n + (round[col.key]?.values.length ?? 0), 0);
                const pinkDiceCount = round['pink']?.values.length ?? 0;
                // Dice count rules: round 1 = exactly n, rounds 2-5 = n or n+1, rounds 6-10 = n, n+1, or n+2
                // Bonus dice (n+1 or n+2) require matching pink dice count
                const expectedDice = roundIndex + 1;
                const maxDice = roundIndex >= 5 ? expectedDice + 2 : roundIndex >= 1 ? expectedDice + 1 : expectedDice;
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
                  colSpan={COLUMNS.length + 1}
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
                    next[confirmClearRound] = {} as RoundData;
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
          existing={rounds[editing.roundIndex][editing.color] ?? null}
          defaultDiceCount={getDefaultDiceCount(editing.roundIndex, editing.color)}
          defaultGlitter={getDefaultGlitter(editing.roundIndex)}
          columnConfig={editingColumn}
          onSave={(data) => handleSave(editing.roundIndex, editing.color, data)}
          onClose={() => setEditing(null)}
          onSwipe={handleSwipeNavigate}
        />
      )}
    </div>
  );
}
