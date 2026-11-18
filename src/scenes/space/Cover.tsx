import {AbsoluteFill} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {GRAIN_FRAG} from '../../gl/shaders';
import {COVER_FRAG} from './coverGl';

/**
 * 《空间的形状》封面（16:9 / 4:3 / 3:4）。
 * 帕路奇亚（起源形态，官方立绘）悬在两层平行空间的缝隙里，上下两张网格面朝它弯折收拢；
 * 身后一道亚空裂斩劈开空间；标题被同一刀斩开、上下错位。
 */

type Layout = {
	w: number;
	h: number;
	cam: {ro: [number, number, number]; yaw: number; pitch: number; fl: number};
	/** 弯折中心（世界 xz） */
	c: [number, number];
	h0: number;
	sigma: number;
	pinch: number;
	/** 中心处的拧转角（弧度）与网格密度 */
	twist: number;
	density: number;
	/** 立绘：相对弯折中心在屏幕上的偏移、显示边长、是否镜像 */
	art: {dx: number; dy: number; size: number; mirror: boolean};
	/** 裂斩：相对弯折中心的偏移（px）、角度（弧度，屏幕 y 向上）、半长与半宽（按画面高度） */
	tear: {dx: number; dy: number; ang: number; len: number; w: number};
	title: {x: number; y: number; size: number; align: 'left' | 'center'};
};

const project = (L: Layout, W: [number, number, number]): [number, number] => {
	const [rx, ry, rz] = L.cam.ro;
	const vx = W[0] - rx;
	const vy = W[1] - ry;
	const vz = W[2] - rz;
	const cy = Math.cos(L.cam.yaw);
	const sy = Math.sin(L.cam.yaw);
	const cp = Math.cos(L.cam.pitch);
	const sp = Math.sin(L.cam.pitch);
	// 与着色器 camRot() 互逆：先撤销偏航，再撤销俯仰
	const x1 = cy * vx - sy * vz;
	const z1 = sy * vx + cy * vz;
	const y2 = cp * vy + sp * z1;
	const z2 = -sp * vy + cp * z1;
	const px = (x1 * L.cam.fl) / -z2;
	const py = (y2 * L.cam.fl) / -z2;
	return [L.w / 2 + px * L.h, L.h / 2 - py * L.h];
};

// ── 漂浮的光点与碎片（固定种子） ──
const rand = (seed: number) => {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 4294967296;
	};
};

const NACRE = ['#ffd6f0', '#e6dcff', '#d4f1ff', '#fff4fb', '#f2c9ff', '#dcfff1'];

const Motes: React.FC<{w: number; h: number; cx: number; cy: number; seed: number; front: boolean}> = ({w, h, cx, cy, seed, front}) => {
	const r = rand(seed);
	const n = front ? 16 : 70;
	const items = Array.from({length: n}, (_, i) => {
		// 越靠近裂斩中心越密
		const a = r() * Math.PI * 2;
		const d = Math.pow(r(), 0.7) * Math.max(w, h) * 0.75;
		const x = cx + Math.cos(a) * d;
		const y = cy + Math.sin(a) * d * 0.8;
		const size = front ? 10 + r() * 46 : 1.5 + Math.pow(r(), 3) * 7;
		const blur = front ? 4 + r() * 14 : r() < 0.7 ? 0 : 1.5;
		const op = front ? 0.18 + r() * 0.3 : 0.35 + r() * 0.65;
		const c = NACRE[Math.floor(r() * NACRE.length)];
		return (
			<div
				key={i}
				style={{
					position: 'absolute',
					left: x - size / 2,
					top: y - size / 2,
					width: size,
					height: size,
					borderRadius: '50%',
					background: front
						? `radial-gradient(circle, ${c}cc 0%, ${c}55 45%, transparent 70%)`
						: `radial-gradient(circle, #ffffff 0%, ${c} 35%, transparent 72%)`,
					filter: blur ? `blur(${blur}px)` : undefined,
					opacity: op,
					mixBlendMode: 'screen',
				}}
			/>
		);
	});
	return <AbsoluteFill style={{pointerEvents: 'none'}}>{items}</AbsoluteFill>;
};

