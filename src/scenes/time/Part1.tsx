import {CINZEL, CORMORANT, SERIF} from '../../fonts';
import {bf, BEAT, ease, easeInQuad, easeOutCubic, env, flowTime, lerp, prog, pulse, rnd} from './common';
import {Cam, DIALGA, DROP0, escapePath, GEM, gearPath, gemPath, INK, RULER_X0, rulerX, toScreen, viewBounds, WATER_Y} from './world';

/**
 * 上篇（第 1–3 段）画在星图上的东西。全部用世界坐标，由 Master 的世界层 SVG 统一套镜头。
 *
 *   1 钩子：杯子落下碎裂 → 时间轴向右流 → 第 3 小节箭头翻转、碎片倒飞拼回 → 杯中一点钴蓝光升成片名
 *   2 静止与流动：往下摇到悬空的水滴（第 6–7 小节一切停住）→ 第 8 小节水滴落下、涟漪 → 涟漪立成星盘、混沌与蛋
 *     → 两道光，钴蓝那道凝成帝牙卢卡的剪影 → 钻石一闪，时间轴从它胸口射出
 *   3 节拍：时间轴变成对数刻度尺，五个"重复的东西"按拍弹出 → 一起闪、飞回原点 → 钻石上拉开，帝牙卢卡显形
 */

// ════════ 1 钩子：杯子 ════════

const CUP = {top: -130, bottom: 130, rt: 95, rb: 70};
/** 杯子落地碎裂的帧（第 0 小节第 3 拍） */
export const SHATTER = bf(0, 2);
/** 落下的高度与加速度：从第 0 帧到碎裂正好落完 */
const FALL_H = 380;
const FALL_G = (2 * FALL_H) / (SHATTER * SHATTER);
const REWIND_A = bf(3);
const REWIND_B = bf(3, 3);

/** 碎片：原位（在杯身里）、初速度、角速度、形状 */
const SHARDS = Array.from({length: 22}, (_, i) => {
	const v = rnd(i * 3.3);
	const y = lerp(CUP.top + 10, CUP.bottom - 8, v);
	const half = lerp(CUP.rt, CUP.rb, v);
	const x = (rnd(i * 5.1) * 2 - 1) * half * 0.85;
	const side = x >= 0 ? 1 : -1;
	const n = 3 + Math.floor(rnd(i * 7.7) * 3);
	const r = 14 + rnd(i * 2.9) * 20;
	const pts = Array.from({length: n}, (_, k) => {
		const a = (k / n) * Math.PI * 2 + rnd(i * 11 + k) * 0.9;
		const rr = r * (0.6 + rnd(i * 13 + k * 3) * 0.6);
		return [Math.cos(a) * rr, Math.sin(a) * rr] as [number, number];
	});
	return {
		x0: x,
		y0: y,
		vx: side * (2.5 + rnd(i * 1.9) * 8) + (rnd(i * 4.4) - 0.5) * 3,
		vy: -(3 + rnd(i * 6.1) * 9),
		w: (rnd(i * 8.3) - 0.5) * 28,
		pts,
		label: i % 6 === 1,
	};
});
const G = 0.75;

/** 碎片的时间 τ：碎裂后正着走；第 3 小节起倒着走回 0（第 3 小节第 4 拍拼回） */
const shardTau = (f: number) => {
	const tMax = REWIND_A - SHATTER;
	if (f < SHATTER) return -1;
	if (f < REWIND_A) return f - SHATTER;
	return tMax * (1 - ease(prog(f, REWIND_A, REWIND_B)));
};

const shardAt = (s: (typeof SHARDS)[number], tau: number) => {
	// 落到地面（杯底所在的 y）后贴地滑行、减速
	const ground = CUP.bottom - 4;
	const a = 0.5 * G;
	const b = s.vy;
	const c = s.y0 - ground;
	const tL = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
	if (tau <= tL) return {x: s.x0 + s.vx * tau, y: s.y0 + s.vy * tau + a * tau * tau, rot: s.w * tau};
	const k = 0.12;
	const dt = tau - tL;
	return {x: s.x0 + s.vx * tL + (s.vx * 0.45 * (1 - Math.exp(-k * dt))) / k, y: ground, rot: s.w * tL + s.w * 0.2 * (1 - Math.exp(-k * dt)) / k};
};

const cupOutline = () => {
	const {top, bottom, rt, rb} = CUP;
	return `M${-rt} ${top}L${-rb} ${bottom}A${rb} 11 0 0 0 ${rb} ${bottom}L${rt} ${top}`;
};

export const Cup: React.FC<{f: number; o: number; glint: number}> = ({f, o, glint}) => {
	if (o <= 0) return null;
	// 第一帧就在画面上方，慢慢落下，第 0 小节第 3 拍落地
	const y = f < SHATTER ? -FALL_H + 0.5 * FALL_G * f * f : 0;
	return (
		<g transform={`translate(0 ${y})`} opacity={o}>
			<path d={`${cupOutline()}Z`} fill="url(#tm-glass)" />
			<ellipse cx={0} cy={CUP.top} rx={CUP.rt} ry={13} fill="none" stroke={INK.line} strokeWidth={2} vectorEffect="non-scaling-stroke" />
			<path d={cupOutline()} fill="none" stroke={INK.line} strokeWidth={2} vectorEffect="non-scaling-stroke" />
			{/* 高光 */}
			<path d={`M${-CUP.rt + 22} ${CUP.top + 26}L${-CUP.rb + 18} ${CUP.bottom - 22}`} stroke="rgba(230,240,255,0.55)" strokeWidth={5} strokeLinecap="round" />
			<path d={`M${CUP.rt - 30} ${CUP.top + 40}L${CUP.rb - 24} ${CUP.bottom - 40}`} stroke={`rgba(${INK.cobaltRgb},0.5)`} strokeWidth={3} strokeLinecap="round" />
			{glint > 0 ? <path d={gemPath(0, 10, 26)} fill="url(#tm-gem)" opacity={glint} filter="url(#tm-glow)" /> : null}
		</g>
	);
};

