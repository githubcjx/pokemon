import {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {CINZEL, SERIF} from '../../fonts';
import {V3} from '../../three/stage';
import {Cam, project, pxOf} from './cam';
import {bf, BEAT, easeOutCubic, env, lerp, prog, rnd, smooth, TOTAL_FRAMES, track} from './common';
import {CC} from './clash';
import {CUT_P1, CUT_P2, PANEL_H, PANEL_W, PEARL, PINK} from './hook';

/**
 * 第 8 段「一块布」与第 9 段「回到屏幕」：
 * 撕口合拢的地方织成一整块布：横向是空间（珍珠色），纵向是时间（钴蓝）；布整体起伏（GridDistortion 的思路）
 * → 58.0 从地球望向太阳，光要走 8 分 20 秒；月亮、仙女座星系依次挂上，排成星星的穹顶（DomeGallery 的排法）
 * → 60.0 镜头绕到侧面，穹顶的深度方向变成一根时间轴 → 61.0 回到布上：一点淡金的光分出钴蓝与珍珠两道光，重新织出时间与空间
 * → 63.1 光尘凝成一颗颗微粒（物质）→ 64–65 两道光绕着彼此收拢，布朝镜头折过来、压平
 * → 66.0 正好变回开场第 0 帧那张珍珠白方格网 → 半米与 1.7 纳秒 → 呼吸与心跳同步 → 光淡去，停在开场第 0 帧（重播无缝）。
 */

// ════════ 时间线 ════════

const CLOTH_AT = bf(55, 1);
const WAVE_AT = bf(56, 2);
export const SUNLIGHT_AT = bf(58);
const DOME_AT = bf(59);
const AXIS_AT = bf(60);
export const SPLIT_AT = bf(61);
export const MATTER_AT = bf(63, 1);
const SPIRAL_AT = bf(64);
/** 第 66 小节落拍：拍平成开场的屏幕 */
export const SCREEN_AT = bf(66);
const RULER_AT = bf(67);
const SCAR_AT = bf(68, 2);
export const PULSE_AT = bf(70, 1);
const SYNC_AT = bf(71, 1);
export const END_AT = bf(72);

const CLOTH_W = 26;
const CLOTH_H = 15;

// ════════ 布 / 屏幕 ════════

/** 织线的整体亮度：看光的那几小节压暗一点，第 60 小节第 3 拍起几乎抹掉，等两道光重新织出来 */
const lineAt = (f: number) =>
	track(f, [
		[bf(57, 2), 1],
		[SUNLIGHT_AT, 0.4],
		[bf(60, 2), 0.4],
		[SPLIT_AT, 0.1],
	]);
/** 重新织出来的范围（布的局部坐标，从中心往外） */
const revAt = (f: number) => ({x: 14 * easeOutCubic(prog(f, SPLIT_AT, bf(62, 3))), y: 8.5 * easeOutCubic(prog(f, SPLIT_AT + BEAT, bf(63)))});
const foldAt = (f: number) => Math.sin(Math.PI * smooth(prog(f, SPIRAL_AT, SCREEN_AT))) * smooth(prog(f, SPIRAL_AT, bf(65)));
const shrinkAt = (f: number) => smooth(prog(f, bf(64, 2), SCREEN_AT));
const panelAt = (f: number) => smooth(prog(f, bf(65, 2), SCREEN_AT));

export const clothOn = (f: number) => smooth(prog(f, CLOTH_AT, bf(56, 1)));

export const Cloth: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(() => new THREE.PlaneGeometry(CLOTH_W, CLOTH_H, 156, 90), []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				side: THREE.DoubleSide,
				uniforms: {
					uT: {value: 0},
					uPT: {value: 0},
					uWave: {value: 0},
					uFold: {value: 0},
					uScale: {value: new THREE.Vector2(1, 1)},
					uLine: {value: 1},
					uRedraw: {value: 0},
					uRev: {value: new THREE.Vector2(99, 99)},
					uPanel: {value: 0},
					uScar: {value: 0},
					uA: {value: 0},
					uFlash: {value: 0},
					uP1: {value: new THREE.Vector2(...CUT_P1)},
					uP2: {value: new THREE.Vector2(...CUT_P2)},
				},
				vertexShader: /* glsl */ `
					uniform float uT; uniform float uWave; uniform float uFold; uniform vec2 uScale;
					varying vec2 vL; varying vec2 vUv; varying float vZ;
					void main() {
						vL = position.xy;
						vUv = uv;
						vec3 p = position;
						float z = uWave * (sin(p.x * 0.33 + uT * 0.045) * 0.7 + sin(p.y * 0.52 - uT * 0.038) * 0.5 + sin((p.x + p.y) * 0.21 + uT * 0.03) * 0.45);
						// 往镜头折过来：四边先翘起来
						z += uFold * (pow(abs(p.x) / ${(CLOTH_W / 2).toFixed(1)}, 2.0) * 6.0 + pow(abs(p.y) / ${(CLOTH_H / 2).toFixed(1)}, 2.0) * 3.5);
						vZ = z;
						p.xy *= uScale;
						p.z = z;
						gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
					}`,
				fragmentShader: /* glsl */ `
					uniform float uT; uniform float uPT; uniform float uLine; uniform float uRedraw; uniform vec2 uRev;
					uniform float uPanel; uniform float uScar; uniform float uA; uniform float uFlash;
					uniform vec2 uP1; uniform vec2 uP2;
					varying vec2 vL; varying vec2 vUv; varying float vZ;
					float line1(float x, float w) { float g = abs(fract(x - 0.5) - 0.5) / max(fwidth(x), 1e-4); return 1.0 - min(g / w, 1.0); }
					float gridLine(vec2 p, float w) { vec2 g = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), 1e-4); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
					float segDist(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
					void main() {
						// ── 布：纵向时间线（钴蓝）× 横向空间线（珍珠），一上一下地织 ──
						float s = 0.62;
						float vx = line1(vL.x / s, 1.5);
						float hy = line1(vL.y / s, 1.5);
						float weave = sin(3.14159 * vL.x / s) * sin(3.14159 * vL.y / s);
						float over = smoothstep(-0.2, 0.2, weave);
						float mv = mix(uLine, 0.1 + 0.9 * smoothstep(uRev.x + 0.6, uRev.x - 0.6, abs(vL.x)), uRedraw);
						float mh = mix(uLine, 0.1 + 0.9 * smoothstep(uRev.y + 0.6, uRev.y - 0.6, abs(vL.y)), uRedraw);
						vec3 cT = vec3(0.38, 0.6, 1.0);
						vec3 cS = vec3(1.0, 0.84, 0.95);
						float shade = 0.75 + 0.25 * clamp(vZ * 0.6, -1.0, 1.0);
						vec3 col = cT * vx * mv * (0.55 + 0.45 * over) * 1.15 + cS * hy * mh * (0.55 + 0.45 * (1.0 - over)) * 1.05;
						// 织出来的那一道前沿
						col += cT * exp(-abs(abs(vL.x) - uRev.x) / 0.25) * uRedraw * step(uRev.x, 13.0) * 0.9;
						col += cS * exp(-abs(abs(vL.y) - uRev.y) / 0.25) * uRedraw * step(uRev.y, 7.5) * 0.9;
						col *= shade;
						vec2 e = vec2(${(CLOTH_W / 2).toFixed(1)}, ${(CLOTH_H / 2).toFixed(1)}) - abs(vL);
						float edge = smoothstep(0.0, 1.2, min(e.x, e.y));
						float a = clamp(max(vx * mv, hy * mh) * 0.9 + 0.06, 0.0, 1.0) * edge;
						// ── 屏幕：和开场第 0 帧同一张方格网（hook.tsx 的面板） ──
						vec2 p = (vUv - 0.5) * vec2(${PANEL_W.toFixed(4)}, ${PANEL_H.toFixed(4)});
						vec2 q = p + vec2(uPT * 0.0042, uPT * 0.0016);
						float cell = 0.4315;
						float minor = gridLine(q / cell, 1.1);
						float major = gridLine(q / (cell * 4.0), 1.5);
						float r = length(p / vec2(6.5, 3.7));
						vec3 base = mix(vec3(0.034, 0.03, 0.054), vec3(0.016, 0.014, 0.028), smoothstep(0.0, 1.3, r));
						vec3 lc = vec3(0.86, 0.83, 0.94);
						vec3 pc = base + lc * (minor * 0.2 + major * 0.32);
						pc += vec3(0.05, 0.045, 0.07) * smoothstep(0.9, 0.0, abs(p.x * 0.35 + p.y * 0.9 - 1.2));
						// 开场那道斩痕愈合后留下的淡痕
						float d = segDist(p, uP1, uP2);
						pc += vec3(1.0, 0.6, 0.82) * (exp(-d / 0.012) * 0.16 + exp(-d / 0.1) * 0.04) * uScar;
						pc += vec3(1.0, 0.92, 0.97) * uFlash;
						col = mix(col, pc, uPanel);
						a = mix(a, 1.0, uPanel);
						gl_FragColor = vec4(col, a * uA);
					}`,
			}),
		[],
	);
	// 结尾不淡出：停在开场第 0 帧那张屏幕上，重播时无缝接上
	const on = clothOn(f);
	if (on <= 0) return null;
	const u = mat.uniforms;
	u.uT.value = f;
	// 屏幕网格的平移按"距离片尾还有几帧"算：最后一帧正好是开场第 0 帧的前一帧
	u.uPT.value = f - TOTAL_FRAMES;
	u.uWave.value = smooth(prog(f, WAVE_AT, bf(57, 1))) * (1 - smooth(prog(f, SPIRAL_AT, SCREEN_AT))) * 0.9 + 0.08 * (1 - panelAt(f));
	u.uFold.value = foldAt(f);
	const sh = shrinkAt(f);
	u.uScale.value.set(lerp(1, PANEL_W / CLOTH_W, sh), lerp(1, PANEL_H / CLOTH_H, sh));
	u.uLine.value = lineAt(f);
	u.uRedraw.value = f >= SPLIT_AT ? 1 : 0;
	const rv = revAt(f);
	u.uRev.value.set(f >= SPLIT_AT ? rv.x : 99, f >= SPLIT_AT ? rv.y : 99);
	u.uPanel.value = panelAt(f);
	u.uScar.value = env(f, SCAR_AT, END_AT, 24, 30);
	u.uA.value = on;
	u.uFlash.value = f >= SCREEN_AT - 1 ? 0.35 * Math.exp(-(f - SCREEN_AT) / 5) : 0;
	return <mesh geometry={geo} material={mat} position={CC} frustumCulled={false} />;
};

