"""
《看不见的信任》（烧焦塔，代码短名 tower）音效轨（不是配乐：没有旋律，只有环境声与动作音效）。
全部用 numpy 程序合成，不使用外部素材。时间轴与七段首尾相接后的整期一致（0 秒 = 第 1 段第一帧），
音效节点直接取自各段场景代码（src/scenes/tower/*.tsx）里的帧号。叫声在视频里，这里不含。

今（月夜 / 破晓）：夜风、虫鸣、余烬、草丛、风；昔：古纸的空气、雷、火、骤雨、水汽、火把、远海。
基础工具函数沿用 sfx/ep03_sfx.py。

输出：
  out/tower-sfx.wav               整期音效（48kHz 立体声 16 位，峰值 -3 dBFS）
  out/sfx/tower-s1-sfx.wav … s7   按段切开的音效

用法：python sfx/tower_sfx.py
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
FPS = 30  # 时间轴按 30fps 帧号编写，与场景代码一致

# 各段时长（30fps 帧数），与 src/scenes/tower/*Scene.tsx 的 *_SCENE_FRAMES 一致
SEGMENTS = [('s1', 600), ('s2', 780), ('s3', 900), ('s4', 810), ('s5', 1020), ('s6', 900), ('s7', 900)]
OFFSET = {}
_acc = 0.0
for _name, _frames in SEGMENTS:
	OFFSET[_name] = _acc
	_acc += _frames / FPS
TOTAL = _acc

N = int(TOTAL * SR)
L = np.zeros(N, dtype=np.float64)
R = np.zeros(N, dtype=np.float64)
rng = np.random.default_rng(20261002)


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


# ─── 水墨这一期的音效 ─────────────────────────────────────────────────
def echo(x: np.ndarray, taps=((0.13, 0.45), (0.29, 0.3), (0.47, 0.18), (0.71, 0.1), (1.0, 0.05)), dark=2500) -> np.ndarray:
	"""洞窟回声：几次越来越暗、越来越弱的反射"""
	n = len(x) + int(taps[-1][0] * SR) + 1
	y = np.zeros(n)
	y[: len(x)] += x
	for dt, g in taps:
		i = int(dt * SR)
		y[i : i + len(x)] += band(x, 60, dark * (1 - dt * 0.5), 0.4) * g
	return y


def drip(start: float, size: float = 1.0, pan: float = 0.0, cave: bool = False, gain: float = 0.5) -> None:
	"""一滴落进水里：上滑的"咚"（气泡共振）+ 细小的水花；cave=True 时带洞窟回声"""
	n = int(0.5 * SR)
	t = np.arange(n) / SR
	f0 = rng.uniform(700, 1100) / (0.6 + 0.4 * size)
	f = f0 * (1 + 1.8 * (1 - np.exp(-t / 0.03)))
	plink = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(n, 0.045 + 0.03 * size, 0.0015)
	spl = band(noise(n), 1500, 9000) * decay(n, 0.02 + 0.03 * size, 0.0005)
	sig = norm(plink) * 0.8 + norm(spl) * 0.3 * size
	if size > 0.9:
		sig = sig + norm(band(noise(n), 60, 400) * decay(n, 0.12, 0.003)) * 0.5 * size  # 大墨滴落下的闷响
	if cave:
		sig = echo(sig)
	add(start, sig, gain, pan)


def ink_bloom(start: float, dur: float, gain: float = 0.35, pan: float = 0.0) -> None:
	"""墨在水里洇开：低沉柔和的涌动 + 缓缓翻卷的水声"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	swell = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
	low = norm(band(brown(n), 30, 260)) * slow_wobble(n, 0.6, 0.5)
	swirl = norm(band(noise(n), 300, 2200, 0.5)) * np.clip(slow_wobble(n, 1.4, 0.7), 0.1, None) * 0.35
	add(start, (low * 0.8 + swirl) * swell, gain, pan)