/** 从切口崩出的空间碎片：带网格的珍珠母贝玻璃片 */
const Shards: React.FC<{list: {x: number; y: number; s: number; rot: number; skew: number; blur: number; op: number}[]}> = ({list}) => (
	<AbsoluteFill style={{pointerEvents: 'none'}}>
		{list.map((k, i) => (
			<div
				key={i}
				style={{
					position: 'absolute',
					left: k.x - k.s / 2,
					top: k.y - k.s * 0.35,
					width: k.s,
					height: k.s * 0.7,
					transform: `rotate(${k.rot}deg) skewX(${k.skew}deg)`,
					clipPath: 'polygon(8% 0%, 100% 18%, 86% 100%, 0% 72%)',
					background: [
						'repeating-linear-gradient(0deg, rgba(255,255,255,0.55) 0 1px, transparent 1px 14px)',
						'repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 1px, transparent 1px 14px)',
						'linear-gradient(125deg, rgba(255,214,240,0.55), rgba(212,241,255,0.35) 45%, rgba(230,220,255,0.5) 70%, rgba(220,255,241,0.35))',
					].join(','),
					boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.75)',
					filter: `blur(${k.blur}px) drop-shadow(0 0 10px rgba(255,170,230,0.7))`,
					opacity: k.op,
					mixBlendMode: 'screen',
				}}
			/>
		))}
	</AbsoluteFill>
);

/** 被斩开的标题：沿一条斜线分成上下两半，上半沿切线滑开 */
const SlicedTitle: React.FC<{L: Layout}> = ({L}) => {
	const {size, align} = L.title;
	const text = '空间的形状';
	const tracking = 0.06;
	const blockW = size * text.length * (1 + tracking);
	// 切线：从左侧 58% 高度到右侧 40% 高度
	const y0 = 58;
	const y1 = 40;
	const shift = size * 0.11;
	const textStyle: React.CSSProperties = {
		fontFamily: SERIF,
		fontWeight: 900,
		fontSize: size,
		lineHeight: 1.18,
		letterSpacing: `${tracking}em`,
		whiteSpace: 'nowrap',
	};
	const fill: React.CSSProperties = {
		...textStyle,
		backgroundImage:
			'linear-gradient(176deg, #ffffff 0%, #fbf6ff 30%, #e9dcff 52%, #ffd9f1 68%, #dff3ff 84%, #f4ecff 100%)',
		WebkitBackgroundClip: 'text',
		backgroundClip: 'text',
		color: 'transparent',
	};
	const layer = (clip: string, dx: number, dy: number) => (
		<div style={{position: 'absolute', inset: 0, clipPath: clip, transform: `translate(${dx}px, ${dy}px)`}}>
			{/* 色散 */}
			<div style={{...textStyle, position: 'absolute', left: -3, top: 0, color: 'rgba(255,90,190,0.55)', mixBlendMode: 'screen', filter: 'blur(0.6px)'}}>{text}</div>
			<div style={{...textStyle, position: 'absolute', left: 3, top: 0, color: 'rgba(90,210,255,0.5)', mixBlendMode: 'screen', filter: 'blur(0.6px)'}}>{text}</div>
			<div
				style={{
					...fill,
					position: 'absolute',
					left: 0,
					top: 0,
					filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.9)) drop-shadow(0 0 18px rgba(240,150,230,0.55)) drop-shadow(0 0 46px rgba(170,130,255,0.45))',
				}}
			>
				{text}
			</div>
		</div>
	);
	const ang = Math.atan2(((y1 - y0) / 100) * size * 1.18, blockW);
	const ux = Math.cos(ang);
	const uy = Math.sin(ang);
	const left = align === 'center' ? L.title.x - blockW / 2 : L.title.x;
	const en = 'THE SHAPE OF SPACE';
	return (
		<div style={{position: 'absolute', left, top: L.title.y, width: blockW, height: size * 1.18}}>
			{layer(`polygon(-10% -20%, 110% -20%, 110% ${y1}%, -10% ${y0}%)`, shift * ux, shift * uy - size * 0.012)}
			{layer(`polygon(-10% ${y0}%, 110% ${y1}%, 110% 120%, -10% 120%)`, -shift * 0.35 * ux, -shift * 0.35 * uy + size * 0.012)}
			{/* 刀痕 */}
			<div
				style={{
					position: 'absolute',
					left: -size * 0.5,
					top: `${(y0 + y1) / 2}%`,
					width: blockW + size,
					height: 2,
					transform: `translateY(-1px) rotate(${(ang * 180) / Math.PI}deg)`,
					background:
						'linear-gradient(90deg, transparent 0%, rgba(255,210,240,0.0) 4%, rgba(255,255,255,0.95) 30%, #ffffff 55%, rgba(220,240,255,0.9) 80%, transparent 100%)',
					boxShadow: '0 0 12px 2px rgba(255,160,230,0.85), 0 0 34px 6px rgba(180,140,255,0.45)',
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: 0,
					width: blockW,
					top: size * 1.3,
					textAlign: align,
					fontFamily: CINZEL,
					fontWeight: 600,
					fontSize: size * 0.205,
					letterSpacing: '0.62em',
					color: '#efe6ff',
					textShadow: '0 0 14px rgba(230,160,255,0.7), 0 0 2px rgba(255,255,255,0.8)',
					paddingLeft: align === 'center' ? '0.62em' : 0,
					whiteSpace: 'nowrap',
				}}
			>
				{en}
			</div>
		</div>
	);
};