// ════════ 看得越远，看到的就越早 ════════

/** 你（地球）、月亮、太阳、仙女座星系：都在布前后，侧面看时排成一根时间轴 */
const EARTH: V3 = [CC[0] - 8, CC[1] - 3.2, CC[2] + 8];
const MOON: V3 = [EARTH[0] + 1.6, EARTH[1] + 1.3, EARTH[2] - 1.5];
const SUN: V3 = [CC[0] + 5, CC[1] + 2.8, CC[2] + 2];
const ANDRO: V3 = [CC[0] - 3, CC[1] + 6.5, CC[2] - 34];
const AXIS_Y = EARTH[1] - 2.2;

const domeOn = (f: number) => env(f, SUNLIGHT_AT - 4, SPLIT_AT + 4, 10, 14);

/** 穹顶上的星点与经线（3D） */
export const Dome: React.FC<{f: number}> = ({f}) => {
	const geos = useMemo(() => {
		const sp: number[] = [];
		for (let i = 0; i < 420; i++) {
			const a = rnd(i * 1.7) * Math.PI * 2;
			const e = Math.acos(rnd(i * 2.9));
			sp.push(Math.sin(e) * Math.cos(a), Math.cos(e), -Math.sin(e) * Math.sin(a) * 0.9);
		}
		const stars = new THREE.BufferGeometry();
		stars.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
		const lp: number[] = [];
		for (let m = 0; m < 7; m++) {
			const a = (m / 7) * Math.PI;
			for (let i = 0; i < 48; i++) {
				const e0 = (i / 48) * Math.PI;
				const e1 = ((i + 1) / 48) * Math.PI;
				lp.push(Math.cos(e0), Math.sin(e0) * Math.cos(a), -Math.sin(e0) * Math.sin(a), Math.cos(e1), Math.sin(e1) * Math.cos(a), -Math.sin(e1) * Math.sin(a));
			}
		}
		for (const el of [0.3, 0.65, 1.0]) {
			for (let i = 0; i < 64; i++) {
				const a0 = (i / 64) * Math.PI;
				const a1 = ((i + 1) / 64) * Math.PI;
				const r = Math.cos(el);
				lp.push(Math.cos(a0) * r, Math.sin(el), -Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(el), -Math.sin(a1) * r);
			}
		}
		const arcs = new THREE.BufferGeometry();
		arcs.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
		// 时间轴（沿 −z）与刻度
		const ap: number[] = [EARTH[0], AXIS_Y, EARTH[2] + 1, EARTH[0], AXIS_Y, ANDRO[2] - 8];
		for (const P of [EARTH, MOON, SUN, ANDRO]) ap.push(EARTH[0], AXIS_Y - 0.4, P[2], EARTH[0], AXIS_Y + 0.4, P[2], P[0], P[1], P[2], EARTH[0], AXIS_Y, P[2]);
		const axis = new THREE.BufferGeometry();
		axis.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
		return {stars, arcs, axis};
	}, []);
	const mats = useMemo(
		() => ({
			stars: new THREE.PointsMaterial({color: new THREE.Color(1, 0.9, 0.97), size: 2.2, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}),
			arcs: new THREE.LineBasicMaterial({color: new THREE.Color(0.55, 0.5, 0.75), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}),
			axis: new THREE.LineBasicMaterial({color: new THREE.Color(0.9, 0.85, 1.0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}),
		}),
		[],
	);
	const a = domeOn(f);
	if (a <= 0) return null;
	const dome = smooth(prog(f, DOME_AT, DOME_AT + BEAT * 3));
	mats.stars.opacity = a * dome;
	mats.arcs.opacity = a * dome * 0.14 * (1 - smooth(prog(f, AXIS_AT - 10, AXIS_AT)));
	mats.axis.opacity = a * smooth(prog(f, AXIS_AT - 6, AXIS_AT + 14));
	return (
		<>
			<points geometry={geos.stars} material={mats.stars} position={EARTH} scale={30 * lerp(0.6, 1, dome)} frustumCulled={false} />
			<lineSegments geometry={geos.arcs} material={mats.arcs} position={EARTH} scale={30 * lerp(0.6, 1, dome)} frustumCulled={false} />
			<lineSegments geometry={geos.axis} material={mats.axis} frustumCulled={false} />
		</>
	);
};

const Tag: React.FC<{x: number; y: number; zh: string; en: string; a: number; align?: 'left' | 'right'; size?: number}> = ({x, y, zh, en, a, align = 'left', size = 30}) =>
	a > 0.01 ? (
		<div style={{position: 'absolute', left: align === 'left' ? x : x - 700, top: y, width: 700, textAlign: align, opacity: a, textShadow: `0 0 12px rgba(${PINK},0.55), 0 0 4px rgba(0,0,0,0.95)`}}>
			<div style={{fontFamily: SERIF, fontWeight: 700, fontSize: size, color: '#fff2fa', letterSpacing: 3}}>{zh}</div>
			<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 13, letterSpacing: 4, color: 'rgba(255,228,244,0.78)', marginTop: 4}}>{en}</div>
		</div>
	) : null;

