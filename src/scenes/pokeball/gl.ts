import {COMMON} from '../../gl/shaders';

/**
 * 暗金档案馆的底：墨黑偏暖棕，极淡的烟状纹理，一束展柜式的暖光，可选的"桌面"地平线，
 * 以及一组细金线刻出的同心环（带刻度，缓慢转动），呼应参考片的星盘 / 命运之轮。
 * 坐标一律用 CSS 像素（y 向下）。
 * uSpot / uSpotR / uSpotAmt：暖光中心（0–1）、半径（占画面高度）、强度
 * uRingC / uRingR / uRings / uRingRot：刻度环中心（像素）、半径（像素）、不透明度、转角
 * uFloorY / uFloor：桌面地平线位置（0–1）与强度
 * uBright：整体亮度
 */
export const BACKDROP_FRAG = `${COMMON}
uniform vec2 uSpot;
uniform float uSpotR;
uniform float uSpotAmt;
uniform vec2 uRingC;
uniform float uRingR;
uniform float uRings;
uniform float uRingRot;
uniform float uFloorY;
uniform float uFloor;
uniform float uBright;

float aaLine(float d, float w) { return 1.0 - smoothstep(w * 0.5 - 0.7, w * 0.5 + 0.7, abs(d)); }

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	vec2 uv = px / uRes;
	float aspect = uRes.x / uRes.y;

	// 底色：墨黑暖棕 + 极淡的烟
	vec3 col = vec3(0.034, 0.023, 0.013);
	float smoke = fbm(vec2(uv.x * aspect, uv.y) * 2.6 + vec2(uTime * 0.012, -uTime * 0.008));
	float smoke2 = fbm(vec2(uv.x * aspect, uv.y) * 7.0 - vec2(uTime * 0.02, 0.0));
	col *= 0.78 + 0.42 * smoke + 0.12 * smoke2;

	// 展柜暖光
	vec2 d = (uv - uSpot) * vec2(aspect, 1.0);
	float spot = exp(-dot(d, d) / (uSpotR * uSpotR));
	col += vec3(0.20, 0.135, 0.065) * uSpotAmt * spot * (0.85 + 0.3 * smoke);

	// 桌面：地平线以下略亮，一条细线向两侧淡出
	float below = smoothstep(uFloorY - 0.002, uFloorY + 0.18, uv.y);
	float centerFade = 1.0 - smoothstep(0.0, 0.55, abs(uv.x - 0.5));
	col += vec3(0.045, 0.031, 0.017) * uFloor * below * centerFade;
	float horizon = aaLine((uv.y - uFloorY) * uRes.y, 1.2) * centerFade;
	col += vec3(0.55, 0.42, 0.24) * 0.22 * uFloor * horizon;

	// 刻度环
	if (uRings > 0.001) {
		vec2 rp = px - uRingC;
		float r = length(rp);
		float a = atan(rp.y, rp.x) - uRingRot;
		float ring = 0.0;
		ring += aaLine(r - uRingR, 1.3);
		ring += 0.55 * aaLine(r - uRingR * 0.84, 1.0);
		ring += 0.45 * aaLine(r - uRingR * 1.22, 1.0);
		ring += 0.3 * aaLine(r - uRingR * 1.42, 0.9);
		// 刻度：72 格，每 6 格一长刻
		float seg = a / (6.2831853 / 72.0);
		float tickPos = abs(fract(seg + 0.5) - 0.5) * (6.2831853 / 72.0) * r;
		float idx = floor(seg + 0.5);
		float longTick = step(abs(mod(idx, 6.0)), 0.5);
		float tickLen = mix(9.0, 20.0, longTick);
		float inBand = step(uRingR, r) * step(r, uRingR + tickLen);
		ring += 0.8 * aaLine(tickPos, 1.1) * inBand;
		// 外环上的小圆点
		float seg2 = a / (6.2831853 / 24.0);
		vec2 dotP = vec2(abs(fract(seg2 + 0.5) - 0.5) * (6.2831853 / 24.0) * r, r - uRingR * 1.22);
		ring += 0.9 * (1.0 - smoothstep(1.6, 3.0, length(dotP)));
		float fade = smoothstep(uRingR * 1.7, uRingR * 0.9, r);
		col += vec3(0.85, 0.66, 0.36) * 0.16 * uRings * ring * fade;
	}

	// 稀疏的金色星点
	vec2 cell = floor(px / 9.0);
	float h = hash(cell);
	if (h > 0.9965) {
		vec2 c = (cell + 0.5) * 9.0;
		float tw = 0.55 + 0.45 * sin(uTime * (0.6 + h * 2.0) + h * 40.0);
		col += vec3(1.0, 0.82, 0.55) * 0.35 * tw * (1.0 - smoothstep(0.4, 1.6, length(px - c)));
	}

	col *= uBright;
	outColor = vec4(col, 1.0);
}
`;

