import {AbsoluteFill, Easing, interpolate, staticFile} from 'remotion';
import {Cam, project, shake, track} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer, Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Orb} from '../../components/effects/Orb';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {PokemonArt} from '../../components/PokemonArt';
import {SacredRings} from '../../components/SacredRings';
import {CINZEL, SERIF} from '../../fonts';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {LAKE_FRAG} from '../../gl/shaders';
import {clamp, COLORS} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {Cry} from '../../components/Cry';

// ─── 时间轴（30fps 单位，1150 帧 ≈ 38 秒）─────────────────────────
export const LAKE_TRIO_SCENE_FRAMES = 1150;

const W = 1920;
const H = 1080;
const WATER_Y = 640;
const SIZE = 440;
const HOVER_Y = 400;

type God = {
	key: string;
	art: string;
	x: number;
	rgb: string;
	/** 立绘上额头宝石的相对位置 */
	gem: {x: number; y: number};
	burst: number;
	no: string;
	zh: string;
	en: string;
	category: string;
	categoryEn: string;
	lake: string;
	lakeEn: string;
	dexZh: string;
	dexEn: string;
};

const GODS: God[] = [
	{
		key: 'uxie',
		art: staticFile('pokemon/uxie/art.png'),
		x: 420,
		rgb: '240,208,110',
		gem: {x: 0.18, y: 0.28},
		burst: 150,
		no: 'No.0480',
		zh: '由克希',
		en: 'UXIE',
		category: '知识宝可梦',
		categoryEn: 'KNOWLEDGE POKÉMON',
		lake: '睿智湖',
		lakeEn: 'LAKE ACUITY',
		dexZh: '被称为知识之神。据说拥有消除与之目光交会者的记忆的力量。',
		dexEn: 'Known as “The Being of Knowledge.” It is said that it can wipe out the memory of those who see its eyes.',
	},
	{
		key: 'mesprit',
		art: staticFile('pokemon/mesprit/art.png'),
		x: 960,
		rgb: '240,160,192',
		gem: {x: 0.49, y: 0.16},
		burst: 360,
		no: 'No.0481',
		zh: '艾姆利多',
		en: 'MESPRIT',
		category: '感情宝可梦',
		categoryEn: 'EMOTION POKÉMON',
		lake: '心齐湖',
		lakeEn: 'LAKE VERITY',
		dexZh: '教会了人们悲伤的痛苦和快乐的宝贵。被称为感情之神。',
		dexEn: 'Known as “The Being of Emotion.” It taught humans the nobility of sorrow, pain, and joy.',
	},
	{
		key: 'azelf',
		art: staticFile('pokemon/azelf/art.png'),
		x: 1500,
		rgb: '130,172,240',
		gem: {x: 0.64, y: 0.25},
		burst: 570,
		no: 'No.0482',
		zh: '亚克诺姆',
		en: 'AZELF',
		category: '意志宝可梦',
		categoryEn: 'WILLPOWER POKÉMON',
		lake: '立志湖',
		lakeEn: 'LAKE VALOR',
		dexZh: '被称为意志之神。一直沉睡在湖底，维持着世界的平衡。',
		dexEn: 'Known as “The Being of Willpower.” It sleeps at the bottom of a lake to keep the world in balance.',
	},
];

const T = {
	orbsIn: 30,
	orbTravel: [50, 132] as const,
	lakesIn: 790, // "守护着神奥的三座湖"
	pillars: [795, 860] as const,
	matter: [885, 985] as const, // 物质诞生：时空双神的光
	spirit: [990, 1100] as const, // 心灵诞生：三神之光升起汇聚
	converge: [1010, 1060] as const,
	fadeOut: 1122,
};

