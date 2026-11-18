import {CINZEL, CORMORANT, SERIF} from '../../fonts';
import {bf, BEAT, ease, easeInQuad, easeOutCubic, env, flowTime, lerp, prog, rnd, track} from './common';
import {Cup} from './Part1';
import {Clock} from './Part2';
import {escapePath, gearPath, INK, ORIGIN} from './world';

/**
 * 下篇（第 6–7 段）画在星图上的东西（世界坐标）。
 *
 *   6 时光咆哮：光点汇向口中蓄力 → 前面所有的图表飞回来，围着它拼成一整张星图（四个词一拍点亮一圈）
 *     → 第 52 小节咆哮：扭曲 / 第 53 小节：破坏（碎成刻度和数字的碎片）/ 第 54 小节：再生（碎片倒飞拼回，箭头变成金蓝两头）
 *     → 第 58 小节"下一回合自己将无法动弹"：一切定住，只有晶体还在慢慢跳
 *   7 心跳：回到开场那只杯子；下面是观众的心电线，上面是帝牙卢卡的脉搏；三个光点落下（心灵）→ 两条线的心跳慢慢对齐 → 淡出
 */

// ════════ 6 时光咆哮 ════════

/** 起源形态的嘴（立绘镜像后在 (0.72, 0.16)） */
export const MOUTH: [number, number] = [ORIGIN.x + 0.22 * ORIGIN.size, ORIGIN.y + (0.16 - 0.5) * ORIGIN.size];
/** 星图的中心（帝牙卢卡胸前） */
const PC: [number, number] = [ORIGIN.x + 40, ORIGIN.y - 40];

export const ROAR = bf(52);
const BREAK = bf(53);
const REGEN = bf(54);
const REGEN_DONE = bf(54, 1.5);
const CHART_IN = bf(47);
/** 蓄力：第 44 小节起慢慢变强，第 51 小节第 4 拍最强，咆哮后散去 */
export const chargeAt = (f: number) =>
	track(f, [
		[bf(44), 0],
		[bf(47), 0.35],
		[bf(50), 0.5],
		[bf(51, 3), 1],
		[ROAR + 2, 1.15],
		[bf(53, 2), 0.3],
		[bf(55), 0.1],
	]);
/** 扭曲：咆哮那一拍拧弯，碎裂前最强 */
const warpAt = (f: number) =>
	track(f, [
		[bf(51), 0],
		[bf(51, 3), 6],
		[ROAR, 10],
		[ROAR + 8, 95],
		[BREAK - 2, 70],
		[BREAK + 10, 20],
		[REGEN, 0],
	]);

/** 碎片的时间 τ：第 53 小节炸开，第 54 小节倒飞回来 */
const shardTau = (f: number) => {
	if (f < BREAK) return 0;
	const tMax = REGEN - BREAK;
	if (f < REGEN) return f - BREAK;
	return tMax * (1 - ease(prog(f, REGEN, REGEN_DONE)));
};

/** 光点汇向口中 */
export const ChargeMotes: React.FC<{f: number}> = ({f}) => {
	const a = env(f, bf(44), ROAR + 4, 20, 3);
	if (a <= 0) return null;
	const k = chargeAt(f);
	return (
		<g opacity={a}>
			{Array.from({length: 46}, (_, i) => {
				const period = 40 + rnd(i * 2.1) * 30;
				const ph = (((f - bf(44)) / period + rnd(i * 3.7)) % 1 + 1) % 1;
				const ang = rnd(i * 5.3) * Math.PI * 2;
				const r0 = 380 + rnd(i * 7.9) * 420;
				const r = r0 * (1 - easeInQuad(ph));
				const x = MOUTH[0] + Math.cos(ang) * r;
				const y = MOUTH[1] + Math.sin(ang) * r * 0.8;
				const tail = 30 + 60 * k;
				return (
					<g key={i}>
						<line x1={x} y1={y} x2={x + Math.cos(ang) * tail} y2={y + Math.sin(ang) * tail * 0.8} stroke={`rgba(${INK.cyanRgb},${0.5 * ph * k})`} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
						<circle cx={x} cy={y} r={3 + 3 * k} fill={`rgba(220,240,255,${0.9 * ph})`} />
					</g>
				);
			})}
			<circle cx={MOUTH[0]} cy={MOUTH[1]} r={20 + 70 * k} fill={`rgba(${INK.cobaltRgb},${0.35 * k})`} filter="url(#tm-glow)" />
			<circle cx={MOUTH[0]} cy={MOUTH[1]} r={8 + 22 * k} fill={`rgba(235,245,255,${0.8 * k})`} filter="url(#tm-glow)" />
		</g>
	);
};

