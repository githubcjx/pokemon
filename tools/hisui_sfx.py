"""《神奥之名》音效轨（v2，2026-10-31 重做）：全部现场合成（numpy / scipy），不取用任何素材或旧期音效。

用法：python tools/hisui_sfx.py
输出：out/神奥之名/hisui-sfx-v2.wav（整期，从第 0 帧对齐）
      out/神奥之名/sfx/hisui-s{1..9}-<段名>-sfx-v2.wav（按段切开，和各段成片对齐）
      out/神奥之名/sfx/hisui-part{1,2,3}-sfx-v2.wav（上中下三篇）

声音的思路（画风「雪峰与天裂」）：
- 底子是山顶的风：今天的月夜偏冷偏空，古代的黄昏偏暖偏轻；海边换成浪。
- 裂缝 = 很低的嗡鸣和缓慢翻涌的气流；雷都是远处滚过来的闷雷，不要炸裂的脆响。
- 神（金光、阿尔宙斯）= 温暖的和声铺底，加很轻的泛光；石头 = 闷的撞击和摩擦。
- 双神对撞、阿尔宙斯光爆这样的大场面靠超低频和长尾巴撑，不靠高频。
- 用户要求不要太尖锐：所有声音的起音至少几毫秒，高频整体压掉（总线 7.5 kHz 低通），铃音只用接近谐波的柔和泛音。
- 叫声在视频轨里，叫声响起的那两秒音效把中高频让出来（只留超低频）。
时间点全部按 30fps 帧号，和 src/scenes/hisui/common.ts 的 T 一一对应。
"""

from __future__ import annotations

import math
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, istft, oaconvolve, sosfilt, stft

SR = 48000
OUT = os.path.join('out', '神奥之名')

# ── 时间轴（30fps 帧号，抄自 common.ts）──
T = dict(
	l1=24, l2=150, cyrus=170, l3=305, l4=418, title=515, swap=560, card=650, rewind=660, down=860, l5=815, l6=900, l7=1075,
	beams=1087, l8=1255, l9=1370, build=1380, built=1545, l10=1555, l11=1645, dark=1750, end1=1850,
	rise=1850, swap2=1972, l12=1935, clear=2060, land=2125, l13=2080, split=2105, l14=2195, l15=2330, l17=2525, l18=2715,
	l19=2875, l20=3025, ships2=2995, l21=3175, l22=3305, l23=3415, vbuild=3405, vbuilt=3510, l24=3560, end2=3785,
	card2=3875, l25=3985, tear=3995, fall=4107, beach=4197, l27=4245, voidIn=4275, l28=4405, voidOut=4550, l29=4557,
	bolt=4590, l30=4670, frenzy=4683, l31=4790, irida=4807, l32=5000, calm=5017, l33=5180, still=5167, l34=5253,
	redsky=5247, l35=5445, kamado=5443, l36=5625, cast=5621, end3=5780,
	volo=5785, l38=5915, hut=6025, l39=6040, inside=6113, l40=6217, zhou=6223, yu=6285, l41=6357, l42=6477, l43=6637,
	lakes=6625, l44=6780, ruins=6770, chain=6835, l45=6913, end4=7155,
	l46=7190, l47=7315, l48=7445, bow=7525, l49=7605, unbalance=7725, l50=7750, dialga=7760, dialgaPeak=7830, l51=7875,
	l52=8005, chainBreak=8067, l53=8120, caught=8127, warn=8185, palkia=8265, palkiaPeak=8297, l55=8390, dialga2=8465,
	ram=8505, impact=8527, l56=8565, beam=8575, burst=8635, l57=8752, ball=8832, summit=8962, l59=8987, close=9017,
	dex=9097, l60=9117, cogita=9282, l61=9302, l62=9467, end5=9612,
	card3=9635, l63=9725, l64=9860, plates=9870, ring=10030, l65=10065, fist=10140, l66=10160, zap=10300, l67=10315,
	celestica=10418, l68=10430, l69=10620, l70=10800, l71=10910, end6=11050,
	l72=11075, l73=11200, l74=11325, coat=11335, memory=11405, l75=11415, l76=11605, l77=11760, l78=11920, back7=12075,
	l79=12085, revTear=12195, l80=12210, gira=12220, giraPeak=12275, origin=12335, originPeak=12360, void7=12380,
	l81=12390, duel=12520, l82=12695, l83=12790, l84=12925, l85=13065, flute=13080, l86=13205, end7=13405,
	l87=13420, play1=13430, journey=13515, l88=13530, stairs=13705, l89=13715, play2=13720, climb=13805, l90=13970,
	arceus=13965, arceusPeak=14030, l91=14185, burst8=14115, l92=14340, l93=14465, gift=14475, l94=14570, end8=14815,
	prelude=14855, l95=14875, l96=15085, l97=15245, l98=15335, night9=15485, l100=15510, cyrus9=15560, l102=15730,
	fade9=15835, end9=15925,
)
SEGS = [('pillar', 0, T['end1']), ('clans', T['end1'], T['end2']), ('rift', T['end2'], T['end3']), ('cosmos', T['end3'], T['end4']),
	('gods', T['end4'], T['end5']), ('plates', T['end5'], T['end6']), ('volo', T['end6'], T['end7']), ('hall', T['end7'], T['end8']),
	('name', T['end8'], T['end9'])]
PARTS = [(0, T['end2']), (T['end2'], T['end5']), (T['end5'], T['end9'])]
# 叫声（视频轨里）：这些时候音效让出中高频
CRIES = [T['dialgaPeak'], T['palkiaPeak'], T['burst'] - 16, T['burst'] - 10, T['giraPeak'], T['originPeak'], T['arceusPeak'], T['burst8']]


def s(frame: float) -> float:
	return frame / 30


def n_of(d: float) -> int:
	return max(1, int(round(d * SR)))


def tv(d: float):
	return np.arange(n_of(d)) / SR


def rng(seed: int):
	return np.random.default_rng(seed)


def noise(d, seed):
	return rng(seed).standard_normal(n_of(d)).astype(np.float64)


def _sos(kind, f, order=2):
	return butter(order, f, btype=kind, fs=SR, output='sos')


def lp(x, f, order=2):
	return sosfilt(_sos('lowpass', f, order), x)


def hp(x, f, order=2):
	return sosfilt(_sos('highpass', f, order), x)


def bp(x, f0, f1, order=2):
	return sosfilt(_sos('bandpass', [f0, f1], order), x)


def norm(x, peak=1.0):
	m = np.max(np.abs(x)) + 1e-12
	return x * (peak / m)


def env(n, a, d, curve=3.0):
	"""起音 a 秒（正弦缓起，不会有咔哒）、指数衰减 d 秒。"""
	t = np.arange(n) / SR
	att = np.sin(0.5 * np.pi * np.clip(t / max(a, 0.004), 0, 1)) ** 2
	dec = np.exp(-curve * np.clip(t - a, 0, None) / max(d, 1e-3))
	return att * dec


def swell(n, peak=0.6, p_in=2.0, p_out=1.6):
	"""从 0 涨到峰值再落回 0（峰在 peak 比例处），两端都是缓的。"""
	u = np.linspace(0, 1, n)
	up = np.clip(u / peak, 0, 1)
	dn = np.clip((1 - u) / (1 - peak), 0, 1)
	return np.where(u < peak, np.sin(0.5 * np.pi * up) ** p_in, np.sin(0.5 * np.pi * dn) ** p_out)


def fade(n, a=0.5, b=0.5):
	"""两头淡入淡出（秒）。"""
	e = np.ones(n)
	na, nb = min(n, n_of(a)), min(n, n_of(b))
	e[:na] *= np.sin(0.5 * np.pi * np.linspace(0, 1, na)) ** 2
	e[n - nb :] *= np.cos(0.5 * np.pi * np.linspace(0, 1, nb)) ** 2
	return e


def smooth_rand(d, seed, rate=0.5, lo=0.3, hi=1.0):
	"""慢慢起伏的随机曲线（阵风、浪的大小），每秒约 rate 个起伏。"""
	n = n_of(d)
	k = max(4, int(d * rate) + 4)
	pts = rng(seed).uniform(lo, hi, k)
	x = np.linspace(0, k - 3, n)
	i = np.floor(x).astype(int)
	u = x - i
	u = u * u * (3 - 2 * u)
	return pts[i] * (1 - u) + pts[i + 1] * u


def osc(freq, d, phase=0.0):
	n = n_of(d)
	f = np.broadcast_to(np.asarray(freq, dtype=float), (n,)) if np.ndim(freq) else np.full(n, float(freq))
	return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def glide(f0, f1, d, curve=1.0):
	u = np.linspace(0, 1, n_of(d)) ** curve
	return f0 * (f1 / f0) ** u


