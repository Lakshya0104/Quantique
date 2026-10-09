from lib import *
REFS=[
 ('LoRa airtime','Semtech AN1200.13, LoRa Modem Designer\'s Guide: time-on-air formula; airtime rises with SF and payload','https://www.mouser.com/pdfdocs/semtech-lora-modem-design.pdf','21 B structured frame; SF9 baseline ≈185 ms; custom text capped at 40 B','Design basis'),
 ('LoRa scalability','Bor, Roedig, Voigt, Alonso. "Do LoRa Low-Power Wide-Area Networks Scale?" ACM MSWiM 2016: collisions limit density; parameter choice and multiple sinks help','https://doi.org/10.1145/2988287.2989163','short frames, priority backoff, plan for several receiving stations','Needs evaluation'),
 ('Managed flooding','Meshtastic, Mesh Broadcast Algorithm: hop-limited flooding, listen-before-rebroadcast, SNR-based contention window','https://meshtastic.org/docs/overview/mesh-algo/','dedup, hop limit, cancel-if-overheard; we add a distance-gradient rule and priority classes','MVP core'),
 ('Why flood routing','Meshtastic blog, "Why Meshtastic uses managed flood routing": trade-offs of flooding vs routed meshes','https://meshtastic.org/blog/why-meshtastic-uses-managed-flood-routing/','keep routing simple; limit flood scope with gradient + hop limit','MVP core'),
 ('Channel activity detection','Semtech, "Channel Activity Detection: ensuring your LoRa packets are sent": CAD detects LoRa preambles/chirps, not full carrier sense','https://lora-developers.semtech.com/documentation/tech-papers-and-guides/channel-activity-detection-ensuring-your-lora-packets-are-sent/','CAD + random backoff before TX; collisions still possible','MVP (to test)'),
 ('SX1276 radio','Semtech SX1276/77/78/79 datasheet: LoRa modem, CAD mode, programmable SF/BW/CR','https://cdn.sparkfun.com/assets/7/7/3/2/2/SX1276_Datasheet.pdf','radio settings and CAD use match the actual chip','Design basis'),
 ('ESP32 SoftAP','Espressif ESP-IDF Wi-Fi API (AP/STA modes); SoftAP example: max_connection default 4','https://docs.espressif.com/projects/esp-idf/en/v5.0/esp32/api-reference/network/esp_wifi.html','optional phone form; few phones per node at a time','Optional'),
 ('Browser location','MDN Geolocation API & Chrome: geolocation only in secure contexts (HTTPS)','https://developer.chrome.com/blog/geolocation-on-secure-contexts-only','don\'t assume phone GPS on a local HTTP portal; use labelled node location','Design constraint'),
 ('Indian band rules','DoT clarification on 865–867 MHz (1 W TX, 4 W ERP, 200 kHz carrier); GSR 853(E) 2021, 865–868 MHz SRD exemption rules','https://dot.gov.in/sites/default/files/Clarification%20ETA%20865-867%20MHz.pdf','125 kHz BW inside 200 kHz; verify current limits in the 2021 gazette text','Must verify'),
 ('Regional plan','LoRa Alliance RP002-1.0.3 Regional Parameters, IN865-867 section','https://lora-alliance.org/wp-content/uploads/2021/05/RP002-1.0.3-FINAL-1.pdf','channel-plan reference (we do not run LoRaWAN)','Reference'),
 ('Public warning','NDMA CAP-based Integrated Alert System (SACHET), built with C-DOT','https://sachet.ndma.gov.in/','proposed route to announce SOS node locations; no integration exists','Proposed')]
def slide6(p):
    s=p.slides.add_slide(p.slide_layouts[6])
    header(s,'06','Research & References','What published work establishes, how it shapes VOID-NAV, and what we still have to prove')
    cols=[('Area',1.45),('Established technique / finding (click to open)',5.3),('How it informs our design',4.2),('Status',1.48)]
    t=s.shapes.add_table(len(REFS)+1,4,I(0.45),I(1.42),I(12.43),I(5.0)).table
    for j,(h,w) in enumerate(cols): t.columns[j].width=I(w)
    stc={'MVP core':(GL,GREEN),'MVP (to test)':(GL,GREEN),'Design basis':(TL,TEAL),'Optional':(GREY,MUT),'Design constraint':(TL,TEAL),'Needs evaluation':(OL,ORANGE),'Must verify':(RL,RUST),'Reference':(GREY,MUT),'Proposed':(OL,ORANGE)}
    for i in range(len(REFS)+1):
        t.rows[i].height=I(0.42 if i else 0.25)
        for j in range(4):
            c=t.cell(i,j); c.margin_left=c.margin_right=I(0.06); c.margin_top=c.margin_bottom=I(0.02)
            c.fill.solid(); c.fill.fore_color.rgb=INK if i==0 else (WHITE if i%2 else GREY)
            tf=c.text_frame; tf.word_wrap=True; pp=tf.paragraphs[0]
            if i==0:
                r=pp.add_run(); r.text=cols[j][0]; f=r.font; f.size=Pt(8); f.bold=True; f.color.rgb=WHITE; f.name=SANS; continue
            area,find,url,how,st=REFS[i-1]
            if j==0: r=pp.add_run(); r.text=area; r.font.size=Pt(8); r.font.bold=True; r.font.name=SANS; r.font.color.rgb=INK
            elif j==1:
                r=pp.add_run(); r.text=find+'  '; r.font.size=Pt(7.9); r.font.name=SANS; r.font.color.rgb=INK
                r2=pp.add_run(); r2.text='↗ link'; r2.font.size=Pt(7.9); r2.font.bold=True; r2.font.name=SANS; r2.hyperlink.address=url; r2.font.color.rgb=TEAL
            elif j==2: r=pp.add_run(); r.text=how; r.font.size=Pt(7.9); r.font.name=SANS; r.font.color.rgb=INK
            else:
                bg,fc=stc[st]; c.fill.fore_color.rgb=bg; r=pp.add_run(); r.text=st; r.font.size=Pt(7.6); r.font.bold=True; r.font.name=SANS; r.font.color.rgb=fc
    box(s,0.45,6.5,12.43,0.58,fill=OL)
    tb(s,0.65,6.55,12.1,0.5,[[B('Read this right: ',color=ORANGE),T('published work supports individual techniques (airtime, CAD, managed flooding, band rules). It does not show that VOID-NAV as a whole works. Our own contribution is the integration and protocol design, and every performance figure in this deck is an estimate or target until measured on our prototype.')]],size=8.6,anchor=V.MIDDLE)
    footer(s,6)
