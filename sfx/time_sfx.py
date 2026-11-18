"""
《时间的心跳》（代码短名 time）音效轨。用户剪辑时自己放配乐《千年之后》，这条轨只做画面里的动作声，没有旋律。
本期的音色是专门为这一期设计的，全部用 numpy 合成，不用外部素材：

  · 钟表：滴答（钢）、擒纵的"嗒—咔"、齿轮的棘轮声——量时间的东西；
  · 玻璃与水：杯子碎裂（倒流时把碎裂声倒着放，碎片"被吸回去"）、水滴、涟漪、墨在水里散开；
  · 心跳：帝牙卢卡的心跳低沉，带一点金属钟的余振；观众的心跳更暖、更轻，结尾两者慢慢对齐；
  · 光：起源形态与片名用晶体般的泛音和一声低沉的"开花"；时光咆哮是全片唯一的重低音冲击。

两段"时间停住"（第 6–7 小节、第 58 小节到第 60 小节第 3 拍）几乎静音，只留一点耳鸣般的高音 / 心跳。
叫声处（第 16、30、52 小节强拍）主音轨压低 8 dB，冲击的低频不压。

时间轴与 src/scenes/time/common.ts 完全一致：112.905 BPM，第 0 小节强拍 0.087 秒，第 72 小节强拍（153.14 秒）结束。

输出：
  out/时间的心跳/time-sfx.wav           整期
  out/时间的心跳/sfx/time-part1-sfx.wav  上篇（第 1–3 段），part2 / part3 同理，与三个视频文件一一对应
用法：python sfx/time_sfx.py
"""
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
BPM = 112.905
BEAT = 60 / BPM
BAR = BEAT * 4
DOWN0 = 0.087


def bt(bar: float, beat: float = 0.0) -> float:
	"""第 bar 小节第 beat 拍的秒数（与 common.ts 的 bf() / 30 相同）"""
	return DOWN0 + bar * BAR + beat * BEAT


def fr(frames: float) -> float:
	"""30fps 帧数 → 秒"""
	return frames / 30


TOTAL = round(bt(72) * 30) / 30
N = int(TOTAL * SR) + SR * 4
rng = np.random.default_rng(20261025)

# 三条母线：main（受叫声闪避、送混响）、impact（低频冲击，不闪避）、heart（心跳，静段里也保留）
BUS = {k: np.zeros((2, N)) for k in ('main', 'impact', 'heart')}


def place(bus: str, t: float, sig: np.ndarray, gain: float = 1.0, pan: float = 0.0):
	"""在 t 秒处放一段单声道信号；pan −1 左 … +1 右（等功率）"""
	i = int(round(t * SR))
	if i >= N or len(sig) == 0:
		return
	if i < 0:
		sig = sig[-i:]
		i = 0
	sig = sig[: N - i]
	a = (pan + 1) * np.pi / 4
	BUS[bus][0, i : i + len(sig)] += sig * gain * np.cos(a)
	BUS[bus][1, i : i + len(sig)] += sig * gain * np.sin(a)


def place_st(bus: str, t: float, lr: np.ndarray, gain: float = 1.0):
	i = int(round(t * SR))
	n = min(lr.shape[1], N - i)
	BUS[bus][:, i : i + n] += lr[:, :n] * gain


# ── 基本素材 ──
def tt(dur: float) -> np.ndarray:
	return np.arange(int(dur * SR)) / SR


def noise(dur: float) -> np.ndarray:
	return rng.standard_normal(int(dur * SR))


def bp(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
	return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def lp(x: np.ndarray, f: float, order: int = 2) -> np.ndarray:
	return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)


def hp(x: np.ndarray, f: float, order: int = 2) -> np.ndarray:
	return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)


def sweep_bp(x: np.ndarray, f0: float, f1: float, q: float = 1.2, block: float = 0.01) -> np.ndarray:
	"""中心频率从 f0 滑到 f1 的带通（分块滤波、保留状态，几乎无接缝）"""
	n = len(x)
	bl = int(block * SR)
	out = np.zeros(n)
	zi = None
	for k in range(0, n, bl):
		u = k / max(n - 1, 1)
		fc = f0 * (f1 / f0) ** u
		lo, hi = fc / (1 + 0.5 / q), min(fc * (1 + 0.5 / q), SR * 0.45)
		sos = butter(2, [lo, hi], 'band', fs=SR, output='sos')
		if zi is None or zi.shape[0] != sos.shape[0]:
			zi = np.zeros((sos.shape[0], 2))
		seg, zi = sosfilt(sos, x[k : k + bl], zi=zi)
		out[k : k + bl] = seg
	return out


def envelope(dur: float, a: float, d: float, curve: float = 1.0) -> np.ndarray:
	"""a 秒线性起音，之后到 dur 结束按指数衰减到很小"""
	t = tt(dur)
	att = np.clip(t / max(a, 1e-4), 0, 1)
	dec = np.exp(-np.maximum(t - a, 0) / max(d, 1e-4)) ** curve
	return att * dec


def fade(x: np.ndarray, fin: float = 0.005, fout: float = 0.02) -> np.ndarray:
	n = len(x)
	a, b = int(fin * SR), int(fout * SR)
	y = x.copy()
	if a:
		y[: min(a, n)] *= np.linspace(0, 1, min(a, n))
	if b:
		y[-min(b, n) :] *= np.linspace(1, 0, min(b, n))
	return y


def norm(x: np.ndarray) -> np.ndarray:
	m = np.max(np.abs(x))
	return x / m if m > 0 else x


