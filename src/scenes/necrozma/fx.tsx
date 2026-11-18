import {AbsoluteFill, Img, interpolate, random, staticFile} from 'remotion';
import {Cam} from '../../camera';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {clamp} from '../../theme';
import {secs} from './continuity';

type U = Record<string, number | [number, number] | [number, number, number] | [number, number, number, number]>;

/** 全屏着色器背景：镜头在着色器内部换算（与 CamLayer 同一组值） */
export const Backdrop: React.FC<{frag: string; f: number; cam: Cam; uniforms: U; opacity?: number; scale?: number; blend?: React.CSSProperties['mixBlendMode']}> = ({
	frag,
	f,
	cam,
	uniforms,
	opacity = 1,
	scale = 1,
	blend,
}) => {
	if (opacity <= 0.001) return null;
	return (
		<AbsoluteFill style={{opacity, mixBlendMode: blend}}>
			<ShaderCanvas frag={frag} width={1920} height={1080} scale={scale} uniforms={{uTime: secs(f), uCam: [cam.x, cam.y, cam.zoom], uRoll: cam.roll, ...uniforms}} />
		</AbsoluteFill>
	);
};

export const fadeIn = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
export const fadeOut = (f: number, a: number, b: number) => interpolate(f, [a, b], [1, 0], clamp);
export const win = (f: number, a: number, b: number, fi = 10, fo = 10) => interpolate(f, [a, a + fi, b - fo, b], [0, 1, 1, 0], clamp);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ─── 黑色晶体碎片的外形（多边形，随机但固定） ───────────────────────────────
const shardPoly = (seed: string, size: number) => {
	const n = 4 + Math.floor(random(`${seed}n`) * 3);
	const stretch = 0.45 + random(`${seed}s`) * 0.5;
	return Array.from({length: n}, (_, k) => {
		const a = (k / n) * Math.PI * 2 + (random(`${seed}a${k}`) - 0.5) * 0.7;
		const r = size * (0.55 + random(`${seed}r${k}`) * 0.55) * (k % 2 === 0 ? 1 : 0.7);
		return [Math.cos(a) * r, Math.sin(a) * r * stretch] as [number, number];
	});
};

/** 一块黑色棱晶：黑色面 + 一条亮棱 + 边缘色散 */
export const Crystal: React.FC<{
	x: number;
	y: number;
	size: number;
	rot?: number;
	seed: string;
	glint?: number;
	edge?: string;
	opacity?: number;
}> = ({x, y, size, rot = 0, seed, glint = 0.6, edge = '255,226,170', opacity = 1}) => {
	const pts = shardPoly(seed, size);
	const d = pts.map((p) => p.join(',')).join(' ');
	// 一条从中心到某个顶点的棱
	const v = pts[Math.floor(random(`${seed}v`) * pts.length)];
	return (
		<g transform={`translate(${x},${y}) rotate(${rot})`} opacity={opacity}>
			<polygon points={d} fill="#07070b" stroke={`rgba(${edge},${0.35 + 0.65 * glint})`} strokeWidth={Math.max(1, size * 0.05)} strokeLinejoin="round" />
			<polygon points={`0,0 ${v[0]},${v[1]} ${pts[0][0] * 0.6},${pts[0][1] * 0.6}`} fill={`rgba(${edge},${0.08 + 0.22 * glint})`} />
			<line x1={0} y1={0} x2={v[0]} y2={v[1]} stroke={`rgba(255,255,255,${0.3 + 0.7 * glint})`} strokeWidth={Math.max(0.8, size * 0.035)} strokeLinecap="round" />
		</g>
	);
};

// ─── 光团碎裂时飞散的黑色晶体（第 3 段） ─────────────────────────────────────
const BURST = Array.from({length: 46}, (_, i) => {
	const a = random(`ba${i}`) * Math.PI * 2;
	return {
		a,
		sp: 6 + random(`bs${i}`) * 16,
		size: 6 + random(`bz${i}`) ** 2 * 34,
		spin: (random(`bw${i}`) - 0.5) * 14,
		g: 0.05 + random(`bg${i}`) * 0.12,
		drag: 0.965 + random(`bd${i}`) * 0.02,
	};
});

