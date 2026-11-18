import {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {V3} from '../../three/stage';
import {Cam, project, pxOf} from './cam';
import {bf, easeInQuad, easeOutCubic, env, lerp, prog, rnd, smooth} from './common';

/**
 * 第 7–9 段在毁坏的世界里的部分：
 * 最深处的岛上站着赤日 → 一张纸在他身旁慢慢转（正面珍珠白、背面金），讲到"撕掉一面"时裂成两半，
 * 再被缝回去、中间开出口子、整张扭曲 → 骑拉帝纳从上方降下 → 52.0 起源形态显色 → 53.0 消失（全片最暗）
 * → 54.0 从暗处出手（全片最大爆发）→ 58.2 战斗结束，它沉回深处（之后见 mirror.tsx）。
 */

export const CYRUS2: V3 = [-16, -78, -30];
const SHEET_C: V3 = [-16, -71.2, -31];
const SHEET_HALF = 3.4;
export const G2: V3 = [-16, -64.5, -34];

const SHEET_IN = bf(45);
const TEAR_AT = bf(47, 2);
const MEND_AT = bf(49);
const SHEET_OUT = bf(50, 2);
const DESCEND_AT = bf(50, 2);
export const ORIGIN_AT = bf(52);
export const VANISH_AT = bf(53);
export const STRIKE_AT = bf(54);
const LEAVE_AT = bf(58, 2);

// ════════ 纸的两面（3D） ════════

const SHEET_VERT = /* glsl */ `
	uniform float uWarp; uniform float uT;
	varying vec2 vP;
	void main() {
		vec3 p = position;
		vP = p.xy;
		// 两个世界一起扭曲：整张纸起伏
		p.z += uWarp * (sin(p.x * 1.3 + uT * 0.12) * 0.35 + sin(p.y * 1.7 - uT * 0.09) * 0.3);
		gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
	}`;

const SHEET_FRAG = /* glsl */ `
	uniform float uA; uniform float uHole; uniform float uTear; uniform float uSide; uniform float uT;
	varying vec2 vP;
	float gridLine(float v, float period, float w) {
		float d = abs(fract(v / period + 0.5) - 0.5) * period;
		float aa = fwidth(v);
		return (1.0 - smoothstep(w, w + aa * 1.2, d)) * (1.0 - smoothstep(period * 0.25, period * 0.6, aa));
	}
	void main() {
		float H = ${SHEET_HALF.toFixed(2)};
		vec2 q = vP;
		float r = length(q);
		float ang = atan(q.y, q.x);
		float rings = max(gridLine(r, 0.55, 0.012), gridLine(r, 2.2, 0.02)) * (1.0 - smoothstep(H * 0.92, H, r));
		float rays = gridLine(ang * r, 0.6, 0.01) * step(1.0, r) * (1.0 - smoothstep(H * 0.85, H * 0.95, r));
		float border = 1.0 - smoothstep(0.0, fwidth(q.x) * 2.0 + 0.01, abs(max(abs(q.x), abs(q.y)) - (H - 0.15)));
		float hole = uHole * (1.0 + 0.15 * sin(ang * 5.0 + uT * 0.1));
		if (r < hole) discard;
		vec3 ink = gl_FrontFacing ? vec3(0.9, 0.88, 1.0) : vec3(1.0, 0.7, 0.32);
		vec3 base = gl_FrontFacing ? vec3(0.03, 0.03, 0.05) : vec3(0.045, 0.03, 0.03);
		vec3 col = base + ink * ((rings + rays) * 0.5 + border * 0.6);
		col += vec3(1.0, 0.72, 0.34) * exp(-max(r - hole, 0.0) / 0.25) * step(0.01, uHole) * 1.2;
		// 撕口的边：红金色
		col += vec3(1.0, 0.35, 0.18) * exp(-abs(q.x * uSide) / 0.12) * uTear * 1.4;
		gl_FragColor = vec4(col, uA);
	}`;

export const TwoSidedSheet: React.FC<{f: number}> = ({f}) => {
	const mats = useMemo(
		() =>
			[0, 1].map(
				(i) =>
					new THREE.ShaderMaterial({
						transparent: true,
						side: THREE.DoubleSide,
						uniforms: {uA: {value: 0}, uHole: {value: 0}, uTear: {value: 0}, uSide: {value: i ? 1 : -1}, uWarp: {value: 0}, uT: {value: 0}},
						vertexShader: SHEET_VERT,
						fragmentShader: SHEET_FRAG,
					}),
			),
		[],
	);
	const geos = useMemo(
		() =>
			[-1, 1].map((side) => {
				const g = new THREE.PlaneGeometry(SHEET_HALF, SHEET_HALF * 2, 24, 48);
				g.translate((side * SHEET_HALF) / 2, 0, 0);
				return g;
			}),
		[],
	);
	const a = env(f, SHEET_IN, SHEET_OUT + 14, 14, 14);
	if (a <= 0) return null;
	// 慢慢转一整圈：正面 → 侧边 → 背面 → 正面
	const spin = Math.PI * 2 * smooth(prog(f, SHEET_IN + 6, TEAR_AT - 4));
	const rock = Math.sin((f - MEND_AT) * 0.05) * 0.5 * smooth(prog(f, MEND_AT, MEND_AT + 20));
	// 撕开：两半往两边漂开、各自歪一点；第 49 小节合回去
	const tear = easeOutCubic(prog(f, TEAR_AT, TEAR_AT + 14)) * (1 - easeInQuad(prog(f, MEND_AT - 10, MEND_AT + 4)));
	const tearGlow = Math.exp(-Math.max(0, f - TEAR_AT) / 14) * (f >= TEAR_AT ? 1 : 0) + tear * 0.4;
	const hole = 1.3 * easeOutCubic(prog(f, MEND_AT + 4, MEND_AT + 26));
	const warp = smooth(prog(f, MEND_AT + 6, bf(50)));
	return (
		<group position={SHEET_C} rotation={[0, spin + rock + 0.25, 0]}>
			{[0, 1].map((i) => {
				const u = mats[i].uniforms;
				u.uA.value = a;
				u.uHole.value = hole;
				u.uTear.value = tearGlow;
				u.uWarp.value = warp;
				u.uT.value = f;
				const side = i ? 1 : -1;
				return (
					<mesh
						key={i}
						geometry={geos[i]}
						material={mats[i]}
						position={[side * tear * 1.1, -tear * 0.4 * side, 0]}
						rotation={[0, 0, side * tear * 0.12]}
					/>
				);
			})}
		</group>
	);
};

// ════════ 骑拉帝纳（起源形态） ════════

/** 显色、消失、出手的位置与可见度 */
const originState = (f: number) => {
	const down = easeOutCubic(prog(f, DESCEND_AT, ORIGIN_AT));
	const strikeK = easeOutCubic(prog(f, STRIKE_AT, STRIKE_AT + 10));
	const sink = easeInQuad(prog(f, LEAVE_AT, LEAVE_AT + 30));
	const pos: V3 = [G2[0] + 2.2 * strikeK, lerp(G2[1] + 20, G2[1], down) + 1.0 * strikeK - 9 * sink, G2[2] + 9 * strikeK];
	const vanish = 1 - smooth(prog(f, VANISH_AT, VANISH_AT + 4));
	const back = smooth(prog(f, STRIKE_AT - 1, STRIKE_AT + 2));
	const leave = 1 - smooth(prog(f, LEAVE_AT, LEAVE_AT + 30));
	const vis = smooth(prog(f, DESCEND_AT, DESCEND_AT + 10)) * (f < STRIKE_AT - 1 ? vanish : back) * leave;
	return {pos, vis};
};

export const OriginGiratina: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	if (f < DESCEND_AT || f > LEAVE_AT + 32) return null;
	const {pos, vis} = originState(f);
	if (vis <= 0.001) return null;
	const pr = project(c, pos);
	if (pr.depth <= 0) return null;
	const size = pxOf(c, pr.depth, 19);
	const rv = easeOutCubic(prog(f, ORIGIN_AT - 2, ORIGIN_AT + 14));
	const lit = smooth(prog(f, ORIGIN_AT - 4, ORIGIN_AT + 18));
	const flash = (f >= ORIGIN_AT - 1 ? Math.exp(-(f - ORIGIN_AT) / 8) : 0) + (f >= STRIKE_AT - 1 ? 1.4 * Math.exp(-(f - STRIKE_AT) / 7) : 0);
	return (
		<PokemonArt3D
			dir="pokemon/giratina"
			variant="-origin"
			x={pr.x}
			y={pr.y}
			size={size}
			yaw={Math.sin((f - ORIGIN_AT) * 0.02) * 2.5 * lit}
			pitch={-2}
			depthScale={0.5}
			ambient={[lerp(0.32, 0.48, lit), lerp(0.3, 0.45, lit), lerp(0.36, 0.5, lit)]}
			dirLights={[
				{dir: [0, 0.85, 0.5], color: [0.9 * lit, 0.62 * lit, 0.3 * lit], wrap: 0.5},
				{dir: [-0.6, -0.6, 0.4], color: [0.3 * lit, 0.24 * lit, 0.22 * lit], wrap: 0.3},
			]}
			rim={{dir: [1, -0.3], color: [0.85 * lit, 0.18 * lit, 0.12 * lit], power: 2.2}}
			hatch={{amount: 0.75, body: 1, reveal: rv, color: [1.0, 0.74, 0.4], freq: 92, time: f / 30, center: [0.5, 0.42]}}
			brightness={1 + 0.9 * flash}
			opacity={vis}
			resolution={Math.min(1.4, 2600 / Math.max(1, size * 1.12))}
		/>
	);
};

