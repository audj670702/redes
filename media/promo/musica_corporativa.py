# SCaD Redes · música corporativa de fondo (42 s) — original, sin derechos de terceros
# Estilo: corporativo optimista, 100 BPM, Re mayor, I–V–vi–IV. Sin efectos de sonido.
# Estructura alineada con las escenas del video:
#   0–4.6 intro (piano + pad) · 4.6–9.4 entra bajo y percusión suave ·
#   9.4–35.6 cuerpo (arpegio, melodía de campana) · 35.6–42 cierre en acorde final.
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
DUR = 42.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(11)

def tt(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.01, r=0.2):
    e = np.ones(n); na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    if nr < n: e[-nr:] *= np.linspace(1, 0, nr)
    return e
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def add(sig, t0, g=1.0, pan=0.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if i >= N or j <= i: return
    s = sig[: j - i] * g
    L[i:j] += s * np.sqrt((1 - pan) / 2) * 1.414
    R[i:j] += s * np.sqrt((1 + pan) / 2) * 1.414

# --- instrumentos ---
def piano(m, d=1.6):
    t = tt(d); f = hz(m); s = np.zeros(len(t))
    for k, (a, dec) in enumerate([(1, 2.2), (.45, 3.5), (.22, 5), (.12, 7), (.06, 9)], 1):
        s += a * np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) * np.exp(-t * dec)
    s += 0.05 * bp(rng.standard_normal(len(t)), 1500, 5000) * np.exp(-t * 60)   # martillo
    return s * env(len(t), 0.003, 0.25) * 0.32
def pad(notes, d):
    t = tt(d); s = np.zeros(len(t))
    for m in notes:
        f = hz(m)
        for det in (-0.15, 0, 0.15):
            ph = rng.uniform(0, 6.28)
            s += np.sin(2 * np.pi * f * (1 + det / 100) * t + ph) + 0.25 * np.sin(4 * np.pi * f * t + ph)
    vib = 1 + 0.08 * np.sin(2 * np.pi * 0.25 * t)
    return lp(s, 1400) * env(len(t), 0.8, 0.9) * vib / (len(notes) * 3.5)
def bass(m, d):
    t = tt(d); f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    return lp(s, 400) * env(len(t), 0.01, 0.12) * (0.6 + 0.4 * np.exp(-t * 3))
def bell(m, d=1.4):
    t = tt(d); f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 3.0 * f * t) * np.exp(-t * 6)
    return s * np.exp(-t * 2.8) * env(len(t), 0.004, 0.2) * 0.22
def kick():
    t = tt(0.3); f = 90 * np.exp(-t * 20) + 48
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) * 0.7
def snap():
    t = tt(0.2)
    return bp(rng.standard_normal(len(t)), 1200, 5000) * np.exp(-t * 28) * 0.35
def shaker():
    t = tt(0.08)
    return hp(rng.standard_normal(len(t)), 6000) * np.sin(np.pi * t / 0.08) ** 2 * 0.12

# --- armonía en Re mayor: D – A – Bm – G ---
CH = [([62, 66, 69], 38), ([61, 64, 69], 45), ([62, 66, 71], 47), ([62, 67, 71], 43)]
ARP = [[74, 78, 81, 78], [73, 76, 81, 76], [74, 78, 83, 78], [74, 79, 83, 79]]
MEL = [[81, None, 78, 76, 78, None, None, None],   # 1 compás por acorde, corcheas de negra
       [76, None, 73, 73, 76, None, 78, None],
       [78, None, 74, 74, 78, None, 81, None],
       [79, None, 78, 76, 74, None, None, None]]

FIN_CUERPO = 35.6
t = 0.0; k = 0
while t < FIN_CUERPO - 0.01:
    notes, root = CH[k % 4]
    add(pad(notes + [notes[0] + 12], BAR + 0.9), t, 0.45)
    for b in range(4):
        bt = t + b * BEAT
        if bt >= FIN_CUERPO: break
        # piano: acorde en 1, notas sueltas en 2–4
        if b == 0:
            for i, m in enumerate(notes): add(piano(m, 2.2), bt + i * 0.012, 0.55, -0.2 + 0.2 * i)
        else:
            add(piano(notes[b % 3] + 12, 1.0), bt, 0.32, 0.15)
        if bt >= 4.6:                       # bajo y percusión suave
            add(bass(root, BEAT * 0.95), bt, 0.45)
            if b in (0, 2): add(kick(), bt, 0.28)
            if b in (1, 3) and bt >= 9.4: add(snap(), bt, 0.5, 0.1)
            if bt >= 9.4:
                for s16 in range(4): add(shaker(), bt + s16 * BEAT / 4, 1.0 if s16 % 2 else 0.6, 0.35)
        if 9.4 <= bt:                       # arpegio de piano en corcheas
            for q in range(2): add(piano(ARP[k % 4][(2 * b + q) % 4], 0.8), bt + q * BEAT / 2, 0.2, -0.35 + 0.7 * q)
        if 14.6 <= bt:                      # melodía de campana
            for q in range(2):
                m = MEL[k % 4][2 * b + q]
                if m: add(bell(m), bt + q * BEAT / 2, 0.75, 0.2)
    t += BAR; k += 1

# --- cierre: acorde final sostenido sobre Re ---
add(pad([50, 62, 66, 69, 74], 6.4), 35.6, 0.75)
for i, m in enumerate([50, 62, 66, 69, 74, 78]): add(piano(m, 5.5), 35.6 + i * 0.05, 0.6, -0.3 + 0.12 * i)
add(bass(38, 3.0), 35.6, 0.6)
add(bell(86, 3.0), 37.3, 0.9, 0.2)

# --- mezcla ---
mix = np.stack([L, R], axis=1)
fi, fo = int(1.2 * SR), int(3.0 * SR)
g = np.ones(N); g[:fi] = np.linspace(0, 1, fi); g[-fo:] = np.linspace(1, 0, fo)
mix *= g[:, None]
mix = np.tanh(mix * 1.6)
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.89
wavfile.write('musica_corporativa.wav', SR, (mix * 32767).astype(np.int16))
print('ok')
