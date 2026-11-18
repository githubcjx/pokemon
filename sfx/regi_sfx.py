"""
《敬畏》（代码短名 regi）音效轨（不是配乐：没有旋律，只有环境声与动作音效）。
全部用 numpy 程序合成，不使用外部素材。叫声在视频里，这里不含。

时间轴：整期一条总时间轴（30fps 帧号，src/scenes/regi/common.ts 的 T），0 秒 = 第 1 段第一帧。
关键帧直接从 common.ts 读出来，场景代码里派生的时刻（雷击、圆环、开门……）照抄过来。

整体柔和、克制（CLAUDE.md 的音效要求）：
  海底、洞里是低频的水声和空气声；雪原是低频为主的风；火把是低沉的燃烧声；
  雷只用远处闷雷；撞击、地震只留低沉轰鸣；石门开合是低沉的摩擦声；
  光点、点字、金光用低中频的柔和嗡鸣（glow），不用高频闪烁；
  不用尖锐高频、碎裂声、雨幕沙沙、人群嘈杂；爆发点（王醒来）比底噪响但不刺耳。
所有音源最后再过一道 6 kHz 的柔和低通。叫声响起时音效压低 8 dB，雷吉奇卡斯第二次叫声只压 3 dB。

输出（都在 out/敬畏/ 下）：
  regi-sfx.wav                        整期音效（48kHz 立体声 16 位，峰值 -3 dBFS）
  sfx/regi-part1/2/3-sfx.wav          上篇（第 1–3 段）、中篇（第 4–6 段）、下篇（第 7–9 段）
  sfx/regi-s1-chamber-sfx.wav …       按段切开，文件名与视频对应

用法：python sfx/regi_sfx.py
"""
import re
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
FPS = 30

# ─── 从 common.ts 读关键帧 ──────────────────────────────────────────
_src = (ROOT / 'src/scenes/regi/common.ts').read_text(encoding='utf-8')
_blk = _src[_src.index('export const T = {') : _src.index('};', _src.index('export const T = {'))]
K = {m.group(1): int(m.group(2)) for m in re.finditer(r'^\t(\w+): (\d+),', _blk, re.M)}


from types import SimpleNamespace

T = SimpleNamespace(**K)  # T.pass 是关键字，写作 getattr(T, 'pass')

SEGMENTS = [
	('s1-chamber', T.sea, T.end1),
	('s2-legend-rock', T.legend, T.end3),
	('s3-giants', T.giants, T.endA),
	('s4-fear', T.tundra, T.endB),
	('s5-trial', T.tablet, T.endC),
	('s6-doors', T.unova, T.endD),
	('s7-temple', T.keyCard, T.endE),
	('s8-awe', T.awe, T.endF),
	('s9-king', T.door9, T.endG),
]
PARTS = [('part1', 0, 2), ('part2', 3, 5), ('part3', 6, 8)]
TOTAL_FRAMES = T.endG
TOTAL = TOTAL_FRAMES / FPS

# 场景代码里派生的时刻（与 FearSeg / KeySeg / KingSeg 一致）
STRIKE = [T.disaster + 14 + ((i * 5) % 8) * 9 for i in range(8)]
RINGS_AT = [T.rings + 18, T.rings + 42, T.rings + 66]
HOENN_CLOSE = [T.ruins + 62 + i * 26 for i in range(3)]
SOLVE_OPEN = [T.solve + 44, T.solve + 120, T.solve + 180]
MARK_AT = [T.statues + 104, T.statues + 124, T.statues + 144]

N = int(TOTAL * SR)
L = np.zeros(N, dtype=np.float64)
R = np.zeros(N, dtype=np.float64)
rng = np.random.default_rng(20261023)


def S(f: float) -> float:
	"""帧号 → 秒"""
	return f / FPS


# ─── 基础工具（同 necrozma_sfx.py）────────────────────────────────────
def noise(n: int) -> np.ndarray:
	return rng.standard_normal(n)


def spectral(x: np.ndarray, mag) -> np.ndarray:
	X = np.fft.rfft(x)
	f = np.fft.rfftfreq(len(x), 1 / SR)
	return np.fft.irfft(X * mag(f), n=len(x))


def band(x: np.ndarray, lo: float, hi: float, soft: float = 0.35) -> np.ndarray:
	def mag(f):
		lf = np.log2(np.maximum(f, 1.0))
		a = 1 / (1 + np.exp(-(lf - np.log2(max(lo, 1))) / soft)) if lo > 0 else 1.0
		b = 1 / (1 + np.exp((lf - np.log2(hi)) / soft))
		return a * b

	return spectral(x, mag)


def brown(n: int) -> np.ndarray:
	return spectral(noise(n), lambda f: 1 / np.maximum(f, 20.0))


def norm(x: np.ndarray) -> np.ndarray:
	p = np.max(np.abs(x))
	return x / p if p > 0 else x


def env(t: np.ndarray, pts) -> np.ndarray:
	"""pts 的时间是帧号"""
	xs, ys = zip(*pts)
	return np.interp(t, [S(x) for x in xs], ys)


def wobble(n: int, rate: float = 0.3, depth: float = 0.4) -> np.ndarray:
	t = np.arange(n) / SR
	w = sum(np.sin(2 * np.pi * rate * k * t + rng.uniform(0, 6.28)) / k for k in (1, 1.7, 2.9))
	return 1 + depth * w / 1.9


def add(start: float, sig: np.ndarray, gain: float = 1.0, pan=0.0) -> None:
	"""在整期时间 start 秒处叠加单声道信号；pan 为 -1（左）…1（右），可为等长数组"""
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


def decay(n: int, tau: float, attack: float = 0.01) -> np.ndarray:
	t = np.arange(n) / SR
	return np.minimum(t / attack, 1.0) * np.exp(-t / tau)


def span(a: float, b: float):
	"""帧号 a–b → 起点秒、采样数、每个采样的秒数"""
	start = S(a)
	n = int(S(b - a) * SR)
	return start, n, start + np.arange(n) / SR


def P(x: float) -> float:
	"""画面横坐标（像素，1920 宽）→ 声像"""
	return float(np.clip((x / 1920 - 0.5) * 1.6, -1, 1))


# ─── 柔和的音效（时间参数都是帧号）──────────────────────────────────────
def air(a, b, pts, gain=0.1, pan=0.0):
	"""空气声：极轻的低频底噪"""
	s, n, t = span(a, b)
	add(s, norm(band(brown(n), 30, 500)) * wobble(n, 0.12, 0.3) * env(t, pts), gain, pan)


def deep(a, b, pts, gain=0.12):
	"""海底：闷住的低频水压声 + 缓慢的涌动（左右各一条）"""
	s, n, t = span(a, b)
	e = env(t, pts)
	for side in (-0.4, 0.4):
		sig = norm(band(brown(n), 20, 260)) * np.clip(wobble(n, 0.08, 0.6), 0.2, None)
		add(s, sig * e, gain * 0.7, side)