/** 起源形态的小标签 */
export const OriginTag: React.FC<{f: number}> = ({f}) => {
	const a = env(f, ORIGIN_AT + 6, VANISH_AT, 14, 6);
	if (a <= 0) return null;
	return (
		<div style={{position: 'absolute', left: 110, top: 104, opacity: a}}>
			<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 40, letterSpacing: 8, color: '#f6dca0', textShadow: '0 0 18px rgba(255,190,90,0.55), 0 2px 3px rgba(0,0,0,0.9)'}}>起源形态</div>
			<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 20, letterSpacing: 6, marginTop: 6, color: 'rgba(250,236,210,0.85)', textShadow: '0 0 10px rgba(0,0,0,0.9)'}}>ORIGIN FORME</div>
		</div>
	);
};

/** 53.0：它消失，四周的线一起熄灭，全片最暗的一拍，只剩几点暗红；54.0 一下亮回来 */
export const Blackout: React.FC<{f: number}> = ({f}) => {
	const a = smooth(prog(f, VANISH_AT, VANISH_AT + 5)) * (1 - smooth(prog(f, STRIKE_AT - 1, STRIKE_AT + 1)));
	if (a <= 0) return null;
	const dots = Array.from({length: 7}, (_, i) => ({x: 300 + rnd(i * 3.3) * 1320, y: 200 + rnd(i * 7.1) * 600, r: 3 + 4 * rnd(i * 5.5), p: rnd(i * 9.9)}));
	return (
		<AbsoluteFill style={{background: `rgba(2,1,3,${0.93 * a})`}}>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				{dots.map((d, i) => (
					<circle key={i} cx={d.x} cy={d.y} r={d.r} fill={`rgba(200,30,22,${a * (0.5 + 0.5 * Math.sin(f * 0.4 + d.p * 6))})`} />
				))}
			</svg>
		</AbsoluteFill>
	);
};