const Shards: React.FC<{f: number}> = ({f}) => {
	const tau = shardTau(f);
	if (tau < 0 || f >= REWIND_B) return null;
	const sec = tau / 30;
	return (
		<g>
			{SHARDS.map((s, i) => {
				const p = shardAt(s, tau);
				const d = `M${s.pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
				return (
					<g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.rot})`}>
						<path d={d} fill="rgba(150,190,255,0.12)" stroke={INK.line} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
					</g>
				);
			})}
			{/* 几块碎片旁边标着它此刻的时间 */}
			{SHARDS.filter((s) => s.label).map((s, i) => {
				const p = shardAt(s, tau);
				const a = Math.min(prog(tau, 4, 12), 1 - prog(f, REWIND_B - 10, REWIND_B));
				return (
					<g key={`l${i}`} opacity={a}>
						<line x1={p.x} y1={p.y} x2={p.x + 34} y2={p.y - 40} stroke={INK.lineSoft} strokeWidth={1} vectorEffect="non-scaling-stroke" />
						<text x={p.x + 38} y={p.y - 44} fill={INK.lineSoft} fontFamily={CORMORANT} fontSize={20} fontStyle="italic">
							t = {sec.toFixed(2)} s
						</text>
					</g>
				);
			})}
		</g>
	);
};

/** 地面线 */
const Ground: React.FC<{f: number}> = ({f}) => {
	const a = env(f, 0, bf(6, 2), 20, 40);
	return <line x1={-1400} y1={CUP.bottom} x2={1400} y2={CUP.bottom} stroke={INK.lineSoft} strokeWidth={1.2} vectorEffect="non-scaling-stroke" opacity={a} />;
};

/** 钩子里的时间轴：第 2 句出现，刻度向左流（时间往前）；第 3 小节箭头翻转、刻度倒流 */
const HookTimeline: React.FC<{f: number}> = ({f}) => {
	const a = env(f, bf(1), bf(4, 2), 14, 16);
	if (a <= 0) return null;
	const y = 255;
	const L = 640;
	const grow = easeOutCubic(prog(f, bf(1), bf(1, 2)));
	// 刻度位移：正向每帧 3，倒流时反向
	const fwd = Math.min(f, REWIND_A) - bf(1);
	const back = f > REWIND_A ? (f - REWIND_A) * 1.15 * (0.4 + 0.6 * ease(prog(f, REWIND_A, REWIND_A + 8))) : 0;
	const off = 3 * fwd - 3 * back * 1.6;
	const flip = ease(prog(f, REWIND_A, REWIND_A + 9));
	const step = 48;
	const ticks: React.ReactNode[] = [];
	for (let k = -20; k <= 20; k++) {
		const x = (((k * step - off) % (step * 41)) + step * 41 * 2) % (step * 41) - step * 20.5;
		if (Math.abs(x) > L * grow) continue;
		const big = ((k % 5) + 5) % 5 === 0;
		ticks.push(<line key={k} x1={x} y1={y - (big ? 12 : 6)} x2={x} y2={y + (big ? 12 : 6)} stroke={INK.lineSoft} strokeWidth={1} vectorEffect="non-scaling-stroke" />);
	}
	const ax = L * grow;
	const dir = 1 - 2 * flip;
	return (
		<g opacity={a}>
			<line x1={-ax} y1={y} x2={ax} y2={y} stroke={INK.line} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
			{ticks}
			{/* 箭头：翻转时从右端甩到左端 */}
			<path d={`M${dir * ax} ${y}l${-dir * 22} -9v18z`} fill={INK.silver} />
			{/* "现在"：固定在中央的小三角 */}
			<path d={`M0 ${y - 18}l-7 -11h14z`} fill={INK.cyan} opacity={0.9} />
		</g>
	);
};

/** 片名的光点：第 4 小节强拍从杯中升起 */
export const TITLE_Y = -305;
const TitleLight: React.FC<{f: number}> = ({f}) => {
	const t = prog(f, bf(4), bf(4, 1.4));
	const a = env(f, bf(4) - 4, bf(5, 2), 6, 30);
	if (a <= 0) return null;
	const y = lerp(10, TITLE_Y + 60, easeOutCubic(t));
	const bloom = Math.exp(-Math.pow((f - bf(4, 1.4)) / 10, 2));
	return (
		<g opacity={a}>
			<line x1={0} y1={10} x2={0} y2={y} stroke={`rgba(${INK.cyanRgb},${0.5 * (1 - t * 0.6)})`} strokeWidth={2} vectorEffect="non-scaling-stroke" />
			<path d={gemPath(0, y, 20 + bloom * 14)} fill="url(#tm-gem)" filter="url(#tm-glow)" />
			<circle cx={0} cy={y} r={30 + bloom * 120} fill="none" stroke={`rgba(${INK.cyanRgb},${0.6 * bloom})`} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
		</g>
	);
};

export const HookWorld: React.FC<{f: number}> = ({f}) => {
	if (f > bf(7)) return null;
	const glint = env(f, bf(4) - 6, bf(4, 1.4), 6, 8);
	const cupO = f < SHATTER || f >= REWIND_B ? 1 : 0;
	return (
		<g>
			<Ground f={f} />
			<HookTimeline f={f} />
			<Cup f={f} o={cupO} glint={glint} />
			<Shards f={f} />
			{/* 拼回的那一刻：一圈光 */}
			{f >= REWIND_B - 2 && f < REWIND_B + 24 ? <ellipse cx={0} cy={0} rx={120 + (f - REWIND_B) * 6} ry={170 + (f - REWIND_B) * 6} fill="none" stroke={`rgba(${INK.cyanRgb},${0.6 * (1 - prog(f, REWIND_B, REWIND_B + 24))})`} strokeWidth={1.5} vectorEffect="non-scaling-stroke" /> : null}
			<TitleLight f={f} />
		</g>
	);
};

