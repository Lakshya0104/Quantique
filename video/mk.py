import json, subprocess, pymupdf, imageio_ffmpeg as I
exec(open('script.py').read()); F=I.get_ffmpeg_exe(); d=json.load(open('durs.json'))
doc=pymupdf.open('/home/user/Quantique/deck/VOID-NAV_QiskitFallFest.pdf')
for i in range(len(doc)):
    pm=doc[i].get_pixmap(matrix=pymupdf.Matrix(1920/doc[i].rect.width,1080/doc[i].rect.height)); pm.save(f's{i}.png')
L=[]
for i,(v,t) in enumerate(SEG):
    dur=d[i]; fr=int(dur*25)+1; out=f'seg{i:02}.mp4'
    fade=f"fade=in:st=0:d=0.35,fade=out:st={dur-0.35:.2f}:d=0.35"
    if isinstance(v,int):
        zin = i%2==0
        z = f"'min(1+0.00018*on,1.06)'" if zin else f"'max(1.06-0.00018*on,1)'"
        vf=f"scale=3840:-1,zoompan=z={z}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={fr}:s=1920x1080:fps=25,{fade},format=yuv420p"
        cmd=[F,'-y','-loglevel','error','-loop','1','-i',f's{v}.png','-i',f'a{i:02}.wav','-t',f'{dur:.2f}','-vf',vf]
    else:
        cmd=[F,'-y','-loglevel','error','-i',f'{v}.mp4','-i',f'a{i:02}.wav','-t',f'{dur:.2f}','-vf',f"tpad=stop_mode=clone:stop_duration=5,{fade},format=yuv420p"]
    cmd+=['-map','0:v','-map','1:a','-r','25','-c:v','libx264','-crf','20','-preset','medium','-c:a','aac','-b:a','192k','-ar','48000',out]
    subprocess.run(cmd,check=True); L.append(f"file '{out}'")
open('list.txt','w').write('\n'.join(L))
subprocess.run([F,'-y','-loglevel','error','-f','concat','-safe','0','-i','list.txt','-c','copy','-movflags','+faststart','/home/user/Quantique/video/VOID-NAV_Round1_Pitch.mp4'],check=True)
