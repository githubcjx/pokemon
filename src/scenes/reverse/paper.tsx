import {useMemo} from 'react';
import * as THREE from 'three';
import {V3} from '../../three/stage';
import {Cam, project} from './cam';
import {bf, easeOutCubic, ease, prog, rnd, smooth} from './common';
import {PORTAL_C} from './pillar';

/**
 * 第 4 段「来历」与第 5 段的翻面：俯看的枪之柱广场原地变成一张纸（深色的纸，正面珍珠白的线）。
 * 纸上一点淡金的光分出三条线（钴蓝、珍珠粉、金）→ 金线被推出纸边，之后只从纸背隐约透过来
 * → 神话只写了两位（多出三点小光）→ 一道红光从纸背撕开又合上（洗翠的裂缝）
 * → 纸上重新画回广场 → 第 30 小节整张纸翻过去，背面是金线。
 * 纸面上的线用 SVG 画在投影后的位置（纸翻动时跟着走），纸本身是 three.js 的平面。
 */

export const PAPER_HALF = 10;
const PAPER_Y = 0.08;

export const PAPER_IN = bf(22);
const LINES_AT = bf(22) + 6;
const PUSH_AT = bf(24, 2);
const TWO_AT = bf(27);
const TEAR_AT = bf(28, 2);
const PLAZA_BACK = bf(29);
export const FLIP_AT = bf(30);
const FLIP_LEN = 22;

/** 纸绕自身 x 轴翻过去的角度 */
export const paperAngle = (f: number) => Math.PI * ease(prog(f, FLIP_AT, FLIP_AT + FLIP_LEN));
/** 纸的不透明度：第 22 小节出现，钻进口子前散掉 */
export const paperA = (f: number) => smooth(prog(f, PAPER_IN, PAPER_IN + 8)) * (1 - smooth(prog(f, bf(30, 2), bf(30, 3) + 4)));

/** 纸面坐标 (u, v)（v 朝镜头下方）→ 世界坐标 */
const toWorld = (f: number, u: number, v: number): V3 => {
	const a = paperAngle(f);
	return [PORTAL_C[0] + u, PAPER_Y - v * Math.sin(a), PORTAL_C[2] + v * Math.cos(a)];
};

/** 纸的正面是否朝着镜头 */
const frontFacing = (f: number, c: Cam) => {
	const a = paperAngle(f);
	const n: V3 = [0, Math.cos(a), Math.sin(a)];
	return n[0] * (c.pos[0] - PORTAL_C[0]) + n[1] * (c.pos[1] - PAPER_Y) + n[2] * (c.pos[2] - PORTAL_C[2]) > 0;
};

// ════════ 纸 ════════

