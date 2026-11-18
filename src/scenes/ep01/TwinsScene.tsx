import {AbsoluteFill, Easing, Img, interpolate, staticFile} from 'remotion';
import {Cam, shake, track} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer, Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {BarrierShatter} from '../../components/effects/BarrierShatter';
import {Orb} from '../../components/effects/Orb';
import {SpaceGrid} from '../../components/effects/SpaceGrid';
import {TimeDial} from '../../components/effects/TimeDial';
import {TimeRiver} from '../../components/effects/TimeRiver';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {Dawn} from '../../components/Dawn';
import {PokemonArt} from '../../components/PokemonArt';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {Cry} from '../../components/Cry';

// ─── 时间轴（30fps 单位，810 帧 = 27 秒）──────────────────────────────
export const TWINS_SCENE_FRAMES = 810;

const T = {
	orbEmerge: 50, // 两团光从阿尔宙斯身上分出
	orbTravel: [70, 132] as const,
	dialgaBurst: 142,
	dialgaReveal: [165, 186, 206] as [number, number, number],
	dialTag: 200,
	riverIn: 275,
	palkiaBurst: 434,
	palkiaReveal: [456, 478, 498] as [number, number, number],
	palkiaTag: 492,
	crackStart: 566, // "屏障消失"
	breakAt: 598,
	exit: [768, 805] as const, // 双神化作光散去，只留黎明，接下一段
};

const ART = {
	arceus: staticFile('pokemon/arceus/art.png'),
	dialga: staticFile('pokemon/dialga/art.png'),
	palkia: staticFile('pokemon/palkia/art.png'),
};

const SIZE = 780;
const ARCEUS_POS = {x: 960, y: 480};
const DIALGA = {x: 560, y: 600};
const PALKIA = {x: 1380, y: 600};
// 立绘上的特征点（相对坐标）：帝牙卢卡胸口的金刚宝石、帕路奇亚肩上的珍珠
const DIALGA_GEM = {x: DIALGA.x - SIZE / 2 + 0.79 * SIZE, y: DIALGA.y - SIZE / 2 + 0.59 * SIZE};
const PALKIA_PEARL = {x: PALKIA.x - SIZE / 2 + 0.52 * SIZE, y: PALKIA.y - SIZE / 2 + 0.26 * SIZE};

const BLUE = '150,190,235';
const PINK = '235,170,205';

const SOURCE_MYTH = {zh: '神奥传说《起始的故事》', en: 'THE ORIGINAL STORY · SINNOH MYTH'};
const SOURCE_DIALGA = {zh: '帝牙卢卡图鉴《传说 阿尔宙斯》', en: 'POKÉDEX · LEGENDS: ARCEUS'};
const SOURCE_PALKIA = {zh: '帕路奇亚图鉴《传说 阿尔宙斯》', en: 'POKÉDEX · LEGENDS: ARCEUS'};

const DIALGA_FLOAT = 24;
const PALKIA_FLOAT = 28;
const floatY = (frame: number, period: number) => Math.sin(frame / period) * 9;

// ─── 背景：创世黎明 ──────────────────────────────────────────
// 时间开始流动的第一个迹象：晨光从星球的地平线下缓缓升起
const HORIZON_Y = 830;

/** 本段结束时黎明背景的状态（骑拉帝纳段从这一帧接上） */
export const DAWN_END = {
	sun: {x: 960, y: 735},
	horizonY: HORIZON_Y,
	glow: 1.1,
	rays: 0.9,
	zoom: 0.6,
	tintL: [0.85, 0.95, 1.2] as [number, number, number],
	tintR: [1.12, 0.92, 1.05] as [number, number, number],
	tintAmt: 0.4,
};
/** 本段结束时的镜头（骑拉帝纳段从这里开始） */
export const TWINS_END_CAM: Cam = {x: 960, y: 540, zoom: 0.92, roll: 0};

