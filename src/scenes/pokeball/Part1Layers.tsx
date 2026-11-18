import {Img, staticFile} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {COLORS} from '../../theme';
import {BEAT, bf, easeInQuad, easeOutCubic, lerp, prog, sat, smooth, track} from './common';
import {BallPose, ModernBall, TitleCard} from './ui';

export const GOLD = `rgb(${COLORS.goldRgb})`;
export const gold = (a: number) => `rgba(${COLORS.goldRgb},${a})`;

/** 线稿逐笔画出：pathLength=1 + dashoffset */
export const draw = (t: number): React.SVGProps<SVGPathElement> => ({pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - sat(t)});

export const Label: React.FC<{x: number; y: number; zh: string; en?: string; o: number; size?: number}> = ({x, y, zh, en, o, size = 22}) => (
	<div style={{position: 'absolute', left: x - 200, width: 400, top: y, textAlign: 'center', opacity: o}}>
		<div style={{fontFamily: SERIF, fontSize: size, letterSpacing: 6, color: COLORS.parchment, textShadow: '0 0 12px rgba(0,0,0,0.9)'}}>{zh}</div>
		{en && <div style={{fontFamily: CINZEL, fontSize: 12, letterSpacing: 4, color: gold(0.55), marginTop: 4}}>{en}</div>}
	</div>
);

// ════════════════════════════════════════════════════════════════════════
// 第 1 段：钩子 + 片名
// ════════════════════════════════════════════════════════════════════════

const LAND = bf(0); // 第一个强拍：球落地
const T_STONE = bf(1);
const T_CHAIN = bf(1, 2);
const T_RING = bf(2);
const T_FOCUS = bf(2, 2);
const T_TITLE = bf(4);
const T_BEFORE = bf(7);
export const TITLE_LINE_Y = 640;
const BALL_REST = {x: 960, y: 500, r: 150};
/** 第一对脚印（人 / 宝可梦）之间的位置：片名小金球落到这里，洗翠精灵球也滚到这里停下、从这里投出 */
const SEAT = {x: 262, y: 600};

/** 开场球的姿态（片名时收成线上的一颗小金球） */
export const hookBall = (f: number): BallPose => {
	// 落下：0 帧在画面上方，强拍落地，两次回弹
	let y: number;
	if (f < LAND) y = lerp(-220, BALL_REST.y, easeInQuad(f / LAND));
	else
		y =
			BALL_REST.y -
			track(f, [
				[LAND, 0],
				[LAND + 8, 34],
				[LAND + 16, 0],
				[LAND + 21, 9],
				[LAND + 26, 0],
			]);
	const spin = 1 - easeOutCubic(prog(f, 0, LAND + 18));
	const wob = Math.exp(-Math.max(0, f - LAND) / 14) * Math.sin(Math.max(0, f - LAND) * 0.55) * 5;
	const idle = Math.sin((f - LAND) / 55) * 7 * smooth(prog(f, LAND + 10, LAND + 60));
	let pose: BallPose = {
		x: BALL_REST.x,
		y,
		r: BALL_REST.r,
		yaw: -16 + 70 * spin + idle,
		pitch: 14 - 420 * spin,
		roll: -5 + 25 * spin + wob,
		glow: 0.22,
	};
	// 片名：缩成一颗小金球落到装饰线中央
	const k = smooth(prog(f, T_TITLE + 2, T_TITLE + 30));
	pose = {
		...pose,
		x: 960,
		y: lerp(pose.y, TITLE_LINE_Y, k),
		r: lerp(BALL_REST.r, 15, k),
		glow: lerp(0.22, 1.2, k),
		gold: k,
	};
	// 进入"没有精灵球的年代"：小金球飘到第一对脚印之间（之后洗翠精灵球滚到同一处停下），再化进光里
	const go = smooth(prog(f, T_BEFORE - 16, T_BEFORE + 2));
	pose.x = lerp(pose.x, SEAT.x, go);
	pose.y = lerp(pose.y, SEAT.y, go) - 90 * Math.sin(Math.PI * go);
	pose.glow = (pose.glow ?? 0) + 0.8 * Math.sin(Math.PI * prog(f, T_BEFORE - 2, T_BEFORE + 16));
	pose.opacity = 1 - smooth(prog(f, T_BEFORE + 2, T_BEFORE + 18));
	return pose;
};

export const StoneIcon: React.FC<{t: number}> = ({t}) => (
	<svg width={220} height={220} viewBox="-110 -110 220 220" style={{overflow: 'visible'}}>
		<defs>
			<radialGradient id="pb-stone-glow">
				<stop offset="0" stopColor="rgba(220,236,255,0.55)" />
				<stop offset="1" stopColor="rgba(220,236,255,0)" />
			</radialGradient>
		</defs>
		<circle r={70} fill="url(#pb-stone-glow)" opacity={smooth(prog(t, 0.5, 1))} />
		<g fill="none" stroke={GOLD} strokeWidth={2} strokeLinejoin="round">
			<path d="M0 -62 L44 -26 L38 34 L0 62 L-38 34 L-44 -26 Z" {...draw(t * 1.4)} />
			<path d="M0 -62 L-14 -18 L0 62 M0 -62 L16 -16 L0 62 M-44 -26 L-14 -18 L16 -16 L44 -26 M-38 34 L-14 -18 M38 34 L16 -16" strokeWidth={1.1} opacity={0.75} {...draw(t * 1.4 - 0.4)} />
		</g>
	</svg>
);

