from lib import *
def slide1(p):
    s=p.slides.add_slide(p.slide_layouts[6])
    eyebrow(s,0.45,0.4,'Tech Horizon 2.0 · Theme: Next-Gen Communication',w=7)
    tb(s,0.45,0.68,5.6,0.8,'VOID-NAV',size=46,font=SERIF,bold=True)
    tb(s,0.45,1.5,5.4,0.75,'An infrastructure-independent SOS network: public SOS nodes and a controlled LoRa relay mesh that carry prioritised, acknowledged emergency messages when towers and internet are down.',size=12.5,font=SERIF,color=MUT)
    box(s,0.45,2.5,5.4,2.55,fill=GREY)
    eyebrow(s,0.62,2.62,'Problem statement',color=RUST)
    tb(s,0.62,2.88,5.05,2.1,[
      [T('In a major disaster, cellular towers, internet and power fail together. Survivors cannot ask for help, share their location, or reach family, even when responders are only a few kilometres away.',)],
      [T('A replacement network must work with ',),B('no cellular or internet dependency'),T(', and it must ',),B('not collapse under its own traffic'),T(': as more survivors transmit, retransmissions, duplicates and simultaneous packets can saturate a low-bandwidth radio channel.')],
      [T('We need controlled forwarding, priority for urgent cases, delivery acknowledgements and location reporting, within LoRa\'s airtime limits.',)]],size=10.5,after=5,ls=1.05)
    tb(s,0.45,5.22,5.4,0.3,[[B('Team: ',color=MUT),T('Team VOID   '),B('Team ID: ',color=MUT),T('[to be filled]   '),B('Category: ',color=MUT),T('Next-Gen Communication')]],size=10)
    tb(s,0.45,5.5,5.4,0.3,[[B('Members: ',color=MUT),T('[Name 1] · [Name 2] · [Name 3] · [Name 4]')]],size=10)
    for i,(k,v) in enumerate([('Towers down','no cellular, no internet'),('Shared channel','limited LoRa airtime'),('Must confirm','sent ≠ delivered')]):
        x=0.45+i*1.83; box(s,x,5.95,1.72,0.85,line=LINE,dash=True)
        tb(s,x+0.1,6.02,1.55,0.3,k,size=11.5,font=SERIF,bold=True,color=TEAL); tb(s,x+0.1,6.35,1.55,0.4,v,size=9,color=MUT)
    # ===== central visual
    X=6.2; box(s,X,0.4,6.7,6.55,fill=None,line=LINE,dash=True)
    eyebrow(s,X+0.18,0.52,'Disaster zone → public SOS nodes → relays → response',w=6.4,color=MUT)
    # dead infrastructure
    box(s,X+0.25,0.95,2.05,1.45,fill=RL)
    for dx in (0.45,1.35):
        poly(s,[(X+0.25+dx,2.15),(X+0.25+dx+0.15,1.25),(X+0.25+dx+0.3,2.15)],color=SLATE,w=1.5,head=False)
        line(s,X+0.25+dx+0.15,1.25,X+0.25+dx+0.15,1.1,color=SLATE,w=1.5,head=False)
        line(s,X+0.25+dx+0.02,1.25,X+0.25+dx+0.28,1.65,color=RUST,w=2.5,head=False); line(s,X+0.25+dx+0.28,1.25,X+0.25+dx+0.02,1.65,color=RUST,w=2.5,head=False)
    tb(s,X+0.3,2.17,2.0,0.2,'Cell towers · internet · grid: DOWN',size=7.5,bold=True,color=RUST,align=A.CENTER)
    # survivors + SOS nodes at public places
    places=[('Hospital','H',0.35,2.75),('Gram panchayat','GP',0.35,3.95),('Railway station','RS',0.35,5.15)]
    for nm,ab,dx,dy in places:
        x=X+dx; y=dy
        box(s,x,y,1.0,0.75,fill=GREY,line=LINE); tb(s,x,y+0.04,1.0,0.2,nm,size=7.5,bold=True,align=A.CENTER,color=MUT)
        node(s,x+0.2,y+0.28,'SOS',fill=TEAL,w=0.6,h=0.36,sub=None)
        circ(s,x+0.82,y+0.31,0.09,'',fill=ORANGE); circ(s,x+0.82,y+0.47,0.09,'',fill=GREEN)
        person(s,x-0.3,y+0.3); person(s,x-0.3,y-0.05,col=SLATE,sc=0.8)
    # relays
    R=[('Relay 1',X+2.25,3.05),('Relay 2',X+3.55,2.35),('Relay 3',X+3.45,4.55),('Relay 4',X+4.75,3.4)]
    for nm,x,y in R: relay(s,x,y,nm)
    # station + dashboard
    sx,sy=X+5.55,1.25
    box(s,sx-0.1,sy-0.05,1.15,2.0,fill=TL,line=TEAL)
    tb(s,sx-0.05,sy,1.05,0.4,[B('SOS receiving\nstation',size=8,color=TEAL)],align=A.CENTER)
    node(s,sx+0.17,sy+0.5,'RX',fill=DARK,w=0.6,h=0.33)
    box(s,sx+0.03,sy+1.0,0.9,0.6,fill=WHITE,line=INK)
    for cx,cy,cc in [(0.2,0.15,RUST),(0.5,0.3,ORANGE),(0.65,0.12,GREEN),(0.35,0.38,RUST)]: circ(s,sx+0.03+cx,sy+1.0+cy,0.08,'',fill=cc)
    tb(s,sx-0.08,sy+1.62,1.1,0.3,'Emergency ops dashboard',size=7,color=MUT,align=A.CENTER)
    # links: message (teal), ack (green dashed), alternate (grey dotted)
    line(s,X+0.95,3.1,X+2.3,3.25,color=TEAL,w=1.75)
    line(s,X+2.5,3.15,X+3.6,2.55,color=TEAL,w=1.75)
    line(s,X+3.8,2.45,X+5.6,1.95,color=TEAL,w=1.75)
    line(s,X+0.95,4.3,X+2.3,3.4,color=TEAL,w=1.75)
    line(s,X+0.95,5.5,X+3.5,4.8,color=SLATE,w=1.5,dash=4)
    line(s,X+3.75,4.65,X+4.8,3.65,color=SLATE,w=1.5,dash=4)
    line(s,X+5.0,3.45,X+5.65,2.6,color=SLATE,w=1.5,dash=4)
    line(s,X+5.55,1.55,X+3.8,2.2,color=GREEN,w=1.5,dash=7)
    line(s,X+3.5,2.3,X+2.4,2.98,color=GREEN,w=1.5,dash=7)
    # legend
    ly=6.35
    line(s,X+0.3,ly+0.1,X+0.75,ly+0.1,color=TEAL,w=1.75); tb(s,X+0.82,ly,1.4,0.2,'SOS message path',size=8)
    line(s,X+2.3,ly+0.1,X+2.75,ly+0.1,color=GREEN,w=1.5,dash=7); tb(s,X+2.82,ly,1.6,0.2,'acknowledgement (return)',size=8)
    line(s,X+4.5,ly+0.1,X+4.95,ly+0.1,color=SLATE,w=1.5,dash=4); tb(s,X+5.02,ly,1.6,0.2,'alternative route',size=8)
    tb(s,X+0.3,ly+0.28,6.2,0.25,'Illustrative layout: actual SOS sites and relay positions are chosen during preparedness planning.',size=7.5,italic=True,color=SLATE)
    footer(s,1)