/** 一块星图碎片：位置随 τ 炸开、旋转，再倒飞回来 */
const Piece: React.FC<{i: number; cx: number; cy: number; f: number; children: React.ReactNode}> = ({i, cx, cy, f, children}) => {
	const tau = shardTau(f);
	if (tau <= 0) return <g>{children}</g>;
	const dx = cx - PC[0];
	const dy = cy - PC[1];
	const d = Math.max(1, Math.hypot(dx, dy));
	const sp = 9 + rnd(i * 3.3) * 12;
	const ox = (dx / d) * sp * tau + (rnd(i * 5.1) - 0.5) * 3 * tau;
	const oy = (dy / d) * sp * tau + (rnd(i * 7.3) - 0.5) * 3 * tau;
	const rot = (rnd(i * 9.7) - 0.5) * 14 * tau;
	return <g transform={`translate(${ox} ${oy}) rotate(${rot} ${cx} ${cy})`}>{children}</g>;
};

/** 环上的一段弧 */
const arcD = (r: number, a0: number, a1: number) => {
	const p = (a: number) => `${(PC[0] + Math.cos(a) * r).toFixed(1)} ${(PC[1] + Math.sin(a) * r).toFixed(1)}`;
	return `M${p(a0)}A${r} ${r} 0 0 1 ${p(a1)}`;
};

const R = {change: 330, beat: 430, arrow: 530, gear: 640};
const WORDS: [string, number, number][] = [
	// [词, 环半径, 点亮的拍]
	['变化', R.change, bf(48)],
	['节拍', R.beat, bf(48, 1)],
	['箭头', R.arrow, bf(48, 2)],
	['快慢', R.arrow + 70, bf(48, 3)],
];