def sweep(d, f0, f1, seed, bw=0.8, curve=1.0):
	"""带通噪声扫频（气流、呼啸）：中心频率按指数从 f0 走到 f1，带宽 bw 个八度。"""
	n = n_of(d)
	x = rng(seed).standard_normal(n + 4096)
	f, t, Z = stft(x, SR, nperseg=2048, noverlap=1536)
	u = np.clip(t / max(d, 1e-3), 0, 1) ** curve
	fc = f0 * (f1 / f0) ** u
	lf = np.log2(np.maximum(f, 1.0))[:, None]
	mask = np.exp(-0.5 * ((lf - np.log2(fc)[None, :]) / (bw / 2)) ** 2)
	_, y = istft(Z * mask, SR, nperseg=2048, noverlap=1536)
	return norm(y[:n])


# ── 声音积木（本期新写）──

def wind(d, seed, body=380, air=1400, gust=0.35, cold=1.0):
	"""山顶的风：低沉的风体 + 一层气声，阵风慢慢起伏。cold 越大气声越多。"""
	g = smooth_rand(d, seed, rate=0.22, lo=1 - gust, hi=1.0)
	g2 = smooth_rand(d, seed + 1, rate=0.4, lo=0.2, hi=1.0)
	lo_ = lp(noise(d, seed + 2), body, 2) * 3.0
	hi_ = bp(noise(d, seed + 3), air * 0.6, air * 1.6, 2) * 0.55 * cold * g2
	return (lo_ + hi_) * g


def surf(d, seed, period=7.5):
	"""海浪：一波波缓缓涌上来、退下去。"""
	n = n_of(d)
	t = tv(d)
	r = rng(seed)
	wave = np.zeros(n)
	k = 0.0
	while k < d:
		at = k + r.uniform(-0.8, 0.8)
		ln = period * r.uniform(0.8, 1.2)
		i0 = max(0, n_of(at))
		m = min(n - i0, n_of(ln))
		if m > 0:
			wave[i0 : i0 + m] = np.maximum(wave[i0 : i0 + m], swell(m, 0.35, 1.6, 1.2) * r.uniform(0.6, 1.0))
		k += ln * 0.85
	body = lp(noise(d, seed + 5), 900, 2) * 2.2
	wash = bp(noise(d, seed + 6), 700, 3200, 2) * 0.5
	return (body + wash) * (0.25 + 0.75 * wave) + 0.4 * lp(noise(d, seed + 7), 120, 2) * 3 * (0.5 + 0.5 * np.sin(2 * np.pi * t / period))


def thunder(d, seed, dist=1.0):
	"""远处滚过来的闷雷：没有脆响，起音 30 毫秒，几团低频接连滚过去。dist 越大越闷。"""
	n = n_of(d)
	r = rng(seed)
	e = np.zeros(n)
	for k in range(r.integers(3, 6)):
		at = (0.04 + r.uniform(0, 0.35) * k)
		i0 = n_of(at)
		m = n - i0
		if m > 0:
			e[i0:] += env(m, 0.03 + 0.03 * k, d * r.uniform(0.25, 0.6), 3.0)[:m] * r.uniform(0.5, 1.0) * (0.8**k)
	x = lp(noise(d, seed + 9), 260 / dist, 3) * 4 + lp(noise(d, seed + 10), 900 / dist, 2) * 0.6 * env(n, 0.03, 0.6, 4)
	return norm(x * e)


def boom(d, f0=62, f1=30, seed=1, air=0.4):
	"""大的低频冲击：下滑的正弦 + 一团低频噪声，起音 15 毫秒。"""
	n = n_of(d)
	x = osc(glide(f0, f1, d, 0.6), d) * env(n, 0.015, d * 0.55, 3)
	x += lp(noise(d, seed), 220, 3) * 2.5 * env(n, 0.02, d * 0.4, 3)
	x += bp(noise(d, seed + 1), 300, 1800, 2) * air * env(n, 0.02, 0.5, 4)
	return norm(x)


def thud(d=0.6, f=70, seed=1, wood=0.0):
	"""闷的撞击（石头落定、门关上）。wood>0 时带一点木头的共鸣。"""
	n = n_of(d)
	x = osc(glide(f * 1.5, f, d, 0.3), d) * env(n, 0.006, d * 0.35, 3)
	x += lp(noise(d, seed), 500, 2) * 1.2 * env(n, 0.005, 0.12, 4)
	if wood:
		x += wood * osc(f * 3.1, d) * env(n, 0.005, 0.18, 4) + wood * 0.5 * osc(f * 4.7, d) * env(n, 0.005, 0.1, 4)
	return norm(x)


def grind(d, seed, f=500):
	"""石头摩擦：低通噪声 + 不规则的颗粒起伏。"""
	g = smooth_rand(d, seed, rate=9, lo=0.2, hi=1.0)
	return norm(lp(noise(d, seed + 1), f, 2) * g) * fade(n_of(d), 0.15, 0.3)


def chime(f, d, a=0.01, bright=0.5):
	"""柔和的铃：泛音接近谐波（1、2、3.01、4.2），高泛音衰减更快，不刺耳。"""
	t = tv(d)
	n = len(t)
	out = np.zeros(n)
	for mult, amp, dec in ((1, 1, 1), (2.0, 0.35 * bright, 0.55), (3.01, 0.16 * bright, 0.35), (4.2, 0.06 * bright, 0.22)):
		if f * mult < 6000:
			out += amp * np.sin(2 * np.pi * f * mult * t) * np.exp(-t / (d * dec / 3))
	return out * env(n, a, d * 10, 0.01)


def clink(f, d=0.5, seed=1):
	"""链环轻碰：金属感但闷一点（泛音低通）。"""
	t = tv(d)
	r = rng(seed)
	x = np.zeros(len(t))
	for mult, amp, dec in ((1, 1, 1), (2.32, 0.5, 0.6), (3.9 + r.uniform(0, 0.3), 0.25, 0.4)):
		x += amp * np.sin(2 * np.pi * f * mult * t + r.uniform(0, 6)) * np.exp(-t / (d * dec / 4))
	return lp(x * env(len(t), 0.003, d * 10, 0.01), 4200, 2)


def pad(freqs, d, seed, warm=1.0, vib=0.0025, harm=6):
	"""温暖的和声：每个音几支略微走音的声部，谐波按 1/k^1.6 递减，再低通。"""
	t = tv(d)
	r = rng(seed)
	out = np.zeros(len(t))
	for f in freqs:
		for v in range(3):
			det = 1 + r.uniform(-0.004, 0.004)
			lfo = 1 + vib * np.sin(2 * np.pi * r.uniform(0.15, 0.4) * t + r.uniform(0, 6))
			ph = 2 * np.pi * np.cumsum(f * det * lfo) / SR
			for k in range(1, harm + 1):
				if f * k < 5000:
					out += np.sin(k * ph + r.uniform(0, 6)) / k**1.6
	return lp(out, 1600 * warm, 2)


def drone(f, d, seed, rough=0.3):
	"""裂缝的嗡鸣：极低的基音 + 慢慢拍动的五度 + 低通噪声翻涌。"""
	t = tv(d)
	x = osc(f, d) + 0.6 * osc(f * 1.5 * 1.003, d) + 0.35 * osc(f * 2.01, d) + 0.2 * osc(f * 3.02, d)
	x *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.13 * t)
	x += rough * norm(lp(noise(d, seed), 160, 2)) * smooth_rand(d, seed + 1, rate=0.6, lo=0.3, hi=1)
	return lp(x, 900, 2)


def whoosh(d, seed, f0=300, f1=1400, peak=0.6, bw=1.0):
	"""气流掠过：带通扫频噪声，鼓起再落下。"""
	return sweep(d, f0, f1, seed, bw=bw) * swell(n_of(d), peak, 1.6, 1.4)


def crunch(seed, d=0.22):
	"""踩雪：一小簇压低了高频的颗粒。"""
	r = rng(seed)
	n = n_of(d)
	x = np.zeros(n)
	for _ in range(r.integers(18, 30)):
		i = int(r.uniform(0, 0.6) * n)
		m = n_of(r.uniform(0.004, 0.012))
		if i + m < n:
			x[i : i + m] += r.standard_normal(m) * np.hanning(m) * r.uniform(0.3, 1)
	return lp(hp(x, 300, 2), 2600, 2) * env(n, 0.01, d * 0.8, 2)


