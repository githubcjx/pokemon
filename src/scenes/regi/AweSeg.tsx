import {useLayoutEffect, useRef} from 'react';
import {interpolate, staticFile} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {Cam, H, project, T, track, W} from './common';
import {TrainerSilhouette} from './DoorsSeg';
import {rng} from './DotTitle';
import {FROST, GIGAS_MARKS, OneDoor} from './KeySeg';

/**
 * 第 8 段 · 敬畏。
 * 石室：右列的"WE OWE ALL TO THE POKEMON."（敬）和"WE FEARED IT."（畏）一起亮起，左边浮出两个大字 → 合成"敬畏" → 天平。
 * 之后：套着圆环的雷吉艾勒奇 → 伽勒尔夜里的城市（画布程序生成）和洛兹的剪影 → 闇夜的黑红漩涡 → 古人留下的那扇门（接第 9 段）。
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

// ── 石室里的敬与畏 ──
export const HALL_CAM_F: [number, number[]][] = [
	[T.awe, [0, 2.6, 6.8, 0, 0, 52]],
	[T.pair, [2.2, 3.4, 3.9, 0, 0, 44]],
	[T.aweWord, [2.15, 3.4, 3.8, 0, 0, 44]],
	[T.lock, [1.6, 3.3, 4.6, 0, 0, 46]],
];
/** 这一段里各块石板的光：只留"感谢"（1）和"害怕"（3）两块 */
export const hotF = (f: number): number[] => {
	const k = interpolate(f, [T.pair - 10, T.pair + 20], [0, 1], clamp);
	const lo = 0.25 - 0.13 * k;
	const hi = 0.5 + 0.8 * k;
	return [lo, hi, lo, hi, lo, lo, lo];
};
export const hallFOpacity = (f: number) => interpolate(f, [T.lock - 10, T.lock + 30], [1, 0], clamp);

/** 敬、畏两个大字：先各自贴在石板旁边，再合成"敬畏"，最后变成天平的两端 */
export const AweWords: React.FC<{f: number; cam: Cam}> = ({f, cam}) => {
	if (f < T.virtue - 4 || f > T.lock + 40) return null;
	const pin = (y: number) => project(cam, [0.35, y, 0.05])!;
	const a0 = pin(4.1);
	const b0 = pin(2.72);
	const join = ease(interpolate(f, [T.aweWord, T.aweWord + 40], [0, 1], clamp));
	const beam = ease(interpolate(f, [T.balance - 10, T.balance + 30], [0, 1], clamp));
	// 天平：先是"畏"那头沉（古时候），之后慢慢翘起来
	const tilt = (beam * (12 - 22 * ease(interpolate(f, [T.balance + 30, T.lock - 10], [0, 1], clamp))) * Math.PI) / 180;
	const C = {x: 960, y: 470};
	const L = 300 * beam;
	const endA = {x: C.x - Math.cos(tilt) * L, y: C.y - Math.sin(tilt) * L};
	const endB = {x: C.x + Math.cos(tilt) * L, y: C.y + Math.sin(tilt) * L};
	const joinA = {x: 960 - 120, y: 460};
	const joinB = {x: 960 + 120, y: 460};
	const posA = beam > 0 ? {x: joinA.x + (endA.x - joinA.x) * beam, y: joinA.y + (endA.y - 120 - joinA.y) * beam} : {x: a0.x + (joinA.x - a0.x) * join, y: a0.y + (joinA.y - a0.y) * join};
	const posB = beam > 0 ? {x: joinB.x + (endB.x - joinB.x) * beam, y: joinB.y + (endB.y - 120 - joinB.y) * beam} : {x: b0.x + (joinB.x - b0.x) * join, y: b0.y + (joinB.y - b0.y) * join};
	const inA = interpolate(f, [T.virtue + 4, T.virtue + 24], [0, 1], clamp);
	const inB = interpolate(f, [T.virtue + 40, T.virtue + 60], [0, 1], clamp);
	const out = interpolate(f, [T.lock - 10, T.lock + 30], [1, 0], clamp);
	const dim = interpolate(f, [T.aweWord, T.aweWord + 40], [0, 0.62], clamp) * out;
	const size = 210 - 30 * join;
	const word = (ch: string, p: {x: number; y: number}, o: number, col: string, glow: string) => (
		<div style={{position: 'absolute', left: p.x - 200, top: p.y - size * 0.62, width: 400, textAlign: 'center', opacity: o * out, fontFamily: SERIF, fontWeight: 600, fontSize: size, lineHeight: 1.2, color: col, textShadow: `0 0 28px ${glow}, 0 0 6px rgba(0,0,0,0.9)`}}>{ch}</div>
	);
	return (
		<>
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, background: '#000', opacity: dim}} />
			{beam > 0 ? (
				<svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, opacity: out * beam}}>
					<g stroke="#e9c98c" strokeWidth={3} fill="none" strokeLinecap="round" style={{filter: 'drop-shadow(0 0 6px rgba(255,180,80,0.8))'}}>
						<line x1={endA.x} y1={endA.y} x2={endB.x} y2={endB.y} />
						<polygon points={`${C.x},${C.y} ${C.x - 34},${C.y + 70} ${C.x + 34},${C.y + 70}`} />
						<line x1={C.x - 90} y1={C.y + 70} x2={C.x + 90} y2={C.y + 70} />
						<line x1={endA.x} y1={endA.y} x2={endA.x} y2={endA.y - 40} />
						<line x1={endB.x} y1={endB.y} x2={endB.x} y2={endB.y - 40} />
					</g>
				</svg>
			) : null}
			{word('敬', posA, inA, '#f3d9a2', 'rgba(255,180,80,0.65)')}
			{word('畏', posB, inB, '#cdd8e6', 'rgba(140,170,220,0.55)')}
		</>
	);
};

