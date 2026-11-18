import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, interpolate} from 'remotion';
import {BiSubtitle, SubtitleSource} from '../../components/BiSubtitle';
import {Grain} from '../../components/Grain';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {CloudSea, CoronetLights, heightAt, Sky, Snow, Terrain, TOWN} from '../../three/hisui/coronet';
import {StoneStatue} from '../../three/hisui/statue';
import {Beam, COLUMNS, PEDESTAL_H, ruinTop, STATUES, TEMPLE, Temple} from '../../three/hisui/temple';
import {CameraRig, V3} from '../../three/stage';
import {CloudPass, ClansLayers, coastDay, coastDusk, coastView, CoastWorld, SUBS_CLANS} from './Clans';
import {flow, prog, SUB, T, track} from './common';
import {CosmosMaster} from './Cosmos';
import {GodsMaster} from './Gods';
import {PlatesMaster} from './Plates';
import {VoloMaster} from './Volo';
import {HallMaster} from './Hall';
import {NameMaster} from './Name';
import {RiftMaster} from './Rift';
import {ArtSil, Folk, Glow, PartCard, TitleCard, View} from './Overlays';

/**
 * 《神奥之名》整期总时间轴。镜头、光、神殿的状态都是整期帧号 f 的函数；各段（Segments.tsx）只是窗口。
 */

// ── 1 枪之柱 ──

/** 开场对准的那根断柱：正面一排里留得最高、带尖的一根 */
const SPEAR = COLUMNS.filter((c) => c.z === 18 && c.tipH > 0).sort((a, b) => b.keep - a.keep)[0];
const SPEAR_TOP = ruinTop(SPEAR);

/** 镜头关键帧：[x, y, z, 看向 x, y, z, fov]。几个连贯的长镜头，每次移动 3–5 秒以上，途经关键帧不停顿 */
const CAM: [number, number[]][] = [
	// 从云海升上山顶，沿断柱横移（赤日的剪影）
	[T.open, [74, -30, 128, 0, 3, 0, 36]],
	[160, [42, 7, 64, 0, 4, 0, 36]],
	[300, [24, 4.6, 40, -1, 4.5, -2, 39]],
	// 慢推向那根削尖的断柱
	[T.l4, [SPEAR.x + 4, 2.4, 33, SPEAR_TOP[0], SPEAR_TOP[1], SPEAR_TOP[2], 36]],
	[T.l4 + 40, [SPEAR.x + 3.4, 2.25, 32, SPEAR_TOP[0], SPEAR_TOP[1] + 0.8, SPEAR_TOP[2], 36]],
	// 沿柱身仰摇到星空，停在星空里放片名、篇章卡、星轨倒转
	[T.title + 40, [SPEAR.x + 2, 2.6, 30, SPEAR.x, 80, 4, 44]],
	[T.rewind + 60, [SPEAR.x + 1.6, 3.0, 30.5, SPEAR.x - 0.5, 80, 2, 46]],
	// 摇下来：黄昏，空着的雪顶；再从跪拜的人身后慢慢后拉
	[T.down, [SPEAR.x + 1, 3.0, 33, SPEAR.x * 0.4, 8, -20, 42]],
	[T.l6 + 95, [3, 2.2, 43, 0, 9, -10, 40]],
	[T.l7, [2.5, 1.9, 45, 0, 9.5, -10, 41]],
	// 光柱落下：缓缓升高、绕到侧面
	[T.l8 - 10, [22, 7, 36, 0, 4.5, 0, 44]],
	[T.l9, [25, 6.6, 33.5, 0, 4, 1, 43]],
	// 建殿：升高后拉，全景展开
	[T.built - 15, [40, 15, 54, 0, 6, 0, 38]],
	[T.l10 + 10, [38.5, 14.2, 53, 0, 6.4, 0, 38]],
	// 降到低机位仰望完工的神殿，再慢慢摇向山下的神阖
	[T.l11 + 25, [14, 5.2, 48, 0, 8.5, 8, 38]],
	[T.dark + 25, [-10, 6, 36, TOWN[0], TOWN[1] + 30, TOWN[2], 40]],
	[T.end1, [-13.5, 6.4, 34.5, TOWN[0], TOWN[1] + 28, TOWN[2], 37]],
];

/** 今天是废墟；镜头仰到星空后（T.swap）废墟不在画面里，直接去掉——摇下来时山顶本就是空的，之后按时间正向建起来 */
const ruinAt = (f: number) => (f < T.swap ? 1 : 0);
const buildAt = (f: number) => (f < T.swap ? 1 : prog(f, T.build, T.built));

