"""
第 1 期《起始之物》原创配乐（程序合成，逐帧对齐画面）。

用法：python music/ep01_score.py
输出：out/ep01-score.wav（48kHz / 24-bit / 立体声，时长与视频一致 127.5 秒）

所有时间点都由各段场景的时间轴帧号（30fps 单位）换算而来，
画面节奏调整后，同步修改下方 CUE 中的帧号再重新生成即可。
"""

import os
import wave

import numpy as np

SR = 48000
FPS = 30
rng = np.random.default_rng(20260930)

# ─── 时间轴：各段起点与关键帧（与 src/scenes/ep01/*.tsx 保持一致）────────────
SEG = {'arceus': 785, 'twins': 810, 'giratina': 650, 'lake': 1150, 'ending': 430}
_off, OFFSET = 0, {}
for _k, _v in SEG.items():
    OFFSET[_k] = _off
    _off += _v
TOTAL = _off / FPS  # 127.5 秒


def at(seg, frame):
    """某段内的帧号 → 全片秒数"""
    return (OFFSET[seg] + frame) / FPS


N = int(round(TOTAL * SR))
DRY = np.zeros((2, N))
SEND = np.zeros((2, N))  # 混响发送


# ─── 基础工具 ────────────────────────────────────────────────
def note(name):
    names = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
    base = names[name[0]]
    i = 1
    if name[i:i + 1] == '#':
        base += 1
        i += 1
    elif name[i:i + 1] == 'b':
        base -= 1
        i += 1
    octave = int(name[i:])
    midi = 12 * (octave + 1) + base
    return 440.0 * 2 ** ((midi - 69) / 12)


def chord(*names):
    return [note(n) for n in names]


def tarr(dur):
    return np.arange(int(dur * SR)) / SR


def envelope(n, attack, release, curve=1.6):
    e = np.ones(n)
    ia = min(n, int(attack * SR))
    ir = min(n, int(release * SR))
    if ia > 0:
        e[:ia] = np.linspace(0, 1, ia) ** curve
    if ir > 0:
        e[n - ir:] *= np.linspace(1, 0, ir) ** curve
    return e


def to_stereo(sig, pan=0.0):
    if sig.ndim == 2:
        return sig
    a = (pan + 1) * np.pi / 4
    return np.stack([sig * np.cos(a), sig * np.sin(a)])


def place(sig, t0, gain=1.0, pan=0.0, send=0.35):
    s = to_stereo(sig, pan) * gain
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    j0 = max(0, -i0)
    i0 = max(0, i0)
    n = min(s.shape[1] - j0, N - i0)
    if n <= 0:
        return
    DRY[:, i0:i0 + n] += s[:, j0:j0 + n]
    SEND[:, i0:i0 + n] += s[:, j0:j0 + n] * send


def filt_noise(dur, lo, hi, seed=None):
    """随时间变化的带通噪声。lo / hi 可为常数或 f(u)（u 为 0–1 的进度）"""
    g = np.random.default_rng(seed) if seed is not None else rng
    n = int(dur * SR)
    B, hop = 2048, 1024
    x = g.standard_normal(n + B)
    out = np.zeros(n + B)
    win = np.hanning(B)
    freqs = np.fft.rfftfreq(B, 1 / SR)
    for s in range(0, n, hop):
        u = s / max(n, 1)
        l = lo(u) if callable(lo) else lo
        h = hi(u) if callable(hi) else hi
        mask = np.clip((freqs - l) / (l * 0.35 + 20), 0, 1) * np.clip((h - freqs) / (h * 0.35 + 20), 0, 1)
        out[s:s + B] += np.fft.irfft(np.fft.rfft(x[s:s + B] * win) * mask, B)
    out = out[:n]
    return out / (np.std(out) + 1e-9)


# ─── 乐器 ────────────────────────────────────────────────────
def ah_formant(f):
    """"啊"元音的共振峰权重，让加法合成听起来更像合唱"""
    return 0.25 + np.exp(-((f - 750) / 220) ** 2) + 0.7 * np.exp(-((f - 1150) / 260) ** 2) + 0.3 * np.exp(-((f - 2800) / 420) ** 2)