def tide(start: float, dur: float, rise: bool = True, gain: float = 0.5, pan: float = 0.0) -> None:
	"""墨潮：满屏的墨涌上来（rise）或退开，像一层水漫过去"""
	n = int(dur * SR)
	u = np.arange(n) / n
	shape = u**1.6 if rise else (1 - u) ** 1.3 * np.minimum(u / 0.08, 1)
	body = norm(band(brown(n), 40, 700)) * 0.8 + norm(band(noise(n), 400, 3500, 0.5)) * 0.3
	add(start, body * np.clip(slow_wobble(n, 0.9, 0.4), 0.2, None) * shape, gain, pan)
	whoosh(start, dur, 250 if rise else 1500, 1500 if rise else 250, gain * 0.35, pan, pan, peak=0.9 if rise else 0.2)


def brush(start: float, dur: float = 0.25, gain: float = 0.12, pan: float = 0.0) -> None:
	"""一笔：毛笔擦过纸面的沙沙声"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	sig = band(noise(n), 1200, 7000, 0.5) * np.sin(np.pi * t / dur) ** 0.8 * (0.7 + 0.3 * np.sin(2 * np.pi * rng.uniform(15, 30) * t))
	add(start, norm(sig), gain, pan)


def writing(start: float, chars: int, rate: float, gain: float = 0.1, pan: float = 0.0, shaky: bool = False) -> None:
	"""逐字写出（与 DiaryText 的节奏一致：每 rate 帧一个字），每个字两三笔"""
	for i in range(chars):
		t0 = start + i * rate / FPS
		for k in range(int(rng.integers(2, 4))):
			brush(t0 + k * rng.uniform(0.02, 0.05), rng.uniform(0.05, 0.11) * (1.4 if shaky else 1), gain * rng.uniform(0.6, 1.1), pan)


def stamp(start: float, gain: float = 0.5, pan: float = 0.0) -> None:
	"""朱砂印落纸：短促的闷响 + 纸面一声轻响"""
	n = int(0.35 * SR)
	t = np.arange(n) / SR
	thud = np.sin(2 * np.pi * (140 * np.exp(-t * 30) + 70) * t) * decay(n, 0.05, 0.002)
	tap = band(noise(n), 800, 5000) * decay(n, 0.012, 0.0005)
	add(start, norm(thud) * 0.9 + norm(tap) * 0.4, gain, pan)


def air(start: float, end: float, envpts, gain: float = 0.12) -> None:
	"""安静的空气 / 纸面的底噪（极轻）"""
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	for p in (-0.6, 0.6):
		add(start, norm(band(noise(n), 200, 3000, 0.7)) * slow_wobble(n, 0.1, 0.3) * env(t, envpts), gain, p)


def fire(start: float, end: float, envpts, gain: float = 0.5, pan=0.0, roar: float = 1.0) -> None:
	"""火：低沉的燃烧声 + 噼啪的爆裂"""
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	e = env(t, envpts)
	body = norm(band(brown(n), 40, 900)) * np.clip(slow_wobble(n, 2.5, 0.6), 0.15, None) * roar
	pops = np.zeros(n)
	for _ in range(int((end - start) * 28)):
		i = rng.integers(0, max(1, n - 3000))
		k = int(rng.uniform(60, 700))
		pops[i : i + k] += noise(k) * decay(k, rng.uniform(0.001, 0.005), 0.0003) * rng.uniform(0.2, 1) ** 2
	sig = body * 0.7 + norm(band(pops, 900, 10000)) * 0.45
	add(start, sig * e, gain, pan)


def breath_fire(start: float, dur: float, gain: float = 0.7, pan0: float = 0.6, pan1: float = -0.3) -> None:
	"""喷火：嘴边的嘶声迅速变成轰然的火流，声像从喷火龙移向目标"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	shape = np.minimum(t / 0.12, 1) * np.where(t < dur * 0.7, 1.0, np.exp(-(t - dur * 0.7) / (dur * 0.12)))
	roar = norm(band(brown(n), 50, 1400)) * np.clip(slow_wobble(n, 7, 0.5), 0.2, None)
	hss = norm(band(noise(n), 1500, 9000)) * 0.35
	add(start, (roar + hss) * shape, gain, np.linspace(pan0, pan1, n))