// ─── 镜头：追光甩镜、顺河横移，屏障碎裂时猛拉远 ──────────────────────
const getCam = (frame: number): Cam => {
	const x = track(frame, [
		[0, 960],
		[88, 960],
		[140, 620, Easing.inOut(Easing.cubic)], // 甩向左边，追上蓝光
		[270, 620],
		[412, 730], // 顺着时间长河横移
		[436, 1330, Easing.inOut(Easing.cubic)], // 快速甩向右边的粉光
		[T.breakAt, 1330],
		[700, 960, Easing.out(Easing.cubic)], // 拉远成双神全景
		[TWINS_SCENE_FRAMES, TWINS_END_CAM.x],
	]);
	const y = track(frame, [
		[0, 500],
		[88, 500],
		[140, 600],
		[412, 615],
		[436, 600],
		[T.breakAt, 600],
		[700, 570],
		[790, TWINS_END_CAM.y], // 缓慢升高
	]);
	const zoom = track(frame, [
		[0, 1.06],
		[88, 1.1],
		[140, 1.2],
		[206, 1.22],
		[412, 1.12],
		[436, 1.18],
		[498, 1.22],
		[T.crackStart, 1.22],
		[T.breakAt, 1.3, Easing.in(Easing.quad)], // 裂纹蔓延时推近
		[T.breakAt + 12, 0.9, Easing.out(Easing.exp)], // 屏障碎裂：猛拉远
		[700, 0.93],
		[790, TWINS_END_CAM.zoom],
	]);
	const roll = track(frame, [
		[0, 0],
		[140, -0.8],
		[412, 0.8],
		[436, -0.6],
		[T.breakAt, 0],
	]);
	const hits = [shake(frame, T.dialgaBurst, 6, 16), shake(frame, T.palkiaBurst, 6, 16), shake(frame, T.breakAt, 24, 30)];
	return {
		x: x + hits.reduce((a, h) => a + h.x, 0),
		y: y + hits.reduce((a, h) => a + h.y, 0),
		zoom,
		roll: roll + hits.reduce((a, h) => a + h.roll, 0),
	};
};

const Background: React.FC = () => {
	const frame = useFrame();
	const sunY = interpolate(frame, [0, 700], [900, 735], {...clamp, easing: Easing.out(Easing.sin)});
	const glow = interpolate(frame, [0, 40, T.dialgaBurst, T.palkiaBurst, T.palkiaBurst + 60], [0.35, 0.6, 0.85, 0.95, 1.1], clamp);
	const rays = interpolate(frame, [0, T.dialgaBurst, T.breakAt, T.breakAt + 60], [0.25, 0.55, 0.6, 0.9], clamp);
	const tintAmt = interpolate(frame, [120, 200], [0, 0.4], clamp);
	const r = interpolate(frame, [T.palkiaBurst - 10, T.palkiaBurst + 40], [0, 1], clamp);
	const tintR: [number, number, number] = [1 + 0.12 * r, 1 - 0.08 * r, 1 + 0.05 * r];
	const zoom = interpolate(frame, [T.breakAt, T.breakAt + 110], [0, 0.6], {...clamp, easing: Easing.out(Easing.cubic)});
	return (
		<Dawn
			sun={{x: 960, y: sunY}}
			horizonY={HORIZON_Y}
			glow={glow}
			rays={rays}
			tintL={DAWN_END.tintL}
			tintR={tintR}
			tintAmt={tintAmt}
			zoom={zoom}
			overscan={1.3}
		/>
	);
};

// ─── 开场：阿尔宙斯分出两个分身 ─────────────────────────────────
const ArceusIntro: React.FC = () => {
	const frame = useFrame();
	const opacity = interpolate(frame, [0, 20, 100, 150], [0, 1, 1, 0], clamp);
	if (opacity <= 0) return null;
	const rise = interpolate(frame, [100, 150], [0, -40], clamp);
	const size = 640;
	return (
		<Img
			src={ART.arceus}
			style={{
				position: 'absolute',
				left: ARCEUS_POS.x - size / 2,
				top: ARCEUS_POS.y - size / 2 + rise + floatY(frame, 24),
				width: size,
				height: size,
				opacity,
				filter: 'drop-shadow(0 0 8px rgba(255,236,190,0.6)) drop-shadow(0 0 40px rgba(255,200,110,0.55))',
			}}
		/>
	);
};

