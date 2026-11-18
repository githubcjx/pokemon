/**
 * 《空间的形状》封面背景：两层平行的空间（上下两张珍珠白网格面）朝帕路奇亚弯折收拢，
 * 它就待在两层之间的缝隙里；身后一道亚空裂斩把空间劈开，切口两侧的网格错位，缝里透出珍珠母贝的虹彩光。
 *
 * 真 3D：两张高度场逐像素光线步进求交，网格线按 fwidth 抗锯齿。
 * 坐标：y 向上，相机看向 -z；uC 是弯折中心（世界 xz），也是帕路奇亚所在的位置。
 */
export const COVER_FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec3 uRo;
uniform float uYaw;
uniform float uPitch;
uniform float uFl;
uniform vec2 uC;
uniform float uH;
uniform float uSigma;
uniform float uPinch;
uniform float uTwist;
uniform float uDensity;
/** 裂斩：屏幕上的中心（按高度归一化，原点在画面中心）、方向角、长度、宽度 */
uniform vec2 uTearP;
uniform float uTearAng;
uniform float uTearLen;
uniform float uTearW;
out vec4 outColor;

const float TAU = 6.2831853;

float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}
float noise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
	float s = 0.0, a = 0.5;
	for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; }
	return s;
}

/** 珍珠母贝：粉、淡紫、冰青、一点薄荷的虹彩，整体偏珍珠白 */
vec3 nacre(float x) {
	return vec3(0.80, 0.76, 0.90) + vec3(0.20, 0.20, 0.13) * cos(TAU * (x + vec3(0.0, 0.30, 0.62)));
}

const vec3 PEARL = vec3(0.93, 0.91, 1.0);
const vec3 PINK = vec3(1.0, 0.62, 0.86);
const vec3 LILAC = vec3(0.70, 0.56, 1.0);
const vec3 DEEP = vec3(0.006, 0.003, 0.016);

/** 弯折量：长尾的漏斗，越靠近帕路奇亚越深 */
float well(vec2 xz) {
	vec2 d = xz - uC;
	float r2 = dot(d, d) / (uSigma * uSigma);
	return pow(1.0 / (1.0 + r2), 1.15);
}
float yLow(vec2 xz) { return -uH + uPinch * uH * well(xz); }
float yHigh(vec2 xz) { return uH - uPinch * uH * well(xz); }

/** 光线与上 / 下两张面求交，返回 t（未命中为 -1） */
float march(vec3 ro, vec3 rd, float s) {
	float t = 0.02;
	float prevT = t;
	float prevF = 1.0;
	for (int i = 0; i < 900; i++) {
		vec3 p = ro + rd * t;
		float f = s < 0.0 ? p.y - yLow(p.xz) : yHigh(p.xz) - p.y;
		if (f < 0.0) {
			// 二分细化
			float a = prevT, b = t;
			for (int k = 0; k < 12; k++) {
				float m = 0.5 * (a + b);
				vec3 q = ro + rd * m;
				float fm = s < 0.0 ? q.y - yLow(q.xz) : yHigh(q.xz) - q.y;
				if (fm < 0.0) b = m; else a = m;
			}
			return 0.5 * (a + b);
		}
		prevT = t;
		prevF = f;
		t += clamp(f * 0.3, 0.002 + t * 0.0012, 0.22);
		if (t > 140.0) break;
	}
	return -1.0;
}

/** 网格线：返回 (细线, 粗线, 交点)。掠射角下两个方向的像素足迹差别很大，按方向分别淡出，避免摩尔纹 */
vec3 grid(vec2 uv, vec2 fw) {
	vec2 w = max(fw, 1e-4);
	vec2 g = abs(fract(uv - 0.5) - 0.5);
	vec2 fadeMinor = 1.0 - smoothstep(0.12, 0.35, w);
	vec2 l = (1.0 - smoothstep(0.0, 1.6, g / w - 0.15)) * fadeMinor;
	float minor = max(l.x, l.y);
	vec2 w5 = w / 5.0;
	vec2 g5 = abs(fract(uv / 5.0 - 0.5) - 0.5);
	vec2 fadeMajor = 1.0 - smoothstep(0.10, 0.30, w5);
	vec2 l5 = (1.0 - smoothstep(0.0, 1.6, g5 / w5 - 0.6)) * fadeMajor;
	float major = max(l5.x, l5.y);
	float node = (1.0 - smoothstep(0.0, 2.4, length(g / w) - 0.9)) * min(fadeMinor.x, fadeMinor.y);
	return vec3(minor, major, node);
}

vec3 stars(vec3 rd) {
	vec3 col = vec3(0.0);
	for (int layer = 0; layer < 3; layer++) {
		float sc = 90.0 + float(layer) * 110.0;
		vec2 uv = vec2(atan(rd.x, -rd.z), rd.y) * sc;
		vec2 id = floor(uv);
		vec2 f = fract(uv) - 0.5;
		float h = hash(id + float(layer) * 17.0);
		if (h > 0.93) {
			vec2 o = vec2(hash(id + 3.1), hash(id + 9.7)) - 0.5;
			float d = length(f - o * 0.7);
			float b = pow(hash(id + 1.7), 3.0);
			col += mix(PEARL, nacre(h * 3.0), 0.5) * b * smoothstep(0.12, 0.0, d) * 1.6;
		}
	}
	return col;
}

