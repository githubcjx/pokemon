import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, shake, track} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer, Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {DustMotes} from '../../components/DustMotes';
import {Abyss, Pangaea} from '../../components/Elements';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// ─── 第 2 期 · 第 5 段「拖动大陆」（600 帧 = 20 秒）──────────────────────────
// 从海沟升起 → 冲出海面 → 古地图般的大地 → 地平线上的雷吉奇卡斯 → 光索拖动大陆 → 推进大陆间的海（交给尾声）
export const CONTINENT_SCENE_FRAMES = 600;

const T = {
	rise: [0, 96] as const,
	surface: 96,
	mapIn: [90, 200] as const,
	subIntro: [122, 228] as const,
	regiIn: [196, 290] as const,
	regiPeak: 290,
	tag: 300,
	ropes: [300, 350] as const,
	subDP: [314, 432] as const,
	pulls: [362, 432, 502],
	subShield: [446, 580] as const,
	diveIn: [540, 600] as const,
};

// 古地图的几何（与 PANGAEA_FRAG 一致）：地平线高度、地面缩放、被拖动大陆的中心与半径
const HORIZON = 0.5;
const C0 = {x: 0, y: 6};
const BLOB_R = 4;

/** 地面坐标 → 屏幕坐标（不含镜头变换）。背景画布有 OVERSCAN 倍的放大余量，要一并换算 */
const OVERSCAN = 1.3;
const CH = 1080 * OVERSCAN;
const groundToScreen = (gx: number, gy: number, scale: number) => {
	const z = gy / scale;
	const y = 0.5 / z - 0.02; // 地平线以下的高度（画布高度为 1）
	const px = gx / (z * scale);
	return {x: 960 + px * CH, y: -(CH - 1080) / 2 + (1 - HORIZON + y) * CH};
};

const pullAt = (frame: number) =>
	T.pulls.reduce((acc, at) => acc + interpolate(frame, [at, at + 40], [0, 1.3], {...clamp, easing: Easing.inOut(Easing.cubic)}), 0);

