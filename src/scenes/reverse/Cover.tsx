import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {GRAIN_FRAG} from '../../gl/shaders';
import {bf} from './common';
import {DistortionWorld, DwSky} from './distortion';
import {MIRROR} from './mirror';
import {Floor, Mountains, SpearPillar, useArtTexture} from './pillar';

/**
 * 《世界的背面》封面（16:9 / 4:3 / 3:4）。
 * 一道金色的镜面线横过画面：上面站着别种形态（官方立绘，原色），水面一样的倒影里却是起源形态（官方立绘，倒过来）。
 * 背景是片里第 64 小节的枪之柱：线上珍珠白的断柱，线下倒挂的金色断柱。标题压在线上，倒影是金色的。
 */

/** 背景取片里镜面那一段（断柱已直回来、地面只剩线） */
const SCENE_F = bf(64);

type Layout = {
	w: number;
	h: number;
	/** 镜面线的高度、骑拉帝纳脚底的横坐标（px） */
	line: number;
	figX: number;
	/** 别种形态的立绘边长（px）；倒影按片里的比例放大一点 */
	size: number;
	/** 镜头离祭坛的距离、竖直视野（度，按画面高度） */
	dist: number;
	fov: number;
	title: {x: number; size: number; align: 'left' | 'center'; top?: number};
	hook: string;
	/** 竖版：钩子文案放在画面下方（倒影上）的高度 */
	hookY?: number;
};

const ALTERED_FOOT_V = 0.955;
const ORIGIN_LOW_V = 0.86;
const PEARL = '244,238,255';
const GOLD = '255,196,110';

/** 镜头：与地面同高、水平看向祭坛；用 setViewOffset 把祭坛和地平线挪到 (figX, line)，竖线不歪 */
const CoverRig: React.FC<{L: Layout}> = ({L}) => {
	const {camera} = useThree();
	const cam = camera as THREE.PerspectiveCamera;
	const ax = Math.abs(L.w / 2 - L.figX);
	const ay = Math.abs(L.h / 2 - L.line);
	const W = L.w + 2 * ax;
	const H = L.h + 2 * ay;
	cam.fov = (2 * Math.atan((Math.tan((L.fov * Math.PI) / 360) * H) / L.h) * 180) / Math.PI;
	cam.aspect = W / H;
	cam.near = 0.3;
	cam.far = 3000;
	cam.position.set(MIRROR[0], 0, MIRROR[2] + L.dist);
	cam.up.set(0, 1, 0);
	cam.lookAt(MIRROR[0], 0, MIRROR[2]);
	cam.setViewOffset(W, H, W / 2 - L.figX, H / 2 - L.line, L.w, L.h);
	cam.updateProjectionMatrix();
	cam.updateMatrixWorld();
	return null;
};

const Scene3D: React.FC<{L: Layout; art: THREE.Texture}> = ({L, art}) => (
	<ThreeCanvas width={L.w} height={L.h} gl={{antialias: true}}>
		<CoverRig L={L} />
		<DwSky f={SCENE_F} />
		<DistortionWorld f={SCENE_F} />
		<Mountains f={SCENE_F} />
		<Floor f={SCENE_F} art={art} />
		<SpearPillar f={SCENE_F} />
	</ThreeCanvas>
);

// ── 浮尘（固定种子）：线上珍珠白往下飘，线下金色往上升 ──
const rand = (seed: number) => {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 4294967296;
	};
};

const Motes: React.FC<{L: Layout}> = ({L}) => {
	const r = rand(487);
	const dots = Array.from({length: 70}, () => {
		const above = r() < 0.5;
		const y = above ? L.line - Math.pow(r(), 1.6) * L.line * 0.95 : L.line + Math.pow(r(), 1.6) * (L.h - L.line);
		return {x: r() * L.w, y, rr: 1 + r() * 2.6, a: 0.25 + r() * 0.6, above, blur: r() < 0.2 ? 2 + r() * 3 : 0};
	});
	return (
		<svg width={L.w} height={L.h} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
			{dots.map((d, i) => (
				<circle key={i} cx={d.x} cy={d.y} r={d.rr + d.blur} fill={`rgba(${d.above ? PEARL : GOLD},${d.a * (d.blur ? 0.5 : 1)})`} style={{filter: d.blur ? `blur(${d.blur}px)` : undefined}} />
			))}
		</svg>
	);
};

