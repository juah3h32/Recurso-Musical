// components/ChordDiagram.js
// Diagrama de acorde estilo GuitarTuna — CORREGIDO
//   · Sin marginRight que descentraba el diagrama en la card
//   · Tablero más grande: CW=20, CH=22
//   · wrap centrado con alignSelf:'center'
//   · paddingHorizontal para que nunca toque el borde de la card
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { F } from '../utils/fonts';
import { CHORD_DATA } from '../utils/chords';

const S  = 6;    // cuerdas
const FR = 4;    // trastes a mostrar
const CW = 14;   // ancho entre cuerdas
const CH = 16;   // alto entre trastes
const DR = 5;    // radio del punto

const CYAN      = '#00BFFF';
const CYAN_DARK = '#0088CC';

export default function ChordDiagram({ chord }) {
  const data = CHORD_DATA[chord];
  if (!data) return null;

  const frets   = data.frets;
  const played  = frets.filter(f => f > 0);
  const maxFret = played.length > 0 ? Math.max(...played) : 0;
  const minFret = played.length > 0 ? Math.min(...played) : 0;

  const needsShift = maxFret > FR;
  const startFret  = needsShift ? minFret : 1;
  const shift      = needsShift ? minFret - 1 : 0;
  const normFrets  = frets.map(f => f > 0 ? f - shift : f);

  const boardW = CW * (S - 1);
  const boardH = CH * FR;
  const isSlash = chord.includes('/');

  return (
    <View style={st.wrap}>

      {/* Nombre */}
      <Text style={[st.name, { fontFamily: F.black }]}>{chord}</Text>

      {/* Posición */}
      {needsShift && (
        <Text style={[st.fretNum, { fontFamily: F.bold }]}>{startFret}fr</Text>
      )}

      {/* Abiertos / silenciados */}
      <View style={[st.topRow, { width: boardW }]}>
        {frets.map((f, i) => (
          <View key={i} style={[st.topCell, { width: CW }]}>
            {f === -1
              ? <Text style={[st.mutedX, { fontFamily: F.bold }]}>×</Text>
              : f === 0
              ? <View style={st.openCircle}/>
              : null
            }
          </View>
        ))}
      </View>

      {/* Tablero */}
      <View style={{ width: boardW, height: boardH, position:'relative' }}>

        {/* Cejuela */}
        {!needsShift && <View style={[st.nut, { width: boardW }]}/>}

        {/* Líneas de trastes */}
        {Array.from({ length: FR + 1 }).map((_, fi) => (
          <View key={fi} style={[st.fretLine, { width: boardW, top: fi * CH }]}/>
        ))}

        {/* Líneas de cuerdas */}
        {Array.from({ length: S }).map((_, si) => (
          <View key={si} style={[st.stringLine, { left: si * CW, height: boardH }]}/>
        ))}

        {/* Cejilla (barre) */}
        {data.barre && (() => {
          const bRow = data.barre - shift;
          if (bRow < 1 || bRow > FR) return null;
          const barreIdxs = frets
            .map((f, i) => f === data.barre ? i : -1)
            .filter(i => i >= 0);
          if (!barreIdxs.length) return null;
          const first = Math.min(...barreIdxs);
          const last  = Math.max(...barreIdxs);
          return (
            <View style={[st.barre, {
              left:   first * CW - DR,
              width:  (last - first) * CW + DR * 2,
              height: DR * 2,
              top:    (bRow - 1) * CH + CH / 2 - DR,
            }]}/>
          );
        })()}

        {/* Puntos */}
        {normFrets.map((f, si) => {
          if (f <= 0 || f > FR) return null;
          return (
            <View key={si} style={[st.dot, {
              left:         si * CW - DR,
              top:          (f - 1) * CH + (CH / 2 - DR),
              width:        DR * 2,
              height:       DR * 2,
              borderRadius: DR,
            }]}/>
          );
        })}

        {/* Bajo slash chord */}
        {isSlash && (() => {
          const bassIdx = frets.findIndex(f => f !== -1);
          if (bassIdx < 0) return null;
          const bassNote = chord.split('/')[1];
          return (
            <View style={[st.bassLabel, { left: bassIdx * CW - 10 }]}>
              <Text style={[st.bassLabelTxt, { fontFamily: F.bold }]}>{bassNote}</Text>
            </View>
          );
        })()}

      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    alignItems:  'center',
    alignSelf:   'center',      // centrado dentro de la card
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  name: {
    color:        CYAN,
    fontSize:     15,
    marginBottom: 6,
    textAlign:    'center',
  },
  fretNum: {
    position: 'absolute',
    top:      38,
    right:    -4,
    color:    '#888',
    fontSize: 9,
  },
  topRow: {
    flexDirection: 'row',
    height:        18,
    marginBottom:  3,
  },
  topCell: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  mutedX: {
    color:    '#AAAAAA',
    fontSize: 12,
  },
  openCircle: {
    width:        9,
    height:       9,
    borderRadius: 4.5,
    borderWidth:  1.5,
    borderColor:  CYAN,
  },
  nut: {
    position:        'absolute',
    height:          5,
    top:             -2,
    backgroundColor: '#BBBBBB',
    borderRadius:    2.5,
    zIndex:          2,
  },
  fretLine: {
    position:        'absolute',
    height:          1,
    backgroundColor: '#DDDDDD',
  },
  stringLine: {
    position:        'absolute',
    width:           1,
    backgroundColor: '#CCCCCC',
    top:             0,
  },
  barre: {
    position:        'absolute',
    backgroundColor: CYAN,
    opacity:         0.6,
    borderRadius:    DR,
    zIndex:          3,
  },
  dot: {
    position:        'absolute',
    backgroundColor: CYAN,
    zIndex:          4,
  },
  bassLabel: {
    position:    'absolute',
    bottom:      -18,
    width:       20,
    alignItems:  'center',
  },
  bassLabelTxt: {
    color:    CYAN_DARK,
    fontSize: 9,
  },
});