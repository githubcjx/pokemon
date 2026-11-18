import {useLayoutEffect, useMemo, useRef} from 'react';
import {interpolate} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL} from '../../fonts';
import {clamp} from '../../theme';
import {BASE_FPS} from '../../time';
import {cellCount, cellsOf, cellTexture, MAX_COLS, MAX_LINES, Panel, RIDDLE_PANELS} from './braille';
import {Cam, camFrom, flow, H, project, T, track, W} from './common';
import {rng} from './DotTitle';
import {HALL_FRAG} from './gl';
import {GLView} from './GLView';

/**
 * 第 5 段 · 解封仪式与三道题。
 * 石室部分仍用 Master 里的 HallView（读正中的大石板）；三座遗迹的点字用同一个石壁着色器的第二个实例（RIDDLE_PANELS，uZone = 1）。
 */

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ── 石室：读大石板、两只宝可梦、地震 ──
export const HALL_CAM_C: [number, number[]][] = [
	[T.endB, [0, 2.45, 6.7, 0, 0, 52]],
	[T.tablet + 50, [0, 2.72, 4.0, 0, 0, 46]],
	[T.relicanth - 14, [0, 2.7, 3.9, 0, 0, 46]],
	[T.relicanth + 34, [0, 2.35, 6.2, 0, 0, 50]],
	[T.bring, [0.2, 2.3, 6.6, 0, 0, 51]],
	[T.quake + 46, [0, 2.4, 7.2, 0, 0, 52]],
];
/** 地震：镜头抖动（同时略微推近，不露边） */
export const quakeShake = (f: number, at: number, len = 50) => {
	const q = interpolate(f, [at, at + 4, at + len * 0.5, at + len], [0, 1, 0.6, 0], clamp);
	return {dx: (Math.sin(f * 2.7) + Math.sin(f * 4.3 + 1)) * 0.018 * q, dy: (Math.sin(f * 3.1 + 2) + Math.sin(f * 5.2)) * 0.014 * q, q};
};
export const hallCamC = (f: number): Cam => {
	const c = camFrom(flow(f, HALL_CAM_C));
	const s = quakeShake(f, T.quake, 56);
	return {...c, x: c.x + s.dx, y: c.y + s.dy, fov: c.fov * (1 - 0.03 * s.q)};
};
export const TABLET_READ: [number, number][] = [
	[T.tablet + 44, 0],
	[T.tablet + 124, cellCount(6)],
];

/** 读到的格子上方浮出字母（与第 1 段的做法一致） */
export const Letters: React.FC<{cam: Cam; panels: Panel[]; which: number[]; read: number[]; show: number}> = ({cam, panels, which, read, show}) => {
	const cells = useMemo(() => which.map((i) => cellsOf(i, panels)), [panels, which]);
	if (show <= 0) return null;
	return (
		<svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
			{cells.map((cs, k) =>
				cs.map((c) => {
					if (c.ch === ' ') return null;
					const lit = Math.min(Math.max(read[which[k]] - c.order, 0), 1);
					if (lit <= 0) return null;
					const p = project(cam, [c.x, c.y + 0.112, 0.04]);
					if (!p || p.x < -50 || p.x > 1970) return null;
					const fs = p.s * 0.068;
					const vis = Math.min(Math.max((fs - 9) / 8, 0), 1);
					if (vis <= 0) return null;
					return (
						<text
							key={`${k}-${c.order}`}
							x={p.x}
							y={p.y}
							fill="#ffe2a8"
							opacity={show * vis * lit}
							fontFamily={CINZEL}
							fontWeight={600}
							fontSize={fs}
							textAnchor="middle"
							dominantBaseline="central"
							style={{filter: `drop-shadow(0 0 ${fs * 0.3}px rgba(255,180,80,0.9))`}}
						>
							{c.ch}
						</text>
					);
				}),
			)}
		</svg>
	);
};

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