/** 第 6 段的整张星图 */
export const StarChart: React.FC<{f: number}> = ({f}) => {
	const a = env(f, CHART_IN, bf(62), 6, 40);
	if (a <= 0) return null;
	const tl = flowTime(f);
	// 飞进来：从大、转着落到位，四圈错开四分之一拍
	const fly = (k: number) => easeOutCubic(prog(f, CHART_IN + k * BEAT * 0.25, CHART_IN + k * BEAT * 0.25 + 22));
	const lit = (t0: number) => Math.exp(-Math.max(0, f - t0) / 14) * prog(f, t0 - 2, t0) + (f > t0 ? 0.35 : 0);
	const tremble = f > bf(50) && f < ROAR ? Math.sin(f * 2.3) * 2 * chargeAt(f) : 0;
	const spin = (base: number) => base * tl + (f > bf(51, 2) ? (f - bf(51, 2)) * 0.9 * base * 20 * Math.min(1, chargeAt(f)) * (f < REGEN ? 1 : 0) : 0);
	const regenGlow = env(f, REGEN, bf(57), 4, 40);
	const ringOp = (k: number, t0: number) => fly(k) * (0.55 + 0.45 * lit(t0));
	const pieces: React.ReactNode[] = [];
	let pid = 0;
	const push = (cx: number, cy: number, node: React.ReactNode) => {
		const i = pid++;
		pieces.push(
			<Piece key={i} i={i} cx={cx} cy={cy} f={f}>
				{node}
			</Piece>,
		);
	};

	// ① 变化：星盘刻度圈
	{
		const k = 0;
		const s = lerp(2.2, 1, fly(k));
		const r = R.change * s;
		const op = ringOp(k, WORDS[0][2]);
		const rot = spin(0.0012) + (1 - fly(k)) * 1.2;
		for (let j = 0; j < 24; j++) {
			const a0 = (j / 24) * Math.PI * 2 + rot;
			const a1 = a0 + (Math.PI * 2) / 24 - 0.02;
			const mid = (a0 + a1) / 2;
			push(
				PC[0] + Math.cos(mid) * r,
				PC[1] + Math.sin(mid) * r,
				<g opacity={op}>
					<path d={arcD(r, a0, a1)} fill="none" stroke="rgba(200,222,255,0.85)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
					{[0, 0.33, 0.66].map((u) => {
						const aa = a0 + (a1 - a0) * u;
						return <line key={u} x1={PC[0] + Math.cos(aa) * r} y1={PC[1] + Math.sin(aa) * r} x2={PC[0] + Math.cos(aa) * (r - (u === 0 ? 18 : 9))} y2={PC[1] + Math.sin(aa) * (r - (u === 0 ? 18 : 9))} stroke="rgba(200,222,255,0.7)" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
					})}
				</g>,
			);
		}
	}
	// ② 节拍：对数刻度尺绕成一圈
	{
		const k = 1;
		const s = lerp(2.2, 1, fly(k));
		const r = R.beat * s;
		const op = ringOp(k, WORDS[1][2]);
		const rot = -spin(0.0009) - (1 - fly(k)) * 1.5;
		const names = ['1 秒', '1 分', '1 小时', '1 天', '1 月', '1 年'];
		for (let d = 0; d < 36; d++) {
			const a0 = (d / 36) * Math.PI * 2 + rot;
			const a1 = a0 + (Math.PI * 2) / 36 - 0.01;
			const big = d % 6 === 0;
			push(
				PC[0] + Math.cos(a0) * r,
				PC[1] + Math.sin(a0) * r,
				<g opacity={op}>
					<path d={arcD(r, a0, a1)} fill="none" stroke="rgba(190,212,250,0.7)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
					{Array.from({length: 9}, (_, m) => {
						const aa = a0 + (a1 - a0) * Math.log10(m + 1);
						const len = m === 0 ? (big ? 26 : 16) : 7;
						return <line key={m} x1={PC[0] + Math.cos(aa) * r} y1={PC[1] + Math.sin(aa) * r} x2={PC[0] + Math.cos(aa) * (r + len)} y2={PC[1] + Math.sin(aa) * (r + len)} stroke={m === 0 ? INK.line : INK.lineSoft} strokeWidth={m === 0 ? 1.4 : 0.8} vectorEffect="non-scaling-stroke" />;
					})}
					{big ? (
						<text x={PC[0] + Math.cos(a0) * (r + 52)} y={PC[1] + Math.sin(a0) * (r + 52) + 10} textAnchor="middle" fill="rgba(200,228,255,0.95)" fontFamily={SERIF} fontSize={28}>
							{names[d / 6]}
						</text>
					) : null}
				</g>,
			);
		}
	}
	// ③ 箭头：一圈 V 形箭头；再生之后变成金蓝两头
	{
		const k = 2;
		const s = lerp(2.2, 1, fly(k));
		const r = R.arrow * s;
		const op = ringOp(k, WORDS[2][2]);
		const rot = spin(0.0016) + (1 - fly(k)) * 1.8;
		const both = f >= REGEN_DONE - 6 ? 1 : 0;
		for (let j = 0; j < 30; j++) {
			const a = (j / 30) * Math.PI * 2 + rot;
			const cx = PC[0] + Math.cos(a) * r;
			const cy = PC[1] + Math.sin(a) * r;
			const deg = (a * 180) / Math.PI + 90;
			const gold = both && j % 2 === 1;
			push(
				cx,
				cy,
				<g opacity={op} transform={`translate(${cx} ${cy}) rotate(${deg + (gold ? 180 : 0)})`}>
					<path d="M-12 14L0 -2L12 14" fill="none" stroke={gold ? `rgba(${INK.goldRgb},0.95)` : `rgba(${INK.cyanRgb},0.9)`} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
				</g>,
			);
		}
		push(PC[0] + r, PC[1], <circle cx={PC[0]} cy={PC[1]} r={r} fill="none" stroke={INK.faint} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={op} />);
	}
	// ④ 快慢：两只钟（左右各一）
	{
		const k = 3;
		const op = ringOp(k, WORDS[3][2]);
		const s = lerp(2.2, 1, fly(k));
		const t = tl / 30;
		const L: [number, number] = [PC[0] - (R.arrow + 120) * s, PC[1] + 40];
		const Rr: [number, number] = [PC[0] + (R.arrow + 150) * s, PC[1] + 60];
		push(L[0], L[1], <g opacity={op} transform={`translate(${L[0]} ${L[1]}) scale(0.62) translate(${-L[0]} ${-L[1]})`}><Clock x={L[0]} y={L[1]} t={t} label="" lead={0} /></g>);
		push(Rr[0], Rr[1], <g opacity={op} transform={`translate(${Rr[0]} ${Rr[1]}) scale(0.62) translate(${-Rr[0]} ${-Rr[1]})`}><Clock x={Rr[0]} y={Rr[1]} t={t * 1.6} label="" lead={34} /></g>);
	}
	// ⑤ 画风 B：最外圈的钢制齿圈 + 一只擒纵轮
	{
		const s = lerp(1.6, 1, fly(3));
		const op = fly(3) * 0.5;
		const rot = (spin(0.0008) * 180) / Math.PI;
		for (let j = 0; j < 8; j++) {
			const a0 = (j / 8) * 360;
			push(
				PC[0] + Math.cos((a0 * Math.PI) / 180) * R.gear,
				PC[1] + Math.sin((a0 * Math.PI) / 180) * R.gear,
				<g opacity={op} transform={`translate(${PC[0]} ${PC[1]}) rotate(${rot}) scale(${s})`}>
					<path d={gearPath(R.gear, 120, 18, R.gear - 40)} fill="url(#tm-steel)" fillRule="evenodd" clipPath={`url(#tm-wedge${j})`} />
				</g>,
			);
		}
		const ex = PC[0] + 500;
		const ey = PC[1] - 430;
		push(ex, ey, <g opacity={fly(3) * 0.75} transform={`translate(${ex} ${ey}) rotate(${Math.floor(tl / BEAT) * 24 + 24 * easeOutCubic((tl / BEAT) % 1)})`} filter="url(#tm-metal-shadow)"><path d={escapePath(90, 15)} fill="url(#tm-steel)" /><circle r={30} fill="url(#tm-brass)" /></g>);
	}

	return (
		<g opacity={a}>
			<defs>
				{Array.from({length: 8}, (_, j) => {
					const a0 = ((j / 8) * Math.PI * 2);
					const a1 = (((j + 1) / 8) * Math.PI * 2);
					const RR = R.gear + 60;
					return (
						<clipPath key={j} id={`tm-wedge${j}`}>
							<path d={`M0 0L${Math.cos(a0) * RR} ${Math.sin(a0) * RR}A${RR} ${RR} 0 0 1 ${Math.cos(a1) * RR} ${Math.sin(a1) * RR}Z`} />
						</clipPath>
					);
				})}
				<filter id="tm-warp" x="-30%" y="-30%" width="160%" height="160%">
					<feTurbulence type="turbulence" baseFrequency="0.0035 0.006" numOctaves={2} seed={3} result="n" />
					<feDisplacementMap in="SourceGraphic" in2="n" scale={warpAt(f)} xChannelSelector="R" yChannelSelector="B" />
				</filter>
			</defs>
			<g transform={`translate(${tremble} ${-tremble * 0.6})`} filter={warpAt(f) > 0.5 ? 'url(#tm-warp)' : undefined}>
				{pieces}
			</g>
			{/* 四个词：一拍点亮一圈 */}
			{WORDS.map(([w, r, t0], i) => {
				const o = env(f, t0, ROAR - 6, 4, 10);
				if (o <= 0) return null;
				// 前三个落在自己那一圈上（角度错开），"快慢"在左边那只钟上方
				const ang = ([-150, -128, -106][i] ?? 0) * (Math.PI / 180);
				const x = i < 3 ? PC[0] + Math.cos(ang) * r : PC[0] - (R.arrow + 120);
				const y = i < 3 ? PC[1] + Math.sin(ang) * r + 16 : PC[1] + 40 - 92;
				const pop = 1 + 0.25 * Math.exp(-Math.max(0, f - t0) / 6);
				return (
					<text key={w} x={x} y={y} textAnchor="middle" fill="rgba(240,246,255,0.98)" fontFamily={SERIF} fontWeight={700} fontSize={46 * pop} letterSpacing={6} opacity={o} filter="url(#tm-glow)">
						{w}
					</text>
				);
			})}
			{regenGlow > 0 ? <circle cx={PC[0]} cy={PC[1]} r={R.arrow + 40} fill="none" stroke={`rgba(${INK.goldRgb},${0.5 * regenGlow})`} strokeWidth={3} vectorEffect="non-scaling-stroke" filter="url(#tm-glow)" /> : null}
		</g>
	);
};