/** 镜面线：一道金白的细线 + 宽的辉光，脚底那里最亮 */
const MirrorLine: React.FC<{L: Layout}> = ({L}) => {
	const fx = (L.figX / L.w) * 100;
	return (
		<>
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: L.line - L.h * 0.14,
					width: L.w,
					height: L.h * 0.28,
					background: `radial-gradient(ellipse 46% 50% at ${fx}% 50%, rgba(255,214,150,0.32) 0%, rgba(255,170,90,0.12) 40%, transparent 72%)`,
					mixBlendMode: 'screen',
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: L.line - 1.5,
					width: L.w,
					height: 3,
					background: `linear-gradient(90deg, rgba(255,190,110,0) 0%, rgba(255,214,160,0.75) ${fx - 30}%, #fffaf0 ${fx}%, rgba(255,214,160,0.75) ${fx + 30}%, rgba(255,190,110,0) 100%)`,
					boxShadow: '0 0 10px 1px rgba(255,200,120,0.9), 0 0 36px 6px rgba(255,160,80,0.45)',
				}}
			/>
			{/* 脚底的星芒 */}
			<div
				style={{
					position: 'absolute',
					left: L.figX - L.w * 0.32,
					top: L.line - 1,
					width: L.w * 0.64,
					height: 2,
					background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95) 50%, transparent)',
					filter: 'blur(0.5px)',
				}}
			/>
			<div style={{position: 'absolute', left: L.figX - 70, top: L.line - 70, width: 140, height: 140, background: 'radial-gradient(circle, rgba(255,250,235,0.9) 0%, rgba(255,210,140,0.35) 18%, transparent 60%)', mixBlendMode: 'screen'}} />
		</>
	);
};

/** 倒影的水面：线下一道道细横纹，越往下越淡 */
const Ripples: React.FC<{L: Layout}> = ({L}) => {
	const r = rand(17);
	const rows = Array.from({length: 26}, (_, i) => {
		const u = (i + r() * 0.6) / 26;
		return {y: L.line + 6 + Math.pow(u, 1.5) * (L.h - L.line), x0: r() * 0.3, x1: 0.7 + r() * 0.3, a: (1 - u) * (0.08 + r() * 0.1)};
	});
	return (
		<svg width={L.w} height={L.h} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
			{rows.map((w, i) => (
				<line key={i} x1={w.x0 * L.w} x2={w.x1 * L.w} y1={w.y} y2={w.y} stroke={`rgba(${GOLD},${w.a})`} strokeWidth={1} />
			))}
		</svg>
	);
};

const Figures: React.FC<{L: Layout}> = ({L}) => {
	const sizeO = L.size * (13 / 12.5);
	return (
		<>
			{/* 倒影：起源形态，画成站在线上再沿线翻下去；越往下越淡 */}
			<AbsoluteFill
				style={{
					transform: 'scaleY(-1)',
					transformOrigin: `50% ${L.line}px`,
					opacity: 0.92,
					WebkitMaskImage: `linear-gradient(180deg, transparent ${L.line - sizeO * 0.92}px, rgba(0,0,0,0.3) ${L.line - sizeO * 0.6}px, rgba(0,0,0,0.85) ${L.line - sizeO * 0.2}px, #000 ${L.line}px)`,
					maskImage: `linear-gradient(180deg, transparent ${L.line - sizeO * 0.92}px, rgba(0,0,0,0.3) ${L.line - sizeO * 0.6}px, rgba(0,0,0,0.85) ${L.line - sizeO * 0.2}px, #000 ${L.line}px)`,
				}}
			>
				<AbsoluteFill style={{clipPath: `inset(0 0 ${L.h - L.line}px 0)`}}>
					<PokemonArt3D
						dir="pokemon/giratina"
						variant="-origin"
						x={L.figX}
						y={L.line - sizeO * (ORIGIN_LOW_V - 0.5)}
						size={sizeO}
						yaw={-3}
						pitch={-2}
						depthScale={0.5}
						ambient={[0.5, 0.42, 0.42]}
						dirLights={[
							// 镜面的金光从线那边打过来
							{dir: [0, 0.85, 0.5], color: [1.15, 0.78, 0.38], wrap: 0.5},
							{dir: [-0.5, -0.5, 0.5], color: [0.25, 0.18, 0.2], wrap: 0.3},
						]}
						rim={{dir: [0.8, -0.6], color: [1.3, 0.55, 0.25], power: 2.0}}
						emissive={0.3}
						emissiveTint={[1.0, 0.75, 0.4]}
						resolution={1.6}
					/>
				</AbsoluteFill>
			</AbsoluteFill>
			{/* 背后的冷光，把别种形态从背景里托出来 */}
			<div
				style={{
					position: 'absolute',
					left: L.figX - L.size * 0.7,
					top: L.line - L.size * 1.05,
					width: L.size * 1.4,
					height: L.size * 1.1,
					background: 'radial-gradient(ellipse 50% 50% at 50% 55%, rgba(190,200,255,0.20) 0%, rgba(150,150,230,0.08) 45%, transparent 72%)',
					mixBlendMode: 'screen',
				}}
			/>
			<AbsoluteFill style={{clipPath: `inset(0 0 ${L.h - L.line}px 0)`}}>
				<PokemonArt3D
					dir="pokemon/giratina"
					x={L.figX}
					y={L.line - L.size * (ALTERED_FOOT_V - 0.5)}
					size={L.size}
					yaw={3}
					pitch={1.5}
					depthScale={0.5}
					ambient={[0.66, 0.64, 0.74]}
					dirLights={[
						// 冷色主光从左上，脚下镜面的金光往上托
						{dir: [-0.5, -0.7, 0.5], color: [0.55, 0.6, 0.8], wrap: 0.4},
						{dir: [0.1, 0.9, 0.4], color: [0.7, 0.48, 0.22], wrap: 0.5},
					]}
					rim={{dir: [0.7, -0.7], color: [1.5, 1.45, 1.8], power: 1.8}}
					emissive={0.2}
					emissiveTint={[1.0, 0.8, 0.5]}
					resolution={1.6}
				/>
			</AbsoluteFill>
		</>
	);
};