export const PaperSheet: React.FC<{f: number}> = ({f}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				side: THREE.DoubleSide,
				depthWrite: false,
				uniforms: {uA: {value: 0}, uPlaza: {value: 1}, uBleed: {value: 0}, uT: {value: 0}, uPortal: {value: 3.8}},
				vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `
					uniform float uA; uniform float uPlaza; uniform float uBleed; uniform float uT; uniform float uPortal;
					varying vec2 vP;
					float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
					float n2(vec2 x) { vec2 i = floor(x); vec2 f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
					float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
					float gridLine(float v, float period, float w) {
						float d = abs(fract(v / period + 0.5) - 0.5) * period;
						float aa = fwidth(v);
						return (1.0 - smoothstep(w, w + aa * 1.2, d)) * (1.0 - smoothstep(period * 0.25, period * 0.6, aa));
					}
					float lineAt(float d, float w) { float aa = fwidth(d); return 1.0 - smoothstep(w, w + aa * 1.2, abs(d)); }
					void main() {
						// 纸面坐标：u 向右，v 向镜头下方（平面的 y 轴朝 -z，所以 v = -y）
						vec2 q = vec2(vP.x, -vP.y);
						float H = ${PAPER_HALF.toFixed(1)};
						float r = length(q) * 1.55;
						float ang = atan(q.y, q.x);
						// 纸纤维与边缘
						float fiber = fbm(q * vec2(0.9, 3.5)) * 0.5 + fbm(q * 6.0) * 0.5;
						float border = lineAt(max(abs(q.x), abs(q.y)) - (H - 0.7), 0.03);
						float edge = smoothstep(H, H - 0.25, max(abs(q.x), abs(q.y)));
						// 广场的地纹（同心圆、放射线、口子）
						float rings = max(gridLine(r, 1.5, 0.035), gridLine(r, 6.0, 0.05)) * (1.0 - smoothstep(15.8, 16.4, r));
						float rays = gridLine(ang * r, 1.6, 0.03) * step(3.0, r) * (1.0 - smoothstep(14.0, 15.5, r));
						float rim = exp(-abs(r - uPortal) / 0.15);
						vec3 col;
						if (gl_FrontFacing) {
							col = vec3(0.028, 0.03, 0.05) * (0.85 + 0.3 * fiber);
							col += vec3(0.96, 0.92, 1.0) * border * 0.45;
							col += (rings + rays) * vec3(0.55, 0.55, 0.72) * 0.55 * uPlaza;
							col += vec3(1.0, 0.72, 0.34) * rim * 0.9 * uPlaza;
							// 被推到背面的金线：从纸背隐约透过来（模糊、发暖）
							float path = abs(q.x - 0.8 * sin(q.y * 0.5) - 0.4);
							float bleed = exp(-path * path / 1.2) * smoothstep(2.5, 5.5, q.y) * smoothstep(H, H - 1.5, q.y);
							col += vec3(1.0, 0.62, 0.24) * bleed * uBleed * (0.25 + 0.08 * fiber);
						} else {
							// 背面：同一张图刻成金线
							col = vec3(0.04, 0.026, 0.03) * (0.85 + 0.3 * fiber);
							col += vec3(1.0, 0.74, 0.36) * border * 0.6;
							col += (rings + rays) * vec3(1.0, 0.7, 0.32) * 0.7;
							col += vec3(1.0, 0.72, 0.34) * rim * 1.2;
						}
						gl_FragColor = vec4(col * edge, uA * edge);
					}`,
			}),
		[],
	);
	const a = paperA(f);
	if (a <= 0) return null;
	const u = mat.uniforms;
	u.uA.value = a;
	u.uPlaza.value = Math.max(1 - smooth(prog(f, PAPER_IN + 2, PAPER_IN + 22)), smooth(prog(f, PLAZA_BACK, PLAZA_BACK + 26)));
	u.uBleed.value = smooth(prog(f, PUSH_AT + 18, bf(25, 3))) * (1 - smooth(prog(f, PLAZA_BACK, PLAZA_BACK + 20)));
	u.uT.value = f;
	return (
		<group position={[PORTAL_C[0], PAPER_Y, PORTAL_C[2]]} rotation={[paperAngle(f), 0, 0]}>
			<mesh material={mat} rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[PAPER_HALF * 2, PAPER_HALF * 2]} />
			</mesh>
		</group>
	);
};

// ════════ 纸面上的线（SVG） ════════

type P2 = [number, number];
const quad = (a: P2, b: P2, c: P2, t: number): P2 => [
	(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0],
	(1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1],
];

const STRANDS: {rgb: string; ctrl: P2; end: P2; delay: number}[] = [
	{rgb: '110,165,255', ctrl: [-2.6, -1.6], end: [-7.2, -6.2], delay: 0},
	{rgb: '255,150,205', ctrl: [2.6, -1.6], end: [7.2, -6.2], delay: 4},
	{rgb: '255,196,110', ctrl: [1.4, 3], end: [0.7, 6.6], delay: 8},
];

const LAKE: {rgb: string; p: P2}[] = [
	{rgb: '255,226,120', p: [-1.8, -3.2]},
	{rgb: '255,150,205', p: [0, -4.4]},
	{rgb: '120,175,255', p: [1.8, -3.2]},
];

/** 洗翠的裂缝：横在金线透过来的地方，锯齿形 */
const TEAR: P2[] = Array.from({length: 15}, (_, i) => [-4.9 + i * 0.7, 6.4 + (rnd(i * 4.7) - 0.5) * 1.0 + Math.sin(i * 0.9) * 0.4]);

