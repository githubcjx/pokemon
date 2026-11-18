import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Easing, interpolate, random} from 'remotion';
import {Cam, flow} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Grain} from '../../components/Grain';
import {InkMountains, PaperVignette} from '../../components/ink/InkPaper';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {Pagoda, PagodaRuin} from '../../three/Pagoda';
import {CameraRig, projectToScreen, V3, WeatherLights} from '../../three/stage';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {SEG_FRAMES, SEG_START} from './continuity';
import {BEAST_SIZE, BEAST_Y, BEAST_Z, BEASTS, getRebirthCamera, getRebirthFov, HOOH_SIZE, hoWorldAt, pxPerUnit} from './RebirthScene';
import {TowerMist} from './TowerMist';

// ─── 第 5 段《恐惧》（1020 帧 = 34 秒，昔·暮色，情绪转折）──────────────────────────
// 接第 4 段的群像：天色转暗，前景亮起一片晃动的火把（字幕一）→ 人群的长影伸向三只（字幕二）
// → 几道墨痕向它们掷去，半途就散成墨雾（字幕三：徒劳的攻击）→ 它们一动不动（字幕四）
// → 依次转身奔向西边的草原，墨色的风痕拖在身后（字幕五 + 水君图鉴"会随北风奔跑着离去"）
// → 凤王升入云中（字幕七：两只再未出现）→ 远方海上，银色的那一只沉入深海（字幕八）→ 墨潮漫过画面，接第 6 段
export const FEAR_SCENE_FRAMES = 1020;

const SEG_F = SEG_START.rebirth + SEG_FRAMES.rebirth; // 本段在整期时间轴（以第 2 段为 0）上的起点
const PREV = SEG_FRAMES.rebirth; // 第 4 段的帧数：凤王与三只的状态接着第 4 段往下算

const T = {
	dim: [0, 140] as const,
	sub1: [20, 150] as const,
	torches: [30, 150] as const,
	sub2: [165, 300] as const,
	shadows: [150, 300] as const,
	sub3: [315, 435] as const,
	attacks: [322, 344, 364, 384, 404] as const,
	sub4: [445, 522] as const,
	run: [526, 548, 572] as const,
	sub5: [530, 652] as const,
	sub6: [658, 760] as const,
	hoRise: [700, 830] as const,
	sub7: [770, 890] as const,
	lugia: [860, 985] as const,
	sub8: [895, 1008] as const,
	inkOut: [958, 1012] as const,
};

const WEST: V3 = [-28, 0, 0];
const EAST: V3 = [28, 0, 0];
const FOV = 34;
const END4 = getRebirthCamera(PREV);

/** 机位：起点 = 第 4 段最后一帧；三只奔走时向左摇，凤王升起时上仰，最后望向远方的海 */
const getCamera = (f: number) => {
	const pos: V3 = [
		flow(f, [
			[0, END4.pos[0]],
			[520, END4.pos[0]],
			[720, -62],
			[1020, -80],
		]),
		flow(f, [
			[0, END4.pos[1]],
			[700, 9],
			[830, 12],
			[1020, 11],
		]),
		flow(f, [
			[0, END4.pos[2]],
			[520, 70],
			[1020, 78],
		]),
	];
	const target: V3 = [
		flow(f, [
			[0, END4.target[0]],
			[520, END4.target[0]],
			[720, -64],
			[1020, -96],
		]),
		flow(f, [
			[0, END4.target[1]],
			[700, 8],
			[810, 15],
			[900, 9],
			[1020, 8],
		]),
		0,
	];
	return {pos, target};
};

/** 前景的火把：一群人站在塔基前方的雾里（只有火光和影子，不画人形） */
const TORCHES = Array.from({length: 26}, (_, i) => ({
	x: WEST[0] - 24 + random(`tx${i}`) * 48,
	z: 25 + random(`tz${i}`) * 13,
	y: 2.2 + random(`ty${i}`) * 1.2,
	at: T.torches[0] + random(`ta${i}`) * (T.torches[1] - T.torches[0]),
	ph: random(`tp${i}`) * 6.28,
}));

/** 掷向三只的墨痕：从某支火把出发，飞到七成就散开 */
const ATTACKS = T.attacks.map((at, i) => ({at, from: TORCHES[(i * 5 + 3) % TORCHES.length], beast: i % 3}));