/** 标题压在镜面线上，下面是金色的倒影 */
const Title: React.FC<{L: Layout}> = ({L}) => {
	const {size, align} = L.title;
	const text = '世界的背面';
	const tracking = 0.08;
	const blockW = size * text.length * (1 + tracking);
	const left = align === 'center' ? L.title.x - blockW / 2 : L.title.x;
	const lineH = size * 1.12;
	const onLine = L.title.top === undefined;
	const top = onLine ? L.line - lineH - size * 0.04 : (L.title.top as number);
	const base: React.CSSProperties = {fontFamily: SERIF, fontWeight: 900, fontSize: size, lineHeight: 1.12, letterSpacing: `${tracking}em`, whiteSpace: 'nowrap', position: 'absolute', left: 0, top: 0};
	const front: React.CSSProperties = {
		...base,
		backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #f6f1ff 45%, #dcd2f2 100%)',
		WebkitBackgroundClip: 'text',
		backgroundClip: 'text',
		color: 'transparent',
		filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8)) drop-shadow(0 0 22px rgba(190,180,255,0.45)) drop-shadow(0 6px 18px rgba(0,0,0,0.85))',
	};
	const back: React.CSSProperties = {
		...base,
		backgroundImage: 'linear-gradient(180deg, #fff1d0 0%, #ffc56e 40%, #d9792e 100%)',
		WebkitBackgroundClip: 'text',
		backgroundClip: 'text',
		color: 'transparent',
		filter: 'drop-shadow(0 0 16px rgba(255,150,60,0.55))',
	};
	const en = 'THE OTHER SIDE OF THE WORLD';
	const enStyle: React.CSSProperties = {
		position: 'absolute',
		left: 0,
		width: blockW,
		textAlign: align,
		fontFamily: CINZEL,
		fontWeight: 600,
		fontSize: size * 0.17,
		letterSpacing: '0.5em',
		paddingLeft: align === 'center' ? '0.5em' : 0,
		color: `rgba(${PEARL},0.9)`,
		textShadow: '0 0 12px rgba(200,190,255,0.6), 0 2px 6px rgba(0,0,0,0.9)',
		whiteSpace: 'nowrap',
	};
	const hookStyle: React.CSSProperties = {
		position: 'absolute',
		left: 0,
		width: blockW,
		textAlign: align,
		fontFamily: SERIF,
		fontWeight: 700,
		fontSize: size * 0.27,
		letterSpacing: '0.2em',
		color: `rgb(${GOLD})`,
		textShadow: '0 0 14px rgba(255,160,70,0.6), 0 2px 6px rgba(0,0,0,0.95)',
		whiteSpace: 'nowrap',
	};
	return (
		<div style={{position: 'absolute', left, top, width: blockW, height: lineH}}>
			{onLine ? (
				<>
					<div style={{...hookStyle, top: -size * 0.52}}>{L.hook}</div>
					{/* 倒影：沿镜面线翻下去，金色、越往下越淡 */}
					<div
						style={{
							position: 'absolute',
							left: 0,
							top: lineH + size * 0.08,
							width: blockW,
							height: lineH,
							transform: 'scaleY(-1)',
							opacity: 0.8,
							WebkitMaskImage: 'linear-gradient(0deg, #000 0%, rgba(0,0,0,0.5) 40%, transparent 85%)',
							maskImage: 'linear-gradient(0deg, #000 0%, rgba(0,0,0,0.5) 40%, transparent 85%)',
						}}
					>
						<div style={back}>{text}</div>
					</div>
					<div style={{...enStyle, top: lineH + size * 1.02}}>{en}</div>
				</>
			) : (
				<>
					<div style={{...enStyle, top: lineH + size * 0.12}}>{en}</div>
				</>
			)}
			<div style={front}>{text}</div>
		</div>
	);
};

