from itertools import count
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from scipy.signal import sosfilt

from space_sfx import (
    Mix, SR, bell, bp, env_ad, env_swell, glide, hp, noise, norm,
    osc, rng, shatter, sos, sparkle, sweep, tear, thump, tvec,
)
from wish_sfx import write_wav


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out" / "坠落的序列"
FPS = 30
SEGMENTS = (
    ("Fall", 0, 400),
    ("Helix", 400, 900),
    ("Birth", 900, 1400),
    ("Forms", 1400, 2065),
    ("Meteorites", 2065, 2665),
    ("Island", 2665, 3385),
    ("Alarm", 3385, 3865),
    ("Hoenn", 3865, 4205),
    ("Delta", 4205, 4600),
    ("Battle", 4600, 5230),
    ("Shower", 5230, 5800),
    ("Coda", 5800, 6120),
)
TOTAL_FRAMES = SEGMENTS[-1][2]
CRIES = ((1010, 1.063799, 6), (4095, 2.098345, 7), (4475, 1.063799, 6))


class Track:
    def __init__(self):
        self.mix = Mix(TOTAL_FRAMES / FPS)
        self.seeds = count(3861511, 17)

    def seed(self):
        return next(self.seeds)

    def put(self, frame, sound, gain, *, pan=0, send=.10):
        sound = np.array(sound, dtype=float, copy=True)
        attack = min(48, len(sound))
        release = min(720, len(sound))
        sound[:attack] *= np.linspace(0, 1, attack)
        sound[-release:] *= np.linspace(1, 0, release) ** 2
        self.mix.add(sound, frame / FPS, gain, pan=pan, send=send)

    def air(self, points, band, gain, *, pan=0, send=.06):
        frames, levels = zip(*points)
        duration = (frames[-1] - frames[0]) / FPS
        t = tvec(duration)
        seed = self.seed()
        sound = bp(noise(duration, seed), *band)
        sound *= .25 / np.sqrt(np.mean(sound ** 2))
        knots = np.arange(0, duration + .8, .8)
        gust = np.interp(t, knots, rng(seed + 1).uniform(.48, 1, len(knots)))
        sound *= gust * np.interp(t * FPS + frames[0], frames, levels)
        self.put(frames[0], sound, gain, pan=pan, send=send)

    def pass_by(self, start, crest, end, tones, gain, *, pan=(-.4, .4), grit=.10, send=.10):
        duration = (end - start) / FPS
        peak = (crest - start) / (end - start)
        sound = sweep(
            duration, tones[0], tones[-1], self.seed(), bw=.85,
            fc=lambda u: np.exp(np.interp(u, [0, peak, 1], np.log(tones))),
        )
        rasp = norm(bp(noise(duration, self.seed()), 1100, 5400))
        envelope = env_swell(len(sound), peak, 1.4, 1.9)
        sound = (sound + grit * rasp * envelope) * envelope
        self.put(start, sound, gain, pan=np.linspace(*pan, len(sound)), send=send)

    def hit(self, frame, gain, *, hz=(94, 39), duration=1.1, pan=0, grit=.16, send=.10):
        t = tvec(duration)
        sound = thump(*hz, duration, click=0)
        body = norm(bp(noise(duration, self.seed()), 135, 690))
        chips = norm(bp(noise(duration, self.seed()), 720, 3900))
        sound += .36 * body * np.exp(-t / (duration * .23))
        sound += grit * chips * np.exp(-t / (duration * .065))
        self.put(frame, sound, gain, pan=pan, send=send)

    def tick(self, frame, gain, *, pan=0, hz=2160, duration=.045):
        t = tvec(duration)
        sound = bp(noise(duration, self.seed()), hz * .42, min(7600, hz * 2.1))
        sound = norm(sound) * np.exp(-t / (duration * .16))
        sound += .24 * bell(hz, duration, ((1, 1, 1), (1.53, .25, .4)), a=.0008)
        self.put(frame, sound, gain, pan=pan, send=.035)

    def glint(self, frame, gain, *, hz=1379, duration=.85, pan=0):
        sound = bell(hz, duration, ((1, 1, 1), (1.43, .32, .5), (2.17, .16, .3)), a=.015)
        self.put(frame, sound, gain, pan=pan, send=.18)

    def particles(self, start, end, gain, *, pan=0, rate=18, reverse=False, band=(2900, 7100)):
        duration = (end - start) / FPS
        sound = sparkle(duration, self.seed(), rate=rate, lo=band[0], hi=band[1])
        sound = hp(sound, band[0] * .7)
        sound *= env_swell(len(sound), .15, 1, 2.1)
        if reverse:
            sound = sound[::-1].copy()
        self.put(start, sound, gain, pan=pan, send=.14)

    def beam(self, start, crest, end, gain, *, pan=(-.4, .3)):
        duration = (end - start) / FPS
        t = tvec(duration)
        peak = (crest - start) / (end - start)
        air = sweep(duration, 1450, 440, self.seed(), bw=.7)
        carrier = osc(glide(1220, 380, duration, .5), duration)
        carrier *= .66 + .34 * np.sin(2 * np.pi * (41 * t + 7 * t * t))
        sound = (air + .19 * carrier) * env_swell(len(t), peak, .65, 1.7)
        self.put(start, sound, gain, pan=np.linspace(*pan, len(t)), send=.10)


