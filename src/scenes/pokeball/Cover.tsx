import {AbsoluteFill, Img, staticFile} from 'remotion';
import {CINZEL, SERIF} from '../../fonts';
import {COLORS} from '../../theme';
import {gold, HisuiBall} from './Part1Layers';
import {Backdrop, GOLD_TEXT, ModernBall} from './ui';

/**
 * 《人造容器》视频封面（静帧）：16:9（1920×1080）、4:3（1440×1080）、3:4（1080×1440）。
 * 沿用片名段的"古籍插图"：现代精灵球在中央，外面是那张精灵球线描结构图（外壳轮廓、十字构造线、刻度、按钮两圈）；
 * 赤道缝向两侧延伸成一条时间轴，左边是洗翠时代的手工精灵球，右边是现代的大师球。
 * 标题《人造容器》+ 片尾的提问「一颗精灵球，到底装着什么？」。
 */

type P = {x: number; y: number};
type Layout = {
	W: number;
	H: number;
	/** 中央现代精灵球 */
	hero: P & {r: number};
	/** 线描结构图的外圈半径 */
	bp: number;
	/** 时间轴两端的球：洗翠精灵球、大师球 */
	left: P & {s: number};
	right: P & {s: number};
	/** 时间轴：画在 y 处，从 x0 到 x1 */
	axis: {y: number; x0: number; x1: number};
	title: {top: number; size: number; hook: number; en: number};
	/** 标题区的压暗方向 */
	shade: 'top' | 'bottom';
	fig: P;
};

const F = 3000; // 背景着色器取的时间点（只影响烟雾纹理）

const BallOnAxis: React.FC<{kind: 'hisui' | 'master'; p: P & {s: number}; zh: string; en: string}> = ({kind, p, zh, en}) => (
	<>
		<div style={{position: 'absolute', left: p.x - p.s * 0.9, top: p.y - p.s * 0.9, width: p.s * 1.8, height: p.s * 1.8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,214,150,0.22) 0%, rgba(0,0,0,0) 65%)'}} />
		{kind === 'hisui' ? (
			<HisuiBall x={p.x} y={p.y} scale={p.s} glow={0.25} />
		) : (
			<div style={{position: 'absolute', left: p.x - p.s / 2, top: p.y - p.s / 2, width: p.s, height: p.s, filter: 'drop-shadow(0 0 16px rgba(190,140,255,0.35)) drop-shadow(0 6px 6px rgba(0,0,0,0.7))'}}>
				<Img src={staticFile('items/masterball.png')} style={{width: p.s, height: p.s}} />
			</div>
		)}
		<div style={{position: 'absolute', left: p.x - 200, width: 400, top: p.y + p.s * 0.62, textAlign: 'center'}}>
			<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: Math.round(p.s * 0.16), letterSpacing: Math.round(p.s * 0.05), color: COLORS.parchment, textShadow: '0 0 12px rgba(0,0,0,0.95)'}}>{zh}</div>
			<div style={{fontFamily: CINZEL, fontSize: Math.round(p.s * 0.075), letterSpacing: 4, color: gold(0.6), marginTop: 4}}>{en}</div>
		</div>
	</>
);