def psy_hum(start: float, dur: float, gain: float = 0.35, pan: float = -0.4, f0: float = 52.0, f1: float = 62.0, beat: float = 4.0) -> None:
	"""念力：低沉的嗡鸣，带缓慢的颤动（只是一层低频，没有旋律）"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	f = f0 * (f1 / f0) ** (t / dur)
	ph = 2 * np.pi * np.cumsum(f) / SR
	hum = np.sin(ph) + 0.5 * np.sin(ph * 2.01) + 0.25 * np.sin(ph * 3.02)
	trem = 0.7 + 0.3 * np.sin(2 * np.pi * beat * t)
	grit = band(noise(n), 150, 700)
	shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.5
	add(start, (norm(hum) * trem + norm(grit) * 0.25) * shape, gain, pan)


def cave_bed(start: float, end: float, envpts, gain: float = 0.4, pan: float = 0.0, drips: float = 0.6) -> None:
	"""洞窟：深处的低鸣 + 水面轻拍 + 稀疏的滴水回声"""
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	e = env(t, envpts)
	drone = norm(band(brown(n), 25, 160)) * slow_wobble(n, 0.08, 0.4)
	lap = norm(band(noise(n), 200, 1500, 0.5)) * np.clip(slow_wobble(n, 0.35, 0.8), 0.05, None) * 0.25
	for p in (pan - 0.5, pan + 0.5):
		add(start, (drone * 0.8 + lap) * e, gain * 0.7, p)
	xs, ys = zip(*envpts)
	for _ in range(int((end - start) * drips)):
		ts = rng.uniform(start, end - 1.0)
		g = float(np.interp(ts, xs, ys))
		if g > 0.05:
			drip(ts, rng.uniform(0.3, 0.6), float(np.clip(pan + rng.uniform(-0.8, 0.8), -1, 1)), cave=True, gain=0.45 * g * gain)


def jungle_bed(start: float, end: float, envpts, gain: float = 0.3, pan: float = -0.5) -> None:
	"""丛林：树叶的沙沙风声 + 细碎的虫鸣（高频的噪声脉冲，没有音高）+ 远处的流水"""
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	e = env(t, envpts)
	tt = np.arange(n) / SR
	leaves = norm(band(noise(n), 1500, 8000, 0.6)) * np.clip(slow_wobble(n, 0.5, 0.8), 0.05, None) * 0.5
	insects = norm(band(noise(n), 5000, 9000)) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 26 * tt))) * np.clip(slow_wobble(n, 0.2, 0.9), 0, None) * 0.18
	stream = norm(band(noise(n), 400, 3000, 0.5)) * slow_wobble(n, 1.7, 0.3) * 0.25
	for p in (pan - 0.4, pan + 0.4):
		add(start, (leaves + insects + stream) * e, gain * 0.7, p)





# ─── 《看不见的信任》专用的音效 ─────────────────────────────────────────
def night_bed(start: float, end: float, envpts, gain: float = 0.3, crickets: float = 1.0) -> None:
	"""月夜的原野：低低的夜风 + 远处细碎的虫鸣（高频噪声脉冲，没有音高）"""
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	e = env(t, envpts)
	tt = np.arange(n) / SR
	breeze = norm(band(noise(n), 150, 1200, 0.6)) * np.clip(slow_wobble(n, 0.12, 0.6), 0.1, None) * 0.6
	chirp = norm(band(noise(n), 4200, 7500)) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 19 * tt))) * np.clip(slow_wobble(n, 0.3, 1.0), 0, None) * 0.12 * crickets
	for p in (-0.6, 0.6):
		add(start, (breeze + chirp) * e, gain * 0.7, p)


def embers(start: float, end: float, envpts, gain: float = 0.2, pan: float = 0.0) -> None:
	"""余烬：极轻的噼啪声和低低的闷燃"""
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	pops = np.zeros(n)
	for _ in range(int((end - start) * 6)):
		i = rng.integers(0, max(1, n - 3000))
		k = int(rng.uniform(80, 500))
		pops[i : i + k] += noise(k) * decay(k, rng.uniform(0.001, 0.004), 0.0003) * rng.uniform(0.2, 1) ** 2
	smoulder = norm(band(brown(n), 40, 300)) * slow_wobble(n, 0.4, 0.5) * 0.4
	add(start, (norm(band(pops, 1200, 9000)) * 0.6 + smoulder) * env(t, envpts), gain, pan)


def grass(start: float, end: float, envpts, gain: float = 0.25) -> None:
	"""草丛：叶片相互摩擦的沙沙声"""
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	for p in (-0.5, 0.5):
		sig = norm(band(noise(n), 1500, 7500, 0.6)) * np.clip(slow_wobble(n, 0.8, 0.8), 0.05, None)
		add(start, sig * env(t, envpts), gain * 0.7, p)


def gust(start: float, dur: float = 1.6, gain: float = 0.45) -> None:
	"""一阵风从右往左掠过草丛：呼啸 + 草叶被压弯的一大片沙沙声"""
	whoosh(start, dur, 500, 1800, gain, 0.9, -0.9, peak=0.45)
	n = int(dur * SR)
	u = np.arange(n) / n
	sh = np.exp(-(((u - 0.45) / 0.22) ** 2))
	add(start, norm(band(noise(n), 2000, 8000, 0.5)) * sh, gain * 0.5, np.linspace(0.9, -0.9, n))


def torches(start: float, end: float, envpts, gain: float = 0.3, pan: float = -0.2) -> None:
	"""一片火把：许多小火苗的呼呼声 + 稀疏的爆裂（人群只用火光表示，不加人声）"""
	fire(start, end, envpts, gain, pan, roar=0.6)
	n = int((end - start) * SR)
	t = start + np.arange(n) / SR
	flutter = norm(band(noise(n), 300, 2500, 0.5)) * np.clip(slow_wobble(n, 3.5, 0.9), 0.05, None)
	for p in (pan - 0.5, pan + 0.5):
		add(start, flutter * env(t, envpts), gain * 0.3, p)


def throw(start: float, pan0: float, pan1: float, gain: float = 0.35) -> None:
	"""徒劳的攻击：掷出的墨痕划破空气，半途散成墨雾"""
	whoosh(start, 0.6, 900, 2600, gain, pan0, pan1, peak=0.5)
	n = int(1.2 * SR)
	puff = band(noise(n), 200, 1800) * decay(n, 0.25, 0.02)
	add(start + 0.5, norm(puff), gain * 0.45, pan1)


def wings(start: float, dur: float, gain: float = 0.35, pan0: float = 0.0, pan1: float = 0.0, rate: float = 1.4) -> None:
	"""大鸟振翅：低沉的一下下扑风"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	beat = np.maximum(np.sin(2 * np.pi * rate * t), 0) ** 3
	body = norm(band(noise(n), 80, 900, 0.5)) * beat
	add(start, body * np.sin(np.pi * t / dur) ** 0.5, gain, np.linspace(pan0, pan1, n))


