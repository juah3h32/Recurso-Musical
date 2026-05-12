// FavoritosScreen — CORREGIDO
// FIXES:
//  1. CifraViewer: infoBar + toolbar FUERA del ScrollView (sticky fijo)
//     → ya no se distorsionan ni bajan con el scroll de la letra
//  2. CAPO: mostrado con CapoIcon en infoBar + en cards de listado
//  3. Scroll auto: velocidad base lenta (sin BPM), muy suave
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Modal, Animated,
  TextInput, RefreshControl, Image, Platform, PermissionsAndroid,
} from 'react-native';
import AudioRecord from 'react-native-audio-record';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getFavoritos, getCancionero, toggleFavorito,
  toggleFavoritoCancionero, normalizeCancion,
} from '../utils/turso';
import { F } from '../utils/fonts';
import { TONOS, transposeLyrics, semitonesBetween, detectKey } from '../utils/transpose';
import { extractChords } from '../utils/chords';
import ChordDiagram from '../components/ChordDiagram';
import TabRiffViewer from '../components/TabRiffViewer';

const C = {
  bg:'#FFFFFF', white:'#FFFFFF', accent:'#00BFFF', accentDark:'#0099CC',
  text:'#111111', textMed:'#555555', textLight:'#999999',
  border:'#EBEBEB', pill:'#F5F5F5', green:'#22C55E', red:'#EF4444', blue:'#1A73E8',
};

// ─────────────────────────────────────────────────────────────────────────────
// PITCH DETECTION — NSDF estilo GuitarTuna (mismo que TutorialsScreen)
// ─────────────────────────────────────────────────────────────────────────────
const NV_F=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function applyHannF(buf){
  const N=buf.length,out=new Float32Array(N);
  for(let i=0;i<N;i++)out[i]=buf[i]*(0.5-0.5*Math.cos(2*Math.PI*i/(N-1)));
  return out;
}
function nsdfF(buf){
  const N=buf.length,W=N>>1,r=new Float32Array(W+1);
  for(let tau=0;tau<=W;tau++){
    let corr=0,norm=0;
    for(let i=0;i<N-tau;i++){corr+=buf[i]*buf[i+tau];norm+=buf[i]*buf[i]+buf[i+tau]*buf[i+tau];}
    r[tau]=norm>0?(2*corr)/norm:0;
  }
  return r;
}
function detectPitchF(buf,sr){
  const windowed=applyHannF(buf),n=nsdfF(windowed),W=n.length-1;
  const T_MIN=Math.ceil(sr/1400),T_MAX=Math.floor(sr/40);
  let best=-1,bestVal=0.45,i=T_MIN;
  while(i<T_MAX&&n[i]>0)i++;while(i<T_MAX&&n[i]<=0)i++;
  while(i<T_MAX-1){
    if(n[i]>n[i-1]&&n[i]>=n[i+1]){if(n[i]>bestVal){bestVal=n[i];best=i;}break;}
    i++;
  }
  if(best<0)return -1;
  const p=best>0?n[best-1]:n[best],cv=n[best],nx=best<W?n[best+1]:n[best],den=p-2*cv+nx;
  const tau=den!==0?best+0.5*(p-nx)/den:best;
  return sr/tau;
}
function freqToNoteF(freq){
  if(!freq||freq<40||freq>1400)return null;
  const midi=12*Math.log2(freq/440)+69,r=Math.round(midi),idx=((r%12)+12)%12;
  return{note:NV_F[idx],cents:Math.round((midi-r)*100),freq:Math.round(freq*10)/10};
}
const NF_F={'C':[32.7,65.41,130.81,261.63,523.25],'C#':[34.65,69.3,138.59,277.18,554.37],'D':[36.71,73.42,146.83,293.66,587.33],'D#':[38.89,77.78,155.56,311.13,622.25],'E':[41.2,82.41,164.81,329.63,659.25],'F':[43.65,87.31,174.61,349.23,698.46],'F#':[46.25,92.5,185,369.99,739.99],'G':[49,98,196,392,784],'G#':[51.91,103.83,207.65,415.3,830.61],'A':[55,110,220,440,880],'A#':[58.27,116.54,233.08,466.16,932.33],'B':[61.74,123.47,246.94,493.88,987.77]};
function freqMatchesNoteF(freq,note){
  const fs=NF_F[note];if(!fs||freq<=0)return false;
  for(const f of fs)if(Math.abs(1200*Math.log2(freq/f))<=45)return true;
  return false;
}
function medianF(arr){if(!arr.length)return 0;const s=[...arr].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];}
function cToRF(c){const m=c.match(/^([A-G][#b]?)/);return m?m[1]:null;}
function normStrF(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}

// ── CapoIcon ──────────────────────────────────────────────────────────────────
function CapoIcon({ size = 16, color = C.accent }) {
  const s = size;
  return (
    <View style={{ width: s, height: s }}>
      {[0,1,2,3,4,5].map(i => (
        <View key={i} style={{ position:'absolute', top:0, bottom:0,
          left: s*0.08 + i*(s*0.155), width:1.5,
          backgroundColor: C.border, borderRadius:1 }}/>
      ))}
      <View style={{ position:'absolute', left:0, right:0, top:s*0.32,
        height:s*0.28, borderRadius:s*0.14, backgroundColor:color }}/>
      <View style={{ position:'absolute', right:s*0.12, top:-s*0.06,
        width:s*0.22, height:s*0.28, borderRadius:s*0.1, backgroundColor:color, opacity:0.7 }}/>
      <View style={{ position:'absolute', right:s*0.12, bottom:-s*0.06,
        width:s*0.22, height:s*0.28, borderRadius:s*0.1, backgroundColor:color, opacity:0.7 }}/>
      <View style={{ position:'absolute', right:s*0.2, top:0, bottom:0,
        width:s*0.07, backgroundColor:color, opacity:0.5 }}/>
    </View>
  );
}

function CancionCover({ uri, size = 48 }) {
  const [failed, setFailed] = React.useState(false);
  if (!uri || failed) return (
    <View style={{ width:size, height:size, borderRadius:10,
      backgroundColor:C.pill, borderWidth:1, borderColor:C.border,
      alignItems:'center', justifyContent:'center' }}>
      <Ionicons name="musical-note" size={16} color={C.accent} />
    </View>
  );
  return (
    <Image source={{ uri }} resizeMode="cover" onError={() => setFailed(true)}
      style={{ width:size, height:size, borderRadius:10,
        borderWidth:1, borderColor:C.border, backgroundColor:C.pill }}/>
  );
}

const cleanCapo = v => String(v || '').replace(/\s*(traste|°\s*traste)/gi, '').trim();

function parseChordLine(line) {
  const segs = [], first = line.indexOf('[');
  if (first > 0) segs.push({ chord:null, text:line.slice(0, first) });
  const re = /\[([^\]]+)\]([^\[]*)/g; let m;
  while ((m = re.exec(line)) !== null) segs.push({ chord:m[1], text:m[2] });
  return segs;
}

function isChordOnlyLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (/^\[[^\]]+\]$/.test(t)) return false; // section header
  return /^\s*(\[[^\]]+\]\s*)+$/.test(t);
}

function mergeChordOnlyLines(lines) {
  const out = []; let i = 0;
  while (i < lines.length) {
    if (isChordOnlyLine(lines[i])) {
      let merged = lines[i].trim();
      while (i + 1 < lines.length && isChordOnlyLine(lines[i + 1])) {
        i++;
        merged += ' ' + lines[i].trim();
      }
      out.push(merged);
    } else {
      out.push(lines[i]);
    }
    i++;
  }
  return out;
}

function segmentLyricsWithTabs(lyrics) {
  if (!lyrics) return [{ type:'text', lines:[] }];
  const lines = lyrics.split('\n'), inTab = new Array(lines.length).fill(false);
  const isStr = l => /^\s*[eEBGDA]\|/.test(l);
  const isLbl = s =>
    /\[.*(tab|riff|inter|solo|intro|vers|puente|bridge|outro|fill|lick|ej\.?|ejemplo).*\]/i.test(s) ||
    /^(ej\.?\s*(solo|intro|vers|puente|outro|fill|lick|riff)|solo|intro\s*tab|tab\s*intro|tab\s*solo)/i.test(s);
  for (let i = 0; i < lines.length; i++) {
    if (isStr(lines[i])) {
      inTab[i] = true;
      for (let b = 1; b <= 3 && i-b >= 0; b++) {
        const p = lines[i-b].trim();
        if (!p) { inTab[i-b] = true; continue; }
        if (isLbl(p)) { inTab[i-b] = true; break; }
        if (/^[\s]*[A-G][#b]?(\s+[A-G][#b]?)*\s*$/.test(p)) inTab[i-b] = true;
        else break;
      }
    }
  }
  const segs = []; let i = 0;
  while (i < lines.length) {
    if (!inTab[i]) { let j=i; while(j<lines.length&&!inTab[j])j++; segs.push({type:'text',lines:lines.slice(i,j)}); i=j; }
    else { let j=i; while(j<lines.length&&inTab[j])j++; segs.push({type:'tab',text:lines.slice(i,j).join('\n')}); i=j; }
  }
  return segs;
}

// ── TRANSPOSITOR ──────────────────────────────────────────────────────────────
function Transpositor({ visible, currentKey, originalKey, onTranspose, onReset, onClose }) {
  const semis = semitonesBetween(originalKey, currentKey);
  const slide = useRef(new Animated.Value(-260)).current;
  const fade  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, { toValue:visible?0:-260, tension:80, friction:10, useNativeDriver:true }),
      Animated.timing(fade,  { toValue:visible?1:0, duration:visible?200:180, useNativeDriver:true }),
    ]).start();
  }, [visible]);
  return (<>
    <Animated.View pointerEvents="auto" style={[TP.backdrop, { opacity:fade }]}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1}/>
    </Animated.View>
    <Animated.View style={[TP.card, { transform:[{ translateY:slide }], opacity:fade }]}>
      <View style={TP.handle}/>
      <View style={TP.row}>
        <MaterialCommunityIcons name="transfer-right" size={16} color={C.accent}/>
        <Text style={[TP.label, { fontFamily:F.bold }]}>Transpositor</Text>
        {semis !== 0 && (
          <TouchableOpacity style={TP.resetBtn} onPress={onReset}>
            <Feather name="rotate-ccw" size={13} color={C.textMed}/>
            <Text style={[TP.resetTxt, { fontFamily:F.semibold }]}> Orig. {originalKey}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={TP.closeBtn} onPress={onClose} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
          <Feather name="x" size={18} color={C.textLight}/>
        </TouchableOpacity>
      </View>
      <View style={TP.ctrlRow}>
        <TouchableOpacity style={TP.semiBtn} onPress={() => onTranspose(-1)}><Feather name="minus" size={22} color={C.text}/></TouchableOpacity>
        <View style={TP.keyDisplay}>
          <Text style={[TP.keyNote, { fontFamily:F.black }]}>{currentKey}</Text>
          <Text style={[TP.keyDiff, { fontFamily:F.bold, color:semis>0?C.green:semis<0?C.red:C.textLight }]}>
            {semis>0?`+${semis}`:semis===0?'original':semis} semitonos
          </Text>
        </View>
        <TouchableOpacity style={TP.semiBtn} onPress={() => onTranspose(1)}><Feather name="plus" size={22} color={C.text}/></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={TP.keysRow}>
        {TONOS.map(k => (
          <TouchableOpacity key={k}
            style={[TP.chip, currentKey===k&&TP.chipOn, k===originalKey&&currentKey!==k&&TP.chipOrig]}
            onPress={() => onTranspose(semitonesBetween(currentKey, k))}>
            <Text style={[TP.chipTxt, { fontFamily:F.bold }, currentKey===k&&{ color:C.white }]}>{k}</Text>
            {k===originalKey && <View style={TP.origDot}/>}
          </TouchableOpacity>
        ))}
        <View style={{ width:14 }}/>
      </ScrollView>
    </Animated.View>
  </>);
}