/** 碎片：从 (x, y) 炸开，带一点下坠；into 里的几块飞向究极之洞并在洞口消失 */
export const BurstShards: React.FC<{
	f: number;
	at: number;
	x: number;
	y: number;
	scale?: number;
	into?: {i: number; x: number; y: number; t: number}[];
}> = ({f, at, x, y, scale = 1, into = []}) => {
	const t = f - at;
	if (t < 0 || t > 260) return null;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible', filter: 'drop-shadow(0 0 6px rgba(255,220,160,0.55))'}}>
			{BURST.map((b, i) => {
				// 速度按阻尼衰减：位移 = v (1 - drag^t) / (1 - drag)
				const disp = (b.sp * (1 - b.drag ** t)) / (1 - b.drag);
				let px = x + Math.cos(b.a) * disp * scale;
				let py = y + Math.sin(b.a) * disp * scale + b.g * t * t * 0.5 * scale;
				let o = interpolate(t, [0, 2, 160, 240], [0, 1, 1, 0], clamp);
				let sz = b.size * scale;
				const tg = into.find((q) => q.i === i);
				if (tg) {
					const u = interpolate(t, [20, tg.t], [0, 1], {...clamp, easing: (v) => v * v});
					px = lerp(px, tg.x, u);
					py = lerp(py, tg.y, u);
					sz *= 1 - 0.85 * u;
					o *= u >= 1 ? 0 : 1;
				}
				const glint = 0.5 + 0.5 * Math.sin(t * 0.3 + i);
				return <Crystal key={i} x={px} y={py} size={sz} rot={b.spin * t + i * 40} seed={`burst${i}`} glint={glint} />;
			})}
		</svg>
	);
};

// ─── 究极大都会的人（没有官方形象，代码画的剪影） ─────────────────────────────
// 前景里仰望天空的人：只露出腰部以上，逆光，朝光源一侧有一道轮廓光
type Figure = {x: number; h: number; tilt: number; arm: 'down' | 'shade' | 'reach'; hood?: boolean; face: 1 | -1};
const FIGS: Figure[] = [
	{x: 150, h: 430, tilt: -6, arm: 'down', face: 1},
	{x: 360, h: 380, tilt: -10, arm: 'shade', face: 1},
	{x: 520, h: 300, tilt: -12, arm: 'down', face: 1, hood: true},
	{x: 1430, h: 360, tilt: -8, arm: 'reach', face: -1},
	{x: 1610, h: 410, tilt: -5, arm: 'down', face: -1, hood: true},
	{x: 1800, h: 330, tilt: -9, arm: 'down', face: -1},
];

const figure = (g: Figure, base: number) => {
	const {x, h, face} = g;
	const u = h / 100; // 以身高的 1% 为单位
	const sy = base - 78 * u; // 肩线
	const hx = x + face * 1.5 * u;
	const head = `M ${hx - 6 * u} ${sy - 9 * u} C ${hx - 7.5 * u} ${sy - 20 * u}, ${hx + 7.5 * u} ${sy - 20 * u}, ${hx + 6 * u} ${sy - 9 * u} C ${hx + 5 * u} ${sy - 4 * u}, ${hx - 5 * u} ${sy - 4 * u}, ${hx - 6 * u} ${sy - 9 * u} Z`;
	const hood = g.hood
		? `M ${hx - 9 * u} ${sy - 4 * u} C ${hx - 10 * u} ${sy - 24 * u}, ${hx + 10 * u} ${sy - 24 * u}, ${hx + 9 * u} ${sy - 4 * u} Z`
		: '';
	const neck = `M ${x - 3 * u} ${sy - 6 * u} L ${x + 3 * u} ${sy - 6 * u} L ${x + 4 * u} ${sy} L ${x - 4 * u} ${sy} Z`;
	// 外套：肩部斜下、领口立起、下摆往外张
	const body = `M ${x - 4 * u} ${sy - 2 * u} C ${x - 12 * u} ${sy - 1 * u}, ${x - 17 * u} ${sy + 2 * u}, ${x - 18 * u} ${sy + 8 * u} L ${x - 19 * u} ${base + 40 * u} L ${x + 19 * u} ${base + 40 * u} L ${x + 18 * u} ${sy + 8 * u} C ${x + 17 * u} ${sy + 2 * u}, ${x + 12 * u} ${sy - 1 * u}, ${x + 4 * u} ${sy - 2 * u} Z`;
	const s0 = {x: x + face * 16 * u, y: sy + 5 * u};
	const arm =
		g.arm === 'shade'
			? `M ${s0.x} ${s0.y} L ${x + face * 17 * u} ${sy + 22 * u} L ${hx + face * 4 * u} ${sy - 12 * u}`
			: g.arm === 'reach'
			? `M ${s0.x} ${s0.y} L ${x + face * 26 * u} ${sy - 10 * u} L ${x + face * 31 * u} ${sy - 32 * u}`
			: '';
	return {head, hood, neck, body, arm, u, pivot: {x, y: base}};
};

