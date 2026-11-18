"""
《神奥之名》（代码短名 hisui）音效轨（不是配乐：没有旋律，只有环境声与动作音效）。
全部用 numpy 程序合成，不使用外部素材。叫声在视频里，这里不含。

时间轴：整期一条总时间轴（30fps 帧号，src/scenes/hisui/common.ts 的 T），0 秒 = 第 1 段第一帧。
关键帧直接从 common.ts 读出来，场景代码里派生的时刻（落雷、王的狂暴与平静、石板、对抗……）照抄过来。

整体柔和、克制（CLAUDE.md 的音效要求）：
  天冠山顶、雪原是低频为主的风；海岸是缓慢的低频浪声（没有浪花的沙沙）；火塘、熔岩是低沉的燃烧声；
  雷只用远处闷雷；对撞、神殿倒塌只留低沉轰鸣，碎块落地是低沉的闷响（不是碎裂声）；城门开合是低沉的摩擦声；
  金光、石板、锁链、笛子的光用低中频的柔和嗡鸣（glow / ping），不用高频闪烁，笛子不做旋律；
  不用尖锐高频、碎裂声、雨幕沙沙、人群嘈杂；两个爆发点（双神对撞、阿尔宙斯光爆）比底噪响但不刺耳，阿尔宙斯最响。
所有音源最后再过一道 6 kHz 的柔和低通。叫声响起时音效压低 8 dB；双神第二次叫声和阿尔宙斯第二次叫声只压 3 dB。

输出（都在 out/神奥之名/ 下）：
  hisui-sfx.wav                       整期音效（48kHz 立体声 16 位，峰值 -3 dBFS）
  sfx/hisui-part1/2/3-sfx.wav         上篇（第 1–2 段）、中篇（第 3–5 段）、下篇（第 6–9 段）
  sfx/hisui-s1-pillar-sfx.wav …       按段切开，文件名与视频对应

用法：python sfx/hisui_sfx.py
"""
import re
import wave
from pathlib import Path
from types import SimpleNamespace

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
FPS = 30

# ─── 从 common.ts 读关键帧 ──────────────────────────────────────────
_src = (ROOT / 'src/scenes/hisui/common.ts').read_text(encoding='utf-8')
_blk = _src[_src.index('export const T = {') : _src.index('};', _src.index('export const T = {'))]
K = {m.group(1): int(m.group(2)) for m in re.finditer(r'^\t(\w+): (\d+),', _blk, re.M)}
T = SimpleNamespace(**K)

SEGMENTS = [
	('s1-pillar', T.open, T.end1),
	('s2-clans', T.end1, T.end2),
	('s3-rift', T.end2, T.end3),
	('s4-cosmos', T.end3, T.end4),
	('s5-gods', T.end4, T.end5),
	('s6-plates', T.end5, T.end6),
	('s7-volo', T.end6, T.end7),
	('s8-hall', T.end7, T.end8),
	('s9-name', T.end8, T.end9),
]
PARTS = [('part1', 0, 1), ('part2', 2, 4), ('part3', 5, 8)]
TOTAL_FRAMES = T.end9
TOTAL = TOTAL_FRAMES / FPS

# 场景代码里派生的时刻（与 Master / Rift / Plates / Volo / Hall 一致）
BEAMS = [T.beams + i * 9 for i in range(10)]  # 十道光柱（前五道在左排、后五道在右排）
RIFT_BOLTS = [T.bolt, T.bolt + 16, T.bolt + 27, T.bolt + 40, T.irida + 40, T.irida + 110, T.l31 + 175]
NOBLE_STRIKE = [T.frenzy + 6 + i * 16 for i in range(5)]
NOBLE_QUELL = [T.calm + 10 + i * 24 for i in range(5)]
LAKES = [T.lakes - 8 + i * 16 for i in range(3)]
STORM = [(T.zap + 30, 360), (T.zap + 58, 1560), (T.zap + 84, 1170), (T.celestica - 6, 820)]
DUEL = SimpleNamespace(charge=T.duel + 8, fire=T.duel + 62, clash=T.duel + 70, hit=T.duel + 116)
LAND_LEN = 36
LANDS = [T.journey + 14 + i * LAND_LEN for i in range(5)]  # 雪原、湿地、海岸、火山、冻土

N = int(TOTAL * SR)
L = np.zeros(N, dtype=np.float64)
R = np.zeros(N, dtype=np.float64)
rng = np.random.default_rng(20261025)


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



def sea(a, b, pts, gain=0.1, pan=0.0, period=7.0):
	"""海浪：低频为主，一阵阵缓慢涌上来再退下去（没有浪花的沙沙）"""
	s, n, t = span(a, b)
	tt = np.arange(n) / SR
	ph = rng.uniform(0, 6.28)
	surge = np.clip(np.sin(2 * np.pi * tt / period + ph), 0, None) ** 1.6 + 0.25
	for side in (-0.45, 0.45):
		sig = norm(band(brown(n), 30, 420)) * 0.8 + norm(band(noise(n), 120, 900)) * 0.25 * surge
		add(s, norm(sig) * surge * env(t, pts), gain * 0.7, float(np.clip(pan + side, -1, 1)))


