import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {V3} from '../../three/stage';
import {useFrame} from '../../time';
import {TrainerSil} from './people';
import {aimCamera, Cam, camAt, project, pxOf} from './cam';
import {DIALGA_AT, PALKIA_AT, PlateRing, TimeSpaceSides} from './plates';
import {Blackout, CYRUS2, finaleOn, ORIGIN_AT, OriginGiratina, OriginTag, STRIKE_AT, StrikeBurst, TwoSidedSheet} from './finale';
import {MirrorGiratina, MirrorLine} from './mirror';
import {DistortionWorld, DwSky} from './distortion';
import {flipFlash, PaperInk, PaperSheet} from './paper';
import {bf, easeInQuad, easeOutCubic, env, lerp, prog, rnd, smooth, SUB, SUBS, TOTAL_FRAMES} from './common';
import {
	chainCurve,
	chainGlow,
	Chains,
	CYRUS_FOOT,
	Floor,
	LUNGE_AT,
	Mountains,
	OPEN_AT,
	PORTAL_C,
	portalR,
	RIFT_RGB,
	riftA,
	riftPos,
	Rifts,
	RISE_AT,
	shadowPos,
	Snow,
	SpearPillar,
	UnderWorld,
	useArtTexture,
	worldDim,
} from './pillar';

/**
 * 《世界的背面》整期总时间轴。整期是一台连续的 3D 镜头（cam.ts）；各段（Segments.tsx）只是窗口。
 * 第 1–3 段（枪之柱、影子、骑拉帝纳显色）的 3D 物体在 pillar.tsx，人物剪影在 people.tsx，其余 2D 叠层在本文件。
 */

const GOLD = '255,196,110';
const PEARL = '244,236,255';

// ════════ 2D 叠层 ════════

/** 天上两道口子的光晕 */
const RiftGlow: React.FC<{f: number; c: Cam}> = ({f, c}) => (
	<>
		{([-1, 1] as const).map((side) => {
			const p = project(c, riftPos(f, side));
			if (p.depth <= 0) return null;
			const r = pxOf(c, p.depth, 26);
			const rgb = RIFT_RGB[side].map((v) => Math.round(v * 255)).join(',');
			const a = 0.42 * riftA(f) * (0.85 + 0.15 * Math.sin(f * 0.07 + side));
			return (
				<div
					key={side}
					style={{
						position: 'absolute',
						left: p.x - r,
						top: p.y - r,
						width: r * 2,
						height: r * 2,
						mixBlendMode: 'screen',
						background: `radial-gradient(circle, rgba(${rgb},${a}) 0%, rgba(${rgb},${a * 0.35}) 30%, rgba(0,0,0,0) 70%)`,
					}}
				/>
			);
		})}
	</>
);

/** 锁链的 2D 辉光 */
const ChainBloom: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const g = chainGlow(f);
	if (g <= 0.01) return null;
	const paths = ([-1, 1] as const).map((side) => {
		const curve = chainCurve(f, side);
		const pts: string[] = [];
		for (let i = 0; i <= 48; i++) {
			const p = project(c, curve(i / 48));
			if (p.depth > 0.5) pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
		}
		return pts.join(' ');
	});
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
			<defs>
				<filter id="rv-chain-w" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="16" />
				</filter>
			</defs>
			{paths.map((d, i) => (
				<polyline key={i} points={d} fill="none" stroke={`rgba(255,40,30,${0.32 * g})`} strokeWidth={26} filter="url(#rv-chain-w)" />
			))}
		</svg>
	);
};

/** 一点光（光晕 + 十字星芒） */
const Glint: React.FC<{x: number; y: number; r: number; a: number; rgb: string}> = ({x, y, r, a, rgb}) => {
	if (a <= 0.01) return null;
	const L = r * 5;
	return (
		<>
			<div
				style={{
					position: 'absolute',
					left: x - r * 3,
					top: y - r * 3,
					width: r * 6,
					height: r * 6,
					mixBlendMode: 'screen',
					background: `radial-gradient(circle, rgba(255,255,255,${a}) 0%, rgba(${rgb},${0.6 * a}) 16%, rgba(${rgb},${0.16 * a}) 40%, rgba(0,0,0,0) 70%)`,
				}}
			/>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
				<line x1={x - L} y1={y} x2={x + L} y2={y} stroke={`rgba(${rgb},${0.6 * a})`} strokeWidth={1.4} />
				<line x1={x} y1={y - L * 0.6} x2={x} y2={y + L * 0.6} stroke={`rgba(${rgb},${0.45 * a})`} strokeWidth={1.1} />
			</svg>
		</>
	);
};

