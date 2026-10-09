from lib import *
def stage(s,x,y,w,h,n,title,col=TEAL):
    box(s,x,y,w,h,line=LINE,dash=True)
    circ(s,x+0.12,y+0.1,0.3,str(n),fill=col,size=10)
    tb(s,x+0.5,y+0.1,w-0.6,0.3,title,size=12,font=SERIF,bold=True)
def slide3(p):
    s=p.slides.add_slide(p.slide_layouts[6])
    header(s,'03','Technical Approach','How a request is created, carried across a congested shared channel, and confirmed back to the survivor')
    # ---------- STAGE 1
    X1,W1=0.45,3.75; stage(s,X1,1.4,W1,4.45,1,'Alert, access & request')
    eyebrow(s,X1+0.15,1.85,'Proposed alert integration (not connected)',color=MUT,w=3.5,size=7)
    fl=['Disaster\ndeclared','Authorised\nwarning*','SOS node\nmap shared','Survivor\nreaches node']
    for i,t in enumerate(fl):
        x=X1+0.12+i*0.9; box(s,x,2.05,0.78,0.48,fill=TL if i!=1 else OL,shape=S.ROUNDED_RECTANGLE,rad=0.2,text=[T(t,bold=True)],size=7,tcolor=INK)
        if i<3: line(s,x+0.79,2.29,x+0.89,2.29,w=1)
    tb(s,X1+0.15,2.56,3.5,0.2,'*e.g. via an authorised CAP-based channel such as NDMA SACHET; proposed only',size=6.8,italic=True,color=MUT)
    eyebrow(s,X1+0.15,2.82,'Node menu · urgent first, ≤ 4 presses',color=MUT,w=3.5,size=7)
    scr=[('1 · CATEGORY',['▶ Rescue now (P0)','  Injured/medical (P0)','  Trapped (P0)','  More ▾']),('2 · INJURED?',['▶ Yes','  No']),('3 · PEOPLE',['  1','▶ 2–5','  6+']),('4 · CONFIRM',['Rescue · injured · 2–5','▶ SEND'])]
    for i,(h,ls) in enumerate(scr):
        x=X1+0.12+(i%2)*1.8; y=3.02+(i//2)*0.78
        box(s,x,y,1.7,0.7,fill=DARK,text=[[B(h,size=6.8,color=ORANGE)]]+[[T(l,size=6.8,color=WHITE)] for l in ls],align=A.LEFT,anchor=V.TOP,font=MONO)
    eyebrow(s,X1+0.15,4.6,'Packet built on node · 21 bytes',color=MUT,w=3.5,size=7)
    fields=[('T',1,TEAL),('msg_id',4,ORANGE),('dst',2,TEAL),('P',1,RUST),('d',1,TEAL),('a',1,TEAL),('c',1,GREEN),('n',1,GREEN),('f',1,GREEN),('location + label',8,SLATE)]
    x=X1+0.12; scale=3.5/21
    for nm,b,c in fields:
        w=b*scale; box(s,x,4.8,w-0.01,0.3,fill=c,text=[T(nm,bold=True)],size=6.2,tcolor=WHITE); tb(s,x,5.12,w,0.15,str(b),size=6.5,color=MUT,align=A.CENTER); x+=w
    tb(s,X1+0.15,5.26,3.5,0.15,'T type · P priority+hops left · d distance-to-station · a age · c category · n people · f flags',size=6.2,color=MUT)
    tb(s,X1+0.15,5.42,3.5,0.45,[[B('Location is labelled: '),T('STATION (surveyed coords of a fixed public node) or NODE-GPS (portable node). Not the survivor\'s exact position. Phone form adds a landmark; browser geolocation needs HTTPS, so it isn\'t assumed.')]],size=6.8,color=INK)
    # ---------- STAGE 2
    X2,W2=4.35,4.85; stage(s,X2,1.4,W2,4.45,2,'Controlled message transport')
    stk=[('App: menu · queues',TEAL),('VOID-NAV protocol (ours)',ORANGE),('RadioLib driver · CAD',SLATE),('SX127x LoRa · 865–867 MHz',DARK)]
    for i,(t,c) in enumerate(stk):
        box(s,X2+0.12+i*1.18,1.85,1.12,0.34,fill=c,text=[T(t,bold=True)],size=6.6,tcolor=WHITE,shape=S.ROUNDED_RECTANGLE,rad=0.15)
    A_=[('① RX packet','',None),('② Valid?','CRC (radio) · version · length','drop'),('③ Seen msg_id?','dedup table: 128 IDs, 15 min','drop'),('④ Hops left & age < TTL?','hop limit 4 (open decision 3–5)','drop'),('⑤ Addressed to me?','yes → deliver + ACK · no → ⑥','deliver')]
    Bc=[('⑥ Gradient rule','forward only if my_dist < sender_dist','silent'),('⑦ Enqueue by priority','P0→P3 · ages +1 class / 60 s · cap 32','evict'),('⑧ CAD + random backoff','window by priority; cancel if overheard','cancel'),('⑨ Transmit','hops−1, dist = my_dist, age++',None),('⑩ Await echo / ACK','bounded retry (originator)',None)]
    def fbox(x,y,t,sub,tag,w=2.2):
        box(s,x,y,w,0.48,fill=WHITE,line=INK,shape=S.ROUNDED_RECTANGLE,rad=0.12,text=[[B(t,size=7.8)],[T(sub,size=6.5,color=MUT)]] if sub else [[B(t,size=7.8)]])
        if tag:
            col={'drop':RUST,'deliver':GREEN,'silent':SLATE,'evict':RUST,'cancel':SLATE}[tag]
            chip(s,x+w-0.5,y-0.08,tag,col,WHITE,w=0.5,size=6.2)
    for i,(t,sub,tag) in enumerate(A_):
        y=2.32+i*0.55; fbox(X2+0.12,y,t,sub,tag)
        if i<4: line(s,X2+1.22,y+0.48,X2+1.22,y+0.55,w=1)
    for i,(t,sub,tag) in enumerate(Bc):
        y=2.32+i*0.55; fbox(X2+2.55,y,t,sub,tag)
        if i<4: line(s,X2+3.65,y+0.48,X2+3.65,y+0.55,w=1)
    poly(s,[(X2+2.32,4.84),(X2+2.43,4.84),(X2+2.43,2.56),(X2+2.55,2.56)],w=1)
    # priority table
    rows=[('P0','Rescue · trapped · medical','0–150 ms','30 min','5'),('P1','Child/elder · report other','0–300 ms','30 min','4'),('P2','Food · water','0–600 ms','20 min','3'),('P3','Safe · family (≤ 1 per 30 s/node)','0–1.2 s','10 min','2')]
    t=s.shapes.add_table(5,5,I(X2+0.12),I(5.12),I(4.6),I(0.7)).table
    for j,wd in enumerate([0.35,1.75,0.85,0.75,0.9]): t.columns[j].width=I(wd)
    hdr=['','Priority class','Backoff win.','TTL','Retries']
    for i,r in enumerate([hdr]+rows):
        t.rows[i].height=I(0.14)
        for j,v in enumerate(r):
            c=t.cell(i,j); c.text=v or ' '; c.margin_left=c.margin_right=I(0.04); c.margin_top=c.margin_bottom=I(0.005)
            c.fill.solid(); c.fill.fore_color.rgb=INK if i==0 else ([OL,TL,GREY,WHITE][i-1] if j else [RUST,ORANGE,TEAL,SLATE][i-1])
            f=c.text_frame.paragraphs[0].runs[0].font; f.size=Pt(6.6); f.name=SANS; f.bold=(i==0 or j==0); f.color.rgb=WHITE if (i==0 or j==0) else INK
    # ---------- STAGE 3
    X3,W3=9.35,3.53; stage(s,X3,1.4,W3,4.45,3,'Destination & confirmation')
    st=['RX at receiving station','Dedup + decode category, n, flags','Show location + label on map','Rank by priority, alert operator','ACK(msg_id) back to origin']
    for i,t in enumerate(st):
        y=1.85+i*0.38; box(s,X3+0.12,y,2.05,0.3,fill=TL if i<4 else GL,shape=S.ROUNDED_RECTANGLE,rad=0.2,text=[T(t,bold=True)],size=6.8)
        if i<4: line(s,X3+1.15,y+0.3,X3+1.15,y+0.38,w=1)
    box(s,X3+2.27,1.85,1.15,1.82,fill=WHITE,line=INK)
    tb(s,X3+2.3,1.88,1.1,0.18,'Ops dashboard',size=6.8,bold=True,align=A.CENTER)
    for i,(c,l) in enumerate([(RUST,'P0 · 2–5 · inj.'),(RUST,'P0 · 1 · trapped'),(ORANGE,'P1 · elder'),(TEAL,'P2 · water')]):
        circ(s,X3+2.33,2.13+i*0.25,0.12,'',fill=c); tb(s,X3+2.5,2.11+i*0.25,0.95,0.16,l,size=6.3)
    tb(s,X3+2.3,3.15,1.1,0.5,'loc: STATION\n#GP-07 (surveyed)',size=6.3,color=MUT,align=A.CENTER)
    tb(s,X3+0.12,3.78,3.3,0.55,[[B('Reverse-path ACK: '),T('each relay caches msg_id → previous hop when forwarding; the ACK retraces that path hop by hop. If a hop is gone, the ACK falls back to gradient forwarding (same rules).')]],size=7)
    eyebrow(s,X3+0.15,4.38,'Originating-node LED states',color=MUT,w=3.3,size=7)
    seq=[(ORANGE,'Sent','TX done\n≠ delivered'),(ORANGE,'Retrying','blink · k/5'),(GREEN,'ACK','msg_id\nmatched'),(SLATE,'Dispatch','separate msg\n→ screen text')]
    for i,(c,a,b) in enumerate(seq):
        x=X3+0.15+i*0.83; circ(s,x+0.2,4.6,0.28,'',fill=c,line_c=(INK if i==1 else None))
        tb(s,x-0.02,4.92,0.75,0.18,a,size=7.2,bold=True,align=A.CENTER); tb(s,x-0.05,5.1,0.8,0.4,b,size=6.3,color=MUT,align=A.CENTER)
        if i<3: line(s,x+0.52,4.74,x+0.82,4.74,w=1,color=SLATE)
    tb(s,X3+0.15,5.5,3.3,0.32,'No ACK after final retry → orange off, screen: "Not confirmed. Retry or use next SOS point."',size=6.5,italic=True,color=RUST)
    # ---------- TECH STACK
    box(s,0.45,5.98,12.43,1.1,fill=GREY)
    eyebrow(s,0.6,6.04,'Technical stack',w=3)
    cols=[('Hardware','ESP32 dev board · SX1276-family LoRa module (865–867 MHz variant) · 128×64 OLED + 4 buttons · orange/green LEDs','MVP'),
     ('Radio config','LoRa 125 kHz BW · SF9 baseline (SF7–10 to tune) · CR 4/5 · ≈185 ms per 21 B packet (calc.)','MVP'),
     ('Firmware','Arduino-ESP32 · RadioLib (CAD) · ESP32 SoftAP + local web form for phones','MVP / opt.'),
     ('Messaging layer','VOID-NAV protocol: msg_id, dedup, hop/TTL, gradient forwarding, P0–P3 queues, ACK + retries','MVP core'),
     ('Location','surveyed coords for fixed nodes · GPS module (e.g. NEO-6M) on portable nodes · phone landmark text','MVP / prop.'),
     ('Dashboard','station node → USB serial → local Python web map with cached offline tiles','MVP')]
    for i,(h,b,st_) in enumerate(cols):
        x=0.6+i*2.05; tb(s,x,6.27,1.4,0.2,h,size=8.5,bold=True,color=TEAL)
        chip(s,x+1.25,6.27,st_,TL if 'MVP'==st_ else OL,TEAL if 'MVP'==st_ else ORANGE,w=0.68,size=6)
        tb(s,x,6.5,1.95,0.55,b,size=7.2,color=INK)
    footer(s,3)
