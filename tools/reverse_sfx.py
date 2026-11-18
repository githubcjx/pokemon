"""《世界的背面》音效轨：全部现场合成（numpy / scipy），不取用任何素材或旧期音效。
合成积木（铃、扫频噪声、撕裂、碎玻璃、混音台…）沿用 tools/space_sfx.py，这里只写本期的编排。

用法：python tools/reverse_sfx.py
输出：out/世界的背面/reverse-sfx.wav（整期，和配乐、上中下三篇一样从第 0 帧对齐）
      out/世界的背面/sfx/reverse-part{1,2,3}-sfx.wav（按三篇切开）

声音的思路（和画面"正反两面"对应）：
- 正面（珍珠白线框）= 玻璃、铃、山顶的风；背面（金与暗红）= 低沉的金属和声、倒放的铃和气流。
- 影子 = 压低的气声和极低的暗红嗡鸣；纸 = 翻动、撕开、缝回去。
- 结尾的镜面：同一个铃声正放和倒放叠在一起，前后对称。
- 叫声在视频轨里（16.0、22.1、23.0、52.0、54.0），这几下音效只用超低频和高频，让出中频。
时间点全部按小节 / 30fps 帧号换算，和 src/scenes/reverse/*.tsx 里的常量一一对应。
"""

from __future__ import annotations

import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from space_sfx import (  # noqa: E402
	BEAT,
	Mix,
	SR,
	bell,
	bt,
	clink,
	drone,
	env_ad,
	env_swell,
	glide,
	hp,
	lp,
	n_of,
	noise,
	norm,
	osc,
	reverse,
	rng,
	rumble,
	shatter,
	sparkle,
	sweep,
	tear,
	thump,
	ticks,
	tvec,
	write,
)

TOTAL = 4594 / 30  # 第 72 小节强拍
PARTS = [(0, 1406), (1406, 2809), (2809, 4594)]
OUT = os.path.join('out', '世界的背面')


def F(bar: float, beat: float = 0) -> float:
	"""bf()：30fps 帧号（与 src/scenes/time/common.ts 一致）。"""
	return bt(bar, beat) * 30


# 画面里的时间点（30fps 帧号，同 Master / pillar / paper / finale / mirror）
LUNGE = F(10, 2)
OPEN = LUNGE + 9
TITLE = F(4)
REVEAL = F(16)
PUSH = F(24, 2)
TWO = F(27)
TEAR_PAPER = F(28, 2)
FLIP = F(30)
SHEET_TEAR = F(47, 2)
MEND = F(49)
ORIGIN = F(52)
VANISH = F(53)
STRIKE = F(54)
ALTERED_IN = F(61)
ALTERED_REVEAL = F(63)


def s(frame: float) -> float:
	return frame / 30


def mirror_tone(f, d, a=0.003):
	"""镜面音：铃声正放接倒放，前后对称（先倒着涨上来，再正着落下去）。"""
	b = bell(f, d, partials=((1, 1, 1), (2.0, 0.35, 0.7), (3.01, 0.18, 0.5)), a=a)
	return np.concatenate([reverse(b), b])


def footstep(seed):
	"""石地上很轻的一步：短促的低频 + 一点砂砾。"""
	d = 0.18
	t = tvec(d)
	body = osc(glide(140, 80, d), d) * np.exp(-t / 0.03)
	grit = bp_noise(d, seed, 1500, 5000) * np.exp(-t / 0.02)
	return body * 0.8 + grit * 0.3


def bp_noise(d, seed, f0, f1):
	return norm(hp(lp(noise(d, seed), f1), f0))


def grind(d, seed, f0=150, f1=90, rate=(24, 12)):
	"""石头扭弯的呻吟：窄带噪声 + 颤动。"""
	x = sweep(d, f0, f1, seed, bw=0.25) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * glide(rate[0], rate[1], d) * tvec(d))))
	return lp(x, 700)


def rustle(d, seed, rate=220):
	"""纸的沙沙声。"""
	return hp(sparkle(d, seed, rate=rate, lo=2500, hi=7000, ramp=lambda u: math.sin(math.pi * u)), 2000) * 0.6 + hp(noise(d, seed + 1), 3000) * env_swell(n_of(d), 0.5) * 0.25


