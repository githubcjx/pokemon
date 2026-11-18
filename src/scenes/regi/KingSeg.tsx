import {useLayoutEffect, useRef} from 'react';
import {interpolate} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {H, T, W} from './common';
import {rng} from './DotTitle';
import {FACE_DOTS, GIGAS_HOLES} from './GiantsSeg';
import {FROST, OneDoor} from './KeySeg';
import {artToScreen} from './Rocks';
import {Pt} from './shapes';

/**
 * 第 9 段 · 王醒来（全片爆发点）。
 * 门前：三个巨人一个个出现（背光的剪影）→ 门开、推进 → 最深处：石像一样的雷吉奇卡斯，三个巨人站在前排，脸上的七个点亮起
 * → 石像表面裂开、碎片剥落、恢复颜色，七个圆孔一个个点亮，第二次叫声 → 从外面看敞开的门，光照出来，淡出。
 */

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const useCanvas = (draw: (ctx: CanvasRenderingContext2D) => void) => {
	const ref = useRef<HTMLCanvasElement>(null);
	useLayoutEffect(() => {
		const c = ref.current;
		if (!c) return;
		const ctx = c.getContext('2d')!;
		ctx.clearRect(0, 0, W, H);
		draw(ctx);
	});
	return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', left: 0, top: 0, width: W, height: H}} />;
};
const goldDot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) => {
	if (a <= 0) return;
	const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
	g.addColorStop(0, `rgba(255,240,200,${a})`);
	g.addColorStop(0.3, `rgba(255,200,110,${a * 0.9})`);
	g.addColorStop(1, 'rgba(255,160,60,0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
	ctx.fill();
};

// ── 门前：三个巨人一个个回来（门缝的金光从背后照着） ──
const AT_DOOR = [
	{dir: 'regirock', at: T.seek + 104, x: 450, y: 700, size: 380},
	{dir: 'registeel', at: T.seek + 124, x: 1470, y: 720, size: 420},
	{dir: 'regice', at: T.seek + 144, x: 960, y: 790, size: 400},
];
export const GiantsAtDoor: React.FC<{f: number}> = ({f}) => {
	if (f < T.seek + 100 || f > T.before + 52) return null;
	// 门开时一起往门里走（变小、淡去）
	const go = ease(interpolate(f, [T.before + 6, T.before + 50], [0, 1], clamp));
	return (
		<>
			{AT_DOOR.map((g) => {
				const o = interpolate(f, [g.at, g.at + 22], [0, 1], clamp) * (1 - go);
				if (o <= 0) return null;
				const x = g.x + (960 - g.x) * go * 0.5;
				const y = g.y - 60 * go;
				return (
					<PokemonArt3D
						key={g.dir}
						dir={`pokemon/${g.dir}`}
						x={x}
						y={y}
						size={g.size * (1 - 0.3 * go)}
						depthScale={0.5}
						ambient={[0.03, 0.03, 0.04]}
						brightness={0.4}
						rim={{dir: [0, -1], color: [1.7, 1.15, 0.5], power: 2.2}}
						opacity={o}
					/>
				);
			})}
		</>
	);
};

// ── 最深处 ──
export const chamberOpacity = (f: number) => interpolate(f, [T.before + 36, T.before + 70, T.dread - 40, T.dread], [0, 1, 1, 0], clamp);
const GIGAS = {x: 960, y: 430, size: 800};
const FRONT = [
	{dir: 'regirock', x: 560, size: 240, dots: FACE_DOTS.regirock},
	{dir: 'regice', x: 960, size: 240, dots: FACE_DOTS.regice},
	{dir: 'registeel', x: 1360, size: 260, dots: FACE_DOTS.registeel},
];
const FRONT_Y = 790;
/** 石像上的裂纹（从七个圆孔附近出发） */
const CRACKS = (() => {
	const r = rng(486);
	return Array.from({length: 22}, (_, i) => {
		const o = GIGAS_HOLES[i % 7];
		// 只在躯干上（圆孔附近往下、往两侧裂开，不越过头顶）
		const start: Pt = [o[0] + (r() - 0.5) * 0.12, Math.max(o[1] + (r() - 0.3) * 0.16, 0.26)];
		const pts: Pt[] = [start];
		let a = Math.PI * (0.15 + r() * 0.7) + (r() < 0.5 ? 0 : Math.PI * 0.0);
		for (let k = 0; k < 6; k++) {
			a += (r() - 0.5) * 1.0;
			const p = pts[pts.length - 1];
			const nx = Math.min(Math.max(p[0] + Math.cos(a) * 0.028, 0.3), 0.66);
			const ny = Math.min(Math.max(p[1] + Math.abs(Math.sin(a)) * 0.028, 0.26), 0.62);
			pts.push([nx, ny]);
		}
		return {pts, d: r() * 16};
	});
})();
/** 剥落的石片 */
const FLAKES = (() => {
	const r = rng(487);
	return Array.from({length: 70}, () => ({uv: [0.2 + r() * 0.6, 0.2 + r() * 0.55] as Pt, d: r() * 40, vx: (r() - 0.5) * 3, rot: (r() - 0.5) * 0.2, s: 4 + r() * 9, shade: 60 + r() * 60}));
})();

export const wakeShake = (f: number) => interpolate(f, [T.wake + 24, T.wake + 30, T.wake + 70, T.wake + 110], [0, 1, 0.5, 0], clamp);

export const KingChamber: React.FC<{f: number}> = ({f}) => {
	const o = chamberOpacity(f);
	const color = ease(interpolate(f, [T.wake + 6, T.wake + 76], [0, 1], clamp));
	const burst = interpolate(f, [T.wake + 20, T.wake + 34, T.wake + 90, T.dread], [0, 1, 0.45, 0.35], clamp);
	const q = wakeShake(f);
	const cv = useCanvas((ctx) => {
		if (o <= 0) return;
		const at = (uv: Pt) => artToScreen(uv, GIGAS.x, GIGAS.y, GIGAS.size);
		// 裂纹：金光沿着裂缝爬开，颜色回来后慢慢退去
		const fade = interpolate(f, [T.wake + 50, T.wake + 100], [1, 0], clamp);
		ctx.globalCompositeOperation = 'lighter';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		CRACKS.forEach((c) => {
			const grow = interpolate(f, [T.wake - 12 + c.d, T.wake + 24 + c.d], [0, 1], clamp);
			if (grow <= 0 || fade <= 0) return;
			const n = Math.max(1, Math.ceil(grow * (c.pts.length - 1)));
			ctx.beginPath();
			for (let k = 0; k <= n; k++) {
				const p = at(c.pts[k]);
				if (k === 0) ctx.moveTo(p[0], p[1]);
				else ctx.lineTo(p[0], p[1]);
			}
			ctx.strokeStyle = `rgba(255,200,110,${0.35 * fade})`;
			ctx.lineWidth = 7;
			ctx.stroke();
			ctx.strokeStyle = `rgba(255,240,200,${0.9 * fade})`;
			ctx.lineWidth = 2;
			ctx.stroke();
		});
		// 七个圆孔：一个接一个点亮
		GIGAS_HOLES.forEach((uv, i) => {
			const a = interpolate(f, [T.wake + 24 + i * 6, T.wake + 34 + i * 6], [0, 1], clamp) * (0.85 + 0.15 * Math.sin(f * 0.15 + i));
			const p = at(uv);
			goldDot(ctx, p[0], p[1], (GIGAS.size / 1050) * 10, a);
		});
		// 前排三个巨人脸上的七个点
		FRONT.forEach((g, gi) => {
			g.dots.forEach((uv, i) => {
				const a = interpolate(f, [T.before + 70 + gi * 6 + i * 2, T.before + 80 + gi * 6 + i * 2], [0, 1], clamp) * (0.8 + 0.2 * Math.sin(f * 0.12 + i));
				const p = artToScreen(uv, g.x, FRONT_Y, g.size);
				goldDot(ctx, p[0], p[1], 4.5, a);
			});
		});
		ctx.globalCompositeOperation = 'source-over';
		// 剥落的石片
		FLAKES.forEach((fl) => {
			const t = f - (T.wake + 28 + fl.d);
			if (t < 0 || t > 90) return;
			const p = at(fl.uv);
			const x = p[0] + fl.vx * t;
			const y = p[1] + 0.08 * t * t;
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(fl.rot * t);
			ctx.globalAlpha = interpolate(t, [0, 6, 60, 90], [0, 1, 1, 0], clamp);
			ctx.fillStyle = `rgb(${fl.shade},${fl.shade},${fl.shade + 6})`;
			ctx.beginPath();
			ctx.moveTo(-fl.s, -fl.s * 0.6);
			ctx.lineTo(fl.s * 0.8, -fl.s * 0.4);
			ctx.lineTo(fl.s * 0.5, fl.s * 0.7);
			ctx.lineTo(-fl.s * 0.7, fl.s * 0.5);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		});
		ctx.globalAlpha = 1;
	});
	if (o <= 0) return null;
	const sx = (Math.sin(f * 2.3) + Math.sin(f * 3.7)) * 5 * q;
	const sy = (Math.sin(f * 2.9 + 1) + Math.sin(f * 4.1)) * 4 * q;
	const gray = 1 - color;
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: o}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '960px 540px', transform: `translate(${sx}px, ${sy}px) scale(${1 + 0.025 * q})`}}>
				<OneDoor f={f} view={[0, 2.0, 5.6]} o={1} door={[100, 0, 0, 0]} glow={[0, 0, 0, 0]} marks={NO_MARKS} layer={0} tint={FROST} />
				{/* 身后的金光 */}
				<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, mixBlendMode: 'screen', opacity: burst, background: 'radial-gradient(ellipse 38% 46% at 50% 40%, rgba(255,200,120,0.55), rgba(255,150,60,0.18) 55%, rgba(0,0,0,0) 100%)'}} />
				<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, filter: `grayscale(${gray}) sepia(${0.15 * gray}) brightness(${0.8 + 0.25 * color})`}}>
					<PokemonArt3D
						dir="pokemon/regigigas"
						x={GIGAS.x}
						y={GIGAS.y}
						size={GIGAS.size}
						depthScale={0.5}
						ambient={[0.3 + 0.35 * color, 0.32 + 0.32 * color, 0.36 + 0.26 * color]}
						dirLights={[{dir: [-0.3, -0.8, 0.6], color: [0.7 + 0.4 * color, 0.72 + 0.3 * color, 0.8 + 0.1 * color], wrap: 0.4}]}
						rim={{dir: [0, -1], color: [0.9 + 0.9 * color, 0.9 + 0.3 * color, 1.0 - 0.5 * color], power: 2.6}}
					/>
				</div>
				{FRONT.map((g) => (
					<PokemonArt3D
						key={g.dir}
						dir={`pokemon/${g.dir}`}
						x={g.x}
						y={FRONT_Y}
						size={g.size}
						depthScale={0.5}
						ambient={[0.4, 0.42, 0.45]}
						dirLights={[{dir: [0, -0.6, 0.8], color: [0.5 + 0.6 * burst, 0.45 + 0.4 * burst, 0.35 + 0.2 * burst], wrap: 0.4}]}
						rim={{dir: [0, -1], color: [1.7, 1.15, 0.5], power: 2.4}}
						opacity={interpolate(f, [T.before + 50, T.before + 80], [0, 1], clamp)}
					/>
				))}
				{cv}
			</div>
		</div>
	);
};
const NO_MARKS = Array.from({length: 80}, () => 50);