def ember_out(start: float, gain: float = 0.25, pan: float = 0.0) -> None:
	"""火中一点微光熄灭：一声下沉的轻叹（带通噪声往下扫）"""
	whoosh(start, 1.4, 2200, 300, gain, pan, pan, peak=0.15)


def wpan(x: float) -> float:
	"""画面 x（0–1920）→ 声像"""
	return pan_of_x(x / 1920)


# ─── 第 1 段：废墟（RuinsScene，今·月夜）─────────────────────────────────
s = 's1'
T1 = lambda f: t_of(s, f)
night_bed(T1(0), T1(600), [(T1(0), 0.0), (T1(40), 1.0), (T1(540), 1.0), (T1(594), 0.0)], 0.32)
T2 = lambda f: t_of('s2', f)
embers(T1(0), T1(600), [(T1(0), 0.4), (T1(300), 0.8), (T1(470), 1.0), (T1(600), 1.0)], 0.22)
wind(T1(360), T1(520), [(T1(360), 0.0), (T1(420), 0.7), (T1(470), 0.7), (T1(520), 0.0)], 0.18, 200, 1600, 0.3, 0.2)  # 越过断柱望向东塔
fire(T1(500), T2(40), [(T1(500), 0.0), (T1(565), 0.35), (T1(600), 1.2), (T2(40), 0.0)], 0.45, 0.0, roar=0.8)  # 余烬复燃，金光里散去
riser(T1(520), (594 - 520) / FPS, 0.3, 50, 120)
whoosh(T1(556), (600 - 556) / FPS + 1.3, 400, 4000, 0.4, 0, 0, peak=0.53)  # 金光漫满画面，峰值落在段落交界
shimmer(T1(565), 2.4, 0.18, 30, lo=1800, hi=8000)