def pad(freqs, dur, attack=2.0, release=2.5, bright=0.4, voices=3, detune=9, H=10, vib=0.003, formant=False, width=0.7):
    """弦乐 / 合唱式铺底：多声部失谐的加法合成"""
    t = tarr(dur)
    n = len(t)
    out = np.zeros((2, n))
    for f in freqs:
        for v in range(voices):
            k = (v - (voices - 1) / 2) / max((voices - 1) / 2, 1)
            fv = f * 2 ** (k * detune / 1200)
            rate = 4.2 + rng.random() * 1.2
            ph = 2 * np.pi * np.cumsum(fv * (1 + vib * np.sin(2 * np.pi * rate * t + rng.random() * 6.28))) / SR
            sig = np.zeros(n)
            for h in range(1, H + 1):
                fh = fv * h
                if fh > 9500:
                    break
                a = h ** -(1.0 + (1 - bright) * 1.5)
                if formant:
                    a *= ah_formant(fh)
                sig += a * np.sin(h * ph + rng.random() * 6.28)
            out += to_stereo(sig, k * width)
    out *= envelope(n, attack, release)
    return out * 0.22 / np.sqrt(len(freqs) * voices)


def lead(melody, t0, gain=0.5, octave_up=False, send=0.5, pan=0.0):
    """主旋律：独唱般的合唱音色，音符之间连奏"""
    t = t0
    for name, d in melody:
        f = note(name) * (2 if octave_up else 1)
        s = pad([f], d + 0.5, attack=0.18, release=0.55, bright=0.55, voices=2, detune=5, H=12, vib=0.006, formant=True, width=0.2)
        place(s, t, gain=gain, pan=pan, send=send)
        t += d


def bell(f, dur=4.0):
    t = tarr(dur)
    partials = [(1, 1.0, 1.0), (2.0, 0.5, 1.7), (2.76, 0.38, 2.3), (4.07, 0.22, 3.1), (5.4, 0.14, 4.2), (8.93, 0.07, 6.0)]
    k = 3.2 / dur
    s = sum(a * np.sin(2 * np.pi * f * r * t + rng.random() * 6.28) * np.exp(-t * d * k) for r, a, d in partials)
    return s * np.minimum(1, t / 0.002) * 0.3


def pluck(f, dur=2.5):
    """竖琴拨弦"""
    t = tarr(dur)
    s = np.zeros(len(t))
    for h in range(1, 9):
        if f * h > 10000:
            break
        s += h ** -1.3 * np.sin(2 * np.pi * f * h * t + rng.random() * 6.28) * np.exp(-t * (1.6 + h * 0.9))
    return s * np.minimum(1, t / 0.003) * 0.3


def drone(f, dur, attack=3.0, release=3.0):
    t = tarr(dur)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t + 1.0) + 0.1 * np.sin(6 * np.pi * f * t)
    s *= 1 + 0.08 * np.sin(2 * np.pi * 0.13 * t)
    return s * envelope(len(t), attack, release) * 0.3


def taiko(size=1.0, dur=2.2):
    t = tarr(dur)
    f = 40 + 115 * np.exp(-t * 22 / size)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5 / size)
    skin = filt_noise(dur, 80, 1400) * np.exp(-t * 30)
    return np.tanh(1.6 * (body + 0.3 * skin)) * 0.8


def heartbeat(gain=1.0):
    """"扑通、扑通"两下低频"""
    def thump(amp):
        t = tarr(0.5)
        f = 45 + 45 * np.exp(-t * 18)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) * amp
    s = np.zeros(int(0.8 * SR))
    a = thump(1.0)
    b = thump(0.65)
    s[:len(a)] += a
    o = int(0.28 * SR)
    s[o:o + len(b)] += b
    return s * gain


def boom(dur=6.0):
    """史诗重击：次低频下潜 + 低频冲击 + 镲的余响"""
    t = tarr(dur)
    f = 26 + 64 * np.exp(-t * 3.2)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 0.85)
    body = filt_noise(dur, 40, 500) * np.exp(-t * 3.2) * 0.5
    crashL = filt_noise(dur, 3500, 15000) * np.exp(-t * 1.5) * 0.22
    crashR = filt_noise(dur, 3500, 15000) * np.exp(-t * 1.5) * 0.22
    mono = np.tanh(1.3 * (sub + body))
    return np.stack([mono + crashL, mono + crashR])