export const ChainIcon: React.FC<{t: number}> = ({t}) => {
	const links = [-75, -25, 25, 75];
	return (
		<svg width={260} height={220} viewBox="-130 -110 260 220" style={{overflow: 'visible'}}>
			<g transform="rotate(-18)" fill="none" strokeLinecap="round">
				{links.map((x, i) => (
					<g key={i} transform={`translate(${x} 0) ${i % 2 ? 'rotate(0)' : ''}`}>
						{i % 2 === 0 ? (
							<rect x={-34} y={-20} width={68} height={40} rx={20} stroke="#a3241e" strokeWidth={9} {...(draw(t * 1.6 - i * 0.15) as object)} />
						) : (
							<line x1={-26} y1={0} x2={26} y2={0} stroke="#a3241e" strokeWidth={9} {...(draw(t * 1.6 - i * 0.15) as object)} />
						)}
						{i % 2 === 0 ? (
							<rect x={-34} y={-20} width={68} height={40} rx={20} stroke={gold(0.85)} strokeWidth={1.4} {...(draw(t * 1.6 - i * 0.15) as object)} />
						) : (
							<line x1={-26} y1={-5} x2={26} y2={-5} stroke={gold(0.85)} strokeWidth={1.4} {...(draw(t * 1.6 - i * 0.15) as object)} />
						)}
					</g>
				))}
			</g>
		</svg>
	);
};

/**
 * 片名静段（第 4–6 小节）：片名后面逐笔画出一张精灵球的线描结构图，像古籍里的专利图。
 * 赤道缝正好是片名的装饰线，中央按钮正好是那颗小金球。标注按拍出现，都写在片名字面之外。
 */
const BP = {x: 960, y: TITLE_LINE_Y, r: 380, rIn: 322};
type Callout = {at: number; ang: number; r: number; elbow: P; end: P; zh: string; en: string; side: 'l' | 'r'};
const CALLOUTS: Callout[] = [
	{at: bf(5), ang: -125, r: BP.r, elbow: {x: 600, y: 236}, end: {x: 520, y: 236}, zh: '上壳', en: 'UPPER SHELL', side: 'l'},
	{at: bf(5, 2), ang: 0, r: 50, elbow: {x: 1130, y: 614}, end: {x: 1430, y: 614}, zh: '按钮', en: 'BUTTON', side: 'r'},
	{at: bf(6), ang: 125, r: BP.r, elbow: {x: 600, y: 1010}, end: {x: 520, y: 1010}, zh: '下壳', en: 'LOWER SHELL', side: 'l'},
	{at: bf(6, 2), ang: 40, r: BP.rIn, elbow: {x: 1330, y: 930}, end: {x: 1430, y: 930}, zh: '收纳宝可梦的空间', en: 'INTERIOR', side: 'r'},
];

const Blueprint: React.FC<{f: number}> = ({f}) => {
	if (f < bf(4, 1) || f > bf(7) + 6) return null;
	const o = 1 - smooth(prog(f, bf(6, 3), bf(7) + 4));
	const beat = (b: number, n = 1) => prog(f, b, b + BEAT * n);
	const outer = beat(bf(4, 1.5), 2);
	const cross = beat(bf(4, 2), 2);
	const seam = beat(bf(5), 1);
	const btn = beat(bf(5, 2), 1);
	const inner = beat(bf(6, 1.5), 1.5);
	const ticks = beat(bf(4, 3), 2);
	const fig = smooth(prog(f, bf(4, 3), bf(4, 3) + 16));
	const s = 1 + 0.015 * prog(f, bf(4), bf(7));
	const line = gold(0.45);
	const at = (ang: number, r: number): P => ({x: BP.x + r * Math.cos((ang * Math.PI) / 180), y: BP.y + r * Math.sin((ang * Math.PI) / 180)});
	return (
		<div style={{position: 'absolute', inset: 0, opacity: o, transformOrigin: `${BP.x}px ${BP.y}px`, transform: `scale(${s})`}}>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
				<g fill="none" strokeLinecap="round">
					{/* 外壳轮廓：从顶上开始画一圈 */}
					<circle cx={BP.x} cy={BP.y} r={BP.r} stroke={gold(0.55)} strokeWidth={1.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outer} transform={`rotate(-90 ${BP.x} ${BP.y})`} />
					{/* 构造线：十字中线（虚线），伸出轮廓一点 */}
					<path d={`M ${BP.x} ${BP.y - BP.r - 60} L ${BP.x} ${BP.y + BP.r + 50}`} stroke={gold(0.2)} strokeWidth={1} strokeDasharray="10 6 2 6" {...draw(cross)} />
					<path d={`M ${BP.x - BP.r - 60} ${BP.y} L ${BP.x - BP.r} ${BP.y} M ${BP.x + BP.r} ${BP.y} L ${BP.x + BP.r + 60} ${BP.y}`} stroke={gold(0.3)} strokeWidth={1} {...draw(cross)} />
					{/* 刻度：每 30° 一格 */}
					{Array.from({length: 12}, (_, i) => {
						const k = sat(ticks * 12 - i);
						if (k <= 0) return null;
						const a = at(i * 30 - 90, BP.r + 10);
						const b = at(i * 30 - 90, BP.r + (i % 3 === 0 ? 26 : 18));
						return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={gold(0.32 * k)} strokeWidth={1} />;
					})}
					{/* 赤道的接缝：上下两道细线 */}
					{[-9, 9].map((dy) => {
						const half = Math.sqrt(BP.r * BP.r - dy * dy);
						return <path key={dy} d={`M ${BP.x - half} ${BP.y + dy} L ${BP.x + half} ${BP.y + dy}`} stroke={line} strokeWidth={1} {...draw(seam)} />;
					})}
					{/* 按钮：围着小金球的两圈 */}
					<circle cx={BP.x} cy={BP.y} r={32} stroke={gold(0.5)} strokeWidth={1.2} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - btn} />
					<circle cx={BP.x} cy={BP.y} r={50} stroke={gold(0.34)} strokeWidth={1} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - btn} transform={`rotate(180 ${BP.x} ${BP.y})`} />
					{/* 内部：收纳宝可梦的空间（虚线圈） */}
					<circle cx={BP.x} cy={BP.y} r={BP.rIn} stroke={gold(0.36)} strokeWidth={1} strokeDasharray="4 7" pathLength={1000} strokeDashoffset={1000 * (1 - inner) - f * 0.4} opacity={inner > 0 ? 1 : 0} />
				</g>
				{/* 标注：引线逐笔画出，末端出字 */}
				{CALLOUTS.map((c, i) => {
					const t = prog(f, c.at, c.at + BEAT * 1.2);
					if (t <= 0) return null;
					const a = at(c.ang, c.r);
					return (
						<g key={i} fill="none">
							<circle cx={a.x} cy={a.y} r={3.2} fill={gold(0.8 * smooth(prog(t, 0, 0.2)))} />
							<path d={`M ${a.x} ${a.y} L ${c.elbow.x} ${c.elbow.y} L ${c.end.x} ${c.end.y}`} stroke={gold(0.5)} strokeWidth={1} {...draw(t * 1.3)} />
						</g>
					);
				})}
			</svg>
			{CALLOUTS.map((c, i) => {
				const k = smooth(prog(f, c.at + BEAT * 0.7, c.at + BEAT * 1.3));
				if (k <= 0) return null;
				const left = c.side === 'r';
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							top: c.end.y - 30,
							...(left ? {left: c.end.x + 14} : {right: 1920 - c.end.x + 14}),
							textAlign: left ? 'left' : 'right',
							opacity: k,
							transform: `translateX(${(left ? -8 : 8) * (1 - k)}px)`,
							whiteSpace: 'nowrap',
						}}
					>
						<div style={{fontFamily: SERIF, fontSize: 22, letterSpacing: 5, color: COLORS.parchment, opacity: 0.85, textShadow: '0 0 12px rgba(0,0,0,0.9)'}}>{c.zh}</div>
						<div style={{fontFamily: CINZEL, fontSize: 12, letterSpacing: 4, color: gold(0.55), marginTop: 4}}>{c.en}</div>
					</div>
				);
			})}
			{/* 图号：像古籍里的插图编号 */}
			<div style={{position: 'absolute', left: 1500, top: 236, opacity: 0.8 * fig, textAlign: 'left'}}>
				<div style={{fontFamily: SERIF, fontSize: 20, letterSpacing: 6, color: COLORS.parchmentDim}}>图一　精灵球</div>
				<div style={{fontFamily: CINZEL, fontSize: 12, letterSpacing: 4, color: gold(0.5), marginTop: 4}}>FIG. I · POKÉ BALL</div>
			</div>
		</div>
	);
};