# ════════════════════════════════════════════════════════════════════════
# 第 1 段 枪之柱：月夜的断柱 → 片名 → 星轨倒转、黄昏 → 古人、十道光、建殿 → 神阖的灯熄灭
# ════════════════════════════════════════════════════════════════════════
swell(T.open, 4.5, 0.08, 30, 300, peak=0.6)  # 从云海升上山顶
wind(T.open, T.down + 40, [(T.open, 0.0), (40, 0.8), (T.title, 0.65), (T.swap, 0.35), (T.down, 0.35), (T.down + 40, 0.0)], 0.18, 110, 1000, 0.0, 0.18)
air(T.open, T.end1, [(T.open, 0.0), (30, 0.6), (T.end1, 0.6)], 0.07)
glow(T.cyrus, T.l3, [(T.cyrus, 0.0), (T.cyrus + 30, 0.8), (T.l3 - 30, 0.8), (T.l3, 0.0)], 0.03, 87)  # 赤日剪影边的蓝、粉微光
swell_to(T.title - 10, T.title + 40, 0.12, 40, 500, 0.0, 1.6)  # 片名
glow(T.title, T.card + 80, [(T.title, 0.0), (T.title + 40, 0.7), (T.card + 40, 0.6), (T.card + 80, 0.0)], 0.04, 73)
swell(T.card, 2.6, 0.08, 40, 400, peak=0.35)  # 篇章卡
# 星轨倒转：时间倒流，一道慢慢转过去的低频呼啸
whoosh(T.card + 10, S(T.down - T.card), 160, 520, 0.07, -0.5, 0.5, peak=0.55)
drone(T.card, T.down + 30, [(T.card, 0.0), (T.card + 60, 0.6), (T.down, 0.5), (T.down + 30, 0.0)], 0.05, 41)
# 古代的黄昏：暖一点、轻一点的风
wind(T.down - 30, T.swap2 + 40, [(T.down - 30, 0.0), (T.down + 30, 0.5), (T.l11, 0.5), (T.end1, 0.6), (T.swap2, 0.5), (T.swap2 + 40, 0.0)], 0.12, 100, 800, 0.0, 0.14)
air(T.end1 - 20, T.clear + 40, [(T.end1 - 20, 0.0), (T.end1 + 20, 0.7), (T.clear, 0.7), (T.clear + 40, 0.0)], 0.08)  # 云海里
glow(T.l6, T.l9 + 20, [(T.l6, 0.0), (T.l6 + 50, 0.8), (T.beams, 1.1), (T.l8 + 40, 0.5), (T.l9 + 20, 0.0)], 0.05, 73)  # 天上的金光
for i, at in enumerate(BEAMS):  # 十道光柱落下
	pan = -0.4 if i < 5 else 0.4
	thud(at, 0.16, pan)
	ping(at + 1, 0.03, 98, pan)
swell_to(T.beams - 20, T.beams + 30, 0.08, 40, 500, 0.0, 1.0)
rumble(T.build, T.built, [(T.build, 0.0), (T.build + 20, 0.5), (T.built - 20, 0.5), (T.built, 0.0)], 0.08)  # 人和宝可梦建殿
for k in range(12):
	thud(T.build + 8 + k * 13, 0.1, float(np.sin(k * 1.9)) * 0.5)  # 一块块石头落定
swell(T.built - 10, 2.6, 0.08, 40, 500, peak=0.4)  # 完整的神殿
glow(T.l11 - 40, T.dark + 100, [(T.l11 - 40, 0.0), (T.l11 + 10, 0.5), (T.dark, 0.5), (T.dark + 100, 0.0)], 0.03, 82, -0.3)  # 神阖的灯
drone(T.dark - 20, T.swap2, [(T.dark - 20, 0.0), (T.dark + 40, 0.5), (T.end1, 0.5), (T.swap2, 0.0)], 0.05, 39)  # 灯一盏盏熄灭

# ════════════════════════════════════════════════════════════════════════
# 第 2 段 两个神：云海吞没镜头 → 海岸、部族靠岸 → 两队 → 口头禅 → 对峙 → 第三群人 → 祝庆村 → 夜里三处灯火
# ════════════════════════════════════════════════════════════════════════
swell_to(T.rise + 10, T.swap2, 0.1, 30, 400, 0.0, 1.0)  # 云海涨上来
whoosh(T.swap2 - 40, 3.2, 320, 140, 0.06, 0.0, 0.0, peak=0.4)  # 穿过云层
air(T.swap2, T.end2, [(T.swap2, 0.0), (T.clear, 0.6), (T.end2, 0.6)], 0.07)
sea(T.clear - 20, T.l15, [(T.clear - 20, 0.0), (T.clear + 30, 0.8), (T.l14, 0.6), (T.l15, 0.0)], 0.1)  # 晨光里的海
for k in range(4):
	thud(T.land + k * 8, 0.1, -0.2 + k * 0.1)  # 船靠岸
wind(T.l13, T.l20 + 20, [(T.l13, 0.0), (T.l14, 0.5), (T.l18, 0.5), (T.l19, 0.7), (T.l20 + 20, 0.0)], 0.12, 110, 900, 0.0, 0.15)  # 雪原
glow(T.l14 + 15, T.l15 + 45, [(T.l14 + 15, 0.0), (T.l14 + 50, 0.7), (T.l15 + 10, 0.7), (T.l15 + 45, 0.0)], 0.035, 98, -0.5)  # 金刚队：时间之环
glow(T.l15 + 15, T.l17 - 15, [(T.l15 + 15, 0.0), (T.l15 + 50, 0.7), (T.l17 - 50, 0.7), (T.l17 - 15, 0.0)], 0.035, 110, 0.5)  # 珍珠队：空间之格
ping(T.l17 + 30, 0.03, 98, -0.3)  # 口头禅
ping(T.l17 + 108, 0.03, 110, 0.3)  # "时"叠化成"地"
drone(T.l18 - 20, T.l19 + 60, [(T.l18 - 20, 0.0), (T.l18 + 30, 0.5), (T.l19, 0.5), (T.l19 + 60, 0.0)], 0.05, 41)  # 对峙
for at in (T.l18, T.l18 + 55, T.l18 + 110):  # 日夜轮换、一代传一代
	swell(at, 1.8, 0.05, 30, 260, peak=0.5)
