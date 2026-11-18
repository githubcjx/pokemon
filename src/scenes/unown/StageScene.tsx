import {AbsoluteFill, Easing, Img, interpolate, random, staticFile} from 'remotion';
import {flow, shake} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {projectSnow, SinjohSnow, SnowCam} from '../../components/unown/SinjohSnow';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {HALL_FRAG} from '../../gl/sinjohHall';
import {clamp} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {F4, JOURNEY_SCENE_FRAMES, snowCam} from './JourneyScene';
import {FORMS} from './wall';

// ─── 第 6 段《他们守护的是什么》（1100 帧，约 37 秒；全片最大的爆发点）──────────────────────
// 接第 5 段末帧（神殿门洞的黑暗，深处一点金光）→ 穿过门洞进入殿内：两侧列柱，穹顶裂缝漏下冷光，
// 通道尽头的三角形舞台上，金光里站着阿尔宙斯（显色 + 叫声 + 名称卡；这座神殿，是为阿尔宙斯而建的）
// → 未知图腾从入口成群涌进来，一圈圈环绕阿尔宙斯（从不肯离开遗迹的未知图腾，在这里环绕着阿尔宙斯）
// → 爆发点二：第二次叫声 + 震动，墙、柱、穹顶从舞台上方裂开成宇宙，地面散去，只留舞台；
// 深处升起一颗星球，舞台的图案灌满金光（古老的文献记载……时间、空间与反物质——也就是世界，将会诞生）
// → 阿尔宙斯上方出现一颗蛋，裂开一道缝（未知图腾、阿露福遗迹、阿尔宙斯……谜团越来越深）→ 金光铺满画面。
// 游戏画面的顺序：未知图腾环绕 → 宇宙 → 地球 → 舞台图案 → 蛋出现、裂开（原作的实景照片蒙太奇不用；蛋里是什么不揭晓）。
export const STAGE_SCENE_FRAMES = 1100;

const F5 = F4 + JOURNEY_SCENE_FRAMES;

const T = {
	enter: [0, 40] as const,
	swap: 40,
	hallIn: [40, 130] as const,
	reveal: [150, 250] as const,
	cry: 250,
	name: 262,
	nameOut: [420, 444] as const,
	sub1: [290, 404] as const,
	unown: [370, 560] as const,
	sub2: [440, 574] as const,
	burst: 592,
	cosmos: [592, 690] as const,
	floorGone: [650, 760] as const,
	sub3a: [700, 812] as const,
	sub3b: [818, 932] as const,
	earth: [700, 880] as const,
	pattern: [800, 880] as const,
	egg: [860, 910] as const,
	crack: [970, 1010] as const,
	sub4: [944, 1062] as const,
	flash: [1030, 1100] as const,
};

const ease = Easing.inOut(Easing.sin);

/** 殿内的相机（米）：与雪原同一套换算 */
const hallKeys = {
	x: [[T.swap, 0], [200, 0], [330, 1.0], [560, -1.2], [700, 0], [830, 3.5], [960, 0], [1100, 0]],
	y: [[T.swap, 1.6], [200, 1.7], [330, 1.8], [560, 2.0], [700, 2.6], [830, 7.5], [960, 4.0], [1100, 5.4]],
	z: [[T.swap, 1.0], [200, -9], [330, -12.5], [560, -13.5], [700, -12], [830, -15.5], [960, -15], [1100, -19.5]],
	yaw: [[T.swap, 0], [200, 0], [330, -2], [560, 3], [700, 0], [830, -22], [960, 0], [1100, 0]],
	pitch: [[T.swap, -2], [200, -5], [330, -6], [560, -6], [700, -9], [830, 36], [960, -16], [1100, -14]],
} as Record<string, [number, number][]>;
const hallCam = (f: number): SnowCam => {
	const sh = shake(f, T.burst, 0.9, 60);
	return {
		x: flow(f, hallKeys.x) + sh.x * 0.05,
		y: flow(f, hallKeys.y) + sh.y * 0.05,
		z: flow(f, hallKeys.z),
		yaw: flow(f, hallKeys.yaw) + sh.roll * 2,
		pitch: flow(f, hallKeys.pitch),
		fov: 44 - 6 * interpolate(f, [T.burst, T.burst + 6, T.burst + 40], [0, 1, 0], clamp),
	};
};