type GlintT = React.FC<{x: number; y: number; r: number; a: number; star: number}>;

/** 地球、太阳、月亮、仙女座的光点与标注；太阳的光沿一条线走到地球 */
export const LightAges: React.FC<{f: number; c: Cam; Glint: GlintT}> = ({f, c, Glint}) => {
	const a = domeOn(f);
	if (a <= 0) return null;
	const E = project(c, EARTH);
	const S = project(c, SUN);
	const M = project(c, MOON);
	const A = project(c, ANDRO);
	const beam = smooth(prog(f, SUNLIGHT_AT, SUNLIGHT_AT + BEAT * 2.5));
	const bx = lerp(S.x, E.x, beam);
	const by = lerp(S.y, E.y, beam);
	const side = smooth(prog(f, AXIS_AT - 6, AXIS_AT + 14)) * (1 - smooth(prog(f, bf(60, 3), SPLIT_AT)));
	const lE = env(f, SUNLIGHT_AT, SPLIT_AT, 10, 12);
	const lS = env(f, SUNLIGHT_AT + BEAT * 2, SPLIT_AT, 10, 12);
	const lM = env(f, DOME_AT, SPLIT_AT, 10, 12);
	const lA = env(f, DOME_AT + BEAT * 2, SPLIT_AT, 10, 12);
	const tick = (P: V3) => project(c, [EARTH[0], AXIS_Y, P[2]]);
	const ticks: [V3, string, string][] = [
		[EARTH, '现在', 'NOW'],
		[MOON, '1.3 秒前', '1.3 S AGO'],
		[SUN, '8 分 20 秒前', '8 MIN 20 S AGO'],
		[ANDRO, '250 万年前', '2.5 MILLION YEARS AGO'],
	];
	const axisEnd = project(c, [EARTH[0], AXIS_Y, ANDRO[2] - 8]);
	return (
		<>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: a}}>
				<defs>
					<filter id="sp-sunbeam" x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur stdDeviation="5" />
					</filter>
				</defs>
				{beam > 0 ? (
					<>
						<line x1={S.x} y1={S.y} x2={bx} y2={by} stroke="rgba(255,236,200,0.7)" strokeWidth={8} filter="url(#sp-sunbeam)" />
						<line x1={S.x} y1={S.y} x2={bx} y2={by} stroke="rgba(255,248,236,0.95)" strokeWidth={2} />
					</>
				) : null}
			</svg>
			<Glint x={E.x} y={E.y} r={8} a={a} star={0.3} />
			<Glint x={S.x} y={S.y} r={20} a={a * smooth(prog(f, SUNLIGHT_AT - 4, SUNLIGHT_AT + 4))} star={0.8} />
			<Glint x={M.x} y={M.y} r={6} a={lM} star={0.3} />
			<Glint x={A.x} y={A.y} r={9} a={lA} star={0.6} />
			{beam > 0 && beam < 1 ? <Glint x={bx} y={by} r={8} a={a} star={0.6} /> : null}
			{/* 正面看：标注挂在各自旁边 */}
			<Tag x={E.x + 26} y={E.y + 10} zh="你 · 地球" en="YOU · EARTH" a={lE * (1 - side)} />
			<Tag x={S.x + 34} y={S.y - 30} zh="太阳 · 8 分 20 秒前的样子" en="THE SUN · AS IT WAS 8 MIN 20 S AGO" a={lS * (1 - side)} />
			<Tag x={M.x + 20} y={M.y - 62} zh="月亮 · 1.3 秒前" en="THE MOON · 1.3 S AGO" a={lM * (1 - side)} size={24} />
			<Tag x={A.x - 20} y={A.y - 70} zh="仙女座星系 · 250 万年前" en="ANDROMEDA · 2.5 MILLION YEARS AGO" a={lA * (1 - side)} align="right" size={26} />
			{/* 侧面看：同样几样东西沿时间轴排开 */}
			{ticks.map(([P, zh, en], i) => {
				const t = tick(P);
				return <Tag key={i} x={t.x - 680} y={t.y + 24} zh={zh} en={en} a={side} align="right" size={28} />;
			})}
			{side > 0.01 ? (
				<div style={{position: 'absolute', left: axisEnd.x - 520, top: axisEnd.y - 82, width: 500, textAlign: 'right', opacity: side, textShadow: '0 0 10px rgba(0,0,0,0.9)'}}>
					<div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 30, color: '#e8ecff', letterSpacing: 3}}>越远 → 越早</div>
					<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 13, letterSpacing: 4, color: 'rgba(220,228,255,0.75)', marginTop: 4}}>FARTHER = EARLIER · NOT TO SCALE</div>
				</div>
			) : null}
		</>
	);
};

