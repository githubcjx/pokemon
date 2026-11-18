"""
第 2 期《大地与海洋之战》音效轨（不是配乐：没有旋律，只有环境声与动作音效）。
全部用 numpy 程序合成，不使用外部素材。时间轴与六段首尾相接后的整期一致（0 秒 = 第 1 段第一帧）。

输出：
  out/ep02-sfx.wav               整期音效（48kHz 立体声 16 位）
  out/sfx/ep02-s1-sfx.wav … s6   按段切开的音效

用法：python sfx/ep02_sfx.py
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
FPS = 30  # 时间轴按 30fps 帧号编写，与场景代码一致

# 各段时长（30fps 帧数）与起点（秒）
SEGMENTS = [('s1', 600), ('s2', 750), ('s3', 900), ('s4', 540), ('s5', 600), ('s6', 600)]
OFFSET = {}
_acc = 0.0
for _name, _frames in SEGMENTS:
	OFFSET[_name] = _acc
	_acc += _frames / FPS
TOTAL = _acc

N = int(TOTAL * SR)
L = np.zeros(N, dtype=np.float64)
R = np.zeros(N, dtype=np.float64)
rng = np.random.default_rng(20261001)


def t_of(seg: str, frame: float) -> float:
	"""段内 30fps 帧号 → 整期秒数"""
	return OFFSET[seg] + frame / FPS


# ─── 基础工具 ────────────────────────────────────────────────────────
def noise(n: int) -> np.ndarray:
	return rng.standard_normal(n)


def spectral(x: np.ndarray, mag) -> np.ndarray:
	"""频域整形：mag(freqs) 返回每个频率的增益"""
	X = np.fft.rfft(x)
	f = np.fft.rfftfreq(len(x), 1 / SR)
	return np.fft.irfft(X * mag(f), n=len(x))


def band(x: np.ndarray, lo: float, hi: float, soft: float = 0.3) -> np.ndarray:
	"""柔和边缘的带通（lo / hi 处按对数频率平滑过渡）"""

	def mag(f):
		lf = np.log2(np.maximum(f, 1.0))
		a = 1 / (1 + np.exp(-(lf - np.log2(max(lo, 1))) / soft)) if lo > 0 else 1.0
		b = 1 / (1 + np.exp((lf - np.log2(hi)) / soft))
		return a * b

	return spectral(x, mag)


def brown(n: int) -> np.ndarray:
	"""低频为主的噪声（1/f²）"""
	return spectral(noise(n), lambda f: 1 / np.maximum(f, 20.0))


def norm(x: np.ndarray) -> np.ndarray:
	p = np.max(np.abs(x))
	return x / p if p > 0 else x


def env(t: np.ndarray, pts) -> np.ndarray:
	"""分段线性包络：pts 为 [(秒, 值), …]"""
	xs, ys = zip(*pts)
	return np.interp(t, xs, ys)


def slow_wobble(n: int, rate: float = 0.3, depth: float = 0.4) -> np.ndarray:
	"""缓慢起伏的幅度调制（几组低频正弦叠加）"""
	t = np.arange(n) / SR
	w = sum(np.sin(2 * np.pi * rate * k * t + rng.uniform(0, 6.28)) / k for k in (1, 1.7, 2.9))
	return 1 + depth * w / 1.9


def add(start: float, sig: np.ndarray, gain: float = 1.0, pan=0.0) -> None:
	"""在整期时间轴的 start 秒处叠加单声道信号；pan 为 -1（左）…1（右），可为数组"""
	i0 = int(start * SR)
	if i0 >= N:
		return
	if i0 < 0:
		sig = sig[-i0:]
		if isinstance(pan, np.ndarray):
			pan = pan[-i0:]
		i0 = 0
	n = min(len(sig), N - i0)
	sig = sig[:n] * gain
	p = pan[:n] if isinstance(pan, np.ndarray) else pan
	th = (np.clip(p, -1, 1) + 1) * np.pi / 4
	L[i0 : i0 + n] += sig * np.cos(th)
	R[i0 : i0 + n] += sig * np.sin(th)


def add_stereo(start: float, sl: np.ndarray, sr_: np.ndarray, gain: float = 1.0) -> None:
	i0 = int(start * SR)
	n = min(len(sl), N - i0)
	L[i0 : i0 + n] += sl[:n] * gain
	R[i0 : i0 + n] += sr_[:n] * gain


def decay(n: int, tau: float, attack: float = 0.004) -> np.ndarray:
	t = np.arange(n) / SR
	return np.minimum(t / attack, 1.0) * np.exp(-t / tau)


def pan_of_x(x: float) -> float:
	"""画面横向位置（0–1）→ 声像"""
	return float(np.clip((x - 0.5) * 1.6, -1, 1))


# ─── 音效 ────────────────────────────────────────────────────────────
def rain(start: float, end: float, envpts, gain=1.0) -> None:
	"""雨：高频雨幕（左右独立）+ 稀疏的雨滴"""
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	e = env(t, envpts)
	for side in (0, 1):
		bed = norm(band(noise(n), 900, 9000, 0.5)) * 0.55
		drops = np.zeros(n)
		count = int((end - start) * 160)
		for _ in range(count):
			i = rng.integers(0, n - 2000)
			k = int(rng.uniform(120, 600))
			drops[i : i + k] += noise(k) * decay(k, rng.uniform(0.002, 0.008)) * rng.uniform(0.2, 1.0)
		drops = norm(band(drops, 1500, 10000)) * 0.45
		sig = (bed + drops) * e
		if side == 0:
			add_stereo(start, sig * 0.75, np.zeros(n), gain)
		else:
			add_stereo(start, np.zeros(n), sig * 0.75, gain)


def thunder(start: float, pan: float, near: float = 1.0, muffled: bool = False) -> None:
	"""雷：近处的炸裂 + 滚动的闷雷"""
	n = int(4.5 * SR)
	t = np.arange(n) / SR
	crack = noise(n) * decay(n, 0.035, 0.001)
	crack = band(crack, 300 if not muffled else 80, 9000 if not muffled else 900)
	roll = band(noise(n), 25, 420 if not muffled else 220)
	am = np.clip(slow_wobble(n, 2.2, 0.8), 0.1, None)
	roll = roll * am * np.minimum(t / 0.08, 1) * np.exp(-t / (1.6 + 0.8 * near))
	sig = norm(crack) * 0.9 * near + norm(roll) * 0.8
	add(start, sig, 0.55, pan)


def impact(start: float, size: float = 1.0, pan: float = 0.0, debris: bool = True, splash: bool = False) -> None:
	"""撞击 / 爆发：低频轰鸣 + 中频闷响 + 炸裂 + 拖尾 + 碎石 / 水花"""
	dur = 2.5 + 3.0 * size
	n = int(dur * SR)
	t = np.arange(n) / SR
	f = 75 * np.exp(-t * 1.8) + 26
	boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(n, 0.6 + 0.9 * size, 0.003)
	thud = band(noise(n), 40, 400) * decay(n, 0.18 + 0.15 * size)
	crack = band(noise(n), 1200, 12000) * decay(n, 0.03, 0.0008)
	tail = band(brown(n), 20, 260) * np.minimum(t / 0.05, 1) * np.exp(-t / (1.2 + 1.5 * size))
	sig = norm(boom) * 1.0 + norm(thud) * 0.7 + norm(crack) * 0.55 + norm(tail) * 0.6 * size
	add(start, sig, 0.8 * (0.6 + 0.4 * size), pan)
	if debris:
		for _ in range(int(25 * size)):
			dt = rng.uniform(0.15, 1.8) ** 1.4
			k = int(rng.uniform(0.02, 0.09) * SR)
			c = band(noise(k), rng.uniform(250, 900), rng.uniform(2500, 7000)) * decay(k, rng.uniform(0.01, 0.03))
			add(start + dt, norm(c), rng.uniform(0.08, 0.25) * size, float(np.clip(pan + rng.uniform(-0.8, 0.8), -1, 1)))
	if splash:
		k = int(2.0 * SR)
		s = band(noise(k), 500, 7000) * decay(k, 0.45, 0.01)
		add(start + 0.03, norm(s), 0.4 * size, pan + 0.3)


def hiss(start: float, end: float, envpts, gain=1.0, pan=0.0, lo=1800, hi=11000) -> None:
	"""蒸汽 / 嘶声"""
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	sig = norm(band(noise(n), lo, hi)) * slow_wobble(n, 1.3, 0.35) * env(t, envpts)
	add(start, sig, gain, pan)


def lava(start: float, end: float, envpts, gain=1.0, pan=-0.6) -> None:
	"""熔岩：低沉的轰鸣 + 爆裂声 + 冒泡"""
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	e = env(t, envpts)
	roar = norm(band(brown(n), 25, 380)) * slow_wobble(n, 0.4, 0.5) * 0.7
	pops = np.zeros(n)
	for _ in range(int((end - start) * 35)):
		i = rng.integers(0, n - 3000)
		k = int(rng.uniform(80, 900))
		pops[i : i + k] += noise(k) * decay(k, rng.uniform(0.001, 0.006), 0.0003) * rng.uniform(0.2, 1) ** 2
	pops = norm(band(pops, 600, 9000)) * 0.45
	bub = np.zeros(n)
	for _ in range(int((end - start) * 1.8)):
		i = rng.integers(0, n - SR // 4)
		k = int(rng.uniform(0.08, 0.22) * SR)
		tt = np.arange(k) / SR
		fr = rng.uniform(55, 110) * (1 + 1.6 * tt / tt[-1])
		bub[i : i + k] += np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.sin(np.pi * tt / tt[-1]) ** 2 * rng.uniform(0.3, 1)
	bub = norm(bub) * 0.35
	add(start, (roar + pops + bub) * e, gain, pan)


def wind(start: float, end: float, envpts, gain=1.0, lo=120, hi=1400, pan=0.0, rate=0.25) -> None:
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	for side, p in ((0, pan - 0.5), (1, pan + 0.5)):
		sig = norm(band(noise(n), lo, hi, 0.6)) * np.clip(slow_wobble(n, rate, 0.6), 0.05, None) * env(t, envpts)
		add(start, sig, gain * 0.7, p)


def surf(start: float, end: float, envpts, gain=1.0, pan=0.6, period=5.0) -> None:
	"""海浪：一涌一退的拍岸声"""
	n = int((end - start) * SR)
	t = np.arange(n) / SR
	base = band(noise(n), 180, 4500, 0.5)
	ph = (t / period + rng.uniform(0, 1)) % 1.0
	swell = np.where(ph < 0.7, (ph / 0.7) ** 2, np.exp(-(ph - 0.7) * 9))
	sig = norm(base) * (0.25 + 0.75 * swell) * env(start + t, envpts)
	add(start, sig, gain, pan)


def whoosh(start: float, dur: float, f0: float, f1: float, gain=1.0, pan0=0.0, pan1=0.0, peak=0.6) -> None:
	"""呼啸：中心频率从 f0 扫到 f1 的带通噪声，钟形包络（分块近似时变滤波）"""
	n = int(dur * SR)
	x = noise(n)
	out = np.zeros(n)
	blk = 2048
	win = np.hanning(blk * 2)
	for i in range(0, n, blk):
		seg = np.zeros(blk * 2)
		chunk = x[i : i + blk * 2]
		seg[: len(chunk)] = chunk
		u = min(i / n, 1.0)
		fc = f0 * (f1 / f0) ** u
		y = band(seg * win, fc / 2.2, fc * 2.2, 0.35)
		out[i : i + blk * 2] += y[: len(out[i : i + blk * 2])]
	t = np.arange(n) / n
	shape = np.where(t < peak, (t / peak) ** 2, np.exp(-(t - peak) / (1 - peak) * 4))
	add(start, norm(out) * shape, gain, np.linspace(pan0, pan1, n))


def rumble(start: float, end: float, envpts, gain=1.0, pan=0.0) -> None:
	"""大地的低频震颤"""
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	sig = norm(band(brown(n), 18, 120)) * np.clip(slow_wobble(n, 1.1, 0.7), 0.1, None) * env(t, envpts)
	add(start, sig, gain, pan)


def shimmer(start: float, dur: float, gain=0.25, density=40, lo=2200, hi=9000, pan=0.0, swell=True) -> None:
	"""光芒闪烁：随机频率的细碎高音闪点（无旋律）+ 一层空灵的高频气声"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	out = np.zeros(n)
	for _ in range(int(dur * density)):
		i = rng.integers(0, max(1, n - SR // 3))
		k = min(int(rng.uniform(0.08, 0.35) * SR), n - i)
		tt = np.arange(k) / SR
		fr = np.exp(rng.uniform(np.log(lo), np.log(hi)))
		out[i : i + k] += np.sin(2 * np.pi * fr * tt) * np.exp(-tt / (k / SR / 3)) * rng.uniform(0.2, 1)
	air = norm(band(noise(n), 4000, 14000)) * 0.15
	shape = np.sin(np.pi * t / dur) if swell else np.ones(n)
	sig = (norm(out) * 0.6 + air) * shape
	add(start, sig, gain, pan)


def riser(start: float, dur: float, gain=0.5, f0=45.0, f1=110.0) -> None:
	"""能量蓄积：低沉的嗡鸣升调 + 噪声上扫"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	f = f0 * (f1 / f0) ** (t / dur)
	ph = 2 * np.pi * np.cumsum(f) / SR
	drone = sum(np.sin(ph * k + rng.uniform(0, 6)) / k for k in (1, 2, 3, 4)) * (t / dur) ** 1.5
	whoosh(start, dur, 300, 6000, gain * 0.6, 0, 0, peak=0.97)
	add(start, norm(drone), gain, 0.0)


def underwater(start: float, end: float, envpts, gain=1.0, bubbles=1.0) -> None:
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	deep = norm(band(brown(n), 20, 350)) * slow_wobble(n, 0.15, 0.5)
	bub = np.zeros(n)
	for _ in range(int((end - start) * 3 * bubbles)):
		i = rng.integers(0, n - SR // 10)
		k = int(rng.uniform(0.02, 0.06) * SR)
		tt = np.arange(k) / SR
		fr = rng.uniform(300, 700) * (1 + 1.5 * tt / tt[-1])
		bub[i : i + k] += np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.sin(np.pi * tt / tt[-1]) * rng.uniform(0.2, 1)
	sig = (deep * 0.8 + norm(bub) * 0.25 * bubbles) * env(t, envpts)
	for p in (-0.4, 0.4):
		add(start, sig * 0.7, gain, p)


def strain(start: float, dur: float, gain=0.4) -> None:
	"""光索绷紧的低吟：低频锯齿波的缓慢弯音 + 中频摩擦声"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	f = 48 * (1 + 0.12 * np.sin(2 * np.pi * 0.7 * t)) * (1 + 0.15 * t / dur)
	ph = np.cumsum(f) / SR
	saw = 2 * (ph % 1.0) - 1
	saw = band(saw, 30, 900)
	grit = band(noise(n), 200, 900) * slow_wobble(n, 6, 0.8)
	shape = np.sin(np.pi * t / dur) ** 0.7
	add(start, (norm(saw) * 0.7 + norm(grit) * 0.3) * shape, gain, 0.0)


def pulse(start: float, gain=0.3) -> None:
	"""生命的脉动：柔和的低频一跳"""
	n = int(0.6 * SR)
	t = np.arange(n) / SR
	s = np.sin(2 * np.pi * (48 + 20 * np.exp(-t * 12)) * t) * decay(n, 0.15, 0.01)
	add(start, s, gain, 0.0)


def splash(start: float, gain=0.6, pan=0.0) -> None:
	n = int(1.6 * SR)
	s = band(noise(n), 400, 8000) * decay(n, 0.35, 0.02)
	add(start, norm(s), gain, pan)


# ─── 第 1 段：原始回归 ─────────────────────────────────────────────────
s = 's1'
T1 = lambda f: t_of(s, f)
lava(T1(0), T1(600), [(T1(0), 0.0), (T1(20), 0.55), (T1(160), 0.8), (T1(166), 1.2), (T1(260), 0.85), (T1(500), 0.85), (T1(600), 1.2)], 0.6, -0.7)
rain(T1(0), T1(600), [(T1(0), 0.0), (T1(20), 0.7), (T1(166), 1.0), (T1(600), 1.1)], 0.5)
wind(T1(0), T1(600), [(T1(0), 0.0), (T1(24), 0.4), (T1(600), 0.6)], 0.25, 150, 900, 0.6)
rumble(T1(50), T1(170), [(T1(50), 0.0), (T1(160), 1.0), (T1(170), 0.0)], 0.5)
hiss(T1(60), T1(166), [(T1(60), 0.0), (T1(160), 0.5), (T1(166), 0.0)], 0.25)  # 分界线噼啪
for f, x in [(70, 0.82), (132, 0.66), (165, 0.86), (300, 0.78), (432, 0.92), (548, 0.7), (574, 0.85)]:
	thunder(T1(f), pan_of_x(x), 0.9)
impact(T1(166), 1.0, -0.2, debris=False)
impact(T1(174), 0.55, 0.3, debris=False, splash=True)
hiss(T1(166), T1(500), [(T1(166), 1.0), (T1(206), 0.35), (T1(500), 0.3)], 0.35)  # 爆发后分界线上的蒸汽
rumble(T1(500), T1(600), [(T1(500), 0.0), (T1(600), 1.2)], 0.6)
hiss(T1(500), T1(605), [(T1(500), 0.1), (T1(600), 1.0), (T1(605), 0.0)], 0.5)
whoosh(T1(560), (T1(602) - T1(560)), 300, 5000, 0.6, 0, 0, peak=0.95)

# ─── 第 2 段：大地与海洋 ───────────────────────────────────────────────
s = 's2'
T2 = lambda f: t_of(s, f)
hiss(T2(0), T2(30), [(T2(0), 0.8), (T2(30), 0.0)], 0.5)  # 白场的蒸汽余韵
wind(T2(0), T2(390), [(T2(0), 0.6), (T2(390), 0.5)], 0.35, 200, 1600)
lava(T2(0), T2(390), [(T2(0), 0.6), (T2(210), 1.1), (T2(390), 0.6)], 0.55, -0.6)
surf(T2(0), T2(390), [(T2(0), 0.4), (T2(210), 0.5), (T2(300), 1.0), (T2(390), 1.0)], 0.45, 0.6, 4.2)
hiss(T2(0), T2(390), [(T2(0), 0.3), (T2(390), 0.35)], 0.2, 0.0)
rain(T2(210), T2(390), [(T2(210), 0.0), (T2(260), 0.8), (T2(390), 0.9)], 0.45)
for f, x in [(262, 0.74), (330, 0.9)]:
	thunder(T2(f), pan_of_x(x), 0.8)
cuts = [36, 32, 28, 24, 20, 16, 14, 10]
f0 = 390
for i, ln in enumerate(cuts):
	sun = i % 2 == 0
	a, b = T2(f0), T2(f0 + ln)
	impact(a, 0.18, -0.4 if sun else 0.4, debris=False)
	if sun:
		lava(a, b + 0.05, [(a, 1.3), (b, 1.3)], 0.6, -0.3)
		hiss(a, b, [(a, 0.7), (b, 0.7)], 0.3, -0.2, 1200, 8000)
	else:
		rain(a, b + 0.05, [(a, 1.3), (b, 1.3)], 0.7)
		surf(a, b, [(a, 1.0), (b, 1.0)], 0.5, 0.4, 1.5)
		thunder(T2(f0 + 2), 0.4, 1.0)
	f0 += ln
wind(T2(570), T2(750), [(T2(570), 0.5), (T2(750), 0.8)], 0.35, 150, 1200)
lava(T2(570), T2(750), [(T2(570), 0.8), (T2(750), 1.2)], 0.55, -0.6)
rain(T2(570), T2(750), [(T2(570), 0.7), (T2(640), 0.9), (T2(750), 1.1)], 0.5)
surf(T2(570), T2(750), [(T2(570), 0.7), (T2(750), 1.0)], 0.4, 0.6, 3.5)
whoosh(T2(604), T2(641) - T2(604), 200, 3000, 0.7, -0.9, -0.05, peak=0.97)  # 固拉多冲锋
whoosh(T2(604), T2(641) - T2(604), 260, 3600, 0.7, 0.9, 0.05, peak=0.97)  # 盖欧卡冲锋
impact(T2(640), 1.6, 0.0, debris=True, splash=True)
hiss(T2(640), T2(750), [(T2(640), 1.0), (T2(680), 0.5), (T2(750), 0.6)], 0.4)
rumble(T2(640), T2(750), [(T2(640), 0.6), (T2(750), 1.0)], 0.55)
for f, x in [(588, 0.82), (668, 0.68), (690, 0.92), (712, 0.3), (731, 0.76), (744, 0.6)]:
	thunder(T2(f), pan_of_x(x), 0.9)

# ─── 第 3 段：天空之上 ─────────────────────────────────────────────────
s = 's3'
T3 = lambda f: t_of(s, f)
lava(T3(0), T3(70), [(T3(0), 1.2), (T3(70), 0.0)], 0.55, -0.6)
rain(T3(0), T3(80), [(T3(0), 1.1), (T3(80), 0.0)], 0.5)
rumble(T3(0), T3(70), [(T3(0), 1.0), (T3(70), 0.0)], 0.55)
thunder(T3(18), pan_of_x(0.72), 1.0)
whoosh(T3(40), T3(90) - T3(40), 200, 4000, 0.9, 0, 0, peak=0.75)  # 急速上摇
wind(T3(66), T3(160), [(T3(66), 0.0), (T3(80), 1.0), (T3(150), 1.2), (T3(160), 0.0)], 0.7, 120, 2200, 0, 0.8)  # 穿云
for f, x in [(104, 0.6), (124, 0.35)]:
	thunder(T3(f), pan_of_x(x), 0.6, muffled=True)
whoosh(T3(140), T3(170) - T3(140), 600, 9000, 0.5, 0, 0, peak=0.4)  # 冲出云顶
wind(T3(150), T3(470), [(T3(150), 0.0), (T3(175), 0.35), (T3(470), 0.3)], 0.25, 2500, 9000, 0, 0.12)  # 平流层的高空风
shimmer(T3(160), 4.0, 0.12, 12)
whoosh(T3(262), T3(350) - T3(262), 400, 1400, 0.35, 0.9, -0.3, peak=0.5)  # 掠过臭氧层
shimmer(T3(300), (T3(380) - T3(300)), 0.22, 30, pan=0.3)  # 显色
whoosh(T3(458), T3(520) - T3(458), 3000, 400, 0.6, 0.3, -0.2, peak=0.6)  # 转身俯冲
whoosh(T3(476), T3(520) - T3(476), 4000, 250, 0.9, 0, 0, peak=0.7)  # 急速下摇
wind(T3(500), T3(572), [(T3(500), 0.0), (T3(512), 1.0), (T3(566), 1.1), (T3(572), 0.0)], 0.7, 120, 2200, 0, 0.8)
thunder(T3(538), pan_of_x(0.55), 0.6, muffled=True)
rain(T3(566), T3(664), [(T3(566), 0.0), (T3(576), 1.1), (T3(640), 1.1), (T3(664), 0.0)], 0.55)
lava(T3(566), T3(720), [(T3(566), 0.0), (T3(576), 1.1), (T3(640), 1.2), (T3(720), 0.0)], 0.5, -0.5)
rumble(T3(566), T3(640), [(T3(566), 0.4), (T3(640), 1.2)], 0.55)
for f, x in [(574, 0.28), (606, 0.86), (626, 0.16)]:
	thunder(T3(f), pan_of_x(x), 1.0)
riser(T3(592), T3(640) - T3(592), 0.5)
shimmer(T3(592), T3(642) - T3(592), 0.3, 60, swell=False, pan=0.3)
impact(T3(640), 2.0, 0.1, debris=True, splash=True)  # 全片最大的爆发
whoosh(T3(640), 1.4, 2500, 150, 0.8, 0, 0, peak=0.05)  # 冲击波扫过
hiss(T3(640), T3(760), [(T3(640), 1.0), (T3(660), 0.8), (T3(760), 0.0)], 0.4, -0.3)  # 熔岩冷却的嘶声
surf(T3(660), T3(900), [(T3(660), 0.0), (T3(720), 0.6), (T3(900), 0.6)], 0.35, 0.3, 6.5)
wind(T3(660), T3(900), [(T3(660), 0.0), (T3(720), 0.35), (T3(900), 0.35)], 0.25, 300, 2500, 0, 0.15)
shimmer(T3(660), 5.0, 0.12, 14)  # 神光

# ─── 第 4 段：沉睡 ─────────────────────────────────────────────────────
s = 's4'
T4 = lambda f: t_of(s, f)
surf(T4(0), T4(110), [(T4(0), 0.6), (T4(110), 0.0)], 0.35, 0.3, 6.5)
wind(T4(0), T4(110), [(T4(0), 0.35), (T4(110), 0.0)], 0.25, 300, 2500, 0, 0.15)
whoosh(T4(0), T4(70) - T4(0), 500, 3000, 0.4, 0.3, 0.3, peak=0.8)  # 烈空坐飞离
shimmer(T4(50), (T4(84) - T4(50)), 0.18, 40)  # 金线描出
rumble(T4(74), T4(200), [(T4(74), 0.0), (T4(170), 0.8), (T4(200), 0.4)], 0.5, -0.7)  # 左：沉入地底
underwater(T4(74), T4(170), [(T4(74), 0.0), (T4(130), 0.8), (T4(170), 0.8)], 0.5)  # 右：沉入海沟
splash(T4(80), 0.25, 0.7)
n4 = int((T4(540) - T4(170)) * SR)
tt = np.arange(n4) / SR
breath = 0.5 + 0.5 * np.sin(2 * np.pi * tt / 4.0)  # 与画面的呼吸同步（120 帧 = 4 秒）
mag = norm(band(brown(n4), 20, 300)) * (0.4 + 0.6 * breath)
bub_l = np.zeros(n4)
for _ in range(int(n4 / SR * 1.2)):
	i = rng.integers(0, n4 - SR // 4)
	k = int(rng.uniform(0.1, 0.25) * SR)
	x = np.arange(k) / SR
	bub_l[i : i + k] += np.sin(2 * np.pi * np.cumsum(rng.uniform(50, 90) * (1 + 1.4 * x / x[-1])) / SR) * np.sin(np.pi * x / x[-1]) ** 2
fade_l = env(T4(170) + tt, [(T4(170), 1.0), (T4(470), 1.0), (T4(520), 0.0)])
add(T4(170), (mag * 0.8 + norm(bub_l) * 0.3) * fade_l, 0.45, -0.75)  # 地底岩浆的呼吸
underwater(T4(170), T4(540), [(T4(170), 0.8), (T4(470), 0.7), (T4(540), 0.9)], 0.45, 0.6)

# ─── 第 5 段：拖动大陆 ─────────────────────────────────────────────────
s = 's5'
T5 = lambda f: t_of(s, f)
underwater(T5(0), T5(100), [(T5(0), 0.9), (T5(96), 1.0), (T5(100), 0.0)], 0.45, 1.8)
whoosh(T5(20), T5(98) - T5(20), 150, 1200, 0.4, 0, 0, peak=0.95)  # 向上浮起
splash(T5(96), 0.6)
wind(T5(96), T5(600), [(T5(96), 0.0), (T5(110), 0.6), (T5(200), 0.4), (T5(540), 0.35), (T5(600), 0.0)], 0.3, 400, 3000, 0, 0.2)
shimmer(T5(110), 3.0, 0.08, 10)  # 古地图展开
rumble(T5(196), T5(300), [(T5(196), 0.0), (T5(285), 1.0), (T5(300), 0.5)], 0.6, 0.1)  # 巨人现身
shimmer(T5(255), (T5(300) - T5(255)), 0.2, 30, lo=1500, hi=6000, pan=0.1)  # 双眼亮起
impact(T5(290), 0.5, 0.1, debris=False)
shimmer(T5(300), (T5(352) - T5(300)), 0.22, 50, lo=1800, hi=7000)  # 光索描出
for f in (362, 432, 502):
	impact(T5(f), 0.7, 0.0, debris=True)  # 沉重的一拉
	rumble(T5(f), T5(f + 60), [(T5(f), 1.2), (T5(f + 60), 0.0)], 0.6)
	strain(T5(f - 4), (T5(f + 50) - T5(f - 4)), 0.35)
	surf(T5(f + 4), T5(f + 50), [(T5(f + 4), 1.0), (T5(f + 50), 0.0)], 0.35, 0.0, 1.5)  # 大陆破浪
whoosh(T5(540), T5(600) - T5(540), 2000, 200, 0.4, 0, 0, peak=0.5)
underwater(T5(560), T5(600), [(T5(560), 0.0), (T5(600), 0.7)], 0.4, 0.5)

# ─── 第 6 段：尾声 ─────────────────────────────────────────────────────
s = 's6'
T6 = lambda f: t_of(s, f)
underwater(T6(0), T6(600), [(T6(0), 0.7), (T6(90), 0.45), (T6(540), 0.4), (T6(600), 0.0)], 0.6, 0.4)
shimmer(T6(0), 3.0, 0.25, 14)  # 生命之光亮起
for k in range(int((T6(540) - T6(30)) / 4.0)):
	pulse(T6(30) + k * 4.0, 0.4)  # 生命的脉动（每 4 秒一次）
shimmer(T6(150), (T6(245) - T6(150)), 0.32, 45, lo=2500, hi=9000)  # 双螺旋展开
shimmer(T6(200), (T6(320) - T6(200)), 0.35, 30, lo=1500, hi=7000)  # 梦幻浮现
n6 = int((T6(600) - T6(240)) * SR)
x6 = T6(240) + np.arange(n6) / SR
add(T6(240), norm(band(noise(n6), 3500, 12000)) * env(x6, [(T6(240), 0.0), (T6(300), 0.12), (T6(540), 0.12), (T6(600), 0.0)]), 1.0, 0.0)  # 空灵的余韵

# ─── 混音输出 ────────────────────────────────────────────────────────
mix = np.stack([L, R], axis=1)
# 轻微的软限幅，防止大爆发削顶；整体峰值压到 -3 dBFS
mix = np.tanh(mix / (np.max(np.abs(mix)) * 0.7))
mix = mix / np.max(np.abs(mix)) * 10 ** (-3 / 20)


def write_wav(path: Path, data: np.ndarray) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	pcm = (np.clip(data, -1, 1) * 32767).astype('<i2')
	with wave.open(str(path), 'wb') as w:
		w.setnchannels(2)
		w.setsampwidth(2)
		w.setframerate(SR)
		w.writeframes(pcm.tobytes())


root = Path(__file__).resolve().parent.parent
write_wav(root / 'out' / 'ep02-sfx.wav', mix)
for name, frames in SEGMENTS:
	a = int(OFFSET[name] * SR)
	b = int((OFFSET[name] + frames / FPS) * SR)
	write_wav(root / 'out' / 'sfx' / f'ep02-{name}-sfx.wav', mix[a:b])
print(f'ep02-sfx.wav: {TOTAL:.2f}s, peak -3 dBFS')