glow(T.l19 - 30, T.l20, [(T.l19 - 30, 0.0), (T.l19 + 20, 0.7), (T.l19 + 70, 0.7), (T.l20, 0.0)], 0.04, 73)  # 山顶神殿的金光熄灭
sea(T.ships2 - 40, T.l23 + 40, [(T.ships2 - 40, 0.0), (T.ships2, 0.7), (T.l22, 0.8), (T.l23, 0.5), (T.l23 + 40, 0.0)], 0.1, 0.3)  # 第三群人的船
fire(T.l21 + 20, T.l23, [(T.l21 + 20, 0.0), (T.l21 + 70, 0.6), (T.l22 + 60, 0.6), (T.l23, 0.0)], 0.1, 0.4)  # 海那边的火光（马加木的故乡）
for k in range(8):
	thud(T.vbuild + 6 + k * 13, 0.12, 0.2 + float(np.sin(k * 2.3)) * 0.3)  # 祝庆村立起来
ping(T.l24 - 12, 0.04, 110)  # 门柱上的精灵球
wind(T.l24, T.end2 + 60, [(T.l24, 0.0), (T.l24 + 60, 0.5), (T.end2, 0.5), (T.end2 + 60, 0.0)], 0.1, 100, 800, 0.0, 0.15)  # 夜里三处灯火
glow(T.l23 + 60, T.end2 + 40, [(T.l23 + 60, 0.0), (T.l24 + 40, 0.5), (T.end2, 0.5), (T.end2 + 40, 0.0)], 0.03, 82)

# ════════════════════════════════════════════════════════════════════════
# 第 3 段 裂缝：篇章卡 → 天空裂开 → 坠落、海滩 → 跨越时空的地方 → 落雷、王狂暴 → 珠贝 → 王平静 → 红天 → 关门
# ════════════════════════════════════════════════════════════════════════
wind(T.end2, T.tear + 20, [(T.end2, 0.0), (T.end2 + 40, 0.5), (T.tear + 20, 0.4)], 0.12, 100, 800, 0.0, 0.15)
swell(T.card2, 2.6, 0.1, 40, 400, peak=0.35)  # 篇章卡「中篇 · 裂缝」
swell_to(T.tear - 30, T.tear + 15, 0.22, 25, 500, 0.0, 1.4)  # 裂缝撕开
rumble(T.tear, T.tear + 110, [(T.tear, 0.0), (T.tear + 10, 1.0), (T.tear + 80, 0.6), (T.tear + 110, 0.0)], 0.16)
drone(T.tear, T.end3, [(T.tear, 0.0), (T.tear + 40, 0.7), (T.fall, 0.5), (T.voidIn, 0.2), (T.voidOut, 0.5), (T.end3, 0.5)], 0.05, 41)  # 裂缝一直在
whoosh(T.fall, S(T.beach - T.fall) + 0.2, 520, 140, 0.11, 0.0, 0.0, peak=0.75)  # 从裂缝里掉下来
thud(T.beach, 0.4)  # 落在海滩上
sea(T.beach - 4, T.voidIn + 60, [(T.beach - 4, 0.0), (T.beach + 20, 0.7), (T.voidIn + 20, 0.6), (T.voidIn + 60, 0.0)], 0.09)  # 夜里的海滩
glow(T.voidIn, T.voidOut + 20, [(T.voidIn, 0.0), (T.voidIn + 60, 0.8), (T.l28, 1.0), (T.voidOut - 20, 0.8), (T.voidOut + 20, 0.0)], 0.05, 73)  # 跨越时空的地方
swell_to(T.voidIn, T.voidIn + 80, 0.08, 40, 500, 0.0, 1.6)
whoosh(T.voidOut - 30, 1.5, 600, 200, 0.06, 0.0, 0.0, peak=0.5)  # 光收成裂缝的光核
air(T.voidOut, T.end3, [(T.voidOut, 0.0), (T.voidOut + 30, 0.6), (T.end3, 0.6)], 0.07)
for i, at in enumerate(RIFT_BOLTS):  # 落雷（只用远处闷雷）
	thunder(at, [0.2, -0.1, 0.5, -0.3, 0.5, 0.3, 0.6][i], 0.8 if i < 4 else 0.45)
boom(T.bolt + 2, 0.35)
for i, at in enumerate(NOBLE_STRIKE):  # 王一只只被雷击中、狂暴起来
	thunder(at, P([300, 650, 960, 1315, 1665][i]), 0.4)
rumble(T.frenzy, T.irida, [(T.frenzy, 0.0), (T.frenzy + 30, 0.6), (T.irida - 20, 0.6), (T.irida, 0.0)], 0.12)
wind(T.irida - 10, T.calm + 20, [(T.irida - 10, 0.0), (T.irida + 20, 0.6), (T.calm, 0.6), (T.calm + 20, 0.0)], 0.12, 110, 900, 0.0, 0.15)  # 珍珠队营地
for i, at in enumerate(NOBLE_QUELL):  # 王一只只平静下来
	ping(at, 0.035, 82, P([300, 650, 960, 1315, 1665][i]))
swell(T.calm, 3.0, 0.05, 40, 400, peak=0.3)
swell_to(T.redsky - 20, T.redsky + 60, 0.16, 25, 500, 0.0, 1.4)  # 天空染成红色
rumble(T.redsky, T.cast, [(T.redsky, 0.0), (T.redsky + 40, 0.5), (T.cast, 0.4)], 0.08)
wind(T.redsky, T.end3 + 40, [(T.redsky, 0.0), (T.redsky + 60, 0.6), (T.end3, 0.6), (T.end3 + 40, 0.5)], 0.12, 100, 800, 0.0, 0.14)
grind(T.cast + 58, T.cast + 108, 0.16, 0.2)  # 西门关上
boom(T.cast + 108, 0.35, 0.2)

