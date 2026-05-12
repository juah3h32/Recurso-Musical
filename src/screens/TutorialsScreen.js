import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import YoutubeIframe from 'react-native-youtube-iframe';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Linking, TextInput, Modal, ActivityIndicator,
  RefreshControl, Animated, Image, Dimensions, Share,
  Platform, PermissionsAndroid,
} from 'react-native';
import AudioRecord from 'react-native-audio-record';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTutorialesByCategoria, buscarTutoriales, toggleFavorito } from '../utils/turso';
import { F } from '../utils/fonts';
import { TONOS, transposeLyrics, semitonesBetween, detectKey } from '../utils/transpose';
import { extractChords } from '../utils/chords';
import ChordDiagram from '../components/ChordDiagram';

const { width: SW } = Dimensions.get('window');
const CATS     = ['Todos','Guitarra','Piano','Multitracks','Programas'];
const CARD_BGS = ['#E8F3FF','#EDF7F0','#FFF3EC','#F3EEFF','#ECF7FF','#FFFAEC'];

// ── Thumbnail helpers ─────────────────────────────────────────────────────────
const YT_QUALITIES = ['hqdefault','mqdefault','sddefault','default'];
const ytThumb = (id, q='hqdefault') => `https://img.youtube.com/vi/${id}/${q}.jpg`;

const cleanCapo = (val) =>
  String(val||'').replace(/\s*(traste|°\s*traste)/gi,'').trim();

// Parsea capítulos desde la descripción (formato estándar YouTube):
// "0:00 Intro\n0:45 Verso\n1:30 Coro"
function parseCapitulos(descripcion) {
  if (!descripcion) return [];
  const out = [];
  for (const line of descripcion.split('\n')) {
    const m = line.trim().match(/^(\d+):(\d{2})(?::(\d{2}))?\s+(.+)$/);
    if (!m) continue;
    const hasH = m[3] !== undefined;
    const h  = hasH ? parseInt(m[1]) : 0;
    const mm = hasH ? parseInt(m[2]) : parseInt(m[1]);
    const ss = hasH ? parseInt(m[3]) : parseInt(m[2]);
    out.push({ name: m[4].trim().toUpperCase(), seconds: h*3600 + mm*60 + ss });
  }
  return out.sort((a,b) => a.seconds - b.seconds);
}

function extractSections(lyrics) {
  if (!lyrics) return [];
  const seen = new Set(), out = [];
  for (const line of lyrics.split('\n')) {
    const t = line.trim();
    if (/^\[[^\]]+\]$/.test(t)) {
      const name = t.slice(1,-1).replace(/\d+:\d{2}(?::\d{2})?/g,'').trim().toUpperCase();
      if (name && !seen.has(name)) { seen.add(name); out.push(name); }
    }
  }
  return out;
}

const CHAP_KEY = (id) => `chapters_v1_${id}`;
const SEC_COLORS = { INTRO:'#00BFFF', VERSO:'#00CC88', CORO:'#FF6B6B', PUENTE:'#FFB347', OUTRO:'#AA88FF' };
const secColor = (name) => SEC_COLORS[name] || '#00BFFF';

function fmtTime(s) {
  const t = Math.floor(s);
  const m = Math.floor(t/60), ss = t%60;
  return `${m}:${String(ss).padStart(2,'0')}`;
}

// ── YtImage: fallback automático entre calidades ──────────────────────────────
function YtImage({ youtubeId, style, resizeMode='cover', onAllFailed }) {
  const [idx, setIdx]       = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setIdx(0); setFailed(false); }, [youtubeId]);
  if (failed || !youtubeId) return null;
  return (
    <Image
      source={{ uri: ytThumb(youtubeId, YT_QUALITIES[idx]) }}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        const next = idx + 1;
        if (next < YT_QUALITIES.length) setIdx(next);
        else { setFailed(true); onAllFailed?.(); }
      }}
    />
  );
}

// ── parseChordLine ────────────────────────────────────────────────────────────
// "[C]Cuan hermoso eres, [G]Jesús"
// → [{ chord:'C', text:'Cuan hermoso eres, ' }, { chord:'G', text:'Jesús' }]
function parseChordLine(line) {
  const segments = [];
  const firstBracket = line.indexOf('[');
  if (firstBracket > 0) {
    segments.push({ chord: null, text: line.slice(0, firstBracket) });
  }
  const regex = /\[([^\]]+)\]([^\[]*)/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    segments.push({ chord: match[1], text: match[2] });
  }
  return segments;
}

