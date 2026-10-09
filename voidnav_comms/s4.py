from lib import *
def tbl(s,x,y,w,colw,rows,size=7.2,hdr_fill=INK,row_h=0.2,fills=None,bold_cols=(0,)):
    t=s.shapes.add_table(len(rows),len(colw),I(x),I(y),I(w),I(row_h*len(rows))).table
    for j,wd in enumerate(colw): t.columns[j].width=I(wd)
    for i,r in enumerate(rows):
        t.rows[i].height=I(row_h)
        for j,v in enumerate(r):
            c=t.cell(i,j); c.text=v or ' '; c.margin_left=c.margin_right=I(0.05); c.margin_top=c.margin_bottom=I(0.015)
            c.fill.solid(); c.fill.fore_color.rgb=hdr_fill if i==0 else (fills(i,j,v) if fills else (WHITE if i%2 else GREY))
            for pp in c.text_frame.paragraphs:
                for rr in pp.runs:
                    f=rr.font; f.size=Pt(size); f.name=SANS; f.bold=(i==0 or j in bold_cols); f.color.rgb=WHITE if i==0 else INK
    return t
def slide4(p):
    s=p.slides.add_slide(p.slide_layouts[6])
    header(s,'04','Feasibility, Viability & Risk Mitigation','Built incrementally on commodity ESP32 + LoRa hardware, with every risky assumption named and testable')
    # A
    box(s,0.45,1.4,5.95,2.35,line=LINE,dash=True); circ(s,0.57,1.5,0.3,'A',fill=TEAL,size=10); tb(s,0.97,1.5,5,0.3,'Why the system is feasible',size=12,font=SERIF,bold=True)
    items=[('ESP32 controller','dual-core MCU with built-in Wi-Fi; mature Arduino/ESP-IDF toolchains'),('LoRa modules available','SX127x-family modules with 865–867 MHz variants are sold in India'),('Local Wi-Fi interface','ESP32 SoftAP + small web server serves a form with no internet'),('Small structured payloads','21 B request ≈ 185 ms airtime at SF9/125 kHz (formula-based)'),('Incremental build','each layer (link → relay → ACK → priority) testable on its own'),('No cloud, no cellular','the LoRa path is fully local; the dashboard runs on a laptop')]
    for i,(a,b) in enumerate(items):
        x=0.6+(i%2)*2.92; y=1.92+(i//2)*0.6
        circ(s,x,y+0.02,0.22,'✓',fill=GL,fc=GREEN,size=8)
        tb(s,x+0.3,y,2.55,0.2,a,size=9,bold=True); tb(s,x+0.3,y+0.2,2.55,0.38,b,size=7.6,color=MUT)
    # B roadmap
    box(s,6.55,1.4,6.33,2.35,line=LINE,dash=True); circ(s,6.67,1.5,0.3,'B',fill=TEAL,size=10); tb(s,7.07,1.5,5,0.3,'How we build it',size=12,font=SERIF,bold=True)
    steps=[('1','Point-to-point LoRa link','exit: stable RX/TX, RSSI logged'),('2','Packet format + unique msg_id','exit: 21 B frames decode at station'),('3','Relay forwarding + dedup + hop limit','exit: 3-hop chain, no duplicate storms'),('4','Menu UI + LED states','exit: request in ≤ 4 presses'),('5','ACK return path, retries, priority queues + CAD backoff','exit: green LED on matched ACK'),('6','Location + dashboard; load & failure tests','exit: metrics from slide 5 plan')]
    for i,(n,a,b) in enumerate(steps):
        x=6.67+(i%3)*2.05; y=1.92+(i//3)*0.9
        box(s,x,y,1.95,0.8,fill=TL if i<3 else OL,shape=S.ROUNDED_RECTANGLE,rad=0.1)
        circ(s,x+0.08,y+0.08,0.24,n,fill=TEAL if i<3 else ORANGE,size=8)
        tb(s,x+0.38,y+0.07,1.52,0.42,a,size=8,bold=True); tb(s,x+0.1,y+0.52,1.8,0.25,b,size=6.8,color=MUT,italic=True)
        if i%3<2: line(s,x+1.95,y+0.4,x+2.05,y+0.4,w=1)
    # C risks
    box(s,0.45,3.88,7.4,3.2,line=LINE,dash=True); circ(s,0.57,3.98,0.3,'C',fill=RUST,size=10); tb(s,0.97,3.98,5,0.3,'Risks & mitigation',size=12,font=SERIF,bold=True)
    rows=[('Risk','Effect','Mitigation'),
     ('Simultaneous TX / collisions','lost packets; retries add load','CAD before TX, priority-scaled random backoff, cancel if overheard; collisions reduced, never eliminated'),
     ('Relay congestion','queues fill, latency grows','gradient forwarding (not blind flooding), P3 rate limit, queue cap 32 with lowest-priority eviction'),
     ('Lost ACKs → repeats','duplicate traffic','retries reuse msg_id → relays drop dups; station re-ACKs without re-alerting; capped retries'),
     ('Relay or station offline','route breaks','another lower-distance relay forwards; store-and-forward until TTL; distance beacons refresh'),
     ('Wrong / missing location','help sent to wrong place','explicit label: STATION / NODE-GPS / NONE; surveyed coords at install; GPS fix age'),
     ('Limited bandwidth & payload','text crowds out urgent traffic','21 B structured frames; custom text ≤ 40 B, single frame, no fragmentation in MVP'),
     ('Forged / spam messages','false alarms, wasted airtime','node-ID allow-list + rate limits (MVP); message authentication with a network key (proposed)'),
     ('Power failure at SOS site','node offline','battery + solar enclosure (proposed); relay sleep; battery level in beacons'),
     ('Radio regulation','non-compliance','stay in 865–867 MHz exempt band, 125 kHz BW (< 200 kHz); verify power limits in GSR 853(E)')]
    tbl(s,0.57,4.33,7.15,[1.6,1.5,4.05],rows,size=6.9,row_h=0.27,hdr_fill=RUST)
    # D prototype vs deployment
    box(s,8.0,3.88,4.88,3.2,line=LINE,dash=True); circ(s,8.12,3.98,0.3,'D',fill=ORANGE,size=10); tb(s,8.52,3.98,4,0.3,'Prototype vs deployment',size=12,font=SERIF,bold=True)
    pr=[('Capability','Hackathon PoC','Deployment'),('LoRa P2P + 3-hop relay','planned demo','field test'),('Dedup, hop limit, gradient rule','planned demo','tune at scale'),('Priority queues + CAD backoff','planned demo','load test'),('End-to-end ACK + LEDs','planned demo','field test'),('Phone Wi-Fi form','optional','optional'),('Fixed / GPS location label','planned demo','survey all sites'),('Ops dashboard (offline)','planned demo','multi-station'),('Solar enclosure, auth key','—','proposed'),('Public-warning integration','—','proposed, needs partner')]
    def f(i,j,v):
        if j==0: return GREY
        return GL if v.startswith('planned') else (OL if v.startswith(('field','tune','load','survey','multi','proposed')) else WHITE)
    tbl(s,8.12,4.33,4.64,[2.0,1.27,1.37],pr,size=6.9,row_h=0.205,fills=f)
    tb(s,8.12,6.42,4.64,0.62,[[B('Status: '),T('"planned demo" = target for our hackathon build, '),B('[confirm before submission]'),T('. Nothing above is claimed as already tested.')],[B('BOM template: '),T('ESP32 · LoRa module + antenna · OLED + 4 buttons · 2 LEDs · GPS (portable) · battery/solar · enclosure → unit costs [fill from supplier quotes].')]],size=6.8,color=INK,after=2)
    footer(s,4)