/** 天色：月夜 → 仰望星空时褪成古代的黄昏 → 结尾入夜 */
const duskAt = (f: number) => track(f, [[T.rewind + 20, 0], [T.down - 20, 1], [T.l11, 1], [T.end1, 0.18]]);
/** 星空转角：平时缓慢转，倒流时飞快倒转、拖出星轨 */
const starAt = (f: number) => {
	const base = f * 0.0006;
	const back = -track(f, [[T.card, 0], [T.down, 7.5]]);
	const trail = track(f, [[T.card, 0], [T.card + 50, 0.9], [T.down - 60, 1.1], [T.down, 0]]);
	return {rot: base + back, trail};
};
/** 天上的金光（古人朝拜的神奥大尊）与十道光柱 */
const goldAt = (f: number) => track(f, [[T.l6, 0], [T.l6 + 50, 0.8], [T.beams, 1.1], [T.l8 + 40, 0.5], [T.l9 + 20, 0]]);
const BEAM_EVERY = 9;
const beamAt = (f: number, i: number) => {
	const t0 = T.beams + i * BEAM_EVERY;
	return interpolate(f, [t0, t0 + 3, t0 + 20, t0 + 70], [0, 1.8, 0.7, 0], clamp);
};
/** 剪影：光柱落下时出现，神殿建起时化成石像 */
const silAt = (f: number, i: number) => {
	const t0 = T.beams + i * BEAM_EVERY + 2;
	return interpolate(f, [t0, t0 + 10, T.build + 40 + i * 6, T.build + 70 + i * 6], [0, 1, 1, 0], clamp);
};
/** 石像：建造时淡入 */
const statueAt = (f: number, i: number) => interpolate(f, [T.build + 40 + i * 6, T.build + 70 + i * 6], [0, 1], clamp);

/** 神阖市镇的灯：散在台地上，一盏盏熄灭 */
const TOWN_LIGHTS: V3[] = Array.from({length: 46}, (_, i) => {
	const a = i * 2.39996;
	const r = 3 + Math.sqrt(i) * 3.4;
	const x = TOWN[0] + Math.cos(a) * r;
	const z = TOWN[2] + Math.sin(a) * r * 0.8;
	return [x, heightAt(x, z) + 0.6, z];
});
const townLightAt = (f: number, i: number) => {
	const on = interpolate(f, [T.l11 - 40, T.l11 + 10], [0, 1], clamp);
	const off = T.dark + ((i * 37) % 46) * 2.0;
	return on * interpolate(f, [off, off + 8], [1, 0], clamp) * (0.75 + 0.25 * Math.sin(f * 0.21 + i * 1.7));
};

/** 古人的剪影：朝北方天上的金光跪拜 */
const KNEEL: V3[] = [
	[-4, 0, 23],
	[-1.4, 0, 24.5],
	[1.5, 0, 23.6],
	[4.2, 0, 24.8],
	[-6.5, 0, 26.5],
	[-2.8, 0, 27.4],
	[0.4, 0, 28],
	[3.3, 0, 27.7],
	[6.4, 0, 26.6],
];
/** 搬石头的人与宝可梦（延时摄影：沿神殿正面从右往左走） */
const HAULERS = [0, 1, 2, 3, 4, 5];

