import {AbsoluteFill} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {V3} from '../../three/stage';
import {Cam, project, pxOf} from './cam';
import {bf, easeOutCubic, env, lerp, prog, rnd, smooth} from './common';
import {BALL_POS, CUT_D, CUT_P, CUT_T, ORIGIN_AT, REMAKE_AT, REND_AT, SH_Y, sheetLocalToWorldV, slashDraw} from './bend';
import {PEARL, PINK} from './hook';

/**
 * 第 5 段「起源形态与亚空裂斩」：
 * 第 30 小节落拍，坑底的光爆开，网格翻成珍珠母贝（Iridescence / LiquidChrome 的思路），起源形态在光里升起显色；
 * 身后一层很淡的金光（像创造神）。32.2 扭曲、32.3 打碎、33.0 再造（网格本身在 bend.tsx 的 SpaceSheet 里）；
 * 33.3 起蓄力，35.0 亚空裂斩横切整张网格。
 */

/** 起源形态（官方立绘 art-origin.png），面朝右 */
export const ORIGIN = {pos: [0, 7.0, 0] as V3, size: 12};
/** 立绘里近侧那颗珍珠的位置（立绘 UV） */
const PEARL_UV: [number, number] = [0.55, 0.32];
const CHARGE_FROM = bf(33, 3);

const originPos = (f: number): V3 => {
	const k = easeOutCubic(prog(f, ORIGIN_AT, bf(31)));
	return [0, lerp(SH_Y + 1.5, ORIGIN.pos[1], k), 0];
};
const originScale = (f: number) => lerp(0.55, 1, easeOutCubic(prog(f, ORIGIN_AT - 2, bf(31))));
/** 镜头从它身边穿过裂口时淡出 */
const originOpacity = (f: number) => smooth(prog(f, ORIGIN_AT - 2, ORIGIN_AT + 5)) * (1 - smooth(prog(f, bf(35, 2), bf(36))));

const mix3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];

const pearlScreen = (f: number, c: Cam) => {
	const p = originPos(f);
	const s = ORIGIN.size * originScale(f);
	return project(c, [p[0] + (PEARL_UV[0] - 0.5) * s, p[1] - (PEARL_UV[1] - 0.5) * s, p[2] + 0.5]);
};

export const chargeAt = (f: number) => smooth(prog(f, CHARGE_FROM, REND_AT)) * (1 - smooth(prog(f, REND_AT, REND_AT + 20)));

/** 身后很淡的金光（画在宝可梦后面） */
export const OriginHalo: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const o = originOpacity(f);
	if (o <= 0) return null;
	const p = project(c, originPos(f));
	if (p.depth <= 0) return null;
	const r = pxOf(c, p.depth, ORIGIN.size) * 0.85 * originScale(f);
	const burst = Math.exp(-Math.max(0, f - ORIGIN_AT) / 10);
	const remake = f >= REMAKE_AT - 1 ? Math.exp(-(f - REMAKE_AT) / 12) : 0;
	const a = o * (0.26 + 0.5 * burst + 0.35 * remake + 0.25 * chargeAt(f));
	return (
		<div
			style={{
				position: 'absolute',
				left: p.x - r,
				top: p.y - r * 1.05,
				width: r * 2,
				height: r * 2,
				mixBlendMode: 'screen',
				background: `radial-gradient(circle, rgba(255,226,170,${0.5 * a}) 0%, rgba(255,205,140,${0.22 * a}) 32%, rgba(255,180,200,${0.06 * a}) 55%, rgba(0,0,0,0) 72%)`,
			}}
		/>
	);
};

export const OriginPalkia: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const o = originOpacity(f);
	if (o <= 0) return null;
	const pr = project(c, originPos(f));
	if (pr.depth <= 0.5) return null;
	const size = pxOf(c, pr.depth, ORIGIN.size) * originScale(f);
	// 从光里显出来：先是一团亮白，十几帧内回到原色
	const white = Math.exp(-Math.max(0, f - ORIGIN_AT) / 9);
	const ch = chargeAt(f);
	const rend = f >= REND_AT ? Math.exp(-(f - REND_AT) / 8) : 0;
	const az = (Math.atan2(c.pos[0] - ORIGIN.pos[0], c.pos[2] - ORIGIN.pos[2]) * 180) / Math.PI;
	const yaw = Math.max(-6, Math.min(6, az * 0.12)) + Math.sin((f - ORIGIN_AT) * 0.022) * 1.4;
	return (
		<PokemonArt3D
			dir="pokemon/palkia"
			variant="-origin"
			x={pr.x}
			y={pr.y}
			size={size}
			yaw={yaw}
			pitch={-1}
			depthScale={0.5}
			ambient={[0.56, 0.54, 0.62]}
			dirLights={[
				{dir: [-0.5, -0.7, 0.6], color: [0.5, 0.48, 0.56], wrap: 0.45},
				{dir: [0.7, 0.3, 0.4], color: [0.36, 0.3, 0.26], wrap: 0.5},
			]}
			pointLights={[{pos: [PEARL_UV[0] - 0.5, PEARL_UV[1] - 0.5, 0.3], color: mix3([0.4, 0.22, 0.3], [1.4, 0.7, 1.0], ch + rend), radius: 0.32}]}
			rim={{dir: [-0.7, -0.6], color: mix3([0.9, 0.7, 0.9], [1.6, 0.8, 1.3], ch), power: 2.6}}
			emissive={0.08 + 0.5 * ch + 0.6 * rend}
			emissiveTint={[1.5, 0.75, 1.15]}
			emissiveKey={[0.5, 1, 0.12, 0.8]}
			brightness={1 + 2.6 * white + 0.25 * ch + 0.5 * rend}
			opacity={o}
			resolution={Math.min(1.4, 2600 / Math.max(1, size * 1.12))}
		/>
	);
};