const Cover: React.FC<{L: Layout}> = ({L}) => {
	const {W, H, hero, bp} = L;
	// 1920×1080 的背景着色器铺满画面（等比放大、居中裁切），光斑和刻度环对准中央的球
	const k = Math.max(W / 1920, H / 1080);
	const ox = (W - 1920 * k) / 2;
	const oy = (H - 1080 * k) / 2;
	const cx = (hero.x - ox) / k;
	const cy = (hero.y - oy) / k;
	const at = (deg: number, r: number): P => ({x: hero.x + r * Math.cos((deg * Math.PI) / 180), y: hero.y + r * Math.sin((deg * Math.PI) / 180)});
	const line = gold(0.5);
	const t = L.title;
	return (
		<AbsoluteFill style={{background: '#090603', overflow: 'hidden'}}>
			<div style={{position: 'absolute', left: ox, top: oy, width: 1920, height: 1080, transform: `scale(${k})`, transformOrigin: '0 0'}}>
				<Backdrop
					f={F}
					s={{spot: [cx / 1920, cy / 1080], spotR: 0.42, spotAmt: 1.1, ringC: [cx, cy], ringR: (bp * 1.25) / k, rings: 0.75, ringRot: 0.4, floorY: 0, floor: 0, bright: 1}}
				/>
			</div>

			{/* 线描结构图 */}
			<svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
				<g fill="none" strokeLinecap="round">
					<circle cx={hero.x} cy={hero.y} r={bp} stroke={gold(0.6)} strokeWidth={1.6} />
					<circle cx={hero.x} cy={hero.y} r={bp * 0.85} stroke={gold(0.34)} strokeWidth={1} strokeDasharray="4 7" />
					<path d={`M ${hero.x} ${hero.y - bp - 50} L ${hero.x} ${hero.y + bp + 40}`} stroke={gold(0.22)} strokeWidth={1} strokeDasharray="10 6 2 6" />
					{Array.from({length: 12}, (_, i) => {
						const a = at(i * 30 - 90, bp + 10);
						const b = at(i * 30 - 90, bp + (i % 3 === 0 ? 28 : 18));
						return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={gold(0.4)} strokeWidth={1.2} />;
					})}
					{/* 时间轴（赤道缝的延长线） */}
					<line x1={L.axis.x0} y1={L.axis.y} x2={L.axis.x1} y2={L.axis.y} stroke={line} strokeWidth={1.4} />
					{[-9, 9].map((dy) => (
						<line key={dy} x1={L.axis.x0 + 40} y1={L.axis.y + dy} x2={L.axis.x1 - 40} y2={L.axis.y + dy} stroke={gold(0.2)} strokeWidth={1} />
					))}
					<path d={`M ${L.axis.x1 + 2} ${L.axis.y} l -14 -7 l 0 14 Z`} fill={gold(0.7)} stroke="none" />
					<path d={`M ${L.axis.x0 - 9} ${L.axis.y} l 6 -4 l 6 4 l -6 4 Z`} fill={gold(0.7)} stroke="none" />
				</g>
			</svg>
			<div style={{position: 'absolute', left: L.fig.x, top: L.fig.y, opacity: 0.85}}>
				<div style={{fontFamily: SERIF, fontSize: 22, letterSpacing: 6, color: COLORS.parchmentDim}}>图一　精灵球</div>
				<div style={{fontFamily: CINZEL, fontSize: 13, letterSpacing: 4, color: gold(0.55), marginTop: 4}}>FIG. I · POKÉ BALL</div>
			</div>

			<BallOnAxis kind="hisui" p={L.left} zh="洗翠时代" en="HISUI" />
			<BallOnAxis kind="master" p={L.right} zh="现代" en="MODERN" />

			{/* 中央：现代精灵球 */}
			<div style={{position: 'absolute', left: hero.x - hero.r * 2, top: hero.y - hero.r * 2, width: hero.r * 4, height: hero.r * 4, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,226,170,0.28) 0%, rgba(255,190,110,0.1) 35%, rgba(0,0,0,0) 62%)'}} />
			<ModernBall f={F} p={{x: hero.x, y: hero.y, r: hero.r, yaw: -14, pitch: 12, roll: -5, glow: 0.45}} shadow={0} />

			{/* 标题区压暗 */}
			<AbsoluteFill
				style={{
					background:
						L.shade === 'bottom'
							? 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.6) 24%, transparent 46%)'
							: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 20%, transparent 34%)',
				}}
			/>
			<div style={{position: 'absolute', left: 0, right: 0, top: t.top, textAlign: 'center'}}>
				<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: t.hook, letterSpacing: t.hook * 0.16, paddingLeft: t.hook * 0.16, color: 'rgba(246,236,214,0.96)', textShadow: '0 0 12px rgba(0,0,0,0.95), 0 0 30px rgba(0,0,0,0.9)'}}>
					一颗精灵球，到底装着什么？
				</div>
				<div
					style={{
						display: 'inline-block',
						fontFamily: SERIF,
						fontWeight: 900,
						fontSize: t.size,
						letterSpacing: t.size * 0.18,
						paddingLeft: t.size * 0.18,
						lineHeight: 1.15,
						marginTop: t.size * 0.06,
						background: GOLD_TEXT,
						WebkitBackgroundClip: 'text',
						backgroundClip: 'text',
						color: 'transparent',
						filter: `drop-shadow(0 0 28px rgba(${COLORS.glowRgb},0.45)) drop-shadow(0 5px 6px rgba(20,8,0,0.95))`,
					}}
				>
					人造容器
				</div>
				<div style={{width: t.size * 3.6, height: 2, margin: `${t.en * 0.3}px auto 0`, background: `linear-gradient(90deg, transparent, ${gold(0.95)}, transparent)`}} />
				<div style={{fontFamily: CINZEL, fontSize: t.en, letterSpacing: t.en * 0.45, paddingLeft: t.en * 0.45, color: gold(0.85), marginTop: t.en * 0.5}}>THE VESSEL OF HUMANKIND&apos;S INVENTION</div>
			</div>

			<AbsoluteFill style={{background: 'radial-gradient(ellipse 78% 74% at 50% 50%, transparent 58%, rgba(0,0,0,0.55) 100%)'}} />
		</AbsoluteFill>
	);
};

const WIDE: Layout = {
	W: 1920,
	H: 1080,
	hero: {x: 960, y: 395, r: 205},
	bp: 300,
	left: {x: 395, y: 415, s: 200},
	right: {x: 1525, y: 415, s: 200},
	axis: {y: 415, x0: 150, x1: 1770},
	title: {top: 728, size: 132, hook: 38, en: 22},
	shade: 'bottom',
	fig: {x: 1560, y: 70},
};

const STANDARD: Layout = {
	W: 1440,
	H: 1080,
	hero: {x: 720, y: 390, r: 190},
	bp: 280,
	left: {x: 220, y: 409, s: 168},
	right: {x: 1220, y: 409, s: 168},
	axis: {y: 409, x0: 60, x1: 1380},
	title: {top: 730, size: 128, hook: 36, en: 20},
	shade: 'bottom',
	fig: {x: 1110, y: 56},
};

const PORTRAIT: Layout = {
	W: 1080,
	H: 1440,
	hero: {x: 540, y: 880, r: 215},
	bp: 318,
	left: {x: 104, y: 902, s: 122},
	right: {x: 976, y: 902, s: 122},
	axis: {y: 902, x0: 18, x1: 1062},
	title: {top: 76, size: 140, hook: 38, en: 20},
	shade: 'top',
	fig: {x: 760, y: 470},
};

export const PokeballCoverWide: React.FC = () => <Cover L={WIDE} />;
export const PokeballCoverStandard: React.FC = () => <Cover L={STANDARD} />;
export const PokeballCoverPortrait: React.FC = () => <Cover L={PORTRAIT} />;
