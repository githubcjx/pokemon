import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import {H, W} from './common';
import {rng} from './DotTitle';
import {Pt} from './shapes';

/** 立绘不透明区域的取样点（立绘 UV，0–1），按 n×n 网格 */
export function useArtMask(dir: string, n = 90): Pt[] | null {
	const [pts, setPts] = useState<Pt[] | null>(null);
	const [handle] = useState(() => delayRender(`mask ${dir}`));
	useEffect(() => {
		const img = new Image();
		img.onload = () => {
			const c = document.createElement('canvas');
			c.width = c.height = n;
			const ctx = c.getContext('2d')!;
			ctx.drawImage(img, 0, 0, n, n);
			const d = ctx.getImageData(0, 0, n, n).data;
			const out: Pt[] = [];
			for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (d[(y * n + x) * 4 + 3] > 200) out.push([(x + 0.5) / n, (y + 0.5) / n]);
			setPts(out);
			continueRender(handle);
		};
		img.src = staticFile(`${dir}/art.png`);
	}, [dir, n, handle]);
	return pts;
}

/** 立绘 UV → 屏幕（PokemonArt3D 以 x、y 为中心，边长 size） */
export const artToScreen = (uv: Pt, x: number, y: number, size: number): Pt => [x - size / 2 + uv[0] * size, y - size / 2 + uv[1] * size];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * 碎石从地层各处飞出，拼成巨人的轮廓。
 * sources：每块碎石出发的位置和颜色；target：立绘摆放（中心、边长）
 */
export const RockAssembly: React.FC<{
	f: number;
	mask: Pt[] | null;
	start: number;
	dur: number;
	spread: number;
	fadeAt: [number, number];
	target: {x: number; y: number; size: number};
	sources: {p: Pt; col: string}[];
}> = ({f, mask, start, dur, spread, fadeAt, target, sources}) => {
	const ref = useRef<HTMLCanvasElement>(null);
	const chunks = useMemo(() => {
		if (!mask) return [];
		const r = rng(4242);
		return sources.map((s) => {
			const uv = mask[Math.floor(r() * mask.length)];
			const nv = 5 + Math.floor(r() * 3);
			const rad = 9 + r() * 16;
			const shape = Array.from({length: nv}, (_, k) => {
				const a = (k / nv) * Math.PI * 2 + r() * 0.5;
				const rr = rad * (0.65 + r() * 0.45);
				return [Math.cos(a) * rr, Math.sin(a) * rr] as Pt;
			});
			return {uv, shape, d: r() * spread, spin: (r() - 0.5) * 6, src: s};
		});
	}, [mask, sources, spread]);

	useLayoutEffect(() => {
		const c = ref.current;
		if (!c) return;
		const ctx = c.getContext('2d')!;
		ctx.clearRect(0, 0, W, H);
		if (f < start || f > fadeAt[1]) return;
		const fade = 1 - Math.min(Math.max((f - fadeAt[0]) / (fadeAt[1] - fadeAt[0]), 0), 1);
		for (const ch of chunks) {
			const k = Math.min(Math.max((f - start - ch.d) / dur, 0), 1);
			if (k <= 0) continue;
			const e = ease(k);
			const to = artToScreen(ch.uv, target.x, target.y, target.size);
			const x = ch.src.p[0] + (to[0] - ch.src.p[0]) * e;
			const y = ch.src.p[1] + (to[1] - ch.src.p[1]) * e - Math.sin(e * Math.PI) * 120;
			const rot = ch.spin * (1 - e);
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(rot);
			ctx.globalAlpha = fade * Math.min(k * 4, 1);
			ctx.beginPath();
			ch.shape.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy)));
			ctx.closePath();
			ctx.fillStyle = ch.src.col;
			ctx.fill();
			// 迎光的一边亮、背光的一边暗
			ctx.strokeStyle = 'rgba(255,214,150,0.35)';
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.restore();
		}
		ctx.globalAlpha = 1;
	});
	return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', left: 0, top: 0, width: W, height: H}} />;
};
