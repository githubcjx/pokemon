import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Cam, track} from '../../camera';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {AGES_SCENE_FRAMES, LEAVE_SCENE_FRAMES, globalFrame, globalTime} from './continuity';
import {HookView} from './HookScene';
import {leaveCam, leaveCrystal, leaveLook} from './LeaveScene';
import {Figure, Glow, MeadowBg, MeadowLook, mixLook, onScreen} from './Oil';
import {PastFigures, SUN} from './Past';
import {warRim} from './WarScene';

export {AGES_SCENE_FRAMES};

/**
 * 第 6 段《三千年》（28 秒，冷灰蓝的延时摄影）：
 * 昼夜飞快交替，焦土上重新长出草，冬雪落了又化；最终兵器沉进地下；一条土路伸向地平线，路旁一块块立起墓石；
 * 他的身影一次次出现在路上，越走越远；远处的地平线上偶尔掠过一点小小的红光（花叶蒂也在流浪）→
 * 黄昏降临，画面化回第 1 段那条街——路灯下的高大身影（首尾呼应）。
 */

const CITY_IN: [number, number] = [736, 800];

/** 冷色的白天 / 夜晚 */
const COLD_DAY = (base: MeadowLook): MeadowLook => ({
	...base,
	skyTop: [0.4, 0.47, 0.6],
	skyHor: [0.74, 0.76, 0.78],
	sunCol: [0.95, 0.85, 0.7],
	sunAmt: 0.35,
	hill1: [0.42, 0.42, 0.46],
	hill2: [0.36, 0.38, 0.32],
	field: [0.42, 0.46, 0.3],
	smoke: 0,
	fire: 0,
	red: 0,
	desat: 0.5,
	tint: [0.86, 0.93, 1.06],
	dim: 0.9,
});
const NIGHT = (day: MeadowLook): MeadowLook => ({
	...day,
	skyTop: [0.05, 0.06, 0.12],
	skyHor: [0.16, 0.18, 0.26],
	sunAmt: 0,
	dim: 0.55,
});

const ramp = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
const bell = (f: number, c: number, w: number) => Math.exp(-(((f - c) / w) ** 2));

const look0 = leaveLook();

export const agesLook = (f: number): MeadowLook => {
	const day = {
		...COLD_DAY(look0),
		scorch: 1 - ramp(f, 60, 260),
		flowers: 0.45 * ramp(f, 200, 400),
		road: ramp(f, 200, 320),
		stones: ramp(f, 330, 500),
		snow: 0.9 * bell(f, 230, 40) + 0.9 * bell(f, 520, 40),
		castle: 1 - ramp(f, 300, 450),
	};
	const settle = mixLook(look0, day, ramp(f, 30, 150));
	// 昼夜交替（周期 5 秒），开头慢慢进入，结尾停在黄昏
	const cyc = 0.5 - 0.5 * Math.cos((2 * Math.PI * Math.max(0, f - 60)) / 150);
	const nt = cyc * ramp(f, 60, 120) * (1 - ramp(f, 640, 700)) + 0.55 * ramp(f, 660, 740);
	return mixLook(settle, NIGHT(settle), nt);
};

const cam0 = leaveCam(LEAVE_SCENE_FRAMES);
export const agesCam = (f: number): Cam => ({
	x: track(f, [
		[0, cam0.x],
		[CITY_IN[1], 1010],
	]),
	y: track(f, [
		[0, cam0.y],
		[CITY_IN[1], 604],
	]),
	zoom: track(f, [
		[0, cam0.zoom],
		[CITY_IN[1], 1.16],
	]),
	roll: 0,
});

/** 路上一次次出现的身影：rt 为路上的位置（0 近 → 1 远） */
const WALKS = [
	{f0: 110, f1: 196, rt: 0.12},
	{f0: 240, f1: 326, rt: 0.3},
	{f0: 372, f1: 458, rt: 0.48},
	{f0: 504, f1: 590, rt: 0.64},
	{f0: 630, f1: 712, rt: 0.8},
];
const roadAt = (rt: number) => ({
	x: 380 + (1180 - 380) * Math.pow(rt, 0.8) - 40,
	y: 1080 + (742 - 1080) * rt,
	sc: (1080 + (742 - 1080) * rt - 600) / 480,
});

