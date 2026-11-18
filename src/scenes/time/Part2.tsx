import {CORMORANT, SERIF} from '../../fonts';
import {bf, ease, easeInQuad, easeOutCubic, env, lerp, prog, rnd, track} from './common';
import {Cam, GEM, INK, viewBounds} from './world';

/**
 * 中篇（第 4–5 段）画在星图上的东西（世界坐标）。
 *
 *   4 时间之箭：时间轴上流动的箭头 → 墨滴在水杯里散开 → 一副牌、52! 的 68 位数字 → 整副牌缩成一点、周围一大片灰点
 *     → 洗乱、洗不回去 → 所有东西顺着箭头流 → 逆着箭头摇回帝牙卢卡，光明涌来，第 30 小节起源形态
 *     → 箭头按拍左右翻转，墨聚回又散开，刻度时疏时密
 *   5 快与慢：往下摇到"我们的世界"：地球与 GPS 卫星、两只钟、导航偏差 → 升回神话那一层：雨中的花，
 *     时间轴上的游标往左（花倒长回芽、雨往上落）、往右（花开、谢、结籽）→ 雨慢到几乎悬停 → 推向帝牙卢卡
 */

export const AY = GEM[1];

// ════════ 时间之箭：轴上流动的箭头 ════════

/** 箭头方向：平时 +1；第 32 小节第 3 拍起按拍翻转（"方向会不断变化"） */
export const arrowDir = (f: number) =>
	track(f, [
		[bf(32, 2) - 1, 1],
		[bf(32, 2) + 7, -1],
		[bf(33) - 1, -1],
		[bf(33) + 7, 1],
		[bf(33, 1) - 1, 1],
		[bf(33, 1) + 6, -1],
		[bf(33, 2) - 1, -1],
		[bf(33, 2) + 6, 1],
		[bf(33, 3) - 1, 1],
		[bf(33, 3) + 6, -1],
		[bf(34) - 1, -1],
		[bf(34) + 8, 1],
	]);
/** 箭头流速（"速度也不固定"：第 33 小节第 3 拍起时快时慢） */
const arrowSpeed = (f: number) => {
	const base = track(f, [
		[bf(22), 0],
		[bf(22, 2), 4],
		[bf(28, 2), 4],
		[bf(29), 9],
		[bf(29, 2), 9],
		[bf(30), 3],
		[bf(33, 2), 3.5],
	]);
	const vary = f > bf(33, 2) && f < bf(34, 2) ? 1 + 0.9 * Math.sin((f - bf(33, 2)) * 0.55) : 1;
	return base * vary;
};
/** 箭头位移：流速 × 方向 的积分（半帧步长，确定性） */
const arrowOffset = (f: number) => {
	let acc = 0;
	const a = bf(22);
	for (let t = a; t < f; t += 0.5) acc += arrowSpeed(t) * arrowDir(t) * Math.min(0.5, f - t);
	return acc;
};

const CHEV = 240;
export const TimeArrows: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const a = env(f, bf(22), bf(34, 3), 20, 24);
	if (a <= 0) return null;
	const off = arrowOffset(f);
	const dir = arrowDir(f);
	const b = viewBounds(c, CHEV);
	// 从帝牙卢卡胸口往右画开
	const reach = lerp(GEM[0], 3400, easeOutCubic(prog(f, bf(22), bf(23))));
	const glow = 0.55 + 0.45 * env(f, bf(28, 2), bf(29, 2), 6, 10);
	const els: React.ReactNode[] = [];
	const k0 = Math.floor((b.x0 - off) / CHEV);
	const k1 = Math.ceil((b.x1 - off) / CHEV);
	for (let k = k0; k <= k1; k++) {
		const x = k * CHEV + off;
		if (x < GEM[0] + 60 || x > reach) continue;
		const s = 1;
		els.push(
			<path
				key={k}
				d={`M${x - 16 * dir} ${AY - 22 * s}L${x + 10 * dir} ${AY}L${x - 16 * dir} ${AY + 22 * s}`}
				fill="none"
				stroke={`rgba(${INK.cyanRgb},${0.75 * glow})`}
				strokeWidth={2.4}
				strokeLinecap="round"
				strokeLinejoin="round"
				vectorEffect="non-scaling-stroke"
			/>,
		);
	}
	// 一串流动的小刻度：时疏时密
	const ticks: React.ReactNode[] = [];
	const step = 60;
	for (let k = Math.floor((b.x0 - off * 1.6) / step); k <= Math.ceil((b.x1 - off * 1.6) / step); k++) {
		const x = k * step + off * 1.6;
		if (x < GEM[0] + 40 || x > reach) continue;
		ticks.push(<line key={k} x1={x} y1={AY - 7} x2={x} y2={AY + 7} stroke={INK.lineSoft} strokeWidth={1} vectorEffect="non-scaling-stroke" />);
	}
	return (
		<g opacity={a}>
			{ticks}
			<g filter="url(#tm-glow)">{els}</g>
		</g>
	);
};