// ── 套着圆环的雷吉艾勒奇 ──
export const LockedEleki: React.FC<{f: number}> = ({f}) => {
	const o = interpolate(f, [T.lock - 6, T.lock + 30, T.rose - 10, T.rose + 24], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	const url = `url(${staticFile('pokemon/regieleki/rings.png')})`;
	const pulse = 0.7 + 0.3 * Math.sin(f * 0.13);
	const flick = 0.55 + 0.15 * Math.sin(f * 1.3) * Math.sin(f * 0.41);
	const S = 760;
	const x = 960;
	const y = 470;
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: o}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, background: 'radial-gradient(ellipse 45% 40% at 50% 45%, rgba(60,55,20,0.5), rgba(0,0,0,0.95) 70%)'}} />
			<PokemonArt3D
				dir="pokemon/regieleki"
				x={x}
				y={y}
				size={S}
				depthScale={0.5}
				ambient={[0.25, 0.25, 0.22]}
				dirLights={[
					{dir: [-1, -0.2, 0.35], color: [1.0 * flick, 0.9 * flick, 0.35 * flick], wrap: 0.35},
					{dir: [1, -0.1, 0.35], color: [0.7 * flick, 0.62 * flick, 0.25 * flick], wrap: 0.35},
				]}
				emissive={0.2}
				emissiveTint={[1.0, 0.95, 0.6]}
				rim={{dir: [-0.6, -0.8], color: [1.4, 1.25, 0.4], power: 2.4}}
				brightness={0.85}
			/>
			{/* 圆环：金色的锁 */}
			<div style={{position: 'absolute', left: x - S / 2, top: y - S / 2, width: S, height: S, WebkitMaskImage: url, WebkitMaskSize: '100% 100%', maskImage: url, maskSize: '100% 100%', background: 'rgba(255,205,110,0.95)', mixBlendMode: 'screen', opacity: 0.55 * pulse, filter: 'drop-shadow(0 0 10px rgba(255,190,90,0.9))'}} />
		</div>
	);
};