/** 全息取景框：四角的细线与刻度 */
const Hud: React.FC<{w: number; h: number; m: number}> = ({w, h, m}) => {
	const arm = Math.min(w, h) * 0.05;
	const line = 'rgba(238,228,255,0.55)';
	const corner = (x: number, y: number, sx: number, sy: number, k: number) => (
		<div key={k} style={{position: 'absolute', left: x, top: y}}>
			<div style={{position: 'absolute', width: arm, height: 1.5, background: line, left: sx < 0 ? -arm : 0}} />
			<div style={{position: 'absolute', width: 1.5, height: arm, background: line, top: sy < 0 ? -arm : 0}} />
		</div>
	);
	const label: React.CSSProperties = {
		position: 'absolute',
		fontFamily: CINZEL,
		fontWeight: 600,
		fontSize: Math.min(w, h) * 0.017,
		letterSpacing: '0.34em',
		color: 'rgba(238,228,255,0.7)',
		whiteSpace: 'nowrap',
	};
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{corner(m, m, 1, 1, 0)}
			{corner(w - m, m, -1, 1, 1)}
			{corner(m, h - m, 1, -1, 2)}
			{corner(w - m, h - m, -1, -1, 3)}
			<div style={{...label, left: m + arm * 0.35, top: m + arm * 0.3}}>NO.0484 · PALKIA</div>
			<div style={{...label, right: m + arm * 0.35, bottom: m + arm * 0.3, textAlign: 'right'}}>SPATIAL POKÉMON</div>
		</AbsoluteFill>
	);
};