# ── 钟表 ──
def tick(bright: float = 1.0, size: float = 1.0) -> np.ndarray:
	"""钢的滴答：一记极短的噪声 + 两三个高频共振"""
	d = 0.09
	t = tt(d)
	click = bp(noise(d), 2500 * bright, 9000) * np.exp(-t / 0.0025)
	ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / (0.012 * size)) * w for f, w in ((3100 * bright, 0.6), (4870 * bright, 0.4), (7230 * bright, 0.25)))
	return fade(norm(click * 0.8 + ring * 0.5), 0.0005, 0.01)


def tock() -> np.ndarray:
	return tick(0.72, 1.3)


def clank(f: float = 420) -> np.ndarray:
	"""金属件落位：中频的短促碰撞 + 金属泛音"""
	d = 0.5
	t = tt(d)
	hit = bp(noise(d), 300, 3000) * np.exp(-t / 0.008)
	ring = sum(np.sin(2 * np.pi * f * r * t + r) * np.exp(-t / (0.09 / r**0.5)) * w for r, w in ((1, 0.7), (2.41, 0.45), (3.93, 0.3), (5.6, 0.18)))
	return fade(norm(hit * 0.6 + ring * 0.6), 0.0005, 0.05)


def ratchet(dur: float, rate0: float, rate1: float, bright: float = 1.0) -> np.ndarray:
	"""棘轮：一串越来越快（或越来越慢）的细小滴答"""
	out = np.zeros(int(dur * SR) + SR // 10)
	t = 0.0
	tk = tick(bright * 1.1, 0.5)
	while t < dur:
		u = t / dur
		i = int(t * SR)
		out[i : i + len(tk)] += tk * (0.6 + 0.4 * rng.random())
		t += 1 / (rate0 + (rate1 - rate0) * u)
	return out


# ── 玻璃与水 ──
def glass_ping(f: float, dur: float = 0.6) -> np.ndarray:
	t = tt(dur)
	parts = ((1, 1), (2.32, 0.55), (4.25, 0.35), (6.63, 0.2))
	x = sum(np.sin(2 * np.pi * f * r * t + rng.random() * 6) * np.exp(-t / (dur * 0.35 / r**0.6)) * w for r, w in parts)
	return fade(x, 0.0008, 0.05)


def shatter(dur: float = 1.4, size: float = 1.0) -> np.ndarray:
	"""玻璃碎裂：高频噪声爆开 + 一簇随机的玻璃泛音 + 一点低的落地声"""
	n = int(dur * SR)
	out = np.zeros(n)
	t = tt(dur)
	out += hp(noise(dur), 2200) * np.exp(-t / (0.09 * size)) * 0.9
	out += bp(noise(dur), 600, 2500) * np.exp(-t / 0.03) * 0.6
	for _ in range(int(46 * size)):
		at = rng.exponential(0.12 * size)
		if at > dur - 0.3:
			continue
		p = glass_ping(rng.uniform(2200, 7800), rng.uniform(0.15, 0.5)) * rng.uniform(0.1, 0.45)
		i = int(at * SR)
		out[i : i + len(p)] += p[: n - i]
	out += lp(noise(dur), 180) * np.exp(-t / 0.05) * 1.4
	return fade(norm(out), 0.0005, 0.1)


def drop_plink() -> np.ndarray:
	"""水滴落水：一记向上滑的共振 + 一点溅水"""
	d = 0.5
	t = tt(d)
	f = 700 + 1300 * (1 - np.exp(-t / 0.012))
	ph = 2 * np.pi * np.cumsum(f) / SR
	tone = np.sin(ph) * np.exp(-t / 0.05)
	spl = hp(noise(d), 3000) * np.exp(-t / 0.02) * 0.25
	return fade(norm(tone + spl), 0.0005, 0.05)


def bloop(f0: float = 520) -> np.ndarray:
	"""涟漪：柔和下滑的水声"""
	d = 0.7
	t = tt(d)
	f = f0 * (0.55 + 0.45 * np.exp(-t / 0.08))
	ph = 2 * np.pi * np.cumsum(f) / SR
	return fade(np.sin(ph) * envelope(d, 0.01, 0.16), 0.002, 0.05)


def underwater_bloom(dur: float = 3.0) -> np.ndarray:
	"""墨在水里散开：低沉、慢慢鼓起来的水下声"""
	t = tt(dur)
	x = lp(noise(dur), 420, 3) * (1 - np.exp(-t / 0.4)) * np.exp(-t / 1.4)
	x += np.sin(2 * np.pi * 62 * t + 2 * np.sin(2 * np.pi * 0.7 * t)) * (1 - np.exp(-t / 0.3)) * np.exp(-t / 1.2) * 0.5
	return fade(norm(x), 0.02, 0.4)


# ── 空气与光 ──
def whoosh(dur: float, f0: float, f1: float, peak: float = 0.6, q: float = 1.0) -> np.ndarray:
	"""气流：带通噪声的中心频率滑动，音量在 peak（0–1 位置）最大"""
	t = tt(dur)
	u = t / dur
	envl = np.where(u < peak, (u / peak) ** 2, np.exp(-(u - peak) / (1 - peak) * 3.2))
	return fade(norm(sweep_bp(noise(dur), f0, f1, q)) * envl, 0.005, 0.05)


def shimmer(dur: float, base: float, rise: float = 1.0, density: int = 26) -> np.ndarray:
	"""晶体般的闪光：一串高频的小泛音，整体随 rise 往上爬"""
	n = int(dur * SR)
	out = np.zeros(n)
	for _ in range(density):
		at = rng.uniform(0, dur * 0.8)
		f = base * rng.uniform(1, 2.2) * (1 + (rise - 1) * at / dur)
		p = glass_ping(f, rng.uniform(0.3, 0.9)) * rng.uniform(0.2, 0.6)
		i = int(at * SR)
		out[i : i + len(p)] += p[: n - i]
	return fade(norm(out), 0.01, 0.1)


def bloom(dur: float = 3.0, f: float = 98) -> np.ndarray:
	"""一声低沉的"开花"：低频的和声慢慢展开，带一点空气"""
	t = tt(dur)
	x = sum(np.sin(2 * np.pi * f * r * t + r) * w for r, w in ((1, 1), (1.5, 0.5), (2, 0.45), (3, 0.2), (4, 0.12)))
	x = x * envelope(dur, 0.04, dur * 0.35)
	x += lp(noise(dur), 900) * envelope(dur, 0.01, 0.4) * 0.4
	return fade(norm(x), 0.005, 0.3)


def boom(dur: float = 2.6, f0: float = 70, f1: float = 30) -> np.ndarray:
	"""冲击：从 f0 掉到 f1 的次低频 + 一记闷响"""
	t = tt(dur)
	f = f1 + (f0 - f1) * np.exp(-t / 0.25)
	ph = 2 * np.pi * np.cumsum(f) / SR
	x = np.sin(ph) * envelope(dur, 0.004, 0.7)
	x += lp(noise(dur), 220, 3) * np.exp(-t / 0.08) * 1.2
	return fade(norm(x), 0.0005, 0.3)


def riser(dur: float, f0: float, f1: float) -> np.ndarray:
	"""上扬：越来越亮的噪声 + 一个往上爬的音"""
	t = tt(dur)
	u = t / dur
	x = norm(sweep_bp(noise(dur), f0, f1, 0.8)) * u**2.2
	f = 110 * (1 + 3 * u**2)
	x += np.sin(2 * np.pi * np.cumsum(f) / SR) * u**3 * 0.25
	return fade(norm(x), 0.05, 0.01)


def hum(dur: float, f: float, wob: float = 0.3) -> np.ndarray:
	t = tt(dur)
	return np.sin(2 * np.pi * f * t + wob * np.sin(2 * np.pi * 0.31 * t)) * 0.7 + np.sin(2 * np.pi * f * 2.003 * t) * 0.3


def chord_ring(dur: float, base: float) -> np.ndarray:
	"""金蓝的和声余振（再生之后的那一圈）：几个钟形泛音慢慢衰减"""
	t = tt(dur)
	x = np.zeros(len(t))
	for r, w in ((1, 1), (1.5, 0.7), (2, 0.5), (2.76, 0.3), (4, 0.2)):
		x += np.sin(2 * np.pi * base * r * t + r) * np.exp(-t / (dur * 0.45 / r**0.4)) * w
	return fade(norm(x), 0.01, 0.4)


# ── 心跳 ──
def heartbeat(kind: str = 'dialga') -> np.ndarray:
	"""一次心跳（lub—dub）。dialga：更低、更重，带金属钟的余振；human：更暖、更轻"""
	d = 1.2
	t = tt(d)

	def thump(f0, f1, dec):
		f = f1 + (f0 - f1) * np.exp(-t / 0.03)
		return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / dec)

	if kind == 'dialga':
		lub = thump(78, 42, 0.11) + lp(noise(d), 160) * np.exp(-t / 0.02) * 0.5
		bell = sum(np.sin(2 * np.pi * f * t + i) * np.exp(-t / dc) * w for i, (f, dc, w) in enumerate(((196, 0.55, 0.16), (311, 0.4, 0.1), (466, 0.3, 0.07))))
		x = lub + bell
		dub = thump(92, 50, 0.08) * 0.55
		off = int(0.2 * SR)
		x[off:] += dub[: len(x) - off]
	else:
		lub = thump(96, 58, 0.07) + bp(noise(d), 80, 400) * np.exp(-t / 0.015) * 0.3
		x = lub
		dub = thump(110, 66, 0.055) * 0.6
		off = int(0.17 * SR)
		x[off:] += dub[: len(x) - off]
	return fade(norm(x), 0.001, 0.2)