const STAGE = {x: 0, y: 0.8, z: -24};
/** 阿尔宙斯：立绘中心（世界坐标）与边长（米） */
const ARC = {x: 0, y: STAGE.y + 1.95, z: STAGE.z, size: 4.3};
const EGG = {x: 0, y: 6.9, z: STAGE.z, h: 1.15};

/** 环绕阿尔宙斯的未知图腾：三圈，各自倾斜、反向旋转 */
const RINGS = [
	{r: 3.4, y: 2.2, tilt: 0.16, w: 0.35, n: 12},
	{r: 4.5, y: 3.4, tilt: -0.12, w: -0.26, n: 14},
	{r: 5.6, y: 4.6, tilt: 0.08, w: 0.2, n: 16},
];
const SWARM = RINGS.flatMap((ring, ri) =>
	Array.from({length: ring.n}, (_, i) => {
		const k = `${ri}:${i}`;
		return {
			ri,
			a0: (i / ring.n) * Math.PI * 2 + ri * 0.4,
			form: FORMS[Math.floor(random(`sf${k}`) * 28)],
			start: {x: (random(`sx${k}`) - 0.5) * 12, y: 1 + random(`sy${k}`) * 6, z: 1.5 - random(`sz${k}`) * 5},
			at: T.unown[0] + random(`sa${k}`) * 90,
			bob: random(`sb${k}`) * 6.28,
		};
	}),
);