def reverse_swell(dur=1.6):
    """反向镲：越来越响，直到重击的瞬间"""
    t = tarr(dur)
    s = filt_noise(dur, 2500, 14000) * (t / dur) ** 3
    return s * 0.35


def riser(dur=4.0):
    t = tarr(dur)
    noise = filt_noise(dur, lambda x: 300 + 3000 * x, lambda x: 900 + 9000 * x) * (t / dur) ** 2 * 0.28
    f = 180 * 2 ** (2.5 * t / dur)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / dur) ** 2 * 0.08
    return noise + tone


def whoosh(dur=1.6, pan_from=-0.8, pan_to=0.8):
    t = tarr(dur)
    center = lambda x: 300 + 3500 * np.sin(np.pi * x)
    s = filt_noise(dur, lambda x: center(x) * 0.5, lambda x: center(x) * 2.0) * np.sin(np.pi * t / dur) ** 2 * 0.35
    pans = np.linspace(pan_from, pan_to, len(t))
    a = (pans + 1) * np.pi / 4
    return np.stack([s * np.cos(a), s * np.sin(a)])


def tick(freq=2600):
    t = tarr(0.05)
    return (np.sin(2 * np.pi * freq * t) * np.exp(-t * 300) + 0.5 * filt_noise(0.05, 2000, 9000) * np.exp(-t * 500)) * 0.25


def glass(dur=1.2, count=45):
    t = tarr(dur)
    s = np.zeros(len(t))
    for _ in range(count):
        st = int(rng.random() * 0.45 * SR)
        f = 2200 + rng.random() * 5500
        d = 12 + rng.random() * 40
        seg = t[:len(t) - st]
        s[st:] += np.sin(2 * np.pi * f * seg) * np.exp(-seg * d) * (0.3 + rng.random() * 0.7)
    s += filt_noise(dur, 4000, 16000) * np.exp(-t * 6) * 0.5
    return s * 0.12


def braam(freqs, dur=3.0):
    """低音铜管式的"轰"：明亮层快速衰减 + 暗色持续层，再过饱和"""
    bright = pad(freqs, dur, attack=0.03, release=1.2, bright=1.0, voices=3, detune=14, H=16, width=0.5)
    dark = pad(freqs, dur, attack=0.05, release=1.5, bright=0.2, voices=2, detune=8, H=8, width=0.3)
    t = tarr(dur)
    mix = bright * np.exp(-t * 1.8) + dark
    return np.tanh(mix * 6) * 0.35


def rumble(dur, attack=1.0, release=0.5):
    t = tarr(dur)
    return filt_noise(dur, 20, 140) * envelope(len(t), attack, release) * 0.35


# ─── 编曲 ────────────────────────────────────────────────────
Dm_low = chord('D2', 'A2', 'D3', 'F3', 'A3')
THEME = [('A4', 0.9), ('D5', 0.9), ('C5', 0.6), ('A4', 0.6), ('G4', 1.0), ('A4', 2.2)]
MINOR_PENTA = ['D5', 'F5', 'G5', 'A5', 'C6', 'D6']