HB_D = heartbeat('dialga')
HB_H = heartbeat('human')
TICK = tick()
TOCK = tock()


def card_flick() -> np.ndarray:
	d = 0.05
	t = tt(d)
	return fade(bp(noise(d), 1800, 7000) * np.exp(-t / 0.006), 0.0005, 0.01)


def riffle(dur: float = 0.42, n: int = 34) -> np.ndarray:
	out = np.zeros(int(dur * SR) + SR // 10)
	for k in range(n):
		at = dur * (k / n) ** 0.85
		f = card_flick() * (0.5 + 0.5 * rng.random())
		i = int(at * SR)
		out[i : i + len(f)] += f
	return fade(norm(out), 0.002, 0.05)


def rain_bed(dur: float) -> np.ndarray:
	"""雨：一层柔和的白噪声 + 许多细小的雨点"""
	n = int(dur * SR)
	x = bp(noise(dur), 900, 7000) * 0.35
	for _ in range(int(dur * 70)):
		at = rng.uniform(0, dur)
		dd = 0.03
		tq = tt(dd)
		p = np.sin(2 * np.pi * rng.uniform(1800, 5200) * tq) * np.exp(-tq / 0.004) * rng.uniform(0.1, 0.5)
		i = int(at * SR)
		x[i : i + len(p)] += p[: n - i]
	return x


def speed_change(x: np.ndarray, rate: float) -> np.ndarray:
	"""变速（音高随之变化）：rate > 1 快放"""
	idx = np.arange(0, len(x) - 1, rate)
	return np.interp(idx, np.arange(len(x)), x)


def tape_stop(x: np.ndarray, dur: float) -> np.ndarray:
	"""磁带停转：dur 秒内速度从 1 降到 0"""
	n = int(dur * SR)
	speed = np.linspace(1, 0, n) ** 1.3
	pos = np.cumsum(speed)
	pos = pos[pos < len(x) - 1]
	return np.interp(pos, np.arange(len(x)), x) * np.linspace(1, 0.2, len(pos))


# ═══════════════════ 1 钩子（第 0–5 小节） ═══════════════════
SHATTER_T = bt(0, 2)
place('main', 0.0, whoosh(SHATTER_T, 1800, 700, 0.95, 2.0), 0.08)
sh = shatter(1.5, 1.0)
place('main', SHATTER_T, sh, 0.62)
# 时间轴出现：刻度每拍从"现在"经过一格（滴—答）
place('main', bt(1), whoosh(0.5, 900, 2600, 0.3), 0.1, 0.0)
for k in range(8):
	place('main', bt(1, k), TICK if k % 2 == 0 else TOCK, 0.22, -0.1)
# 第 3 小节：箭头翻转、碎片倒飞拼回——碎裂声倒着放，末尾正好落在拼好的那一刻
REW_A, REW_B = bt(3), bt(3, 3)
place('main', REW_A, whoosh(0.45, 2600, 700, 0.15), 0.16)
rev = sh[::-1][-int(1.2 * SR) :]
place('main', REW_B - len(rev) / SR, rev, 0.45)
for k in range(4):
	place('main', bt(3, k), TOCK if k % 2 == 0 else TICK, 0.18, 0.1)
place('main', REW_B, glass_ping(2600, 1.4), 0.3)
# 第 4 小节：杯中一点光升起，展开成片名
place('main', bt(4), shimmer(1.4, 2200, 1.6, 22), 0.22)
place('main', bt(4, 1.4), bloom(3.4, 82), 0.32)
for i in range(5):
	place('main', bt(4, 1.4) + fr(i * 5), glass_ping(3300 + i * 260, 0.7), 0.07, (i - 2) * 0.15)
# 第 5 小节：往下摇，时间慢下来、停住
place('main', bt(5), whoosh(BAR * 1.05, 1600, 300, 0.45, 0.9), 0.14)
slow = hum(BAR, 330, 0.2) * np.linspace(1, 0, int(BAR * SR)) ** 2
place('main', bt(5, 2), speed_change(slow, 0.7)[: int(BAR * SR)], 0.04)

# ═══════════════════ 2 静止与流动（第 6–13 小节） ═══════════════════
# 静段：几乎无声（只有一点耳鸣般的高音，见混音部分的 ears）
# 第 8 小节：水滴落下，落水，涟漪每拍一圈
DROP_HIT = bt(8, 1)
place('main', bt(8), whoosh(BEAT, 3000, 1200, 0.9, 2.0), 0.05)
place('main', DROP_HIT, drop_plink(), 0.42)
for k in range(7):
	place('main', DROP_HIT + k * BEAT, bloop(560 - k * 30), 0.2 * 0.82**k)
# "变化"的小标注
for k in range(3):
	place('main', bt(9, k), glass_ping(3800 + k * 300, 0.35), 0.08, (-0.2, 0.3, -0.4)[k])
# 涟漪立成星盘：刻度一圈圈点亮
place('main', bt(10), whoosh(BAR, 400, 1400, 0.55, 0.8), 0.12)
place('main', bt(10, 2), ratchet(BAR, 10, 34, 0.9), 0.07)
# 混沌的漩涡
cha = bp(noise(BAR * 1.8), 180, 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.4 * tt(BAR * 1.8)))
place('main', bt(10, 2), fade(cha * envelope(BAR * 1.8, 0.8, 1.6), 0.4, 0.4), 0.06)
# 蛋：一点温暖的嗡声
place('main', bt(11, 2), fade(hum(BAR * 0.8, 220, 0.4) * envelope(BAR * 0.8, 0.3, 0.7), 0.2, 0.3), 0.05)
# 两道光分开：钴蓝往左、淡粉往右
place('main', bt(12), whoosh(BEAT * 2, 1400, 500, 0.4), 0.16, -0.65)
place('main', bt(12), whoosh(BEAT * 2, 2000, 4800, 0.4), 0.11, 0.7)
place('main', bt(12, 1), whoosh(BEAT * 2, 300, 900, 0.85), 0.08, -0.6)
# 第 13 句：钻石一闪，时间轴从胸口射出（从左往右）
place('heart', bt(13), HB_D, 0.55, -0.5)
zing_d = BAR
zt = tt(zing_d)
zf = 500 + 2200 * (1 - np.exp(-zt / 0.25))
zing = np.sin(2 * np.pi * np.cumsum(zf) / SR) * np.exp(-zt / 0.4) * 0.3 + whoosh(zing_d, 1200, 5200, 0.12) * 0.7
zl = np.stack([zing * np.cos(np.linspace(0.2, 1.4, len(zing))), zing * np.sin(np.linspace(0.2, 1.4, len(zing)))])
place_st('main', bt(13), zl, 0.16)