/** 片名（HTML，跟着世界坐标走，镜头往下摇时自然移出画面） */
export const Title: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const a = env(f, bf(4, 1), bf(5, 3), 10, 26);
	if (a <= 0) return null;
	const [x, y] = toScreen(c, 0, TITLE_Y);
	const chars = '时间的心跳'.split('');
	const en = prog(f, bf(4, 3), bf(5, 0.5));
	return (
		<div style={{position: 'absolute', left: x - 700, top: y - 90, width: 1400, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: a}}>
			<div style={{display: 'flex', fontFamily: SERIF, fontWeight: 700, fontSize: 116 * c.z, letterSpacing: 30 * c.z, paddingLeft: 30 * c.z}}>
				{chars.map((ch, i) => {
					const t = prog(f, bf(4, 1.4) + i * 5, bf(4, 1.4) + i * 5 + 16);
					return (
						<span
							key={i}
							style={{
								opacity: t,
								filter: `blur(${(1 - t) * 10}px) drop-shadow(0 0 22px rgba(120,170,255,0.5)) drop-shadow(0 0 60px rgba(70,120,255,0.3))`,
								background: 'linear-gradient(180deg, #ffffff 0%, #e8f0ff 45%, #9cc0ff 82%, #d8e6ff 100%)',
								WebkitBackgroundClip: 'text',
								color: 'transparent',
								transform: `translateY(${(1 - easeOutCubic(t)) * 16}px)`,
							}}
						>
							{ch}
						</span>
					);
				})}
			</div>
			<div style={{width: 560 * easeOutCubic(prog(f, bf(4, 2), bf(5))), height: 1.5, margin: '16px 0 18px', background: `linear-gradient(90deg, rgba(${INK.cyanRgb},0), rgba(${INK.cyanRgb},0.85), rgba(${INK.cyanRgb},0))`}} />
			<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 30 * c.z, letterSpacing: 14, paddingLeft: 14, color: 'rgba(228,236,252,0.9)', opacity: en, filter: `blur(${(1 - en) * 6}px)`, textShadow: '0 0 18px rgba(110,160,255,0.6)'}}>
				THE HEARTBEAT OF TIME
			</div>
		</div>
	);
};

// ════════ 浮尘（全篇；跟着 τ 流动，静段里停住） ════════

const MOTES = Array.from({length: 260}, (_, i) => ({
	x: -1800 + rnd(i * 1.3) * 5200,
	y: -900 + rnd(i * 2.7) * 3300,
	vx: (rnd(i * 3.9) - 0.5) * 0.5,
	vy: -0.15 - rnd(i * 4.3) * 0.35,
	r: 1 + rnd(i * 5.7) * 2.2,
	tw: rnd(i * 6.1) * 6.28,
}));

export const Motes: React.FC<{f: number; c: Cam; o?: number}> = ({f, c, o = 1}) => {
	const tau = flowTime(f);
	const b = viewBounds(c, 40);
	return (
		<g opacity={o}>
			{MOTES.map((m, i) => {
				const x = m.x + m.vx * tau + Math.sin(tau * 0.02 + m.tw) * 14;
				const yy = m.y + m.vy * tau;
				const y = ((((yy + 900) % 3300) + 3300) % 3300) - 900;
				if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) return null;
				const tw = 0.45 + 0.35 * Math.sin(tau * 0.05 + m.tw);
				return <circle key={i} cx={x} cy={y} r={m.r / Math.sqrt(c.z)} fill={`rgba(200,220,255,${tw * 0.55})`} />;
			})}
		</g>
	);
};

// ════════ 2 静止与流动 ════════

const DROP_HIT = bf(8, 1);
/** 涟漪：水滴落水起每拍一圈 */
const RIPPLES = Array.from({length: 7}, (_, i) => DROP_HIT + i * BEAT);
/** 立成星盘的四圈半径 */
const DISC_R = [118, 210, 318, 430];
export const DISC_C: [number, number] = [0, WATER_Y];

/** 俯仰：0 = 侧视（涟漪是扁椭圆），1 = 俯视（正圆） */
const tiltAt = (f: number) => ease(prog(f, bf(10), bf(11)));
const FLAT = 0.2;

const Drop: React.FC<{f: number}> = ({f}) => {
	if (f > DROP_HIT + 2 || f < bf(5)) return null;
	const t = Math.max(0, f - bf(8));
	const y = Math.min(WATER_Y - 8, DROP0[1] + 0.5 * 2.05 * t * t);
	const stretch = 1 + Math.min(0.35, t * 0.025);
	return (
		<g transform={`translate(${DROP0[0]} ${y}) scale(${1.7 / Math.sqrt(stretch)} ${1.7 * stretch})`}>
			<path d="M0 -26C8 -12 16 -2 16 8A16 16 0 0 1 -16 8C-16 -2 -8 -12 0 -26Z" fill="rgba(150,200,255,0.22)" stroke={INK.line} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
			<ellipse cx={-5} cy={4} rx={3.5} ry={6} fill="rgba(240,248,255,0.8)" />
		</g>
	);
};