// ─── 镜头 1：从海沟升起 ───────────────────────────────────────────────
const RiseShot: React.FC = () => {
	const frame = useFrame();
	if (frame >= T.surface + 8) return null;
	const p = interpolate(frame, [T.rise[0], T.rise[1]], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const breath = 0.5 + 0.5 * Math.sin((frame / 120) * Math.PI * 2);
	const kFade = interpolate(frame, [0, 70], [1, 0], clamp);
	return (
		<AbsoluteFill>
			<Abyss centerX={0.5} caustic={0.35 + 1.2 * p} bright={1 + 1.5 * p} />
			{/* 越接近海面越亮的天光 */}
			<AbsoluteFill
				style={{background: `linear-gradient(180deg, rgba(170,220,225,${0.85 * p * p}) 0%, rgba(60,130,150,${0.5 * p}) 40%, transparent 85%)`}}
			/>
			{kFade > 0 && (
				<PokemonArt3D
					dir="pokemon/kyogre"
					variant="-primal"
					x={960}
					y={interpolate(frame, [0, 90], [584, 900], {...clamp, easing: Easing.in(Easing.quad)})}
					size={interpolate(frame, [0, 90], [790, 160], {...clamp, easing: Easing.in(Easing.quad)})}
					yaw={-4}
					pitch={4}
					opacity={kFade}
					depthScale={0.5}
					ambient={[0.02, 0.035, 0.06]}
					dirLights={[{dir: [0, -1, 0.4], color: [0.08, 0.2, 0.28], wrap: 0.3}]}
					rim={{dir: [0, -1], color: [0.18 * (0.4 + 0.6 * breath), 0.6 * (0.4 + 0.6 * breath), 0.72 * (0.4 + 0.6 * breath)], power: 2}}
					emissive={0.1 + 0.4 * breath}
					emissiveTint={[0.6, 1.0, 1.2]}
				/>
			)}
		</AbsoluteFill>
	);
};

// ─── 镜头 2：古地图与雷吉奇卡斯 ────────────────────────────────────────
const getCam = (frame: number): Cam => {
	const s = T.pulls.reduce((acc, at) => {
		const k = shake(frame, at, 7, 40);
		return {x: acc.x + k.x, y: acc.y + k.y, roll: acc.roll + k.roll};
	}, shake(frame, T.regiPeak, 5, 30));
	return {
		x: 960 + s.x,
		y:
			track(frame, [
				[T.diveIn[0], 540],
				[T.diveIn[1], 760, Easing.in(Easing.cubic)],
			]) + s.y,
		zoom: track(frame, [
			[T.mapIn[0], 1.12],
			[T.regiIn[0], 1.0],
			[T.diveIn[0], 1.04],
			[T.diveIn[1], 1.7, Easing.in(Easing.cubic)],
		]),
		roll: s.roll,
	};
};

/** 金色光索：从手到大陆远端，拖动时绷紧、间歇时微微松垂 */
const Ropes: React.FC<{hands: {x: number; y: number}[]; ends: {x: number; y: number}[]}> = ({hands, ends}) => {
	const frame = useFrame();
	const draw = interpolate(frame, [T.ropes[0], T.ropes[1]], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	if (draw <= 0) return null;
	const taut = T.pulls.reduce((acc, at) => Math.max(acc, interpolate(frame, [at - 4, at + 6, at + 40, at + 60], [0, 1, 1, 0], clamp)), 0);
	const sag = 70 * (1 - taut) + 8;
	const hum = taut * Math.sin(frame * 3.1) * 2.5; // 绷紧时的细颤
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
			{hands.map((h, i) => {
				const e = ends[i];
				const mx = (h.x + e.x) / 2;
				const my = (h.y + e.y) / 2 + sag + hum;
				const d = `M ${h.x} ${h.y} Q ${mx} ${my} ${e.x} ${e.y}`;
				const dash = {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw};
				return (
					<g key={i} fill="none" strokeLinecap="round">
						<path d={d} stroke={`rgba(255,200,110,${0.35 + 0.35 * taut})`} strokeWidth={16} style={{filter: 'blur(8px)'}} {...dash} />
						<path d={d} stroke={`rgba(255,226,160,${0.8 + 0.2 * taut})`} strokeWidth={4.5} {...dash} />
						<path d={d} stroke="rgba(255,250,235,0.9)" strokeWidth={1.6} {...dash} />
					</g>
				);
			})}
		</svg>
	);
};

const MapShot: React.FC<{cam: Cam}> = ({cam}) => {
	const frame = useFrame();
	if (frame < T.surface - 6) return null;
	const scale = track(frame, [
		[T.surface, 1.6],
		[T.mapIn[1], 4, Easing.out(Easing.cubic)],
	]);
	const pull = pullAt(frame);

	// 雷吉奇卡斯：地平线上的巨大身影，下半身没入暮霭
	const RX = 1080;
	const RY = 352;
	const RS = 900;
	const appear = interpolate(frame, [T.regiIn[0], T.regiIn[0] + 40], [0, 1], clamp);
	const r = interpolate(frame, [T.regiPeak - 14, T.regiPeak], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const eyes = interpolate(frame, [T.regiIn[0] + 30, T.regiPeak - 6, T.regiPeak, T.regiPeak + 40], [0, 1.6, 2.0, 0.6], clamp);
	const over = interpolate(frame, [T.regiPeak - 14, T.regiPeak, T.regiPeak + 36], [1, 1.45, 1], clamp);
	const lean = T.pulls.reduce((acc, at) => acc + interpolate(frame, [at, at + 14, at + 50], [0, 1, 0], clamp), 0);
	const horizonY = -(CH - 1080) / 2 + (1 - HORIZON) * CH;

	// 光索两端：雷吉奇卡斯的双手（立绘中约 7% / 93% 宽、66% 高）→ 被拖动大陆的远端
	const hands = [
		{x: RX + (0.07 - 0.5) * RS, y: RY + (0.66 - 0.5) * RS + lean * 6},
		{x: RX + (0.93 - 0.5) * RS, y: RY + (0.65 - 0.5) * RS + lean * 6},
	];
	const farEdge = C0.y + BLOB_R * 0.75 + pull;
	const ends = [groundToScreen(-1.6, farEdge, scale), groundToScreen(1.8, farEdge, scale)];

	return (
		<AbsoluteFill>
			<CamLayer cam={cam} k={0.6}>
				<Pangaea horizon={HORIZON} scale={scale} offset={[0, 0]} pull={[0, pull]} grid={interpolate(frame, [T.mapIn[0], T.mapIn[1]], [0, 1], clamp)} />
			</CamLayer>
			<CamLayer cam={cam} k={0.62}>
				{appear > 0 && (
					<div
						style={{
							position: 'absolute',
							inset: 0,
							opacity: appear,
							// 下半身没入地平线的暮霭
							maskImage: `linear-gradient(180deg, #000 ${horizonY - 40}px, transparent ${horizonY + 110}px)`,
							WebkitMaskImage: `linear-gradient(180deg, #000 ${horizonY - 40}px, transparent ${horizonY + 110}px)`,
						}}
					>
						<PokemonArt3D
							dir="pokemon/regigigas"
							x={RX}
							y={RY + lean * 6}
							size={RS}
							yaw={-3 + lean * 1.5}
							pitch={-2 + lean * 2}
							depthScale={0.5}
							brightness={over}
							ambient={[0.34 * r, 0.28 * r, 0.22 * r]}
							dirLights={[{dir: [-0.3, -0.5, 0.6], color: [0.8 * r, 0.62 * r, 0.4 * r], wrap: 0.3}]}
							rim={{dir: [0.2, -1], color: [1.5, 1.05, 0.55], power: 1.6}}
							emissive={eyes}
							emissiveTint={[1.2, 1.0, 0.75]}
						/>
					</div>
				)}
			</CamLayer>
			<CamLayer cam={cam} k={0.6}>
				<Ropes hands={hands} ends={ends} />
			</CamLayer>
			<CamLayer cam={cam} k={0.8}>
				<DustMotes opacity={0.6} />
			</CamLayer>
		</AbsoluteFill>
	);
};

export const ContinentScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);
	const surfaceFlash = interpolate(frame, [T.surface - 8, T.surface, T.surface + 24], [0, 0.95, 0], clamp);
	const dark = interpolate(frame, [T.diveIn[0] + 10, T.diveIn[1]], [0, 0.92], {...clamp, easing: Easing.in(Easing.quad)});
	const tagOut = interpolate(frame, [T.subShield[0], T.subShield[0] + 16], [1, 0], clamp);

	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			<MapShot cam={cam} />
			<RiseShot />
			<Vignette strength={0.55} />
			{surfaceFlash > 0 && <AbsoluteFill style={{background: `rgba(225,245,242,${surfaceFlash})`}} />}
			{dark > 0 && <AbsoluteFill style={{background: `radial-gradient(ellipse 60% 60% at 50% 70%, rgba(2,10,16,${dark * 0.85}) 0%, rgba(1,5,9,${dark}) 70%)`}} />}

			<NameTag
				from={T.tag}
				x={100}
				y={70}
				no="No.0486"
				zh="雷吉奇卡斯"
				en="REGIGIGAS"
				category="巨大宝可梦"
				categoryEn="COLOSSAL POKÉMON"
				opacity={tagOut}
			/>

			<SubtitleBackdrop />
			{/* 旁白（制作者撰写）：引出雷吉奇卡斯拖动大陆的传说 */}
			<BiSubtitle
				from={T.subIntro[0]}
				to={T.subIntro[1]}
				zh="传说中，大地的样貌也并非生来如此。"
				en="Legend holds that the land was not always shaped as it is today."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<BiSubtitle
				from={T.subDP[0]}
				to={T.subDP[1]}
				zh="世间流传着这样的传说，据说它拖动了用绳捆绑的大陆。"
				en="There is an enduring legend that states this Pokémon towed continents with ropes."
				source={{zh: '雷吉奇卡斯图鉴《晶灿钻石·明亮珍珠》', en: 'POKÉDEX · DIAMOND'}}
			/>
			<BiSubtitle
				from={T.subShield[0]}
				to={T.subShield[1]}
				zh="据说它用各种各样的材料制作了宝可梦后，把大陆移动到了现在的位置。"
				en="It’s said that Regigigas created other Pokémon from many different materials before it moved the continents to where they are today."
				source={{zh: '雷吉奇卡斯图鉴《盾》', en: 'POKÉDEX · SHIELD'}}
			/>

			<Cry name="regigigas" at={T.regiPeak} />
			<Grain />
		</AbsoluteFill>
	);
};