export const StageScene: React.FC = () => {
	const f = useFrame();
	const fA = F5 + f;

	// ── 前段：穿过门洞（雪原着色器接着推进）──
	if (f < T.swap) {
		const c0 = snowCam(JOURNEY_SCENE_FRAMES);
		const k = interpolate(f, T.enter, [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
		const cam = {...c0, z: c0.z - 3.0 * k, y: c0.y - 0.15 * k};
		const veil = interpolate(f, [24, T.swap], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
		return (
			<AbsoluteFill style={{background: '#000'}}>
				<SinjohSnow cam={cam} time={fA / BASE_FPS} white={0} haze={0.15} snow={0.9 * (1 - k)} doorGlow={0.4 + 0.5 * k} />
				<Vignette strength={0.28 + 0.4 * k} />
				<AbsoluteFill style={{background: 'linear-gradient(to top, rgba(16,20,28,0.5) 0%, rgba(16,20,28,0.22) 17%, transparent 34%)', opacity: 1 - k}} />
				<Veil o={veil} />
				<Grain opacity={0.06 + 0.06 * k} frameOffset={F5} />
			</AbsoluteFill>
		);
	}

	const cam = hallCam(f);
	const fade = interpolate(f, T.hallIn, [1, 0], {...clamp, easing: Easing.out(Easing.quad)});
	const veil = interpolate(f, [T.swap, T.swap + 40], [1, 0], {...clamp, easing: Easing.out(Easing.quad)});
	const reveal = interpolate(f, T.reveal, [0, 1], {...clamp, easing: ease});
	const cosmos = interpolate(f, T.cosmos, [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const floorGone = interpolate(f, T.floorGone, [0, 1], {...clamp, easing: ease});
	const earth = interpolate(f, T.earth, [0, 1], {...clamp, easing: ease});
	const pattern = interpolate(f, T.pattern, [0, 1], {...clamp, easing: ease});
	const burstK = interpolate(f, [T.burst, T.burst + 4, T.burst + 50], [0, 1, 0], clamp);
	const light = 0.35 + 1.1 * reveal + 1.6 * burstK + 0.6 * pattern;

	// ── 阿尔宙斯 ──
	const ap = projectSnow(cam, ARC);
	const toModel = (p: {x: number; y: number; z: number}): [number, number, number] => [(p.x - ARC.x) / ARC.size, -(p.y - ARC.y) / ARC.size, (p.z - ARC.z) / ARC.size];
	const glowFront = {x: 0, y: STAGE.y + 0.4, z: STAGE.z + 2.6};
	const arceus = (
		<PokemonArt3D
			key="arceus"
			dir="pokemon/arceus"
			x={ap.x}
			y={ap.y}
			size={ARC.size * ap.scale}
			yaw={(cam.x - ARC.x) * -1.2 + Math.sin(fA / 70) * 2}
			pitch={-3}
			depthScale={0.5}
			ambient={[0.02 + 0.5 * reveal, 0.022 + 0.5 * reveal, 0.03 + 0.5 * reveal]}
			pointLights={[
				{pos: toModel(glowFront), color: [1.6 * light, 1.1 * light, 0.55 * light], radius: 1.2},
				{pos: toModel({x: -4, y: 9, z: STAGE.z + 4}), color: [0.5, 0.6, 0.8], radius: 2.5},
			]}
			rim={{dir: [-0.6, -0.7], color: [0.55 + 0.6 * pattern, 0.62 + 0.4 * pattern, 0.8], power: 2.2}}
			emissive={0.25 + 0.75 * reveal + 0.5 * burstK}
			brightness={0.12 + 0.88 * reveal}
			resolution={1.4}
		/>
	);

	// ── 未知图腾：从入口涌进来，一圈圈环绕 ──
	const items: {depth: number; el: React.ReactNode}[] = [{depth: ap.depth, el: arceus}];
	const time = (f - T.unown[0]) / BASE_FPS;
	SWARM.forEach((u, i) => {
		const ring = RINGS[u.ri];
		const k = interpolate(f, [u.at, u.at + 100], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
		if (k <= 0) return;
		const a = u.a0 + ring.w * time;
		const slot = {
			x: ARC.x + ring.r * Math.cos(a),
			y: ring.y + ring.r * Math.sin(a) * ring.tilt + Math.sin(fA / 23 + u.bob) * 0.08,
			z: ARC.z + ring.r * Math.sin(a),
		};
		const p = {
			x: u.start.x + (slot.x - u.start.x) * k,
			y: u.start.y + (slot.y - u.start.y) * k + Math.sin(k * Math.PI) * 1.2,
			z: u.start.z + (slot.z - u.start.z) * k,
		};
		const s = projectSnow(cam, p);
		if (s.behind || s.depth < 0.6) return;
		const size = Math.min(700, 0.6 * s.scale);
		const lit = 0.35 + 0.4 * reveal + 0.3 * cosmos;
		items.push({
			depth: s.depth,
			el: (
				<Img
					key={`u${i}`}
					src={staticFile(`pokemon/unown/art-${u.form}.png`)}
					style={{
						position: 'absolute',
						left: s.x - size / 2,
						top: s.y - size / 2,
						width: size,
						height: size,
						opacity: interpolate(k, [0, 0.15], [0, 1], clamp),
						filter: `brightness(${lit}) drop-shadow(0 0 ${size * 0.08}px rgba(255,200,120,${0.25 + 0.35 * pattern}))`,
					}}
				/>
			),
		});
	});
	items.sort((p, q) => q.depth - p.depth);

	// ── 蛋 ──
	const eggK = interpolate(f, T.egg, [0, 1], {...clamp, easing: ease});
	const crackK = interpolate(f, T.crack, [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
	const flash = interpolate(f, T.flash, [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const ep = projectSnow(cam, EGG);
	const eggH = EGG.h * ep.scale;

	return (
		<AbsoluteFill style={{background: '#000'}}>
			<ShaderCanvas
				frag={HALL_FRAG}
				width={1920}
				height={1080}
				scale={0.75}
				style={{position: 'absolute', left: 0, top: 0}}
				uniforms={{
					uTime: fA / BASE_FPS,
					uCamPos: [cam.x, cam.y, cam.z],
					uYaw: cam.yaw,
					uPitch: cam.pitch,
					uFov: cam.fov,
					uFade: fade,
					uLight: light,
					uShaft: 1 - cosmos,
					uCosmos: cosmos,
					uFloorGone: floorGone,
					uEarth: earth,
					uPattern: pattern,
				}}
			/>
			{items.map((it) => it.el)}
			{eggK > 0 && !ep.behind ? <Egg x={ep.x} y={ep.y} h={eggH} k={eggK} crack={crackK} f={fA} /> : null}
			<Cry name="arceus" at={T.cry} />
			<Cry name="arceus" at={T.burst} />
			<NameTag
				from={T.name}
				x={1280}
				y={300}
				no="No.0493"
				category="创造宝可梦"
				categoryEn="ALPHA POKÉMON"
				zh="阿尔宙斯"
				en="ARCEUS"
				opacity={interpolate(f, T.nameOut, [1, 0], clamp)}
			/>
			<Vignette strength={0.62} />
			<Veil o={veil} />
			{/* 爆发的金色闪光 */}
			<AbsoluteFill style={{background: `radial-gradient(circle at ${ap.x}px ${ap.y}px, rgba(255,226,160,0.95) 0%, rgba(255,170,70,0.4) 30%, transparent 70%)`, mixBlendMode: 'screen', opacity: burstK * 0.9}} />
			{/* 结尾：蛋的裂缝里涌出的金光铺满画面 */}
			{flash > 0 ? <AbsoluteFill style={{background: `radial-gradient(circle at ${ep.x}px ${ep.y}px, rgba(255,246,220,1) ${flash * 70}%, rgba(255,200,110,${flash}) ${30 + flash * 70}%)`, opacity: Math.min(1, flash * 1.3)}} /> : null}
			<SubtitleBackdrop />
			{/* 最后 20 帧铺成均匀的金白（第 7 段从这里接） */}
			<AbsoluteFill style={{background: '#fff3dc', opacity: interpolate(f, [STAGE_SCENE_FRAMES - 24, STAGE_SCENE_FRAMES - 4], [0, 1], clamp)}} />

			{/* 旁白（制作者撰写）：依据心金魂银·竹兰 "What is now the Sinjoh Ruins was built to honor ARCEUS by the Sinnoh people..." */}
			<BiSubtitle from={T.sub1[0]} to={T.sub1[1]} zh="这座神殿，是为阿尔宙斯而建的。" en="This temple was built to honor Arceus." source={{zh: '旁白（依据心金魂银·竹兰）', en: 'NARRATION (after HGSS · Cynthia)'}} />
			{/* 旁白（制作者撰写）：依据心金魂银的活动画面（阿尔宙斯站上舞台，被未知图腾环绕）与研究员台词 */}
			<BiSubtitle
				from={T.sub2[0]}
				to={T.sub2[1]}
				zh="从不肯离开遗迹的未知图腾，在这里环绕着阿尔宙斯。"
				en="Here, the Unown that never left their ruins gathered around Arceus."
				source={{zh: '旁白（依据心金魂银·神都遗迹活动画面）', en: 'NARRATION (after HGSS · Sinjoh Ruins event)'}}
			/>
			{/* 旁白（制作者撰写）：依据心金魂银·竹兰 "According to an ancient document, time, space, and antimatter, or what combined we call the world, shall be born when ARCEUS stands on the Mystri Stage." 一句拆成两条 */}
			<BiSubtitle
				from={T.sub3a[0]}
				to={T.sub3a[1]}
				zh="古老的文献记载：阿尔宙斯站上这座舞台时，"
				en="According to an ancient document, when Arceus stands on this stage,"
				source={{zh: '旁白（依据心金魂银·竹兰）', en: 'NARRATION (after HGSS · Cynthia)'}}
			/>
			<BiSubtitle
				from={T.sub3b[0]}
				to={T.sub3b[1]}
				zh="时间、空间与反物质——也就是世界，将会诞生。"
				en="time, space, and antimatter—what together we call the world—shall be born."
				source={{zh: '旁白（依据心金魂银·竹兰）', en: 'NARRATION (after HGSS · Cynthia)'}}
			/>
			{/* 旁白（制作者撰写）：依据心金魂银·研究员 "UNOWN, the Ruins of Alph, and ARCEUS... The mystery deepens..." */}
			<BiSubtitle
				from={T.sub4[0]}
				to={T.sub4[1]}
				zh="未知图腾、阿露福遗迹、阿尔宙斯……谜团越来越深。"
				en="The Unown, the Ruins of Alph, and Arceus… The mystery deepens."
				source={{zh: '旁白（依据心金魂银·研究员）', en: 'NARRATION (after HGSS · lead researcher)'}}
			/>
			<Grain frameOffset={F5} />
		</AbsoluteFill>
	);
};

/** 门洞里的黑暗 → 殿内：中央一点金光不断，四周压黑 */
const Veil: React.FC<{o: number}> = ({o}) =>
	o > 0 ? (
		<AbsoluteFill
			style={{
				opacity: o,
				background: 'radial-gradient(circle at 50% 46%, rgba(120,78,30,0.0) 0%, rgba(40,26,10,0.85) 22%, rgba(0,0,0,1) 48%)',
			}}
		/>
	) : null;

/** 蛋：白里透金的光，裂开一道缝（蛋不是宝可梦，可以画） */
const Egg: React.FC<{x: number; y: number; h: number; k: number; crack: number; f: number}> = ({x, y, h, k, crack, f}) => {
	const w = h * 0.78;
	const pts = [
		[-0.5, 0.02],
		[-0.32, -0.06],
		[-0.18, 0.05],
		[-0.04, -0.08],
		[0.1, 0.04],
		[0.24, -0.05],
		[0.38, 0.03],
		[0.5, -0.02],
	];
	const n = Math.max(2, Math.ceil(crack * pts.length));
	const line = pts
		.slice(0, n)
		.map(([px, py]) => `${px * w},${py * h}`)
		.join(' ');
	const pulse = 0.9 + 0.1 * Math.sin(f / 9);
	return (
		<div style={{position: 'absolute', left: x, top: y, opacity: k, pointerEvents: 'none'}}>
			<div
				style={{
					position: 'absolute',
					left: -h * 2,
					top: -h * 2,
					width: h * 4,
					height: h * 4,
					borderRadius: '50%',
					mixBlendMode: 'screen',
					background: `radial-gradient(circle, rgba(255,236,190,${0.55 * pulse}) 0%, rgba(255,190,100,${0.22 + 0.3 * crack}) 30%, transparent 65%)`,
				}}
			/>
			<svg width={w * 2} height={h * 2} viewBox={`${-w} ${-h} ${w * 2} ${h * 2}`} style={{position: 'absolute', left: -w, top: -h, overflow: 'visible'}}>
				<defs>
					<radialGradient id="eggFill" cx="0.42" cy="0.38" r="0.7">
						<stop offset="0" stopColor="#ffffff" />
						<stop offset="0.55" stopColor="#f6f1e6" />
						<stop offset="1" stopColor="#d9c7a0" />
					</radialGradient>
				</defs>
				<path
					d={`M 0,${-h / 2} C ${w * 0.42},${-h / 2} ${w / 2},${-h * 0.02} ${w / 2},${h * 0.12} C ${w / 2},${h * 0.36} ${w * 0.28},${h / 2} 0,${h / 2} C ${-w * 0.28},${h / 2} ${-w / 2},${h * 0.36} ${-w / 2},${h * 0.12} C ${-w / 2},${-h * 0.02} ${-w * 0.42},${-h / 2} 0,${-h / 2} Z`}
					fill="url(#eggFill)"
				/>
				{crack > 0 ? (
					<>
						<polyline points={line} fill="none" stroke="rgba(255,190,80,0.9)" strokeWidth={h * 0.06} strokeLinejoin="miter" style={{filter: `blur(${h * 0.03}px)`}} />
						<polyline points={line} fill="none" stroke="#fffbe8" strokeWidth={h * 0.018} strokeLinejoin="miter" />
					</>
				) : null}
			</svg>
		</div>
	);
};
