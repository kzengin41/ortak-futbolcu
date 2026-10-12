# Paket 24 (12 Ekim 2026, Kerem: "3-2-1 geri sayımı ve bir donk sesi geliyor.
# toplamda 3 tane ses olması lazım. sonuncusu donk.") — Paket 22'de count-1
# dosyası "bip + 1,25 sn sonra başlama sesi" idi: 3 bip + 1 başlama = 4 ses.
# Artık tam 3 ses: "3" bip, "2" bip, "1" DONK (tok, alçak, kısa yankılı).
# Donk "1" ile AYNI ANDA çalar; ayrı bir başlama sesi yok.
# Paket 22 — 3-2-1 efekti (sentez, lisans derdi yok). Yarış oyunu sayımı:
# "bip – bip – bip – BİİİP": her sayı kısa, tok bir bip (+ alçak darbe),
# başlama anında yükselen bir "vuuş" ve parlak, uzun bir başlama sesi.
import numpy as np, subprocess, wave
SR = 44100
def t(sn): return np.arange(int(sn * SR)) / SR
def zarf(n, atak, birak, sustain=0.0):
    e = np.ones(n); a = int(atak * SR); e[:a] = np.linspace(0, 1, a)
    s = int(sustain * SR); kalan = n - a - s
    e[a + s:] = np.exp(-np.arange(kalan) / (birak * SR))
    return e
def ton(f, sn, harmonik=(1, .35, .18, .08)):
    x = t(sn); return sum(g * np.sin(2 * np.pi * f * (k + 1) * x) for k, g in enumerate(harmonik))
def darbe(sn=0.16, f0=140, f1=48):
    x = t(sn); f = f1 + (f0 - f1) * np.exp(-x / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.05)
def gurultu(sn, seed=1): return np.random.default_rng(seed).standard_normal(int(sn * SR))
def bp(x, lo, hi):   # basit FFT bant geçiren
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR); X[(fr < lo) | (fr > hi)] = 0; return np.fft.irfft(X, len(x))

def bip(f=622):   # D#5 civarı, tok
    n = int(0.45 * SR)
    b = ton(f, .45) * zarf(n, .004, .06, .09)
    d = np.zeros(n); dd = darbe(); d[:len(dd)] = dd
    tik = np.zeros(n); g = bp(gurultu(.012, 3), 2000, 9000) * np.linspace(1, 0, int(.012 * SR)); tik[:len(g)] = g
    return .55 * b + .6 * d + .25 * tik

def basla(f=1244):   # bir oktav üstü, uzun ve parlak (kuint ile)
    sn = 1.35; n = int(sn * SR)
    a = ton(f, sn, (1, .3, .12)) + .45 * ton(f * 1.5, sn, (1, .2)) + .3 * ton(f / 2, sn, (1, .2))
    vib = 1 + .004 * np.sin(2 * np.pi * 6 * t(sn))
    a = a * zarf(n, .006, .26, .22) * vib
    d = np.zeros(n); dd = darbe(.25, 160, 42); d[:len(dd)] = dd * 1.2
    # tribün patlaması: bant geçiren gürültü, hızlı atak, yavaş sönüm
    tr = bp(gurultu(sn, 7), 300, 4000) * zarf(n, .02, .35, .05); tr /= np.abs(tr).max()
    return .5 * a + .55 * d + .22 * tr

def vuus(sn=0.45):   # başlamadan önce yükselen hava sesi: bant gürültü + yükselen hafif ton
    n = int(sn * SR); x = t(sn)
    g = bp(gurultu(sn, 5), 900, 7000); g /= np.abs(g).max()
    f = 300 * (4 ** (x / sn))                       # 300 Hz -> 1200 Hz
    sw = np.sin(2 * np.pi * np.cumsum(f) / SR)
    e = (x / sn) ** 2.2
    return (.30 * g + .18 * sw) * e

OLCEK = None   # hepsi aynı ölçekle: count-3/2'deki bip, count-1'dekiyle aynı yükseklikte
def yaz(ad, x):
    x = x * OLCEK
    k = int(.03 * SR); x = x.copy(); x[-k:] *= np.linspace(1, 0, k)
    w = wave.open("_g.wav", "w"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((x * 32767).astype(np.int16).tobytes()); w.close()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "_g.wav", "-af", "highpass=f=35", "-c:a", "libmp3lame", "-b:a", "96k", ad], check=True)
    return x

def donk(f=311):   # bipin bir oktav altı (D#4): tok gövde + güçlü darbe + hafif ton düşüşü
    sn = 0.9; n = int(sn * SR); x = t(sn)
    kay = f * (1 + .06 * np.exp(-x / .025))                 # vuruş anında hafif yukarıdan iner
    faz = 2 * np.pi * np.cumsum(kay) / SR
    g = (np.sin(faz) + .45 * np.sin(2 * faz) + .22 * np.sin(3 * faz) + .3 * np.sin(.5 * faz)) * zarf(n, .003, .22, .03)
    d = np.zeros(n); dd = darbe(.3, 170, 45); d[:len(dd)] = dd * 1.4
    tik = np.zeros(n); k = bp(gurultu(.02, 4), 1500, 6000) * np.linspace(1, 0, int(.02 * SR)); tik[:len(k)] = k
    return .55 * g + .7 * d + .2 * tik

b = bip()
dk = donk()
OLCEK = 0.93 / max(np.abs(dk).max(), np.abs(b).max() / 0.8)   # bipler donk'tan biraz kısık
yaz("count-3.mp3", b)
yaz("count-2.mp3", b)
yaz("count-1.mp3", dk)
# dinleme dosyası (uygulamadaki zamanlama, Paket 25: 0 / 0.7 / 1.4 sn; takımlar 1.8 sn)
d = np.zeros(int(2.8 * SR))
for t0, x in ((0, b), (.7, b), (1.4, dk)):
    i = int(t0 * SR); d[i:i + len(x)] += x[:len(d) - i]
yaz("dinle_3-2-1.mp3", np.concatenate([np.zeros(int(.3 * SR)), d]))
