"""
《人造容器》（代码短名 pokeball）音效轨。用户剪辑时自己放配乐《千年之后》（参考视频用的也是这首），
这条轨只做画面上的动作音效，不是配乐：没有旋律，全部用 numpy 合成，不用外部素材。整期一个文件（用户 2026-10-17）。
2026-10-18 按返工后的画面（字幕表 v3、新转场）和原曲长度重做。
时间轴 = 整期总时间轴（0 秒 = 第一部分第一帧），卡点与 src/scenes/pokeball/common.ts 的 bf() 一致：
  112.91 BPM，第 0 小节强拍 1.0918 秒，一小节 2.1256 秒；原曲 134.3 秒，第 62 小节起自然淡出。

整体柔和、克制（CLAUDE.md），而且要给配乐让位：
  · 底噪极低，只在档案馆的空间里留一点空气；
  · 物件声：现代精灵球 = 漆面树脂的闷"咚"，洗翠精灵球 / 球果 = 木头的短"笃"，按钮 = 很软的"嗒"；
  · 光：钟形包络的一阵气流；收服、显色 = 一声温暖的低钟；
  · 爆发点（片名、起源球、锁链合上、大师球碎开）只用低沉的闷响和低钟，不用碎裂声、不用尖锐高频；
  · 最后整体过 5.5 kHz 柔和低通。叫声处压低 8 dB（与爆发点同拍的两声只压 4 dB）。

输出：out/人造容器/pokeball-sfx.wav
用法：python sfx/pokeball_sfx.py
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
BPM = 112.91
BEAT = 60 / BPM
BAR = BEAT * 4
DOWN0 = 1.0918
MUSIC_END = 134.3


def bt(bar: float, beat: float = 0.0) -> float:
	"""第 bar 小节第 beat 拍的秒数（与 common.ts 的 bf() / 30 相同）"""
	return DOWN0 + bar * BAR + beat * BEAT


TOTAL = round(MUSIC_END * 30) / 30
N = int(TOTAL * SR) + SR
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(20261018)


def px(x: float) -> float:
	"""画面横坐标 → 声像（只做轻微定位）"""
	return (x / 960 - 1) * 0.55


# ─── 工具 ────────────────────────────────────────────────────────────
def noise(n):
	return rng.standard_normal(n)


def spectral(x, mag):
	X = np.fft.rfft(x)
	f = np.fft.rfftfreq(len(x), 1 / SR)
	return np.fft.irfft(X * mag(f), n=len(x))


def band(x, lo, hi, soft=0.35):
	def mag(f):
		lf = np.log2(np.maximum(f, 1.0))
		a = 1 / (1 + np.exp(-(lf - np.log2(max(lo, 1))) / soft)) if lo > 0 else 1.0
		b = 1 / (1 + np.exp((lf - np.log2(hi)) / soft))
		return a * b

	return spectral(x, mag)


def brown(n):
	return spectral(noise(n), lambda f: 1 / np.maximum(f, 20.0))


def norm(x):
	p = np.max(np.abs(x))
	return x / p if p > 0 else x


def wobble(n, rate=0.3, depth=0.4):
	t = np.arange(n) / SR
	w = sum(np.sin(2 * np.pi * rate * k * t + rng.uniform(0, 6.28)) / k for k in (1, 1.7, 2.9))
	return 1 + depth * w / 1.9


def add(start, sig, gain=1.0, pan=0.0):
	i0 = int(start * SR)
	if i0 >= N:
		return
	if i0 < 0:
		sig = sig[-i0:]
		i0 = 0
	n = min(len(sig), N - i0)
	sig = sig[:n] * gain
	th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
	L[i0 : i0 + n] += sig * np.cos(th)
	R[i0 : i0 + n] += sig * np.sin(th)


def reverb(x, rt=1.6, wet=0.3):
	"""档案馆的空间：中等长度的混响"""
	n = int(rt * SR)
	t = np.arange(n) / SR
	ir = band(noise(n), 90, 4500) * np.exp(-t * 6.9 / rt)
	ir /= np.sqrt(np.sum(ir ** 2))
	m = len(x) + n
	y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x) + n]
	out = np.concatenate([x, np.zeros(n)]) * (1 - wet) + y * wet * 2.0
	return out


# ─── 音源 ────────────────────────────────────────────────────────────
def room(start, end, gain=0.03):
	"""底噪：很低的空气，缓慢起伏"""
	n = int((end - start) * SR)
	sig = norm(band(brown(n), 30, 220)) * wobble(n, 0.06, 0.25) + norm(band(noise(n), 200, 800)) * 0.08 * wobble(n, 0.1, 0.4)
	fade = np.minimum(np.arange(n) / (2 * SR), 1) * np.minimum((n - np.arange(n)) / (2 * SR), 1)
	add(start, sig * fade, gain)


def modal(start, f0, ratios, amps, taus, gain, pan=0.0, attack=0.002, rt=1.4, wet=0.25, knock=0.0):
	"""模态合成的敲击：若干衰减的正弦 + 一点点击噪声"""
	dur = max(taus) * 5 + 0.05
	n = int(dur * SR)
	t = np.arange(n) / SR
	sig = np.zeros(n)
	for r, a, tau in zip(ratios, amps, taus):
		f = f0 * r * (1 + rng.uniform(-0.004, 0.004))
		if f > 5000:
			continue
		sig += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / tau)
	sig *= np.minimum(t / attack, 1)
	if knock > 0:
		sig += knock * band(noise(n), 300, 2400) * np.exp(-t / 0.006)
	add(start, reverb(norm(sig), rt, wet), gain, pan)


def resin_knock(start, gain=0.16, pan=0.0, pitch=1.0):
	"""现代精灵球落地：漆面树脂空心球的闷"咚" """
	modal(start, 190 * pitch, [1, 2.05, 3.4, 5.1], [1, 0.45, 0.22, 0.1], [0.12, 0.06, 0.035, 0.02], gain, pan, 0.0015, 1.4, 0.22, 0.25)


def wood_tock(start, gain=0.12, pan=0.0, pitch=1.0):
	"""木头 / 球果的短"笃" """
	modal(start, 320 * pitch, [1, 2.7, 4.9], [1, 0.4, 0.15], [0.05, 0.025, 0.012], gain, pan, 0.001, 1.0, 0.2, 0.35)


def soft_click(start, gain=0.05, pan=0.0):
	"""按钮 / 锁扣：很软的"嗒"（中频为主）"""
	n = int(0.12 * SR)
	t = np.arange(n) / SR
	sig = band(noise(n), 500, 2600) * np.exp(-t / 0.004) + 0.5 * np.sin(2 * np.pi * 900 * t) * np.exp(-t / 0.01)
	add(start, reverb(norm(sig), 0.8, 0.2), gain, pan)


def bell(start, f0=220.0, gain=0.07, pan=0.0, tau=2.2):
	"""温暖的低钟（收服、显色）：近谐和泛音，软起音"""
	modal(start, f0, [1, 2.0, 2.76, 4.07], [1, 0.35, 0.18, 0.07], [tau, tau * 0.55, tau * 0.35, tau * 0.2], gain, pan, 0.006, 2.2, 0.35)


def glass_tap(start, f0=520.0, gain=0.05, pan=0.0):
	"""展柜玻璃：轻敲一下（非谐和泛音，软槌）"""
	modal(start, f0, [1, 2.32, 4.25], [1, 0.4, 0.15], [1.0, 0.45, 0.2], gain, pan, 0.004, 2.0, 0.35)


def air(start, dur, gain=0.05, pan0=0.0, pan1=0.0, lo=180, hi=1100):
	"""光、线条移动：一阵极轻的气流，钟形包络"""
	n = int(dur * SR)
	t = np.arange(n) / SR / dur
	sig = norm(band(noise(n), lo, hi)) * np.sin(np.pi * t) ** 2 * wobble(n, 0.6, 0.3)
	pan = pan0 + (pan1 - pan0) * t
	i0 = int(start * SR)
	m = min(n, N - i0)
	th = (np.clip(pan[:m], -1, 1) + 1) * np.pi / 4
	L[i0 : i0 + m] += sig[:m] * gain * np.cos(th)
	R[i0 : i0 + m] += sig[:m] * gain * np.sin(th)


def swell(start, dur, gain=0.1, lo=35, hi=500, peak=0.85):
	"""低频的上扬：配乐上扬段下面垫一层，峰值落在下一小节强拍"""
	n = int(dur * SR)
	t = np.arange(n) / SR / dur
	sig = norm(band(brown(n), lo, hi)) * wobble(n, 0.5, 0.2)
	shape = np.where(t < peak, (t / peak) ** 2.2, np.cos(np.pi / 2 * (t - peak) / (1 - peak)) ** 2)
	add(start, sig * shape, gain)


def thump(start, size=1.0, pan=0.0):
	"""低沉的闷响：低频扫频 + 低频拖尾，没有高频"""
	dur = 1.8 + 1.8 * size
	n = int(dur * SR)
	t = np.arange(n) / SR
	f = 68 * np.exp(-t * 2.2) + 34
	tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(t / 0.008, 1) * np.exp(-t / (0.45 + 0.6 * size))
	body = band(noise(n), 30, 280) * np.minimum(t / 0.01, 1) * np.exp(-t / (0.2 + 0.25 * size))
	tail = band(brown(n), 20, 150) * np.minimum(t / 0.08, 1) * np.exp(-t / (0.8 + 1.0 * size))
	add(start, reverb(norm(tone) + norm(body) * 0.45 + norm(tail) * 0.5 * size, 2.2, 0.28), 0.45 * size ** 0.9, pan)


def puff(start, gain=0.04, pan=0.0):
	"""洗翠精灵球收服时的蒸汽：柔和的低通"噗" """
	n = int(0.9 * SR)
	t = np.arange(n) / SR
	sig = band(noise(n), 250, 2200) * np.minimum(t / 0.03, 1) * np.exp(-t / 0.22)
	add(start, reverb(norm(sig), 1.0, 0.25), gain, pan)


def step(start, gain=0.05, pan=0.0, soft=False):
	"""脚步：闷闷的一下（泥土地）"""
	n = int(0.3 * SR)
	t = np.arange(n) / SR
	sig = band(noise(n), 60, 600 if not soft else 400) * np.exp(-t / (0.035 if not soft else 0.025)) + 0.6 * np.sin(2 * np.pi * 90 * t) * np.exp(-t / 0.04)
	add(start, reverb(norm(sig), 0.9, 0.18), gain, pan)


def hum(start, dur, f=55.0, gain=0.05, pan=0.0, fm=0.0):
	"""低沉的嗡鸣（工厂、锁链、电流），慢起慢落；fm>0 时带一点电流的颤动"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	vib = 1 + fm * np.sin(2 * np.pi * 7 * t)
	sig = np.sin(2 * np.pi * f * np.cumsum(vib) / SR) + 0.5 * np.sin(2 * np.pi * 2 * f * t) + 0.35 * norm(band(brown(n), 30, 180))
	shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
	add(start, norm(sig) * shape, gain, pan)