# ════════════════════════════════════════════════════════════════════════
# 第 4 段 宇与宙：门外的红天、望罗 → 雪林小屋、火塘 → 星轨与纵深 → 三座湖 → 红色锁链
# ════════════════════════════════════════════════════════════════════════
wind(T.end3 + 40, T.hut + 40, [(T.end3 + 40, 0.5), (T.hut, 0.6), (T.hut + 40, 0.0)], 0.12, 100, 800, 0.0, 0.14)
rumble(T.end3, T.hut, [(T.end3, 0.4), (T.hut, 0.0)], 0.08)
drone(T.end3, T.hut, [(T.end3, 0.5), (T.hut, 0.0)], 0.05, 41)
wind(T.hut - 10, T.inside + 20, [(T.hut - 10, 0.0), (T.hut + 20, 0.7), (T.inside, 0.7), (T.inside + 20, 0.0)], 0.12, 90, 700, 0.0, 0.12)  # 雪林
fire(T.inside - 10, T.l40 + 30, [(T.inside - 10, 0.0), (T.inside + 20, 0.8), (T.l40 - 10, 0.8), (T.l40 + 30, 0.0)], 0.14)  # 火塘
# 星空：宙（星轨绕天极）→ 宇（往星海深处飞）→ 交织 → 各看见一半
air(T.l40 - 20, T.lakes + 40, [(T.l40 - 20, 0.0), (T.l40 + 20, 0.5), (T.lakes + 40, 0.0)], 0.06)
drone(T.l40 - 10, T.lakes + 30, [(T.l40 - 10, 0.0), (T.zhou, 0.5), (T.l41, 0.7), (T.l42 + 60, 0.5), (T.lakes + 30, 0.0)], 0.05, 44)
whoosh(T.zhou, 3.0, 150, 380, 0.05, -0.7, 0.7, peak=0.6)  # 宙
whoosh(T.yu - 6, 3.2, 200, 650, 0.06, 0.0, 0.0, peak=0.7)  # 宇
swell_to(T.l41 - 10, T.l41 + 40, 0.08, 40, 500, 0.0, 1.2)  # 合成"宇宙"
glow(T.l42, T.l43, [(T.l42, 0.0), (T.l42 + 30, 0.6), (T.l43 - 20, 0.6), (T.l43, 0.0)], 0.03, 98, -0.6)  # 左：纵深
glow(T.l42, T.l43, [(T.l42, 0.0), (T.l42 + 30, 0.6), (T.l43 - 20, 0.6), (T.l43, 0.0)], 0.03, 87, 0.6)  # 右：星轨
# 三座湖
water(T.lakes - 10, T.ruins + 20, [(T.lakes - 10, 0.0), (T.lakes + 20, 0.7), (T.ruins, 0.7), (T.ruins + 20, 0.0)], 0.08)
wind(T.lakes - 10, T.ruins + 20, [(T.lakes - 10, 0.0), (T.lakes + 20, 0.4), (T.ruins + 20, 0.0)], 0.08, 90, 700, 0.0, 0.12)  # 湖边的风
for i, at in enumerate(LAKES):
	ping(at + 12, 0.04, [98, 110, 87][i], [-0.6, 0.0, 0.6][i])
# 云雾遗迹：三道光飞进来，合成红色锁链
air(T.ruins - 10, T.end4 + 40, [(T.ruins - 10, 0.0), (T.ruins + 30, 0.7), (T.end4, 0.6), (T.end4 + 40, 0.0)], 0.09)
for k, pan in enumerate((-0.6, 0.0, 0.6)):
	whoosh(T.ruins - 10 + k * 6, S(T.chain - T.ruins) + 0.3, 300, 600, 0.04, pan, 0.0, peak=0.8)
glow(T.chain - 10, T.end4 + 30, [(T.chain - 10, 0.0), (T.chain + 40, 1.0), (T.l45, 0.7), (T.end4, 0.6), (T.end4 + 30, 0.0)], 0.05, 65)
swell_to(T.chain, T.chain + 45, 0.12, 40, 500, 0.0, 1.4)
for k in range(9):
	thud(T.chain + 10 + k * 4, 0.05, -0.6 + k * 0.15)  # 一节节锁链扣上（低沉的轻响，不是金属声）

# ════════════════════════════════════════════════════════════════════════
# 第 5 段 神殿上的双神（第一个爆发点）
# ════════════════════════════════════════════════════════════════════════
air(T.end4, T.ball, [(T.end4, 0.0), (T.end4 + 40, 0.6), (T.ball, 0.5)], 0.07)
swell(T.end4, 3.0, 0.06, 30, 300, peak=0.5)  # 雾变成云海、推到山顶
wind(T.end4 + 20, T.ball, [(T.end4 + 20, 0.0), (T.l46, 0.7), (T.unbalance, 0.7), (T.burst, 0.9), (T.l57 + 60, 0.7), (T.ball, 0.0)], 0.16, 110, 1000, 0.0, 0.18)
drone(T.end4 + 20, T.close + 60, [(T.end4 + 20, 0.0), (T.l46, 0.5), (T.unbalance, 0.8), (T.burst + 60, 0.6), (T.ball, 0.4), (T.summit, 0.5), (T.close, 0.5), (T.close + 60, 0.0)], 0.06, 37)  # 头顶的裂缝
rumble(T.unbalance - 10, T.dialgaPeak + 20, [(T.unbalance - 10, 0.0), (T.unbalance + 30, 0.8), (T.dialga, 1.0), (T.dialgaPeak + 20, 0.0)], 0.16)  # 裂缝失去平衡
swell_to(T.unbalance, T.dialgaPeak, 0.2, 25, 600, 0.0, 0.8)
whoosh(T.dialga, 2.4, 160, 420, 0.06, 0.0, 0.0, peak=0.7)  # 帝牙卢卡降下来
glow(T.l52, T.chainBreak + 10, [(T.l52, 0.0), (T.l52 + 20, 0.8), (T.chainBreak, 1.0), (T.chainBreak + 10, 0.0)], 0.05, 65)  # 锁链缠上去
thud(T.chainBreak, 0.4)  # 锁链挣碎（只留低沉一声）
swell(T.chainBreak, 2.0, 0.08, 40, 500, peak=0.15)
whoosh(T.caught - 6, 1.2, 600, 180, 0.06, 0.0, 0.0, peak=0.4)  # 收进球里
thud(T.caught + 30, 0.2)
for k in range(6):  # 警告：一下一下的脉动
	thud(T.warn + 10 + k * 39, 0.12)