const bezier = (t: number, p0: {x: number; y: number}, c: {x: number; y: number}, p1: {x: number; y: number}) => ({
	x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x + t ** 2 * p1.x,
	y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * c.y + t ** 2 * p1.y,
});

const ORB_START = {x: 960, y: 500};
const PATHS = [
	{to: DIALGA, ctrl: {x: 680, y: 240}, rgb: BLUE, burst: T.dialgaBurst},
	{to: PALKIA, ctrl: {x: 1240, y: 240}, rgb: PINK, burst: T.palkiaBurst},
];

const Orbs: React.FC = () => {
	const frame = useFrame();
	if (frame < T.orbEmerge) return null;

	const grow = interpolate(frame, [T.orbEmerge, T.orbTravel[0]], [0, 1], {...clamp, easing: Easing.out(Easing.back(2))});
	const travel = (f: number) =>
		interpolate(f, [T.orbTravel[0], T.orbTravel[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});

	return (
		<AbsoluteFill>
			{PATHS.map((p, i) => {
				if (frame >= p.burst) return null;
				const t = travel(frame);
				// 抵达后轻微悬浮、脉动；临近爆发时膨胀
				const hover = t >= 1 ? Math.sin(frame * 0.08 + i) * 6 : 0;
				const swell = interpolate(frame, [p.burst - 14, p.burst], [1, 1.8], clamp);
				const pulse = 1 + Math.sin(frame * 0.2) * 0.06;
				const pos = bezier(t, ORB_START, p.ctrl, p.to);
				const trail = [1, 2, 3, 4, 5, 6].map((k) => ({
					...bezier(travel(frame - k * 2), ORB_START, p.ctrl, p.to),
					k,
				}));
				const moving = t > 0 && t < 1;
				return (
					<div key={i}>
						{moving &&
							trail.map((q) => (
								<Orb key={q.k} x={q.x} y={q.y} size={70 * (1 - q.k * 0.12)} rgb={p.rgb} intensity={0.5 - q.k * 0.07} />
							))}
						<Orb x={pos.x} y={pos.y + hover} size={80 * grow * pulse * swell} rgb={p.rgb} intensity={grow} />
					</div>
				);
			})}
		</AbsoluteFill>
	);
};

// 光球爆发：冲击环 + 局部闪光
const OrbBurst: React.FC<{x: number; y: number; at: number; rgb: string}> = ({x, y, at, rgb}) => {
	const frame = useFrame();
	if (frame < at || frame > at + 40) return null;
	const t = interpolate(frame, [at, at + 36], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const ring = 60 + t * 900;
	const flash = interpolate(frame, [at, at + 4, at + 26], [0.2, 1, 0], clamp);
	return (
		<AbsoluteFill>
			<div
				style={{
					position: 'absolute',
					left: x - 450,
					top: y - 450,
					width: 900,
					height: 900,
					borderRadius: '50%',
					opacity: flash,
					background: `radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(${rgb},0.6) 25%, transparent 60%)`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: x - ring / 2,
					top: y - ring / 2,
					width: ring,
					height: ring,
					borderRadius: '50%',
					border: `${3 * (1 - t) + 1}px solid rgba(255,250,240,${1 - t})`,
					boxShadow: `0 0 40px rgba(${rgb},${0.8 * (1 - t)})`,
				}}
			/>
		</AbsoluteFill>
	);
};

// ─── 帝牙卢卡：心跳（胸口宝石的脉冲光） ──────────────────────────
const Heartbeat: React.FC = () => {
	const frame = useFrame();
	const start = T.dialgaReveal[2];
	if (frame < start) return null;
	const period = 40;
	const local = (frame - start) % period;
	const gx = DIALGA_GEM.x;
	const gy = DIALGA_GEM.y + floatY(frame, DIALGA_FLOAT);
	// "扑通、扑通"：一个周期两次搏动
	const beats = [0, 9].map((offset) => {
		const b = local - offset;
		return b >= 0 && b < 26 ? b / 26 : -1;
	});
	const glow = Math.max(...beats.map((b) => (b >= 0 ? (1 - b) ** 2 : 0)));
	return (
		<AbsoluteFill style={{mixBlendMode: 'screen'}}>
			<div
				style={{
					position: 'absolute',
					left: gx - 60,
					top: gy - 60,
					width: 120,
					height: 120,
					borderRadius: '50%',
					background: `radial-gradient(circle, rgba(230,242,255,${0.9 * glow}) 0%, rgba(${BLUE},${0.5 * glow}) 35%, transparent 70%)`,
				}}
			/>
			{beats.map((b, i) =>
				b < 0 ? null : (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: gx - (20 + b * 260) / 2,
							top: gy - (20 + b * 260) / 2,
							width: 20 + b * 260,
							height: 20 + b * 260,
							borderRadius: '50%',
							border: `1.5px solid rgba(215,232,255,${0.7 * (1 - b)})`,
						}}
					/>
				),
			)}
		</AbsoluteFill>
	);
};

