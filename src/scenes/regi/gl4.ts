import {HEAD} from './gl';

/**
 * 王冠雪原（第 4 段）：暮色里的雪山、山下的平原、前景的山脊，风雪。
 * 画面按"基准构图"的像素来摆：uCam = 镜头中心（基准像素）和推近倍数；远景按视差系数少动一些。
 * 前景山脊只用正弦叠加（JS 里的 ridgeY 与这里一致，巨人站在山脊上）。
 * uTint：天空和雪地的色调（灾祸时偏红）；uFlash：闪电照亮天空（基准像素位置、强度）
 */
export const TUNDRA_FRAG = `${HEAD}
uniform vec3 uCam;
uniform vec3 uTint;
uniform vec3 uFlash;
uniform float uStorm;
uniform float uTemple; // 第 7 段：洗翠的山崖和雪峰神殿（0–1）
uniform float uDim;
uniform float uExposure;
uniform float uFade;

float ridge(float u) {
	return -0.16 + 0.1 * u + 0.02 * sin(u * 3.1 + 0.5) + 0.01 * sin(u * 7.3);
}
// 第 k 层（视差系数 k）里，这个像素对应的基准坐标（uv，y 向上，画面中心为 0）
vec2 layerUV(vec2 frag, float k) {
	float z = 1.0 + (uCam.z - 1.0) * k;
	vec2 c = vec2(960.0, 540.0) + (uCam.xy - vec2(960.0, 540.0)) * k;
	vec2 px = vec2(frag.x, uRes.y - frag.y) / uRes.y * 1080.0;
	vec2 b = c + (px - vec2(960.0, 540.0)) / z;
	return vec2((b.x - 960.0) / 1080.0, (540.0 - b.y) / 1080.0);
}
float mtn(float x, float sc, float off) { return fbm(vec2(x * sc + off, 0.5), 5); }

void main() {
	vec2 frag = gl_FragCoord.xy;
	float t = uTime;
	// 天空
	vec2 s = layerUV(frag, 0.08);
	vec3 col = mix(vec3(0.06, 0.07, 0.09), vec3(0.008, 0.011, 0.02), smoothstep(-0.05, 0.5, s.y));
	float cl = fbm(vec2(s.x * 1.4 + t * 0.012, s.y * 3.0), 5);
	col = mix(col, vec3(0.045, 0.05, 0.065), smoothstep(0.45, 0.8, cl) * 0.6);
	col *= uTint;
	// 闪电照亮云层（柔和，不闪白）
	vec2 fp = (uFlash.xy - vec2(960.0, 540.0)) / 1080.0 * vec2(1.0, -1.0);
	col += vec3(1.0, 0.85, 0.45) * uFlash.z * exp(-length(s - fp) * 2.2) * (0.5 + 0.5 * cl) * 0.6;
	// 远山
	vec2 a = layerUV(frag, 0.25);
	float h1 = mtn(a.x, 1.6, 3.0) * 0.26 - 0.02;
	if (a.y < h1) {
		float slope = (mtn(a.x + 0.004, 1.6, 3.0) - mtn(a.x - 0.004, 1.6, 3.0)) * 0.26 / 0.008;
		float lit = clamp(0.55 - slope * 0.5, 0.15, 1.0);
		vec3 m = vec3(0.12, 0.14, 0.18) * (0.6 + 0.55 * lit) * (0.85 + 0.3 * fbm(vec2(a.x * 9.0 + a.y * 2.0, a.y * 40.0), 4));
		m = mix(m, vec3(0.055, 0.065, 0.085), 0.45);
		col = m * mix(vec3(1.0), uTint, 0.6);
	}
	// 中景的山
	vec2 b = layerUV(frag, 0.5);
	float h2 = -0.07 + mtn(b.x, 2.4, 11.0) * 0.24;
	if (b.y < h2) {
		float slope = (mtn(b.x + 0.003, 2.4, 11.0) - mtn(b.x - 0.003, 2.4, 11.0)) * 0.24 / 0.006;
		float lit = clamp(0.55 - slope * 0.5, 0.15, 1.0);
		vec3 m = vec3(0.16, 0.18, 0.23) * (0.6 + 0.55 * lit) * (0.85 + 0.3 * fbm(vec2(b.x * 9.0 + b.y * 2.0, b.y * 40.0), 4));
		// 岩石露出来的地方
		float rock = smoothstep(0.55, 0.7, fbm(b * vec2(9.0, 9.0) + 4.0, 4)) * smoothstep(h2 - 0.2, h2 - 0.01, b.y);
		m = mix(m, vec3(0.025, 0.025, 0.03), rock * 0.7);
		m = mix(m, vec3(0.06, 0.07, 0.09), 0.3);
		col = m * mix(vec3(1.0), uTint, 0.7);
	}
	// 山崖和神殿（中景，视差 0.5）
	if (uTemple > 0.0) {
		const float CX = 0.38;
		float dx = abs(b.x - CX);
		float cliff = 0.11 - smoothstep(0.12, 0.3, dx) * 0.26 + (fbm(vec2(b.x * 9.0, 4.0), 3) - 0.5) * 0.025 + (fbm(vec2(b.x * 40.0, 7.0), 3) - 0.5) * 0.03 * smoothstep(0.1, 0.16, dx);
		vec3 tc = col;
		bool hit = false;
		if (b.y < cliff) {
			float n = fbm(b * vec2(10.0, 22.0), 4);
			float streak = fbm(vec2(b.x * 60.0, b.y * 8.0), 3);
			tc = mix(vec3(0.03, 0.033, 0.042), vec3(0.08, 0.085, 0.1), n) * (0.75 + 0.5 * streak);
			// 残雪：岩面上零星的积雪
			tc = mix(tc, vec3(0.24, 0.27, 0.32), smoothstep(0.62, 0.72, fbm(b * vec2(26.0, 40.0) + 3.0, 4)) * 0.8);
			tc = mix(tc, vec3(0.28, 0.31, 0.37), smoothstep(0.01, 0.0, cliff - b.y) * 0.9);
			hit = true;
		}
		// 神殿（照游戏里的雪峰神殿）：低矮宽阔的石砌建筑，平顶铺石板、积着雪；正面左右各三根圆石柱，
		// 正中是黑洞洞的门口和台阶；两旁是积雪的树
		float base = 0.11;
		float dxx = b.x - CX;
		float ax = abs(dxx);
		float yy = b.y - base;
		vec3 stone = vec3(0.085, 0.092, 0.112);
		// 两旁积雪的树（圆团，上半截是雪）
		for (int i = 0; i < 4; i++) {
			float tx = (i < 2 ? -1.0 : 1.0) * (0.15 + 0.035 * float(i % 2));
			float tr = 0.022 - 0.004 * float(i % 2);
			vec2 tq = vec2(dxx - tx, yy - tr * 0.9);
			float td = length(tq * vec2(1.0, 1.1));
			if (td < tr) {
				tc = mix(vec3(0.02, 0.04, 0.035), vec3(0.26, 0.29, 0.34), smoothstep(-0.2, 0.5, tq.y / tr + 0.25 * fbm(b * 160.0, 2)));
				hit = true;
			}
		}
		// 台基
		if (ax < 0.118 && yy > 0.0 && yy < 0.012) {
			tc = mix(stone * 1.1, vec3(0.27, 0.3, 0.35), smoothstep(0.006, 0.012, yy));
			hit = true;
		}
		// 墙：大块石砖（错缝）
		if (ax < 0.1 && yy >= 0.012 && yy < 0.084) {
			float row = floor((yy - 0.012) / 0.018);
			float bx = (dxx + 0.1 + mod(row, 2.0) * 0.016) / 0.032;
			float edge = min(min(fract(bx), 1.0 - fract(bx)) * 0.032, min(fract((yy - 0.012) / 0.018), 1.0 - fract((yy - 0.012) / 0.018)) * 0.018);
			tc = stone * (0.85 + 0.25 * hash12(vec2(floor(bx), row))) * (0.9 + 0.2 * fbm(b * 90.0, 2));
			tc *= mix(0.55, 1.0, smoothstep(0.0, 0.0012, edge));
			// 门口：黑洞洞的，里面一点冷光；门前三级台阶
			if (ax < 0.017 && yy < 0.052) tc = vec3(0.012, 0.014, 0.02) + vec3(0.03, 0.045, 0.06) * smoothstep(0.052, 0.0, yy) * 0.6;
			hit = true;
		}
		if (ax < 0.024 && yy > 0.0 && yy < 0.012) {
			float st = fract(yy / 0.004);
			tc = mix(vec3(0.11, 0.12, 0.14), vec3(0.24, 0.26, 0.31), step(0.6, st));
			hit = true;
		}
		// 正面的圆石柱：门两边各三根
		for (int i = 0; i < 6; i++) {
			float cxp = (i < 3 ? -1.0 : 1.0) * (0.03 + 0.024 * float(i % 3));
			float u = (dxx - cxp) / 0.0075;
			if (abs(u) < 1.0 && yy > 0.012 && yy < 0.084) {
				float shade = 0.55 + 0.6 * sqrt(max(1.0 - u * u, 0.0)) * (0.75 - 0.25 * u);
				tc = vec3(0.11, 0.118, 0.14) * shade * (0.9 + 0.2 * fbm(vec2(u, yy * 220.0), 2));
				// 柱头、柱脚
				if (yy < 0.017 || yy > 0.079) tc *= 1.25;
				hit = true;
			}
		}
		// 平顶：正面一道石板边，上面露出一窄条铺着石板、积着雪的屋顶
		if (ax < 0.108 && yy >= 0.084 && yy < 0.094) {
			tc = stone * 0.85 * (0.9 + 0.2 * fbm(b * 120.0, 2));
			hit = true;
		}
		float topW = mix(0.108, 0.098, smoothstep(0.094, 0.112, yy));
		if (ax < topW && yy >= 0.094 && yy < 0.112) {
			vec2 slab = vec2(fract((dxx + 0.11) / 0.022), fract((yy - 0.094) / 0.006));
			tc = mix(vec3(0.2, 0.22, 0.26), vec3(0.3, 0.33, 0.38), fbm(b * 140.0, 3));
			tc *= mix(0.82, 1.0, smoothstep(0.0, 0.06, min(slab.x, 1.0 - slab.x)));
			hit = true;
		}
		if (hit) col = mix(col, tc * mix(vec3(1.0), uTint, 0.7), uTemple);
	}
	// 平原和前景山脊（视差 1）
	vec2 g = layerUV(frag, 1.0);
	float plain = -0.065 + 0.006 * sin(g.x * 9.0);
	if (g.y < plain) {
		float d = plain - g.y;
		vec3 m = mix(vec3(0.07, 0.08, 0.1), vec3(0.1, 0.11, 0.14), smoothstep(0.0, 0.25, d));
		m *= 0.85 + 0.3 * fbm(vec2(g.x * 30.0, g.y * 90.0), 3);
		col = m * mix(vec3(1.0), uTint, 0.8);
	}
	float hr3 = ridge(g.x);
	if (g.y < hr3) {
		float d = hr3 - g.y;
		vec3 m = vec3(0.2, 0.22, 0.27) * (0.75 + 0.35 * fbm(vec2(g.x * 18.0 + g.y * 4.0, g.y * 60.0), 4));
		m *= mix(1.0, 0.5, smoothstep(0.0, 0.35, d));
		// 山脊线上一道受光的边
		m += vec3(0.16, 0.18, 0.22) * exp(-d * 260.0) * 0.6;
		col = m * mix(vec3(1.0), uTint, 0.85);
	}
	// 贴地吹过的雪
	float drift = fbm(vec2(g.x * 3.0 - t * 0.5, g.y * 14.0), 5);
	col += vec3(0.55, 0.6, 0.68) * smoothstep(0.5, 0.85, drift) * 0.08 * uStorm * smoothstep(0.1, -0.35, g.y);
	// 雪雾
	col = mix(col, vec3(0.07, 0.08, 0.1) * uTint, 0.14 * uStorm * (0.6 + 0.4 * fbm(vec2(g.x * 2.0 - t * 0.2, g.y * 4.0), 3)));
	// 远处的落雪（两层；近处的雪在前景画布上）
	for (int i = 0; i < 2; i++) {
		float fi = float(i);
		float sc = 40.0 - fi * 12.0;
		vec2 q = (frag / uRes.y) * sc + vec2(t * (1.4 + fi * 1.2), t * (2.0 + fi * 1.4));
		vec2 cell = floor(q);
		vec2 o = vec2(hash12(cell + fi * 7.0), hash12(cell + fi * 13.0 + 3.0)) * 0.8 + 0.1;
		float r = length(fract(q) - o);
		float sz = 0.05 + fi * 0.03;
		col += vec3(0.75, 0.8, 0.88) * smoothstep(sz, sz * 0.2, r) * (0.18 + fi * 0.14) * uStorm * step(0.45, hash12(cell + 2.7));
	}
	col *= 1.0 - uDim;
	outColor = vec4(finish(col, frag, uExposure, 0.7, uFade), 1.0);
}
`;