swell_to(T.warn, T.palkia, 0.14, 25, 400, 0.0, 0.1)
boom(T.palkia, 0.6)  # 另一只冲出裂缝
swell_to(T.palkia - 10, T.palkiaPeak, 0.16, 30, 600, 0.0, 1.2)
glow(T.l55 - 20, T.dialga2 + 25, [(T.l55 - 20, 0.0), (T.l55 + 25, 0.8), (T.dialga2 - 10, 0.8), (T.dialga2 + 25, 0.0)], 0.04, 73)  # 身后的金光
whoosh(T.dialga2 - 4, 1.1, 600, 200, 0.06, -0.3, -0.5, peak=0.3)  # 帝牙卢卡被放出来
# 冲撞
whoosh(T.ram - 14, S(T.impact - T.ram) + 0.5, 180, 520, 0.09, -0.8, 0.0, peak=0.75)
whoosh(T.ram - 14, S(T.impact - T.ram) + 0.5, 200, 560, 0.09, 0.8, 0.0, peak=0.75)
boom(T.impact, 1.0)
rumble(T.impact, T.impact + 90, [(T.impact, 0.0), (T.impact + 4, 1.0), (T.impact + 60, 0.6), (T.impact + 90, 0.0)], 0.16)  # 正面高处先塌一小块
for k in range(5):
	thud(T.impact + 20 + k * 9, 0.1, float(np.sin(k * 2.1)) * 0.4)
# 蓄力、光柱相撞：第一个爆发点
swell_to(T.beam, T.burst, 0.3, 25, 700, 0.0, 0.3)
drone(T.beam, T.burst + 20, [(T.beam, 0.0), (T.burst - 10, 1.0), (T.burst + 20, 0.0)], 0.07, 55)
boom(T.burst, 1.5)
rumble(T.burst, T.burst + 210, [(T.burst, 0.0), (T.burst + 6, 1.2), (T.burst + 120, 0.8), (T.burst + 210, 0.0)], 0.22)  # 神殿一点点倒塌
for k in range(16):  # 构件、石像碎块落地（低沉的闷响）
	thud(T.burst + 24 + k * 9 + (k * 5) % 7, 0.14, float(np.sin(k * 1.7)) * 0.6)
# 撤下山 → 起源球 → 回山顶
fire(T.ball - 10, T.summit + 10, [(T.ball - 10, 0.0), (T.ball + 20, 0.5), (T.summit - 10, 0.5), (T.summit + 10, 0.0)], 0.08, -0.5)  # 工作台边的炉火
glow(T.l58 + 20, T.summit, [(T.l58 + 20, 0.0), (T.l58 + 70, 0.8), (T.summit - 20, 0.5), (T.summit, 0.0)], 0.04, 92)
ping(T.l58 + 76, 0.05, 98)  # 起源球合成
wind(T.summit - 20, T.dex + 20, [(T.summit - 20, 0.0), (T.summit + 20, 0.7), (T.dex, 0.6), (T.dex + 20, 0.0)], 0.14, 110, 1000, 0.0, 0.18)
ping(T.l59 + 34, 0.05, 110, 0.2)  # 粉光落进手里
whoosh(T.close - 10, 2.2, 500, 140, 0.07, 0.0, 0.0, peak=0.3)  # 裂缝合上
thud(T.close + 45, 0.3)
whoosh(T.dex - 6, 1.0, 420, 260, 0.04, 0.0, 0.0, peak=0.4)  # 图鉴翻开
air(T.dex - 20, T.cogita + 30, [(T.dex - 20, 0.0), (T.dex + 10, 0.7), (T.cogita, 0.7), (T.cogita + 30, 0.0)], 0.08)
drone(T.dex, T.cogita + 30, [(T.dex, 0.0), (T.dex + 40, 0.4), (T.cogita, 0.4), (T.cogita + 30, 0.0)], 0.04, 44)
glow(T.l60 + 40, T.cogita + 20, [(T.l60 + 40, 0.0), (T.l60 + 100, 0.6), (T.l60 + 150, 0.9), (T.cogita + 20, 0.0)], 0.04, 98)  # 蓝粉两道光在中缝叠成白光
wind(T.cogita - 10, T.end5 + 60, [(T.cogita - 10, 0.0), (T.cogita + 30, 0.5), (T.end5, 0.5), (T.end5 + 60, 0.0)], 0.1, 90, 700, 0.0, 0.12)  # 夜里的雪林
glow(T.l61 + 90, T.end5 + 60, [(T.l61 + 90, 0.0), (T.l61 + 150, 0.8), (T.end5, 0.9), (T.end5 + 60, 0.6)], 0.04, 73)  # 金光

# ════════════════════════════════════════════════════════════════════════
# 第 6 段 石板与雕像
# ════════════════════════════════════════════════════════════════════════
swell(T.card3 - 10, 2.6, 0.1, 40, 400, peak=0.35)  # 篇章卡「下篇 · 枪之柱」
air(T.end5, T.celestica, [(T.end5, 0.0), (T.end5 + 40, 0.5), (T.celestica, 0.5)], 0.06)
glow(T.end5 + 60, T.fist + 30, [(T.end5 + 60, 0.6), (T.ring, 0.8), (T.l65 + 10, 1.2), (T.fist, 0.7), (T.fist + 30, 0.0)], 0.04, 73)
for i in range(18):  # 十八块石板从夜空深处飞来
	at = T.plates + (i * 7) % (18 * 7) * 0.9 + float(rng.uniform(0, 20))
	whoosh(at, 1.3, 220, 520, 0.022, float(np.sin(i * 2.4)) * 0.8, float(np.sin(i * 2.4)) * 0.3, peak=0.8)