def section_arceus():
    burst = at('arceus', 440)
    egg = at('arceus', 205)
    crack = at('arceus', 388)
    white = at('arceus', 752)
    end = at('arceus', 785)

    # 混沌：低音持续 + 暗色铺底 + 零星钟声
    place(drone(note('D2'), burst - 0.1, attack=3, release=0.15), 0, gain=0.9, send=0.2)
    place(pad(chord('D3', 'A3', 'D4', 'F4'), burst - 0.1, attack=4, release=0.2, bright=0.15), 0, gain=0.9)
    for i, tt in enumerate(np.arange(1.2, burst - 1.5, 1.35)):
        place(bell(note(MINOR_PENTA[int(rng.random() * len(MINOR_PENTA))]), 3.5), tt + rng.random() * 0.3, gain=0.18, pan=rng.random() * 1.4 - 0.7, send=0.7)
    # 开场穿越
    place(whoosh(3.4, -0.2, 0.2), 0.0, gain=0.9, send=0.3)
    place(rumble(3.5, attack=0.3, release=1.5), 0.0, gain=0.8)
    # 光蛋的心跳：先平缓（与画面光环同步，每 1.2 秒一次），裂纹后加快
    tt = egg + 0.3
    while tt < burst - 0.35:
        interval = 1.2 if tt < crack else max(0.42, 1.2 - (tt - crack) / (burst - crack) * 0.9)
        place(heartbeat(0.9), tt, send=0.15)
        tt += interval
    # 坠落时和弦下沉到 Bb，张力上升
    place(pad(chord('Bb2', 'F3', 'Bb3', 'D4'), burst - at('arceus', 345), attack=1.0, release=0.1, bright=0.35), at('arceus', 345), gain=0.8)
    place(riser(burst - (burst - 4.2)), burst - 4.2, gain=1.0, send=0.25)
    place(reverse_swell(1.4), burst - 1.4, gain=1.0, send=0.2)

    # 破壳：重击 + 太鼓 + 合唱齐奏
    place(boom(6.5), burst, gain=1.0, send=0.35)
    place(taiko(1.4), burst, gain=0.9, send=0.3)
    prog = [(chord('D3', 'A3', 'D4', 'F4', 'A4'), 3.9), (chord('Bb2', 'F3', 'Bb3', 'D4', 'F4'), 3.0), (chord('F2', 'C3', 'F3', 'A3', 'C4'), 2.5), (chord('C3', 'G3', 'C4', 'E4', 'G4'), 1.8)]
    t = burst
    for c, d in prog:
        place(pad(c, d + 1.8, attack=0.25 if t == burst else 0.8, release=1.6, bright=0.55, formant=True), t, gain=1.1)
        place(pad([f / 2 for f in c[:2]], d + 1.8, attack=0.4, release=1.6, bright=0.3, voices=2), t, gain=0.8)
        t += d
    # 白闪前升上 A 大调（属和弦），为下一段的 D 大调做解决
    place(pad(chord('A2', 'E3', 'A3', 'C#4', 'E4'), end - t + 0.4, attack=1.0, release=0.4, bright=0.6, formant=True), t, gain=1.1)
    # 主旋律（显形仰摇时进入）
    lead(THEME, at('arceus', 505), gain=0.55)
    for tt in [burst + 3.9, burst + 6.9]:
        place(taiko(1.0), tt, gain=0.45)
    place(bell(note('A5'), 5), at('arceus', 583), gain=0.3, send=0.7)
    # 结尾推进光中
    place(riser(end - white + 0.6), white - 0.6, gain=0.9)
    place(reverse_swell(end - white + 0.3), white - 0.3, gain=0.8)