/** 时光咆哮的光束与冲击波 */
export const RoarBeam: React.FC<{f: number}> = ({f}) => {
	const a = env(f, ROAR - 1, bf(53, 2), 2, 14);
	if (a <= 0) return null;
	const t = f - ROAR;
	const len = 4200 * easeOutCubic(prog(f, ROAR - 1, ROAR + 6));
	const w = 70 + 26 * Math.sin(f * 1.7) + 30 * Math.exp(-Math.max(0, t) / 10);
	const [x, y] = MOUTH;
	const ang = -6;
	return (
		<g opacity={a}>
			<g transform={`rotate(${ang} ${x} ${y})`}>
				<rect x={x} y={y - w} width={len} height={w * 2} fill={`rgba(${INK.cobaltRgb},0.45)`} filter="url(#tm-glow)" />
				<rect x={x} y={y - w * 0.45} width={len} height={w * 0.9} fill="rgba(140,190,255,0.8)" filter="url(#tm-glow)" />
				<rect x={x} y={y - w * 0.14} width={len} height={w * 0.28} fill="rgba(245,250,255,0.98)" />
				{Array.from({length: 7}, (_, i) => {
					const p = (((t * 0.06 + i / 7) % 1) + 1) % 1;
					return <ellipse key={i} cx={x + p * len} cy={y} rx={30 + p * 50} ry={w * (1.1 + p * 0.6)} fill="none" stroke={`rgba(220,236,255,${0.6 * (1 - p)})`} strokeWidth={2} vectorEffect="non-scaling-stroke" />;
				})}
			</g>
			{t >= 0
				? [0, 6, 13].map((d) => {
						const tt = t - d;
						if (tt < 0 || tt > 40) return null;
						return <circle key={d} cx={x} cy={y} r={60 + tt * 26} fill="none" stroke={`rgba(200,225,255,${0.7 * (1 - tt / 40)})`} strokeWidth={3} vectorEffect="non-scaling-stroke" />;
					})
				: null}
			<circle cx={x} cy={y} r={w * 1.1} fill={`rgba(${INK.cobaltRgb},0.45)`} filter="url(#tm-glow)" />
			<circle cx={x} cy={y} r={w * 0.45} fill="rgba(245,250,255,0.95)" filter="url(#tm-glow)" />
		</g>
	);
};