# ═══════════════════ 3 节拍（第 14–21 小节） ═══════════════════
# 上扬：棘轮越转越快，空气越来越亮
place('main', bt(14), riser(BAR * 2, 400, 5000), 0.12)
place('main', bt(14), ratchet(BAR * 2 - BEAT, 4, 22, 1.0), 0.06)
# 五个"重复的东西"按拍弹出（声相跟着画面）
place('heart', bt(14), heartbeat('human'), 0.28, -0.1)
place('main', bt(14), glass_ping(2400, 0.5), 0.1, -0.1)
for k in range(6):
	place('main', bt(14, 2 + k), TICK if k % 2 == 0 else TOCK, 0.2, -0.15)
place('main', bt(14, 2), clank(520), 0.1, -0.15)
for at, f, pn in ((bt(15), 2900, 0.35), (bt(15, 1), 3300, 0.55), (bt(15, 2), 3800, 0.75)):
	place('main', at, glass_ping(f, 0.6), 0.12, pn)
# 第 15 小节第 4 拍：所有节拍一起闪，化成光飞回原点
for f, pn in ((2400, -0.2), (2900, 0.2), (3300, 0.5), (3800, 0.7), (4300, 0.0)):
	place('main', bt(15, 3), glass_ping(f, 0.4), 0.07, pn)