def water(a, b, pts, gain=0.08, pan=0.0):
	"""石室里的水潭：低频的轻拍水声（缓慢起伏，没有水滴的高频）"""
	s, n, t = span(a, b)
	lap = norm(band(noise(n), 70, 650)) * np.clip(wobble(n, 0.45, 0.8), 0.1, None)
	add(s, lap * env(t, pts), gain, pan)


def wind(a, b, pts, gain=0.2, lo=110, hi=1000, pan=0.0, rate=0.2):
	"""风：低频为主，缓慢起伏，左右各一条"""
	s, n, t = span(a, b)
	e = env(t, pts)
	for side in (-0.5, 0.5):
		sig = norm(band(noise(n), lo, hi)) * np.clip(wobble(n, rate, 0.6), 0.15, None) * e
		add(s, sig, gain * 0.7, float(np.clip(pan + side, -1, 1)))


def fire(a, b, pts, gain=0.3, pan=0.0):
	"""火把 / 熔岩：低沉的燃烧声（没有噼啪）"""
	s, n, t = span(a, b)
	roar = norm(band(brown(n), 35, 420)) * wobble(n, 0.5, 0.45)
	body = norm(band(noise(n), 200, 1200)) * np.clip(wobble(n, 1.6, 0.7), 0.2, None) * 0.22
	add(s, (roar + body) * env(t, pts), gain, pan)


def thunder(at, pan=0.0, size=1.0):
	"""远处的闷雷"""
	n = int((3.5 + 1.5 * size) * SR)
	t = np.arange(n) / SR
	roll = band(noise(n), 25, 240)
	am = np.clip(wobble(n, 1.6, 0.7), 0.15, None)
	sig = norm(roll * am) * np.minimum(t / 0.18, 1) * np.exp(-t / (1.3 + 0.7 * size))
	add(S(at), sig, 0.3 * size, pan)


def boom(at, size=1.0, pan=0.0):
	"""低沉的轰鸣：低频扫频 + 低频拖尾，起音略缓"""
	dur = 2.5 + 2.5 * size
	n = int(dur * SR)
	t = np.arange(n) / SR
	f = 62 * np.exp(-t * 1.5) + 30
	tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(n, 0.7 + 0.8 * size, 0.012)
	body = band(noise(n), 30, 260) * decay(n, 0.35 + 0.3 * size, 0.02)
	tail = band(brown(n), 20, 180) * np.minimum(t / 0.1, 1) * np.exp(-t / (1.0 + 1.4 * size))
	sig = norm(tone) + norm(body) * 0.55 + norm(tail) * 0.55 * size
	add(S(at), sig, 0.6 * size ** 0.9, pan)


def thud(at, size=0.3, pan=0.0):
	"""轻的低沉一声（石头落定、圆环扣上、巨人站定）"""
	n = int(1.4 * SR)
	t = np.arange(n) / SR
	tone = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-t * 4) + 42) / SR) * decay(n, 0.25, 0.006)
	body = band(noise(n), 40, 300) * decay(n, 0.12, 0.004)
	add(S(at), norm(tone) + norm(body) * 0.4, 0.5 * size, pan)


def rumble(a, b, pts, gain=0.25, pan=0.0):
	"""地鸣：持续的低频震动（地震、大陆被拖动、石像要醒来）"""
	s, n, t = span(a, b)
	sig = norm(band(brown(n), 18, 160)) * np.clip(wobble(n, 2.2, 0.5), 0.3, None)
	add(s, sig * env(t, pts), gain, pan)


def grind(a, b, gain=0.18, pan=0.0):
	"""石门滑动：低沉的摩擦声，带细小的颤动，首尾淡入淡出"""
	s, n, t = span(a, b)
	tt = np.arange(n) / SR
	jitter = 1 + 0.35 * np.sin(2 * np.pi * 11 * tt + np.sin(2 * np.pi * 3.1 * tt) * 2)
	sig = norm(band(noise(n), 45, 380)) * jitter + 0.6 * norm(band(brown(n), 25, 120))
	k = np.minimum(np.minimum(tt / 0.25, (tt[-1] - tt) / 0.35), 1) if n > 1 else np.ones(n)
	add(s, norm(sig) * np.clip(k, 0, 1), gain, pan)


