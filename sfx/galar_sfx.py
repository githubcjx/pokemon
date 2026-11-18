"""
《剑与盾》（代码短名 galar）音效轨。本期没有旁白配音，只有音效（用户 2026-10-13）。
不是配乐：没有旋律，只有石厅的空间声和玻璃、光的动作音效。全部用 numpy 合成，不用外部素材。
时间轴 = 整期总时间轴（0 秒 = 第 1 段第一帧），帧号取自 src/scenes/galar/common.ts 的 T。

整体柔和、克制（CLAUDE.md）：
  · 石厅：很低的空间底噪；
  · 光：光带移动时一阵极轻的空气声；每一格窗"醒来"时敲一下玻璃——同一个音，代表"光来了"；
  · 玻璃的声音用敲击玻璃的非谐和泛音（1 : 2.32 : 4.25 : 6.63 : 9.38），软槌起音，没有碎裂声；
  · 最后整体过 6 kHz 柔和低通，不留刺耳的高频。

输出（out/剑与盾/）：galar-sfx.wav（已做完的整段），sfx/galar-<段名>-sfx.wav，sfx/galar-part1-sfx.wav
用法：python sfx/galar_sfx.py
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
FPS = 30

# 整期总时间轴的关键帧（与 src/scenes/galar/common.ts 一致）
T = dict(opening=0, title=390, pictures=510, p1=640, p2=820, p3=980, p4=1130, summary=1250, doubt=1330, end3=1590,
		 reveal=1590, impact=1632, relead=1676, zacian=1846, zamazenta=1902, darkest=2110, eterRelead=2170, eternatus=2292,
		 vortex=2540, crack2=2640, eternamax=2726, clash=2810, blaze=2920, floor=3000, burst=3120, mend=3200,
		 readings=3330, ending=3820, end=4120)
_SEG = ['opening', 'pictures', 'doubt', 'reveal', 'darkest', 'clash', 'readings', 'ending']
SEGMENTS = [(n, T[n], T[_SEG[i + 1]] if i + 1 < len(_SEG) else T['end']) for i, n in enumerate(_SEG)]
PARTS = [('part1', T['opening'], T['reveal']), ('part2', T['reveal'], T['readings']), ('part3', T['readings'], T['end'])]
# 尖拱窗中心 x（米），用来给声音定位
CX = [-1.95, -0.65, 0.65, 1.95]

TOTAL = T['end'] / FPS + 0.5
N = int(TOTAL * SR)
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(20261013)


def ts(frame: float) -> float:
	return frame / FPS


def noise(n):
	return rng.standard_normal(n)


def spectral(x, mag):
	X = np.fft.rfft(x)
	f = np.fft.rfftfreq(len(x), 1 / SR)
	return np.fft.irfft(X * mag(f), n=len(x))


def band(x, lo, hi, soft=0.35):
	def mag(f):
		lf = np.log2(np.maximum(f, 1.0))
		a = 1 / (1 + np.exp(-(lf - np.log2(max(lo, 1))) / soft)) if lo > 0 else 1.0
		b = 1 / (1 + np.exp((lf - np.log2(hi)) / soft))
		return a * b

	return spectral(x, mag)


def brown(n):
	return spectral(noise(n), lambda f: 1 / np.maximum(f, 20.0))


def norm(x):
	p = np.max(np.abs(x))
	return x / p if p > 0 else x


def env(t, pts):
	xs, ys = zip(*pts)
	return np.interp(t, xs, ys)


def wobble(n, rate=0.3, depth=0.4):
	t = np.arange(n) / SR
	w = sum(np.sin(2 * np.pi * rate * k * t + rng.uniform(0, 6.28)) / k for k in (1, 1.7, 2.9))
	return 1 + depth * w / 1.9


def add(start, sig, gain=1.0, pan=0.0):
	i0 = int(start * SR)
	if i0 >= N:
		return
	if i0 < 0:
		sig = sig[-i0:]
		i0 = 0
	n = min(len(sig), N - i0)
	sig = sig[:n] * gain
	th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
	L[i0 : i0 + n] += sig * np.cos(th)
	R[i0 : i0 + n] += sig * np.sin(th)


def reverb(x, rt=2.8, wet=0.35):
	"""石厅的长混响：指数衰减的噪声脉冲响应（卷积，FFT）。"""
	n = int(rt * SR)
	t = np.arange(n) / SR
	ir = band(noise(n), 80, 5000) * np.exp(-t * 6.9 / rt)
	ir /= np.sqrt(np.sum(ir ** 2))
	m = len(x) + n
	y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]
	return x * (1 - wet) + y * wet * 2.2


# ─── 音源 ────────────────────────────────────────────────────────────
def hall(start, end, gain=0.05):
	"""石厅的空间底噪：低频为主，缓慢起伏"""
	n = int((end - start) * SR)
	sig = norm(band(brown(n), 30, 260)) * wobble(n, 0.07, 0.25) + norm(band(noise(n), 200, 900)) * 0.12 * wobble(n, 0.11, 0.4)
	add(start, sig, gain)


def glass(start, f0=330.0, gain=0.14, pan=0.0, tau=2.4):
	"""敲一下玻璃：非谐和泛音、软槌起音（4 ms），高泛音衰减得更快。"""
	n = int((tau * 2.5) * SR)
	t = np.arange(n) / SR
	ratios = [1, 2.32, 4.25, 6.63, 9.38]
	amps = [1.0, 0.55, 0.3, 0.16, 0.08]
	sig = np.zeros(n)
	for r, a in zip(ratios, amps):
		f = f0 * r * (1 + rng.uniform(-0.002, 0.002))
		if f > 5500:
			continue
		sig += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / (tau / r ** 0.7))
	sig *= np.minimum(t / 0.004, 1)
	add(start, reverb(norm(sig), 3.2, 0.45), gain, pan)


def light_air(start, dur, gain=0.06, pan0=0.0, pan1=0.0, lo=180, hi=1100):
	"""光移动时的空气声：一阵极轻的气流，钟形包络"""
	n = int(dur * SR)
	t = np.arange(n) / SR / dur
	sig = norm(band(noise(n), lo, hi)) * np.sin(np.pi * t) ** 2 * wobble(n, 0.6, 0.3)
	pan = pan0 + (pan1 - pan0) * t
	i0 = int(start * SR)
	m = min(n, N - i0)
	th = (np.clip(pan[:m], -1, 1) + 1) * np.pi / 4
	L[i0 : i0 + m] += sig[:m] * gain * np.cos(th)
	R[i0 : i0 + m] += sig[:m] * gain * np.sin(th)


def swell(start, dur, gain=0.12, lo=35, hi=600, peak=0.8):
	n = int(dur * SR)
	t = np.arange(n) / SR / dur
	sig = norm(band(brown(n), lo, hi)) * wobble(n, 0.5, 0.2)
	shape = np.where(t < peak, (t / peak) ** 2, np.cos(np.pi / 2 * (t - peak) / (1 - peak)) ** 2)
	add(start, sig * shape, gain)


def stone_hum(start, dur, f=55.0, gain=0.08):
	"""石头的低沉共鸣：两个略失谐的低音 + 低频噪声，慢起慢落"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	sig = np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 1.503 * t) + 0.5 * norm(band(brown(n), 30, 200))
	shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
	add(start, norm(sig) * shape, gain)


