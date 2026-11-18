import {useMemo, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import * as THREE from 'three';
import {V3} from '../../three/stage';
import {Cam} from './cam';
import {bf, BEAT, easeInQuad, easeOutCubic, lerp, prog, rnd, smooth} from './common';
import {glassAt, portalCloseAt, relightAt, unbendAt} from './mirror';

/**
 * 第 1–3 段的 3D 世界：天冠山顶的枪之柱（断柱是珍珠白线框，画法接《空间的形状》第 7 段），
 * 天上左右两道口子（钴蓝 = 时间，珍珠粉 = 空间），两条红色锁链从祭坛拽着它们。
 * 地面是会受光的线：两道口子的光把断柱的影子投在地上；第三个影子没有任何东西投下它，
 * 而且逆着光的方向挪动（形状取自骑拉帝纳官方立绘的轮廓）。
 * 第 10 小节起地上开出一道通往背面的口子：口子里看得见倒挂的金色世界（断柱的倒影）。
 */

// ════════ 时间线与位置 ════════

export const ALTAR: V3 = [0, 0, 0];
/** 赤日站的地方，也是地上那道口子的中心 */
export const CYRUS_FOOT: V3 = [0.8, 0, 2.6];
export const PORTAL_C: V3 = CYRUS_FOOT;

/** 天上的两道口子（光源）：-1 钴蓝（时间），1 珍珠粉（空间） */
export const riftPos = (f: number, side: -1 | 1): V3 => [side * 11 + Math.sin(f * 0.013 + side) * 0.3, 17.5 + Math.sin(f * 0.017 + side * 2) * 0.25, -16];
export const RIFT_RGB = {[-1]: [0.35, 0.58, 1.0], [1]: [1.0, 0.55, 0.82]} as Record<-1 | 1, [number, number, number]>;

/** 第三个影子：从断柱影子堆里冒出来，逆着光往祭坛挪 */
export const RISE_AT = bf(8);
export const LUNGE_AT = bf(10, 2);
export const shadowPos = (f: number): V3 => {
	const k = smooth(prog(f, bf(0, 2), bf(7, 2)));
	return [lerp(5.4, 3.4, k), 0, lerp(-0.6, -3.4, k)];
};
/** 地上那片影子的浓淡：一开始只是一团，第 1 小节第 3 拍（"第三个影子"）起成形；第 8 小节立起来时消失 */
export const floorShadowA = (f: number) => smooth(prog(f, 2, bf(1, 2) + 6)) * (1 - smooth(prog(f, RISE_AT - 2, RISE_AT + 8)));

/** 地上的口子：影子扑上赤日后张开；第 58.2–60 小节（战斗结束）合上 */
export const OPEN_AT = LUNGE_AT + 9;
export const portalR = (f: number) => {
	const open = easeOutCubic(prog(f, OPEN_AT, OPEN_AT + 16)) * 3.2 + 0.6 * smooth(prog(f, bf(14, 2), bf(16)));
	return open * (1 - portalCloseAt(f));
};
/** 石柱以口子为中心扭弯（第 11 小节起，像被拉进水里）；第 56.2 小节扭曲停下，直回来 */
export const bendAt = (f: number) => easeOutCubic(prog(f, OPEN_AT + 6, bf(13, 2))) * 0.85 * (1 - unbendAt(f));

/** 锁链：赤日被拖走后松开、落下、散去 */
const chainA = (f: number) => 1 - smooth(prog(f, LUNGE_AT + 14, bf(12, 2)));
const slackAt = (f: number) => easeInQuad(prog(f, LUNGE_AT + 10, bf(12)));
/** 两道口子：骑拉帝纳出来后渐渐暗下去（时间与空间之神的戏份交给下一段） */
export const riftA = (f: number) => (1 - 0.55 * smooth(prog(f, bf(12), bf(16)))) * (1 - worldDim(f));
/** 第 22 小节起，正面的世界（地面、断柱、天上的口子、远山）暗下去，换成一张纸（paper.tsx） */
export const worldDim = (f: number) => smooth(prog(f, bf(22), bf(22, 2)));

// ════════ 立绘轮廓贴图（地上影子的形状） ════════

const texCache = new Map<string, THREE.Texture>();
/** 在 ThreeCanvas 外面（Master 顶层）调用：贴图加载完之前整个画面不渲染，免得第一帧截到没有贴图的地面 */
export const useArtTexture = (file: string) => {
	const [tex, setTex] = useState<THREE.Texture | null>(() => texCache.get(file) ?? null);
	const [handle] = useState(() => (texCache.has(file) ? null : delayRender(`texture ${file}`)));
	useMemo(() => {
		if (texCache.has(file)) return;
		new THREE.TextureLoader().load(staticFile(file), (t) => {
			t.colorSpace = THREE.NoColorSpace;
			t.generateMipmaps = true;
			t.minFilter = THREE.LinearMipmapLinearFilter;
			texCache.set(file, t);
			setTex(t);
			if (handle !== null) continueRender(handle);
		});
	}, [file, handle]);
	return tex;
};

// ════════ 断柱 ════════

export const PILLARS = Array.from({length: 9}, (_, i) => {
	const a = (i / 9) * Math.PI * 2 + 0.35;
	const x = ALTAR[0] + Math.cos(a) * 12.5;
	const z = ALTAR[2] + Math.sin(a) * 12.5;
	const back = (ALTAR[2] - z) / 12.5;
	const h = back > 0.2 ? 10 + 5 * rnd(i * 3.3) : 2.5 + 3 * rnd(i * 5.1);
	return {x, z, h, r: 0.85 + 0.15 * rnd(i * 7.7)};
});

const pillarGeo = () => {
	const pos: number[] = [];
	const hh: number[] = [];
	const seg = (a: V3, b: V3, ha: number, hb: number) => {
		pos.push(...a, ...b);
		hh.push(ha, hb);
	};
	for (const [pi, P] of PILLARS.entries()) {
		const F = 16;
		const tops: number[] = [];
		for (let k = 0; k < F; k++) {
			const top = P.h - (P.h > 8 ? 1.4 : 0.9) * rnd(pi * 31 + k * 1.7) * (0.6 + 0.4 * Math.sin(k * 1.3 + pi));
			tops.push(top);
			const a = (k / F) * Math.PI * 2;
			const x = P.x + Math.cos(a) * P.r;
			const z = P.z + Math.sin(a) * P.r;
			seg([x, 0.9, z], [x, top, z], 0.9 / P.h, top / P.h);
		}
		for (let y = 0.9; y < P.h - 1; y += 1.6) {
			for (let k = 0; k < 32; k++) {
				const a0 = (k / 32) * Math.PI * 2;
				const a1 = ((k + 1) / 32) * Math.PI * 2;
				if (y > Math.min(tops[Math.floor((k / 32) * F)], tops[Math.floor(((k + 1) / 32) * F) % F])) continue;
				seg([P.x + Math.cos(a0) * P.r, y, P.z + Math.sin(a0) * P.r], [P.x + Math.cos(a1) * P.r, y, P.z + Math.sin(a1) * P.r], y / P.h, y / P.h);
			}
		}
		const b = P.r * 1.35;
		const c: V3[] = [
			[P.x - b, 0, P.z - b],
			[P.x + b, 0, P.z - b],
			[P.x + b, 0, P.z + b],
			[P.x - b, 0, P.z + b],
		];
		for (let k = 0; k < 4; k++) {
			const p = c[k];
			const q = c[(k + 1) % 4];
			seg(p, q, 0, 0);
			seg([p[0], 0.9, p[2]], [q[0], 0.9, q[2]], 0.9 / P.h, 0.9 / P.h);
			seg(p, [p[0], 0.9, p[2]], 0, 0.9 / P.h);
		}
	}
	// 祭坛
	for (const y of [0.4, 0.8]) {
		for (let k = 0; k < 64; k++) {
			const a0 = (k / 64) * Math.PI * 2;
			const a1 = ((k + 1) / 64) * Math.PI * 2;
			seg([Math.cos(a0) * 2.2, y, Math.sin(a0) * 2.2], [Math.cos(a1) * 2.2, y, Math.sin(a1) * 2.2], 0.05, 0.05);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1));
	return g;
};

const PILLAR_VERT = /* glsl */ `
	attribute float aH;
	uniform float uBend; uniform vec2 uC; uniform float uT; uniform float uFlip;
	varying float vH; varying float vD; varying vec3 vW;
	void main() {
		vec3 p = position;
		// 以口子为中心扭弯：越高弯得越多，朝口子倒，带一点水波似的摆动
		if (aH > 0.0) {
			vec2 d = uC - p.xz;
			vec2 dir = normalize(d + 1e-3);
			float sway = sin(uT * 0.08 + length(d) * 0.5 + aH * 3.0) * 0.25;
			p.xz += dir * uBend * aH * aH * (2.6 + sway);
			p.y -= uBend * aH * aH * 0.9;
		}
		p.y = p.y * uFlip - (1.0 - uFlip) * 0.04;
		vH = aH; vW = p;
		vec4 mv = modelViewMatrix * vec4(p, 1.0);
		vD = -mv.z;
		gl_Position = projectionMatrix * mv;
	}`;

export const SpearPillar: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(pillarGeo, []);
	const mats = useMemo(() => {
		const lines = new THREE.ShaderMaterial({
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			uniforms: {
				uA: {value: 1},
				uBend: {value: 0},
				uC: {value: new THREE.Vector2(PORTAL_C[0], PORTAL_C[2])},
				uT: {value: 0},
				uFlip: {value: 1},
				uGold: {value: 0},
				uPortal: {value: new THREE.Vector3(PORTAL_C[0], PORTAL_C[2], 0)},
			},
			vertexShader: PILLAR_VERT,
			fragmentShader: /* glsl */ `
				uniform float uA; uniform float uGold; uniform vec3 uPortal;
				varying float vH; varying float vD; varying vec3 vW;
				void main() {
					float fog = exp(-max(vD - 14.0, 0.0) * 0.03);
					vec3 c = mix(vec3(0.62, 0.68, 0.95), vec3(0.97, 0.93, 1.0), clamp(vH, 0.0, 1.0));
					// 口子张开后，从下面映上来的金光（离口子越近越亮）
					float near = exp(-length(vW.xz - uPortal.xy) / 7.0) * uPortal.z;
					c = mix(c, vec3(1.0, 0.72, 0.32), clamp(near * (1.0 - vH * 0.6), 0.0, 0.85));
					gl_FragColor = vec4(c * uA * (0.35 + 0.65 * fog), 1.0);
				}`,
		});
		const gold = lines.clone();
		gold.fragmentShader = /* glsl */ `
			uniform float uA; varying float vH; varying float vD; varying vec3 vW;
			void main() {
				vec3 c = mix(vec3(0.75, 0.42, 0.14), vec3(1.0, 0.82, 0.45), clamp(vH, 0.0, 1.0));
				gl_FragColor = vec4(c * uA * (0.5 + 0.5 * exp(-max(vD - 10.0, 0.0) * 0.03)), 1.0);
			}`;
		return {lines, gold, occ: new THREE.MeshBasicMaterial({color: '#06050c'})};
	}, []);
	const bend = bendAt(f);
	const u = mats.lines.uniforms;
	u.uBend.value = bend;
	u.uT.value = f;
	u.uPortal.value.z = smooth(prog(f, OPEN_AT, OPEN_AT + 20)) * 0.9 * (1 - portalCloseAt(f));
	// 第 60.2 小节起，镜头升回地面高度，正面的断柱重新亮起来
	u.uA.value = 1 - worldDim(f) * (1 - relightAt(f));
	const g = mats.gold.uniforms;
	g.uBend.value = bend;
	g.uT.value = f;
	g.uFlip.value = -1;
	// 倒影只在口子里看得见（地面是不透明的）；第 22–30 小节俯看那张纸时收起，钻进背面后再出现
	g.uA.value = smooth(prog(f, OPEN_AT, OPEN_AT + 30)) * Math.max(1 - worldDim(f), smooth(prog(f, bf(30, 2), bf(31))));
	return (
		<>
			{bend < 0.04
				? PILLARS.map((P, i) => (
						<mesh key={i} material={mats.occ} position={[P.x, P.h / 2, P.z]}>
							<cylinderGeometry args={[P.r * 0.97, P.r * 0.97, P.h - 1, 20]} />
						</mesh>
					))
				: null}
			{u.uA.value > 0 ? <lineSegments geometry={geo} material={mats.lines} frustumCulled={false} /> : null}
			{g.uA.value > 0 ? <lineSegments geometry={geo} material={mats.gold} frustumCulled={false} /> : null}
		</>
	);
};