// ════════ 7 心跳 ════════

const CUP_ON = bf(60, 2);
export const HUMAN_Y = 250;
export const DIALGA_Y = -250;
const PEN_X = 780;
const SCROLL = 5;
const ALIGN = bf(68);

/** 帝牙卢卡的心跳：每两拍一次（从第 16 小节起一直如此） */
const dialgaBeats = (() => {
	const out: number[] = [];
	for (let t = bf(16); t < bf(73); t += BEAT * 2) out.push(t);
	return out;
})();
/** 观众的心跳：一开始快一点，越来越接近，第 68 小节起和它完全对齐 */
const humanBeats = (() => {
	const out: number[] = [];
	for (let t = ALIGN; t < bf(73); t += BEAT * 2) out.push(t);
	let t = ALIGN;
	for (let j = 1; t > bf(59); j++) {
		t -= BEAT * (2 - 0.3 * Math.min(1, j / 6));
		out.unshift(t);
	}
	return out;
})();

/** 一次心跳的波形（PQRST），dt 为距这次心跳的帧数 */
const pqrst = (dt: number) => {
	const u = dt / 3;
	if (u < -6 || u > 10) return 0;
	return -10 * Math.exp(-Math.pow((u + 4) / 1.2, 2)) + 20 * Math.exp(-Math.pow((u + 0.9) / 0.4, 2)) - 78 * Math.exp(-Math.pow(u / 0.45, 2)) + 24 * Math.exp(-Math.pow((u - 0.9) / 0.5, 2)) - 16 * Math.exp(-Math.pow((u - 6) / 1.6, 2));
};

