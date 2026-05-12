// transpose.js — music transposition utilities
export const TONOS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const ENHARMONIC = {
  'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B',
};

function noteToIndex(note) {
  const n = ENHARMONIC[note] || note;
  return TONOS.indexOf(n);
}

function indexToNote(idx) {
  return TONOS[((idx % 12) + 12) % 12];
}

export function semitonesBetween(from, to) {
  const a = noteToIndex(from);
  const b = noteToIndex(to);
  if (a === -1 || b === -1) return 0;
  return ((b - a) + 12) % 12;
}

export function transposeLyrics(text, semitones) {
  if (!semitones || !text) return text;
  return text.replace(/\[([^\]]+)\]/g, (match, chord) => {
    const rootMatch = chord.match(/^([A-G][#b]?)/);
    if (!rootMatch) return match;
    const root = rootMatch[1];
    const idx = noteToIndex(root);
    if (idx === -1) return match;
    const newRoot = indexToNote(idx + semitones);
    return '[' + chord.replace(root, newRoot) + ']';
  });
}

export function detectKey(input) {
  if (!input) return 'C';
  // Accept both a string (lyrics with [Chord] markers) and an array of chord names
  const list = Array.isArray(input)
    ? input
    : [...String(input).matchAll(/\[([A-G][#b]?[^\]]*)\]/g)].map(m => m[1]);
  if (!list.length) return 'C';
  const counts = {};
  list.forEach(c => {
    const m = String(c).match(/^([A-G][#b]?)/);
    if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'C';
}