# ─── 第 2 段：双塔（TwinScene，昔·古纸）──────────────────────────────────
s = 's2'
T2 = lambda f: t_of(s, f)
shimmer(T2(0), 1.6, 0.12, 20, lo=2000, hi=8000)  # 金光退去
air(T2(0), T2(780), [(T2(0), 0.0), (T2(40), 1.0), (T2(700), 1.0), (T2(780), 0.6)], 0.11)
wind(T2(0), T2(780), [(T2(0), 0.0), (T2(80), 0.35), (T2(640), 0.35), (T2(780), 0.8)], 0.16, 150, 1200, 0, 0.15)
shimmer(T2(370), (440 - 370) / FPS, 0.16, 22, lo=1800, hi=7000)  # 塔顶上空金光聚起
ink_bloom(T2(395), (440 - 395) / FPS + 1.0, 0.35)  # 凤王的墨影
shimmer(T2(440), (525 - 440) / FPS, 0.14, 18, lo=2500, hi=9000)  # 显出水墨画、淡彩渗入
brush(T2(488), 0.45, 0.11, -0.3)  # 名称卡
brush(T2(498), 0.35, 0.09, -0.25)
stamp(T2(530), 0.5, -0.35)  # 「凤王」朱砂印
whoosh(T2(600), (650 - 600) / FPS, 500, 300, 0.2, 0.3, -0.3, peak=0.5)  # 镜头平移到西塔
ink_bloom(T2(640), (700 - 640) / FPS + 1.5, 0.3, -0.1)  # 洛奇亚的淡墨影
rumble(T2(700), T2(780), [(T2(700), 0.0), (T2(780), 0.5)], 0.3)  # 云层压低，接第 3 段的雷

# ─── 第 3 段：雷火（FireScene）──────────────────────────────────────────
s = 's3'
T3 = lambda f: t_of(s, f)
rumble(T3(0), T3(110), [(T3(0), 0.5), (T3(100), 0.8), (T3(110), 0.0)], 0.3)
wind(T3(0), T3(900), [(T3(0), 0.8), (T3(100), 1.0), (T3(560), 0.7), (T3(640), 1.0), (T3(900), 0.5)], 0.26, 120, 1600, 0, 0.4)
thunder(T3(30), -0.5, near=0.3, muffled=True)  # 墨云压顶
thunder(T3(70), 0.4, near=0.4, muffled=True)
whoosh(T3(96), 0.3, 6000, 1500, 0.35, 0.3, 0.0, peak=0.8)  # 雷劈下来
thunder(T3(105), 0.0, near=1.0)  # 劈中相轮：本段的爆发
impact(T3(105), 1.0, 0.0, debris=True)
fire(T3(105), T3(710), [(T3(105), 0.0), (T3(130), 0.5), (T3(300), 1.0), (T3(560), 1.0), (T3(600), 0.9), (T3(710), 0.0)], 0.5, 0.0, roar=1.2)
rumble(T3(150), T3(560), [(T3(150), 0.0), (T3(300), 0.6), (T3(560), 0.6)], 0.3)  # 烟柱翻卷
for i, fr in enumerate((515, 540, 565)):  # 三点微光一一熄灭（机位静止）
	ember_out(T3(fr), 0.22, [-0.25, 0.0, 0.25][i])
thunder(T3(590), -0.3, near=0.5, muffled=True)
rain(T3(588), T3(900), [(T3(588), 0.0), (T3(640), 1.0), (T3(860), 0.6), (T3(900), 0.45)], 0.42)  # 骤雨
hiss(T3(600), T3(720), [(T3(600), 0.0), (T3(630), 1.0), (T3(710), 0.3), (T3(720), 0.0)], 0.35)  # 火被浇灭、水汽腾起
embers(T3(700), T3(900), [(T3(700), 0.6), (T3(900), 0.2)], 0.15)