def fall(track):
    track.air([(0, 0), (75, .24), (240, .43), (365, 1), (445, .55), (525, 0)],
              (39, 290), .105, pan=-.24)
    track.air([(0, 0), (160, .2), (310, .5), (390, 1), (505, 0)],
              (1050, 3500), .030, pan=.41)
    track.pass_by(12, 302, 444, (155, 790, 225), .16, pan=(-.52, .22), grit=.07)
    for k in range(19):
        track.tick(23 + k * 3, .020 if k % 4 else .026, pan=-.12 + k * .012, hz=2030)
    for k in range(5):
        track.tick(172 + k * 8, .043, pan=(k - 2) * .12, hz=1860, duration=.09)
    track.pass_by(276, 398, 482, (260, 1180, 330), .19, pan=(.26, -.18), grit=.16)


def helix(track):
    for k, frame in enumerate((414, 444, 475)):
        track.put(frame, tear(.92, track.seed(), 1170 + k * 190, 340),
                  .089 - k * .012, pan=(-.42, .38, -.17)[k], send=.04)
    track.air([(448, 0), (523, .6), (579, .45), (655, .55), (755, 1),
               (920, .7), (1010, .12), (1060, 0)], (440, 1640), .037, pan=-.30)
    track.air([(477, 0), (530, .7), (740, .8), (886, .9), (1006, .08), (1070, 0)],
              (1900, 5400), .017, pan=.40)
    track.glint(521, .025, hz=1693, duration=.55, pan=.20)
    track.beam(566, 580, 662, .24, pan=(-.56, .18))
    track.hit(580, .22, hz=(124, 58), duration=.52, grit=.28)
    random = rng(track.seed())
    for frame in np.sort(random.uniform(584, 705, 39)):
        track.tick(frame, random.uniform(.011, .031), pan=random.uniform(-.6, .6),
                   hz=random.uniform(1700, 3200), duration=random.uniform(.025, .055))
    track.pass_by(704, 780, 905, (570, 2260, 720), .14, pan=(-.5, .24), grit=.19)
    track.particles(759, 934, .029, pan=-.35, rate=31)
    track.particles(782, 966, .026, pan=.38, rate=29)


def birth(track):
    track.pass_by(899, 998, 1032, (3900, 1290, 240), .13, pan=(.51, .01), grit=.04)
    track.particles(926, 1009, .034, pan=-.27, rate=33, reverse=True)
    track.hit(1010, .21, hz=(69, 35), duration=1.14, grit=.015, send=.05)
    track.glint(1010, .054, hz=1379, duration=1.04, pan=.06)
    for k in range(5):
        track.tick(1038 + k * 8, .018, hz=1860, pan=-.18 + k * .045)
    track.air([(1005, 0), (1080, .5), (1250, .36), (1410, .65), (1530, 0)],
              (115, 650), .035, pan=.27)
    track.particles(1165, 1272, .016, pan=.32, rate=8)
    track.pass_by(1264, 1322, 1408, (310, 1050, 290), .047, pan=(.27, -.12), grit=.04)


def morph(track, start, gain, mode, pan=0):
    duration = 72 if mode != "link" else 42
    crest = start + (36 if mode != "link" else 18)
    tones = {
        "attack": (590, 2260, 650),
        "defense": (340, 1250, 275),
        "speed": (960, 3860, 880),
        "link": (690, 2190, 530),
    }[mode]
    track.pass_by(start, crest, start + duration, tones, gain,
                  pan=(pan - .19, pan + .16), grit=.14)
    track.particles(start + 6, start + duration + 10, gain * .17,
                    pan=-pan, rate=24, band=(3100, 6800))
    if mode == "defense":
        track.hit(crest, .085, hz=(112, 67), duration=.38, grit=.035, pan=pan)
    if mode == "speed":
        for delta in (17, 24, 30):
            track.tick(start + delta, .025, pan=pan, hz=2870, duration=.026)