export const HookLayer: React.FC<{f: number}> = ({f}) => {
	if (f > T_BEFORE + 30) return null;
	const ball = hookBall(f);
	const toTitle = smooth(prog(f, T_TITLE - 10, T_TITLE + 8));
	const focus = smooth(prog(f, T_FOCUS, T_FOCUS + 24));
	const stoneT = prog(f, T_STONE, T_STONE + 24);
	const chainT = prog(f, T_CHAIN, T_CHAIN + 24);
	const ringT = prog(f, T_RING, T_RING + 22);
	const sideO = (1 - 0.72 * focus) * (1 - toTitle);
	const stoneX = 470 - 30 * focus;
	const chainX = 1450 + 30 * focus;
	// 空圆：先画出虚线圆，聚焦时收紧变亮；片名时闪一下散开
	const flash = prog(f, T_TITLE, T_TITLE + 16);
	const ringR = lerp(210, 186, focus) + 70 * easeOutCubic(flash);
	const ringO = (ringT > 0 ? 1 : 0) * (1 - smooth(flash));
	const plinthO = smooth(prog(f, LAND, LAND + 30)) * (1 - toTitle);
	// 装饰线：从小金球向两侧展开
	const lineW = 380 * easeOutCubic(prog(f, T_TITLE + 14, T_TITLE + 48));
	const lineO = 1 - smooth(prog(f, T_BEFORE - 14, T_BEFORE + 16));

	return (
		<>
			{/* 展台：球下的细金椭圆 */}
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: plinthO}}>
				<ellipse cx={960} cy={BALL_REST.y + BALL_REST.r * 0.98} rx={250} ry={34} fill="none" stroke={gold(0.55)} strokeWidth={1.3} />
				<ellipse cx={960} cy={BALL_REST.y + BALL_REST.r * 0.98} rx={300} ry={41} fill="none" stroke={gold(0.22)} strokeWidth={1} />
			</svg>

			<Blueprint f={f} />

			{/* 三样东西 */}
			<div style={{position: 'absolute', left: stoneX - 110, top: 390, opacity: sideO * (stoneT > 0 ? 1 : 0)}}>
				<StoneIcon t={stoneT} />
			</div>
			<Label x={stoneX} y={620} zh="宇宙起始之石" o={sideO * smooth(prog(f, T_STONE + 10, T_STONE + 26))} />
			<div style={{position: 'absolute', left: chainX - 130, top: 390, opacity: sideO * (chainT > 0 ? 1 : 0)}}>
				<ChainIcon t={chainT} />
			</div>
			<Label x={chainX} y={620} zh="红色锁链" o={sideO * smooth(prog(f, T_CHAIN + 10, T_CHAIN + 26))} />

			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: ringO}}>
				<circle
					cx={960}
					cy={BALL_REST.y}
					r={ringR}
					fill="none"
					stroke={gold(0.6 + 0.4 * focus)}
					strokeWidth={1.6 + focus}
					strokeDasharray="6 9"
					pathLength={1000}
					strokeDashoffset={1000 * (1 - ringT) + f * 0.6}
					style={{filter: `drop-shadow(0 0 ${6 + 10 * focus}px rgba(${COLORS.glowRgb},${0.3 + 0.4 * focus}))`}}
				/>
			</svg>
			<Label x={960} y={BALL_REST.y + 222} zh="人造容器" o={smooth(prog(f, T_RING + 10, T_RING + 26)) * (1 - toTitle)} />

			{/* 片名时的闪光 */}
			{flash > 0 && flash < 1 && (
				<div
					style={{
						position: 'absolute',
						left: 960 - 420,
						top: BALL_REST.y - 420,
						width: 840,
						height: 840,
						borderRadius: '50%',
						background: `radial-gradient(circle, rgba(255,236,190,${0.55 * (1 - flash)}) 0%, rgba(255,200,110,${0.25 * (1 - flash)}) 30%, rgba(0,0,0,0) 65%)`,
					}}
				/>
			)}

			{/* 装饰线 */}
			{lineW > 0 && (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: lineO}}>
					<line x1={960 - lineW} y1={TITLE_LINE_Y} x2={960 - 24} y2={TITLE_LINE_Y} stroke={gold(0.9)} strokeWidth={1.4} />
					<line x1={960 + 24} y1={TITLE_LINE_Y} x2={960 + lineW} y2={TITLE_LINE_Y} stroke={gold(0.9)} strokeWidth={1.4} />
					<path d={`M ${960 - lineW - 9} ${TITLE_LINE_Y} l 6 -4 l 6 4 l -6 4 Z`} fill={GOLD} opacity={sat(lineW / 380)} />
					<path d={`M ${960 + lineW + 9} ${TITLE_LINE_Y} l -6 -4 l -6 4 l 6 4 Z`} fill={GOLD} opacity={sat(lineW / 380)} />
				</svg>
			)}

			<ModernBall p={ball} f={f} shadow={1 - toTitle} />
			<TitleCard f={f} at={T_TITLE + 6} out={T_BEFORE} lineY={TITLE_LINE_Y} />
		</>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 第 2 段：没有球的年代——人和宝可梦的脚印并排向前，每拍一步
