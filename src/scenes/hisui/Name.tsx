import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, interpolate} from 'remotion';
import {BiSubtitle, SubtitleSource} from '../../components/BiSubtitle';
import {Grain} from '../../components/Grain';
import {CINZEL, SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {coastHeight, SUMMIT} from '../../three/hisui/coast';
import {CloudSea, CoronetLights, GOLD_DIR, Sky, Snow, Terrain} from '../../three/hisui/coronet';
import {TEMPLE, Temple} from '../../three/hisui/temple';
import {CameraRig, V3} from '../../three/stage';
import {CoastWorld, TrainerSil} from './Clans';
import {flow, prog, SUB, T, track} from './common';
import {HallMaster} from './Hall';
import {ArtSil, Glow, toScreen, View} from './Overlays';
import {REI} from './Rift';

// ─── 第 9 段「神奥之名」（全片结尾）────────────────────────────────────────────
// 阿尔宙斯的金光铺满画面 → 起始海滩的早晨（3D 海岸，远处山顶的神殿已经塌了）：马加木望着天冠山，那个人、刚石、珠贝在旁边
// → 马加木的话，山顶亮起一点金光 → 海天之间"洗翠"化成"神奥" → 蓝、白两道光升起、合成一道
// → 叠化回开场的月夜断柱（第 1 段的机位），赤日的剪影一闪 → 仰到天顶，一点金光 → 传说石板，淡出。
// （2026-10-25 删去吾思那句和"而那位神，一直都在"，结尾只收一次）

const ease = (t: number) => t * t * (3 - 2 * t);
const BLUE = '120,165,255';
const PEARL = '255,214,234';
const GOLD = '255,214,140';

// ── 起始海滩 ──

const g = (x: number, z: number): V3 => [x, coastHeight(x, z), z];
const KAMADO: V3 = g(13.2, -3.4);
const REI_B: V3 = g(11.2, -3.9);
const ADAMAN: V3 = g(9.6, -4.6);
const IRIDA: V3 = g(15.0, -1.9);
const COGITA: V3 = g(7.6, -8.6);

const CAMB: [number, number[]][] = [
	[T.prelude - 10, [3.0, 2.3, 14.5, SUMMIT[0], SUMMIT[1] * 0.3, SUMMIT[2], 46]],
	[T.l96, [5.2, 2.1, 12.2, SUMMIT[0], SUMMIT[1] * 0.32, SUMMIT[2], 42]],
	[T.l97, [5.6, 2.1, 11.6, SUMMIT[0], SUMMIT[1] * 0.5, SUMMIT[2], 46]],
	[T.l99, [5.0, 2.2, 12.0, SUMMIT[0], SUMMIT[1] * 0.36, SUMMIT[2], 46]],
	[T.night9 + 30, [4.6, 1.8, 4.8, COGITA[0] - 2, COGITA[1] + 1.4, COGITA[2] - 8, 40]],
];
const viewB = (f: number): View => {
	const c = flow(f, CAMB);
	return {pos: [c[0], c[1], c[2]], target: [c[3], c[4], c[5]], fov: c[6]};
};

const BeachLayers: React.FC<{f: number; v: View}> = ({f, v}) => {
	const peak = interpolate(f, [T.l96 + 40, T.l96 + 90], [0, 0.7], clamp) * (1 - prog(f, T.l98, T.l98 + 40));
	// 两道光：从刚石、珠贝身上升起，往中间靠、合成一道白光
	const rise = ease(prog(f, T.l98, T.l98 + 100));
	const lift = (p: V3, toward: V3): V3 => [p[0] + (toward[0] - p[0]) * rise, p[1] + 1.2 + 6 * rise, p[2] + (toward[2] - p[2]) * rise];
	const mid: V3 = [(ADAMAN[0] + IRIDA[0]) / 2, 0, (ADAMAN[2] + IRIDA[2]) / 2 - 4];
	const twin = interpolate(f, [T.l95 + 20, T.l95 + 60], [0.35, 0.55], clamp) * (1 - 0.6 * prog(f, T.l98 + 80, T.l98 + 110));
	const one = interpolate(f, [T.l98 + 70, T.l98 + 110, T.night9, T.night9 + 30], [0, 0.85, 0.85, 0], clamp);
	return (
		<>
			<Glow v={v} p={[SUMMIT[0], SUMMIT[1] + 16, SUMMIT[2]]} r={90} rgb={GOLD} a={peak} />
			<Glow v={v} p={lift(ADAMAN, mid)} r={150} rgb={BLUE} a={twin} />
			<Glow v={v} p={lift(IRIDA, mid)} r={150} rgb={PEARL} a={twin} />
			<Glow v={v} p={[mid[0], mid[1] + 1.2 + 6, mid[2]]} r={220} rgb="255,250,240" a={one} />
			<TrainerSil v={v} file="trainers/adaman/la.png" aspect={777 / 1600} foot={ADAMAN} h={1.8} o={1} from="left" rgb={BLUE} lift={0.13} />
			<TrainerSil v={v} {...REI} foot={REI_B} h={1.65} o={1} from="right" rgb="255,226,190" lift={0.12} />
			<TrainerSil v={v} file="trainers/kamado/la.png" aspect={1117 / 1600} foot={KAMADO} h={1.9} o={1} from="right" rgb="255,226,190" lift={0.12} />
			<TrainerSil v={v} file="trainers/irida/la.png" aspect={691 / 1600} foot={IRIDA} h={1.62} o={1} from="right" rgb={PEARL} lift={0.13} />
		</>
	);
};

/** "洗翠"化成"神奥"：海天之间的两个金字，模糊着换成另外两个 */
const NameMorph: React.FC<{f: number}> = ({f}) => {
	const a = interpolate(f, [T.l96 + 100, T.l97, T.l98 + 60, T.l98 + 100], [0, 1, 1, 0], clamp);
	if (a <= 0) return null;
	const m = ease(prog(f, T.l97 + 10, T.l97 + 60));
	const word = (zh: string, en: string, o: number, blur: number) => (
		<div style={{position: 'absolute', left: 0, right: 0, top: 230, textAlign: 'center', opacity: o * a, filter: `blur(${blur}px)`}}>
			<div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 150, letterSpacing: 40, paddingLeft: 40, color: '#fff3d8', textShadow: `0 0 26px rgba(${GOLD},0.9), 0 0 80px rgba(${GOLD},0.5), 0 2px 10px rgba(80,50,20,0.5)`}}>{zh}</div>
			<div style={{marginTop: 6, fontFamily: CINZEL, fontWeight: 600, fontSize: 30, letterSpacing: 18, paddingLeft: 18, color: 'rgba(255,246,226,0.9)', textShadow: `0 0 16px rgba(${GOLD},0.7)`}}>{en}</div>
		</div>
	);
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{word('洗翠', 'HISUI', 1 - m, 14 * m)}
			{word('神奥', 'SINNOH', m, 14 * (1 - m))}
		</AbsoluteFill>
	);
};

