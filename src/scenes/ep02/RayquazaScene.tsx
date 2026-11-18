import {AbsoluteFill, Easing, interpolate, Sequence} from 'remotion';
import {Cam, shake, track} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer, Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {CloudTunnel, Coast, Stratosphere} from '../../components/Elements';
import {FlyThroughDust} from '../../components/effects/FlyThroughDust';
import {Impact} from '../../components/effects/Impact';
import {Lightning} from '../../components/effects/Lightning';
import {Rain} from '../../components/effects/Rain';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {ArtLighting, PokemonArt3D} from '../../components/PokemonArt3D';
import {SacredRings} from '../../components/SacredRings';
import {clamp} from '../../theme';
import {toFrames, useFrame} from '../../time';
import {CLASH_SCENE_FRAMES, ClashShot} from './ClashScene';

// ─── 第 2 期 · 第 3 段「天空之上」（900 帧 = 30 秒，全片高潮）─────────────────
// 混战 → 急速上摇穿云 → 平流层的寂静 → 烈空坐降临 → 俯冲穿云 → 悬停战场 → 爆发平息 → 宁静
export const RAYQUAZA_SCENE_FRAMES = 900;

const T = {
	whipUp: [46, 84] as const,
	clouds: [66, 156] as const,
	breakOut: 152,
	subOzone: [178, 288] as const,
	ripple: [262, 350] as const,
	rayIn: [296, 372] as const,
	rayPeak: 372,
	tag: 384,
	subAge: [396, 466] as const,
	dive: [458, 520] as const,
	whipDown: [482, 516] as const,
	diveClouds: [500, 572] as const,
	battle: 566,
	charge: [592, 640] as const,
	burst: 640,
	subLegend: [716, 858] as const,
};

const SUN: [number, number] = [0.17, 0.2];

// ─── 纵向动态模糊（急速摇镜）─────────────────────────────────────────
const VBlur: React.FC<{id: string; amount: number}> = ({id, amount}) => (
	<svg width={0} height={0} style={{position: 'absolute'}}>
		<filter id={id} x="-5%" y="-30%" width="110%" height="160%">
			<feGaussianBlur stdDeviation={`${amount * 0.08} ${amount}`} />
		</filter>
	</svg>
);

const Whip: React.FC<{id: string; y: number; blur: number; children: React.ReactNode}> = ({id, y, blur, children}) => (
	<AbsoluteFill style={{transform: `translateY(${y}px)`, filter: blur > 0.5 ? `url(#${id})` : undefined}}>
		<VBlur id={id} amount={blur} />
		{children}
	</AbsoluteFill>
);

// 云层内部 / 战场上空的闪电
const BOLTS = [
	{at: 18, from: [1460, -60], to: [1380, 560], x: 0.72},
	{at: 104, x: 0.6},
	{at: 124, x: 0.35},
	{at: 538, x: 0.55},
	{at: 574, from: [520, -60], to: [600, 620], x: 0.28},
	{at: 606, from: [1620, -60], to: [1700, 640], x: 0.86},
	{at: 626, from: [300, -60], to: [380, 560], x: 0.16},
] as {at: number; from?: [number, number]; to?: [number, number]; x: number}[];

const flashAt = (frame: number) =>
	BOLTS.reduce((acc, b) => {
		const t = frame - b.at;
		if (t < 0 || t > 14) return acc;
		return Math.max(acc, t < 2 ? 1 : t < 3.5 ? 0.3 : t < 5.5 ? 0.85 : 0.85 * Math.exp(-(t - 5.5) / 3));
	}, 0);

