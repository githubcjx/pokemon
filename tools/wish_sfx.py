"""合成《迎着流星》v3 的独立音效轨。用法：python tools/wish_sfx.py

时间用整期 30fps 帧号。四段 WAV 对应 01–04 的 60fps v3 成片，从各自第 0 帧对齐。
先混整期，再按采样切开，保留过场的风声和混响。成片里的游戏叫声由视频提供。
"""

from itertools import count
from pathlib import Path
from tempfile import TemporaryDirectory
import wave

import numpy as np

from space_sfx import (
    Mix, SR, bell, bp, env_ad, env_swell, glide, noise, norm,
    osc, rng, sparkle, sweep, tear, thump, tvec,
)


FPS = 30
CUTS = (0, 437, 1890, 4420, 7912)  # hook / part1 / part2 / part3 / end
OUT = Path(__file__).resolve().parents[1] / "out" / "迎着流星"
STEMS = ("wish-hook-sfx-v3", "wish-part1-sfx-v3", "wish-part2-sfx-v3", "wish-part3-sfx-v3")
IMPACT = 6987


class Track:
    def __init__(self):
        self.mix = Mix(CUTS[-1] / FPS)
        self.seeds = count(38400, 19)

    def seed(self):
        return next(self.seeds)

    def put(self, frame, sound, gain, *, pan=0, send=.12):
        # 每个素材独立消除边缘的点击声。分段时直接切混好的信号。
        fade_in = min(72, len(sound))
        fade_out = min(960, len(sound))
        sound[:fade_in] *= np.linspace(0, 1, fade_in)
        sound[-fade_out:] *= np.linspace(1, 0, fade_out) ** 2
        self.mix.add(sound, frame / FPS, gain, pan=pan, send=send)

    def air(self, points, band, gain, *, pan=0, send=.09):
        """按镜头的明暗和距离调制环境声。左右各自有独立的气流。"""
        frames, levels = zip(*points)
        duration = (frames[-1] - frames[0]) / FPS
        t = tvec(duration)
        seed = self.seed()
        texture = bp(noise(duration, seed), *band)
        texture *= .27 / np.sqrt(np.mean(texture**2))
        gusts = np.arange(0, duration + 1.2, 1.2)
        flutter = np.interp(t, gusts, rng(seed + 1).uniform(.66, 1, len(gusts)))
        envelope = np.interp(t * FPS + frames[0], frames, levels)
        self.put(frames[0], texture * flutter * envelope, gain, pan=pan, send=send)

    def pass_by(self, start, crest, end, tones, gain, *, pan=(-.5, .5), grit=.16, send=.12):
        """擦过镜头的风压，接近时变亮，通过后迅速降低音色。"""
        duration = (end - start) / FPS
        peak = (crest - start) / (end - start)
        air = sweep(
            duration, tones[0], tones[-1], self.seed(), bw=.84,
            fc=lambda u: np.exp(np.interp(u, [0, peak, 1], np.log(tones))),
        )
        rasp = norm(bp(noise(duration, self.seed()), 1100, 6100))
        env = env_swell(len(air), peak, 1.07, 1.55)
        self.put(start, (air + grit * rasp * env) * env, gain,
                 pan=np.linspace(*pan, len(air)), send=send)

    def hit(self, frame, gain, *, hz=(97, 39), duration=1.1, pan=0, grit=.24, send=.13):
        """低频重量、可在小扬声器上听见的震动和一小层碎屑。"""
        t = tvec(duration)
        body = thump(*hz, duration, click=0)
        knock = norm(bp(noise(duration, self.seed()), hz[0] * 1.25, hz[0] * 5))
        chips = norm(bp(noise(duration, self.seed()), 510, 3600))
        sound = body + .46 * knock * np.exp(-t / (duration * .27))
        sound += grit * chips * np.exp(-t / (duration * .09))
        self.put(frame, sound, gain, pan=pan, send=send)

    def glint(self, frame, hz, duration, gain, *, pan=0, send=.26):
        partials = ((1, 1, 1), (1.47, .36, .45), (2.19, .2, .27), (3.91, .11, .18))
        self.put(frame, bell(hz, duration, partials, a=.012), gain, pan=pan, send=send)