def whoosh(at, dur, f0, f1, gain=0.3, pan0=0.0, pan1=0.0, peak=0.6):
	"""柔和的呼啸：中心频率从 f0 移到 f1（压在 2.5 kHz 以内），钟形包络；dur 为秒"""
	n = int(dur * SR)
	t = np.arange(n) / SR / dur
	src = noise(n)
	fc = np.minimum(f0 * (f1 / f0) ** t, 2500)
	out = np.zeros(n)
	blk = int(0.05 * SR)
	win = np.hanning(blk * 2)
	for i in range(0, n, blk):
		a = max(0, i - blk // 2)
		b = min(n, a + blk * 2)
		c = fc[min(i, n - 1)]
		out[a:b] += band(src[a:b], c * 0.55, c * 1.6) * win[: b - a]
	shape = np.where(t < peak, np.sin(np.pi / 2 * t / peak) ** 2, np.cos(np.pi / 2 * (t - peak) / (1 - peak)) ** 2)
	add(S(at), norm(out) * shape, gain, pan0 + (pan1 - pan0) * t)


def swell(at, dur, gain=0.3, lo=40, hi=700, pan=0.0, peak=0.8):
	"""低频的涌起：慢慢变响，到 peak 处最响后回落；dur 为秒"""
	n = int(dur * SR)
	t = np.arange(n) / SR / dur
	sig = norm(band(brown(n), lo, hi)) * wobble(n, 0.8, 0.2)
	shape = np.where(t < peak, (t / peak) ** 2, np.cos(np.pi / 2 * (t - peak) / (1 - peak)) ** 2)
	add(S(at), sig * shape, gain, pan)


def swell_to(a, b, gain=0.3, lo=40, hi=700, pan=0.0, after=0.4):
	"""从帧 a 涌起，到 b 最响，之后 after 秒回落"""
	dur = S(b - a) + after
	swell(a, dur, gain, lo, hi, pan, peak=S(b - a) / dur)


def drone(a, b, pts, gain=0.15, f=48.0, pan=0.0):
	"""低沉的持续音（单一低音、缓慢拍频，不成旋律）"""
	s, n, t = span(a, b)
	tt = np.arange(n) / SR
	tone = np.sin(2 * np.pi * f * tt) + 0.7 * np.sin(2 * np.pi * f * 1.006 * tt + 1.0) + 0.25 * np.sin(2 * np.pi * f * 2.003 * tt)
	hm = norm(band(noise(n), f * 1.5, f * 6)) * 0.3
	add(s, (norm(tone) + hm) * wobble(n, 0.15, 0.25) * env(t, pts), gain, pan)


def glow(a, b, pts, gain=0.06, f=110.0, pan=0.0):
	"""光点 / 点字 / 金光的嗡鸣：低中频的柔和泛音簇 + 一点气声（不尖、不闪）"""
	s, n, t = span(a, b)
	tt = np.arange(n) / SR
	tone = sum(w * np.sin(2 * np.pi * f * k * tt + k) for k, w in ((1, 1.0), (1.503, 0.5), (2.004, 0.35), (2.997, 0.15)))
	tone = tone * (0.85 + 0.15 * np.sin(2 * np.pi * 0.37 * tt))
	breath = norm(band(noise(n), f * 2, f * 9)) * 0.25
	add(s, (norm(tone) + breath) * wobble(n, 0.1, 0.2) * env(t, pts), gain, pan)


def ping(at, gain=0.05, f=98.0, pan=0.0):
	"""一个光点亮起：很短的低中频泛音（像手指碰到石头时的微光，不是铃声）"""
	n = int(1.6 * SR)
	tt = np.arange(n) / SR
	tone = sum(w * np.sin(2 * np.pi * f * k * tt + k) for k, w in ((1, 1.0), (2.004, 0.4), (2.997, 0.15)))
	add(S(at), norm(tone) * decay(n, 0.45, 0.04), gain, pan)


def hum(a, b, pts, gain=0.1, f=60.0, pan=0.0, flick=0.0):
	"""电的嗡鸣（雷吉艾勒奇、城市）：低频锯齿过低通；flick > 0 时带不规则的闪断"""
	s, n, t = span(a, b)
	tt = np.arange(n) / SR
	saw = sum(np.sin(2 * np.pi * f * k * tt) / k for k in range(1, 8))
	sig = norm(band(saw, 40, 600))
	if flick > 0:
		gate = (np.sin(2 * np.pi * 3.7 * tt) + 0.6 * np.sin(2 * np.pi * 6.1 * tt + 1)) > 0.2
		g = np.convolve(gate.astype(float), np.ones(int(0.02 * SR)) / int(0.02 * SR), 'same')
		sig = sig * (1 - flick + flick * g)
	add(s, sig * env(t, pts), gain, pan)


def soft_lowpass(x: np.ndarray, hi: float = 6000) -> np.ndarray:
	return band(x, 0, hi, 0.4)


# ════════════════════════════════════════════════════════════════════════
# 第 1 段 海底的石室：下潜 → 钻进岩缝 → 石室读点字 → 退回海里 → 点阵片名
# ════════════════════════════════════════════════════════════════════════
deep(T.sea, T.splashIn + 10, [(T.sea, 0.0), (20, 0.8), (T.dive, 1.0), (T.splashIn, 0.7), (T.splashIn + 10, 0.0)], 0.16)
swell_to(90, T.dive, 0.08, 30, 300, 0.0, 0.8)  # 越潜越深
glow(T.dive - 30, T.splashIn, [(T.dive - 30, 0.0), (T.dive, 0.4), (T.splashIn, 0.8)], 0.04, 82)  # 岩缝的青光
swell_to(T.splashIn - 18, T.splashIn, 0.14, 50, 600, 0.0, 0.7)  # 钻进岩缝、从水里浮出
# 石室：水潭的轻拍 + 洞里的空气
water(T.splashIn, T.splashOut, [(T.splashIn, 0.0), (T.splashIn + 30, 0.8), (T.splashOut - 20, 0.8), (T.splashOut, 0.3)], 0.07)
air(T.splashIn, T.splashOut, [(T.splashIn, 0.0), (T.wall, 0.7), (T.splashOut, 0.6)], 0.08)
whoosh(258, 3.0, 180, 420, 0.05, -0.7, 0.7, peak=0.5)  # 读字光扫过整面墙
for at, pan in ((T.read1, -0.4), (T.read2, 0.4), (T.read3, -0.4), (T.read4, 0.4)):  # 每块石板读起来时的微光
	glow(at, at + 70, [(at, 0.0), (at + 10, 1.0), (at + 60, 0.6), (at + 70, 0.0)], 0.04, 98, pan)
glow(T.both, T.leave, [(T.both, 0.0), (T.both + 20, 0.8), (T.leave - 20, 0.8), (T.leave, 0.0)], 0.05, 87)  # 两句话一起亮着
swell_to(T.splashOut - 16, T.splashOut, 0.12, 50, 600, 0.0, 0.8)  # 退回水里
deep(T.splashOut, T.end2 + 40, [(T.splashOut, 0.0), (T.splashOut + 20, 0.8), (T.title, 0.6), (T.end1, 0.5), (T.end2, 0.6), (T.end2 + 40, 0.0)], 0.14)
swell(T.splashOut + 10, 3.5, 0.08, 30, 260, peak=0.5)  # 一路升向海面
glow(T.title, T.end1 + 20, [(T.title, 0.0), (T.title + 60, 0.7), (T.title + 120, 1.0), (T.end1, 0.7), (T.end1 + 20, 0.0)], 0.05, 73)  # 海雪聚成片名
swell_to(T.title + 80, T.title + 118, 0.16, 40, 500, 0.0, 1.4)  # 片名

# ════════════════════════════════════════════════════════════════════════
# 第 2 段 传说与岩石巨人
# ════════════════════════════════════════════════════════════════════════
glow(T.legend, T.book, [(T.legend, 0.5), (T.legend + 60, 0.8), (T.book, 0.4)], 0.04, 65)  # 点阵大陆
drone(T.giant - 10, T.book + 40, [(T.giant - 10, 0.0), (T.giant + 40, 0.8), (T.book, 0.6), (T.book + 40, 0.0)], 0.08, 41)  # 巨人的剪影
rumble(T.drag, T.drag + 150, [(T.drag, 0.0), (T.drag + 20, 1.0), (T.drag + 120, 1.0), (T.drag + 150, 0.0)], 0.2)  # 绳索拖动大陆
for k in range(6):
	thud(T.drag + k * 13 + 72, 0.25, float(np.cos(k * 1.9)) * 0.6)  # 一块块大陆到位
whoosh(T.book - 6, 2.0, 600, 250, 0.08, 0.0, 0.0, peak=0.4)  # 光点收成一本图鉴
swell_to(T.truth - 10, T.truth + 4, 0.08, 60, 600, 0.0, 1.0)
glow(T.truth, T.fall + 30, [(T.truth, 0.0), (T.truth + 10, 1.0), (T.fall, 1.0), (T.fall + 30, 0.0)], 0.04, 110)  # 只剩"一丝真理"
whoosh(T.fall, 2.8, 500, 160, 0.09, 0.0, 0.0, peak=0.3)  # 坠向海底
swell_to(T.strata - 30, T.strata + 10, 0.12, 30, 300, 0.0, 0.8)  # 没入岩缝、进入地层
air(T.strata, T.end3, [(T.strata, 0.0), (T.strata + 30, 0.7), (T.end3, 0.6)], 0.08)
drone(T.strata, T.regirock + 20, [(T.strata, 0.0), (T.strata + 40, 0.6), (T.regirock, 0.8), (T.regirock + 20, 0.0)], 0.06, 44)
for i in range(18):  # 碎石飞来拼成雷吉洛克（一连串很轻的落定声）
	thud(2070 + i * 3 + (i * 7) % 5, 0.12, float(np.sin(i * 2.3)) * 0.6)
swell_to(2100, T.regirock, 0.18, 30, 400, 0.0, 0.6)
hum(T.scan + 10, T.scan + 120, [(T.scan + 10, 0.0), (T.scan + 20, 0.7), (T.scan + 104, 0.7), (T.scan + 120, 0.0)], 0.04, 55)  # 扫描
for at in (T.lands + 60, T.columns + 20):
	swell(at, 2.0, 0.06, 40, 400, peak=0.3)
rumble(T.fit, T.fit + 90, [(T.fit, 0.0), (T.fit + 50, 0.8), (T.fit + 90, 0.0)], 0.12)  # 两岸拼合
thud(T.fit + 70, 0.4)
rumble(T.drift, T.drift + 110, [(T.drift, 0.0), (T.drift + 30, 0.6), (T.drift + 110, 0.0)], 0.1)  # 又慢慢漂开
whoosh(T.home - 4, 3.0, 300, 700, 0.07, -0.5, 0.2, peak=0.6)  # 光点流进雷吉洛克
glow(T.home, T.end3 + 20, [(T.home, 0.0), (T.home + 60, 0.8), (T.end3, 0.6), (T.end3 + 20, 0.0)], 0.04, 82)

# ════════════════════════════════════════════════════════════════════════
# 第 3 段 冰河、地底与造物主
# ════════════════════════════════════════════════════════════════════════
air(T.giants, T.coast, [(T.giants, 0.6), (T.coast, 0.6)], 0.08)
wind(T.giants, T.coast + 10, [(T.giants, 0.0), (3150, 0.6), (T.magma, 0.6), (T.coast + 10, 0.0)], 0.1, 120, 800, 0.0, 0.1)  # 海水冻成冰川
swell_to(T.giants + 10, 3150, 0.08, 30, 300, 0.0, 0.8)
fire(T.magma - 4, T.coast, [(T.magma - 4, 0.0), (T.magma + 20, 0.8), (T.coast - 20, 0.8), (T.coast, 0.0)], 0.14)  # 熔岩从下面烤上来
# 海岸剖面：海面降下 120 米、再涨回来
water(T.coast, T.deep, [(T.coast, 0.0), (T.coast + 20, 0.7), (T.seaDrop, 0.7), (T.seaDrop + 100, 0.3), (T.melt, 0.3), (T.melt + 110, 0.8), (T.deep, 0.0)], 0.07)
swell(T.seaDrop + 10, 3.4, 0.08, 25, 200, peak=0.7)
swell(T.melt + 10, 4.0, 0.1, 30, 300, peak=0.75)
glow(T.cave, T.deep, [(T.cave, 0.0), (T.cave + 70, 0.6), (T.deep, 0.0)], 0.03, 92)  # 洞口的青光
# 往下穿过地壳到地幔
whoosh(T.deep - 10, 4.5, 400, 120, 0.1, 0.0, 0.0, peak=0.5)
rumble(T.deep, T.tri, [(T.deep, 0.0), (T.deep + 60, 0.6), (T.registeel, 0.8), (T.metal, 0.5), (T.tri, 0.0)], 0.12)
fire(T.deep + 60, T.tri + 30, [(T.deep + 60, 0.0), (T.registeel - 40, 0.6), (T.metal, 0.4), (T.tri + 30, 0.0)], 0.1)
swell_to(T.registeel - 60, T.registeel, 0.16, 30, 400, 0.0, 0.6)  # 雷吉斯奇鲁从红光里浮上来
for k in range(4):  # 压力：箭头一拍一拍往里压
	thud(T.pressure + 6 + k * 26, 0.22)
glow(T.metal, T.metal + 80, [(T.metal, 0.0), (T.metal + 30, 0.9), (T.metal + 80, 0.0)], 0.04, 123)  # 金属光泽扫过
swell_to(T.tri - 10, T.tri + 40, 0.08, 40, 500, 0.0, 0.8)  # 三联画推开
# 七个点 → 雷吉奇卡斯
for g in range(3):
	for i in range(7):
		ping(T.dots + g * 12 + i * 3, 0.018, 98 + g * 10, (g - 1) * 0.6)
whoosh(T.cluster, 1.6, 300, 600, 0.05, 0.0, 0.0, peak=0.6)  # 点飘到头顶排成三组
drone(T.holes - 10, T.endA + 60, [(T.holes - 10, 0.0), (T.holes + 70, 0.8), (T.regigigas, 1.0), (T.why, 0.7), (T.endA, 0.6), (T.endA + 60, 0.0)], 0.09, 37)
swell_to(T.holes, T.holes + 70, 0.14, 25, 220, 0.0, 0.8)  # 巨大的身影升起
for i in range(7):  # 七个圆孔一个接一个点亮
	ping(T.holes + 66 + i * 7, 0.03, 82, 0.0)
swell_to(T.regigigas - 20, T.regigigas + 6, 0.2, 30, 500, 0.0, 0.8)  # 显色（叫声在视频里）
glow(T.made + 30, T.drag2 + 20, [(T.made + 30, 0.0), (T.made + 60, 0.8), (T.drag2, 0.8), (T.drag2 + 20, 0.0)], 0.04, 110)  # 金线连到三个巨人
rumble(T.drag2 + 30, T.king + 20, [(T.drag2 + 30, 0.0), (T.drag2 + 70, 0.7), (T.king, 0.7), (T.king + 20, 0.0)], 0.12)  # 绳索与大陆
swell(T.why, 3.6, 0.06, 25, 160, peak=0.2)  # 暗回剪影

# ════════════════════════════════════════════════════════════════════════
# 第 4 段 古人怕的是什么：王冠雪原 → 石门 → 回到石室
# ════════════════════════════════════════════════════════════════════════
wind(T.tundra, T.seal + 34, [(T.tundra, 0.0), (T.tundra + 76, 0.9), (T.seal - 6, 0.9), (T.seal + 34, 0.0)], 0.22, 110, 1000, 0.0, 0.18)
swell(T.tundra + 24, 2.6, 0.1, 40, 400, peak=0.35)  # 篇章卡
for at, x in ((T.notThree + 2, 300), (T.notThree + 10, 565), (T.notThree + 18, 830), (T.notThree + 38, 1210), (T.notThree + 46, 1580)):
	swell(at, 1.8, 0.05, 30, 260, P(x), peak=0.4)  # 山脊上的剪影一个个出现
# 雷吉艾勒奇
swell_to(T.eleki - 30, T.eleki, 0.16, 40, 600, P(1250), 0.5)
thunder(T.eleki - 4, P(1250), 0.5)
hum(T.eleki - 10, T.dragoLine + 40, [(T.eleki - 10, 0.0), (T.eleki + 10, 0.8), (T.power + 20, 1.0), (T.disaster, 1.2), (RINGS_AT[0], 1.0), (RINGS_AT[2] + 10, 0.3), (T.dragoLine + 40, 0.0)], 0.06, 55, P(1250), flick=0.5)
whoosh(T.power + 6, 2.0, 300, 900, 0.07, P(1250), P(960), peak=0.6)  # 电流流向平原
glow(T.power + 20, T.disaster + 60, [(T.power + 20, 0.0), (T.power + 80, 0.7), (T.disaster, 0.7), (T.disaster + 60, 0.0)], 0.04, 87, -0.4)  # 城镇的灯
for i, at in enumerate(STRIKE):  # 雷击（只用远处闷雷）
	thunder(at, P([150, 330, 470, 640, 760, 560, 880, 250][i]), 0.55)
for at, pan in zip(RINGS_AT, (P(1100), P(1350), P(1240))):  # 圆环一个个扣上
	whoosh(at - 26, 0.9, 900, 300, 0.05, pan * 1.5, pan, peak=0.85)
	thud(at, 0.4, pan)
	ping(at + 2, 0.04, 87, pan)
# 雷吉铎拉戈：结晶飞来拼成
for i in range(10):
	whoosh(T.dragoLine + 10 + i * 4, 1.4, 250, 600, 0.03, float(np.sin(i * 2.1)) * 0.8, 0.0, peak=0.7)
swell_to(T.dragoLine + 30, T.drago, 0.18, 30, 500, 0.0, 0.6)
glow(T.crystal + 40, T.seal, [(T.crystal + 40, 0.0), (T.crystal + 100, 0.5), (T.doom, 0.4), (T.seal, 0.0)], 0.03, 73, -0.3)  # 虚线的龙身
drone(T.doom + 10, T.seal + 20, [(T.doom + 10, 0.0), (T.doom + 60, 0.9), (T.seal, 0.8), (T.seal + 20, 0.0)], 0.08, 39)  # 毁灭的想象
rumble(T.doom + 40, T.doom + 150, [(T.doom + 40, 0.0), (T.doom + 60, 0.9), (T.doom + 110, 0.9), (T.doom + 150, 0.0)], 0.16)
# 封进神殿：石门合拢
air(T.seal, T.back + 10, [(T.seal, 0.0), (T.seal + 30, 0.6), (T.back, 0.6), (T.back + 10, 0.0)], 0.08)
grind(T.seal + 22, T.seal + 74, 0.2)
boom(T.seal + 74, 0.45)
drone(T.might, T.ruins, [(T.might, 0.0), (T.might + 30, 0.6), (T.ruins, 0.0)], 0.05, 44)  # 门缝漏出的光（可能会做的事）
hum(T.might, T.ruins, [(T.might, 0.0), (T.might + 30, 0.5), (T.ruins, 0.0)], 0.03, 60, P(690), flick=0.6)
for i, at in enumerate(HOENN_CLOSE):  # 丰缘的三道门一扇扇关上
	grind(at, at + 26, 0.12, [-0.7, -0.35, 0.0][i])
	thud(at + 26, 0.35, [-0.7, -0.35, 0.0][i])
glow(T.path, T.back + 30, [(T.path, 0.0), (T.path + 40, 0.8), (T.back, 1.1), (T.back + 30, 0.0)], 0.05, 98)  # 门缝的金光、七个点
swell_to(T.path + 40, T.back + 4, 0.16, 50, 700, 0.0, 0.8)  # 推进门缝
water(T.back - 10, T.endB, [(T.back - 10, 0.0), (T.back + 30, 0.7), (T.endB, 0.7)], 0.07)  # 回到石室
air(T.back - 10, T.endB, [(T.back - 10, 0.0), (T.back + 30, 0.6), (T.endB, 0.6)], 0.08)

# ════════════════════════════════════════════════════════════════════════
# 第 5 段 解封仪式与三道题
# ════════════════════════════════════════════════════════════════════════
water(T.tablet, T.quake + 80, [(T.tablet, 0.7), (T.quake + 40, 0.7), (T.quake + 80, 0.0)], 0.07)
air(T.tablet, T.quake + 80, [(T.tablet, 0.6), (T.quake + 80, 0.0)], 0.08)
glow(T.tablet + 40, T.relicanth, [(T.tablet + 40, 0.0), (T.tablet + 60, 0.8), (T.tablet + 124, 0.8), (T.relicanth, 0.3)], 0.04, 92)  # 读大石板
whoosh(T.relicanth - 36, 1.8, 200, 450, 0.05, P(900), P(570), peak=0.6)  # 古空棘鱼游进来
whoosh(T.wailord - 40, 2.4, 120, 300, 0.07, 1.0, P(1440), peak=0.6)  # 吼鲸王游进来
swell_to(T.bring + 20, T.quake, 0.14, 25, 220, 0.0, 0.2)
boom(T.quake, 0.7)  # 地震
rumble(T.quake, T.quake + 90, [(T.quake, 0.0), (T.quake + 6, 1.0), (T.quake + 50, 0.6), (T.quake + 90, 0.0)], 0.15)
# 三道门同时打开
air(T.quake + 46, T.riddle + 144, [(T.quake + 46, 0.0), (T.quake + 80, 0.6), (T.riddle + 144, 0.4)], 0.08)
for pan in (-0.6, 0.0, 0.6):
	grind(T.open + 24, T.open + 76, 0.08, pan)
swell_to(T.riddle + 50, T.riddle + 130, 0.12, 40, 500, P(300), 0.6)  # 推进沙漠遗迹
# 沙漠：暖风
wind(T.riddle + 96, T.island + 40, [(T.riddle + 96, 0.0), (T.riddle + 130, 0.6), (T.island, 0.6), (T.island + 40, 0.0)], 0.1, 100, 700, 0.0, 0.15)
glow(T.desert + 14, T.desert + 130, [(T.desert + 14, 0.0), (T.desert + 30, 0.7), (T.desert + 128, 0.7), (T.desert + 130, 0.0)], 0.03, 98)
for need in (6, 13, 19, 24):  # 箭头一个个亮起
	ping(T.desert + 14 + need * 114 / 46, 0.03, 87)
boom(T.strength + 2, 0.55)  # 考的是力量
rumble(T.strength, T.strength + 60, [(T.strength, 0.0), (T.strength + 6, 0.8), (T.strength + 60, 0.0)], 0.12)
# 小岛洞穴：冷空气；"时间流过两次"时光影快速扫过
air(T.island - 10, T.tomb + 30, [(T.island - 10, 0.0), (T.island + 30, 0.7), (T.tomb + 30, 0.0)], 0.1)
glow(T.island + 30, T.island + 142, [(T.island + 30, 0.0), (T.island + 50, 0.7), (T.island + 140, 0.7), (T.island + 142, 0.0)], 0.03, 92)
for k in range(8):
	whoosh(T.patience + 18 + k * 13, 0.9, 200, 500, 0.03, -0.7 if k % 2 else 0.7, 0.7 if k % 2 else -0.7, peak=0.5)
for k in range(2):
	ping(T.patience + 68 + k * 50, 0.05, 82)
# 古墓：中央升起光柱
air(T.tomb - 10, T.wait, [(T.tomb - 10, 0.0), (T.tomb + 30, 0.6), (T.wait, 0.6)], 0.08)
glow(T.tomb + 22, T.tomb + 126, [(T.tomb + 22, 0.0), (T.tomb + 40, 0.7), (T.tomb + 124, 0.7), (T.tomb + 126, 0.0)], 0.03, 98)
swell_to(T.tomb + 112, T.tomb + 150, 0.12, 60, 900, 0.0, 1.2)
glow(T.tomb + 120, T.record + 80, [(T.tomb + 120, 0.0), (T.tomb + 150, 0.9), (T.record + 50, 0.9), (T.record + 80, 0.0)], 0.04, 123)
glow(T.will, T.wait + 30, [(T.will, 0.0), (T.will + 20, 0.6), (T.will + 84, 1.2), (T.wait + 30, 0.0)], 0.04, 110)  # 在中央发出光芒
swell_to(T.will + 60, T.will + 88, 0.1, 60, 700, 0.0, 1.0)
# 回到三道门：巨人在等
air(T.wait - 4, T.endC, [(T.wait - 4, 0.0), (T.wait + 36, 0.6), (T.endC, 0.6)], 0.08)
drone(T.wait, T.endC, [(T.wait, 0.0), (T.wait + 40, 0.5), (T.endC, 0.5)], 0.05, 44)
for k in range(3):
	ping(T.wait2 + 22 + [0, 22, 52][k], 0.03, 98, [-0.5, 0.0, 0.5][k])

# ════════════════════════════════════════════════════════════════════════
# 第 6 段 各地的门
# ════════════════════════════════════════════════════════════════════════
drone(T.endC, T.unova + 70, [(T.endC, 0.5), (T.unova + 70, 0.0)], 0.05, 44)
# 合众地底遗迹：火把
fire(T.unova + 6, T.peony + 14, [(T.unova + 6, 0.0), (T.unova + 70, 0.6), (T.honor + 100, 0.6), (T.peony + 14, 0.0)], 0.1, -0.6)
fire(T.unova + 6, T.peony + 14, [(T.unova + 6, 0.0), (T.unova + 70, 0.5), (T.honor + 100, 0.5), (T.peony + 14, 0.0)], 0.1, 0.6)
air(T.unova, T.peony + 14, [(T.unova, 0.0), (T.unova + 60, 0.6), (T.peony + 14, 0.0)], 0.08)
glow(T.protect + 10, T.moon + 30, [(T.protect + 10, 0.0), (T.protect + 50, 0.8), (T.moon + 30, 0.3)], 0.04, 98)  # 刻字描金
swell(T.moon + 6, 2.0, 0.06, 60, 600, -0.6, peak=0.5)  # 日
swell(T.moon + 110, 2.0, 0.06, 60, 600, 0.6, peak=0.5)  # 月
glow(T.honor, T.peony, [(T.honor, 0.0), (T.honor + 40, 0.8), (T.peony, 0.0)], 0.04, 87)
# 王冠雪原：皮欧尼与笔记
wind(T.honor + 96, T.solve + 20, [(T.honor + 96, 0.0), (T.peony + 14, 0.7), (T.solve - 20, 0.7), (T.solve + 20, 0.0)], 0.16, 110, 900, 0.0, 0.18)
whoosh(T.notes - 4, 1.2, 250, 600, 0.04, 0.6, 0.3, peak=0.5)  # 笔记翻开
for at in (T.note1, T.note2, T.note3, getattr(T, 'pass') + 20):
	ping(at + 4, 0.03, 87, 0.4)
# 三扇门依次打开
air(T.solve - 16, T.last + 30, [(T.solve - 16, 0.0), (T.solve + 20, 0.6), (T.last + 30, 0.0)], 0.08)
for i, at in enumerate(SOLVE_OPEN):
	ping(at - 30, 0.03, 98, [-0.7, -0.35, 0.0][i])
	grind(at, at + 34, 0.12, [-0.7, -0.35, 0.0][i])
# 三个巨人聚到抉择遗迹门前、门开、二选一
for k in range(5):
	thud(T.gather - 40 + k * 16, 0.18, -0.3 + k * 0.15)
grind(T.gather + 50, T.gather + 94, 0.16, 0.3)
hum(T.gather + 60, T.every + 40, [(T.gather + 60, 0.0), (T.choose + 30, 0.6), (T.every + 40, 0.0)], 0.03, 55, P(700), flick=0.4)  # 雷吉艾勒奇那道门
drone(T.gather + 60, T.every + 40, [(T.gather + 60, 0.0), (T.choose + 30, 0.6), (T.every + 40, 0.0)], 0.05, 41, P(1230))  # 雷吉铎拉戈那道门
glow(T.every, T.last + 20, [(T.every, 0.0), (T.every + 40, 0.7), (T.last + 20, 0.0)], 0.04, 98)  # 五道门的记号
# 回到石室，读最后两块石板
water(T.last - 10, T.endD, [(T.last - 10, 0.0), (T.last + 30, 0.7), (T.endD, 0.7)], 0.07)
air(T.last - 10, T.endD, [(T.last - 10, 0.0), (T.last + 30, 0.6), (T.endD, 0.6)], 0.08)
glow(T.courage + 4, T.courage + 110, [(T.courage + 4, 0.0), (T.courage + 20, 0.7), (T.courage + 108, 0.7), (T.courage + 110, 0.0)], 0.03, 98, -0.4)
glow(T.eternal, T.endD + 30, [(T.eternal, 0.0), (T.eternal + 30, 0.7), (T.eternal + 62, 1.2), (T.endD + 30, 0.0)], 0.04, 87, 0.3)
swell_to(T.eternal + 40, T.eternal + 62, 0.12, 40, 500, 0.0, 1.6)  # 整面墙亮起（中篇完）

# ════════════════════════════════════════════════════════════════════════
# 第 7 段 雪峰神殿
# ════════════════════════════════════════════════════════════════════════
water(T.keyCard, T.hisui + 20, [(T.keyCard, 0.7), (T.king2 + 60, 0.4), (T.hisui + 20, 0.0)], 0.07)
swell(T.keyCard + 24, 2.6, 0.1, 40, 400, peak=0.35)  # 篇章卡
for i in range(7):
	ping(T.king2 + 40 + i * 9, 0.03, 82)
wind(T.hisui - 36, T.statues + 30, [(T.hisui - 36, 0.0), (T.hisui + 10, 0.8), (T.statues - 6, 0.8), (T.statues + 30, 0.0)], 0.18, 110, 1000, 0.0, 0.15)
air(T.statues - 6, T.adaman + 16, [(T.statues - 6, 0.0), (T.statues + 30, 0.6), (T.adaman + 16, 0.6)], 0.08)
for i, at in enumerate(MARK_AT):  # 岩、冰、钢的记号依次亮起
	ping(at, 0.04, [82, 98, 110][i], 0.0)
	thud(at, 0.15)
grind(MARK_AT[2] + 14, MARK_AT[2] + 60, 0.1)
# 地底的门、刚石
air(T.adaman - 24, T.today + 30, [(T.adaman - 24, 0.0), (T.adaman + 16, 0.7), (T.today + 30, 0.0)], 0.09)
thud(T.stuck + 21, 0.35)  # 推门推不动
glow(T.plates + 30, T.unseal + 40, [(T.plates + 30, 0.0), (T.plates + 90, 0.7), (T.unseal, 0.8), (T.unseal + 40, 0.0)], 0.04, 92)  # 三块石板
for i in range(3):
	ping(T.plates + 30 + i * 22, 0.035, [82, 98, 110][i], [-0.4, 0.0, 0.4][i])
swell(T.stuff, 2.2, 0.06, 30, 300, peak=0.4)  # 三个巨人的影子
whoosh(T.unseal + 2, 1.3, 600, 250, 0.07, 0.0, 0.0, peak=0.5)  # 石板飞进门缝
grind(T.unseal + 26, T.unseal + 80, 0.18)
swell_to(T.unseal + 40, T.unseal + 90, 0.16, 50, 700, 0.0, 1.0)  # 门开、金光
# 今天：石像一样的雷吉奇卡斯
air(T.today - 4, T.bed + 20, [(T.today - 4, 0.0), (T.today + 30, 0.6), (T.bed - 24, 0.6), (T.bed + 20, 0.0)], 0.09)
drone(T.today, T.bed, [(T.today, 0.0), (T.today + 40, 0.5), (T.three + 40, 0.5), (T.three + 120, 0.8), (T.bed, 0.0)], 0.06, 37)
swell(T.three, 1.8, 0.06, 30, 300, peak=0.4)  # 三个巨人站到面前
for i in range(7):
	ping(T.three + 40 + i * 8, 0.03, 82)
swell_to(T.three + 40, T.three + 120, 0.1, 30, 400, 0.0, 0.8)  # 慢慢恢复颜色
glow(T.reverse + 44, T.bed, [(T.reverse + 44, 0.0), (T.reverse + 64, 0.6), (T.keys + 40, 0.6), (T.bed, 0.0)], 0.03, 98, 0.4)  # 地上的一圈七个点
for i in range(7):
	ping(T.reverse + 56 + i * 6, 0.025, 98, 0.4)
swell(T.reverse + 110, 1.8, 0.07, 30, 300, 0.4, peak=0.5)  # 雷吉洛克醒来
glow(T.keys, T.bed - 10, [(T.keys, 0.0), (T.keys + 20, 0.7), (T.bed - 10, 0.0)], 0.04, 110)  # 互为钥匙
# 伽勒尔的巨人睡榻
wind(T.bed - 24, T.endE + 50, [(T.bed - 24, 0.0), (T.bed + 20, 0.7), (T.endE, 0.7), (T.endE + 50, 0.0)], 0.16, 110, 900, 0.0, 0.18)
rumble(T.bed + 20, T.bed + 110, [(T.bed + 20, 0.0), (T.bed + 80, 0.7), (T.bed + 110, 0.0)], 0.12)  # 雷吉奇卡斯升起
for i in range(7):
	ping(T.bed + 90 + i * 6, 0.025, 82)
# 动画：暴走（低沉的轰鸣与地鸣）；游戏：安静地等
rumble(T.anime, T.anime + 136, [(T.anime, 0.0), (T.anime + 16, 1.0), (T.anime + 112, 1.0), (T.anime + 136, 0.0)], 0.16)
for k in range(3):
	boom(T.anime + 20 + k * 34, 0.35)
glow(T.anime + 120, T.endE + 40, [(T.anime + 120, 0.0), (T.anime + 150, 0.7), (T.endE + 40, 0.0)], 0.04, 87)

# ════════════════════════════════════════════════════════════════════════
# 第 8 段 敬畏
# ════════════════════════════════════════════════════════════════════════
water(T.awe, T.lock + 30, [(T.awe, 0.0), (T.awe + 50, 0.7), (T.lock, 0.6), (T.lock + 30, 0.0)], 0.07)
air(T.awe, T.lock + 30, [(T.awe, 0.0), (T.awe + 50, 0.6), (T.lock + 30, 0.0)], 0.08)
glow(T.pair - 10, T.aweWord + 30, [(T.pair - 10, 0.0), (T.pair + 20, 0.8), (T.aweWord + 30, 0.4)], 0.04, 98, 0.4)  # 两块石板一起亮起
swell(T.virtue + 4, 1.6, 0.06, 60, 600, -0.3, peak=0.4)  # 敬
swell(T.virtue + 40, 1.6, 0.06, 40, 400, -0.3, peak=0.4)  # 畏
swell_to(T.aweWord, T.aweWord + 40, 0.1, 40, 500, 0.0, 1.4)  # 合成"敬畏"
drone(T.balance - 10, T.lock + 20, [(T.balance - 10, 0.0), (T.balance + 30, 0.5), (T.lock, 0.5), (T.lock + 20, 0.0)], 0.04, 44)  # 天平
hum(T.lock - 6, T.rose + 24, [(T.lock - 6, 0.0), (T.lock + 30, 0.6), (T.rose - 10, 0.6), (T.rose + 24, 0.0)], 0.04, 55, 0.0, flick=0.3)  # 锁在圆环里的电
# 伽勒尔夜里的城市：低沉的城市嗡鸣（没有人声）
hum(T.rose - 10, T.lesson + 100, [(T.rose - 10, 0.0), (T.rose + 30, 0.6), (T.dark + 10, 0.6), (T.dark + 90, 0.15), (T.lesson + 100, 0.0)], 0.04, 50)
air(T.rose - 10, T.lesson + 100, [(T.rose - 10, 0.0), (T.rose + 30, 0.7), (T.lesson + 100, 0.0)], 0.09)
wind(T.rose, T.lesson + 100, [(T.rose, 0.0), (T.rose + 40, 0.4), (T.dark, 0.4), (T.dark + 60, 0.8), (T.lesson + 100, 0.0)], 0.08, 100, 700, 0.0, 0.12)
# 闇夜
drone(T.dark, T.lesson + 100, [(T.dark, 0.0), (T.dark + 60, 1.0), (T.lesson + 60, 0.8), (T.lesson + 100, 0.0)], 0.09, 34)
swell_to(T.dark + 10, T.dark + 90, 0.16, 25, 220, P(855), 0.8)
for k, x in enumerate((855, 400, 1300)):
	thunder(T.dark + 30 + k * 40, P(x), 0.6)
# 古人留下的那扇门
air(T.lesson + 56, T.endF, [(T.lesson + 56, 0.0), (T.lesson + 100, 0.6), (T.endF, 0.6)], 0.08)
glow(T.lesson + 56, T.endF, [(T.lesson + 56, 0.0), (T.lesson + 100, 0.7), (T.endF, 0.7)], 0.04, 98)

# ════════════════════════════════════════════════════════════════════════
# 第 9 段 王醒来（全片爆发点）
# ════════════════════════════════════════════════════════════════════════
air(T.door9, T.before + 70, [(T.door9, 0.6), (T.before + 70, 0.0)], 0.08)
glow(T.door9, T.before + 40, [(T.door9, 0.7), (T.before, 0.9), (T.before + 40, 0.0)], 0.04, 98)
for at in (T.seek + 14, T.seek + 44, T.seek + 78):  # 力量、耐心、爱与希望
	ping(at, 0.04, 98)
for at, x in ((T.seek + 104, 450), (T.seek + 124, 1470), (T.seek + 144, 960)):  # 巨人一个个回来
	thud(at + 10, 0.3, P(x))
	swell(at, 1.4, 0.05, 30, 260, P(x), peak=0.5)
grind(T.before - 8, T.before + 40, 0.2)  # 门开
swell_to(T.before + 10, T.before + 60, 0.16, 50, 700, 0.0, 0.6)  # 推进最深处
# 最深处：石像要醒了
air(T.before + 36, T.dread, [(T.before + 36, 0.0), (T.before + 70, 0.6), (T.dread, 0.6)], 0.08)
drone(T.before + 40, T.dread, [(T.before + 40, 0.0), (T.before + 80, 0.6), (T.wake, 0.9), (T.wake + 30, 1.3), (T.dread - 40, 0.8), (T.dread, 0.0)], 0.08, 33)
for i in range(21):  # 三个巨人脸上的七个点
	ping(T.before + 70 + (i // 7) * 6 + (i % 7) * 2, 0.012, 98 + (i // 7) * 10, ((i // 7) - 1) * 0.6)
rumble(T.wake - 30, T.wake + 140, [(T.wake - 30, 0.0), (T.wake, 0.6), (T.wake + 28, 1.2), (T.wake + 70, 0.8), (T.wake + 140, 0.0)], 0.22)  # 裂纹爬开
swell_to(T.wake - 20, T.wake + 30, 0.34, 25, 600, 0.0, 0.3)
boom(T.wake + 30, 1.9)  # 王醒来：全片最响，但只有低沉的轰鸣（第二次叫声在视频里）
for i in range(7):  # 七个圆孔一个个点亮
	ping(T.wake + 24 + i * 6, 0.05, 82)
glow(T.wake + 24, T.dread, [(T.wake + 24, 0.0), (T.wake + 60, 1.0), (T.dread - 30, 0.7), (T.dread, 0.0)], 0.05, 73)
for k in range(12):  # 石片剥落（低沉的细碎落地，不是碎裂声）
	thud(T.wake + 40 + k * 6 + (k * 5) % 4, 0.08, float(np.sin(k * 1.7)) * 0.5)
# 敞开的门，光照出来；淡出
air(T.dread - 40, T.endG, [(T.dread - 40, 0.0), (T.dread, 0.6), (T.revere + 92, 0.6), (T.endG, 0.0)], 0.08)
glow(T.dread - 40, T.endG, [(T.dread - 40, 0.0), (T.dread, 1.0), (T.revere + 92, 1.0), (T.endG, 0.0)], 0.06, 87)
swell(T.revere + 40, 4.0, 0.06, 30, 300, peak=0.3)


# ─── 混音输出 ────────────────────────────────────────────────────────
mix = np.stack([soft_lowpass(L), soft_lowpass(R)], axis=1)
mix = np.tanh(mix / (np.max(np.abs(mix)) * 0.85))
mix = mix / np.max(np.abs(mix)) * 10 ** (-3 / 20)

# 叫声在视频里：叫声响起时把音效压低约 8 dB（雷吉奇卡斯第二次叫声只压 3 dB，保住全片最大的爆发点）
CLIMAX = S(T.wake + 30)
CRIES = [S(x) for x in (T.regirock, T.regice, T.registeel, T.regigigas, T.eleki, T.drago, T.relicanth, T.wailord)] + [CLIMAX]
duck_db = np.zeros(N)
tt = np.arange(N) / SR
for c in CRIES:
	shape = np.interp(tt, [c - 0.06, c, c + 1.6, c + 2.2], [0, 1, 1, 0], left=0, right=0)
	duck_db = np.maximum(duck_db, shape * (3.0 if c == CLIMAX else 8.0))
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


def cut(a: int, b: int) -> np.ndarray:
	return mix[int(a / FPS * SR) : int(b / FPS * SR)]


outdir = ROOT / 'out' / '敬畏'
write_wav(outdir / 'regi-sfx.wav', mix)
for name, a, b in SEGMENTS:
	write_wav(outdir / 'sfx' / f'regi-{name}-sfx.wav', cut(a, b))
for part, i0, i1 in PARTS:
	write_wav(outdir / 'sfx' / f'regi-{part}-sfx.wav', cut(SEGMENTS[i0][1], SEGMENTS[i1][2]))
print(f'regi-sfx.wav: {TOTAL:.2f}s ({TOTAL_FRAMES} frames), peak -3 dBFS')
for name, a, b in SEGMENTS:
	print(f'  {name}: {(b - a) / FPS:.2f}s')
