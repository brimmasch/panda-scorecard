import { useState, useRef } from 'react';
import { COLUMNS } from '../gameLogic';
import type { DiceColor, RoundData } from '../types';

const COLOR_NAMES: Record<string, DiceColor> = {
  yellow: 'yellow', purple: 'purple', blue: 'blue', red: 'red',
  green: 'green', clear: 'clear', pink: 'pink', black: 'black',
};

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const NEGATIVE_WORDS = new Set(['negative', 'minus']);

// Common speech-recognition mishearings → canonical form
const WORD_REPLACEMENTS: Record<string, string> = {
  read: 'red',
  to: 'two', too: 'two',
  for: 'four', fore: 'four',
  won: 'one',
  ate: 'eight',
  tree: 'three', free: 'three',
  sex: 'six',
};

function resolveNum(token: string): number {
  if (WORD_NUMBERS[token] !== undefined) return WORD_NUMBERS[token];
  return parseFloat(token);
}

function applyReplacements(text: string): string {
  const words = text.split(/\s+/).map((w) => {
    const key = w.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return WORD_REPLACEMENTS[key] ?? key;
  });
  const result: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
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

export function useSpeechInput(
  rounds: RoundData[],
  setRounds: React.Dispatch<React.SetStateAction<RoundData[]>>,
  expansion: boolean
) {
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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
        // Carry over black dice from previous round if expansion is on and user didn't say black
        if (expansion && !parsed['black'] && targetIndex > 0) {
          const prevBlack = prev[targetIndex - 1]['black'];
          if (prevBlack) round['black'] = prevBlack;
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

  return { listening, interimTranscript, handleVoiceInput };
}