/** 显色那一下：坑底的光爆开 */
export const OriginBurst: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const t = f - ORIGIN_AT;
	if (t < -3 || t > 50) return null;
	const a = Math.exp(-Math.max(0, t) / 9) * smooth(prog(t, -3, 0));
	const p = project(c, [0, BALL_POS(ORIGIN_AT - 1)[1], 0]);
	return (
		<AbsoluteFill
			style={{
				mixBlendMode: 'screen',
				background: `radial-gradient(circle at ${p.x}px ${p.y}px, rgba(255,250,240,${0.95 * a}) 0%, rgba(255,226,180,${0.5 * a}) 20%, rgba(${PINK},${0.25 * a}) 45%, rgba(0,0,0,0) 85%)`,
			}}
		/>
	);
};

/** 小标签：起源形态 · Origin Forme */
export const OriginTag: React.FC<{f: number}> = ({f}) => {
	const a = env(f, bf(30, 2), bf(32, 2), 14, 16);
	if (a <= 0) return null;
	const ls = 10 - 4 * smooth(prog(f, bf(30, 2), bf(31, 2)));
	return (
		<div style={{position: 'absolute', right: 150, top: 210, textAlign: 'right', opacity: a, textShadow: `0 0 16px rgba(255,214,160,0.55), 0 0 3px rgba(0,0,0,0.9)`}}>
			<div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 44, color: '#fff6ec', letterSpacing: ls}}>起源形态</div>
			<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 17, letterSpacing: ls * 0.7, color: 'rgba(255,232,206,0.85)', marginTop: 6}}>ORIGIN FORME</div>
		</div>
	);
};

/** 蓄力：粉色光尘向珍珠汇聚 */
export const ChargeMotes: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const ch = chargeAt(f);
	if (ch <= 0.01 || f > REND_AT + 2) return null;
	const ps = pearlScreen(f, c);
	const motes = Array.from({length: 42}, (_, i) => {
		const period = 26 + 14 * rnd(i * 2.1);
		const ph = (((f - CHARGE_FROM) / period + rnd(i * 3.7)) % 1 + 1) % 1;
		const ang = rnd(i * 5.3) * Math.PI * 2;
		const d = (1 - ph) * (260 + 260 * rnd(i * 7.1));
		const swirl = ang + (1 - ph) * 1.2;
		return {x: ps.x + Math.cos(swirl) * d, y: ps.y + Math.sin(swirl) * d * 0.8, a: smooth(ph) * ch * (f - CHARGE_FROM > ph * period ? 1 : 0), r: 1.5 + 2 * rnd(i * 9.9)};
	});
	const core = ch;
	return (
		<>
			<div
				style={{
					position: 'absolute',
					left: ps.x - 160,
					top: ps.y - 160,
					width: 320,
					height: 320,
					mixBlendMode: 'screen',
					background: `radial-gradient(circle, rgba(255,240,248,${0.7 * core}) 0%, rgba(${PINK},${0.4 * core}) 18%, rgba(0,0,0,0) 65%)`,
				}}
			/>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
				{motes.map((m, i) => (m.a > 0.01 ? <circle key={i} cx={m.x} cy={m.y} r={m.r} fill={`rgba(${PEARL},${m.a})`} /> : null))}
			</svg>
		</>
	);
};

/** 亚空裂斩：斩痕的 2D 光（画在宝可梦后面，斩的是它身后的空间）与全屏闪光 */
export const RendFlash: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const t = f - REND_AT;
	if (t < -4 || t > 60) return null;
	const k = slashDraw(f);
	const a = (t < 0 ? 1 : Math.exp(-t / 14)) * smooth(prog(t, -4, -3));
	const tEnd = lerp(CUT_T[0], CUT_T[1], k);
	const w = (tt: number) => sheetLocalToWorldV(CUT_P[0] + CUT_D[0] * tt, CUT_P[1] + CUT_D[1] * tt);
	const p1 = project(c, w(CUT_T[0]));
	const p2 = project(c, w(tEnd));
	const flash = t >= 0 ? Math.exp(-t / 5) : 0;
	return (
		<>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
				<defs>
					<filter id="sp-rend-w" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation="30" />
					</filter>
					<filter id="sp-rend-n" x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation="5" />
					</filter>
				</defs>
				<line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={`rgba(${PINK},${0.6 * a})`} strokeWidth={70} strokeLinecap="round" filter="url(#sp-rend-w)" />
				<line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={`rgba(255,240,250,${0.9 * a})`} strokeWidth={9} strokeLinecap="round" filter="url(#sp-rend-n)" />
			</svg>
			{flash > 0.01 ? <AbsoluteFill style={{mixBlendMode: 'screen', background: `rgba(255,214,236,${0.32 * flash})`}} /> : null}
		</>
	);
};