// ════════════════════════════════════════════════════════════════════════

const T_INVENT = bf(10);
const T_ROLL = bf(8, 2);
/** 第一次投球：滚进来的那颗球从原地被投出去 */
const T_THROW1 = bf(10, 2);

const ShoePrint: React.FC<{o: number; s: number; flip: boolean}> = ({o, s, flip}) => (
	<g opacity={o} transform={`scale(${s}) ${flip ? 'scale(1,-1)' : ''}`}>
		<path d="M-34 -2 C -36 -14 -22 -17 -4 -16 C 14 -15 30 -12 34 -3 C 37 6 26 13 8 13 C -8 13 -32 10 -34 -2 Z" fill={gold(0.16)} stroke={gold(0.85)} strokeWidth={1.4} />
		<path d="M-58 -1 C -59 -9 -50 -12 -44 -11 C -38 -10 -36 -5 -37 0 C -38 6 -44 9 -50 8 C -55 7 -58 4 -58 -1 Z" fill={gold(0.16)} stroke={gold(0.85)} strokeWidth={1.4} />
		<path d="M-22 -9 L -22 7 M -10 -12 L -10 10 M 2 -12 L 2 10 M 14 -11 L 14 9 M 25 -8 L 25 6 M -53 -5 L -53 4 M -45 -6 L -45 5" stroke={gold(0.5)} strokeWidth={1.1} />
	</g>
);

const PawPrint: React.FC<{o: number; s: number}> = ({o, s}) => (
	<g opacity={o} transform={`scale(${s})`}>
		<path d="M-12 0 C -12 -9 -4 -13 4 -11 C 12 -9 14 0 12 6 C 10 12 2 13 -4 12 C -10 10 -12 6 -12 0 Z" fill={gold(0.18)} stroke={gold(0.85)} strokeWidth={1.3} />
		<ellipse cx={18} cy={-12} rx={5.5} ry={4.5} fill={gold(0.18)} stroke={gold(0.85)} strokeWidth={1.2} />
		<ellipse cx={22} cy={0} rx={5.5} ry={4.5} fill={gold(0.18)} stroke={gold(0.85)} strokeWidth={1.2} />
		<ellipse cx={18} cy={12} rx={5.5} ry={4.5} fill={gold(0.18)} stroke={gold(0.85)} strokeWidth={1.2} />
	</g>
);

export const BeforeLayer: React.FC<{f: number}> = ({f}) => {
	if (f < T_BEFORE - 5 || f > T_INVENT + 40) return null;
	const out = 1 - smooth(prog(f, T_INVENT - 16, T_INVENT + 36));
	const STEPS = 12;
	const x0 = 250;
	const dx = 128;
	const pathY = (x: number) => 560 + 34 * Math.sin((x - 250) / 420);
	return (
		<>
		{/* 第 5 句"精灵球才刚刚出现"：一颗洗翠精灵球从左边沿着足迹滚进来，停在第一对脚印之间 */}
		{f >= T_ROLL && f < T_THROW1 && (() => {
			const u = easeOutCubic(prog(f, T_ROLL, T_INVENT - 4));
			const x = lerp(-90, SEAT.x, u);
			const R = 40;
			return <HisuiBall x={x} y={SEAT.y} scale={2 * R} rot={((x + 90) / (Math.PI * 2 * R)) * 360} glow={0.25 * Math.exp(-Math.max(0, f - T_INVENT + 4) / 16)} />;
		})()}
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: out}}>
			{Array.from({length: STEPS}, (_, i) => {
				const tPerson = T_BEFORE + i * BEAT;
				const tPoke = T_BEFORE + (i + 0.5) * BEAT;
				const xp = x0 + i * dx;
				const xk = x0 + (i + 0.5) * dx;
				const age = (t: number) => {
					if (f < t) return {o: 0, s: 1.25};
					const k = prog(f, t, t + 5);
					const decay = 0.42 + 0.58 * Math.exp(-(f - t) / 70);
					return {o: smooth(k) * decay, s: lerp(1.25, 1, easeOutCubic(k))};
				};
				const a = age(tPerson);
				const b = age(tPoke);
				return (
					<g key={i}>
						<g transform={`translate(${xp} ${pathY(xp) - 70 + (i % 2 ? 34 : 0)})`}>
							<ShoePrint o={a.o} s={a.s * 1.45} flip={i % 2 === 1} />
						</g>
						<g transform={`translate(${xk} ${pathY(xk) + 96 + (i % 2 ? 0 : 20)})`}>
							<PawPrint o={b.o} s={b.s * 1.5} />
						</g>
					</g>
				);
			})}
		</svg>
		</>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 第 3–4 段：洗翠时代——投球、失手、命中、缩小收进球里、配方、九种球
