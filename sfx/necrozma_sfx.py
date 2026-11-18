"""
《夺走的光辉》（代码短名 necrozma）音效轨（不是配乐：没有旋律，只有环境声与动作音效）。
全部用 numpy 程序合成，不使用外部素材。叫声在视频里，这里不含。

时间轴：场景代码按"内部帧号"（30fps）编写，第 2、5 段提速播放；这里的事件也写内部帧号，
用与 src/scenes/necrozma/continuity.ts 相同的 outT() 换成输出时间（0 秒 = 第 1 段第一帧）。
帧号取自 common.ts（BURST_AT、REVEAL、CLASH…）和 Shots*.tsx。

整体柔和、克制（CLAUDE.md 的音效要求）：
  雷只用远处闷雷；撞击只留低沉轰鸣；风、火是低频为主的底噪；
  不用尖锐高频、碎裂声、雨幕沙沙、人群嘈杂；爆发点比底噪响但不刺耳。
  "光"的声音用低中频的柔和嗡鸣（glow），不用高频闪烁。
所有音源最后再过一道 6 kHz 的柔和低通。

输出（都在 out/夺走的光辉/ 下）：
  necrozma-sfx.wav                    整期音效（48kHz 立体声 16 位，峰值 -3 dBFS）
  sfx/necrozma-part1/2/3-sfx.wav      与三个视频文件对应（第 1–3 段、第 4–6 段、第 7–9 段）
  sfx/necrozma-s1…s9-sfx.wav          按段切开

用法：python sfx/necrozma_sfx.py
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
FPS = 30

# 各段输出时长（30fps 帧数），与 continuity.ts 一致
SEGMENTS = [
	('s1', 540),  # 两个名字 → 片名
	('s2', 357),  # 光辉大神（提速）
	('s3', 780),  # 贪心
	('s4', 600),  # 漆黑
	('s5', 408),  # 牢塔（提速）
	('s6', 960),  # 光之掠夺者（古书）
	('s7', 960),  # 再临
	('s8', 820),  # 追击与究极爆发
	('s9', 960),  # 尾声
]
PARTS = [('part1', ['s1', 's2', 's3']), ('part2', ['s4', 's5', 's6']), ('part3', ['s7', 's8', 's9'])]
OFFSET = {}
_acc = 0
for _name, _frames in SEGMENTS:
	OFFSET[_name] = _acc
	_acc += _frames
TOTAL_FRAMES = _acc
TOTAL = TOTAL_FRAMES / FPS

# ─── 内部帧号 → 输出秒（与 continuity.ts 的 outT 相同）──────────────────
R2 = (540, 960, 357)
R5 = (2340, 2820, 408)
D2 = R2[1] - R2[0] - R2[2]
D5 = R5[1] - R5[0] - R5[2]


def outT(i: float) -> float:
	if i <= R2[0]:
		return i
	if i <= R2[1]:
		return R2[0] + (i - R2[0]) * R2[2] / (R2[1] - R2[0])
	if i <= R5[0]:
		return i - D2
	if i <= R5[1]:
		return R5[0] - D2 + (i - R5[0]) * R5[2] / (R5[1] - R5[0])
	return i - D2 - D5


def T(i: float) -> float:
	"""内部帧号 → 整期输出秒数"""
	return outT(i) / FPS


def D(a: float, b: float) -> float:
	"""两个内部帧号之间的输出时长（秒）"""
	return T(b) - T(a)


# 关键帧（内部帧号，与 common.ts 一致）
BURST_AT = 1258
REVEAL = 1846
ABSORB = [2030, 2080, 2130, 2180]
TOWER_UP = 2370
ESCAPE = 3870
LUSA = 3935
SOL_PEAK = 4100
LUN_PEAK = 4130
NEC_OUT = 4190
LUNGE = 4270
FUSE = 4400
DM_PEAK = 4414
DW_PEAK = 4450
DARKEN = 4590
WARP = 4740
ULTRA = 5000
CLASH = 5240
HIT = 5430
CITY_DARK = 5640
SPIRES = [330, 760, 1210, 1640]

N = int(TOTAL * SR)
L = np.zeros(N, dtype=np.float64)
R = np.zeros(N, dtype=np.float64)
rng = np.random.default_rng(20261011)


# ─── 基础工具（同 dragons_sfx.py）────────────────────────────────────
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
	"""pts 的时间是内部帧号"""
	xs, ys = zip(*pts)
	return np.interp(t, [T(x) for x in xs], ys)


def wobble(n: int, rate: float = 0.3, depth: float = 0.4) -> np.ndarray:
	t = np.arange(n) / SR
	w = sum(np.sin(2 * np.pi * rate * k * t + rng.uniform(0, 6.28)) / k for k in (1, 1.7, 2.9))
	return 1 + depth * w / 1.9


def add(start: float, sig: np.ndarray, gain: float = 1.0, pan=0.0) -> None:
	"""在整期输出时间 start 秒处叠加单声道信号；pan 为 -1（左）…1（右），可为等长数组"""
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
	"""内部帧号 a–b → 采样数、每个采样的输出秒数"""
	start = T(a)
	n = int(D(a, b) * SR)
	return start, n, start + np.arange(n) / SR


def P(x: float) -> float:
	"""画面横坐标（像素，1920 宽）→ 声像"""
	return float(np.clip((x / 1920 - 0.5) * 1.6, -1, 1))


# ─── 柔和的音效（时间参数都是内部帧号）────────────────────────────────
def air(a, b, pts, gain=0.1, pan=0.0):
	"""空气声：极轻的低频底噪"""
	s, n, t = span(a, b)
	add(s, norm(band(brown(n), 30, 500)) * wobble(n, 0.12, 0.3) * env(t, pts), gain, pan)


def wind(a, b, pts, gain=0.2, lo=120, hi=1100, pan=0.0, rate=0.2):
	"""风：低频为主，缓慢起伏，左右各一条"""
	s, n, t = span(a, b)
	e = env(t, pts)
	for side in (-0.5, 0.5):
		sig = norm(band(noise(n), lo, hi)) * np.clip(wobble(n, rate, 0.6), 0.15, None) * e
		add(s, sig, gain * 0.7, float(np.clip(pan + side, -1, 1)))


def fire(a, b, pts, gain=0.3, pan=0.0):
	"""火 / 余烬：低沉的燃烧声（没有噼啪）"""
	s, n, t = span(a, b)
	roar = norm(band(brown(n), 35, 420)) * wobble(n, 0.5, 0.45)
	body = norm(band(noise(n), 200, 1300)) * np.clip(wobble(n, 1.6, 0.7), 0.2, None) * 0.25
	add(s, (roar + body) * env(t, pts), gain, pan)


def thunder(at, pan=0.0, size=1.0):
	"""远处的闷雷"""
	n = int((3.5 + 1.5 * size) * SR)
	t = np.arange(n) / SR
	roll = band(noise(n), 25, 260)
	am = np.clip(wobble(n, 1.6, 0.7), 0.15, None)
	sig = norm(roll * am) * np.minimum(t / 0.18, 1) * np.exp(-t / (1.3 + 0.7 * size))
	add(T(at), sig, 0.32 * size, pan)


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
	add(T(at), sig, 0.6 * size ** 0.9, pan)


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
	add(T(at), norm(out) * shape, gain, pan0 + (pan1 - pan0) * t)


def swell(at, dur, gain=0.3, lo=40, hi=700, pan=0.0, peak=0.8):
	"""低频的涌起：慢慢变响，到 peak 处最响后回落；dur 为秒"""
	n = int(dur * SR)
	t = np.arange(n) / SR / dur
	sig = norm(band(brown(n), lo, hi)) * wobble(n, 0.8, 0.2)
	shape = np.where(t < peak, (t / peak) ** 2, np.cos(np.pi / 2 * (t - peak) / (1 - peak)) ** 2)
	add(T(at), sig * shape, gain, pan)


def swell_to(a, b, gain=0.3, lo=40, hi=700, pan=0.0, after=0.4):
	"""从内部帧 a 涌起，到 b 最响，之后 after 秒回落"""
	dur = D(a, b) + after
	swell(a, dur, gain, lo, hi, pan, peak=D(a, b) / dur)


def drone(a, b, pts, gain=0.15, f=48.0, pan=0.0):
	"""低沉的持续音（单一低音、缓慢拍频，不成旋律）"""
	s, n, t = span(a, b)
	tt = np.arange(n) / SR
	tone = np.sin(2 * np.pi * f * tt) + 0.7 * np.sin(2 * np.pi * f * 1.006 * tt + 1.0) + 0.25 * np.sin(2 * np.pi * f * 2.003 * tt)
	hum = norm(band(noise(n), f * 1.5, f * 6)) * 0.3
	add(s, (norm(tone) + hum) * wobble(n, 0.15, 0.25) * env(t, pts), gain, pan)


def glow(a, b, pts, gain=0.08, f=110.0, pan=0.0):
	"""光的嗡鸣：低中频的柔和泛音簇 + 一点气声，缓慢起伏（不尖、不闪）"""
	s, n, t = span(a, b)
	tt = np.arange(n) / SR
	tone = sum(w * np.sin(2 * np.pi * f * k * tt + k) for k, w in ((1, 1.0), (1.503, 0.5), (2.004, 0.35), (2.997, 0.15)))
	tone = tone * (0.85 + 0.15 * np.sin(2 * np.pi * 0.37 * tt))
	breath = norm(band(noise(n), f * 2, f * 9)) * 0.25
	add(s, (norm(tone) + breath) * wobble(n, 0.1, 0.2) * env(t, pts), gain, pan)


def hum(a, b, pts, gain=0.1, f=60.0, pan=0.0, flick=0.0):
	"""人造光的电嗡（塔的光）：低频锯齿过低通；flick > 0 时带不规则的闪断"""
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
# 第 1 段：烧焦的书页 → 光谱 → 远古究极大都会 → 片名（内部 0–540）
# ════════════════════════════════════════════════════════════════════════
air(0, 300, [(0, 0.7), (250, 0.7), (300, 0.0)], 0.08)
fire(0, 290, [(0, 0.0), (10, 0.5), (240, 0.5), (290, 0.0)], 0.1, 0.3)  # 书页焦边的余烬（低沉）
swell_to(14, 40, 0.14, 60, 600, -0.3, 0.6)  # 一束光照亮"光之掠夺者"
glow(20, 260, [(20, 0.0), (40, 0.6), (140, 0.6), (160, 1.0), (240, 1.0), (260, 0.0)], 0.05, 98)
swell_to(130, 152, 0.12, 100, 900, 0.5, 0.5)  # 晶片闪一下
whoosh(150, D(150, 240), 250, 1100, 0.14, 0.5, -0.6, peak=0.45)  # 光谱扇展开、伸向另一个世界
# 远古的金色城市：温暖的风 + 光团的低嗡，一直到光团炸开
wind(232, BURST_AT, [(232, 0.0), (290, 0.8), (1100, 0.8), (BURST_AT, 0.3)], 0.13, 120, 900, 0.0, 0.12)
glow(240, BURST_AT + 4, [(240, 0.0), (320, 0.7), (1060, 0.8), (1240, 1.3), (BURST_AT + 4, 0.0)], 0.07, 82, P(1210))
swell(436, 1.8, 0.14, 40, 400, peak=0.35)  # 本期标题

# ════════════════════════════════════════════════════════════════════════
# 第 2–3 段：光辉大神 → 贪心：聚光塔、拉扯、光团炸开（内部 540–1740）
# ════════════════════════════════════════════════════════════════════════
air(540, 1740, [(540, 0.6), (1740, 0.6)], 0.07)
swell_to(880, 1070, 0.16, 25, 220, 0.0, 0.8)  # 聚光塔从城里升起（极轻的地鸣）
for i, x in enumerate(SPIRES):  # 四束光柱依次对准天上的光
	whoosh(1058 + i * 6, 1.3, 200, 900, 0.07, P(x), P(1210), peak=0.7)
hum(1060, BURST_AT + 2, [(1060, 0.0), (1100, 0.6), (1250, 1.0), (BURST_AT + 2, 0.0)], 0.07, 58)  # 光被强行拉扯
swell_to(1110, BURST_AT, 0.3, 30, 800, P(1210), 0.2)  # 光团出现裂纹、将碎
boom(BURST_AT, 0.85, P(1210))  # 光团炸开
whoosh(BURST_AT, 1.8, 1000, 250, 0.2, P(1210), -0.9, peak=0.12)
whoosh(BURST_AT, 1.8, 1000, 250, 0.2, P(1210), 0.9, peak=0.12)
for at, x in ((BURST_AT + 22, 470), (BURST_AT + 30, 1560), (BURST_AT + 40, 960)):  # 天上撕开三个究极之洞
	swell(at, 1.6, 0.1, 60, 700, P(x), peak=0.4)
for i, (at, p0, p1) in enumerate(((1300, -0.2, -0.7), (1318, 0.3, 0.8), (1336, 0.0, -0.3), (1356, 0.5, 0.2))):  # 碎片落进洞里
	whoosh(at, 1.6, 700, 220, 0.09, p0, p1, peak=0.35)
drone(1290, 1560, [(1290, 0.0), (1330, 0.7), (1470, 0.7), (1540, 0.0)], 0.06, 51)  # 洞里的空响
# 碎光散尽，漆黑里出现它
drone(1590, 2330, [(1590, 0.0), (1700, 0.6), (1846, 1.0), (2240, 1.0), (2330, 0.0)], 0.1, 38, P(1150))

# ════════════════════════════════════════════════════════════════════════
# 第 4 段：漆黑：显色、夺回城里的光（内部 1740–2340）
# ════════════════════════════════════════════════════════════════════════
air(1740, 2340, [(1740, 0.6), (2240, 0.6), (2320, 0.25), (2340, 0.25)], 0.08)
swell_to(1796, REVEAL, 0.24, 40, 600, P(1120), 0.6)  # 显色（叫声在视频里）
swell_to(2010, 2050, 0.16, 25, 220, 0.0, 1.0)  # 整座城在颤
for i, at in enumerate(ABSORB):  # 四座聚光塔的光依次被吸走
	whoosh(at, 1.5, 300, 1000, 0.13, P(SPIRES[i]), P(1120), peak=0.75)
	swell(at + 30, 1.2, 0.1, 40, 300, P(SPIRES[i]), peak=0.2)
glow(2030, 2280, [(2030, 0.0), (2070, 0.5), (2200, 0.9), (2280, 0.0)], 0.06, 73, P(1120))  # 光灌进它的身体
swell(2236, 2.6, 0.12, 30, 200, peak=0.15)  # 光全部熄灭（一声沉下去）

# ════════════════════════════════════════════════════════════════════════
# 第 5 段：牢塔（内部 2340–2820）
# ════════════════════════════════════════════════════════════════════════
air(2340, 2800, [(2340, 0.25), (2380, 0.6), (2800, 0.6)], 0.08)
swell_to(TOWER_UP, TOWER_UP + 130, 0.2, 25, 260, 0.0, 0.8)  # 高塔从漆黑里升起
hum(TOWER_UP + 10, 2800, [(TOWER_UP + 10, 0.0), (TOWER_UP + 120, 0.8), (2800, 1.0)], 0.06, 60)  # 人造光的冷嗡
swell_to(2540, 2620, 0.14, 40, 500, 0.0, 0.3)  # 光笼合上
boom(2620, 0.4)
swell_to(2690, 2800, 0.2, 60, 1200, 0.0, 0.2)  # 推进塔顶的光、曝白

# ════════════════════════════════════════════════════════════════════════
# 第 6 段：阿罗拉的古书（内部 2785–3792）
# ════════════════════════════════════════════════════════════════════════
air(2785, 3780, [(2785, 0.0), (2810, 0.6), (3760, 0.6), (3780, 0.0)], 0.08)
fire(2785, 3790, [(2785, 0.0), (2830, 0.35), (3540, 0.35), (3620, 0.8), (3760, 1.0), (3790, 0.0)], 0.12, 0.0)  # 余烬，最后整页烧进来
swell_to(2840, 2905, 0.14, 40, 500, 0.0, 0.6)  # 插图：奈克洛兹玛降临
swell(2880, 4.4, 0.12, 25, 200, peak=0.35)  # 墨色漫开，世界被黑暗包围
swell_to(2972, 3045, 0.08, 60, 500, P(500), 0.6)  # 太阳之兽
swell_to(2982, 3055, 0.08, 60, 500, P(1420), 0.6)  # 月亮之兽
boom(3170, 0.35, P(500))  # 被夺走，成为黄昏之鬃
boom(3268, 0.35, P(1420))  # 成为拂晓之翼
swell_to(3330, 3380, 0.12, 60, 800, 0.0, 0.4)  # 年轻人与守护神举起石头
glow(3365, 3640, [(3365, 0.0), (3395, 0.9), (3560, 0.7), (3640, 0.0)], 0.07, 98)  # 石头放出光明
swell(3372, 2.4, 0.1, 80, 900, peak=0.25)

# ════════════════════════════════════════════════════════════════════════
# 第 7 段：再临（内部 3780–4740）
# ════════════════════════════════════════════════════════════════════════
# 塔顶：光在闪、光笼在颤 → 撕开究极之洞
air(3760, 3935, [(3760, 0.0), (3800, 0.6), (3935, 0.6)], 0.08)
hum(3760, 3935, [(3760, 0.0), (3800, 0.9), (3935, 0.9)], 0.07, 60, 0.0, flick=0.7)
drone(3790, 3880, [(3790, 0.0), (3840, 0.7), (3880, 0.0)], 0.07, 44)  # 它在笼里挣扎
swell_to(3830, ESCAPE, 0.22, 40, 700, 0.0, 0.2)
boom(ESCAPE, 0.7)  # 光笼碎开、究极之洞撕开
whoosh(ESCAPE + 4, D(ESCAPE, 3935), 300, 1300, 0.16, 0.0, 0.0, peak=0.75)  # 镜头冲进洞里
# 露莎米奈：冷灰的空间、一道究极之洞
drone(LUSA - 8, 4072, [(LUSA - 8, 0.0), (LUSA + 20, 0.7), (4040, 0.7), (4072, 0.0)], 0.07, 49)
air(LUSA - 8, 4072, [(LUSA - 8, 0.0), (LUSA + 20, 0.6), (4072, 0.6)], 0.08)
glow(LUSA, 4072, [(LUSA, 0.0), (LUSA + 20, 0.5), (4072, 0.9)], 0.04, 92)  # 洞口的光
whoosh(3998, D(3998, 4060), 200, 900, 0.12, 0.0, 0.0, peak=0.8)  # 她走进洞里
swell_to(4030, 4072, 0.14, 60, 900, 0.0, 0.3)  # 曝白转到祭坛
# 祭坛分屏：左边白昼的风，右边夜晚的空气
wind(4058, 4600, [(4058, 0.0), (4090, 0.8), (4560, 0.8), (4600, 0.3)], 0.1, 120, 900, -0.6, 0.15)
air(4058, 4600, [(4058, 0.0), (4090, 0.7), (4600, 0.4)], 0.07, 0.6)
swell_to(SOL_PEAK - 46, SOL_PEAK, 0.18, 40, 600, -0.6, 0.5)  # 索尔迦雷欧的光柱（叫声在视频里）
swell_to(LUN_PEAK - 46, LUN_PEAK, 0.18, 40, 600, 0.6, 0.5)  # 露奈雅拉的光柱
# 祭坛上空撕开究极之洞，奈克洛兹玛冲出来、扑上去
swell_to(NEC_OUT - 30, NEC_OUT, 0.18, 40, 700, 0.0, 0.2)
boom(NEC_OUT, 0.6)
whoosh(NEC_OUT + 8, D(NEC_OUT, NEC_OUT + 50), 900, 300, 0.12, -0.5, -0.3, peak=0.3)
whoosh(NEC_OUT + 8, D(NEC_OUT, NEC_OUT + 50), 900, 300, 0.12, 0.5, 0.3, peak=0.3)
whoosh(LUNGE - 10, 0.9, 300, 1200, 0.16, -0.4, 0.0, peak=0.6)
whoosh(LUNGE - 10, 0.9, 300, 1200, 0.16, 0.4, 0.0, peak=0.6)
boom(LUNGE + 4, 0.9)  # 扑上去
drone(LUNGE, FUSE, [(LUNGE, 0.0), (LUNGE + 10, 0.9), (FUSE - 10, 1.2), (FUSE, 0.0)], 0.08, 41)  # 缠斗
for at in (LUNGE + 50, LUNGE + 70, LUNGE + 92):  # 光被吸走
	whoosh(at, 1.1, 500, 1100, 0.07, -0.3, -0.5, peak=0.7)
	whoosh(at + 4, 1.1, 500, 1100, 0.07, 0.3, 0.5, peak=0.7)
swell_to(LUNGE + 60, FUSE, 0.3, 30, 800, 0.0, 0.1)
boom(FUSE, 0.85)  # 合体的白闪（黄昏之鬃 / 拂晓之翼的叫声在视频里）
# 阿罗拉的光被吸走，天上到处裂开究极之洞，它们逃走
swell(DARKEN, 3.6, 0.16, 25, 220, peak=0.3)
for at, x in ((DARKEN + 30, 300), (DARKEN + 36, 1180), (DARKEN + 44, 760), (DARKEN + 50, 1640), (DARKEN + 60, 520), (DARKEN + 66, 1420)):
	thunder(at, P(x), 0.55)
whoosh(DARKEN, D(DARKEN, DARKEN + 80), 1000, 300, 0.1, -0.8, -0.3, peak=0.5)  # 天上的光流进它的身体
whoosh(DARKEN, D(DARKEN, DARKEN + 80), 1000, 300, 0.1, 0.8, 0.3, peak=0.5)
drone(DARKEN, 4740, [(DARKEN, 0.0), (DARKEN + 40, 0.8), (4740, 0.8)], 0.07, 46)
whoosh(4660, D(4660, 4745), 250, 1200, 0.16, 0.0, 0.0, peak=0.85)  # 升起、钻进天上的洞
swell_to(4705, 4745, 0.16, 60, 900, 0.0, 0.3)

# ════════════════════════════════════════════════════════════════════════
# 第 8 段：究极空间跳跃骑行 → 塔顶的究极爆发与对撞（内部 4740–5560）
# ════════════════════════════════════════════════════════════════════════
wind(WARP - 6, 4895, [(WARP - 6, 0.0), (WARP + 20, 1.0), (4870, 1.1), (4895, 0.0)], 0.22, 150, 1300, 0.0, 0.6)  # 穿行的气流
drone(WARP, 4895, [(WARP, 0.0), (WARP + 20, 0.7), (4895, 0.7)], 0.06, 55)
for i, at in enumerate(range(WARP + 30, 4880, 24)):  # 隧道里的光环一圈圈掠过
	p = -0.7 if i % 2 == 0 else 0.7
	whoosh(at, 0.7, 300, 900, 0.08, p * 0.3, p, peak=0.5)
swell_to(4860, 4895, 0.14, 60, 900, 0.0, 0.3)
# 塔顶：光茧
air(4888, 5560, [(4888, 0.0), (4910, 0.5), (5560, 0.5)], 0.07)
drone(4895, ULTRA + 6, [(4895, 0.0), (4930, 0.6), (ULTRA, 1.2), (ULTRA + 6, 0.0)], 0.09, 43)
glow(4905, ULTRA + 6, [(4905, 0.0), (4960, 0.5), (ULTRA, 1.0), (ULTRA + 6, 0.0)], 0.06, 82)
swell_to(4905, ULTRA, 0.4, 30, 900, 0.0, 0.2)
boom(ULTRA, 1.25)  # 究极爆发（叫声在视频里）
glow(ULTRA, HIT + 10, [(ULTRA, 0.0), (ULTRA + 20, 1.0), (CLASH, 0.8), (HIT, 0.8), (HIT + 10, 0.0)], 0.06, 82)  # 光之龙本身的光
for i in range(9):  # 全身发射激光
	at = 5168 + i * 7
	whoosh(at, 0.8, 900, 400, 0.08, float(np.cos(i * 2.4)) * 0.7, float(np.cos(i * 2.4)) * 0.9, peak=0.15)
# 光子喷涌（金，左上）对上Ｚ力量（虹，右下）
swell_to(CLASH - 30, CLASH, 0.22, 40, 700, 0.0, 0.1)
boom(CLASH + 2, 1.05)
fire(CLASH, HIT + 4, [(CLASH, 0.0), (CLASH + 14, 1.0), (HIT - 8, 1.0), (HIT + 4, 0.0)], 0.22, -0.4)  # 光子喷涌的低吼
hum(CLASH + 8, HIT + 30, [(CLASH + 8, 0.0), (CLASH + 18, 0.8), (HIT, 1.0), (HIT + 30, 0.0)], 0.07, 49, 0.4)  # Ｚ力量
drone(CLASH, HIT, [(CLASH, 0.0), (CLASH + 20, 0.8), (HIT - 10, 1.2), (HIT, 0.0)], 0.08, 37)  # 对撞点的压力
for at, sz in ((CLASH + 16, 0.45), (CLASH + 70, 0.55), (CLASH + 120, 0.6)):  # 交汇点来回推挤（与镜头震动一致）
	boom(at, sz, 0.1)
swell_to(CLASH + 150, HIT, 0.4, 30, 900, 0.3, 0.1)  # Ｚ力量压过去
boom(HIT, 2.0)  # 命中：全片最响，但只有低沉的轰鸣
whoosh(HIT, 2.2, 1100, 200, 0.22, 0.0, 0.0, peak=0.1)  # 光碎成无数光点
swell_to(HIT + 24, 5520, 0.22, 60, 1200, 0.0, 0.3)  # 曝白转到黎明

# ════════════════════════════════════════════════════════════════════════
# 第 9 段：尾声（内部 5560–6520）
# ════════════════════════════════════════════════════════════════════════
glow(5513, 5665, [(5513, 0.0), (5550, 0.7), (5640, 0.5), (5665, 0.0)], 0.05, 110)  # 光回到阿罗拉（光点落下）
wind(5513, 5665, [(5513, 0.0), (5560, 0.6), (5665, 0.0)], 0.08, 120, 800)
air(CITY_DARK - 12, 5792, [(CITY_DARK - 12, 0.0), (CITY_DARK + 20, 0.6), (5792, 0.0)], 0.08)
drone(CITY_DARK - 12, 5792, [(CITY_DARK - 12, 0.0), (CITY_DARK + 20, 0.6), (5760, 0.6), (5792, 0.0)], 0.07, 44)  # 依然漆黑的究极大都会
hum(CITY_DARK - 12, 5792, [(CITY_DARK - 12, 0.0), (CITY_DARK + 20, 0.5), (5792, 0.0)], 0.04, 60)
# 拉纳基拉山的雪夜
wind(5760, 6520, [(5760, 0.0), (5800, 0.7), (6420, 0.7), (6520, 0.0)], 0.12, 150, 900, 0.0, 0.08)
air(5760, 6520, [(5760, 0.0), (5800, 0.6), (6450, 0.6), (6520, 0.0)], 0.08)
swell(5800, 3.4, 0.1, 40, 400, peak=0.6)  # 镜头从夜空降到雪坑
drone(5880, 6060, [(5880, 0.0), (5920, 0.5), (6040, 0.5), (6060, 0.2)], 0.05, 41)  # 它在发抖
glow(5932, 6040, [(5932, 0.0), (5970, 0.8), (6020, 0.8), (6040, 0.2)], 0.05, 123)  # Ｚ手环分给它的光
whoosh(6040, D(6040, 6140), 600, 250, 0.08, -0.4, -0.15, peak=0.6)  # 两团光落下
whoosh(6044, D(6044, 6144), 600, 250, 0.08, 0.4, 0.15, peak=0.6)
glow(6090, 6510, [(6090, 0.0), (6170, 0.7), (6420, 0.7), (6510, 0.0)], 0.06, 98)  # 光陪着它，一线彩虹


# ─── 混音输出 ────────────────────────────────────────────────────────
mix = np.stack([soft_lowpass(L), soft_lowpass(R)], axis=1)
mix = np.tanh(mix / (np.max(np.abs(mix)) * 0.85))
mix = mix / np.max(np.abs(mix)) * 10 ** (-3 / 20)

# 叫声在视频里：叫声响起时把音效压低约 8 dB（命中处的第二次叫声只压 3 dB，保住全片最大的爆发点）
CRIES = [T(REVEAL), T(SOL_PEAK), T(LUN_PEAK), T(DM_PEAK), T(DW_PEAK), T(ULTRA), T(HIT)]
duck_db = np.zeros(N)
tt = np.arange(N) / SR
for c in CRIES:
	shape = np.interp(tt, [c - 0.06, c, c + 1.6, c + 2.2], [0, 1, 1, 0], left=0, right=0)
	duck_db = np.maximum(duck_db, shape * (3.0 if c == T(HIT) else 8.0))
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


def cut(a_frames: int, b_frames: int) -> np.ndarray:
	return mix[int(a_frames / FPS * SR) : int(b_frames / FPS * SR)]


root = Path(__file__).resolve().parent.parent
outdir = root / 'out' / '夺走的光辉'
write_wav(outdir / 'necrozma-sfx.wav', mix)
frames_of = dict(SEGMENTS)
for name, frames in SEGMENTS:
	write_wav(outdir / 'sfx' / f'necrozma-{name}-sfx.wav', cut(OFFSET[name], OFFSET[name] + frames))
for part, segs in PARTS:
	write_wav(outdir / 'sfx' / f'necrozma-{part}-sfx.wav', cut(OFFSET[segs[0]], OFFSET[segs[-1]] + frames_of[segs[-1]]))
print(f'necrozma-sfx.wav: {TOTAL:.2f}s, peak -3 dBFS')
