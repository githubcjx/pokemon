import {COMMON} from './shaders';

/**
 * 《被遗忘的英雄》②③ 的刺绣世界：深蓝丝绒底上的金线钉绣（opus anglicanum）。
 * 世界坐标与挂毯 Tapestry 的画心坐标一致（y 向下），镜头 uCam = (中心 x, 中心 y, 每单位像素)。
 * 每个像素先算出材质（底色、线的高度、光泽、金属度、自发光），再统一按高度求法线打光，
 * 这样金线、丝线、珍珠、亮片都会随光源方向闪烁。
 */
export const GALAR_GOLD_FRAG = `${COMMON}
uniform vec3 uCam;
uniform vec4 uIris;
uniform vec4 uStar;
uniform vec3 uTrail;
uniform vec4 uCrater;
uniform float uShock;
uniform float uEnergy;
uniform float uBurial;
uniform float uRupture;
uniform float uSkyRot;
uniform float uRedSky;
uniform float uVortex;
uniform vec2 uVortexC;
uniform float uBeam;
uniform float uTear;
uniform float uDark;
uniform float uGeo;
uniform float uKey;
uniform vec4 uG0;
uniform vec4 uG1;
uniform vec4 uG2;

const float PI = 3.14159265;
const vec3 GOLD = vec3(0.86, 0.56, 0.17);
const vec3 GOLD_HI = vec3(1.0, 0.82, 0.42);
const vec3 GARNET = vec3(0.42, 0.03, 0.05);

struct Surf { vec3 alb; float h; float gloss; float metal; float velvet; vec3 emit; };

vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 17.31)); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float prof(float u) { float x = fract(u) * 2.0 - 1.0; return sqrt(max(0.0, 1.0 - x * x)); }

// 三层山丘（与挂毯第一幅的构图一致：画心下部起伏）
float hill(float x, int i) {
	if (i == 0) return 548.0 + 26.0 * sin(x * 0.011 + 0.7) + 14.0 * sin(x * 0.027 + 2.1);
	if (i == 1) return 598.0 + 22.0 * sin(x * 0.014 + 2.4) + 10.0 * sin(x * 0.033 + 0.4);
	return 640.0 + 18.0 * sin(x * 0.012 - 0.6) + 9.0 * sin(x * 0.029 + 1.3);
}

// 七角星：坐标取自 Tapestry.tsx 的 STAR_POINTS，减去中心 (328,170)
float sdStar(vec2 p) {
	vec2 v[14] = vec2[14](
		vec2(1, -54), vec2(10, -18), vec2(40, -31), vec2(21, -5), vec2(49, 11), vec2(16, 11), vec2(18, 44),
		vec2(-1, 19), vec2(-21, 46), vec2(-16, 11), vec2(-50, 11), vec2(-22, -5), vec2(-39, -31), vec2(-9, -18));
	float d = dot(p - v[0], p - v[0]);
	float s = 1.0;
	for (int i = 0, j = 13; i < 14; j = i, i++) {
		vec2 e = v[j] - v[i];
		vec2 w = p - v[i];
		vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
		d = min(d, dot(b, b));
		bvec3 c = bvec3(p.y >= v[i].y, p.y < v[j].y, e.x * w.y > e.y * w.x);
		if (all(c) || all(not(c))) s *= -1.0;
	}
	return s * sqrt(d);
}

// Voronoi：返回 (到边界距离, 格子 id)
vec3 voronoi(vec2 p) {
	vec2 n = floor(p), f = fract(p);
	vec2 mg, mr; float md = 8.0;
	for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
		vec2 g = vec2(i, j);
		vec2 o = 0.15 + 0.7 * hash2(n + g);
		vec2 r = g + o - f;
		float d = dot(r, r);
		if (d < md) { md = d; mr = r; mg = g; }
	}
	md = 8.0;
	for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
		vec2 g = mg + vec2(i, j);
		vec2 o = 0.15 + 0.7 * hash2(n + g);
		vec2 r = g + o - f;
		if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
	}
	return vec3(md, n + mg);
}

// 两根并排钉绣的金线，外加一针针横压的红丝
void goldCouch(inout Surf s, float d, float along, float width, float threads) {
	float u = d / width * threads;
	if (u < 0.0 || u > threads) return;
	float twist = 0.82 + 0.18 * sin((along * 2.6 + floor(u) * 1.7) * 3.0);
	s.alb = GOLD * twist;
	s.h = 0.9 + 0.7 * prof(u);
	s.gloss = 0.9; s.metal = 1.0; s.velvet = 0.0;
	float c = fract(along / 6.5 + floor(u) * 0.5);
	if (c < 0.13) { s.alb = vec3(0.45, 0.05, 0.05); s.h = 1.9 + 0.3 * prof(c / 0.13 * 0.5 + 0.25); s.gloss = 0.5; s.metal = 0.0; }
}

Surf sky(vec2 w) {
	Surf s;
	float pile = noise(w * 2.7) * 0.55 + noise(w * 8.3) * 0.3;
	float crush = fbm(w * 0.009 + vec2(3.1, uTime * 0.004));
	vec3 night = mix(vec3(0.012, 0.02, 0.06), vec3(0.03, 0.045, 0.13), crush);
	vec3 red = mix(vec3(0.05, 0.004, 0.01), vec3(0.2, 0.015, 0.025), crush);
	s.alb = mix(night, red, uRedSky) * (0.8 + 0.4 * pile);
	s.h = pile * 0.25;
	s.gloss = 0.12; s.metal = 0.0; s.velvet = 1.0; s.emit = vec3(0);

	// 天上的星：珍珠与金亮片，随时间绕天极转动
	vec2 q = rot(uSkyRot) * (w - vec2(260.0, -700.0)) + vec2(260.0, -700.0);
	vec2 cell = floor(q / 46.0);
	vec2 hc = hash2(cell);
	if (hc.x < 0.33) {
		vec2 c = (cell + 0.2 + 0.6 * hash2(cell + 3.0)) * 46.0;
		vec2 r = q - c;
		float d = length(r);
		if (hc.y < 0.55) {
			float rad = 1.3 + 0.9 * hash(cell + 9.0);
			if (d < rad) { s.alb = vec3(0.85, 0.82, 0.74); s.h = 1.5 * sqrt(1.0 - d * d / (rad * rad)) * rad; s.gloss = 0.95; s.metal = 0.0; s.velvet = 0.0; }
		} else if (hc.y < 0.8) {
			float rad = 2.8 + 1.2 * hash(cell + 5.0);
			if (d < rad && d > rad * 0.28) {
				vec2 tilt = hash2(cell + 11.0) - 0.5;
				s.alb = GOLD * 1.05; s.h = 0.6 + dot(r, tilt) * 0.5; s.gloss = 1.0; s.metal = 1.0; s.velvet = 0.0;
				s.emit = GOLD_HI * 0.05 * (1.0 - uRedSky);
			}
		} else {
			// 四角金线小星：两道交叉的钉金线
			float L = 7.0 + 4.0 * hash(cell + 13.0);
			vec2 rr = rot(hash(cell + 21.0)) * r;
			float arm = min(abs(rr.x) + abs(rr.y) * 0.18, abs(rr.y) + abs(rr.x) * 0.18);
			float len = max(abs(rr.x), abs(rr.y));
			float wdt = 1.3 * (1.0 - len / L);
			if (len < L && arm < wdt) { s.alb = GOLD_HI * 0.9; s.h = prof(arm / wdt * 0.5 + 0.5); s.gloss = 0.95; s.metal = 1.0; s.velvet = 0.0; s.emit = GOLD_HI * 0.08 * (1.0 - uRedSky); }
		}
	}
	return s;
}

Surf ground(vec2 w, int i, float d) {
	Surf s;
	vec3 base = i == 0 ? vec3(0.03, 0.1, 0.11) : i == 1 ? vec3(0.13, 0.09, 0.035) : vec3(0.025, 0.085, 0.04);
	// 顺着山势一排排铺开的丝线（laid work），每排错开针脚
	float u = d * 0.85;
	float row = floor(u);
	float seg = fract(w.x * 0.21 + hash(vec2(row, float(i))) * 7.0);
	float taper = smoothstep(0.0, 0.07, seg) * smoothstep(1.0, 0.93, seg);
	float shade = 0.75 + 0.5 * noise(vec2(row * 0.23, w.x * 0.008 + float(i) * 4.0));
	s.alb = base * shade * mix(1.15, 0.55, smoothstep(0.0, 120.0, d));
	s.h = 0.7 * prof(u) * mix(0.45, 1.0, taper);
	s.gloss = 0.6; s.metal = 0.0; s.velvet = 0.0; s.emit = vec3(0);
	// 山脊上的金线
	goldCouch(s, d - 0.6, w.x, 4.2, 2.0);
	if (d < 0.6) { s.alb = vec3(0.01); s.h = 0.0; s.gloss = 0.0; s.metal = 0.0; }
	return s;
}

// 天上的黑红旋涡：多股黑丝绒、石榴红丝线和细金线盘成的螺旋，越往中心转得越快
void vortex(inout Surf s, vec2 w) {
	vec2 r = w - uVortexC;
	float rad = length(r);
	float reach = uVortex * 1500.0;
	float swirl = 2.6 / (1.0 + rad * 0.004);
	float a = atan(r.y, r.x) + uTime * (0.08 + 0.25 * swirl) + 1.1 * (fbm(r * 0.0035 + uTime * 0.03) - 0.5);
	float sp = a / (2.0 * PI) * 3.0 + log(rad + 6.0) * 1.25;
	float edge = smoothstep(reach, reach - 220.0, rad + 90.0 * noise(vec2(a * 3.0, uTime * 0.2)));
	if (edge <= 0.0) return;
	float band = fract(sp);
	float k = mod(floor(sp), 3.0);
	float u = band * 26.0;
	float deep = smoothstep(900.0, 60.0, rad);
	Surf v;
	if (k < 1.5) {
		v.alb = vec3(0.012, 0.006, 0.012) * (0.7 + 0.6 * noise(r * 0.02)); v.gloss = 0.12; v.velvet = 1.0;
	} else {
		v.alb = mix(GARNET * 0.55, vec3(0.6, 0.05, 0.05), deep * (0.5 + 0.5 * prof(u * 0.5))); v.gloss = 0.7; v.velvet = 0.0;
	}
	v.h = 0.8 * prof(u); v.metal = 0.0;
	v.emit = vec3(0.6, 0.03, 0.03) * (k > 1.5 ? 0.35 : 0.04) * deep * (0.6 + 0.4 * sin(sp * 4.0 - uTime * 2.5));
	v.emit += vec3(1.0, 0.25, 0.08) * 0.9 * exp(-rad / 45.0);
	if (band < 0.018) { v.alb = GOLD * 0.75; v.h = 1.4 * prof(band / 0.018 * 0.5 + 0.25); v.gloss = 0.9; v.metal = 1.0; v.velvet = 0.0; }
	s.alb = mix(s.alb, v.alb, edge); s.h = mix(s.h, v.h, edge); s.gloss = mix(s.gloss, v.gloss, edge);
	s.metal = mix(s.metal, v.metal, edge); s.velvet = mix(s.velvet, v.velvet, edge); s.emit = mix(s.emit, v.emit, edge);
}

// 极巨化的红云：一团团翻卷的石榴红丝线，每团绣成小漩涡，金线勾边，一明一暗地呼吸
void crown(inout Surf s, vec2 w, vec4 g) {
	if (g.w <= 0.0) return;
	vec2 p = (w - g.xy) / g.z;
	float d = 1e3; vec2 cc = vec2(0); float cr = 1.0;
	for (int i = 0; i < 9; i++) {
		float fi = float(i);
		float ang = PI * (0.08 + 0.84 * fi / 8.0);
		vec2 c = vec2(-cos(ang) * 80.0, -sin(ang) * 34.0 + 18.0 - 34.0 * hash(vec2(fi, 9.0))) + 4.0 * vec2(sin(uTime * 1.3 + fi), cos(uTime * 1.1 + fi * 2.0));
		float rr = 16.0 + 24.0 * hash(vec2(fi, 4.0)) + 3.0 * sin(uTime * 2.0 + fi);
		float di = length(p - c) - rr;
		if (di < d) { d = di; cc = c; cr = rr; }
	}
	d = d * g.z;
	float pulse = 0.6 + 0.4 * sin(uTime * 2.2 + g.x);
	if (d > 5.0 * g.z) { s.emit += vec3(0.9, 0.05, 0.04) * 0.55 * g.w * pulse * exp(-d / (22.0 * g.z)); return; }
	vec2 q = p - cc;
	float u = length(q) / cr * 4.0 + atan(q.y, q.x) / (2.0 * PI) * 2.0;
	Surf c;
	c.alb = mix(vec3(0.16, 0.008, 0.02), vec3(0.62, 0.05, 0.05), smoothstep(1.0, 0.1, length(q) / cr)); c.h = 0.8 * prof(u * 3.0); c.gloss = 0.7; c.metal = 0.0; c.velvet = 0.0;
	c.emit = vec3(0.95, 0.06, 0.04) * 0.3 * pulse * smoothstep(0.9, 0.0, length(q) / cr);
	if (d > 0.0) { c.alb = GOLD; c.h = 1.3 * prof(d / (5.0 * g.z) * 0.5 + 0.25); c.gloss = 0.9; c.metal = 1.0; c.emit = vec3(0); }
	s.alb = mix(s.alb, c.alb, g.w); s.h = mix(s.h, c.h, g.w); s.gloss = mix(s.gloss, c.gloss, g.w);
	s.metal = mix(s.metal, c.metal, g.w); s.velvet = mix(s.velvet, 0.0, g.w); s.emit = mix(s.emit, c.emit, g.w);
}

Surf nightWorld(vec2 w) {
	Surf s = sky(w);
	vortex(s, w);
	crown(s, w, uG0); crown(s, w, uG1); crown(s, w, uG2);

	// 红光柱：从陨坑直冲天顶，竖向的红丝缎面
	if (uBeam > 0.0 && w.y < uCrater.y) {
		float bw = 26.0 * (0.6 + 0.4 * uBeam) * (1.0 + 0.15 * sin(w.y * 0.03 + uTime * 4.0));
		float bx = abs(w.x - uCrater.x) / bw;
		float m = smoothstep(1.0, 0.85, bx) * uBeam;
		vec3 bc = mix(vec3(1.0, 0.42, 0.22), vec3(0.6, 0.02, 0.04), smoothstep(0.0, 0.8, bx));
		s.alb = mix(s.alb, bc * 0.5, m); s.h = mix(s.h, 0.7 * prof((w.x - uCrater.x) / 1.6), m);
		s.gloss = mix(s.gloss, 0.8, m); s.velvet *= 1.0 - m; s.metal *= 1.0 - m;
		s.emit += bc * (m * 1.3 + uBeam * 0.4 * exp(-bx * 1.5));
	}

	// 坠落的星和它拖出的金线尾巴
	if (uStar.w > 0.0) {
		vec2 p = (w - uStar.xy) / uStar.z;
		vec2 dir = uTrail.xy;
		vec2 perp = vec2(-dir.y, dir.x);
		float t = dot(p, -dir) / max(uTrail.z, 1.0);
		float across = dot(p, perp);
		float width = mix(13.0, 0.6, pow(clamp(t, 0.0, 1.0), 0.7)) * (0.85 + 0.15 * sin(t * 30.0 - uTime * 8.0));
		if (uTrail.z > 1.0 && t > 0.0 && t < 1.0 && abs(across) < width) {
			float u = across / 1.4;
			vec3 tc = mix(GOLD_HI, vec3(0.75, 0.16, 0.08), smoothstep(0.1, 1.0, t));
			s.alb = tc * (0.8 + 0.2 * sin(t * 140.0 + floor(u) * 2.0)); s.h = 1.0 * prof(u); s.gloss = 0.9; s.metal = 1.0; s.velvet = 0.0;
			s.emit += tc * (0.35 + 0.9 * prof(u)) * (1.0 - t) * uStar.w;
		}
		float sd = sdStar(p);
		if (sd < 0.0) {
			float a = atan(p.y, p.x);
			float u = a * length(p) / 1.3;
			s.alb = mix(GOLD, GOLD_HI, 0.25 + 0.25 * sin(length(p) * 0.5)); s.h = 1.2 + 0.8 * prof(u) + 2.0 * smoothstep(0.0, -14.0, sd); s.gloss = 0.95; s.metal = 1.0; s.velvet = 0.0;
			s.emit += GOLD_HI * 0.12 * uStar.w;
			if (sd > -3.5) { s.alb = vec3(0.32, 0.17, 0.06); s.h = 2.6 * prof(-sd / 3.5 * 0.5 + 0.25); s.metal = 0.3; s.gloss = 0.5; }
		}
		s.emit += GOLD_HI * 0.9 * uStar.w * exp(-max(sd, 0.0) / 16.0) * smoothstep(-1.0, 1.0, sd) * (0.4 + 0.6 * step(1.0, uTrail.z + 0.5));
		if (uTrail.z > 1.0) { float tt = dot(p, -dir) / uTrail.z; if (tt > 0.12) s.emit += vec3(1.0, 0.6, 0.25) * 0.35 * uStar.w * exp(-abs(across) / 10.0) * smoothstep(1.0, 0.0, tt) * step(0.0, tt); }
	}

	// 地面三层
	for (int i = 0; i < 3; i++) {
		float hy = hill(w.x, i);
		float sl = (hill(w.x + 1.0, i) - hy);
		float d = (w.y - hy) / sqrt(1.0 + sl * sl);
		if (d > 0.0) {
			Surf g = ground(w, i, d);
			s = g;
		}
	}

	// 陨坑、冲击波、注入核心的能量、缝合与裂开
	vec2 cr = (w - uCrater.xy) / vec2(78.0, 20.0);
	float cl = length(cr);
	float onGround = step(hill(w.x, 2), w.y) + step(hill(w.x, 1), w.y) + step(hill(w.x, 0), w.y);
	onGround = clamp(onGround, 0.0, 1.0);
	if (cl < 1.0 && uCrater.w > 0.0) {
		float m = uCrater.w;
		s.alb = mix(s.alb, vec3(0.02, 0.005, 0.008), m); s.h = mix(s.h, -1.0 + cl, m); s.gloss *= 1.0 - m; s.metal *= 1.0 - m;
		s.emit += vec3(1.0, 0.18, 0.08) * uCrater.z * (1.0 - cl) * m * 1.5;
	}
	vec2 rc = w - uCrater.xy;
	float rcl = length(rc * vec2(1.0, 2.2));
	s.emit += vec3(1.0, 0.25, 0.1) * uCrater.z * 0.6 * exp(-rcl / 110.0) * onGround;
	if (uShock > 0.0 && uShock < 1.0) {
		float R = uShock * 520.0;
		float ring = exp(-abs(rcl - R) / (3.0 + 10.0 * uShock));
		s.emit += GOLD_HI * ring * (1.0 - uShock) * 2.0;
	}
	if (uEnergy > 0.0) {
		float ang = atan(rc.y, rc.x);
		float lines = smoothstep(0.75, 1.0, prof(ang * 40.0 / (2.0 * PI) + noise(vec2(rcl * 0.01, 0.0)) * 0.6));
		float pulse = pow(fract(rcl * 0.012 + uTime * 0.9), 5.0);
		s.emit += mix(vec3(1.0, 0.4, 0.1), vec3(1.0, 0.1, 0.1), pulse) * uEnergy * lines * (0.25 + 1.6 * pulse) * onGround * smoothstep(620.0, 80.0, rcl);
	}
	if (uBurial > 0.0) {
		float x0 = uCrater.x - 150.0, x1 = x0 + 300.0 * uBurial;
		float ly = uCrater.y + 3.0 * sin(w.x * 0.08);
		if (w.x > x0 && w.x < x1 && abs(w.y - ly) < 1.8 && fract((w.x - x0) / 11.0) < 0.62) {
			s.alb = GOLD_HI * 0.9; s.h = 2.0 * prof((w.y - ly) / 3.6 + 0.5); s.gloss = 0.9; s.metal = 1.0;
		}
	}
	if (uRupture > 0.0) {
		vec3 vr = voronoi(w / 18.0 + noise(w * 0.05) * 0.6);
		float crack = smoothstep(0.045, 0.0, vr.x) * smoothstep(160.0, 10.0, rcl * (0.8 + 0.5 * hash(vr.yz))) * onGround;
		float flick = 0.7 + 0.3 * sin(uTime * 9.0 + vr.y * 3.0 + vr.z);
		s.emit += vec3(1.0, 0.16, 0.06) * crack * uRupture * 2.2 * flick;
		s.alb *= 1.0 - 0.5 * crack * uRupture;
	}
	return s;
}

// 草路镇的山坡：俯看的一整片绿丝绒草地，散落的短针像草
Surf geoWorld(vec2 w) {
	Surf s;
	float roll = fbm(w * 0.004 + 2.0);
	vec3 base = mix(vec3(0.04, 0.1, 0.03), vec3(0.11, 0.2, 0.06), roll);
	vec2 cell = floor(w / 3.2);
	vec2 lp = fract(w / 3.2) - 0.5;
	float an = hash(cell) * PI;
	vec2 q = rot(an) * lp;
	float st = smoothstep(0.42, 0.3, abs(q.x)) * smoothstep(0.2, 0.08, abs(q.y));
	s.alb = base * (0.75 + 0.5 * hash(cell + 2.0)) * (0.8 + 0.4 * st);
	s.h = 0.3 * noise(w * 2.0) + 0.6 * st * prof(q.y * 2.5 + 0.5);
	s.gloss = 0.35; s.metal = 0.0; s.velvet = 0.6; s.emit = vec3(0);
	return s;
}

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * (1920.0 / uRes.x);
	vec2 w = (px - vec2(960.0, 540.0)) / uCam.z + uCam.xy;

	// 布面撕裂：世界按 Voronoi 碎成一块块布片，向外漂开，缝隙里是黑红的余烬
	vec3 vc = voronoi(w / 210.0 + 0.35 * vec2(noise(w * 0.012), noise(w * 0.012 + 7.0)));
	vec2 id = vc.yz;
	float gapW = uTear * (0.035 + 0.05 * noise(w * 0.04)) + uTear * 0.02 * hash(floor(w * 0.6));
	vec2 drift = (hash2(id + 4.0) - 0.5) * vec2(260.0, 160.0) * uTear + vec2(0.0, 120.0 * uTear * uTear * hash(id + 8.0));
	vec2 sw = w - drift;
	float flip = clamp((uGeo - hash(id + 1.0) * 0.6) / 0.4, 0.0, 1.0);
	Surf s;
	if (flip < 0.5) s = nightWorld(sw); else s = geoWorld(sw);
	float flipDim = 1.0 - 0.85 * sin(flip * PI);
	s.alb *= (1.0 - 0.45 * uTear) * flipDim;

	vec2 grad = vec2(dFdx(s.h) / dFdx(w.x), dFdy(s.h) / dFdy(w.y));
	grad = clamp(grad, -3.0, 3.0);
	vec3 N = normalize(vec3(-grad, 1.0));
	vec3 L = normalize(vec3(-0.55 + 0.25 * sin(uTime * 0.21), -0.62, 0.58));
	vec3 V = vec3(0.0, 0.0, 1.0);
	vec3 H = normalize(L + V);
	float diff = max(dot(N, L), 0.0);
	float spec = pow(max(dot(N, H), 0.0), mix(10.0, 90.0, s.gloss)) * s.gloss;
	vec3 specCol = mix(vec3(0.9, 0.85, 0.8) * 0.35, s.alb * 2.4 + 0.15, s.metal);
	vec3 col = s.alb * (0.18 + 1.05 * diff) * (1.0 - 0.55 * s.metal) + specCol * spec * uKey;
	col += s.alb * 2.2 * pow(1.0 - N.z, 1.5) * s.velvet;
	// 陨坑 / 光柱的红光也照在线上
	vec3 Lp = normalize(vec3(uCrater.xy - sw, 90.0));
	float pd = max(dot(N, Lp), 0.0) * exp(-length(uCrater.xy - sw) / 260.0);
	col += s.alb * vec3(1.6, 0.35, 0.15) * pd * (uCrater.z * 1.2 + uBeam);
	col *= uKey;
	col += s.emit;

	// 撕开的缝
	if (uTear > 0.0 && vc.x < gapW) {
		float e = vc.x / max(gapW, 1e-4);
		vec3 ember = vec3(1.0, 0.18, 0.05) * (0.25 + 1.4 * pow(e, 6.0)) * (0.6 + 0.4 * noise(w * 0.3 + uTime));
		float fib = smoothstep(0.6, 1.0, prof(dot(w, vec2(0.7, 0.7)) * 1.5)) * step(0.4, e);
		col = vec3(0.01, 0.004, 0.006) + ember * (1.0 - uDark * 0.5) + vec3(0.8, 0.5, 0.3) * fib * 0.25;
	}
	if (flip > 0.02 && flip < 0.98) col += GOLD_HI * smoothstep(0.02, 0.0, vc.x) * sin(flip * PI) * 1.2;

	col *= 1.0 - uDark * 0.86;
	col = 1.0 - exp(-col * 1.35);
	col = pow(col, vec3(1.0 / 2.0));

	float alpha = 1.0;
	if (uIris.w > 0.0) {
		vec2 d = px - uIris.xy;
		float ang = atan(d.y, d.x);
		float fray = hash(vec2(floor(ang * 260.0), 3.0));
		float r = uIris.z * (1.0 + 0.05 * (noise(vec2(ang * 4.0, uTime)) - 0.5)) + 26.0 * fray * fray;
		float dist = length(d);
		alpha = smoothstep(r, r - 18.0, dist);
		float ring = exp(-abs(dist - r + 8.0) / 7.0);
		col += GOLD_HI * ring * 0.9 * step(1.0, uIris.z);
		alpha = max(alpha, ring * 0.8 * step(1.0, uIris.z));
	}
	outColor = vec4(col, alpha);
}
`;