/** 水面：侧视时是一条线和一点倒影；俯仰立起时淡出 */
const Water: React.FC<{f: number}> = ({f}) => {
	const a = env(f, bf(5), bf(10, 3), 30, 30);
	if (a <= 0) return null;
	// 水滴落水后水面轻微起伏
	const k = f > DROP_HIT ? Math.exp(-(f - DROP_HIT) / 40) : 0;
	const pts: string[] = [];
	for (let x = -1300; x <= 1300; x += 20) {
		const d = Math.abs(x);
		const w = k * 7 * Math.sin(d * 0.05 - (f - DROP_HIT) * 0.5) * Math.exp(-d / 360);
		pts.push(`${x} ${(WATER_Y + w).toFixed(2)}`);
	}
	return (
		<g opacity={a}>
			<rect x={-1400} y={WATER_Y} width={2800} height={500} fill="url(#tm-water)" />
			<path d={`M${pts.join('L')}`} fill="none" stroke={INK.line} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
		</g>
	);
};

/** 溅起的水花 */
const Splash: React.FC<{f: number}> = ({f}) => {
	const t = f - DROP_HIT;
	if (t < 0 || t > 40) return null;
	return (
		<g opacity={1 - t / 40}>
			{Array.from({length: 9}, (_, i) => {
				const a = -Math.PI / 2 + (i - 4) * 0.28;
				const v = 5 + rnd(i * 3.1) * 3;
				const x = Math.cos(a) * v * t;
				const y = WATER_Y + Math.sin(a) * v * t + 0.35 * t * t;
				if (y > WATER_Y) return null;
				return <circle key={i} cx={x} cy={y} r={3} fill="rgba(200,230,255,0.85)" />;
			})}
		</g>
	);
};

/** 涟漪 → 星盘 */
const Disc: React.FC<{f: number}> = ({f}) => {
	if (f < DROP_HIT) return null;
	const tilt = tiltAt(f);
	const ry = lerp(FLAT, 1, tilt);
	const fade = 1 - ease(prog(f, bf(13, 2), bf(14, 2)));
	const rot = f > bf(13) ? (f - bf(13)) * 0.12 : 0;
	const tickA = prog(f, bf(10, 2), bf(11, 2));
	const els: React.ReactNode[] = [];
	RIPPLES.forEach((t0, i) => {
		if (f < t0) return;
		const free = 10 + (Math.min(f, bf(10)) - t0) * 6.2;
		const keep = i < DISC_R.length;
		const r = keep ? lerp(free, DISC_R[i], ease(prog(f, bf(10), bf(11)))) : free + Math.max(0, f - bf(10)) * 6.2;
		const ao = keep ? Math.max(0.35, 1 - free / 900) : Math.max(0, 1 - free / 700) * (1 - prog(f, bf(10), bf(10, 3)));
		if (ao <= 0) return;
		els.push(<ellipse key={`r${i}`} cx={DISC_C[0]} cy={DISC_C[1]} rx={r} ry={r * ry} fill="none" stroke={`rgba(200,222,255,${ao})`} strokeWidth={keep ? 1.6 : 1.2} vectorEffect="non-scaling-stroke" />);
	});
	// 星盘的刻度
	if (tickA > 0) {
		DISC_R.forEach((r, i) => {
			const n = [24, 36, 72, 120][i];
			for (let k = 0; k < n; k++) {
				const a = ((k / n) * 360 + rot * (i % 2 ? -1 : 1)) * (Math.PI / 180);
				const big = k % (n / 12) === 0;
				const len = big ? 14 : 6;
				const vis = prog(tickA, k / n - 0.05, k / n + 0.1);
				if (vis <= 0) continue;
				const x1 = Math.cos(a) * r;
				const y1 = Math.sin(a) * r;
				const x2 = Math.cos(a) * (r - len);
				const y2 = Math.sin(a) * (r - len);
				els.push(<line key={`t${i}-${k}`} x1={DISC_C[0] + x1} y1={DISC_C[1] + y1 * ry} x2={DISC_C[0] + x2} y2={DISC_C[1] + y2 * ry} stroke={`rgba(200,222,255,${0.6 * vis})`} strokeWidth={big ? 1.4 : 0.9} vectorEffect="non-scaling-stroke" />);
			}
		});
		// 十二道径向细线
		for (let k = 0; k < 12; k++) {
			const a = ((k / 12) * 360 + rot * 0.5) * (Math.PI / 180);
			els.push(<line key={`s${k}`} x1={DISC_C[0] + Math.cos(a) * DISC_R[0]} y1={DISC_C[1] + Math.sin(a) * DISC_R[0] * ry} x2={DISC_C[0] + Math.cos(a) * DISC_R[3]} y2={DISC_C[1] + Math.sin(a) * DISC_R[3] * ry} stroke={`rgba(170,200,250,${0.14 * tickA})`} strokeWidth={1} vectorEffect="non-scaling-stroke" />);
		}
	}
	return <g opacity={fade}>{els}</g>;
};

