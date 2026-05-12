// screens/ExtrasScreen.js — v4
// Bajo usa BassNoteDiagram (nota raíz individual en mástil)
import React, { useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Dimensions, FlatList,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AppText from '../components/AppText';
import AppHeader from '../components/AppHeader';
import { CHORD_DATA, UKULELE_CHORD_DATA } from '../utils/chords';
import ChordDiagram from '../components/ChordDiagram';
import BassNoteDiagram from '../components/BassNoteDiagram';

const { width: SW } = Dimensions.get('window');
const GAP    = 10;
const PAD    = 16;
const COLS   = 3;
const CARD_W = (SW - PAD * 2 - GAP * (COLS - 1)) / COLS;

const C = {
  bg:         '#FFFFFF',
  white:      '#FFFFFF',
  accent:     '#00BFFF',
  accentSoft: '#E6F9FF',
  accentDark: '#0088CC',
  text:       '#0D0D0D',
  textMed:    '#4A4A5A',
  textLight:  '#9B9BAD',
  border:     '#E8E8EF',
  pill:       '#F0F0F5',
  green:      '#16A34A',
  greenSoft:  '#ECFDF5',
  purple:     '#7C3AED',
  purpleSoft: '#F5F3FF',
};

// ── INSTRUMENTOS ──────────────────────────────────────────────────────────
const CHORD_INSTRUMENTS = [
  { id: 'acustica', label: 'Guitarra', icon: 'guitar-acoustic' },
  { id: 'bajo',     label: 'Bajo',     icon: 'guitar-electric' },
  { id: 'ukulele',  label: 'Ukulele',  icon: 'music'           },
  { id: 'piano',    label: 'Piano',    icon: 'piano'           },
];

// ── GRUPOS POR INSTRUMENTO ────────────────────────────────────────────────

const GUITAR_GROUPS = [
  { label: 'Mayores',  chords: ['C','D','E','F','G','A','B'] },
  { label: 'Menores',  chords: ['Cm','Dm','Em','Fm','Gm','Am','Bm'] },
  { label: '7ª dom.',  chords: ['C7','D7','E7','G7','A7','B7'] },
  { label: 'Mayor 7',  chords: ['Cmaj7','Fmaj7','F7M'] },
  { label: 'Menor 7',  chords: ['Am7','Em7','Dm7'] },
  { label: '9ª',       chords: ['C9'] },
  { label: '#/b',      chords: ['C#','D#','F#','G#','A#','Bb','Eb','Ab','Db','Gb'] },
];

// Bajo: notas raíz (las mismas notas de las que el bajista toca la raíz)
const BASS_GROUPS = [
  { label: 'Naturales', chords: ['C','D','E','F','G','A','B'] },
  { label: 'Menores',   chords: ['Cm','Dm','Em','Fm','Gm','Am','Bm'] },
  { label: '7ª',        chords: ['C7','D7','E7','G7','A7','B7'] },
  { label: '#/b',       chords: ['C#','Db','D#','Eb','F#','G#','Ab','A#','Bb'] },
];

const UKULELE_GROUPS = [
  { label: 'Mayores',  chords: ['C','D','E','F','G','A','B'] },
  { label: 'Menores',  chords: ['Cm','Dm','Em','Fm','Gm','Am','Bm'] },
  { label: '7ª dom.',  chords: ['C7','D7','E7','G7','A7','B7'] },
  { label: '#/b',      chords: ['C#','D#','F#','G#','A#','Bb'] },
  { label: 'Sus/maj7', chords: ['Csus2','Gsus4','Asus4','Amaj7','Gmaj7'] },
];

// ── PIANO ─────────────────────────────────────────────────────────────────
const PIANO_CHORD_SHAPES = {
  'C':    [0,4,7],   'Cm':   [0,3,7],   'C7':   [0,4,7,10],  'Cmaj7': [0,4,7,11],
  'Csus2':[0,2,7],   'Csus4':[0,5,7],
  'C#':   [1,5,8],   'C#m':  [1,4,8],   'Db':   [1,5,8],
  'D':    [2,6,9],   'Dm':   [2,5,9],   'D7':   [2,6,9,12],  'Dmaj7': [2,6,9,13],
  'Dm7':  [2,5,9,12],'Dsus2':[2,4,9],   'Dsus4':[2,7,9],
  'D#':   [3,7,10],  'Eb':   [3,7,10],
  'E':    [4,8,11],  'Em':   [4,7,11],  'E7':   [4,8,11,14],
  'F':    [5,9,12],  'Fm':   [5,8,12],  'F7':   [5,9,12,15], 'Fmaj7': [5,9,12,16],
  'F#':   [6,10,13], 'F#m':  [6,9,13],  'Gb':   [6,10,13],
  'G':    [7,11,14], 'Gm':   [7,10,14], 'G7':   [7,11,14,17],'Gmaj7': [7,11,14,18],
  'Gsus2':[7,9,14],  'Gsus4':[7,12,14],
  'G#':   [8,12,15], 'Ab':   [8,12,15],
  'A':    [9,13,16], 'Am':   [9,12,16], 'A7':   [9,13,16,19],'Am7':   [9,12,16,19],
  'Amaj7':[9,13,16,20],'Asus4':[9,14,16],
  'A#':   [10,14,17],'Bb':   [10,14,17],
  'B':    [11,15,18],'Bm':   [11,14,18],'B7':   [11,15,18,21],
};

const PIANO_GROUPS = [
  { label: 'Mayores',  chords: ['C','D','E','F','G','A','B'] },
  { label: 'Menores',  chords: ['Cm','Dm','Em','Fm','Gm','Am','Bm'] },
  { label: '7ª dom.',  chords: ['C7','D7','E7','G7','A7','B7'] },
  { label: 'Mayor 7',  chords: ['Cmaj7','Fmaj7','Gmaj7','Amaj7'] },
  { label: 'Menor 7',  chords: ['Dm7','Am7'] },
  { label: '#/b',      chords: ['C#','Db','D#','Eb','F#','Gb','G#','Ab','A#','Bb'] },
];

const PIANO_KEYS_LAYOUT = [
  { note:0,  black:false, label:'C'  }, { note:1,  black:true,  label:'C#' },
  { note:2,  black:false, label:'D'  }, { note:3,  black:true,  label:'D#' },
  { note:4,  black:false, label:'E'  }, { note:5,  black:false, label:'F'  },
  { note:6,  black:true,  label:'F#' }, { note:7,  black:false, label:'G'  },
  { note:8,  black:true,  label:'G#' }, { note:9,  black:false, label:'A'  },
  { note:10, black:true,  label:'A#' }, { note:11, black:false, label:'B'  },
  { note:12, black:false, label:'C'  }, { note:13, black:true,  label:'C#' },
  { note:14, black:false, label:'D'  }, { note:15, black:true,  label:'D#' },
  { note:16, black:false, label:'E'  }, { note:17, black:false, label:'F'  },
  { note:18, black:true,  label:'F#' }, { note:19, black:false, label:'G'  },
  { note:20, black:true,  label:'G#' }, { note:21, black:false, label:'A'  },
];

function PianoChordMini({ chord }) {
  const chordNotes = PIANO_CHORD_SHAPES[chord];
  if (!chordNotes) return (
    <View style={PD.wrap}>
      <AppText weight="black" style={PD.name}>{chord}</AppText>
      <View style={PD.noShape}><AppText style={PD.noShapeTxt}>?</AppText></View>
    </View>
  );
  const w = 130, whiteH = 52, blackH = 32, dotR = 5;
  const minNote = Math.min(...chordNotes);
  const windowStart = minNote <= 2 ? 0 : minNote - 1;
  const windowEnd   = windowStart + 14;
  const visibleKeys = PIANO_KEYS_LAYOUT.filter(k => k.note >= windowStart && k.note <= windowEnd);
  const whiteKeys   = visibleKeys.filter(k => !k.black);
  const whiteW      = whiteKeys.length > 0 ? w / whiteKeys.length : 16;
  const blackW      = whiteW * 0.58;
  const whitePositions = {};
  whiteKeys.forEach((k, i) => { whitePositions[k.note] = i * whiteW; });
  const blackPositions = {};
  visibleKeys.filter(k => k.black).forEach(bk => {
    const prev = visibleKeys.filter(k => !k.black && k.note < bk.note).slice(-1)[0];
    if (prev !== undefined && whitePositions[prev.note] !== undefined)
      blackPositions[bk.note] = whitePositions[prev.note] + whiteW - blackW / 2 - 1;
  });
  const isActive = note => chordNotes.includes(note);
  return (
    <View style={PD.wrap}>
      <AppText weight="black" style={PD.name}>{chord}</AppText>
      <View style={{ width: w, height: whiteH, position: 'relative' }}>
        {whiteKeys.map(k => {
          const active = isActive(k.note);
          return (
            <View key={k.note} style={[PD.whiteKey, {
              left: whitePositions[k.note], width: whiteW - 1.5, height: whiteH,
              backgroundColor: active ? C.accentSoft : C.white,
              borderColor: active ? C.accent : C.border, borderWidth: active ? 1.5 : 1,
            }]}>
              {active && <View style={[PD.dot, { width:dotR*2, height:dotR*2, borderRadius:dotR, backgroundColor:C.accent, bottom:5 }]}/>}
            </View>
          );
        })}
        {visibleKeys.filter(k => k.black).map(k => {
          const x = blackPositions[k.note];
          if (x === undefined) return null;
          const active = isActive(k.note);
          return (
            <View key={k.note} style={[PD.blackKey, {
              left: x, width: blackW, height: blackH,
              backgroundColor: active ? C.accent : C.text, zIndex: 2,
            }]}>
              {active && <View style={[PD.dotBlack, { width:dotR*1.5, height:dotR*1.5, borderRadius:dotR, bottom:4 }]}/>}
            </View>
          );
        })}
      </View>
      <View style={PD.notesRow}>
        {chordNotes.map((n, i) => {
          const lbl = PIANO_KEYS_LAYOUT.find(k => k.note === n)?.label || '';
          return (
            <View key={i} style={PD.badge}>
              <AppText weight="black" style={PD.badgeTxt}>{lbl}</AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const PD = StyleSheet.create({
  wrap:      { alignItems:'center', paddingVertical:8 },
  name:      { fontSize:14, color:C.text, marginBottom:8 },
  whiteKey:  { position:'absolute', top:0, borderRadius:3, borderBottomLeftRadius:4, borderBottomRightRadius:4, alignItems:'center', justifyContent:'flex-end' },
  blackKey:  { position:'absolute', top:0, borderRadius:3, alignItems:'center', justifyContent:'flex-end' },
  dot:       { alignSelf:'center' },
  dotBlack:  { alignSelf:'center', backgroundColor:C.white, opacity:0.9 },
  notesRow:  { flexDirection:'row', gap:4, marginTop:6, flexWrap:'wrap', justifyContent:'center' },
  badge:     { backgroundColor:C.accentSoft, borderRadius:5, paddingHorizontal:6, paddingVertical:2, borderWidth:1, borderColor:C.accent+'44' },
  badgeTxt:  { fontSize:9, color:C.accentDark },
  noShape:   { width:130, height:52, backgroundColor:C.pill, borderRadius:8, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.border },
  noShapeTxt:{ fontSize:20, color:C.textLight },
});

// ── InstrumentIcon ────────────────────────────────────────────────────────
function InstrumentIcon({ id, size = 16, color }) {
  const col = color || C.textMed;
  if (id === 'piano')   return <MaterialCommunityIcons name="piano"           size={size} color={col}/>;
  if (id === 'ukulele') return <MaterialCommunityIcons name="music"           size={size} color={col}/>;
  if (id === 'bajo')    return <MaterialCommunityIcons name="guitar-electric" size={size} color={col}/>;
  return                       <MaterialCommunityIcons name="guitar-acoustic" size={size} color={col}/>;
}

// ── CHORD LIBRARY ─────────────────────────────────────────────────────────
function ChordLibrary() {
  const [activeInst,  setActiveInst]  = useState('acustica');
  const [activeGroup, setActiveGroup] = useState(0);

  const groupsMap = {
    acustica: GUITAR_GROUPS,
    bajo:     BASS_GROUPS,
    ukulele:  UKULELE_GROUPS,
    piano:    PIANO_GROUPS,
  };

  const groups     = groupsMap[activeInst] || GUITAR_GROUPS;
  const isPiano    = activeInst === 'piano';
  const isBajo     = activeInst === 'bajo';

  // Para guitarra y ukulele validamos contra la tabla de acordes
  // Para bajo y piano todos los chords del grupo son válidos (no necesitan tabla)
  const allChords  = groups[activeGroup]?.chords || [];
  const validChords = (isBajo || isPiano)
    ? allChords
    : allChords.filter(c => !!(isBajo ? true : isPiano ? PIANO_CHORD_SHAPES[c] : activeInst === 'ukulele' ? UKULELE_CHORD_DATA[c] : CHORD_DATA[c]));

  const handleInstChange = (id) => {
    setActiveInst(id);
    setActiveGroup(0);
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>

      {/* Selector instrumento */}
      <View style={CL.instBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={CL.instScroll} bounces={false}>
          {CHORD_INSTRUMENTS.map(inst => {
            const isOn = activeInst === inst.id;
            return (
              <TouchableOpacity key={inst.id}
                style={[CL.instChip, isOn && CL.instChipOn]}
                onPress={() => handleInstChange(inst.id)}>
                <InstrumentIcon id={inst.id} size={14} color={isOn ? C.white : C.textMed}/>
                <AppText weight={isOn ? 'extrabold' : 'semibold'}
                  style={[CL.instTxt, isOn && CL.instTxtOn]}>
                  {inst.label}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Nota informativa para bajo */}
      {isBajo && (
        <View style={CL.bassNote}>
          <Ionicons name="information-circle-outline" size={13} color={C.accentDark}/>
          <AppText weight="regular" style={CL.bassNoteTxt}>
            El bajo toca la nota raíz — se muestra la posición más cómoda en el mástil
          </AppText>
        </View>
      )}

      {/* Selector grupo */}
      <View style={CL.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={CL.filterScroll} bounces={false}>
          {groups.map((g, i) => (
            <TouchableOpacity key={i}
              style={[CL.chip, activeGroup === i && CL.chipOn]}
              onPress={() => setActiveGroup(i)}>
              <AppText weight={activeGroup === i ? 'bold' : 'semibold'}
                style={[CL.chipTxt, activeGroup === i && CL.chipTxtOn]}>
                {g.label}
              </AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Grid */}
      {isPiano ? (
        <ScrollView style={{ flex:1, backgroundColor:C.bg }}
          contentContainerStyle={CL.pianoGrid} showsVerticalScrollIndicator={false}>
          <View style={CL.pianoRow}>
            {validChords.map(ch => (
              <View key={ch} style={CL.pianoCard}>
                <PianoChordMini chord={ch}/>
              </View>
            ))}
          </View>
          <View style={{ height:40 }}/>
        </ScrollView>
      ) : isBajo ? (
        // Bajo: BassNoteDiagram en grid 3 columnas
        <FlatList
          key={`bajo_${activeGroup}`}
          data={validChords}
          numColumns={COLS}
          keyExtractor={item => item}
          contentContainerStyle={CL.grid}
          columnWrapperStyle={CL.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: chord }) => (
            <View style={[CL.card, { width: CARD_W }]}>
              <BassNoteDiagram chord={chord}/>
            </View>
          )}
          ListFooterComponent={<View style={{ height:40 }}/>}
        />
      ) : (
        // Guitarra / Ukulele: ChordDiagram con instrument prop
        <FlatList
          key={`${activeInst}_${activeGroup}`}
          data={validChords}
          numColumns={COLS}
          keyExtractor={item => item}
          contentContainerStyle={CL.grid}
          columnWrapperStyle={CL.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: chord }) => (
            <View style={[CL.card, { width: CARD_W }]}>
              <ChordDiagram chord={chord} instrument={activeInst}/>
            </View>
          )}
          ListFooterComponent={<View style={{ height:40 }}/>}
        />
      )}
    </View>
  );
}

// ── ESCALAS ───────────────────────────────────────────────────────────────
const SCALES = [
  { name:'Mayor (Jónica)',    color:'#1A73E8', formula:'T–T–ST–T–T–T–ST',  example:'C D E F G A B',  notas:['1','2','3','4','5','6','7'],    uso:'Base tonal. Sonido alegre y brillante.' },
  { name:'Menor Natural',     color:'#8B5CF6', formula:'T–ST–T–T–ST–T–T',  example:'A B C D E F G',  notas:['1','2','b3','4','5','b6','b7'], uso:'Emotiva y oscura. Alabanza contemplativa.' },
  { name:'Pentatónica Mayor', color:'#16A34A', formula:'T–T–T½–T–T½',       example:'C D E G A',      notas:['1','2','3','5','6'],            uso:'5 notas. Para solos. Nunca suena mal.' },
  { name:'Pentatónica Menor', color:'#DC2626', formula:'T½–T–T–T½–T',       example:'A C D E G',      notas:['1','b3','4','5','b7'],          uso:'Rock y blues. Muy expresiva en solos.' },
  { name:'Mixolidia',         color:'#00BFFF', formula:'T–T–ST–T–T–ST–T',   example:'G A B C D E F',  notas:['1','2','3','4','5','6','b7'],   uso:'Mayor con 7ª menor. Contemporary worship.' },
  { name:'Menor Armónica',    color:'#F97316', formula:'T–ST–T–T–ST–T½–ST', example:'A B C D E F G#', notas:['1','2','b3','4','5','b6','7'],  uso:'Dramática y oriental. Música épica.' },
];

function Escalas() {
  const [expanded, setExpanded] = useState(null);
  return (
    <ScrollView contentContainerStyle={ES.container} style={{ backgroundColor:C.bg }} showsVerticalScrollIndicator={false}>
      <View style={ES.intro}>
        <AppText weight="regular" style={ES.introTxt}>T = Tono  ·  ST = Semitono  ·  T½ = Tono y medio</AppText>
      </View>
      {SCALES.map((sc, i) => (
        <TouchableOpacity key={i}
          style={[ES.card, expanded === i && { borderColor:sc.color+'50' }]}
          onPress={() => setExpanded(expanded === i ? null : i)} activeOpacity={0.85}>
          <View style={ES.cardRow}>
            <View style={[ES.colorBar, { backgroundColor:sc.color }]}/>
            <AppText weight="black" style={[ES.cardTitle, { color:expanded === i ? sc.color : C.text }]}>{sc.name}</AppText>
            <Ionicons name={expanded === i ? 'chevron-up' : 'chevron-down'} size={15} color={expanded === i ? sc.color : C.textLight}/>
          </View>
          {expanded === i && (
            <View style={ES.body}>
              <View style={ES.pills}>
                {sc.notas.map((n, ni) => (
                  <View key={ni} style={[ES.pill, { borderColor:sc.color+'50', backgroundColor:sc.color+'12' }]}>
                    <AppText weight="extrabold" style={[ES.pillTxt, { color:sc.color }]}>{n}</AppText>
                  </View>
                ))}
              </View>
              <AppText weight="semibold" style={ES.formula}>{sc.formula}</AppText>
              <AppText weight="black" style={[ES.example, { color:sc.color }]}>{sc.example}</AppText>
              <AppText weight="regular" style={ES.uso}>{sc.uso}</AppText>
            </View>
          )}
        </TouchableOpacity>
      ))}
      <View style={{ height:40 }}/>
    </ScrollView>
  );
}

// ── TEORÍA ────────────────────────────────────────────────────────────────
const TEORIA = [
  { icon:'musical-notes', title:'Cifrado Nashville', color:'#1A73E8',
    content:`Sistema que usa números en vez de notas:\n\nI → Tónica\nii → Supertónica (menor)\nIV → Subdominante\nV → Dominante\nvi → Submediante (menor)\n\nEjemplo Do Mayor:\nI=C · IV=F · V=G · vi=Am\n\nProgresión I–V–vi–IV:\n• Do: C – G – Am – F\n• Sol: G – D – Em – C\n• Re: D – A – Bm – G` },
  { icon:'git-network', title:'Progresiones de Alabanza', color:'#8B5CF6',
    content:`Las más usadas en música cristiana:\n\n🎵 I – V – vi – IV\n   Sol: G – D – Em – C\n\n🎵 I – IV – V – I\n   Sol: G – C – D – G\n\n🎵 vi – IV – I – V\n   Sol: Em – C – G – D\n\n🎵 ii – V – I\n   Do: Dm – G – C` },
  { icon:'refresh-circle', title:'Círculo de Quintas', color:'#16A34A',
    content:`Mayores (horario, +1 sostenido):\nC→G→D→A→E→B→F#→Db→Ab→Eb→Bb→F→C\n\nMenores relativas:\nAm Em Bm F#m C#m G#m D#m Bbm Fm Cm Gm Dm\n\nTonos más usados en iglesia:\n🎸 C — 0 alteraciones\n🎸 G — 1 sostenido\n🎸 D — 2 sostenidos\n🎸 A — 3 sostenidos\n🎸 F — 1 bemol` },
  { icon:'time', title:'Compases y BPM', color:'#00BFFF',
    content:`4/4 — El más común, 4 tiempos\n3/4 — Vals, 3 tiempos\n6/8 — 2 grupos de 3 (fluido)\n\nBPM por estilo:\n• Adoración profunda:  55–72\n• Balada suave:        72–88\n• Contemporánea:       88–110\n• Alabanza moderada:  110–130\n• Alabanza energética: 130–160` },
  { icon:'options', title:'Modos Griegos', color:'#F97316',
    content:`1. Jónico (Mayor): brillante — C D E F G A B\n2. Dórico: menor jazz/rock — D E F G A B C\n3. Frigio: oscuro, flamenco — E F G A B C D\n4. Lidio: etéreo — F G A B C D E\n5. Mixolidio: rock worship — G A B C D E F\n6. Eólico (Menor natural) — A B C D E F G\n\nMás usados: Jónico, Eólico, Mixolidio.` },
  { icon:'layers', title:'Intervalos', color:'#DC2626',
    content:`Unísono: 0   · 2ª menor: 1  · 2ª mayor: 2\n3ª menor: 3  · 3ª mayor: 4  · 4ª justa: 5\nTritono: 6   · 5ª justa: 7  · 6ª menor: 8\n6ª mayor: 9  · 7ª menor: 10 · 7ª mayor: 11\nOctava: 12\n\nMayor = 3ª mayor + 5ª justa\nMenor = 3ª menor + 5ª justa` },
];

function Teoria() {
  const [expanded, setExpanded] = useState(null);
  return (
    <ScrollView contentContainerStyle={TH.container} style={{ backgroundColor:C.bg }} showsVerticalScrollIndicator={false}>
      {TEORIA.map((item, i) => (
        <TouchableOpacity key={i}
          style={[TH.card, expanded === i && { borderColor:item.color+'40' }]}
          onPress={() => setExpanded(expanded === i ? null : i)} activeOpacity={0.85}>
          <View style={TH.cardRow}>
            <View style={[TH.iconWrap, { backgroundColor:item.color+'15', borderColor:item.color+'30' }]}>
              <Ionicons name={item.icon} size={20} color={item.color}/>
            </View>
            <AppText weight="black" style={[TH.cardTitle, { color:expanded === i ? item.color : C.text }]}>{item.title}</AppText>
            <Ionicons name={expanded === i ? 'chevron-up' : 'chevron-down'} size={17} color={expanded === i ? item.color : C.textLight}/>
          </View>
          {expanded === i && <AppText weight="regular" style={TH.content}>{item.content}</AppText>}
        </TouchableOpacity>
      ))}
      <View style={{ height:40 }}/>
    </ScrollView>
  );
}

// ── PANTALLA PRINCIPAL ────────────────────────────────────────────────────
const SECTIONS = [
  { key:'chords', label:'ACORDES' },
  { key:'scales', label:'ESCALAS' },
  { key:'teoria', label:'TEORÍA'  },
];

export default function ExtrasScreen({ notifCount = 0, onNotifCountChange }) {
  const [section, setSection] = useState('chords');
  return (
    <View style={X.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white}/>
      <AppHeader title="Biblioteca" subtitle="ACORDES · ESCALAS · TEORÍA"
        notifCount={notifCount} onNotifCountChange={onNotifCountChange} onSettings={() => {}}/>
      <View style={X.tabsRow}>
        {SECTIONS.map(s => (
          <TouchableOpacity key={s.key} style={[X.tab, section === s.key && X.tabOn]} onPress={() => setSection(s.key)}>
            <AppText weight="extrabold" style={[X.tabTxt, section === s.key && X.tabTxtOn]}>{s.label}</AppText>
            {section === s.key && <View style={X.tabLine}/>}
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flex:1 }}>
        {section === 'chords' && <ChordLibrary/>}
        {section === 'scales' && <Escalas/>}
        {section === 'teoria' && <Teoria/>}
      </View>
    </View>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────
const X = StyleSheet.create({
  screen:   { flex:1, backgroundColor:C.white },
  tabsRow:  { flexDirection:'row', backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border },
  tab:      { flex:1, alignItems:'center', justifyContent:'center', paddingVertical:14, position:'relative' },
  tabOn:    {},
  tabTxt:   { color:C.textLight, fontSize:11, letterSpacing:2 },
  tabTxtOn: { color:C.text },
  tabLine:  { position:'absolute', bottom:0, left:'15%', right:'15%', height:2.5, backgroundColor:C.accent, borderRadius:2 },
});

const CL = StyleSheet.create({
  instBar:    { backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border },
  instScroll: { paddingHorizontal:PAD, paddingVertical:10, gap:8, alignItems:'center' },
  instChip:   { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:999, backgroundColor:C.pill, borderWidth:1.5, borderColor:C.border },
  instChipOn: { backgroundColor:C.accent, borderColor:C.accent },
  instTxt:    { color:C.textMed, fontSize:12 },
  instTxtOn:  { color:C.white },
  bassNote:   { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:C.accentSoft, paddingHorizontal:16, paddingVertical:8, borderBottomWidth:1, borderBottomColor:C.border },
  bassNoteTxt:{ color:C.accentDark, fontSize:11, flex:1, lineHeight:16 },
  filterWrap:   { height:46, backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border },
  filterScroll: { paddingHorizontal:PAD, gap:6, alignItems:'center' },
  chip:         { paddingHorizontal:12, paddingVertical:7, borderRadius:999, backgroundColor:C.pill, borderWidth:1, borderColor:C.border },
  chipOn:       { backgroundColor:C.text, borderColor:C.text },
  chipTxt:      { color:C.textMed, fontSize:12 },
  chipTxtOn:    { color:C.white },
  grid:     { padding:PAD, gap:GAP },
  row:      { gap:GAP },
  card:     { backgroundColor:C.white, borderRadius:14, padding:12, borderWidth:1, borderColor:C.border, alignItems:'center', shadowColor:'#000', shadowOpacity:0.03, shadowRadius:5, shadowOffset:{width:0,height:2}, elevation:1 },
  pianoGrid:{ padding:PAD },
  pianoRow: { flexDirection:'row', flexWrap:'wrap', gap:10 },
  pianoCard:{ backgroundColor:C.white, borderRadius:14, padding:10, borderWidth:1, borderColor:C.border, alignItems:'center', shadowColor:'#000', shadowOpacity:0.03, shadowRadius:5, shadowOffset:{width:0,height:2}, elevation:1 },
});

const ES = StyleSheet.create({
  container: { padding:16 },
  intro:     { backgroundColor:C.white, borderRadius:12, padding:12, marginBottom:12, borderWidth:1, borderColor:C.border },
  introTxt:  { color:C.textMed, fontSize:11, lineHeight:17, textAlign:'center' },
  card:      { backgroundColor:C.white, borderRadius:16, marginBottom:9, borderWidth:1, borderColor:C.border, shadowColor:'#000', shadowOpacity:0.03, shadowRadius:5, shadowOffset:{width:0,height:2}, elevation:1 },
  cardRow:   { flexDirection:'row', alignItems:'center', gap:12, padding:16 },
  colorBar:  { width:3, height:22, borderRadius:2 },
  cardTitle: { flex:1, fontSize:14 },
  body:      { paddingHorizontal:16, paddingBottom:16, gap:10 },
  pills:     { flexDirection:'row', gap:6, flexWrap:'wrap' },
  pill:      { borderWidth:1, borderRadius:7, paddingHorizontal:9, paddingVertical:4 },
  pillTxt:   { fontSize:12 },
  formula:   { color:C.textLight, fontSize:12, fontStyle:'italic' },
  example:   { fontSize:13 },
  uso:       { color:C.textMed, fontSize:12, lineHeight:18 },
});

const TH = StyleSheet.create({
  container: { padding:16 },
  card:      { backgroundColor:C.white, borderRadius:16, marginBottom:9, borderWidth:1, borderColor:C.border, shadowColor:'#000', shadowOpacity:0.03, shadowRadius:5, shadowOffset:{width:0,height:2}, elevation:1 },
  cardRow:   { flexDirection:'row', alignItems:'center', gap:12, padding:16 },
  iconWrap:  { width:42, height:42, borderRadius:12, alignItems:'center', justifyContent:'center', borderWidth:1 },
  cardTitle: { flex:1, fontSize:14 },
  content:   { color:C.textMed, fontSize:12, lineHeight:20, paddingHorizontal:16, paddingBottom:16 },
});