// ════════ 地面：会受光的线 ════════

const FLOOR_FRAG = /* glsl */ `
	uniform vec3 uL[2]; uniform vec3 uLC[2];
	uniform vec4 uP[9];
	uniform sampler2D uArt;
	uniform vec3 uS; uniform vec2 uSD; uniform float uSA;
	uniform vec3 uPortal; uniform float uT; uniform float uDim; uniform float uGlass;
	varying vec3 vW;
	float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	float n2(vec2 x) { vec2 i = floor(x); vec2 f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
	float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
	// 细线：v 为坐标，period 为间距，w 为线宽（世界单位）；太密时自动淡掉
	float gridLine(float v, float period, float w) {
		float d = abs(fract(v / period + 0.5) - 0.5) * period;
		float aa = fwidth(v);
		float fade = 1.0 - smoothstep(period * 0.25, period * 0.6, aa);
		return (1.0 - smoothstep(w, w + aa * 1.2, d)) * fade;
	}
	// 断柱挡住光源的程度
	float pillarShadow(vec3 P, vec3 L) {
		vec2 D = L.xz - P.xz;
		float Dl = length(D);
		vec2 dir = D / Dl;
		float s = 0.0;
		for (int j = 0; j < 9; j++) {
			vec4 q = uP[j];
			float t = clamp(dot(q.xy - P.xz, dir), 0.0, Dl);
			float dist = length(P.xz + dir * t - q.xy);
			float hgt = L.y * t / Dl;
			float sh = (1.0 - smoothstep(q.z * 0.85, q.z * 1.1, dist)) * (1.0 - smoothstep(q.w - 0.6, q.w + 0.6, hgt));
			s = max(s, sh);
		}
		return s;
	}
	void main() {
		vec3 P = vW;
		vec2 rel = P.xz;
		float r = length(rel);
		float ang = atan(rel.y, rel.x);

		// 光：两道口子各自照过来，被断柱挡住的地方是影子
		vec3 lit = vec3(0.0);
		for (int i = 0; i < 2; i++) {
			vec3 L = uL[i];
			float d = length(L - P);
			float k = 1.0 / (1.0 + d * d / 900.0);
			lit += uLC[i] * k * (1.0 - pillarShadow(P, L));
		}
		// 第三个影子：没有东西投下它（形状取自立绘轮廓，头朝镜头那边）
		vec2 su = vec2((P.x - uS.x) / uSD.x + 0.5, 1.0 - (P.z - uS.z) / uSD.y);
		float g = 0.0;
		if (su.x > 0.0 && su.x < 1.0 && su.y > 0.0 && su.y < 1.0) {
			vec2 wob = vec2(fbm(su * 5.0 + uT * 0.02), fbm(su * 5.0 + 3.7 - uT * 0.018)) - 0.5;
			g = smoothstep(0.25, 0.6, texture2D(uArt, su + wob * 0.03, 1.5).a);
			g *= smoothstep(0.0, 0.05, su.y) * smoothstep(1.0, 0.95, su.y);
		}
		g *= uSA;
		lit *= 1.0 - 0.94 * g;
		// 影子边缘一圈极淡的暗红（只有仔细看才看得出它不是普通的影子）
		float gEdge = g * (1.0 - g) * 4.0;

		float plaza = 1.0 - smoothstep(15.8, 16.4, r);
		// 地纹：同心圆 + 放射线（暗处也隐约可见），刻线（只在受光处，像刮画）
		float rings = max(gridLine(r, 1.5, 0.035), gridLine(r, 6.0, 0.05)) * plaza;
		float rays = gridLine(ang * r, 1.6, 0.03) * plaza * step(3.0, r) * (1.0 - smoothstep(14.0, 15.5, r));
		float hatch = gridLine(P.x * 0.82 + P.z * 0.57, 0.34, 0.035) * plaza;
		float outer = gridLine(P.z + fbm(P.xz * 0.08) * 6.0, 2.2, 0.05) * (1.0 - plaza) * exp(-max(r - 16.0, 0.0) * 0.05);
		float L = dot(lit, vec3(0.333));
		vec3 col = vec3(0.012, 0.011, 0.02);
		col += (rings + rays) * (vec3(0.09, 0.085, 0.14) * (1.0 - g * 0.85) + lit * 0.42);
		col += hatch * lit * 0.4;
		col += outer * (vec3(0.035, 0.035, 0.06) + lit * 0.16);
		col += vec3(0.5, 0.08, 0.06) * gEdge * 0.18;

		// 地上的口子：里面是空的（看得见下面倒挂的世界），边缘一圈金色的裂口
		if (uPortal.z > 0.001) {
			vec2 pd = P.xz - uPortal.xy;
			float pr = length(pd);
			float edgeN = (fbm(vec2(atan(pd.y, pd.x) * 3.0, uT * 0.03)) - 0.5) * 0.9;
			float R = uPortal.z * (1.0 + edgeN * 0.35);
			if (pr < R - 0.02) discard;
			float rim = exp(-(pr - R) / 0.12) * 1.6 + exp(-(pr - R) / 1.4) * 0.5;
			col += vec3(1.0, 0.7, 0.3) * rim * min(1.0, uPortal.z * 2.0);
			// 口子附近的地纹被映成金色
			col += (rings + rays + hatch * 0.6) * vec3(1.0, 0.68, 0.3) * exp(-(pr - R) / 4.0) * 0.8 * min(1.0, uPortal.z);
		}
		col *= 1.0 - 0.94 * uDim;
		// 地面的背面（从下面往上看）：世界的背面，同一张地纹刻成金线
		if (!gl_FrontFacing) {
			col = vec3(0.03, 0.022, 0.035) + (rings + rays) * vec3(1.0, 0.7, 0.32) * 0.5 + hatch * vec3(1.0, 0.72, 0.36) * 0.08;
			col += outer * vec3(0.5, 0.34, 0.16) * 0.25;
			if (uPortal.z > 0.001) {
				float pr = length(P.xz - uPortal.xy);
				col += vec3(1.0, 0.72, 0.34) * exp(-max(pr - uPortal.z, 0.0) / 0.5) * 0.9;
			}
			// 远处融进毁坏的世界的天色，不留一道地平线
			col = mix(col, vec3(0.07, 0.054, 0.084), smoothstep(30.0, 160.0, r));
		}
		// 镜面（第 60.2–67.2 小节）：只留下地纹的线，其余透明
		float lineM = clamp(rings + rays + hatch * 0.5 + outer, 0.0, 1.0);
		float alpha = mix(1.0, lineM * 0.85, uGlass);
		if (alpha < 0.02) discard;
		gl_FragColor = vec4(col, alpha);
	}`;