swell_to(T.ring - 20, T.ring + 20, 0.07, 40, 500, 0.0, 1.0)  # 围成一圈
swell_to(T.l65 - 10, T.l65 + 12, 0.12, 40, 600, 0.0, 1.6)  # 石板的主人
whoosh(T.fist - 4, 1.2, 250, 480, 0.05, 0.0, 0.0, peak=0.5)  # 拳头石板推到眼前
glow(T.l66, T.zap, [(T.l66, 0.0), (T.l66 + 30, 0.6), (T.zap, 0.4)], 0.03, 65)  # 铭文一个个亮起
hum(T.zap, T.celestica + 4, [(T.zap, 0.0), (T.zap + 14, 0.6), (T.celestica, 0.6), (T.celestica + 4, 0.0)], 0.03, 55, 0.0, flick=0.4)  # 雷电石板
for at, x in STORM:
	thunder(at, P(x), 0.7)
# 神阖寺院遗址（黄昏）
wind(T.celestica - 4, T.end6 + 40, [(T.celestica - 4, 0.0), (T.celestica + 20, 0.6), (T.end6, 0.6), (T.end6 + 40, 0.5)], 0.12, 100, 800, 0.0, 0.14)
air(T.celestica, T.end6, [(T.celestica, 0.0), (T.celestica + 20, 0.6), (T.end6, 0.6)], 0.07)
drone(T.l69 + 30, T.l70 + 100, [(T.l69 + 30, 0.0), (T.l69 + 110, 0.7), (T.l70 + 40, 0.7), (T.l70 + 100, 0.0)], 0.06, 35)  # 碎像周围暗下去
glow(T.l70, T.l71 + 60, [(T.l70, 0.0), (T.l70 + 60, 0.6), (T.l71 + 60, 0.2)], 0.03, 73)  # 天上的金光

# ════════════════════════════════════════════════════════════════════════
# 第 7 段 望罗
# ════════════════════════════════════════════════════════════════════════
wind(T.end6, T.memory + 20, [(T.end6, 0.5), (T.l73, 0.7), (T.memory, 0.6), (T.memory + 20, 0.0)], 0.13, 100, 900, 0.0, 0.16)
air(T.end6, T.memory + 20, [(T.end6, 0.6), (T.memory + 20, 0.0)], 0.07)
swell(T.l73 + 20, 3.0, 0.05, 40, 400, peak=0.6)  # 沿断柱仰上去
whoosh(T.coat, 2.5, 380, 820, 0.06, 0.0, 0.8, peak=0.3)  # 外衣被风卷走
# 回忆一：骑拉帝纳撕开裂缝、双神发狂（红色旧胶片）
drone(T.memory - 10, T.l76 + 20, [(T.memory - 10, 0.0), (T.memory + 20, 0.7), (T.l76, 0.7), (T.l76 + 20, 0.0)], 0.07, 35)
swell_to(T.l75, T.l75 + 70, 0.14, 25, 500, 0.0, 0.8)
rumble(T.l75 + 70, T.l76 + 10, [(T.l75 + 70, 0.0), (T.l75 + 80, 0.9), (T.l76, 0.8), (T.l76 + 10, 0.0)], 0.14)
thunder(T.l75 + 75, -0.6, 0.6)
thunder(T.l75 + 92, 0.6, 0.6)
# 回忆二：金光被暗流缠住往下拽 → 洗翠化成光点散去 → 白场
glow(T.l76 - 10, T.l78, [(T.l76 - 10, 0.0), (T.l76 + 40, 0.8), (T.l77, 0.6), (T.l78, 0.0)], 0.04, 73)
rumble(T.l76 + 10, T.l77 + 40, [(T.l76 + 10, 0.0), (T.l76 + 60, 0.7), (T.l77, 0.8), (T.l77 + 40, 0.0)], 0.12)
swell_to(T.l76 + 10, T.l76 + 80, 0.1, 25, 300, 0.0, 1.0)
whoosh(T.l77 + 20, S(T.l78 - T.l77), 200, 700, 0.06, 0.0, 0.0, peak=0.75)  # 化成光点往上散
swell_to(T.l77 + 90, T.l78 - 5, 0.08, 60, 800, 0.0, 0.8)  # 白场
# 回忆三：古代神奥人朝金光跪拜
glow(T.l78, T.back7 + 10, [(T.l78, 0.0), (T.l78 + 30, 0.7), (T.back7, 0.6), (T.back7 + 10, 0.0)], 0.04, 82)
wind(T.l78, T.back7 + 10, [(T.l78, 0.0), (T.l78 + 40, 0.4), (T.back7 + 10, 0.0)], 0.08, 100, 700, 0.0, 0.12)
# 回到废墟，天暗下去 → 世界背面的裂口
wind(T.back7 - 10, T.l83 + 20, [(T.back7 - 10, 0.0), (T.back7 + 30, 0.6), (T.revTear, 0.7), (T.l82 + 60, 0.7), (T.l83 + 20, 0.5)], 0.13, 100, 900, 0.0, 0.16)
air(T.back7 - 10, T.end7, [(T.back7 - 10, 0.0), (T.back7 + 30, 0.6), (T.end7, 0.6)], 0.07)
drone(T.revTear - 20, T.l82 + 80, [(T.revTear - 20, 0.0), (T.gira, 0.8), (T.duel, 0.8), (T.l82 + 40, 0.6), (T.l82 + 80, 0.0)], 0.07, 33)
swell_to(T.revTear, T.gira + 10, 0.16, 25, 500, 0.0, 0.6)
rumble(T.revTear, T.gira + 60, [(T.revTear, 0.0), (T.revTear + 20, 0.8), (T.gira + 60, 0.0)], 0.14)
whoosh(T.gira, 2.0, 140, 380, 0.07, 0.0, 0.0, peak=0.6)  # 骑拉帝纳钻出来
swell_to(T.origin - 42, T.origin, 0.2, 30, 600, 0.0, 1.0)  # 全身发光
boom(T.origin, 0.6)  # 换成起源形态
# 没有天地之分的世界：往上流的瀑布（低频的水声）
water(T.void7 - 8, T.duel + 6, [(T.void7 - 8, 0.0), (T.void7 + 20, 0.7), (T.duel - 10, 0.7), (T.duel + 6, 0.0)], 0.08)
whoosh(T.void7, S(T.duel - T.void7), 120, 300, 0.05, 0.0, 0.0, peak=0.5)
# 对抗
swell_to(DUEL.charge, DUEL.fire, 0.16, 25, 400, 0.0, 0.2)  # 骑拉帝纳蓄力
whoosh(DUEL.fire - 2, 0.6, 180, 560, 0.08, 0.0, -0.2, peak=0.6)  # 暗红的光射出
boom(DUEL.clash, 0.6, -0.2)  # 撞上蓝白的光
rumble(DUEL.clash, DUEL.hit + 10, [(DUEL.clash, 0.0), (DUEL.clash + 4, 1.0), (DUEL.hit - 10, 1.0), (DUEL.hit + 10, 0.0)], 0.16)
glow(DUEL.clash - 4, DUEL.hit + 30, [(DUEL.clash - 4, 0.0), (DUEL.clash + 10, 0.8), (DUEL.hit, 1.0), (DUEL.hit + 30, 0.0)], 0.04, 98, -0.2)  # 蓝白的光
swell_to(DUEL.clash + 10, DUEL.hit, 0.14, 30, 600, 0.0, 0.2)  # 一点点推回去
boom(DUEL.hit, 1.0)  # 打中骑拉帝纳
whoosh(T.l82 + 5, 2.0, 400, 120, 0.07, 0.0, 0.0, peak=0.3)  # 缩回裂口
thud(T.l82 + 70, 0.3)  # 裂口合上
glow(T.flute, T.end7 + 40, [(T.flute, 0.0), (T.flute + 30, 0.8), (T.end7, 0.6), (T.end7 + 40, 0.5)], 0.04, 98, 0.2)  # 天界之笛亮起
ping(T.flute + 20, 0.05, 110, 0.2)
wind(T.l86 - 20, T.end7 + 40, [(T.l86 - 20, 0.0), (T.l86 + 40, 0.6), (T.end7, 0.8), (T.end7 + 40, 0.6)], 0.14, 110, 1000, -0.3, 0.18)  # 望罗走进风雪