def brush(d, seed, f0=900, f1=2400):
	"""毛笔一划：一段柔和的带通气声。"""
	return sweep(d, f0, f1, seed, bw=1.3) * swell(n_of(d), 0.3, 1.2, 2.0)


def fire(d, seed):
	"""屋里的火：低沉的呼呼声 + 稀疏的、被压闷了的噼啪。"""
	n = n_of(d)
	r = rng(seed)
	x = lp(noise(d, seed), 350, 2) * 2.0 * smooth_rand(d, seed + 1, rate=1.5, lo=0.5, hi=1)
	pops = np.zeros(n)
	for _ in range(int(d * 6)):
		i = int(r.uniform(0, 1) * n)
		m = n_of(r.uniform(0.005, 0.02))
		if i + m < n:
			pops[i : i + m] += r.standard_normal(m) * np.hanning(m) * r.uniform(0.2, 0.8)
	return x + lp(pops, 1800, 2) * 1.5


def lapping(d, seed):
	"""湖水轻拍岸边。"""
	g = smooth_rand(d, seed, rate=1.2, lo=0.0, hi=1.0) ** 2
	return lp(bp(noise(d, seed + 1), 200, 1500, 2), 1200, 2) * g


def flute(notes, seed, breath=0.18):
	"""笛声：正弦为主、少量谐波、轻微颤音，加一点气声。notes = [(频率, 秒)]。"""
	outs = []
	for k, (f, d) in enumerate(notes):
		t = tv(d)
		n = len(t)
		vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.35, 0, 1)
		ph = 2 * np.pi * np.cumsum(f * vib) / SR
		x = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
		x += breath * norm(bp(noise(d, seed + k), f * 1.2, min(f * 3.2, 7000), 2)) * 0.6
		e = np.minimum(np.sin(0.5 * np.pi * np.clip(t / 0.07, 0, 1)) ** 2, np.cos(0.5 * np.pi * np.clip((t - (d - 0.12)) / 0.12, 0, 1)) ** 2)
		outs.append(x * e)
	return lp(np.concatenate(outs), 5000, 2)


def growl(d, seed, f=55):
	"""低吼（狂暴的王、远处的骚动）：低频噪声 + 不规则的颤动，不模仿任何宝可梦的叫声。"""
	t = tv(d)
	am = 0.6 + 0.4 * np.sin(2 * np.pi * (18 + 6 * smooth_rand(d, seed, 2, 0, 1)) * t)
	x = lp(noise(d, seed + 1), 300, 3) * 3 + osc(f * (1 + 0.05 * smooth_rand(d, seed + 2, 3, -1, 1)), d)
	return norm(x * am) * swell(len(t), 0.3, 1.2, 1.6)


def energy(d, f, seed, throb=7.0):
	"""光柱：几支走音的锯齿低通成嗡嗡的能量声，带脉动。"""
	t = tv(d)
	x = np.zeros(len(t))
	for k, det in enumerate((1.0, 1.007, 0.993, 2.003)):
		ph = (f * det * t + rng(seed + k).uniform()) % 1.0
		x += (2 * ph - 1) * (0.5 if k == 3 else 1.0)
	x = lp(x, 1100, 3)
	x *= 0.7 + 0.3 * np.sin(2 * np.pi * throb * t)
	return norm(x + 0.5 * norm(lp(noise(d, seed), 250, 2)))


# ── 混音 ──

class Mix:
	def __init__(self, dur):
		self.n = n_of(dur)
		self.dry = np.zeros((self.n, 2), np.float32)
		self.wet = np.zeros((self.n, 2), np.float32)

	def add(self, x, frame, gain=1.0, pan=0.0, rev=0.25, width=0.0):
		"""在第 frame 帧（30fps）放入单声道 x；pan -1 左 … 1 右；rev 送进混响的比例；width>0 时左右略有时差。"""
		i0 = n_of(s(frame)) if frame > 0 else 0
		if i0 >= self.n:
			return
		x = np.asarray(x, dtype=np.float64)[: self.n - i0] * gain
		a = (pan + 1) * np.pi / 4
		l, r = math.cos(a), math.sin(a)
		m = len(x)
		L = x * l
		R = x * r
		if width > 0:
			sh = int(width * SR * 0.012)
			R = np.concatenate([np.zeros(sh), R[: m - sh]]) if sh else R
		self.dry[i0 : i0 + m, 0] += L * (1 - rev * 0.5)
		self.dry[i0 : i0 + m, 1] += R * (1 - rev * 0.5)
		self.wet[i0 : i0 + m, 0] += L * rev
		self.wet[i0 : i0 + m, 1] += R * rev

	def bed(self, maker, f0, f1, gain, seed, a=1.5, b=1.5, pan=0.0, rev=0.15):
		"""两路独立的底噪（左右各一）铺在 f0–f1 帧之间，两头淡入淡出。"""
		d = s(f1 - f0)
		n = n_of(d)
		for ch, p in ((0, -0.7 + pan), (1, 0.7 + pan)):
			x = norm(maker(d, seed + ch * 101)) * fade(n, a, b)
			self.add(x, f0, gain, max(-1, min(1, p)), rev)

	def render(self):
		# 混响：低通过的指数衰减噪声当冲激响应，左右各一，约 3.2 秒，像雪山里空旷的回声
		d = 3.2
		n = n_of(d)
		t = np.arange(n) / SR
		irs = []
		for seed in (7, 8):
			ir = rng(seed).standard_normal(n) * np.exp(-t / 0.75)
			ir = lp(ir, 3200, 2)
			ir[: n_of(0.02)] *= np.linspace(0, 1, n_of(0.02))
			irs.append((ir / np.sqrt(np.sum(ir**2))).astype(np.float32))
		wet = np.stack([oaconvolve(self.wet[:, c], irs[c])[: self.n] for c in range(2)], axis=1)
		out = self.dry.astype(np.float64) + 0.9 * wet
		# 叫声让位：中高频压低，超低频照旧
		duck = np.ones(self.n)
		for c in CRIES:
			i0, i1 = n_of(s(c) - 0.1), n_of(s(c) + 1.6)
			k = np.arange(self.n)
			seg = np.clip(np.minimum((k - i0) / (0.12 * SR), (i1 - k) / (0.5 * SR)), 0, 1)
			duck = np.minimum(duck, 1 - 0.45 * seg)
		low = np.stack([lp(out[:, c], 140, 2) for c in range(2)], axis=1)
		out = low + (out - low) * duck[:, None]
		# 总线：压掉高频，再轻轻地软限幅
		out = np.stack([lp(hp(out[:, c], 28, 2), 7500, 2) for c in range(2)], axis=1)
		out = norm(out, 1.0)
		out = np.tanh(out * 1.6) / np.tanh(1.6)
		return norm(out, 0.89)