// ════════════════════════════════════════════════════════════════════════

const ROWLET = {x: 1390, y: 455, size: 430};
const HIT = {x: 1300, y: 500};
const THROW_FROM = SEAT;
const T_RECIPE = bf(14);
const T_SHAKE = bf(15, 2);
const T_CAUGHT = bf(16);
const T_APRI = bf(16, 2);
const T_STONE2 = bf(17, 2);
const T_GRID = bf(18, 3);

export type P = {x: number; y: number};
/** 抛物线：起点、终点、顶点高度 */
const arc = (a: P, b: P, apex: number, u: number): P => ({x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) - apex * 4 * u * (1 - u)});

const ArcDots: React.FC<{a: P; b: P; apex: number; upto: number; o: number}> = ({a, b, apex, upto, o}) => {
	const N = 46;
	return (
		<g opacity={o}>
			{Array.from({length: N}, (_, i) => {
				const u = i / (N - 1);
				if (u > upto) return null;
				const p = arc(a, b, apex, u);
				return <circle key={i} cx={p.x} cy={p.y} r={1.9} fill={gold(0.75)} />;
			})}
		</g>
	);
};

/** 洗翠精灵球（官方图，2.5D 打光；固定尺寸渲染，用 CSS 缩放） */
export const HisuiBall: React.FC<{x: number; y: number; scale: number; rot?: number; glow?: number; o?: number}> = ({x, y, scale, rot = 0, glow = 0, o = 1}) => {
	const S = 360;
	return (
		<div style={{position: 'absolute', left: x - S / 2, top: y - S / 2, width: S, height: S, transform: `scale(${scale / S}) rotate(${rot}deg)`, opacity: o}}>
			<PokemonArt3D
				dir="items/hisui-pokeball"
				x={S / 2}
				y={S / 2}
				size={S}
				depthScale={0.5}
				ambient={[0.42, 0.36, 0.3]}
				dirLights={[
					{dir: [-0.55, -0.7, 0.5], color: [1.15, 0.98, 0.78], wrap: 0.25},
					{dir: [0.7, 0.4, 0.35], color: [0.28, 0.2, 0.12], wrap: 0.4},
				]}
				rim={{dir: [0.7, -0.6], color: [0.9 + glow, 0.65 + glow * 0.8, 0.32 + glow * 0.5], power: 2.4}}
				emissive={glow * 0.6}
				emissiveTint={[1, 0.8, 0.5]}
				resolution={1.5}
			/>
		</div>
	);
};

const ApricornArt: React.FC<{t: number; split: number}> = ({t, split}) => (
	<svg width={240} height={240} viewBox="-120 -120 240 240" style={{overflow: 'visible'}}>
		<g fill="none" stroke={GOLD} strokeLinecap="round" style={{filter: `drop-shadow(0 0 6px rgba(${COLORS.glowRgb},0.45))`}}>
			{/* 上半：果盖与果柄 */}
			<g transform={`translate(0 ${-26 * split})`}>
				<path d="M-62 -12 C -60 -50 -30 -66 0 -66 C 30 -66 60 -50 62 -12" strokeWidth={2} {...draw(t * 1.5)} />
				<path d="M-58 -26 C -20 -40 20 -40 58 -26" strokeWidth={1.1} opacity={0.7} {...draw(t * 1.5 - 0.2)} />
				<path d="M-48 -44 C -16 -54 16 -54 48 -44" strokeWidth={1.1} opacity={0.6} {...draw(t * 1.5 - 0.3)} />
				<path d="M0 -66 C 2 -78 8 -86 16 -92" strokeWidth={3} {...draw(t * 1.5 - 0.35)} />
				<path d="M-62 -12 L 62 -12" strokeWidth={1.2} strokeDasharray="4 5" opacity={split} />
			</g>
			{/* 下半：果身 */}
			<g transform={`translate(0 ${18 * split})`}>
				<path d="M-62 -12 C -66 30 -36 64 0 64 C 36 64 66 30 62 -12" strokeWidth={2} {...draw(t * 1.5 - 0.1)} />
				<path d="M34 -4 C 44 16 42 36 26 50" strokeWidth={1.1} opacity={0.6} {...draw(t * 1.5 - 0.45)} />
				<path d="M22 6 C 30 22 28 36 18 46" strokeWidth={1.1} opacity={0.45} {...draw(t * 1.5 - 0.5)} />
				<path d="M-62 -12 L 62 -12" strokeWidth={1.2} strokeDasharray="4 5" opacity={split} />
			</g>
		</g>
	</svg>
);

