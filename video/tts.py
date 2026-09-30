import numpy as np, soundfile as sf, re, json
from kokoro_onnx import Kokoro
exec(open('script.py').read())
k=Kokoro('/tmp/claude-0/tts/kokoro.onnx','/tmp/claude-0/tts/voices.bin')
durs=[]
for i,(v,t) in enumerate(SEG):
    parts=[p for p in re.split(r'(?<=[.?!])\s+',t) if p]
    out=[]
    for p in parts:
        a,sr=k.create(p,voice='af_heart',speed=1.15,lang='en-us'); out+= [a, np.zeros(int(sr*0.24),dtype=a.dtype)]
    a=np.concatenate([np.zeros(int(sr*0.35),dtype=out[0].dtype)]+out+[np.zeros(int(sr*0.25),dtype=out[0].dtype)])
    sf.write(f'a{i:02}.wav',a,sr); durs.append(len(a)/sr)
json.dump(durs,open('durs.json','w')); print([round(d,1) for d in durs], round(sum(durs),1))