whip = whoosh(BEAT * 1.05, 800, 4000, 0.92, 0.9)
wl = np.stack([whip * np.cos(np.linspace(1.3, 0.3, len(whip))), whip * np.sin(np.linspace(1.3, 0.3, len(whip)))])
place_st('main', bt(15, 3) - 0.02, wl, 0.26)
# 第 16 小节：在钻石上拉开，帝牙卢卡显形
REVEAL = bt(16)
place('impact', REVEAL, boom(2.8, 64, 32), 0.5)
place('main', REVEAL, bloom(3.5, 73), 0.3)
place('main', REVEAL, shimmer(2.2, 2600, 1.2, 30), 0.14)
# 心跳：显形后每两拍一次，身后的齿轮跟着推一格
HEART0 = bt(16)
for k in range(int((bt(22) - HEART0) / (BEAT * 2)) + 1):
	at = HEART0 + k * BEAT * 2
	if at >= bt(22):
		break
	place('heart', at, HB_D, 0.5, -0.25)
	place('main', at + 0.03, clank(340), 0.05, 0.45)
	place('main', at + 0.03, TOCK, 0.08, 0.45)

# ═══════════════════ 4 时间之箭（第 22–33 小节） ═══════════════════
# 镜头沿箭头往右推；箭头一路流（很轻的气流）
place('main', bt(22), whoosh(BAR, 600, 1800, 0.35), 0.12, 0.3)
flow_d = bt(28, 2) - bt(22)
flow = bp(noise(flow_d), 500, 2400) * (0.7 + 0.3 * np.sin(2 * np.pi * (BPM / 60) / 2 * tt(flow_d)))
place('main', bt(22), fade(flow, 1.0, 1.5), 0.018)
place('main', bt(22, 2), glass_ping(1900, 1.2), 0.12, 0.4)
# 墨滴
place('main', bt(23) + fr(10), drop_plink(), 0.28, 0.3)
place('main', bt(23) + fr(12), underwater_bloom(3.4), 0.26, 0.3)
# 一副牌一张张出现
for i in range(52):
	place('main', bt(24, 2) + fr(i * 0.35), card_flick(), 0.1 * (0.6 + 0.4 * rng.random()), 0.1 + (i % 13 - 6) * 0.04)
# 52! 的 68 位数字逐位滚出，最后"咔"地定住
roll_d = fr(4 + 67 * 0.34 + 4)
place('main', bt(25, 2), ratchet(roll_d, 60, 90, 1.3), 0.06)
place('main', bt(25, 2) + roll_d, glass_ping(3100, 1.0), 0.16)
place('main', bt(25, 2) + roll_d, clank(600), 0.07)
# 整副牌缩成一点；周围铺开一大片灰点
place('main', bt(26, 2), whoosh(0.4, 3000, 900, 0.95, 1.4), 0.14)
place('main', bt(26, 2) + 0.38, glass_ping(4200, 0.9), 0.14)
place('main', bt(26, 2) + 0.15, shimmer(0.9, 4000, 1.0, 40), 0.05)
# 重新展开、连洗几次
place('main', bt(27, 2) - fr(8), whoosh(0.3, 900, 3000, 0.4), 0.1)
for at in (bt(27, 2), bt(27, 3), bt(28), bt(28, 1)):
	place('main', at, riffle(), 0.2, 0.15)
# 这就是时间的箭头：一切顺着箭头流
place('main', bt(28, 2), whoosh(BAR * 0.9, 500, 2600, 0.5), 0.15, 0.4)
# 光明涌来：越来越亮，逆着箭头摇回帝牙卢卡
FLOOD_D = bt(30) - bt(28, 2)
place('main', bt(28, 2), riser(FLOOD_D, 300, 6000), 0.16)
place('main', bt(29), shimmer(FLOOD_D - BEAT * 2, 2000, 2.2, 36), 0.1)
swing = whoosh(BAR * 0.5, 2400, 700, 0.85)
sl = np.stack([swing * np.cos(np.linspace(1.4, 0.4, len(swing))), swing * np.sin(np.linspace(1.4, 0.4, len(swing)))])
place_st('main', bt(29, 2), sl, 0.18)
# 第 30 小节：起源形态
ORIGIN_T = bt(30)
place('impact', ORIGIN_T, boom(3.0, 58, 30), 0.42)
place('main', ORIGIN_T, bloom(4.0, 87), 0.3)
place('main', ORIGIN_T, shimmer(2.6, 3000, 1.3, 36), 0.14)
for k in range(2):
	place('heart', ORIGIN_T + BEAT * 2 * (k + 1), HB_D, 0.4, -0.3)
# 箭头按拍翻转：往回时用倒放的气流
flips = [(bt(32, 2), -1), (bt(33), 1), (bt(33, 1), -1), (bt(33, 2), 1), (bt(33, 3), -1), (bt(34), 1)]
for at, d in flips:
	w = whoosh(0.35, 900, 2600, 0.5)
	place('main', at, w[::-1] if d < 0 else w, 0.13, 0.35 * d)
	place('main', at, TICK if d > 0 else TOCK, 0.12, 0.35 * d)
# 速度也不固定：滴答忽快忽慢
t = bt(33, 2)
k = 0
while t < bt(34, 2):
	place('main', t, TICK if k % 2 == 0 else TOCK, 0.1, 0.3)
	t += BEAT * (0.5 + 0.45 * np.sin(k * 1.3) + 0.5)
	k += 1