// ════════ 墨滴与水杯 ════════

export const GLASS = {x: 380, w: 210, h: 300};
const GLASS_TOP = AY - GLASS.h;
const WATER_TOP = GLASS_TOP + 46;
const INK_DROP = bf(23);
/** 墨的散开程度：0 = 一滴，1 = 散满；第 31 小节第 3 拍起跟着箭头聚回、散开 */
const inkSpread = (f: number) =>
	track(f, [
		[INK_DROP + 10, 0],
		[bf(24, 2), 0.82],
		[bf(28, 2), 0.95],
		[bf(29, 2), 1],
		[bf(31, 2), 1],
		[bf(32, 2) + 4, 0.08],
		[bf(33), 0.85],
		[bf(33, 2) + 3, 0.12],
		[bf(34), 0.9],
	]);

export const InkGlass: React.FC<{f: number}> = ({f}) => {
	const a = env(f, bf(22, 2), bf(35), 16, 20);
	if (a <= 0) return null;
	const {x, w, h} = GLASS;
	const draw = easeOutCubic(prog(f, bf(22, 2), bf(23)));
	const rt = w / 2;
	const rb = w * 0.4;
	const outline = `M${x - rt} ${GLASS_TOP}L${x - rb} ${AY}L${x + rb} ${AY}L${x + rt} ${GLASS_TOP}`;
	const s = inkSpread(f);
	// 墨滴落下
	const dropY = f < INK_DROP ? GLASS_TOP - 160 : Math.min(WATER_TOP + 6, GLASS_TOP - 160 + 0.5 * 3.2 * Math.pow(f - INK_DROP, 2));
	const dropIn = f >= INK_DROP - 12 && f < INK_DROP + 10;
	const plumes = Array.from({length: 9}, (_, i) => {
		const ang = rnd(i * 2.3) * Math.PI * 2;
		const reachX = (rnd(i * 4.1) - 0.5) * w * 0.7;
		const reachY = 40 + rnd(i * 5.7) * (h - 90);
		const px = x + reachX * s;
		const py = WATER_TOP + 10 + reachY * Math.pow(s, 0.8);
		const r = 10 + s * (40 + rnd(i * 7.1) * 40);
		return <circle key={i} cx={px + Math.cos(ang) * 6 * s} cy={py} r={r} fill={`rgba(120,140,255,${0.42 - 0.18 * s})`} />;
	});
	return (
		<g opacity={a}>
			<defs>
				<clipPath id="tm-glass-in">
					<path d={`M${x - rt + 4} ${WATER_TOP}L${x - rb + 3} ${AY - 3}L${x + rb - 3} ${AY - 3}L${x + rt - 4} ${WATER_TOP}Z`} />
				</clipPath>
				<filter id="tm-ink" x="-20%" y="-20%" width="140%" height="140%">
					<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={3} seed={7} result="n" />
					<feDisplacementMap in="SourceGraphic" in2="n" scale={60} xChannelSelector="R" yChannelSelector="G" result="d" />
					<feGaussianBlur in="d" stdDeviation="7" />
				</filter>
			</defs>
			<path d={`${outline}Z`} fill="url(#tm-glass)" opacity={draw} />
			<rect x={x - rt} y={WATER_TOP} width={w} height={AY - WATER_TOP} fill="rgba(90,140,230,0.1)" clipPath="url(#tm-glass-in)" opacity={draw} />
			{f >= INK_DROP + 6 ? (
				<g clipPath="url(#tm-glass-in)">
					<g filter="url(#tm-ink)">{plumes}</g>
				</g>
			) : null}
			<line x1={x - rt + 4} y1={WATER_TOP} x2={x + rt - 4} y2={WATER_TOP} stroke={INK.lineSoft} strokeWidth={1.2} vectorEffect="non-scaling-stroke" opacity={draw} />
			<path d={outline} fill="none" stroke={INK.line} strokeWidth={2} vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={`${draw} 1`} />
			<ellipse cx={x} cy={GLASS_TOP} rx={rt} ry={12} fill="none" stroke={INK.line} strokeWidth={1.8} vectorEffect="non-scaling-stroke" opacity={draw} />
			{dropIn ? <circle cx={x} cy={dropY} r={9} fill="rgba(140,160,255,0.95)" filter="url(#tm-glow)" /> : null}
			{/* 熵 ↑ 的小标注 */}
			<g opacity={env(f, bf(23, 2), bf(28, 2), 10, 14)}>
				<line x1={x + rt + 10} y1={WATER_TOP + 90} x2={x + rt + 70} y2={WATER_TOP + 40} stroke={INK.cyan} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
				<text x={x + rt + 78} y={WATER_TOP + 36} fill="rgba(220,236,255,0.95)" fontFamily={SERIF} fontSize={34} letterSpacing={3}>
					散开 · 熵 ↑
				</text>
			</g>
		</g>
	);
};