export const PaperInk: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const a = paperA(f);
	if (a <= 0 || f > FLIP_AT + 4 || !frontFacing(f, c)) return null;
	const pr = (u: number, v: number) => project(c, toWorld(f, u, v));
	const inkOut = 1 - smooth(prog(f, PLAZA_BACK, PLAZA_BACK + 18));
	// 起始的那一点光
	const o = pr(0, 0);
	const originA = smooth(prog(f, PAPER_IN, PAPER_IN + 8)) * (0.55 + 0.45 * (1 - smooth(prog(f, LINES_AT, bf(23, 2))))) * inkOut;
	// 三条线
	const strands = STRANDS.map((s, i) => {
		const grow = easeOutCubic(prog(f, LINES_AT + s.delay, bf(23, 2) + s.delay));
		// 金线：第 24 小节第 3 拍起整条往纸边滑下去，滑出纸边的部分看不见
		const slide = i === 2 ? 12 * ease(prog(f, PUSH_AT, PUSH_AT + 26)) : 0;
		const fade = i === 2 ? 1 - smooth(prog(f, PUSH_AT + 18, PUSH_AT + 30)) : 1;
		const pts: string[] = [];
		const N = 40;
		for (let k = 0; k <= N; k++) {
			const t = (k / N) * grow;
			const [u, v] = quad([0, 0], s.ctrl, s.end, t);
			const vv = v + slide;
			if (vv > PAPER_HALF - 0.4) break;
			const p = pr(u, vv);
			pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
		}
		const head = quad([0, 0], s.ctrl, s.end, grow);
		return {d: pts.join(' '), rgb: s.rgb, a: fade * inkOut * (grow > 0 ? 1 : 0), head: pr(head[0], Math.min(head[1] + slide, PAPER_HALF - 0.4)), slide};
	});
	// 金线滑出纸边时，纸边上一点金光
	const edgeGlow = smooth(prog(f, PUSH_AT + 8, PUSH_AT + 16)) * (1 - smooth(prog(f, PUSH_AT + 26, PUSH_AT + 44)));
	const edge = pr(1.0, PAPER_HALF - 0.2);
	const lakeA = smooth(prog(f, TWO_AT + 4, TWO_AT + 20)) * inkOut;
	// 裂缝：张开又合上
	const tearW = Math.sin(Math.PI * prog(f, TEAR_AT, TEAR_AT + 40)) * (f > TEAR_AT ? 1 : 0);
	const tear = TEAR.map(([u, v], i) => {
		const k = Math.sin((i / (TEAR.length - 1)) * Math.PI);
		const up = pr(u, v - tearW * 0.6 * k);
		const dn = pr(u, v + tearW * 0.6 * k);
		return {up, dn};
	});
	const tearPoly = [...tear.map((t) => `${t.up.x},${t.up.y}`), ...[...tear].reverse().map((t) => `${t.dn.x},${t.dn.y}`)].join(' ');
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: a}}>
			<defs>
				<filter id="rv-ink-w" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="9" />
				</filter>
				<filter id="rv-ink-g" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation="22" />
				</filter>
			</defs>
			{strands.map((s, i) =>
				s.a > 0.01 ? (
					<g key={i} opacity={s.a}>
						<polyline points={s.d} fill="none" stroke={`rgba(${s.rgb},0.55)`} strokeWidth={14} filter="url(#rv-ink-w)" />
						<polyline points={s.d} fill="none" stroke={`rgba(${s.rgb},1)`} strokeWidth={3} strokeLinecap="round" />
						<circle cx={s.head.x} cy={s.head.y} r={5} fill={`rgba(255,255,255,0.9)`} filter="url(#rv-ink-w)" />
					</g>
				) : null,
			)}
			{originA > 0.01 ? <circle cx={o.x} cy={o.y} r={26} fill={`rgba(255,226,170,${originA})`} filter="url(#rv-ink-g)" /> : null}
			{originA > 0.01 ? <circle cx={o.x} cy={o.y} r={5} fill={`rgba(255,250,235,${originA})`} /> : null}
			{edgeGlow > 0.01 ? <circle cx={edge.x} cy={edge.y} r={40} fill={`rgba(255,180,90,${0.8 * edgeGlow})`} filter="url(#rv-ink-g)" /> : null}
			{lakeA > 0.01
				? LAKE.map((l, i) => {
						const p = pr(l.p[0], l.p[1]);
						return (
							<g key={i} opacity={lakeA * (0.85 + 0.15 * Math.sin(f * 0.2 + i * 2))}>
								<circle cx={p.x} cy={p.y} r={16} fill={`rgba(${l.rgb},0.6)`} filter="url(#rv-ink-w)" />
								<circle cx={p.x} cy={p.y} r={3.5} fill="rgba(255,255,255,0.95)" />
							</g>
						);
					})
				: null}
			{tearW > 0.01 ? (
				<g>
					<polygon points={tearPoly} fill={`rgba(255,70,40,${0.55 * tearW})`} filter="url(#rv-ink-w)" />
					<polygon points={tearPoly} fill={`rgba(255,215,150,${0.9 * tearW})`} />
					<polyline points={tear.map((t) => `${t.up.x},${t.up.y}`).join(' ')} fill="none" stroke={`rgba(255,90,50,${tearW})`} strokeWidth={2.5} />
					<polyline points={tear.map((t) => `${t.dn.x},${t.dn.y}`).join(' ')} fill="none" stroke={`rgba(255,90,50,${tearW})`} strokeWidth={2.5} />
				</g>
			) : null}
		</svg>
	);
};

/** 翻面那一下：纸立起来（侧对镜头）时的一道金光 */
export const flipFlash = (f: number) => {
	const t = prog(f, FLIP_AT, FLIP_AT + FLIP_LEN);
	return Math.exp(-Math.pow((t - 0.5) / 0.18, 2)) * (f > FLIP_AT ? 1 : 0);
};