/** 神话的线描：混沌的漩涡（第 11 句）、蛋（第 11 句后半），第 12 句分出两道光 */
const Myth: React.FC<{f: number}> = ({f}) => {
	const a = env(f, bf(10, 2), bf(14, 2), 20, 30);
	if (a <= 0) return null;
	const [cx, cy] = DISC_C;
	const spin = f * 0.6;
	const chaos = env(f, bf(10, 2), bf(12, 1), 30, 14);
	const arms: React.ReactNode[] = [];
	for (let k = 0; k < 5; k++) {
		const pts: string[] = [];
		for (let s = 0; s <= 40; s++) {
			const t = s / 40;
			const r = 12 + t * 96;
			const ang = (k / 5) * Math.PI * 2 + t * 4.2 + (spin * Math.PI) / 180 + Math.sin(f * 0.03 + k) * 0.2;
			pts.push(`${(cx + Math.cos(ang) * r).toFixed(1)} ${(cy + Math.sin(ang) * r).toFixed(1)}`);
		}
		arms.push(<path key={k} d={`M${pts.join('L')}`} fill="none" stroke={`rgba(190,210,250,${0.55 * chaos})`} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />);
	}
	// 蛋
	const egg = env(f, bf(11, 2), bf(12, 2), 16, 10);
	const eggGlow = 0.5 + 0.5 * Math.sin(f * 0.25);
	// 两道光
	const split = prog(f, bf(12), bf(12, 2));
	const beamFade = 1 - prog(f, bf(12, 2), bf(13));
	const blueTo: [number, number] = [GEM[0], GEM[1] - 60];
	const bx = lerp(cx, blueTo[0], easeOutCubic(split));
	const by = lerp(cy, blueTo[1], easeOutCubic(split));
	const px = lerp(cx, cx + 1100, easeInQuad(split));
	const py = lerp(cy, cy - 80, easeInQuad(split));
	return (
		<g opacity={a}>
			{arms}
			{egg > 0 ? (
				<g opacity={egg}>
					<ellipse cx={cx} cy={cy + 4} rx={30} ry={40} fill={`rgba(${INK.goldRgb},${0.12 + 0.1 * eggGlow})`} stroke={`rgba(${INK.goldRgb},0.9)`} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
					<circle cx={cx} cy={cy + 4} r={60 + 10 * eggGlow} fill={`rgba(${INK.goldRgb},0.08)`} />
				</g>
			) : null}
			{split > 0 && beamFade > 0 ? (
				<g opacity={beamFade}>
					<line x1={cx} y1={cy} x2={bx} y2={by} stroke={`rgba(${INK.cobaltRgb},0.8)`} strokeWidth={4} strokeLinecap="round" filter="url(#tm-glow)" />
					<circle cx={bx} cy={by} r={12} fill={`rgba(${INK.cyanRgb},0.9)`} filter="url(#tm-glow)" />
					<line x1={cx} y1={cy} x2={px} y2={py} stroke={`rgba(${INK.pinkRgb},0.7)`} strokeWidth={3} strokeLinecap="round" filter="url(#tm-glow)" />
					<circle cx={px} cy={py} r={10} fill={`rgba(${INK.pinkRgb},0.9)`} filter="url(#tm-glow)" />
				</g>
			) : null}
		</g>
	);
};

/** "变化"的小标注：第 8 句时指向水花、涟漪、一粒浮尘 */
const ChangeTags: React.FC<{f: number}> = ({f}) => {
	const tags: [number, number, number, number][] = [
		// [出现帧, x, y, 方向]
		[bf(9), 40, WATER_Y - 70, 1],
		[bf(9, 1), 330, WATER_Y + 20, 1],
		[bf(9, 2), -260, WATER_Y - 230, -1],
	];
	return (
		<g>
			{tags.map(([t0, x, y, d], i) => {
				const a = env(f, t0, bf(10, 2), 8, 14);
				if (a <= 0) return null;
				const s = easeOutCubic(prog(f, t0, t0 + 10));
				return (
					<g key={i} opacity={a}>
						<line x1={x} y1={y} x2={x + d * 60 * s} y2={y - 46 * s} stroke={INK.cyan} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
						<circle cx={x} cy={y} r={4} fill={INK.cyan} />
						<text x={x + d * 66} y={y - 52} textAnchor={d > 0 ? 'start' : 'end'} fill="rgba(220,236,255,0.95)" fontFamily={SERIF} fontSize={34} letterSpacing={4} opacity={s}>
							变化
						</text>
					</g>
				);
			})}
		</g>
	);
};

/** 第 13 句：时间轴从钻石射出（之后在第 3 段变成对数刻度尺） */
export const AXIS_START = bf(13);
const Axis: React.FC<{f: number}> = ({f}) => {
	if (f < AXIS_START) return null;
	const grow = easeOutCubic(prog(f, AXIS_START, bf(14)));
	const x1 = GEM[0] + 3600 * grow;
	// 显形后时间轴往左也延伸到帝牙卢卡身后
	const left = GEM[0] - 2400 * ease(prog(f, bf(16), bf(17)));
	const y = GEM[1];
	const head = Math.exp(-(f - AXIS_START) / 20);
	// 第 6 段星图合拢时淡出（之后的时间轴由星图的圆环和心电线接替）
	const gone = 1 - prog(f, bf(46, 2), bf(47, 2));
	if (gone <= 0) return null;
	return (
		<g opacity={gone}>
			<line x1={left} y1={y} x2={x1} y2={y} stroke={INK.line} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
			<path d={`M${x1 + 4} ${y}l-24 -9v18z`} fill={INK.silver} />
			{head > 0.01 ? <circle cx={x1} cy={y} r={10} fill={`rgba(${INK.cyanRgb},${head})`} filter="url(#tm-glow)" /> : null}
			<g opacity={env(f, AXIS_START + 6, bf(14, 2), 10, 14)}>
				<line x1={GEM[0]} y1={y - 16} x2={GEM[0]} y2={y + 16} stroke={INK.line} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
				<text x={DIALGA.x + DIALGA.size * 0.5 + 10} y={y - 22} fill="rgba(220,236,255,0.9)" fontFamily={CORMORANT} fontStyle="italic" fontSize={34}>
					t = 0
				</text>
			</g>
		</g>
	);
};

export const StillWorld: React.FC<{f: number}> = ({f}) => {
	if (f < bf(5)) return null;
	// 时间轴从第 13 句起一直留在星图上（中篇、下篇也用）
	if (f > bf(22) + 10) return <Axis f={f} />;
	return (
		<g>
			<Water f={f} />
			<Disc f={f} />
			<Myth f={f} />
			<Drop f={f} />
			<Splash f={f} />
			<ChangeTags f={f} />
			<Axis f={f} />
		</g>
	);
};

// ════════ 3 节拍：对数刻度尺 ════════

const RULER_ON = bf(14);
const RULER_OFF = bf(16);
/** 刻度尺上的主刻度（标名字的） */
const NAMED: [number, string][] = [
	[1, '1 秒'],
	[60, '1 分'],
	[3600, '1 小时'],
	[86400, '1 天'],
	[2.55e6, '1 月'],
	[3.156e7, '1 年'],
];