/** 前景一排仰望天空的人；rim 为轮廓光颜色 */
export const People: React.FC<{base: number; rim: string; rimO: number; f: number}> = ({base, rim, rimO, f}) => (
	<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
		<defs>
			<filter id="pplRim" x="-20%" y="-20%" width="140%" height="140%">
				<feMorphology in="SourceAlpha" operator="erode" radius="2.2" result="e" />
				<feOffset in="e" dx="-2.4" dy="2.6" result="o" />
				<feComposite in="SourceAlpha" in2="o" operator="out" result="edge" />
				<feGaussianBlur in="edge" stdDeviation="0.9" result="eb" />
				<feFlood floodColor={rim} floodOpacity={rimO} />
				<feComposite in2="eb" operator="in" result="rimc" />
				<feMerge>
					<feMergeNode in="SourceGraphic" />
					<feMergeNode in="rimc" />
				</feMerge>
			</filter>
		</defs>
		<g filter="url(#pplRim)">
			{FIGS.map((g, i) => {
				const p = figure(g, base);
				const breathe = Math.sin(f * 0.035 + i * 1.9) * 0.6;
				return (
					<g key={i} fill="#050407" transform={`rotate(${breathe} ${p.pivot.x} ${p.pivot.y})`}>
						{p.hood && <path d={p.hood} />}
						<path d={p.neck} />
						<path d={p.head} transform={`rotate(${g.tilt * g.face} ${p.pivot.x} ${base - 78 * p.u})`} />
						<path d={p.body} />
						{p.arm && <path d={p.arm} stroke="#050407" strokeWidth={8 * p.u} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
					</g>
				);
			})}
		</g>
	</svg>
);

// ─── 余烬：从书页焦边升起的火星 ───────────────────────────────────────────
const EMBERS = Array.from({length: 60}, (_, i) => ({
	x: random(`ex${i}`) * 2100 - 90,
	y: random(`ey${i}`) * 1200,
	sp: 0.6 + random(`es${i}`) * 1.6,
	r: 0.8 + random(`er${i}`) ** 2 * 2.6,
	ph: random(`ep${i}`) * 6.28,
	life: 90 + random(`el${i}`) * 140,
}));

export const Embers: React.FC<{f: number; opacity: number; rise?: number}> = ({f, opacity, rise = 1}) => {
	if (opacity <= 0.01) return null;
	return (
		<AbsoluteFill style={{opacity, mixBlendMode: 'screen', pointerEvents: 'none'}}>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				{EMBERS.map((e, i) => {
					const t = (f + e.ph * 40) % e.life;
					const y = e.y - t * e.sp * 2.2 * rise;
					const yy = ((y % 1300) + 1300) % 1300 - 110;
					const x = e.x + Math.sin(f * 0.04 + e.ph) * 18 + t * 0.25;
					const o = interpolate(t, [0, 12, e.life * 0.6, e.life], [0, 1, 0.8, 0], clamp) * (0.6 + 0.4 * Math.sin(f * 0.3 + e.ph));
					return <circle key={i} cx={x} cy={yy} r={e.r} fill="rgb(255,150,60)" opacity={o} style={{filter: 'drop-shadow(0 0 4px rgba(255,120,40,0.9))'}} />;
				})}
			</svg>
		</AbsoluteFill>
	);
};

// ─── 浮尘 / 光点 ─────────────────────────────────────────────────────────
const MOTES = Array.from({length: 70}, (_, i) => ({
	x: random(`mx${i}`) * 1920,
	y: random(`my${i}`) * 1300,
	sp: 0.15 + random(`ms${i}`) * 0.5,
	r: 0.7 + random(`mr${i}`) ** 2 * 2.2,
	ph: random(`mp${i}`) * 6.28,
	h: random(`mh${i}`),
}));

export const Motes: React.FC<{f: number; opacity: number; rgb?: string; dir?: 1 | -1; rainbow?: number}> = ({f, opacity, rgb = '255,236,200', dir = -1, rainbow = 0}) => {
	if (opacity <= 0.01) return null;
	return (
		<AbsoluteFill style={{opacity, mixBlendMode: 'screen', pointerEvents: 'none'}}>
			{MOTES.map((m, i) => {
				const y = (((m.y + dir * f * m.sp * 2.2) % 1300) + 1300) % 1300 - 110;
				const x = m.x + Math.sin(f * 0.03 + m.ph) * 16;
				const c = rainbow > 0 && m.h < rainbow ? `hsla(${((m.h * 3 + f * 0.003) * 360) % 360}, 95%, 82%, 0.95)` : `rgba(${rgb},0.95)`;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: y,
							width: m.r * 2,
							height: m.r * 2,
							borderRadius: '50%',
							background: c,
							boxShadow: `0 0 ${m.r * 4}px ${c}`,
							opacity: 0.5 + 0.5 * Math.sin(f * 0.08 + m.ph),
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

/** 光流：一束光点从 from 流向 to（城市的光被吸走、光被抽进身体） */
export const LightStream: React.FC<{
	f: number;
	from: {x: number; y: number};
	to: {x: number; y: number};
	start: number;
	end: number;
	n?: number;
	rgb?: string;
	spread?: number;
	seed: string;
	width?: number;
}> = ({f, from, to, start, end, n = 40, rgb = '255,232,190', spread = 60, seed, width = 1}) => {
	if (f < start || f > end + 40) return null;
	const life = 34;
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const len = Math.hypot(dx, dy) || 1;
	const nx = -dy / len;
	const ny = dx / len;
	const emitO = interpolate(f, [start, start + 10, end - 10, end], [0, 1, 1, 0], clamp);
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible', mixBlendMode: 'screen'}}>
			{Array.from({length: n}, (_, i) => {
				const off = random(`${seed}o${i}`) * life;
				const t0 = Math.floor((f - start - off) / life) * life + start + off;
				const u = (f - t0) / life;
				if (t0 < start || t0 > end || u < 0 || u > 1) return null;
				const side = (random(`${seed}s${i}-${Math.floor(t0)}`) - 0.5) * spread * Math.sin(u * Math.PI);
				const e = u * u;
				const x = from.x + dx * e + nx * side;
				const y = from.y + dy * e + ny * side;
				const r = (1.2 + random(`${seed}r${i}`) * 2.2) * width * (1 - 0.4 * u);
				const o = Math.sin(u * Math.PI) * emitO;
				return <circle key={i} cx={x} cy={y} r={r} fill={`rgb(${rgb})`} opacity={o} style={{filter: `drop-shadow(0 0 6px rgba(${rgb},0.9))`}} />;
			})}
		</svg>
	);
};

// ─── 有官方形象的人物：官方立绘做剪影（不镜像、不改形状） ─────────────────────
const TRAINERS = {
	lusamine: {src: 'trainers/lusamine/sm.png', w: 697, h: 1600},
	elio: {src: 'trainers/elio/usum.png', w: 1170, h: 1566},
	selene: {src: 'trainers/selene/usum.png', w: 1020, h: 1586},
};
export type Trainer = keyof typeof TRAINERS;

/**
 * 人物剪影：x 为水平中心、y 为脚底、h 为身高（像素）；crop 只露出上面这一截（0–1，骑在宝可梦背上时用）。
 * 立绘压暗（shade = 0 为纯黑），外圈一层逆光。
 */
export const TrainerArt: React.FC<{who: Trainer; x: number; y: number; h: number; rimRgb?: string; rim?: number; opacity?: number; crop?: number; shade?: number}> = ({
	who,
	x,
	y,
	h,
	rimRgb = '255,255,255',
	rim = 0.7,
	opacity = 1,
	crop = 1,
	shade = 0,
}) => {
	const a = TRAINERS[who];
	const w = (h * a.w) / a.h;
	const k = h / 300;
	return (
		<div style={{position: 'absolute', left: x - w / 2, top: y - h, width: w, height: h * crop, overflow: 'hidden', opacity}}>
			<Img
				src={staticFile(a.src)}
				style={{
					width: w,
					height: h,
					filter: `brightness(${shade}) drop-shadow(0 0 ${2 * k + 1}px rgba(${rimRgb},${rim})) drop-shadow(0 0 ${10 * k + 4}px rgba(${rimRgb},${rim * 0.5}))`,
				}}
			/>
		</div>
	);
};
