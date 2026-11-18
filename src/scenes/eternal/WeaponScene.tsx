import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cam, shake, track} from '../../camera';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {WAR_SCENE_FRAMES, WEAPON_SCENE_FRAMES, globalFrame, globalTime} from './continuity';
import {Crystal, Glow, MeadowBg, MeadowLook, TinyBox, handOf, onScreen} from './Oil';
import {FloetteArt, GROUND, KING, PastFigures, SUN} from './Past';
import {warCam, warLook, warRim} from './WarScene';

export {WEAPON_SCENE_FRAMES};

/**
 * 第 4 段《最终兵器》（31 秒，视觉爆发点）：
 * 国王身前升起一个水晶花苞——让生命复苏的机器；箱子化进光里 → 花叶蒂在光中醒来、显色，色彩短暂回来 →
 * 天色发红（愤怒）→ 远处的山间升起一朵巨大的水晶花（最终兵器，形状像永恒之花）→ 花瓣张开、蓄能 →
 * 光柱直冲云霄（猛推 + 震动、白闪）→ 光洒落大地，原野烧成焦土，烟与火都烧尽 → 寂静。
 * ＡＺ亲口的原话加「」（传说 Z-A 屋顶自白，官方中文）。不放叫声（叫声留给重逢）。
 */

const MACH_X = 1010;
const WEAP_X = 1330;
const WEAP_SCALE = 520;
const FIRE = 660;

const camBase = warCam(WAR_SCENE_FRAMES);

export const weaponCam = (f: number): Cam => {
	const sk = [shake(f, 486, 4, 30), shake(f, 526, 5, 30), shake(f, 566, 6, 34), shake(f, FIRE, 28, 48)];
	return {
		x:
			track(f, [
				[0, camBase.x],
				[150, 940],
				[300, 930],
				[450, 880],
				[600, 960],
				[FIRE, 975],
				[FIRE + 12, 990, Easing.out(Easing.cubic)],
				[760, 960],
				[WEAPON_SCENE_FRAMES, 920],
			]) + sk.reduce((a, s) => a + s.x, 0),
		y:
			track(f, [
				[0, camBase.y],
				[150, 700],
				[300, 680],
				[450, 660],
				[600, 560],
				[FIRE, 545],
				[FIRE + 12, 520, Easing.out(Easing.cubic)],
				[760, 560],
				[WEAPON_SCENE_FRAMES, 600],
			]) + sk.reduce((a, s) => a + s.y, 0),
		zoom: track(f, [
			[0, camBase.zoom],
			[150, 1.55],
			[300, 1.6],
			[450, 1.85],
			[600, 1.0],
			[FIRE, 1.05],
			[FIRE + 12, 1.28, Easing.out(Easing.cubic)],
			[760, 1.2],
			[WEAPON_SCENE_FRAMES, 1.12],
		]),
		roll: sk.reduce((a, s) => a + s.roll, 0),
	};
};

const ramp = (f: number, a: number, b: number, from = 0, to = 1) => interpolate(f, [a, b], [from, to], {...clamp, easing: Easing.inOut(Easing.sin)});

/** 原野的样子：复苏时色彩短暂回来 → 愤怒时天色发红 → 光洒落后烧成焦土 */
export const weaponLook = (f: number): MeadowLook => {
	const base = warLook(WAR_SCENE_FRAMES);
	const revive = ramp(f, 190, 290) * (1 - ramp(f, 330, 450));
	const scorch = ramp(f, 760, 860);
	return {
		...base,
		desat: base.desat - 0.34 * revive + 0.0 * scorch - 0.08 * ramp(f, 310, 450),
		dim: base.dim + 0.13 * revive - 0.08 * scorch,
		sunAmt: base.sunAmt + 0.2 * revive - 0.12 * scorch,
		red: 0.65 * ramp(f, 310, 450) - 0.4 * scorch,
		scorch,
		flowers: base.flowers * (1 - scorch),
		smoke: 1 - ramp(f, 760, 870),
		fire: base.fire * (1 - ramp(f, 770, 880)),
	};
};

export const weaponCrystal = (f: number): Crystal => {
	const machSize = interpolate(f, [30, 140], [0, 210], {...clamp, easing: Easing.out(Easing.cubic)}) * (1 - ramp(f, 480, 560));
	const machGlow = ramp(f, 30, 150, 0, 0.5) + ramp(f, 190, 240, 0, 0.6) * (1 - ramp(f, 260, 330)) + ramp(f, 330, 450, 0, 0.3);
	return {
		machine: machSize > 0.5 ? {x: MACH_X, y: GROUND, size: machSize, glow: machGlow} : undefined,
		weapon: {
			x: WEAP_X,
			grow: interpolate(f, [480, 600], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)}),
			open: ramp(f, 600, FIRE - 4),
			charge: ramp(f, 590, FIRE) * (1 - ramp(f, 760, 860) * 0.85),
			scale: WEAP_SCALE,
		},
		beam: interpolate(f, [FIRE, FIRE + 8], [0, 1], clamp) * (1 - ramp(f, 740, 840)),
		rain: ramp(f, 730, 760) * (1 - ramp(f, 800, 860)),
	};
};