// ── METRÓNOMO ─────────────────────────────────────────────────────────────────
function generateBeepWav(f=880, ms=80, sr=22050) {
  const n=Math.floor(sr*ms/1000),buf=new ArrayBuffer(44+n*2),v=new DataView(buf);
  const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  ws(0,'RIFF');v.setUint32(4,36+n*2,true);ws(8,'WAVE');ws(12,'fmt ');v.setUint32(16,16,true);
  v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);
  v.setUint16(32,2,true);v.setUint16(34,16,true);ws(36,'data');v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++){const t=i/sr,e=i<n*.08?i/(n*.08):1-(i-n*.08)/(n*.92);v.setInt16(44+i*2,Math.round(Math.sin(2*Math.PI*f*t)*e*.92*32767),true);}
  let b='';const by=new Uint8Array(buf);for(let i=0;i<by.byteLength;i++)b+=String.fromCharCode(by[i]);
  return 'data:audio/wav;base64,'+btoa(b);
}
async function playClick(isAccent=false) {
  try {
    const{Audio}=require('expo-av');
    await Audio.setAudioModeAsync({playsInSilentModeIOS:true,staysActiveInBackground:false});
    const{sound}=await Audio.Sound.createAsync({uri:generateBeepWav(isAccent?1100:700,isAccent?90:60)},{shouldPlay:true,volume:1.0});
    sound.setOnPlaybackStatusUpdate(s=>{if(s.didJustFinish)sound.unloadAsync();});
  } catch(_) {}
}

function Metronomo({ visible, onClose, initBpm=80, onPlayingChange }) {
  const [bpm,setBpm]=useState(initBpm),[on,setOn]=useState(false),[beat,setBeat]=useState(0),[compas,setCompas]=useState(4);
  const scale=useRef(new Animated.Value(1)).current,timer=useRef(null),bRef=useRef(0);
  const slide=useRef(new Animated.Value(-440)).current,fade=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.parallel([Animated.spring(slide,{toValue:visible?0:-440,tension:80,friction:10,useNativeDriver:true}),Animated.timing(fade,{toValue:visible?1:0,duration:visible?200:180,useNativeDriver:true})]).start();
  },[visible]);
  useEffect(()=>{
    if(on){bRef.current=1;setBeat(1);playClick(true);
      Animated.sequence([Animated.timing(scale,{toValue:1.5,duration:55,useNativeDriver:true}),Animated.timing(scale,{toValue:1,duration:145,useNativeDriver:true})]).start();
      timer.current=setInterval(()=>{bRef.current=(bRef.current%compas)+1;const a=bRef.current===1;setBeat(bRef.current);playClick(a);
        Animated.sequence([Animated.timing(scale,{toValue:a?1.5:1.18,duration:55,useNativeDriver:true}),Animated.timing(scale,{toValue:1,duration:145,useNativeDriver:true})]).start();
      },(60/bpm)*1000);}
    else{clearInterval(timer.current);setBeat(0);bRef.current=0;}
    return()=>clearInterval(timer.current);
  },[on,bpm,compas]);
  useEffect(()=>{onPlayingChange?.(on);},[on]);
  const adj=d=>setBpm(p=>Math.min(240,Math.max(30,p+d)));
  return(<>
    {/* ★ backdrop: pointerEvents depende de si está visible */}
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[MET.backdrop,{opacity:fade}]}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1}/>
    </Animated.View>
    {/* ★ card: pointerEvents depende de si está visible */}
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[MET.card,{transform:[{translateY:slide}],opacity:fade}]}>
      <View style={MET.handle}/>
      <View style={MET.row}>
        <MaterialCommunityIcons name="metronome" size={18} color={C.accent}/>
        <Text style={[MET.title,{fontFamily:F.bold}]}>Metrónomo</Text>
        {on&&<View style={MET.badge}><View style={MET.badgeDot}/><Text style={[MET.badgeTxt,{fontFamily:F.bold}]}>SONANDO</Text></View>}
        <TouchableOpacity style={MET.closeBtn} onPress={onClose} hitSlop={{top:10,bottom:10,left:10,right:10}}><Feather name="x" size={16} color={C.textLight}/></TouchableOpacity>
      </View>
      <View style={MET.beats}>{Array.from({length:compas}).map((_,i)=><View key={i} style={[MET.dot,beat===i+1&&MET.dotOn,beat===i+1&&i===0&&MET.dotStrong]}/>)}</View>
      <View style={MET.pulsoWrap}><Animated.View style={[MET.ball,{transform:[{scale}]}]}><View style={[MET.ballCore,on&&MET.ballCoreOn]}/></Animated.View></View>
      <View style={MET.bpmCtrl}>{[{l:'−5',d:-5},{l:'−1',d:-1},{l:'+1',d:1},{l:'+5',d:5}].map(b=><TouchableOpacity key={b.l} style={MET.adjBtn} onPress={()=>adj(b.d)}><Text style={[MET.adjTxt,{fontFamily:F.bold}]}>{b.l}</Text></TouchableOpacity>)}</View>
      <View style={MET.bpmShow}><Text style={[MET.bpmNum,{fontFamily:F.black}]}>{bpm}</Text><Text style={[MET.bpmLbl,{fontFamily:F.semibold}]}>BPM</Text></View>
      <View style={MET.compasRow}><Text style={[MET.compasLbl,{fontFamily:F.semibold}]}>Compás:</Text>
        {[2,3,4,6].map(c=><TouchableOpacity key={c} style={[MET.cBtn,compas===c&&MET.cBtnOn]} onPress={()=>{setCompas(c);setBeat(0);bRef.current=0;}}><Text style={[MET.cTxt,{fontFamily:F.bold},compas===c&&MET.cTxtOn]}>{c}/4</Text></TouchableOpacity>)}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
        {[{l:'Largo',b:50},{l:'Adagio',b:66},{l:'Andante',b:76},{l:'Moderato',b:96},{l:'Allegro',b:120},{l:'Vivace',b:156},{l:'Presto',b:180}].map(p=>(
          <TouchableOpacity key={p.l} style={[MET.preset,bpm===p.b&&MET.presetOn]} onPress={()=>setBpm(p.b)}>
            <Text style={[MET.presetL,{fontFamily:F.semibold}]}>{p.l}</Text><Text style={[MET.presetB,{fontFamily:F.regular}]}>{p.b}</Text>
          </TouchableOpacity>
        ))}
        <View style={{width:14}}/>
      </ScrollView>
      <TouchableOpacity style={[MET.playBtn,on&&MET.stopBtn]} onPress={()=>setOn(!on)}>
        <Ionicons name={on?'stop':'play'} size={18} color={on?C.white:C.text}/>
        <Text style={[MET.playTxt,{fontFamily:F.extrabold,color:on?C.white:C.text}]}>{on?'  Detener':'  Iniciar'}</Text>
      </TouchableOpacity>
    </Animated.View>
  </>);
}

// ── CHORD SECTION ─────────────────────────────────────────────────────────────
function ChordSection({ lyrics }) {
  const chords = extractChords(lyrics);
  if (!chords.length) return null;
  const rows = []; for(let i=0;i<chords.length;i+=3)rows.push(chords.slice(i,i+3));
  return (
    <View style={CDS.wrap}>
      <View style={CDS.header}><View style={CDS.line}/><Ionicons name="musical-notes" size={14} color={C.accent}/><Text style={[CDS.title,{fontFamily:F.extrabold}]}>ACORDES DE LA CANCIÓN</Text><View style={CDS.line}/></View>
      {rows.map((row,ri)=>(
        <View key={ri} style={CDS.gridRow}>
          {row.map(ch=><View key={ch} style={CDS.card}><ChordDiagram chord={ch}/></View>)}
          {row.length<3&&Array.from({length:3-row.length}).map((_,i)=><View key={`e${i}`} style={CDS.card}/>)}
        </View>
      ))}
    </View>
  );
}

