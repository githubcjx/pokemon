import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender} from 'remotion';
import {CINZEL, SERIF} from '../../fonts';
import {bits, DOT_GAP} from './braille';
import {rng, sampleText} from './DotTitle';
import {DOORS_FRAG} from './gl4';
import {GLView} from './GLView';
import {FROST, GIGAS_MARKS} from './KeySeg';

/**
 * 《敬畏》视频封面（静帧）：16:9（1920×1080）、4:3（1440×1080）、3:4（1080×1440）。
 * 不直接露出宝可梦：神殿最深处那道石门虚掩着一条缝，金光从缝里漏出来、铺到地上，门楣上雷吉奇卡斯的七个点亮着 ——
 * 门后睡着什么，留给观众去猜。标题用片中的金色光点字《敬畏》+ AWE；
 * 钩子取开场点字里自相矛盾的两句：「一切都要感谢宝可梦」「但我们封印了它」，下面压一行真的点字（WE FEARED IT.）。
 */

type Layout = {
	W: number;
	H: number;
	/** 石门的取景（世界坐标：画面中心 x、y，画面纵向看到的高度） */
	view: [number, number, number];
	title: {cx: number; cy: number; size: number; step: number};
	awe: {top: number; size: number};
	hook: {top: number; size: number; align: 'center' | 'left'; x: number; w: number};
	braille: {x: number; y: number; cell: number};
	/** 标题区压暗：圆心与半径（相对画面） */
	shade: {x: number; y: number; rx: number; ry: number};
};

const ZERO4 = Array.from({length: 16}, () => 0);
const FAR4 = [100, 104, 108, 112].flatMap((x) => [x, 0, 0, 0]);

/** 光点字：等字体加载完再取样，画成发光的金点 */
const DotText: React.FC<{text: string; W: number; H: number; cx: number; cy: number; size: number; step: number}> = ({text, W, H, cx, cy, size, step}) => {
	const ref = useRef<HTMLCanvasElement>(null);
	const [pts, setPts] = useState<[number, number][] | null>(null);
	const [handle] = useState(() => delayRender('cover title'));
	useEffect(() => {
		const font = `900 ${size}px ${SERIF}`;
		document.fonts.load(font).then(() => {
			// sampleText 在 1920×1080 的画布上取样：先放在画布中间，再平移到目标位置
			const raw = sampleText(text, font, 960, 540, step, size * 0.18);
			setPts(raw.map(([x, y]) => [x - 960 + cx, y - 540 + cy]));
			continueRender(handle);
		});
	}, [text, size, step, cx, cy, handle]);
	useLayoutEffect(() => {
		const c = ref.current;
		if (!c || !pts) return;
		const ctx = c.getContext('2d')!;
		ctx.clearRect(0, 0, W, H);
		const r = rng(77);
		ctx.globalCompositeOperation = 'lighter';
		for (const [x, y] of pts) {
			const a = 0.75 + 0.25 * r();
			const s = step * (0.36 + 0.08 * r());
			const g = ctx.createRadialGradient(x, y, 0, x, y, s * 1.6);
			g.addColorStop(0, `rgba(255,244,214,${a})`);
			g.addColorStop(0.35, `rgba(255,206,120,${a * 0.85})`);
			g.addColorStop(1, 'rgba(255,160,60,0)');
			ctx.fillStyle = g;
			ctx.fillRect(x - s * 1.6, y - s * 1.6, s * 3.2, s * 3.2);
		}
		// 光点字周围一圈很淡的辉光
		ctx.globalCompositeOperation = 'source-over';
	});
	return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', left: 0, top: 0, width: W, height: H, filter: 'drop-shadow(0 0 18px rgba(255,170,70,0.45))'}} />;
};

/** 一行真的点字（英文一级点字），淡淡的金色 */
const BrailleRow: React.FC<{text: string; x: number; y: number; cell: number}> = ({text, x, y, cell}) => {
	const g = (cell * DOT_GAP) / 0.16;
	return (
		<svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
			{text.split('').flatMap((ch, i) => {
				const b = bits(ch);
				return [0, 1, 2, 3, 4, 5].map((k) => {
					const on = (b >> k) & 1;
					const cx = x + i * cell + (k < 3 ? -g / 2 : g / 2);
					const cy = y + (k % 3) * g;
					return on ? (
						<circle key={`${i}-${k}`} cx={cx} cy={cy} r={g * 0.32} fill="rgba(255,214,150,0.55)" style={{filter: 'drop-shadow(0 0 4px rgba(255,180,80,0.8))'}} />
					) : (
						<circle key={`${i}-${k}`} cx={cx} cy={cy} r={g * 0.22} fill="rgba(160,170,190,0.12)" />
					);
				});
			})}
		</svg>
	);
};