/**
 * 现代精灵球（代码绘制的实物）：解析求交的球体，上红下白、黑色腰带、正面按钮。
 * 物体坐标：按钮朝 +z，上半球 +y。uYaw / uPitch / uRoll 为弧度。
 * 打光：左上暖色主光 + 右下金色补光 + 漆面高光 + 菲涅尔环境反射 + 金色轮廓光（uGlow）。
 * uDim：整体压暗（0–1），uGold：把球染成金色线稿般的发光体（0–1，用于片名时的收束）。
 */
export const BALL_FRAG = `${COMMON}
uniform float uYaw;
uniform float uPitch;
uniform float uRoll;
uniform float uGlow;
uniform float uDim;
uniform float uGold;
uniform float uFade;

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0, -s, c, 0, 0, 0, 1); }

void main() {
	vec2 q = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
	float R = 0.8;
	float pxSize = 2.0 / uRes.x;
	float r = length(q);
	float alpha = 1.0 - smoothstep(R - pxSize, R + pxSize, r);
	if (alpha <= 0.0) { outColor = vec4(0.0); return; }

	vec2 s = q / R;
	vec3 n = vec3(s, sqrt(max(0.0, 1.0 - dot(s, s))));
	mat3 M = rotZ(uRoll) * rotX(uPitch) * rotY(uYaw);
	vec3 o = transpose(M) * n;

	vec3 red = vec3(0.60, 0.035, 0.025);
	vec3 white = vec3(0.80, 0.77, 0.72);
	vec3 black = vec3(0.018, 0.016, 0.015);

	float bw = 0.06;
	float edgeW = 0.012;
	vec3 base = o.y > 0.0 ? red : white;
	float gloss = 1.0;
	// 腰带
	float band = 1.0 - smoothstep(bw - edgeW * 0.5, bw + edgeW * 0.5, abs(o.y));
	base = mix(base, black, band);
	gloss = mix(gloss, 0.55, band);
	// 腰带两侧的凹槽阴影
	float groove = exp(-max(0.0, abs(o.y) - bw) / 0.02);
	base *= 1.0 - 0.45 * groove * (1.0 - band);

	// 按钮
	float ang = acos(clamp(o.z, -1.0, 1.0));
	float ringOuter = 1.0 - smoothstep(0.30, 0.31, ang);
	float button = 1.0 - smoothstep(0.195, 0.205, ang);
	base = mix(base, black, ringOuter);
	gloss = mix(gloss, 0.6, ringOuter);
	vec3 btnCol = white * (1.0 - 0.35 * (1.0 - smoothstep(0.125, 0.135, ang)) * smoothstep(0.11, 0.12, ang));
	base = mix(base, btnCol * 1.05, button);
	gloss = mix(gloss, 0.8, button);

	// 打光（视图空间，y 向上）
	vec3 V = vec3(0.0, 0.0, 1.0);
	vec3 L1 = normalize(vec3(-0.55, 0.7, 0.55));
	vec3 L2 = normalize(vec3(0.7, -0.45, 0.35));
	vec3 key = vec3(1.25, 1.02, 0.78);
	vec3 fill = vec3(0.30, 0.21, 0.11);
	float d1 = max(dot(n, L1) * 0.85 + 0.15, 0.0);
	float d2 = max(dot(n, L2), 0.0);
	vec3 H = normalize(L1 + V);
	float nh = max(dot(n, H), 0.0);
	float spec = (pow(nh, 90.0) * 1.6 + pow(nh, 14.0) * 0.12) * gloss;
	float fres = 0.04 + 0.96 * pow(1.0 - n.z, 5.0);
	vec3 Rv = reflect(-V, n);
	vec3 envCol = mix(vec3(0.015, 0.011, 0.007), vec3(0.32, 0.22, 0.11), smoothstep(-0.3, 0.9, Rv.y));
	vec3 col = base * (0.08 + d1 * key + d2 * fill) + spec * key + envCol * fres * gloss * 0.9;
	col += vec3(1.0, 0.70, 0.34) * pow(1.0 - n.z, 3.5) * uGlow;

	// 色调映射 + gamma
	col = 1.0 - exp(-col * 1.35);
	col = pow(col, vec3(1.0 / 2.2));
	col *= 1.0 - 0.75 * uDim;

	// 金色化：亮度映射到金色，边缘留一圈亮线
	float lum = dot(col, vec3(0.3, 0.55, 0.15));
	vec3 gold = vec3(1.0, 0.80, 0.46) * (0.35 + 0.9 * lum) + vec3(1.0, 0.86, 0.6) * smoothstep(R - 6.0 * pxSize, R - pxSize, r) * 0.8;
	col = mix(col, gold, uGold);

	outColor = vec4(col, alpha * uFade);
}
`;