// ── LYRIC LINE ────────────────────────────────────────────────────────────────
function LyricLine({ line, fontSize, chordPopup, setChordPopup, lineIdx=0,
                     activeLine=-1, sectionMap }) {
  if (!line.trim()) return <View style={{ height:10 }}/>;

  if (/^\[[^\]]+\]$/.test(line.trim())) {
    const secName = line.trim().slice(1,-1).replace(/\d+:\d{2}(?::\d{2})?/g,'').trim().toUpperCase();
    const isActive = activeLine === lineIdx;
    return (
      <View style={VI.secWrap}
        onLayout={e => { if(sectionMap)sectionMap.current[lineIdx]=e.nativeEvent.layout.y; }}>
        <View style={[VI.sectionPill, isActive && VI.sectionPillActive]}>
          {isActive && <View style={VI.sectionPillDot}/>}
          <Text style={[VI.sec,{fontFamily:F.extrabold}, isActive&&{color:C.white}]}>{secName}</Text>
        </View>
      </View>
    );
  }

  const isAct = activeLine === lineIdx;
  const isPast = activeLine > lineIdx && activeLine >= 0;

  if (/\[[^\]]+\]/.test(line)) {
    const segs = parseChordLine(line);
    const chordOnly = segs.every(s => !s.text || !s.text.trim());
    return (
      <View style={[VI.lineBlock, isAct && VI.lineBlockActive]}>
        <View style={[VI.segRow, chordOnly && VI.segRowChordOnly]}>
          {segs.map((seg,si)=>{
            const isOpen=chordPopup?.lineIdx===lineIdx&&chordPopup?.segIdx===si;
            const hasText = !!(seg.text && seg.text.trim());
            const noTextPad = !hasText ? { minWidth: fontSize * 1.4 } : {};
            return (
              <View key={si} style={[VI.seg, noTextPad]}>
                {seg.chord ? (
                  <TouchableOpacity
                    onPress={()=>setChordPopup(isOpen?null:{chord:seg.chord,lineIdx,segIdx:si})}
                    hitSlop={{top:6,bottom:6,left:4,right:4}}
                    activeOpacity={0.65}>
                    <Text style={[VI.segChord,{fontFamily:F.black,fontSize,
                      color:isOpen?C.text:C.accent}]}>
                      {seg.chord}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[VI.segChord,{fontFamily:F.black,fontSize,color:'transparent'}]}>
                    {seg.text ? ' ' : ''}
                  </Text>
                )}
                {seg.text && (
                  <Text style={[VI.segTxt,{fontSize,fontFamily:F.regular,
                    color:isAct?C.text:isPast?C.border:C.textMed}]}>
                    {seg.text}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  }
  return (
    <Text style={[VI.lyric,{fontSize,fontFamily:F.regular,
      color:isAct?C.text:isPast?C.border:C.textMed}]}>
      {line}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ★ CIFRA VIEWER — CORREGIDO
//   infoBar + toolbar son FIJOS (fuera del ScrollView)
//   ScrollView SOLO contiene la letra
// ─────────────────────────────────────────────────────────────────────────────
function CifraViewer({ cancion, onClose, onFavChange }) {
  const norm     = normalizeCancion(cancion);
  const rawLetra = norm.letra || norm.cancion_letra || '';

  const [lyrics,      setLyrics]      = useState(rawLetra);
  const [currentKey,  setCurrentKey]  = useState(detectKey(rawLetra) || norm.tono || 'C');
  const [originalKey, setOriginalKey] = useState(detectKey(rawLetra) || norm.tono || 'C');
  const [transpose,   setTranspose]   = useState(false);
  const [metro,       setMetro]       = useState(false);
  const [metroPlay,   setMetroPlay]   = useState(false);
  const [autoScroll,  setAutoScroll]  = useState(false);
  const [showSpeeds,  setShowSpeeds]  = useState(false);
  // ★ Velocidad inicial calculada desde BPM (muy lenta por defecto)
  //   BPM 60  → ×0.3  BPM 90 → ×0.5  BPM 120 → ×0.7  BPM 150+ → ×1.0
  const calcInitSpeed = (bpm) => {
    if (!bpm || bpm <= 0) return 0.3;
    if (bpm < 70)  return 0.2;
    if (bpm < 90)  return 0.3;
    if (bpm < 110) return 0.4;
    if (bpm < 130) return 0.5;
    if (bpm < 160) return 0.7;
    return 1.0;
  };
  const [scrollSpeed, setScrollSpeed] = useState(() => calcInitSpeed(norm.bpm));
  const [fontSize,    setFontSize]    = useState(15);
  const [fav,         setFav]         = useState(norm.es_favorito === 1);
  const [chordPopup,  setChordPopup]  = useState(null);
  // ★ Detector de voz
  const [micOn,       setMicOn]       = useState(false);
  const [voiceNote,   setVoiceNote]   = useState(null);
  const [activeLine,  setActiveLine]  = useState(-1);

  const scrollRef  = useRef(null);
  const scrollY    = useRef(0);
  const rafRef     = useRef(null);
  // Refs del detector
  const sectionMap = useRef({});  // lineIdx → Y de la cabecera
  const CONTENT_Y  = useRef(0);
  const sectionsRef   = useRef([]);
  const seqRef        = useRef([]);
  const secPosRef     = useRef(-1);
  const secHitCounts  = useRef({});
  const actRef        = useRef(-1);
  const hitRef        = useRef(0);
  const vBuf          = useRef([]);
  const vHist         = useRef([]);
  const vSil          = useRef(0);
  const vFreeze       = useRef(null);
  const vTimer        = useRef(null);

  // ★ Velocidades ampliadas — desde muy lento hasta 2×
  const SPEEDS = [
    {label:'×0.1', v:0.1},
    {label:'×0.2', v:0.2},
    {label:'×0.3', v:0.3},
    {label:'×0.5', v:0.5},
    {label:'×0.7', v:0.7},
    {label:'×1',   v:1.0},
    {label:'×1.5', v:1.5},
    {label:'×2',   v:2.0},
  ];
  const segments = useMemo(() => segmentLyricsWithTabs(lyrics), [lyrics]);

  // ★ Scroll automático — multiplicador base 0.2 (era 0.4) → todo más lento
  useEffect(() => {
    if (autoScroll) {
      const ppf = scrollSpeed * 0.2;   // ★ base 0.2px/frame en vez de 0.4
      rafRef.current = setInterval(() => {
        scrollY.current += ppf;
        scrollRef.current?.scrollTo({ y:scrollY.current, animated:false });
      }, 16);
    } else clearInterval(rafRef.current);
    return () => clearInterval(rafRef.current);
  }, [autoScroll, scrollSpeed]);

  const handleTranspose = semis => {
    if (!semis) return;
    setLyrics(transposeLyrics(lyrics, semis));
    setCurrentKey(TONOS[((TONOS.indexOf(currentKey)+semis)%12+12)%12]);
  };

  // ── Parsear secciones al cargar la letra ─────────────────────────────────
  const lines = useMemo(()=>(lyrics||'').split('\n'),[lyrics]);

  useEffect(()=>{
    const secs=[],allSeq=[];let curSec=null;
    lines.forEach((line,i)=>{
      const trimmed=line.trim();
      if(/^\[[^\]]+\]$/.test(trimmed)){
        const raw=trimmed.slice(1,-1).replace(/\d+:\d{2}(?::\d{2})?/g,'').trim();
        curSec={name:raw,lineIdx:i,chordRoots:[]};secs.push(curSec);return;
      }
      [...line.matchAll(/\[([^\]]+)\]/g)].forEach(m=>{
        const r=cToRF(m[1]);if(!r)return;
        allSeq.push({lineIdx:i,chord:m[1],root:r});
        if(curSec&&!curSec.chordRoots.includes(r))curSec.chordRoots.push(r);
      });
    });
    sectionsRef.current=secs;seqRef.current=allSeq;
    secPosRef.current=-1;secHitCounts.current={};actRef.current=-1;hitRef.current=0;
    sectionMap.current={};
  },[lyrics]);

  // ── Scroll a una sección ──────────────────────────────────────────────────
  const scrollToSection=useCallback((lineIdx)=>{
    if(lineIdx<0)return;
    const attempt=()=>{
      let y=sectionMap.current[lineIdx];
      if(y===undefined)return false;
      const targetY=Math.max(0,CONTENT_Y.current+y-80);
      scrollRef.current?.scrollTo({y:targetY,animated:true});
      scrollY.current=targetY;
      return true;
    };
    if(!attempt()){setTimeout(()=>{if(!attempt())setTimeout(attempt,300);},150);}
  },[]);

  // ── Ir a sección N ────────────────────────────────────────────────────────
  const goToSection=useCallback((secIdx)=>{
    const secs=sectionsRef.current;
    if(secIdx<0||secIdx>=secs.length)return;
    secPosRef.current=secIdx;
    const sec=secs[secIdx];
    scrollToSection(sec.lineIdx);
    if(sec.lineIdx!==actRef.current){actRef.current=sec.lineIdx;setActiveLine(sec.lineIdx);}
    secHitCounts.current={};hitRef.current=0;
  },[scrollToSection]);

  // ── startMic: CHORD SCORING detector ─────────────────────────────────────
  const startMic=useCallback(async()=>{
    if(Platform.OS==='android'){
      const r=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {title:'Micrófono',message:'Para el detector de voz.',buttonPositive:'Permitir',buttonNegative:'Cancelar'});
      if(r!==PermissionsAndroid.RESULTS.GRANTED)return;
    }
    vBuf.current=[];vHist.current=[];vSil.current=0;
    secPosRef.current=-1;secHitCounts.current={};actRef.current=-1;hitRef.current=0;
    setActiveLine(-1);setVoiceNote(null);

    const SR22=22050, FBUF=4096;
    const RMS_MIN=0.006, NOTE_WIN=16, MIN_GAP=1200;
    let lastJump=0;
    const secScores={}, noteWin=[];

    // Calcular exclusividad de cada root entre secciones
    const getRootCount=(secs)=>{
      const rc={};
      secs.forEach(s=>s.chordRoots.forEach(r=>{rc[r]=(rc[r]||0)+1;}));
      return rc;
    };

    const scoreSections=(secs,curIdx)=>{
      if(!secs.length||!noteWin.length)return;
      const rc=getRootCount(secs);
      secs.forEach((sec,si)=>{
        if(si===curIdx||!sec.chordRoots.length)return;
        let fs=0;
        noteWin.forEach(note=>{
          if(sec.chordRoots.includes(note)){
            fs+=0.5+(1/(rc[note]||1))*1.5;
          }
        });
        const norm=fs/(NOTE_WIN*sec.chordRoots.length*0.5);
        secScores[si]=(secScores[si]||0)*0.75+norm*0.25;
      });
      if(curIdx>=0)secScores[curIdx]=(secScores[curIdx]||0)*0.5;
    };

    const tryJump=(secs,curIdx)=>{
      const now=Date.now();
      if(now-lastJump<MIN_GAP)return;
      let bestSi=-1,bestScore=0;
      secs.forEach((_,si)=>{
        if(si===curIdx)return;
        const s=secScores[si]||0;
        if(s>bestScore){bestScore=s;bestSi=si;}
      });
      if(bestSi<0)return;
      const rc=getRootCount(secs);
      const unique=secs[bestSi].chordRoots.filter(r=>rc[r]===1).length;
      const thr=unique>=2?0.25:unique===1?0.35:0.45;
      if(bestScore>=thr){
        lastJump=now;
        goToSection(bestSi);
        Object.keys(secScores).forEach(k=>{secScores[k]*=0.2;});
        noteWin.length=0;
        hitRef.current=0;
      }
    };

    AudioRecord.init({sampleRate:SR22,channels:1,bitsPerSample:16,audioSource:6,wavFile:'fs_v.wav'});
    AudioRecord.on('data',data=>{
      try{
        const bin=atob(data),nS=Math.floor(bin.length/2);
        if(nS<1)return;
        const pcm=new Float32Array(nS);
        for(let i=0;i<nS;i++){let v=(bin.charCodeAt(i*2+1)<<8)|bin.charCodeAt(i*2);if(v>=32768)v-=65536;pcm[i]=v/32768;}
        let rms=0;for(let i=0;i<nS;i++)rms+=pcm[i]*pcm[i];rms=Math.sqrt(rms/nS);
        for(let i=0;i<nS;i++)vBuf.current.push(pcm[i]);
        if(vBuf.current.length>FBUF*3)vBuf.current=vBuf.current.slice(-FBUF);

        if(rms<RMS_MIN){
          vSil.current++;
          if(vSil.current>6)Object.keys(secScores).forEach(k=>{secScores[k]*=0.9;});
          if(vSil.current===10&&vFreeze.current){
            clearTimeout(vTimer.current);
            vTimer.current=setTimeout(()=>{vFreeze.current=null;setVoiceNote(null);},400);
          }
          return;
        }
        vSil.current=0;clearTimeout(vTimer.current);

        if(vBuf.current.length<FBUF)return;
        const frame=new Float32Array(vBuf.current.slice(-FBUF));
        const windowed=new Float32Array(FBUF);
        for(let i=0;i<FBUF;i++)windowed[i]=frame[i]*(0.5-0.5*Math.cos(2*Math.PI*i/(FBUF-1)));
        const freq=detectPitchF(windowed,SR22);

        if(freq>60&&freq<1400){
          vHist.current.push(freq);
          if(vHist.current.length>5)vHist.current.shift();
          const med=medianF(vHist.current);
          const info=freqToNoteF(med);
          if(info){
            vFreeze.current=info;setVoiceNote(info);
            noteWin.push(info.note);
            if(noteWin.length>NOTE_WIN)noteWin.shift();
            const secs=sectionsRef.current,cur=secPosRef.current;
            if(cur===-1&&noteWin.length>=3){lastJump=Date.now();goToSection(0);return;}
            if(secs.length>1&&noteWin.length>=6){scoreSections(secs,cur);tryJump(secs,cur);}
          }
        } else {vHist.current=[];}
      }catch(e){}
    });
    AudioRecord.start();setMicOn(true);
  },[goToSection]);

  const stopMic=useCallback(async()=>{
    try{await AudioRecord.stop();}catch(e){}
    clearTimeout(vTimer.current);
    vBuf.current=[];vHist.current=[];vFreeze.current=null;
    setMicOn(false);setVoiceNote(null);setActiveLine(-1);
  },[]);

  useEffect(()=>()=>{stopMic();clearInterval(rafRef.current);},[]);

  const handleFav = async () => {
    const v = fav ? 0 : 1; setFav(!fav);
    try {
      if (norm.tipo === 'cancionero') {
        try { await toggleFavoritoCancionero(norm.id, v); } catch(_) {}
        if (v === 1) await AsyncStorage.setItem(`fav_can_${norm.id}`, JSON.stringify({ ...cancion, es_favorito:1, tipo:'cancionero', titulo:norm.titulo, artista:norm.artista, letra:lyrics, tono:currentKey, bpm:norm.bpm, capo:norm.capo, intro:norm.intro, _savedAt:Date.now() }));
        else await AsyncStorage.removeItem(`fav_can_${norm.id}`);
      } else {
        try { await toggleFavorito(norm.id, v); } catch(_) {}
        if (v === 1) await AsyncStorage.setItem(`fav_letra_${norm.id}`, JSON.stringify({ ...cancion, es_favorito:1, cancion_letra:lyrics, cancion_tono:currentKey, _savedAt:Date.now() }));
        else await AsyncStorage.removeItem(`fav_letra_${norm.id}`);
      }
      onFavChange?.(norm.id, v);
    } catch(e) { console.warn('[CifraViewer] fav:', e.message); }
  };

  const capoNum = parseInt(cleanCapo(norm.capo)) || 0;

  return (
    <View style={VI.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white}/>

      {/* ── HEADER — fijo ── */}
      <View style={VI.header}>
        <TouchableOpacity style={VI.iconBtn} onPress={onClose}><Ionicons name="chevron-back" size={22} color={C.text}/></TouchableOpacity>
        <View style={{ flex:1 }}>
          <Text style={[VI.title,{fontFamily:F.bold}]} numberOfLines={1}>{norm.titulo}</Text>
          <Text style={[VI.artist,{fontFamily:F.regular}]} numberOfLines={1}>{norm.artista}</Text>
        </View>
        {lyrics&&<TouchableOpacity style={[VI.iconBtn,transpose&&VI.iconBtnOn]} onPress={()=>setTranspose(!transpose)}><MaterialCommunityIcons name="transfer-right" size={20} color={transpose?C.accent:C.textLight}/></TouchableOpacity>}
        <TouchableOpacity style={[VI.iconBtn,(metro||metroPlay)&&VI.iconBtnOn]} onPress={()=>setMetro(!metro)}>
          <MaterialCommunityIcons name="metronome" size={20} color={(metro||metroPlay)?C.accent:C.textLight}/>
          {metroPlay&&<View style={VI.playDot}/>}
        </TouchableOpacity>
        <TouchableOpacity style={VI.iconBtn} onPress={handleFav}>
          <Ionicons name={fav?'bookmark':'bookmark-outline'} size={20} color={fav?C.accent:C.textLight}/>
        </TouchableOpacity>
      </View>

      {/* ── INFO BAR ── */}
      {(!!norm.tono || norm.bpm > 0 || capoNum > 0 || !!norm.intro) && (
        <View style={VI.infoBar}>
          {/* ── UNA SOLA FILA: TONO · CAPO · BPM · INTRO ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={VI.infoRow} bounces={false}>

            {!!norm.tono && (
              <View style={VI.infoItem}>
                <Text style={[VI.infoKey,{fontFamily:F.extrabold}]}>TONO</Text>
                <Text style={[VI.infoVal,{fontFamily:F.black}]}>{currentKey||'—'}</Text>
              </View>
            )}

            {norm.bpm > 0 && (
              <View style={VI.infoItem}>
                <Text style={[VI.infoKey,{fontFamily:F.extrabold}]}>BPM</Text>
                <Text style={[VI.infoVal,{fontFamily:F.black}]}>{norm.bpm}</Text>
              </View>
            )}

            {!!norm.intro && (
              <View style={[VI.infoItem,{alignItems:'center',borderRightWidth:capoNum>0?1:0,paddingHorizontal:14}]}>
                <Text style={[VI.infoKey,{fontFamily:F.extrabold}]}>INTRO</Text>
                <View style={VI.introPills}>
                  {String(norm.intro).trim().split(/\s+/).filter(Boolean).map((ch,ci)=>(
                    <View key={ci} style={VI.introPill}>
                      <Text style={[VI.introPillTxt,{fontFamily:F.black}]} numberOfLines={1}>{ch}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {capoNum > 0 && (
              <View style={[VI.infoItem,{borderRightWidth:0}]}>
                <View style={VI.capoTopRow}>
                  <CapoIcon size={11} color={C.accent}/>
                  <Text style={[VI.infoKey,{fontFamily:F.extrabold}]}>CAPO</Text>
                </View>
                <Text style={[VI.capoNum,{fontFamily:F.black}]}>{capoNum}</Text>
                <Text style={[VI.capoTraste,{fontFamily:F.semibold}]}>Traste</Text>
              </View>
            )}

          </ScrollView>
        </View>
      )}

      {/* ── TOOLBAR — FIJO fuera del ScrollView ── */}
      <View style={VI.toolbar}>
        <TouchableOpacity style={VI.fontBtn} onPress={()=>setFontSize(p=>Math.max(11,p-1))}><Text style={[VI.fontBtnTxt,{fontFamily:F.bold,fontSize:11}]}>A−</Text></TouchableOpacity>
        <TouchableOpacity style={VI.fontBtn} onPress={()=>setFontSize(p=>Math.min(24,p+1))}><Text style={[VI.fontBtnTxt,{fontFamily:F.bold,fontSize:14}]}>A+</Text></TouchableOpacity>
        <View style={{flex:1}}/>
        {/* ★ Botón detector de voz */}
        <TouchableOpacity
          style={[VI.fontBtn, micOn && {backgroundColor:C.red+'18',borderColor:C.red+'40'}]}
          onPress={micOn?stopMic:startMic}>
          <Ionicons name={micOn?'mic':'mic-outline'} size={16} color={micOn?C.red:C.textLight}/>
          {micOn && <View style={{position:'absolute',top:2,right:2,width:6,height:6,borderRadius:3,backgroundColor:C.red}}/>}
        </TouchableOpacity>
        <TouchableOpacity style={[VI.autoBtn,autoScroll&&VI.autoBtnOn]}
          onPress={()=>{ if(!autoScroll){setAutoScroll(true);setShowSpeeds(true);}else{setAutoScroll(false);setShowSpeeds(false);} }}>
          <Ionicons name={autoScroll?'pause-circle':'play-circle-outline'} size={14} color={autoScroll?C.white:C.text}/>
          <Text style={[VI.autoBtnTxt,{fontFamily:F.bold,color:autoScroll?C.white:C.text}]}>{autoScroll?' Pausar':' Auto'}</Text>
        </TouchableOpacity>
      </View>

      {/* ★ Barra de nota detectada — visible solo cuando micrófono activo */}
      {micOn && (
        <View style={VI.micBar}>
          <Ionicons name="mic" size={12} color={C.red}/>
          <Text style={[VI.micBarTxt,{fontFamily:F.bold}]}>
            {voiceNote ? `${voiceNote.note}  ${voiceNote.cents>0?'+':''}${voiceNote.cents}¢` : 'Escuchando...'}
          </Text>
          {sectionsRef.current.length>0&&secPosRef.current>=0&&(
            <Text style={[VI.micBarSec,{fontFamily:F.semibold}]}>
              {sectionsRef.current[secPosRef.current]?.name?.toUpperCase()}
            </Text>
          )}
        </View>
      )}

      {/* ── VELOCIDADES — FIJO ── */}
      {autoScroll && showSpeeds && (
        <View style={VI.speedPanel}>
          <View style={VI.speedHeader}>
            <Text style={[VI.speedBpm,{fontFamily:F.extrabold}]}>VELOCIDAD</Text>
            {norm.bpm > 0 && (
              <Text style={[VI.speedBpmHint,{fontFamily:F.regular}]}>
                sugerida para {norm.bpm} BPM
              </Text>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={VI.speedBtns}>
            {SPEEDS.map(({label,v})=>{
              const isSuggested = norm.bpm > 0 && Math.abs(v - calcInitSpeed(norm.bpm)) < 0.05;
              return (
                <TouchableOpacity key={v}
                  style={[VI.speedChip, scrollSpeed===v && VI.speedChipOn,
                          isSuggested && scrollSpeed!==v && VI.speedChipSug]}
                  onPress={()=>setScrollSpeed(v)}>
                  <Text style={[VI.speedTxt,{fontFamily:F.bold},
                    scrollSpeed===v && VI.speedTxtOn,
                    isSuggested && scrollSpeed!==v && VI.speedTxtSug]}>
                    {label}
                  </Text>
                  {isSuggested && (
                    <View style={VI.speedDot}/>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={VI.speedClose} onPress={()=>setShowSpeeds(false)}>
            <Feather name="chevron-up" size={14} color={C.textLight}/>
          </TouchableOpacity>
        </View>
      )}

      {/* ── CHORD POPUP OVERLAY — nivel pantalla ── */}
      {chordPopup && (
        <TouchableOpacity style={VI.overlayBackdrop} activeOpacity={1} onPress={()=>setChordPopup(null)}>
          <View style={VI.overlayCard} onStartShouldSetResponder={()=>true}>
            <View style={VI.overlayHeader}>
              <Text style={[VI.overlayChordName,{fontFamily:F.black}]}>{chordPopup.chord}</Text>
              <TouchableOpacity style={VI.overlayClose} onPress={()=>setChordPopup(null)} hitSlop={{top:12,bottom:12,left:12,right:12}}>
                <Feather name="x" size={16} color={C.textMed}/>
              </TouchableOpacity>
            </View>
            <ChordDiagram chord={chordPopup.chord}/>
          </View>
        </TouchableOpacity>
      )}

      {/* ── SCROLLVIEW — SOLO la letra ── */}
      {!lyrics ? (
        <View style={VI.noLetra}>
          <Ionicons name="document-text-outline" size={40} color={C.border}/>
          <Text style={[VI.noLetraTxt,{fontFamily:F.semibold}]}>Sin cifrado disponible</Text>
        </View>
      ) : (
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}
          style={{ flex:1, backgroundColor:C.bg }}
          contentContainerStyle={VI.content}
          onScroll={e=>{ scrollY.current=e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}>
          {/* onLayout captura la Y del contenido para calcular scroll absoluto */}
          <View onLayout={e=>{CONTENT_Y.current=e.nativeEvent.layout.y;}}>
            {segments.map((seg,si)=>{
              if(seg.type==='tab') return <TabRiffViewer key={`tab_${si}`} tabText={seg.text} bpm={norm.bpm||100} style={{marginHorizontal:-16}}/>;
              return mergeChordOnlyLines(seg.lines).map((line,li)=>{
                // Calcular lineIdx real (posición en el array de lines)
                const realIdx = lines.findIndex((l,idx)=>idx>=(si===0?0:1)&&l===line)||si*1000+li;
                return (
                  <LyricLine key={`${si}_${li}`} line={line} fontSize={fontSize}
                    chordPopup={chordPopup} setChordPopup={setChordPopup}
                    lineIdx={realIdx}
                    activeLine={activeLine}
                    sectionMap={sectionMap}/>
                );
              });
            })}
          </View>
          <ChordSection lyrics={lyrics}/>
          <View style={{height:100}}/>
        </ScrollView>
      )}

      {transpose&&lyrics&&(
        <Transpositor visible currentKey={currentKey} originalKey={originalKey}
          onTranspose={handleTranspose}
          onReset={()=>{ setLyrics(rawLetra); setCurrentKey(originalKey); }}
          onClose={()=>setTranspose(false)}/>
      )}
      {/* ★ FIX METRÓNOMO: siempre montado (visible/hidden via prop)
           El timer sigue corriendo aunque se cierre el panel.
           Solo se detiene cuando el usuario presiona Detener. */}
      <Metronomo
        visible={metro}
        onClose={()=>setMetro(false)}
        initBpm={norm.bpm||80}
        onPlayingChange={setMetroPlay}
      />
    </View>
  );
}

// ── CANCIONERO TAB ────────────────────────────────────────────────────────────
function CancioneroTab() {
  const [canciones,setCanciones]=useState([]),[loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false),[q,setQ]=useState('');
  const [activeCat,setActiveCat]=useState('Todos'),[error,setError]=useState(null);
  const [selected,setSelected]=useState(null),[modal,setModal]=useState(false);
  const inputRef=useRef(null);

  const load=useCallback(async(isRefresh=false)=>{
    if(!isRefresh)setLoading(true); setError(null);
    try{ const data=await getCancionero(); setCanciones(Array.isArray(data)?data.map(normalizeCancion):[]);}
    catch(e){ setError(e.message); }
    setLoading(false); setRefreshing(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const CATS=['Todos',...new Set(canciones.map(c=>c.categoria).filter(Boolean))];
  const searching=q.trim().length>0||activeCat!=='Todos';
  const highlight=(text='',query='')=>{
    if(!query.trim())return[{text,match:false}];
    const idx=text.toLowerCase().indexOf(query.toLowerCase());
    if(idx<0)return[{text,match:false}];
    return[{text:text.slice(0,idx),match:false},{text:text.slice(idx,idx+query.length),match:true},{text:text.slice(idx+query.length),match:false}];
  };
  const filtered=searching?canciones.filter(c=>{
    const mc=activeCat==='Todos'||c.categoria===activeCat;
    const mq=!q.trim()||(c.titulo||'').toLowerCase().includes(q.toLowerCase())||(c.artista||'').toLowerCase().includes(q.toLowerCase());
    return mc&&mq;
  }):[];
  const handleFavChange=(id,val)=>setCanciones(prev=>prev.map(c=>c.id===id?{...c,es_favorito:val}:c));

  if(loading)return<View style={SH.center}><ActivityIndicator size="large" color={C.accent}/></View>;

  return (
    <View style={{flex:1,backgroundColor:C.bg}}>
      <View style={SH.searchWrap}>
        <View style={[SH.searchBox,q.length>0&&SH.searchBoxActive]}>
          <Feather name="search" size={15} color={q.length>0?C.accentDark:C.textLight} style={{marginRight:9}}/>
          <TextInput ref={inputRef} style={[SH.searchInput,{fontFamily:F.regular}]}
            placeholder="Busca una canción para ensayar..." placeholderTextColor={C.textLight}
            value={q} onChangeText={setQ} selectionColor={C.accent} autoCorrect={false} returnKeyType="search"/>
          {q.length>0&&<TouchableOpacity onPress={()=>{setQ('');inputRef.current?.focus();}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <View style={SH.clearBtn}><Feather name="x" size={11} color={C.textLight}/></View>
          </TouchableOpacity>}
        </View>
      </View>
      {CATS.length>1&&(
        <View style={SH.catsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={SH.catsContent} bounces={false}>
            {CATS.map(c=><TouchableOpacity key={c} style={[SH.chip,activeCat===c&&SH.chipOn]} onPress={()=>setActiveCat(c)}><Text style={[SH.chipTxt,{fontFamily:activeCat===c?F.bold:F.semibold},activeCat===c&&SH.chipTxtOn]}>{c}</Text></TouchableOpacity>)}
            <View style={{width:16}}/>
          </ScrollView>
        </View>
      )}
      {!searching&&(
        <View style={SH.searchPrompt}>
          <View style={SH.searchPromptIcon}><Feather name="search" size={28} color={C.border}/></View>
          <Text style={[SH.searchPromptTitle,{fontFamily:F.bold}]}>Encuentra tu canción</Text>
          <Text style={[SH.searchPromptSub,{fontFamily:F.regular}]}>Busca por nombre de la canción{'\n'}o artista para ver letra y acordes</Text>
          <View style={SH.searchPromptStats}><Text style={[SH.searchPromptStatTxt,{fontFamily:F.semibold}]}>{canciones.length} canciones disponibles</Text></View>
        </View>
      )}
      {searching&&(
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={SH.list} keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(true);}} tintColor={C.accent}/>}>
          {error&&<View style={SH.banner}><Feather name="wifi-off" size={12} color="#FF9500"/><Text style={[SH.bannerTxt,{fontFamily:F.semibold}]}>Sin conexión — mostrando caché</Text></View>}
          {q.trim().length>0&&<View style={SH.resultCount}><Text style={[SH.resultCountTxt,{fontFamily:F.semibold}]}>{filtered.length===0?`Sin resultados para "${q}"`:filtered.length===1?`1 resultado para "${q}"`:` ${filtered.length} resultados para "${q}"`}</Text></View>}
          {filtered.length===0&&!error&&<View style={SH.empty}><Ionicons name="musical-notes-outline" size={44} color={C.border}/><Text style={[SH.emptyTxt,{fontFamily:F.semibold}]}>{q.trim().length>0?`No encontramos "${q}"`:' Cancionero vacío'}</Text></View>}
          {filtered.map(c=>{
            const tp=highlight(c.titulo,q),ap=highlight(c.artista,q);
            const capoN=parseInt(cleanCapo(c.capo))||0;
            return(
              <TouchableOpacity key={c.id} style={SH.card} onPress={()=>{setSelected(c);setModal(true);}} activeOpacity={0.82}>
                <CancionCover uri={c.imagen} size={48}/>
                <View style={{flex:1}}>
                  <Text style={[SH.cardTitle,{fontFamily:F.bold}]} numberOfLines={2}>{tp.map((p,pi)=>p.match?<Text key={pi} style={SH.cardHighlight}>{p.text}</Text>:<Text key={pi}>{p.text}</Text>)}</Text>
                  <Text style={[SH.cardArtist,{fontFamily:F.regular}]} numberOfLines={1}>{ap.map((p,pi)=>p.match?<Text key={pi} style={SH.cardHighlightSub}>{p.text}</Text>:<Text key={pi}>{p.text}</Text>)}</Text>
                  <View style={SH.cardMeta}>
                    {c.tono&&<View style={SH.metaPill}><Text style={[SH.metaTxt,{fontFamily:F.bold}]}>{'Tono '+c.tono}</Text></View>}
                    {c.bpm>0&&<View style={SH.metaPill}><Text style={[SH.metaTxt,{fontFamily:F.bold}]}>{c.bpm+' BPM'}</Text></View>}
                    {/* ★ CAPO en card */}
                    {capoN>0&&<View style={[SH.metaPill,SH.metaPillCapo]}><CapoIcon size={10} color={C.accent}/><Text style={[SH.metaTxt,{fontFamily:F.bold,color:C.accentDark,marginLeft:4}]}>Capo {capoN}</Text></View>}
                    {(c.letra||'').length>5&&<View style={[SH.metaPill,SH.metaPillGreen]}><Text style={[SH.metaTxt,{fontFamily:F.bold,color:C.green}]}>● cifrado</Text></View>}
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color={C.border}/>
              </TouchableOpacity>
            );
          })}
          <View style={{height:80}}/>
        </ScrollView>
      )}
      <Modal visible={modal} animationType="slide" onRequestClose={()=>setModal(false)}>
        {selected&&<CifraViewer cancion={selected} onClose={()=>setModal(false)} onFavChange={handleFavChange}/>}
      </Modal>
    </View>
  );
}

// ── GUARDADOS TAB ─────────────────────────────────────────────────────────────
function GuardadosTab() {
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false),[selected,setSelected]=useState(null),[modal,setModal]=useState(false);

  const loadFromStorage=async()=>{
    try{
      const keys=await AsyncStorage.getAllKeys();
      const gk=keys.filter(k=>k.startsWith('fav_letra_')||k.startsWith('fav_can_'));
      if(!gk.length)return[];
      const pairs=await AsyncStorage.multiGet(gk);
      return pairs.map(([,v])=>{try{return JSON.parse(v);}catch{return null;}}).filter(Boolean).sort((a,b)=>(b._savedAt||0)-(a._savedAt||0));
    }catch{return[];}
  };
  const load=useCallback(async(isRefresh=false)=>{
    if(!isRefresh)setLoading(true);
    const stored=await loadFromStorage();
    try{const api=await getFavoritos();if(Array.isArray(api)&&api.length>0){const sid=new Set(stored.map(s=>String(s.id)));setItems([...stored,...api.filter(t=>!sid.has(String(t.id)))]);}else setItems(stored);}
    catch{setItems(stored);}
    setLoading(false);setRefreshing(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const openItem=async t=>{
    let item={...t};const norm=normalizeCancion(t);
    if(!norm.letra&&!norm.cancion_letra){const k=norm.tipo==='cancionero'?`fav_can_${norm.id}`:`fav_letra_${norm.id}`;try{const s=await AsyncStorage.getItem(k);if(s)item={...item,...JSON.parse(s)};}catch{}}
    setSelected(item);setModal(true);
  };
  const handleUnfav=async(id,tipo)=>{
    const k=tipo==='cancionero'?`fav_can_${id}`:`fav_letra_${id}`;
    try{await AsyncStorage.removeItem(k);}catch{}
    try{if(tipo==='cancionero')await toggleFavoritoCancionero(id,0);else await toggleFavorito(id,0);}catch{}
    setItems(prev=>prev.filter(t=>String(t.id)!==String(id)));setModal(false);
  };

  if(loading)return<View style={SH.center}><ActivityIndicator size="large" color={C.accent}/></View>;

  return(<>
    {items.length===0?(
      <View style={SH.empty}>
        <View style={SH.emptyIcon}><Ionicons name="bookmark-outline" size={32} color={C.textLight}/></View>
        <Text style={[SH.emptyTxt,{fontFamily:F.semibold}]}>Sin guardados</Text>
        <Text style={[SH.emptySub,{fontFamily:F.regular}]}>Toca el marcador en cualquier canción o tutorial{'\n'}para verlo sin internet</Text>
      </View>
    ):(
      <ScrollView showsVerticalScrollIndicator={false} style={{backgroundColor:C.bg}} contentContainerStyle={SH.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(true);}} tintColor={C.accent}/>}>
        {items.map(t=>{
          const norm=normalizeCancion(t);
          const esCan=norm.tipo==='cancionero';
          const tieneLetra=!!(norm.letra||norm.cancion_letra||t.letra);
          const capoN=parseInt(cleanCapo(norm.capo))||0;
          return(
            <TouchableOpacity key={`${norm.tipo}_${norm.id}`} style={SH.card} onPress={()=>openItem(t)} activeOpacity={0.82}>
              {esCan?<CancionCover uri={norm.imagen} size={48}/>:<View style={SH.noteBadge}><Ionicons name="play-circle" size={20} color={C.accent}/></View>}
              <View style={{flex:1}}>
                <Text style={[SH.cardTitle,{fontFamily:F.bold}]} numberOfLines={2}>{norm.titulo}</Text>
                <Text style={[SH.cardArtist,{fontFamily:F.regular}]} numberOfLines={1}>{norm.artista}</Text>
                <View style={SH.cardMeta}>
                  {norm.tono&&<View style={SH.metaPill}><Text style={[SH.metaTxt,{fontFamily:F.bold}]}>{'Tono '+norm.tono}</Text></View>}
                  {norm.bpm>0&&<View style={SH.metaPill}><Text style={[SH.metaTxt,{fontFamily:F.bold}]}>{norm.bpm+' BPM'}</Text></View>}
                  {/* ★ CAPO en guardados */}
                  {capoN>0&&<View style={[SH.metaPill,SH.metaPillCapo]}><CapoIcon size={10} color={C.accent}/><Text style={[SH.metaTxt,{fontFamily:F.bold,color:C.accentDark,marginLeft:4}]}>Capo {capoN}</Text></View>}
                  {tieneLetra&&<View style={[SH.metaPill,SH.metaPillGreen]}><Ionicons name="cloud-offline-outline" size={10} color={C.green}/><Text style={[SH.metaTxt,{fontFamily:F.bold,color:C.green,marginLeft:3}]}>{esCan?'Cifrado offline':'Letra offline'}</Text></View>}
                </View>
              </View>
              <TouchableOpacity style={SH.unfavBtn} onPress={()=>handleUnfav(norm.id,norm.tipo)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                <Ionicons name="bookmark" size={18} color={C.accent}/>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
        <View style={{height:80}}/>
      </ScrollView>
    )}
    <Modal visible={modal} animationType="slide" onRequestClose={()=>setModal(false)}>
      {selected&&<CifraViewer cancion={selected} onClose={()=>setModal(false)} onFavChange={(id)=>{const n=normalizeCancion(selected);handleUnfav(id,n.tipo);}}/>}
    </Modal>
  </>);
}

// ── PANTALLA PRINCIPAL ────────────────────────────────────────────────────────
export default function FavoritosScreen() {
  const [activeTab,setActiveTab]=useState('guardados');
  return(
    <View style={FS.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white}/>
      <View style={FS.header}>
        <View style={FS.logoWrap}>
          <View style={FS.iconWrap}><Ionicons name={activeTab==='guardados'?'bookmark':'musical-notes'} size={18} color={C.accent}/></View>
          <View>
            <Text style={[FS.headerTitle,{fontFamily:F.black}]}>{activeTab==='guardados'?'Guardados':'Canciones'}</Text>
            <Text style={[FS.headerSub,{fontFamily:F.extrabold}]}>{activeTab==='guardados'?'TUTORIALES OFFLINE':'LETRA & ACORDES'}</Text>
          </View>
        </View>
      </View>
      <View style={FS.tabsRow}>
        {[{id:'guardados',label:'GUARDADOS',icon:'bookmark',iconOff:'bookmark-outline'},{id:'cancionero',label:'CANCIONES',icon:'musical-notes',iconOff:'musical-notes-outline'}].map(tab=>(
          <TouchableOpacity key={tab.id} style={[FS.tab,activeTab===tab.id&&FS.tabOn]} onPress={()=>setActiveTab(tab.id)}>
            <Ionicons name={activeTab===tab.id?tab.icon:tab.iconOff} size={15} color={activeTab===tab.id?C.text:C.textLight}/>
            <Text style={[FS.tabTxt,{fontFamily:F.bold},activeTab===tab.id&&FS.tabTxtOn]}>{' '}{tab.label}</Text>
            {activeTab===tab.id&&<View style={FS.tabLine}/>}
          </TouchableOpacity>
        ))}
      </View>
      {activeTab==='guardados'?<GuardadosTab/>:<CancioneroTab/>}
    </View>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const FS=StyleSheet.create({
  screen:{flex:1,backgroundColor:C.white},
  header:{paddingTop:54,paddingHorizontal:20,paddingBottom:14,backgroundColor:C.white,borderBottomWidth:1,borderBottomColor:C.border},
  logoWrap:{flexDirection:'row',alignItems:'center',gap:12},
  iconWrap:{width:42,height:42,borderRadius:12,backgroundColor:C.accent+'22',borderWidth:1.5,borderColor:C.accent+'44',alignItems:'center',justifyContent:'center'},
  headerTitle:{fontSize:20,color:C.text},
  headerSub:{fontSize:8,color:C.accentDark,letterSpacing:4,marginTop:1},
  tabsRow:{flexDirection:'row',backgroundColor:C.white,borderBottomWidth:1,borderBottomColor:C.border},
  tab:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:14,position:'relative'},
  tabOn:{},tabTxt:{color:C.textLight,fontSize:11,letterSpacing:1.5},tabTxtOn:{color:C.text},
  tabLine:{position:'absolute',bottom:0,left:'20%',right:'20%',height:2.5,backgroundColor:C.accent,borderRadius:2},
});
const SH=StyleSheet.create({
  center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:C.bg},
  list:{paddingHorizontal:16,paddingTop:10},
  empty:{alignItems:'center',paddingVertical:60,gap:12,paddingHorizontal:32},
  emptyIcon:{width:72,height:72,borderRadius:36,backgroundColor:C.pill,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  emptyTxt:{color:C.textMed,fontSize:15,textAlign:'center'},emptySub:{color:C.textLight,fontSize:12,textAlign:'center',lineHeight:18},
  banner:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#FFF8F0',borderRadius:10,paddingHorizontal:12,paddingVertical:8,marginBottom:12,borderWidth:1,borderColor:'#FF950030'},
  bannerTxt:{color:'#FF9500',fontSize:11,flex:1},
  searchWrap:{paddingHorizontal:16,paddingTop:14,paddingBottom:10,backgroundColor:C.white},
  searchBox:{flexDirection:'row',alignItems:'center',backgroundColor:C.bg,borderRadius:14,borderWidth:1,borderColor:C.border,paddingHorizontal:14,paddingVertical:2},
  searchBoxActive:{borderColor:C.accent+'55',backgroundColor:C.white},
  searchInput:{flex:1,color:C.text,fontSize:15,paddingVertical:12},
  clearBtn:{width:22,height:22,borderRadius:11,backgroundColor:C.pill,alignItems:'center',justifyContent:'center'},
  catsWrap:{height:48,backgroundColor:C.white},catsContent:{paddingHorizontal:16,alignItems:'center',gap:8},
  chip:{paddingHorizontal:14,paddingVertical:8,borderRadius:999,backgroundColor:C.pill,borderWidth:1,borderColor:C.border},
  chipOn:{backgroundColor:C.text,borderColor:C.text},chipTxt:{color:C.textMed,fontSize:12},chipTxtOn:{color:C.white},
  searchPrompt:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:40,gap:12,backgroundColor:C.bg},
  searchPromptIcon:{width:72,height:72,borderRadius:36,backgroundColor:C.pill,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center',marginBottom:4},
  searchPromptTitle:{color:C.textMed,fontSize:16,textAlign:'center'},searchPromptSub:{color:C.textLight,fontSize:12,textAlign:'center',lineHeight:18},
  searchPromptStats:{backgroundColor:C.white,borderRadius:20,paddingHorizontal:16,paddingVertical:6,borderWidth:1,borderColor:C.border,marginTop:4},
  searchPromptStatTxt:{color:C.textMed,fontSize:11},
  resultCount:{paddingHorizontal:2,paddingBottom:10,paddingTop:4},resultCountTxt:{color:C.textLight,fontSize:11},
  card:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:C.white,borderRadius:14,padding:14,marginBottom:10,borderWidth:1,borderColor:C.border,shadowColor:'#000',shadowOpacity:0.04,shadowRadius:6,shadowOffset:{width:0,height:2},elevation:1},
  noteBadge:{width:48,height:48,borderRadius:10,backgroundColor:C.accent+'22',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.accent+'44',flexShrink:0},
  cardTitle:{color:C.text,fontSize:14,lineHeight:18,marginBottom:3},cardArtist:{color:C.textMed,fontSize:12,marginBottom:7},
  cardHighlight:{color:C.accentDark,fontWeight:'bold'},cardHighlightSub:{color:C.accent},
  cardMeta:{flexDirection:'row',gap:6,flexWrap:'wrap'},
  metaPill:{backgroundColor:C.pill,borderRadius:6,paddingHorizontal:7,paddingVertical:3,borderWidth:1,borderColor:C.border,flexDirection:'row',alignItems:'center'},
  metaTxt:{color:C.textMed,fontSize:10},metaPillGreen:{backgroundColor:C.green+'12',borderColor:C.green+'30'},
  metaPillCapo:{backgroundColor:C.accent+'12',borderColor:C.accent+'30'},  // ★ nuevo
  unfavBtn:{width:36,height:36,alignItems:'center',justifyContent:'center',flexShrink:0},
});
const VI=StyleSheet.create({
  container:{flex:1,backgroundColor:C.white},
  playDot:{position:'absolute',top:2,right:2,width:8,height:8,borderRadius:4,backgroundColor:C.accent,borderWidth:1,borderColor:C.white},
  header:{flexDirection:'row',alignItems:'center',gap:6,paddingTop:52,paddingBottom:12,paddingHorizontal:14,backgroundColor:C.white,borderBottomWidth:1,borderBottomColor:C.border},
  iconBtn:{width:38,height:38,borderRadius:19,backgroundColor:C.pill,alignItems:'center',justifyContent:'center'},
  iconBtnOn:{backgroundColor:C.accent+'22',borderWidth:1,borderColor:C.accent+'44'},
  title:{color:C.text,fontSize:14},artist:{color:C.textLight,fontSize:11,marginTop:1},
  // ── INFO BAR — UNA SOLA FILA HORIZONTAL ──────────────────────
  infoBar:       { backgroundColor:C.white, borderBottomWidth:1, borderBottomColor:C.border },
  infoRow:       { flexDirection:'row', alignItems:'stretch' },
  infoTopRow:    { flexDirection:'row' }, // legacy
  infoItem:      { paddingVertical:10, paddingHorizontal:14,
                   alignItems:'center', justifyContent:'center',
                   borderRightWidth:1, borderRightColor:C.border,
                   minWidth:70 },
  infoKey:       { color:C.accentDark, fontSize:9, letterSpacing:1.5, marginBottom:3 },
  infoVal:       { color:C.text, fontSize:18 },
  capoTopRow:    { flexDirection:'row', alignItems:'center', gap:3, marginBottom:2 },
  capoNum:       { color:C.text, fontSize:18, lineHeight:20 },
  capoTraste:    { color:C.textLight, fontSize:8, letterSpacing:1, marginTop:-2 },
  // INTRO inline — centrado, pills en fila
  introRow:      { flexDirection:'row', alignItems:'center',
                   paddingVertical:9, paddingHorizontal:14,
                   borderTopWidth:1, borderTopColor:C.border }, // legacy
  introPills:    { flexDirection:'row', alignItems:'center',
                   justifyContent:'center', gap:5, flexWrap:'nowrap',
                   marginTop:2 },
  introPill:     { backgroundColor:C.accent+'22', borderRadius:7,
                   paddingHorizontal:9, paddingVertical:4,
                   borderWidth:1, borderColor:C.accent+'55',
                   flexShrink:0, flexGrow:0 },
  introPillTxt:  { color:C.accentDark, fontSize:12, letterSpacing:0.3 },
  // ── legacy (no borrar) ────────────────────────────────────
  infoRow:       { flexDirection:'row' },
  introItem:     { flex:2, paddingVertical:10, paddingHorizontal:8,
                   alignItems:'center', justifyContent:'center',
                   borderRightWidth:1, borderRightColor:C.border },
  introChords:   { flexDirection:'row', alignItems:'center', gap:6, flexWrap:'nowrap' },
  introChordPill:{ backgroundColor:C.accent+'22', borderRadius:7,
                   paddingHorizontal:10, paddingVertical:4,
                   borderWidth:1, borderColor:C.accent+'55', flexShrink:0 },
  introChordTxt: { color:C.accentDark, fontSize:13, letterSpacing:0.3, fontWeight:'700' },
  introNotesRow: { flexDirection:'row', alignItems:'center', gap:8, flexWrap:'nowrap' },
  // ★ TOOLBAR fijo
  toolbar:{flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:10,backgroundColor:C.white,borderBottomWidth:1,borderBottomColor:C.border,gap:6},
  fontBtn:{width:32,height:32,backgroundColor:C.pill,borderRadius:8,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center',flexShrink:0},
  fontBtnTxt:{color:C.textMed},
  autoBtn:{flexDirection:'row',alignItems:'center',paddingHorizontal:10,paddingVertical:7,backgroundColor:C.pill,borderRadius:9,borderWidth:1,borderColor:C.border,flexShrink:0},
  autoBtnOn:{backgroundColor:C.text,borderColor:C.text},autoBtnTxt:{fontSize:12},
  speedPanel:{backgroundColor:C.bg,borderBottomWidth:1,borderBottomColor:C.border,paddingHorizontal:12,paddingTop:8,paddingBottom:6},
  speedHeader:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:7},
  speedBpm:{color:C.accentDark,fontSize:10,letterSpacing:1},
  speedBpmHint:{color:C.textLight,fontSize:10,flex:1},
  speedBtns:{gap:6,paddingRight:8},
  speedChip:{paddingVertical:7,paddingHorizontal:10,borderRadius:8,backgroundColor:C.white,borderWidth:1,borderColor:C.border,alignItems:'center',minWidth:44,position:'relative'},
  speedChipOn:{backgroundColor:C.text,borderColor:C.text},
  speedChipSug:{borderColor:C.accent+'55',backgroundColor:C.accent+'0A'},
  speedTxt:{color:C.textMed,fontSize:11},
  speedTxtOn:{color:C.white},
  speedTxtSug:{color:C.accentDark},
  speedDot:{position:'absolute',top:3,right:4,width:5,height:5,borderRadius:2.5,backgroundColor:C.accent},
  speedClose:{width:28,height:28,borderRadius:14,backgroundColor:C.pill,alignItems:'center',justifyContent:'center',alignSelf:'flex-end',marginTop:4},
  noLetra:{flex:1,alignItems:'center',justifyContent:'center',gap:10,padding:32,backgroundColor:C.bg},noLetraTxt:{color:C.textMed,fontSize:14},
  // ★ Scroll solo letra
  content:{paddingHorizontal:16,paddingTop:16},
  secWrap:{marginTop:20,marginBottom:8},
  sectionPill:{backgroundColor:C.accent+'18',alignSelf:'flex-start',borderRadius:8,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:C.accent+'30',flexDirection:'row',alignItems:'center',gap:6},
  sectionPillActive:{backgroundColor:C.accent,borderColor:C.accent},
  sectionPillDot:{width:6,height:6,borderRadius:3,backgroundColor:C.white},
  sec:{color:C.accentDark,fontSize:10,letterSpacing:2},
  lineBlock:{marginBottom:14},
  lineBlockActive:{borderLeftWidth:2,borderLeftColor:C.accent,paddingLeft:8,marginLeft:-10},
  lyric:{color:C.textMed,lineHeight:24},
  // ★ Barra de micrófono activo
  micBar:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,paddingVertical:7,backgroundColor:C.red+'08',borderBottomWidth:1,borderBottomColor:C.red+'20'},
  micBarTxt:{color:C.red,fontSize:12,flex:1},
  micBarSec:{color:C.accent,fontSize:10,letterSpacing:1,backgroundColor:C.accent+'18',borderRadius:5,paddingHorizontal:8,paddingVertical:2},
  segRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'flex-end'},
  segRowChordOnly:{flexWrap:'nowrap'},
  seg:{flexDirection:'column',alignItems:'flex-start',marginRight:1},
  segChord:{letterSpacing:0.5,lineHeight:22,minWidth:8},segTxt:{lineHeight:24,minWidth:4},
  overlayBackdrop:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:200,backgroundColor:'rgba(0,0,0,0.18)',alignItems:'center',justifyContent:'center'},
  overlayCard:{backgroundColor:C.white,borderRadius:20,padding:20,minWidth:160,maxWidth:260,shadowColor:'#000',shadowOpacity:0.15,shadowRadius:20,shadowOffset:{width:0,height:8},elevation:20,borderWidth:1,borderColor:C.border},
  overlayHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},
  overlayChordName:{color:C.text,fontSize:28,lineHeight:32},
  overlayClose:{width:32,height:32,borderRadius:16,backgroundColor:C.pill,alignItems:'center',justifyContent:'center'},
});
const CDS=StyleSheet.create({
  wrap:{backgroundColor:C.white,paddingBottom:16,borderTopWidth:1,borderTopColor:C.border},
  header:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:20,paddingTop:18,paddingBottom:14},
  line:{flex:1,height:1,backgroundColor:C.border},title:{color:C.accentDark,fontSize:10,letterSpacing:2},
  gridRow:{flexDirection:'row',paddingHorizontal:14,gap:8,marginBottom:8},
  card:{flex:1,backgroundColor:C.bg,borderRadius:12,padding:12,borderWidth:1,borderColor:C.border,alignItems:'center',minHeight:60},
});
const TP=StyleSheet.create({
  backdrop:{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.2)',zIndex:15},
  card:{position:'absolute',top:0,left:0,right:0,backgroundColor:C.white,borderBottomLeftRadius:24,borderBottomRightRadius:24,borderWidth:1,borderTopWidth:0,borderColor:C.border,paddingBottom:20,zIndex:20,elevation:20,shadowColor:'#000',shadowOpacity:0.08,shadowRadius:16,shadowOffset:{width:0,height:8}},
  handle:{width:36,height:4,borderRadius:2,backgroundColor:C.border,alignSelf:'center',marginTop:10,marginBottom:14},
  row:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:20,marginBottom:14},label:{flex:1,color:C.text,fontSize:14},
  resetBtn:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:C.pill,borderRadius:8,paddingHorizontal:10,paddingVertical:5,borderWidth:1,borderColor:C.border},resetTxt:{color:C.textMed,fontSize:11},
  closeBtn:{width:32,height:32,borderRadius:16,backgroundColor:C.pill,alignItems:'center',justifyContent:'center'},
  ctrlRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:20,marginBottom:16,paddingHorizontal:20},
  semiBtn:{width:52,height:52,borderRadius:26,backgroundColor:C.pill,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  keyDisplay:{flex:1,alignItems:'center'},keyNote:{color:C.text,fontSize:48,lineHeight:52},keyDiff:{fontSize:13,marginTop:-4},
  keysRow:{paddingBottom:4,gap:8,paddingLeft:20},
  chip:{paddingHorizontal:14,paddingVertical:9,borderRadius:999,backgroundColor:C.pill,borderWidth:1,borderColor:C.border,alignItems:'center',minWidth:44},
  chipOn:{backgroundColor:C.text,borderColor:C.text},chipOrig:{borderColor:C.accent},chipTxt:{color:C.textMed,fontSize:13},origDot:{width:5,height:5,borderRadius:2.5,backgroundColor:C.accent,marginTop:3},
});
const MET=StyleSheet.create({
  backdrop:{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.2)',zIndex:15},
  card:{position:'absolute',top:0,left:0,right:0,backgroundColor:C.white,borderBottomLeftRadius:24,borderBottomRightRadius:24,borderWidth:1,borderTopWidth:0,borderColor:C.border,paddingBottom:20,zIndex:20,elevation:20,shadowColor:'#000',shadowOpacity:0.08,shadowRadius:16,shadowOffset:{width:0,height:8}},
  handle:{width:36,height:4,borderRadius:2,backgroundColor:C.border,alignSelf:'center',marginTop:10,marginBottom:14},
  closeBtn:{width:32,height:32,borderRadius:16,backgroundColor:C.pill,alignItems:'center',justifyContent:'center'},
  badge:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#F0FDF4',borderRadius:8,paddingHorizontal:8,paddingVertical:4,borderWidth:1,borderColor:C.green+'44'},
  badgeDot:{width:6,height:6,borderRadius:3,backgroundColor:C.green},badgeTxt:{color:C.green,fontSize:9,letterSpacing:1.5},
  row:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:20,marginBottom:14},title:{flex:1,color:C.text,fontSize:15},
  beats:{flexDirection:'row',justifyContent:'center',gap:10,marginBottom:14},
  dot:{width:13,height:13,borderRadius:6.5,backgroundColor:C.pill,borderWidth:1,borderColor:C.border},
  dotOn:{backgroundColor:C.accent+'55'},dotStrong:{backgroundColor:C.accent,transform:[{scale:1.3}]},
  pulsoWrap:{alignItems:'center',marginBottom:14},
  ball:{width:56,height:56,borderRadius:28,backgroundColor:C.pill,borderWidth:2,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  ballCore:{width:24,height:24,borderRadius:12,backgroundColor:C.border},ballCoreOn:{backgroundColor:C.accent},
  bpmCtrl:{flexDirection:'row',justifyContent:'center',gap:8,marginBottom:6},
  adjBtn:{paddingHorizontal:14,paddingVertical:9,backgroundColor:C.pill,borderRadius:10,borderWidth:1,borderColor:C.border},adjTxt:{color:C.text,fontSize:13},
  bpmShow:{alignItems:'center',marginBottom:14},bpmNum:{color:C.text,fontSize:50,lineHeight:54},bpmLbl:{color:C.textLight,fontSize:11,letterSpacing:3,marginTop:-4},
  compasRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:14},compasLbl:{color:C.textMed,fontSize:12},
  cBtn:{paddingHorizontal:12,paddingVertical:7,backgroundColor:C.pill,borderRadius:8,borderWidth:1,borderColor:C.border},cBtnOn:{backgroundColor:C.text,borderColor:C.text},cTxt:{color:C.textMed,fontSize:12},cTxtOn:{color:C.white},
  preset:{paddingHorizontal:12,paddingVertical:7,backgroundColor:C.pill,borderRadius:999,borderWidth:1,borderColor:C.border,marginRight:8,alignItems:'center'},presetOn:{backgroundColor:C.accent+'22',borderColor:C.accent+'55'},presetL:{color:C.textMed,fontSize:11},presetB:{color:C.textLight,fontSize:10},
  playBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',backgroundColor:C.accent,borderRadius:12,paddingVertical:13,marginBottom:4,marginHorizontal:20},stopBtn:{backgroundColor:C.red},playTxt:{fontSize:15},
});