"""《空间的形状》音效轨：全部现场合成（numpy / scipy），不取用任何素材或旧期音效。

用法：python tools/space_sfx.py
输出：out/空间的形状/space-sfx.wav（整期，和配乐、上中下三篇一样从第 0 帧对齐）
      out/空间的形状/sfx/space-part{1,2,3}-sfx.wav（按三篇切开）

声音的思路（和画面"全息维度"对应）：
- 空间 = 玻璃、珍珠：高频的玻璃音、铃音、细碎的光尘；被撕开时是撕裂 + 碎玻璃。
- 时间 = 钴蓝：低沉的脉冲、心跳；只在帝牙卢卡出现的地方用。
- 镜头运动 = 风声 / 呼啸（带通噪声扫频），速度越快越亮。
- 叫声在视频轨里，音效在显色那一下让出中频，不抢叫声。
时间点全部按 30fps 帧号 / 小节换算，和 src/scenes/space/*.tsx 里的常量一一对应。
"""

from __future__ import annotations

import math
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, istft, sosfilt, stft

SR = 48000
BEAT = 60 / 112.905
BAR = BEAT * 4
T0 = 0.087
TOTAL = 4594 / 30  # 第 72 小节强拍（整期最后一帧之后）
PARTS = [(0, 1406), (1406, 2809), (2809, 4594)]

OUT = os.path.join('out', '空间的形状')


def bt(bar: float, beat: float = 0, frames: float = 0) -> float:
	"""第 bar 小节第 beat 拍（beat 从 0 起）再加 frames 个 30fps 帧，换成秒。"""
	return T0 + bar * BAR + beat * BEAT + frames / 30


rng_master = np.random.default_rng(20261026)


def rng(seed: int):
	return np.random.default_rng(seed)


def n_of(d: float) -> int:
	return max(1, int(round(d * SR)))


def tvec(d: float):
	return np.arange(n_of(d)) / SR


# ════════ 基本积木 ════════


def sos(kind: str, f, order=2):
	return butter(order, f, btype=kind, fs=SR, output='sos')


def lp(x, f, order=2):
	return sosfilt(sos('lowpass', f, order), x)


def hp(x, f, order=2):
	return sosfilt(sos('highpass', f, order), x)


def bp(x, f0, f1, order=2):
	return sosfilt(sos('bandpass', [f0, f1], order), x)


def norm(x):
	m = np.max(np.abs(x)) + 1e-12
	return x / m


def env_ad(n, a, d, curve=4.0):
	"""起音 a 秒、按指数衰减 d 秒的包络（总长 n 个采样）。"""
	t = np.arange(n) / SR
	att = np.clip(t / max(a, 1e-4), 0, 1)
	dec = np.exp(-np.maximum(t - a, 0) / max(d, 1e-4) * curve / 4)
	return att * dec


def env_swell(n, peak=0.7, p_in=2.0, p_out=2.0):
	"""从 0 涨到峰值（在 peak 比例处）再落回 0。"""
	u = np.linspace(0, 1, n)
	up = np.clip(u / peak, 0, 1) ** p_in
	down = np.clip((1 - u) / (1 - peak + 1e-6), 0, 1) ** p_out
	return np.minimum(up, down)


def osc(freq, d, phase=0.0, shape='sine'):
	"""freq 可以是数或数组（滑音）。"""
	n = n_of(d)
	f = np.broadcast_to(np.asarray(freq, dtype=float), (n,)) if np.ndim(freq) else np.full(n, float(freq))
	ph = phase + 2 * np.pi * np.cumsum(f) / SR
	if shape == 'sine':
		return np.sin(ph)
	if shape == 'tri':
		return 2 / np.pi * np.arcsin(np.sin(ph))
	if shape == 'saw':
		return 2 * ((ph / (2 * np.pi)) % 1) - 1
	raise ValueError(shape)


def glide(f0, f1, d, curve=1.0):
	u = np.linspace(0, 1, n_of(d)) ** curve
	return f0 * (f1 / f0) ** u


def noise(d, seed):
	return rng(seed).standard_normal(n_of(d))


def sweep(d, f0, f1, seed, bw=0.7, curve=1.0, fc=None):
	"""带通噪声扫频（呼啸、气流）：中心频率按指数从 f0 走到 f1，带宽 bw 个八度。用 STFT 做时变滤波。"""
	n = n_of(d)
	x = rng(seed).standard_normal(n + 4096)
	f, tt, Z = stft(x, SR, nperseg=2048, noverlap=1536)
	u = np.clip(tt / d, 0, 1) ** curve
	c = fc(np.clip(tt / d, 0, 1)) if fc is not None else f0 * (f1 / f0) ** u
	ff = np.maximum(f, 1.0)[:, None]
	mask = np.exp(-0.5 * (np.log2(ff / c[None, :]) / bw) ** 2)
	_, y = istft(Z * mask, SR, nperseg=2048, noverlap=1536)
	return norm(y[:n])


def bell(f, d, partials=((1, 1, 1), (2.76, 0.5, 0.6), (5.4, 0.28, 0.38), (8.93, 0.14, 0.22)), a=0.004):
	"""玻璃 / 铃：非谐泛音，高泛音衰减更快。partials = (倍数, 音量, 衰减比例)。"""
	t = tvec(d)
	out = np.zeros_like(t)
	for k, (m, g, dk) in enumerate(partials):
		out += g * np.sin(2 * np.pi * f * m * t + k) * np.exp(-t / (d * dk / 3))
	return out * np.clip(t / a, 0, 1)


def pluck(f, d, seed, bright=0.5):
	"""Karplus–Strong 拨弦（绷紧的细线）。"""
	n = n_of(d)
	L = max(2, int(SR / f))
	buf = rng(seed).uniform(-1, 1, L)
	out = np.zeros(n)
	for i in range(n):
		j = i % L
		out[i] = buf[j]
		nxt = buf[(j + 1) % L]
		buf[j] = 0.996 * (bright * buf[j] + (1 - bright) * 0.5 * (buf[j] + nxt))
	return out


def thump(f0, f1, d, click=0.3, seed=1):
	"""低频冲击：下滑的正弦 + 一点点击声。"""
	t = tvec(d)
	s = osc(glide(f0, f1, d, 0.5), d) * np.exp(-t / (d / 3.5))
	c = hp(noise(min(d, 0.03), seed), 1500) * np.exp(-tvec(min(d, 0.03)) / 0.006)
	s[: len(c)] += click * c
	return s


def shatter(d, seed, density=80, lo=2200, hi=9500):
	"""碎玻璃：大量随机的短玻璃音 + 高频噪声。"""
	r = rng(seed)
	n = n_of(d)
	out = np.zeros(n)
	for _ in range(density):
		t0 = r.exponential(d * 0.18)
		if t0 > d * 0.9:
			continue
		f = r.uniform(lo, hi)
		dd = r.uniform(0.03, 0.25)
		g = bell(f, dd, partials=((1, 1, 1), (1.5 + r.uniform(0, 1.5), 0.4, 0.5)), a=0.0008) * r.uniform(0.2, 1)
		i = n_of(t0)
		m = min(len(g), n - i)
		out[i : i + m] += g[:m]
	nz = hp(noise(d, seed + 7), 3000) * env_ad(n, 0.002, d * 0.3)
	return norm(out) * 0.8 + 0.35 * nz