// ── 开场的月夜断柱（第 1 段的样子）──

const CAMN: [number, number[]][] = [
	[T.night9, [42, 7, 64, 0, 4, 0, 36]],
	[T.l101 - 10, [24, 4.6, 40, -1, 4.5, -2, 39]],
	// 仰到天顶：金光所在的方向
	[T.l102 + 40, [22, 4.8, 38, 22 + GOLD_DIR[0] * 100, 4.8 + GOLD_DIR[1] * 100, 38 + GOLD_DIR[2] * 100, 50]],
	[T.end9, [21.6, 4.9, 37.6, 22 + GOLD_DIR[0] * 100, 4.9 + GOLD_DIR[1] * 104, 38 + GOLD_DIR[2] * 100, 48]],
];
const viewN = (f: number): View => {
	const c = flow(f, CAMN);
	return {pos: [c[0], c[1], c[2]], target: [c[3], c[4], c[5]], fov: c[6]};
};

const PillarNight: React.FC<{f: number; v: View}> = ({f, v}) => {
	const time = f / 30;
	const gold = interpolate(f, [T.l101, T.l101 + 50], [0, 0.9], clamp);
	return (
		<ThreeCanvas width={1920} height={1080} shadows gl={{antialias: true}}>
			<CameraRig pos={v.pos} target={v.target} fov={v.fov} />
			<CoronetLights dusk={0} gold={gold * 0.4} />
			<Sky cam={v.pos} s={{dusk: 0, starRot: f * 0.0006, trail: 0, gold}} />
			<Terrain />
			<Temple ruin={1} build={1} />
			<CloudSea y={-58} opacity={0.9} time={time} color="#9aa7bd" shade="#3d4658" cam={v.pos} />
			<Snow cam={v.pos} time={time} amount={0.85} wind={1.2} />
		</ThreeCanvas>
	);
};