mat3 camRot() {
	float cy = cos(uYaw), sy = sin(uYaw), cp = cos(uPitch), sp = sin(uPitch);
	mat3 yaw = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
	mat3 pitch = mat3(1.0, 0.0, 0.0, 0.0, cp, sp, 0.0, -sp, cp);
	return yaw * pitch;
}

void main() {
	vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

	// ── 裂斩（屏幕空间）：切口两侧的空间错开 ──
	vec2 tdir = vec2(cos(uTearAng), sin(uTearAng));
	vec2 tn = vec2(-tdir.y, tdir.x);
	vec2 rel = p - uTearP;
	float along = dot(rel, tdir) / uTearLen;
	// 切口边缘带一点不规则的锯齿
	float jag = (fbm(vec2(along * 9.0, 1.3)) - 0.5) * 0.010 + (noise(vec2(along * 60.0, 4.0)) - 0.5) * 0.0025;
	// 刀痕略带弧度
	float across = dot(rel, tn) + jag + along * along * 0.035;
	float lens = sqrt(max(0.0, 1.0 - along * along));
	float halfW = uTearW * pow(lens, 2.2) * (0.85 + 0.3 * fbm(vec2(along * 4.0, 7.0)));
	float side = sign(across);
	float shear = smoothstep(1.05, 0.2, abs(along));
	// 两半沿切口方向相对滑开，并向两侧略微推开
	vec2 pShift = p - side * (tdir * 0.018 + tn * halfW * 0.9) * shear;

	vec3 ro = uRo;
	mat3 R = camRot();
	vec3 rd = normalize(R * vec3(pShift, -uFl));

	float tL = march(ro, rd, -1.0);
	float tU = march(ro, rd, 1.0);
	float t = -1.0;
	float sheet = 0.0;
	if (tL > 0.0 && (tU < 0.0 || tL < tU)) { t = tL; sheet = -1.0; }
	else if (tU > 0.0) { t = tU; sheet = 1.0; }

	vec3 hit = ro + rd * max(t, 0.0);
	// 两层空间的格子互相错开半格，切口两侧再各自滑动一点
	// 帕路奇亚周围的空间被拧转：越靠近中心转得越多
	vec2 rc = hit.xz - uC;
	float tw = well(hit.xz) * uTwist * (sheet > 0.0 ? -1.0 : 1.0);
	rc = mat2(cos(tw), sin(tw), -sin(tw), cos(tw)) * rc;
	vec2 uv = (rc + uC) * uDensity + (sheet > 0.0 ? vec2(0.5, 0.25) : vec2(0.0)) + side * shear * vec2(0.5, 0.0);
	vec2 fw = fwidth(uv);

	vec3 col = DEEP;
	// 远处的缝：两层之间的地平线泛着珍珠粉的雾光
	float horizon = exp(-abs(rd.y + 0.02) * 9.0);
	col += mix(LILAC * 0.16, PINK * 0.24, 0.5 + 0.5 * rd.x) * horizon;
	col += stars(rd) * (1.0 - horizon * 0.6);

	vec3 C3 = vec3(uC.x, 0.0, uC.y);
	if (t > 0.0) {
		float w = well(hit.xz);
		vec3 gl = grid(uv, fw);
		// 法线（数值梯度）用于菲涅耳
		float e = 0.01;
		vec2 xz = hit.xz;
		float fy = sheet < 0.0 ? yLow(xz) : yHigh(xz);
		float dx = (sheet < 0.0 ? yLow(xz + vec2(e, 0)) : yHigh(xz + vec2(e, 0))) - fy;
		float dz = (sheet < 0.0 ? yLow(xz + vec2(0, e)) : yHigh(xz + vec2(0, e))) - fy;
		vec3 n = normalize(vec3(-dx / e, 1.0, -dz / e)) * (sheet < 0.0 ? 1.0 : -1.0);
		float fres = pow(1.0 - abs(dot(n, -rd)), 3.0);
		// 侧对视线的面上，线框压成一团细纹：按掠射角淡出
		float edgeOn = smoothstep(0.04, 0.16, abs(dot(n, rd)));
		gl *= edgeOn;

		float distFade = exp(-t * 0.07);
		float toC = length(hit - C3);
		float light = 1.0 / (1.0 + toC * toC * 0.12);
		// 越靠近弯折中心，线框越变成珍珠母贝
		float pearlMix = smoothstep(0.05, 0.75, w);
		vec3 irid = nacre(w * 1.4 + fres * 0.8 + dot(hit.xz, vec2(0.05, 0.03)) + fbm(hit.xz * 0.6) * 0.5);
		vec3 lineCol = mix(PEARL * vec3(0.78, 0.80, 1.0), irid * 1.25, pearlMix);

		vec3 s = vec3(0.0);
		// 面本身：极淡的玻璃，掠射角更亮
		s += mix(LILAC, PINK, pearlMix) * (0.018 + 0.10 * fres + 0.22 * w * w) * (0.5 + light);
		s += lineCol * gl.x * (0.16 + 1.3 * light + 1.2 * w);
		s += lineCol * gl.y * (0.50 + 2.2 * light + 1.4 * w);
		s += mix(PEARL, irid, 0.6) * gl.z * (0.5 + 3.5 * light) * 1.3;
		// 网格上流动的光脉
		float pulse = smoothstep(0.92, 1.0, sin(length(hit.xz - uC) * 2.2 - fbm(hit.xz * 0.3) * 4.0));
		s += irid * pulse * (gl.x + gl.y) * light * 1.6;

		float fog = 1.0 - distFade;
		vec3 fogCol = mix(LILAC * 0.16, PINK * 0.24, 0.5 + 0.5 * rd.x) * horizon + DEEP;
		col = mix(s + DEEP, fogCol, fog);
	}

	// ── 帕路奇亚所在处的光：两层空间被它捏在一起的地方 ──
	vec3 v = C3 - ro;
	float tc = max(dot(v, rd), 0.0);
	float dC = length(ro + rd * tc - C3);
	float glow = exp(-dC * dC * 0.9) * 0.55 + 0.25 / (1.0 + dC * dC * 3.0) + 0.05 / (1.0 + dC * dC * 0.2);
	// 放射的光束
	vec3 cs = transpose(R) * normalize(C3 - ro);
	vec2 cScr = cs.xy / -cs.z * uFl;
	vec2 dr = p - cScr;
	float ang = atan(dr.y, dr.x);
	float rays = pow(fbm(vec2(ang * 5.0, 0.0) + 3.0), 2.5) * 1.6 + pow(noise(vec2(ang * 22.0, 1.0)), 6.0) * 0.8;
	float rFall = exp(-length(dr) * 1.6);
	col += mix(PINK, PEARL, 0.45) * glow * 1.3;
	col += mix(PINK, LILAC, 0.5 + 0.5 * sin(ang * 2.0)) * rays * rFall * 0.22;

	// ── 裂斩的切口：白热的芯、珍珠母贝的边，缝里是另一侧的空间 ──
	float inside = halfW - abs(across);
	float tearMask = smoothstep(-0.0015, 0.0015, inside) * step(abs(along), 1.0);
	float tearOn = smoothstep(1.02, 0.8, abs(along));
	if (tearMask > 0.0) {
		// 缝里是另一侧的空间：流动的珍珠母贝光，中线白热
		float u = across / max(halfW, 1e-4);
		float flow = fbm(vec2(along * 5.0, u * 1.2) + 2.0);
		float streak = pow(fbm(vec2(along * 26.0, u * 0.6) + 9.0), 2.0);
		vec3 other = nacre(along * 1.2 + u * 0.22 + flow * 0.9) * (0.55 + 0.9 * streak);
		other = mix(other, mix(PINK, LILAC, 0.5 + 0.5 * u) * 0.5, smoothstep(0.4, 1.0, abs(u)) * 0.6);
		other += vec3(1.0, 0.97, 1.0) * exp(-u * u * 10.0) * 1.9 * lens;
		col = mix(col, other, tearMask * tearOn);
	}
	float edge = abs(abs(across) - halfW);
	// 切口两侧的色散：一边偏粉、一边偏冰青
	vec3 edgeCol = mix(vec3(0.75, 0.92, 1.0), vec3(1.0, 0.7, 0.92), step(0.0, across));
	col += edgeCol * 1.6 * exp(-edge * 700.0) * tearOn;
	col += mix(edgeCol, PINK, 0.5) * 0.35 * exp(-edge * 90.0) * tearOn;
	// 切口外的柔光：向两侧漫开的品红与淡紫
	float outside = max(abs(across) - halfW, 0.0);
	col += mix(vec3(1.0, 0.45, 0.85), LILAC, 0.45) * exp(-outside * 16.0) * lens * 0.42 * tearOn;
	col += vec3(0.85, 0.55, 1.0) * exp(-outside * 4.5) * lens * 0.12 * tearOn;
	// 两端延伸出的细裂纹
	float hairline = exp(-abs(across) * 2500.0) * smoothstep(1.6, 1.0, abs(along)) * step(1.0, abs(along));
	col += PEARL * hairline * 0.8;

	// 色调：柔和的胶片曲线 + 暗角
	col = col / (1.0 + col * 0.55);
	float lum = dot(col, vec3(0.299, 0.587, 0.114));
	col = max(mix(vec3(lum), col, 1.3), 0.0);
	// 压暗部、留亮部：深空更黑
	col = pow(col, vec3(1.08));
	vec2 vq = gl_FragCoord.xy / uRes - 0.5;
	float vig = 1.0 - dot(vq * vec2(0.9, 1.1), vq * vec2(0.9, 1.1)) * 1.25;
	col *= clamp(vig, 0.0, 1.0);
	outColor = vec4(col, 1.0);
}
`;