def section_twins():
    s = lambda f: at('twins', f)
    start = s(0)
    # 白光中落地：D 大调明亮和弦
    place(pad(chord('D3', 'A3', 'D4', 'F#4', 'A4'), 5.0, attack=0.05, release=3.0, bright=0.6, formant=True), start, gain=1.0)
    place(boom(4.0), start, gain=0.35)
    # 两团光分开：钟声分别从左右滑过
    for i, (nm, pan) in enumerate([('D5', -0.7), ('A5', -0.8), ('F5', 0.7), ('C6', 0.8)]):
        place(bell(note(nm), 3.0), s(55) + i * 0.25, gain=0.25, pan=pan, send=0.6)
    place(whoosh(1.8, 0.3, -0.9), s(86), gain=1.0)  # 甩向左边
    # 帝牙卢卡
    place(taiko(0.9), s(142), gain=0.6)
    place(bell(note('D5'), 4), s(142), gain=0.35, pan=-0.3, send=0.6)
    place(pad(chord('D2', 'A2', 'D3', 'F3', 'A3'), s(275) - s(142) + 1, attack=0.6, release=1.0, bright=0.35), s(142), gain=0.9)
    # 时钟滴答（每 0.75 秒，80 BPM）
    for tt in np.arange(s(170), s(598), 0.75):
        place(tick(2600 if int((tt - s(170)) / 0.75) % 2 == 0 else 2100), tt, gain=0.9, pan=-0.35, send=0.25)
    # 时间长河：推进的弦乐律动（八分音符，80 BPM）
    beat = 0.375
    river_chords = [(s(275), chord('D3', 'A3', 'D4')), (s(275) + 3.0, chord('Bb2', 'F3', 'Bb3')), (s(275) + 6.0, chord('C3', 'G3', 'C4')), (s(412), chord('F2', 'C3', 'F3'))]
    for i, (tt, c) in enumerate(river_chords):
        nxt = river_chords[i + 1][0] if i + 1 < len(river_chords) else s(598)
        place(pad(c, nxt - tt + 1.0, attack=0.5, release=1.0, bright=0.45), tt, gain=0.8)
        k = 0
        for bt in np.arange(tt, nxt, beat):
            f = c[k % len(c)] * (2 if k % 4 == 3 else 1)
            place(pluck(f, 0.8), bt, gain=0.55, pan=-0.2 + 0.4 * (k % 2), send=0.25)
            k += 1
        for bt in np.arange(tt, nxt, beat * 4):
            place(taiko(0.7), bt, gain=0.3)
    place(whoosh(1.2, -0.4, 0.95), s(410), gain=1.0)  # 快速甩向右边
    # 帕路奇亚
    place(taiko(0.9), s(434), gain=0.6)
    place(bell(note('A5'), 4), s(434), gain=0.35, pan=0.3, send=0.6)
    place(pad(chord('G2', 'D3', 'G3', 'Bb3'), s(566) - s(434), attack=1.0, release=0.4, bright=0.4), s(434), gain=0.8)
    place(pad(chord('A2', 'E3', 'A3', 'C#4'), s(598) - s(566) + 0.1, attack=0.3, release=0.1, bright=0.6), s(566), gain=0.9)
    # 裂纹：玻璃咯吱声 + 上升
    for i in range(10):
        place(glass(0.5, 4), s(566) + i * 0.1 + rng.random() * 0.05, gain=0.5, pan=0.4, send=0.5)
    place(riser(3.0), s(598) - 3.0, gain=1.0)
    place(reverse_swell(1.2), s(598) - 1.2, gain=0.9)
    # 屏障碎裂：重击 + 玻璃碎裂，随后展开宽广的和弦
    hit = s(598)
    place(boom(6.0), hit, gain=1.0)
    place(glass(1.6, 60), hit, gain=1.3, pan=0.3, send=0.6)
    place(taiko(1.4), hit, gain=0.9)
    t = hit
    for c, d in [(chord('Bb2', 'F3', 'Bb3', 'D4', 'F4'), 2.2), (chord('F2', 'C3', 'F3', 'A3', 'C4'), 2.0), (chord('D3', 'A3', 'D4', 'F4', 'A4'), s(810) - hit - 4.2)]:
        place(pad(c, d + 1.5, attack=0.2 if t == hit else 0.7, release=1.5, bright=0.55, formant=True, width=0.9), t, gain=1.0)
        t += d
    lead([('D5', 0.9), ('F5', 0.9), ('E5', 0.6), ('D5', 0.6), ('A4', 1.6)], hit + 1.2, gain=0.45)
    # 双神化作光散去：留下一个高音长音接下一段
    place(pad(chord('D5', 'A5'), 5.0, attack=1.5, release=2.5, bright=0.3, voices=2), s(760), gain=0.5, send=0.7)