export const Floor: React.FC<{f: number; art: THREE.Texture}> = ({f, art}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {
					uL: {value: [new THREE.Vector3(), new THREE.Vector3()]},
					uLC: {value: [new THREE.Vector3(), new THREE.Vector3()]},
					uP: {value: PILLARS.map((p) => new THREE.Vector4(p.x, p.z, p.r, p.h))},
					uArt: {value: null},
					uS: {value: new THREE.Vector3()},
					uSD: {value: new THREE.Vector2(8.5, 10)},
					uSA: {value: 0},
					uPortal: {value: new THREE.Vector3(PORTAL_C[0], PORTAL_C[2], 0)},
					uT: {value: 0},
					uDim: {value: 0},
					uGlass: {value: 0},
				},
				side: THREE.DoubleSide,
				vertexShader: /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
				fragmentShader: FLOOR_FRAG,
			}),
		[],
	);
	const u = mat.uniforms;
	const ra = riftA(f);
	([-1, 1] as const).forEach((side, i) => {
		u.uL.value[i].set(...riftPos(f, side));
		const c = RIFT_RGB[side];
		u.uLC.value[i].set(c[0] * 1.15 * ra, c[1] * 1.15 * ra, c[2] * 1.15 * ra);
	});
	u.uArt.value = art;
	u.uS.value.set(...shadowPos(f));
	u.uSA.value = floorShadowA(f);
	u.uPortal.value.z = portalR(f);
	u.uT.value = f;
	u.uDim.value = worldDim(f) * (1 - 0.6 * relightAt(f));
	const glass = glassAt(f);
	u.uGlass.value = glass;
	// 变成镜面时才走半透明（平时不透明，先写深度）
	mat.transparent = glass > 0.001;
	return (
		<mesh material={mat} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-5}>
			<planeGeometry args={[3000, 3000]} />
		</mesh>
	);
};