// ─── 帕路奇亚：呼吸（肩上珍珠的明暗起伏） ─────────────────────────
const Breath: React.FC = () => {
	const frame = useFrame();
	const start = T.palkiaReveal[2];
	if (frame < start) return null;
	const inhale = (Math.sin((frame - start) * 0.07 - Math.PI / 2) + 1) / 2;
	const px = PALKIA_PEARL.x;
	const py = PALKIA_PEARL.y + floatY(frame, PALKIA_FLOAT);
	const size = 90 + inhale * 70;
	return (
		<div
			style={{
				position: 'absolute',
				left: px - size / 2,
				top: py - size / 2,
				width: size,
				height: size,
				borderRadius: '50%',
				mixBlendMode: 'screen',
				background: `radial-gradient(circle, rgba(255,240,246,${0.35 + inhale * 0.5}) 0%, rgba(${PINK},${0.2 + inhale * 0.3}) 40%, transparent 70%)`,
			}}
		/>
	);
};

const Grid: React.FC = () => {
	const frame = useFrame();
	const base = Math.max(0, frame - 450) * 0.012;
	const burst = interpolate(frame, [T.breakAt, T.breakAt + 90], [0, 1.8], {...clamp, easing: Easing.out(Easing.cubic)});
	const radius = interpolate(frame, [T.breakAt, T.breakAt + 90], [760, 1900], {...clamp, easing: Easing.out(Easing.cubic)});
	return <SpaceGrid x={PALKIA.x} y={PALKIA.y - 20} revealFrom={450} phase={base + burst} radius={radius} opacity={0.55} />;
};

// 开场：接住上一段的白闪，从白光中淡入
const WhiteIn: React.FC = () => {
	const frame = useFrame();
	const opacity = interpolate(frame, [0, 28], [1, 0], {...clamp, easing: Easing.out(Easing.quad)});
	if (opacity <= 0) return null;
	return (
		<AbsoluteFill
			style={{opacity, background: 'radial-gradient(circle at 50% 45%, #fffdf6 0%, #fff4dc 45%, #f6e2b8 100%)'}}
		/>
	);
};