const Trace: React.FC<{f: number; beats: number[]; y: number; color: string; o: number; from: number; ticks?: number}> = ({f, beats, y, color, o, from, ticks = 0}) => {
	if (o <= 0) return null;
	const pts: string[] = [];
	const start = Math.max(-PEN_X, PEN_X - (f - from) * SCROLL);
	const near = beats.filter((b) => b > f - (2 * PEN_X) / SCROLL - 40 && b < f + 40);
	for (let x = start; x <= PEN_X; x += 4) {
		const t = f - (PEN_X - x) / SCROLL;
		let v = 0;
		for (const b of near) v += pqrst(t - b);
		pts.push(`${x.toFixed(0)} ${(y + v).toFixed(1)}`);
	}
	const marks = ticks > 0
		? near
				.filter((b) => b <= f && b >= bf(64))
				.map((b) => {
					const x = PEN_X - (f - b) * SCROLL;
					if (x < -PEN_X) return null;
					return <line key={b} x1={x} y1={y + 30} x2={x} y2={y + 52} stroke={color} strokeWidth={1.4} opacity={ticks} vectorEffect="non-scaling-stroke" />;
				})
		: null;
	return (
		<g opacity={o}>
			{ticks > 0 ? <line x1={-PEN_X} y1={y + 41} x2={PEN_X} y2={y + 41} stroke={INK.lineSoft} strokeWidth={1} opacity={ticks} vectorEffect="non-scaling-stroke" /> : null}
			{marks}
			<path d={`M${pts.join('L')}`} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
			<circle cx={PEN_X} cy={pts.length ? Number(pts[pts.length - 1].split(' ')[1]) : y} r={6} fill={color} filter="url(#tm-glow)" />
		</g>
	);
};