// ── 伽勒尔夜里的城市 ──
type Bld = {x: number; w: number; h: number; layer: number; win: {x: number; y: number; ph: number; on: number}[]};
const CITY: Bld[] = (() => {
	const r = rng(1000);
	const out: Bld[] = [];
	for (const layer of [0, 1, 2]) {
		let x = -40;
		while (x < W + 40) {
			const w = 40 + r() * (layer === 2 ? 110 : 80);
			const h = (layer === 0 ? 120 : layer === 1 ? 190 : 150) + r() * (layer === 0 ? 160 : layer === 1 ? 260 : 200);
			const win: Bld['win'] = [];
			const cols = Math.floor(w / 14);
			const rows = Math.floor(h / 18);
			for (let i = 0; i < cols; i++)
				for (let j = 0; j < rows; j++) if (r() < (layer === 2 ? 0.35 : 0.22)) win.push({x: 6 + i * 14, y: 10 + j * 18, ph: r() * 6.28, on: r()});
			out.push({x, w, h, layer, win});
			x += w + (layer === 2 ? 6 : 2) + r() * 12;
		}
	}
	return out;
})();
const BASE_Y = [760, 840, 960];
const TOWER = {x: 820, w: 70, h: 560};

export const cityOpacity = (f: number) => interpolate(f, [T.rose - 10, T.rose + 30, T.lesson + 60, T.lesson + 100], [0, 1, 1, 0], clamp);
/** 闇夜：灯一片片灭掉，天空发红，城市上空出现黑红色的漩涡 */
const darkK = (f: number) => interpolate(f, [T.dark + 10, T.dark + 90], [0, 1], clamp);

export const GalarCity: React.FC<{f: number}> = ({f}) => {
	const o = cityOpacity(f);
	const dk = darkK(f);
	const cv = useCanvas((ctx) => {
		if (o <= 0) return;
		// 天空
		const sky = ctx.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, `rgb(${6 + 30 * dk},${8 - 4 * dk},${22 - 12 * dk})`);
		sky.addColorStop(0.65, `rgb(${30 + 60 * dk},${26 - 10 * dk},${50 - 30 * dk})`);
		sky.addColorStop(1, `rgb(${70 + 40 * dk},${45 - 20 * dk},${40 - 25 * dk})`);
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, W, H);
		// 闇夜的漩涡
		if (dk > 0) {
			const cx = TOWER.x + TOWER.w / 2;
			const cy = 170;
			ctx.save();
			ctx.translate(cx, cy);
			for (let i = 0; i < 9; i++) {
				const R = (90 + i * 46) * (0.4 + 0.6 * dk);
				ctx.rotate(0.35 + f * 0.004);
				const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
				g.addColorStop(0, `rgba(10,0,4,${0.55 * dk})`);
				g.addColorStop(0.7, `rgba(${120 + i * 8},10,20,${0.16 * dk})`);
				g.addColorStop(1, 'rgba(0,0,0,0)');
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.ellipse(0, 0, R * 1.5, R * 0.55, 0, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
			// 塔顶升起的红光
			const beam = ctx.createLinearGradient(0, cy, 0, H - TOWER.h);
			beam.addColorStop(0, `rgba(255,40,40,${0.0})`);
			beam.addColorStop(1, `rgba(255,60,50,${0.45 * dk})`);
			ctx.fillStyle = beam;
			ctx.fillRect(cx - 10, cy, 20, H - TOWER.h - cy);
		}
		// 楼和窗
		CITY.forEach((b) => {
			const base = BASE_Y[b.layer];
			const top = base - b.h;
			const shade = b.layer === 0 ? 14 : b.layer === 1 ? 10 : 6;
			ctx.fillStyle = `rgb(${shade + 4 * dk},${shade},${shade + 10 - 6 * dk})`;
			ctx.fillRect(b.x, top, b.w, H - top);
			b.win.forEach((w) => {
				// 闇夜时按顺序熄灭
				const off = interpolate(dk, [w.on * 0.8, w.on * 0.8 + 0.2], [1, 0], clamp);
				const a = (b.layer === 0 ? 0.35 : b.layer === 1 ? 0.55 : 0.8) * (0.8 + 0.2 * Math.sin(f * 0.05 + w.ph)) * off;
				if (a <= 0.01) return;
				ctx.fillStyle = `rgba(255,${200 + 20 * Math.sin(w.ph)},${120 + 30 * Math.cos(w.ph)},${a})`;
				ctx.fillRect(b.x + w.x, top + w.y, 6, 9);
			});
		});
		// 中间的高塔（能源塔）
		ctx.fillStyle = 'rgb(9,9,14)';
		ctx.beginPath();
		ctx.moveTo(TOWER.x, H);
		ctx.lineTo(TOWER.x + 12, H - TOWER.h);
		ctx.lineTo(TOWER.x + TOWER.w - 12, H - TOWER.h);
		ctx.lineTo(TOWER.x + TOWER.w, H);
		ctx.fill();
		const lamp = (1 - dk) * (0.7 + 0.3 * Math.sin(f * 0.08)) + dk;
		const g = ctx.createRadialGradient(TOWER.x + TOWER.w / 2, H - TOWER.h, 0, TOWER.x + TOWER.w / 2, H - TOWER.h, 120);
		g.addColorStop(0, dk > 0.5 ? `rgba(255,70,60,${0.9 * lamp})` : `rgba(255,220,150,${0.9 * lamp})`);
		g.addColorStop(1, 'rgba(255,120,60,0)');
		ctx.fillStyle = g;
		ctx.fillRect(TOWER.x - 100, H - TOWER.h - 120, TOWER.w + 200, 240);
		// 城市的光晕
		const haze = ctx.createLinearGradient(0, 600, 0, H);
		haze.addColorStop(0, 'rgba(255,170,90,0)');
		haze.addColorStop(1, `rgba(${255},${150 - 90 * dk},${80 - 50 * dk},${0.22 * (1 - 0.5 * dk)})`);
		ctx.fillStyle = haze;
		ctx.fillRect(0, 600, W, H - 600);
	});
	if (o <= 0) return null;
	const h = 900;
	const roseO = interpolate(f, [T.rose + 4, T.rose + 40, T.lesson + 40, T.lesson + 80], [0, 1, 1, 0], clamp);
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: o}}>
			{cv}
			{/* 洛兹：剪影，城市的暖光从左边来，闇夜时变红 */}
			<TrainerSilhouette file="trainers/rose/swsh.png" x={1530} top={1080 - h + 40} h={h} aspect={602 / 1600} o={roseO} from="left" rgb={dk > 0.5 ? '255,110,90' : '255,205,150'} lift={0.15} />
		</div>
	);
};