def failed_light(track, start, end, pan):
    """希嘉娜的红石先亮后暗。两次都把气声收窄，留一小段空白。"""
    track.glint(start, 773, 1.2, .040, pan=pan, send=.22)
    duration = (end - start) / FPS
    t = tvec(duration)
    air = sweep(duration, 710, 175, track.seed(), bw=.59)
    glass = osc(glide(361, 177, duration, .85), duration)
    sputter = .74 + .26 * np.sin(2 * np.pi * (6.3 * t + .85 * t * t))
    dying = (air * .62 + glass * .25) * sputter * env_swell(len(t), .24, 1.15, 2.5)
    track.put(start, dying, .145, pan=pan, send=.10)


def evolution(track, start, at, strength, *, flash_hz, send):
    """虹彩聚拢、白光峰值、标志落定、光尘散开。峰值白光比标志早 10 帧。"""
    flash = at - 10
    duration = (flash - start) / FPS
    t = tvec(duration)
    rise = env_swell(len(t), .97, 1.45, 1.2)
    tremolo = .64 + .36 * np.sin(2 * np.pi * (4.2 * t + 3.9 * t * t / duration))
    for pan, tones in ((-.52, (265, 3650)), (.50, (435, 5230))):
        air = sweep(duration, *tones, track.seed(), bw=.75, curve=1.25)
        ring = osc(glide(tones[0] * 1.2, tones[1] * .69, duration, 1.4), duration)
        track.put(start, (air + .15 * ring * tremolo) * rise, .26 * strength,
                  pan=np.linspace(pan, pan * .29, len(t)), send=send)

    flash_noise = norm(bp(noise(.32, track.seed()), *flash_hz))
    track.put(flash, flash_noise * env_ad(len(flash_noise), .006, .08), .29 * strength, send=send)
    track.hit(at, .62 * strength, hz=(64, 32), duration=1.15, grit=.035, send=.08)
    track.glint(at, 1922, .48, .102 * strength, pan=.11, send=send)
    for pan in (-.61, .61):
        grains = sparkle(1.12, track.seed(), rate=38, lo=5700, hi=9600, ramp=lambda u: 1 - .95 * u)
        track.put(at + 10, grains * env_swell(len(grains), .22, 1, 2.5),
                  .098 * strength, pan=pan, send=send)


def hook(track):
    # 0–437，火尾右入左出 → 塔顶红石 → 龙影擦过 → 失光 → 片名。
    track.air([(0, .45), (71, .86), (168, 1), (239, .81), (306, .17),
               (346, .09), (423, .44), (477, .79), (532, 0)], (106, 643), .115, pan=-.28)
    track.air([(0, .34), (128, .76), (231, .63), (286, .11), (393, .18),
               (484, .69), (532, 0)], (1350, 3950), .058, pan=.44)
    track.pass_by(0, 56, 151, (338, 1350, 155), .54, pan=(.68, -.67), grit=.33)
    track.air([(0, .62), (56, 1), (106, .58), (166, 0)], (39, 178), .21, pan=.14)
    track.glint(153, 773, 1.36, .066, pan=.48)
    track.pass_by(176, 224, 273, (156, 508, 141), .31, pan=(.69, -.17), grit=.06)
    failed_light(track, 247, 330, .46)
    track.pass_by(344, 382, 427, (725, 3060, 930), .134, pan=(-.46, .43), grit=.08, send=.27)
    track.glint(365, 1269, 1.65, .100, pan=-.24, send=.32)
    track.glint(389, 1757, .93, .049, pan=.31, send=.32)