// ════════ 两道光：重新织出时间与空间，最后绕着彼此收拢 ════════

export const WeaveLights: React.FC<{f: number; c: Cam; Glint: GlintT}> = ({f, c, Glint}) => {
	const out: React.ReactNode[] = [];
	// 淡金的一点（起始之物，不显形）
	const gold = env(f, bf(60, 2), SPLIT_AT + 8, 14, 8);
	if (gold > 0) {
		const p = project(c, [CC[0], CC[1], CC[2] + 0.3]);
		const r = 160 * (1 + Math.exp(-Math.abs(f - SPLIT_AT) / 5));
		out.push(
			<div key="gold" style={{position: 'absolute', left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, mixBlendMode: 'screen', background: `radial-gradient(circle, rgba(255,240,205,${0.95 * gold}) 0%, rgba(255,214,150,${0.4 * gold}) 14%, rgba(0,0,0,0) 60%)`}} />,
		);
	}
	// 分出来的两道光：钴蓝沿横向往两边走（身后留下纵向的时间线），珍珠沿纵向往上下走
	const rv = revAt(f);
	const wa = env(f, SPLIT_AT, bf(63, 1), 2, 14);
	if (wa > 0) {
		for (const s of [-1, 1]) {
			if (rv.x < 13.2) {
				const p = project(c, [CC[0] + s * rv.x, CC[1], CC[2] + 0.3]);
				out.push(<CobaltGlint key={`c${s}`} x={p.x} y={p.y} a={wa} />);
			}
			if (rv.y < 7.6) {
				const p = project(c, [CC[0], CC[1] + s * rv.y, CC[2] + 0.3]);
				out.push(<Glint key={`p${s}`} x={p.x} y={p.y} r={11} a={wa} star={0.7} />);
			}
		}
	}
	// 64–65：两道光绕着彼此越转越近，66.0 合在一起
	const sa = env(f, SPIRAL_AT - 4, SCREEN_AT + 2, 10, 4);
	if (sa > 0) {
		const k = prog(f, SPIRAL_AT, SCREEN_AT);
		const R = 6 * (1 - smooth(k));
		const ang = k * k * Math.PI * 8;
		for (const s of [0, 1]) {
			const a = ang + s * Math.PI;
			const p = project(c, [CC[0] + Math.cos(a) * R * 1.5, CC[1] + Math.sin(a) * R * 0.8, CC[2] + 1]);
			out.push(s === 0 ? <CobaltGlint key={`sc${s}`} x={p.x} y={p.y} a={sa} /> : <Glint key={`sp${s}`} x={p.x} y={p.y} r={12} a={sa} star={0.8} />);
		}
	}
	return <>{out}</>;
};