/** 54.0：从暗处出手——金线从它身上炸开（全片最大爆发） */
export const StrikeBurst: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const t = f - STRIKE_AT;
	if (t < 0 || t > 60) return null;
	const {pos} = originState(f);
	const p = project(c, pos);
	const flash = Math.exp(-t / 6);
	const ringR = 40 + 1600 * easeOutCubic(t / 30);
	const ringA = Math.exp(-t / 14);
	const rays = Array.from({length: 46}, (_, i) => {
		const a = rnd(i * 3.1) * Math.PI * 2;
		const l0 = 50 + 160 * rnd(i * 5.7);
		const l1 = l0 + (400 + 1000 * rnd(i * 7.3)) * easeOutCubic(t / 18);
		return {a, l0: l0 + (l1 - l0) * 0.45 * easeOutCubic(t / 26), l1, w: 1 + 3 * rnd(i * 9.1)};
	});
	return (
		<>
			<AbsoluteFill
				style={{
					mixBlendMode: 'screen',
					background: `radial-gradient(circle at ${p.x}px ${p.y}px, rgba(255,245,220,${0.95 * flash}) 0%, rgba(255,190,100,${0.5 * flash}) 14%, rgba(200,40,30,${0.25 * flash}) 34%, rgba(0,0,0,0) 70%)`,
				}}
			/>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
				<defs>
					<filter id="rv-strike" x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur stdDeviation="3" />
					</filter>
				</defs>
				<circle cx={p.x} cy={p.y} r={ringR} fill="none" stroke={`rgba(255,200,110,${0.8 * ringA})`} strokeWidth={10 * ringA + 2} filter="url(#rv-strike)" />
				<circle cx={p.x} cy={p.y} r={ringR * 0.96} fill="none" stroke={`rgba(220,50,40,${0.6 * ringA})`} strokeWidth={6 * ringA + 1} filter="url(#rv-strike)" />
				{rays.map((r, i) => (
					<line
						key={i}
						x1={p.x + Math.cos(r.a) * r.l0}
						y1={p.y + Math.sin(r.a) * r.l0}
						x2={p.x + Math.cos(r.a) * r.l1}
						y2={p.y + Math.sin(r.a) * r.l1}
						stroke={i % 3 ? `rgba(255,205,120,${0.85 * Math.exp(-t / 14)})` : `rgba(230,60,45,${0.7 * Math.exp(-t / 14)})`}
						strokeWidth={r.w}
						strokeLinecap="round"
					/>
				))}
			</svg>
		</>
	);
};

export const finaleOn = (f: number) => f >= bf(44);