const LogTicks: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const a = env(f, RULER_ON, RULER_OFF + 10, 8, 16);
	if (a <= 0) return null;
	const y = GEM[1];
	// 刻度从左往右逐个点亮，跟着镜头
	const front = lerp(RULER_X0 - 200, rulerX(1e8), ease(prog(f, RULER_ON, bf(15, 2))));
	const b = viewBounds(c, 50);
	const els: React.ReactNode[] = [];
	for (let d = 0; d <= 8; d++) {
		for (let m = 1; m <= 9; m++) {
			const sec = m * Math.pow(10, d);
			const x = rulerX(sec);
			if (x > front || x < b.x0 || x > b.x1) continue;
			const big = m === 1;
			els.push(<line key={`${d}-${m}`} x1={x} y1={y - (big ? 18 : 8)} x2={x} y2={y + (big ? 18 : 8)} stroke={big ? INK.line : INK.lineSoft} strokeWidth={big ? 1.4 : 0.9} vectorEffect="non-scaling-stroke" />);
			if (big) {
				els.push(
					<text key={`e${d}`} x={x} y={y + 60} textAnchor="middle" fill="rgba(180,200,240,0.65)" fontFamily={CORMORANT} fontStyle="italic" fontSize={32}>
						10<tspan dy={-13} fontSize={21}>{d}</tspan>
						<tspan dy={13}> s</tspan>
					</text>,
				);
			}
		}
	}
	NAMED.forEach(([sec, name], i) => {
		const x = rulerX(sec);
		if (x > front) return;
		els.push(
			<g key={`n${i}`}>
				<line x1={x} y1={y - 30} x2={x} y2={y + 30} stroke={INK.cyan} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
				<text x={x + 10} y={y - 42} fill="rgba(200,232,255,0.95)" fontFamily={SERIF} fontSize={36} letterSpacing={2}>
					{name}
				</text>
			</g>,
		);
	});
	return <g opacity={a}>{els}</g>;
};

type Item = {at: number; x: number; up: boolean; name: string; value: string; draw: (f: number, k: number) => React.ReactNode; k?: number; dy?: number; label?: number};
const ITEM_DY = 230;