const CoverBase: React.FC<{L: Layout}> = ({L}) => {
	const [px, py] = project(L, [L.c[0], 0, L.c[1]]);
	const tearX = px + L.tear.dx;
	const tearY = py + L.tear.dy;
	const uniforms = {
		uRo: L.cam.ro,
		uYaw: L.cam.yaw,
		uPitch: L.cam.pitch,
		uFl: L.cam.fl,
		uC: L.c,
		uH: L.h0,
		uSigma: L.sigma,
		uPinch: L.pinch,
		uTwist: L.twist,
		uDensity: L.density,
		uTearP: [(tearX - L.w / 2) / L.h, (L.h / 2 - tearY) / L.h] as [number, number],
		uTearAng: L.tear.ang,
		uTearLen: L.tear.len,
		uTearW: L.tear.w,
	};
	const ax = px + L.art.dx;
	const ay = py + L.art.dy;
	const s = L.art.size;
	// 碎片沿裂斩方向散开
	const tdx = Math.cos(L.tear.ang);
	const tdy = -Math.sin(L.tear.ang);
	const r = rand(484);
	const shards = Array.from({length: 7}, (_, i) => {
		const t = (i / 6 - 0.5) * 2;
		const along = t * L.tear.len * L.h * (0.7 + r() * 0.25);
		const off = (r() - 0.5) * L.h * 0.32;
		const near = r() < 0.35;
		return {
			x: tearX + tdx * along - tdy * off,
			y: tearY + tdy * along + tdx * off,
			s: (near ? 80 : 26) + r() * (near ? 70 : 34),
			rot: r() * 360,
			skew: (r() - 0.5) * 40,
			blur: near ? 3 + r() * 3 : r() * 0.8,
			op: near ? 0.45 : 0.75,
		};
	});

	return (
		<AbsoluteFill style={{background: '#030108', overflow: 'hidden'}}>
			{/* 2 倍超采样，压住掠射角的网格线与轮廓锯齿 */}
			<ShaderCanvas frag={COVER_FRAG} width={L.w} height={L.h} scale={2} uniforms={uniforms} />
			<Motes w={L.w} h={L.h} cx={tearX} cy={tearY} seed={7} front={false} />
			{/* 帕路奇亚背后的柔光，压住它和裂缝的交界 */}
			<div
				style={{
					position: 'absolute',
					left: ax - s * 0.55,
					top: ay - s * 0.55,
					width: s * 1.1,
					height: s * 1.1,
					background: 'radial-gradient(circle, rgba(255,200,240,0.20) 0%, rgba(190,150,255,0.10) 35%, transparent 65%)',
					mixBlendMode: 'screen',
				}}
			/>
			<div style={{position: 'absolute', inset: 0, transform: L.art.mirror ? 'scaleX(-1)' : undefined, transformOrigin: `${ax}px 50%`}}>
				<PokemonArt3D
					dir="pokemon/palkia"
					variant="-origin"
					x={ax}
					y={ay}
					size={s}
					depthScale={0.5}
					yaw={L.art.mirror ? 4 : -4}
					pitch={2}
					ambient={[0.62, 0.58, 0.76]}
					dirLights={[
						// 裂缝的珍珠粉光从背后侧上方打来
						{dir: [0.35, -0.55, -0.6], color: [1.1, 0.7, 1.0], wrap: 0.5},
						// 下层空间的冷光托底
						{dir: [-0.3, 0.8, 0.45], color: [0.32, 0.36, 0.6], wrap: 0.6},
					]}
					pointLights={[{pos: [0.08, -0.05, -0.35], color: [0.9, 0.7, 1.0], radius: 0.9}]}
					rim={{dir: [0.45, -1], color: [1.7, 1.15, 1.7], power: 1.8}}
					emissive={0.35}
					emissiveTint={[1.0, 0.7, 0.75]}
					emissiveKey={[0.5, 0.8, 0.2, 0.6]}
					resolution={1.6}
				/>
			</div>
			<Motes w={L.w} h={L.h} cx={tearX} cy={tearY} seed={21} front />
			{/* 标题区压暗 */}
			<AbsoluteFill
				style={{
					background:
						L.title.align === 'left'
							? 'linear-gradient(90deg, rgba(3,1,8,0.72) 0%, rgba(3,1,8,0.45) 30%, transparent 52%)'
							: 'linear-gradient(0deg, rgba(3,1,8,0.85) 0%, rgba(3,1,8,0.55) 22%, transparent 40%)',
				}}
			/>
			<SlicedTitle L={L} />
			<Hud w={L.w} h={L.h} m={Math.min(L.w, L.h) * 0.045} />
			<AbsoluteFill style={{mixBlendMode: 'overlay', opacity: 0.12, pointerEvents: 'none'}}>
				<ShaderCanvas frag={GRAIN_FRAG} width={L.w} height={L.h} uniforms={{uTime: 0}} />
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

const WIDE: Layout = {
	w: 1920,
	h: 1080,
	cam: {ro: [0, 0.05, 0], yaw: 0, pitch: 0.0, fl: 1.55},
	c: [1.25, -6.2],
	h0: 1.0,
	sigma: 2.0,
	pinch: 0.9,
	twist: 1.3,
	density: 2.6,
	art: {dx: 10, dy: 20, size: 1120, mirror: true},
	tear: {dx: 150, dy: -40, ang: 1.15, len: 0.62, w: 0.05},
	title: {x: 110, y: 350, size: 158, align: 'left'},
};

const STANDARD: Layout = {
	...WIDE,
	w: 1440,
	h: 1080,
	c: [1.18, -6.2],
	art: {dx: 20, dy: 30, size: 1040, mirror: true},
	tear: {dx: 130, dy: -40, ang: 1.15, len: 0.62, w: 0.05},
	title: {x: 72, y: 330, size: 104, align: 'left'},
};

const PORTRAIT: Layout = {
	...WIDE,
	w: 1080,
	h: 1440,
	cam: {ro: [0, 0.05, 0], yaw: 0, pitch: -0.07, fl: 1.5},
	c: [0, -6.4],
	art: {dx: 0, dy: 0, size: 1000, mirror: false},
	tear: {dx: -130, dy: -40, ang: 1.25, len: 0.46, w: 0.045},
	title: {x: 540, y: 1050, size: 150, align: 'center'},
};

export const SpaceCoverWide: React.FC = () => <CoverBase L={WIDE} />;
export const SpaceCoverStandard: React.FC = () => <CoverBase L={STANDARD} />;
export const SpaceCoverPortrait: React.FC = () => <CoverBase L={PORTRAIT} />;