const CONVERGE_POINT = {x: 960, y: 150};
const reveal = (burst: number) => [burst + 20, burst + 38, burst + 56] as [number, number, number];
const floatPeriod = (i: number) => 22 + i * 3;
const floatOffset = (frame: number, i: number) => Math.sin(frame / floatPeriod(i)) * 9;
const gemPos = (g: God, i: number, frame: number) => ({
	x: g.x - SIZE / 2 + g.gem.x * SIZE,
	y: HOVER_Y - SIZE / 2 + g.gem.y * SIZE + floatOffset(frame, i),
});

// ─── 镜头：随光下降 → 沿湖岸横移 → 拉回全景 → 升起 → 仰望天顶 ─────────
const getCam = (frame: number): Cam => {
	const glide = Easing.inOut(Easing.cubic);
	const x = track(frame, [
		[0, 960],
		[120, 960],
		[172, 560, glide], // 由克希
		[340, 560],
		[388, 960, glide], // 艾姆利多
		[550, 960],
		[598, 1360, glide], // 亚克诺姆
		[770, 1360],
		[815, 960, glide], // 拉回全景
		[LAKE_TRIO_SCENE_FRAMES, 960],
	]);
	const y = track(frame, [
		[0, 150], // 从天空开始
		[40, 150],
		[150, 470], // 跟着光团下降到湖面
		[770, 470],
		[815, 520],
		[T.matter[0], 520],
		[T.matter[1], 430], // 物质诞生：缓慢升起
		[T.converge[0], 400],
		[T.converge[1] + 30, 230], // 心灵诞生：跟着光束仰望天顶
		[LAKE_TRIO_SCENE_FRAMES, 190],
	]);
	const zoom = track(frame, [
		[0, 1],
		[150, 1.1],
		[190, 1.25],
		[770, 1.25],
		[815, 1],
		[T.matter[1], 0.95],
		[T.converge[1] + 30, 1],
		[LAKE_TRIO_SCENE_FRAMES, 1.05],
	]);
	const roll = track(frame, [
		[0, 0],
		[172, -0.6],
		[388, 0.6],
		[598, -0.6],
		[815, 0],
	]);
	const hits = GODS.map((g) => shake(frame, g.burst, 5, 16));
	return {
		x: x + hits.reduce((a, h) => a + h.x, 0),
		y: y + hits.reduce((a, h) => a + h.y, 0),
		zoom,
		roll: roll + hits.reduce((a, h) => a + h.roll, 0),
	};
};

// ─── 背景：晨雾中的湖 ───────────────────────────────────────────
const LAKE_OVERSCAN = 1.3;
const LCW = W * LAKE_OVERSCAN;
const LCH = H * LAKE_OVERSCAN;
const LOX = (LCW - W) / 2;
const LOY = (LCH - H) / 2;
const toCanvas = (x: number, y: number): [number, number] => [(x + LOX) / LCW, (y + LOY) / LCH];