# ═══════════════════ 5 快与慢（第 34–43 小节） ═══════════════════
# 往下摇到"我们的世界"
place('main', bt(34), whoosh(BAR * 1.4, 1600, 380, 0.4, 0.9), 0.15)
# GPS 卫星：每两拍一记柔和的电子"嘀"
for k in range(int((bt(38, 2) - bt(34, 2)) / (BEAT * 2))):
	at = bt(34, 2) + k * BEAT * 2
	tq = tt(0.25)
	ping = np.sin(2 * np.pi * 1760 * tq) * np.exp(-tq / 0.05)
	place('main', at, fade(ping, 0.002, 0.05), 0.035, -0.6)
# 两只钟：地面每拍一下；卫星的钟同时走，但越走越靠前（一点点"双响"）
for k in range(int((bt(38, 2) - bt(35)) / BEAT)):
	at = bt(35) + k * BEAT
	lead = min(0.045, 0.006 * k)
	place('main', at, TICK if k % 2 == 0 else TOCK, 0.15, 0.15)
	place('main', at - lead, tick(1.25, 0.8), 0.11, 0.45)
# "每天快 38 微秒"：读数滚动的细小电子声
place('main', bt(35, 2), ratchet(BAR * 0.5, 40, 12, 1.4), 0.03, 0.3)
# 导航偏差：一条往上爬的细音，偏到 10 公里时"叮"
dr = bt(37, 3) - bt(36, 3)
dt_ = tt(dr)
dtone = np.sin(2 * np.pi * np.cumsum(500 + 900 * (dt_ / dr) ** 1.5) / SR) * (0.3 + 0.7 * dt_ / dr)
place('main', bt(36, 3), fade(dtone, 0.1, 0.05), 0.04, 0.35)
place('main', bt(37, 3), glass_ping(2400, 1.0), 0.13, 0.35)
# 升回神话那一层
place('main', bt(38), whoosh(BAR, 400, 1500, 0.6), 0.14)
# 雨：正着下 → 往过去（倒着下）→ 往未来（快放）→ 几乎悬停 → 第 42 小节恢复
R0, R1 = bt(38, 2), bt(44) + 1.0
rain = rain_bed(R1 - R0 + 2)
PAST_A, PAST_B = bt(40, 2), bt(40, 3) + fr(10)
FUT_A, FUT_B = PAST_B, bt(41, 2)
HANG_A, HANG_B = bt(41, 3), bt(42)
seg = lambda a, b: rain[int((a - R0) * SR) : int((b - R0) * SR)]
place('main', R0, fade(seg(R0, PAST_A), 1.2, 0.03), 0.07)
place('main', PAST_A, fade(seg(PAST_A, PAST_B)[::-1], 0.03, 0.03), 0.08)
place('main', PAST_A, whoosh(PAST_B - PAST_A, 2600, 800, 0.3)[::-1], 0.12, -0.3)
fut = speed_change(seg(FUT_A, FUT_A + (FUT_B - FUT_A) * 1.6), 1.6)
place('main', FUT_A, fade(fut[: int((FUT_B - FUT_A) * SR)], 0.03, 0.03), 0.08)
place('main', FUT_A, whoosh(FUT_B - FUT_A, 800, 3200, 0.6), 0.1, 0.3)
place('main', FUT_A + 0.3, shimmer(FUT_B - FUT_A, 2600, 1.4, 14), 0.05, 0.3)
hang = seg(FUT_B, HANG_B)
hang = hang * np.interp(FUT_B + np.arange(len(hang)) / SR, [FUT_B, HANG_A], [1, 0.04])
place('main', FUT_B, hang, 0.08)
place('main', HANG_A, fade(np.sin(2 * np.pi * 5400 * tt(HANG_B - HANG_A)), 0.3, 0.05), 0.008)
place('main', HANG_B, fade(seg(HANG_B, R1), 0.02, 1.2), 0.07)
place('main', HANG_B, drop_plink(), 0.12, 0.4)
# 心跳在雨里轻轻地继续
for k in range(int((bt(44) - bt(38, 2)) / (BEAT * 2))):
	at = bt(38, 2) + k * BEAT * 2
	if HANG_A <= at < HANG_B:
		continue
	place('heart', at, HB_D, 0.2, -0.35)

# ═══════════════════ 6 时光咆哮（第 44–60 小节） ═══════════════════
ROAR_T = bt(52)
# 蓄力：一直往上爬的低鸣；光点被吸进口中
CH_D = ROAR_T - bt(44)
ct = tt(CH_D)
cu = ct / CH_D
charge = (np.sin(2 * np.pi * np.cumsum(41 + 30 * cu**2) / SR) * 0.8 + np.sin(2 * np.pi * np.cumsum(82 + 60 * cu**2) / SR) * 0.35 + norm(sweep_bp(noise(CH_D), 250, 2400, 0.6)) * 0.3) * (0.15 + 0.85 * cu**2.4)
place('main', bt(44), fade(charge, 0.8, 0.01), 0.22, -0.3)
for k in range(22):
	at = bt(44) + rng.uniform(0, CH_D - 0.6)
	w = whoosh(rng.uniform(0.25, 0.55), 1400, 4000, 0.4)[::-1]
	place('main', at, w, 0.04 * (0.4 + (at - bt(44)) / CH_D), rng.uniform(-0.8, 0.2))
for k in range(int(CH_D / (BEAT * 2))):
	at = bt(44) + k * BEAT * 2
	place('heart', at, HB_D, 0.22 + 0.36 * (k / (CH_D / (BEAT * 2))), -0.3)
# 第 47 小节：前面的图表飞回来，拼成星图
for k in range(4):
	place('main', bt(47) + k * BEAT * 0.25, whoosh(0.6, 2600, 700, 0.75), 0.1, (-0.6, 0.5, -0.3, 0.7)[k])
	place('main', bt(47) + k * BEAT * 0.25 + fr(20), clank(300 + 70 * k), 0.07, (-0.6, 0.5, -0.3, 0.7)[k])