const TumblestoneArt: React.FC<{t: number}> = ({t}) => (
	<svg width={240} height={180} viewBox="-120 -90 240 180" style={{overflow: 'visible'}}>
		<g fill="none" stroke={GOLD} strokeLinecap="round" style={{filter: `drop-shadow(0 0 6px rgba(${COLORS.glowRgb},0.45))`}}>
			<path d="M-66 10 C -70 -20 -40 -44 0 -44 C 44 -44 72 -24 68 6 C 64 34 30 46 -6 44 C -42 42 -62 32 -66 10 Z" strokeWidth={2} {...draw(t * 1.5)} />
			<path d="M-34 -24 C -14 -34 18 -34 38 -24" strokeWidth={1.4} opacity={0.75} {...draw(t * 1.5 - 0.3)} />
			<path d="M40 14 C 34 26 20 32 4 34" strokeWidth={1.1} opacity={0.5} {...draw(t * 1.5 - 0.45)} />
		</g>
	</svg>
);

const GRID_ITEMS = [
	['poke', '精灵球'],
	['great', '超级球'],
	['ultra', '高级球'],
	['heavy', '沉重球'],
	['leaden', '超重球'],
	['gigaton', '巨重球'],
	['feather', '飞羽球'],
	['wing', '飞翼球'],
	['jet', '飞梭球'],
] as const;
export const GRID = {cx: 960, cy: 455, step: 168, sprite: 112};
/** 第 5 段：九宫格左移，给洗翠顽皮雷弹让位 */
export const GRID_SHIFT = -380;

/** 九种洗翠精灵球：每半拍亮一格 */
export const BallGrid: React.FC<{f: number; at: number; o?: number; dx?: number}> = ({f, at, o = 1, dx = 0}) => {
	if (f < at - 2) return null;
	const half = BEAT / 2;
	const lines = easeOutCubic(prog(f, at - 6, at + 30));
	const {cx, cy, step, sprite} = GRID;
	const x0 = cx + dx - step;
	const y0 = cy - step;
	return (
		<div style={{position: 'absolute', inset: 0, opacity: o}}>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				{[0.5, 1.5].map((k) => (
					<g key={k} stroke={gold(0.35)} strokeWidth={1}>
						<line x1={x0 - step / 2 + (3 * step) * (1 - lines) * 0.5} y1={y0 + k * step} x2={x0 + 2.5 * step - (3 * step) * (1 - lines) * 0.5} y2={y0 + k * step} />
						<line x1={x0 + k * step} y1={y0 - step / 2 + (3 * step) * (1 - lines) * 0.5} x2={x0 + k * step} y2={y0 + 2.5 * step - (3 * step) * (1 - lines) * 0.5} />
					</g>
				))}
				<rect x={x0 - step / 2} y={y0 - step / 2} width={3 * step} height={3 * step} fill="none" stroke={gold(0.5 * lines)} strokeWidth={1.2} />
			</svg>
			{GRID_ITEMS.map(([key, name], i) => {
				const t = at + i * half;
				const k = prog(f, t, t + 10);
				if (k <= 0) return null;
				const col = i % 3;
				const row = Math.floor(i / 3);
				const x = x0 + col * step;
				const y = y0 + row * step - 12;
				const pop = 1 + 0.18 * Math.sin(Math.PI * sat(k * 1.2));
				const flash = Math.exp(-Math.max(0, f - t) / 8);
				return (
					<div key={key}>
						<div
							style={{
								position: 'absolute',
								left: x - sprite / 2,
								top: y - sprite / 2,
								width: sprite,
								height: sprite,
								opacity: smooth(k),
								transform: `scale(${pop})`,
								filter: `drop-shadow(0 0 ${4 + 16 * flash}px rgba(${COLORS.glowRgb},${0.25 + 0.6 * flash})) drop-shadow(0 4px 4px rgba(0,0,0,0.7))`,
							}}
						>
							<Img src={staticFile(`items/la/${key}.png`)} style={{width: sprite, height: sprite}} />
						</div>
						<div style={{position: 'absolute', left: x - 80, width: 160, top: y + sprite / 2 + 2, textAlign: 'center', fontFamily: SERIF, fontSize: 18, letterSpacing: 4, color: COLORS.parchmentDim, opacity: smooth(prog(f, t + 4, t + 14))}}>
							{name}
						</div>
					</div>
				);
			})}
		</div>
	);
};

