from lib import *
def slide5(p):
    s=p.slides.add_slide(p.slide_layouts[6])
    header(s,'05','Impact & Benefits','Keeping a usable emergency pathway open when conventional infrastructure is gone')
    st=[('◉','Survivors without signal','can request help from a nearby public SOS point'),('✚','Urgent medical / rescue','P0 requests get first use of scarce airtime'),('♥','Families','"I am safe" messages travel when calls cannot'),('◎','Authorities','one prioritised, location-labelled list of requests'),('⌂','Public facilities','hospitals, panchayats, stations become comms points')]
    for i,(ic,a,b) in enumerate(st):
        x=0.45+i*2.5; box(s,x,1.4,2.38,1.05,fill=GREY)
        circ(s,x+0.12,1.5,0.36,ic,fill=TEAL,size=12); tb(s,x+0.58,1.52,1.75,0.4,a,size=9.5,bold=True,font=SERIF)
        tb(s,x+0.12,1.95,2.15,0.45,b,size=8,color=MUT)
    # capability -> benefit -> outcome
    eyebrow(s,0.45,2.62,'Capability → operational benefit → intended outcome',w=8)
    for j,(h,c) in enumerate([('Capability',TEAL),('Operational benefit',ORANGE),('Intended outcome',GREEN)]):
        tb(s,0.45+j*2.75,2.85,2.5,0.2,h,size=8.5,bold=True,color=c)
    rows=[('Pre-loaded structured messages','request in a few presses, no typing','help asked for even under stress'),
     ('Multi-hop relays','reach beyond one radio link','coverage across the affected area*'),
     ('Labelled location data','responder knows which site sent it','teams go to the right place'),
     ('End-to-end acknowledgements','survivor sees green when delivered','less panic-driven resending'),
     ('Priority handling','airtime goes to urgent cases first','critical requests surface first'),
     ('Store-and-forward + controlled relaying','survives short link outages','messages arrive late rather than never')]
    for i,(a,b,c) in enumerate(rows):
        y=3.08+i*0.5
        box(s,0.45,y,2.5,0.42,fill=TL,shape=S.ROUNDED_RECTANGLE,rad=0.15,text=[T(a,bold=True)],size=8)
        line(s,2.97,y+0.21,3.18,y+0.21,w=1.2,color=SLATE)
        box(s,3.2,y,2.5,0.42,fill=OL,shape=S.ROUNDED_RECTANGLE,rad=0.15,text=[T(b)],size=8)
        line(s,5.72,y+0.21,5.93,y+0.21,w=1.2,color=SLATE)
        box(s,5.95,y,2.5,0.42,fill=GL,shape=S.ROUNDED_RECTANGLE,rad=0.15,text=[T(c)],size=8)
    tb(s,0.45,6.12,8,0.2,'*subject to radio range, terrain, relay placement and channel capacity, which must be measured on site.',size=7,italic=True,color=MUT)
    # right: capacity + latency
    R=8.75; box(s,R,2.62,4.13,3.72,line=LINE,dash=True)
    eyebrow(s,R+0.15,2.72,'Capacity & latency (estimates)',w=3.8)
    tb(s,R+0.15,2.95,3.85,0.85,[[B('More relays ≠ more capacity. '),T('Nodes in radio range share one channel. One P0 request over 3 hops plus its ACK uses ≈ 3×185 + 3×144 ≈ 1.0 s of airtime, so at a cautious 20–30 % channel load one shared channel carries roughly 12–18 such requests per minute. Scaling means more receiving stations and separate areas, not just more relays.')]],size=7.6)
    rows=[('Per hop, P0 (SF9, 21 B)','ms'),('CAD check (~2 symbols)','≈ 8'),('Random backoff (avg of 0–150)','≈ 75'),('Time on air','≈ 185'),('Processing / queue','≈ 10'),('3 hops forward','≈ 0.85 s'),('ACK back, 3 hops (10 B)','≈ 0.7 s'),('Round trip, idle channel','≈ 1.6 s')]
    t=s.shapes.add_table(len(rows),2,I(R+0.15),I(3.88),I(3.85),I(1.6)).table
    t.columns[0].width=I(2.75); t.columns[1].width=I(1.1)
    for i,r in enumerate(rows):
        t.rows[i].height=I(0.19)
        for j,v in enumerate(r):
            c=t.cell(i,j); c.text=v; c.margin_left=c.margin_right=I(0.05); c.margin_top=c.margin_bottom=I(0.01)
            c.fill.solid(); c.fill.fore_color.rgb=INK if i==0 else (OL if i==7 else (WHITE if i%2 else GREY))
            f=c.text_frame.paragraphs[0].runs[0].font; f.size=Pt(7.2); f.name=SANS; f.bold=(i in (0,7)); f.color.rgb=WHITE if i==0 else INK
    tb(s,R+0.15,5.55,3.85,0.75,[[B('Proposed targets (to measure): ',color=ORANGE),T('P0 ACK ≤ 5 s at 3 hops · delivery ratio ≥ 95 % at test load · transmissions per delivered request ≤ hops + 2 · reported at 1, 5, 20 requests/min and with one relay removed.')]],size=7.4)
    # bottom statement
    box(s,0.45,6.42,12.43,0.65,fill=DARK)
    tb(s,0.7,6.47,12,0.55,[[T('Intended outcome: ',font=SERIF,bold=True,color=ORANGE,size=13),T('when towers and internet are gone, survivors still have a nearby place to ask for help, and responders still receive a prioritised, location-labelled list of who needs it.',font=SERIF,size=13,color=WHITE)]],anchor=V.MIDDLE)
    footer(s,5)