/** mode 0：完整湖景（远景层）；mode 1：只画水面（与宝可梦同层） */
const Lake: React.FC<{mode: 0 | 1}> = ({mode}) => {
	const frame = useFrame();
	const age = (start: number) => (frame >= start ? (frame - start) / BASE_FPS : 0);
	// 每只宝可梦显形时，以及光柱落水时，湖面各荡起一组涟漪
	const rip = (g: God) => {
		const start = frame >= T.pillars[0] + 8 ? T.pillars[0] + 8 : g.burst;
		return [...toCanvas(g.x, WATER_Y + 26), age(start)] as [number, number, number];
	};
	const glow = interpolate(frame, [0, 60, T.matter[0], T.spirit[1]], [0.55, 0.8, 0.9, 1.25], clamp);
	// 从上一段的黑暗中缓缓浮现
	const bright = interpolate(frame, [0, 45], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	return (
		<AbsoluteFill>
			<ShaderCanvas
				frag={LAKE_FRAG}
				width={LCW}
				height={LCH}
				style={{position: 'absolute', left: -LOX, top: -LOY}}
				uniforms={{
					uTime: frame / BASE_FPS,
					uMode: mode,
					uWater: (WATER_Y + LOY) / LCH,
					uSun: toCanvas(960, 560),
					uGlow: glow,
					uBright: bright,
					uRip0: rip(GODS[0]),
					uRip1: rip(GODS[1]),
					uRip2: rip(GODS[2]),
				}}
			/>
		</AbsoluteFill>
	);
};

// ─── 三团光从天而降 ─────────────────────────────────────────────
const DescendingOrbs: React.FC = () => {
	const frame = useFrame();
	if (frame < T.orbsIn) return null;
	const grow = interpolate(frame, [T.orbsIn, T.orbTravel[0]], [0, 1], {...clamp, easing: Easing.out(Easing.back(2))});
	const travel = (f: number) =>
		interpolate(f, [T.orbTravel[0], T.orbTravel[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const start = {x: 960, y: 90};
	return (
		<AbsoluteFill>
			{GODS.map((g, i) => {
				if (frame >= g.burst) return null;
				const at = (f: number) => {
					const t = travel(f);
					return {x: start.x + (g.x - start.x) * t, y: start.y + (HOVER_Y - start.y) * Math.sin((t * Math.PI) / 2)};
				};
				const pos = at(frame);
				const moving = travel(frame) > 0 && travel(frame) < 1;
				const hover = travel(frame) >= 1 ? Math.sin(frame * 0.08 + i * 2) * 6 : 0;
				const swell = interpolate(frame, [g.burst - 14, g.burst], [1, 1.8], clamp);
				return (
					<div key={g.key}>
						{moving &&
							[1, 2, 3, 4, 5].map((k) => {
								const q = at(frame - k * 2);
								return <Orb key={k} x={q.x} y={q.y} size={60 * (1 - k * 0.13)} rgb={g.rgb} intensity={0.45 - k * 0.07} />;
							})}
						<Orb x={pos.x} y={pos.y + hover} size={72 * grow * swell * (1 + Math.sin(frame * 0.2 + i) * 0.06)} rgb={g.rgb} intensity={grow} />
					</div>
				);
			})}
		</AbsoluteFill>
	);
};

const OrbBurst: React.FC<{x: number; y: number; at: number; rgb: string}> = ({x, y, at, rgb}) => {
	const frame = useFrame();
	if (frame < at || frame > at + 40) return null;
	const t = interpolate(frame, [at, at + 36], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const ring = 50 + t * 700;
	const flash = interpolate(frame, [at, at + 4, at + 26], [0.2, 1, 0], clamp);
	return (
		<AbsoluteFill>
			<div
				style={{
					position: 'absolute',
					left: x - 350,
					top: y - 350,
					width: 700,
					height: 700,
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
					boxShadow: `0 0 36px rgba(${rgb},${0.8 * (1 - t)})`,
				}}
			/>
		</AbsoluteFill>
	);
};

// ─── 三神本体 + 湖面倒影 ─────────────────────────────────────────
const GodArt: React.FC<{g: God; i: number}> = ({g, i}) => (
	<PokemonArt
		src={g.art}
		x={g.x}
		y={HOVER_Y}
		size={SIZE}
		appear={g.burst}
		reveal={reveal(g.burst)}
		rimRgb="255,248,232"
		glowRgb={g.rgb}
		floatPeriod={floatPeriod(i)}
		restRim={0.35}
	/>
);

// 以水岸线为轴翻转的倒影：淡、虚，并被横向水纹切碎
const Reflections: React.FC = () => {
	const frame = useFrame();
	const shimmer = (frame * 0.6) % 9;
	const fade = `linear-gradient(to bottom, transparent ${WATER_Y - 380}px, rgba(0,0,0,0.9) ${WATER_Y - 30}px, #000 ${WATER_Y}px, transparent ${WATER_Y}px)`;
	const lines = `repeating-linear-gradient(to bottom, #000 0px, #000 5px, rgba(0,0,0,0.25) 6px, rgba(0,0,0,0.25) 9px)`;
	return (
		<AbsoluteFill
			style={{
				transformOrigin: `0 ${WATER_Y}px`,
				transform: `scaleY(-1) scaleX(${1 + Math.sin(frame * 0.05) * 0.004})`,
				opacity: 0.32,
				filter: 'blur(1.6px)',
				maskImage: `${fade}, ${lines}`,
				WebkitMaskImage: `${fade}, ${lines}`,
				maskPosition: `0 0, 0 ${shimmer}px`,
				WebkitMaskPosition: `0 0, 0 ${shimmer}px`,
				maskComposite: 'intersect',
				WebkitMaskComposite: 'source-in',
			}}
		>
			{GODS.map((g, i) => (
				<GodArt key={g.key} g={g} i={i} />
			))}
		</AbsoluteFill>
	);
};

// 额头宝石：显形时点亮；"心灵诞生"时三颗同时强光
const GemGlows: React.FC = () => {
	const frame = useFrame();
	return (
		<AbsoluteFill style={{mixBlendMode: 'screen'}}>
			{GODS.map((g, i) => {
				const [, , re] = reveal(g.burst);
				const intro = interpolate(frame, [re - 6, re + 8, re + 40], [0, 1, 0.25], clamp);
				const spirit = interpolate(frame, [T.spirit[0], T.spirit[0] + 20, T.spirit[1]], [0, 1, 0.6], clamp);
				const glow = Math.max(intro, spirit) * (0.85 + 0.15 * Math.sin(frame * 0.15 + i));
				if (glow <= 0) return null;
				const p = gemPos(g, i, frame);
				const s = 70 + glow * 90;
				return (
					<div
						key={g.key}
						style={{
							position: 'absolute',
							left: p.x - s / 2,
							top: p.y - s / 2,
							width: s,
							height: s,
							borderRadius: '50%',
							background: `radial-gradient(circle, rgba(255,245,235,${glow}) 0%, rgba(${g.rgb},${glow * 0.6}) 30%, transparent 68%)`,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

// 光柱：守护三湖时落入水中；心灵诞生时反向升起、在天顶汇聚
const LightPillars: React.FC = () => {
	const frame = useFrame();
	const down = interpolate(frame, [T.pillars[0], T.pillars[0] + 20, T.pillars[1]], [0, 1, 0], clamp);
	const up = interpolate(frame, [T.spirit[0] + 10, T.converge[0], T.converge[1], T.converge[1] + 30], [0, 1, 1, 0], clamp);
	const reach = interpolate(frame, [T.spirit[0] + 10, T.converge[0]], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	return (
		<AbsoluteFill style={{mixBlendMode: 'screen'}}>
			{GODS.map((g, i) => {
				const p = gemPos(g, i, frame);
				return (
					<div key={g.key}>
						{down > 0 && (
							<div
								style={{
									position: 'absolute',
									left: g.x - 18,
									top: p.y,
									width: 36,
									height: WATER_Y + 30 - p.y,
									opacity: down,
									background: `linear-gradient(to bottom, rgba(${g.rgb},0), rgba(255,250,235,0.9) 60%, rgba(${g.rgb},0.7))`,
									filter: 'blur(6px)',
								}}
							/>
						)}
						{up > 0 && (
							<svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, opacity: up}}>
								<line
									x1={p.x}
									y1={p.y}
									x2={p.x + (CONVERGE_POINT.x - p.x) * reach}
									y2={p.y + (CONVERGE_POINT.y - p.y) * reach}
									stroke={`rgba(${g.rgb},0.95)`}
									strokeWidth={6}
									strokeLinecap="round"
									style={{filter: `drop-shadow(0 0 10px rgba(${g.rgb},1)) drop-shadow(0 0 30px rgba(${g.rgb},0.7))`}}
								/>
							</svg>
						)}
					</div>
				);
			})}
		</AbsoluteFill>
	);
};

// 物质诞生：天空两侧亮起时空双神的蓝、粉之光
const TwinLights: React.FC = () => {
	const frame = useFrame();
	const o = interpolate(frame, [T.matter[0], T.matter[0] + 30, T.spirit[1], T.fadeOut], [0, 1, 0.5, 0], clamp);
	if (o <= 0) return null;
	const light = (x: number, rgb: string) => (
		<div
			style={{
				position: 'absolute',
				left: x - 700,
				top: -600,
				width: 1400,
				height: 1400,
				borderRadius: '50%',
				opacity: o,
				background: `radial-gradient(circle, rgba(${rgb},0.55) 0%, rgba(${rgb},0.18) 35%, transparent 65%)`,
			}}
		/>
	);
	return (
		<AbsoluteFill style={{mixBlendMode: 'screen'}}>
			{light(200, '150,190,235')}
			{light(1720, '235,170,205')}
		</AbsoluteFill>
	);
};

// 心灵诞生：三道光在天顶汇聚成星，远古光环随之展开
const SpiritStar: React.FC = () => {
	const frame = useFrame();
	const star = interpolate(frame, [T.converge[0], T.converge[1], T.fadeOut], [0, 1, 0.7], clamp);
	const bloom = interpolate(frame, [T.converge[1] - 4, T.converge[1] + 6, T.converge[1] + 50], [0, 1, 0], clamp);
	if (star <= 0) return null;
	return (
		<AbsoluteFill>
			<SacredRings x={CONVERGE_POINT.x} y={CONVERGE_POINT.y} size={760} revealFrom={T.converge[1] - 10} revealFrames={70} opacity={0.55} />
			<Orb x={CONVERGE_POINT.x} y={CONVERGE_POINT.y} size={90 + star * 40} rgb="255,214,140" intensity={star} />
			<div
				style={{
					position: 'absolute',
					left: CONVERGE_POINT.x - 900,
					top: CONVERGE_POINT.y - 900,
					width: 1800,
					height: 1800,
					borderRadius: '50%',
					opacity: bloom,
					mixBlendMode: 'screen',
					background: 'radial-gradient(circle, rgba(255,246,220,0.9) 0%, rgba(255,200,120,0.35) 25%, transparent 60%)',
				}}
			/>
		</AbsoluteFill>
	);
};

// 湖名标注
const LakeLabels: React.FC = () => {
	const frame = useFrame();
	const out = interpolate(frame, [T.matter[0] - 10, T.matter[0] + 10], [1, 0], clamp);
	return (
		<AbsoluteFill>
			{GODS.map((g, i) => {
				const o = interpolate(frame, [T.lakesIn + i * 8, T.lakesIn + i * 8 + 20], [0, 1], clamp) * out;
				if (o <= 0) return null;
				return (
					<div
						key={g.key}
						style={{
							position: 'absolute',
							left: g.x,
							top: WATER_Y + 40,
							transform: 'translateX(-50%)',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							opacity: o,
							textShadow: '0 0 16px rgba(0,0,0,0.9)',
						}}
					>
						<span style={{fontFamily: SERIF, fontSize: 30, letterSpacing: 10, color: COLORS.parchment}}>{g.lake}</span>
						<span style={{fontFamily: CINZEL, fontSize: 15, letterSpacing: 5, color: `rgba(${COLORS.goldRgb},0.8)`, marginTop: 4}}>
							{g.lakeEn}
						</span>
					</div>
				);
			})}
		</AbsoluteFill>
	);
};

const FadeOut: React.FC<{cam: Cam}> = ({cam}) => {
	const frame = useFrame();
	const opacity = interpolate(frame, [T.fadeOut, LAKE_TRIO_SCENE_FRAMES - 1], [0, 1], clamp);
	if (opacity <= 0) return null;
	// 四周暗下时，天顶那颗星留在最上层，与尾声开场的星衔接
	const star = project(cam, 1, CONVERGE_POINT);
	return (
		<>
			<AbsoluteFill style={{background: '#000', opacity}} />
			<div style={{opacity}}>
				<Orb x={star.x} y={star.y} size={118 * cam.zoom} rgb="255,214,140" intensity={0.7} />
			</div>
		</>
	);
};

const SOURCE_MYTH = {zh: '神奥传说《起始的故事》', en: 'THE ORIGINAL STORY · SINNOH MYTH'};

export const LakeTrioScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);
	const dust = interpolate(frame, [10, 50], [0, 1], clamp);

	return (
		<AbsoluteFill style={{background: '#0b0703', overflow: 'hidden'}}>
			<CamLayer cam={cam} k={0.35}>
				<Lake mode={0} />
				<TwinLights />
			</CamLayer>
			<CamLayer cam={cam} k={0.7}>
				<DustMotes opacity={dust * 0.5} />
			</CamLayer>
			<CamLayer cam={cam} k={1}>
			<Lake mode={1} />
			<Reflections />
			<LightPillars />
			{GODS.map((g, i) => (
				<GodArt key={g.key} g={g} i={i} />
			))}
			<GemGlows />
			<DescendingOrbs />
			{GODS.map((g) => (
				<OrbBurst key={g.key} x={g.x} y={HOVER_Y} at={g.burst} rgb={g.rgb} />
			))}
			<SpiritStar />
			<LakeLabels />
			</CamLayer>
			<CamLayer cam={cam} k={1.6} style={{filter: 'blur(1.5px)'}}>
				<DustMotes opacity={dust * 0.7} />
			</CamLayer>
			<Vignette />

			{/* 名称标签固定在画面顶部，水平位置跟随各自的宝可梦 */}
			{GODS.map((g) => (
				<NameTag
					key={g.key}
					from={g.burst + 40}
					x={project(cam, 1, {x: g.x, y: HOVER_Y}).x}
					y={24}
					align="center"
					compact
					no={g.no}
					zh={g.zh}
					en={g.en}
					category={g.category}
					categoryEn={g.categoryEn}
					opacity={interpolate(frame, [T.spirit[0], T.spirit[0] + 18], [1, 0], clamp)}
				/>
			))}

			<SubtitleBackdrop />
			<BiSubtitle
				from={15}
				to={138}
				zh="之后它又从自己的身体中孕育出了３个生命。"
				en="From itself again, three living things the Original One did make."
				source={SOURCE_MYTH}
			/>
			{GODS.map((g) => (
				<BiSubtitle
					key={g.key}
					from={g.burst + 50}
					to={g.burst + 200}
					zh={g.dexZh}
					en={g.dexEn}
					source={{zh: `${g.zh}图鉴《晶灿钻石》`, en: 'POKÉDEX · BRILLIANT DIAMOND'}}
				/>
			))}
			<BiSubtitle
				from={T.lakesIn - 5}
				to={T.matter[0] - 5}
				zh="它们分别守护着神奥的三座湖。"
				en="Each became the guardian of one of Sinnoh's three lakes."
			/>
			<BiSubtitle
				from={T.matter[0]}
				to={T.matter[1]}
				zh="在２个分身祈祷后，所谓的“物质”就此诞生。"
				en="The two beings wished, and from them, matter came to be."
				source={SOURCE_MYTH}
			/>
			<BiSubtitle
				from={T.spirit[0]}
				to={T.spirit[1] + 20}
				zh="在３个生命祈祷后，所谓的“心灵”就此诞生。"
				en="The three living things wished, and from them, spirit came to be."
				source={SOURCE_MYTH}
			/>

			{/* 叫声：三神各自显形时 */}
			{GODS.map((g) => (
				<Cry key={g.key} name={g.key} at={reveal(g.burst)[1]} volume={0.75} />
			))}
			<Grain />
			<FadeOut cam={cam} />
		</AbsoluteFill>
	);
};