# ─── 第 4 段：重生（RebirthScene，全片高潮）───────────────────────────────
s = 's4'
T4 = lambda f: t_of(s, f)
rain(T4(0), T4(80), [(T4(0), 0.45), (T4(70), 0.0), (T4(80), 0.0)], 0.42)  # 接第 3 段的雨，雨停
hiss(T4(0), T4(100), [(T4(0), 0.3), (T4(100), 0.0)], 0.3)
embers(T4(0), T4(100), [(T4(0), 0.2), (T4(100), 0.0)], 0.15)
wind(T4(0), T4(810), [(T4(0), 0.5), (T4(90), 0.25), (T4(810), 0.3)], 0.2, 150, 1200, 0, 0.15)
air(T4(60), t_of('s5', 140), [(T4(60), 0.0), (T4(120), 1.0), (T4(810), 1.0), (t_of('s5', 140), 0.0)], 0.1)  # 延续到第 5 段开头，交界不断
whoosh(T4(60), (210 - 60) / FPS, 2500, 700, 0.3, 0.1, -0.1, peak=0.6)  # 凤王自天而降
wings(T4(110), (210 - 110) / FPS, 0.22, 0.0, -0.1, 1.2)
shimmer(T4(100), (185 - 100) / FPS, 0.15, 20, lo=2000, hi=8000)
shimmer(T4(220), (300 - 220) / FPS, 0.16, 30, lo=2500, hi=9000)  # 三点微光从塔脚亮起、升起
riser(T4(230), (300 - 230) / FPS, 0.4)
impact(T4(300), 1.6, 0.0, debris=False)  # 金光爆开（全片最大的爆发点，叫声在视频里）
whoosh(T4(300), 1.6, 3000, 160, 0.7, 0, 0, peak=0.05)  # 光环推开
shimmer(T4(300), 3.0, 0.2, 40, lo=1500, hi=9000)
ink_bloom(T4(300), (378 - 300) / FPS + 1.0, 0.35)  # 三只的墨影 → 水墨画
brush(T4(424), 0.45, 0.11, 0.3)  # 总卡
brush(T4(436), 0.35, 0.09, 0.35)
brush(T4(448), 0.35, 0.09, 0.4)
# 雷 / 火 / 雨的淡彩依次化开（跟字幕三逐字出现的节奏）
thunder(T4(458), -0.5, near=0.25, muffled=True)
fire(T4(472), T4(560), [(T4(472), 0.0), (T4(490), 0.5), (T4(560), 0.0)], 0.3, 0.0, roar=0.8)
rain(T4(488), T4(600), [(T4(488), 0.0), (T4(510), 0.35), (T4(600), 0.0)], 0.25)

# ─── 第 5 段：恐惧（FearScene，昔·暮色）───────────────────────────────────
s = 's5'
T5 = lambda f: t_of(s, f)
wind(T5(0), T5(1020), [(T5(0), 0.3), (T5(140), 0.5), (T5(520), 0.5), (T5(700), 0.8), (T5(1020), 0.6)], 0.22, 120, 1300, 0, 0.2)
torches(T5(30), T5(980), [(T5(30), 0.0), (T5(150), 1.0), (T5(526), 1.0), (T5(700), 0.6), (T5(980), 0.2)], 0.32, -0.3)
rumble(T5(150), T5(320), [(T5(150), 0.0), (T5(300), 0.4), (T5(320), 0.0)], 0.25)  # 人影伸长
for i, fr in enumerate((322, 344, 364, 384, 404)):  # 徒劳的攻击
	throw(T5(fr), -0.6 + 0.1 * i, [-0.3, 0.0, 0.3][i % 3], 0.3)
# 字幕四"它们没有反击"：只剩风和火把
for i, fr in enumerate((526, 548, 572)):  # 三只依次向西奔走
	whoosh(T5(fr), 2.2, 600, 1800, 0.4, [-0.2, 0.0, 0.2][i], -1.0, peak=0.35)
	grass(T5(fr), T5(fr) + 2.4, [(T5(fr), 0.0), (T5(fr) + 0.6, 1.0), (T5(fr) + 2.4, 0.0)], 0.2)
whoosh(T5(700), (830 - 700) / FPS, 900, 3500, 0.3, 0.0, -0.2, peak=0.7)  # 凤王升入云中
wings(T5(700), (830 - 700) / FPS, 0.22, 0.0, -0.2, 1.0)
surf(T5(800), T5(1012), [(T5(800), 0.0), (T5(880), 0.6), (T5(980), 0.6), (T5(1012), 0.0)], 0.22, -0.5, 6.0)  # 远方的海
underwater(T5(900), T5(1000), [(T5(900), 0.0), (T5(960), 0.6), (T5(1000), 0.0)], 0.25, 0.8)  # 洛奇亚沉入深海
tide(T5(958), (1012 - 958) / FPS, rise=True, gain=0.55)  # 墨潮漫过画面