# ════════════════════════════════════════════════════════════════════════
# 第 8 段 起始之殿（全片最大爆发点）
# ════════════════════════════════════════════════════════════════════════
air(T.end7, T.journey + 20, [(T.end7, 0.6), (T.journey + 20, 0.0)], 0.07)
wind(T.end7 + 40, T.journey + 20, [(T.end7 + 40, 0.6), (T.journey + 20, 0.0)], 0.12, 110, 900, 0.0, 0.16)
for k in range(3):  # 第一次吹笛：蓝白的光环（没有旋律）
	ping(T.play1 + k * 30, 0.04, 110, 0.2)
glow(T.play1, T.journey, [(T.play1, 0.0), (T.play1 + 20, 0.8), (T.play1 + 90, 0.4), (T.journey, 0.0)], 0.04, 98, 0.2)
# 走遍洗翠：雪原、湿地、海岸、火山、冻土
wind(LANDS[0] - 8, LANDS[1] + 8, [(LANDS[0] - 8, 0.0), (LANDS[0] + 4, 0.6), (LANDS[1], 0.6), (LANDS[1] + 8, 0.0)], 0.1, 110, 900)
water(LANDS[1] - 8, LANDS[2] + 8, [(LANDS[1] - 8, 0.0), (LANDS[1] + 4, 0.7), (LANDS[2], 0.7), (LANDS[2] + 8, 0.0)], 0.07)
sea(LANDS[2] - 8, LANDS[3] + 8, [(LANDS[2] - 8, 0.0), (LANDS[2] + 4, 0.8), (LANDS[3], 0.8), (LANDS[3] + 8, 0.0)], 0.1, 0.0, 2.4)
fire(LANDS[3] - 8, LANDS[4] + 8, [(LANDS[3] - 8, 0.0), (LANDS[3] + 4, 0.6), (LANDS[4], 0.6), (LANDS[4] + 8, 0.0)], 0.1)
wind(LANDS[4] - 8, T.stairs + 10, [(LANDS[4] - 8, 0.0), (LANDS[4] + 4, 0.7), (T.stairs, 0.6), (T.stairs + 10, 0.0)], 0.12, 90, 800)
# 黎明前的废墟：笛声再响，光阶升起
wind(T.stairs - 12, T.climb + 40, [(T.stairs - 12, 0.0), (T.stairs + 20, 0.6), (T.climb + 40, 0.0)], 0.1, 110, 900, 0.0, 0.16)
for k in range(4):
	ping(T.play2 + k * 30, 0.04, 110, 0.2)
swell_to(T.play2 + 20, T.climb + 40, 0.12, 40, 600, 0.0, 1.0)
glow(T.play2, T.arceus, [(T.play2, 0.0), (T.play2 + 40, 0.6), (T.climb, 0.8), (T.arceus, 0.6)], 0.04, 92)  # 光阶
# 沿阶梯慢慢升上去、穿过云海；出云后只有风和平台上的金光，静一拍
whoosh(T.climb, S(T.climb + 125 - T.climb), 180, 520, 0.07, 0.0, 0.0, peak=0.55)
air(T.climb + 60, T.end8, [(T.climb + 60, 0.0), (T.climb + 120, 0.5), (T.end8, 0.5)], 0.07)
glow(T.arceus - 80, T.burst8, [(T.arceus - 80, 0.0), (T.arceus - 35, 0.6), (T.arceusPeak, 0.9), (T.burst8, 1.2)], 0.05, 73)  # 金光
drone(T.arceus - 40, T.burst8 + 10, [(T.arceus - 40, 0.0), (T.arceusPeak, 0.7), (T.burst8 - 10, 1.0), (T.burst8 + 10, 0.0)], 0.07, 37)
swell_to(T.arceus, T.arceusPeak, 0.18, 30, 600, 0.0, 1.0)  # 显色
# 全片最大爆发点：金白光爆（第二次叫声在视频里）
swell_to(T.burst8 - 45, T.burst8, 0.34, 25, 700, 0.0, 0.3)
boom(T.burst8, 1.9)
rumble(T.burst8, T.burst8 + 150, [(T.burst8, 0.0), (T.burst8 + 6, 1.0), (T.burst8 + 70, 0.5), (T.burst8 + 150, 0.0)], 0.14)
glow(T.burst8, T.end8 + 40, [(T.burst8, 1.4), (T.burst8 + 80, 1.0), (T.l94, 0.8), (T.end8, 0.9), (T.end8 + 40, 1.0)], 0.05, 73)
swell(T.gift, 2.4, 0.07, 40, 500, peak=0.6)  # 分身落进那个人手里
ping(T.gift + 45, 0.05, 82)
wind(T.l94 - 20, T.end8, [(T.l94 - 20, 0.0), (T.l94 + 40, 0.5), (T.end8, 0.4)], 0.1, 100, 800, 0.0, 0.14)  # 拉开：云上的风