// ════════ 一副牌 ════════

export const CARDS = {x: 1350, y: AY - 270};
const CW = 46;
const CH = 64;
const GAP = 8;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♣', '♦'];
const slot = (i: number): [number, number] => {
	const col = i % 13;
	const row = Math.floor(i / 13);
	return [CARDS.x + (col - 6) * (CW + GAP), CARDS.y + (row - 1.5) * (CH + GAP + 6)];
};
/** 几次洗牌（确定性的随机排列） */
const perm = (seed: number) => {
	const p = Array.from({length: 52}, (_, i) => i);
	for (let i = 51; i > 0; i--) {
		const j = Math.floor(rnd(seed * 97 + i * 1.37) * (i + 1));
		[p[i], p[j]] = [p[j], p[i]];
	}
	return p;
};
const SHUFFLES: [number, number[]][] = [
	[bf(27, 2), perm(1)],
	[bf(27, 3), perm(2)],
	[bf(28), perm(3)],
	[bf(28, 1), perm(4)],
];
const CARDS_ON = bf(24, 2);
const COLLAPSE = bf(26, 2);
const REOPEN = bf(27, 2) - 8;

export const Deck: React.FC<{f: number}> = ({f}) => {
	const a = env(f, CARDS_ON, bf(29, 1), 8, 18);
	if (a <= 0) return null;
	// 第 23 句：整副牌缩成一点；第 24 句前重新展开
	const shrink = Math.min(ease(prog(f, COLLAPSE, COLLAPSE + 12)), 1 - ease(prog(f, REOPEN, REOPEN + 8)));
	// 第 25 句：顺着箭头往右流
	const drift = easeInQuad(prog(f, bf(28, 2), bf(29, 1))) * 900;
	return (
		<g opacity={a}>
			{Array.from({length: 52}, (_, i) => {
				let [x, y] = slot(i);
				for (const [t0, p] of SHUFFLES) {
					if (f < t0) break;
					const k = ease(prog(f, t0, t0 + 9));
					const prev = SHUFFLES.indexOf(SHUFFLES.find((s) => s[0] === t0)!);
					const from = prev === 0 ? slot(i) : slot(SHUFFLES[prev - 1][1].indexOf(i));
					const to = slot(p.indexOf(i));
					x = lerp(from[0], to[0], k);
					y = lerp(from[1], to[1], k);
				}
				const appear = easeOutCubic(prog(f, CARDS_ON + i * 0.35, CARDS_ON + i * 0.35 + 8));
				if (appear <= 0) return null;
				const cx = lerp(x, CARDS.x, shrink);
				const cy = lerp(y, CARDS.y, shrink);
				const sc = appear * (1 - shrink * 0.97);
				const suit = Math.floor(i / 13);
				const red = suit % 2 === 1;
				return (
					<g key={i} transform={`translate(${cx + drift * (0.6 + rnd(i) * 0.8)} ${cy}) scale(${sc})`}>
						<rect x={-CW / 2} y={-CH / 2} width={CW} height={CH} rx={5} fill="rgba(20,34,70,0.85)" stroke={INK.lineSoft} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
						<text x={-CW / 2 + 6} y={-CH / 2 + 18} fill={red ? 'rgba(255,170,200,0.95)' : 'rgba(225,236,255,0.95)'} fontFamily={CORMORANT} fontSize={17} fontWeight={500}>
							{RANKS[i % 13]}
						</text>
						<text x={0} y={12} textAnchor="middle" fill={red ? 'rgba(255,170,200,0.9)' : 'rgba(225,236,255,0.9)'} fontSize={24}>
							{SUITS[suit]}
						</text>
					</g>
				);
			})}
		</g>
	);
};