/** 震落的尘土和碎石（屏幕坐标） */
const DUST = (() => {
	const r = rng(7620);
	return Array.from({length: 140}, () => ({x: r() * W, d: r() * 20, v: 6 + r() * 10, s: 1 + r() * 3.5, rock: r() < 0.18}));
})();
export const Dust: React.FC<{f: number; at: number; len: number; rgb: string}> = ({f, at, len, rgb}) =>
	useCanvas((ctx) => {
		const vis = interpolate(f, [at, at + 6, at + len - 20, at + len], [0, 1, 1, 0], clamp);
		if (vis <= 0) return;
		DUST.forEach((d) => {
			const t = f - at - d.d;
			if (t < 0) return;
			const y = -20 + t * d.v + 0.12 * t * t;
			if (y > H + 20) return;
			ctx.globalAlpha = vis * (d.rock ? 0.85 : 0.45);
			ctx.fillStyle = d.rock ? 'rgba(40,36,32,1)' : `rgba(${rgb},1)`;
			ctx.beginPath();
			ctx.arc(d.x + Math.sin(t * 0.1 + d.d) * 6, y, d.rock ? d.s * 1.6 : d.s, 0, Math.PI * 2);
			ctx.fill();
		});
		// 扬起的尘雾
		const g = ctx.createLinearGradient(0, 0, 0, H * 0.5);
		g.addColorStop(0, `rgba(${rgb},${0.18 * vis * interpolate(f, [at, at + 20, at + len], [0, 1, 0], clamp)})`);
		g.addColorStop(1, `rgba(${rgb},0)`);
		ctx.globalAlpha = 1;
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, W, H * 0.5);
	});

/** 古空棘鱼和吼鲸王：从右边游到墙前（画面坐标），地震后淡去 */
export const SeaGuests: React.FC<{f: number}> = ({f}) => {
	if (f < T.relicanth - 40 || f > T.quake + 70) return null;
	const fadeOut = interpolate(f, [T.quake + 24, T.quake + 64], [1, 0], clamp);
	const rk = ease(interpolate(f, [T.relicanth - 36, T.relicanth + 14], [0, 1], clamp));
	const wk = ease(interpolate(f, [T.wailord - 40, T.wailord + 26], [0, 1], clamp));
	const bob = (ph: number) => Math.sin(f * 0.06 + ph) * 8;
	const pool: [number, number, number] = [0.2, 0.75, 0.8];
	const light = (k: number) => ({
		ambient: [0.3, 0.33, 0.36] as [number, number, number],
		dirLights: [
			{dir: [0.1, 1.0, 0.4] as [number, number, number], color: [pool[0] * 1.1 * k, pool[1] * 1.1 * k, pool[2] * 1.1 * k] as [number, number, number], wrap: 0.4},
			{dir: [-0.5, -0.7, 0.5] as [number, number, number], color: [0.9 * k, 0.65 * k, 0.35 * k] as [number, number, number], wrap: 0.4},
		],
		rim: {dir: [0, 1] as [number, number], color: [0.4, 1.3, 1.4] as [number, number, number], power: 2.4},
	});
	return (
		<>
			{rk > 0 ? (
				<PokemonArt3D dir="pokemon/relicanth" x={900 - 330 * rk} y={790 + bob(0)} size={400} depthScale={0.5} {...light(1)} opacity={Math.min(rk * 2, 1) * fadeOut} />
			) : null}
			{wk > 0 ? (
				<PokemonArt3D dir="pokemon/wailord" x={2450 - 1010 * wk} y={700 + bob(2)} size={860} depthScale={0.5} {...light(1)} opacity={Math.min(wk * 2, 1) * fadeOut} />
			) : null}
		</>
	);
};

// ── 三座遗迹 ──
const RIDDLE_CAM: [number, number[]][] = [
	[T.riddle + 100, [-6, 1.72, 4.6, 0, 0, 46]],
	[T.desert + 50, [-6, 1.62, 3.6, 0, 0, 44]],
	[T.island - 16, [-6, 1.57, 3.45, 0, 0, 44]],
	[T.island + 36, [0, 1.62, 3.6, 0, 0, 44]],
	[T.tomb - 22, [0, 1.62, 3.8, 0, 0, 44]],
	[T.tomb + 30, [6, 1.62, 3.6, 0, 0, 44]],
	[T.record + 10, [6, 1.62, 3.7, 0, 0, 44]],
	[T.will - 4, [10, 1.62, 3.6, 0, 0, 44]],
	[T.wait + 20, [10, 1.66, 3.85, 0, 0, 45]],
];
export const riddleCam = (f: number): Cam => {
	const c = camFrom(flow(f, RIDDLE_CAM));
	const s = quakeShake(f, T.strength + 2, 44);
	return {...c, x: c.x + s.dx, y: c.y + s.dy, fov: c.fov * (1 - 0.03 * s.q)};
};
export const riddleOpacity = (f: number) => interpolate(f, [T.riddle + 96, T.riddle + 130, T.wait - 4, T.wait + 40], [0, 1, 1, 0], clamp);
export const riddleRead = (f: number): number[] => {
	const r = RIDDLE_PANELS.map(() => 0);
	r[0] = track(f, [[T.desert + 14, 0], [T.desert + 128, cellCount(0, RIDDLE_PANELS)]], (t) => t);
	r[1] = track(f, [[T.island + 30, 0], [T.island + 140, cellCount(1, RIDDLE_PANELS)]], (t) => t);
	r[2] = track(f, [[T.tomb + 22, 0], [T.tomb + 124, cellCount(2, RIDDLE_PANELS)]], (t) => t);
	r[3] = track(f, [[T.will, 0], [T.will + 62, cellCount(3, RIDDLE_PANELS)]], (t) => t);
	return r;
};
const RIDDLE_CELLS = cellTexture(RIDDLE_PANELS);
const RIDDLE_U = RIDDLE_PANELS.flatMap((p) => [p.cx, p.cy, p.w, p.h]);
const RIDDLE_LINES = RIDDLE_PANELS.map((p) => p.lines.length);

