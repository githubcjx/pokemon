"""
《真实与理想》（代码短名 dragons）音效轨（不是配乐：没有旋律，只有环境声与动作音效）。
全部用 numpy 程序合成，不使用外部素材。时间轴与八段首尾相接后的整期一致（0 秒 = 第 1 段第一帧），
音效节点直接取自 src/scenes/dragons/*.tsx 里的帧号。叫声在视频里，这里不含。

用户要求"不要吵的音效"：整体柔和、克制——
  雷只用远处的闷雷（低通，没有近处炸裂声）；撞击只留低沉的轰鸣（没有高频炸裂、碎石）；
  不用雨幕沙沙声、尖锐的高频闪烁、人群嘈杂；风、火都是低频为主的柔和底噪。
所有音源最后再过一道 6 kHz 的柔和低通，去掉刺耳的高频。

输出（都在 out/真实与理想/ 下）：
  dragons-sfx.wav                  整期音效（48kHz 立体声 16 位，峰值 -3 dBFS）
  sfx/dragons-part1/2/3-sfx.wav    与三个视频文件对应（第 1–3 段、第 4–5 段、第 6–8 段）
  sfx/dragons-s1…s8-sfx.wav        按段切开

用法：python sfx/dragons_sfx.py
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
FPS = 30  # 时间轴按 30fps 帧号编写，与场景代码一致

# 各段时长（30fps 帧数），与 src/scenes/dragons/continuity.ts 一致
SEGMENTS = [
	('s1', 380),  # 三只龙 + 本期标题 HookScene
	('s2', 330),  # 建国 FoundingScene
	('s3', 880),  # 分裂 SplitScene
	('s4', 730),  # 双龙之战 WarScene
	('s5', 800),  # 空壳 HuskScene
	('s6', 1230),  # 英雄再现 RevivalScene
	('s7', 1790),  # 合体 FusionScene（2026-10-04 加长：驱逐舰、冰封双龙市、传家宝、魁奇思的结局）
	('s8', 590),  # 尾声 CodaScene（开头加了酋雷姆消失、镜头升起的过渡；结尾不放标题）
]
PARTS = [('part1', ['s1', 's2', 's3']), ('part2', ['s4', 's5']), ('part3', ['s6', 's7', 's8'])]
OFFSET = {}
_acc = 0.0
for _name, _frames in SEGMENTS:
	OFFSET[_name] = _acc
	_acc += _frames / FPS
TOTAL = _acc

N = int(TOTAL * SR)
L = np.zeros(N, dtype=np.float64)
R = np.zeros(N, dtype=np.float64)
rng = np.random.default_rng(20261004)


def t_of(seg: str, frame: float) -> float:
	"""段内 30fps 帧号 → 整期秒数"""
	return OFFSET[seg] + frame / FPS


# ─── 基础工具 ────────────────────────────────────────────────────────
def noise(n: int) -> np.ndarray:
	return rng.standard_normal(n)


def spectral(x: np.ndarray, mag) -> np.ndarray:
	X = np.fft.rfft(x)
	f = np.fft.rfftfreq(len(x), 1 / SR)
	return np.fft.irfft(X * mag(f), n=len(x))


def band(x: np.ndarray, lo: float, hi: float, soft: float = 0.35) -> np.ndarray:
	"""柔和边缘的带通（按对数频率平滑过渡）"""

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
	xs, ys = zip(*pts)
	return np.interp(t, xs, ys)


def wobble(n: int, rate: float = 0.3, depth: float = 0.4) -> np.ndarray:
	t = np.arange(n) / SR
	w = sum(np.sin(2 * np.pi * rate * k * t + rng.uniform(0, 6.28)) / k for k in (1, 1.7, 2.9))
	return 1 + depth * w / 1.9


def add(start: float, sig: np.ndarray, gain: float = 1.0, pan=0.0) -> None:
	"""在整期时间轴的 start 秒处叠加单声道信号；pan 为 -1（左）…1（右），可为数组（等长）"""
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


def span(start: float, end: float):
	n = int((end - start) * SR)
	return n, start + np.arange(n) / SR


# ─── 柔和的音效 ──────────────────────────────────────────────────────
def air(start: float, end: float, envpts, gain: float = 0.1, pan: float = 0.0) -> None:
	"""空气声：极轻的低频底噪，让画面不至于死寂"""
	n, t = span(start, end)
	sig = norm(band(brown(n), 30, 500)) * wobble(n, 0.12, 0.3) * env(t, envpts)
	add(start, sig, gain, pan)


def wind(start: float, end: float, envpts, gain: float = 0.2, lo: float = 120, hi: float = 1100, pan=0.0, rate: float = 0.2) -> None:
	"""风：低频为主，缓慢起伏（左右各一条，略有差异，显得开阔）"""
	n, t = span(start, end)
	e = env(t, envpts)
	for side in (-0.5, 0.5):
		sig = norm(band(noise(n), lo, hi)) * np.clip(wobble(n, rate, 0.6), 0.15, None) * e
		add(start, sig, gain * 0.7, float(np.clip(pan + side, -1, 1)) if not isinstance(pan, np.ndarray) else pan)


def fire(start: float, end: float, envpts, gain: float = 0.3, pan=0.0) -> None:
	"""火：低沉的燃烧声（没有噼啪爆裂）"""
	n, t = span(start, end)
	roar = norm(band(brown(n), 35, 420)) * wobble(n, 0.5, 0.45)
	body = norm(band(noise(n), 200, 1300)) * np.clip(wobble(n, 1.6, 0.7), 0.2, None) * 0.25
	add(start, (roar + body) * env(t, envpts), gain, pan)


def thunder(start: float, pan: float = 0.0, size: float = 1.0) -> None:
	"""远处的闷雷：只有低频的滚动，慢起慢落"""
	n = int((3.5 + 1.5 * size) * SR)
	t = np.arange(n) / SR
	roll = band(noise(n), 25, 260)
	am = np.clip(wobble(n, 1.6, 0.7), 0.15, None)
	sig = norm(roll * am) * np.minimum(t / 0.18, 1) * np.exp(-t / (1.3 + 0.7 * size))
	add(start, sig, 0.32 * size, pan)


def boom(start: float, size: float = 1.0, pan: float = 0.0) -> None:
	"""低沉的轰鸣（撞击 / 爆发）：低频扫频 + 低频拖尾，起音略缓，不刺耳"""
	dur = 2.5 + 2.5 * size
	n = int(dur * SR)
	t = np.arange(n) / SR
	f = 62 * np.exp(-t * 1.5) + 30
	tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(n, 0.7 + 0.8 * size, 0.012)
	body = band(noise(n), 30, 260) * decay(n, 0.35 + 0.3 * size, 0.02)
	tail = band(brown(n), 20, 180) * np.minimum(t / 0.1, 1) * np.exp(-t / (1.0 + 1.4 * size))
	sig = norm(tone) + norm(body) * 0.55 + norm(tail) * 0.55 * size
	add(start, sig, 0.6 * size ** 0.9, pan)  # 音量随事件大小拉开：对撞（1.6）明显最响


def whoosh(start: float, dur: float, f0: float, f1: float, gain: float = 0.3, pan0: float = 0.0, pan1: float = 0.0, peak: float = 0.6) -> None:
	"""柔和的呼啸：中心频率从 f0 移到 f1（最高压在 2.5 kHz 以内），钟形包络"""
	n = int(dur * SR)
	t = np.arange(n) / SR / dur
	src = noise(n)
	fc = np.minimum(f0 * (f1 / f0) ** t, 2500)
	# 分块带通，近似随时间移动的滤波
	out = np.zeros(n)
	blk = int(0.05 * SR)
	win = np.hanning(blk * 2)
	for i in range(0, n, blk):
		a = max(0, i - blk // 2)
		b = min(n, a + blk * 2)
		c = fc[min(i, n - 1)]
		seg = band(src[a:b], c * 0.55, c * 1.6)
		out[a:b] += seg * win[: b - a]
	shape = np.where(t < peak, np.sin(np.pi / 2 * t / peak) ** 2, np.cos(np.pi / 2 * (t - peak) / (1 - peak)) ** 2)
	pan = pan0 + (pan1 - pan0) * t
	add(start, norm(out) * shape, gain, pan)


def swell(start: float, dur: float, gain: float = 0.3, lo: float = 40, hi: float = 700, pan: float = 0.0, peak: float = 0.8) -> None:
	"""低频的涌起（蓄力、显色前）：慢慢变响，到 peak 处最响后回落"""
	n = int(dur * SR)
	t = np.arange(n) / SR / dur
	sig = norm(band(brown(n), lo, hi)) * wobble(n, 0.8, 0.2)
	shape = np.where(t < peak, (t / peak) ** 2, np.cos(np.pi / 2 * (t - peak) / (1 - peak)) ** 2)
	add(start, sig * shape, gain, pan)


def drone(start: float, end: float, envpts, gain: float = 0.15, f: float = 48.0, pan: float = 0.0) -> None:
	"""低沉的持续音（单一低音、缓慢拍频，不成旋律）：空洞的嗡鸣、不安的气氛"""
	n, t = span(start, end)
	tt = np.arange(n) / SR
	tone = np.sin(2 * np.pi * f * tt) + 0.7 * np.sin(2 * np.pi * f * 1.006 * tt + 1.0) + 0.25 * np.sin(2 * np.pi * f * 2.003 * tt)
	hum = norm(band(noise(n), f * 1.5, f * 6)) * 0.3
	add(start, (norm(tone) + hum) * wobble(n, 0.15, 0.25) * env(t, envpts), gain, pan)


def electric(start: float, end: float, envpts, gain: float = 0.12, pan: float = 0.6) -> None:
	"""电流的低嗡（捷克罗姆的雷）：低频锯齿经过低通，轻微抖动"""
	n, t = span(start, end)
	tt = np.arange(n) / SR
	saw = sum(np.sin(2 * np.pi * 55 * k * tt) / k for k in range(1, 9))
	sig = band(saw, 40, 700) * np.clip(wobble(n, 7.0, 0.35), 0.3, None)
	add(start, norm(sig) * env(t, envpts), gain, pan)


def cave(start: float, end: float, envpts, gain: float = 0.18) -> None:
	"""冰窟：空旷的低频空气声 + 极轻的冷风"""
	air(start, end, envpts, gain)
	wind(start, end, envpts, gain * 0.5, 200, 900, 0.0, 0.08)


def soft_lowpass(x: np.ndarray, hi: float = 6000) -> np.ndarray:
	return band(x, 0, hi, 0.4)


def P(x: float) -> float:
	"""画面横坐标（像素，1920 宽）→ 声像"""
	return float(np.clip((x / 1920 - 0.5) * 1.6, -1, 1))


# ─── 第 1 段：三只龙（HookScene）──────────────────────────────────────
s = 's1'
T = lambda f: t_of(s, f)
air(T(0), T(380), [(T(0), 0.6), (T(380), 0.6)], 0.08)
swell(T(296), (330 - 296) / FPS + 1.4, 0.14, 40, 400, peak=0.4)  # 本期标题出现（开头）
fire(T(0), T(44), [(T(0), 0.0), (T(8), 1.0), (T(40), 1.0), (T(46), 0.0)], 0.28)  # 白焰中的莱希拉姆
for b in (48, 61, 76):  # 捷克罗姆背后的闪电：只用远处闷雷
	thunder(T(b), 0.0, 0.7)
wind(T(88), T(134), [(T(88), 0.0), (T(94), 1.0), (T(128), 1.0), (T(134), 0.0)], 0.22, 300, 1600)  # 冰雾里的酋雷姆
for c in (44, 88, 132):  # 镜头切换：极轻的低频一推
	swell(T(c) - 0.25, 0.5, 0.12, 40, 300, peak=0.5)
swell(T(186), (206 - 186) / FPS + 0.2, 0.3, 40, 600, peak=0.9)  # 三道剪影化光汇聚
whoosh(T(186), (206 - 186) / FPS + 0.1, 300, 1200, 0.18, -0.6, 0.0, peak=0.95)
whoosh(T(186), (206 - 186) / FPS + 0.1, 300, 1200, 0.18, 0.6, 0.0, peak=0.95)
boom(T(206), 0.5)  # 空洞成形
drone(T(200), t_of('s3', 205), [(T(200), 0.0), (T(240), 1.0), (t_of('s3', 150), 1.0), (t_of('s3', 205), 1.3)], 0.12, 46)  # 空洞的嗡鸣，一直到第 3 段裂开

# ─── 第 2 段：建国（FoundingScene）────────────────────────────────────
s = 's2'
T = lambda f: t_of(s, f)
wind(T(0), t_of('s3', 400), [(T(0), 0.0), (T(70), 1.0), (t_of('s3', 380), 1.0), (t_of('s3', 400), 0.0)], 0.16, 120, 900)  # 远古合众的风，延续到第 3 段
swell(T(150), (250 - 150) / FPS, 0.14, 30, 220, peak=0.6)  # 城邦从地面升起（极轻的地鸣）

# ─── 第 3 段：分裂（SplitScene）──────────────────────────────────────
s = 's3'
T = lambda f: t_of(s, f)
drone(T(40), T(205), [(T(40), 0.0), (T(200), 1.0), (T(205), 0.0)], 0.08, 61)  # 兄弟争执：不安的低音慢慢浮上来
for b in (132, 168, 186):
	thunder(T(b), 0.6, 0.6)
swell(T(150), (205 - 150) / FPS, 0.35, 40, 800, peak=0.97)  # 空洞颤动、将裂
boom(T(205), 1.0)  # 一分为二
whoosh(T(205), 1.6, 900, 300, 0.22, 0.0, -0.9, peak=0.15)
whoosh(T(205), 1.6, 900, 300, 0.22, 0.0, 0.9, peak=0.15)
fire(T(230), T(400), [(T(230), 0.0), (T(280), 0.35), (T(380), 0.5), (T(400), 0.9)], 0.18, -0.7)  # 暖白的一团光（左）
electric(T(230), T(400), [(T(230), 0.0), (T(280), 0.4), (T(400), 0.4)], 0.06, 0.7)  # 蓝色的一团光（右）
swell(T(380), (400 - 380) / FPS + 0.1, 0.3, 40, 900, -0.6, peak=0.95)  # 暖光吞没画面
fire(T(400), T(620), [(T(400), 1.0), (T(600), 1.0), (T(620), 0.0)], 0.3, -0.1)  # 黑底白焰
swell(T(406), (440 - 406) / FPS, 0.2, 40, 500, peak=0.95)  # 莱希拉姆显色（叫声在视频里）
for b in (614, 652, 700, 748, 796):  # 白底雷云
	thunder(T(b), 0.2, 0.8)
wind(T(620), T(846), [(T(620), 0.0), (T(640), 1.0), (T(846), 1.0)], 0.2, 120, 900, 0.3)
swell(T(640), (674 - 640) / FPS, 0.2, 40, 500, 0.2, peak=0.95)  # 捷克罗姆显色
# 左右对峙：左边火、右边风雷，延续到第 4 段
fire(T(846), t_of('s4', 150), [(T(846), 0.0), (T(862), 0.8), (t_of('s4', 150), 1.0)], 0.26, -0.7)
wind(T(846), t_of('s4', 150), [(T(846), 0.0), (T(862), 1.0), (t_of('s4', 150), 1.0)], 0.18, 120, 900, 0.7)

# ─── 第 4 段：双龙之战（WarScene，爆发点）────────────────────────────
s = 's4'
T = lambda f: t_of(s, f)
for b in (70, 108, 132):
	thunder(T(b), 0.7, 0.7)
swell(T(50), (150 - 50) / FPS, 0.45, 30, 900, peak=0.98)  # 蓄力逼近
boom(T(148), 1.6)  # 白焰与蓝雷对撞：全片最响，但只有低沉的轰鸣
whoosh(T(150), 2.0, 1200, 200, 0.25, 0.0, 0.0, peak=0.1)  # 冲击波推开
fire(T(150), T(300), [(T(150), 0.0), (T(156), 1.0), (T(262), 1.0), (T(300), 0.0)], 0.32, -0.6)  # 白焰光束
electric(T(150), T(300), [(T(150), 0.0), (T(156), 1.0), (T(262), 1.0), (T(300), 0.0)], 0.14, 0.6)  # 蓝雷光束
drone(T(150), T(300), [(T(150), 0.0), (T(160), 1.0), (T(262), 1.0), (T(300), 0.0)], 0.12, 41)  # 光球翻滚
boom(T(205), 0.6)  # 第二圈冲击波
wind(T(310), T(600), [(T(310), 0.0), (T(330), 0.8), (T(560), 0.8), (T(600), 0.0)], 0.15, 120, 900)  # 停战后的风
for b in (440, 462):  # 儿子们再起战火
	thunder(T(b), 0.6, 0.6)
for b in (500, 520, 545, 560):  # 雷电落在城邦
	thunder(T(b), 0.3, 0.9)
fire(T(505), T(600), [(T(505), 0.0), (T(530), 0.7), (T(570), 0.7), (T(600), 0.0)], 0.26, 0.3)  # 城邦着火（远处）
swell(T(520), (585 - 520) / FPS, 0.25, 25, 200, 0.3, peak=0.6)  # 城邦塌陷的地鸣
air(T(600), t_of('s5', 160), [(T(600), 0.0), (T(620), 1.0), (t_of('s5', 160), 1.0)], 0.08)
# 两团光坠落（光明石落在左、黑暗石落在右），第 5 段开头落地
whoosh(T(640), (730 - 640 + 18) / FPS, 400, 160, 0.16, -0.5, -0.2, peak=0.9)
whoosh(T(648), (730 - 648 + 26) / FPS, 400, 160, 0.16, 0.5, 0.2, peak=0.9)

# ─── 第 5 段：空壳（HuskScene）──────────────────────────────────────
s = 's5'
T = lambda f: t_of(s, f)
boom(T(18), 0.35, -0.2)  # 落地（光明石）
boom(T(26), 0.35, 0.2)  # 落地（黑暗石）
drone(T(18), T(170), [(T(18), 1.0), (T(170), 0.2)], 0.06, 52, -0.2)  # 石头的余温
wind(T(160), T(330), [(T(160), 0.0), (T(230), 1.0), (T(330), 0.8)], 0.2, 250, 1400)  # 寒气漫进来
drone(T(222), T(330), [(T(222), 0.0), (T(246), 0.8), (T(330), 0.5)], 0.08, 46)  # 空洞的残影
whoosh(T(246), 2.4, 800, 250, 0.2, 0.0, -1.0, peak=0.3)  # 两团光飞走
whoosh(T(246), 2.4, 800, 250, 0.2, 0.0, 1.0, peak=0.3)
swell(T(262), (300 - 262) / FPS + 0.6, 0.16, 200, 1500, peak=0.6)  # 原处结冰的空壳
whoosh(T(318), (350 - 318) / FPS + 0.1, 900, 300, 0.2, 0.0, 0.7, peak=0.85)  # 空壳缩成陨石坠落
thunder(T(350), 0.7, 0.8)  # 远处陨石坑的闷响
wind(T(330), T(540), [(T(330), 0.6), (T(360), 1.0), (T(500), 1.0), (T(540), 1.5)], 0.2, 150, 1000, 0.2)  # 笼目镇的寒风
swell(T(500), (540 - 500) / FPS + 0.2, 0.25, 60, 1200, 0.5, peak=0.9)  # 推向陨石坑
cave(T(540), t_of('s6', 110), [(T(540), 0.0), (T(560), 1.0), (t_of('s6', 110), 1.0)], 0.2)  # 冰窟
swell(T(600), (634 - 600) / FPS, 0.2, 40, 500, peak=0.95)  # 酋雷姆显色

# ─── 第 6 段：英雄再现（RevivalScene，今·黑 / 白）────────────────────────
s = 's6'
T = lambda f: t_of(s, f)
air(T(110), T(385), [(T(110), 0.0), (T(130), 1.0), (T(385), 1.0)], 0.1)  # 魁奇思与Ｎ、演讲台
drone(T(110), T(296), [(T(110), 0.0), (T(150), 0.7), (T(296), 0.7)], 0.07, 49)
swell(T(296), (385 - 296) / FPS, 0.14, 60, 500, peak=0.5)  # 人群（只留低沉的气息，不做嘈杂人声）
wind(T(385), T(520), [(T(385), 0.0), (T(400), 1.0), (T(520), 1.0)], 0.22, 250, 1400, 0.0, 0.3)  # 龙螺旋之塔的风雪
swell(T(425), (445 - 425) / FPS, 0.25, 40, 700, peak=0.95)
boom(T(445), 0.8)  # 塔顶的龙苏醒
air(T(520), T(600), [(T(520), 0.0), (T(530), 1.0), (T(600), 1.0)], 0.1)
drone(T(520), T(600), [(T(520), 0.0), (T(540), 0.6), (T(600), 0.6)], 0.06, 55, -0.1)  # 训练师手里的石头
swell(T(600), (660 - 600) / FPS, 0.22, 25, 220, peak=0.7)  # Ｎ的城堡从地面升起
for b in (630, 665):
	thunder(T(b), 0.4, 0.5)
swell(T(640), (682 - 640) / FPS, 0.3, 40, 900, -0.5, peak=0.97)
boom(T(682), 0.9)  # 石头苏醒
fire(T(700), T(830), [(T(700), 0.0), (T(716), 0.7), (T(810), 0.7), (T(830), 0.0)], 0.2, -0.7)  # 传说又一次上演
wind(T(700), T(830), [(T(700), 0.0), (T(716), 1.0), (T(810), 1.0), (T(830), 0.0)], 0.14, 120, 900, 0.7)
wind(T(830), T(910), [(T(830), 0.0), (T(846), 0.6), (T(910), 0.3)], 0.12, 100, 600)  # Ｎ输了：只剩一点风
drone(T(910), T(1060), [(T(910), 0.0), (T(930), 1.0), (T(1040), 1.0), (T(1060), 0.0)], 0.12, 38)  # 魁奇思说出真话
wind(T(1060), t_of('s7', 40), [(T(1060), 0.0), (T(1080), 0.8), (t_of('s7', 30), 1.4), (t_of('s7', 40), 0.0)], 0.16, 120, 900)  # 夜风
whoosh(T(1080), (1144 - 1080) / FPS + 0.4, 300, 1400, 0.18, 0.0, 0.7, peak=0.4)  # 一道光飞向月亮

# ─── 第 7 段：合体（FusionScene）─────────────────────────────────────
s = 's7'
T = lambda f: t_of(s, f)
O = 694  # 巨人洞窟以后的部分整体后移的帧数（与场景代码一致）
TO = lambda f: t_of(s, f + O)
# 驱逐舰驶过夜空：低沉的嗡鸣从右往左
drone(T(0), T(200), [(T(0), 0.0), (T(40), 0.8), (T(180), 0.8), (T(200), 0.3)], 0.1, 52, 0.0)
whoosh(T(10), (240 - 10) / FPS, 200, 500, 0.12, 0.9, -0.6, peak=0.55)
wind(T(0), T(200), [(T(0), 1.0), (T(200), 0.6)], 0.12, 120, 900)
# 冰弹落向双龙市，城市被冻住（远处的闷响 + 低频的冰封涌起，不刺耳）
for i, m in enumerate((214, 222, 232, 240, 250)):
	thunder(T(m + 12), [-0.6, -0.1, 0.25, -0.4, 0.55][i], 0.45)
swell(T(244), (330 - 244) / FPS, 0.22, 60, 900, peak=0.85)
wind(T(200), T(730), [(T(200), 0.4), (T(330), 1.0), (T(700), 1.0), (T(730), 1.6)], 0.18, 200, 1200)  # 冰城的寒风
drone(T(340), T(640), [(T(340), 0.0), (T(380), 0.6), (T(640), 0.6)], 0.06, 55)  # 夏卡与传家宝
swell(T(414), (440 - 414) / FPS + 0.4, 0.12, 100, 900, -0.5, peak=0.5)  # 基因之楔的光
whoosh(T(656), 0.5, 900, 400, 0.12, 0.6, 0.6, peak=0.2)  # 黑暗铁三角现身
whoosh(T(690), (700 - 690) / FPS + 0.5, 600, 1500, 0.14, -0.5, 0.5, peak=0.3)  # 基因之楔被夺走
swell(T(700), (730 - 700) / FPS, 0.18, 200, 1400, peak=0.95)  # 寒气漫开
# 巨人洞窟
cave(TO(36), TO(330), [(TO(36), 0.0), (TO(46), 1.0), (TO(330), 1.0)], 0.2)
drone(TO(60), TO(330), [(TO(60), 0.0), (TO(120), 0.6), (TO(238), 0.9), (TO(330), 1.2)], 0.09, 44)  # 魁奇思的控制
for d, p0 in ((0, -0.5), (6, -0.4)):  # 两枚楔形的光
	whoosh(TO(158 + d), (186 - 158) / FPS, 500, 1500, 0.14, p0, 0.2, peak=0.85)
swell(TO(192), (238 - 192) / FPS, 0.22, 40, 700, 0.5, peak=0.95)  # Ｎ的龙被拽过去
boom(TO(238), 0.5)
swell(TO(300), (330 - 300) / FPS, 0.3, 40, 900, peak=0.97)
boom(TO(330), 1.0)  # 焰白酋雷姆
fire(TO(330), TO(520), [(TO(330), 0.0), (TO(340), 0.8), (TO(510), 0.8), (TO(520), 0.0)], 0.24)
wind(TO(330), TO(520), [(TO(330), 0.0), (TO(340), 0.8), (TO(520), 0.6)], 0.12, 300, 1400)
boom(TO(520), 0.8)  # 暗黑酋雷姆
for b in (516, 560, 610, 660):
	thunder(TO(b), -0.2, 0.7)
wind(TO(520), TO(710), [(TO(520), 0.0), (TO(530), 1.0), (TO(700), 1.0), (TO(710), 0.0)], 0.18, 150, 1100)
drone(TO(710), TO(830), [(TO(710), 0.0), (TO(730), 1.0), (TO(830), 1.0)], 0.11, 41)  # 被人强行合上的
boom(TO(830), 1.0)  # 训练师打败了它
whoosh(TO(856), (922 - 856) / FPS, 600, 300, 0.16, 0.0, 0.7, peak=0.6)  # 那团光回到Ｎ身边
cave(TO(830), t_of('s8', 0), [(TO(830), 0.0), (TO(850), 1.0), (t_of('s8', 0), 1.0)], 0.2)
# 魁奇思的结局：黑暗铁三角现身、把他带走，只剩手杖
drone(TO(964), TO(1036), [(TO(964), 0.0), (TO(990), 0.7), (TO(1030), 0.7), (TO(1036), 0.0)], 0.07, 38, -0.2)
whoosh(TO(1006), 0.5, 900, 400, 0.12, 0.3, 0.0, peak=0.2)
whoosh(TO(1036), 0.7, 400, 1200, 0.12, 0.0, 0.6, peak=0.2)

# ─── 第 8 段：尾声（CodaScene）────────────────────────────────────────
s = 's8'
T = lambda f: t_of(s, f)
# 过渡：酋雷姆化进冰雾消失 → 镜头升出巨人洞窟、升到夜空
swell(T(24), (100 - 24) / FPS, 0.16, 80, 900, peak=0.45)  # 酋雷姆消失
cave(T(0), T(140), [(T(0), 1.0), (T(96), 1.0), (T(140), 0.0)], 0.2)
whoosh(T(96), (186 - 96) / FPS + 0.3, 200, 700, 0.14, 0.0, 0.0, peak=0.5)  # 镜头升起（柔和、低）
wind(T(110), T(220), [(T(110), 0.0), (T(170), 1.0), (T(200), 1.0), (T(220), 0.0)], 0.16, 120, 800)  # 崖口上的夜风
air(T(200), T(376), [(T(200), 0.0), (T(224), 1.0), (T(376), 1.0)], 0.1)
drone(T(376), T(590), [(T(376), 0.0), (T(416), 0.8), (T(512), 0.8), (T(590), 0.0)], 0.1, 46)  # 一条龙的空洞重现，随画面淡出
swell(T(372), (406 - 372) / FPS + 0.5, 0.18, 40, 500, peak=0.6)
air(T(376), T(590), [(T(376), 0.5), (T(560), 0.5), (T(590), 0.0)], 0.08)


# ─── 混音输出 ────────────────────────────────────────────────────────
mix = np.stack([soft_lowpass(L), soft_lowpass(R)], axis=1)
# 柔和的压缩：大爆发与底噪的差距收窄一些，整体不刺耳
mix = np.tanh(mix / (np.max(np.abs(mix)) * 0.85))
mix = mix / np.max(np.abs(mix)) * 10 ** (-3 / 20)

# 叫声在视频里：叫声响起时把音效压低约 8 dB，免得盖住叫声（帧号取自各段场景代码）
CRIES = [
	t_of('s3', 440),  # 莱希拉姆（RESHIRAM_REVEAL[1]）
	t_of('s3', 674),  # 捷克罗姆（ZEKROM_REVEAL[1]）
	t_of('s4', 151),  # 双龙第二次叫声（CLASH + 1 / + 8）
	t_of('s4', 158),
	t_of('s5', 634),  # 酋雷姆（KYUREM_REVEAL[1]）
	t_of('s7', 372 + 694),  # 焰白酋雷姆（WHITE_REVEAL[1]）
	t_of('s7', 562 + 694),  # 暗黑酋雷姆（BLACK_REVEAL[1]）
]
duck_db = np.zeros(N)
tt = np.arange(N) / SR
# 双龙对撞处的两声叫声只压 4 dB，保住全片最大的爆发点
CLASH_CRIES = {t_of('s4', 151), t_of('s4', 158)}
for c in CRIES:
	shape = np.interp(tt, [c - 0.06, c, c + 1.6, c + 2.2], [0, 1, 1, 0], left=0, right=0)
	duck_db = np.maximum(duck_db, shape * (4.0 if c in CLASH_CRIES else 8.0))
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
outdir = root / 'out' / '真实与理想'
write_wav(outdir / 'dragons-sfx.wav', mix)
frames_of = dict(SEGMENTS)
for name, frames in SEGMENTS:
	a = int(OFFSET[name] * SR)
	b = int((OFFSET[name] + frames / FPS) * SR)
	write_wav(outdir / 'sfx' / f'dragons-{name}-sfx.wav', mix[a:b])
for part, segs in PARTS:
	a = int(OFFSET[segs[0]] * SR)
	b = int((OFFSET[segs[-1]] + frames_of[segs[-1]] / FPS) * SR)
	write_wav(outdir / 'sfx' / f'dragons-{part}-sfx.wav', mix[a:b])
print(f'dragons-sfx.wav: {TOTAL:.2f}s, peak -3 dBFS')