def forms(track):
    track.air([(1330, 0), (1470, .4), (1570, .64), (1820, .55), (2095, .7),
               (2400, .64), (2575, .28), (2660, 0)], (90, 590), .047, pan=-.31)
    track.air([(1410, 0), (1510, .64), (1660, .7), (1900, .68), (2170, .6),
               (2475, .55), (2580, .22), (2635, 0)], (1730, 4310), .018, pan=.43)
    track.pass_by(1402, 1462, 1510, (160, 730, 280), .078, pan=(-.25, .24), grit=.035)
    for frame, gain, mode, pan in ((1510, .17, "attack", -.17),
                                   (1660, .15, "defense", .14),
                                   (1810, .18, "speed", .04)):
        morph(track, frame, gain, mode, pan)


def meteorites(track):
    for k, pan in enumerate((-.62, .61, -.71, .69, -.54, .55)):
        frame = 2095 + k * 48
        track.tick(frame, .047, pan=pan, hz=1873, duration=.075)
        track.pass_by(frame - 3, frame + 11, frame + 31, (590, 1900, 840),
                      .087, pan=(pan, .03), grit=.06)
        morph(track, frame + 4, .093, "link", pan * .13)
    track.glint(2317, .019, hz=1379, duration=.7, pan=.16)
    track.pass_by(2550, 2605, 2630, (2470, 1040, 200), .14, pan=(-.39, .04), grit=.08)
    track.pass_by(2612, 2664, 2711, (250, 3220, 280), .34, pan=(.31, -.18), grit=.22, send=.055)


def island(track):
    track.air([(2645, 0), (2700, .52), (2890, .72), (3050, .62), (3235, .46),
               (3330, .67), (3490, .25), (3700, .08), (3860, 0)], (82, 580), .090, pan=-.42)
    track.air([(2670, 0), (2780, .56), (2910, .68), (3110, .45), (3250, .3),
               (3400, .3), (3660, .08), (3870, 0)], (850, 2860), .037, pan=.51)
    track.hit(2715, .17, hz=(126, 62), duration=.58, grit=.17, pan=-.08, send=.045)
    track.air([(2805, 0), (2845, .67), (2922, 1), (2980, .42), (3025, 0)],
              (150, 470), .057, pan=-.46, send=.035)
    track.pass_by(2805, 2890, 3025, (650, 1780, 460), .065, pan=(-.67, -.15), grit=.035)
    track.pass_by(2828, 2865, 2960, (940, 2290, 890), .049, pan=(-.37, .36), grit=.025)
    for k, frame in enumerate((3010, 3050, 3090, 3130, 3170)):
        pan = (-.40, .22, .46, -.35, .02)[k]
        track.pass_by(frame, frame + 6, frame + 17, (510, 1640, 390),
                      .14, pan=(-pan, pan), grit=.15, send=.045)
        track.tick(frame + 12, .048, hz=1300, pan=pan, duration=.075)
        for j, delta in enumerate((17, 25, 33)):
            track.hit(frame + delta, .039 + j * .003, hz=(190, 96), duration=.095,
                      grit=.28, pan=pan * .8, send=.025)
        track.glint(frame + 40, .027 + k * .003, hz=1379, duration=.29, pan=pan * .5)
    track.pass_by(3198, 3232, 3248, (240, 1330, 350), .12, pan=(-.12, .12), grit=.1)
    track.hit(3235, .44, hz=(108, 44), duration=1.2, grit=.26, pan=-.05)
    track.put(3235, shatter(1.07, track.seed(), density=37, lo=780, hi=4200),
              .11, pan=.19, send=.11)
    track.particles(3247, 3344, .036, pan=-.36, rate=28, reverse=True)
    track.pass_by(3252, 3312, 3394, (470, 1710, 570), .105, pan=(.3, -.17), grit=.07)
    track.glint(3305, .042, hz=1379, duration=.8, pan=-.06)