def tear(d, seed, f0=2500, f1=400):
	"""撕裂：带通扫频噪声 + 急促的颗粒调制（像纤维一根根断开）。"""
	n = n_of(d)
	base = sweep(d, f0, f1, seed, bw=1.1, curve=0.6)
	r = rng(seed + 3)
	grain = np.zeros(n)
	pos = 0
	while pos < n:
		pos += int(r.exponential(SR * 0.006)) + 1
		if pos < n:
			grain[pos] = r.uniform(0.3, 1)
	grain = lp(grain, 4000) * 30
	am = 0.35 + np.clip(grain, 0, 3)
	return norm(base * am) * env_ad(n, 0.01, d * 0.7)


def sparkle(d, seed, rate=40, lo=3000, hi=11000, ramp=None):
	"""光尘：稀疏的高频小亮点。ramp(u) 控制密度随时间变化。"""
	r = rng(seed)
	n = n_of(d)
	out = np.zeros(n)
	t = 0.0
	while t < d:
		u = t / d
		k = rate * (ramp(u) if ramp else 1) + 1e-3
		t += r.exponential(1 / k)
		if t >= d:
			break
		g = bell(r.uniform(lo, hi), r.uniform(0.05, 0.3), partials=((1, 1, 1), (2.01, 0.3, 0.5)), a=0.001) * r.uniform(0.2, 1)
		i = n_of(t)
		m = min(len(g), n - i)
		out[i : i + m] += g[:m]
	return out


def ticks(times, seed, f=3200, d=0.025):
	"""一串干净的小咔哒（读数、刻度）。times 为相对秒。"""
	end = max(times) + d + 0.05
	out = np.zeros(n_of(end))
	for k, t in enumerate(times):
		c = bell(f * (1 + 0.02 * (k % 3)), d, partials=((1, 1, 1), (2.4, 0.4, 0.5)), a=0.0005)
		cl = hp(noise(0.004, seed + k), 2000) * np.exp(-tvec(0.004) / 0.001)
		c[: len(cl)] += 0.4 * cl
		i = n_of(t)
		out[i : i + len(c)] += c[: len(out) - i]
	return out


def clink(f, d, seed):
	"""金属链环的碰撞：非谐泛音，短。"""
	r = rng(seed)
	parts = ((1, 1, 1), (2.32, 0.6, 0.7), (4.08, 0.4, 0.5), (6.1 + r.uniform(0, 0.4), 0.25, 0.35))
	return bell(f * r.uniform(0.94, 1.06), d, partials=parts, a=0.0006)


def drone(freqs, d, seed, detune=0.004, lpf=1400):
	t = tvec(d)
	r = rng(seed)
	out = np.zeros_like(t)
	for f in freqs:
		for s in (-1, 1):
			out += osc(f * (1 + s * detune * r.uniform(0.5, 1.5)), d, phase=r.uniform(0, 6.28), shape='saw')
	return norm(lp(out, lpf, 2))


def rumble(d, seed, f=60):
	return norm(lp(noise(d, seed), f * 3, 4) + 0.6 * osc(f, d))


def reverse(x):
	return x[::-1].copy()


# ════════ 混音台 ════════


class Mix:
	def __init__(self, dur):
		self.n = n_of(dur)
		self.dry = np.zeros((self.n, 2))
		self.send = np.zeros((self.n, 2))

	def add(self, sig, t, gain=1.0, pan=0.0, send=0.25, width=0.0):
		"""sig 单声道；pan 为数或数组（−1 左 … 1 右）；width 给左右一点点时间差，让声音更宽。"""
		sig = np.asarray(sig, dtype=float) * gain
		i = n_of(t)
		if i >= self.n:
			return
		m = min(len(sig), self.n - i)
		sig = sig[:m]
		p = np.broadcast_to(np.asarray(pan, dtype=float), (len(np.atleast_1d(pan)),))
		p = p[:m] if p.size > 1 else np.full(m, float(p[0]))
		gl = np.cos((p + 1) * np.pi / 4)
		gr = np.sin((p + 1) * np.pi / 4)
		L = sig * gl
		R = sig * gr
		if width > 0:
			k = int(width * SR)
			R = np.concatenate([np.zeros(k), R])[:m]
		self.dry[i : i + m, 0] += L
		self.dry[i : i + m, 1] += R
		self.send[i : i + m, 0] += L * send
		self.send[i : i + m, 1] += R * send

	def render(self):
		# 混响：带早期反射的指数衰减噪声，左右各一条，尾巴越往后越暗
		d = 3.2
		t = tvec(d)
		irs = []
		for s in (11, 12):
			ir = rng(s).standard_normal(len(t)) * np.exp(-t / 0.75)
			ir = lp(ir, 5200) * 0.6 + lp(ir, 1800) * 0.4
			ir[: n_of(0.012)] = 0
			irs.append(ir / np.sqrt(np.sum(ir**2)))
		wet = np.stack([fftconvolve(self.send[:, c], irs[c])[: self.n] for c in range(2)], axis=1)
		out = self.dry + wet * 0.9
		# 柔和限幅，再把峰值压到 −1 dBFS
		out = np.tanh(out * 1.1) / np.tanh(1.1)
		peak = np.max(np.abs(out)) + 1e-9
		out *= 10 ** (-1 / 20) / peak
		# 开头 2 ms 淡入；结尾 0.7 秒淡到无声（混响尾巴也收掉），循环播放时接回开场不突兀
		k = n_of(0.002)
		out[:k] *= np.linspace(0, 1, k)[:, None]
		k = n_of(0.7)
		out[-k:] *= (np.linspace(1, 0, k) ** 2)[:, None]
		return out


# ════════ 编排：按画面一段一段放 ════════


