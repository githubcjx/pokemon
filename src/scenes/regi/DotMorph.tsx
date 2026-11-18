import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import {SERIF} from '../../fonts';
import {H, W} from './common';
import {rng, sampleText} from './DotTitle';
import {Pt} from './shapes';

/**
 * 一群金色光点在几种图形之间流转：点阵片名 → 大陆 → 图鉴 → ……
 * 第 0 幕固定是片名，聚拢的写法和 DotTitle 完全一致（第 1 段已按它渲染）；之后各幕由 stages 给出。
 *
 * 每一幕：at 开始，各点按 spread 内的随机先后出发，用 dur 帧飞到新位置。
 * pts(f) 可以随时间变化（例如大陆被绳子拖动），alpha / size 可以逐点给。
 * 某一幕的点比光点少时，多出来的光点隐身（alpha 0），停在随机一个点上。
 */
export type Stage = {
	at: number;
	dur: number;
	spread: number;
	pts: (f: number) => Pt[];
	alpha?: (i: number, f: number) => number;
	size?: (i: number, f: number) => number;
	/** 颜色：0 金、1 青、2 玫红 */
	color?: (i: number, f: number) => number;
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const hash = (i: number) => {
	const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

const SPRITE_COLS: [string, string, string, string][] = [
	['rgba(255,236,190,1)', 'rgba(255,205,120,0.95)', 'rgba(255,170,70,0.28)', 'rgba(255,150,50,0)'],
	['rgba(210,255,250,1)', 'rgba(110,235,230,0.95)', 'rgba(60,200,210,0.3)', 'rgba(40,180,200,0)'],
	['rgba(255,220,230,1)', 'rgba(255,140,170,0.95)', 'rgba(240,90,130,0.3)', 'rgba(230,70,120,0)'],
];
const sprites = (() => {
	let cache: HTMLCanvasElement[] | null = null;
	return () => {
		if (cache) return cache;
		cache = SPRITE_COLS.map((cs) => {
			const s = document.createElement('canvas');
			s.width = s.height = 48;
			const g = s.getContext('2d')!;
			const grd = g.createRadialGradient(24, 24, 0, 24, 24, 24);
			grd.addColorStop(0, cs[0]);
			grd.addColorStop(0.12, cs[1]);
			grd.addColorStop(0.35, cs[2]);
			grd.addColorStop(1, cs[3]);
			g.fillStyle = grd;
			g.fillRect(0, 0, 48, 48);
			return s;
		});
		return cache;
	};
})();

export const DotMorph: React.FC<{
	f: number;
	title: {start: number; text: string; cy: number; size: number; tracking: number; step: number; each: number; spread: number};
	stages: Stage[];
	count: number;
	/** 额外画在光点之下的东西（绳子等），与光点共用画布 */
	under?: (ctx: CanvasRenderingContext2D, pos: (i: number) => Pt) => void;
}> = ({f, title, stages, count, under}) => {
	const ref = useRef<HTMLCanvasElement>(null);
	const [tp, setTp] = useState<Pt[] | null>(null);
	const [handle] = useState(() => delayRender('DotMorph font'));
	useEffect(() => {
		const font = `900 ${title.size}px ${SERIF}`;
		document.fonts.load(font).then(() => {
			setTp(sampleText(title.text, font, W / 2, title.cy, title.step, title.tracking));
			continueRender(handle);
		});
	}, [title.text, title.size, title.cy, title.step, title.tracking, handle]);

	// 片名幕：与 DotTitle 相同的随机序列
	const tparts = useMemo(() => {
		if (!tp) return [];
		const r = rng(1234);
		return tp.map((t) => {
			const sx = r() * W;
			const sy = H * (0.15 + r() * 1.0);
			return {t, s: [sx, sy] as Pt, d: r() * title.spread, ph: r() * 6.28, sz: 0.75 + r() * 0.5};
		});
	}, [tp, title.spread]);

	useLayoutEffect(() => {
		const c = ref.current;
		if (!c) return;
		const ctx = c.getContext('2d')!;
		ctx.clearRect(0, 0, W, H);
		if (!tp || f < title.start - 20) return;
		const spr = sprites();
		const nT = tparts.length;

		/** 片名幕的状态（与 DotTitle 一致） */
		type Q = {p: Pt; a: number; s: number; c?: number};
		const titleState = (i: number): Q => {
			if (i >= nT) {
				const h = hash(i);
				return {p: [h * W, H * (0.2 + hash(i + 9) * 0.9)], a: 0, s: 14};
			}
			const p = tparts[i];
			const k = clamp01((f - title.start - p.d) / title.each);
			const e = ease(k);
			const drift = (f - title.start) * 0.25;
			const sx = p.s[0] + Math.sin(f * 0.03 + p.ph) * 6;
			const sy = p.s[1] - drift;
			const bend = Math.sin(e * Math.PI) * 60 * Math.sin(p.ph);
			const x = sx + (p.t[0] - sx) * e + bend;
			const y = sy + (p.t[1] - sy) * e;
			const appear = clamp01((f - title.start + 20) / 20);
			const pulse = 0.85 + 0.15 * Math.sin(f * 0.08 + p.ph);
			const a = appear * (0.35 + 0.65 * e) * (k >= 1 ? pulse : 1);
			return {p: [x, y], a, s: (k < 1 ? 14 : 18) * p.sz};
		};
		const sz = (i: number) => (i < nT ? tparts[i].sz : 0.75 + hash(i + 3) * 0.5);
		const ph = (i: number) => (i < nT ? tparts[i].ph : hash(i + 5) * 6.28);

		const ptsCache = new Map<number, Pt[]>();
		const stageState = (si: number, i: number): Q => {
			const st = stages[si];
			let pts = ptsCache.get(si);
			if (!pts) {
				pts = st.pts(f);
				ptsCache.set(si, pts);
			}
			const n = pts.length;
			const p = i < n ? pts[i] : pts[Math.floor(hash(i + 1) * n) % n];
			const pulse = 0.85 + 0.15 * Math.sin(f * 0.08 + ph(i));
			const a = (i < n ? (st.alpha ? st.alpha(i, f) : 1) : 0) * pulse;
			const s = 18 * sz(i) * (st.size ? st.size(i, f) : 1);
			return {p: [p[0] + Math.sin(f * 0.031 + ph(i)) * 1.5, p[1] + Math.cos(f * 0.027 + ph(i)) * 1.5], a, s, c: st.color ? st.color(i, f) : 0};
		};

		const at = (i: number): Q => {
			let si = -1;
			for (let k = 0; k < stages.length; k++) if (f >= stages[k].at) si = k;
			if (si < 0) return titleState(i);
			const st = stages[si];
			const from = si === 0 ? titleState(i) : stageState(si - 1, i);
			const to = stageState(si, i);
			const k = clamp01((f - st.at - hash(i + 11) * st.spread) / st.dur);
			const e = ease(k);
			const bend = Math.sin(e * Math.PI) * 40 * Math.sin(ph(i) * 1.7);
			return {
				p: [from.p[0] + (to.p[0] - from.p[0]) * e + bend, from.p[1] + (to.p[1] - from.p[1]) * e],
				a: from.a + (to.a - from.a) * e,
				s: from.s + (to.s - from.s) * e,
				c: e < 0.5 ? from.c : to.c,
			};
		};

		const cache: (Q | undefined)[] = [];
		const get = (i: number) => (cache[i] ??= at(i));
		if (under) under(ctx, (i) => get(i).p);
		ctx.globalCompositeOperation = 'lighter';
		for (let i = 0; i < count; i++) {
			const q = get(i);
			if (q.a <= 0.004) continue;
			ctx.globalAlpha = Math.min(q.a, 1);
			const sp = spr[q.c ?? 0];
			ctx.drawImage(sp, q.p[0] - q.s / 2, q.p[1] - q.s / 2, q.s, q.s);
			// 特别亮的点（alpha > 1）再叠一圈大光晕
			if (q.a > 1.05) {
				const g = q.s * 2.6;
				ctx.globalAlpha = Math.min(q.a - 1, 1) * 0.6;
				ctx.drawImage(sp, q.p[0] - g / 2, q.p[1] - g / 2, g, g);
			}
		}
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
	});

	return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', left: 0, top: 0, width: W, height: H}} />;
};