def upper(track):
    # 穿云和云上稀薄的风。烈空坐的叫声从 866 帧开始。
    track.pass_by(442, 502, 599, (171, 423, 236), .21, pan=(.25, -.17), grit=.11)
    track.air([(468, 0), (551, 1), (670, .78), (800, .63), (866, .32), (917, .55),
               (1085, .74), (1260, .42), (1395, .77), (1462, 0)], (122, 760), .105, pan=.26)
    track.air([(502, 0), (604, .56), (688, .72), (802, .86), (856, .18), (921, .65),
               (1113, .53), (1291, .40), (1380, .83), (1458, 0)], (1580, 4190), .064, pan=-.43)
    track.pass_by(785, 831, 859, (288, 1085, 355), .18, pan=(.66, .02), grit=.10)
    track.glint(873, 2670, .39, .040, pan=-.44)

    # 陨石小群在景深中交错，画面左侧来的一颗在 1065 帧被吞下。
    for start, crest, end, gain in ((911, 956, 1000, .19), (963, 1016, 1077, .095),
                                    (976, 1010, 1045, .15), (1092, 1128, 1190, .10)):
        track.pass_by(start, crest, end, (480, 1640, 390), gain, pan=(-.72, .73), grit=.25)
    track.pass_by(1002, 1055, 1065, (320, 2470, 1080), .28, pan=(-.79, .02), grit=.28)
    track.hit(1065, .28, hz=(166, 70), duration=.40, pan=.01, grit=.45)
    track.glint(1075, 841, .79, .084, pan=.13)
    for i in range(4):
        track.glint(1100 + i * 23, 973 + i * 81, .51, .042 + i * .007, pan=.06 + i * .082)
    track.air([(1067, 0), (1120, .45), (1198, 1), (1268, 0)], (190, 541), .18, pan=.20)

    # 固拉多的岩层在左，盖欧卡的水雾在右。先显色叫声，再打闪电和浪头。
    track.pass_by(1291, 1380, 1476, (260, 624, 109), .27, pan=(-.24, .37), grit=.12)
    track.air([(1393, 0), (1467, .76), (1520, .53), (1598, 1), (1661, .72),
               (1756, .17), (1899, 0)], (42, 261), .29, pan=-.49)
    track.air([(1421, 0), (1504, .62), (1547, .68), (1634, 1), (1694, .73),
               (1824, .18), (1925, 0)], (377, 1990), .16, pan=.50)
    track.hit(1484, .21, hz=(74, 34), duration=1.01, pan=-.49, grit=.10)
    track.pass_by(1453, 1507, 1515, (410, 1800, 760), .145, pan=(.71, .37), grit=.10)
    track.hit(1515, .14, hz=(102, 43), duration=.82, pan=.44, grit=.04)
    for frame, gain, pan in ((1570, .43, .33), (1629, .32, .51)):
        track.put(frame, tear(.54, track.seed(), 3800, 470), gain * .77, pan=pan, send=.15)
        track.hit(frame + 3, gain, hz=(97, 34), duration=1.8, pan=pan, grit=.19, send=.17)
    track.pass_by(1552, 1634, 1733, (204, 990, 276), .31, pan=(.71, -.38), grit=.33)
    track.pass_by(1628, 1687, 1766, (980, 2220, 290), .29, pan=(.18, -.13), grit=.10, send=.19)
    track.glint(1694, 917, 1.66, .068, send=.27)