# 第 48 小节：四个词一拍一个
for k in range(4):
	place('main', bt(48, k), clank(380 + 90 * k), 0.13, (-0.4, -0.2, 0.1, -0.6)[k])
	place('main', bt(48, k), glass_ping(2600 + 400 * k, 0.8), 0.1, (-0.4, -0.2, 0.1, -0.6)[k])
# 星图慢慢转：齿轮的棘轮
place('main', bt(49), ratchet(BAR, 5, 7, 0.9), 0.05, 0.2)
# 第 50–51 小节：上扬，星图开始颤
place('main', bt(50), riser(BAR * 2, 200, 4200), 0.18)
place('main', bt(50), ratchet(BAR * 2, 7, 40, 0.8), 0.07)
tr_d = BAR * 2
trt = tt(tr_d)
trem = lp(noise(tr_d), 140, 3) * (trt / tr_d) ** 2 * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * trt))
place('impact', bt(50), fade(trem, 0.3, 0.01), 0.35)
# 咆哮前一拍：吸一口气
place('main', bt(51, 3), whoosh(BEAT, 900, 5000, 0.97, 1.0), 0.2)
# 第 52 小节：时光咆哮（全片最大的冲击；叫声同时）
place('impact', ROAR_T, boom(3.6, 80, 26), 0.95)
beam_d = bt(53, 2) - ROAR_T
bt_ = tt(beam_d)
beam = norm(bp(noise(beam_d), 500, 4200)) * 0.7 + sum(np.sin(2 * np.pi * f * bt_ + f) * w for f, w in ((110, 0.4), (165, 0.25), (220, 0.2), (330, 0.12)))
beam = beam * (0.75 + 0.25 * np.sin(2 * np.pi * 7 * bt_)) * envelope(beam_d, 0.01, beam_d * 0.6)
bl = np.stack([beam * 0.75, beam * 1.0])
place_st('main', ROAR_T, np.stack([fade(bl[0], 0.003, 0.3), fade(bl[1], 0.003, 0.3)]), 0.26)
# 扭曲：低频的晃动
wob_d = BAR
wt = tt(wob_d)
wob = np.sin(2 * np.pi * np.cumsum(55 + 18 * np.sin(2 * np.pi * 3 * wt)) / SR) * envelope(wob_d, 0.05, 0.6)
place('impact', ROAR_T + 0.05, fade(wob, 0.02, 0.1), 0.3)
# 第 53 小节：破坏——碎成无数刻度和数字
BREAK_T = bt(53)
big = shatter(2.4, 2.2)
place('main', BREAK_T, big, 0.6)
place('impact', BREAK_T, boom(1.6, 90, 40), 0.35)
for k in range(10):
	place('main', BREAK_T + rng.uniform(0.05, BAR * 0.9), clank(rng.uniform(500, 1400)), 0.04, rng.uniform(-0.9, 0.9))
# 第 54 小节：再生——碎裂声倒放，末尾落在拼好的那一刻，然后一圈金蓝的和声
REGEN_DONE = bt(54, 1.5)
rv = big[::-1][-int(1.6 * SR) :]
place('main', REGEN_DONE - len(rv) / SR, rv, 0.5)
place('main', bt(54), whoosh(REGEN_DONE - bt(54) + 0.1, 600, 3800, 0.95, 0.9), 0.14)
# 和声余振一直响到第 58 小节，在那里像磁带停转一样戛然停住
ring_d = bt(58) - REGEN_DONE
ring = chord_ring(ring_d + 3, 146.8) * 0.7 + shimmer(ring_d + 3, 2400, 1.0, 20) * 0.3
ring_main = ring[: int(ring_d * SR)]
place('main', REGEN_DONE, fade(ring_main, 0.01, 0.001), 0.2)
place('main', bt(58), tape_stop(ring[int(ring_d * SR) :], 0.35), 0.2)
place('main', REGEN_DONE, glass_ping(2934, 2.0), 0.14)
# 余波里星图慢慢转：稀疏的棘轮
place('main', bt(55), ratchet(bt(58) - bt(55), 3, 3, 0.8), 0.035, 0.3)
for k in range(int((bt(58) - bt(54)) / (BEAT * 2))):
	place('heart', bt(54) + k * BEAT * 2, HB_D, 0.2, -0.3)
# 第 58 小节：下一回合自己将无法动弹——一切停住，只有晶体还在慢慢跳
FREEZE_A, FREEZE_B = bt(58), bt(60, 2)
for k in range(int((FREEZE_B - FREEZE_A) / (BEAT * 2)) + 1):
	at = FREEZE_A + k * BEAT * 2
	if at < FREEZE_B:
		place('heart', at, HB_D, 0.26, -0.3)
# 第 60 小节第 3 拍：时间重新流动
place('main', FREEZE_B, whoosh(BAR * 1.2, 300, 1800, 0.55), 0.16)

# ═══════════════════ 7 心跳（第 61–71 小节） ═══════════════════
place('main', bt(61) - 0.3, whoosh(BAR * 1.1, 600, 2200, 0.5, 0.9), 0.12)
place('main', bt(61, 3), glass_ping(2200, 1.6), 0.08)
# 两个心跳：帝牙卢卡每两拍一次（上，偏左）；观众一开始快一点（下，偏右），第 68 小节起完全对齐
ALIGN = bt(68)
dialga_beats = [bt(16) + k * BEAT * 2 for k in range(200)]
dialga_beats = [b for b in dialga_beats if bt(61) <= b < bt(72)]
human = [ALIGN + k * BEAT * 2 for k in range(20) if ALIGN + k * BEAT * 2 < bt(72)]
tb = ALIGN
j = 1
while tb > bt(59):
	tb -= BEAT * (2 - 0.3 * min(1, j / 6))
	human.insert(0, tb)
	j += 1