/** 52! 的 68 位数字，第 22 句逐位滚出 */
const FACT52 = '80658175170943878571660636856403766975289505440883277824000000000000';
export const BigNumber: React.FC<{f: number}> = ({f}) => {
	const a = env(f, bf(25, 2), bf(26, 2) + 6, 6, 10);
	if (a <= 0) return null;
	const rows = 4;
	const per = 17;
	const lockAt = (i: number) => bf(25, 2) + 4 + i * 0.34;
	const x0 = CARDS.x - (per * 30) / 2;
	const y0 = CARDS.y - 70;
	const done = prog(f, lockAt(67), lockAt(67) + 8);
	return (
		<g opacity={a}>
			<rect x={x0 - 40} y={y0 - 60} width={per * 30 + 80} height={rows * 54 + 150} rx={8} fill="rgba(6,12,30,0.82)" stroke={INK.faint} strokeWidth={1} vectorEffect="non-scaling-stroke" />
			{Array.from({length: 68}, (_, i) => {
				const r = Math.floor(i / per);
				const c = i % per;
				const locked = f >= lockAt(i);
				const ch = locked ? FACT52[i] : String(Math.floor(rnd(i * 13 + Math.floor(f * 2)) * 10));
				return (
					<text key={i} x={x0 + c * 30 + 15} y={y0 + r * 54} textAnchor="middle" fill={locked ? 'rgba(230,240,255,0.96)' : `rgba(${INK.cyanRgb},0.55)`} fontFamily={CORMORANT} fontSize={44} fontWeight={500}>
						{ch}
					</text>
				);
			})}
			<text x={CARDS.x} y={y0 + rows * 54 + 40} textAnchor="middle" fill={`rgba(${INK.cyanRgb},${done})`} fontFamily={SERIF} fontSize={46} letterSpacing={3}>
				52! ≈ 8 × 10<tspan dy={-18} fontSize={28}>67</tspan>
				<tspan dy={18}> 种</tspan>
			</text>
		</g>
	);
};

/** 第 23 句：一大片灰点里只有一个亮点 */
export const DotField: React.FC<{f: number}> = ({f}) => {
	const a = env(f, COLLAPSE + 4, REOPEN + 4, 10, 8);
	if (a <= 0) return null;
	const cols = 44;
	const rows = 26;
	const sp = 22;
	const spread = easeOutCubic(prog(f, COLLAPSE + 4, COLLAPSE + 22));
	const els: React.ReactNode[] = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const dx = (c - (cols - 1) / 2) * sp;
			const dy = (r - (rows - 1) / 2) * sp;
			const d = Math.hypot(dx, dy);
			if (d > spread * 560) continue;
			els.push(<circle key={`${r}-${c}`} cx={CARDS.x + dx + (rnd(r * 99 + c) - 0.5) * 6} cy={CARDS.y + dy + (rnd(r * 77 + c * 3) - 0.5) * 6} r={2.6} fill="rgba(140,160,200,0.45)" />);
		}
	}
	const pulse = 0.6 + 0.4 * Math.sin(f * 0.3);
	return (
		<g opacity={a}>
			{els}
			<circle cx={CARDS.x} cy={CARDS.y} r={7} fill="#f4f9ff" filter="url(#tm-glow)" />
			<circle cx={CARDS.x} cy={CARDS.y} r={22 + 6 * pulse} fill="none" stroke={`rgba(${INK.cyanRgb},0.9)`} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
			<line x1={CARDS.x + 26} y1={CARDS.y - 20} x2={CARDS.x + 120} y2={CARDS.y - 110} stroke={INK.cyan} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
			<text x={CARDS.x + 128} y={CARDS.y - 118} fill="rgba(230,240,255,0.97)" fontFamily={SERIF} fontSize={36} letterSpacing={3}>
				按顺序：1 种
			</text>
		</g>
	);
};