const CobaltGlint: React.FC<{x: number; y: number; a: number; r?: number}> = ({x, y, a, r = 12}) => (
	<>
		<div style={{position: 'absolute', left: x - r * 3, top: y - r * 3, width: r * 6, height: r * 6, mixBlendMode: 'screen', background: `radial-gradient(circle, rgba(235,245,255,${a}) 0%, rgba(110,160,255,${0.6 * a}) 16%, rgba(80,130,255,${0.18 * a}) 40%, rgba(0,0,0,0) 70%)`}} />
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
			<line x1={x - r * 6} y1={y} x2={x + r * 6} y2={y} stroke={`rgba(180,210,255,${0.6 * a})`} strokeWidth={1.4} />
			<line x1={x} y1={y - r * 3.5} x2={x} y2={y + r * 3.5} stroke={`rgba(180,210,255,${0.45 * a})`} strokeWidth={1.1} />
		</svg>
	</>
);

/** 63.1：两道光之间，光尘凝成一颗颗微粒（"物质"） */
const MATTER_N = 900;
const CLUSTERS = 34;
export const Matter: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const p = new Float32Array(MATTER_N * 3);
		const tg = new Float32Array(MATTER_N * 3);
		const s = new Float32Array(MATTER_N);
		const cl: V3[] = Array.from({length: CLUSTERS}, (_, k) => [(rnd(k * 3.7) - 0.5) * 20, (rnd(k * 5.9) - 0.5) * 11, rnd(k * 1.3) * 1.5]);
		for (let i = 0; i < MATTER_N; i++) {
			p.set([(rnd(i * 1.9) - 0.5) * 24, (rnd(i * 2.7) - 0.5) * 13, rnd(i * 4.3) * 2.5], i * 3);
			const k = Math.floor(rnd(i * 6.1) * CLUSTERS);
			const j = 0.02 + 0.07 * rnd(i * 7.7);
			const a = rnd(i * 8.3) * Math.PI * 2;
			tg.set([cl[k][0] + Math.cos(a) * j, cl[k][1] + Math.sin(a) * j, cl[k][2]], i * 3);
			s[i] = rnd(i * 9.1);
		}
		g.setAttribute('position', new THREE.BufferAttribute(p, 3));
		g.setAttribute('aTg', new THREE.BufferAttribute(tg, 3));
		g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: {uK: {value: 0}, uPull: {value: 0}, uA: {value: 0}, uT: {value: 0}},
				vertexShader: /* glsl */ `
					attribute vec3 aTg; attribute float aS;
					uniform float uK; uniform float uPull; uniform float uT;
					varying float vB;
					void main() {
						vec3 drift = vec3(sin(uT * 0.02 + aS * 30.0), cos(uT * 0.017 + aS * 20.0), 0.0) * 0.25 * (1.0 - uK);
						vec3 p = mix(position + drift, aTg, uK);
						p = mix(p, vec3(0.0, 0.0, 1.0), uPull);
						vB = mix(0.25, 1.0, uK) * (0.4 + 0.6 * aS);
						vec4 mv = modelViewMatrix * vec4(p, 1.0);
						gl_PointSize = clamp(mix(2.0, 4.5, uK) * 22.0 / -mv.z * (0.6 + 0.8 * aS), 1.0, 7.0);
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying float vB;
					void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.94, 0.86) * smoothstep(0.5, 0.0, d) * vB * uA, 1.0); }`,
			}),
		[],
	);
	const a = env(f, bf(62, 2), bf(65, 2), 20, 14);
	if (a <= 0) return null;
	mat.uniforms.uK.value = easeOutCubic(prog(f, MATTER_AT, MATTER_AT + BEAT * 2.5));
	mat.uniforms.uPull.value = smooth(prog(f, bf(64, 2), bf(65, 2)));
	mat.uniforms.uA.value = a;
	mat.uniforms.uT.value = f;
	return <points geometry={geo} material={mat} position={[CC[0], CC[1], CC[2] + 0.2]} frustumCulled={false} />;
};