// ════════ 口子下面：倒挂的金色世界（断柱的倒影 + 几块浮着的岩块） ════════

const ISLANDS = Array.from({length: 7}, (_, i) => ({
	p: [PORTAL_C[0] + (rnd(i * 3.1) - 0.5) * 30, -6 - rnd(i * 5.3) * 14, PORTAL_C[2] + (rnd(i * 7.9) - 0.5) * 30] as V3,
	s: 1.2 + 2.2 * rnd(i * 2.2),
	r: rnd(i * 4.4) * Math.PI,
}));

export const UnderWorld: React.FC<{f: number}> = ({f}) => {
	const mat = useMemo(() => new THREE.LineBasicMaterial({color: new THREE.Color(1.0, 0.72, 0.32), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false}), []);
	const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 0)), []);
	const a = smooth(prog(f, OPEN_AT, OPEN_AT + 30)) * (1 - worldDim(f));
	if (a <= 0) return null;
	mat.opacity = 0.7 * a;
	return (
		<>
			{ISLANDS.map((it, i) => (
				<lineSegments key={i} geometry={geo} material={mat} position={[it.p[0], it.p[1] + Math.sin(f * 0.02 + i) * 0.4, it.p[2]]} rotation={[it.r, f * 0.004 * (i % 2 ? 1 : -1), 0]} scale={[it.s * 1.4, it.s * 0.7, it.s]} />
			))}
		</>
	);
};