def murals(track):
    # 内部石壁。声场缩窄，风和亮部变暗，壁画内的水声也带一点石室反射。
    track.pass_by(1905, 1972, 2050, (381, 653, 244), .18, pan=(.15, -.24), grit=.04, send=.24)
    track.air([(1890, 0), (1980, .66), (2133, .79), (2346, .50), (2570, .69),
               (2753, .59), (3120, .51), (3328, .79), (3465, .50), (3705, 0)],
              (93, 489), .124, pan=-.29, send=.24)
    for frame, freq, gain in ((2025, 710, .058), (2089, 829, .039), (2191, 518, .048)):
        crackle = norm(bp(noise(.19, track.seed()), freq, freq * 4))
        track.put(frame, crackle * env_ad(len(crackle), .007, .044), gain, pan=.44, send=.24)
    track.air([(2185, 0), (2278, 1), (2317, .87), (2398, .72), (2485, 0)],
              (47, 190), .24, pan=-.49, send=.18)
    track.hit(2346, .22, hz=(70, 36), duration=.96, pan=-.48, grit=.07, send=.19)
    track.pass_by(2318, 2374, 2384, (202, 1200, 560), .125, pan=(.57, .43), grit=.07, send=.15)
    track.hit(2384, .17, hz=(63, 36), duration=.98, pan=.51, grit=.03, send=.21)

    # 第一颗撞入瀑布，碎块从同一侧陆续落下。光从水底慢慢浮起来。
    track.air([(2458, 0), (2526, .59), (2592, .61), (2607, 1), (2689, .77),
               (2785, .39), (2938, .23), (3120, 0)], (360, 2800), .155, pan=.18, send=.26)
    track.pass_by(2471, 2578, 2603, (420, 1430, 390), .27, pan=(.67, .06), grit=.28, send=.18)
    track.hit(2603, .49, hz=(104, 39), duration=1.25, pan=.04, grit=.34, send=.20)
    track.air([(2603, 0), (2608, 1), (2620, .86), (2645, .40), (2681, 0)],
              (688, 4540), .49, pan=.10, send=.19)
    track.hit(2626, .20, hz=(148, 64), duration=.64, pan=.40, grit=.38, send=.20)
    track.hit(2648, .15, hz=(152, 68), duration=.44, pan=-.13, grit=.35, send=.20)
    track.pass_by(2652, 2723, 2792, (400, 1960, 550), .14, pan=(.16, -.05), grit=.04, send=.29)
    track.glint(2734, 1091, 1.60, .094, pan=.10, send=.36)
    track.glint(2756, 1472, .83, .040, pan=-.25, send=.30)
    track.pass_by(2818, 2901, 2973, (224, 898, 187), .31, pan=(-.30, .09), grit=.11, send=.23)
    track.air([(2910, 0), (2940, .64), (2980, .94), (3050, .60), (3130, 0)],
              (124, 541), .13, pan=.20, send=.24)

    # 第二颗砸进海里，先是钝重的一击，再是水体扩张和地裂。
    track.pass_by(3179, 3290, 3307, (262, 1420, 405), .35, pan=(-.69, .05), grit=.36, send=.14)
    track.hit(3307, .64, hz=(76, 29), duration=1.85, grit=.18, send=.18)
    track.air([(3307, 0), (3315, 1), (3327, .77), (3353, .43), (3404, 0)],
              (271, 1840), .46, pan=-.22, send=.23)
    for frame, pan, gain in ((3322, -.43, .16), (3340, .43, .22), (3362, .14, .12)):
        track.put(frame, tear(.70, track.seed(), 1120, 260), gain, pan=pan, send=.21)
    track.air([(3400, 0), (3442, .40), (3528, .81), (3580, 1), (3645, 0)],
              (185, 622), .14, pan=-.10, send=.26)
    track.pass_by(3444, 3517, 3597, (475, 1930, 603), .16, pan=(-.25, .23), grit=.04, send=.28)
    track.glint(3528, 866, 1.5, .099, pan=-.09, send=.36)
    track.glint(3567, 1372, 1.34, .063, pan=.18, send=.31)

    # 壁画褪去，超级进化。3836 帧同时有叫声，标志的重音留在低频。
    track.air([(3615, 0), (3697, .83), (3796, .74), (3824, .26), (3903, .26),
               (4006, .83), (4144, .37), (4222, .53), (4295, .74), (4478, 0)],
              (98, 534), .135, pan=.29)
    track.air([(3680, 0), (3783, .43), (3836, .15), (3920, .49), (4133, .80),
               (4310, .68), (4503, 0)], (1290, 3420), .08, pan=-.41)
    evolution(track, 3729, 3836, .90, flash_hz=(3450, 8360), send=.24)
    track.pass_by(3943, 4038, 4148, (282, 755, 251), .113, pan=(-.18, .42), grit=.06)
    track.pass_by(4263, 4295, 4359, (740, 2490, 1100), .15, pan=(.32, -.51), grit=.04, send=.20)
    track.glint(4295, 1621, 1.27, .097, pan=-.43)