# ─── 第 6 段：等待（WaitScene，今·月夜）───────────────────────────────────
s = 's6'
T6 = lambda f: t_of(s, f)
tide(T6(0), 140 / FPS, rise=False, gain=0.5)  # 墨从中间化开
night_bed(T6(40), T6(900), [(T6(40), 0.0), (T6(140), 1.0), (T6(900), 1.0)], 0.32)
embers(T6(0), T6(260), [(T6(0), 0.0), (T6(120), 0.7), (T6(260), 0.0)], 0.18)
grass(T6(190), T6(900), [(T6(190), 0.0), (T6(300), 0.7), (T6(560), 0.6), (T6(700), 0.3), (T6(900), 0.25)], 0.22)
for fr in (262, 298, 336):  # 三阵风从右往左掠过草丛
	gust(T6(fr) - 0.2, 1.8, 0.42)
shimmer(T6(700), (900 - 700) / FPS, 0.07, 8, lo=3000, hi=9000)  # 七色月晕

# ─── 第 7 段：降临（DescendScene，今·破晓）────────────────────────────────
s = 's7'
T7 = lambda f: t_of(s, f)
night_bed(T7(0), T7(900), [(T7(0), 1.0), (T7(200), 0.35), (T7(215), 0.08), (T7(400), 0.08), (T7(500), 0.25), (T7(852), 0.25), (T7(900), 0.0)], 0.32, crickets=0.4)
grass(T7(0), T7(900), [(T7(0), 0.25), (T7(200), 0.15), (T7(215), 0.0), (T7(900), 0.0)], 0.22)
air(T7(0), T7(900), [(T7(0), 0.3), (T7(260), 1.0), (T7(852), 1.0), (T7(900), 0.0)], 0.09)
# 凤王降临前半秒几乎无声，然后自天而降（不放叫声）
whoosh(T7(215), (400 - 215) / FPS, 3000, 600, 0.32, 0.25, 0.15, peak=0.55)
wings(T7(240), (400 - 240) / FPS, 0.2, 0.25, 0.15, 1.1)
shimmer(T7(215), (400 - 215) / FPS, 0.14, 24, lo=2200, hi=9000, pan=0.2)  # 七色的光
shimmer(T7(300), (385 - 300) / FPS + 1.0, 0.12, 14, lo=1500, hi=6000, pan=0.15)  # 第一缕阳光照亮塔顶
# T.still 之后画面静止：只留极轻的空气声，让问句落下
stamp(T7(706), 0.22, -0.3)  # 「缘朱」朱砂印（结尾很静，压低）


# ─── 混音输出 ────────────────────────────────────────────────────────
mix = np.stack([L, R], axis=1)
# 轻微的软限幅，防止大爆发削顶；整体峰值压到 -3 dBFS
mix = np.tanh(mix / (np.max(np.abs(mix)) * 0.7))
mix = mix / np.max(np.abs(mix)) * 10 ** (-3 / 20)

# 叫声在视频里：叫声响起时把音效压低约 8 dB（闪避），免得盖住叫声；帧号取自 TwinScene（T.cry）、RebirthScene（T.burst、T.cries）
CRIES = [t_of('s2', 478), t_of('s4', 300), t_of('s4', 376), t_of('s4', 392), t_of('s4', 408)]
duck_db = np.zeros(N)
tt = np.arange(N) / SR
for c in CRIES:
	shape = np.interp(tt, [c - 0.06, c, c + 1.6, c + 2.2], [0, 1, 1, 0], left=0, right=0)
	duck_db = np.maximum(duck_db, shape * 8.0)
mix = mix * (10 ** (-duck_db / 20))[:, None]
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
write_wav(root / 'out' / 'tower-sfx.wav', mix)
for name, frames in SEGMENTS:
	a = int(OFFSET[name] * SR)
	b = int((OFFSET[name] + frames / FPS) * SR)
	write_wav(root / 'out' / 'sfx' / f'tower-{name}-sfx.wav', mix[a:b])
print(f'tower-sfx.wav: {TOTAL:.2f}s, peak -3 dBFS')