def alarm(track):
    track.pass_by(3375, 3423, 3495, (470, 1710, 690), .070, pan=(-.35, .35), grit=.08)
    random = rng(track.seed())
    frame = 3412
    while frame < 3618:
        track.tick(frame, random.uniform(.023, .038), hz=2150, pan=random.uniform(-.28, .28))
        frame += random.uniform(17, 27)
    track.hit(3625, .19, hz=(119, 59), duration=.72, grit=.07, send=.045)
    for frame, gain in ((3625, .082), (3634, .059), (3667, .067),
                        (3676, .047), (3726, .043), (3735, .033)):
        duration = .17
        t = tvec(duration)
        beep = osc(glide(1080, 860, duration, .7), duration)
        beep += .16 * osc(1730, duration)
        track.put(frame, beep * env_ad(len(t), .009, .046), gain, pan=.16, send=.035)
    track.air([(3580, 0), (3625, .42), (3720, .5), (3880, .8),
               (4050, 1), (4160, .8), (4210, 0)], (39, 310), .105, pan=-.16)
    track.pass_by(3780, 3867, 3970, (170, 860, 320), .11, pan=(.4, -.2), grit=.05)


def hoenn(track):
    track.air([(3865, 0), (3940, .3), (4070, .74), (4170, 1), (4235, 0)],
              (480, 2270), .052, pan=.37)
    track.pass_by(3995, 4089, 4211, (310, 2030, 670), .32,
                  pan=(.64, -.13), grit=.14, send=.055)
    track.particles(4037, 4090, .022, pan=.38, rate=22)
    track.pass_by(4154, 4202, 4240, (290, 2900, 410), .31,
                  pan=(.47, -.18), grit=.20, send=.05)


def delta(track):
    track.hit(4205, .94, hz=(102, 34), duration=2.1, grit=.31, send=.14)
    track.put(4205, tear(1.45, track.seed(), 5100, 270), .32, pan=-.16, send=.13)
    track.put(4207, shatter(1.7, track.seed(), density=58, lo=600, hi=4800),
              .22, pan=.21, send=.16)
    track.pass_by(4205, 4219, 4290, (1650, 2910, 220), .22, pan=(-.51, .61), grit=.23)
    track.particles(4220, 4385, .044, pan=-.40, rate=29, band=(2200, 6600))
    for k, frame in enumerate((4255, 4284, 4312, 4341)):
        pan = .42 if k % 2 else -.42
        track.pass_by(frame, frame + 8, frame + 26, (720, 2630, 620), .12,
                      pan=(pan, -pan), grit=.14, send=.07)
    track.pass_by(4380, 4441, 4455, (510, 3130, 970), .25, pan=(-.31, .31), grit=.19)
    track.particles(4387, 4445, .052, pan=-.27, rate=36, reverse=True)
    track.hit(4445, .57, hz=(91, 38), duration=1.25, grit=.17, send=.12)
    track.put(4445, tear(.83, track.seed(), 3600, 440), .19, pan=.18, send=.10)
    track.glint(4475, .054, hz=1379, duration=.9, pan=.05)
    track.air([(4465, 0), (4535, .5), (4670, .42), (4810, .69),
               (4920, .78), (5040, .7), (5105, 0)], (65, 580), .060, pan=-.32)
    track.particles(4510, 4608, .021, pan=.39, rate=13)


def battle(track):
    track.pass_by(4590, 4640, 4704, (450, 1590, 410), .14, pan=(.66, .24), grit=.13)
    track.pass_by(4692, 4728, 4746, (430, 2710, 980), .20, pan=(-.26, -.03), grit=.12)
    track.beam(4725, 4736, 4840, .36, pan=(-.31, .51))
    track.hit(4740, .25, hz=(139, 56), duration=.68, grit=.21, pan=.50, send=.07)
    track.particles(4743, 4808, .039, pan=.52, rate=27)
    track.pass_by(4835, 4885, 4920, (2840, 1190, 310), .22, pan=(-.59, -.14), grit=.07)
    track.particles(4835, 4905, .043, pan=.37, rate=32, reverse=True)
    track.hit(4885, .15, hz=(69, 43), duration=.67, grit=.025, pan=-.15)
    track.pass_by(4882, 4918, 4933, (370, 2560, 570), .27, pan=(.56, -.24), grit=.18)
    track.hit(4920, .53, hz=(115, 43), duration=.92, grit=.28, pan=-.15)
    track.put(4920, shatter(.65, track.seed(), density=27, lo=1400, hi=5300),
              .11, pan=-.35, send=.13)
    track.particles(4945, 5012, .058, pan=-.39, rate=37, reverse=True)
    track.pass_by(4945, 4998, 5023, (3100, 1040, 390), .16, pan=(.42, -.19), grit=.06)
    track.glint(5000, .046, hz=1379, duration=.56, pan=-.15)
    track.pass_by(5012, 5039, 5056, (330, 2840, 490), .29, pan=(.62, -.27), grit=.20)
    track.hit(5040, .72, hz=(98, 33), duration=1.63, grit=.21, send=.13)
    track.put(5040, tear(1.04, track.seed(), 4200, 490), .23, pan=-.23, send=.15)
    track.particles(5048, 5136, .072, pan=-.37, rate=32)
    track.particles(5057, 5150, .049, pan=.43, rate=25)
    track.pass_by(5110, 5170, 5205, (390, 1640, 210), .18, pan=(.22, -.76), grit=.10)
    track.pass_by(5190, 5229, 5271, (170, 2450, 280), .24, pan=(-.19, .14), grit=.13, send=.045)