const SegPillarLayers: React.FC<{f: number; v: View}> = ({f, v}) => {
	const kneel = interpolate(f, [T.l6, T.l6 + 30, T.l7 + 120, T.l7 + 160], [0, 1, 1, 0], clamp);
	const hero = interpolate(f, [T.l7 + 10, T.l7 + 40, T.l8 + 60, T.l8 + 90], [0, 1, 1, 0], clamp);
	const haul = interpolate(f, [T.l9, T.l9 + 20, T.built - 10, T.built + 10], [0, 1, 1, 0], clamp);
	const cyrus = interpolate(f, [T.cyrus, T.cyrus + 30, T.l3 - 30, T.l3], [0, 0.85, 0.85, 0], clamp);
	const noble = interpolate(f, [T.l8 + 10, T.l8 + 40, T.l9, T.l9 + 20], [0, 1, 1, 0], clamp);
	return (
		<>
			{/* 今天：赤日的剪影在断柱间一闪（时间与空间之神的蓝、粉微光） */}
			<Glow v={v} p={[-2.2, 4.5, 2]} r={300} rgb="90,140,255" a={cyrus * 0.4} />
			<Glow v={v} p={[2.2, 4.5, 2]} r={300} rgb="255,120,190" a={cyrus * 0.32} />
			<ArtSil v={v} who="cyrus" foot={[0, TEMPLE.stepTop, 6]} h={1.85} rimRgb="190,215,255" rim={0.95} opacity={cyrus} />

			{KNEEL.map((p, i) => (
				<Folk key={i} v={v} foot={p} pose="pray" t={0.5 + 0.5 * Math.sin(f * 0.04 + i * 1.3)} flip rimDir={[0, -1]} opacity={kneel} />
			))}
			{STATUES.map((s, i) => (
				<ArtSil
					key={s.name}
					v={v}
					who={s.name}
					foot={[s.x, 0, s.z]}
					h={3.4}
					rimRgb="255,214,140"
					rim={0.55 + (s.noble ? 0.45 * noble : -0.35 * noble)}
					opacity={silAt(f, i)}
					flip={s.x > 0}
				/>
			))}
			<Folk v={v} foot={[0, 0, 17]} pose="raise" rimDir={[0, -1]} rim={0.9} opacity={hero} />
			{HAULERS.map((i) => {
				const t = ((f - T.l9) * 0.006 + i / HAULERS.length) % 1;
				const x = 17 - t * 34;
				const z = 23 + (i % 2) * 1.4;
				return i % 3 === 2 ? (
					<ArtSil key={i} v={v} who={i % 2 ? 'ursaluna' : 'wyrdeer'} foot={[x, heightAt(x, z), z]} h={2.6} rimRgb="255,200,140" rim={0.6} opacity={haul} flip />
				) : (
					<Folk key={i} v={v} foot={[x, heightAt(x, z), z]} pose="pull" t={(f * 0.05 + i) % 1} flip rimDir={[-1, -0.4]} rimColor="#ffb878" opacity={haul} />
				);
			})}
			{TOWN_LIGHTS.map((p, i) => (
				<Glow key={i} v={v} p={p} r={11 + (i % 4) * 3} rgb="255,170,90" a={townLightAt(f, i)} />
			))}
		</>
	);
};

const SUBS_PILLAR: [number, number, string, string][] = [
	[T.l1, 140, '神奥地区，天冠山的山顶，立着一圈断裂的石柱。', 'In the Sinnoh region, atop Mount Coronet, stands a ring of broken stone pillars.'],
	[T.l2, 298, '人们叫它"枪之柱"。银河队曾在这里，召唤过时间与空间之神。', 'People call it the Spear Pillar. Here, Team Galactic once summoned the gods of time and space.'],
	[T.l3, 410, '可很少有人问过：这些柱子，原本是什么？', 'Yet few have ever asked: what were these pillars, once?'],
	[T.l4, 528, '答案要回到很久以前——那时，神奥还不叫神奥。', 'The answer lies long ago, when Sinnoh was not yet called Sinnoh.'],
	[T.l5, 885, '那时，这片土地叫洗翠。', 'Back then, this land was called Hisui.'],
	[T.l6, 1060, '最早住在这里的人，崇拜一位创造了这片土地的神，叫它"神奥大尊"。', 'The first people here worshipped the god who made this land. They called it "almighty Sinnoh."'],
	[T.l7, 1245, '传说有一位古代英雄，带着十只宝可梦去挑战神奥大尊，得到了它的认可。', 'Legend tells of an ancient hero who led ten Pokémon against almighty Sinnoh—and won its approval.'],
	[T.l8, 1363, '那十只宝可梦的后代，后来被人们尊为"王"。', 'The descendants of those ten would come to be revered as nobles.'],
	[T.l9, 1543, '人们和宝可梦一起，把石头搬上天之山的峰顶，刻成那十只宝可梦的样子。', "People and Pokémon carried stone to the peak of heaven's mount, and carved it into those ten Pokémon."],
	[T.l10, 1635, '这就是供奉神奥大尊的神殿。', 'This was the temple of almighty Sinnoh.'],
	[T.l11, 1805, '那时还有一个叫"神阖"的市镇。后来居民离散，这个名字再也没人提起。', 'There was also a town called Celestica. In time its people scattered, and its name was spoken no more.'],
];

/** 第 2 段开头：镜头停在山腰的神阖上方，山下的云海涨上来（第 1 段的关键帧不动，保证两段交界一致） */
const coronetView = (f: number): View => {
	const c = flow(f, CAM);
	const k = track(f, [[T.end1, 0], [T.swap2, 1]]);
	return {pos: [c[0] - 1.2 * k, c[1] - 0.6 * k, c[2] - 0.8 * k], target: [c[3], c[4] - 16 * k, c[5]], fov: c[6] - 1.5 * k};
};