for b in dialga_beats:
	place('heart', b, HB_D, 0.5, -0.3)
for b in human:
	if b < bt(61, 2):
		continue
	place('heart', b, HB_H, 0.4 if b < ALIGN else 0.32, 0.3)
	# 第 64 小节起，每一下都留下一道刻痕
	if b >= bt(64):
		place('main', b + 0.02, tick(1.1, 0.6), 0.07, 0.3)
# 第 66 小节：三个光点落下（心灵诞生）
for i, (f, pn) in enumerate(((1318.5, -0.5), (1661.2, 0.0), (1975.5, 0.5))):
	t0 = bt(65, 2) + fr(i * 4)
	fall = bt(66) - t0
	ft = tt(fall)
	whistle = np.sin(2 * np.pi * np.cumsum(f * 2 * (1 - 0.5 * ft / fall)) / SR) * (ft / fall) ** 2 * 0.3
	place('main', t0, fade(whistle, 0.05, 0.01), 0.05, pn)
	place('main', bt(66), glass_ping(f, 2.4), 0.15, pn)
warm = sum(np.sin(2 * np.pi * f * tt(BAR * 3) + i) for i, f in enumerate((164.8, 207.7, 246.9, 329.6))) * envelope(BAR * 3, BAR * 0.8, BAR * 1.6)
place('main', bt(66), fade(warm, 0.5, 1.0), 0.04)
# 对齐之后，每一下两颗心同时跳，中间亮起一道光
for b in dialga_beats:
	if b >= ALIGN:
		place('main', b + 0.01, glass_ping(2637, 1.2), 0.05)

# ═══════════════════ 混音 ═══════════════════
t_all = np.arange(N) / SR

# 叫声处闪避：main 压低 8 dB
CRIES = [(REVEAL, 1.56), (ORIGIN_T, 1.61), (ROAR_T, 1.61)]
duck = np.ones(N)
for at, ln in CRIES:
	a0, a1, b0, b1 = at - 0.08, at, at + ln, at + ln + 0.35
	g = 10 ** (-8 / 20)
	seg_ = (t_all >= a0) & (t_all < b1)
	x = t_all[seg_]
	k = np.where(x < a1, 1 - (1 - g) * (x - a0) / (a1 - a0), np.where(x < b0, g, g + (1 - g) * (x - b0) / (b1 - b0)))
	duck[seg_] = np.minimum(duck[seg_], k)

# 时间停住的两段：main 与 impact 静音（耳鸣般的高音是在静段之后放进 main 的，单独补回）
gate = np.ones(N)
for a, b in ((bt(6) + 0.05, bt(8)), (bt(58) + 0.36, bt(60, 2))):
	gate[(t_all >= a) & (t_all < b)] = 0
	r = int(0.04 * SR)
	i0, i1 = int(a * SR), int(b * SR)
	gate[i0 : i0 + r] = np.minimum(gate[i0 : i0 + r], np.linspace(1, 0, r))
	gate[i1 - r : i1] = np.linspace(0, 1, r)

main = BUS['main'] * duck
impact = BUS['impact']
heart = BUS['heart']

# 一点星空般的混响：指数衰减的噪声脉冲响应
ir_len = 2.4
irt = tt(ir_len)
ir = np.stack([lp(noise(ir_len), 6000) * np.exp(-irt / 0.7), lp(noise(ir_len), 6000) * np.exp(-irt / 0.72)])
ir /= np.sqrt(np.sum(ir**2, axis=1, keepdims=True))
wet = np.stack([fftconvolve(main[c] + heart[c] * 0.6, ir[c])[:N] for c in range(2)]) * 0.22

# 静段里补回的那一点高音（不受门限）
ears = np.zeros((2, N))
for a, b, f, g in ((bt(6), bt(8), 6200, 0.012), (bt(58), bt(60, 2), 4800, 0.007)):
	i0 = int(a * SR)
	d = b - a
	s = fade(np.sin(2 * np.pi * f * tt(d)) * envelope(d, 0.8, 9.0), 0.5, 0.05) * g
	ears[:, i0 : i0 + len(s)] += s

mix = (main + impact) * gate + wet * gate + heart + ears

# 结尾第 71 小节起淡出，第 72 小节强拍归零
end_i = int(bt(72) * SR)
f0_i = int(bt(71) * SR)
mix[:, f0_i:end_i] *= np.linspace(1, 0, end_i - f0_i) ** 1.6
mix[:, end_i:] = 0
mix = mix[:, : int(round(TOTAL * SR))]

# 柔和的高频收边 + 软限幅，峰值 −4 dBFS
mix = np.stack([lp(c, 13000) for c in mix])
peak = np.max(np.abs(mix))
mix = np.tanh(mix / peak * 1.25) / np.tanh(1.25) * 10 ** (-4 / 20)


def write(path: Path, x: np.ndarray):
	path.parent.mkdir(parents=True, exist_ok=True)
	pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').T.copy()
	with wave.open(str(path), 'wb') as w:
		w.setnchannels(2)
		w.setsampwidth(2)
		w.setframerate(SR)
		w.writeframes(pcm.tobytes())


OUT = Path('out/时间的心跳')
write(OUT / 'time-sfx.wav', mix)
# 与三个视频文件一一对应（段落起点同 common.ts 的 SEG_START：第 22、44 小节强拍取整帧）
cut1 = round(bt(22) * 30) / 30
cut2 = round(bt(44) * 30) / 30
for name, a, b in (('time-part1-sfx.wav', 0, cut1), ('time-part2-sfx.wav', cut1, cut2), ('time-part3-sfx.wav', cut2, TOTAL)):
	write(OUT / 'sfx' / name, mix[:, int(round(a * SR)) : int(round(b * SR))])
print('done', TOTAL, 's', 'peak', np.max(np.abs(mix)))