def build():
	M = Mix(TOTAL)
	add = M.add
	seed = iter(range(1000, 100000, 7))
	S = lambda: next(seed)  # noqa: E731

	# ── 1 钩子（0–5 小节）──
	# 第 3 帧：一道裂痕闪过屏幕——极短的玻璃"叮"加一丝高频的嘶
	add(bell(4200, 0.9, partials=((1, 1, 1), (1.47, 0.6, 0.6), (2.93, 0.4, 0.4), (4.1, 0.25, 0.3)), a=0.0005), bt(0), 0.45, pan=0.35, send=0.4)
	add(hp(noise(0.12, S()), 5000) * env_ad(n_of(0.12), 0.001, 0.05), bt(0), 0.25, pan=0.3)
	# 0.0–0.2：裂痕里细细的颤音（等待时的微光）
	add(osc(glide(5200, 5600, bt(0, 2) - bt(0)), bt(0, 2) - bt(0)) * env_swell(n_of(bt(0, 2) - bt(0)), 0.85) * 0.08, bt(0), 1, pan=0.2, send=0.5)
	# 0.2：裂开——低频冲击 + 碎玻璃 + 两半往后翻的风声
	o = bt(0, 2)
	add(thump(70, 28, 1.8, click=0.5, seed=S()), o, 0.9, send=0.3)
	add(shatter(1.2, S(), density=60), o, 0.55, pan=-0.1, send=0.45, width=0.008)
	add(tear(0.35, S(), 6000, 1500), o - 0.02, 0.4, send=0.2)
	add(sweep(1.2, 900, 220, S(), bw=0.9) * env_ad(n_of(1.2), 0.02, 0.6), o, 0.35, pan=np.linspace(-0.6, 0.6, n_of(1.2)), send=0.3)
	# 0.3–2.0：冲进裂缝的气流，越冲越亮
	d = bt(2) - bt(0, 3)
	add(sweep(d, 250, 3200, S(), bw=0.8, curve=1.4) * env_swell(n_of(d), 0.55, 1.5, 1.2), bt(0, 3), 0.55, send=0.2, width=0.006)
	# 2.2、2.3：深处闪过两点珍珠光——两声远处的玻璃铃
	add(bell(1568, 2.4), bt(2, 2), 0.28, pan=-0.25, send=0.7)
	add(bell(2093, 2.4), bt(2, 3), 0.26, pan=0.25, send=0.7)
	# 3.0–4.0：两点光变亮——很轻的上行和声
	d = bt(4) - bt(3)
	add(drone([392, 587], d, S(), lpf=2500) * env_swell(n_of(d), 0.9, 1.6, 3) * 0.12, bt(3), 1, send=0.6)
	# 4.0 起：片名五个字逐字凸出（每字隔半拍）——针板墙"咔嗒"一声 + 一小记低音
	for k in range(5):
		t = bt(4, k * 0.5)
		add(ticks([0, 0.012, 0.03], S(), f=2600 + 180 * k), t, 0.35, pan=(k - 2) * 0.25, send=0.3)
		add(thump(120, 70, 0.25, click=0.1, seed=S()), t, 0.3, pan=(k - 2) * 0.25, send=0.2)
	# 5.0：片名缩回——一串细小的倒抽声
	add(reverse(ticks([0.01 * k * k for k in range(14)], S(), f=3000)) * 0.8, bt(5) - 0.05, 0.3, send=0.3)
	# 5.0–6.0：网格开始发抖
	d = bt(6) - bt(5)
	add(rumble(d, S(), 45) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * tvec(d))) * env_swell(n_of(d), 0.6), bt(5), 0.3, send=0.2)

	# ── 2 呼吸与登场（6–13 小节）──
	# 6、7 小节：一呼一吸（前半吸、后半呼），每呼一次网格稳一点
	for k, g in ((6, 0.32), (7, 0.24)):
		dh = BAR / 2
		inh = sweep(dh, 500, 1300, S(), bw=0.9) * env_swell(n_of(dh), 0.85, 1.5, 3)
		exh = sweep(dh * 1.1, 1100, 450, S(), bw=1.0) * env_swell(n_of(dh * 1.1), 0.25, 2, 1.6)
		add(inh, bt(k), g, send=0.3)
		add(exh, bt(k, 2), g * 0.9, send=0.3)
		add(rumble(BAR, S(), 40) * env_swell(n_of(BAR), 0.5) * (1 - (k - 6) * 0.5), bt(k), 0.12)
	# 7.3 → 8.0：显色前的吸气式上扬（倒放的铃）
	add(reverse(bell(1046, 1.6)) * 0.9, bt(8) - 1.6, 0.25, send=0.6)
	# 8.0：帕路奇亚显色——给叫声让出中频：只用超低频的"落地"和极高的珍珠闪光
	add(thump(55, 30, 2.2, click=0.0, seed=S()), bt(8), 0.7, send=0.2)
	add(hp(sparkle(1.4, S(), rate=60, lo=6000, hi=12000, ramp=lambda u: max(0, 1 - u)), 4000), bt(8), 0.35, send=0.6, width=0.01)
	# 8.1：名称卡逐字浮现——四下很轻的刻字声
	add(ticks([0, BEAT * 0.25, BEAT * 0.5, BEAT * 0.75], S(), f=3600, d=0.02), bt(8, 1), 0.18, pan=0.5, send=0.3)
	# 10.0：一叠玻璃层依次滑出（每层隔四分之一拍）
	for k in range(6):
		g = sweep(0.35, 1800 + 300 * k, 5200 + 400 * k, S(), bw=0.45) * env_ad(n_of(0.35), 0.03, 0.2)
		add(g, bt(10, k * 0.25), 0.22, pan=-0.5 + 0.2 * k, send=0.4)
		add(bell(2637 + 220 * k, 0.6, a=0.002), bt(10, k * 0.25) + 0.08, 0.06, pan=-0.5 + 0.2 * k, send=0.5)
	# 10.0–12.2：镜头绕到书页的侧面——慢慢的气流
	d = bt(12, 2) - bt(10, 2)
	add(sweep(d, 300, 700, S(), bw=1.0) * env_swell(n_of(d), 0.5), bt(10, 2), 0.18, pan=np.linspace(0.6, -0.4, n_of(d)), send=0.3)
	# 12.2–13.2：一切缩成一个点——倒放的呼啸收进去，最后一声小"叮"
	d = bt(13, 2) - bt(12, 2)
	add(sweep(d, 3000, 600, S(), bw=0.8) * env_swell(n_of(d), 0.92, 2.5, 6), bt(12, 2), 0.35, send=0.3)
	add(bell(3136, 1.2), bt(13, 2), 0.22, send=0.6)

	# ── 3 长宽高与无边无际（14–21 小节）──
	# 14.0 点拉成线：一道细光"嗖"
	add(osc(glide(500, 1800, 0.22), 0.22) * env_ad(n_of(0.22), 0.005, 0.12), bt(14), 0.25, pan=np.linspace(-0.4, 0.4, n_of(0.22)), send=0.4)
	# 14.2 线扫成面
	add(sweep(0.4, 800, 3500, S(), bw=0.5) * env_ad(n_of(0.4), 0.02, 0.25), bt(14, 2), 0.3, send=0.35)
	# 15.0 面立成体
	add(osc(glide(220, 440, 0.3), 0.3, shape='tri') * env_ad(n_of(0.3), 0.01, 0.2), bt(15), 0.25, send=0.4)
	# 15.1–15.3 晶格往外长三圈：三声越来越亮的晶体敲击
	for k in range(3):
		add(bell(880 * 2 ** (k * 4 / 12), 1.2, a=0.001), bt(15, 1 + k), 0.24 + 0.05 * k, pan=(k - 1) * 0.4, send=0.5)
		add(ticks([0, 0.02], S(), f=4000 + 600 * k), bt(15, 1 + k), 0.2, send=0.3)
	# 15.3 → 16.0：上扬
	d = bt(16) - bt(15, 2)
	add(sweep(d, 600, 6000, S(), bw=0.6, curve=1.8) * env_swell(n_of(d), 0.98, 2.2, 8), bt(15, 2), 0.35, send=0.2)
	# 16.0 落拍：玻璃墙炸开——冲击 + 大片碎玻璃 + 镜头急退的风
	add(thump(62, 26, 2.4, click=0.6, seed=S()), bt(16), 1.0, send=0.3)
	add(shatter(2.4, S(), density=160), bt(16), 0.75, send=0.55, width=0.012)
	add(sweep(2.0, 1800, 200, S(), bw=0.9) * env_ad(n_of(2.0), 0.03, 1.0), bt(16), 0.45, send=0.3, width=0.01)
	# 16.1–17.2：碎片在星海里慢慢散开——稀疏的余响
	d = bt(17, 2) - bt(16, 1)
	add(sparkle(d, S(), rate=14, lo=2500, hi=8000, ramp=lambda u: 1 - u), bt(16, 1), 0.2, send=0.7, width=0.01)
	# 17.2–18.2：地面一格一格熄灭——细碎的电流声
	d = bt(18, 2) - bt(17, 2)
	add(hp(sparkle(d, S(), rate=120, lo=1500, hi=6000, ramp=lambda u: math.sin(math.pi * u)), 1000), bt(17, 2), 0.18, send=0.3, width=0.01)
	# 19.2："你"——一声很近、很轻的木质小音，和后面越来越远的声音对比
	add(bell(659.3, 1.4, partials=((1, 1, 1), (3.0, 0.2, 0.3)), a=0.002), bt(19, 2), 0.14, send=0.15)
	add(lp(noise(1.6, S()), 220) * env_swell(n_of(1.6), 0.4), bt(18, 3), 0.1)
	# 尺度飞行：19.3→20.0 拉远到地球（快）
	d = bt(20) - bt(19, 3)
	add(sweep(d + 0.15, 4000, 400, S(), bw=0.7) * env_swell(n_of(d + 0.15), 0.75, 1.5, 2.5), bt(19, 3), 0.5, send=0.2, width=0.008)
	add(thump(90, 45, 0.8, click=0.15, seed=S()), bt(20), 0.4, send=0.3)
	# 20.2：光一秒绕地球七圈半——一圈一次的"嗖"，左右来回
	d = 1.0
	tt = tvec(d)
	whirr = osc(1400 + 300 * np.sin(2 * np.pi * 7.5 * tt), d) * (0.5 + 0.5 * np.cos(2 * np.pi * 7.5 * tt)) * env_ad(n_of(d), 0.02, 0.9)
	add(whirr, bt(20, 2), 0.16, pan=np.sin(2 * np.pi * 7.5 * tt) * 0.8, send=0.3)
	add(bell(2349, 1.0), bt(20, 2) + 1.0, 0.16, send=0.5)
	# 21.0→21.2：一口气飞过太阳到银河（更长、更深）
	d = bt(21, 2) - bt(21)
	add(sweep(d + 0.2, 6000, 180, S(), bw=0.8, curve=0.8) * env_swell(n_of(d + 0.2), 0.7, 1.4, 2.5), bt(21), 0.6, send=0.25, width=0.01)
	add(sweep(0.3, 2000, 900, S(), bw=0.4) * env_swell(n_of(0.3), 0.5), bt(21, 1) - 0.15, 0.18, pan=0.5, send=0.4)  # 太阳一闪而过
	add(thump(60, 30, 1.6, click=0.1, seed=S()), bt(21, 2), 0.55, send=0.35)
	add(drone([110, 164.8, 220], 2.4, S(), lpf=900) * env_swell(n_of(2.4), 0.2, 1.5, 2) * 0.35, bt(21, 2), 1, send=0.5)
	# 光横穿银河：读数一路滚（越滚越快），跑完一声"叮"
	ca = bt(21, 2, 6)
	cb = bt(22, 2)
	nt = 26
	ts = [(cb - ca) * (k / nt) ** 0.8 for k in range(nt)]
	add(ticks(ts, S(), f=2800, d=0.018), ca, 0.13, pan=0.55, send=0.2)
	add(bell(1760, 1.6), cb, 0.22, pan=0.4, send=0.6)

	# ── 4 胀大与弯曲（22–29 小节）──
	# 22.3→23.1：银河往里缩成面团
	d = bt(23, 1) - bt(22, 3)
	add(reverse(sweep(d, 300, 2500, S(), bw=0.8)) * env_swell(n_of(d), 0.9, 2, 5), bt(22, 3), 0.35, send=0.3)
	add(thump(140, 90, 0.4, click=0.0, seed=S()), bt(23, 1), 0.25, send=0.3)
	# 23.1–25.2：面团胀大——两条慢慢往上滑的低音，像面团被撑开
	d = bt(25, 2) - bt(23, 1)
	tt = tvec(d)
	f1 = 82 * (1.5 ** (tt / d))
	stretch = osc(f1, d, shape='tri') + 0.7 * osc(f1 * 1.503, d, shape='tri') + 0.3 * osc(f1 * 2.01, d)
	add(lp(stretch, 600) * env_swell(n_of(d), 0.8, 1.2, 2) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.9 * tt)), bt(23, 1), 0.2, send=0.3)
	add(lp(noise(d, S()), 300) * env_swell(n_of(d), 0.8) * 0.4, bt(23, 1), 0.12, send=0.1)
	# 25.2：面团溶成宇宙网——晶体一点点长出来
	d = bt(26, 2) - bt(25, 2)
	add(sparkle(d, S(), rate=50, lo=1800, hi=7000, ramp=lambda u: min(1, u * 2) * (1 - u * 0.5)), bt(25, 2), 0.24, send=0.6, width=0.01)
	# 26.2：网压平——往下的风
	add(sweep(0.8, 2500, 300, S(), bw=0.7) * env_swell(n_of(0.8), 0.4), bt(26, 2), 0.3, send=0.3)
	# 26.3→27.0：保龄球落下（下行的哨声）→ 27.0 落在蹦床上：闷响 + 弹回的"嘣"
	d = bt(27) - bt(26, 3)
	add(osc(glide(1500, 500, d, 1.6), d) * env_swell(n_of(d), 0.95, 2, 6) * 0.5 + 0.5 * sweep(d, 1200, 400, S(), bw=0.4) * env_swell(n_of(d), 0.95, 2, 6), bt(26, 3), 0.18, send=0.3)
	add(thump(75, 35, 1.0, click=0.35, seed=S()), bt(27), 0.75, send=0.25)
	tt = tvec(1.6)
	boing = osc(58 * (1 + 0.25 * np.exp(-tt / 0.25) * np.sin(2 * np.pi * 9 * tt)), 1.6) * np.exp(-tt / 0.55)
	add(boing, bt(27), 0.45, send=0.2)
	# 28.0–30.0：弹珠绕坑滚——滚动声随它的位置左右移动（和 bend.tsx 的 marbleAt 同一个积分）
	d = bt(30) - bt(28)
	nfr = int(d * 30) + 2
	th = 2.75
	pans = []
	for k in range(nfr + 8):
		r = 4.4 + 4.6 * math.exp(-k / 46)
		th += 0.085 * (6 / r) ** 1.5
		pans.append(math.cos(th))
	pans = np.array(pans[8:])
	pan = np.interp(np.arange(n_of(d)) / SR * 30, np.arange(len(pans)), pans) * 0.85
	roll = lp(noise(d, S()), 900) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 13 * tvec(d)))) + 0.3 * lp(hp(noise(d, S()), 2500), 6000)
	add(roll * env_swell(n_of(d), 0.5, 0.6, 1.2), bt(28), 0.22, pan=pan, send=0.15)
	# 28.0–30.0：星光流向坑底的上扬（第二次上扬）
	add(sweep(d, 300, 7000, S(), bw=0.7, curve=1.6) * env_swell(n_of(d), 0.99, 2.4, 10), bt(28), 0.4, send=0.3, width=0.008)
	add(osc(glide(220, 880, d, 1.5), d, shape='tri') * env_swell(n_of(d), 0.99, 2.4, 10) * 0.5, bt(28), 0.18, send=0.4)
	# 29.0：保龄球变成太阳——"呼"地燃起，暖色的低音铺底
	add(sweep(0.9, 200, 1600, S(), bw=1.0) * env_ad(n_of(0.9), 0.08, 0.5), bt(29), 0.35, send=0.3)
	add(drone([98, 147, 196], bt(30) - bt(29), S(), lpf=800) * env_swell(n_of(bt(30) - bt(29)), 0.95, 1.2, 8) * 0.4, bt(29), 1, send=0.3)
	# 星光绕过太阳：一道高光从左扫到右
	d = BEAT * 3.2
	add(osc(glide(3500, 2600, d), d) * env_swell(n_of(d), 0.5) * 0.4 + sweep(d, 4000, 3000, S(), bw=0.3) * env_swell(n_of(d), 0.5), bt(29, 0, 2), 0.2, pan=np.linspace(-0.9, 0.9, n_of(d)), send=0.5)
	# 第 29 小节第 2 拍：1919 年的标注——一声很轻的刻字
	add(ticks([0, 0.03], S(), f=3000), bt(29, 1), 0.12, pan=-0.7, send=0.2)

	# ── 5 起源形态与亚空裂斩（30–35 小节）──
	o = bt(30)
	add(thump(48, 22, 3.0, click=0.5, seed=S()), o, 1.0, send=0.35)
	add(hp(shatter(1.6, S(), density=70, lo=5000, hi=12000), 3500), o, 0.3, send=0.7, width=0.012)
	add(sweep(1.2, 600, 3000, S(), bw=0.9) * env_ad(n_of(1.2), 0.01, 0.6), o + 0.05, 0.35, pan=np.linspace(0.3, -0.3, n_of(1.2)), send=0.4)  # 网面翻起
	# 珍珠母贝的和声：一层很亮、慢慢呼吸的玻璃和弦（叫声之后才浮起来）
	d = bt(32, 2) - bt(30, 1)
	chord = sum(bell(f, d * 0.9, partials=((1, 1, 1), (2.0, 0.3, 0.8)), a=0.4) for f in (1318.5, 1661.2, 1975.5, 2489.0))
	add(chord * env_swell(n_of(d * 0.9), 0.3, 1.5, 1.2), bt(30, 1), 0.06, send=0.8, width=0.015)
	# 32.2 扭曲（打旋）
	d = 0.5
	add(sweep(d, 400, 1800, S(), bw=0.6, fc=lambda u: 900 * 2 ** (0.9 * np.sin(2 * np.pi * 2.5 * u))) * env_swell(n_of(d), 0.5), bt(32, 2), 0.4, pan=np.sin(np.linspace(0, 5 * np.pi, n_of(d))) * 0.7, send=0.3)
	# 32.3 打碎
	add(shatter(1.0, S(), density=90, lo=1800, hi=8000), bt(32, 3), 0.6, send=0.45, width=0.01)
	add(thump(110, 60, 0.4, click=0.4, seed=S()), bt(32, 3), 0.4)
	# 33.0 再造：碎片倒着飞回来（倒放），落在一声金色的和弦上
	rev = reverse(shatter(0.5, S(), density=70, lo=1800, hi=8000))
	add(rev, bt(33) - 0.5, 0.45, send=0.4, width=0.01)
	gold = sum(bell(f, 2.6, a=0.003) * g for f, g in ((523.3, 1), (659.3, 0.8), (784.0, 0.7), (1046.5, 0.5)))
	add(gold, bt(33), 0.22, send=0.7, width=0.012)
	# 33.3→35.0 蓄力：越来越尖的嗡鸣 + 光尘往一处汇
	d = bt(35) - bt(33, 3)
	tt = tvec(d)
	whine = osc(glide(220, 1760, d, 2.0), d, shape='saw')
	add(lp(whine, 4000) * env_swell(n_of(d), 0.995, 2.6, 30) * (0.7 + 0.3 * np.sin(2 * np.pi * glide(4, 18, d) * tt)), bt(33, 3), 0.16, send=0.3)
	add(sparkle(d, S(), rate=40, lo=3000, hi=9000, ramp=lambda u: u * u), bt(33, 3), 0.22, send=0.5, width=0.01)
	add(rumble(d, S(), 38) * env_swell(n_of(d), 0.995, 3, 30), bt(33, 3), 0.35)
	# 35.0 亚空裂斩：一道极快的斩（从右上划到左下）+ 撕开 + 冲击 + 金属般的尾音
	o = bt(35)
	add(sweep(0.18, 9000, 2500, S(), bw=0.5) * env_ad(n_of(0.18), 0.005, 0.1), o - 3 / 30, 0.7, pan=np.linspace(0.8, -0.8, n_of(0.18)), send=0.3)
	add(tear(0.9, S(), 5000, 600), o, 0.75, send=0.35, width=0.008)
	add(thump(55, 24, 2.4, click=0.7, seed=S()), o, 1.0, send=0.3)
	tt = tvec(3.0)
	ring = (osc(1244, 3.0) * osc(87, 3.0) + 0.5 * osc(1867, 3.0) * osc(61, 3.0)) * np.exp(-tt / 0.9)
	add(ring, o, 0.12, send=0.7, width=0.015)
	# 35.1–36.2：裂口张开、镜头穿过去
	d = bt(36, 2) - bt(35, 1)
	add(sweep(d, 250, 2400, S(), bw=0.9, curve=1.3) * env_swell(n_of(d), 0.7, 1.4, 2), bt(35, 1), 0.5, pan=np.linspace(-0.3, 0.5, n_of(d)), send=0.3, width=0.01)

	# ── 6 折纸与捷径（36–43 小节，静段）──
	# 它的世界：缎带飘着——气声的底 + 稀疏的玻璃
	d = bt(39, 1) - bt(36)
	tt = tvec(d)
	air = sweep(d, 600, 900, S(), bw=1.6, fc=lambda u: 700 * 2 ** (0.5 * np.sin(2 * np.pi * 0.35 * u * d)))
	add(air * env_swell(n_of(d), 0.2, 1.2, 1.5), bt(36), 0.14, send=0.5, width=0.015)
	add(sparkle(d, S(), rate=3, lo=1200, hi=4000), bt(36), 0.14, send=0.85, width=0.015)
	# 37.1 一道细线一下接通：绷紧的弦
	add(pluck(659.3, 2.2, S(), bright=0.35), bt(37, 1), 0.35, pan=-0.1, send=0.5)
	add(bell(2637, 1.2), bt(37, 1), 0.12, send=0.6)
	# 37.2 光点一步跳过去：一声"嗖"从左到右，落地一声"叮"
	jt = bt(37, 2)
	add(osc(glide(900, 2600, 0.23), 0.23) * env_ad(n_of(0.23), 0.004, 0.15), jt, 0.25, pan=np.linspace(-0.6, 0.6, n_of(0.23)), send=0.4)
	add(bell(3520, 1.0), jt + 7 / 30, 0.2, pan=0.5, send=0.6)
	# 39.1 一张白纸亮起：柔和的"呼"+ 纸的沙沙声
	add(sweep(0.9, 300, 1400, S(), bw=1.2) * env_ad(n_of(0.9), 0.15, 0.5), bt(39, 1), 0.25, send=0.5)
	rust = lambda d, s: hp(sparkle(d, s, rate=260, lo=2500, hi=7000, ramp=lambda u: math.sin(math.pi * u)), 2000) * 0.6 + hp(noise(d, s + 1), 3000) * env_swell(n_of(d), 0.5) * 0.25  # noqa: E731
	add(rust(0.5, S()), bt(39, 1) + 0.1, 0.12, send=0.2)
	# 41.1→42.0：纸慢慢对折
	d = bt(42) - bt(41, 1)
	add(rust(d, S()), bt(41, 1), 0.2, pan=np.linspace(0.4, -0.3, n_of(d)), send=0.25)
	add(sweep(d, 900, 350, S(), bw=0.9) * env_swell(n_of(d), 0.6), bt(41, 1), 0.15, send=0.3)
	# 42.1：中间长出一条管道（虫洞）——空心的共鸣，往上走
	d = BEAT * 2.5
	tt = tvec(d)
	hollow = sum(osc(glide(f, f * 1.5, d), d) / (k + 1) for k, f in enumerate((180, 360, 540, 900)))
	add(lp(hollow, 2500) * env_swell(n_of(d), 0.35, 1.2, 2) * (0.8 + 0.2 * np.sin(2 * np.pi * 6 * tt)), bt(42, 1), 0.22, send=0.6, width=0.01)
	add(ticks([0], S(), f=2400), bt(42, 1, 10), 0.1, pan=-0.6, send=0.3)  # "假说"的标注
	# 43.1：纸摊平、变暗
	d = BEAT * 2
	add(rust(d, S()), bt(43, 1), 0.15, send=0.2)
	add(thump(130, 80, 0.4, click=0.2, seed=S()), bt(43, 1) + d, 0.2, send=0.3)
	# 43.2 起：折痕的红光——低沉的嗡，一直接到锁链
	d = bt(46) - bt(43, 2)
	tt = tvec(d)
	hum = osc(55, d) + 0.5 * osc(110.3, d) + 0.25 * osc(165.2, d) + 0.15 * osc(220.6, d)
	add(hum * env_swell(n_of(d), 0.55, 1.5, 1.2) * (0.85 + 0.15 * np.sin(2 * np.pi * 3 * tt)), bt(43, 2), 0.22, send=0.2)

	# ── 7 枪之柱（44–54 小节）──
	# 44.0–45.2：红光一环一环长成锁链
	n_links = 15
	for k in range(n_links):
		t = bt(44) + (bt(45, 2) - bt(44)) * (k / n_links) ** 0.8
		add(clink(1900 + 60 * (k % 4), 0.35, S()), t, 0.18, pan=0.1 * math.sin(k), send=0.35)
	# 46.0→47.2：锁链往上下伸长，垂到祭坛——一路哗啦
	d = bt(47, 2) - bt(46)
	r = rng(S())
	tc = 0.0
	while tc < d:
		tc += r.exponential(0.03 + 0.05 * (1 - tc / d))
		add(clink(r.uniform(1300, 2600), 0.25, S()), bt(46) + tc, 0.1 * r.uniform(0.4, 1), pan=r.uniform(-0.3, 0.3), send=0.3)
	add(thump(90, 50, 0.6, click=0.5, seed=S()), bt(47, 2), 0.45, send=0.4)  # 锁链落在祭坛上
	# 46.2–55.3：山顶的风（第 50 小节起更大），雪横着飞
	d = bt(55, 3) - bt(46, 2)
	tt = tvec(d)
	u = tt / d
	ramp = np.interp(tt, [0, bt(50) - bt(46, 2), bt(53) - bt(46, 2), bt(55) - bt(46, 2), d], [0.35, 0.45, 1.0, 0.8, 0.0])
	fade_in = np.clip(tt / 1.5, 0, 1)
	gust = 0.75 + 0.25 * np.sin(2 * np.pi * 0.23 * tt + 1) * np.sin(2 * np.pi * 0.11 * tt)
	w1 = sweep(d, 400, 900, S(), bw=1.3, fc=lambda x: 500 * 2 ** (0.6 * np.sin(2 * np.pi * 0.2 * x * d) + 0.8 * np.clip((x * d - (bt(50) - bt(46, 2))) / 6, 0, 1)))
	w2 = sweep(d, 1500, 3000, S(), bw=0.8, fc=lambda x: 1800 * 2 ** (0.5 * np.sin(2 * np.pi * 0.31 * x * d + 2)))
	add((w1 + 0.4 * w2) * ramp * fade_in * gust, bt(46, 2), 0.32, pan=0.3 * np.sin(2 * np.pi * 0.07 * tt), send=0.25, width=0.02)
	# 48.2：两条锁链甩上天——两记鞭响，口子被撕开（左低右高）
	w0 = bt(48, 2, -6)
	for k, (dt, pan_) in enumerate(((0, -0.5), (4 / 30, 0.5))):
		add(sweep(0.25, 1500, 7000, S(), bw=0.6) * env_ad(n_of(0.25), 0.01, 0.12), w0 + dt, 0.45, pan=pan_, send=0.3)
		add(hp(noise(0.015, S()), 2000) * np.exp(-tvec(0.015) / 0.003), w0 + dt + 0.22, 0.8, pan=pan_, send=0.4)
	add(tear(0.7, S(), 1800, 300), bt(48, 2, 8), 0.5, pan=-0.6, send=0.4)
	add(tear(0.7, S(), 4500, 900), bt(48, 2, 12), 0.45, pan=0.6, send=0.4)
	# 口子里的声音：左边钴蓝（时间）是每拍一下的深沉脉动，右边珍珠（空间）是发亮的颤音
	d = bt(55, 1) - bt(48, 3)
	tt = tvec(d)
	pulse = np.zeros(n_of(d))
	for k in range(int(d / BEAT) + 1):
		p = thump(64, 52, 0.45, click=0.05, seed=S())
		i = n_of(k * BEAT)
		m = min(len(p), len(pulse) - i)
		if m > 0:
			pulse[i : i + m] += p[:m]
	grow = np.interp(tt, [0, 1.5, bt(52) - bt(48, 3), bt(53) - bt(48, 3), bt(54) - bt(48, 3), d], [0, 0.5, 0.8, 1.0, 0.6, 0])
	add(pulse * grow, bt(48, 3), 0.28, pan=-0.6, send=0.3)
	shim = osc(2093 * (1 + 0.006 * np.sin(2 * np.pi * 6.5 * tt)), d) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.8 * tt)) + 0.5 * osc(3136 * (1 + 0.008 * np.sin(2 * np.pi * 5.1 * tt)), d)
	add(shim * grow, bt(48, 3), 0.05, pan=0.6, send=0.6)
	# 50–52：锁链收紧——吱嘎声越来越密，紧张的上扬一直推到 53.0
	d = bt(53) - bt(50)
	r = rng(S())
	tc = 0.0
	while tc < d:
		tc += r.exponential(0.35 * (1 - tc / d) + 0.05)
		f0 = r.uniform(90, 160)
		cr = sweep(0.3, f0 * 3, f0 * 5, S(), bw=0.3) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * r.uniform(25, 45) * tvec(0.3)))) * env_swell(n_of(0.3), 0.3)
		add(cr, bt(50) + tc, 0.12 * (0.4 + tc / d), pan=r.choice([-0.5, 0.5]), send=0.2)
	add(sweep(d, 200, 6000, S(), bw=0.7, curve=2.0) * env_swell(n_of(d), 0.995, 2.8, 30), bt(50), 0.45, send=0.25, width=0.01)
	add(osc(glide(110, 440, d, 1.8), d, shape='saw') * env_swell(n_of(d), 0.995, 2.8, 30), bt(50), 0.06, send=0.3)
	add(rumble(d, S(), 32) * env_swell(n_of(d), 0.995, 2.5, 30), bt(50), 0.4)
	# 52.0：帝牙卢卡显色——冲击压低，让叫声在中频
	add(thump(46, 26, 2.0, click=0.0, seed=S()), bt(52), 0.75, send=0.3)
	add(sweep(0.8, 3000, 500, S(), bw=0.8) * env_ad(n_of(0.8), 0.01, 0.4), bt(52), 0.25, pan=-0.5, send=0.4)
	# 53.0：两股力量正面撞上（全片最大）：先抽空一拍（倒放），再炸开
	o = bt(53)
	add(reverse(sweep(0.5, 400, 8000, S(), bw=1.0)) * env_swell(n_of(0.5), 0.9, 2, 8), o - 0.5, 0.5, send=0.2)
	add(thump(42, 18, 4.0, click=1.0, seed=S()), o, 1.4, send=0.35)
	add(lp(noise(2.5, S()), 1200, 2) * env_ad(n_of(2.5), 0.005, 0.9), o, 0.7, send=0.5, width=0.015)
	add(shatter(2.0, S(), density=120, lo=1500, hi=9000), o, 0.5, send=0.6, width=0.015)
	tt = tvec(4.0)
	ring = (osc(830, 4.0) * osc(37, 4.0) + 0.6 * osc(1245, 4.0) * osc(53, 4.0) + 0.4 * osc(311, 4.0)) * np.exp(-tt / 1.3)
	add(ring, o, 0.16, send=0.8, width=0.02)
	add(sweep(1.6, 2500, 150, S(), bw=1.0) * env_ad(n_of(1.6), 0.01, 0.8), o, 0.55, pan=np.linspace(0, 0, n_of(1.6)), send=0.3, width=0.025)  # 冲击波往外扩
	# 断柱被扭弯：低沉的石头呻吟
	d = 1.2
	groan = sweep(d, 160, 90, S(), bw=0.25) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * glide(30, 14, d) * tvec(d))))
	add(lp(groan, 600) * env_swell(n_of(d), 0.3), o + 0.1, 0.35, send=0.35)
	# 54.0：整个画面被撕开——巨大的撕裂 + 撕口里白热的呼啸（停住）
	o = bt(54)
	add(tear(1.4, S(), 7000, 250), o, 1.0, pan=np.linspace(0.6, -0.6, n_of(1.4)), send=0.35, width=0.012)
	add(thump(50, 22, 2.5, click=0.6, seed=S()), o, 0.9, send=0.3)
	add(hp(shatter(1.2, S(), density=60, lo=3000, hi=11000), 2500), o, 0.35, send=0.6, width=0.01)
	d = bt(55) - o
	tt = tvec(d)
	hiss = sweep(d, 2500, 1800, S(), bw=1.4) * (0.85 + 0.15 * np.sin(2 * np.pi * 11 * tt))
	add(hiss * env_swell(n_of(d), 0.15, 1, 0.8), o + 0.1, 0.3, send=0.3, width=0.02)
	# 55.0→55.3：裂口慢慢合拢——倒吸进去，归于安静
	d = bt(55, 3) - bt(55)
	add(reverse(sweep(d, 300, 3000, S(), bw=1.0)) * env_swell(n_of(d), 0.85, 1.4, 6), bt(55), 0.4, send=0.5)
	add(bell(392, 3.0, a=0.01), bt(55, 3), 0.12, send=0.8)

	# ── 8 一块布（55–65 小节）──
	# 布织出来、起伏：很轻的布料翻动 + 两层织线的和声（低的钴蓝、高的珍珠）
	d = bt(64) - bt(55, 1)
	tt = tvec(d)
	flutter = lp(noise(d, S()), 500) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.45 * tt) ** 2)
	add(flutter * env_swell(n_of(d), 0.08, 1.4, 1.2), bt(55, 1), 0.12, send=0.3, width=0.02)
	low = drone([73.4, 110], d, S(), lpf=500)
	high = sum(osc(f * (1 + 0.003 * np.sin(2 * np.pi * 0.3 * tt + k)), d) for k, f in enumerate((1174.7, 1760.0)))
	weave_env = np.interp(tt, [0, 1.5, bt(58) - bt(55, 1), bt(60, 2) - bt(55, 1), bt(61) - bt(55, 1), bt(62) - bt(55, 1), d], [0, 1, 0.55, 0.55, 0.15, 1, 1])
	add(low * weave_env, bt(55, 1), 0.1, pan=-0.25, send=0.4)
	add(high * weave_env, bt(55, 1), 0.025, pan=0.25, send=0.7)
	# 58.0：太阳的光沿一条线走到地球（2.5 拍），到了一声轻轻的"叮"
	d = BEAT * 2.5
	add(osc(glide(2600, 1900, d), d) * env_swell(n_of(d), 0.8) * 0.3 + sweep(d, 3500, 1800, S(), bw=0.4) * env_swell(n_of(d), 0.8), bt(58), 0.18, pan=np.linspace(0.5, -0.5, n_of(d)), send=0.5)
	add(bell(1568, 1.8), bt(58) + d, 0.18, pan=-0.5, send=0.6)
	add(ticks([0, 0.03], S(), f=3000), bt(58, 2), 0.1, pan=0.4, send=0.3)  # 太阳的标注
	# 59.0 月亮、59.2 仙女座：近的一声清、远的一声远（混响多）
	add(bell(2093, 1.4), bt(59), 0.16, pan=-0.4, send=0.5)
	add(bell(1396.9, 3.0), bt(59, 2), 0.12, pan=-0.2, send=0.95)
	# 穹顶的星点浮现
	add(sparkle(BEAT * 3, S(), rate=25, lo=4000, hi=10000, ramp=lambda u: 1 - u), bt(59), 0.12, send=0.7, width=0.015)
	# 59.2→60.1 绕到侧面、60.3→61.1 回到正面：两次大的风
	for a, b, p0, p1 in ((bt(59, 2), bt(60, 1), -0.6, 0.6), (bt(60, 3), bt(61, 1), 0.6, -0.6)):
		d = b - a
		add(sweep(d, 300, 1500, S(), bw=0.9) * env_swell(n_of(d), 0.5, 1.5, 1.5), a, 0.3, pan=np.linspace(p0, p1, n_of(d)), send=0.3)
	add(ticks([0, 0.05, 0.1, 0.15], S(), f=2600), bt(60) + 0.1, 0.1, pan=0.3, send=0.3)  # 时间轴的刻度
	# 60.2：一点淡金的光；61.0 分出两道光——一条往下（钴蓝）、一条往上（珍珠），往两边织开
	add(bell(523.3, 3.0, a=0.05), bt(60, 2), 0.18, send=0.7)
	d = bt(62, 3) - bt(61)
	add(osc(glide(523.3, 196, d, 0.6), d, shape='tri') * env_ad(n_of(d), 0.02, d * 0.7), bt(61), 0.12, pan=np.linspace(0, -0.7, n_of(d)), send=0.5)
	add(osc(glide(523.3, 1568, d, 0.6), d) * env_ad(n_of(d), 0.02, d * 0.7), bt(61), 0.08, pan=np.linspace(0, 0.7, n_of(d)), send=0.6)
	add(sweep(d, 600, 4000, S(), bw=0.5, curve=0.6) * env_ad(n_of(d), 0.05, d * 0.6), bt(61), 0.14, send=0.4, width=0.015)
	# 63.1：光尘凝成一颗颗微粒（"物质"）——先散后聚，落成清楚的小颗粒声
	d = BEAT * 3
	add(sparkle(d, S(), rate=90, lo=2000, hi=9000, ramp=lambda u: max(0, 1 - u * 1.4)), bt(63, 1) - 0.3, 0.12, send=0.5, width=0.01)
	add(ticks([0.06 * k + 0.01 * (k % 3) for k in range(12)], S(), f=3800, d=0.03), bt(63, 1) + 0.25, 0.12, pan=0.2, send=0.4)
	# 64–65：两道光绕着彼此越转越近（左右转圈、越转越快），布折过来——上扬推到 66.0
	d = bt(66) - bt(64)
	tt = tvec(d)
	k = tt / d
	ang = k * k * np.pi * 8
	orbit_a = osc(glide(392, 784, d, 1.5), d) * env_swell(n_of(d), 0.97, 1.6, 12)
	orbit_b = osc(glide(587, 1174, d, 1.5), d, shape='tri') * env_swell(n_of(d), 0.97, 1.6, 12)
	add(orbit_a, bt(64), 0.1, pan=np.cos(ang) * 0.8, send=0.4)
	add(orbit_b, bt(64), 0.07, pan=-np.cos(ang) * 0.8, send=0.4)
	add(sweep(d, 300, 5000, S(), bw=0.8, curve=1.8) * env_swell(n_of(d), 0.985, 2.4, 20), bt(64), 0.35, send=0.3)
	# 66.0：拍平成开场的屏幕——一声干脆的"啪"，随后几乎无声
	add(thump(95, 50, 0.5, click=0.6, seed=S()), bt(66), 0.55, send=0.2)
	add(hp(noise(0.08, S()), 1200) * env_ad(n_of(0.08), 0.001, 0.03), bt(66), 0.35, send=0.3)
	add(bell(784, 2.0, a=0.003), bt(66), 0.08, send=0.7)

	# ── 9 回到屏幕（66–72 小节）──
	# 67.0：一条虚线从下往上画到屏幕——一节一声，到头一声"叮"
	ts = [k * (14 / 30) / 9 for k in range(9)]
	add(ticks(ts, S(), f=3300, d=0.015), bt(67), 0.12, pan=0.5, send=0.3)
	add(bell(2637, 1.4), bt(67, 0, 14), 0.16, pan=0.5, send=0.6)
	# 70.1 起：呼吸（上方的珍珠光）和心跳（下方的钴蓝钻石）；71.1 两者对上
	pa = bt(70, 1)
	sync = bt(71, 1)
	for kk in range(4):
		t = pa + kk * BEAT * 2
		lub = thump(58, 44, 0.35, click=0.02, seed=S())
		dub = thump(50, 40, 0.3, click=0.0, seed=S())
		g = 0.42 * (1 - 0.15 * max(0, kk - 2))
		add(lub, t, g, send=0.15)
		add(dub, t + 6 / 30, g * 0.6, send=0.15)
	for kk in range(4):
		# 呼吸的峰：起初比心跳晚大半拍，到 71.1 对上（和 fabric.tsx 的 breathAt 一致）
		t_peak = pa + kk * BEAT * 2
		lag = BEAT * 0.9 * (1 - min(1, max(0, (t_peak - pa) / (sync - pa))) ** 2 * (3 - 2 * min(1, max(0, (t_peak - pa) / (sync - pa)))))
		dh = BEAT * 1.6
		br = sweep(dh, 700, 1200, S(), bw=1.0) * env_swell(n_of(dh), 0.5, 1.6, 1.6)
		add(br, t_peak + lag - dh / 2, 0.12 * (1 - 0.2 * max(0, kk - 2)), send=0.4)
	# 同步那一下之上一声很轻的长铃（片尾最后约 0.7 秒在 render 里淡到无声，重播时接回开场的裂痕）
	add(bell(1046.5, 1.6, partials=((1, 1, 1), (2.0, 0.3, 0.6), (3.01, 0.15, 0.4)), a=0.02), sync, 0.06, send=0.7)

	return M


def write(path, x):
	os.makedirs(os.path.dirname(path), exist_ok=True)
	wavfile.write(path, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))


def main():
	M = build()
	out = M.render()
	write(os.path.join(OUT, 'space-sfx.wav'), out)
	for k, (a, b) in enumerate(PARTS, 1):
		write(os.path.join(OUT, 'sfx', f'space-part{k}-sfx.wav'), out[n_of(a / 30) : n_of(b / 30)])
	print('done', out.shape[0] / SR, 's')


if __name__ == '__main__':
	main()