// ─── 烈空坐的光照 ──────────────────────────────────────────────────
const rayquazaLight = (frame: number): ArtLighting => {
	const flash = flashAt(frame);
	// 剪影 → 显色
	const r = interpolate(frame, [T.rayPeak - 12, T.rayPeak], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	// 爆发前的蓄力：环纹越来越亮
	const charge = interpolate(frame, [T.charge[0], T.burst], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const after = interpolate(frame, [T.burst, T.burst + 60], [0, 1], clamp);
	const inStorm = frame >= T.diveClouds[0] + 20 && frame < T.burst ? 1 : 0;
	const emissive =
		interpolate(frame, [T.rayIn[0], T.rayPeak - 4, T.rayPeak, T.rayPeak + 40], [0.15, 0.8, 1.6, 0.45], clamp) + charge * 2.2 - after * 0.1;
	return {
		depthScale: 0.5,
		ambient: [0.3 * r * (1 - inStorm * 0.3), 0.34 * r * (1 - inStorm * 0.25), 0.46 * r],
		dirLights: [
			// 平流层：左上方的太阳；战场：爆发后从天而降的金光
			{dir: [-0.7, -0.6, 0.4], color: [1.1 * r * (1 - inStorm), 0.92 * r * (1 - inStorm), 0.62 * r * (1 - inStorm)], wrap: 0.2},
			{dir: [0.2, -1, 0.5], color: [1.0 * after, 0.85 * after, 0.55 * after], wrap: 0.3},
			{dir: [0.8, -0.5, 0.3], color: [2.0 * flash, 2.2 * flash, 2.7 * flash], wrap: 0},
		],
		rim: {dir: [-0.85, -0.55], color: [1.6, 1.25, 0.75], power: 1.8},
		emissive,
		emissiveTint: [1.2, 1.0, 0.6],
	};
};

// ─── 镜头 A：接续上一段的混战，急速上摇 ────────────────────────────────
const BattleWhipUp: React.FC = () => {
	const frame = useFrame();
	if (frame >= T.whipUp[1]) return null;
	const p = interpolate(frame, [T.whipUp[0], T.whipUp[1]], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	return (
		<Whip id="whipA" y={p * 1400} blur={p * 60}>
			{/* 让上一段的对撞镜头沿自己的时间线继续往下放，画面无缝接续 */}
			<Sequence from={-toFrames(CLASH_SCENE_FRAMES)} layout="none">
				<ClashShot />
			</Sequence>
		</Whip>
	);
};

// ─── 镜头 B / D：穿云（向上 / 俯冲）────────────────────────────────────
const CloudsUp: React.FC = () => {
	const frame = useFrame();
	if (frame < T.whipUp[0] || frame > T.breakOut + 18) return null;
	const enter = interpolate(frame, [T.whipUp[0], T.whipUp[1]], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	const travel = track(frame, [
		[T.whipUp[0], 0],
		[T.breakOut, 3.4, Easing.in(Easing.quad)],
	]);
	const tint = interpolate(frame, [T.clouds[0], 120, T.breakOut], [0, 0.25, 1], {...clamp, easing: Easing.in(Easing.quad)});
	return (
		<Whip id="whipB" y={(enter - 1) * 1400} blur={(1 - enter) * 60 * (frame < T.whipUp[1] ? 1 : 0)}>
			<CloudTunnel travel={travel} tint={tint} flash={flashAt(frame)} />
			<FlyThroughDust travel={travel * 4} speed={0.12} opacity={0.6 * (1 - tint)} />
		</Whip>
	);
};

const CloudsDown: React.FC = () => {
	const frame = useFrame();
	if (frame < T.whipDown[0] || frame >= T.battle + 6) return null;
	const enter = interpolate(frame, [T.whipDown[0], T.whipDown[1]], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	const travel = track(frame, [
		[T.whipDown[0], 0],
		[T.battle, 3.0, Easing.in(Easing.quad)],
	]);
	const tint = interpolate(frame, [T.diveClouds[0], T.diveClouds[0] + 40], [1, 0], clamp);
	return (
		<Whip id="whipD" y={(1 - enter) * 1400} blur={(1 - enter) * 60 * (frame < T.whipDown[1] ? 1 : 0)}>
			<CloudTunnel travel={travel} tint={tint} flash={flashAt(frame)} />
			<FlyThroughDust travel={travel * 4} speed={0.14} opacity={0.7} />
		</Whip>
	);
};

// ─── 镜头 C：平流层 ────────────────────────────────────────────────
const StratoShot: React.FC<{cam: Cam}> = ({cam}) => {
	const frame = useFrame();
	if (frame < T.breakOut - 4 || frame >= T.whipDown[1]) return null;
	const down = interpolate(frame, [T.whipDown[0], T.whipDown[1]], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	return (
		<Whip id="whipC" y={-down * 1400} blur={down * 60}>
			<CamLayer cam={cam} k={0.25}>
				<Stratosphere
					sun={SUN}
					horizon={0.3}
					curve={0.09}
					ripple={track(frame, [
						[T.ripple[0], 1.15],
						[T.ripple[1], 0.5],
					])}
					rippleAmt={interpolate(frame, [T.ripple[0], T.ripple[0] + 20, T.ripple[1], T.ripple[1] + 60], [0, 1, 0.7, 0.15], clamp)}
				/>
			</CamLayer>
		</Whip>
	);
};

// ─── 镜头 E：战场上空 ──────────────────────────────────────────────
const BattleShot: React.FC<{cam: Cam; hidePair?: boolean}> = ({cam, hidePair = false}) => {
	const frame = useFrame();
	if (frame < T.battle) return null;
	const flash = flashAt(frame);
	const after = (a: number, b: number) => interpolate(frame, [T.burst + a, T.burst + b], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const calm = after(0, 80);
	const rainOut = after(0, 24);
	const lava = 0.85 + 0.1 * Math.sin(frame * 0.37);

	// 固拉多与盖欧卡：爆发前仍在角力，爆发后被震开、暗下去
	const strain = Math.sin(frame * 0.25) * 10 * (1 - calm);
	const recoil = after(0, 20);
	const subdued = after(10, 90);
	const gx = 760 - 150 * recoil + strain;
	const kx = 1170 + 150 * recoil - strain;
	const dim = 1 - 0.3 * subdued;

	const groudon: ArtLighting = {
		depthScale: 0.5,
		ambient: [0.32 + 0.1 * calm, 0.28 + 0.08 * calm, 0.26 + 0.04 * calm],
		dirLights: [
			{dir: [0.2, -1, 0.5], color: [0.9 * calm, 0.75 * calm, 0.5 * calm], wrap: 0.3},
			{dir: [1, -0.4, 0.2], color: [1.6 * flash, 1.8 * flash, 2.2 * flash], wrap: 0},
		],
		pointLights: [{pos: [0.05, 0.8, 0.25], color: [2.4 * lava * (1 - calm * 0.85), 0.85 * lava * (1 - calm * 0.85), 0.22 * (1 - calm)], radius: 0.7}],
		emissive: 0.35 * (1 - subdued),
		emissiveTint: [1.0, 0.72, 0.38],
	};
	const kyogre: ArtLighting = {
		depthScale: 0.5,
		ambient: [0.28 + 0.12 * calm, 0.32 + 0.1 * calm, 0.4],
		dirLights: [
			{dir: [0.2, -1, 0.5], color: [0.45 + 0.5 * calm, 0.52 + 0.4 * calm, 0.66 + 0.2 * calm], wrap: 0.3},
			{dir: [0.7, -0.6, 0.3], color: [2.2 * flash, 2.4 * flash, 2.9 * flash], wrap: 0},
		],
		emissive: 0.35 * (1 - subdued),
		emissiveTint: [0.85, 1.0, 1.2],
	};

	return (
		<AbsoluteFill>
			<CamLayer cam={cam} k={0.3}>
				<Coast
					horizon={0.97}
					front={Math.sin(frame * 0.05) * 0.5 * (1 - calm)}
					scroll={0}
					dolly={120 + frame * 0.02 * (1 - calm)}
					sun={0.55 * calm}
					rain={0.7 * (1 - calm)}
					heat={1.5 - 0.5 * calm}
					storm={1.6 - 1.0 * calm}
					clash={1.4 - 1.25 * calm}
					cool={calm}
					pool={[0.47, 0.7, after(2, 90) * 1.7]}
					flash={Math.max(flash, interpolate(frame, [T.burst, T.burst + 16], [1, 0], clamp))}
					flashX={0.5}
				/>
			</CamLayer>
			<CamLayer cam={cam} k={0.35}>
				{BOLTS.filter((b) => b.from && b.at > T.battle).map((b) => (
					<Lightning key={b.at} at={b.at} from={b.from!} to={b.to!} seed={`ep02r-${b.at}`} />
				))}
			</CamLayer>
			<CamLayer cam={cam} k={0.8}>
				{!hidePair && (
					<>
						<PokemonArt3D dir="pokemon/groudon" variant="-primal" x={gx} y={810} size={440} yaw={2} pitch={4} brightness={dim} {...groudon} />
						<PokemonArt3D dir="pokemon/kyogre" variant="-primal" x={kx} y={790} size={430} yaw={-2} pitch={4} brightness={dim} {...kyogre} />
					</>
				)}
				<Impact at={T.burst} x={965} y={800} scale={1.7} squash={0.3} />
			</CamLayer>
			<Rain opacity={0.9 * (1 - rainOut)} />
			<GodRays opacity={after(4, 60) * 0.8} />
		</AbsoluteFill>
	);
};

/** 云层冲开后从天而降的神光（屏幕空间） */
const GodRays: React.FC<{opacity: number}> = ({opacity}) => {
	const frame = useFrame();
	if (opacity <= 0) return null;
	const beams = [
		{x: 34, w: 7, rot: 14, a: 0.8},
		{x: 44, w: 4, rot: 9, a: 0.6},
		{x: 52, w: 10, rot: 4, a: 1},
		{x: 61, w: 5, rot: -2, a: 0.7},
		{x: 70, w: 8, rot: -8, a: 0.85},
	];
	return (
		<AbsoluteFill style={{opacity, mixBlendMode: 'screen', filter: 'blur(18px)', pointerEvents: 'none'}}>
			{beams.map((b, i) => (
				<div
					key={i}
					style={{
						position: 'absolute',
						left: `${b.x}%`,
						top: -200,
						width: `${b.w}%`,
						height: 1500,
						transformOrigin: '50% 0',
						transform: `rotate(${b.rot + Math.sin(frame * 0.02 + i) * 1.2}deg)`,
						background: `linear-gradient(180deg, rgba(255,232,180,${0.75 * b.a}) 0%, rgba(255,214,150,${0.35 * b.a}) 45%, transparent 85%)`,
					}}
				/>
			))}
		</AbsoluteFill>
	);
};

// ─── 镜头与烈空坐的位置 ───────────────────────────────────────────────
const getCam = (frame: number): Cam => {
	const s = shake(frame, T.burst, 42, 50);
	const s0 = shake(frame, T.rayPeak, 10, 24);
	const rumble = frame >= T.charge[0] && frame < T.burst ? interpolate(frame, [T.charge[0], T.burst], [1, 7], clamp) : 0;
	return {
		x: 960 + s.x + s0.x + rumble * Math.sin(frame * 2.7),
		y: 540 + s.y + s0.y + rumble * Math.cos(frame * 3.1),
		zoom: track(frame, [
			[T.breakOut, 1.1],
			[T.rayIn[0], 1.0],
			[T.rayPeak, 1.07, Easing.out(Easing.cubic)],
			[T.dive[0], 1.03],
			[T.battle, 1.18],
			[T.burst - 1, 1.08, Easing.in(Easing.cubic)],
			[T.burst + 6, 1.42, Easing.out(Easing.cubic)],
			[T.burst + 150, 1.0, Easing.inOut(Easing.cubic)],
			[RAYQUAZA_SCENE_FRAMES, 0.98],
		]),
		roll: s.roll + s0.roll,
	};
};

const rayquazaPose = (frame: number) => {
	// 平流层：从右上方滑入；俯冲：向左下扑去并放大；战场：从云底冲出后悬停，爆发后缓缓升起
	if (frame < T.battle) {
		return {
			x: track(frame, [
				[T.rayIn[0], 1760],
				[T.rayPeak, 1250, Easing.out(Easing.cubic)],
				[T.dive[0], 1220],
				[T.dive[1], 900, Easing.in(Easing.cubic)],
			]),
			y: track(frame, [
				[T.rayIn[0], 200],
				[T.rayPeak, 440, Easing.out(Easing.cubic)],
				[T.dive[0], 430],
				[T.dive[1], 640, Easing.in(Easing.cubic)],
			]),
			size: track(frame, [
				[T.rayIn[0], 1050],
				[T.dive[0], 1150],
				[T.dive[1], 1550, Easing.in(Easing.cubic)],
			]),
			yaw: track(frame, [
				[T.rayIn[0], 6],
				[T.rayPeak, 0],
				[T.dive[1], -6],
			]),
			pitch: track(frame, [
				[T.rayIn[0], -3],
				[T.dive[0], 0],
				[T.dive[1], 6],
			]),
		};
	}
	return {
		x: track(frame, [
			[T.battle, 1150],
			[T.battle + 26, 1330, Easing.out(Easing.cubic)],
		]),
		y: track(frame, [
			[T.battle, -260],
			[T.battle + 26, 330, Easing.out(Easing.cubic)],
			[T.burst, 345],
			[RAYQUAZA_SCENE_FRAMES, 255],
		]),
		size: track(frame, [
			[T.battle, 1600],
			[T.battle + 26, 980, Easing.out(Easing.cubic)],
		]),
		yaw: -3 + Math.sin(frame * 0.03) * 1.5,
		pitch: 5,
	};
};

const Rayquaza: React.FC<{cam: Cam}> = ({cam}) => {
	const frame = useFrame();
	if (frame < T.rayIn[0]) return null;
	const pose = rayquazaPose(frame);
	const bob = Math.sin(frame / 28) * 8;
	const over = interpolate(frame, [T.rayPeak - 12, T.rayPeak, T.rayPeak + 36], [1, 1.55, 1], clamp) * interpolate(frame, [T.burst - 2, T.burst, T.burst + 30], [1, 1.6, 1], clamp);
	// 爆发前在周身聚拢的日晷光环；爆发时扩散成冲击波
	const ringsSize = frame < T.burst ? interpolate(frame, [T.charge[0], T.burst], [1300, 950], clamp) : interpolate(frame, [T.burst, T.burst + 30], [950, 4600], {...clamp, easing: Easing.out(Easing.cubic)});
	const ringsO = frame < T.burst ? interpolate(frame, [T.charge[0], T.charge[0] + 16], [0, 1], clamp) : interpolate(frame, [T.burst, T.burst + 30], [1, 0], clamp);
	// 蓄力时身后越来越强的金色光晕
	const aura = frame < T.burst ? interpolate(frame, [T.charge[0], T.burst], [0, 1], {...clamp, easing: Easing.in(Easing.quad)}) : interpolate(frame, [T.burst, T.burst + 24], [1, 0], clamp);
	return (
		<CamLayer cam={cam} k={1}>
			{aura > 0 && (
				<div
					style={{
						position: 'absolute',
						left: pose.x - 60 - 700,
						top: pose.y + bob - 700,
						width: 1400,
						height: 1400,
						borderRadius: '50%',
						background: `radial-gradient(circle, rgba(255,236,180,${0.85 * aura}) 0%, rgba(255,200,110,${0.45 * aura}) 30%, transparent 65%)`,
						mixBlendMode: 'screen',
					}}
				/>
			)}
			{frame >= T.charge[0] && ringsO > 0 && (
				<div style={{position: 'absolute', inset: 0, filter: 'brightness(1.6)'}}>
					<SacredRings x={pose.x - 60} y={pose.y + bob} size={ringsSize} revealFrom={T.charge[0]} revealFrames={34} opacity={ringsO} />
				</div>
			)}
			<PokemonArt3D
				dir="pokemon/rayquaza"
				x={pose.x}
				y={pose.y + bob}
				size={pose.size}
				yaw={pose.yaw}
				pitch={pose.pitch}
				brightness={over}
				{...rayquazaLight(frame)}
			/>
		</CamLayer>
	);
};

export const RayquazaScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);
	// 冲出云顶 / 爆发时的白光
	const breakFlash = interpolate(frame, [T.breakOut - 6, T.breakOut, T.breakOut + 22], [0, 0.95, 0], clamp);
	const burstFlash = interpolate(frame, [T.burst - 1, T.burst + 1, T.burst + 36], [0, 1, 0], clamp);
	const tagOut = interpolate(frame, [T.dive[0], T.dive[0] + 14], [1, 0], clamp);

	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			<BattleShot cam={cam} />
			<StratoShot cam={cam} />
			<CloudsUp />
			<CloudsDown />
			<BattleWhipUp />
			<Rayquaza cam={cam} />
			<Vignette strength={0.5} />
			{breakFlash > 0 && <AbsoluteFill style={{background: `rgba(255,246,226,${breakFlash})`}} />}
			{burstFlash > 0 && (
				<AbsoluteFill
					style={{
						background: `radial-gradient(ellipse 70% 80% at 66% 35%, rgba(255,252,240,${burstFlash}) 0%, rgba(255,236,200,${burstFlash * 0.85}) 50%, rgba(255,225,180,${burstFlash * 0.6}) 100%)`,
					}}
				/>
			)}

			<NameTag
				from={T.tag}
				x={100}
				y={430}
				no="No.0384"
				zh="烈空坐"
				en="RAYQUAZA"
				category="天空宝可梦"
				categoryEn="SKY HIGH POKÉMON"
				opacity={tagOut}
			/>

			<SubtitleBackdrop />
			{/* 旁白（制作者根据设定撰写）：依据《钻石·珍珠》图鉴（栖息在臭氧层、从地面看不见）与《欧米伽红宝石》图鉴（平息争斗） */}
			<BiSubtitle
				from={T.subOzone[0]}
				to={T.subOzone[1]}
				zh="而在云层之上的臭氧层里，栖息着一只从未有人见过的宝可梦。"
				en="But high above the clouds, in the ozone layer, dwelt a Pokémon no one had ever seen."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<BiSubtitle
				from={T.subAge[0]}
				to={T.subAge[1]}
				zh="据说已经生存了数亿年。"
				en="Rayquaza is said to have lived for hundreds of millions of years."
				source={{zh: '烈空坐图鉴《欧米伽红宝石》', en: 'POKÉDEX · OMEGA RUBY'}}
			/>
			<BiSubtitle
				from={T.subLegend[0]}
				to={T.subLegend[1]}
				zh="烈空坐的力量压制了两者，这场漫长的争斗就此平息。"
				en="Rayquaza's power subdued them both, bringing the long battle to its end."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>

			<Cry name="rayquaza" at={T.rayPeak} />
			{/* 全片高潮：爆发瞬间再放一次（用户要求） */}
			<Cry name="rayquaza" at={T.burst} volume={1} />
			<Grain />
		</AbsoluteFill>
	);
};

/**
 * 本段结尾的平静全景，供下一段接续使用（放进 from = -本段帧数 的 Sequence 里继续往下放）。
 * rise：烈空坐向上飞离画面的位移（像素）。
 */
export const RayquazaFinale: React.FC<{rise?: number; hidePair?: boolean}> = ({rise = 0, hidePair = false}) => {
	const frame = useFrame();
	const cam = getCam(frame);
	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			<BattleShot cam={cam} hidePair={hidePair} />
			<AbsoluteFill style={{transform: `translateY(${-rise}px)`}}>
				<Rayquaza cam={cam} />
			</AbsoluteFill>
			<Vignette strength={0.5} />
		</AbsoluteFill>
	);
};