def section_giratina():
    s = lambda f: at('giratina', f)
    # 世界翻转：反向镲 + 呼啸，和声下滑
    place(reverse_swell(s(140) - s(50)), s(50), gain=0.9)
    place(whoosh(s(140) - s(40), -0.9, 0.9), s(40), gain=1.2)
    place(boom(4.0), s(140), gain=0.5)
    # 毁坏的世界：不协和的暗色长音
    dark_end = s(425)
    place(drone(note('D1') * 2, dark_end - s(130), attack=2.0, release=1.0), s(130), gain=1.0, send=0.2)
    place(pad(chord('D3', 'Eb3', 'Ab3'), dark_end - s(130), attack=2.5, release=1.0, bright=0.25, detune=18), s(130), gain=0.9)
    place(pad(chord('D5', 'G#5'), dark_end - s(150), attack=3.0, release=1.0, bright=0.1, voices=2, vib=0.01), s(150), gain=0.35, send=0.8)
    place(rumble(dark_end - s(130), attack=2.0, release=1.0), s(130), gain=0.6)
    # 别种形态显形
    place(boom(4.0), s(198), gain=0.55)
    place(braam(chord('D2', 'A2', 'D3')), s(198), gain=0.7)
    for tt in np.arange(s(260), dark_end - 0.5, 2.4):
        place(taiko(1.2), tt, gain=0.45)
    # 强光照：明亮的 D 大调升起
    place(pad(chord('D4', 'F#4', 'A4', 'D5', 'F#5'), s(455) - s(405) + 0.6, attack=1.2, release=0.3, bright=0.7, formant=True), s(405), gain=1.0)
    place(riser(s(455) - s(405)), s(405), gain=0.9)
    place(bell(note('D6'), 3), s(455) - 0.1, gain=0.4, send=0.8)
    # 暗影生：骤然下沉，反向镲引向起源形态
    place(pad(chord('D2', 'Eb2', 'A2'), s(505) - s(455) + 0.2, attack=0.1, release=0.2, bright=0.2, detune=20), s(455), gain=1.0)
    place(reverse_swell(s(505) - s(470)), s(470), gain=0.9)
    # 起源形态：低音铜管重击
    hit = s(505)
    place(boom(6.0), hit, gain=0.95)
    place(taiko(1.4), hit, gain=0.8)
    place(braam(chord('D2', 'A2', 'Eb3'), 3.5), hit, gain=1.0)
    place(braam(chord('Bb1', 'F2', 'Bb2'), 3.0), hit + 1.8, gain=0.8)
    place(pad(chord('D3', 'F3', 'Ab3', 'D4'), s(596) - hit + 0.5, attack=0.4, release=0.5, bright=0.35, formant=True), hit, gain=0.9)
    # 暗影吞没：隆隆声涌起，最后静音
    place(rumble(s(642) - s(590), attack=1.3, release=0.2), s(590), gain=1.3)
    place(pad(chord('D1', 'D2'), s(642) - s(590), attack=1.2, release=0.25, bright=0.5, voices=3, detune=25), s(590), gain=1.0)


