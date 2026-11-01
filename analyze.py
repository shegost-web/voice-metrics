#!/usr/bin/env python3
"""Offline per-second analysis of a saved recording.
usage: python3 analyze.py voice_YYYYMMDD_HHMMSS.webm START [out.csv]
START = audioStartMs (epoch ms) from the timeline JSON, or an ISO time (e.g. 2026-11-01T14:20:00+09:00).
Outputs: iso_jst,epochMs,offsetSec,avgDb,peakDb,avgHz,voicedRatio,isSilent  (needs ffmpeg + numpy)"""
import sys, subprocess, csv, datetime as dt
import numpy as np
SR, FR = 16000, 800  # 50ms frames like the browser tool
JST = dt.timezone(dt.timedelta(hours=9))
def load(path):
    raw = subprocess.run(['ffmpeg','-v','error','-i',path,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)
def pitch(x, lo=70, hi=500):
    if np.sqrt(np.mean(x*x)) < 0.01: return None
    x = x - x.mean(); n = len(x); lo_l, hi_l = SR//hi, min(SR//lo, n-2)
    c = np.zeros(hi_l+2)
    for lag in range(lo_l-1, hi_l+2):
        a, b = x[:-lag], x[lag:]; c[lag] = (a@b)/np.sqrt((a@a)*(b@b) or 1)
    best = c[lo_l:hi_l+1].max()
    if best < 0.5: return None
    for lag in range(lo_l, hi_l+1):  # shortest lag near best (avoid octave errors), like the browser tool
        if c[lag] >= best*0.9 and c[lag] >= c[lag-1] and c[lag] >= c[lag+1]:
            y0, y1, y2 = c[lag-1], c[lag], c[lag+1]; d = y0-2*y1+y2
            return SR/(lag + (0.5*(y0-y2)/d if d else 0))
    return None
def parse_start(s):
    return int(s) if s.isdigit() else int(dt.datetime.fromisoformat(s).timestamp()*1000)
def main():
    path, start = sys.argv[1], parse_start(sys.argv[2]); out = open(sys.argv[3],'w',newline='') if len(sys.argv)>3 else sys.stdout
    x = load(path); w = csv.writer(out); w.writerow(['iso_jst','epochMs','offsetSec','avgDb','peakDb','avgHz','voicedRatio','isSilent'])
    for sec in range(int(np.ceil(len(x)/SR))):
        dbs, hzs = [], []
        for f in range(20):
            fr = x[sec*SR+f*FR: sec*SR+(f+1)*FR]
            if len(fr) < FR//2: break
            r = np.sqrt(np.mean(fr*fr)); dbs.append(20*np.log10(r) if r > 0 else -100.0)
            if dbs[-1] > -45: hzs.append(pitch(fr))
        if not dbs: break
        voiced = [d for d in dbs if d > -45]; hz = [h for h in hzs if h]
        ms = start + sec*1000
        avg = 10*np.log10(np.mean([10**(d/10) for d in dbs]))
        w.writerow([dt.datetime.fromtimestamp(ms/1000, JST).isoformat(timespec='milliseconds'), ms, sec, round(avg,1), round(max(dbs),1),
                    round(float(np.mean(hz)),1) if hz else '', round(len(voiced)/len(dbs),2), str(not voiced).lower()])
if __name__ == '__main__': main()