def clank(start, gain=0.12, pan=0.0, pitch=1.0):
	"""锁链的链环相扣：低沉、阻尼大的金属声（过 3 kHz 低通的模态）"""
	modal(start, 140 * pitch, [1, 2.76, 5.4, 8.9], [1, 0.5, 0.25, 0.1], [0.25, 0.12, 0.06, 0.03], gain, pan, 0.002, 1.6, 0.3, 0.4)


def rumble_roll(start, dur, gain=0.06, pan0=-0.6, pan1=0.2):
	"""球在地上滚：低频的滚动声，越滚越慢"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	speed = 1 - t / dur
	sig = norm(band(brown(n), 30, 300)) * (0.3 + 0.7 * speed) * np.clip(wobble(n, 6.0 * (0.4 + speed.mean()), 0.5), 0.2, None)
	sig *= np.minimum(t / 0.15, 1)
	pan = pan0 + (pan1 - pan0) * t / dur
	i0 = int(start * SR)
	m = min(n, N - i0)
	th = (np.clip(pan[:m], -1, 1) + 1) * np.pi / 4
	L[i0 : i0 + m] += sig[:m] * gain * np.cos(th)
	R[i0 : i0 + m] += sig[:m] * gain * np.sin(th)


def glide(start, dur, f0, f1, gain=0.04, pan=0.0):
	"""捕获率的满格：一道很轻的上行正弦"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	f = f0 * (f1 / f0) ** (t / dur)
	sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur) ** 1.5
	add(start, reverb(sig, 1.2, 0.25), gain, pan)


