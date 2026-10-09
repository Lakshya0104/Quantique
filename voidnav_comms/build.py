from lib import *
import s12
p=Presentation(); p.slide_width=I(13.333); p.slide_height=I(7.5)
s12.slide1(p); s12.slide2(p)
import importlib,os
for m in ('s3','s4','s5','s6'):
    if os.path.exists(m+'.py'): getattr(importlib.import_module(m),'slide'+m[1])(p)
p.save('VOID-NAV_SOS_Network.pptx'); print('saved',len(p.slides))