const SUBS: [number, number, string, string, SubtitleSource?][] = [...SUBS_PILLAR, ...SUBS_CLANS];

export const HisuiMaster: React.FC = () => {
	const f = useFrame();
	if (f >= T.end8) return <NameMaster f={f} />;
	if (f >= T.end7) return <HallMaster f={f} />;
	if (f >= T.end6) return <VoloMaster f={f} />;
	if (f >= T.end5) return <PlatesMaster f={f} />;
	if (f >= T.end4) return <GodsMaster f={f} />;
	if (f >= T.end3) return <CosmosMaster f={f} />;
	if (f >= T.end2) return <RiftMaster f={f} />;
	if (f >= T.swap2) return <CoastMaster f={f} />;
	const view = coronetView(f);
	const dusk = duskAt(f);
	const star = starAt(f);
	const gold = goldAt(f);
	const ruin = ruinAt(f);
	const build = buildAt(f);
	const time = f / 30;
	const cloudY = track(f, [[T.rewind, -58], [T.down, -128], [T.rise, -128], [T.swap2 - 6, 9]]);
	const cloudOp = track(f, [[T.rewind, 0.9], [T.down, 0.55], [T.l11, 0.5], [T.end1, 0.35], [T.swap2 - 40, 1]]);
	const snow = track(f, [[T.open, 0.85], [T.rewind, 0.85], [T.down, 0.2], [T.l11, 0.2], [T.end1, 0.5]]);
	// 黄昏雪地画面亮，颗粒降到 0.07；夜里 0.12
	const grain = 0.12 - 0.05 * dusk;
	const vig = 0.55 - 0.15 * dusk;
	return (
		<AbsoluteFill style={{background: '#05070c'}}>
			<ThreeCanvas width={1920} height={1080} shadows gl={{antialias: true}}>
				<CameraRig pos={view.pos} target={view.target} fov={view.fov} />
				<CoronetLights dusk={dusk} gold={gold} />
				<Sky cam={view.pos} s={{dusk, starRot: star.rot, trail: star.trail, gold}} />
				<Terrain />
				<Temple ruin={ruin} build={build} />
				{STATUES.map((s, i) => (
					<StoneStatue key={s.name} dir={s.dir} pos={[s.x, TEMPLE.stepTop + PEDESTAL_H, s.z]} ry={s.ry} height={3.3} opacity={statueAt(f, i)} />
				))}
				{STATUES.map((s, i) => (
					<Beam key={s.name} p={[s.x, 0, s.z]} intensity={beamAt(f, i)} />
				))}
				<CloudSea y={cloudY} opacity={cloudOp} time={time} color={dusk > 0.5 ? '#ffd9c2' : '#9aa7bd'} shade={dusk > 0.5 ? '#a07888' : '#3d4658'} cam={view.pos} />
				<Snow cam={view.pos} time={time} amount={snow} wind={1.2} />
			</ThreeCanvas>
			<SegPillarLayers f={f} v={view} />
			<TitleCard f={f} from={T.title} to={T.card - 10} />
			<PartCard f={f} from={T.card} to={T.card + 80} zh="上篇 · 两个神" en="PART ONE · TWO GODS" />
			<AbsoluteFill style={{background: `radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,${vig}) 100%)`, pointerEvents: 'none'}} />
			<CloudPass f={f} />
			<Subs />
			<Grain opacity={grain} />
		</AbsoluteFill>
	);
};

const Subs: React.FC = () => (
	<>
		{SUBS.map(([from, to, zh, en, source]) => (
			<BiSubtitle key={from} from={from} to={to} zh={zh} en={en} source={source} {...SUB} />
		))}
	</>
);

/** 第 2 段起：洗翠的海岸 */
const CoastMaster: React.FC<{f: number}> = ({f}) => {
	const view = coastView(f);
	const lum = Math.max(coastDusk(f), coastDay(f));
	return (
		<AbsoluteFill style={{background: '#05070c'}}>
			<CoastWorld f={f} view={view} />
			<ClansLayers f={f} v={view} />
			<AbsoluteFill style={{background: `radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,${0.55 - 0.15 * lum}) 100%)`, pointerEvents: 'none'}} />
			<CloudPass f={f} />
			<Subs />
			{/* 雪原、沙滩是浅色画面，颗粒压到 0.06 左右（省码率） */}
			<Grain opacity={0.12 - 0.065 * lum} />
		</AbsoluteFill>
	);
};