def build():
	M = Mix(TOTAL)
	add = M.add
	seed = iter(range(5000, 200000, 7))
	S = lambda: next(seed)  # noqa: E731

	# ════════ 正面：枪之柱（0–22 小节）════════

	# 山顶的风：一直吹到第 22 小节世界暗下去（第 8 小节全乐队进来时略大）
	d = bt(22, 2)
	tt = tvec(d)
	ramp = np.interp(tt, [0, 2.0, bt(8) - 0.2, bt(8) + 1, bt(16), bt(21), bt(22), d], [0, 0.55, 0.55, 0.85, 0.75, 0.6, 0.15, 0])
	gust = 0.75 + 0.25 * np.sin(2 * np.pi * 0.21 * tt + 1) * np.sin(2 * np.pi * 0.09 * tt)
	w1 = sweep(d, 400, 900, S(), bw=1.3, fc=lambda x: 520 * 2 ** (0.6 * np.sin(2 * np.pi * 0.18 * x * d)))
	w2 = sweep(d, 1500, 3000, S(), bw=0.8, fc=lambda x: 1900 * 2 ** (0.5 * np.sin(2 * np.pi * 0.29 * x * d + 2)))
	add((w1 + 0.35 * w2) * ramp * gust, 0, 0.26, pan=0.3 * np.sin(2 * np.pi * 0.06 * tt), send=0.25, width=0.02)

	# 天上的两道口子：左边钴蓝（时间）每两拍一下深沉的脉动，右边珍珠（空间）发亮的颤音；
	# 第 12–16 小节随口子暗下去，第 22 小节没了
	d = bt(22, 1)
	tt = tvec(d)
	ra = np.interp(tt, [0, 1.5, bt(12), bt(16), bt(21), bt(22), d], [0, 1, 1, 0.45, 0.45, 0, 0])
	pulse = np.zeros(n_of(d))
	for k in range(int(d / (BEAT * 2)) + 1):
		p = thump(62, 50, 0.5, click=0.03, seed=S())
		i = n_of(k * BEAT * 2)
		m = min(len(p), len(pulse) - i)
		if m > 0:
			pulse[i : i + m] += p[:m]
	add(pulse * ra, 0, 0.16, pan=-0.6, send=0.3)
	shim = osc(2093 * (1 + 0.006 * np.sin(2 * np.pi * 6.1 * tt)), d) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * tt)) + 0.5 * osc(3136 * (1 + 0.007 * np.sin(2 * np.pi * 4.7 * tt)), d)
	add(shim * ra, 0, 0.03, pan=0.6, send=0.6)

	# 锁链：绷着、偶尔吱嘎一下（第 0–10 小节）
	r = rng(S())
	tc = 0.5
	while tc < s(LUNGE):
		tc += r.exponential(1.4)
		if tc >= s(LUNGE):
			break
		f0 = r.uniform(90, 150)
		cr = sweep(0.35, f0 * 3, f0 * 5, S(), bw=0.3) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * r.uniform(25, 40) * tvec(0.35)))) * env_swell(n_of(0.35), 0.3)
		add(cr, tc, 0.06, pan=r.choice([-0.55, 0.55]), send=0.25)
		if r.uniform() < 0.5:
			add(clink(r.uniform(1500, 2400), 0.3, S()), tc + 0.05, 0.05, pan=r.choice([-0.4, 0.4]), send=0.4)

	# 1.2：地上多了第三个影子——倒吸进来的一口暗气 + 极低的暗红嗡鸣
	o = bt(1, 2)
	add(reverse(lp(noise(1.4, S()), 500) * env_ad(n_of(1.4), 0.01, 0.9)), o - 1.2, 0.35, send=0.3)
	d = bt(4) - o
	tt = tvec(d)
	hum = osc(55, d) + 0.45 * osc(82.6, d) + 0.2 * osc(110.4, d)
	add(lp(hum, 300) * env_swell(n_of(d), 0.5, 1.2, 1.5) * (0.85 + 0.15 * np.sin(2 * np.pi * 2.3 * tt)), o, 0.22, pan=0.2, send=0.2)

	# 4.0：片名（镜像的金字翻成珍珠白）——翻面的气流，翻正那一下一声玻璃铃
	add(sweep(0.9, 500, 2600, S(), bw=0.7) * env_swell(n_of(0.9), 0.6), s(TITLE + 4), 0.28, pan=np.linspace(0.4, -0.4, n_of(0.9)), send=0.35)
	add(reverse(bell(1568, 1.2)) * 0.8, s(TITLE + 17) - 1.2, 0.14, send=0.5)
	add(bell(1568, 2.6), s(TITLE + 17), 0.22, send=0.65)
	add(bell(2349, 2.0), s(TITLE + 17) + 0.04, 0.1, pan=0.3, send=0.7)
	# 5.2→6.0：片名落下
	d = bt(6) - bt(5, 2)
	add(sweep(d, 2000, 350, S(), bw=0.8) * env_swell(n_of(d), 0.7, 1.5, 2), bt(5, 2), 0.2, send=0.3)

	# 7.2 → 8.0：影子立起来之前，倒放的气流往上收
	d = bt(8) - bt(7, 2)
	add(reverse(sweep(d, 200, 2400, S(), bw=0.9)) * env_swell(n_of(d), 0.92, 2, 6), bt(7, 2), 0.3, send=0.25)
	# 8.0：影子从地上立起来——一记很深的低音 + 往上爬的暗色气声
	add(thump(44, 24, 2.6, click=0.15, seed=S()), bt(8), 0.85, send=0.3)
	d = 1.6
	add(sweep(d, 120, 900, S(), bw=1.1, curve=0.7) * env_ad(n_of(d), 0.08, 1.0), bt(8), 0.4, pan=0.25, send=0.35, width=0.012)
	add(lp(osc(55, 2.5) + 0.45 * osc(82.6, 2.5), 260) * env_ad(n_of(2.5), 0.2, 1.6), bt(8), 0.25, pan=0.25)

	# 10.2：影子扑上赤日——急促的扑声 → 第 8 帧撞上（震动）→ 一起沉进地里（倒吸）
	o = s(LUNGE)
	add(sweep(0.3, 600, 3500, S(), bw=0.7) * env_ad(n_of(0.3), 0.01, 0.2), o, 0.4, pan=np.linspace(0.4, 0, n_of(0.3)), send=0.25)
	add(thump(58, 26, 1.8, click=0.4, seed=S()), o + 8 / 30, 0.8, send=0.3)
	add(lp(noise(1.2, S()), 900) * env_ad(n_of(1.2), 0.005, 0.5), o + 8 / 30, 0.35, send=0.4)
	d = (18 - 7) / 30 + 0.4
	add(reverse(sweep(d, 300, 2200, S(), bw=0.9)) * env_swell(n_of(d), 0.8, 1.5, 4), o + 7 / 30, 0.3, send=0.3)
	# 锁链松开、落下：一串哗啦（LUNGE+10 → 第 12 小节）
	d = bt(12) - (o + 10 / 30)
	r = rng(S())
	tc = 0.0
	while tc < d:
		tc += r.exponential(0.04 + 0.12 * tc / d)
		add(clink(r.uniform(1200, 2600), 0.3, S()), o + 10 / 30 + tc, 0.1 * r.uniform(0.4, 1) * (1 - 0.6 * tc / d), pan=r.uniform(-0.5, 0.5), send=0.35)
	add(thump(110, 60, 0.4, click=0.5, seed=S()), bt(12) - 0.1, 0.25, pan=-0.3, send=0.3)
	# 口子张开（OPEN → +16 帧）：金色的共鸣涨起来，边缘噼啪；之后一直有很低的金色嗡声
	o = s(OPEN)
	gold_chord = sum(osc(f * (1 + 0.004 * k), 3.0) for k, f in enumerate((98, 146.8, 196, 293.7)))
	add(lp(gold_chord, 1200) * env_ad(n_of(3.0), 0.5, 2.2), o, 0.12, send=0.5)
	add(sparkle(1.4, S(), rate=60, lo=1200, hi=5000, ramp=lambda u: 1 - u), o, 0.16, send=0.4, width=0.008)
	d = bt(22, 1) - (o + 1.5)
	tt = tvec(d)
	ph = np.interp(tt, [0, 1, bt(20, 2) - (o + 1.5), d], [0, 1, 1, 0])
	add(drone([73.4, 110, 146.8], d, S(), lpf=600) * ph, o + 1.5, 0.07, send=0.3)
	# 石柱被扭弯（OPEN+6 → 13.2）：低沉的石头呻吟，两三声
	for k, (t0, d, f0) in enumerate(((s(OPEN + 6), 1.6, 160), (bt(12, 1), 1.4, 130), (bt(13), 1.2, 110))):
		add(grind(d, S(), f0, f0 * 0.6) * env_swell(n_of(d), 0.3), t0, 0.32, pan=(-0.4, 0.4, 0)[k], send=0.35)

	# 14.0：竹兰走进来——四步很轻的脚步
	for k in range(4):
		add(footstep(S()), bt(14) + k * 0.22, 0.14 * (1 - 0.12 * k), pan=-0.5 + 0.12 * k, send=0.2)
	# 15.0→16.0：骑拉帝纳从口子里升起——暗色的上扬（倒放铃 + 低频涨上来）
	d = bt(16) - bt(15)
	add(sweep(d, 150, 3200, S(), bw=0.8, curve=1.6) * env_swell(n_of(d), 0.97, 2, 10), bt(15), 0.35, send=0.25)
	add(rumble(d, S(), 36) * env_swell(n_of(d), 0.97, 2, 10), bt(15), 0.35)
	add(reverse(bell(1046.5, 1.8)) * 0.9, bt(16) - 1.8, 0.2, send=0.6)
	# 16.0：显色 + 叫声——只用超低频的落地和极高的金色亮点；名称卡逐字浮现
	add(thump(42, 24, 2.4, click=0.0, seed=S()), bt(16), 0.75, send=0.25)
	add(hp(sparkle(1.6, S(), rate=50, lo=6000, hi=12000, ramp=lambda u: max(0, 1 - u)), 4500), bt(16), 0.3, send=0.6, width=0.01)
	add(ticks([0, BEAT * 0.25, BEAT * 0.5, BEAT * 0.75], S(), f=3400, d=0.02), s(REVEAL + 4) + 0.6, 0.12, pan=-0.6, send=0.3)
	# 20.0→22.0：镜头绕到口子侧面、升到正上方——两段风
	for a, b, p0, p1 in ((bt(20), bt(21), 0.5, -0.3), (bt(21), bt(22), -0.3, 0.2)):
		d = b - a
		add(sweep(d, 300, 1400, S(), bw=0.9) * env_swell(n_of(d), 0.5, 1.5, 1.5), a, 0.22, pan=np.linspace(p0, p1, n_of(d)), send=0.3)
	# 20.2→21.3：骑拉帝纳淡出——一声倒放的铃收进去
	add(reverse(bell(784, 2.2)) * 0.8, bt(21, 3) - 2.2, 0.14, send=0.6)

	# ════════ 来历：一张纸（22–30 小节）════════

	# 22.0：广场变成一张纸——柔和的"呼"+ 纸声
	add(sweep(0.9, 250, 1200, S(), bw=1.1) * env_ad(n_of(0.9), 0.1, 0.5), bt(22), 0.25, send=0.45)
	add(rustle(0.6, S()), bt(22) + 0.05, 0.1, send=0.2)
	# 22.0+6 → 23.2：一点光分出三条线——三个音从同一个音分开（蓝往下、粉往上、金居中）
	o = bt(22, 0, 6)
	d = bt(23, 2) - o
	base = 523.3
	add(osc(glide(base, 261.6, d, 0.6), d, shape='tri') * env_ad(n_of(d), 0.02, d * 0.9), o, 0.07, pan=np.linspace(0, -0.6, n_of(d)), send=0.5)
	add(osc(glide(base, 1046.5, d, 0.6), d) * env_ad(n_of(d), 0.02, d * 0.9), o, 0.05, pan=np.linspace(0, 0.6, n_of(d)), send=0.6)
	add(osc(glide(base, 392, d, 0.6), d) * env_ad(n_of(d), 0.02, d * 0.9), o, 0.05, send=0.55)
	add(bell(base, 2.2, a=0.02), bt(22) + 0.05, 0.12, send=0.7)
	# 纸外一圈石板浮现：稀疏、很轻的石片碰撞（高频，不碰叫声的中频）
	r = rng(S())
	for k in range(9):
		t0 = bt(22) + 0.3 + k * 0.32 + r.uniform(0, 0.12)
		add(hp(clink(r.uniform(2800, 4200), 0.25, S()), 2200), t0, 0.05, pan=r.uniform(-0.9, 0.9), send=0.5)
	# 24.2：金线被推出纸边——往下滑的金色滑音，滑到纸边一声暗金的铃
	d = 26 / 30
	add(osc(glide(392, 196, d, 1.4), d) * env_swell(n_of(d), 0.2, 1.2, 1.2), s(PUSH), 0.1, pan=np.linspace(0, 0.3, n_of(d)), send=0.5)
	add(sweep(d, 1800, 500, S(), bw=0.5) * env_swell(n_of(d), 0.4), s(PUSH), 0.12, send=0.35)
	add(bell(293.7, 2.6, partials=((1, 1, 1), (2.76, 0.4, 0.6), (5.4, 0.2, 0.3)), a=0.004), s(PUSH + 12), 0.14, pan=0.3, send=0.8)
	# 25.2：石板原文——留白，只有很低的金色底
	d = bt(27) - bt(25, 2)
	add(drone([73.4, 110], d, S(), lpf=400) * env_swell(n_of(d), 0.5, 1.5, 1.5), bt(25, 2), 0.06, send=0.4)
	# 27.0：神话只写了时间和空间——两边的神变亮（一层轻轻的和声），三点湖光（三声小铃）
	d = bt(28, 2) - bt(27)
	add(drone([196, 293.7, 392], d, S(), lpf=1800) * env_swell(n_of(d), 0.4, 1.5, 2), bt(27), 0.05, send=0.6)
	for k, f in enumerate((2637, 3136, 3520)):
		add(bell(f, 1.4), s(TWO + 6 + k * 4), 0.1, pan=(-0.3, 0.1, 0.4)[k], send=0.6)
	# 28.2：一道红光从纸背撕开又合上（洗翠的裂缝）
	add(tear(0.7, S(), 2600, 500), s(TEAR_PAPER), 0.45, pan=-0.1, send=0.35)
	add(thump(85, 45, 0.6, click=0.3, seed=S()), s(TEAR_PAPER), 0.3, send=0.3)
	add(reverse(tear(0.5, S(), 2000, 600)) * 0.7, s(TEAR_PAPER + 40) - 0.5, 0.25, send=0.35)
	# 29.0：纸上重新画回广场——一串很快的笔触
	ts = [0.035 * k + 0.01 * (k % 3) for k in range(18)]
	add(hp(ticks(ts, S(), f=2400, d=0.02), 1500), bt(29), 0.07, pan=0.1, send=0.3)
	add(rustle(0.7, S(), rate=300), bt(29), 0.07, send=0.2)
	# 29.2 → 30.0：翻面前的上扬
	d = bt(30) - bt(29, 2)
	add(sweep(d, 300, 5000, S(), bw=0.8, curve=1.8) * env_swell(n_of(d), 0.98, 2.4, 12), bt(29, 2), 0.35, send=0.25)
	# 30.0：整张纸翻过去（22 帧，纸侧对镜头时一道金光）
	o = s(FLIP)
	d = 22 / 30
	add(sweep(d + 0.2, 400, 2200, S(), bw=1.0) * env_swell(n_of(d + 0.2), 0.5), o, 0.45, pan=np.linspace(-0.5, 0.5, n_of(d + 0.2)), send=0.3, width=0.01)
	add(rustle(d, S(), rate=400), o, 0.14, send=0.2)
	add(thump(52, 26, 2.0, click=0.3, seed=S()), o + 11 / 30, 0.7, send=0.3)
	add(bell(392, 3.5, a=0.003), o + 11 / 30, 0.16, send=0.8, width=0.012)
	add(hp(shatter(1.0, S(), density=40, lo=4000, hi=10000), 3000), o + 11 / 30, 0.2, send=0.6, width=0.01)

	# ════════ 背面：毁坏的世界（30–58 小节）════════

	# 30.2→31.2：从口子钻下去——往下冲的气流
	d = bt(31, 2) - bt(30, 2)
	add(sweep(d, 3000, 300, S(), bw=0.8) * env_swell(n_of(d), 0.55, 1.5, 2), bt(30, 2), 0.5, send=0.25, width=0.012)
	add(reverse(bell(1046.5, 2.0)) * 0.8, bt(31, 1) - 2.0, 0.12, send=0.7)

	# 背面的底：一直延续到第 61 小节（第 41–44 小节最空，53.0 整个抽走，56.2 起和声舒展开）
	a0 = bt(31)
	d = bt(61, 2) - a0
	tt = tvec(d)
	ga = np.interp(
		tt + a0,
		[a0, bt(32), bt(40), bt(41), bt(44), bt(45), bt(52), bt(53), bt(53, 1), bt(54), bt(54, 1), bt(56, 2), bt(60, 2), bt(61, 2)],
		[0, 1, 1, 0.35, 0.35, 0.8, 1, 1, 0.05, 0.05, 0.9, 0.8, 0.6, 0],
	)
	low = drone([49, 73.4, 98], d, S(), lpf=420)
	add(low * ga, a0, 0.12, send=0.35)
	# 云涡：慢慢打转的气流（左右来回）
	swirl = sweep(d, 300, 700, S(), bw=1.4, fc=lambda u: 450 * 2 ** (0.5 * np.sin(2 * np.pi * 0.05 * u * d)))
	add(swirl * ga, a0, 0.12, pan=0.6 * np.sin(2 * np.pi * 0.04 * tt), send=0.45, width=0.02)
	# 倒放的铃：背面世界里零星的回声（第 41–44 小节更稀）
	r = rng(S())
	tc = bt(32)
	while tc < bt(58):
		tc += r.exponential(2.6 if not (bt(41) <= tc < bt(44)) else 4.5)
		if bt(52) - 1 < tc < bt(55, 2) or tc >= bt(58):
			continue
		f = r.choice([392, 523.3, 587.3, 784, 880, 1174.7])
		b = reverse(bell(f, 1.6, a=0.003))
		add(b, tc - 1.6, 0.07 * r.uniform(0.5, 1), pan=r.uniform(-0.8, 0.8), send=0.75, width=0.01)

	# 31.2→36.0：退开看全景——大片的风
	d = bt(36) - bt(31, 2)
	add(sweep(d, 250, 900, S(), bw=1.0) * env_swell(n_of(d), 0.5, 1.2, 1.5), bt(31, 2), 0.18, pan=np.linspace(0.3, -0.4, n_of(d)), send=0.35)
	# 36.0→37.2：贴近浮岛
	d = bt(37, 2) - bt(36)
	add(sweep(d, 400, 1300, S(), bw=0.9) * env_swell(n_of(d), 0.6), bt(36), 0.18, pan=np.linspace(-0.4, 0.5, n_of(d)), send=0.3)
	# 37.0→38.0：横滚 90°（墙变地面）——声音跟着绕半圈；39.2→40.2 转回来
	for a, b, p0, p1 in ((bt(37), bt(38), -0.8, 0.8), (bt(39, 2), bt(40, 2), 0.8, -0.8)):
		d = b - a
		add(sweep(d, 500, 1600, S(), bw=0.8, fc=lambda u: 600 * 2 ** (1.3 * np.sin(np.pi * u))) * env_swell(n_of(d), 0.5, 1.4, 1.4), a, 0.26, pan=np.linspace(p0, p1, n_of(d)), send=0.3, width=0.01)
	# 37.2→40.0：倒挂、往上流的瀑布——倒放的水声
	d = bt(40) - bt(37, 2)
	water = reverse(bp_noise(d, S(), 900, 6000) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 7.3 * tvec(d)))))
	add(water * env_swell(n_of(d), 0.5, 1.5, 1.5), bt(37, 2), 0.08, pan=0.4, send=0.4)
	add(reverse(sparkle(d, S(), rate=30, lo=1500, hi=5000)), bt(37, 2), 0.08, pan=0.4, send=0.5)
	# 41.0：远处独自一个的骑拉帝纳——一声很远的低铃
	add(bell(196, 5.0, partials=((1, 1, 1), (2.76, 0.3, 0.6)), a=0.02), bt(41), 0.1, pan=-0.2, send=0.95)

	# 44.0：到了最深处的岛
	add(thump(70, 40, 0.9, click=0.1, seed=S()), bt(44), 0.3, send=0.35)
	# 45.0→47.2：一张纸在赤日身旁慢慢转一圈——纸声跟着左右转
	d = bt(47, 2) - bt(45)
	tt = tvec(d)
	add(rustle(d, S(), rate=60) * env_swell(n_of(d), 0.5, 1, 1), bt(45), 0.08, pan=np.sin(2 * np.pi * tt / d) * 0.6, send=0.3)
	add(sweep(d, 500, 900, S(), bw=1.0) * env_swell(n_of(d), 0.5), bt(45), 0.08, pan=np.sin(2 * np.pi * tt / d) * 0.6, send=0.4)
	# 47.2："撕掉一面"——纸从中间撕开，两半往两边漂
	o = s(SHEET_TEAR)
	add(tear(0.9, S(), 4200, 700), o, 0.55, send=0.3, width=0.008)
	add(thump(95, 50, 0.5, click=0.4, seed=S()), o, 0.3, send=0.3)
	add(sweep(1.0, 900, 300, S(), bw=0.8) * env_ad(n_of(1.0), 0.02, 0.6), o + 0.1, 0.18, pan=np.linspace(0, 0.6, n_of(1.0)), send=0.3)
	add(sweep(1.0, 900, 300, S(), bw=0.8) * env_ad(n_of(1.0), 0.02, 0.6), o + 0.12, 0.18, pan=np.linspace(0, -0.6, n_of(1.0)), send=0.3)
	# 49.0：缝回去（倒放的撕裂）→ 中间开出口子（金色的共鸣）→ 整张扭曲
	o = s(MEND)
	add(reverse(tear(0.6, S(), 4200, 700)), o - 0.6, 0.4, send=0.3)
	add(bell(293.7, 3.0, a=0.003), o, 0.14, send=0.7)
	add(lp(gold_chord, 1200) * env_ad(n_of(3.0), 0.3, 2.0), o + 4 / 30, 0.08, send=0.5)
	d = bt(50, 2) - (o + 6 / 30)
	tt = tvec(d)
	add(sweep(d, 300, 900, S(), bw=0.6, fc=lambda u: 500 * 2 ** (0.7 * np.sin(2 * np.pi * 2.0 * u))) * env_swell(n_of(d), 0.6), o + 6 / 30, 0.16, pan=0.5 * np.sin(2 * np.pi * 1.3 * tt), send=0.3)
	# 50.2→52.0：它从上方降下——推到 52.0 的上扬
	d = bt(52) - bt(50, 2)
	add(sweep(d, 200, 5000, S(), bw=0.7, curve=2.0) * env_swell(n_of(d), 0.99, 2.6, 25), bt(50, 2), 0.42, send=0.25, width=0.01)
	add(osc(glide(98, 392, d, 1.8), d, shape='saw') * env_swell(n_of(d), 0.99, 2.6, 25), bt(50, 2), 0.05, send=0.3)
	add(rumble(d, S(), 32) * env_swell(n_of(d), 0.99, 2.4, 25), bt(50, 2), 0.38)

	# 52.0：起源形态显色 + 叫声——超低频落地 + 高处的金色亮点，中频留给叫声
	o = s(ORIGIN)
	add(thump(40, 22, 2.6, click=0.0, seed=S()), o, 0.85, send=0.3)
	add(hp(sparkle(1.4, S(), rate=60, lo=6000, hi=12000, ramp=lambda u: max(0, 1 - u)), 4500), o, 0.3, send=0.6, width=0.012)
	# 52.2→53.0：它要消失——所有声音被抽走（倒放的气流收在 53.0）
	o = s(VANISH)
	add(reverse(sweep(0.9, 300, 6000, S(), bw=1.0)) * env_swell(n_of(0.9), 0.9, 2, 8), o - 0.9, 0.45, send=0.15)
	# 53.0–54.0：全片最暗的一拍——只剩几点暗红：很低、很慢的两下心跳
	for k in range(2):
		add(thump(48, 38, 0.4, click=0.0, seed=S()), o + 0.25 + k * BEAT * 1.6, 0.35, send=0.15)
	add(lp(noise(bt(54) - o, S()), 200) * env_swell(n_of(bt(54) - o), 0.5), o, 0.06)
	# 54.0：从暗处出手（全片最大爆发）+ 第二次叫声——先抽一口气，再炸开；中频压低
	o = s(STRIKE)
	add(reverse(sweep(0.45, 400, 9000, S(), bw=1.0)) * env_swell(n_of(0.45), 0.92, 2, 8), o - 0.45, 0.55, send=0.2)
	add(thump(40, 17, 4.0, click=0.5, seed=S()), o, 1.4, send=0.35)
	add(lp(noise(2.4, S()), 300, 2) * env_ad(n_of(2.4), 0.005, 1.0), o, 0.8, send=0.4)
	add(hp(shatter(2.2, S(), density=140, lo=3500, hi=11000), 3000), o, 0.5, send=0.6, width=0.015)
	tt = tvec(4.0)
	ring = (osc(1661, 4.0) * osc(41, 4.0) + 0.6 * osc(2489, 4.0) * osc(59, 4.0)) * np.exp(-tt / 1.3)
	add(ring, o + 1.0, 0.07, send=0.85, width=0.02)  # 叫声过后才浮起来
	add(sweep(1.8, 4000, 160, S(), bw=1.0) * env_ad(n_of(1.8), 0.01, 0.9), o + 0.05, 0.25, send=0.3, width=0.025)

	# ════════ 它的两个样子（55–72 小节）════════

	# 56.2→58.2：扭曲停了下来——背面的低音慢慢舒展成和弦，远处断柱直回来的一声石响
	d = bt(58, 2) - bt(56, 2)
	add(drone([98, 146.8, 196, 246.9], d + 2, S(), lpf=900) * env_swell(n_of(d + 2), 0.55, 1.5, 2), bt(56, 2), 0.05, send=0.6)
	add(reverse(grind(1.4, S(), 110, 170)) * env_swell(n_of(1.4), 0.7), bt(57), 0.16, pan=-0.3, send=0.6)
	# 58.2：它沉回深处——往下的暗色气流
	d = 1.4
	add(sweep(d, 1200, 160, S(), bw=0.9) * env_swell(n_of(d), 0.3, 1.2, 1.5), bt(58, 2), 0.3, pan=-0.2, send=0.35)
	add(thump(70, 35, 1.2, click=0.0, seed=S()), bt(58, 2) + 0.9, 0.2, send=0.4)
	# 58.2→61.2：镜头一路升上去（穿过浮岛，越升越亮）
	d = bt(61, 2) - bt(58, 3)
	add(sweep(d, 220, 2400, S(), bw=0.9, curve=1.3) * env_swell(n_of(d), 0.75, 1.3, 2), bt(58, 3), 0.32, send=0.25, width=0.012)
	for t0, p in ((bt(59, 1), 0.6), (bt(59, 3), -0.5), (bt(60, 1), 0.4)):  # 擦过浮岛
		add(sweep(0.5, 700, 1800, S(), bw=0.6) * env_swell(n_of(0.5), 0.5), t0, 0.12, pan=p, send=0.3)
	# 60.0：天花板下（地面的背面），起源形态倒挂——金色的低和声
	d = bt(61, 2) - bt(60)
	add(lp(gold_chord[: n_of(3.0)], 1400) * env_swell(n_of(3.0), 0.4, 1.4, 1.5), bt(60), 0.1, send=0.6)
	# 60.2→61.2：正面重新亮起来——珍珠白的玻璃和声浮上来（一直到 66.2，镜头离开镜面时收）
	a0 = bt(60, 2)
	d = bt(67, 2) - a0
	tt = tvec(d)
	pe = np.interp(tt + a0, [a0, bt(61, 2), bt(66, 2), bt(67, 2)], [0, 1, 1, 0])
	pearl = sum(osc(f * (1 + 0.003 * np.sin(2 * np.pi * 0.27 * tt + k)), d) for k, f in enumerate((1174.7, 1568.0, 1975.5)))
	add(pearl * pe, a0, 0.018, pan=0.2, send=0.8, width=0.015)
	# 61.0：别种形态刻出来——细密的刻线声
	d = 20 / 30 + 0.6
	add(hp(sparkle(d, S(), rate=220, lo=3000, hi=8000, ramp=lambda u: math.sin(math.pi * u)), 2500), s(ALTERED_IN), 0.08, send=0.4, width=0.008)
	# 61.2：镜头到了地面的高度，地面成了一道镜面线——一声前后对称的镜面音
	mt = mirror_tone(784, 2.2)
	add(mt, bt(61, 2) - 2.2, 0.16, send=0.7, width=0.012)
	add(mirror_tone(1174.7, 1.8), bt(61, 2) - 1.8, 0.07, send=0.8, width=0.012)
	# 62.2–66.2：镜面上很轻的持续音（左右各一半：上面珍珠、下面金）
	d = bt(66, 2) - bt(62, 2)
	tt = tvec(d)
	add(osc(392 * (1 + 0.002 * np.sin(2 * np.pi * 0.2 * tt)), d) * env_swell(n_of(d), 0.5, 1.5, 1.5), bt(62, 2), 0.035, pan=-0.3, send=0.6)
	add(osc(98 * (1 + 0.002 * np.sin(2 * np.pi * 0.17 * tt)), d, shape='tri') * env_swell(n_of(d), 0.5, 1.5, 1.5), bt(62, 2), 0.05, pan=0.3, send=0.4)
	# 63.0：别种形态显色，一道金光沿镜面线从左走到右（50 帧）
	o = s(ALTERED_REVEAL)
	d = 50 / 30
	add(osc(glide(1568, 2349, d), d) * env_swell(n_of(d), 0.5) * 0.4 + sweep(d, 2500, 3800, S(), bw=0.35) * env_swell(n_of(d), 0.5), o, 0.16, pan=np.linspace(-0.9, 0.9, n_of(d)), send=0.55)
	add(sparkle(1.6, S(), rate=30, lo=4000, hi=10000, ramp=lambda u: 1 - u), o, 0.1, send=0.6, width=0.01)
	add(thump(60, 40, 1.0, click=0.0, seed=S()), o, 0.2, send=0.3)
	# 66.2→67.2：镜头升到地面上方，地面重新合上——背面的声音被闷住（低通往下收）、一声很轻的落定
	d = bt(67, 2) - bt(66, 2)
	add(sweep(d, 900, 120, S(), bw=0.9) * env_swell(n_of(d), 0.3, 1.2, 2), bt(66, 2), 0.18, send=0.3)
	add(thump(80, 50, 0.7, click=0.1, seed=S()), bt(67, 2), 0.18, send=0.4)
	# 67.0–72：正面的风回来（很轻）
	a0 = bt(67)
	d = TOTAL - a0
	tt = tvec(d)
	wa = np.interp(tt, [0, 2, d - 3, d], [0, 0.45, 0.35, 0])
	add(sweep(d, 450, 900, S(), bw=1.3, fc=lambda x: 520 * 2 ** (0.5 * np.sin(2 * np.pi * 0.2 * x * d))) * wa, a0, 0.2, pan=0.3 * np.sin(2 * np.pi * 0.07 * tt), send=0.3, width=0.02)
	# 69.0："另一面，留在了世界的背面"——一声珍珠白的铃，底下很轻地跟一声倒放的金（背面），随片尾淡出
	add(bell(1046.5, 3.5, partials=((1, 1, 1), (2.0, 0.3, 0.6), (3.01, 0.15, 0.4)), a=0.02), bt(69), 0.12, send=0.75)
	add(reverse(bell(261.6, 2.4, partials=((1, 1, 1), (2.76, 0.3, 0.6)), a=0.003)) * 0.9, bt(69) + 0.3, 0.1, send=0.8)

	return M


def main():
	M = build()
	out = M.render()
	write(os.path.join(OUT, 'reverse-sfx.wav'), out)
	for k, (a, b) in enumerate(PARTS, 1):
		write(os.path.join(OUT, 'sfx', f'reverse-part{k}-sfx.wav'), out[n_of(a / 30) : n_of(b / 30)])
	print('done', out.shape[0] / SR, 's')


if __name__ == '__main__':
	main()