const PillarLayers: React.FC<{f: number; v: View}> = ({f, v}) => {
	const cyrus = interpolate(f, [T.cyrus9, T.cyrus9 + 30, T.l101 - 40, T.l101], [0, 0.85, 0.85, 0], clamp);
	return (
		<>
			<Glow v={v} p={[-2.2, 4.5, 2]} r={300} rgb="90,140,255" a={cyrus * 0.4} />
			<Glow v={v} p={[2.2, 4.5, 2]} r={300} rgb="255,120,190" a={cyrus * 0.32} />
			<ArtSil v={v} who="cyrus" foot={[0, TEMPLE.stepTop, 6]} h={1.85} rimRgb="190,215,255" rim={0.95} opacity={cyrus} />
		</>
	);
};

// ── 合在一起 ──

export const NameMaster: React.FC<{f: number}> = ({f}) => {
	// 开头：阿尔宙斯的金光铺满画面，退去时已是起始海滩的早晨
	const goldIn = interpolate(f, [T.end8, T.prelude], [0, 1], clamp);
	const goldOut = interpolate(f, [T.prelude, T.l95 + 20], [1, 0], clamp);
	const glow = f < T.prelude ? goldIn : goldOut;
	const showHall = f < T.prelude;
	const beach = f >= T.prelude && f < T.night9 + 45;
	const night = f >= T.night9;
	const nightO = interpolate(f, [T.night9, T.night9 + 45], [0, 1], clamp);
	const vb = viewB(f);
	const vn = viewN(f);
	const fade = interpolate(f, [T.fade9, T.end9 - 2], [0, 1], clamp);
	const day = track(f, [[T.prelude, 0.85], [T.night9, 1]]);
	const grain = night ? 0.12 : 0.06;
	return (
		<AbsoluteFill style={{background: '#05070c'}}>
			{showHall ? <HallMaster f={f} /> : null}
			{beach ? (
				<AbsoluteFill>
					<CoastWorld f={f} view={vb} env={{dusk: 0.15, day, red: 0, rift: 0, canopy: 0, riftDir: [0, 1, 0], flash: 0, gate: 0}} ruined />
					<BeachLayers f={f} v={vb} />
					<NameMorph f={f} />
				</AbsoluteFill>
			) : null}
			{night ? (
				<AbsoluteFill style={{opacity: nightO}}>
					<PillarNight f={f} v={vn} />
					<PillarLayers f={f} v={vn} />
				</AbsoluteFill>
			) : null}
			{glow > 0.003 ? (
				<AbsoluteFill style={{pointerEvents: 'none', background: `radial-gradient(ellipse 80% 70% at 50% 35%, rgba(255,250,236,${glow}) 0%, rgba(255,226,170,${glow}) 55%, rgba(255,210,150,${glow * 0.95}) 100%)`}} />
			) : null}
			{showHall ? null : <AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)', pointerEvents: 'none'}} />}
			{SUBS_NAME.map(([from, to, zh, en, source]) => (
				<BiSubtitle key={from} from={from} to={to} zh={zh} en={en} source={source} {...SUB} />
			))}
			{showHall ? null : <Grain opacity={grain} />}
			{fade > 0 ? <AbsoluteFill style={{background: `rgba(0,0,0,${fade})`}} /> : null}
		</AbsoluteFill>
	);
};

export const SUBS_NAME: [number, number, string, string, SubtitleSource?][] = [
	[T.l95, T.l95 + 195, '后来，马加木站在海滩上说：「不论是我们，还是刚石和珠贝，都受到了神奥大尊的引导吧。」', 'Later, Kamado stood on the beach and said: "You and I, Adaman, Irida—we were all being guided by almighty Sinnoh."'],
	[T.l96, T.l96 + 145, '「或许这片大地不该称为洗翠地区，而是该称为神奥地区。」', '"It might be more appropriate to call this region the Sinnoh region."', {zh: '《传说 阿尔宙斯》马加木台词', en: 'Bulbapedia, Kamado/Quotes'}],
	[T.l97, T.l97 + 75, '洗翠，就这样成了神奥。', 'And so Hisui became Sinnoh.'],
	[T.l98, T.l98 + 115, '此时与此地，本来就是同一个宇宙的两半。', 'This time and this place were always two halves of the same universe.'],
	[T.l100, T.l100 + 165, '很久以后，一个同样叫银河队的组织站上了这片断柱，想要另造一个世界。', 'Long after, another group called Team Galactic stood among these broken pillars, seeking to make a new world.'],
	[T.l102, T.l102 + 135, '其在所有的宇宙中，注视着宝可梦与人。', 'From all creations, over all creations, does the Original One watch over all.', {zh: '《传说 阿尔宙斯》传说石板', en: 'Bulbapedia, Legend Plate'}],
];
