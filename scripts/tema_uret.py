# Paket 24 — tema paletlerini OKLCH ile üretir (lib/theme.js PALETLER, lib/temaOlusturucu.js ZEMINLER).
# Çalıştır: python3 scripts/tema_uret.py  → değerleri ekrana basar; elle theme.js'e işlenir.
import math, json, sys
def lin2s(c): return 12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055
def s2lin(c): return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def oklch2rgb(L,C,h):
    a=C*math.cos(math.radians(h)); b=C*math.sin(math.radians(h))
    l_=L+0.3963377774*a+0.2158037573*b; m_=L-0.1055613458*a-0.0638541728*b; s_=L-0.0894841775*a-1.2914855480*b
    l,m,s=l_**3,m_**3,s_**3
    r=4.0767416621*l-3.3077115913*m+0.2309699292*s
    g=-1.2684380046*l+2.6097574011*m-0.3413193965*s
    bb=-0.0041960863*l-0.7034186147*m+1.7076147010*s
    return r,g,bb
def hx(L,C,h):
    c=C
    while True:
        r,g,b=oklch2rgb(L,c,h)
        if all(-1e-4<=x<=1+1e-4 for x in (r,g,b)) or c<=0: break
        c-=0.002
    r,g,b=[min(1,max(0,x)) for x in oklch2rgb(L,max(c,0),h)]
    return '#'+''.join(f'{round(lin2s(x)*255):02X}' for x in (r,g,b))
def rgb2oklch(hexs):
    n=int(hexs[1:7],16); r,g,b=[s2lin(((n>>k)&255)/255) for k in (16,8,0)]
    l=0.4122214708*r+0.5363325363*g+0.0514459929*b; m=0.2119034982*r+0.6806995451*g+0.1073969566*b; s=0.0883024619*r+0.2817188376*g+0.6299787005*b
    l,m,s=[x**(1/3) for x in (l,m,s)]
    L=0.2104542553*l+0.7936177850*m-0.0040720468*s; a=1.9779984951*l-2.4285922050*m+0.4505937099*s; bb=0.0259040371*l+0.7827717662*m-0.8086757660*s
    return L, math.hypot(a,bb), (math.degrees(math.atan2(bb,a))+360)%360
def lum(hexs):
    n=int(hexs[1:7],16); r,g,b=[s2lin(((n>>k)&255)/255) for k in (16,8,0)]
    return .2126*r+.7152*g+.0722*b
def kontrast(a,b):
    x,y=sorted([lum(a),lum(b)],reverse=True); return (x+.05)/(y+.05)
import json
# Paket 25: kart zeminden daha belirgin ayrılsın (kontrast 1.26 → ~1.5)
L_ZEMIN, L_KART, L_CERCEVE = .15, .295, .41
# (taban tonu, yüzey kroması, vurgu, ikincil, üçüncü) — vurgular (L, C, h)
T = {
 'cim':  dict(h=150, cs=.030, acc=(.84,.19,138), cta=(.86,.14,90),  uc=(.84,.085,190)),
 'gece': dict(h=262, cs=.036, acc=(.75,.14,250), cta=(.83,.15,72),  uc=(.82,.08,295)),
 'koyu': dict(h=0,   cs=0,    acc=(.86,.13,158), cta=(.84,.09,85),  uc=(.82,.05,240), siyah=True),
 'gs':   dict(h=22,  cs=.045, acc=(.84,.165,82), cta=(.69,.19,28),  uc=(.89,.06,80)),
 'fb':   dict(h=262, cs=.045, acc=(.91,.18,100), cta=(.79,.11,250), uc=(.90,.06,95)),
 'bjk':  dict(h=0,   cs=0,    acc=(1,0,0),       cta=(.82,0,0),     uc=(.64,0,0), siyah=True),
 'ts':   dict(h=5,   cs=.045, acc=(.79,.11,228), cta=(.65,.17,8),   uc=(.88,.05,20)),
}
def palet(t):
    h, cs = t['h'], t['cs']
    p = {}
    p['bg'] = '#000000' if t.get('siyah') else hx(L_ZEMIN, cs*1.35, h)
    p['card'] = hx(L_KART if not t.get('siyah') else L_KART - .02, cs, h)
    p['cardBorder'] = p['border'] = hx(L_CERCEVE if not t.get('siyah') else L_CERCEVE - .02, cs*.9, h)
    p['text'] = hx(.97, min(cs, .008), h)
    p['textMuted'] = hx(.77, min(cs, .03), h)
    p['textFaint'] = hx(.57, min(cs, .03), h)
    for ad, k in (('accent','acc'),('cta','cta'),('ucuncu','uc')):
        L,C,hh = t[k]
        p[ad] = hx(L,C,hh)
        # renk üstündeki yazı: aynı tonun çok koyusu (renk açıksa), değilse beyaz
        koyu = hx(.2, min(C*.35,.06) if C else 0, hh)
        p[ad+'Dark'] = koyu if kontrast(p[ad], koyu) >= kontrast(p[ad], '#FFFFFF') else '#FFFFFF'
    return p
OUT={}; out = {k: palet(v) for k,v in T.items()}
for k,p in out.items():
    OUT[k]=p; print(k, json.dumps(p), 'card/bg %.2f'%kontrast(p['card'],p['bg']), 'text/card %.1f muted/card %.1f acc/accD %.1f cta/ctaD %.1f'%(kontrast(p['text'],p['card']),kontrast(p['textMuted'],p['card']),kontrast(p['accent'],p['accentDark']),kontrast(p['cta'],p['ctaDark'])))

# özel tema zeminleri
Z = [('lacivert','Lacivert',248,.035),('gece','Gece mavisi',268,.04),('siyah','Siyah',0,0),('grafit','Grafit',250,.012),('orman','Orman',152,.035),('bordo','Bordo',18,.045),('mor','Mor',300,.04),('kahve','Kahve',60,.03)]
zem=[]
for i,ad,h,cs in Z:
    t=dict(h=h,cs=cs,siyah=(i=='siyah'))
    bg='#000000' if i=='siyah' else hx(L_ZEMIN,cs*1.35,h)
    zem.append(dict(id=i,ad=ad,renkler=dict(bg=bg,card=hx(L_KART if i!='siyah' else L_KART-.02,cs,h),cardBorder=hx(L_CERCEVE if i!='siyah' else L_CERCEVE-.02,cs*.9,h),text=hx(.97,min(cs,.008),h),textMuted=hx(.77,min(cs,.03),h),textFaint=hx(.57,min(cs,.03),h))))

for z in zem: print(z['id'], z['renkler'])

import sys
if len(sys.argv)>1:
    json.dump({'palet':OUT,'zemin':zem}, open(sys.argv[1],'w'), indent=1)