/**
 * 遗迹的石门（第 4 段）：一面岩壁上开着几道拱门，每道门两扇石板向中间合拢。世界单位：门宽 1.8、高 2.3，地面 y = 0。
 * uView：画面中心（世界坐标）和画面纵向看到的高度。uLayer 0 = 岩壁和门洞里的暗处（不透明），1 = 只画石板（透明背景）。
 * uDoor[i] = 门的 x、合拢程度、门缝的金光、门楣上七个点的金光；uGlow[i] = 门洞里的光色和强度
 * uMarks：每道门 7 个点（门楣上的记号，相对坐标），每个 vec4 存两个点
 */
export const DOORS_FRAG = `${HEAD}
uniform vec3 uView;
uniform float uLayer;
uniform vec4 uDoor[5];
uniform vec4 uGlow[5];
uniform vec4 uMarks[20];
uniform vec3 uWallTint; // 第 7 段：神殿里偏冷的石头（0 = 不变）
uniform float uExposure;
uniform float uFade;

const float DW = 1.8, DH = 2.3;

// 门洞（拱形）的有向距离：内部为负
float archSD(vec2 q) {
	float r = DW * 0.5;
	float yc = DH - r;
	if (q.y > yc) return length(q - vec2(0.0, yc)) - r;
	return max(abs(q.x) - r, -q.y);
}
float rockH(vec2 p) { return fbm(p * 1.3, 5) * 0.12 + fbm(p * 7.0, 3) * 0.02; }

vec2 markPt(int door, int k) {
	vec4 v = uMarks[door * 4 + k / 2];
	return (k % 2 == 0) ? v.xy : v.zw;
}

void main() {
	vec2 frag = gl_FragCoord.xy;
	vec2 uv = (frag - uRes * 0.5) / uRes.y;
	vec2 P = uView.xy + uv * uView.z;
	float pxw = uView.z / uRes.y;
	// 离这个像素最近的门
	int id = 0;
	float best = 1e9;
	for (int i = 0; i < 5; i++) { float d = abs(P.x - uDoor[i].x); if (d < best) { best = d; id = i; } }
	vec4 D = uDoor[id];
	vec2 q = P - vec2(D.x, 0.0);
	float sd = archSD(q);
	vec3 gc = uGlow[id].rgb * uGlow[id].a;
	vec3 wt = mix(vec3(1.0), uWallTint, step(0.001, uWallTint.r + uWallTint.g + uWallTint.b));

	if (uLayer > 0.5) {
		// 石板：左扇从左往右推，右扇从右往左推；合拢时中间留一道缝
		float hw = DW * 0.5;
		float close = D.y;
		float edgeL = -hw + hw * close;
		float edgeR = hw - hw * close;
		bool onL = q.x < edgeL;
		bool onR = q.x > edgeR;
		if (close < 0.001 || q.y < 0.0 || sd > 0.04 || !(onL || onR)) { outColor = vec4(0.0); return; }
		float e = onL ? edgeL - q.x : q.x - edgeR; // 离石板内侧边缘的距离
		vec2 sp = vec2(e, q.y) + vec2(onL ? 3.1 : 7.7, 0.0);
		vec3 alb = mix(vec3(0.06, 0.056, 0.052), vec3(0.12, 0.11, 0.1), fbm(sp * 3.0, 4)) * (0.8 + 0.35 * fbm(sp * 14.0, 3));
		// 浅浮雕：两道竖线和一圈拱形纹
		float ring = abs(archSD(vec2(q.x, q.y) * 1.25 + vec2(0.0, 0.0)) + 0.0);
		float groove = smoothstep(0.012, 0.0, abs(ring - 0.18)) + smoothstep(0.012, 0.0, abs(e - 0.12));
		alb *= (1.0 - groove * 0.35) * wt;
		vec3 col = alb * 0.5;
		col += alb * vec3(0.5, 0.55, 0.65) * 0.35 * smoothstep(0.0, DH, q.y);
		// 内侧边缘倒角受光
		col += vec3(0.12, 0.1, 0.08) * exp(-e / (pxw * 3.0)) * 0.45;
		// 门洞里的光从缝里透出来
		col += gc * exp(-e / 0.05) * 0.35;
		// 门缝漏出的金光
		col += vec3(1.0, 0.7, 0.32) * D.z * exp(-abs(q.x) / 0.035) * 1.1;
		float a = smoothstep(0.04, 0.0, sd) * clamp(e / pxw + 0.5, 0.0, 1.0);
		outColor = vec4(finish(col, frag, uExposure, 0.6, uFade), a);
		return;
	}

	vec3 col;
	if (P.y < 0.0) {
		// 地面
		float n = fbm(vec2(P.x * 2.0, P.y * 8.0), 4);
		col = vec3(0.025, 0.023, 0.022) * (0.7 + 0.5 * n) * wt;
		for (int i = 0; i < 5; i++) {
			vec2 gq = P - vec2(uDoor[i].x, 0.0);
			col += uGlow[i].rgb * uGlow[i].a * 0.35 * exp(-length(gq * vec2(0.9, 3.0)) * 1.6) * (1.0 - uDoor[i].y * 0.85);
			col += vec3(1.0, 0.7, 0.32) * uDoor[i].z * 0.5 * exp(-length(gq * vec2(4.0, 2.0)) * 2.0);
		}
	} else if (sd < 0.0) {
		// 门洞里：黑暗，正中有巨人身上的光
		float r = length((q - vec2(0.0, DH * 0.45)) * vec2(1.0, 0.8));
		col = vec3(0.004, 0.005, 0.006) + gc * exp(-r * 2.2) * 0.35;
	} else {
		// 岩壁：高度图求法线
		float frame = smoothstep(0.0, 0.03, sd) * smoothstep(0.24, 0.2, sd);
		float h0 = rockH(P) + frame * 0.05;
		float hx = rockH(P + vec2(0.01, 0.0)) + smoothstep(0.0, 0.03, archSD(q + vec2(0.01, 0.0))) * smoothstep(0.24, 0.2, archSD(q + vec2(0.01, 0.0))) * 0.05;
		float hy = rockH(P + vec2(0.0, 0.01)) + smoothstep(0.0, 0.03, archSD(q + vec2(0.0, 0.01))) * smoothstep(0.24, 0.2, archSD(q + vec2(0.0, 0.01))) * 0.05;
		vec3 N = normalize(vec3(-(hx - h0) / 0.01, -(hy - h0) / 0.01, 1.0));
		vec3 alb = mix(vec3(0.03, 0.029, 0.028), vec3(0.085, 0.08, 0.072), fbm(P * 2.1 + 5.0, 4));
		alb = mix(alb, vec3(0.11, 0.1, 0.09), frame * 0.7) * wt;
		col = alb * (0.12 + 0.7 * pow(max(dot(N, normalize(vec3(-0.5, 0.6, 0.6))), 0.0), 2.0));
		// 门洞里的光照到门框上（门越关越暗）
		col += alb * gc * 3.0 * exp(-sd * 3.5) * (1.0 - D.y * 0.8);
		// 门缝的金光照亮门框
		col += alb * vec3(1.0, 0.7, 0.32) * D.z * 0.9 * exp(-length(q - vec2(0.0, DH * 0.5)) * 1.2);
		// 门楣上的七个点（刻进石头里，亮起时是金色）
		vec2 mc = vec2(0.0, DH + 0.42);
		for (int k = 0; k < 7; k++) {
			vec2 m = mc + markPt(id, k);
			float r = length(q - m);
			float pit = smoothstep(0.05, 0.035, r);
			col *= 1.0 - pit * 0.35;
			col += vec3(1.0, 0.72, 0.35) * D.w * (pit * 1.8 + exp(-r * r / 0.006) * 0.5);
		}
	}
	outColor = vec4(finish(col, frag, uExposure, 0.8, uFade), 1.0);
}
`;