/** 湖之三神：三点小光赶来，挡在锁链之间，又被推开（第 6–8 小节，只是光，不显形） */
const LAKE = [
	{rgb: '255,226,120', from: [-14, 2, 14] as V3, to: [-2.4, 4.6, 1.5] as V3},
	{rgb: '255,150,205', from: [0, -1, 18] as V3, to: [0.2, 6.4, 0.8] as V3},
	{rgb: '120,175,255', from: [14, 2, 14] as V3, to: [2.8, 4.6, 1.5] as V3},
];
const LakeLights: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const inK = easeOutCubic(prog(f, bf(6), bf(6, 3)));
	const push = easeOutCubic(prog(f, bf(7, 2), bf(8)));
	const a = smooth(prog(f, bf(6), bf(6) + 10)) * (1 - smooth(prog(f, bf(7, 3), bf(8, 1))));
	if (a <= 0) return null;
	return (
		<>
			{LAKE.map((l, i) => {
				const p: V3 = [lerp(l.from[0], l.to[0], inK), lerp(l.from[1], l.to[1], inK) + Math.sin(f * 0.15 + i * 2) * 0.15, lerp(l.from[2], l.to[2], inK)];
				const out: V3 = [p[0] * (1 + 2.5 * push), p[1] + 3 * push, p[2] + 6 * push];
				const pr = project(c, out);
				if (pr.depth <= 0) return null;
				return <Glint key={i} x={pr.x} y={pr.y} r={9} a={a * (0.85 + 0.15 * Math.sin(f * 0.3 + i))} rgb={l.rgb} />;
			})}
		</>
	);
};

/** 地上口子张开的金光，第 14–16 小节从口子里往上翻涌的金线 */
const PortalLight: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const R = portalR(f);
	if (R <= 0.01) return null;
	const p = project(c, PORTAL_C);
	if (p.depth <= 0) return null;
	const t = f - OPEN_AT;
	const flash = t >= -1 ? Math.exp(-Math.max(0, t) / 7) : 0;
	const surge = smooth(prog(f, bf(14), bf(16))) * (1 - smooth(prog(f, bf(16, 2), bf(18))));
	const big = f >= bf(16) - 1 ? Math.exp(-(f - bf(16)) / 9) : 0;
	const r = pxOf(c, p.depth, R * 5);
	const glow = (0.28 + 0.4 * surge + 0.9 * flash + 0.8 * big) * (1 - worldDim(f));
	const streaks = Array.from({length: 34}, (_, i) => {
		const ang = rnd(i * 3.3) * Math.PI * 2;
		const rr = Math.sqrt(rnd(i * 5.1)) * R * 0.9;
		const base = project(c, [PORTAL_C[0] + Math.cos(ang) * rr, 0, PORTAL_C[2] + Math.sin(ang) * rr]);
		const speed = 0.06 + 0.1 * rnd(i * 7.7);
		const ph = (f * speed + rnd(i * 9.1)) % 1;
		const top = project(c, [PORTAL_C[0] + Math.cos(ang) * rr, ph * 14, PORTAL_C[2] + Math.sin(ang) * rr]);
		const len = 0.5 + 1.8 * rnd(i * 2.9);
		const tail = project(c, [PORTAL_C[0] + Math.cos(ang) * rr, Math.max(0, ph * 14 - len), PORTAL_C[2] + Math.sin(ang) * rr]);
		return {x1: tail.x, y1: tail.y, x2: top.x, y2: top.y, a: Math.sin(ph * Math.PI) * surge, ok: base.depth > 0};
	});
	return (
		<>
			<div
				style={{
					position: 'absolute',
					left: p.x - r,
					top: p.y - r * 0.6,
					width: r * 2,
					height: r * 1.2,
					mixBlendMode: 'screen',
					background: `radial-gradient(ellipse 50% 50% at 50% 50%, rgba(${GOLD},${Math.min(1, glow)}) 0%, rgba(${GOLD},${0.3 * Math.min(1, glow)}) 30%, rgba(0,0,0,0) 72%)`,
				}}
			/>
			{flash + big > 0.02 ? (
				<AbsoluteFill style={{mixBlendMode: 'screen', background: `radial-gradient(circle at ${p.x}px ${p.y}px, rgba(255,240,210,${0.5 * flash + 0.6 * big}) 0%, rgba(${GOLD},${0.25 * (flash + big)}) 25%, rgba(0,0,0,0) 65%)`}} />
			) : null}
			{surge > 0.01 ? (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
					{streaks.map((s, i) =>
						s.ok && s.a > 0.01 ? <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={`rgba(${GOLD},${0.75 * s.a})`} strokeWidth={1.6} strokeLinecap="round" /> : null,
					)}
				</svg>
			) : null}
		</>
	);
};