# ════════════════════════════════════════════════════════════════════════
# 第 9 段 神奥之名（结尾）
# ════════════════════════════════════════════════════════════════════════
glow(T.end8 + 40, T.l95 + 40, [(T.end8 + 40, 1.0), (T.prelude, 0.8), (T.l95 + 40, 0.0)], 0.05, 73)  # 金光退去
sea(T.prelude - 10, T.night9 + 45, [(T.prelude - 10, 0.0), (T.prelude + 30, 0.8), (T.night9, 0.7), (T.night9 + 45, 0.0)], 0.1)  # 起始海滩的早晨
air(T.prelude, T.night9 + 45, [(T.prelude, 0.0), (T.prelude + 30, 0.5), (T.night9 + 45, 0.0)], 0.06)
glow(T.l96 + 40, T.l98 + 40, [(T.l96 + 40, 0.0), (T.l96 + 90, 0.5), (T.l98 + 40, 0.0)], 0.03, 73)  # 山顶的一点金光
swell_to(T.l97 + 10, T.l97 + 60, 0.1, 40, 500, 0.0, 1.4)  # "洗翠"化成"神奥"
glow(T.l97, T.l98 + 100, [(T.l97, 0.0), (T.l97 + 30, 0.6), (T.l98 + 60, 0.6), (T.l98 + 100, 0.0)], 0.035, 82)
glow(T.l98, T.l98 + 110, [(T.l98, 0.0), (T.l98 + 60, 0.6), (T.l98 + 110, 0.0)], 0.03, 98, -0.4)  # 蓝光
glow(T.l98, T.l98 + 110, [(T.l98, 0.0), (T.l98 + 60, 0.6), (T.l98 + 110, 0.0)], 0.03, 110, 0.4)  # 珍珠白光
glow(T.l98 + 70, T.night9 + 30, [(T.l98 + 70, 0.0), (T.l98 + 110, 0.8), (T.night9, 0.8), (T.night9 + 30, 0.0)], 0.04, 87)  # 合成一道白光
# 回到开场的月夜断柱
wind(T.night9, T.end9, [(T.night9, 0.0), (T.night9 + 45, 0.8), (T.l102, 0.7), (T.fade9, 0.5), (T.end9, 0.0)], 0.18, 110, 1000, 0.0, 0.18)
air(T.night9, T.end9, [(T.night9, 0.0), (T.night9 + 45, 0.6), (T.fade9, 0.5), (T.end9, 0.0)], 0.07)
glow(T.cyrus9, T.l101, [(T.cyrus9, 0.0), (T.cyrus9 + 30, 0.8), (T.l101 - 40, 0.8), (T.l101, 0.0)], 0.03, 87)  # 赤日剪影边的微光
glow(T.l101, T.end9, [(T.l101, 0.0), (T.l101 + 50, 0.9), (T.fade9, 0.9), (T.end9, 0.0)], 0.05, 73)  # 天顶的金光
swell(T.l101, 4.0, 0.07, 30, 400, peak=0.5)


# ─── 混音输出 ────────────────────────────────────────────────────────
mix = np.stack([soft_lowpass(L), soft_lowpass(R)], axis=1)
mix = np.tanh(mix / (np.max(np.abs(mix)) * 0.85))
mix = mix / np.max(np.abs(mix)) * 10 ** (-3 / 20)

# 叫声在视频里：叫声响起时把音效压低约 8 dB；双神第二次叫声、阿尔宙斯第二次叫声只压 3 dB，保住两个爆发点
LIGHT = [S(T.burst - 16), S(T.burst - 10), S(T.burst8)]
CRIES = [S(x) for x in (T.dialgaPeak, T.palkiaPeak, T.giraPeak, T.originPeak, T.arceusPeak)] + LIGHT
duck_db = np.zeros(N)
tt = np.arange(N) / SR
for c in CRIES:
	shape = np.interp(tt, [c - 0.06, c, c + 1.6, c + 2.2], [0, 1, 1, 0], left=0, right=0)
	duck_db = np.maximum(duck_db, shape * (3.0 if c in LIGHT else 8.0))
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


outdir = ROOT / 'out' / '神奥之名'
write_wav(outdir / 'hisui-sfx.wav', mix)
for name, a, b in SEGMENTS:
	write_wav(outdir / 'sfx' / f'hisui-{name}-sfx.wav', cut(a, b))
for part, i0, i1 in PARTS:
	write_wav(outdir / 'sfx' / f'hisui-{part}-sfx.wav', cut(SEGMENTS[i0][1], SEGMENTS[i1][2]))
print(f'hisui-sfx.wav: {TOTAL:.2f}s ({TOTAL_FRAMES} frames), peak -3 dBFS')
for name, a, b in SEGMENTS:
	print(f'  {name}: {(b - a) / FPS:.2f}s')