def altar(track):
    # 钥石、超级石到烈空坐体内的光流，再从近处转到琉璃市和逼近的陨石。
    track.glint(4465, 1253, 1.10, .092, pan=-.36)
    track.glint(4482, 1014, 1.20, .089, pan=.37)
    track.pass_by(4516, 4557, 4608, (810, 1520, 455), .13, pan=(.39, -.16), grit=.07)
    track.air([(4490, 0), (4559, .40), (4668, .66), (4770, .86), (4863, 0)],
              (169, 625), .131, pan=.19)
    for start, crest, end, gain in ((4601, 4642, 4661, .10), (4650, 4697, 4722, .12),
                                    (4710, 4753, 4778, .15), (4747, 4789, 4828, .18)):
        track.pass_by(start, crest, end, (795, 2520, 1440), gain, pan=(-.65, .28), grit=.06)
    track.glint(4789, 1063, 1.4, .084, pan=.27)
    track.air([(4833, 0), (4894, .74), (5012, .63), (5125, .53), (5289, .35), (5406, 0)],
              (181, 941), .096, pan=-.35)
    track.air([(4951, 0), (5055, .39), (5185, .68), (5328, 1), (5441, 0)],
              (38, 173), .26, pan=.30)
    track.pass_by(5228, 5332, 5427, (162, 667, 128), .22, pan=(.64, .13), grit=.12)

    # 回到塔顶，复现开场的红石与失光。补上陨石才给出完整的回应。
    track.air([(5355, 0), (5437, 1), (5473, .65), (5514, .21), (5566, .43),
               (5632, .67), (5755, .88), (5880, .51), (6081, .65), (6300, .58),
               (6432, .67), (6555, .20), (6655, .33), (6732, .87), (6815, 0)],
              (105, 671), .131, pan=-.27)
    track.air([(5355, 0), (5445, .60), (5495, .23), (5566, .52), (5712, .69),
               (5881, .28), (6027, .58), (6341, .74), (6507, .49), (6621, .18),
               (6716, .82), (6801, 0)], (1340, 3910), .069, pan=.41)
    track.pass_by(5368, 5426, 5452, (179, 790, 150), .33, pan=(.66, .07), grit=.07)
    track.hit(5444, .22, hz=(87, 37), duration=1.13, pan=.09, grit=.15)
    failed_light(track, 5452, 5525, -.46)
    track.glint(5548, 1114, 1.32, .092, pan=.54)
    track.pass_by(5566, 5619, 5632, (587, 2140, 483), .20, pan=(.56, .13), grit=.11)
    track.hit(5632, .32, hz=(157, 71), duration=.49, pan=.13, grit=.47)
    track.glint(5645, 939, 1.46, .125, pan=.11, send=.22)
    track.air([(5633, 0), (5650, .83), (5675, 1), (5715, .55), (5755, 0)],
              (174, 1010), .202, pan=.19)
    track.pass_by(5681, 5731, 5787, (215, 760, 210), .19, pan=(.12, -.24), grit=.11)

    # 抛球、落地、收回。画龙点睛的示意光弧为后来真正冲刺预留相似的风声。
    track.glint(5800, 1474, .25, .067, pan=.48, send=.06)
    track.pass_by(5800, 5832, 5853, (448, 1810, 459), .157, pan=(.55, .02), grit=.09)
    track.hit(5853, .16, hz=(246, 101), duration=.16, pan=.03, grit=.72, send=.06)
    track.pass_by(5848, 5863, 5908, (762, 2270, 441), .237, pan=(.18, 0), grit=.04)
    track.glint(5906, 1577, .41, .093, pan=.02, send=.10)
    track.pass_by(6027, 6122, 6161, (251, 3140, 726), .27, pan=(-.45, .51), grit=.10, send=.19)
    track.glint(6140, 1368, 1.19, .075, pan=.45)

    # 对战三次闪光、交接和塔顶的第二次超级进化。
    for at, pan, gain in ((6315, -.31, .37), (6360, .30, .31), (6420, .03, .45)):
        track.pass_by(at - 21, at - 5, at, (373, 1800, 918), gain * .65,
                      pan=(pan * 2, pan), grit=.14, send=.09)
        track.hit(at, gain, hz=(110, 45), duration=.90, pan=pan, grit=.29)
        track.put(at + 1, tear(.28, track.seed(), 2750, 600), gain * .51, pan=pan, send=.15)
    track.pass_by(6507, 6564, 6606, (755, 1342, 496), .10, pan=(-.37, .18), grit=.035)
    evolution(track, 6611, 6665, 1.06, flash_hz=(1220, 7550), send=.18)