def slide2(p):
    s=p.slides.add_slide(p.slide_layouts[6])
    header(s,'02','Proposed Solution','Public SOS points + structured requests + controlled LoRa relaying + end-to-end acknowledgements')
    # LEFT problem
    L=0.45; box(s,L,1.45,2.85,4.55,fill=GREY)
    eyebrow(s,L+0.15,1.55,'Problem at hand',color=RUST,w=2.6)
    pains=[('Communications fail','Towers, internet and power go down together; phones lose service.'),
     ('No way to ask for help','Survivors can\'t reliably request rescue, medical aid or supplies.'),
     ('Location is unknown','Families and responders can\'t tell where a request came from.'),
     ('Forwarding congests','Unchecked rebroadcasts, duplicates and collisions waste scarce LoRa airtime.')]
    for i,(a,b) in enumerate(pains):
        y=1.85+i*1.03; circ(s,L+0.15,y,0.34,str(i+1),fill=RUST,size=10)
        tb(s,L+0.6,y-0.02,2.15,0.3,a,size=11,bold=True,font=SERIF); tb(s,L+0.6,y+0.3,2.15,0.8,b,size=9,color=MUT)
    # CENTRE architecture
    X=3.5; W=6.3; box(s,X,1.45,W,3.55,line=LINE,dash=True)
    eyebrow(s,X+0.15,1.55,'Our solution · system architecture',w=4)
    # stage markers
    # survivor & phone
    person(s,X+0.25,2.15); person(s,X+0.25,3.45,col=SLATE)
    box(s,X+0.2,2.55,0.32,0.5,fill=WHITE,line=INK,shape=S.ROUNDED_RECTANGLE,rad=0.2); tb(s,X+0.05,3.08,0.65,0.3,'phone (optional)',size=6.5,color=MUT,align=A.CENTER)
    # SOS node with menu
    box(s,X+0.85,1.95,1.25,2.0,fill=TL,line=TEAL)
    tb(s,X+0.85,1.98,1.25,0.2,'SOS ACCESS NODE',size=7,bold=True,color=TEAL,align=A.CENTER)
    box(s,X+0.95,2.2,1.05,0.95,fill=DARK,text=[[T('1 Rescue now',size=6.5,color=WHITE)],[T('2 Injured / medical',size=6.5,color=WHITE)],[T('3 Trapped',size=6.5,color=WHITE)],[T('4 Food / water',size=6.5,color=WHITE)],[T('5 Safe, tell family',size=6.5,color=WHITE)]],align=A.LEFT,anchor=V.TOP)
    for i in range(4): box(s,X+0.97+i*0.26,3.22,0.2,0.14,fill=SLATE,shape=S.ROUNDED_RECTANGLE,rad=0.3)
    circ(s,X+1.05,3.48,0.13,'',fill=ORANGE); tb(s,X+1.2,3.47,0.4,0.15,'sent',size=6.5)
    circ(s,X+1.5,3.48,0.13,'',fill=GREEN); tb(s,X+1.65,3.47,0.45,0.15,'ack',size=6.5)
    tb(s,X+0.88,3.7,1.2,0.22,'ESP32 + LoRa + GPS/fixed loc',size=6.5,color=MUT,align=A.CENTER)
    line(s,X+0.5,2.3,X+0.85,2.4,color=INK,w=1); line(s,X+0.52,2.8,X+0.85,2.8,color=INK,w=1,dash=4)
    # relays
    rel=[('Relay 1',X+2.45,2.0),('Relay 2',X+3.6,2.0),('Relay 3',X+3.0,3.2)]
    for nm,x,y in rel: relay(s,x,y,nm)
    # station
    box(s,X+4.6,1.85,1.55,1.05,fill=DARK,text=[[B('SOS RECEIVING\nSTATION',size=7.5,color=WHITE)],[T('decode · verify · ACK',size=6.5,color=SLATE)]])
    box(s,X+4.6,3.05,1.55,0.85,fill=WHITE,line=INK,text=[[B('Ops dashboard',size=8)],[T('map · priority list',size=6.5,color=MUT)]])
    line(s,X+5.38,2.9,X+5.38,3.05,color=INK,w=1)
    # paths
    line(s,X+2.1,2.25,X+2.5,2.12,color=TEAL,w=2); line(s,X+2.75,2.12,X+3.65,2.12,color=TEAL,w=2); line(s,X+3.9,2.12,X+4.6,2.2,color=TEAL,w=2)
    line(s,X+4.6,2.55,X+3.9,2.4,color=GREEN,w=1.5,dash=7); line(s,X+3.65,2.4,X+2.75,2.4,color=GREEN,w=1.5,dash=7); line(s,X+2.5,2.4,X+2.1,2.55,color=GREEN,w=1.5,dash=7)
    line(s,X+2.1,3.1,X+3.05,3.3,color=SLATE,w=1.25,dash=4); line(s,X+3.3,3.3,X+4.6,2.75,color=SLATE,w=1.25,dash=4)
    # numbered stages
    for n,(x,y) in enumerate([(X+0.05,1.85),(X+0.75,1.8),(X+2.3,1.75),(X+4.5,1.72),(X+4.5,2.95),(X+2.0,2.62)],1):
        circ(s,x,y,0.22,str(n),fill=ORANGE,size=8)
    # legend
    ly=4.12
    line(s,X+0.2,ly+0.08,X+0.6,ly+0.08,color=TEAL,w=2); tb(s,X+0.65,ly,1.3,0.18,'message path',size=7.5)
    line(s,X+1.75,ly+0.08,X+2.15,ly+0.08,color=GREEN,w=1.5,dash=7); tb(s,X+2.2,ly,1.5,0.18,'ACK return path',size=7.5)
    line(s,X+3.45,ly+0.08,X+3.85,ly+0.08,color=SLATE,w=1.25,dash=4); tb(s,X+3.9,ly,2.2,0.18,'alternative route if Relay 2 fails',size=7.5)
    tb(s,X+0.2,4.37,W-0.4,0.6,[[B('①',color=ORANGE),T(' survivor reaches node  '),B('②',color=ORANGE),T(' picks message, node builds packet  '),B('③',color=ORANGE),T(' relays forward toward station  '),B('④',color=ORANGE),T(' station decodes & ACKs  '),B('⑤',color=ORANGE),T(' dashboard shows request + location  '),B('⑥',color=ORANGE),T(' ACK returns → green LED')]],size=8.2,color=INK)
    # workflow strip
    wf=['Disaster','SOS node','Packet\n(21 B)','Relay hops','Station','Dashboard','ACK back']
    for i,t in enumerate(wf):
        x=X+i*0.9; box(s,x,5.12,0.78,0.48,fill=TEAL if i not in (6,) else GREEN,shape=S.ROUNDED_RECTANGLE,rad=0.2,text=[T(t,bold=True)],size=7.5,tcolor=WHITE)
        if i<6: line(s,x+0.79,5.36,x+0.89,5.36,color=INK,w=1)
    tb(s,X,5.68,W,0.3,'Optional path: phone → node Wi-Fi hotspot → local web form → same LoRa packet (custom text ≤ 40 B).',size=8,italic=True,color=MUT)
    # RIGHT features
    R=10.0; eyebrow(s,R,1.5,'Key features',w=2.8)
    feats=[('◎','Infrastructure-independent','local radio only; no cellular, internet or cloud'),('▤','Structured SOS menus','pre-loaded categories, yes/no and counts'),('⇄','Multi-hop forwarding','relays carry packets beyond one radio link'),('Wi','Phone-to-node Wi-Fi (opt.)','local web form for short custom text'),('⌖','Location-linked reports','node GPS or surveyed fixed-node location, labelled'),('✓','Two-way acknowledgement','orange = sent · green = delivered'),('▲','Priority, congestion-aware','P0 rescue first; dedup, hop limit, backoff'),('↻','Store-and-forward','buffer with expiry during link outages')]
    for i,(ic,a,b) in enumerate(feats):
        y=1.78+i*0.53; circ(s,R,y,0.3,ic,fill=TL,fc=TEAL,size=10)
        tb(s,R+0.42,y-0.03,2.45,0.22,a,size=9.5,bold=True); tb(s,R+0.42,y+0.19,2.45,0.35,b,size=8,color=MUT)
    # why we stand out
    box(s,0.45,6.12,12.43,0.95,fill=OL)
    eyebrow(s,0.62,6.2,'Why we stand out',color=ORANGE,w=3)
    tb(s,0.62,6.42,12.1,0.62,[[T('LoRa itself isn\'t the novelty. The value is the '),B('integration'),T(': accessible public SOS points + one-touch structured requests that fit in ~21 bytes + a forwarding protocol we implement ourselves ('),B('distance-gradient forwarding, duplicate suppression, hop limits, priority queues, bounded retries'),T(') + '),B('end-to-end acknowledgements'),T(' that tell a survivor their message actually arrived, with explicit, honest location labels.')]],size=9.5)
    footer(s,2)