/** 三个光点（湖之三神只以光点出现）：第 66 小节强拍落到心电线上 */
const SPIRITS: [string, number][] = [
	['255,224,122', -300],
	['255,159,210', 0],
	['127,184,255', 300],
];
export const HeartWorld: React.FC<{f: number}> = ({f}) => {
	if (f < CUP_ON - 2) return null;
	const cupA = env(f, CUP_ON, bf(73), 20, 2);
	const humanA = env(f, bf(61, 2), bf(73), 18, 2);
	const dialgaA = env(f, bf(61), bf(73), 18, 2);
	const warm = ease(prog(f, bf(66), bf(66, 2)));
	const humanCol = `rgb(${Math.round(lerp(200, 255, warm))},${Math.round(lerp(225, 228, warm))},${Math.round(lerp(255, 190, warm))})`;
	const ticks = ease(prog(f, bf(64), bf(64, 2)));
	const sync = env(f, ALIGN, bf(73), 20, 2);
	return (
		<g>
			<line x1={-1400} y1={130} x2={1400} y2={130} stroke={INK.lineSoft} strokeWidth={1.2} vectorEffect="non-scaling-stroke" opacity={cupA} />
			<Cup f={f} o={cupA} glint={0} />
			{/* 帝牙卢卡的脉搏（上） */}
			<g opacity={dialgaA}>
				<path d={`M${-PEN_X - 70} ${DIALGA_Y - 16}l14 -12l14 12l-6 18h-16z`} fill="url(#tm-gem)" filter="url(#tm-glow)" />
				<text x={-PEN_X - 56} y={DIALGA_Y + 44} textAnchor="middle" fill="rgba(180,210,255,0.85)" fontFamily={SERIF} fontSize={24}>
					它
				</text>
			</g>
			<Trace f={f} beats={dialgaBeats} y={DIALGA_Y} color={`rgb(120,170,255)`} o={dialgaA} from={bf(61)} />
			{/* 观众的心电线（下） */}
			<g opacity={humanA}>
				<text x={-PEN_X - 56} y={HUMAN_Y + 12} textAnchor="middle" fill="rgba(240,236,225,0.9)" fontFamily={SERIF} fontSize={30}>
					你
				</text>
			</g>
			<Trace f={f} beats={humanBeats} y={HUMAN_Y} color={humanCol} o={humanA} from={bf(61, 2)} ticks={ticks} />
			{/* 对齐之后：两条线的峰之间连一道竖光 */}
			{sync > 0
				? dialgaBeats
						.filter((b) => b >= ALIGN && b <= f && f - b < 60)
						.map((b) => {
							const x = PEN_X - (f - b) * SCROLL;
							const k = Math.exp(-(f - b) / 18);
							return <line key={b} x1={x} y1={DIALGA_Y + 10} x2={x} y2={HUMAN_Y - 30} stroke={`rgba(235,240,255,${0.5 * k * sync})`} strokeWidth={2} vectorEffect="non-scaling-stroke" filter="url(#tm-glow)" />;
						})
				: null}
			{/* 三个光点 */}
			{SPIRITS.map(([rgb, x], i) => {
				const t0 = bf(65, 2) + i * 4;
				const p = easeInQuad(prog(f, t0, bf(66)));
				if (f < t0) return null;
				const y = lerp(-700, HUMAN_Y, p);
				const xx = lerp(x * 2.2, x, p);
				const land = Math.exp(-Math.max(0, f - bf(66)) / 16);
				return (
					<g key={i} opacity={env(f, t0, bf(73), 6, 2)}>
						<circle cx={xx} cy={y} r={10 + 30 * land * (f >= bf(66) ? 1 : 0)} fill={`rgba(${rgb},0.95)`} filter="url(#tm-glow)" />
						{f >= bf(66) ? <circle cx={xx} cy={y} r={20 + (f - bf(66)) * 4} fill="none" stroke={`rgba(${rgb},${0.7 * land})`} strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null}
					</g>
				);
			})}
		</g>
	);
};

/** 右上角：本片已经播放的时长与估算的心跳数 */
export const HeartCounter: React.FC<{f: number}> = ({f}) => {
	const a = env(f, bf(62), bf(71), 14, 24);
	if (a <= 0) return null;
	const sec = f / 30;
	const mm = Math.floor(sec / 60);
	const ss = Math.floor(sec % 60);
	const beats = Math.round((sec * 70) / 60);
	return (
		<div style={{position: 'absolute', right: 130, top: 96, opacity: a, textAlign: 'right', color: 'rgba(236,240,250,0.95)', textShadow: '0 0 14px rgba(0,0,0,0.85)'}}>
			<div style={{fontFamily: CINZEL, fontSize: 40, letterSpacing: 4}}>
				{mm}:{String(ss).padStart(2, '0')}
			</div>
			<div style={{fontFamily: SERIF, fontSize: 34, letterSpacing: 3, marginTop: 6}}>
				心跳 ≈ <span style={{fontFamily: CORMORANT, fontSize: 46, color: 'rgba(255,226,190,0.98)'}}>{beats}</span> 下
			</div>
			<div style={{fontFamily: SERIF, fontSize: 20, letterSpacing: 2, marginTop: 4, color: 'rgba(200,210,235,0.7)'}}>按每分钟 70 下估算</div>
		</div>
	);
};