// ════════ 天上的两道口子 ════════

const RIFT_H = 7.5;

export const Rifts: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				side: THREE.DoubleSide,
				uniforms: {uOpen: {value: 1}, uT: {value: 0}, uCore: {value: new THREE.Vector3()}, uEdge: {value: new THREE.Vector3()}, uSeed: {value: 0}, uHot: {value: 0}},
				vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `
					uniform float uOpen; uniform float uT; uniform vec3 uCore; uniform vec3 uEdge; uniform float uSeed; uniform float uHot;
					varying vec2 vP;
					float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
					float n2(vec2 x) { vec2 i = floor(x); vec2 f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
					float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
					void main() {
						float H = ${RIFT_H.toFixed(2)};
						float y = vP.y / H;
						if (abs(y) > 1.25) discard;
						float tilt = vP.x - vP.y * 0.22;
						float w = uOpen * 2.6 * pow(max(1.0 - y * y, 0.0), 0.6);
						w += (fbm(vec2(vP.y * 2.2, uT * 0.02)) - 0.5) * 1.1 * uOpen + (n2(vec2(vP.y * 9.0, 3.0)) - 0.5) * 0.35 * uOpen;
						float d = abs(tilt) - w;
						vec2 q = vec2(tilt, vP.y) * 0.6;
						float sw = fbm(q * 1.6 + vec2(uT * 0.015, -uT * 0.02) + fbm(q * 2.4 - uT * 0.01) * 1.5);
						float star = step(0.985, h2(floor(vP * 9.0))) * 0.8;
						vec3 inside = uCore * (0.35 + 1.1 * sw) + vec3(1.0) * pow(max(1.0 - abs(tilt) / max(w, 1e-3), 0.0), 3.0) * 0.6 + star;
						float rim = exp(-abs(d) / 0.07) * 2.2 + exp(-max(d, 0.0) / 0.9) * 0.35 + exp(-max(d, 0.0) / 3.0) * 0.12;
						vec3 col = (d < 0.0 ? inside : vec3(0.0)) + uEdge * rim * smoothstep(1.25, 0.95, abs(y));
						col *= 1.0 + uHot * 1.5;
						gl_FragColor = vec4(col * min(1.0, uOpen * 4.0), 1.0);
					}`,
			}),
		[],
	);
	const mats = useMemo(() => [mat.clone(), mat.clone()], [mat]);
	const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...c.pos), new THREE.Vector3(...riftPos(f, 1)), new THREE.Vector3(0, 1, 0));
	const q = new THREE.Quaternion().setFromRotationMatrix(m);
	// 锁链收紧的抖动（一拍一抖），赤日被拖走后停下
	const pulse = 0.25 * Math.pow(Math.max(0, Math.sin((f / BEAT) * Math.PI)), 6) * chainA(f);
	return (
		<>
			{([-1, 1] as const).map((side, i) => {
				const u = mats[i].uniforms;
				u.uOpen.value = (1 + 0.1 * Math.sin(f * 0.05 + side)) * riftA(f);
				u.uT.value = f;
				u.uSeed.value = side * 3.1;
				u.uHot.value = pulse;
				u.uCore.value.set(...(side === -1 ? [0.25, 0.45, 1.0] : [1.0, 0.45, 0.75]));
				u.uEdge.value.set(...(side === -1 ? [0.55, 0.8, 1.0] : [1.0, 0.75, 0.92]));
				return (
					<mesh key={side} material={mats[i]} position={riftPos(f, side)} quaternion={q} scale={[side, 1, 1]}>
						<planeGeometry args={[22, RIFT_H * 2.6]} />
					</mesh>
				);
			})}
		</>
	);
};