// ── METRÓNOMO ─────────────────────────────────────────────────────────────────
function Metronomo({ visible, onClose, initBpm=80, onPlayingChange }) {
  const [bpm,setBpm]       = useState(initBpm);
  const [on,setOn]         = useState(false);
  const [beat,setBeat]     = useState(0);
  const [compas,setCompas] = useState(4);
  const scale     = useRef(new Animated.Value(1)).current;
  const timer     = useRef(null);
  const bRef      = useRef(0);
  const slideAnim = useRef(new Animated.Value(-440)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim,{ toValue:visible?0:-440, tension:80, friction:10, useNativeDriver:true }),
      Animated.timing(fadeAnim, { toValue:visible?1:0, duration:visible?200:180, useNativeDriver:true }),
    ]).start();
  }, [visible]);

  useEffect(() => {
    if (on) {
      timer.current = setInterval(() => {
        bRef.current = (bRef.current % compas) + 1;
        setBeat(bRef.current);
        Animated.sequence([
          Animated.timing(scale,{ toValue:bRef.current===1?1.5:1.18, duration:55, useNativeDriver:true }),
          Animated.timing(scale,{ toValue:1, duration:145, useNativeDriver:true }),
        ]).start();
      }, (60/bpm)*1000);
    } else { clearInterval(timer.current); setBeat(0); bRef.current=0; }
    return () => clearInterval(timer.current);
  }, [on,bpm,compas]);

  useEffect(() => { onPlayingChange?.(on); }, [on]);
  const adj = d => setBpm(p=>Math.min(240,Math.max(30,p+d)));
  const handleClose = () => { setOn(false); onClose(); };

  return (
    <>
      <Animated.View pointerEvents="auto" style={[M.backdrop,{opacity:fadeAnim}]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleClose} activeOpacity={1}/>
      </Animated.View>
      <Animated.View style={[M.floatingCard,{transform:[{translateY:slideAnim}],opacity:fadeAnim}]}>
        <View style={M.handle}/>
        <View style={M.row}>
          <MaterialCommunityIcons name="metronome" size={18} color="#00BFFF"/>
          <Text style={[M.title,{fontFamily:F.bold}]}>Metrónomo</Text>
          {on&&<View style={M.playingBadge}><View style={M.playingDot}/><Text style={[M.playingTxt,{fontFamily:F.bold}]}>SONANDO</Text></View>}
          <TouchableOpacity style={M.closeBtn} onPress={handleClose} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Feather name="x" size={16} color="#444"/>
          </TouchableOpacity>
        </View>
        <View style={M.beats}>
          {Array.from({length:compas}).map((_,i)=>(
            <View key={i} style={[M.dot,beat===i+1&&M.dotOn,beat===i+1&&i===0&&M.dotStrong]}/>
          ))}
        </View>
        <View style={M.pulsoWrap}>
          <Animated.View style={[M.ball,{transform:[{scale}]}]}>
            <View style={[M.ballCore,on&&M.ballCoreOn]}/>
          </Animated.View>
        </View>
        <View style={M.bpmCtrl}>
          {[{l:'−5',d:-5},{l:'−1',d:-1},{l:'+1',d:1},{l:'+5',d:5}].map(b=>(
            <TouchableOpacity key={b.l} style={M.adjBtn} onPress={()=>adj(b.d)}>
              <Text style={[M.adjTxt,{fontFamily:F.bold}]}>{b.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={M.bpmShow}>
          <Text style={[M.bpmNum,{fontFamily:F.black}]}>{bpm}</Text>
          <Text style={[M.bpmLbl,{fontFamily:F.semibold}]}>BPM</Text>
        </View>
        <View style={M.compasRow}>
          <Text style={[M.compasLbl,{fontFamily:F.semibold}]}>Compás:</Text>
          {[2,3,4,6].map(c=>(
            <TouchableOpacity key={c} style={[M.cBtn,compas===c&&M.cBtnOn]}
              onPress={()=>{setCompas(c);setBeat(0);bRef.current=0;}}>
              <Text style={[M.cTxt,{fontFamily:F.bold},compas===c&&M.cTxtOn]}>{c}/4</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
          {[{l:'Largo',b:50},{l:'Adagio',b:66},{l:'Andante',b:76},{l:'Moderato',b:96},{l:'Allegro',b:120},{l:'Vivace',b:156},{l:'Presto',b:180}].map(p=>(
            <TouchableOpacity key={p.l} style={[M.preset,bpm===p.b&&M.presetOn]} onPress={()=>setBpm(p.b)}>
              <Text style={[M.presetL,{fontFamily:F.semibold}]}>{p.l}</Text>
              <Text style={[M.presetB,{fontFamily:F.regular}]}>{p.b}</Text>
            </TouchableOpacity>
          ))}
          <View style={{width:14}}/>
        </ScrollView>
        <TouchableOpacity style={[M.playBtn,on&&M.stopBtn]} onPress={()=>setOn(!on)}>
          <Ionicons name={on?'stop':'play'} size={18} color={on?'#fff':'#000'}/>
          <Text style={[M.playTxt,{fontFamily:F.extrabold,color:on?'#fff':'#000'}]}>
            {on?'  Detener':'  Iniciar'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

// ── TRANSPOSITOR ──────────────────────────────────────────────────────────────
function Transpositor({ visible, currentKey, originalKey, onTranspose, onReset, onClose }) {
  const semis     = semitonesBetween(originalKey, currentKey);
  const slideAnim = useRef(new Animated.Value(-260)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim,{toValue:visible?0:-260,tension:80,friction:10,useNativeDriver:true}),
      Animated.timing(fadeAnim, {toValue:visible?1:0,duration:visible?200:180,useNativeDriver:true}),
    ]).start();
  }, [visible]);

  return (
    <>
      <Animated.View pointerEvents="auto" style={[TP.backdrop,{opacity:fadeAnim}]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1}/>
      </Animated.View>
      <Animated.View style={[TP.floatingCard,{transform:[{translateY:slideAnim}],opacity:fadeAnim}]}>
        <View style={TP.handle}/>
        <View style={TP.row}>
          <MaterialCommunityIcons name="transfer-right" size={16} color="#00BFFF"/>
          <Text style={[TP.label,{fontFamily:F.bold}]}>Transpositor de tonalidad</Text>
          {semis!==0&&(
            <TouchableOpacity style={TP.resetBtn} onPress={onReset}>
              <Feather name="rotate-ccw" size={13} color="#888"/>
              <Text style={[TP.resetTxt,{fontFamily:F.semibold}]}> Orig. {originalKey}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={TP.closeBtn} onPress={onClose} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Feather name="x" size={18} color="#444"/>
          </TouchableOpacity>
        </View>
        <View style={TP.ctrlRow}>
          <TouchableOpacity style={TP.semiBtn} onPress={()=>onTranspose(-1)}>
            <Feather name="minus" size={22} color="#fff"/>
          </TouchableOpacity>
          <View style={TP.keyDisplay}>
            <Text style={[TP.keyNote,{fontFamily:F.black}]}>{currentKey}</Text>
            <Text style={[TP.keyDiff,{fontFamily:F.bold,color:semis>0?'#4CAF50':semis<0?'#FF6B6B':'#555'}]}>
              {semis>0?`+${semis}`:semis===0?'original':semis} semitonos
            </Text>
          </View>
          <TouchableOpacity style={TP.semiBtn} onPress={()=>onTranspose(1)}>
            <Feather name="plus" size={22} color="#fff"/>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={TP.keysRow}>
          {TONOS.map(k=>(
            <TouchableOpacity key={k}
              style={[TP.keyChip,currentKey===k&&TP.keyChipOn,k===originalKey&&currentKey!==k&&TP.keyChipOrig]}
              onPress={()=>onTranspose(semitonesBetween(currentKey,k))}>
              <Text style={[TP.keyChipTxt,{fontFamily:F.bold},currentKey===k&&{color:'#000'}]}>{k}</Text>
              {k===originalKey&&<View style={TP.origDot}/>}
            </TouchableOpacity>
          ))}
          <View style={{width:14}}/>
        </ScrollView>
      </Animated.View>
    </>
  );
}

// ── PITCH DETECTION ───────────────────────────────────────────────────────────
const SR_V=44100,DS_V=8,SR_EV=Math.round(SR_V/DS_V),BUF_V=2048,HOP_V=512;
const NOTES_VOICE    = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTES_ES_VOICE = ['Do','Do#','Re','Re#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
function dsVoice(pcm,f){const o=new Float32Array(Math.floor(pcm.length/f));for(let i=0;i<o.length;i++){let s=0;for(let j=0;j<f;j++)s+=pcm[i*f+j];o[i]=s/f;}return o;}
function hannV(b){const N=b.length,o=new Float32Array(N);for(let i=0;i<N;i++)o[i]=b[i]*(0.5-0.5*Math.cos(2*Math.PI*i/(N-1)));return o;}
function yinV(buf,sr){const W=Math.floor(buf.length/2),tMin=Math.max(2,Math.ceil(sr/1100)),tMax=Math.min(W-1,Math.floor(sr/70));const d=new Float32Array(W);for(let t=tMin;t<=tMax;t++){let s=0;for(let i=0;i<W;i++){const x=buf[i]-buf[i+t];s+=x*x;}d[t]=s;}const dn=new Float32Array(W);dn[0]=1;let rs=0;for(let t=1;t<=tMax;t++){rs+=d[t];dn[t]=rs>0?(d[t]*t)/rs:1;}for(let t=tMin;t<=tMax;t++){if(dn[t]<0.13){while(t+1<=tMax&&dn[t+1]<dn[t])t++;const p=t>1?t-1:t,n=t<W-1?t+1:t,den=2*dn[t]-dn[p]-dn[n];return sr/(den!==0?t+(dn[n]-dn[p])/(2*den):t);}}let bT=tMin,bV=Infinity;for(let t=tMin;t<=tMax;t++)if(dn[t]<bV){bV=dn[t];bT=t;}return bV<0.32?sr/bT:-1;}
function voiceFreqToNote(freq){if(!freq||freq<70||freq>1100)return null;const m=12*Math.log2(freq/440)+69,r=Math.round(m),idx=((r%12)+12)%12;return{note:NOTES_VOICE[idx],noteEs:NOTES_ES_VOICE[idx],cents:Math.round((m-r)*100),freq:Math.round(freq*10)/10};}
const NOTE_FREQS={'C':[65.41,130.81,261.63,523.25],'C#':[69.30,138.59,277.18,554.37],'D':[73.42,146.83,293.66,587.33],'D#':[77.78,155.56,311.13,622.25],'E':[82.41,164.81,329.63,659.25],'F':[87.31,174.61,349.23,698.46],'F#':[92.50,185.00,369.99,739.99],'G':[98.00,196.00,392.00,784.00],'G#':[103.83,207.65,415.30,830.61],'A':[110.00,220.00,440.00,880.00],'A#':[116.54,233.08,466.16,932.33],'B':[123.47,246.94,493.88,987.77]};
function chordToRoot(c){const m=c.match(/^([A-G][#b]?)/);return m?m[1]:null;}
function freqMatchesNote(freq,n){const fs=NOTE_FREQS[n];if(!fs)return false;for(const f of fs)if(Math.abs(1200*Math.log2(freq/f))<55)return true;return false;}

// ── LETRA VIEWER ──────────────────────────────────────────────────────────────
function LetraViewer({
  lyrics, bpm, outerScrollRef,
  autoScroll, setAutoScroll: _setAutoScroll, showSpeeds: _showSpeeds, setShowSpeeds: _setShowSpeeds,
  scrollSpeed, setScrollSpeed: _setScrollSpeed, scrollY,
  fontSize, setFontSize: _setFontSize,
  micOn, setMicOn, onVoiceNote, onSeqInfo, detectRef,
  jumpSectionRef,
}) {
  const scrollRef = outerScrollRef;
  const lineYMap  = useRef({});
  const sectionLineMap = useRef({});
  const [voiceNote,  setVoiceNote]  = useState(null);
  const [activeLine, setActiveLine] = useState(-1);
  const [chordSeq,   setChordSeq]   = useState([]);
  const [seqPos,     setSeqPos]     = useState(-1);

  const vBufRef=useRef([]),vHistRef=useRef([]),vSilRef=useRef(0),vFreezeRef=useRef(null),vTimerRef=useRef(null);
  const activeRef=useRef(-1),seqRef=useRef([]),seqPosRef=useRef(-1),blockRef=useRef(false),singableRef=useRef([]),hitCountRef=useRef(0);
  const rafRef    = useRef(null);
  const baseSpeed = bpm ? (bpm/60)*0.85 : 1.0;
  const CONTENT_OFFSET = useRef(0);
  const lines = (lyrics||'').split('\n');

  useEffect(()=>{
    const sb=[],seq=[],secMap={};
    lines.forEach((line,i)=>{
      if(!line.trim())return;
      if(/^\[[^\]]+\]$/.test(line.trim())){
        const sec=line.trim().slice(1,-1).replace(/\d+:\d{2}(?::\d{2})?/g,'').trim().toUpperCase();
        secMap[sec]=i;return;
      }
      if(line.replace(/\[[^\]]+\]/g,'').trim().length>0)sb.push(i);
      [...line.matchAll(/\[([^\]]+)\]/g)].forEach(m=>{const root=chordToRoot(m[1]);if(root)seq.push({lineIdx:i,chord:m[1],root});});
    });
    sectionLineMap.current=secMap;
    singableRef.current=sb;seqRef.current=seq;setChordSeq(seq);seqPosRef.current=-1;setSeqPos(-1);
  },[lyrics]);

  const handleLineLayout=useCallback((i,e)=>{lineYMap.current[i]=e.nativeEvent.layout.y;},[]);
  const scrollToLine=useCallback((lineIdx)=>{
    if(lineIdx<0)return;
    const go=()=>{const y=lineYMap.current[lineIdx];if(y!==undefined){const t=Math.max(0,CONTENT_OFFSET.current+y-80);scrollRef.current?.scrollTo({y:t,animated:true});scrollY.current=t;}};
    go();setTimeout(go,150);setTimeout(go,400);
  },[]);
  useEffect(()=>{if(activeLine>=0)scrollToLine(activeLine);},[activeLine]);

  useEffect(()=>{
    if(!jumpSectionRef)return;
    jumpSectionRef.current=(sectionName)=>{
      const name=(sectionName||'').toUpperCase().trim();
      const map=sectionLineMap.current;
      // 1. Coincidencia exacta
      let idx=map[name];
      // 2. La sección empieza con el nombre del capítulo (ej "CORO 1" → busca "CORO")
      if(idx===undefined){
        for(const key of Object.keys(map)){
          if(key.startsWith(name)||name.startsWith(key)){idx=map[key];break;}
        }
      }
      if(idx!==undefined)scrollToLine(idx);
    };
  },[jumpSectionRef,scrollToLine]);

  useEffect(()=>{
    if(autoScroll&&!micOn){
      if(scrollRef.current?._scrollY!==undefined)scrollY.current=scrollRef.current._scrollY;
      const ppf=Math.max(0.3,(baseSpeed*scrollSpeed)*0.55);
      rafRef.current=setInterval(()=>{scrollY.current+=ppf;scrollRef.current?.scrollTo({y:scrollY.current,animated:false});},16);
    }else clearInterval(rafRef.current);
    return()=>clearInterval(rafRef.current);
  },[autoScroll,micOn,baseSpeed,scrollSpeed]);

  const advanceSeq=useCallback(()=>{
    if(blockRef.current)return;blockRef.current=true;setTimeout(()=>{blockRef.current=false;},200);
    const seq=seqRef.current;if(!seq.length)return;
    const next=Math.min(seqPosRef.current+1,seq.length-1);seqPosRef.current=next;setSeqPos(next);hitCountRef.current=0;
    const nl=seq[next].lineIdx;if(nl!==activeRef.current){activeRef.current=nl;setActiveLine(nl);}
    onSeqInfo?.({curChord:seq[next]??null,nextChord:seq[next+1]??null});
  },[]);

  const startSeq=useCallback(()=>{
    const seq=seqRef.current;if(!seq.length)return;
    seqPosRef.current=0;setSeqPos(0);activeRef.current=seq[0].lineIdx;setActiveLine(seq[0].lineIdx);hitCountRef.current=0;
    onSeqInfo?.({curChord:seq[0]??null,nextChord:seq[1]??null});
  },[]);

  const startMic=useCallback(async()=>{
    if(Platform.OS==='android'){
      const r=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {title:'Micrófono',message:'Para el detector de voz.',buttonPositive:'Permitir',buttonNegative:'Cancelar'});
      if(r!==PermissionsAndroid.RESULTS.GRANTED)return;
    }
    vBufRef.current=[];vHistRef.current=[];vSilRef.current=0;activeRef.current=-1;
    seqPosRef.current=-1;hitCountRef.current=0;blockRef.current=false;
    setActiveLine(-1);setSeqPos(-1);setVoiceNote(null);
    AudioRecord.init({sampleRate:SR_V,channels:1,bitsPerSample:16,audioSource:6,wavFile:'kara.wav'});
    AudioRecord.on('data',data=>{
      try{
        const bin=atob(data),len=Math.floor(bin.length/2),pcm=new Float32Array(len);
        for(let i=0;i<len;i++){let v=(bin.charCodeAt(i*2+1)<<8)|bin.charCodeAt(i*2);if(v>=32768)v-=65536;pcm[i]=v/32768;}
        vBufRef.current.push(...dsVoice(pcm,DS_V));
        while(vBufRef.current.length>=BUF_V){
          const chunk=new Float32Array(vBufRef.current.slice(0,BUF_V));vBufRef.current.splice(0,HOP_V);
          let rms=0;for(let i=0;i<chunk.length;i++)rms+=chunk[i]*chunk[i];rms=Math.sqrt(rms/chunk.length);
          if(rms<0.005){vSilRef.current++;hitCountRef.current=0;
            if(vSilRef.current===2&&vFreezeRef.current){clearTimeout(vTimerRef.current);vTimerRef.current=setTimeout(()=>{vFreezeRef.current=null;setVoiceNote(null);},2000);}
            continue;}
          vSilRef.current=0;clearTimeout(vTimerRef.current);
          const freq=yinV(hannV(chunk),SR_EV);
          if(freq>50&&freq<1100){
            vHistRef.current.push(freq);if(vHistRef.current.length>3)vHistRef.current.shift();
            if(vHistRef.current.length>=2){
              const sorted=[...vHistRef.current].sort((a,b)=>a-b),med=sorted[Math.floor(sorted.length/2)],info=voiceFreqToNote(med);
              if(info){vFreezeRef.current=info;setVoiceNote(info);onVoiceNote?.(info);}
              const seq=seqRef.current,pos=seqPosRef.current;
              if(pos===-1){startSeq();continue;}
              const expected=pos+1<seq.length?seq[pos+1]:null;if(!expected)continue;
              if(freqMatchesNote(med,expected.root)){hitCountRef.current++;if(hitCountRef.current>=2)advanceSeq();}
              else{
                let jp=-1;for(let j=0;j<seq.length;j++){if(j!==pos&&freqMatchesNote(med,seq[j].root)){jp=j;break;}}
                if(jp>=0){hitCountRef.current++;if(hitCountRef.current>=3){seqPosRef.current=jp;setSeqPos(jp);activeRef.current=seq[jp].lineIdx;setActiveLine(seq[jp].lineIdx);hitCountRef.current=0;blockRef.current=false;}}
                else hitCountRef.current=0;
              }
            }
          }else{vHistRef.current=[];hitCountRef.current=0;}
        }
      }catch(e){}
    });
    AudioRecord.start();setMicOn(true);
  },[advanceSeq,startSeq]);

  const stopMic=useCallback(async()=>{
    try{await AudioRecord.stop();}catch(e){}clearTimeout(vTimerRef.current);
    vBufRef.current=[];vHistRef.current=[];vFreezeRef.current=null;activeRef.current=-1;
    seqPosRef.current=-1;hitCountRef.current=0;
    setMicOn(false);setVoiceNote(null);setActiveLine(-1);setSeqPos(-1);
    onVoiceNote?.(null);onSeqInfo?.({curChord:null,nextChord:null});
  },[]);

  const toggleDetect=async()=>{if(micOn)await stopMic();else await startMic();};
  useEffect(()=>{if(detectRef)detectRef.current=toggleDetect;},[toggleDetect]);
  useEffect(()=>()=>{stopMic();clearInterval(rafRef.current);},[]);

  const vCents=voiceNote?.cents??0;
  const vColor=voiceNote?(Math.abs(vCents)<=5?'#00FF88':Math.abs(vCents)<=15?'#FFD700':'#FF6B6B'):'#00BFFF';
  const curChord =seqPos>=0&&chordSeq[seqPos]   ?chordSeq[seqPos]   :null;
  const nextChord=seqPos>=0&&chordSeq[seqPos+1] ?chordSeq[seqPos+1]:null;

  return (
    <View style={LV.container} onLayout={e=>{CONTENT_OFFSET.current=e.nativeEvent.layout.y;}}>
      <View style={LV.scrollContent}>
        {lines.map((line,i)=>{
          if(!line.trim()) return <View key={i} style={{height:12}}/>;

          // ── Etiqueta de sección: [Coro], [Verso], etc. ───────────────────
          if(/^\[[^\]]+\]$/.test(line.trim())) return (
            <View key={i} style={LV.secWrap} onLayout={e=>handleLineLayout(i,e)}>
              <Text style={[LV.section,{fontFamily:F.extrabold}]}>
                {line.trim().slice(1,-1).toUpperCase()}
              </Text>
            </View>
          );

          const isActive  = micOn && activeLine===i;
          const isPast    = micOn && activeLine>i;
          const hasChords = /\[[^\]]+\]/.test(line);

          // ── Línea con acordes: renderizado tipo CifraClub ────────────────
          if (hasChords) {
            const segments = parseChordLine(line);
            return (
              <View
                key={i}
                onLayout={e=>handleLineLayout(i,e)}
                style={[LV.lineBlock, isActive&&LV.lineBlockActive, isPast&&{opacity:0.28}]}>
                <View style={LV.segmentRow}>
                  {segments.map((seg,si)=>{
                    const isCur = micOn&&curChord &&curChord.chord ===seg.chord&&curChord.lineIdx ===i;
                    const isNxt = micOn&&nextChord&&nextChord.chord===seg.chord&&nextChord.lineIdx===i;
                    const chordColor = isCur ? vColor
                      : isNxt ? '#00BFFF55'
                      : isActive ? '#fff'
                      : isPast   ? '#2A2A2A'
                      : '#00BFFF';
                    const chordSize = isCur ? fontSize+3 : fontSize;

                    return (
                      <View key={si} style={LV.segment}>
                        {/* Acorde arriba, alineado a la sílaba */}
                        <Text style={[LV.segChord,{
                          fontFamily: F.black,
                          fontSize:   chordSize,
                          color:      seg.chord ? chordColor : 'transparent',
                        }]}>
                          {seg.chord ? seg.chord : (seg.text ? ' ' : '')}
                        </Text>
                        {/* Letra/sílaba debajo */}
                        {seg.text ? (
                          <Text style={[LV.segText,{
                            fontSize,
                            fontFamily: isActive ? F.extrabold : F.regular,
                            color: isActive?'#0D0D0D':isPast?'#C0C0CC':'#0D0D0D',
                          }]}>
                            {seg.text}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          }

          // ── Línea solo texto ─────────────────────────────────────────────
          const lyricText = line.replace(/\[[^\]]+\]/g,'').trim();
          return (
            <Text key={i}
              onLayout={lyricText?e=>handleLineLayout(i,e):undefined}
              style={[LV.lyric,{fontSize,
                fontFamily: isActive?F.extrabold:F.regular,
                color: isActive?'#0D0D0D':isPast?'#C0C0CC':'#0D0D0D',
                ...(isActive?{textShadowColor:vColor+'80',textShadowOffset:{width:0,height:0},textShadowRadius:10}:{}),
              }]}>
              {line}
            </Text>
          );
        })}
        <View style={{height:120}}/>
      </View>
    </View>
  );
}

// ── CHORD SECTION ─────────────────────────────────────────────────────────────
function ChordSection({ lyrics }) {
  const chords = extractChords(lyrics);
  if (!chords.length) return null;
  const rows=[];for(let i=0;i<chords.length;i+=3)rows.push(chords.slice(i,i+3));
  return (
    <View style={CD.wrap}>
      <View style={CD.header}>
        <View style={CD.headerLine}/><Ionicons name="musical-notes" size={14} color="#00BFFF"/>
        <Text style={[CD.title,{fontFamily:F.extrabold}]}>ACORDES DE LA CANCIÓN</Text>
        <View style={CD.headerLine}/>
      </View>
      {rows.map((row,ri)=>(
        <View key={ri} style={CD.gridRow}>
          {row.map(chord=><View key={chord} style={CD.diagramCard}><ChordDiagram chord={chord}/></View>)}
          {row.length<3&&Array.from({length:3-row.length}).map((_,i)=><View key={`e${i}`} style={CD.diagramCard}/>)}
        </View>
      ))}
    </View>
  );
}

// ── THUMBNAIL ─────────────────────────────────────────────────────────────────
function Thumb({ t, large, onPress }) {
  const [imgFailed,setImgFailed] = useState(false);
  const bg     = CARD_BGS[parseInt(t.id||0)%CARD_BGS.length];
  const song   = (t.cancion_titulo||t.titulo.split(' - ')[0]).toUpperCase();
  const artist = (t.artista||'').toUpperCase();
  useEffect(()=>{setImgFailed(false);},[t.id]);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.86} style={[T.thumb,large?T.lg:T.sm]}>
      <View style={[StyleSheet.absoluteFillObject,{backgroundColor:bg}]}>
        <View style={T.eqFallback}>
          {[18,30,45,60,42,55,35,48,28,52,38,24].map((h,i)=>(
            <View key={i} style={[T.eqBar,{height:large?h:h*0.6}]}/>
          ))}
        </View>
      </View>
      {!imgFailed&&<YtImage youtubeId={t.youtube_id} style={StyleSheet.absoluteFillObject} resizeMode="cover" onAllFailed={()=>setImgFailed(true)}/>}
      <View style={T.overlay}>
        <Text style={[T.artist,{fontFamily:F.bold},large?T.artistLg:T.artistSm]}>{artist}</Text>
        <Text style={[T.song,{fontFamily:F.black},large?T.songLg:T.songSm]} numberOfLines={large?2:1}>{song}</Text>
      </View>
      <View style={T.cam}><Ionicons name="videocam" size={large?14:11} color="rgba(255,255,255,0.5)"/></View>
      {t.duracion&&<View style={T.dur}><Text style={[T.durTxt,{fontFamily:F.bold}]}>{t.duracion}</Text></View>}
    </TouchableOpacity>
  );
}

// ── VIDEO PLAYER ──────────────────────────────────────────────────────────────
function VideoPlayer({ t, onClose, onTimeUpdate, chapters, sections, onMarkSection, onClearChapters }) {
  const playerRef        = useRef(null);
  const [playing,        setPlaying]   = useState(false);
  const [curTime,        setCurTime]   = useState(0);
  const [curSec,         setCurSec]    = useState('');
  const [marking,        setMarking]   = useState(false);
  const [justMark,       setJustMark]  = useState('');
  const timerRef         = useRef(null);
  const onTimeUpdateRef  = useRef(onTimeUpdate);
  const chaptersRef      = useRef(chapters);
  const ytUrl            = `https://www.youtube.com/watch?v=${t.youtube_id}`;
  const hasChapters      = chapters.length > 0;

  // Siempre actualiza los refs con los valores más recientes
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { chaptersRef.current = chapters; }, [chapters]);

  // Interval único que lee siempre los refs actualizados
  useEffect(() => {
    timerRef.current = setInterval(async () => {
      if (!playerRef.current) return;
      try {
        const time = await playerRef.current.getCurrentTime();
        if (time == null) return;
        setCurTime(time);
        onTimeUpdateRef.current?.(time);
        const caps = chaptersRef.current;
        if (caps.length) {
          let cur = '';
          for (const c of caps) { if (time >= c.seconds) cur = c.name; else break; }
          setCurSec(prev => prev !== cur ? cur : prev);
        }
      } catch (_) {}
    }, 800);
    return () => clearInterval(timerRef.current);
  }, []);  // ← se monta una vez, lee siempre lo último via refs

  useEffect(() => () => clearInterval(timerRef.current), []);

  const markSection = async (name) => {
    try {
      const time = await playerRef.current?.getCurrentTime() ?? 0;
      onMarkSection(name, Math.floor(time));
      setJustMark(name);
      setTimeout(() => setJustMark(''), 1500);
    } catch (_) {}
  };

  return (
    <View style={VP.wrap}>
      {/* Video embebido */}
      <View style={VP.videoBox}>
        <YoutubeIframe
          ref={playerRef}
          height={210}
          width={SW}
          videoId={t.youtube_id}
          play={playing}
          onChangeState={state => setPlaying(state === 'playing')}
          webViewProps={{ allowsFullscreenVideo: true, allowsInlineMediaPlayback: true }}
        />
        <TouchableOpacity style={VP.closeBtn} onPress={onClose}>
          <Feather name="x" size={18} color="#fff"/>
        </TouchableOpacity>
      </View>

      {/* Barra de sección actual */}
      <View style={[VP.secBar, { borderLeftColor: curSec ? secColor(curSec) : '#333' }]}>
        <View style={{flex:1}}>
          {curSec ? (
            <>
              <Text style={[VP.secNow,{fontFamily:F.extrabold,color:secColor(curSec)}]}>{curSec}</Text>
              <Text style={[VP.secTime,{fontFamily:F.bold}]}>{fmtTime(curTime)}</Text>
            </>
          ) : (
            <Text style={[VP.secNow,{fontFamily:F.semibold,color:'#666'}]}>
              {hasChapters ? `${fmtTime(curTime)}` : 'Sin sección activa'}
            </Text>
          )}
        </View>
        {hasChapters && (
          <TouchableOpacity onPress={onClearChapters} style={VP.clearBtn}>
            <Feather name="refresh-ccw" size={13} color="#888"/>
            <Text style={[VP.clearTxt,{fontFamily:F.semibold}]}> Limpiar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setMarking(m => !m)} style={[VP.markToggle, marking && VP.markToggleOn]}>
          <Feather name="flag" size={13} color={marking ? '#fff' : '#00BFFF'}/>
          <Text style={[VP.markToggleTxt,{fontFamily:F.bold,color:marking?'#fff':'#00BFFF'}]}>
            {' '}{hasChapters ? 'Editar' : 'Marcar'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Botones para marcar secciones */}
      {marking && (
        <View style={VP.markRow}>
          <Text style={[VP.markHint,{fontFamily:F.semibold}]}>
            {playing ? 'Toca la sección cuando empiece en el video:' : 'Reproduce el video y toca cada sección:'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={VP.markBtns}>
            {sections.map(name => {
              const saved = chapters.find(c => c.name === name);
              const isJust = justMark === name;
              return (
                <TouchableOpacity key={name} onPress={() => markSection(name)}
                  style={[VP.markBtn, saved && VP.markBtnSaved, isJust && {borderColor: secColor(name)}]}>
                  {isJust && <Feather name="check" size={11} color={secColor(name)} style={{marginRight:3}}/>}
                  <Text style={[VP.markBtnTxt,{fontFamily:F.bold,color:isJust?secColor(name):saved?'#00CC88':'#ddd'}]}>
                    {name}
                  </Text>
                  {saved && !isJust && (
                    <Text style={[VP.markBtnTime,{fontFamily:F.regular}]}> {fmtTime(saved.seconds)}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Capítulos timeline */}
      {hasChapters && !marking && (
        <View style={VP.chapRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={VP.chapList}>
            {chapters.map((c,i) => {
              const isActive = curSec === c.name;
              return (
                <TouchableOpacity key={i} onPress={async()=>{
                  await playerRef.current?.seekTo(c.seconds, true);
                  setCurSec(c.name);
                }} style={[VP.chapChip, isActive && {backgroundColor:secColor(c.name)+'33',borderColor:secColor(c.name)}]}>
                  <Text style={[VP.chapName,{fontFamily:F.bold,color:isActive?secColor(c.name):'#bbb'}]}>{c.name}</Text>
                  <Text style={[VP.chapTime,{fontFamily:F.semibold,color:isActive?secColor(c.name)+'aa':'#666'}]}>{fmtTime(c.seconds)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <TouchableOpacity style={VP.ytCta} onPress={() => Linking.openURL(ytUrl)}>
        <Ionicons name="logo-youtube" size={16} color="#fff"/>
        <Text style={[VP.ytCtaTxt,{fontFamily:F.bold}]}> Abrir en YouTube</Text>
        <Feather name="external-link" size={12} color="rgba(255,255,255,0.5)" style={{marginLeft:4}}/>
      </TouchableOpacity>
    </View>
  );
}

// ── PANEL DE COMPARTIR ────────────────────────────────────────────────────────
function SharePanel({ visible, onClose, t, currentKey, lyrics }) {
  const slideAnim=useRef(new Animated.Value(300)).current;
  const fadeAnim =useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.parallel([
      Animated.spring(slideAnim,{toValue:visible?0:300,tension:80,friction:10,useNativeDriver:true}),
      Animated.timing(fadeAnim, {toValue:visible?1:0,duration:visible?200:180,useNativeDriver:true}),
    ]).start();
  },[visible]);
  if(!t||!visible)return null;
  const ytUrl=`https://www.youtube.com/watch?v=${t.youtube_id}`;
  const songName=t.cancion_titulo||t.titulo.split(' - ')[0];
  const artist  =t.artista||'';
  const buildMsg=(ic)=>{
    let m=`🎵 *${songName}* — ${artist}\n`;
    if(currentKey)m+=`🎸 Tono: ${currentKey}\n`;
    if(t.capo)    m+=`🔧 Capo: ${cleanCapo(t.capo)} Traste\n`;
    if(t.cancion_bpm&&parseInt(t.cancion_bpm)>0)m+=`🥁 BPM: ${t.cancion_bpm}\n`;
    m+=`\n▶️ Tutorial: ${ytUrl}`;
    if(ic&&lyrics){const c=[...new Set([...lyrics.matchAll(/\[([^\]]+)\]/g)].map(x=>x[1]))];if(c.length)m+=`\n\n🎼 Acordes: ${c.join(' · ')}`;}
    return m+'\n\n_Compartido desde Recurso Musical_';
  };
  const shareNative  =async(ic)=>{try{await Share.share({message:buildMsg(ic),title:`${songName} - ${artist}`});}catch(e){}onClose();};
  const shareWhatsApp=(ic)=>{Linking.openURL(`whatsapp://send?text=${encodeURIComponent(buildMsg(ic))}`).catch(()=>Linking.openURL(`https://wa.me/?text=${encodeURIComponent(buildMsg(ic))}`));onClose();};
  const opts=[
    {icon:'logo-whatsapp',label:'WhatsApp',           sub:'Solo info básica',    color:'#25D366',bg:'#0A1F0F',fn:()=>shareWhatsApp(false)},
    {icon:'logo-whatsapp',label:'WhatsApp + acordes', sub:'Con lista de acordes',color:'#25D366',bg:'#0A1F0F',fn:()=>shareWhatsApp(true)},
    {icon:'share-social', label:'Otras apps',         sub:'Instagram, Telegram…',color:'#00BFFF',bg:'#0A1628',fn:()=>shareNative(false)},
    {icon:'share-social', label:'Otras apps + acordes',sub:'Con lista de acordes',color:'#00BFFF',bg:'#0A1628',fn:()=>shareNative(true)},
  ];
  return (
    <>
      <Animated.View pointerEvents="auto" style={[SP.backdrop,{opacity:fadeAnim}]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1}/>
      </Animated.View>
      <Animated.View style={[SP.card,{transform:[{translateY:slideAnim}],opacity:fadeAnim}]}>
        <View style={SP.handle}/>
        <View style={SP.header}>
          <Feather name="share-2" size={18} color="#00BFFF"/>
          <View style={{flex:1}}>
            <Text style={[SP.title,{fontFamily:F.bold}]}>Compartir tutorial</Text>
            <Text style={[SP.subtitle,{fontFamily:F.regular}]} numberOfLines={1}>{songName} · {artist}</Text>
          </View>
          <TouchableOpacity style={SP.closeBtn} onPress={onClose}><Feather name="x" size={16} color="#444"/></TouchableOpacity>
        </View>
        {opts.map((o,i)=>(
          <TouchableOpacity key={i} style={[SP.option,{backgroundColor:o.bg}]} onPress={o.fn} activeOpacity={0.8}>
            <View style={[SP.optIcon,{borderColor:o.color+'40'}]}><Ionicons name={o.icon} size={22} color={o.color}/></View>
            <View style={{flex:1}}>
              <Text style={[SP.optLabel,{fontFamily:F.bold,color:o.color}]}>{o.label}</Text>
              <Text style={[SP.optSub,{fontFamily:F.regular}]}>{o.sub}</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#333"/>
          </TouchableOpacity>
        ))}
        <View style={SP.preview}>
          <Text style={[SP.previewLabel,{fontFamily:F.extrabold}]}>VISTA PREVIA</Text>
          <Text style={[SP.previewTxt,{fontFamily:F.regular}]}>{buildMsg(false)}</Text>
        </View>
      </Animated.View>
    </>
  );
}

// ── CAPO ICON ─────────────────────────────────────────────────────────────────
function CapoIcon({ size=32, color='#00BFFF' }) {
  const s=size;
  return (
    <View style={{width:s,height:s}}>
      {[0,1,2,3,4,5].map(i=><View key={i} style={{position:'absolute',top:0,bottom:0,left:s*0.08+i*(s*0.155),width:1.5,backgroundColor:'#444',borderRadius:1}}/>)}
      <View style={{position:'absolute',left:0,right:0,top:s*0.32,height:s*0.28,borderRadius:s*0.14,backgroundColor:color}}/>
      <View style={{position:'absolute',right:s*0.12,top:-s*0.06,width:s*0.22,height:s*0.28,borderRadius:s*0.1,backgroundColor:color,opacity:0.7}}/>
      <View style={{position:'absolute',right:s*0.12,bottom:-s*0.06,width:s*0.22,height:s*0.28,borderRadius:s*0.1,backgroundColor:color,opacity:0.7}}/>
      <View style={{position:'absolute',right:s*0.2,top:0,bottom:0,width:s*0.07,backgroundColor:color,opacity:0.5}}/>
    </View>
  );
}

// ── MODAL DETALLE ─────────────────────────────────────────────────────────────
function DetailModal({ t, visible, onClose, onFavChange }) {
  const [fav,setFav]                   = useState(false);
  const [metro,setMetro]               = useState(false);
  const [transpose,setTranspose]       = useState(false);
  const [shareOpen,setShareOpen]       = useState(false);
  const [metroPlaying,setMetroPlaying] = useState(false);
  const [showVideo,setShowVideo]       = useState(false);
  const [lyrics,setLyrics]             = useState('');
  const [currentKey,setCurrentKey]     = useState('C');
  const [originalKey,setOriginalKey]   = useState('C');
  const [thumbFailed,setThumbFailed]   = useState(false);
  const [autoScroll,setAutoScroll]     = useState(false);
  const [showSpeeds,setShowSpeeds]     = useState(false);
  const [scrollSpeed,setScrollSpeed]   = useState(1.0);
  const [fontSize,setFontSize]         = useState(15);
  const [micOn,setMicOn]               = useState(false);
  const [voiceNote,setVoiceNote]       = useState(null);
  const [seqInfo,setSeqInfo]           = useState({curChord:null,nextChord:null});
  const [chapters, setChapters]   = useState([]);
  const scrollY        = useRef(0);
  const outerScrollRef = useRef(null);
  const detectRef      = useRef(null);
  const jumpSectionRef = useRef(null);
  const lastCapRef     = useRef('');
  const sections       = useMemo(()=>extractSections(t?.cancion_letra||''),[t?.cancion_letra]);
  const SPEEDS=[{label:'×0.5',v:0.5},{label:'×1',v:1.0},{label:'×1.5',v:1.5},{label:'×2',v:2.0}];

  useEffect(()=>{
    if(t){
      setFav(t.es_favorito===1||t.es_favorito==='1');
      const l=t.cancion_letra||'';setLyrics(l);
      const key=detectKey(l)||t.cancion_tono||'C';setCurrentKey(key);setOriginalKey(key);
      setThumbFailed(false);setShowVideo(false);
      setAutoScroll(false);setShowSpeeds(false);
      setMicOn(false);setVoiceNote(null);
      setSeqInfo({curChord:null,nextChord:null});
      lastCapRef.current='';
      const fromDesc = parseCapitulos(t.descripcion||'');
      // Fuente 2: marcas manuales guardadas en AsyncStorage (tienen prioridad por sección)
      AsyncStorage.getItem(CHAP_KEY(t.id)).then(raw=>{
        try {
          const manual = raw ? JSON.parse(raw) : [];
          if (manual.length) {
            // Combina: descripción base + manual sobreescribe por nombre
            const merged = [...fromDesc];
            for (const m of manual) {
              const idx = merged.findIndex(c=>c.name===m.name);
              if (idx>=0) merged[idx]=m; else merged.push(m);
            }
            setChapters(merged.sort((a,b)=>a.seconds-b.seconds));
          } else {
            setChapters(fromDesc);
          }
        } catch { setChapters(fromDesc); }
      });
    }
  },[t]);

  const saveChapters = useCallback(async(caps)=>{
    setChapters(caps);
    await AsyncStorage.setItem(CHAP_KEY(t.id), JSON.stringify(caps));
  },[t]);

  const handleMarkSection = useCallback((name, seconds)=>{
    const next = chapters.filter(c=>c.name!==name);
    next.push({name, seconds});
    next.sort((a,b)=>a.seconds-b.seconds);
    saveChapters(next);
  },[chapters, saveChapters]);

  const handleClearChapters = useCallback(()=>{
    saveChapters([]);
    lastCapRef.current='';
  },[saveChapters]);

  const handleVideoTime=useCallback((time)=>{
    if(!chapters.length)return;
    let cur=null;
    for(const cap of chapters){if(time>=cap.seconds)cur=cap;else break;}
    if(cur&&cur.name!==lastCapRef.current){
      lastCapRef.current=cur.name;
      jumpSectionRef.current?.(cur.name);
    }
  },[chapters]);

  if(!t)return null;
  const ytUrl=`https://www.youtube.com/watch?v=${t.youtube_id}`;

  const handleFav=async()=>{const v=fav?0:1;setFav(!fav);await toggleFavorito(t.id,v);onFavChange?.(t.id,v);};
  const handleTranspose=(semis)=>{
    if(!semis)return;
    const nl=transposeLyrics(lyrics,semis),idx=TONOS.indexOf(currentKey);
    setLyrics(nl);setCurrentKey(TONOS[((idx+semis)%12+12)%12]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={D.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF"/>

        {/* Header */}
        <View style={D.header}>
          <TouchableOpacity style={D.iconBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#ccc"/>
          </TouchableOpacity>
          <Text style={[D.headerTitle,{fontFamily:F.semibold}]} numberOfLines={1}>{t.titulo}</Text>
          {lyrics?(
            <TouchableOpacity style={[D.iconBtn,transpose&&D.iconBtnOn]} onPress={()=>setTranspose(!transpose)}>
              <MaterialCommunityIcons name="transfer-right" size={21} color={transpose?'#00BFFF':'#555'}/>
            </TouchableOpacity>
          ):null}
          <TouchableOpacity style={[D.iconBtn,(metro||metroPlaying)&&D.iconBtnOn]} onPress={()=>setMetro(!metro)}>
            <MaterialCommunityIcons name="metronome" size={21} color={(metro||metroPlaying)?'#00BFFF':'#555'}/>
            {metroPlaying&&<View style={D.playingDot}/>}
          </TouchableOpacity>
          <TouchableOpacity style={D.iconBtn} onPress={()=>setShareOpen(true)}>
            <Feather name="share" size={19} color="#555"/>
          </TouchableOpacity>
          <TouchableOpacity style={D.iconBtn} onPress={handleFav}>
            <Ionicons name={fav?'bookmark':'bookmark-outline'} size={21} color={fav?'#00BFFF':'#555'}/>
          </TouchableOpacity>
        </View>

        {/* ── CABECERA FIJA: video/thumb + infoBar + toolbar ── */}
        <View>
          {showVideo ? (
            <VideoPlayer
              t={t}
              onClose={()=>setShowVideo(false)}
              onTimeUpdate={handleVideoTime}
              chapters={chapters}
              sections={sections}
              onMarkSection={handleMarkSection}
              onClearChapters={handleClearChapters}/>
          ) : (
            <TouchableOpacity style={D.videoThumb} onPress={()=>setShowVideo(true)} activeOpacity={0.9}>
              <View style={[StyleSheet.absoluteFillObject,{backgroundColor:'#050D18'}]}/>
              {!thumbFailed&&<YtImage youtubeId={t.youtube_id} style={StyleSheet.absoluteFillObject} resizeMode="cover" onAllFailed={()=>setThumbFailed(true)}/>}
              <View style={D.videoOverlay}/>
              <View style={D.videoInfo}>
                <Text style={[D.videoSong,{fontFamily:F.black}]}>{(t.cancion_titulo||t.titulo.split(' - ')[0]).toUpperCase()}</Text>
                <Text style={[D.videoArtist,{fontFamily:F.bold}]}>{(t.artista||'').toUpperCase()}</Text>
              </View>
              <View style={D.ytPlay}><Ionicons name="play" size={28} color="#fff" style={{marginLeft:4}}/></View>
              <View style={D.ytBadge}>
                <Text style={[D.ytYou,{fontFamily:F.black}]}>You</Text>
                <View style={D.ytTube}><Text style={[D.ytTubeT,{fontFamily:F.black}]}>Tube</Text></View>
              </View>
            </TouchableOpacity>
          )}

          <View style={D.stickyBlock}>
            {(()=>{
              const capoVal=cleanCapo(t.capo);
              const showCapo=!!(capoVal&&capoVal!=='0');
              return(
                <View style={D.infoBar}>
                  {t.cancion_tono?(<View style={D.infoItem}><Text style={[D.infoKey,{fontFamily:F.extrabold}]}>TONO</Text><Text style={[D.infoVal,{fontFamily:F.black}]}>{currentKey}</Text></View>):null}
                  {t.intro?(<View style={[D.infoItem,{flex:showCapo?1.5:2}]}><Text style={[D.infoKey,{fontFamily:F.extrabold}]}>INTRO</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} contentContainerStyle={D.introChords}>{t.intro.trim().split(/\s+/).map((ch,ci)=><View key={ci} style={D.introChordPill}><Text style={[D.introChordTxt,{fontFamily:F.bold}]} numberOfLines={1}>{ch}</Text></View>)}</ScrollView></View>):null}
                  {showCapo?(<View style={D.infoItem}><View style={D.capoTopRow}><CapoIcon size={14} color="#00BFFF"/><Text style={[D.infoKey,{fontFamily:F.extrabold}]}>CAPO</Text></View><Text style={[D.capoNum,{fontFamily:F.black}]}>{capoVal}</Text><Text style={[D.capoTraste,{fontFamily:F.semibold}]}>Traste</Text></View>):null}
                  {t.cancion_bpm&&parseInt(t.cancion_bpm)>0?(<View style={[D.infoItem,{borderRightWidth:0}]}><Text style={[D.infoKey,{fontFamily:F.extrabold}]}>BPM</Text><Text style={[D.infoVal,{fontFamily:F.black}]}>{t.cancion_bpm}</Text></View>):null}
                </View>
              );
            })()}
            <View style={D.stickyBar}>
              <TouchableOpacity style={D.stickyFontBtn} onPress={()=>setFontSize(p=>Math.max(11,p-1))}>
                <Text style={[D.stickyFontTxt,{fontFamily:F.bold,fontSize:11}]}>A−</Text>
              </TouchableOpacity>
              <TouchableOpacity style={D.stickyFontBtn} onPress={()=>setFontSize(p=>Math.min(24,p+1))}>
                <Text style={[D.stickyFontTxt,{fontFamily:F.bold,fontSize:14}]}>A+</Text>
              </TouchableOpacity>
              <View style={{flex:1}}/>
              <TouchableOpacity style={[D.stickyAutoBtn,autoScroll&&D.stickyAutoBtnOn]}
                onPress={()=>{if(!autoScroll){setAutoScroll(true);setShowSpeeds(true);}else{setAutoScroll(false);setShowSpeeds(false);}}}>
                <Ionicons name={autoScroll?'pause-circle':'play-circle-outline'} size={14} color={autoScroll?'#000':'#00BFFF'}/>
                <Text style={[D.stickyAutoBtnTxt,{fontFamily:F.bold,color:autoScroll?'#000':'#00BFFF'}]}>{autoScroll?' Pausar':' Auto'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[D.stickyDetectBtn,micOn&&D.stickyDetectBtnOn]} onPress={()=>detectRef.current?.()}>
                <Ionicons name={micOn?'mic':'mic-outline'} size={14} color={micOn?'#FF6B6B':'#555'}/>
                <Text style={[D.stickyDetectTxt,{fontFamily:F.bold,color:micOn?'#FF6B6B':'#555'}]}>{micOn?' Stop':' Detectar'}</Text>
                {micOn&&<View style={D.stickyMicPulse}/>}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── SCROLL: solo la letra ── */}
        <ScrollView ref={outerScrollRef} showsVerticalScrollIndicator={false} style={{flex:1}}
          onScroll={e=>{const y=e.nativeEvent.contentOffset.y;if(outerScrollRef.current)outerScrollRef.current._scrollY=y;scrollY.current=y;}}
          scrollEventThrottle={16}>
          {lyrics?(
            <View>
              {autoScroll&&showSpeeds&&(
                <View style={D.stickySpeedPanel}>
                  <Text style={[D.stickySpeedBpmLbl,{fontFamily:F.extrabold}]}>{parseInt(t.cancion_bpm)>0?`${t.cancion_bpm} BPM`:'BPM'}</Text>
                  <View style={D.stickySpeedBtns}>
                    {SPEEDS.map(({label,v})=>(
                      <TouchableOpacity key={v} style={[D.stickySpeedChip,scrollSpeed===v&&D.stickySpeedChipOn]} onPress={()=>setScrollSpeed(v)}>
                        <Text style={[D.stickySpeedTxt,{fontFamily:F.bold},scrollSpeed===v&&D.stickySpeedTxtOn]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={D.stickySpeedClose} onPress={()=>setShowSpeeds(false)}>
                    <Feather name="chevron-up" size={14} color="#555"/>
                  </TouchableOpacity>
                </View>
              )}
              {micOn&&(()=>{
                const vc=voiceNote?.cents??0,col=voiceNote?(Math.abs(vc)<=5?'#00FF88':Math.abs(vc)<=15?'#FFD700':'#FF6B6B'):'#00BFFF';
                return(
                  <View style={D.stickyChordBar}>
                    <View style={D.stickyChordSide}><Text style={[D.stickyChordLbl,{fontFamily:F.extrabold}]}>TOCANDO</Text><Text style={[D.stickyChordNote,{fontFamily:F.black,color:col}]}>{seqInfo.curChord?seqInfo.curChord.chord:'—'}</Text></View>
                    <View style={D.stickyChordCenter}>
                      {voiceNote?<><Text style={[D.stickyChordDetected,{fontFamily:F.black,color:col}]}>{voiceNote.note}</Text><Text style={[D.stickyChordCents,{fontFamily:F.bold,color:col+'88'}]}>{vc>0?`+${vc}¢`:vc===0?'✓':`${vc}¢`}</Text></>
                        :<Text style={{color:'#2A2A2A',fontSize:9,fontFamily:F.semibold,letterSpacing:1}}>TOCA</Text>}
                    </View>
                    <View style={[D.stickyChordSide,{alignItems:'flex-end'}]}><Text style={[D.stickyChordLbl,{fontFamily:F.extrabold}]}>SIGUIENTE</Text><Text style={[D.stickyChordNote,{fontFamily:F.black,color:'#00BFFF77'}]}>{seqInfo.nextChord?seqInfo.nextChord.chord:'—'}</Text></View>
                  </View>
                );
              })()}
              <LetraViewer
                lyrics={lyrics} bpm={parseInt(t.cancion_bpm)||80}
                outerScrollRef={outerScrollRef} autoScroll={autoScroll} setAutoScroll={setAutoScroll}
                showSpeeds={showSpeeds} setShowSpeeds={setShowSpeeds}
                scrollSpeed={scrollSpeed} setScrollSpeed={setScrollSpeed} scrollY={scrollY}
                fontSize={fontSize} setFontSize={setFontSize}
                micOn={micOn} setMicOn={setMicOn}
                onVoiceNote={setVoiceNote} onSeqInfo={setSeqInfo} detectRef={detectRef}
                jumpSectionRef={jumpSectionRef}/>
              <ChordSection lyrics={lyrics}/>
            </View>
          ):(
            <View style={D.noLetra}>
              <View style={D.noLetraIcon}><Ionicons name="logo-youtube" size={28} color="#FF0000"/></View>
              <Text style={[D.noLetraTxt,{fontFamily:F.semibold}]}>Ver el tutorial completo en YouTube</Text>
              <TouchableOpacity style={D.ytBtn} onPress={()=>Linking.openURL(ytUrl)}>
                <Text style={[D.ytBtnTxt,{fontFamily:F.bold}]}>Abrir en YouTube</Text>
                <Feather name="external-link" size={14} color="#fff" style={{marginLeft:8}}/>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {transpose&&!!lyrics&&(
          <Transpositor visible={true} currentKey={currentKey} originalKey={originalKey}
            onTranspose={handleTranspose}
            onReset={()=>{setLyrics(t.cancion_letra||'');setCurrentKey(originalKey);}}
            onClose={()=>setTranspose(false)}/>
        )}
        {metro&&<Metronomo visible={true} onClose={()=>setMetro(false)} initBpm={parseInt(t.cancion_bpm)||80} onPlayingChange={setMetroPlaying}/>}
        {shareOpen&&<SharePanel visible={true} onClose={()=>setShareOpen(false)} t={t} currentKey={currentKey} lyrics={lyrics}/>}
      </View>
    </Modal>
  );
}

// ── PANTALLA PRINCIPAL ────────────────────────────────────────────────────────
export default function TutorialsScreen() {
  const [cat,setCat]         = useState('Todos');
  const [q,setQ]             = useState('');
  const [items,setItems]     = useState([]);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRef]  = useState(false);
  const [selected,setSel]    = useState(null);
  const [modal,setModal]     = useState(false);
  const [error,setError]     = useState(null);

  const load = useCallback(async()=>{
    setError(null);
    try{
      const data=q.length>1?await buscarTutoriales(q):await getTutorialesByCategoria(cat);
      setItems(Array.isArray(data)?data:[]);
    }catch(e){console.error('[TutorialsScreen]',e.message);setError(e.message);setItems([]);}
    finally{setLoading(false);setRef(false);}
  },[cat,q]);

  useEffect(()=>{load();},[load]);

  const filtered=items.filter(t=>{
    if(t.tipo==='cancionero') return false;
    const mc=cat==='Todos'||t.categoria===cat;
    const mq=!q||(t.titulo||'').toLowerCase().includes(q.toLowerCase())||(t.artista||'').toLowerCase().includes(q.toLowerCase());
    return mc&&mq;
  });

  const open=t=>{setSel(t);setModal(true);};

  return (
    <View style={S.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF"/>
      <View style={S.header}>
        <View style={S.logoWrap}>
          <View style={S.logoBox}>
            <View style={S.eqRow}>{[5,8,12,16,12,20,16,12,8,5].map((h,i)=><View key={i} style={[S.eqBar,{height:h}]}/>)}</View>
            <Text style={[S.logoLetter,{fontFamily:F.black}]}>R</Text>
            <View style={S.logoDot}/>
          </View>
          <View>
            <Text style={[S.logoWord,{fontFamily:F.black}]}>RECURSO</Text>
            <Text style={[S.logoSub,{fontFamily:F.extrabold}]}>MUSICAL</Text>
          </View>
        </View>
      </View>

      <View style={S.searchWrap}>
        <View style={S.searchBox}>
          <Feather name="search" size={15} color="#333" style={{marginRight:8}}/>
          <TextInput style={[S.searchInput,{fontFamily:F.regular}]}
            placeholder="Buscar tutorial, canción, artista..." placeholderTextColor="#B0B0C0"
            value={q} onChangeText={setQ} selectionColor="#00BFFF"/>
          {q.length>0&&<TouchableOpacity onPress={()=>setQ('')}><Feather name="x" size={15} color="#444"/></TouchableOpacity>}
        </View>
      </View>

      <View style={S.catsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.catsContent} bounces={false}>
          {CATS.map(c=>(
            <TouchableOpacity key={c} style={[S.chip,cat===c&&S.chipOn]} onPress={()=>setCat(c)}>
              <Text style={[S.chipTxt,{fontFamily:cat===c?F.bold:F.semibold},cat===c&&S.chipTxtOn]}>{c}</Text>
            </TouchableOpacity>
          ))}
          <View style={{width:16}}/>
        </ScrollView>
      </View>

      {loading?(
        <View style={S.center}><ActivityIndicator size="large" color="#00BFFF"/></View>
      ):(
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.listPad}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRef(true);load();}} tintColor="#00BFFF"/>}>
          {error?(
            <View style={S.empty}>
              <Ionicons name="wifi-outline" size={52} color="#D0D0DA"/>
              <Text style={[S.emptyTxt,{fontFamily:F.semibold}]}>Error de conexión</Text>
              <Text style={[S.emptySubTxt,{fontFamily:F.regular}]}>{error}</Text>
              <TouchableOpacity style={S.retryBtn} onPress={load}>
                <Text style={[S.retryTxt,{fontFamily:F.bold}]}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ):filtered.length===0?(
            <View style={S.empty}>
              <Ionicons name="musical-notes-outline" size={52} color="#D0D0DA"/>
              <Text style={[S.emptyTxt,{fontFamily:F.semibold}]}>Sin resultados</Text>
            </View>
          ):(
            <>
              <View style={S.featured}>
                <Thumb t={filtered[0]} large onPress={()=>open(filtered[0])}/>
                <Text style={[S.featLabel,{fontFamily:F.semibold}]} numberOfLines={2}>
                  {filtered[0].cancion_titulo||filtered[0].titulo} · {filtered[0].artista}
                </Text>
              </View>
              {filtered.slice(1).map(t=>(
                <TouchableOpacity key={t.id} style={S.listRow} onPress={()=>open(t)} activeOpacity={0.82}>
                  <Thumb t={t} onPress={()=>open(t)}/>
                  <View style={S.listInfo}>
                    <Text style={[S.listTitle,{fontFamily:F.bold}]} numberOfLines={2}>{t.cancion_titulo||t.titulo.split(' - ')[0]}</Text>
                    <Text style={[S.listArtist,{fontFamily:F.regular}]} numberOfLines={1}>{t.artista}</Text>
                    {t.categoria&&<View style={S.catPill}><Text style={[S.catPillTxt,{fontFamily:F.bold}]}>{t.categoria}</Text></View>}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
          <View style={{height:80}}/>
        </ScrollView>
      )}

      <DetailModal t={selected} visible={modal} onClose={()=>setModal(false)}
        onFavChange={(id,v)=>setItems(prev=>prev.map(t=>t.id===id?{...t,es_favorito:v}:t))}/>
    </View>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  screen:      {flex:1,backgroundColor:'#FFFFFF'},
  header:      {paddingTop:54,paddingHorizontal:16,paddingBottom:12,borderBottomWidth:1,borderBottomColor:'#E8E8EF'},
  logoWrap:    {flexDirection:'row',alignItems:'center',gap:12},
  logoBox:     {width:52,height:52,borderRadius:14,backgroundColor:'#0A1628',borderWidth:1.5,borderColor:'#00BFFF25',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  eqRow:       {flexDirection:'row',alignItems:'flex-end',position:'absolute',bottom:8,gap:2},
  eqBar:       {width:3.5,backgroundColor:'#00BFFF',borderRadius:1.5,opacity:0.4},
  logoLetter:  {fontSize:28,color:'#1565C0',lineHeight:32,textShadowColor:'#00BFFF40',textShadowOffset:{width:0,height:0},textShadowRadius:8},
  logoDot:     {position:'absolute',bottom:11,left:13,width:7,height:7,borderRadius:3.5,backgroundColor:'#00BFFF'},
  logoWord:    {fontSize:22,color:'#1565C0',letterSpacing:4,lineHeight:26},
  logoSub:     {fontSize:9,color:'#00BFFF',letterSpacing:9,marginTop:-2},
  searchWrap:  {paddingHorizontal:14,paddingVertical:10},
  searchBox:   {flexDirection:'row',alignItems:'center',backgroundColor:'#F5F5F7',borderRadius:12,borderWidth:1,borderColor:'#E8E8EF',paddingHorizontal:12},
  searchInput: {flex:1,color:'#0D0D0D',fontSize:14,paddingVertical:11},
  catsWrap:    {height:46,marginBottom:2},
  catsContent: {paddingHorizontal:14,alignItems:'center',paddingBottom:6,gap:8},
  chip:        {paddingHorizontal:16,paddingVertical:8,borderRadius:999,backgroundColor:'#F0F0F5',borderWidth:1,borderColor:'#E8E8EF'},
  chipOn:      {backgroundColor:'#0088CC',borderColor:'#0088CC'},
  chipTxt:     {color:'#9B9BAD',fontSize:12},
  chipTxtOn:   {color:'#000'},
  center:      {flex:1,alignItems:'center',justifyContent:'center'},
  listPad:     {paddingHorizontal:14,paddingTop:14},
  empty:       {alignItems:'center',paddingVertical:60,gap:12},
  emptyTxt:    {color:'#4A4A5A',fontSize:15},
  emptySubTxt: {color:'#9B9BAD',fontSize:12,textAlign:'center',marginTop:-6},
  retryBtn:    {backgroundColor:'#00BFFF',paddingHorizontal:24,paddingVertical:10,borderRadius:10},
  retryTxt:    {color:'#000',fontSize:13},
  featured:    {marginBottom:18},
  featLabel:   {color:'#6B6B7A',fontSize:13,marginTop:7,lineHeight:18},
  listRow:     {flexDirection:'row',alignItems:'flex-start',marginBottom:16,gap:12},
  listInfo:    {flex:1,paddingTop:4},
  listTitle:   {color:'#0D0D0D',fontSize:14,lineHeight:18,marginBottom:3},
  listArtist:  {color:'#9B9BAD',fontSize:12,marginBottom:7},
  catPill:     {backgroundColor:'#E6F5FF',borderRadius:6,paddingHorizontal:8,paddingVertical:3,alignSelf:'flex-start',borderWidth:1,borderColor:'#00BFFF33'},
  catPillTxt:  {color:'#0088CC',fontSize:10},
});

const T = StyleSheet.create({
  thumb:      {borderRadius:10,overflow:'hidden',justifyContent:'flex-end'},
  lg:         {height:210,width:'100%'},
  sm:         {height:95,width:138},
  eqFallback: {flexDirection:'row',alignItems:'flex-end',position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:4,gap:3,opacity:0.18},
  eqBar:      {flex:1,backgroundColor:'#00BFFF',borderRadius:1},
  overlay:    {position:'absolute',bottom:0,left:0,right:0,backgroundColor:'rgba(0,0,0,0.7)',padding:10,paddingTop:24},
  artist:     {color:'rgba(255,255,255,0.6)',letterSpacing:0.8},
  artistLg:   {fontSize:12},artistSm:{fontSize:9},
  song:       {color:'#00BFFF'},
  songLg:     {fontSize:24,lineHeight:28},songSm:{fontSize:13,lineHeight:16},
  cam:        {position:'absolute',bottom:9,left:9},
  dur:        {position:'absolute',bottom:9,right:9,backgroundColor:'rgba(0,0,0,0.85)',borderRadius:4,paddingHorizontal:5,paddingVertical:2},
  durTxt:     {color:'#fff',fontSize:10},
});

const D = StyleSheet.create({
  container:       {flex:1,backgroundColor:'#FFFFFF',overflow:'hidden'},
  playingDot:      {position:'absolute',top:2,right:2,width:8,height:8,borderRadius:4,backgroundColor:'#00FF88',borderWidth:1,borderColor:'#000'},
  header:          {flexDirection:'row',alignItems:'center',gap:5,paddingTop:52,paddingBottom:12,paddingHorizontal:12,borderBottomWidth:1,borderBottomColor:'#E8E8EF'},
  iconBtn:         {width:38,height:38,borderRadius:19,backgroundColor:'#F0F0F5',alignItems:'center',justifyContent:'center'},
  iconBtnOn:       {backgroundColor:'#00BFFF14',borderWidth:1,borderColor:'#00BFFF28'},
  headerTitle:     {flex:1,color:'#4A4A5A',fontSize:13},
  videoThumb:      {height:240,backgroundColor:'#050D18',overflow:'hidden'},
  videoOverlay:    {position:'absolute',bottom:0,left:0,right:0,height:'75%',backgroundColor:'rgba(0,0,0,0.6)'},
  videoInfo:       {position:'absolute',bottom:0,left:0,right:0,padding:16},
  videoSong:       {color:'#00BFFF',fontSize:20,lineHeight:24,marginBottom:4},
  videoArtist:     {color:'rgba(255,255,255,0.6)',fontSize:12,letterSpacing:1},
  ytPlay:          {position:'absolute',top:'50%',left:'50%',transform:[{translateX:-28},{translateY:-28}],width:56,height:56,borderRadius:28,backgroundColor:'#FF0000',alignItems:'center',justifyContent:'center'},
  ytBadge:         {position:'absolute',bottom:14,right:14,flexDirection:'row',alignItems:'center',backgroundColor:'rgba(0,0,0,0.75)',borderRadius:4,overflow:'hidden',paddingLeft:6},
  ytYou:           {color:'#fff',fontSize:12},
  ytTube:          {backgroundColor:'#FF0000',paddingHorizontal:4,paddingVertical:2,marginLeft:1},
  ytTubeT:         {color:'#fff',fontSize:12},
  infoBar:         {flexDirection:'row',backgroundColor:'#F7F9FF',borderBottomWidth:1,borderBottomColor:'#E8E8EF',borderTopWidth:1,borderTopColor:'#E8E8EF'},
  infoItem:        {flex:1,paddingVertical:8,paddingHorizontal:8,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderRightColor:'#E8E8EF'},
  infoKey:         {color:'#0088CC',fontSize:8,letterSpacing:1.2,marginBottom:3},
  infoVal:         {color:'#0D0D0D',fontSize:17},
  introChords:     {flexDirection:'row',flexWrap:'nowrap',gap:5,alignItems:'center',justifyContent:'center'},
  introChordPill:  {backgroundColor:'#E6F5FF',borderRadius:6,paddingHorizontal:8,paddingVertical:4,borderWidth:1,borderColor:'#00BFFF40'},
  introChordTxt:   {color:'#0088CC',fontSize:13,letterSpacing:0.5},
  noLetra:         {padding:32,alignItems:'center',gap:14},
  noLetraIcon:     {width:60,height:60,borderRadius:30,backgroundColor:'#1A0505',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#FF000030'},
  noLetraTxt:      {color:'#6B6B7A',fontSize:14,textAlign:'center'},
  ytBtn:           {flexDirection:'row',alignItems:'center',backgroundColor:'#FF0000',borderRadius:12,paddingVertical:14,paddingHorizontal:24},
  ytBtnTxt:        {color:'#fff',fontSize:14},
  capoTopRow:      {flexDirection:'row',alignItems:'center',gap:4,marginBottom:2},
  capoNum:         {color:'#0D0D0D',fontSize:17,lineHeight:20},
  capoTraste:      {color:'#9B9BAD',fontSize:9,letterSpacing:1,marginTop:-2},
  stickyBlock:     {backgroundColor:'#FFFFFF'},
  stickyBar:       {flexDirection:'row',alignItems:'center',flexWrap:'nowrap',paddingHorizontal:10,paddingVertical:8,backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#E8E8EF',gap:5},
  stickyFontBtn:   {width:32,height:32,backgroundColor:'#F0F0F5',borderRadius:8,borderWidth:1,borderColor:'#E8E8EF',alignItems:'center',justifyContent:'center',flexShrink:0},
  stickyFontTxt:   {color:'#6B6B7A'},
  stickyAutoBtn:   {flexDirection:'row',alignItems:'center',paddingHorizontal:10,paddingVertical:7,backgroundColor:'#E6F5FF',borderRadius:9,borderWidth:1,borderColor:'#00BFFF40',flexShrink:0},
  stickyAutoBtnOn: {backgroundColor:'#00BFFF',borderColor:'#00BFFF'},
  stickyAutoBtnTxt:{fontSize:12},
  stickyDetectBtn: {flexDirection:'row',alignItems:'center',paddingHorizontal:11,paddingVertical:7,backgroundColor:'#F0F0F5',borderRadius:9,borderWidth:1,borderColor:'#E8E8EF',position:'relative',flexShrink:0},
  stickyDetectBtnOn:{backgroundColor:'#1A0A0A',borderColor:'#FF6B6B60'},
  stickyDetectTxt: {fontSize:12},
  stickyMicPulse:  {position:'absolute',top:3,right:3,width:7,height:7,borderRadius:3.5,backgroundColor:'#FF4444',borderWidth:1,borderColor:'#000'},
  stickySpeedPanel:{flexDirection:'row',alignItems:'center',backgroundColor:'#F7F9FF',borderBottomWidth:1,borderBottomColor:'#E8E8EF',paddingHorizontal:12,paddingVertical:8,gap:8},
  stickySpeedBtns: {flexDirection:'row',gap:6,flex:1},
  stickySpeedBpmLbl:{color:'#00BFFF',fontSize:10,letterSpacing:1,marginRight:6,alignSelf:'center'},
  stickySpeedChip: {flex:1,paddingVertical:7,borderRadius:8,backgroundColor:'#F0F0F5',borderWidth:1,borderColor:'#E8E8EF',alignItems:'center'},
  stickySpeedChipOn:{backgroundColor:'#00BFFF',borderColor:'#00BFFF'},
  stickySpeedTxt:  {color:'#9B9BAD',fontSize:11},
  stickySpeedTxtOn:{color:'#000'},
  stickySpeedClose:{width:28,height:28,borderRadius:14,backgroundColor:'#F0F0F5',alignItems:'center',justifyContent:'center'},
  stickyChordBar:  {flexDirection:'row',alignItems:'center',backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#E8E8EF',paddingVertical:10,paddingHorizontal:16},
  stickyChordSide: {flex:1,alignItems:'flex-start'},
  stickyChordCenter:{width:70,alignItems:'center'},
  stickyChordLbl:  {color:'#9B9BAD',fontSize:8,letterSpacing:1.5,marginBottom:2},
  stickyChordNote: {fontSize:28,lineHeight:32},
  stickyChordDetected:{fontSize:26,lineHeight:30},
  stickyChordCents:{fontSize:10,marginTop:-2},
});

const VP = StyleSheet.create({
  wrap:        {backgroundColor:'#0A0D14'},
  videoBox:    {position:'relative'},
  closeBtn:    {position:'absolute',top:8,right:8,zIndex:10,width:30,height:30,borderRadius:15,backgroundColor:'rgba(0,0,0,0.7)',alignItems:'center',justifyContent:'center'},
  secBar:      {flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:10,borderLeftWidth:3,borderLeftColor:'#00BFFF',backgroundColor:'#111520',gap:8},
  secNow:      {color:'#fff',fontSize:13,letterSpacing:0.5},
  secTime:     {color:'#666',fontSize:10,marginTop:1},
  clearBtn:    {flexDirection:'row',alignItems:'center',paddingHorizontal:8,paddingVertical:5,borderRadius:7,backgroundColor:'#1A1E2A'},
  clearTxt:    {color:'#888',fontSize:11},
  markToggle:  {flexDirection:'row',alignItems:'center',paddingHorizontal:10,paddingVertical:6,borderRadius:8,backgroundColor:'#1A1E2A',borderWidth:1,borderColor:'#00BFFF44'},
  markToggleOn:{backgroundColor:'#00BFFF22',borderColor:'#00BFFF'},
  markToggleTxt:{fontSize:12},
  markRow:     {backgroundColor:'#0D1018',paddingTop:10,paddingBottom:12,paddingHorizontal:14},
  markHint:    {color:'#888',fontSize:11,marginBottom:10},
  markBtns:    {gap:8,paddingRight:4},
  markBtn:     {flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:7,borderRadius:10,backgroundColor:'#1A1E2A',borderWidth:1,borderColor:'#333'},
  markBtnSaved:{borderColor:'#00CC8866',backgroundColor:'#00CC8812'},
  markBtnTxt:  {color:'#ddd',fontSize:12},
  markBtnTime: {color:'#00CC88',fontSize:10},
  chapRow:     {backgroundColor:'#0A0D14',paddingVertical:8},
  chapList:    {paddingHorizontal:12,gap:8},
  chapChip:    {paddingHorizontal:12,paddingVertical:6,borderRadius:10,borderWidth:1,borderColor:'#2A2E3A',backgroundColor:'#13161F',alignItems:'center'},
  chapName:    {color:'#bbb',fontSize:11,letterSpacing:0.5},
  chapTime:    {color:'#555',fontSize:10,marginTop:2},
  ytCta:       {flexDirection:'row',alignItems:'center',justifyContent:'center',backgroundColor:'#1A0A0A',paddingVertical:9,borderTopWidth:1,borderTopColor:'#FF000030'},
  ytCtaTxt:    {color:'#FF6666',fontSize:12},
});

const LV = StyleSheet.create({
  container:       {position:'relative'},
  scrollContent:   {paddingHorizontal:16,paddingTop:14,paddingBottom:80},
  secWrap:         {marginTop:20,marginBottom:8},
  section:         {color:'#9B9BAD',fontSize:10,letterSpacing:2,backgroundColor:'#F0F0F5',alignSelf:'flex-start',paddingHorizontal:10,paddingVertical:4,borderRadius:6},
  lineBlock:       {marginBottom:16},
  lineBlockActive: {backgroundColor:'#F0FFF8',borderRadius:8,marginHorizontal:-8,paddingHorizontal:8,paddingVertical:6,borderLeftWidth:3,borderLeftColor:'#00C56A'},
  lyric:           {color:'#0D0D0D',lineHeight:24},

  // ── Renderizado tipo CifraClub: acorde arriba, sílaba abajo ──────────────
  segmentRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',       // wrap para líneas largas
    alignItems:     'flex-end',   // alinear por la base de la letra
  },
  segment: {
    flexDirection:  'column',
    alignItems:     'flex-start',
    marginRight:    1,
  },
  segChord: {
    letterSpacing:  0.5,
    lineHeight:     22,           // espacio fijo para el acorde
    minWidth:       8,
  },
  segText: {
    lineHeight:     24,
    minWidth:       4,
  },
});

const TP = StyleSheet.create({
  backdrop:    {position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.65)',zIndex:15},
  floatingCard:{position:'absolute',top:0,left:0,right:0,backgroundColor:'#FFFFFF',borderBottomLeftRadius:20,borderBottomRightRadius:20,borderWidth:1,borderTopWidth:0,borderColor:'#E8E8EF',paddingBottom:16,zIndex:20,elevation:20},
  handle:      {width:36,height:4,borderRadius:2,backgroundColor:'#D0D0DA',alignSelf:'center',marginTop:10,marginBottom:14},
  row:         {flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:16,marginBottom:14},
  label:       {flex:1,color:'#4A4A5A',fontSize:14},
  resetBtn:    {flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#F0F0F5',borderRadius:8,paddingHorizontal:10,paddingVertical:5,borderWidth:1,borderColor:'#E8E8EF'},
  resetTxt:    {color:'#9B9BAD',fontSize:11},
  closeBtn:    {width:32,height:32,borderRadius:16,backgroundColor:'#F0F0F5',alignItems:'center',justifyContent:'center'},
  ctrlRow:     {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:20,marginBottom:16,paddingHorizontal:16},
  semiBtn:     {width:52,height:52,borderRadius:26,backgroundColor:'#F0F0F5',borderWidth:1,borderColor:'#E8E8EF',alignItems:'center',justifyContent:'center'},
  keyDisplay:  {flex:1,alignItems:'center'},
  keyNote:     {color:'#00BFFF',fontSize:48,lineHeight:52},
  keyDiff:     {fontSize:13,marginTop:-4},
  keysRow:     {paddingBottom:4,gap:8,paddingLeft:16},
  keyChip:     {paddingHorizontal:14,paddingVertical:9,borderRadius:999,backgroundColor:'#F0F0F5',borderWidth:1,borderColor:'#E8E8EF',alignItems:'center',minWidth:44},
  keyChipOn:   {backgroundColor:'#00BFFF',borderColor:'#00BFFF'},
  keyChipOrig: {borderColor:'#00BFFF50'},
  keyChipTxt:  {color:'#6B6B7A',fontSize:13},
  origDot:     {width:5,height:5,borderRadius:2.5,backgroundColor:'#00BFFF',marginTop:3},
});

const M = StyleSheet.create({
  backdrop:    {position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.5)',zIndex:15},
  floatingCard:{position:'absolute',top:0,left:0,right:0,backgroundColor:'#FFFFFF',borderBottomLeftRadius:20,borderBottomRightRadius:20,borderWidth:1,borderTopWidth:0,borderColor:'#E8E8EF',paddingBottom:16,zIndex:20,elevation:20},
  handle:      {width:36,height:4,borderRadius:2,backgroundColor:'#D0D0DA',alignSelf:'center',marginTop:10,marginBottom:14},
  closeBtn:    {width:32,height:32,borderRadius:16,backgroundColor:'#F0F0F5',alignItems:'center',justifyContent:'center'},
  playingBadge:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#0A2010',borderRadius:8,paddingHorizontal:8,paddingVertical:4,borderWidth:1,borderColor:'#00FF8830'},
  playingDot:  {width:6,height:6,borderRadius:3,backgroundColor:'#00FF88'},
  playingTxt:  {color:'#00FF88',fontSize:9,letterSpacing:1.5},
  row:         {flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:16,marginBottom:14},
  title:       {flex:1,color:'#0D0D0D',fontSize:15},
  beats:       {flexDirection:'row',justifyContent:'center',gap:10,marginBottom:14},
  dot:         {width:13,height:13,borderRadius:6.5,backgroundColor:'#F0F0F5',borderWidth:1,borderColor:'#E0E0E8'},
  dotOn:       {backgroundColor:'rgba(0,191,255,0.35)'},
  dotStrong:   {backgroundColor:'#00BFFF',transform:[{scale:1.3}]},
  pulsoWrap:   {alignItems:'center',marginBottom:14},
  ball:        {width:56,height:56,borderRadius:28,backgroundColor:'#F0F0F5',borderWidth:2,borderColor:'#E0E0E8',alignItems:'center',justifyContent:'center'},
  ballCore:    {width:24,height:24,borderRadius:12,backgroundColor:'#E0E0E8',borderWidth:1,borderColor:'#D0D0DA'},
  ballCoreOn:  {backgroundColor:'#00BFFF'},
  bpmCtrl:     {flexDirection:'row',justifyContent:'center',gap:8,marginBottom:6},
  adjBtn:      {paddingHorizontal:14,paddingVertical:9,backgroundColor:'#F0F0F5',borderRadius:8,borderWidth:1,borderColor:'#E8E8EF'},
  adjTxt:      {color:'#6B6B7A',fontSize:13},
  bpmShow:     {alignItems:'center',marginBottom:14},
  bpmNum:      {color:'#00BFFF',fontSize:50,lineHeight:54},
  bpmLbl:      {color:'#9B9BAD',fontSize:11,letterSpacing:3,marginTop:-4},
  compasRow:   {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:14},
  compasLbl:   {color:'#4A4A5A',fontSize:12},
  cBtn:        {paddingHorizontal:12,paddingVertical:7,backgroundColor:'#F0F0F5',borderRadius:8,borderWidth:1,borderColor:'#E8E8EF'},
  cBtnOn:      {backgroundColor:'#00BFFF',borderColor:'#00BFFF'},
  cTxt:        {color:'#6B6B7A',fontSize:12},
  cTxtOn:      {color:'#000'},
  preset:      {paddingHorizontal:12,paddingVertical:7,backgroundColor:'#F0F0F5',borderRadius:999,borderWidth:1,borderColor:'#E8E8EF',marginRight:8,alignItems:'center'},
  presetOn:    {backgroundColor:'#00BFFF12',borderColor:'#00BFFF35'},
  presetL:     {color:'#6B6B7A',fontSize:11},
  presetB:     {color:'#9B9BAD',fontSize:10},
  playBtn:     {flexDirection:'row',alignItems:'center',justifyContent:'center',backgroundColor:'#00BFFF',borderRadius:10,paddingVertical:13,marginBottom:4,marginHorizontal:16},
  stopBtn:     {backgroundColor:'#C0392B'},
  playTxt:     {fontSize:15},
});

const CD = StyleSheet.create({
  wrap:        {backgroundColor:'#FFFFFF',paddingBottom:16},
  header:      {flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:16,paddingTop:16,paddingBottom:14},
  headerLine:  {flex:1,height:1,backgroundColor:'#E8E8EF'},
  title:       {color:'#0088CC',fontSize:10,letterSpacing:2},
  gridRow:     {flexDirection:'row',paddingHorizontal:12,gap:8,marginBottom:8},
  diagramCard: {flex:1,backgroundColor:'#FFFFFF',borderRadius:12,padding:12,borderWidth:1,borderColor:'#E8E8EF',alignItems:'center',minHeight:60},
});

const SP = StyleSheet.create({
  backdrop:    {position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.65)',zIndex:18},
  card:        {position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#0E0E0E',borderTopLeftRadius:20,borderTopRightRadius:20,borderWidth:1,borderBottomWidth:0,borderColor:'#00BFFF20',paddingBottom:24,zIndex:20,elevation:20},
  handle:      {width:36,height:4,borderRadius:2,backgroundColor:'#2A2A2A',alignSelf:'center',marginTop:10,marginBottom:6},
  header:      {flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#141414'},
  title:       {color:'#fff',fontSize:15},
  subtitle:    {color:'#555',fontSize:12,marginTop:1},
  closeBtn:    {width:32,height:32,borderRadius:16,backgroundColor:'#141414',alignItems:'center',justifyContent:'center'},
  option:      {flexDirection:'row',alignItems:'center',gap:14,paddingHorizontal:16,paddingVertical:14,marginHorizontal:14,marginTop:10,borderRadius:14,borderWidth:1,borderColor:'#141414'},
  optIcon:     {width:44,height:44,borderRadius:22,backgroundColor:'#111',alignItems:'center',justifyContent:'center',borderWidth:1},
  optLabel:    {fontSize:14},
  optSub:      {color:'#444',fontSize:11,marginTop:1},
  preview:     {marginHorizontal:14,marginTop:14,backgroundColor:'#0A0A0A',borderRadius:10,padding:12,borderWidth:1,borderColor:'#1A1A1A'},
  previewLabel:{color:'#2A2A2A',fontSize:9,letterSpacing:2,marginBottom:6},
  previewTxt:  {color:'#444',fontSize:11,lineHeight:17},
});