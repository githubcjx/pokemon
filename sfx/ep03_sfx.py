"""
第 3 期《生命之源》音效轨（不是配乐：没有旋律，只有环境声与动作音效）。
全部用 numpy 程序合成，不使用外部素材。时间轴与八段首尾相接后的整期一致（0 秒 = 第 1 段第一帧），
音效节点直接取自各段场景代码（src/scenes/ep03/*.tsx）里的帧号。叫声在视频里，这里不含。

水墨这一期的声音以"水"为主：墨滴入水、墨潮涌退、纸与毛笔、朱砂印落纸；
第 4 段的火与墨爆，第 6 段的洞窟（滴水回声、幽暗的水）、火焰与念力的交战，第 7 段的丛林。

输出：
  out/ep03-sfx.wav               整期音效（48kHz 立体声 16 位，峰值 -3 dBFS）
  out/sfx/ep03-s1-sfx.wav … s8   按段切开的音效

用法：python sfx/ep03_sfx.py
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
FPS = 30  # 时间轴按 30fps 帧号编写，与场景代码一致

# 各段时长（30fps 帧数），与 src/scenes/ep03/*Scene.tsx 的 *_SCENE_FRAMES 一致
SEGMENTS = [('s1', 660), ('s2', 600), ('s3', 720), ('s4', 500), ('s5', 660), ('s6', 840), ('s7', 660), ('s8', 330)]
OFFSET = {}
_acc = 0.0
for _name, _frames in SEGMENTS:
	OFFSET[_name] = _acc
	_acc += _frames / FPS
TOTAL = _acc

N = int(TOTAL * SR)
L = np.zeros(N, dtype=np.float64)
R = np.zeros(N, dtype=np.float64)
rng = np.random.default_rng(20261003)


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


def wpan(x: float) -> float:
	"""主体层的 x（0–1920）→ 声像"""
	return pan_of_x(x / 1920)


# ─── 第 1 段：幻之宝可梦（MirageScene）──────────────────────────────────
s = 's1'
T1 = lambda f: t_of(s, f)
air(T1(0), T1(660), [(T1(0), 0.0), (T1(60), 1.0), (T1(660), 1.0)], 0.1)
tide(T1(0), T1(150) - T1(0), rise=False, gain=0.55)  # 墨退，露出古纸
whoosh(T1(150), T1(176) - T1(150), 2500, 900, 0.18, 0, 0, peak=0.9)  # 墨滴下落
drip(T1(176), 1.3, 0.0, gain=0.7)
ink_bloom(T1(176), 3.0, 0.35)
drip(T1(214), 0.8, wpan(800), gain=0.45)
drip(T1(240), 0.7, wpan(1135), gain=0.4)
ink_bloom(T1(258), T1(336) - T1(258), 0.4)  # 墨影洇满轮廓
shimmer(T1(318), T1(378) - T1(318), 0.14, 20, lo=1800, hi=7000)  # 显出水墨画
shimmer(T1(380), T1(440) - T1(380), 0.12, 14, lo=2500, hi=9000)  # 淡彩渗入
brush(T1(394), 0.5, 0.12, -0.3)  # 名称卡
brush(T1(404), 0.4, 0.1, -0.2)
stamp(T1(438), 0.45, 0.4)
whoosh(T1(556), T1(660) - T1(556), 400, 2500, 0.45, 0.0, 0.9, peak=0.75)  # 梦幻飞向远处

# ─── 第 2 段：祖先（AncestorScene）──────────────────────────────────────
s = 's2'
T2 = lambda f: t_of(s, f)
wind(T2(0), T2(600), [(T2(0), 0.4), (T2(80), 0.6), (T2(480), 0.6), (T2(600), 0.3)], 0.22, 200, 1800, 0, 0.12)  # 远山的风
whoosh(T2(0), T2(100) - T2(0), 600, 2000, 0.3, -0.9, 0.0, peak=0.3)  # 梦幻从左侧飞入
shimmer(T2(100), T2(170) - T2(100), 0.18, 22)  # 周身泛起泥金光
KIN_X = [960 + np.cos(np.radians(192 + i * (348 - 192) / 7)) * 820 for i in range(8)]
ORDER = [3, 4, 2, 5, 1, 6, 0, 7]
for i in range(8):
	st = 150 + ORDER.index(i) * 13
	whoosh(T2(st), 82 / FPS, 300, 1800, 0.12, 0.0, wpan(KIN_X[i]), peak=0.6)  # 墨丝生长
	brush(T2(st), 82 / FPS * 0.8, 0.05, wpan(KIN_X[i]))
	ink_bloom(T2(st + 70), 1.4, 0.12, wpan(KIN_X[i]))  # 枝头洇出剪影
	drip(T2(st + 78), 0.4, wpan(KIN_X[i]), gain=0.15)
shimmer(T2(150), T2(330) - T2(150), 0.1, 18)
tide(T2(486), T2(600) - T2(486), rise=True, gain=0.6)  # 墨潮漫开

# ─── 第 3 段：日记（DiaryScene）─────────────────────────────────────────
s = 's3'
T3 = lambda f: t_of(s, f)
tide(T3(0), T3(120) - T3(0), rise=False, gain=0.5)
air(T3(0), T3(720), [(T3(0), 0.0), (T3(80), 1.0), (T3(640), 1.0), (T3(720), 0.0)], 0.1)
# 三条日记逐字写出（字数取自场景的 ENTRIES，RATE = 2.6），右页的那条声像偏右
writing(T3(156), 35, 2.6, 0.09, -0.4)
writing(T3(318), 23, 2.6, 0.09, -0.4)
writing(T3(452), 32, 2.6, 0.09, 0.4)
for k in range(5):
	brush(T3(244 + k * 15), 0.35, 0.08, -0.3)  # 梦幻的白描速写
whoosh(T3(580), T3(602) - T3(580), 2500, 900, 0.18, 0.4, 0.45, peak=0.9)  # 墨滴下落
drip(T3(602), 1.2, 0.45, gain=0.6)
ink_bloom(T3(602), 2.0, 0.3, 0.45)
tide(T3(640), T3(720) - T3(640), rise=True, gain=0.6, pan=0.3)  # 推进墨渍，浓墨涌出

# ─── 第 4 段：失控（RampageScene）───────────────────────────────────────
s = 's4'
T4 = lambda f: t_of(s, f)
tide(T4(0), 1.4, rise=False, gain=0.4)  # 接上段涌上来的墨潮，慢慢退去
fire(T4(0), T4(500), [(T4(0), 0.15), (T4(60), 0.4), (T4(224), 0.5), (T4(232), 1.3), (T4(420), 1.0), (T4(500), 0.6)], 0.5, 0.0)
writing(T4(40), 28, 2.0, 0.1, -0.1, shaky=True)  # 潦草、颤抖的第四条日记
riser(T4(150), T4(224) - T4(150), 0.4)  # 画面发颤、镜头压近
rumble(T4(150), T4(230), [(T4(150), 0.0), (T4(222), 1.0), (T4(230), 0.0)], 0.45)
impact(T4(224), 1.4, 0.0, debris=False)  # 墨从纸页中心炸开
whoosh(T4(224), 1.2, 3000, 200, 0.6, 0, 0, peak=0.05)
fire(T4(226), T4(420), [(T4(226), 1.2), (T4(300), 0.8), (T4(420), 0.5)], 0.45, 0.0, roar=1.5)  # 火线吞噬纸页
rumble(T4(234), T4(404), [(T4(234), 0.0), (T4(274), 0.9), (T4(356), 0.7), (T4(404), 0.0)], 0.45)  # 超梦的剪影
wind(T4(380), T4(500), [(T4(380), 0.0), (T4(500), 0.6)], 0.25, 200, 1500, 0, 0.3)  # 烟与余烬上升

# ─── 第 5 段：被造之物（CreatedScene）───────────────────────────────────
s = 's5'
T5 = lambda f: t_of(s, f)
fire(T5(0), T5(110), [(T5(0), 0.6), (T5(110), 0.0)], 0.35, 0.0, roar=0.4)  # 余烬
# 墨云漩涡：低沉的旋风，声像缓缓绕圈
n5 = int((T5(660) - T5(0)) * SR)
x5 = T5(0) + np.arange(n5) / SR
swirl_pan = np.sin(2 * np.pi * np.arange(n5) / SR / 6.0) * 0.6
sw = norm(band(noise(n5), 120, 1500, 0.6)) * np.clip(slow_wobble(n5, 0.5, 0.6), 0.1, None)
sw *= env(x5, [(T5(0), 0.9), (T5(200), 0.45), (T5(576), 0.45), (T5(660), 1.3)])
add(T5(0), sw, 0.3, swirl_pan)
ink_bloom(T5(170), T5(250) - T5(170), 0.4)  # 超梦洇出墨影
riser(T5(236), T5(300) - T5(236), 0.3, 40, 80)  # 显出纯墨的水墨画
brush(T5(312), 0.5, 0.12, 0.4)
brush(T5(322), 0.4, 0.1, 0.5)
stamp(T5(356), 0.45, 0.6)
whoosh(T5(576), T5(660) - T5(576), 300, 2200, 0.5, 0, 0, peak=0.85)  # 漩涡加速合拢
rumble(T5(600), T5(660), [(T5(600), 0.0), (T5(660), 1.0)], 0.45)

# ─── 第 6 段：为战斗而生（BattleScene）─────────────────────────────────
s = 's6'
T6 = lambda f: t_of(s, f)
MT, CZ = wpan(560), wpan(1420)
tide(T6(0), T6(130) - T6(0), rise=False, gain=0.45)
cave_bed(T6(0), T6(840), [(T6(0), 0.3), (T6(100), 1.0), (T6(460), 1.0), (T6(640), 0.5), (T6(760), 1.0), (T6(840), 0.8)], 0.42, 0.0, 0.5)
fire(T6(226), T6(780), [(T6(226), 0.0), (T6(300), 0.55), (T6(690), 0.5), (T6(780), 0.0)], 0.3, CZ + 0.15, roar=0.6)  # 洞口的火光 / 尾巴的火焰
brush(T6(345), 0.5, 0.12, -0.6)
brush(T6(355), 0.4, 0.1, -0.5)
stamp(T6(390), 0.45, -0.4)
psy_hum(T6(436), T6(780) - T6(436), 0.3, MT)  # 超梦周身的墨云
breath_fire(T6(490), T6(534) - T6(490), 0.75, CZ, MT + 0.2)  # 火墨扑向超梦
impact(T6(504), 0.45, MT + 0.2, debris=False)  # 被墨云挡下
whoosh(T6(532), T6(576) - T6(532), 200, 1600, 0.6, MT, CZ, peak=0.4)  # 念力的浓墨反卷回去
psy_hum(T6(532), T6(576) - T6(532), 0.4, 0.0, 45, 70, 9)
impact(T6(546), 0.45, CZ - 0.1, debris=False)  # 喷火龙被逼退
breath_fire(T6(596), T6(654) - T6(596), 0.7, CZ, 0.05)  # 两股力量冲向中间、相持
psy_hum(T6(596), T6(650) - T6(596), 0.45, -0.1, 50, 95, 12)
riser(T6(608), T6(640) - T6(608), 0.45)
rumble(T6(600), T6(645), [(T6(600), 0.0), (T6(638), 1.0), (T6(645), 0.0)], 0.5)
impact(T6(640), 1.9, 0.05, debris=True, splash=True)  # 对撞：全片最大的爆发
whoosh(T6(640), 1.5, 2500, 150, 0.8, 0, 0, peak=0.05)  # 冲击波
fire(T6(640), T6(760), [(T6(640), 1.0), (T6(700), 0.4), (T6(760), 0.0)], 0.4, 0.1, roar=0.3)  # 火星与余烬
ink_bloom(T6(660), 4.0, 0.35, 0.0)  # 墨烟慢慢化开、沉下去
rumble(T6(770), T6(840), [(T6(770), 0.0), (T6(840), 0.6)], 0.35)

# ─── 第 7 段：两种命运（FatesScene）────────────────────────────────────
s = 's7'
T7 = lambda f: t_of(s, f)
cave_bed(T7(0), T7(660), [(T7(0), 0.8), (T7(190), 0.6), (T7(600), 0.55), (T7(660), 0.0)], 0.4, 0.55, 0.35)  # 右：洞窟
whoosh(T7(30), T7(190) - T7(30), 1500, 400, 0.35, -0.9, 0.0, peak=0.5)  # 墨缝扫过
jungle_bed(T7(40), T7(660), [(T7(40), 0.0), (T7(190), 1.0), (T7(600), 1.0), (T7(660), 0.0)], 0.3, -0.55)  # 左：丛林
shimmer(T7(150), T7(206) - T7(150), 0.18, 24, pan=wpan(470))  # 梦幻洇出
whoosh(T7(272), T7(302) - T7(272), 1200, 6000, 0.18, wpan(470), wpan(470), peak=0.5)  # 像水汽一样淡去
shimmer(T7(272), T7(302) - T7(272), 0.12, 30, lo=4000, hi=11000, pan=wpan(470))
shimmer(T7(330), T7(372) - T7(330), 0.16, 26, pan=wpan(660))  # 在另一处浮现
ink_bloom(T7(470), T7(570) - T7(470), 0.35, 0.0)  # 两边的墨交汇
shimmer(T7(500), 3.0, 0.08, 10, pan=0.3)
tide(T7(606), T7(660) - T7(606), rise=True, gain=0.55)

# ─── 第 8 段：鸣谢（CreditsScene）──────────────────────────────────────
s = 's8'
T8 = lambda f: t_of(s, f)
tide(T8(0), T8(100) - T8(0), rise=False, gain=0.45)
air(T8(0), T8(330), [(T8(0), 0.0), (T8(80), 1.0), (T8(290), 1.0), (T8(330), 0.0)], 0.1)
shimmer(T8(48), 4.0, 0.06, 6)
stamp(T8(246), 0.5, 0.0)  # 「生命之源」朱砂印
tide(T8(294), T8(330) - T8(294), rise=True, gain=0.45)

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
write_wav(root / 'out' / 'ep03-sfx.wav', mix)
for name, frames in SEGMENTS:
	a = int(OFFSET[name] * SR)
	b = int((OFFSET[name] + frames / FPS) * SR)
	write_wav(root / 'out' / 'sfx' / f'ep03-{name}-sfx.wav', mix[a:b])
print(f'ep03-sfx.wav: {TOTAL:.2f}s, peak -3 dBFS')