/** 西边草原的墨草（屏幕空间，随镜头横移产生视差） */
const GRASS = Array.from({length: 150}, (_, i) => ({
	x: random(`gx${i}`) * 2600 - 340,
	h: 50 + random(`gh${i}`) * 120,
	lean: (random(`gl${i}`) - 0.6) * 0.5,
	w: 2 + random(`gw${i}`) * 3,
	ph: random(`gp${i}`) * 6.28,
	k: 0.7 + random(`gk${i}`) * 0.6,
}));

const LUGIA_SEA: V3 = [-150, 10, -140];

export const FearScene: React.FC = () => {
	const f = useFrame();
	const {pos, target} = getCamera(f);
	const gF = SEG_F + f;
	const fp = PREV + f; // 第 4 段的时间轴

	// 天色转暗（暮色），火光是主要的暖光
	const dim = interpolate(f, T.dim, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const inkCam: Cam = {x: 960 + target[0] * 5, y: 540 - (pos[1] - 24) * 4.5, zoom: 1 + (150 - pos[2]) / 500, roll: 0};

	// 凤王：接第 4 段的悬停，之后升入云中
	const rise = interpolate(f, T.hoRise, [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	const hoBase = hoWorldAt(fp, 1);
	const hoWorld: V3 = [hoBase[0] - rise * 6, hoBase[1] + rise * 48, hoBase[2] - rise * 20];
	const ho = projectToScreen(pos, target, FOV, hoWorld);
	const hoSize = HOOH_SIZE * pxPerUnit(pos, hoWorld, FOV);
	const hoO = interpolate(f, [T.hoRise[0] + 60, T.hoRise[1]], [1, 0], clamp);
	const hoGlow = (0.55 - 0.25 * dim) * hoO;

	// 三只：接第 4 段的站位，依次向西（左）奔走
	const beastState = BEASTS.map((b, i) => {
		const run = interpolate(f, [T.run[i], T.run[i] + 115], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
		const world: V3 = [b.x - run * 85, BEAST_Y + Math.abs(Math.sin(run * 9)) * 0.6 * Math.min(1, run * 4), BEAST_Z + run * 4];
		return {b, i, run, world, p: projectToScreen(pos, target, FOV, world), size: BEAST_SIZE * pxPerUnit(pos, world, FOV)};
	});
	// 雷 / 火 / 雨的晕染：第 4 段末尾留着 0.4，随三只离开散去
	const washLeft = 0.4 * interpolate(f, [0, 160], [1, 0], clamp);

	// 火把与人影
	const torchO = (t: (typeof TORCHES)[number]) => interpolate(f, [t.at, t.at + 20, T.inkOut[0], T.inkOut[1]], [0, 1, 1, 0.6], clamp);
	const shadowGrow = interpolate(f, T.shadows, [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
	const shadowFade = interpolate(f, [T.run[0], T.run[2] + 80], [1, 0], clamp);

	const grassO = interpolate(f, [480, 620], [0, 1], clamp);
	const lugiaO = interpolate(f, [T.lugia[0], T.lugia[0] + 30, T.lugia[1] - 40, T.lugia[1]], [0, 0.55, 0.45, 0], clamp);
	const lugiaSink = interpolate(f, T.lugia, [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const luWorld: V3 = [LUGIA_SEA[0], LUGIA_SEA[1] - lugiaSink * 16, LUGIA_SEA[2]];
	const seaO = interpolate(f, [T.lugia[0] - 60, T.lugia[0] + 20], [0, 1], clamp);
	const sea = projectToScreen(pos, target, FOV, [LUGIA_SEA[0], -2, LUGIA_SEA[2]]);
	const lu = projectToScreen(pos, target, FOV, luWorld);

	const inkOut = interpolate(f, T.inkOut, [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});

	return (
		<AbsoluteFill style={{background: '#1a1410', overflow: 'hidden'}}>
			<InkMountains
				cam={inkCam}
				sun={{x: 1060, y: 250, radius: 105}}
				gold={0.9 - 0.6 * dim}
				mist={1}
				bright={1.0225 - 0.36 * dim}
				timeOffset={SEG_F}
			/>
			<AbsoluteFill style={{filter: `sepia(0.35) saturate(0.78) contrast(0.92) brightness(${1.02 - 0.14 * dim})`}}>
				<ThreeCanvas width={1920} height={1080} shadows gl={{alpha: true, antialias: true}}>
					<CameraRig pos={pos} target={target} fov={FOV} />
					<WeatherLights storm={0.25 * dim} day={1 - 0.4 * dim} />
					<pointLight position={[WEST[0], 3, 30]} intensity={2200 * interpolate(f, T.torches, [0, 1], clamp)} distance={60} decay={2} color="#ff8a3a" />
					<group position={EAST}>
						<Pagoda variant="tin" />
					</group>
					<group position={WEST}>
						<PagodaRuin frame={1800 + f} ground={false} />
					</group>
				</ThreeCanvas>
			</AbsoluteFill>
			<TowerMist pos={pos} target={target} fov={FOV} globalFrame={gF} storm={0} idPrefix="eMist" />

			{/* 远方海上：银色的那一只沉入深海（只有淡墨影） */}
			{lugiaO > 0 && !lu.behind ? (
				<PokemonArt3D
					dir="pokemon/lugia"
					x={lu.x}
					y={lu.y}
					size={26 * pxPerUnit(pos, luWorld, FOV)}
					yaw={2}
					pitch={-3}
					opacity={lugiaO * (1 - 0.85 * lugiaSink)}
					ink={{silhouette: 1, reveal: 0, halo: 0.6, time: gF / 30, center: [0.5, 0.45]}}
				/>
			) : null}

			{/* 远方的海：一条淡墨的水带，洛奇亚沉进去 */}
			{seaO > 0 ? (
				<AbsoluteFill
					style={{
						opacity: seaO,
						background: `linear-gradient(to bottom, transparent ${sea.y - 70}px, rgba(96,108,112,0.55) ${sea.y - 20}px, rgba(84,96,102,0.85) ${sea.y + 30}px, rgba(120,126,124,0.6) ${sea.y + 120}px, transparent ${sea.y + 220}px)`,
						mixBlendMode: 'multiply',
					}}
				/>
			) : null}
			{seaO > 0 ? (
				<svg width={1920} height={1080} style={{position: 'absolute', opacity: seaO * 0.5}}>
					{[0, 1, 2, 3, 4, 5].map((k) => {
						const y = sea.y + k * 16;
						const x = ((k * 317 + f * (0.6 + k * 0.15)) % 1400) + 100;
						return <line key={k} x1={x} y1={y} x2={x + 160 + k * 30} y2={y} stroke="rgba(230,226,214,0.6)" strokeWidth={1.5} strokeLinecap="round" />;
					})}
				</svg>
			) : null}

			{/* 凤王身后的金光与虹晕（接第 4 段） */}
			{hoGlow > 0.005 ? (
				<>
					<AbsoluteFill
						style={{
							opacity: hoGlow,
							mixBlendMode: 'screen',
							background: `radial-gradient(circle at ${ho.x}px ${ho.y}px, rgba(255,236,190,0.85) 0px, rgba(255,214,140,0.35) ${hoSize * 0.38}px, transparent ${hoSize * 0.85}px)`,
						}}
					/>
					<AbsoluteFill
						style={{
							opacity: hoGlow * 0.6,
							background: `radial-gradient(circle at ${ho.x}px ${ho.y}px, transparent ${hoSize * 0.5}px, rgba(255,110,90,0.22) ${hoSize * 0.53}px, rgba(255,200,90,0.22) ${hoSize * 0.56}px, rgba(140,210,120,0.18) ${hoSize * 0.59}px, rgba(110,170,240,0.16) ${hoSize * 0.62}px, rgba(170,120,230,0.13) ${hoSize * 0.65}px, transparent ${hoSize * 0.69}px)`,
						}}
					/>
				</>
			) : null}

			{/* 雷 / 火 / 雨的晕染（第 4 段留下的余韵） */}
			{washLeft > 0
				? beastState.map(({b, world}) => {
						const p = projectToScreen(pos, target, FOV, [world[0], BEAST_Y + 0.6, BEAST_Z - 0.5]);
						const r = BEAST_SIZE * pxPerUnit(pos, world, FOV) * (0.35 + 0.25 * washLeft);
						return (
							<AbsoluteFill
								key={b.dir}
								style={{
									mixBlendMode: 'multiply',
									opacity: washLeft * 0.95,
									background: `radial-gradient(ellipse ${r * 1.15}px ${r}px at ${p.x}px ${p.y}px, rgba(${b.wash},0.75) 0%, rgba(${b.wash},0.4) 55%, rgba(${b.wash},0) 100%)`,
								}}
							/>
						);
					})
				: null}

			{/* 人影：从火把下伸向三只的长影 */}
			{shadowGrow > 0 && shadowFade > 0 ? (
				<svg width={1920} height={1080} style={{position: 'absolute', opacity: 0.38 * shadowFade, mixBlendMode: 'multiply'}}>
					<defs>
						<filter id="shadowInk" x="-20%" y="-20%" width="140%" height="140%">
							<feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves={3} seed={7} result="n" />
							<feDisplacementMap in="SourceGraphic" in2="n" scale={14} />
							<feGaussianBlur stdDeviation={7} />
						</filter>
					</defs>
					<g filter="url(#shadowInk)">
						{TORCHES.map((t, i) => {
							const tgt = beastState[i % 3].world;
							const a = projectToScreen(pos, target, FOV, [t.x, 0.2, t.z]);
							const reach = (0.6 + 0.3 * random(`sr${i}`)) * shadowGrow;
							const endW: V3 = [t.x + (tgt[0] - t.x) * reach, 0.2, t.z + (tgt[2] - t.z) * reach];
							const b = projectToScreen(pos, target, FOV, endW);
							const dx = b.x - a.x;
							const dy = b.y - a.y;
							const len = Math.hypot(dx, dy) || 1;
							const nx = -dy / len;
							const ny = dx / len;
							const w0 = 11;
							const w1 = 2;
							return (
								<polygon
									key={i}
									points={`${a.x + nx * w0},${a.y + ny * w0} ${b.x + nx * w1},${b.y + ny * w1} ${b.x - nx * w1},${b.y - ny * w1} ${a.x - nx * w0},${a.y - ny * w0}`}
									fill="rgb(28,20,14)"
								/>
							);
						})}
					</g>
				</svg>
			) : null}

			{/* 徒劳的攻击：墨痕掷出，飞到七成便散成墨雾 */}
			<svg width={1920} height={1080} style={{position: 'absolute', mixBlendMode: 'multiply'}}>
				{ATTACKS.map((atk, i) => {
					const t = f - atk.at;
					if (t < 0 || t > 50) return null;
					const fly = interpolate(t, [0, 16], [0, 0.72], {...clamp, easing: Easing.out(Easing.quad)});
					const tgt = beastState[atk.beast].world;
					const from: V3 = [atk.from.x, atk.from.y + 1, atk.from.z];
					const at = (k: number): V3 => [
						from[0] + (tgt[0] - from[0]) * k,
						from[1] + (tgt[1] + 2 - from[1]) * k + Math.sin(k * Math.PI) * 4,
						from[2] + (tgt[2] - from[2]) * k,
					];
					const head = projectToScreen(pos, target, FOV, at(fly));
					const tail = projectToScreen(pos, target, FOV, at(Math.max(0, fly - 0.18)));
					const fade = interpolate(t, [14, 34], [1, 0], clamp);
					const burst = interpolate(t, [14, 40], [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
					return (
						<g key={i}>
							<line x1={tail.x} y1={tail.y} x2={head.x} y2={head.y} stroke="rgba(24,17,12,0.92)" strokeWidth={13 * fade + 2} strokeLinecap="round" opacity={fade} />
							{burst > 0 ? (
								<circle cx={head.x} cy={head.y} r={14 + burst * 80} fill="rgba(40,30,22,0.42)" opacity={1 - burst} />
							) : null}
						</g>
					);
				})}
			</svg>

			{/* 三只：接第 4 段，依次向西奔走；身后拖着墨色的风痕 */}
			{beastState.map(({b, i, run, world, p, size}) => {
				const trail = interpolate(run, [0.05, 0.3, 1], [0, 1, 0.6], clamp);
				return (
					<div key={b.dir}>
						{trail > 0 ? (
							<svg width={1920} height={1080} style={{position: 'absolute', opacity: 0.5 * trail, mixBlendMode: 'multiply'}}>
								{[0, 1, 2, 3, 4].map((k) => {
									const y = p.y - size * 0.3 + k * size * 0.13;
									const x0 = p.x + size * 0.15;
									const len = size * (0.6 + 0.5 * random(`tr${i}${k}`)) * (0.4 + run);
									return <line key={k} x1={x0} y1={y} x2={x0 + len} y2={y + 4} stroke="rgba(30,22,16,0.55)" strokeWidth={2 + (k % 2) * 2} strokeLinecap="round" />;
								})}
							</svg>
						) : null}
						<PokemonArt3D
							dir={`pokemon/${b.dir}`}
							x={p.x}
							y={p.y}
							size={size}
							yaw={(i - 1) * 2 + Math.sin(fp / 60 + i) * 1.2}
							pitch={2}
							opacity={interpolate(run, [0.75, 1], [1, 0], clamp)}
							resolution={1.3}
							ink={{silhouette: 1, reveal: 1, paint: 1, color: 0.3, line: 0.85, halo: 0.7, wash: 0.7, time: fp / 30 + i * 3, center: [0.5, 0.5]}}
						/>
					</div>
				);
			})}

			{/* 凤王（接第 4 段的悬停，再升入云中） */}
			{hoO > 0 ? (
				<PokemonArt3D
					dir="pokemon/ho-oh"
					x={ho.x}
					y={ho.y}
					size={hoSize}
					yaw={-2 + Math.sin(fp / 70) * 1.5}
					pitch={-4}
					opacity={hoO}
					resolution={1.4}
					ink={{silhouette: 1, reveal: 1, paint: 1, color: 0.38, line: 0.85, halo: 0.7, wash: 0.7, time: fp / 30, center: [0.5, 0.42]}}
				/>
			) : null}

			{/* 火把：晃动的火光 */}
			{TORCHES.map((t, i) => {
				const o = torchO(t);
				if (o <= 0) return null;
				const p = projectToScreen(pos, target, FOV, [t.x, t.y + Math.sin(f / 23 + t.ph) * 0.08, t.z]);
				const k = pxPerUnit(pos, [t.x, t.y, t.z], FOV);
				const fl = 0.75 + 0.25 * Math.sin(f * 0.9 + t.ph) * Math.sin(f * 0.37 + t.ph * 2);
				return (
					<AbsoluteFill
						key={i}
						style={{
							mixBlendMode: 'screen',
							opacity: o,
							background: `radial-gradient(circle at ${p.x}px ${p.y}px, rgba(255,236,190,${fl}) 0px, rgba(255,150,60,${0.8 * fl}) ${k * 0.18}px, rgba(255,110,40,${0.25 * fl}) ${k * 0.7}px, transparent ${k * 1.6}px)`,
						}}
					/>
				);
			})}

			{/* 西边草原的墨草 */}
			{grassO > 0 ? (
				<svg width={1920} height={1080} style={{position: 'absolute', opacity: grassO * 0.85, mixBlendMode: 'multiply'}}>
					{GRASS.map((g, i) => {
						const shift = (target[0] - END4.target[0]) * 22 * g.k;
						const x = ((((g.x - shift) % 2600) + 2600) % 2600) - 340;
						const sway = Math.sin(f / 18 + g.ph) * 0.12 + g.lean - 0.25;
						const top = 1080 - g.h * g.k;
						return (
							<path
								key={i}
								d={`M${x},1085 Q${x + sway * g.h * 0.5},${(top + 1085) / 2} ${x + sway * g.h},${top}`}
								stroke={`rgba(${34 + (i % 3) * 10},${28 + (i % 3) * 8},20,0.8)`}
								strokeWidth={g.w * g.k}
								fill="none"
								strokeLinecap="round"
							/>
						);
					})}
				</svg>
			) : null}

			<PaperVignette strength={0.85 + 0.1 * dim} />
			{/* 墨潮漫过画面，接第 6 段的月夜 */}
			{inkOut > 0 ? (
				<svg width={1920} height={1080} style={{position: 'absolute'}}>
					<defs>
						<filter id="inkOutEdge" x="-10%" y="-10%" width="120%" height="120%">
							<feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves={4} seed={21} result="n" />
							<feDisplacementMap in="SourceGraphic" in2="n" scale={180} />
						</filter>
						<radialGradient id="inkOutG">
							<stop offset="0.7" stopColor="#0d0b09" stopOpacity={1} />
							<stop offset="1" stopColor="#0d0b09" stopOpacity={0} />
						</radialGradient>
					</defs>
					<circle cx={960} cy={560} r={inkOut * 1500} fill="url(#inkOutG)" filter="url(#inkOutEdge)" />
					<rect width={1920} height={1080} fill="#0d0b09" opacity={interpolate(inkOut, [0.75, 1], [0, 1], clamp)} />
				</svg>
			) : null}

			{/* 旁白（制作者撰写）：依据水晶·米那季 "They struck terror in those who saw their rise." */}
			<BiSubtitle tone="ink" backdrop from={T.sub1[0]} to={T.sub1[1]} zh="可目睹它们降生的人，心中只有恐惧。" en="But they struck terror in those who saw their rise." source={{zh: '旁白（依据水晶·米那季）', en: 'NARRATION (after CRYSTAL · Eusine)'}} />
			{/* 旁白（制作者撰写）：依据心金魂银·缘朱市老人 "The people were afraid of power such as the rainbow-hued Pokémon had shown. They tried to control it by force." */}
			<BiSubtitle tone="ink" backdrop from={T.sub2[0]} to={T.sub2[1]} zh="人们害怕这样的力量，想用武力将它压制。" en="Afraid of such power, the people tried to control it by force." source={{zh: '旁白（依据心金魂银·缘朱市老人）', en: 'NARRATION (after HGSS · Ecruteak elder)'}} />
			{/* 旁白（制作者撰写）：依据水晶·米那季 "Some even took to futile attacks." */}
			<BiSubtitle tone="ink" backdrop from={T.sub3[0]} to={T.sub3[1]} zh="甚至有人，向它们发起了徒劳的攻击。" en="Some even took to futile attacks." source={{zh: '旁白（依据水晶·米那季）', en: 'NARRATION (after CRYSTAL · Eusine)'}} />
			{/* 旁白（制作者撰写）：依据心金魂银 "The nameless Pokémon made no attempt to fight back." */}
			<BiSubtitle tone="ink" backdrop from={T.sub4[0]} to={T.sub4[1]} zh="它们没有反击。" en="They made no attempt to fight back." source={{zh: '旁白（依据心金魂银·缘朱市老人）', en: 'NARRATION (after HGSS · Ecruteak elder)'}} />
			{/* 旁白（制作者撰写）：依据心金魂银 "their great sorrow compelled them to leave" 与《缘朱历史》"ran like the wind off into the grassland" */}
			<BiSubtitle tone="ink" backdrop from={T.sub5[0]} to={T.sub5[1]} zh="只是带着深深的悲伤，像风一样奔向了草原。" en="Filled with great sorrow, they ran like the wind off into the grassland." source={{zh: '旁白（依据心金魂银、《缘朱历史》）', en: 'NARRATION (after HGSS)'}} />
			{/* 官方图鉴原文（取后半句） */}
			<BiSubtitle tone="ink" backdrop from={T.sub6[0]} to={T.sub6[1]} zh="会随北风奔跑着离去。" en="It dashes away with the north wind." source={{zh: '水君图鉴《晶灿钻石·明亮珍珠》', en: 'POKÉDEX · BRILLIANT DIAMOND / SHINING PEARL'}} />
			{/* 旁白（制作者撰写）：依据《缘朱历史》"The two Pokémon haven't been seen since…" */}
			<BiSubtitle tone="ink" backdrop from={T.sub7[0]} to={T.sub7[1]} zh="从此，两座塔顶的宝可梦，再也没有出现过。" en="The Pokémon of the two towers have not been seen since." source={{zh: '旁白（依据《缘朱历史》）', en: 'NARRATION (after "History of Ecruteak")'}} />
			{/* 旁白（制作者撰写）：依据金 / 心金图鉴 "quietly spends its time deep at the bottom of the sea" */}
			<BiSubtitle tone="ink" backdrop from={T.sub8[0]} to={T.sub8[1]} zh="那只银色的宝可梦，据说从此隐居在了深海之中。" en="The silver one, it is said, has dwelt deep beneath the sea ever since." source={{zh: '旁白（依据金 / 心金图鉴）', en: 'NARRATION (after POKÉDEX · GOLD / HEARTGOLD)'}} />
			<Grain opacity={0.05} />
		</AbsoluteFill>
	);
};