def shower(track):
    track.air([(5220, 0), (5290, .58), (5440, .76), (5650, .61), (5780, .47),
               (5860, .22), (5945, 0)], (77, 590), .077, pan=-.43)
    track.air([(5240, 0), (5350, .49), (5520, .73), (5700, .57),
               (5815, .33), (5910, 0)], (880, 2940), .031, pan=.49)
    for k, frame in enumerate((5318, 5395, 5464, 5527, 5606, 5689, 5762)):
        pan = (-.58, .34, -.27, .59, -.43, .24, .51)[k]
        track.pass_by(frame, frame + 11, frame + 31, (1060, 2830, 890),
                      .032 + (k % 3) * .005, pan=(pan, pan - .17), grit=.025, send=.12)
    track.glint(5432, .022, hz=1379, duration=.9, pan=.48)


def coda(track):
    track.air([(5750, 0), (5810, .28), (5910, .61), (6020, .43),
               (6080, .15), (6118, 0)], (118, 940), .068, pan=-.38)
    track.air([(5780, 0), (5860, .36), (5950, .52), (6050, .27),
               (6118, 0)], (1950, 4800), .020, pan=.48)
    track.pass_by(5810, 5877, 5990, (1120, 2130, 780), .042, pan=(-.46, .38), grit=.015)
    track.glint(5976, .018, hz=1379, duration=1.65, pan=.23)


def finish(samples):
    for channel in range(2):
        samples[:, channel] = sosfilt(sos("highpass", 28), samples[:, channel])
        samples[:, channel] = sosfilt(sos("lowpass", 7800), samples[:, channel])
    for frame, duration, db in CRIES:
        start = max(0, round((frame / FPS - .10) * SR))
        end = min(len(samples), round((frame / FPS + duration + .42) * SR))
        t = np.arange(end - start) / SR + start / SR - frame / FPS
        envelope = np.interp(t, [-.10, 0, duration, duration + .42], [0, db, db, 0])
        samples[start:end] *= (10 ** (-envelope / 20))[:, None]
    fade = round(.025 * SR)
    samples[:fade] *= np.linspace(0, 1, fade)[:, None]
    fade = round(1.2 * SR)
    samples[-fade:] *= (np.linspace(1, 0, fade) ** 2)[:, None]
    samples *= 10 ** (-6 / 20) / np.max(np.abs(samples))
    return samples


def main():
    track = Track()
    for section in (fall, helix, birth, forms, meteorites, island,
                    alarm, hoenn, delta, battle, shower, coda):
        section(track)
        print(f"Built: {section.__name__}", flush=True)
    samples = finish(track.mix.render())
    assert samples.shape == (TOTAL_FRAMES * (SR // FPS), 2)
    assert np.isfinite(samples).all()
    exports = [(OUT / "deoxys-sfx.wav", 0, TOTAL_FRAMES)]
    exports.extend((OUT / "sfx" / f"{i:02d}-{name}-sfx.wav", start, end)
                   for i, (name, start, end) in enumerate(SEGMENTS, 1))
    (OUT / "sfx").mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".deoxys-sfx-", dir=OUT) as staging:
        for path, start, end in exports:
            write_wav(Path(staging) / path.name, samples[start * (SR // FPS):end * (SR // FPS)])
        for path, start, end in exports:
            (Path(staging) / path.name).replace(path)
            print(f"{path.name}: {(end - start) / FPS:.6f} s | 48000 Hz / 24 bit / stereo", flush=True)
    print(f"Peak: {20 * np.log10(np.max(np.abs(samples))):.2f} dBFS", flush=True)


if __name__ == "__main__":
    main()