/** 画面里一条横线以下裁掉（东西沉进地面时用） */
const clipBelow = (y: number) => `polygon(0px 0px, 1920px 0px, 1920px ${y}px, 0px ${y}px)`;

// ── 骑拉帝纳 ──

const GIRA_FOOT_V = 0.955;
/** 立绘画布里脚底所在的高度（相对画布上沿，供 transform-origin 用） */
const FOOT_ORIGIN = `50% ${(((GIRA_FOOT_V - 0.5) + 0.56) / 1.12) * 100}%`;

/** 第 8 小节：地上的影子立起来（排线刻出的黑影）→ 扑上赤日 → 一起沉进地里 */
const ShadowFigure: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	if (f < RISE_AT - 2 || f > LUNGE_AT + 20) return null;
	const lunge = easeInQuad(prog(f, LUNGE_AT, LUNGE_AT + 8));
	const sink = easeInQuad(prog(f, LUNGE_AT + 7, LUNGE_AT + 18));
	const s0 = shadowPos(Math.min(f, LUNGE_AT));
	const foot: V3 = [lerp(s0[0], CYRUS_FOOT[0], lunge), -7 * sink, lerp(s0[2], CYRUS_FOOT[2] + 0.4, lunge)];
	const pr = project(c, foot);
	if (pr.depth <= 0) return null;
	const S = 10.5 * (1 + 0.12 * lunge);
	const size = pxOf(c, pr.depth, S);
	const rise = easeOutCubic(prog(f, RISE_AT, RISE_AT + 14));
	const sy = lerp(-0.35, 1, rise);
	const ground = project(c, [foot[0], 0, foot[2]]);
	const lean = (1 - rise) * 10 - 8 * lunge * (1 - sink);
	return (
		<AbsoluteFill style={{clipPath: sink > 0 ? clipBelow(ground.y + 6) : undefined}}>
			<PokemonArt3D
				dir="pokemon/giratina"
				x={pr.x}
				y={pr.y - size * (GIRA_FOOT_V - 0.5)}
				size={size}
				depthScale={0.5}
				ambient={[0.3, 0.29, 0.33]}
				hatch={{amount: 0.3 + 0.08 * Math.sin(f * 0.21), body: 1, color: [0.66, 0.52, 0.34], freq: 84, time: f / 30}}
				opacity={smooth(prog(f, RISE_AT - 2, RISE_AT + 4))}
				resolution={Math.min(1.4, 2400 / Math.max(1, size * 1.12))}
				style={{transform: `scaleY(${sy}) skewX(${lean}deg)`, transformOrigin: FOOT_ORIGIN}}
			/>
		</AbsoluteFill>
	);
};

const REVEAL = bf(16);
const GIRA_FROM = bf(15);
const GIRA_BACK = bf(20, 2);