/** 心电线 */
const ecg = (f: number) => {
	const w = 220;
	const pts: string[] = [];
	// 每两拍一次心跳，波形从左往右扫
	const phase = ((f - bf(14)) / (BEAT * 2)) % 1;
	for (let i = 0; i <= 80; i++) {
		const u = i / 80;
		const local = (u - phase + 1) % 1;
		let v = 0;
		if (local > 0.42 && local < 0.46) v = -12 * Math.sin(((local - 0.42) / 0.04) * Math.PI);
		if (local > 0.5 && local < 0.53) v = 18 * ((local - 0.5) / 0.03);
		if (local >= 0.53 && local < 0.56) v = 18 - 88 * ((local - 0.53) / 0.03);
		if (local >= 0.56 && local < 0.6) v = -70 + 92 * ((local - 0.56) / 0.04);
		if (local >= 0.6 && local < 0.62) v = 22 - 22 * ((local - 0.6) / 0.02);
		if (local > 0.7 && local < 0.8) v = -16 * Math.sin(((local - 0.7) / 0.1) * Math.PI);
		pts.push(`${(-w / 2 + u * w).toFixed(1)} ${v.toFixed(1)}`);
	}
	return <path d={`M${pts.join('L')}`} fill="none" stroke={INK.cyan} strokeWidth={2.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
};

/** 画风 B：钟摆与擒纵轮（钢与黄铜） */
const pendulum = (f: number) => {
	// 一拍摆一次（来回两拍）
	const ph = ((f - bf(14, 2)) / BEAT) * Math.PI;
	const ang = 14 * Math.cos(ph);
	const step = Math.floor((f - bf(14, 2)) / BEAT);
	const wheel = step * 24 + 24 * easeOutCubic(((f - bf(14, 2)) / BEAT) % 1);
	return (
		<g transform="translate(0 -150)">
			<g transform={`rotate(${wheel})`} filter="url(#tm-metal-shadow)">
				<path d={escapePath(58, 15)} fill="url(#tm-steel)" stroke="rgba(20,26,36,0.6)" strokeWidth={1} />
				<circle r={20} fill="url(#tm-brass)" />
				<circle r={5} fill="#1b1407" />
			</g>
			<g transform={`rotate(${ang})`}>
				{/* 擒纵叉 */}
				<path d="M-70 18Q0 -26 70 18L62 30Q0 -8 -62 30Z" fill="url(#tm-steel)" stroke="rgba(20,26,36,0.5)" strokeWidth={1} filter="url(#tm-metal-shadow)" />
				<rect x={-3.5} y={0} width={7} height={300} fill="url(#tm-steel)" />
				<circle cx={0} cy={300} r={42} fill="url(#tm-brass)" filter="url(#tm-metal-shadow)" />
				<circle cx={0} cy={300} r={42} fill="url(#tm-sheen)" />
				<circle cx={-12} cy={288} r={8} fill="rgba(255,250,230,0.5)" />
			</g>
			<circle r={7} fill="#2b2110" stroke="url(#tm-brass)" strokeWidth={3} />
		</g>
	);
};

const earth = (f: number) => {
	const rot = (f - bf(15)) * 2.2;
	return (
		<g>
			<circle r={62} fill="rgba(40,80,170,0.25)" stroke={INK.line} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
			{[-40, -15, 15, 40].map((lat) => (
				<ellipse key={lat} cx={0} cy={(lat / 90) * 62} rx={62 * Math.cos((lat * Math.PI) / 180)} ry={5} fill="none" stroke={INK.faint} strokeWidth={1} vectorEffect="non-scaling-stroke" />
			))}
			{[0, 60, 120].map((m) => {
				const k = Math.cos(((m + rot) * Math.PI) / 180);
				return <ellipse key={m} cx={0} cy={0} rx={Math.abs(k) * 62} ry={62} fill="none" stroke={INK.lineSoft} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
			})}
			{/* 昼夜分界：右半边亮 */}
			<path d="M0 -62A62 62 0 0 1 0 62A22 62 0 0 0 0 -62Z" fill="rgba(255,236,170,0.22)" />
		</g>
	);
};

const moons = (f: number) => {
	const shift = (f - bf(15, 1)) * 0.02;
	return (
		<g>
			{[-2, -1, 0, 1, 2].map((k) => {
				const ph = (((k + 2) / 4 + shift) % 1) * Math.PI * 2;
				const c = Math.cos(ph);
				const x = k * 54;
				return (
					<g key={k} transform={`translate(${x} 0)`}>
						<circle r={21} fill="rgba(20,30,60,0.6)" stroke={INK.lineSoft} strokeWidth={1} vectorEffect="non-scaling-stroke" />
						<path d={`M0 -21A21 21 0 0 ${Math.sin(ph) > 0 ? 1 : 0} 0 21A${Math.abs(c) * 21} 21 0 0 ${c * Math.sin(ph) > 0 ? 0 : 1} 0 -21Z`} fill="rgba(235,240,255,0.85)" />
					</g>
				);
			})}
		</g>
	);
};

const orbit = (f: number) => {
	const a = (f - bf(15, 2)) * 0.05;
	return (
		<g>
			<ellipse rx={110} ry={46} fill="none" stroke={INK.lineSoft} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
			<circle r={16} fill={`rgba(${INK.goldRgb},0.9)`} filter="url(#tm-glow)" />
			<circle cx={Math.cos(a) * 110} cy={Math.sin(a) * 46} r={8} fill={INK.cyan} />
		</g>
	);
};

const ITEMS: Item[] = [
	{at: bf(14), x: rulerX(1), up: true, name: '心跳', value: '约 1 秒', draw: ecg},
	{at: bf(14, 2), x: rulerX(1), up: false, name: '钟摆', value: '摆长约 1 米 · 约 1 秒', draw: pendulum, k: 0.62, dy: 150, label: 170},
	{at: bf(15), x: rulerX(86400), up: true, name: '一天', value: '24 小时', draw: earth},
	{at: bf(15, 1), x: rulerX(2.55e6), up: false, name: '一个月', value: '约 29.5 天', draw: moons},
	{at: bf(15, 2), x: rulerX(3.156e7), up: true, name: '一年', value: '约 365.24 天', draw: orbit},
];
/** 第 15 小节第 4 拍：所有节拍一起闪，然后化成光飞回原点 */
const SYNC = bf(15, 3);

export const RulerWorld: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	if (f < RULER_ON - 2 || f > RULER_OFF + 30) return null;
	const y0 = GEM[1];
	const flash = pulse(f, SYNC, SYNC, 1, 7);
	return (
		<g>
			<LogTicks f={f} c={c} />
			{ITEMS.map((it, i) => {
				const a = env(f, it.at, RULER_OFF + 4, 4, 10);
				if (a <= 0) return null;
				const s = 0.75 + 0.25 * easeOutCubic(prog(f, it.at, it.at + 9));
				const y = y0 + (it.up ? -1 : 1) * (it.dy ?? ITEM_DY);
				const ring = prog(f, it.at, it.at + 22);
				const labelY = it.up ? y - (it.label ?? 125) : y + (it.label ?? 150);
				return (
					<g key={i} opacity={a}>
						<line x1={it.x} y1={y0} x2={it.x} y2={y + (it.up ? 90 : -90)} stroke={INK.faint} strokeWidth={1} strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
						<g transform={`translate(${it.x} ${y}) scale(${(it.k ?? 1) * s * (1 + 0.08 * flash)})`}>{it.draw(f, i)}</g>
						{ring < 1 ? <circle cx={it.x} cy={y} r={40 + ring * 160} fill="none" stroke={`rgba(${INK.cyanRgb},${0.7 * (1 - ring)})`} strokeWidth={1.5} vectorEffect="non-scaling-stroke" /> : null}
						{flash > 0.02 ? <circle cx={it.x} cy={y} r={110 + (1 - flash) * 60} fill="none" stroke={`rgba(${INK.cyanRgb},${0.9 * flash})`} strokeWidth={3} vectorEffect="non-scaling-stroke" filter="url(#tm-glow)" /> : null}
						<text x={it.x} y={labelY} textAnchor="middle" fill="rgba(235,243,255,0.97)" fontFamily={SERIF} fontWeight={600} fontSize={54} letterSpacing={6}>
							{it.name}
						</text>
						<text x={it.x} y={labelY + 50} textAnchor="middle" fill="rgba(170,205,255,0.92)" fontFamily={SERIF} fontSize={34} letterSpacing={2}>
							{it.value}
						</text>
					</g>
				);
			})}
			<Streaks f={f} />
		</g>
	);
};

/** 节拍化成光，沿时间轴飞回原点（钻石） */
const Streaks: React.FC<{f: number}> = ({f}) => {
	const t = prog(f, SYNC, RULER_OFF);
	if (t <= 0 || t >= 1) return null;
	return (
		<g>
			{ITEMS.map((it, i) => {
				const dy = it.dy ?? ITEM_DY;
				const y = GEM[1] + (it.up ? -dy : dy) * (1 - easeInQuad(t));
				const x = lerp(it.x, GEM[0], easeInQuad(t));
				const len = 80 + 600 * t;
				return (
					<g key={i}>
						<line x1={x} y1={y} x2={x + len} y2={y + (it.up ? -dy : dy) * 0.25 * t} stroke={`rgba(${INK.cyanRgb},0.55)`} strokeWidth={5} strokeLinecap="round" filter="url(#tm-glow)" />
						<circle cx={x} cy={y} r={14} fill="rgba(225,240,255,0.95)" filter="url(#tm-glow)" />
					</g>
				);
			})}
		</g>
	);
};