def creak(start, dur=0.5, gain=0.04, pan=0.0, f0=120.0):
	"""裂纹：低频的黏滑摩擦"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	rate = f0 * (1 + 0.3 * np.sin(2 * np.pi * 2.3 * t + rng.uniform(0, 6)))
	ph = np.cumsum(rate) / SR
	pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float) * rng.uniform(0.4, 1.0, n)
	sig = band(pulses, 100, 1300) * np.sin(np.pi * t / dur) ** 2
	add(start, reverb(norm(sig), 1.6, 0.3), gain, pan)


def shimmer(start, dur, gain=0.03, pan=0.0):
	"""太晶的微光：中频的柔和闪烁（带限，不刺耳）"""
	n = int(dur * SR)
	t = np.arange(n) / SR
	sig = np.zeros(n)
	for f in (660, 880, 990, 1320):
		sig += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(1.5, 4) * t + rng.uniform(0, 6)))
	sig *= np.minimum(t / 0.3, 1) * np.exp(-t / (dur * 0.45))
	add(start, reverb(norm(sig), 2.4, 0.45), gain, pan)


# ═══ 整期 ═══════════════════════════════════════════════════════════
room(0, TOTAL, 0.028)

# ─── 第 1 段：钩子 + 片名 ───────────────────────────────────────────
air(0.0, bt(0) + 0.05, 0.03, 0, 0, 200, 900)  # 球落下的风
resin_knock(bt(0), 0.2)  # 第一个强拍：落地
resin_knock(bt(0) + 16 / 30, 0.07, 0, 1.03)  # 回弹两下（与画面一致：落地后 16 帧、26 帧）
resin_knock(bt(0) + 26 / 30, 0.035, 0, 1.05)
air(bt(1), 0.8, 0.035, px(470), px(470), 300, 1500)  # 宇宙起始之石画出
air(bt(1, 2), 0.8, 0.035, px(1450), px(1450), 250, 1200)  # 红色锁链画出
clank(bt(1, 2) + 0.5, 0.04, px(1450), 1.2)
air(bt(2), 0.9, 0.04, 0, 0, 200, 1100)  # 空圆
swell(bt(2, 2), bt(4) - bt(2, 2) + 0.4, 0.06, 35, 400, 0.9)  # 第三样收紧，垫到片名
thump(bt(4), 0.75)  # 片名：闪光、球收成小金球
bell(bt(4) + 0.03, 196, 0.06, 0, 3.0)
air(bt(4, 1), 1.2, 0.03, -0.4, 0.4, 150, 800)  # 装饰线向两侧展开
# 片名静段：片名后面逐笔画出精灵球的线描结构图（配乐这里几乎只剩底音，所以只用极轻的笔触声）
air(bt(4, 1.5), BEAT * 2, 0.018, -0.3, 0.3, 300, 1400)  # 外壳轮廓画一圈
air(bt(5), BEAT, 0.014, -0.4, 0.4, 300, 1200)  # 赤道接缝
for c_at, c_pan in [(bt(5), px(600)), (bt(5, 2), px(1430)), (bt(6), px(600)), (bt(6, 2), px(1430))]:  # 四处标注
	air(c_at, BEAT * 1.1, 0.014, 0, c_pan, 400, 1600)
	soft_click(c_at + BEAT * 0.8, 0.018, c_pan)
air(bt(6, 1.5), BEAT * 1.5, 0.012, 0, 0, 300, 1200)  # 内部虚线圈

# ─── 第 2 段：没有球的年代——小金球落到第一对脚印之间，脚印每拍一步 ──
air(bt(7) - 16 / 30, 0.65, 0.03, 0, px(262), 200, 1000)  # 小金球飘下去
bell(bt(7), 330, 0.02, px(262), 1.4)  # 化进光里
for i in range(12):
	x = 250 + i * 128
	step(bt(7, i), 0.045, px(x))
	step(bt(7, i + 0.5), 0.028, px(x + 64), soft=True)
rumble_roll(bt(8, 2), bt(10) - bt(8, 2), 0.05, -0.9, px(262))  # 第 5 句：洗翠精灵球沿着足迹滚进来
wood_tock(bt(10) - 0.1, 0.03, px(262), 0.92)  # 停住

# ─── 第 3 段：木木枭显色、投球 ──────────────────────────────────────
air(bt(10), BAR, 0.02, px(1390), px(1390), 200, 900)  # 剪影慢慢显色
air(bt(10, 2), BAR / 2, 0.035, px(262), px(1010), 300, 1400)  # 第一次投出（从停住的地方）
wood_tock(bt(11, 2), 0.1, px(1010))  # 落空，落地
wood_tock(bt(11, 2) + 0.16, 0.04, px(1040), 1.06)
wood_tock(bt(11, 2) + 0.3, 0.02, px(1060), 1.1)
for k, x in enumerate([1650, 860, 1560]):  # 几道虚影
	air(bt(12, 2 * k), BEAT * 1.5, 0.02, px(262), px(x), 300, 1300)
air(bt(13, 2), BAR / 2, 0.04, px(262), px(1300), 300, 1400)  # 第三次

# ─── 第 4 段：第一次上扬——命中、缩进球里、摇三下、收服 → 配方 ──────
wood_tock(bt(14), 0.11, px(1300))  # 命中
soft_click(bt(14) + 0.05, 0.03, px(1300))
swell(bt(14), bt(16) - bt(14) + 0.3, 0.07, 40, 500, 0.75)  # 木木枭化光缩进球里
air(bt(14) + 0.4, 1.4, 0.04, px(1390), px(1210), 250, 1500)
for k in range(3):  # 落地、每拍摇一下
	wood_tock(bt(15, 2 + k), 0.06 if k else 0.09, px(1210), 0.95)
puff(bt(16), 0.045, px(1210))  # 收服：蒸汽
bell(bt(16), 262, 0.05, px(1210), 1.8)
soft_click(bt(16) + 0.02, 0.04, px(1210))
air(bt(16, 2), 1.2, 0.03, px(1250), px(1250), 300, 1200)  # 球果果线稿
air(bt(17, 1), 0.8, 0.025, px(1250), px(640), 250, 900)  # 果壳两半连向球
air(bt(17, 2), 1.0, 0.03, px(1250), px(1250), 300, 1200)  # 玉石线稿（第 9 句后半）
air(bt(18, 3) - 0.2, 0.5, 0.03, px(1250), px(640), 200, 900)  # 收拢
for i in range(9):  # 九种球，每半拍亮一格（第 10 句）
	wood_tock(bt(18, 3.5 + i * 0.5), 0.045, px(792 + (i % 3) * 168), 1.0 + 0.04 * (i % 3) - 0.04 * (i // 3))

# ─── 第 5 段：洗翠顽皮雷弹——一颗球从格子里飞出，变成它 ────────────
air(bt(20), 0.6, 0.03, px(960), px(600), 150, 700)  # 九宫格左移
air(bt(20), BEAT * 1.8, 0.035, px(792), px(1330), 200, 1100)  # 球飞出、放大
hum(bt(20, 1.5), 2.6, 60, 0.04, px(1330), fm=0.02)  # 剪影：低低的电流
bell(bt(21), 175, 0.035, px(1330), 1.6)  # 显色
air(bt(21, 2), 1.2, 0.025, px(1330), px(410), 250, 1000)  # 连线到精灵球那一格
air(bt(22, 2), BAR / 2, 0.03, px(1330), 0, 150, 800)  # 缩回画面中央
wood_tock(bt(23), 0.04, 0, 0.9)  # 变回那颗球

# ─── 第 6 段：两个部族 → 帕路奇亚狂暴 ──────────────────────────────
wood_tock(bt(23), 0.05, px(470), 0.8)  # 金刚队
wood_tock(bt(23, 2), 0.05, px(1450), 0.84)  # 珍珠队
air(bt(23, 3), 1.0, 0.025, 0, 0, 250, 1000)  # 断开的连线
hum(bt(24) + 0.2, bt(25, 2) - bt(24), 98, 0.035)  # 空隙合上：温暖的低嗡
bell(bt(25, 2), 196, 0.04, 0, 2.2)  # 连上
hum(bt(26), bt(28) - bt(26) + 0.6, 41, 0.045, fm=0.01)  # 帕路奇亚的影子浮现：低沉的压迫感
air(bt(26, 1), BAR * 0.8, 0.02, -0.5, 0.5, 120, 600)

# ─── 第 7 段：第二次上扬——三样东西 → 起源球 ────────────────────────
air(bt(27), 0.8, 0.035, px(470), px(470), 300, 1500)  # 宇宙起始之石
clank(bt(27, 2), 0.05, px(1450), 1.1)  # 锁链的碎片
clank(bt(27, 2.5), 0.03, px(1450), 1.25)
air(bt(28), 0.9, 0.035, 0, 0, 200, 1100)  # 人造容器
swell(bt(28), bt(30) - bt(28) + 0.2, 0.11, 35, 450, 0.94)  # 三样东西汇到中央
air(bt(29, 2), BAR / 2, 0.05, -0.5, 0.0, 200, 900)
air(bt(29, 2), BAR / 2, 0.05, 0.5, 0.0, 200, 900)
thump(bt(30), 1.25)  # 全片第一个爆发点
bell(bt(30) + 0.03, 147, 0.075, 0, 3.6)
air(bt(30) + 0.6, 1.6, 0.035, 0, 0, 200, 1200)  # 帕路奇亚化光缩进球里
for k in range(3):  # 摇三下
	wood_tock(bt(31, 2 + k), 0.06, 0, 0.9)
bell(bt(32, 1), 247, 0.05, 0, 2.2)  # 收服
soft_click(bt(32, 1) + 0.02, 0.035)

# ─── 第 8 段：展柜里的洗翠 ──────────────────────────────────────────
air(bt(33), BAR * 1.5, 0.025, 0, 0, 150, 700)  # 起源球慢慢放大，淡成洗翠精灵球
glass_tap(bt(34, 2), 560, 0.035, 0)  # 展柜的线条画出来
air(bt(34, 3), 1.4, 0.02, 0, px(640), 150, 800)  # 展柜移到左边
air(bt(35, 1), 0.8, 0.02, px(1400), px(1330), 200, 900)  # 照片滑入
room(bt(34), bt(38) + 1.0, 0.012)  # 美术馆里多一点空间感

# ─── 第 9 段：最后的工匠 ────────────────────────────────────────────
air(bt(38), BEAT * 2, 0.03, px(640), px(345), 200, 1000)  # 镜头推近，球飞到第一颗球果的位置
for i in range(7):  # 七颗球果（第一颗由那颗球变成，其余依次滑出来）
	wood_tock(bt(38, 2 + i * 0.75), 0.05, px(960 + (i - 3) * 205), 0.85 + 0.04 * i)
for i in range(7):  # 静段：每拍连一条线，末端出现一颗球
	air(bt(40, i), BEAT * 0.9, 0.012, px(960 + (i - 3) * 205), px(960 + (i - 3) * 205), 300, 1200)
	resin_knock(bt(40, i + 0.9), 0.05, px(960 + (i - 3) * 205), 1.15 + 0.03 * i)

# ─── 第 10 段：工厂 ─────────────────────────────────────────────────
NODE_X = [470, 960, 1450]
for i, n in enumerate([0, 0, 1, 1, 1, 2, 2]):  # 七颗球缩成光点，飞向工厂节点
	air(bt(42, 3) + i * 2 / 30, bt(43, 1 + n) - bt(42, 3), 0.012, px(960 + (i - 3) * 205), px(NODE_X[n]), 300, 1300)
for i, x in enumerate(NODE_X):  # 三处源头
	bell(bt(43, 1 + i), 131 * (1, 1.12, 1.26)[i], 0.035, px(x), 1.4)
hum(bt(43, 2), bt(47) - bt(43, 2) + 0.5, 49, 0.045)  # 成批生产：低低的机械嗡鸣
for k in range(40):  # 成千上万颗球冒出来：极稀疏、极轻的小"嗒"（不连成一片）
	t0 = bt(43, 2) + (bt(46) - bt(43, 2)) * (k + rng.uniform(0, 1)) / 40
	resin_knock(t0, 0.012, rng.uniform(-0.5, 0.5), rng.uniform(1.4, 1.8))
rumble_roll(bt(44, 2), bt(45) - bt(44, 2) + 0.2, 0.07, -0.7, px(1180))  # 霹雳电球滚进来
resin_knock(bt(45), 0.09, px(1180), 0.8)  # 停住
hum(bt(45), 1.6, 70, 0.03, px(1180), fm=0.03)
rumble_roll(bt(46, 2), bt(47, 1) - bt(46, 2), 0.04, px(1180), 0.95)  # 往右滚出画面

# ─── 第 11 段：大师球 ────────────────────────────────────────────────
glide(bt(46, 3), bt(47) - bt(46, 3), 147, 220, 0.025)  # 点阵里一颗变紫，升起、放大
air(bt(46, 3), bt(47) - bt(46, 3), 0.025, 0, 0, 150, 800)
resin_knock(bt(47), 0.08, 0, 0.9)  # 到位
glide(bt(47) + 0.1, bt(48) - bt(47) - 0.1, 196, 392, 0.03)  # 捕获率一圈满格
bell(bt(48), 392, 0.035, 0, 1.6)
air(bt(50), BEAT * 1.5, 0.04, 0, px(1520), 150, 700)  # "他说他不需要"：球被推开
resin_knock(bt(50) + BEAT * 1.5, 0.04, px(1520), 0.85)
swell(bt(50), bt(52) - bt(50) + 0.2, 0.1, 35, 420, 0.9)  # 第三次上扬
for k in range(5):  # 锁链一节节扣上
	clank(bt(51) + k * BEAT * 0.8, 0.07 + 0.015 * k, px(960 - 240 + k * 120), 1.0 - 0.04 * k)
hum(bt(51), bt(52) - bt(51) + 0.3, 41, 0.04)

# ─── 第 12 段：球与锁链 ──────────────────────────────────────────────
thump(bt(52), 0.7)  # 锁链合上
clank(bt(52) + 0.02, 0.1, 0, 0.8)
air(bt(52, 1), 1.0, 0.02, 0, px(400), 200, 900)
air(bt(52, 1), 1.0, 0.02, 0, px(1520), 200, 900)

# ─── 第 13 段：碎掉的大师球 ─────────────────────────────────────────
air(bt(53, 2), BEAT * 1.6, 0.04, px(1520), 0, 200, 900)  # 大师球回到中央
for k in range(4):  # 裂纹
	creak(bt(53, 2) + k * 0.18, 0.25, 0.03, rng.uniform(-0.2, 0.2), rng.uniform(100, 150))
swell(bt(53, 2), bt(54) - bt(53, 2) + 0.15, 0.08, 40, 500, 0.92)
thump(bt(54), 1.35)  # 碎开：低沉的轰鸣，不用碎裂声
shimmer(bt(54) + 0.05, 3.0, 0.03)  # 太晶的微光
bell(bt(54) + 0.04, 165, 0.05, 0, 3.0)

# ─── 第 14 段：收尾 ─────────────────────────────────────────────────
shimmer(bt(55, 2), 2.6, 0.015, px(760))  # 碎光飘落进画里
air(bt(55, 3), 1.4, 0.022, px(960), px(570), 200, 900)  # 画作淡入
resin_knock(bt(56, 2), 0.06, px(1340), 0.95)  # 开场那颗球回来（第 30 句提问）
for k in range(24):  # 第 31 句：画里的球越来越多——点阵从球周围长出来，极轻的小"嗒"
	t0 = bt(58) + (bt(60, 2) - bt(58)) * (k + rng.uniform(0, 1)) / 24
	resin_knock(t0, 0.01, rng.uniform(-0.6, 0.6), rng.uniform(1.4, 1.8))
air(bt(60), 1.2, 0.025, px(1340), 0, 150, 700)  # 第 32 句：球回到中央
bell(bt(61), 196, 0.035, 0, 4.0)  # 最后一声长长的余音
# 第 62 小节起随原曲的尾音一起淡到无声（见混音输出）


# ─── 混音输出 ────────────────────────────────────────────────────────
def soft_lowpass(x, hi=5500):
	return spectral(x, lambda f: 1 / (1 + (f / hi) ** 4))


mix = np.stack([soft_lowpass(L), soft_lowpass(R)], axis=1)
mix = np.tanh(mix / (np.max(np.abs(mix)) * 0.9))

tt = np.arange(N) / SR
# 叫声在视频里（与 common.ts 的 CRIES 一致）：叫声响起时把音效压低 8 dB
# 与爆发点同拍的两声（起源帕路奇亚、太乐巴戈斯）只压 4 dB，保住闷响
CRIES = [(bt(11), 8.0), (bt(21), 8.0), (bt(30), 4.0), (bt(45), 8.0), (bt(54), 4.0)]
duck = np.zeros(N)
for c, db in CRIES:
	shape = np.interp(tt, [c - 0.06, c, c + 1.5, c + 2.1], [0, 1, 1, 0], left=0, right=0)
	duck = np.maximum(duck, shape * db)
mix = mix * (10 ** (-duck / 20))[:, None]
# 结尾淡出：与原曲同步，第 62 小节起到片尾
fade = np.interp(tt, [bt(62), TOTAL - 0.05], [1, 0], left=1, right=0)
mix = mix * fade[:, None]
mix = mix / np.max(np.abs(mix)) * 10 ** (-3 / 20)


def write_wav(path: Path, data):
	path.parent.mkdir(parents=True, exist_ok=True)
	pcm = (np.clip(data, -1, 1) * 32767).astype('<i2')
	with wave.open(str(path), 'wb') as w:
		w.setnchannels(2)
		w.setsampwidth(2)
		w.setframerate(SR)
		w.writeframes(pcm.tobytes())


root = Path(__file__).resolve().parent.parent
end = int(round(TOTAL * SR))
write_wav(root / 'out' / '人造容器' / 'pokeball-sfx.wav', mix[:end])
print(f'pokeball-sfx.wav: {TOTAL:.3f}s')