def build():
	M = Mix(s(T['end9']) + 0.5)
	add, bed = M.add, M.bed
	sd = iter(range(100, 10**7, 13))

	def S():
		return next(sd)

	# ════ 1 枪之柱 ════
	# 月夜的风：冷、空
	bed(lambda d, k: wind(d, k, body=320, air=1600, gust=0.45, cold=1.2), 0, T['rewind'] + 40, 0.22, S(), a=2.0, b=2.5)
	add(pad([73.4, 110], s(400), S(), warm=0.6) * swell(n_of(s(400)), 0.5), 0, 0.09, 0, 0.3)
	# 赤日的剪影一闪：时间与空间的两道微光，一左一右
	add(norm(osc(146.8, s(150)) + 0.3 * osc(293.7, s(150))) * swell(n_of(s(150)), 0.4), T['cyrus'], 0.05, -0.6, 0.5)
	add(norm(osc(220, s(150)) + 0.3 * osc(440.5, s(150))) * swell(n_of(s(150)), 0.5), T['cyrus'] + 10, 0.045, 0.6, 0.5)
	# 推向断柱、沿柱身仰上去
	add(whoosh(s(220), S(), 220, 900, 0.7, 1.2), T['l3'] - 20, 0.16, 0.1, 0.3)
	# 片名：一声沉的落定 + 低沉的铃
	add(boom(4.5, 55, 32, S(), air=0.2), T['title'] - 2, 0.4, 0, 0.35)
	add(chime(146.8, 5.0, a=0.02, bright=0.4), T['title'], 0.16, 0, 0.6)
	add(pad([73.4, 110, 146.8], 6.0, S(), warm=0.7) * swell(n_of(6.0), 0.25), T['title'] - 10, 0.1, 0, 0.4)
	# 篇章卡
	add(boom(3.0, 70, 40, S(), air=0.1), T['card'], 0.28, 0, 0.35)
	add(chime(220, 3.5, a=0.02, bright=0.3), T['card'] + 2, 0.1, 0, 0.6)
	# 星轨倒转：一段倒放的长尾 + 往下滑的气流，时间往回流
	inhale = whoosh(s(200), S(), 1600, 300, 0.85, 1.4)
	add(inhale, T['rewind'], 0.2, 0, 0.35)
	add(norm(chime(293.7, 6.0, a=0.01, bright=0.4))[::-1], T['rewind'] + 20, 0.12, 0, 0.5)
	# 黄昏的雪顶：暖一些、轻一些的风
	bed(lambda d, k: wind(d, k, body=450, air=1100, gust=0.3, cold=0.5), T['rewind'] + 80, T['end1'] + 20, 0.16, S(), a=3.0, b=1.0)
	# 古人跪拜：天上的金光，温暖的和声
	add(pad([98, 146.8, 196, 246.9], s(T['l8'] - T['l6']), S(), warm=1.1) * swell(n_of(s(T['l8'] - T['l6'])), 0.55, 2.0, 1.4), T['l6'], 0.13, 0, 0.45)
	# 十道光一道道落下：十声柔和的铃（五声音阶，越来越高）
	scale = [196, 220, 246.9, 293.7, 329.6, 392, 440, 493.9, 587.3, 659.3]
	for i in range(10):
		add(chime(scale[i], 2.6, a=0.012, bright=0.45), T['beams'] + i * 9, 0.09, -0.6 + 1.2 * (i / 9), 0.55)
	# 英雄
	add(pad([130.8, 196, 261.6], s(150), S()) * swell(n_of(s(150)), 0.4), T['l7'] + 20, 0.06, 0, 0.5)
	# 建殿：搬石头、石块落定、摩擦；石像一尊尊立起
	for k in range(9):
		add(thud(0.7, 55 + 6 * (k % 3), S()), T['l9'] + 8 + k * 17, 0.22, -0.5 + (k % 5) * 0.25, 0.35)
	add(grind(s(160), S(), 420), T['build'], 0.12, 0.2, 0.3)
	for i in range(10):
		add(thud(0.9, 48 + (i % 4) * 4, S()), T['build'] + 40 + i * 6, 0.16, -0.7 + i * 0.15, 0.4)
	# 神殿落成：一个暖和弦
	add(pad([98, 146.8, 196, 293.7], 6.0, S()) * swell(n_of(6.0), 0.3), T['built'] - 10, 0.12, 0, 0.5)
	add(chime(392, 4.0, a=0.02, bright=0.35), T['built'], 0.08, 0, 0.6)
	# 神阖的灯一盏盏熄灭：往下沉的和声，几声很轻的"噗"
	add(pad([110, 164.8, 220], s(120), S(), warm=0.7) * swell(n_of(s(120)), 0.2, 1.2, 2.0), T['dark'] - 20, 0.08, 0, 0.5)
	for k in range(7):
		add(lp(noise(0.25, S()), 600, 2) * env(n_of(0.25), 0.01, 0.15), T['dark'] + k * 12, 0.05, -0.5 + k * 0.16, 0.4)

	# ════ 2 两个神 ════
	# 云海涨上来、吞没镜头
	add(whoosh(s(T['swap2'] - T['rise'] + 60), S(), 160, 700, 0.75, 1.5), T['rise'] - 30, 0.32, 0, 0.3)
	add(lp(noise(s(200), S()), 300, 2) * swell(n_of(s(200)), 0.6), T['rise'], 0.12, 0, 0.3)
	# 晨光里的海：浪
	bed(lambda d, k: surf(d, k, 7.0), T['clear'] - 40, T['l18'] + 40, 0.2, S(), a=2.5, b=2.0)
	bed(lambda d, k: wind(d, k, body=500, air=900, gust=0.25, cold=0.3), T['clear'] - 40, T['end2'], 0.07, S(), a=3.0, b=2.0)
	# 船靠岸
	add(thud(0.8, 90, S(), wood=0.5), T['land'], 0.16, 0.2, 0.3)
	add(lp(noise(0.6, S()), 1500, 2) * env(n_of(0.6), 0.04, 0.4), T['land'] + 4, 0.1, 0.2, 0.3)
	# 两路灯火分开：一左一右两个音
	add(norm(pad([146.8], s(90), S(), harm=3)) * swell(n_of(s(90)), 0.5), T['split'], 0.08, -0.7, 0.4)
	add(norm(pad([220], s(90), S(), harm=3)) * swell(n_of(s(90)), 0.5), T['split'] + 6, 0.07, 0.7, 0.4)
	# 金刚队（时间）：缓慢的木质脉动，像沉稳的钟摆（左）
	for k in range(8):
		add(thud(0.5, 110, S(), wood=0.7), T['l14'] + 12 + k * 15, 0.06 * (1 - k / 10), -0.4, 0.4)
	add(norm(pad([98, 146.8], s(130), S(), harm=4)) * swell(n_of(s(130)), 0.5), T['l14'], 0.07, -0.5, 0.45)
	# 珍珠队（空间）：向四面铺开的空阔和声（右）
	add(whoosh(s(120), S(), 400, 1600, 0.5, 1.6), T['l15'], 0.08, 0.5, 0.5)
	add(norm(pad([164.8, 246.9, 329.6], s(140), S(), harm=4)) * swell(n_of(s(140)), 0.5), T['l15'] + 5, 0.07, 0.5, 0.5)
	# 口头禅：两笔
	add(brush(0.7, S()), T['l17'] + 50, 0.1, -0.4, 0.3)
	add(brush(0.7, S(), 800, 2000), T['l17'] + 120, 0.1, 0.4, 0.3)
	# 对峙、一代传一代：日夜轮换，低沉的起伏
	for k in range(3):
		add(norm(pad([73.4, 110], s(55), S(), harm=4)) * swell(n_of(s(55)), 0.5), T['l18'] + 10 + k * 50, 0.07, 0, 0.4)
	# 远处山顶的神殿，暖光熄灭
	add(pad([98, 146.8, 196], s(150), S()) * swell(n_of(s(150)), 0.15, 1.2, 2.2), T['l19'], 0.08, 0, 0.5)
	# 第三群人的船
	bed(lambda d, k: surf(d, k, 8.0), T['ships2'] - 20, T['l21'] + 20, 0.15, S(), a=2.0, b=1.5)
	add(thud(0.9, 80, S(), wood=0.4), T['ships2'] + 90, 0.08, -0.3, 0.4)
	# 马加木的故乡：远处的火和骚动
	add(lp(noise(s(130), S()), 380, 3) * swell(n_of(s(130)), 0.5) * 2.5, T['l21'] + 10, 0.12, 0, 0.4)
	add(growl(s(80), S(), 48), T['l21'] + 50, 0.08, 0.3, 0.5)
	# 祝庆村立起来：木头的落定声
	for k in range(6):
		add(thud(0.5, 95 + (k % 3) * 10, S(), wood=0.8), T['vbuild'] + k * 18, 0.1, -0.5 + k * 0.2, 0.35)
	add(chime(261.6, 2.5, a=0.01, bright=0.3), T['vbuilt'] + 10, 0.05, 0.3, 0.5)
	# 夜里三处灯火：安静的风
	add(pad([110, 164.8, 220], s(200), S(), warm=0.7) * swell(n_of(s(200)), 0.4), T['l24'], 0.06, 0, 0.5)

	# ════ 3 裂缝 ════
	bed(lambda d, k: wind(d, k, body=300, air=1300, gust=0.5, cold=1.0), T['end2'] - 30, T['fall'], 0.18, S(), a=2.0, b=1.0)
	add(boom(3.0, 70, 40, S(), air=0.1), T['card2'], 0.28, 0, 0.35)
	add(chime(196, 3.5, a=0.02, bright=0.3), T['card2'] + 2, 0.1, 0, 0.6)
	# 裂缝撕开：低沉的翻涌一下鼓起来，接着一直嗡在那里
	add(whoosh(s(110), S(), 120, 800, 0.8, 1.6), T['tear'] - 20, 0.35, 0, 0.35)
	add(boom(4.0, 45, 26, S(), air=0.3), T['tear'] + 60, 0.45, 0, 0.4)
	add(drone(36.7, s(T['fall'] - T['tear']), S()) * fade(n_of(s(T['fall'] - T['tear'])), 1.5, 0.4), T['tear'], 0.22, 0, 0.3)
	# 坠落：往下滑的呼啸，落地闷响
	add(whoosh(s(90), S(), 1200, 200, 0.6, 1.0), T['fall'], 0.3, 0, 0.3)
	add(thud(1.0, 50, S()), T['beach'] - 2, 0.3, 0, 0.35)
	bed(lambda d, k: surf(d, k, 7.0), T['beach'] - 10, T['voidIn'] + 20, 0.17, S(), a=0.8, b=1.0)
	# 跨越时空的地方：金色的光，很远的和声
	add(pad([130.8, 196, 261.6, 329.6], s(T['voidOut'] - T['voidIn']), S(), warm=1.0, vib=0.004) * swell(n_of(s(T['voidOut'] - T['voidIn'])), 0.5, 2.0, 1.6), T['voidIn'], 0.14, 0, 0.6)
	add(whoosh(s(60), S(), 300, 1200, 0.6), T['voidIn'] - 10, 0.12, 0, 0.5)
	add(whoosh(s(60), S(), 1200, 300, 0.5), T['voidOut'] - 30, 0.12, 0, 0.5)
	# 裂缝回来，嗡鸣一直持续到第 5 段合上
	rift_from, rift_to = T['voidOut'] - 20, T['cast'] + 40
	add(drone(36.7, s(rift_to - rift_from), S()) * fade(n_of(s(rift_to - rift_from)), 1.5, 2.5), rift_from, 0.13, 0, 0.3)
	bed(lambda d, k: wind(d, k, body=280, air=1200, gust=0.55, cold=0.9), T['voidOut'], T['end3'], 0.13, S(), a=1.5, b=1.5)
	# 落雷：远处滚过来的闷雷
	for k, b in enumerate([T['bolt'], T['bolt'] + 16, T['bolt'] + 27, T['bolt'] + 40]):
		add(thunder(4.5, S(), dist=1.0 + 0.3 * k), b + 2, 0.42 * (1 - 0.15 * k), -0.4 + 0.3 * k, 0.4)
	# 王狂暴
	add(growl(s(100), S(), 46), T['frenzy'], 0.18, -0.3, 0.45)
	add(growl(s(90), S(), 52), T['frenzy'] + 25, 0.14, 0.4, 0.45)
	add(boom(2.0, 60, 35, S(), air=0.15), T['frenzy'], 0.25, 0, 0.35)
	for b in [T['irida'] + 40, T['irida'] + 110, T['l31'] + 175]:
		add(thunder(4.0, S(), dist=1.8), b + 3, 0.22, 0.5, 0.45)
	# 王一只只平静：五个往下落的暖音
	for i, f in enumerate([392, 329.6, 293.7, 246.9, 196]):
		add(chime(f, 3.0, a=0.03, bright=0.3), T['calm'] + 10 + i * 24, 0.08, -0.6 + 0.3 * i, 0.6)
	add(pad([98, 146.8, 196], s(150), S()) * swell(n_of(s(150)), 0.5), T['calm'], 0.07, 0, 0.5)
	# 可裂缝还在
	add(swell(n_of(4), 0.5) * drone(55, 4, S(), 0.5), T['still'], 0.1, 0, 0.4)
	# 红天：不祥的鼓胀
	add(whoosh(s(150), S(), 90, 500, 0.6, 1.8), T['redsky'] - 10, 0.25, 0, 0.4)
	add(boom(5.0, 40, 24, S(), air=0.1), T['redsky'] + 40, 0.35, 0, 0.45)
	add(pad([55, 82.4, 116.5], s(200), S(), warm=0.6) * swell(n_of(s(200)), 0.4), T['redsky'], 0.1, 0, 0.45)
	# 马加木：低沉的心跳般的脉动
	for k in range(6):
		add(thud(0.6, 48, S()), T['kamado'] + 20 + k * 26, 0.12, 0, 0.3)
	# 被赶出去，门关上
	add(thud(1.4, 60, S(), wood=0.9), T['cast'] + 100, 0.34, 0.2, 0.45)
	add(lp(noise(0.8, S()), 700, 2) * env(n_of(0.8), 0.06, 0.6), T['cast'] + 92, 0.08, 0.2, 0.4)

	# ════ 4 宇与宙 ════
	bed(lambda d, k: wind(d, k, body=330, air=1200, gust=0.4, cold=0.8), T['end3'] - 20, T['inside'] + 20, 0.15, S(), a=1.0, b=1.0)
	# 望罗踩雪走来
	for k in range(14):
		add(crunch(S()), T['volo'] + 30 + k * 11, 0.1 + 0.004 * k, 0.4 - k * 0.03, 0.2)
	# 小屋里的火光
	bed(fire, T['hut'] - 10, T['zhou'] + 10, 0.13, S(), a=1.5, b=1.0, rev=0.1)
	# "宙""宇"两个字：毛笔划过，底下各一个音
	add(brush(1.2, S(), 700, 1800), T['zhou'], 0.14, -0.3, 0.35)
	add(norm(pad([73.4, 110], s(120), S(), harm=4)) * swell(n_of(s(120)), 0.4), T['zhou'] + 10, 0.08, -0.3, 0.45)
	add(brush(1.2, S(), 900, 2300), T['yu'], 0.14, 0.3, 0.35)
	add(whoosh(s(100), S(), 300, 1300, 0.5, 1.6), T['yu'] + 10, 0.07, 0.3, 0.5)
	# 合成"宇宙"
	add(pad([73.4, 110, 146.8, 185, 220], s(150), S()) * swell(n_of(s(150)), 0.35), T['l41'] - 5, 0.11, 0, 0.5)
	add(chime(293.7, 4.0, a=0.02, bright=0.4), T['l41'], 0.08, 0, 0.6)
	# 各看见一半
	add(norm(pad([146.8], s(140), S(), harm=4)) * swell(n_of(s(140)), 0.5), T['l42'], 0.07, -0.7, 0.4)
	add(norm(pad([220], s(140), S(), harm=4)) * swell(n_of(s(140)), 0.5), T['l42'], 0.07, 0.7, 0.4)
	# 三座湖
	bed(lapping, T['lakes'] - 10, T['ruins'], 0.12, S(), a=1.0, b=1.0)
	bed(lambda d, k: wind(d, k, body=420, air=900, gust=0.3, cold=0.4), T['lakes'] - 10, T['end4'] + 10, 0.08, S(), a=1.0, b=1.0)
	for i, f in enumerate([329.6, 246.9, 392]):
		add(chime(f, 3.5, a=0.02, bright=0.4), T['lakes'] + 15 + i * 40, 0.09, -0.7 + 0.7 * i, 0.6)
	# 云雾遗迹：三道光合成红色锁链
	add(whoosh(s(80), S(), 500, 1500, 0.8, 1.2), T['chain'] - 40, 0.1, 0, 0.5)
	for k in range(12):
		add(clink(700 + 40 * (k % 4), 0.5, S()), T['chain'] + k * 4, 0.035 + 0.004 * k, -0.4 + 0.07 * k, 0.4)
	add(pad([110, 164.8, 220, 277.2], s(160), S()) * swell(n_of(s(160)), 0.35), T['chain'] + 20, 0.1, 0, 0.5)
	add(boom(2.5, 70, 45, S(), air=0.05), T['chain'] + 50, 0.18, 0, 0.4)

	# ════ 5 神殿上的双神 ════
	g5 = [T['end4'], T['close'] + 60]
	add(whoosh(s(110), S(), 200, 900, 0.65, 1.5), T['end4'], 0.22, 0, 0.35)
	bed(lambda d, k: wind(d, k, body=300, air=1200, gust=0.5, cold=0.9), T['end4'], T['end5'], 0.13, S(), a=2.0, b=1.5)
	add(drone(36.7, s(g5[1] - g5[0]), S()) * fade(n_of(s(g5[1] - g5[0])), 3.0, 1.5), g5[0], 0.11, 0, 0.3)
	# 走上台阶、马加木带人上山
	for k in range(10):
		add(crunch(S()), T['l46'] + 5 + k * 12, 0.08, 0.2, 0.2)
	for k in range(12):
		add(crunch(S(), 0.18), T['l47'] + k * 9, 0.06, -0.5, 0.2)
	# 裂缝失衡
	add(whoosh(s(60), S(), 100, 500, 0.8, 1.5), T['unbalance'], 0.25, 0, 0.35)
	# 帝牙卢卡降临：沉稳的脉动、降下来的气流
	add(boom(3.5, 50, 30, S(), air=0.15), T['dialga'] + 4, 0.38, 0, 0.4)
	add(whoosh(s(70), S(), 900, 220, 0.6, 1.2), T['dialga'], 0.2, 0, 0.35)
	for k in range(4):
		add(thud(0.8, 42, S()), T['dialga'] + 10 + k * 15, 0.12, 0, 0.35)
	# 红色锁链：甩出去、缠上、绷紧、碎掉
	add(whoosh(s(30), S(), 600, 1600, 0.5), T['l52'] + 5, 0.15, -0.2, 0.3)
	for k in range(14):
		add(clink(620 + 37 * (k % 5), 0.45, S()), T['l52'] + 22 + k * 3, 0.06, -0.3 + 0.05 * k, 0.35)
	add(grind(s(26), S(), 900), T['chainBreak'] - 26, 0.12, 0, 0.3)
	add(boom(1.8, 90, 50, S(), air=0.15), T['chainBreak'], 0.3, 0, 0.4)
	for k in range(16):
		add(clink(500 + 30 * (k % 7), 0.6, S()), T['chainBreak'] + 1 + k * 2, 0.04, -0.8 + 0.1 * k, 0.45)
	# 收服的光飞进手里
	add(whoosh(s(26), S(), 1400, 500, 0.5), T['caught'] + 12, 0.12, 0.3, 0.35)
	add(chime(392, 2.5, a=0.01, bright=0.4), T['caught'] + 34, 0.07, 0.3, 0.5)
	# 警告：裂缝一下下泛起粉光（约 39 帧一次）
	for k in range(2):
		add(boom(1.4, 70, 45, S(), air=0.05), T['warn'] + 10 + k * 39, 0.13 + 0.06 * k, 0, 0.4)
	# 帕路奇亚冲出裂缝
	add(whoosh(s(60), S(), 200, 1200, 0.3, 1.4), T['palkia'] - 10, 0.35, 0.2, 0.35)
	add(boom(4.0, 58, 30, S(), air=0.25), T['palkia'], 0.45, 0, 0.4)
	# 创造主的金光轮廓：很远的暖和声
	add(pad([130.8, 196, 261.6], s(110), S(), warm=1.0) * swell(n_of(s(110)), 0.5), T['l55'] - 20, 0.06, 0.3, 0.6)
	# 帝牙卢卡又出来
	add(whoosh(s(25), S(), 500, 1300, 0.5), T['dialga2'], 0.12, -0.5, 0.3)
	add(boom(2.0, 60, 36, S(), air=0.1), T['dialga2'] + 20, 0.2, -0.4, 0.35)
	# 互相冲过去，撞在一起
	add(whoosh(s(T['impact'] - T['ram'] + 6), S(), 250, 1100, 0.9, 1.0), T['ram'], 0.25, -0.5, 0.25)
	add(whoosh(s(T['impact'] - T['ram'] + 6), S(), 280, 1200, 0.9, 1.0), T['ram'], 0.25, 0.5, 0.25)
	add(boom(3.0, 70, 32, S(), air=0.3), T['impact'], 0.55, 0, 0.4)
	add(thunder(3.0, S(), 1.5), T['impact'] + 4, 0.2, 0, 0.4)
	# 光柱：蓄力 → 喷出 → 僵持 → 合成光团、炸开
	fire_at, meet_at = T['burst'] - 34, T['burst'] - 24
	add(energy(s(fire_at - T['beam'] + 4), 55, S(), throb=4) * swell(n_of(s(fire_at - T['beam'] + 4)), 0.95, 2.0, 0.5), T['beam'], 0.16, 0, 0.3)
	add(whoosh(s(fire_at - T['beam']), S(), 150, 700, 0.95, 1.2), T['beam'], 0.12, 0, 0.3)
	beam_d = s(T['burst'] - fire_at + 6)
	eb = env(n_of(beam_d), 0.03, beam_d * 3, 0.5) * fade(n_of(beam_d), 0.02, 0.1)
	add(energy(beam_d, 73.4, S(), throb=9) * eb, fire_at, 0.3, -0.45, 0.3)
	add(energy(beam_d, 110, S(), throb=11) * eb, fire_at, 0.26, 0.45, 0.3)
	add(whoosh(s(12), S(), 300, 1400, 0.3), fire_at, 0.18, -0.4, 0.3)
	add(whoosh(s(12), S(), 320, 1500, 0.3), fire_at, 0.18, 0.4, 0.3)
	add(grind(s(T['burst'] - meet_at), S(), 700), meet_at, 0.1, 0, 0.3)
	# 爆发：超低频 + 长长的滚动 + 屋顶塌下来的石头
	add(boom(6.0, 48, 22, S(), air=0.45), T['burst'], 1.1, 0, 0.45)
	add(thunder(6.5, S(), 1.1), T['burst'] + 3, 0.85, 0, 0.5)
	add(whoosh(s(90), S(), 900, 160, 0.15, 1.6), T['burst'], 0.5, 0, 0.4)
	for k in range(14):
		add(thud(0.9, 45 + (k % 5) * 6, S()), T['burst'] + 18 + k * 7 + (k % 3) * 3, 0.16 * (1 - k / 20), -0.7 + 0.1 * k, 0.45)
	add(grind(s(120), S(), 380), T['burst'] + 20, 0.2, 0, 0.4)
	# 撤下山
	for k in range(10):
		add(crunch(S(), 0.2), T['l57'] + 10 + k * 10, 0.06, -0.3, 0.2)
	# 起源球特写
	add(chime(440, 3.0, a=0.015, bright=0.45), T['ball'] + 10, 0.09, 0, 0.55)
	add(norm(pad([220, 329.6], s(90), S(), harm=4)) * swell(n_of(s(90)), 0.4), T['ball'], 0.06, 0, 0.5)
	# 回山顶：第二只被收服，粉光落进手里；裂缝合上（倒吸进去、闷闷地合拢）
	add(whoosh(s(28), S(), 1400, 500, 0.5), T['l59'] + 8, 0.12, 0.2, 0.35)
	add(chime(329.6, 2.5, a=0.01, bright=0.4), T['l59'] + 34, 0.07, 0.2, 0.5)
	close_d = s(60)
	add(whoosh(close_d, S(), 1200, 120, 0.9, 1.4), T['close'] - 10, 0.28, 0, 0.35)
	add(boom(3.5, 45, 28, S(), air=0.05), T['close'] + 50, 0.35, 0, 0.5)
	# 夜里重新安静；图鉴两页
	add(brush(0.8, S(), 600, 1500), T['dex'] + 5, 0.07, -0.3, 0.35)
	add(brush(0.8, S(), 650, 1600), T['dex'] + 19, 0.07, 0.3, 0.35)
	add(chime(146.8, 3.0, a=0.02, bright=0.35), T['dex'] + 10, 0.07, -0.4, 0.55)
	add(chime(220, 3.0, a=0.02, bright=0.35), T['dex'] + 24, 0.07, 0.4, 0.55)
	# 吾思与夜空里的一点金光
	add(chime(587.3, 4.0, a=0.03, bright=0.25), T['cogita'] + 20, 0.05, 0.2, 0.7)
	add(pad([98, 146.8], s(300), S(), warm=0.7) * swell(n_of(s(300)), 0.6), T['cogita'], 0.06, 0, 0.5)

	# ════ 6 石板与雕像 ════
	bed(lambda d, k: wind(d, k, body=300, air=1500, gust=0.35, cold=1.1), T['end5'] - 30, T['fist'] + 20, 0.12, S(), a=1.5, b=1.0)
	add(boom(3.0, 70, 40, S(), air=0.1), T['card3'], 0.28, 0, 0.35)
	add(chime(164.8, 3.5, a=0.02, bright=0.3), T['card3'] + 2, 0.1, 0, 0.6)
	# 十八块石板从夜空深处飞来，落进圈里各一声轻的石音
	r = rng(77)
	for i in range(18):
		t0 = T['plates'] + (i * 7) % (18 * 7) * 0.9 + r.uniform(0, 20)
		p = math.cos(i / 18 * 2 * math.pi)
		add(whoosh(s(26), S(), 1100, 400, 0.4, 0.9), t0, 0.05, p * 0.8, 0.35)
		add(chime(196 * (1.5 ** (i % 4)) / (2 if i % 4 == 3 else 1), 2.0, a=0.01, bright=0.3), t0 + 24, 0.03, p * 0.8, 0.5)
	add(pad([98, 146.8, 196, 293.7], s(200), S()) * swell(n_of(s(200)), 0.4), T['ring'], 0.09, 0, 0.5)
	# 拳头石板
	add(boom(2.5, 60, 38, S(), air=0.05), T['fist'], 0.22, 0, 0.4)
	add(grind(s(70), S(), 350), T['l66'] + 30, 0.08, 0, 0.3)
	# 雷电石板：红色的天，闷雷
	add(whoosh(s(40), S(), 120, 500, 0.7), T['zap'] - 10, 0.18, 0, 0.35)
	bed(lambda d, k: wind(d, k, body=260, air=1000, gust=0.6, cold=0.6), T['zap'], T['celestica'] + 10, 0.13, S(), a=0.6, b=0.4)
	for k, b in enumerate([T['zap'] + 30, T['zap'] + 58, T['zap'] + 84, T['celestica'] - 6]):
		add(thunder(4.5, S(), dist=1.0 if k == 3 else 1.3), b + 2, 0.4 if k == 3 else 0.3, [-0.5, 0.6, 0.2, 0][k], 0.45)
	# 神阖寺院遗址：安静、空
	bed(lambda d, k: wind(d, k, body=360, air=1100, gust=0.3, cold=0.6), T['celestica'], T['end6'] + 20, 0.12, S(), a=1.0, b=1.0)
	add(pad([73.4, 110, 164.8], s(T['l70'] - T['l68']), S(), warm=0.7) * swell(n_of(s(T['l70'] - T['l68'])), 0.5), T['l68'], 0.06, 0, 0.5)
	# 被打碎的骑拉帝纳石像
	add(thud(1.0, 46, S()), T['l69'] - 10, 0.12, 0.3, 0.45)
	add(grind(s(40), S(), 300), T['l69'] - 6, 0.06, 0.3, 0.4)

	# ════ 7 望罗 ════
	bed(lambda d, k: wind(d, k, body=400, air=1200, gust=0.4, cold=0.6), T['end6'], T['memory'] + 10, 0.15, S(), a=1.0, b=0.8)
	add(whoosh(s(140), S(), 200, 1000, 0.6, 1.4), T['l73'] - 10, 0.12, 0, 0.35)
	# 脱下商会的衣服，被风卷走
	add(whoosh(s(60), S(), 500, 1800, 0.3, 1.6), T['coat'] + 5, 0.14, 0.5, 0.3)
	# 回忆（红）：裂缝撕开、双神发狂、金光、洗翠化为乌有、古代神奥人
	mem_d = s(T['back7'] - T['memory'])
	add(drone(30.9, mem_d, S(), 0.5) * fade(n_of(mem_d), 0.8, 1.5), T['memory'], 0.2, 0, 0.35)
	add(whoosh(s(80), S(), 120, 700, 0.7, 1.6), T['l75'] + 10, 0.22, 0, 0.35)
	add(growl(s(90), S(), 44), T['l75'] + 80, 0.12, -0.5, 0.5)
	add(growl(s(90), S(), 50), T['l75'] + 90, 0.12, 0.5, 0.5)
	add(thunder(4.0, S(), 1.6), T['l75'] + 100, 0.2, 0, 0.45)
	add(pad([130.8, 196, 261.6], s(150), S(), warm=1.0) * swell(n_of(s(150)), 0.5), T['l76'], 0.08, 0, 0.6)
	# 洗翠化成光点散去：向上飘散的气声，越来越轻
	add(whoosh(s(150), S(), 400, 1800, 0.2, 1.5), T['l77'] + 5, 0.12, 0, 0.5)
	add(pad([110, 164.8], s(150), S(), warm=0.6) * swell(n_of(s(150)), 0.2, 1.2, 2.0), T['l77'], 0.06, 0, 0.5)
	# 古代神奥人的跪拜：低沉的齐声
	add(pad([65.4, 98, 130.8], s(150), S(), warm=0.6, harm=8) * swell(n_of(s(150)), 0.5), T['l78'], 0.1, 0, 0.45)
	# 回到废墟，天暗下去
	bed(lambda d, k: wind(d, k, body=280, air=1100, gust=0.55, cold=0.8), T['back7'] - 10, T['l83'] + 30, 0.15, S(), a=1.0, b=1.5)
	add(whoosh(s(110), S(), 600, 120, 0.7, 1.6), T['back7'], 0.18, 0, 0.4)
	# 世界背面的裂口打开：深的回旋
	tear_d = s(T['l82'] + 85 - T['revTear'])
	add(drone(27.5, tear_d, S(), 0.7) * fade(n_of(tear_d), 1.0, 1.5), T['revTear'], 0.24, 0, 0.35)
	add(whoosh(s(50), S(), 100, 600, 0.8, 1.8), T['revTear'] - 15, 0.3, 0, 0.4)
	add(boom(3.0, 40, 24, S(), air=0.1), T['revTear'] + 25, 0.35, 0, 0.45)
	# 骑拉帝纳钻出来
	add(whoosh(s(55), S(), 160, 900, 0.7, 1.4), T['gira'], 0.24, 0, 0.35)
	# 全身发光，变成起源形态
	add(whoosh(s(42), S(), 200, 1600, 0.98, 1.4), T['origin'] - 42, 0.22, 0, 0.35)
	add(norm(pad([55, 82.4, 110], s(44), S(), harm=6)) * swell(n_of(s(44)), 0.98, 2.2, 0.5), T['origin'] - 42, 0.14, 0, 0.4)
	add(boom(4.0, 52, 26, S(), air=0.3), T['origin'], 0.55, 0, 0.45)
	# 没有天地之分的世界：倒着走的和声
	vd = s(T['duel'] - T['void7'])
	add(norm(pad([82.4, 116.5, 155.6], vd, S(), warm=0.7))[::-1] * fade(n_of(vd), 0.6, 0.6), T['void7'], 0.1, 0, 0.55)
	# 对抗：骑拉帝纳蓄力（暗红）→ 喷出 → 蓝白的光挡住、推回去 → 打中
	charge, firef, clash, hit = T['duel'] + 8, T['duel'] + 62, T['duel'] + 70, T['duel'] + 116
	add(energy(s(firef - charge), 41.2, S(), throb=3) * swell(n_of(s(firef - charge)), 0.95, 2.0, 0.5), charge, 0.16, 0, 0.3)
	add(whoosh(s(firef - charge), S(), 120, 600, 0.95, 1.4), charge, 0.12, 0, 0.3)
	dd = s(hit - firef + 4)
	add(energy(dd, 41.2, S(), throb=8) * fade(n_of(dd), 0.02, 0.1), firef, 0.26, -0.2, 0.3)
	bd = s(hit - clash + 10)
	add(energy(bd, 98, S(), throb=10) * fade(n_of(bd), 0.04, 0.15), clash - 2, 0.22, 0.4, 0.3)
	add(boom(2.0, 70, 40, S(), air=0.15), clash, 0.3, 0.1, 0.4)
	add(grind(s(hit - clash), S(), 600), clash, 0.08, 0.1, 0.3)
	add(boom(4.0, 55, 26, S(), air=0.3), hit, 0.6, 0, 0.45)
	add(thunder(3.5, S(), 1.3), hit + 3, 0.25, 0, 0.45)
	# 输了：淡一些的白光里变回别种形态，缩回裂口，裂口合上
	revert = T['l82'] + 6
	add(norm(pad([110, 164.8], s(30), S(), harm=4)) * swell(n_of(s(30)), 0.55), revert - 16, 0.1, 0, 0.45)
	add(boom(2.5, 60, 36, S(), air=0.05), revert, 0.25, 0, 0.45)
	add(whoosh(s(50), S(), 900, 140, 0.7, 1.4), T['l82'] + 22, 0.2, 0, 0.4)
	add(boom(3.0, 42, 26, S(), air=0.05), T['l82'] + 80, 0.3, 0, 0.5)
	# 望罗向天喊：只剩风
	add(pad([61.7, 92.5], s(T['l85'] - T['l83']), S(), warm=0.5) * swell(n_of(s(T['l85'] - T['l83'])), 0.6), T['l83'], 0.06, 0, 0.4)
	bed(lambda d, k: wind(d, k, body=380, air=1300, gust=0.35, cold=0.8), T['l83'] + 10, T['end7'] + 30, 0.13, S(), a=1.5, b=1.0)
	# 笛子变成天界之笛
	add(norm(pad([293.7, 440, 587.3], s(90), S(), harm=3)) * swell(n_of(s(90)), 0.35), T['flute'], 0.08, 0.2, 0.6)
	for i, f in enumerate([587.3, 740, 880]):
		add(chime(f, 3.0, a=0.02, bright=0.3), T['flute'] + 20 + i * 8, 0.05, 0.2, 0.65)
	# 望罗离开
	for k in range(10):
		add(crunch(S(), 0.2), T['l86'] + 60 + k * 12, 0.06 * (1 - k / 12), -0.2 - 0.06 * k, 0.25)

	# ════ 8 起始之殿 ════
	bed(lambda d, k: wind(d, k, body=340, air=1300, gust=0.35, cold=0.9), T['end7'] - 20, T['journey'] + 20, 0.14, S(), a=1.0, b=0.6)
	# 第一次吹笛：一段原创的短句，之后什么也没发生
	D5, E5, Fs5, A5, B5, D6 = 587.3, 659.3, 740, 880, 987.8, 1174.7
	add(flute([(D5, 0.45), (Fs5, 0.45), (A5, 1.3)], S()), T['play1'] + 4, 0.13, 0.15, 0.6)
	# 走遍洗翠：雪原的风、湿地的水、海岸的浪、火山的闷响、冻土的夜风，一格一格切
	lands = [
		lambda d, k: wind(d, k, body=420, air=1200, gust=0.3, cold=0.6),
		lambda d, k: lapping(d, k) + 0.3 * lp(noise(d, k + 1), 500, 2),
		lambda d, k: surf(d, k, 4.0),
		lambda d, k: lp(noise(d, k), 140, 3) * 3 + 0.3 * lp(noise(d, k + 2), 600, 2),
		lambda d, k: wind(d, k, body=300, air=1700, gust=0.5, cold=1.2),
	]
	for i, mk in enumerate(lands):
		t0 = T['journey'] + 14 + i * 36
		bed(mk, t0 - 6, t0 + 40, 0.15, S(), a=0.25, b=0.3)
		add(whoosh(s(16), S(), 500, 1500, 0.5), t0 - 8, 0.06, 0.3 - 0.15 * i, 0.3)
	bed(lambda d, k: wind(d, k, body=340, air=1300, gust=0.35, cold=0.9), T['stairs'] - 30, T['climb'] + 40, 0.14, S(), a=1.0, b=2.0)
	# 第二次吹笛，更长；光的阶梯一级级升起
	add(flute([(D5, 0.4), (Fs5, 0.4), (A5, 0.6), (B5, 0.4), (A5, 0.4), (D6, 1.6)], S()), T['play2'] + 2, 0.14, 0.15, 0.65)
	steps = [293.7, 329.6, 370, 440, 493.9, 587.3, 659.3, 740, 880]
	for i, f in enumerate(steps):
		add(chime(f, 2.4, a=0.015, bright=0.35), T['play2'] + 25 + i * 9, 0.045, -0.3 + 0.07 * i, 0.6)
	# 沿阶梯升上去、穿过云海，和声越来越满
	cd = s(T['arceus'] - T['climb'] + 30)
	add(whoosh(cd, S(), 200, 1100, 0.85, 1.6), T['climb'], 0.2, 0, 0.4)
	add(pad([98, 146.8, 196, 246.9, 293.7], cd, S(), warm=1.0) * swell(n_of(cd), 0.9, 1.8, 0.8), T['climb'], 0.13, 0, 0.5)
	# 阿尔宙斯显色：深而暖的鼓胀
	add(boom(5.0, 44, 26, S(), air=0.1), T['arceus'] + 10, 0.45, 0, 0.5)
	add(pad([65.4, 98, 130.8, 164.8, 196], s(200), S(), warm=1.1, harm=7) * swell(n_of(s(200)), 0.3, 1.6, 1.4), T['arceus'], 0.14, 0, 0.55)
	# 全片最大爆发点：金白光爆——整片超低频 + 宽而暖的和声 + 长长的泛光，不靠高频
	add(whoosh(s(30), S(), 150, 1000, 0.97, 1.3), T['burst8'] - 30, 0.25, 0, 0.35)
	add(boom(8.0, 46, 20, S(), air=0.25), T['burst8'], 1.0, 0, 0.5)
	add(thunder(7.0, S(), 1.6), T['burst8'] + 4, 0.3, 0, 0.55)
	bloom_d = s(T['l93'] - T['burst8'])
	add(pad([65.4, 98, 130.8, 196, 261.6, 329.6, 392], bloom_d, S(), warm=1.3, harm=6) * swell(n_of(bloom_d), 0.15, 1.2, 1.8), T['burst8'], 0.2, 0, 0.6)
	for i, f in enumerate([523.3, 659.3, 784, 1046.5, 784, 659.3]):
		add(chime(f, 5.0, a=0.06, bright=0.2), T['burst8'] + 20 + i * 14, 0.035, -0.6 + 0.24 * i, 0.75)
	# 分身：一点金光落进手里
	add(whoosh(s(40), S(), 1300, 500, 0.6), T['gift'] - 10, 0.1, 0.2, 0.4)
	add(chime(392, 4.0, a=0.02, bright=0.4), T['gift'] + 25, 0.1, 0.2, 0.6)
	add(chime(587.3, 4.0, a=0.03, bright=0.3), T['gift'] + 31, 0.06, 0.2, 0.65)
	# 拉开：断柱 = 枪之柱
	bed(lambda d, k: wind(d, k, body=360, air=1200, gust=0.3, cold=0.7), T['l94'] - 20, T['end8'] + 40, 0.13, S(), a=2.0, b=1.0)
	add(pad([98, 146.8, 196], s(T['end8'] - T['l94']), S(), warm=0.9) * swell(n_of(s(T['end8'] - T['l94'])), 0.3, 1.4, 1.6), T['l94'], 0.08, 0, 0.55)

	# ════ 9 神奥之名 ════
	add(whoosh(s(60), S(), 300, 1200, 0.3, 1.5), T['end8'], 0.12, 0, 0.5)
	bed(lambda d, k: surf(d, k, 8.0), T['prelude'] - 20, T['night9'] + 20, 0.18, S(), a=2.0, b=2.5)
	bed(lambda d, k: wind(d, k, body=480, air=900, gust=0.25, cold=0.3), T['prelude'] - 20, T['night9'] + 20, 0.07, S(), a=2.0, b=2.5)
	# "洗翠"化成"神奥"：笔画重写一遍
	add(brush(1.0, S(), 700, 1800), T['l97'] - 5, 0.11, -0.2, 0.4)
	add(brush(1.0, S(), 800, 2100), T['l97'] + 20, 0.11, 0.2, 0.4)
	add(chime(293.7, 4.0, a=0.03, bright=0.35), T['l97'] + 30, 0.07, 0, 0.6)
	# 蓝、白两道光合成一道：两个音合成一个和弦
	add(norm(pad([146.8], s(80), S(), harm=4)) * swell(n_of(s(80)), 0.7), T['l98'], 0.07, -0.6, 0.45)
	add(norm(pad([220], s(80), S(), harm=4)) * swell(n_of(s(80)), 0.7), T['l98'], 0.07, 0.6, 0.45)
	add(pad([73.4, 110, 146.8, 185, 220], s(140), S()) * swell(n_of(s(140)), 0.3), T['l98'] + 50, 0.1, 0, 0.55)
	# 回到开场的月夜断柱
	bed(lambda d, k: wind(d, k, body=320, air=1600, gust=0.45, cold=1.2), T['night9'] - 20, T['end9'] + 15, 0.2, S(), a=2.5, b=3.0)
	add(norm(osc(146.8, s(150)) + 0.3 * osc(293.7, s(150))) * swell(n_of(s(150)), 0.4), T['cyrus9'], 0.045, -0.6, 0.5)
	add(norm(osc(220, s(150)) + 0.3 * osc(440.5, s(150))) * swell(n_of(s(150)), 0.5), T['cyrus9'] + 10, 0.04, 0.6, 0.5)
	# 天顶一点金光，淡出
	add(chime(587.3, 6.0, a=0.05, bright=0.25), T['l102'] - 10, 0.06, 0, 0.75)
	tail = s(T['end9'] - T['l102'] + 15)
	add(pad([73.4, 110, 146.8, 220], tail, S(), warm=0.8) * swell(n_of(tail), 0.35, 1.6, 1.8), T['l102'] - 20, 0.08, 0, 0.6)
	return M


def write(path, x):
	os.makedirs(os.path.dirname(path), exist_ok=True)
	wavfile.write(path, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))


def main():
	M = build()
	out = M.render()
	# 整期结尾最后一点淡到 0
	nf = n_of(s(T['end9'] - T['fade9']))
	e0 = n_of(s(T['end9']))
	out[e0 - nf : e0] *= np.linspace(1, 0, nf)[:, None] ** 1.5
	out[e0:] = 0
	out = out[:e0]
	write(os.path.join(OUT, 'hisui-sfx-v2.wav'), out)
	for k, (name, a, b) in enumerate(SEGS, 1):
		write(os.path.join(OUT, 'sfx', f'hisui-s{k}-{name}-sfx-v2.wav'), out[n_of(s(a)) if a else 0 : n_of(s(b))])
	for k, (a, b) in enumerate(PARTS, 1):
		write(os.path.join(OUT, 'sfx', f'hisui-part{k}-sfx-v2.wav'), out[n_of(s(a)) if a else 0 : n_of(s(b))])
	print('done', out.shape[0] / SR, 's')


if __name__ == '__main__':
	main()