// ════════ 第 9 段：屏幕上的标注、呼吸与心跳 ════════

/** 67.0：从画面下方（你的位置）连到屏幕的一条虚线：约半米、光走约 1.7 纳秒 */
export const ScreenRuler: React.FC<{f: number}> = ({f}) => {
	const a = env(f, RULER_AT, SCAR_AT + 10, 6, 16);
	if (a <= 0) return null;
	const x = 1470;
	const y0 = 1100;
	const y1 = 560;
	const k = easeOutCubic(prog(f, RULER_AT, RULER_AT + 14));
	const y = lerp(y0, y1, k);
	return (
		<>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: a}}>
				<line x1={x} y1={y0} x2={x} y2={y} stroke={`rgba(${PEARL},0.9)`} strokeWidth={2.4} strokeDasharray="10 9" />
				{k > 0.95 ? (
					<>
						<circle cx={x} cy={y1} r={9} fill="none" stroke={`rgb(${PEARL})`} strokeWidth={2} />
						<circle cx={x} cy={y1} r={3} fill={`rgb(${PEARL})`} />
					</>
				) : null}
			</svg>
			<Tag x={x + 28} y={y1 + 40} zh="≈ 0.5 米 · 光走 ≈ 1.7 纳秒" en="≈ 0.5 M · LIGHT TAKES ≈ 1.7 NS" a={a * smooth(prog(f, RULER_AT + 8, RULER_AT + 20))} />
			<div style={{position: 'absolute', left: 120, top: 96, opacity: a * 0.85, textShadow: '0 0 10px rgba(0,0,0,0.9)'}}>
				<div style={{fontFamily: SERIF, fontSize: 22, letterSpacing: 4, color: 'rgba(255,236,246,0.92)'}}>1 纳秒 = 十亿分之一秒</div>
				<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 13, letterSpacing: 4, color: 'rgba(255,228,244,0.7)', marginTop: 6}}>1 NS = ONE BILLIONTH OF A SECOND</div>
			</div>
		</>
	);
};