// ── 古人留下的那扇门（第 8 段结尾 → 第 9 段：门前、推进门里；最后再从外面看敞开的门） ──
export const doorFOpacity = (f: number) =>
	interpolate(f, [T.lesson + 56, T.lesson + 100], [0, 1], clamp) * interpolate(f, [T.before + 36, T.before + 70], [1, 0], clamp) + interpolate(f, [T.dread - 40, T.dread], [0, 1], clamp);
/** 七个记号：说到力量、耐心、爱与希望时各亮一下 */
const markPulse = (f: number) =>
	[T.seek + 14, T.seek + 44, T.seek + 78].reduce((a, t) => a + interpolate(f, [t, t + 6, t + 30], [0, 0.6, 0], clamp), 0) + interpolate(f, [T.seek + 100, T.before], [0, 0.3], clamp);
export const AncientDoor: React.FC<{f: number; layer: 0 | 1}> = ({f, layer}) => {
	const o = doorFOpacity(f);
	if (o <= 0) return null;
	const final = f >= T.dread - 40;
	const z = final ? track(f, [[T.dread - 40, 4.7], [T.endG, 4.2]]) : track(f, [[T.lesson + 56, 3.9], [T.endF, 3.5], [T.before - 6, 3.25], [T.before + 64, 1.3]]);
	const y = final ? 1.1 : 1.35;
	const open = final ? 1 : track(f, [[T.before - 8, 0], [T.before + 40, 1]]);
	const seam = (0.9 + 0.1 * Math.sin(f * 0.07)) * (1 - open);
	const mark = final ? 1.25 : 0.85 + markPulse(f);
	const glow = final ? 1.7 + 0.15 * Math.sin(f * 0.11) : 0.3 + open * 1.4;
	return <OneDoor f={f} view={[0, y, z]} o={Math.min(o, 1)} door={[0, 1 - open, seam, mark]} glow={[1.0, 0.72, 0.35, glow]} marks={GIGAS_MARKS} layer={layer} tint={FROST} />;
};