def section_lake():
    s = lambda f: at('lake', f)
    # 晨雾中的湖：D 大调，从寂静中浮现
    place(pad(chord('D3', 'A3', 'E4', 'F#4'), s(160), attack=3.0, release=1.5, bright=0.35), s(0), gain=0.8)
    # 三团光降临
    for i, (nm, pan) in enumerate([('A5', -0.7), ('F#5', 0.0), ('D5', 0.7)]):
        for j, step in enumerate([0, 0.18, 0.36]):
            f = note(nm) * 2 ** (-j * 2 / 12)
            place(bell(f, 3.0), s(50) + i * 0.3 + step, gain=0.18, pan=pan, send=0.7)
    # 三神依次登场：每只一个钟声主题，底下的和弦 D → Bm → G → A
    gods = [(150, 'A5', 'D', -0.5), (360, 'F#5', 'Bm', 0.0), (570, 'D5', 'G', 0.5)]
    harmony = {
        'D': chord('D3', 'A3', 'D4', 'F#4'),
        'Bm': chord('B2', 'F#3', 'B3', 'D4'),
        'G': chord('G2', 'D3', 'G3', 'B3'),
        'A': chord('A2', 'E3', 'A3', 'C#4'),
    }
    arps = {'D': ['D4', 'F#4', 'A4', 'D5', 'A4', 'F#4'], 'Bm': ['B3', 'D4', 'F#4', 'B4', 'F#4', 'D4'], 'G': ['G3', 'B3', 'D4', 'G4', 'D4', 'B3'], 'A': ['A3', 'C#4', 'E4', 'A4', 'E4', 'C#4']}
    spans = [(s(150), s(360), 'D'), (s(360), s(570), 'Bm'), (s(570), s(795), 'G'), (s(795), s(885), 'A')]
    for f0, nm, key, pan in gods:
        place(bell(note(nm), 5), s(f0), gain=0.4, pan=pan, send=0.7)
        place(bell(note(nm) * 1.5, 4), s(f0) + 0.12, gain=0.2, pan=pan, send=0.7)
    for a, b, key in spans:
        place(pad(harmony[key], b - a + 1.5, attack=1.2, release=1.5, bright=0.35, formant=True), a, gain=0.75)
        for k, bt in enumerate(np.arange(a, b, 0.5)):
            place(pluck(note(arps[key][k % 6]), 2.2), bt, gain=0.45, pan=-0.3 + 0.6 * ((k % 6) / 5), send=0.45)
    # 光柱落水：竖琴下行刮奏 + 低沉水声
    for k, nm in enumerate(['A5', 'E5', 'C#5', 'A4', 'E4', 'C#4', 'A3']):
        place(pluck(note(nm), 2.5), s(795) + k * 0.07, gain=0.45, send=0.6)
    place(boom(3.5), s(803), gain=0.3)
    # 物质诞生：温暖的低音和弦（时空双神）
    place(pad(chord('G2', 'D3', 'G3', 'B3', 'D4'), s(990) - s(885) + 1.0, attack=1.5, release=1.2, bright=0.4, formant=True), s(885), gain=0.95)
    place(drone(note('G1') * 2, s(990) - s(885) + 1.0, attack=1.5, release=1.0), s(885), gain=0.6)
    # 心灵诞生：琶音上行渐强，汇成明亮的合唱
    rise = ['A3', 'C#4', 'E4', 'A4', 'C#5', 'E5', 'A5', 'C#6']
    span = s(1060) - s(990)
    for k in range(24):
        tt = s(990) + span * (1 - (1 - k / 24) ** 1.6)
        place(pluck(note(rise[k % 8]) * (2 if k >= 16 else 1), 1.8), tt, gain=0.3 + 0.3 * k / 24, pan=-0.5 + (k % 3) * 0.5, send=0.5)
    place(pad(chord('A2', 'E3', 'A3', 'C#4', 'E4'), span + 0.3, attack=2.0, release=0.3, bright=0.5, formant=True), s(990), gain=0.9)
    place(riser(span), s(990), gain=0.8)
    bloom = s(1060)
    place(pad(chord('D3', 'A3', 'D4', 'F#4', 'A4', 'D5'), s(1150) - bloom + 1.5, attack=0.15, release=2.0, bright=0.65, formant=True, width=0.9), bloom, gain=1.1)
    for k, nm in enumerate(['D6', 'A5', 'F#5', 'D5']):
        place(bell(note(nm), 5), bloom + k * 0.09, gain=0.28, pan=-0.4 + k * 0.25, send=0.8)
    place(boom(4.0), bloom, gain=0.35)
    lead([('F#5', 0.9), ('A5', 0.9), ('G5', 0.6), ('F#5', 0.6), ('D5', 2.0)], bloom + 0.4, gain=0.4)
    # 天顶的星：高音长音延续到尾声
    place(pad(chord('A5', 'D6'), 6.0, attack=1.0, release=3.0, bright=0.2, voices=2), s(1110), gain=0.45, send=0.8)


def section_ending():
    s = lambda f: at('ending', f)
    # 沉睡：主旋律安静再现，渐弱到无声
    quiet_end = s(212)
    place(pad(chord('D3', 'A3', 'D4', 'F4'), quiet_end - s(0), attack=1.5, release=3.0, bright=0.3, formant=True), s(0), gain=0.75)
    place(drone(note('D2'), quiet_end - s(0), attack=1.5, release=3.0), s(0), gain=0.6)
    lead(THEME, s(40), gain=0.4)
    place(bell(note('D5'), 5), s(150), gain=0.25, send=0.8)
    # 预告：太鼓与低音铜管对准每一刀
    g, k, c = s(232), s(276), s(336)
    place(taiko(1.4), g, gain=1.0)
    place(braam(chord('D2', 'A2', 'D3'), 1.6), g, gain=1.0)
    place(boom(2.0), g, gain=0.55)
    # 火：低沉的火焰轰鸣 + 噼啪声
    fire_d = k - g
    place(filt_noise(fire_d, 80, 900) * envelope(int(fire_d * SR), 0.05, 0.1) * 0.12, g, gain=1.0)
    for _ in range(26):
        place(filt_noise(0.03, 1500, 9000) * np.exp(-tarr(0.03) * 120) * 0.25, g + rng.random() * fire_d, pan=rng.random() * 1.6 - 0.8, send=0.2)
    place(taiko(1.4), k, gain=1.0)
    place(braam(chord('Bb1', 'F2', 'Bb2'), 1.6), k, gain=1.0)
    place(boom(2.0), k, gain=0.55)
    # 水：暴雨声
    rain_d = c - k
    place(np.stack([filt_noise(rain_d, 1800, 11000), filt_noise(rain_d, 1800, 11000)]) * envelope(int(rain_d * SR), 0.05, 0.1) * 0.1, k, gain=1.0, send=0.3)
    # 碰撞前的太鼓连击 + 上升
    for i, tt in enumerate(np.arange(c - 1.2, c - 0.05, 0.15)):
        place(taiko(0.6), tt, gain=0.35 + 0.4 * i / 8)
    place(riser(1.8), c - 1.8, gain=1.0)
    place(reverse_swell(0.9), c - 0.9, gain=0.9)
    # 分屏碰撞：最强一击
    place(boom(5.0), c, gain=1.1)
    place(taiko(1.6), c, gain=1.0)
    place(braam(chord('D1', 'A1', 'D2', 'Eb2'), 2.5), c, gain=1.1)
    # 标题卡：收尾长音
    t_title = s(356)
    place(taiko(1.8), t_title, gain=0.7)
    place(bell(note('D5'), 5.5), t_title, gain=0.4, send=0.8)
    place(pad(chord('D3', 'A3', 'D4', 'F4', 'A4'), s(430) - t_title, attack=0.1, release=2.5, bright=0.5, formant=True), t_title, gain=0.8)