/** 第 15–16 小节：骑拉帝纳从口子里升起，排线刻出的身形 → 16.0 原色从头部渗开；第 20.2 小节起往下沉一点、淡出 */
const Giratina: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	if (f < GIRA_FROM || f > bf(21, 3)) return null;
	const up = easeOutCubic(prog(f, GIRA_FROM, REVEAL + 4));
	const down = easeInQuad(prog(f, GIRA_BACK, bf(21, 3)));
	const foot: V3 = [PORTAL_C[0], -13.8 + 12 * up - 2.5 * down, PORTAL_C[2]];
	const pr = project(c, foot);
	if (pr.depth <= 0) return null;
	const size = pxOf(c, pr.depth, 12.5);
	const rv = easeOutCubic(prog(f, REVEAL - 2, REVEAL + 16));
	const flash = f >= REVEAL - 1 ? Math.exp(-(f - REVEAL) / 8) : 0;
	const lit = smooth(prog(f, REVEAL - 4, REVEAL + 20));
	const R = portalR(f);
	// 口子靠镜头一侧的边缘以下裁掉（从口子里钻出来）
	const toCam = [c.pos[0] - PORTAL_C[0], c.pos[2] - PORTAL_C[2]];
	const tl = Math.hypot(toCam[0], toCam[1]) || 1;
	const lip = project(c, [PORTAL_C[0] + (toCam[0] / tl) * R * 0.7, 0, PORTAL_C[2] + (toCam[1] / tl) * R * 0.7]);
	return (
		<AbsoluteFill style={{clipPath: clipBelow(lip.y)}}>
			<PokemonArt3D
				dir="pokemon/giratina"
				x={pr.x}
				y={pr.y - size * (GIRA_FOOT_V - 0.5)}
				size={size}
				yaw={Math.sin((f - REVEAL) * 0.025) * 2.2 * lit}
				pitch={-1.5}
				depthScale={0.5}
				ambient={[lerp(0.34, 0.46, lit), lerp(0.33, 0.44, lit), lerp(0.38, 0.5, lit)]}
				dirLights={[
					// 口子里的金光从下方照上来
					{dir: [0.1, 0.85, 0.5], color: [0.95 * lit, 0.66 * lit, 0.32 * lit], wrap: 0.5},
					// 天上口子的冷光从左后上方
					{dir: [-0.5, -0.7, 0.3], color: [0.22 * lit, 0.26 * lit, 0.4 * lit], wrap: 0.3},
				]}
				rim={{dir: [1, -0.2], color: [0.8 * lit, 0.16 * lit, 0.1 * lit], power: 2.4}}
				hatch={{amount: 0.9, body: 1, reveal: rv, color: [1.0, 0.76, 0.4], freq: 88, time: f / 30, center: [0.47, 0.3]}}
				brightness={1 + 0.9 * flash}
				opacity={smooth(prog(f, GIRA_FROM, GIRA_FROM + 10)) * (1 - smooth(prog(f, GIRA_BACK, bf(21, 3))))}
				resolution={Math.min(1.4, 2600 / Math.max(1, size * 1.12))}
			/>
		</AbsoluteFill>
	);
};

/** 翻面时纸侧对镜头的那一下：一道金光 */
const FlipFlash: React.FC<{f: number}> = ({f}) => {
	const a = flipFlash(f);
	if (a <= 0.01) return null;
	return <AbsoluteFill style={{mixBlendMode: 'screen', background: `radial-gradient(ellipse 70% 22% at 50% 50%, rgba(255,236,200,${0.85 * a}) 0%, rgba(${GOLD},${0.35 * a}) 40%, rgba(0,0,0,0) 80%)`}} />;
};

/** 第 41–44 小节：浮岛之间，远远一个骑拉帝纳的影子，独自待着 */
const LONE: V3 = [-4, -47, -64];
const LoneGiratina: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const o = smooth(prog(f, bf(40, 3), bf(41, 3))) * (1 - smooth(prog(f, bf(44), bf(45))));
	if (o <= 0) return null;
	const pr = project(c, [LONE[0], LONE[1] + Math.sin(f * 0.02) * 0.4, LONE[2]]);
	if (pr.depth <= 0) return null;
	const size = pxOf(c, pr.depth, 13);
	return (
		<PokemonArt3D
			dir="pokemon/giratina"
			x={pr.x}
			y={pr.y}
			size={size}
			depthScale={0.5}
			ambient={[0.5, 0.48, 0.52]}
			hatch={{amount: 0.6, body: 1, color: [1.0, 0.74, 0.4], freq: 70, time: f / 30}}
			opacity={o}
			resolution={1.5}
		/>
	);
};

const nameOpacity = (f: number) => 1 - smooth(prog(f, bf(19, 2), bf(20)));

// ── 片名 ──

