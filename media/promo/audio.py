# SCaD Redes · audio original para el video promocional (42 s)
# Música sintetizada (sin derechos de terceros) + efectos sincronizados con las escenas.
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
DUR = 42.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
BPM = 112
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)

def tt(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.01, r=0.2, sus=1.0):
    e = np.ones(n) * sus
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, sus, na)
    if nr < n: e[-nr:] = np.linspace(sus, 0, nr)
    return e
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def add(sig, t0, g=1.0, pan=0.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if i >= N or j <= i: return
    s = sig[: j - i] * g
    L[i:j] += s * (1 - pan) ** .5 if pan > 0 else s
    R[i:j] += s * (1 + pan) ** .5 if pan < 0 else s
def hz(m): return 440 * 2 ** ((m - 69) / 12)

# --- instrumentos ---
def pad(notes, d):
    t = tt(d); s = np.zeros(len(t))
    for m in notes:
        f = hz(m)
        for det in (-0.12, 0.0, 0.12):
            s += np.sin(2 * np.pi * f * (1 + det / 100) * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t + 0.5)
    return lp(s, 1800) * env(len(t), 0.35, 0.5) / (len(notes) * 4)
def bass(m, d):
    t = tt(d); f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t)
    return lp(s, 600) * env(len(t), 0.005, 0.08) * np.exp(-t * 2.5)
def kick():
    t = tt(0.35); f = 120 * np.exp(-t * 18) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
def clap():
    t = tt(0.25); n = rng.standard_normal(len(t))
    return bp(n, 900, 4000) * np.exp(-t * 22) * 0.9
def hat(open_=False):
    t = tt(0.12 if not open_ else 0.3); n = rng.standard_normal(len(t))
    return hp(n, 7000) * np.exp(-t * (60 if not open_ else 14)) * 0.35
def pluck(m, d=0.35):
    t = tt(d); f = hz(m)
    s = np.sign(np.sin(2 * np.pi * f * t)) * 0.3 + np.sin(2 * np.pi * f * t)
    return lp(s, 3200) * np.exp(-t * 9) * 0.5
def pop(f=900):
    t = tt(0.09); fr = f * (1 + 2 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 45) * 0.5
def whoosh(d=0.6, up=True):
    t = tt(d); n = rng.standard_normal(len(t))
    out = np.zeros(len(t)); seg = 64
    for k in range(seg):
        a, b = k * len(t) // seg, (k + 1) * len(t) // seg
        x = k / seg if up else 1 - k / seg
        out[a:b] = bp(n[a:b], 300 + 3500 * x, 600 + 6000 * x)
    return out * np.sin(np.pi * np.linspace(0, 1, len(t))) ** 2 * 0.6
def ding(m=88):
    t = tt(1.2); f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2.76 * f * t) + 0.2 * np.sin(2 * np.pi * 5.4 * f * t)
    return s * np.exp(-t * 3.2) * 0.35
def impact():
    t = tt(1.4); n = rng.standard_normal(len(t))
    return (lp(n, 250) * np.exp(-t * 4) * 1.4 + np.sin(2 * np.pi * 50 * t) * np.exp(-t * 3)) * 0.8
def riser(d):
    t = tt(d); f = 200 + 1400 * (t / d) ** 2
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15 + hp(rng.standard_normal(len(t)), 3000) * 0.08
    return s * (t / d) ** 1.5

# --- armonía: C – G – Am – F (2 compases por acorde) ---
CH = [([60, 64, 67, 72], 36), ([59, 62, 67, 71], 43), ([57, 60, 64, 69], 45), ([57, 60, 65, 69], 41)]
ARP = [[72, 76, 79, 76], [71, 74, 79, 74], [69, 72, 76, 72], [69, 72, 77, 72]]

INICIO = 1.6          # golpe del logo
FIN = 40.0
t = INICIO; k = 0
while t < FIN:
    notes, root = CH[k % 4]
    add(pad(notes, 2 * BAR + 0.6), t, 0.55)
    for b in range(8):                         # 2 compases
        bt = t + b * BEAT
        if bt >= FIN: break
        drums = bt >= 4.6
        if drums and b % 2 == 0: add(kick(), bt, 0.9)
        if drums and b % 2 == 1: add(clap(), bt, 0.35, 0.1)
        add(bass(root, BEAT * 0.9), bt, 0.55 if drums else 0.35)
        add(bass(root, BEAT * 0.4), bt + BEAT / 2, 0.3 if drums else 0.0)
        if bt >= 9.4:
            for h in range(2): add(hat(h == 1 and b % 4 == 3), bt + h * BEAT / 2, 0.5, 0.3 * (1 if h else -1))
        if 9.4 <= bt < 35.6:                   # arpegio en escenas de producto
            for q in range(2): add(pluck(ARP[k % 4][(2 * b + q) % 4], 0.3), bt + q * BEAT / 2, 0.28, -0.25 + 0.5 * q)
    t += 2 * BAR; k += 1

# --- efectos sincronizados ---
add(riser(1.5), 0.1, 0.9)
add(impact(), INICIO, 0.9)
for i in range(4): add(pop(700 + 120 * i), 0.9 + i * 0.32, 0.5)              # piezas del logo
for ts in [4.6, 9.4, 14.6, 19.0, 23.2, 27.6, 31.6, 35.6]: add(whoosh(0.55), ts - 0.3, 0.55)
for i in range(8): add(pop(600 + 60 * i), 4.9 + i * 0.12, 0.35, -0.4 + 0.1 * i)  # redes
add(whoosh(0.9, up=False), 7.4, 0.5); add(ding(84), 8.1, 0.8)                  # "Todo en un solo panel"
for i in range(5): add(pop(900), 10.8 + i * 0.28, 0.3)                          # filas del panel
for j in range(11): add(pop(1100 + 30 * j), 15.2 + j * 0.17, 0.22, (j % 3 - 1) * 0.3)  # calendario
for i in range(4): add(pop(750 + 80 * i), 20.1 + i * 0.35, 0.45)               # fechas de la serie
for i in range(5): add(pluck(72 + [0, 2, 4, 7, 12][i], 0.5), 23.6 + i * 0.65, 0.45)  # estados
add(ding(91), 26.2, 0.9)                                                        # Publicado
for i in range(3): add(pop(650), 27.9 + i * 0.35, 0.35)                         # colaboradores
add(whoosh(0.5), 32.0, 0.45)                                                    # teléfono
add(impact(), 35.7, 0.6); add(pad([48, 60, 64, 67, 72], 6.0), 35.7, 0.7)       # cierre
add(pop(800), 36.4, 0.4); add(pop(900), 36.7, 0.4); add(ding(96), 37.3, 0.9)   # precios y URL

# --- mezcla final ---
mix = np.stack([L, R], axis=1)
fade = np.ones(N); fo = int(2.5 * SR); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.1)                       # saturación suave
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.89                                    # margen (~ -1 dBFS)
wavfile.write('promo_audio.wav', SR, (mix * 32767).astype(np.int16))
print('ok', DUR, 's')