// ════════ 3 显形之后：身后的机芯与刻度 ════════

/** 心跳：显形后每两拍一次（第 16 小节强拍起） */
export const HEART0 = bf(16);
export const heartAt = (f: number) => (f < HEART0 ? 0 : pulse(f, HEART0, 1e9, 2, 9));
/** 已经跳了几下（带平滑过渡的小数，用来推刻度） */
export const heartCount = (f: number) => {
	if (f < HEART0) return 0;
	const k = (f - HEART0) / (BEAT * 2);
	const n = Math.floor(k);
	return n + easeOutCubic(Math.min(1, (k - n) * 3));
};

/** 时间轴下面的黄铜小齿轮（显形后的构图里在屏幕右侧、名称卡下方） */
const PINION_R = 105;
const PINION: [number, number] = [-40, GEM[1] + PINION_R + 4];

/** 帝牙卢卡身后：一圈钢制大齿圈（画风 B）+ 时间轴上的刻度，每跳一下推一格 */
export const BehindDialga: React.FC<{f: number}> = ({f}) => {
	const a = env(f, bf(16), bf(22) + 40, 18, 20);
	if (a <= 0) return null;
	const n = heartCount(f);
	const cx = DIALGA.x + 40;
	const cy = DIALGA.y + 20;
	const R = 520;
	const teeth = 96;
	const step = 360 / teeth;
	const y = GEM[1];
	const tickStep = 70;
	const off = (n * tickStep) % (tickStep * 10);
	const ticks: React.ReactNode[] = [];
	for (let k = -40; k <= 40; k++) {
		const x = GEM[0] + k * tickStep - off;
		const big = ((Math.round((k * tickStep - off + 1e5 * tickStep) / tickStep) % 5) + 5) % 5 === 0;
		ticks.push(<line key={k} x1={x} y1={y - (big ? 16 : 8)} x2={x} y2={y + (big ? 16 : 8)} stroke={big ? INK.line : INK.lineSoft} strokeWidth={1} vectorEffect="non-scaling-stroke" />);
	}
	const hb = heartAt(f);
	return (
		<g opacity={a}>
			<g transform={`translate(${cx} ${cy}) rotate(${n * step * 2})`} opacity={0.55}>
				<path d={gearPath(R, teeth, 16, R - 44)} fill="url(#tm-steel)" fillRule="evenodd" opacity={0.5} />
				<circle r={R - 60} fill="none" stroke={`rgba(${INK.cyanRgb},0.25)`} strokeWidth={1} vectorEffect="non-scaling-stroke" />
				{Array.from({length: 12}, (_, k) => {
					const ang = (k / 12) * Math.PI * 2;
					return <line key={k} x1={Math.cos(ang) * (R - 60)} y1={Math.sin(ang) * (R - 60)} x2={Math.cos(ang) * (R - 90)} y2={Math.sin(ang) * (R - 90)} stroke={INK.lineSoft} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />;
				})}
			</g>
			{ticks}
			{/* 一只黄铜小齿轮咬在时间轴下面：心跳一下，它转一格，把刻度往前推一格（齿轮与齿条） */}
			<g transform={`translate(${PINION[0]} ${PINION[1]}) rotate(${-((n * tickStep) / (2 * Math.PI * PINION_R)) * 360})`} opacity={0.85} filter="url(#tm-metal-shadow)">
				<path d={gearPath(PINION_R, 18, 13, 22)} fill="url(#tm-brass)" fillRule="evenodd" />
				{[0, 1, 2, 3, 4].map((k) => {
					const ang = (k / 5) * Math.PI * 2;
					return <path key={k} d={`M${Math.cos(ang) * 30} ${Math.sin(ang) * 30}L${Math.cos(ang) * (PINION_R - 26)} ${Math.sin(ang) * (PINION_R - 26)}`} stroke="#3b2808" strokeWidth={12} opacity={0.4} />;
				})}
				<circle r={PINION_R - 18} fill="url(#tm-sheen)" />
			</g>
			{/* 每跳一下，一圈光从钻石沿时间轴扩开 */}
			{hb > 0.02 ? <ellipse cx={GEM[0]} cy={y} rx={60 + (1 - hb) * 520} ry={18 + (1 - hb) * 60} fill="none" stroke={`rgba(${INK.cyanRgb},${0.6 * hb})`} strokeWidth={1.5} vectorEffect="non-scaling-stroke" /> : null}
		</g>
	);
};

/** 钻石本身的光（画在立绘上面）：剪影时一点微光，显形后随心跳亮 */
export const GemGlow: React.FC<{f: number}> = ({f}) => {
	const sil = env(f, bf(12, 2), bf(16), 14, 2) * 0.55;
	const flash13 = Math.exp(-Math.pow((f - AXIS_START) / 6, 2));
	const hb = heartAt(f);
	if (f >= bf(30)) return null;
	const on = f >= bf(16) ? 0.35 + 0.65 * hb : 0;
	const a = Math.max(sil, on, flash13);
	if (a <= 0.01) return null;
	const w = DIALGA.size * 0.05;
	return (
		<g>
			<circle cx={GEM[0]} cy={GEM[1]} r={w * (1.6 + 2.2 * Math.max(hb, flash13))} fill={`rgba(${INK.cobaltRgb},${0.35 * a})`} filter="url(#tm-glow)" />
			<path d={gemPath(GEM[0], GEM[1], w)} fill={`rgba(160,205,255,${0.55 * a})`} filter="url(#tm-glow)" />
		</g>
	);
};