/** 四角的细线与编号（同《空间的形状》封面） */
const Hud: React.FC<{w: number; h: number; m: number}> = ({w, h, m}) => {
	const arm = Math.min(w, h) * 0.05;
	const line = `rgba(${PEARL},0.5)`;
	const corner = (x: number, y: number, sx: number, sy: number, k: number) => (
		<div key={k} style={{position: 'absolute', left: x, top: y}}>
			<div style={{position: 'absolute', width: arm, height: 1.5, background: line, left: sx < 0 ? -arm : 0}} />
			<div style={{position: 'absolute', width: 1.5, height: arm, background: line, top: sy < 0 ? -arm : 0}} />
		</div>
	);
	const label: React.CSSProperties = {position: 'absolute', fontFamily: CINZEL, fontWeight: 600, fontSize: Math.min(w, h) * 0.017, letterSpacing: '0.34em', color: `rgba(${PEARL},0.7)`, whiteSpace: 'nowrap'};
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{corner(m, m, 1, 1, 0)}
			{corner(w - m, m, -1, 1, 1)}
			{corner(m, h - m, 1, -1, 2)}
			{corner(w - m, h - m, -1, -1, 3)}
			<div style={{...label, left: m + arm * 0.35, top: m + arm * 0.3}}>NO.0487 · GIRATINA</div>
			<div style={{...label, right: m + arm * 0.35, bottom: m + arm * 0.3, textAlign: 'right', color: `rgba(${GOLD},0.75)`}}>RENEGADE POKÉMON</div>
		</AbsoluteFill>
	);
};

const CoverBase: React.FC<{L: Layout}> = ({L}) => {
	const art = useArtTexture('pokemon/giratina/art.png');
	return (
		<AbsoluteFill style={{background: '#06050b', overflow: 'hidden'}}>
			{art ? <Scene3D L={L} art={art} /> : null}
			{/* 天色：线上冷、线下暖 */}
			<AbsoluteFill
				style={{
					background: `linear-gradient(180deg, rgba(40,38,70,0.35) 0%, rgba(20,18,36,0) ${(L.line / L.h) * 100 - 18}%, rgba(0,0,0,0) ${(L.line / L.h) * 100}%, rgba(90,50,20,0.18) ${(L.line / L.h) * 100 + 4}%, rgba(10,6,4,0.5) 100%)`,
				}}
			/>
			<Ripples L={L} />
			<Motes L={L} />
			<Figures L={L} />
			<MirrorLine L={L} />
			{/* 标题区压暗 */}
			<AbsoluteFill
				style={{
					background:
						L.title.align === 'left'
							? 'linear-gradient(90deg, rgba(6,5,11,0.7) 0%, rgba(6,5,11,0.4) 32%, transparent 55%)'
							: 'linear-gradient(180deg, rgba(6,5,11,0.75) 0%, rgba(6,5,11,0.35) 16%, transparent 30%, transparent 78%, rgba(6,5,11,0.7) 100%)',
				}}
			/>
			<Title L={L} />
			{L.hookY !== undefined ? (
				<div
					style={{
						position: 'absolute',
						left: 0,
						top: L.hookY,
						width: L.w,
						textAlign: 'center',
						fontFamily: SERIF,
						fontWeight: 700,
						fontSize: L.title.size * 0.36,
						letterSpacing: '0.24em',
						paddingLeft: '0.24em',
						color: `rgb(${GOLD})`,
						textShadow: '0 0 16px rgba(255,160,70,0.65), 0 2px 8px rgba(0,0,0,0.95)',
					}}
				>
					{L.hook}
				</div>
			) : null}
			<Hud w={L.w} h={L.h} m={Math.min(L.w, L.h) * 0.045} />
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)'}} />
			<AbsoluteFill style={{mixBlendMode: 'overlay', opacity: 0.1, pointerEvents: 'none'}}>
				<ShaderCanvas frag={GRAIN_FRAG} width={L.w} height={L.h} uniforms={{uTime: 0}} />
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

const HOOK = '倒影里的它，不一样';

const WIDE: Layout = {w: 1920, h: 1080, line: 610, figX: 1330, size: 650, dist: 34, fov: 40, title: {x: 120, size: 148, align: 'left'}, hook: HOOK};
const STANDARD: Layout = {w: 1440, h: 1080, line: 620, figX: 1030, size: 620, dist: 32, fov: 42, title: {x: 80, size: 112, align: 'left'}, hook: HOOK};
const PORTRAIT: Layout = {w: 1080, h: 1440, line: 960, figX: 540, size: 680, dist: 34, fov: 46, title: {x: 540, size: 148, align: 'center', top: 96}, hook: HOOK, hookY: 1250};

export const ReverseCoverWide: React.FC = () => <CoverBase L={WIDE} />;
export const ReverseCoverStandard: React.FC = () => <CoverBase L={STANDARD} />;
export const ReverseCoverPortrait: React.FC = () => <CoverBase L={PORTRAIT} />;