// ════════ 红色锁链 ════════

const LINK_PITCH = 0.62;
const MAX_LINKS = 110;
type Curve = (s: number) => V3;

/** 祭坛 → 口子：绷直、一拍一抖；赤日被拖走后松开垂落 */
export const chainCurve = (f: number, side: -1 | 1): Curve => {
	const P0: V3 = [ALTAR[0], 1.2, ALTAR[2]];
	const P1 = riftPos(f, side);
	const slack = slackAt(f);
	const shake = (0.1 + 0.18 * Math.pow(Math.max(0, Math.sin((f / BEAT) * Math.PI)), 4)) * (1 - slack);
	return (s) => {
		const w = 4 * s * (1 - s);
		const wav = Math.sin(s * 18 - f * 0.9 + side) * w * shake;
		// 松开后：口子那头往下掉，整条垂下来
		const tip: V3 = [lerp(P1[0], P1[0] * 0.55, slack), lerp(P1[1], -2, slack), lerp(P1[2], P1[2] * 0.5, slack)];
		const sag = 0.25 + 9 * slack;
		return [lerp(P0[0], tip[0], s) + wav * 0.4, lerp(P0[1], tip[1], s) - w * sag + wav, lerp(P0[2], tip[2], s)];
	};
};

const linksAlong = (curve: Curve) => {
	const N = 160;
	const pts: V3[] = [];
	const acc: number[] = [0];
	for (let i = 0; i <= N; i++) pts.push(curve(i / N));
	for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
	const out: {p: V3; t: V3}[] = [];
	let j = 1;
	for (let d = LINK_PITCH * 0.5; d < acc[N] && out.length < MAX_LINKS; d += LINK_PITCH) {
		while (j < N && acc[j] < d) j++;
		const u = (d - acc[j - 1]) / Math.max(acc[j] - acc[j - 1], 1e-6);
		const a = pts[j - 1];
		const b = pts[j];
		const t: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const l = Math.hypot(...t) || 1;
		out.push({p: [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)], t: [t[0] / l, t[1] / l, t[2] / l]});
	}
	return out;
};