export const RiddleView: React.FC<{f: number}> = ({f}) => {
	const cam = riddleCam(f);
	const strength = interpolate(f, [T.strength, T.strength + 8, T.strength + 60], [0, 1, 0.3], clamp);
	const shine = interpolate(f, [T.will + 64, T.will + 84], [0, 1], clamp);
	const hot = [0.45 + strength * 1.2, 0.45, 0.45, 0.45 + shine * 1.2, 0, 0, 0];
	// "等时间流过两次"：光影快速地扫来扫去（延时摄影）
	const lapse = interpolate(f, [T.patience + 14, T.patience + 26, T.patience + 116, T.patience + 130], [0, 1, 1, 0], clamp);
	const lx = cam.x + 0.25 + Math.sin((f - T.patience) * 0.16) * 2.4 * lapse;
	return (
		<GLView
			frag={HALL_FRAG}
			style={{opacity: riddleOpacity(f)}}
			textures={[{name: 'uCells', w: MAX_COLS, h: RIDDLE_PANELS.length * MAX_LINES, data: RIDDLE_CELLS}]}
			uniforms={{
				uTime: f / BASE_FPS,
				uCamPos: [cam.x, cam.y, cam.z],
				uCamRot: [cam.yaw, cam.pitch],
				uFov: cam.fov,
				'uPanel[]': RIDDLE_U,
				'uLines[1]': RIDDLE_LINES,
				'uRead[1]': riddleRead(f),
				'uHot[1]': hot,
				uLamp: [lx, cam.y + 0.5, Math.min(cam.z * 0.6, 1.4), 0.95 + strength * 0.4],
				uPool: 0.55,
				uZone: 1,
				uSplash: 0,
				uExposure: 1.35,
				uFade: 0,
			}}
		/>
	);
};