const TITLE_AT = bf(4);
/** 第 4 小节：片名以镜像的金色线字出现（像从纸背面看），翻过来变成珍珠白；第 5 小节第 2 拍起落回地面 */
const Title: React.FC<{f: number}> = ({f}) => {
	const a = env(f, TITLE_AT - 4, bf(6), 8, 14);
	if (a <= 0) return null;
	const flip = easeOutCubic(prog(f, TITLE_AT + 4, TITLE_AT + 30));
	const rot = 180 * (1 - flip);
	const k = smooth(prog(rot, 70, 110));
	const rgb = k > 0.5 ? GOLD : PEARL;
	const fall = easeInQuad(prog(f, bf(5, 2), bf(6)));
	const en = env(f, bf(4, 2), bf(6), 16, 14);
	const spacing = 22 - 6 * smooth(prog(f, bf(4, 2), bf(5, 2)));
	return (
		<AbsoluteFill style={{perspective: 1400, opacity: a}}>
			<AbsoluteFill style={{background: `radial-gradient(ellipse 48% 30% at 50% 44%, rgba(4,3,8,${0.55 * a}) 0%, rgba(4,3,8,0) 100%)`}} />
			<div
				style={{
					position: 'absolute',
					left: 0,
					width: 1920,
					top: 400,
					textAlign: 'center',
					transform: `translateY(${fall * 160}px) rotateX(${fall * 70}deg) rotateY(${rot}deg)`,
					fontFamily: SERIF,
					fontWeight: 600,
					fontSize: 132,
					letterSpacing: 26,
					paddingLeft: 26,
					color: 'transparent',
					WebkitTextStroke: `2px rgba(${rgb},0.95)`,
					textShadow: `0 0 26px rgba(${rgb},0.45)`,
				}}
			>
				世界的背面
			</div>
			<div
				style={{
					position: 'absolute',
					left: 0,
					width: 1920,
					top: 580,
					textAlign: 'center',
					opacity: en * (1 - fall),
					fontFamily: CINZEL,
					fontWeight: 600,
					fontSize: 30,
					letterSpacing: spacing,
					paddingLeft: spacing,
					color: `rgba(${PEARL},0.92)`,
					textShadow: `0 0 16px rgba(${GOLD},0.55)`,
				}}
			>
				THE OTHER SIDE OF THE WORLD
			</div>
		</AbsoluteFill>
	);
};

/** 字幕的暗晕：整片一层连续的，不随每句闪 */
const SubScrim: React.FC<{f: number}> = ({f}) => {
	const a = 1 - smooth(prog(f, TOTAL_FRAMES - 30, TOTAL_FRAMES));
	return (
		<div
			style={{
				position: 'absolute',
				left: 960 - 1000,
				width: 2000,
				bottom: 84 - 70,
				height: 230,
				opacity: a,
				background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(10,8,12,0.55) 0%, rgba(10,8,12,0.42) 40%, rgba(10,8,12,0.14) 72%, rgba(10,8,12,0) 100%)',
				pointerEvents: 'none',
			}}
		/>
	);
};

// ════════ 3D 世界 ════════

/** 镜头（带横滚），与 cam.ts 的 project() 同一套算法 */
const RollRig: React.FC<{c: Cam}> = ({c}) => {
	const {camera} = useThree();
	const cam = camera as THREE.PerspectiveCamera;
	cam.fov = c.fov;
	cam.near = 0.3;
	cam.far = 3000;
	cam.updateProjectionMatrix();
	aimCamera(cam, c);
	return null;
};

const World: React.FC<{f: number; c: Cam; art: THREE.Texture}> = ({f, c, art}) => (
	<>
		<RollRig c={c} />
		<DwSky f={f} />
		<DistortionWorld f={f} />
		<TwoSidedSheet f={f} />
		<PaperSheet f={f} />
		<PlateRing f={f} />
		<FrontWorld f={f} c={c} art={art} />
	</>
);

/** 正面的世界（第 1–3 段的枪之柱）；第 22 小节起暗下去，地面的背面留作毁坏的世界的天花板 */
const FrontWorld: React.FC<{f: number; c: Cam; art: THREE.Texture}> = ({f, c, art}) => (
	<>
		<Mountains f={f} />
		<UnderWorld f={f} />
		<Floor f={f} art={art} />
		<SpearPillar f={f} />
		<Rifts f={f} c={c} />
		<Chains f={f} />
		<Snow f={f} />
	</>
);