export const chainGlow = (f: number) => (0.75 + 0.5 * Math.pow(Math.max(0, Math.sin((f / BEAT) * Math.PI)), 4)) * chainA(f);

export const Chains: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(() => {
		const g = new THREE.TorusGeometry(0.27, 0.075, 8, 22);
		g.scale(1.38, 1, 1);
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {uGlow: {value: 1}, uA: {value: 1}},
				transparent: true,
				vertexShader: /* glsl */ `
					varying vec3 vN; varying vec3 vV;
					void main() {
						vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
						vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
						vV = normalize(-mv.xyz);
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uGlow; uniform float uA;
					varying vec3 vN; varying vec3 vV;
					void main() {
						float mu = abs(dot(normalize(vN), vV));
						float fres = pow(1.0 - mu, 2.0);
						vec3 L = normalize(vec3(-0.4, 0.8, 0.5));
						float spec = pow(max(dot(reflect(-L, normalize(vN)), vV), 0.0), 30.0);
						vec3 c = vec3(0.32, 0.02, 0.03) + vec3(1.0, 0.12, 0.08) * (0.35 + fres) * uGlow + vec3(1.0, 0.75, 0.7) * spec * 0.7;
						gl_FragColor = vec4(c, uA);
					}`,
			}),
		[],
	);
	const meshes = useMemo(() => [0, 1].map(() => new THREE.InstancedMesh(geo, mat, MAX_LINKS)), [geo, mat]);
	const a = chainA(f);
	if (a <= 0) return null;
	mat.uniforms.uGlow.value = chainGlow(f) / Math.max(a, 1e-3);
	mat.uniforms.uA.value = a;
	const m4 = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const qr = new THREE.Quaternion();
	const X = new THREE.Vector3(1, 0, 0);
	([-1, 1] as const).forEach((side, ci) => {
		const links = linksAlong(chainCurve(f, side));
		const mesh = meshes[ci];
		links.forEach((l, i) => {
			q.setFromUnitVectors(X, new THREE.Vector3(...l.t));
			qr.setFromAxisAngle(X, (i % 2) * (Math.PI / 2) + 0.3);
			q.multiply(qr);
			m4.compose(new THREE.Vector3(...l.p), q, new THREE.Vector3(1, 1, 1));
			mesh.setMatrixAt(i, m4);
		});
		mesh.count = links.length;
		mesh.instanceMatrix.needsUpdate = true;
	});
	return (
		<>
			{meshes.map((m, i) => (
				<primitive key={i} object={m} frustumCulled={false} />
			))}
		</>
	);
};

