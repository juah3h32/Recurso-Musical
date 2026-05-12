// utils/chords.js
// frets: [E6, A5, D4, G3, B2, e1]  (cuerda 6=grave → cuerda 1=aguda)
// -1 = silenciada, 0 = al aire, 1-12 = traste
// barre: traste del cejilla (opcional)

export const CHORD_DATA = {

  // ── C ─────────────────────────────────────────────────────────────────
  'C':     { frets: [-1, 3, 2, 0, 1, 0] },
  'Cm':    { frets: [-1, 3, 5, 5, 4, 3], barre: 3 },
  'C7':    { frets: [-1, 3, 2, 3, 1, 0] },
  'Cmaj7': { frets: [-1, 3, 2, 0, 0, 0] },
  'C9':    { frets: [-1, 3, 2, 0, 3, 0] },
  'Csus2': { frets: [-1, 3, 0, 0, 1, 3] },
  'Csus4': { frets: [-1, 3, 3, 0, 1, 1] },

  // ── C# / Db ───────────────────────────────────────────────────────────
  'C#':    { frets: [-1, 4, 6, 6, 6, 4], barre: 4 },
  'C#m':   { frets: [-1, 4, 6, 6, 5, 4], barre: 4 },
  'C#7':   { frets: [-1, 4, 3, 4, 2, 4] },
  'Db':    { frets: [-1, 4, 6, 6, 6, 4], barre: 4 },
  'Dbm':   { frets: [-1, 4, 6, 6, 5, 4], barre: 4 },

  // ── D ─────────────────────────────────────────────────────────────────
  'D':     { frets: [-1, -1, 0, 2, 3, 2] },
  'Dm':    { frets: [-1, -1, 0, 2, 3, 1] },
  'D7':    { frets: [-1, -1, 0, 2, 1, 2] },
  'Dmaj7': { frets: [-1, -1, 0, 2, 2, 2] },
  'Dm7':   { frets: [-1, -1, 0, 2, 1, 1] },
  'Dsus2': { frets: [-1, -1, 0, 2, 3, 0] },
  'Dsus4': { frets: [-1, -1, 0, 2, 3, 3] },
  'D9':    { frets: [-1, -1, 0, 2, 1, 0] },

  // ── D# / Eb ───────────────────────────────────────────────────────────
  'D#':    { frets: [-1, 6, 8, 8, 8, 6], barre: 6 },
  'D#m':   { frets: [-1, 6, 8, 8, 7, 6], barre: 6 },
  'Eb':    { frets: [-1, 6, 8, 8, 8, 6], barre: 6 },
  'Ebm':   { frets: [-1, 6, 8, 8, 7, 6], barre: 6 },

  // ── E ─────────────────────────────────────────────────────────────────
  'E':     { frets: [0, 2, 2, 1, 0, 0] },
  'Em':    { frets: [0, 2, 2, 0, 0, 0] },
  'E7':    { frets: [0, 2, 0, 1, 0, 0] },
  'Em7':   { frets: [0, 2, 2, 0, 3, 0] },
  'Emaj7': { frets: [0, 2, 1, 1, 0, 0] },
  'Esus4': { frets: [0, 2, 2, 2, 0, 0] },

  // ── F ─────────────────────────────────────────────────────────────────
  'F':     { frets: [1, 3, 3, 2, 1, 1], barre: 1 },
  'Fm':    { frets: [1, 3, 3, 1, 1, 1], barre: 1 },
  'F7':    { frets: [1, 3, 1, 2, 1, 1], barre: 1 },
  'Fmaj7': { frets: [1, 3, 3, 2, 1, 0], barre: 1 },
  'F7M':   { frets: [1, 3, 3, 2, 1, 0], barre: 1 },
  'Fsus2': { frets: [1, 3, 3, 0, 1, 1], barre: 1 },

  // ── F# / Gb ───────────────────────────────────────────────────────────
  'F#':    { frets: [2, 4, 4, 3, 2, 2], barre: 2 },
  'F#m':   { frets: [2, 4, 4, 2, 2, 2], barre: 2 },
  'F#7':   { frets: [2, 4, 2, 3, 2, 2], barre: 2 },
  'F#m7':  { frets: [2, 4, 2, 2, 2, 2], barre: 2 },
  'Gb':    { frets: [2, 4, 4, 3, 2, 2], barre: 2 },
  'Gbm':   { frets: [2, 4, 4, 2, 2, 2], barre: 2 },

  // ── G ─────────────────────────────────────────────────────────────────
  'G':     { frets: [3, 2, 0, 0, 0, 3] },   // posición abierta, sin shift
  'Gm':    { frets: [3, 5, 5, 3, 3, 3], barre: 3 },
  'G7':    { frets: [3, 2, 0, 0, 0, 1] },
  'Gmaj7': { frets: [3, 2, 0, 0, 0, 2] },
  'Gsus2': { frets: [3, 0, 0, 0, 3, 3] },
  'Gsus4': { frets: [3, 3, 0, 0, 1, 3] },
  'G9':    { frets: [3, 2, 0, 2, 0, 1] },

  // ── G# / Ab ───────────────────────────────────────────────────────────
  'G#':    { frets: [4, 6, 6, 5, 4, 4], barre: 4 },
  'G#m':   { frets: [4, 6, 6, 4, 4, 4], barre: 4 },
  'Ab':    { frets: [4, 6, 6, 5, 4, 4], barre: 4 },
  'Abm':   { frets: [4, 6, 6, 4, 4, 4], barre: 4 },

  // ── A ─────────────────────────────────────────────────────────────────
  'A':     { frets: [-1, 0, 2, 2, 2, 0] },
  'Am':    { frets: [-1, 0, 2, 2, 1, 0] },
  'A7':    { frets: [-1, 0, 2, 0, 2, 0] },
  'Am7':   { frets: [-1, 0, 2, 0, 1, 0] },
  'Amaj7': { frets: [-1, 0, 2, 1, 2, 0] },
  'Asus2': { frets: [-1, 0, 2, 2, 0, 0] },
  'Asus4': { frets: [-1, 0, 2, 2, 3, 0] },
  'A9':    { frets: [-1, 0, 2, 4, 2, 3] },

  // ── A# / Bb ───────────────────────────────────────────────────────────
  'A#':    { frets: [-1, 1, 3, 3, 3, 1], barre: 1 },
  'A#m':   { frets: [-1, 1, 3, 3, 2, 1], barre: 1 },
  'Bb':    { frets: [-1, 1, 3, 3, 3, 1], barre: 1 },
  'Bbm':   { frets: [-1, 1, 3, 3, 2, 1], barre: 1 },
  'Bb7':   { frets: [-1, 1, 3, 1, 3, 1], barre: 1 },
  'Bbmaj7':{ frets: [-1, 1, 3, 2, 3, 0] },

  // ── B ─────────────────────────────────────────────────────────────────
  'B':     { frets: [-1, 2, 4, 4, 4, 2], barre: 2 },
  'Bm':    { frets: [-1, 2, 4, 4, 3, 2], barre: 2 },
  'B7':    { frets: [-1, 2, 1, 2, 0, 2] },
  'Bm7':   { frets: [-1, 2, 4, 2, 3, 2], barre: 2 },
  'Bmaj7': { frets: [-1, 2, 4, 3, 4, 2], barre: 2 },

  // ── ACORDES CON BAJO (slash chords) ──────────────────────────────────
  // Formato: bajo/nota  (el bajo es la nota más grave)

  // C con bajo en E (primer traste, cuerda 6)
  'C/E':   { frets: [0, 3, 2, 0, 1, 0] },
  // C con bajo en G
  'C/G':   { frets: [3, 3, 2, 0, 1, 0] },
  // C con bajo en B
  'C/B':   { frets: [-1, 2, 2, 0, 1, 0] },

  // D con bajo en F# (segundo traste, cuerda 6)
  'D/F#':  { frets: [2, -1, 0, 2, 3, 2] },
  // D con bajo en A
  'D/A':   { frets: [-1, 0, 0, 2, 3, 2] },
  // D con bajo en C
  'D/C':   { frets: [-1, 3, 0, 2, 3, 2] },

  // E con bajo en B
  'E/B':   { frets: [-1, 2, 2, 1, 0, 0] },
  // E con bajo en G#
  'E/G#':  { frets: [4, 2, 2, 1, 0, 0] },

  // G con bajo en B
  'G/B':   { frets: [-1, 2, 0, 0, 0, 3] },
  // G con bajo en D
  'G/D':   { frets: [-1, -1, 0, 0, 0, 3] },
  // G con bajo en F#
  'G/F#':  { frets: [2, 2, 0, 0, 0, 3] },

  // Am con bajo en E
  'Am/E':  { frets: [0, 0, 2, 2, 1, 0] },
  // Am con bajo en G
  'Am/G':  { frets: [3, 0, 2, 2, 1, 0] },
  // Am con bajo en C
  'Am/C':  { frets: [-1, 3, 2, 2, 1, 0] },

  // Em con bajo en B
  'Em/B':  { frets: [-1, 2, 2, 0, 0, 0] },
  // Em con bajo en D
  'Em/D':  { frets: [-1, -1, 0, 0, 0, 0] },

  // F con bajo en C
  'F/C':   { frets: [-1, 3, 3, 2, 1, 1] },
  // F con bajo en A
  'F/A':   { frets: [-1, 0, 3, 2, 1, 1] },

  // Bm con bajo en F#
  'Bm/F#': { frets: [2, 2, 4, 4, 3, 2], barre: 2 },

  // A con bajo en E
  'A/E':   { frets: [0, 0, 2, 2, 2, 0] },
  // A con bajo en C#
  'A/C#':  { frets: [-1, 4, 2, 2, 2, 0] },

  // B con bajo en F#
  'B/F#':  { frets: [2, 2, 4, 4, 4, 2], barre: 2 },
  // B con bajo en D#
  'B/D#':  { frets: [-1, -1, 4, 4, 4, 2] },
};

// ── extractChords ─────────────────────────────────────────────────────────────
// Lee todos los [Acorde] de la letra y devuelve los que tienen diagrama
export function extractChords(lyrics) {
  const found = new Set();
  const regex = /\[([^\]]+)\]/g;
  let m;
  while ((m = regex.exec(lyrics)) !== null) {
    const raw = m[1].trim();
    // Probar exacto primero
    if (CHORD_DATA[raw]) { found.add(raw); continue; }
    // Intentar sin números de tiempo (ej: "G 0:12" → "G")
    const clean = raw.replace(/\s+\d+:\d{2}.*$/, '').trim();
    if (CHORD_DATA[clean]) found.add(clean);
  }
  return Array.from(found);
}