def thump(start, size=1.0, pan=0.0):
	"""低沉的闷响（玻璃被砸裂、爆发）：低频扫频 + 低频拖尾，没有高频碎裂"""
	dur = 2.0 + 2.0 * size
	n = int(dur * SR)
	t = np.arange(n) / SR
	f = 70 * np.exp(-t * 2.0) + 32
	tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(t / 0.008, 1) * np.exp(-t / (0.5 + 0.7 * size))
	body = band(noise(n), 30, 300) * np.minimum(t / 0.01, 1) * np.exp(-t / (0.25 + 0.3 * size))
	tail = band(brown(n), 20, 160) * np.minimum(t / 0.08, 1) * np.exp(-t / (0.9 + 1.2 * size))
	add(start, reverb(norm(tone) + norm(body) * 0.5 + norm(tail) * 0.5 * size, 2.5, 0.3), 0.55 * size ** 0.9, pan)


def creak(start, dur=0.5, gain=0.04, pan=0.0, f0=140.0):
	"""铅条被拨动的吱嘎声：低频的黏滑摩擦（一串不规则的小脉冲过共振）"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	rate = f0 * (1 + 0.3 * np.sin(2 * np.pi * 2.3 * t + rng.uniform(0, 6)))
	ph = np.cumsum(rate) / SR
	pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float) * rng.uniform(0.4, 1.0, n)
	sig = band(pulses, 120, 1400) * np.sin(np.pi * t / dur) ** 2
	add(start, reverb(norm(sig), 2.0, 0.3), gain, pan)


def weld(start, gain=0.025, pan=0.0):
	"""焊点：一声很轻的嘶 + 一下小咔哒"""
	n = int(0.35 * SR)
	t = np.arange(n) / SR
	hiss = band(noise(n), 900, 3200) * np.exp(-t / 0.08)
	tick = band(noise(n), 300, 2000) * np.exp(-t / 0.006)
	add(start, norm(hiss) * 0.5 + norm(tick), gain, pan)


def relead(start, dur, pan=0.0, n_welds=14):
	"""重新嵌铅：一段时间里零星的吱嘎和焊点"""
	for k in range(n_welds):
		t0 = start + dur * (k + rng.uniform(0, 0.8)) / n_welds
		weld(t0, 0.02, pan + rng.uniform(-0.15, 0.15))
		if k % 3 == 0:
			creak(t0 + 0.05, rng.uniform(0.3, 0.6), 0.03, pan, rng.uniform(110, 170))


def vortex_drone(start, end, envpts, gain=0.12):
	"""闇夜的旋涡：低沉、缓慢打转的风声（左右来回）"""
	n = int((end - start) * SR)
	t = np.arange(n) / SR
	e = env(start + t, envpts)
	low = norm(band(brown(n), 25, 220)) * wobble(n, 0.18, 0.4)
	swirl = norm(band(noise(n), 120, 700)) * np.clip(wobble(n, 0.35, 0.7), 0.1, None) * 0.35
	pan = np.sin(2 * np.pi * 0.09 * t)
	sig = (low + swirl) * e
	i0 = int(start * SR)
	m = min(n, N - i0)
	th = (pan[:m] * 0.6 + 1) * np.pi / 4
	L[i0 : i0 + m] += sig[:m] * gain * np.cos(th)
	R[i0 : i0 + m] += sig[:m] * gain * np.sin(th)


def far_thunder(start, size=1.0, pan=0.0):
	n = int((3.5 + 1.5 * size) * SR)
	t = np.arange(n) / SR
	sig = norm(band(noise(n), 25, 240) * np.clip(wobble(n, 1.6, 0.7), 0.15, None)) * np.minimum(t / 0.2, 1) * np.exp(-t / (1.3 + 0.7 * size))
	add(start, sig, 0.22 * size, pan)


# ─── 第 1 段：开场 ───────────────────────────────────────────────────
hall(0, TOTAL, 0.05)
swell(ts(0), ts(170), 0.1, 35, 500, peak=0.75)  # 天亮：光一点点来到地上
light_air(ts(150), ts(160), 0.05, 0.0, 0.0, 150, 800)  # 抬头，顺着光束往上
glass(ts(296), 330, 0.1, 0.0)  # 整扇窗出现
stone_hum(ts(T['title'] - 10), ts(140), 55, 0.07)  # 光扫过刻字
glass(ts(T['title'] + 30), 247, 0.07, -0.55, 3.0)
light_air(ts(T['title']), ts(110), 0.04, -0.5, -0.5, 120, 700)

# ─── 第 2 段：四幅画 ─────────────────────────────────────────────────
light_air(ts(T['pictures'] + 40), ts(90), 0.05, 0.0, CX[0] / 3)  # 光收拢到第一幅
glass(ts(T['p1'] - 8), 330, 0.12, CX[0] / 3)
for k, key in enumerate(['p2', 'p3', 'p4']):
	light_air(ts(T[key] - 50), ts(60), 0.05, CX[k] / 3, CX[k + 1] / 3)  # 光带横移到下一格
	glass(ts(T[key] - 8), 330, 0.12, CX[k + 1] / 3)
light_air(ts(T['summary']), ts(80), 0.05, CX[3] / 3, 0.0)  # 光铺满整扇窗
glass(ts(T['summary'] + 50), 330, 0.06, -0.3)
glass(ts(T['summary'] + 56), 330 * 1.002, 0.06, 0.3)

# ─── 第 3 段：疑点 ───────────────────────────────────────────────────
light_air(ts(T['doubt'] + 40), ts(80), 0.05, 0.0, CX[2] / 3)  # 光退回第三幅
glass(ts(T['doubt'] + 108), 247, 0.1, CX[2] / 3, 3.2)  # 低一点的同一种声音：注意这里
swell(ts(T['doubt'] + 140), ts(T['end3'] - T['doubt'] - 140) + 0.4, 0.08, 30, 300, peak=0.95)  # 一点点绷紧，接下一段的裂开


# ─── 第 4 段：裂开 ───────────────────────────────────────────────────
thump(ts(T['impact']), 0.9, CX[2] / 3)  # 遗迹被砸开 = 玻璃裂开：一声闷响
glass(ts(T['impact']) + 0.02, 220, 0.09, CX[2] / 3, 3.5)  # 裂开的玻璃只留一声低低的余音
relead(ts(T['relead']), ts(150), CX[2] / 3, 18)  # 碎片沿铅条重新嵌好
glass(ts(T['relead'] + 150), 330, 0.1, CX[2] / 3)  # 嵌好：光来了
light_air(ts(T['zacian'] - 30), ts(60), 0.035, CX[2] / 3, CX[2] / 3)

# ─── 第 5 段：闇夜 ───────────────────────────────────────────────────
swell(ts(T['darkest']), ts(T['eterRelead'] + 100 - T['darkest']), 0.1, 30, 300, peak=0.9)  # 太阳暗下去
relead(ts(T['eterRelead']), ts(120), 0.0, 14)  # 圆花窗被无极汰那占据
vortex_drone(ts(T['eternatus'] - 60), ts(T['burst'] + 90), [(ts(T['eternatus'] - 60), 0.0), (ts(T['eternatus']), 0.35), (ts(T['vortex']), 0.4), (ts(T['vortex'] + 70), 1.0), (ts(T['burst']), 1.0), (ts(T['burst'] + 90), 0.0)], 0.13)
far_thunder(ts(T['vortex'] + 20), 1.0, -0.4)
far_thunder(ts(T['vortex'] + 70), 0.8, 0.5)
thump(ts(T['crack2']), 0.8, 0.0)  # 花窗再裂
relead(ts(T['crack2'] + 10), ts(70), 0.0, 10)
far_thunder(ts(T['eternamax'] + 30), 0.9, 0.2)

# ─── 第 6 段：爆发 ───────────────────────────────────────────────────
swell(ts(T['clash']), ts(T['blaze'] + 40 - T['clash']), 0.12, 40, 600, peak=0.85)  # 第三幅自己的光亮起来
light_air(ts(T['floor'] + 10), ts(80), 0.05, CX[2] / 3, 0.1, 120, 700)  # 顺着光束低头
thump(ts(T['floor'] + 72), 0.6, -0.2)  # 金光推一拍
thump(ts(T['floor'] + 96), 0.8, 0.2)  # 再推一拍
swell(ts(T['floor'] + 100), ts(T['burst'] - T['floor'] - 100), 0.14, 35, 500, peak=0.98)
thump(ts(T['burst']), 1.6, 0.0)  # 全片最大的爆发点：低沉的轰鸣，比底噪响但不刺耳
glass(ts(T['burst']) + 0.05, 165, 0.08, 0.0, 4.5)
relead(ts(T['mend'] + 10), ts(110), 0.0, 14)  # 圆花窗用铅条修好
glass(ts(T['mend'] + 120), 330, 0.09, 0.0)

# ─── 第 7 段：两种说法 ───────────────────────────────────────────────
light_air(ts(T['readings']), ts(50), 0.04, 0.0, CX[2] / 3)
glass(ts(T['readings'] + 36), 330, 0.08, CX[2] / 3)
light_air(ts(T['readings'] + 150), ts(40), 0.04, CX[2] / 3, CX[3] / 3)
glass(ts(T['readings'] + 178), 330, 0.08, CX[3] / 3)
light_air(ts(T['readings'] + 300), ts(40), 0.04, CX[3] / 3, (CX[2] + CX[3]) / 6)
glass(ts(T['readings'] + 328), 330, 0.07, CX[2] / 3)
glass(ts(T['readings'] + 336), 330 * 1.002, 0.07, CX[3] / 3)

# ─── 第 8 段：尾声 ───────────────────────────────────────────────────
light_air(ts(T['ending'] + 40), ts(160), 0.04, 0.0, 0.0, 120, 600)  # 云遮住太阳
glass(ts(T['ending'] + 175), 196, 0.08, CX[2] / 3, 6.0)  # 最后一声长长的余音，然后安静


# ─── 混音输出 ────────────────────────────────────────────────────────
def soft_lowpass(x, hi=6000):
	return spectral(x, lambda f: 1 / (1 + (f / hi) ** 4))


mix = np.stack([soft_lowpass(L), soft_lowpass(R)], axis=1)
mix = np.tanh(mix / (np.max(np.abs(mix)) * 0.9))
mix = mix / np.max(np.abs(mix)) * 10 ** (-3 / 20)


def write_wav(path: Path, data):
	path.parent.mkdir(parents=True, exist_ok=True)
	pcm = (np.clip(data, -1, 1) * 32767).astype('<i2')
	with wave.open(str(path), 'wb') as w:
		w.setnchannels(2)
		w.setsampwidth(2)
		w.setframerate(SR)
		w.writeframes(pcm.tobytes())


root = Path(__file__).resolve().parent.parent
outdir = root / 'out' / '剑与盾'
# 叫声在视频里：叫声响起时把音效压低（爆发点那两声只压 4 dB）
CRIES = [T['zacian'], T['zamazenta'], T['eternatus'], T['eternamax'], T['blaze'] + 30, T['blaze'] + 44]
BURST_CRIES = [T['burst'] - 4, T['burst'] + 6]
tt = np.arange(N) / SR
duck = np.zeros(N)
for c in CRIES + BURST_CRIES:
	c = ts(c)
	shape = np.interp(tt, [c - 0.06, c, c + 1.6, c + 2.2], [0, 1, 1, 0], left=0, right=0)
	duck = np.maximum(duck, shape * (4.0 if c in [ts(b) for b in BURST_CRIES] else 8.0))
mix = mix * (10 ** (-duck / 20))[:, None]
mix = mix / np.max(np.abs(mix)) * 10 ** (-3 / 20)

end = int(T['end'] / FPS * SR)
write_wav(outdir / 'galar-sfx.wav', mix[:end])
for name, a, b in SEGMENTS:
	write_wav(outdir / 'sfx' / f'galar-{name}-sfx.wav', mix[int(a / FPS * SR) : int(b / FPS * SR)])
for name, a, b in PARTS:
	write_wav(outdir / 'sfx' / f'galar-{name}-sfx.wav', mix[int(a / FPS * SR) : int(b / FPS * SR)])
print(f'galar-sfx.wav: {T["end"] / FPS:.2f}s')