// ════════ 雪、远山 ════════

const SNOW_N = 2600;
export const Snow: React.FC<{f: number}> = ({f}) => {
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const p = new Float32Array(SNOW_N * 3);
		const s = new Float32Array(SNOW_N);
		for (let i = 0; i < SNOW_N; i++) {
			p.set([rnd(i * 1.1) * 90, rnd(i * 2.3) * 45, rnd(i * 3.7) * 90], i * 3);
			s[i] = rnd(i * 4.9);
		}
		g.setAttribute('position', new THREE.BufferAttribute(p, 3));
		g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				uniforms: {uX: {value: 0}, uY: {value: 0}, uA: {value: 1}, uO: {value: new THREE.Vector3(-45, -3, -55)}, uGold: {value: 0}},
				vertexShader: /* glsl */ `
					attribute float aS;
					uniform float uX; uniform float uY; uniform vec3 uO;
					varying float vB;
					void main() {
						vec3 p = position;
						p.x = mod(p.x + uX * (0.6 + 0.8 * aS), 90.0);
						p.y = mod(p.y - uY * (0.5 + aS), 45.0);
						p.z += sin(uX * 0.05 + aS * 20.0) * 0.6;
						vec4 mv = viewMatrix * vec4(uO + p, 1.0);
						vB = (0.35 + 0.65 * aS) * smoothstep(1.0, 5.0, -mv.z);
						gl_PointSize = clamp((1.2 + 2.2 * aS) * 34.0 / -mv.z, 1.0, 6.0);
						gl_Position = projectionMatrix * mv;
					}`,
				fragmentShader: /* glsl */ `
					uniform float uA; uniform float uGold; varying float vB;
					void main() {
						float d = length(gl_PointCoord - 0.5);
						vec3 c = mix(vec3(0.86, 0.9, 1.0), vec3(1.0, 0.78, 0.45), uGold);
						gl_FragColor = vec4(c * smoothstep(0.5, 0.05, d) * vB * uA * 0.8, 1.0);
					}`,
			}),
		[],
	);
	mat.uniforms.uX.value = f * 0.32;
	mat.uniforms.uY.value = f * 0.045;
	mat.uniforms.uGold.value = 0.35 * smooth(prog(f, OPEN_AT, OPEN_AT + 40));
	// 俯看时收掉，免得糊在纸面上
	mat.uniforms.uA.value = 1 - smooth(prog(f, bf(20, 2), bf(21, 3)));
	return <points geometry={geo} material={mat} frustumCulled={false} />;
};

export const Mountains: React.FC<{f: number}> = ({f}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				uniforms: {uA: {value: 1}},
				vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `
					uniform float uA; varying vec2 vP;
					float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
					float n1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
					float ridge(float x) {
						float v = 0.0; float a = 0.5; float fr = 0.012;
						for (int i = 0; i < 6; i++) { v += a * (1.0 - abs(n1(x * fr) * 2.0 - 1.0)); fr *= 2.1; a *= 0.5; }
						return v;
					}
					void main() {
						float far = ridge(vP.x + 300.0) * 34.0 + 10.0;
						float near = ridge(vP.x * 1.3 + 77.0) * 26.0 - 2.0;
						vec4 col = vec4(0.0);
						if (vP.y < far) { float e = exp(-(far - vP.y) / 2.5); col = vec4(vec3(0.03, 0.03, 0.055) + vec3(0.4, 0.45, 0.7) * e * 0.12, 1.0); }
						if (vP.y < near) { float e = exp(-(near - vP.y) / 2.0); col = vec4(vec3(0.014, 0.013, 0.024) + vec3(0.6, 0.62, 0.85) * e * 0.14, 1.0); }
						gl_FragColor = vec4(col.rgb, col.a * uA);
					}`,
			}),
		[],
	);
	mat.uniforms.uA.value = 1 - worldDim(f) * (1 - relightAt(f));
	if (mat.uniforms.uA.value <= 0) return null;
	return (
		<mesh material={mat} position={[0, -6, -280]}>
			<planeGeometry args={[1400, 140, 1, 1]} />
		</mesh>
	);
};