// ════════ 5 快与慢：我们的世界 ════════

export const EARTH = {x: 180, y: 2560, r: 150};
const ORBIT_R = 320;
const PANEL = {x: 820, y: 2400};
const MAP = {x: 940, y: 2760, w: 560, h: 220};
const GPS_ON = bf(34, 2);
const GPS_OFF = bf(39);

export const Clock: React.FC<{x: number; y: number; t: number; label: string; lead: number}> = ({x, y, t, label, lead}) => {
	const sec = (t * 6) % 360;
	return (
		<g transform={`translate(${x} ${y})`}>
			<circle r={92} fill="rgba(14,26,60,0.7)" stroke={INK.line} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
			{Array.from({length: 60}, (_, k) => {
				const a = (k / 60) * Math.PI * 2;
				const big = k % 5 === 0;
				return <line key={k} x1={Math.sin(a) * 92} y1={-Math.cos(a) * 92} x2={Math.sin(a) * (big ? 78 : 85)} y2={-Math.cos(a) * (big ? 78 : 85)} stroke={big ? INK.line : INK.lineSoft} strokeWidth={big ? 1.6 : 0.9} vectorEffect="non-scaling-stroke" />;
			})}
			{lead > 0 ? <path d={`M0 0L${Math.sin((sec * Math.PI) / 180) * 70} ${-Math.cos((sec * Math.PI) / 180) * 70}A70 70 0 0 1 ${Math.sin(((sec + lead) * Math.PI) / 180) * 70} ${-Math.cos(((sec + lead) * Math.PI) / 180) * 70}Z`} fill={`rgba(${INK.cyanRgb},0.35)`} /> : null}
			<line x1={0} y1={0} x2={Math.sin(((sec + lead) * Math.PI) / 180) * 80} y2={-Math.cos(((sec + lead) * Math.PI) / 180) * 80} stroke={lead > 0 ? INK.cyan : INK.silver} strokeWidth={2.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
			<circle r={5} fill={INK.silver} />
			<text y={128} textAnchor="middle" fill="rgba(230,240,255,0.95)" fontFamily={SERIF} fontSize={32} letterSpacing={4}>
				{label}
			</text>
		</g>
	);
};

export const GpsWorld: React.FC<{f: number}> = ({f}) => {
	const a = env(f, GPS_ON, GPS_OFF, 16, 22);
	if (a <= 0) return null;
	const t = (f - GPS_ON) / 30;
	// 卫星在地球左侧逆时针走，不撞到右边的钟和地图
	const satA = -Math.PI * 0.62 - (f - GPS_ON) * 0.006;
	const sx = EARTH.x + Math.cos(satA) * ORBIT_R;
	const sy = EARTH.y + Math.sin(satA) * ORBIT_R;
	// 卫星钟领先的角度（夸张显示；读数才是真数据）
	const lead = 34 * easeOutCubic(prog(f, bf(35, 2), bf(36, 2)));
	const micro = 38 * easeOutCubic(prog(f, bf(35, 2), bf(36, 2)));
	const km = 10 * easeOutCubic(prog(f, bf(36, 3), bf(37, 3)));
	const mapA = env(f, bf(36, 2), GPS_OFF, 12, 22);
	return (
		<g opacity={a}>
			{/* 地球与轨道 */}
			<circle cx={EARTH.x} cy={EARTH.y} r={EARTH.r} fill="rgba(40,80,170,0.28)" stroke={INK.line} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
			{[-50, -20, 10, 40].map((lat) => (
				<ellipse key={lat} cx={EARTH.x} cy={EARTH.y + (lat / 90) * EARTH.r} rx={EARTH.r * Math.cos((lat * Math.PI) / 180)} ry={8} fill="none" stroke={INK.faint} strokeWidth={1} vectorEffect="non-scaling-stroke" />
			))}
			{[0, 45, 90, 135].map((m) => (
				<ellipse key={m} cx={EARTH.x} cy={EARTH.y} rx={Math.abs(Math.cos(((m + f * 0.8) * Math.PI) / 180)) * EARTH.r} ry={EARTH.r} fill="none" stroke={INK.faint} strokeWidth={1} vectorEffect="non-scaling-stroke" />
			))}
			<circle cx={EARTH.x} cy={EARTH.y} r={ORBIT_R} fill="none" stroke={INK.lineSoft} strokeWidth={1.2} strokeDasharray="6 10" vectorEffect="non-scaling-stroke" />
			<g transform={`translate(${sx} ${sy}) rotate(${(satA * 180) / Math.PI + 90})`}>
				<rect x={-46} y={-7} width={30} height={14} fill="rgba(90,140,230,0.5)" stroke={INK.line} strokeWidth={1} vectorEffect="non-scaling-stroke" />
				<rect x={16} y={-7} width={30} height={14} fill="rgba(90,140,230,0.5)" stroke={INK.line} strokeWidth={1} vectorEffect="non-scaling-stroke" />
				<rect x={-12} y={-12} width={24} height={24} fill="rgba(220,230,250,0.85)" />
			</g>
			<text x={sx + 44} y={sy - 30} fill="rgba(200,225,255,0.9)" fontFamily={SERIF} fontSize={28} letterSpacing={2}>
				GPS 卫星 · 高约 2 万公里
			</text>
			{/* 两只钟 */}
			<Clock x={PANEL.x} y={PANEL.y} t={t} label="地面" lead={0} />
			<Clock x={PANEL.x + 300} y={PANEL.y} t={t} label="卫星" lead={lead} />
			<g opacity={env(f, bf(35, 2), GPS_OFF, 10, 22)}>
				<text x={PANEL.x + 150} y={PANEL.y - 140} textAnchor="middle" fill={`rgba(${INK.cyanRgb},0.98)`} fontFamily={SERIF} fontSize={46} letterSpacing={2}>
					每天快 {micro.toFixed(0)} 微秒
				</text>
				<text x={PANEL.x + 150} y={PANEL.y - 98} textAnchor="middle" fill="rgba(170,200,245,0.85)" fontFamily={CORMORANT} fontStyle="italic" fontSize={28}>
					+45.9 μs（引力弱）− 7.2 μs（跑得快）≈ +38 μs / 天
				</text>
			</g>
			{/* 导航偏差地图 */}
			<g opacity={mapA}>
				<rect x={MAP.x - MAP.w / 2} y={MAP.y - MAP.h / 2} width={MAP.w} height={MAP.h} fill="rgba(10,20,46,0.75)" stroke={INK.lineSoft} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
				{Array.from({length: 9}, (_, k) => (
					<line key={`v${k}`} x1={MAP.x - MAP.w / 2 + (k + 1) * (MAP.w / 10)} y1={MAP.y - MAP.h / 2} x2={MAP.x - MAP.w / 2 + (k + 1) * (MAP.w / 10) + (k % 3) * 6} y2={MAP.y + MAP.h / 2} stroke={INK.faint} strokeWidth={1} vectorEffect="non-scaling-stroke" />
				))}
				{Array.from({length: 3}, (_, k) => (
					<line key={`h${k}`} x1={MAP.x - MAP.w / 2} y1={MAP.y - MAP.h / 2 + (k + 1) * (MAP.h / 4)} x2={MAP.x + MAP.w / 2} y2={MAP.y - MAP.h / 2 + (k + 1) * (MAP.h / 4)} stroke={INK.faint} strokeWidth={1} vectorEffect="non-scaling-stroke" />
				))}
				<circle cx={MAP.x - 200} cy={MAP.y + 10} r={9} fill={INK.silver} />
				<text x={MAP.x - 200} y={MAP.y + 52} textAnchor="middle" fill="rgba(230,240,255,0.9)" fontFamily={SERIF} fontSize={24}>
					你在这里
				</text>
				<line x1={MAP.x - 200} y1={MAP.y + 10} x2={MAP.x - 200 + km * 40} y2={MAP.y + 10 - km * 4} stroke={INK.cyan} strokeWidth={1.4} strokeDasharray="5 6" vectorEffect="non-scaling-stroke" />
				<circle cx={MAP.x - 200 + km * 40} cy={MAP.y + 10 - km * 4} r={11} fill={`rgba(${INK.cyanRgb},0.9)`} filter="url(#tm-glow)" />
				<text x={MAP.x + 20} y={MAP.y - MAP.h / 2 - 22} textAnchor="middle" fill={`rgba(${INK.cyanRgb},0.98)`} fontFamily={SERIF} fontSize={40} letterSpacing={2}>
					一天后，导航偏出 {km.toFixed(1)} 公里
				</text>
			</g>
		</g>
	);
};

// ════════ 5 雨中的花：去往过去，也去往未来 ════════

export const FLOWER = {x: 120, y: AY};
const RAIN_ON = bf(38, 2);
const RAIN_OFF = bf(44) + 30;

/** 游标：0 = 现在；负 = 过去，正 = 未来 */
const cursorAt = (f: number) =>
	track(f, [
		[bf(40, 2), 0],
		[bf(40, 3) + 4, -1],
		[bf(40, 3) + 10, -1],
		[bf(41, 1) + 6, 1],
		[bf(41, 2), 1],
		[bf(41, 3) + 6, 0],
	]);
/** 花的生长：0 = 芽，0.55 = 盛开，1 = 谢了、结籽 */
const growthAt = (f: number) => {
	const c = cursorAt(f);
	return c < 0 ? lerp(0.55, 0.04, -c) : lerp(0.55, 1, c);
};
/** 雨速：游标往过去时雨往上落；第 41 小节第 4 拍到第 43 小节几乎悬停；第 42 小节强拍恢复 */
const rainSpeed = (f: number) => {
	const c = cursorAt(f);
	const dirV = f > bf(40, 2) && f < bf(41, 3) + 6 ? (c < -0.05 ? -1.4 : c > 0.05 ? 1.6 : 1) : 1;
	const hang = track(f, [
		[bf(41, 3), 1],
		[bf(42) - 14, 0.03],
		[bf(42) - 1, 0.03],
		[bf(42) + 6, 1],
	]);
	return dirV * hang;
};
const rainTime = (f: number) => {
	let acc = 0;
	for (let t = RAIN_ON - 60; t < f; t += 0.5) acc += rainSpeed(t) * Math.min(0.5, f - t);
	return acc;
};
const DROPS = Array.from({length: 240}, (_, i) => ({x: rnd(i * 1.7) * 2600 - 1500, y: rnd(i * 3.1) * 1400, v: 18 + rnd(i * 5.3) * 10, l: 26 + rnd(i * 2.2) * 30}));

export const Rain: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const a = env(f, RAIN_ON, RAIN_OFF, 20, 20);
	if (a <= 0) return null;
	const tr = rainTime(f);
	const sp = rainSpeed(f);
	const b = viewBounds(c, 40);
	const top = AY - 1100;
	return (
		<g opacity={a * 0.8}>
			{DROPS.map((d, i) => {
				const x = d.x;
				const y = top + ((((d.y + d.v * tr) % 1400) + 1400) % 1400);
				if (x < b.x0 || x > b.x1 || y < b.y0 || y > AY) return null;
				const len = d.l * Math.max(0.12, Math.min(1.4, Math.abs(sp)));
				return <line key={i} x1={x} y1={y} x2={x - 3} y2={y - len * Math.sign(sp || 1)} stroke="rgba(190,215,255,0.55)" strokeWidth={1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
			})}
		</g>
	);
};

/** 线描的花（植物图谱的画法） */
export const Flower: React.FC<{f: number}> = ({f}) => {
	const a = env(f, RAIN_ON, RAIN_OFF, 20, 20);
	if (a <= 0) return null;
	const g = growthAt(f);
	const {x, y} = FLOWER;
	const stemH = lerp(40, 340, Math.min(1, g / 0.5));
	const sway = Math.sin(f * 0.04) * 6;
	const tx = x + sway;
	const ty = y - stemH;
	const bloom = g < 0.25 ? 0 : g < 0.55 ? (g - 0.25) / 0.3 : 1;
	const wilt = g > 0.62 ? Math.min(1, (g - 0.62) / 0.25) : 0;
	const seed = g > 0.85 ? (g - 0.85) / 0.15 : 0;
	const petals = Array.from({length: 7}, (_, k) => {
		const ang = (k / 7) * 360 + 10;
		const len = 18 + 70 * bloom * (1 - 0.55 * wilt);
		const droop = wilt * 55;
		const o = 1 - Math.max(0, wilt - 0.6) * 2.5;
		if (o <= 0) return null;
		return (
			<g key={k} transform={`translate(${tx} ${ty}) rotate(${ang}) rotate(${droop * Math.sign(Math.sin((ang * Math.PI) / 180))})`} opacity={o}>
				<path d={`M0 0C${len * 0.3} ${-len * 0.35} ${len * 0.85} ${-len * 0.28} ${len} 0C${len * 0.85} ${len * 0.28} ${len * 0.3} ${len * 0.35} 0 0Z`} fill="rgba(170,190,255,0.16)" stroke={INK.line} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
			</g>
		);
	});
	// 落下的花瓣
	const fallen = wilt > 0.6 ? Array.from({length: 5}, (_, k) => <ellipse key={k} cx={x - 80 + k * 38} cy={y - 6} rx={14} ry={5} fill="rgba(170,190,255,0.25)" stroke={INK.lineSoft} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={Math.min(1, (wilt - 0.6) * 2.5)} />) : null;
	return (
		<g opacity={a}>
			<path d={`M${x} ${y}C${x + 10} ${y - stemH * 0.4} ${tx - 14} ${y - stemH * 0.7} ${tx} ${ty}`} fill="none" stroke={INK.line} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
			{g > 0.15 ? (
				<>
					<path d={`M${x + 4} ${y - stemH * 0.35}C${x + 50} ${y - stemH * 0.5} ${x + 90} ${y - stemH * 0.42} ${x + 104} ${y - stemH * 0.3 + wilt * 30}C${x + 70} ${y - stemH * 0.28} ${x + 34} ${y - stemH * 0.26} ${x + 4} ${y - stemH * 0.35}Z`} fill="rgba(140,220,200,0.12)" stroke={INK.lineSoft} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
					<path d={`M${x + 2} ${y - stemH * 0.55}C${x - 40} ${y - stemH * 0.7} ${x - 80} ${y - stemH * 0.64} ${x - 96} ${y - stemH * 0.52 + wilt * 30}C${x - 64} ${y - stemH * 0.48} ${x - 30} ${y - stemH * 0.47} ${x + 2} ${y - stemH * 0.55}Z`} fill="rgba(140,220,200,0.12)" stroke={INK.lineSoft} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
				</>
			) : null}
			{petals}
			{/* 花心 / 花苞 / 种子 */}
			<circle cx={tx} cy={ty} r={g < 0.25 ? 10 + g * 30 : 14} fill={seed > 0 ? 'rgba(240,211,138,0.5)' : 'rgba(240,211,138,0.85)'} stroke={INK.gold} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
			{seed > 0
				? Array.from({length: 10}, (_, k) => {
						const an = (k / 10) * Math.PI * 2;
						return <line key={k} x1={tx} y1={ty} x2={tx + Math.cos(an) * 30 * seed} y2={ty + Math.sin(an) * 30 * seed} stroke={`rgba(${INK.goldRgb},0.7)`} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
					})
				: null}
			{fallen}
		</g>
	);
};

/** 时间轴上的游标：标着"过去 / 现在 / 未来" */
export const Cursor: React.FC<{f: number}> = ({f}) => {
	const a = env(f, bf(39), bf(43), 14, 20);
	if (a <= 0) return null;
	const c = cursorAt(f);
	const x = FLOWER.x + c * 380;
	const lab = (t: string, xx: number, on: number) => (
		<text x={xx} y={AY + 64} textAnchor="middle" fill={`rgba(220,236,255,${0.45 + 0.55 * on})`} fontFamily={SERIF} fontSize={34} letterSpacing={6}>
			{t}
		</text>
	);
	return (
		<g opacity={a}>
			{lab('过去', FLOWER.x - 380, Math.max(0, -c))}
			{lab('现在', FLOWER.x, 1 - Math.abs(c))}
			{lab('未来', FLOWER.x + 380, Math.max(0, c))}
			<path d={`M${x} ${AY - 6}l-12 -20h24z`} fill={INK.cyan} filter="url(#tm-glow)" />
			<line x1={x} y1={AY - 6} x2={x} y2={AY + 18} stroke={INK.cyan} strokeWidth={2} vectorEffect="non-scaling-stroke" />
		</g>
	);
};

export const Part2World: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	if (f < bf(22) - 2 || f > bf(44) + 60) return null;
	return (
		<g>
			<TimeArrows f={f} c={c} />
			<InkGlass f={f} />
			<DotField f={f} />
			<Deck f={f} />
			<BigNumber f={f} />
			<GpsWorld f={f} />
			<Rain f={f} c={c} />
			<Flower f={f} />
			<Cursor f={f} />
		</g>
	);
};