/**
 * 成批生产的精灵球：网格上的小精灵球按"离源头的距离 + 随机"逐个出现。
 * uSrc0–2：三个源头（像素，CSS 坐标）；uProg：进度（0–1.2）；uCell：格距；uR：小球半径；uDim：整体亮度
 */
export const DOTS_FRAG = `${COMMON}
uniform vec2 uSrc0;
uniform vec2 uSrc1;
uniform vec2 uSrc2;
uniform float uProg;
uniform float uCell;
uniform float uR;
uniform float uDim;
uniform float uTopFade;

void main() {
	vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
	vec2 cell = floor(px / uCell);
	vec2 c = (cell + 0.5) * uCell;
	float h = hash(cell);
	float h2 = hash(cell + 17.3);
	// 轻微错位，避免死板的网格
	c += (vec2(h, h2) - 0.5) * uCell * 0.35;
	float d = min(length(c - uSrc0), min(length(c - uSrc1), length(c - uSrc2)));
	float th = 0.72 * d / 1400.0 + 0.28 * h;
	float vis = smoothstep(th, th + 0.04, uProg);
	vec2 q = (px - c) / uR;
	float r = length(q);
	float a = 1.0 - smoothstep(1.0 - 1.5 / uR, 1.0 + 1.5 / uR, r);
	if (a <= 0.0 || vis <= 0.0) { outColor = vec4(0.0); return; }
	vec3 top = vec3(0.78, 0.12, 0.08);
	vec3 bottom = vec3(0.86, 0.81, 0.72);
	vec3 col = q.y < 0.0 ? top : bottom;
	col = mix(col, vec3(0.05), 1.0 - smoothstep(0.1, 0.18, abs(q.y)));
	float btn = 1.0 - smoothstep(0.26, 0.32, r);
	col = mix(col, vec3(0.05), btn);
	col = mix(col, bottom, 1.0 - smoothstep(0.14, 0.19, r));
	vec2 n2 = q;
	float shade = 0.55 + 0.45 * clamp(dot(normalize(vec3(n2, sqrt(max(0.0, 1.0 - dot(n2, n2))))), normalize(vec3(-0.5, -0.6, 0.6))), 0.0, 1.0);
	col *= shade;
	float tw = 0.85 + 0.15 * sin(uTime * 2.0 + h * 30.0);
	float topMask = uTopFade > 0.0 ? smoothstep(uTopFade - 120.0, uTopFade + 60.0, c.y) : 1.0;
	float edge = 1.0 - 0.55 * smoothstep(0.35, 0.75, length((c / uRes - 0.5) * vec2(1.0, 1.3)));
	outColor = vec4(col * uDim * tw, a * vis * topMask * edge);
}
`;
