import {INK_LIB} from './ink';
import {CAVE_LIB} from './inkCave';

/**
 * 两种命运（第 3 期第 7 段）：左边是淡彩的丛林（梦幻），右边是浓墨的洞窟（超梦），中间一道流动的墨缝。
 * uSeam：墨缝在主体层上的 x（从画面外扫进来 = 丛林从墨里显出来）；uMeet：两边的墨在中间交汇、卷成 S 形的程度；
 * uCaveDark：洞窟一侧额外压暗；uSun：丛林里的阳光强度。坐标都在主体层（k = 1）上。
 */
export const INK_DUO_FRAG = `${INK_LIB}
${CAVE_LIB}
uniform float uSeam;
uniform float uMeet;
uniform float uCaveDark;
uniform float uSun;

const vec3 LEAF = vec3(0.47, 0.6, 0.44);   // 花青调绿的淡彩
const vec3 TRUNK = vec3(0.3, 0.26, 0.21);

// 一层树干：返回墨浓度，occ 为是否在树干内
float trunks(vec2 L, float cell, float seed, out float occ) {
	float id = floor(L.x / cell);
	float d = 1e4;
	float wid = 1.0;
	for (int i = -1; i <= 1; i++) {
		float cid = id + float(i);
		if (hash(vec2(cid, seed + 1.3)) < 0.35) continue;
		float r1 = hash(vec2(cid, seed));
		float cx = (cid + 0.25 + 0.5 * r1) * cell;
		// 树干微微弯曲，越往上越细
		cx += sin(L.y * 0.004 + cid * 1.7) * cell * 0.08 + (L.y - 540.0) * (r1 - 0.5) * 0.12;
		float w = cell * (0.05 + 0.08 * hash(vec2(cid, seed + 4.4))) * (0.75 + 0.25 * smoothstep(0.0, 1080.0, L.y));
		float dd = abs(L.x - cx) - w;
		if (dd < d) { d = dd; wid = w; }
	}
	occ = smoothstep(1.5, -1.5, d);
	// 两侧勾勒、中间淡，带横向的树皮皴
	float edge = occ * exp(-max(-d, 0.0) / 3.5);
	float bark = smoothstep(0.5, 0.8, fbm4(vec2(L.x * 0.03, L.y * 0.12) + seed));
	return clamp(occ * (0.35 + 0.3 * bark) + edge * 0.7, 0.0, 1.0);
}

// 一层树冠：大团的淡墨与淡彩，边缘是点叶
float canopy(vec2 L, float base, float seed) {
	float n = fbm4(L * 0.0035 + seed);
	float hang = base + 160.0 * fbm4(vec2(L.x * 0.004, seed * 2.0));
	float m = smoothstep(hang + 40.0, hang - 80.0, L.y + (n - 0.5) * 260.0);
	// 点叶：一簇簇不规则的叶团（旋转过的噪声，避免排成方格）
	vec2 lq = rot(0.7 + seed) * L * 0.035;
	float dots = smoothstep(0.6, 0.72, fbm4(lq + seed) + 0.25 * noise(lq * 3.1)) * smoothstep(hang + 140.0, hang - 40.0, L.y);
	return clamp(m * (0.45 + 0.4 * n) + dots * 0.5, 0.0, 1.0);
}

// 垂下的藤蔓：细而弯的墨线
float vines(vec2 L, float seed) {
	float cell = 150.0;
	float id = floor(L.x / cell);
	float v = 0.0;
	for (int i = -1; i <= 1; i++) {
		float cid = id + float(i);
		float r1 = hash(vec2(cid, seed));
		if (r1 < 0.45) continue;
		float vx = (cid + hash(vec2(cid, seed + 2.0))) * cell + sin(L.y * 0.012 + cid) * 22.0;
		float len = 260.0 + 520.0 * hash(vec2(cid, seed + 5.0));
		v = max(v, smoothstep(2.2, 0.6, abs(L.x - vx)) * smoothstep(len, len - 80.0, L.y));
	}
	return v;
}

vec3 jungle(vec2 p, out float inkAmt) {
	vec3 col = paper(toLayer(p, 0.5) / 1080.0) * 1.03;
	inkAmt = 0.0;
	float ks[3] = float[3](0.35, 0.6, 0.9);
	float cells[3] = float[3](170.0, 260.0, 420.0);
	vec3 tk[3] = vec3[3](vec3(0.62, 0.62, 0.55), vec3(0.45, 0.44, 0.38), TRUNK);
	float ts[3] = float[3](0.45, 0.65, 0.88);
	float bases[3] = float[3](330.0, 260.0, 170.0);
	for (int i = 0; i < 3; i++) {
		vec2 L = toLayer(p, ks[i]);
		float fi = float(i);
		// 远处的层被林间的雾气盖住一部分
		float occ;
		float t = trunks(L, cells[i], fi * 7.1 + 3.0, occ);
		col = mix(col, vec3(0.9, 0.86, 0.74), occ * 0.4);
		col = mix(col, tk[i], t * ts[i]);
		float c = canopy(L, bases[i], fi * 4.3 + 1.0);
		vec3 leafC = mix(LEAF * (1.05 - fi * 0.12), vec3(0.2, 0.24, 0.18), 0.25 + fi * 0.2);
		col = mix(col, leafC, c * (0.45 + fi * 0.18));
		float v = vines(L, fi * 3.3 + 9.0);
		col = mix(col, vec3(0.22, 0.25, 0.19), v * (0.35 + fi * 0.25));
		inkAmt = max(inkAmt, max(t * occ, c) * (0.4 + fi * 0.2));
		// 林间雾
		float band = fbm4(vec2(L.x * 0.002 - uTime * 0.012 * (0.5 + ks[i]), L.y * 0.005 + fi * 3.0));
		col = mix(col, vec3(0.93, 0.89, 0.78), smoothstep(0.5, 0.78, band) * 0.4 * (1.0 - fi * 0.3));
	}
	// 林下的蕨与草：一笔笔斜出的淡墨，底部铺一层淡彩
	vec2 Lg = toLayer(p, 1.0);
	float fern = smoothstep(0.55, 0.8, noise(vec2(Lg.x * 0.03 + Lg.y * 0.02, Lg.y * 0.012))) * smoothstep(860.0, 1040.0, Lg.y);
	col = mix(col, LEAF * 0.8, smoothstep(820.0, 1080.0, Lg.y) * 0.4);
	col = mix(col, vec3(0.2, 0.24, 0.17), fern * 0.32);
	// 阳光：从左上斜射下来的泥金光束
	vec2 Ls = toLayer(p, 0.3);
	float beam = pow(0.5 + 0.5 * sin((Ls.x * 0.8 + Ls.y * 0.5) * 0.012 + 1.0), 6.0) * smoothstep(1000.0, 0.0, Ls.y);
	beam *= 0.6 + 0.4 * fbm4(Ls * 0.003 + uTime * 0.03);
	col += vec3(1.0, 0.86, 0.55) * beam * 0.16 * uSun;
	return col;
}

void main() {
	vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(1920.0, 1080.0);
	vec2 L1 = toLayer(p, 1.0);

	// 墨缝：竖向流动的分界；交汇时卷成 S 形
	float sy = (L1.y - 540.0) / 540.0;
	float seam = uSeam + (fbm4(vec2(L1.y * 0.003, uTime * 0.06)) - 0.5) * 240.0 + uMeet * 260.0 * sin(sy * 2.6);
	float edgeN = (fbm4(L1 * 0.006 + vec2(0.0, uTime * 0.1)) - 0.5) * 160.0;
	float side = smoothstep(seam - 70.0, seam + 70.0, L1.x + edgeN);   // 0 = 丛林，1 = 洞窟

	vec3 col = vec3(0.0);
	float inkJ = 0.0, inkC = 0.0, wet;
	if (side < 0.999) col += jungle(p, inkJ) * (1.0 - side);
	if (side > 0.001) {
		vec3 c = caveScene(p, inkC, wet);
		c = mix(c, INK, uCaveDark * (0.6 + 0.4 * smoothstep(0.2, 0.8, inkC)));
		col += c * side;
	}

	// 墨缝里的墨：从洞窟一侧洇进纸面的墨丝，交汇时更浓、更长
	float dx = L1.x + edgeN - seam;
	float tend = pow(1.0 - abs(2.0 * fbm4(vec2(L1.x * 0.004 - uTime * 0.05, L1.y * 0.008 + uTime * 0.04) + 17.0) - 1.0), 7.0);
	float reach = 140.0 + 260.0 * uMeet;
	float wisp = tend * exp(-max(-dx, 0.0) / reach) * smoothstep(60.0, -40.0, dx);
	col = mix(col, vec3(0.08, 0.065, 0.055), wisp * (0.55 + 0.3 * uMeet));
	// 分界线本身：一道湿墨
	col = mix(col, INK, exp(-pow(dx / 22.0, 2.0)) * (0.35 + 0.35 * uMeet));
	// 洞窟一侧透进来的一点丛林的光（交汇时）
	col = mix(col, col * 1.25 + vec3(0.04, 0.05, 0.02), uMeet * exp(-max(dx, 0.0) / 160.0) * side * 0.4);

	vec2 q1 = L1 / 1080.0;
	col = gold(toLayer(p, 0.5) / 1080.0, col, mix(inkJ, inkC, side));

	float fl = flood(q1);
	col = mix(col, INK, smoothstep(0.4, 0.95, fl));
	col = mix(col, gold(q1 * 1.3 + 3.0, col, fl), smoothstep(0.3, 0.8, fl));
	outColor = vec4(col * uBright, 1.0);
}
`;