export const ReverseMaster: React.FC = () => {
	const f = useFrame();
	const art = useArtTexture('pokemon/giratina/art.png');
	const c = camAt(f);
	const cyrusSink = easeInQuad(prog(f, LUNGE_AT + 7, LUNGE_AT + 18));
	const cyrusGround = project(c, CYRUS_FOOT);
	return (
		<AbsoluteFill style={{background: '#05040a'}}>
			{art ? (
				<ThreeCanvas width={1920} height={1080} gl={{antialias: true}}>
					<World f={f} c={c} art={art} />
				</ThreeCanvas>
			) : null}
			<RiftGlow f={f} c={c} />
			<ChainBloom f={f} c={c} />
			<LakeLights f={f} c={c} />
			<PortalLight f={f} c={c} />
			{/* 赤日：站在祭坛前；被影子拖走时一起沉进地里 */}
			<AbsoluteFill style={{clipPath: cyrusSink > 0 ? clipBelow(cyrusGround.y + 4) : undefined}}>
				<TrainerSil
					c={c}
					file="trainers/cyrus/dp.png"
					aspect={629 / 1600}
					foot={[CYRUS_FOOT[0], -2.6 * cyrusSink, CYRUS_FOOT[2]]}
					h={2.2}
					o={1 - smooth(prog(f, LUNGE_AT + 12, LUNGE_AT + 18))}
					from="right"
					rgb={PEARL}
				/>
			</AbsoluteFill>
			<ShadowFigure f={f} c={c} />
			{/* 竹兰：第 14 小节从左边走进来，停在口子边；口子的金光从右边照着她 */}
			<TrainerSil
				c={c}
				file="trainers/cynthia/dp.png"
				aspect={781 / 1600}
				foot={[lerp(-9.5, -4.4, easeOutCubic(prog(f, bf(14), bf(14) + 26))), 0, lerp(9.4, 7.4, easeOutCubic(prog(f, bf(14), bf(14) + 26)))]}
				h={2.15}
				o={smooth(prog(f, bf(14), bf(14) + 12)) * (1 - smooth(prog(f, bf(20), bf(20, 3))))}
				from="right"
				rgb={GOLD}
			/>
			<Giratina f={f} c={c} />
			<TimeSpaceSides f={f} />
			<PaperInk f={f} c={c} />
			<FlipFlash f={f} />
			<LoneGiratina f={f} c={c} />
			{finaleOn(f) ? (
				<>
					{/* 毁坏的世界最深处：赤日站在岛上；第 58 小节镜头离开时淡掉 */}
					<TrainerSil c={c} file="trainers/cyrus/dp.png" aspect={629 / 1600} foot={CYRUS2} h={2.2} o={smooth(prog(f, bf(44), bf(45))) * (1 - smooth(prog(f, bf(58), bf(58, 3))))} from="left" rgb={GOLD} />
					<OriginGiratina f={f} c={c} />
					<StrikeBurst f={f} c={c} />
					<Blackout f={f} />
					<OriginTag f={f} />
					<MirrorGiratina f={f} c={c} />
					<MirrorLine f={f} c={c} />
				</>
			) : null}
			<Title f={f} />
			<NameTag
				from={REVEAL + 4}
				x={110}
				y={96}
				align="left"
				no="No.0487"
				zh="骑拉帝纳"
				en="GIRATINA"
				category="反抗宝可梦"
				categoryEn="Renegade Pokémon"
				tone="gold"
				opacity={nameOpacity(f)}
			/>
			<Cry name="giratina" at={REVEAL} />
			{/* 第 22 小节纸两边：时间与空间两位本期第一次露面 */}
			<Cry name="dialga" at={DIALGA_AT} />
			<Cry name="palkia" at={PALKIA_AT} />
			<Cry name="giratina-origin" at={ORIGIN_AT} />
			{/* 全片最大爆发点：从暗处出手时第二次叫声 */}
			<Cry name="giratina-origin" at={STRIKE_AT} />
			<Vignette strength={0.5} />
			<SubScrim f={f} />
			{SUBS.map((s) => (
				<BiSubtitle key={s.from} from={s.from} to={s.to} zh={s.zh} en={s.en} wipe={s.wipe} {...SUB} />
			))}
			{/* 片尾：画面慢慢淡出（不回到第 0 帧） */}
			<AbsoluteFill style={{background: '#000', opacity: smooth(prog(f, bf(70, 2), TOTAL_FRAMES))}} />
			<Grain opacity={0.12} />
		</AbsoluteFill>
	);
};