export const AgesScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('ages', frame);
	const cam = agesCam(frame);
	const look = agesLook(frame);
	const lc = leaveCrystal(LEAVE_SCENE_FRAMES);
	const sink = ramp(frame, 120, 320);
	const crystal = {...lc, weapon: lc.weapon && {...lc.weapon, grow: lc.weapon.grow * (1 - sink), charge: lc.weapon.charge * (1 - sink)}};

	const kingO = 1 - ramp(frame, 60, 110);
	const meadowO = 1 - interpolate(frame, CITY_IN, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const night = interpolate(frame, [660, 740], [0, 1], clamp);

	// 地平线上掠过的一点红光
	const redP = interpolate(frame, [560, 680], [0, 1], clamp);
	const red = onScreen(cam, {x: 260 + 1400 * redP, y: 700 - Math.sin(redP * Math.PI) * 40});
	const redA = Math.sin(redP * Math.PI) * (frame > 560 && frame < 680 ? 1 : 0);

	return (
		<AbsoluteFill style={{background: '#06070b'}}>
			{meadowO > 0 && (
				<AbsoluteFill style={{opacity: meadowO}}>
					<MeadowBg time={t} cam={cam} sun={SUN} look={look} crystal={crystal} />
					{kingO > 0 && <PastFigures cam={cam} motherOpacity={0} kingPose="hold" rim={0.55} rimRgb={warRim(1)} />}
					{WALKS.map((w, i) => {
						const o = interpolate(frame, [w.f0, w.f0 + 18, w.f1 - 18, w.f1], [0, 1, 1, 0], clamp);
						if (o <= 0) return null;
						const r = roadAt(w.rt + 0.03 * (frame - w.f0) / (w.f1 - w.f0));
						const p = onScreen(cam, {x: r.x, y: r.y});
						return <Figure key={i} id={`walk${i}`} who="king" pose="stand" x={p.x} y={p.y} h={430 * r.sc * p.s} face="right" rimRgb="190,200,220" rim={0.45} rimDir={[0.5, -1]} opacity={o * (1 - night * 0.3)} />;
					})}
					<Glow x={red.x} y={red.y} r={46} rgb="255,90,80" amt={0.9 * redA} />
					<Glow x={red.x} y={red.y} r={10} rgb="255,220,210" amt={redA} />
					<DustMotes opacity={0.5 * (1 - ramp(frame, 40, 160))} rgb="196,188,180" frameOffset={globalFrame('ages', 0)} />
				</AbsoluteFill>
			)}

			{/* 回到第 1 段那条街：冷色的黄昏，路灯下的高大身影 */}
			{meadowO < 1 && <HookView frame={0} time={t} night={0.62} desat={0.45} tint={[0.86, 0.93, 1.06]} opacity={1 - meadowO} />}

			<Vignette strength={0.72 - 0.02 * ramp(frame, CITY_IN[0], CITY_IN[1])} />

			<BiSubtitle zh="兵器的光，让他得到了永远的生命。" en="The weapon's light gave him a life without end." from={20} to={142} source={{zh: 'XY 石香镇·ＡＺ："被兵器光芒照耀过的男子，踏上了永远的流浪之旅"；增田顺一采访', en: 'X/Y AZ: "A man condemned to wander forever by the light of the weapon…"'}} />
			<BiSubtitle zh="「花叶蒂不知去了哪里，而被留下的我漂泊了长达3000年。」" en={'"She left me. And I wandered alone for three thousand years."'} from={160} to={332} source={{zh: '传说 Z-A·ＡＺ屋顶自白（官方中文）', en: 'Legends: Z-A, AZ on the roof'}} />
			<BiSubtitle zh="战争留下的墓石，至今还立在路旁。" en="The graves of that war still line the road." from={362} to={502} source={{zh: 'XY·闪焰队干部："10 号道路排列的石头其实是宝可梦的墓"', en: 'X/Y Celosia: "those stones that line Route 10 are the graves of Pokémon"'}} />
			<BiSubtitle zh="同样在永恒的时间里流浪的，还有那只宝可梦。" en="And somewhere, a Pokémon wandered through eternity too." from={540} to={700} source={{zh: 'XY 石香镇·ＡＺ', en: 'X/Y AZ: "And a Pokémon that also wanders eternally…"'}} />

		</AbsoluteFill>
	);
};