const Cover: React.FC<{L: Layout}> = ({L}) => {
	const {W, H} = L;
	// 门虚掩一条缝，金光从缝里漏出来；门楣上的七个点亮着
	const door = [0, 0.93, 1.4, 1.5];
	const glow = [1.0, 0.72, 0.35, 2.6];
	const uniforms = {uTime: 30, uView: L.view, uLayer: 0, uWallTint: FROST, 'uDoor[]': [...door, ...FAR4], 'uGlow[]': [...glow, ...ZERO4], 'uMarks[]': GIGAS_MARKS, uExposure: 1.8, uFade: 0};
	// 光点漂浮：门缝的光里有细细的尘
	const dust = (() => {
		const r = rng(486);
		const s = H / L.view[2];
		const dx = W / 2 + (0 - L.view[0]) * s;
		return Array.from({length: 70}, () => ({x: dx + (r() - 0.5) * s * 1.6 * (0.4 + r()), y: H / 2 - (r() * 2.4 - L.view[1]) * s, a: 0.2 + r() * 0.5, sz: 1 + r() * 2.2}));
	})();
	const t = L.title;
	return (
		<AbsoluteFill style={{background: '#05070a', overflow: 'hidden'}}>
			<GLView frag={DOORS_FRAG} width={W} height={H} uniforms={uniforms} />
			<GLView frag={DOORS_FRAG} width={W} height={H} uniforms={{...uniforms, uLayer: 1}} />
			{/* 门缝的光铺到地上、照进画面 */}
			<div style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', background: `radial-gradient(ellipse ${W * 0.16}px ${H * 0.55}px at ${W / 2 + ((0 - L.view[0]) * H) / L.view[2]}px ${H * 0.62}px, rgba(255,200,120,0.16), rgba(0,0,0,0) 100%)`}} />
			<svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
				{dust.map((d, i) => (
					<circle key={i} cx={d.x} cy={d.y} r={d.sz} fill={`rgba(255,226,170,${d.a})`} />
				))}
			</svg>
			{/* 标题区压暗 */}
			<div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse ${L.shade.rx * W}px ${L.shade.ry * H}px at ${L.shade.x * W}px ${L.shade.y * H}px, rgba(0,0,0,0.72), rgba(0,0,0,0) 100%)`}} />
			{/* 四周压暗 */}
			<div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 75% 75% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)'}} />
			<DotText text="敬畏" W={W} H={H} cx={t.cx} cy={t.cy} size={t.size} step={t.step} />
			<div style={{position: 'absolute', left: t.cx - 400, width: 800, top: L.awe.top, textAlign: 'center', fontFamily: CINZEL, fontWeight: 600, fontSize: L.awe.size, letterSpacing: L.awe.size * 0.62, paddingLeft: L.awe.size * 0.62, color: '#f1d9a6', textShadow: '0 0 18px rgba(255,180,80,0.55)'}}>
				AWE
			</div>
			<div style={{position: 'absolute', left: L.hook.x, width: L.hook.w, top: L.hook.top, textAlign: L.hook.align, fontFamily: SERIF, fontWeight: 600, fontSize: L.hook.size, lineHeight: 1.55, letterSpacing: L.hook.size * 0.12, color: '#efe3c8', textShadow: '0 0 14px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.9)'}}>
				<div>「一切都要感谢宝可梦」</div>
				<div style={{color: '#ffd68f', textShadow: '0 0 16px rgba(255,170,70,0.6), 0 0 4px rgba(0,0,0,0.9)'}}>「但我们封印了它」</div>
			</div>
			<BrailleRow text="WE FEARED IT." x={L.braille.x} y={L.braille.y} cell={L.braille.cell} />
		</AbsoluteFill>
	);
};

// 16:9：门在右，标题在左
const WIDE: Layout = {
	W: 1920,
	H: 1080,
	view: [-1.55, 1.45, 3.9],
	title: {cx: 560, cy: 380, size: 300, step: 12},
	awe: {top: 560, size: 54},
	hook: {top: 680, size: 48, align: 'center', x: 160, w: 800},
	braille: {x: 400, y: 880, cell: 26},
	shade: {x: 0.29, y: 0.55, rx: 0.36, ry: 0.55},
};
// 4:3：门在右，标题在左
const STANDARD: Layout = {
	W: 1440,
	H: 1080,
	view: [-1.15, 1.45, 3.9],
	title: {cx: 410, cy: 380, size: 250, step: 10},
	awe: {top: 540, size: 46},
	hook: {top: 650, size: 42, align: 'center', x: 50, w: 720},
	braille: {x: 255, y: 860, cell: 24},
	shade: {x: 0.28, y: 0.55, rx: 0.38, ry: 0.55},
};
// 3:4：标题在上，门在下
const PORTRAIT: Layout = {
	W: 1080,
	H: 1440,
	view: [0, 1.85, 6.2],
	title: {cx: 540, cy: 215, size: 250, step: 10},
	awe: {top: 345, size: 44},
	hook: {top: 1196, size: 46, align: 'center', x: 90, w: 900},
	braille: {x: 385, y: 1365, cell: 26},
	shade: {x: 0.5, y: 0.17, rx: 0.6, ry: 0.2},
};

export const RegiCoverWide: React.FC = () => <Cover L={WIDE} />;
export const RegiCoverStandard: React.FC = () => <Cover L={STANDARD} />;
export const RegiCoverPortrait: React.FC = () => <Cover L={PORTRAIT} />;
