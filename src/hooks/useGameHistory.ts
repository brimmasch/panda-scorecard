import { useState, useEffect } from 'react';
import { commitToHistory, emptyRounds } from '../gameLogic';
import type { GameRecord, RoundData } from '../types';

const STORAGE_KEY = 'panda-royale';

function loadState(): { rounds: RoundData[]; history: GameRecord[]; currentId: string | null; expansion: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rounds: emptyRounds(), history: [], currentId: null, expansion: false };
    const parsed = JSON.parse(raw);
    return {
      rounds: parsed.rounds ?? emptyRounds(),
      history: (parsed.history ?? []).map((e: GameRecord & { timestamp: string }) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })),
      currentId: parsed.currentId ?? null,
      expansion: parsed.expansion ?? false,
    };
  } catch {
    return { rounds: emptyRounds(), history: [], currentId: null, expansion: false };
  }
}

export function useGameHistory() {
  const saved = loadState();
  const [rounds, setRounds] = useState<RoundData[]>(saved.rounds);
  const [history, setHistory] = useState<GameRecord[]>(saved.history);
  const [currentId, setCurrentId] = useState<string | null>(saved.currentId);
  const [expansion, setExpansion] = useState(saved.expansion);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rounds, history, currentId, expansion }));
  }, [rounds, history, currentId, expansion]);

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

  return { rounds, setRounds, history, currentId, expansion, setExpansion, handleNewGame, handleRestoreGame };
}