# ─── 混响与母带 ──────────────────────────────────────────────
def reverb(send, sec=3.4):
    n = int(sec * SR)
    t = np.arange(n) / SR
    pre = int(0.022 * SR)
    out = np.zeros_like(send)
    nf = 1 << int(np.ceil(np.log2(send.shape[1] + n)))
    freqs = np.fft.rfftfreq(nf, 1 / SR)
    damp = 1 / (1 + (freqs / 5500) ** 2)
    for ch in range(2):
        ir = np.zeros(n + pre)
        ir[pre:] = np.random.default_rng(100 + ch).standard_normal(n) * np.exp(-6.9 * t / sec)
        ir /= np.sqrt(np.sum(ir ** 2))
        spec = np.fft.rfft(send[ch], nf) * np.fft.rfft(ir, nf) * damp
        out[ch] = np.fft.irfft(spec, nf)[:send.shape[1]]
    return out


def write_wav(path, stereo):
    x = np.clip(stereo, -1, 1)
    ints = (x.T * (2 ** 23 - 1)).astype('<i4')
    raw = ints.reshape(-1, 1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(raw)


def main():
    for name, fn in [('阿尔宙斯', section_arceus), ('时空双神', section_twins), ('骑拉帝纳', section_giratina), ('心之三神', section_lake), ('尾声', section_ending)]:
        fn()
        print('已编排：', name)
    wet = reverb(SEND)
    mix = DRY + wet * 0.55
    # "抽空"：最大的几次重击前约 0.1 秒整体骤然收声，再全力砸下，冲击感更强
    for hit in [at('arceus', 440), at('twins', 598), at('ending', 336)]:
        i0, i1, i2 = int((hit - 0.14) * SR), int((hit - 0.03) * SR), int(hit * SR)
        mix[:, i0:i1] *= np.linspace(1, 0.08, i1 - i0)
        mix[:, i1:i2] *= 0.08
    # 母带：柔和压缩 + 峰值 -1 dBFS
    peak = np.percentile(np.abs(mix), 99.97)
    mix = np.tanh(mix / peak * 0.95) / np.tanh(0.95)
    mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
    # 首尾淡入淡出，防止爆音
    fade = int(0.02 * SR)
    mix[:, :fade] *= np.linspace(0, 1, fade)
    tail = int(0.4 * SR)
    mix[:, -tail:] *= np.linspace(1, 0, tail)
    os.makedirs('out', exist_ok=True)
    path = os.path.join('out', 'ep01-score.wav')
    write_wav(path, mix)
    rms = 20 * np.log10(np.sqrt(np.mean(mix ** 2)) + 1e-12)
    print(f'已导出 {path}：{TOTAL:.2f} 秒，平均电平 {rms:.1f} dBFS')


if __name__ == '__main__':
    main()