/** 遗迹里的提示：箭头、计时的两个圈、古墓的光柱、"在中央发出光芒" */
export const RiddleFx: React.FC<{f: number}> = ({f}) => {
	const cam = riddleCam(f);
	const o = riddleOpacity(f);
	const read = riddleRead(f);
	const at = (x: number, y: number) => project(cam, [x, y, 0.05]);
	const fx = useCanvas((ctx) => {
		if (o <= 0) return;
		ctx.globalCompositeOperation = 'lighter';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		// 沙漠：→ → ↓ ↓（读到哪个词，亮哪个箭头）
		const arrowsO = o * interpolate(f, [T.island - 20, T.island + 10], [1, 0], clamp);
		[6, 13, 19, 24].forEach((need, k) => {
			const a = Math.min(Math.max(read[0] - need, 0) / 3, 1) * arrowsO;
			if (a <= 0) return;
			const p = at(-6.75 + k * 0.5, 2.5);
			if (!p) return;
			const L = p.s * 0.17;
			const down = k >= 2;
			ctx.globalAlpha = a;
			ctx.strokeStyle = '#ffd68f';
			ctx.shadowColor = 'rgba(255,180,80,0.9)';
			ctx.shadowBlur = 12;
			ctx.lineWidth = Math.max(3, p.s * 0.012);
			ctx.beginPath();
			if (!down) {
				ctx.moveTo(p.x - L, p.y);
				ctx.lineTo(p.x + L, p.y);
				ctx.moveTo(p.x + L * 0.45, p.y - L * 0.5);
				ctx.lineTo(p.x + L, p.y);
				ctx.lineTo(p.x + L * 0.45, p.y + L * 0.5);
			} else {
				ctx.moveTo(p.x, p.y - L);
				ctx.lineTo(p.x, p.y + L);
				ctx.moveTo(p.x - L * 0.5, p.y + L * 0.45);
				ctx.lineTo(p.x, p.y + L);
				ctx.lineTo(p.x + L * 0.5, p.y + L * 0.45);
			}
			ctx.stroke();
		});
		ctx.shadowBlur = 0;
		// 小岛：两个圈依次走满（时间流过两次）
		const ringO = o * interpolate(f, [T.patience, T.patience + 14, T.tomb - 10, T.tomb + 16], [0, 1, 1, 0], clamp);
		if (ringO > 0) {
			[0, 1].forEach((k) => {
				const p = at(-0.42 + k * 0.84, 2.48);
				if (!p) return;
				const R = p.s * 0.2;
				const fill = interpolate(f, [T.patience + 20 + k * 50, T.patience + 68 + k * 50], [0, 1], clamp);
				ctx.globalAlpha = ringO * 0.35;
				ctx.strokeStyle = '#bcd8ff';
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
				ctx.stroke();
				if (fill > 0) {
					ctx.globalAlpha = ringO;
					ctx.strokeStyle = '#ffd68f';
					ctx.shadowColor = 'rgba(255,190,90,0.9)';
					ctx.shadowBlur = 10;
					ctx.lineWidth = Math.max(4, p.s * 0.014);
					ctx.beginPath();
					ctx.arc(p.x, p.y, R, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
					ctx.stroke();
					ctx.shadowBlur = 0;
				}
				const done = interpolate(f, [T.patience + 68 + k * 50, T.patience + 72 + k * 50, T.patience + 90 + k * 50], [0, 1, 0], clamp);
				if (done > 0) {
					ctx.globalAlpha = done * ringO;
					const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 1.8);
					g.addColorStop(0, 'rgba(255,220,150,0.8)');
					g.addColorStop(1, 'rgba(255,180,80,0)');
					ctx.fillStyle = g;
					ctx.fillRect(p.x - R * 2, p.y - R * 2, R * 4, R * 4);
				}
			});
		}
		// 古墓：中央升起一道光柱，光点往上飘（飞向天空）
		const beam = o * interpolate(f, [T.tomb + 112, T.tomb + 140, T.record + 50, T.record + 80], [0, 1, 1, 0], clamp);
		if (beam > 0) {
			const p = at(6, 1.5);
			if (p) {
				const w = p.s * 0.55;
				const g = ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
				g.addColorStop(0, 'rgba(230,236,255,0)');
				g.addColorStop(0.5, `rgba(235,240,255,${0.32 * beam})`);
				g.addColorStop(1, 'rgba(230,236,255,0)');
				ctx.globalAlpha = 1;
				ctx.fillStyle = g;
				const rise = interpolate(f, [T.tomb + 112, T.tomb + 150], [0, 1], clamp);
				ctx.fillRect(p.x - w, H - rise * H, w * 2, rise * H);
				const r = rng(70);
				for (let i = 0; i < 40; i++) {
					const ph = r();
					const t = ((f - T.tomb) * 0.012 + ph) % 1;
					const x = p.x + (r() - 0.5) * w * 1.3;
					const y = H - t * H * 1.1;
					ctx.globalAlpha = beam * Math.sin(t * Math.PI) * 0.9;
					ctx.fillStyle = '#fff4dc';
					ctx.beginPath();
					ctx.arc(x, y, 2 + r() * 2, 0, Math.PI * 2);
					ctx.fill();
				}
			}
		}
		// 另一份记载："在中央发出光芒"
		const shine = o * interpolate(f, [T.will + 66, T.will + 90], [0, 1], clamp);
		if (shine > 0) {
			const p = at(10, 1.5);
			if (p) {
				const R = p.s * (0.6 + 0.5 * shine);
				const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 2);
				g.addColorStop(0, `rgba(255,236,190,${0.55 * shine})`);
				g.addColorStop(0.35, `rgba(255,196,110,${0.22 * shine})`);
				g.addColorStop(1, 'rgba(255,160,60,0)');
				ctx.globalAlpha = 1;
				ctx.fillStyle = g;
				ctx.fillRect(p.x - R * 2, p.y - R * 2, R * 4, R * 4);
			}
		}
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
	});
	return (
		<>
			<Letters cam={cam} panels={RIDDLE_PANELS} which={RIDDLE_WHICH} read={read} show={o} />
			{fx}
		</>
	);
};
const RIDDLE_WHICH = [0, 1, 2, 3];