// ── 结尾：敞开的门，光照出来；淡出 ──
export const DoorLight: React.FC<{f: number}> = ({f}) => {
	if (f < T.dread - 40) return null;
	const o = interpolate(f, [T.dread - 40, T.dread], [0, 1], clamp);
	const rays = 0.75 + 0.25 * Math.sin(f * 0.05);
	const fade = interpolate(f, [T.revere + 92, T.endG - 4], [0, 1], clamp);
	return (
		<>
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, mixBlendMode: 'screen', opacity: o * rays}}>
				<svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
					<defs>
						<radialGradient id="ray" cx="50%" cy="58%" r="60%">
							<stop offset="0%" stopColor="rgba(255,214,150,0.2)" />
							<stop offset="100%" stopColor="rgba(255,170,80,0)" />
						</radialGradient>
					</defs>
					{Array.from({length: 9}, (_, i) => {
						const a = ((i - 4) / 4) * 0.55 + Math.sin(f * 0.01 + i) * 0.02;
						const cx = 960;
						const cy = 560;
						const L = 1300;
						const wdt = 0.05 + (i % 3) * 0.02;
						return <polygon key={i} points={`${cx},${cy} ${cx + Math.sin(a - wdt) * L},${cy + Math.cos(a - wdt) * L} ${cx + Math.sin(a + wdt) * L},${cy + Math.cos(a + wdt) * L}`} fill="url(#ray)" opacity={0.5 + 0.5 * Math.abs(Math.sin(f * 0.02 + i))} />;
					})}
				</svg>
			</div>
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, background: '#000', opacity: fade}} />
		</>
	);
};