export const TwinsScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);
	const riverDim = interpolate(frame, [T.palkiaBurst, T.palkiaBurst + 40], [0.9, 0.35], clamp);
	// 结尾：双神与特效化作光散去，只留下黎明
	const exit = interpolate(frame, [T.exit[0], T.exit[1]], [1, 0], {...clamp, easing: Easing.in(Easing.quad)});
	const exitGlow = interpolate(frame, [T.exit[0], T.exit[1]], [1, 1.8], clamp);

	return (
		<AbsoluteFill style={{background: '#0b0703', overflow: 'hidden'}}>
			<CamLayer cam={cam} k={0.3}>
				<Background />
			</CamLayer>
			<CamLayer cam={cam} k={0.7}>
				<DustMotes opacity={0.6} />
			</CamLayer>

			<CamLayer cam={cam} k={1} style={{opacity: exit, filter: `brightness(${exitGlow})`}}>
			{/* 时间 */}
			<TimeDial x={DIALGA.x} y={DIALGA.y} size={900} revealFrom={170} opacity={0.5} />
			<TimeRiver from={T.riverIn} y={640} opacity={riverDim} />
			{/* 空间 */}
			<Grid />

			<ArceusIntro />
			<PokemonArt
				src={ART.dialga}
				x={DIALGA.x}
				y={DIALGA.y}
				size={SIZE}
				appear={T.dialgaBurst}
				reveal={T.dialgaReveal}
				rimRgb="232,242,255"
				glowRgb="175,195,220"
				floatPeriod={DIALGA_FLOAT}
			/>
			<Heartbeat />
			<PokemonArt
				src={ART.palkia}
				x={PALKIA.x}
				y={PALKIA.y}
				size={SIZE}
				appear={T.palkiaBurst}
				reveal={T.palkiaReveal}
				rimRgb="255,238,246"
				glowRgb="228,180,205"
				floatPeriod={PALKIA_FLOAT}
			/>
			<Breath />
			<Orbs />
			<OrbBurst x={DIALGA.x} y={DIALGA.y} at={T.dialgaBurst} rgb={BLUE} />
			<OrbBurst x={PALKIA.x} y={PALKIA.y} at={T.palkiaBurst} rgb={PINK} />
			<BarrierShatter cx={PALKIA_PEARL.x} cy={PALKIA_PEARL.y} crackStart={T.crackStart} breakAt={T.breakAt} />
			</CamLayer>
			<CamLayer cam={cam} k={1.6} style={{filter: 'blur(1.5px)'}}>
				<DustMotes opacity={0.8} />
			</CamLayer>
			<Vignette />

			<NameTag
				from={T.dialTag}
				x={100}
				y={70}
				no="No.0483"
				zh="帝牙卢卡"
				en="DIALGA"
				category="时间宝可梦"
				categoryEn="TEMPORAL POKÉMON"
				opacity={exit}
			/>
			<NameTag
				from={T.palkiaTag}
				x={1820}
				y={70}
				align="right"
				no="No.0484"
				zh="帕路奇亚"
				en="PALKIA"
				category="空间宝可梦"
				categoryEn="SPATIAL POKÉMON"
				opacity={exit}
			/>

			<SubtitleBackdrop />
			<BiSubtitle
				from={10}
				to={128}
				zh="起始之物创造出了２个分身。"
				en="From itself, two beings the Original One did make."
				source={SOURCE_MYTH}
			/>
			<BiSubtitle from={168} to={262} zh="时间于是开始流动，" en="Time started to spin." source={SOURCE_MYTH} />
			<BiSubtitle
				from={268}
				to={425}
				zh="当此神诞生，现世的时间便如滔滔大河般开始流动。"
				en="The birth of Dialga was what caused the vast river of time to begin flowing in our world."
				source={SOURCE_DIALGA}
			/>
			<BiSubtitle from={452} to={548} zh="空间于是开始扩张。" en="Space began to expand." source={SOURCE_MYTH} />
			<BiSubtitle
				from={554}
				to={722}
				zh="当此神诞生，阻隔现世的屏障消失，出现了无边无际的空间。"
				en="The birth of Palkia was what caused the walls of our world to disappear, creating a sky that spans for infinity."
				source={SOURCE_PALKIA}
			/>

			{/* 叫声：各自显形时 */}
			<Cry name="dialga" at={T.dialgaReveal[1]} />
			<Cry name="palkia" at={T.palkiaReveal[1]} />
			<Grain />
			<WhiteIn />
		</AbsoluteFill>
	);
};