/** 花叶蒂：在机器的光里醒来 → 飘到国王手边 */
export const weaponFloette = (f: number, time: number) => {
	const x = track(f, [
		[200, MACH_X],
		[290, 980],
		[340, 916],
	]);
	const y = track(f, [
		[200, GROUND - 112],
		[290, 640],
		[340, 584],
	]);
	return {x, y: y + Math.sin(time * 1.6) * 5};
};

export const WeaponScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('weapon', frame);
	const cam = weaponCam(frame);
	const look = weaponLook(frame);
	const crystal = weaponCrystal(frame);

	const king = onScreen(cam, {x: KING.x, y: GROUND});
	const hand = handOf('king', king.x, king.y, KING.h * king.s, 'right');
	const boxO = 1 - ramp(frame, 110, 190);

	const appear = interpolate(frame, [196, 220], [0, 1], clamp);
	const reveal = ramp(frame, 210, 290);
	const fp = weaponFloette(frame, t);
	const fs = onScreen(cam, fp);
	const heart = ramp(frame, 200, 290) * (1 - ramp(frame, 330, 470, 0, 0.6));

	// 剪影的逆光：灰 → 复苏时转暖 → 愤怒时发红 → 发射时刺白
	const revive = ramp(frame, 190, 290) * (1 - ramp(frame, 330, 450));
	const fireLit = interpolate(frame, [FIRE, FIRE + 6, 780], [0, 1, 0.2], clamp);
	const rimRgb = frame < FIRE ? (revive > 0.01 ? warRim(1 - revive) : warRim(1)) : '255,236,214';
	const flash = interpolate(frame, [FIRE, FIRE + 3, FIRE + 40], [0, 0.95, 0], clamp);

	return (
		<AbsoluteFill style={{background: '#0a0705'}}>
			<MeadowBg time={t} cam={cam} sun={SUN} look={look} crystal={crystal} />
			<PastFigures cam={cam} motherOpacity={0} kingPose="hold" rim={0.55 + 0.25 * revive + 0.7 * fireLit} rimRgb={rimRgb} />

			{boxO > 0 && <TinyBox x={hand.x - 6 * king.s} y={hand.y + 4 * king.s} w={44 * king.s} opacity={boxO} rimRgb={warRim(1)} rim={0.35 + 0.5 * ramp(frame, 60, 150)} />}

			<Glow x={fs.x} y={fs.y} r={300 * fs.s} rgb="255,214,150" amt={0.5 * heart} />
			{appear > 0 && <FloetteArt cam={cam} p={fp} reveal={reveal} time={t} desat={0.25 * ramp(frame, 450, 700)} opacity={appear} />}

			{/* 发射的白闪 */}
			<AbsoluteFill style={{background: '#fff6e8', opacity: flash, pointerEvents: 'none'}} />

			<Vignette strength={0.7 - 0.15 * fireLit} />

			<BiSubtitle zh="「为了让我心爱的花叶蒂起死回生，我制造了能够赋予生命的机器。」" en={'"I made a device—a machine that could grant life. All so that I could revive my beloved Floette."'} from={20} to={172} source={{zh: '传说 Z-A·ＡＺ屋顶自白（官方中文）', en: 'Legends: Z-A, AZ on the roof'}} />
			<BiSubtitle zh="「花叶蒂复活了。我又让心爱的宝可梦回到了身边。」" en={'"I brought Floette back to life. I got back what I had loved most."'} from={182} to={302} source={{zh: '传说 Z-A·ＡＺ屋顶自白（官方中文）', en: 'Legends: Z-A, AZ on the roof'}} />
			<BiSubtitle zh="「然而我的愤怒并没有平息。我没能原谅这个伤害了我心爱宝可梦的世界。」" en={'"But my rage had not subsided. I could not forgive the world that had hurt the Pokémon that I loved."'} from={312} to={462} source={{zh: '传说 Z-A·ＡＺ屋顶自白（官方中文）', en: 'Legends: Z-A, AZ on the roof'}} />
			<BiSubtitle zh="「我在愤怒之下，把机器改造成了最终兵器。」" en={'"In my rage, I remade my device into the ultimate weapon."'} from={472} to={592} source={{zh: '传说 Z-A·ＡＺ屋顶自白（官方中文）', en: 'Legends: Z-A, AZ on the roof'}} />
			<BiSubtitle zh="「最终兵器发射出来的光芒直冲云霄，」" en={'"The light fired from the ultimate weapon reached the heavens,"'} from={FIRE + 8} to={750} source={{zh: '传说 Z-A·ＡＺ屋顶自白（官方中文，一句分两条）', en: 'Legends: Z-A, AZ on the roof'}} />
			<BiSubtitle zh="「又洒落大地，将地表烧为焦土。」" en={'"then poured down, burning away all that rested upon the earth."'} from={756} to={842} source={{zh: '传说 Z-A·ＡＺ屋顶自白（官方中文，一句分两条）', en: 'Legends: Z-A, AZ on the roof'}} />
			<BiSubtitle zh="战争结束了。" en="The war was over." from={852} to={WEAPON_SCENE_FRAMES - 4} source={{zh: 'XY·ＡＺ："成为破坏之神，结束了战争"', en: 'X/Y AZ: "The man became a bringer of destruction that ended the war."'}} />

		</AbsoluteFill>
	);
};