export const HisuiLayer: React.FC<{f: number}> = ({f}) => {
	if (f < T_INVENT - 5 || f > bf(23, 2)) return null;
	// ── 木木枭 ──
	// 木木枭先以暗色剪影出现，用一整小节慢慢显色（第 11 小节强拍显色完成，放叫声）
	const owlIn = smooth(prog(f, T_INVENT - 8, T_INVENT + 22));
	const owlDark = 1 - smooth(prog(f, T_INVENT + 6, bf(11)));
	const hit = bf(14);
	const silhouette = smooth(prog(f, hit, hit + 12));
	const shrink = easeInQuad(prog(f, hit + 14, T_SHAKE - 2));
	const ballHold = {x: 1210, y: 600};
	const owlScale = lerp(1, 0.04, shrink);
	const owlX = lerp(ROWLET.x, ballHold.x, shrink);
	const owlY = lerp(ROWLET.y, ballHold.y, shrink) + Math.sin(f / 24) * 6 * (1 - silhouette);
	const owlGone = f > T_SHAKE + 2;

	// ── 投球：第一次落空、几道虚影、第三次命中 ──
	const t1a = T_THROW1;
	const t1b = bf(11, 2);
	const miss1 = {x: 1010, y: 800};
	const u1 = prog(f, t1a, t1b);
	const t3a = bf(13, 2);
	const u3 = prog(f, t3a, hit);
	const ghosts = [
		{at: bf(12), b: {x: 1650, y: 820}, apex: 640},
		{at: bf(12, 2), b: {x: 860, y: 830}, apex: 260},
		{at: bf(13), b: {x: 1560, y: 230}, apex: 420},
	];
	const trailO = 1 - smooth(prog(f, hit + 6, hit + 40));

	// ── 命中后：球弹回、悬停、落地摇三下（每拍一下）、收服时冒蒸汽 ──
	let ball: {x: number; y: number; s: number; rot: number} | null = null;
	if (f >= t3a) {
		if (f < hit) {
			const p = arc(THROW_FROM, HIT, 520, u3);
			ball = {x: p.x, y: p.y, s: 92, rot: 720 * u3};
		} else {
			const back = easeOutCubic(prog(f, hit, hit + 14));
			const drop = easeInQuad(prog(f, T_SHAKE - 10, T_SHAKE));
			const x = lerp(HIT.x, ballHold.x, back);
			const y = lerp(lerp(HIT.y, ballHold.y, back), 700, drop);
			const shakes = [T_SHAKE, T_SHAKE + BEAT, T_SHAKE + 2 * BEAT].reduce((acc, t) => acc + (f >= t ? Math.exp(-(f - t) / 4) * Math.sin((f - t) * 1.1) * 14 : 0), 0);
			ball = {x, y, s: 92 + 8 * (1 - back), rot: shakes};
		}
	}
	// 收服后：球移到左侧、放大，作为配方的主角
	const toRecipe = smooth(prog(f, T_CAUGHT + 18, T_APRI + 26));
	const BIG = {x: 640, y: 470, s: 330};
	if (ball && f > T_CAUGHT) ball = {x: lerp(ball.x, BIG.x, toRecipe), y: lerp(ball.y, BIG.y, toRecipe), s: lerp(ball.s, BIG.s, toRecipe), rot: ball.rot * (1 - toRecipe)};
	const gridIn = smooth(prog(f, T_GRID - 4, T_GRID + 14));
	const ballO = 1 - gridIn;

	// 汇聚的光线（木木枭缩进球里时）
	const streak = prog(f, hit + 10, T_SHAKE);
	const capFlash = Math.exp(-Math.max(0, f - T_CAUGHT) / 10) * (f >= T_CAUGHT ? 1 : 0);

	// ── 配方线稿 ──
	const apriT = prog(f, T_APRI, T_APRI + 34);
	const apriSplit = smooth(prog(f, T_APRI + 46, T_APRI + 70));
	const stoneT = prog(f, T_STONE2, T_STONE2 + 30);
	const recipeO = (f >= T_APRI ? 1 : 0) * (1 - smooth(prog(f, T_GRID - 6, T_GRID + 10)));
	const collapse = easeInQuad(prog(f, T_GRID - 6, T_GRID + 10));

	return (
		<>
			{!owlGone && (
				<div style={{position: 'absolute', left: owlX - ROWLET.size / 2, top: owlY - ROWLET.size / 2, width: ROWLET.size, height: ROWLET.size, transform: `scale(${owlScale})`, opacity: owlIn}}>
					<div style={{position: 'absolute', inset: 0, opacity: 1 - 0.75 * silhouette}}>
						<PokemonArt3D
							dir="pokemon/rowlet"
							x={ROWLET.size / 2}
							y={ROWLET.size / 2}
							size={ROWLET.size}
							depthScale={0.5}
							yaw={-5 + 3 * Math.sin(f / 50)}
							ambient={[0.4, 0.36, 0.32]}
							dirLights={[{dir: [-0.6, -0.6, 0.55], color: [1.1, 0.95, 0.75], wrap: 0.3}]}
							rim={{dir: [0.7, -0.6], color: [1.0, 0.72, 0.38], power: 2.2}}
						/>
					</div>
					{owlDark > 0.003 && (
						<div
							style={{
								position: 'absolute',
								inset: 0,
								opacity: owlDark,
								background: 'radial-gradient(circle at 50% 38%, #3a2a18 0%, #1c140b 60%, #0e0905 100%)',
								WebkitMaskImage: `url(${staticFile('pokemon/rowlet/art.png')})`,
								maskImage: `url(${staticFile('pokemon/rowlet/art.png')})`,
								WebkitMaskSize: 'contain',
								maskSize: 'contain',
								filter: `drop-shadow(0 0 3px rgba(255,200,120,${0.5 * owlDark})) drop-shadow(0 0 18px rgba(255,180,90,${0.25 * owlDark}))`,
							}}
						/>
					)}
					<div
						style={{
							position: 'absolute',
							inset: 0,
							opacity: silhouette * 0.92,
							background: 'radial-gradient(circle at 50% 38%, #ffe7b0 0%, #e8b05a 42%, #a8601e 88%, #7a3e12 100%)',
							WebkitMaskImage: `url(${staticFile('pokemon/rowlet/art.png')})`,
							maskImage: `url(${staticFile('pokemon/rowlet/art.png')})`,
							WebkitMaskSize: 'contain',
							maskSize: 'contain',
							filter: `drop-shadow(0 0 ${10 + 26 * shrink}px rgba(255,190,100,0.65))`,
						}}
					/>
				</div>
			)}

			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				{f >= t1a && <ArcDots a={THROW_FROM} b={miss1} apex={460} upto={u1} o={trailO * (1 - 0.6 * prog(f, t1b, t1b + 30))} />}
				{ghosts.map((g, i) => (f >= g.at ? <ArcDots key={i} a={THROW_FROM} b={g.b} apex={g.apex} upto={prog(f, g.at, g.at + BEAT * 1.6)} o={0.55 * trailO * (1 - 0.5 * prog(f, g.at + 20, g.at + 60))} /> : null))}
				{f >= t3a && <ArcDots a={THROW_FROM} b={HIT} apex={520} upto={u3} o={trailO} />}
				{streak > 0 &&
					streak < 1 &&
					Array.from({length: 9}, (_, i) => {
						const a = (i / 9) * Math.PI * 2 + 0.3;
						const r0 = 260 * (1 - streak) + 30;
						const sx = ballHold.x + Math.cos(a) * r0;
						const sy = ballHold.y + Math.sin(a) * r0 * 0.8;
						return <line key={i} x1={sx} y1={sy} x2={lerp(sx, ballHold.x, 0.6)} y2={lerp(sy, ballHold.y, 0.6)} stroke={`rgba(255,214,140,${0.7 * Math.sin(Math.PI * streak)})`} strokeWidth={2} strokeLinecap="round" />;
					})}
			</svg>

			{/* 第一次落空的球：落地后滚停 */}
			{f >= t1a && (
				<HisuiBall
					{...(() => {
						if (f < t1b) {
							const p = arc(THROW_FROM, miss1, 460, u1);
							return {x: p.x, y: p.y, scale: 80, rot: 600 * u1};
						}
						const roll = easeOutCubic(prog(f, t1b, t1b + 40));
						return {x: miss1.x + 70 * roll, y: miss1.y - 12 * Math.exp(-(f - t1b) / 6) * Math.abs(Math.sin((f - t1b) * 0.4)), scale: 80, rot: 600 + 90 * roll};
					})()}
					o={(1 - 0.55 * prog(f, t1b + 10, t1b + 40)) * (1 - smooth(prog(f, hit, hit + 30)))}
				/>
			)}

			{ball && ballO > 0.003 && <HisuiBall x={ball.x} y={ball.y} scale={ball.s} rot={ball.rot} glow={0.5 * Math.sin(Math.PI * streak) + capFlash} o={ballO} />}

			{/* 收服：顶部蒸汽与小烟花 */}
			{f >= T_CAUGHT && f < T_CAUGHT + 40 && (
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
					{Array.from({length: 12}, (_, i) => {
						const a = -Math.PI / 2 + (i - 5.5) * 0.22;
						const t = prog(f, T_CAUGHT, T_CAUGHT + 26);
						const top = {x: ballHold.x, y: 700 - 50};
						const len = 70 * easeOutCubic(t);
						return (
							<line
								key={i}
								x1={top.x + Math.cos(a) * len * 0.45}
								y1={top.y + Math.sin(a) * len * 0.45}
								x2={top.x + Math.cos(a) * len}
								y2={top.y + Math.sin(a) * len}
								stroke={`rgba(255,226,160,${1 - t})`}
								strokeWidth={2}
								strokeLinecap="round"
							/>
						);
					})}
					{Array.from({length: 5}, (_, i) => {
						const t = prog(f, T_CAUGHT + i * 2, T_CAUGHT + 30 + i * 2);
						return <circle key={i} cx={ballHold.x + (i - 2) * 9 + 12 * t * (i - 2)} cy={650 - 90 * easeOutCubic(t)} r={10 + 26 * t} fill={`rgba(240,226,200,${0.22 * (1 - t)})`} style={{filter: 'blur(6px)'}} />;
					})}
				</svg>
			)}

			{/* 配方：球果果 + 玉石 → 精灵球 */}
			{recipeO > 0 && (
				<div style={{position: 'absolute', inset: 0, opacity: recipeO}}>
					<div style={{position: 'absolute', left: 1250 - 120 + (BIG.x - 1250) * collapse, top: 330 - 120 + (BIG.y - 330) * collapse, transform: `scale(${1.4 * (1 - 0.7 * collapse)})`}}>
						<ApricornArt t={apriT} split={apriSplit} />
					</div>
					<Label x={1250} y={490} zh="球果果" en="APRICORN" o={smooth(prog(f, T_APRI + 16, T_APRI + 34)) * (1 - collapse)} />
					{/* 果壳两半连向球的两半 */}
					<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: apriSplit * (1 - collapse)}}>
						<path d={`M 1170 ${330 - 40} C 1000 ${330 - 70} 880 ${BIG.y - 140} ${BIG.x + 150} ${BIG.y - 90}`} fill="none" stroke={gold(0.55)} strokeWidth={1.2} strokeDasharray="5 6" />
						<path d={`M 1170 ${330 + 40} C 1000 ${330 + 70} 900 ${BIG.y + 110} ${BIG.x + 150} ${BIG.y + 80}`} fill="none" stroke={gold(0.55)} strokeWidth={1.2} strokeDasharray="5 6" />
					</svg>
					{stoneT > 0 && (
						<>
							<div style={{position: 'absolute', left: 1250 - 18, top: 548, fontFamily: SERIF, fontSize: 44, color: GOLD, opacity: smooth(prog(f, T_STONE2, T_STONE2 + 10)) * (1 - collapse)}}>＋</div>
							<div style={{position: 'absolute', left: 1250 - 120 + (BIG.x - 1250) * collapse, top: 640 - 90 + (BIG.y - 640) * collapse, transform: `scale(${1.3 * (1 - 0.7 * collapse)})`}}>
								<TumblestoneArt t={stoneT} />
							</div>
							<Label x={1250} y={722} zh="玉石" en="TUMBLESTONE" o={smooth(prog(f, T_STONE2 + 12, T_STONE2 + 30)) * (1 - collapse)} />
						</>
					)}
				</div>
			)}

			{f < bf(23, 1) && <BallGrid f={f} at={T_GRID + BEAT / 2} dx={GRID_SHIFT * smooth(prog(f, bf(20), bf(20, 1)))} o={1 - smooth(prog(f, bf(22, 1), bf(23)))} />}
		</>
	);
};