/** 心跳：每两拍一下（咚—咚），从 70.1 起 */
const heartAt = (f: number) => {
	if (f < PULSE_AT) return 0;
	const k = Math.floor((f - PULSE_AT) / (BEAT * 2));
	const t0 = PULSE_AT + k * BEAT * 2;
	const t = f - t0;
	return Math.exp(-t / 6) + 0.55 * (t > 6 ? Math.exp(-(t - 6) / 6) : 0);
};
/** 呼吸：周期两拍，起初比心跳晚大半拍，到 71.1 正好对上 */
const breathAt = (f: number) => {
	const lag = BEAT * 0.9 * (1 - smooth(prog(f, PULSE_AT, SYNC_AT)));
	return 0.5 + 0.5 * Math.cos(((f - PULSE_AT - lag) / (BEAT * 2)) * Math.PI * 2);
};

export const BreathHeart: React.FC<{f: number; Glint: GlintT}> = ({f, Glint}) => {
	const a = smooth(prog(f, PULSE_AT - 8, PULSE_AT + 8)) * (1 - smooth(prog(f, bf(71, 3), END_AT)));
	if (a <= 0) return null;
	const br = breathAt(f);
	const hb = Math.min(1.2, heartAt(f));
	const sync = smooth(prog(f, SYNC_AT - 6, SYNC_AT + 4));
	const gx = 960;
	const py = 300;
	const dy = 770;
	const w = 26 * (1 + 0.35 * hb);
	const ripple = (f - PULSE_AT) % (BEAT * 2);
	return (
		<>
			{/* 两道光之间的一线淡光：同步后连起来 */}
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: a * sync * (0.3 + 0.5 * br * hb)}}>
				<line x1={gx} y1={py + 30} x2={gx} y2={dy - 40} stroke={`rgba(${PEARL},0.5)`} strokeWidth={1.4} strokeDasharray="4 8" />
			</svg>
			<Glint x={gx} y={py} r={12 + 10 * br} a={a * (0.45 + 0.55 * br)} star={0.3 + 0.5 * br} />
			<div style={{position: 'absolute', left: gx - 150, top: dy - 150, width: 300, height: 300, mixBlendMode: 'screen', background: `radial-gradient(circle, rgba(120,170,255,${a * (0.25 + 0.5 * hb)}) 0%, rgba(70,120,255,${a * 0.15 * (0.4 + hb)}) 30%, rgba(0,0,0,0) 65%)`}} />
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: a}}>
				<path d={`M${gx} ${dy - w * 1.25}L${gx + w} ${dy}L${gx} ${dy + w * 1.25}L${gx - w} ${dy}Z`} fill={`rgba(150,195,255,${0.55 + 0.4 * Math.min(1, hb)})`} stroke="rgba(230,240,255,0.9)" strokeWidth={1.5} />
				<ellipse cx={gx} cy={dy} rx={40 + ripple * 9} ry={14 + ripple * 2.6} fill="none" stroke={`rgba(130,180,255,${0.55 * Math.exp(-ripple / 10)})`} strokeWidth={1.4} />
			</svg>
		</>
	);
};

/** 屏幕拍平那一下的闪光 */
export const SlapFlash: React.FC<{f: number}> = ({f}) => {
	const t = f - SCREEN_AT;
	if (t < 0 || t > 20) return null;
	return <AbsoluteFill style={{mixBlendMode: 'screen', background: `rgba(255,240,250,${0.22 * Math.exp(-t / 4)})`}} />;
};

