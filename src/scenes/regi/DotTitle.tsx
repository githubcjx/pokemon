import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import {SERIF} from '../../fonts';
import {H, W} from './common';

/** 可复现的随机数 */
export const rng = (seed: number) => () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** 把一行字栅格化，按网格取点（字的笔画处） */
export function sampleText(text: string, font: string, cx: number, cy: number, step: number, tracking = 0): [number, number][] {
	const c = document.createElement('canvas');
	c.width = W;
	c.height = H;
	const ctx = c.getContext('2d')!;
	ctx.fillStyle = '#fff';
	ctx.font = font;
	ctx.textBaseline = 'middle';
	const chars = text.split('');
	const widths = chars.map((ch) => ctx.measureText(ch).width);
	const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
	let x = cx - total / 2;
	chars.forEach((ch, i) => {
		ctx.fillText(ch, x, cy);
		x += widths[i] + tracking;
	});
	const img = ctx.getImageData(0, 0, W, H).data;
	const pts: [number, number][] = [];
	for (let y = step / 2; y < H; y += step) {
		for (let xx = step / 2; xx < W; xx += step) {
			const i = (Math.round(y) * W + Math.round(xx)) * 4;
			if (img[i + 3] > 140) pts.push([xx, y]);
		}
	}
	return pts;
}

const sprite = (() => {
	let cache: HTMLCanvasElement | null = null;
	return () => {
		if (cache) return cache;
		const s = document.createElement('canvas');
		s.width = s.height = 48;
		const g = s.getContext('2d')!;
		const grd = g.createRadialGradient(24, 24, 0, 24, 24, 24);
		grd.addColorStop(0, 'rgba(255,236,190,1)');
		grd.addColorStop(0.12, 'rgba(255,205,120,0.95)');
		grd.addColorStop(0.35, 'rgba(255,170,70,0.28)');
		grd.addColorStop(1, 'rgba(255,150,50,0)');
		g.fillStyle = grd;
		g.fillRect(0, 0, 48, 48);
		cache = s;
		return s;
	};
})();

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * 点阵片名：海里漂着的光点一颗颗游过来，排成字的笔画，变成金色。
 * start：开始聚拢的帧；each：每颗点飞行的帧数；spread：各点出发的先后跨度
 */
export const DotTitle: React.FC<{f: number; start: number; text: string; cy: number; size: number; tracking?: number; step?: number; opacity?: number; each?: number; spread?: number}> = ({
	f,
	start,
	text,
	cy,
	size,
	tracking = 0,
	step = 11,
	opacity = 1,
	each = 70,
	spread = 60,
}) => {
	const ref = useRef<HTMLCanvasElement>(null);
	const [pts, setPts] = useState<[number, number][] | null>(null);
	const [handle] = useState(() => delayRender('DotTitle font'));
	useEffect(() => {
		const font = `900 ${size}px ${SERIF}`;
		document.fonts.load(font).then(() => {
			setPts(sampleText(text, font, W / 2, cy, step, tracking));
			continueRender(handle);
		});
	}, [text, size, cy, step, tracking, handle]);

	const parts = useMemo(() => {
		if (!pts) return [];
		const r = rng(1234);
		return pts.map((t) => {
			// 从画面四处、略偏下方出发（像海雪被吸上来）
			const sx = r() * W;
			const sy = H * (0.15 + r() * 1.0);
			return {t, s: [sx, sy] as [number, number], d: r() * spread, ph: r() * 6.28, sz: 0.75 + r() * 0.5};
		});
	}, [pts, spread]);

	useLayoutEffect(() => {
		const c = ref.current;
		if (!c) return;
		const ctx = c.getContext('2d')!;
		ctx.clearRect(0, 0, W, H);
		if (f < start - 20) return;
		const spr = sprite();
		ctx.globalCompositeOperation = 'lighter';
		for (const p of parts) {
			const k = Math.min(Math.max((f - start - p.d) / each, 0), 1);
			const e = ease(k);
			// 出发前在原地慢慢漂
			const drift = (f - start) * 0.25;
			const sx = p.s[0] + Math.sin(f * 0.03 + p.ph) * 6;
			const sy = p.s[1] - drift;
			// 弧线：中途向一侧绕
			const bend = Math.sin(e * Math.PI) * 60 * Math.sin(p.ph);
			const x = sx + (p.t[0] - sx) * e + bend;
			const y = sy + (p.t[1] - sy) * e;
			const appear = Math.min(Math.max((f - start + 20) / 20, 0), 1);
			const settled = k >= 1 ? 1 : 0;
			const pulse = 0.85 + 0.15 * Math.sin(f * 0.08 + p.ph);
			const a = opacity * appear * (0.35 + 0.65 * e) * (settled ? pulse : 1);
			const s = (k < 1 ? 14 : 18) * p.sz;
			ctx.globalAlpha = a;
			ctx.drawImage(spr, x - s / 2, y - s / 2, s, s);
		}
		ctx.globalAlpha = 1;
	});

	return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', left: 0, top: 0, width: W, height: H}} />;
};
