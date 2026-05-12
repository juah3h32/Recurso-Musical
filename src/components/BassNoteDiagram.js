// BassNoteDiagram — muestra la posición de la nota raíz en el bajo (4 cuerdas)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const S  = 4;    // cuerdas (E A D G)
const FR = 4;    // trastes visibles
const CW = 14;
const CH = 16;
const DR = 5;

const CYAN      = '#00BFFF';
const CYAN_DARK = '#0088CC';

// Open strings: E(0) A(1) D(2) G(3) — bajo estándar de grave a agudo
// NOTE_ON_STRING[string][semitones_from_open] = note name
const OPEN_NOTES = [4, 9, 2, 7]; // E=4, A=9, D=2, G=7 (semitone index 0=C)

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ENHARMONIC = { 'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B' };

function noteIndex(name) {
  return NOTE_NAMES.indexOf(ENHARMONIC[name] || name);
}

// Finds best (string, fret) for a given root note — lowest string, lowest fret preferred
function findBassPosition(noteName) {
  const root = String(noteName).match(/^([A-G][#b]?)/)?.[1];
  if (!root) return null;
  const target = noteIndex(root);
  if (target === -1) return null;

  let best = null;
  for (let str = 0; str < S; str++) {
    const open = OPEN_NOTES[str];
    const fret = ((target - open) + 12) % 12;
    if (fret <= 5) {
      if (!best || fret < best.fret || (fret === best.fret && str < best.string)) {
        best = { string: str, fret };
      }
    }
  }
  // Fallback: any position
  if (!best) {
    const fret = ((target - OPEN_NOTES[0]) + 12) % 12;
    best = { string: 0, fret };
  }
  return best;
}

export default function BassNoteDiagram({ chord }) {
  const root = String(chord).match(/^([A-G][#b]?)/)?.[1] || chord;
  const pos = findBassPosition(root);

  const startFret = pos && pos.fret > FR ? pos.fret - FR + 1 : 1;
  const isOpen    = pos && pos.fret === 0;

  const boardW = (S - 1) * CW;
  const boardH = FR * CH;

  return (
    <View style={st.wrap}>
      <Text style={st.name}>{chord}</Text>
      <View style={{ width: boardW + 24, height: boardH + 20, alignItems: 'center' }}>
        {/* Fret number indicator */}
        {!isOpen && pos && pos.fret > FR && (
          <Text style={st.fretNum}>{startFret}fr</Text>
        )}
        {/* Nut / top bar */}
        <View style={[st.nut, { width: boardW + 2, top: isOpen ? 8 : 0,
          backgroundColor: startFret === 1 ? CYAN_DARK : '#ccc' }]}/>
        {/* Strings */}
        {Array.from({ length: S }).map((_, s) => (
          <View key={s} style={[st.string, {
            left: 12 + s * CW, top: 0, height: boardH + 10,
          }]}/>
        ))}
        {/* Frets */}
        {Array.from({ length: FR }).map((_, f) => (
          <View key={f} style={[st.fret, {
            width: boardW + 2, left: 11, top: (f + 1) * CH,
          }]}/>
        ))}
        {/* Open string indicator */}
        {isOpen && pos && (
          <View style={[st.openCircle, { left: 12 + pos.string * CW - DR, top: -2 }]}/>
        )}
        {/* Dot */}
        {pos && !isOpen && (
          <View style={[st.dot, {
            left: 12 + pos.string * CW - DR,
            top: (pos.fret - startFret) * CH + CH / 2 - DR + (startFret === 1 ? 8 : 0),
          }]}/>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap:       { alignItems: 'center', paddingVertical: 6 },
  name:       { fontSize: 13, fontWeight: '900', color: '#0D0D0D', marginBottom: 6 },
  nut:        { position: 'absolute', height: 3, borderRadius: 2 },
  string:     { position: 'absolute', width: 1.5, backgroundColor: '#C0C0C8' },
  fret:       { position: 'absolute', height: 1, backgroundColor: '#E0E0E8' },
  dot:        { position: 'absolute', width: DR * 2, height: DR * 2, borderRadius: DR,
                 backgroundColor: CYAN },
  openCircle: { position: 'absolute', width: DR * 2, height: DR * 2, borderRadius: DR,
                 borderWidth: 1.5, borderColor: CYAN_DARK, backgroundColor: 'transparent' },
  fretNum:    { fontSize: 9, color: '#9B9BAD', position: 'absolute', left: 0, top: 4 },
});
