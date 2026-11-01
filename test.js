const fs=require('fs');const h=fs.readFileSync(__dirname+'/index.html','utf8');
const src=h.split('/* ==METRICS START== */')[1].split('/* ==METRICS END== */')[0];
const m={exports:{}};new Function('module',src)(m);const {rmsDb,detectPitch,summarize,toCSV,isoLocal,aggregateSecond,timelineCSV,capTimeline}=m.exports;
const sr=48000,N=2048;let fail=0;const ok=(c,msg)=>{console.log((c?'PASS ':'FAIL ')+msg);if(!c)fail++;};
const sine=(f,a)=>Float32Array.from({length:N},(_,i)=>a*Math.sin(2*Math.PI*f*i/sr));
ok(Math.abs(rmsDb(sine(440,1))-(-3.01))<0.05,'RMS full-scale sine = -3.01 dBFS: '+rmsDb(sine(440,1)).toFixed(2));
ok(Math.abs(rmsDb(sine(440,0.1))-(-23.01))<0.05,'RMS 0.1 sine = -23 dBFS');
ok(rmsDb(new Float32Array(N))===-Infinity,'silence -> -Inf');
for(const f of [80,110,150,220,300,440]){const p=detectPitch(sine(f,0.5),sr);ok(p&&Math.abs(p-f)/f<0.01,`pitch ${f}Hz -> ${p&&p.toFixed(2)}`);}
// harmonic-rich voice-like signal
const harm=Float32Array.from({length:N},(_,i)=>[1,.6,.4,.3].reduce((a,w,k)=>a+w*Math.sin(2*Math.PI*120*(k+1)*i/sr),0)*.2);
const ph=detectPitch(harm,sr);ok(Math.abs(ph-120)<2,'harmonic 120Hz -> '+ph.toFixed(2));
ok(detectPitch(sine(200,0.001),sr)===null,'quiet -> null');
let rnd=1;const noise=Float32Array.from({length:N},()=>((rnd=rnd*16807%2147483647)/2147483647-.5));ok(detectPitch(noise,sr)===null,'noise -> null');
// summarize: 1s voice, 500ms silence, 0.5s voice, 200ms silence, 0.3s voice (50ms frames)
const fr=[];let t=0;const add=(ms,db,hz)=>{for(let k=0;k<ms/50;k++){fr.push({t,db,hz});t+=50;}};
add(1000,-20,150);add(500,-60,null);add(500,-10,200);add(200,-60,null);add(300,-20,100);
const s=summarize(fr,'こんにちは、元気です。');console.log(s);
ok(s.pauses===1,'pause count 1 (200ms ignored)');ok(Math.abs(s.pauseSec-0.5)<0.06,'pause 0.5s');
ok(s.peakDb===-10&&s.minHz===100&&s.maxHz===200,'peak/min/max');ok(Math.abs(s.rate-9/s.duration)<0.2,'rate chars/s');
const c=toCSV([{time:'x',text:'a,"b"\n',strength:'強い'}]);ok(c.charCodeAt(0)===0xFEFF&&c.includes('"a,""b""\n"'),'CSV BOM+escape');
// timeline
const iso=isoLocal(Date.UTC(2026,0,1,0,0,0,5));ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$/.test(iso)&&new Date(iso).getTime()===Date.UTC(2026,0,1,0,0,0,5),'isoLocal '+iso);
const sf=[];for(let k=0;k<20;k++)sf.push({t:k*50,db:k<10?-20:-60,hz:k<10?150:null});const ag=aggregateSecond(sf,1000,'はい');console.log(ag);
ok(ag.voicedRatio===0.5&&ag.avgHz===150&&ag.peakDb===-20&&!ag.isSilent&&ag.text==='はい'&&ag.epochMs===1000,'aggregateSecond');
ok(aggregateSecond(sf.slice(10),0,'').isSilent===true,'silent second');
const tl={sessions:[{id:'a',rows:Array(5).fill(ag)},{id:'b',rows:Array(5).fill(ag)}]};capTimeline(tl,7);ok(tl.sessions.length===2&&tl.sessions[0].rows.length===2,'cap drops oldest');capTimeline(tl,4);ok(tl.sessions.length===1&&tl.sessions[0].id==='b','cap drops session');
const tc=timelineCSV(tl);ok(tc.charCodeAt(0)===0xFEFF&&tc.split('\r\n').length===5,'timeline CSV');
process.exit(fail?1:0);