def space(track):
    # 穿过云顶，迅速抽掉大气里的风。画龙点睛沿屏幕从左向右加速。
    track.pass_by(6705, 6768, 6832, (215, 1660, 241), .48, pan=(.14, -.41), grit=.20, send=.09)
    track.air([(6716, 0), (6768, 1), (6801, .53), (6844, 0)], (60, 370), .28, pan=.18, send=.06)
    track.air([(6766, 0), (6817, .22), (6889, .46), (6917, .73), (6937, 0)],
              (40, 134), .14, pan=.35, send=.03)
    track.pass_by(6920, 6936, 6940, (326, 2160, 1150), .28, pan=(-.55, -.40), grit=.07, send=.04)
    track.hit(6940, .27, hz=(75, 37), duration=.76, pan=-.45, grit=.045, send=.02)
    track.pass_by(6943, 6983, IMPACT, (166, 6480, 2160), .65,
                  pan=(-.66, .31), grit=.20, send=.035)
    duration = (IMPACT - 6943) / FPS
    t = tvec(duration)
    ionized = sweep(duration, 3240, 7860, track.seed(), bw=.48, curve=1.5)
    pulses = .64 + .36 * np.sin(2 * np.pi * (6 * t + 8 * t * t))
    track.put(6943, ionized * pulses * env_swell(len(t), .9, 2, 3),
              .20, pan=np.linspace(-.53, .41, len(t)), send=.035)

    # 6987 帧命中。岩体先低沉断开，再把锐边和飞散的碎石摊到左右两侧。
    track.hit(IMPACT, 1.16, hz=(85, 29), duration=1.89, pan=.20, grit=.31, send=.05)
    track.put(IMPACT + 1, tear(.56, track.seed(), 4220, 440), .58, pan=.33, send=.10)
    track.put(IMPACT + 3, tear(.82, track.seed(), 1750, 163), .40, pan=-.24, send=.10)
    track.air([(IMPACT, 0), (6996, .90), (7007, 1), (7022, .53), (7060, 0)],
              (125, 880), .44, pan=-.10, send=.07)
    for frame, pan, freq, gain in ((6998, -.53, 302, .21), (7005, .65, 406, .15),
                                   (7016, -.78, 566, .11), (7024, .53, 221, .13),
                                   (7039, -.35, 312, .078), (7056, .64, 285, .064)):
        grit = tear(.27, track.seed(), freq * 5, freq * .85)
        knock = thump(freq, freq * .61, .27, click=.08, seed=track.seed())
        track.put(frame, grit + .36 * knock, gain, pan=pan, send=.06)

    # 核心三角和逆光显形在 7160 帧的叫声前收住。
    track.pass_by(7070, 7084, 7112, (1020, 2500, 1470), .135, pan=(.31, .40), grit=.06, send=.13)
    track.glint(7081, 1753, .87, .075, pan=.36)
    duration = (7157 - 7095) / FPS
    t = tvec(duration)
    signal = osc(glide(433, 782, duration, 1.6), duration)
    signal *= (.47 + .53 * np.cos(2 * np.pi * (3.6 * t + 3.2 * t * t)))
    frost = sweep(duration, 1540, 3480, track.seed(), bw=.62)
    track.put(7095, (.52 * signal + frost) * env_swell(len(t), .76, 1.7, 2.9),
              .15, pan=.27, send=.12)
    track.glint(7227, 1917, .69, .041, pan=-.42, send=.16)

    # 夜空回来，流星掠过远景。告别信出现时留一点纸声。
    track.air([(7305, 0), (7394, .57), (7476, .88), (7553, .71), (7624, .43),
               (7735, .32), (7798, .21), (7912, 0)], (135, 753), .134, pan=-.31)
    track.air([(7333, 0), (7420, .49), (7531, .66), (7606, .42), (7689, .25),
               (7800, .18), (7902, 0)], (1540, 4270), .065, pan=.42)
    track.pass_by(7384, 7444, 7521, (207, 750, 176), .142, pan=(.55, -.16), grit=.08)
    track.pass_by(7430, 7475, 7507, (730, 2650, 945), .085, pan=(-.65, .12), grit=.15)
    track.pass_by(7528, 7562, 7606, (696, 2270, 539), .114, pan=(.71, -.48), grit=.13)
    track.glint(7562, 1536, 1.16, .052, pan=.21, send=.27)
    track.put(7658, tear(.79, track.seed(), 3020, 880), .124, pan=-.33, send=.10)


def write_wav(path, samples):
    """用 24 位 PCM 保存，分块量化避免复制整条音轨。"""
    with wave.open(str(path), "wb") as wav:
        wav.setparams((2, 3, SR, 0, "NONE", "not compressed"))
        for start in range(0, len(samples), SR):
            block = samples[start:start + SR]
            pcm = np.rint(np.clip(block, -1, 1) * 8388607).astype("<i4")
            wav.writeframesraw(pcm.view(np.uint8).reshape(-1, 4)[:, :3].tobytes())


def main():
    track = Track()
    for section in (hook, upper, murals, altar, space):
        section(track)
    samples = track.mix.render()
    samples *= 10 ** (-5 / 20)  # 整期峰值约 -6 dBFS，给原声和旁白留混音余量。

    split_dir = OUT / "sfx"
    split_dir.mkdir(parents=True, exist_ok=True)
    exports = [(OUT / "wish-sfx-v3.wav", 0, CUTS[-1])]
    exports.extend((split_dir / f"{name}.wav", start, end)
                   for name, start, end in zip(STEMS, CUTS, CUTS[1:]))
    samples_per_frame = SR // FPS
    with TemporaryDirectory(prefix=".wish-sfx-", dir=OUT) as staging:
        for path, start, end in exports:
            write_wav(Path(staging) / path.name, samples[start * samples_per_frame:end * samples_per_frame])
        for path, start, end in exports:
            (Path(staging) / path.name).replace(path)
            print(f"{path.name}  {(end - start) / FPS:.6f} s  {SR} Hz / 24 bit / stereo")


if __name__ == "__main__":
    main()
