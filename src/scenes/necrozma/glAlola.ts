import {LIB} from './gl';

/**
 * 阿罗拉的两处画面：祭坛（第 7–8 段，左右对称分屏）、拉纳基拉山顶的雪夜（第 9 段）。
 */

// ─────────────────────────────────────────────────────────────────────────
// 阿罗拉的祭坛：左日轮祭坛（白昼金色）、右月轮祭坛（夜晚银紫）。
// uSplit = 0 时只画一个画面（第 8 段末的黎明）。每半边以自己的中心为画面中心。
// ─────────────────────────────────────────────────────────────────────────
export const ALTAR_FRAG =
	LIB +
	/* glsl */ `
uniform float uSplit;    // 1 = 左右分屏
uniform float uDarkL;    // 左边的光被吸走
uniform float uDarkR;    // 右边的光被吸走
uniform float uPillarL;  // 祭坛上的光柱
uniform float uPillarR;
uniform float uFlash;
uniform float uCrackLine; // 分界线裂开
uniform float uLine;     // 分界线的亮度
uniform float uDawnLight; // 黎明画面里光回来的程度

const float KSK = 0.12;  // 天空
const float KH = 0.3;    // 海平线与远山
const float KA = 0.85;   // 祭坛
const float HY = 600.0;  // 海平线（远山层 y）

// side：0 = 日轮（白昼），1 = 月轮（夜晚），2 = 黎明
vec3 altarScene(vec2 s, float side, float dark) {
	vec2 ps = toLayer(s, KSK);
	float ee = clamp((HY - ps.y) / 700.0, 0.0, 1.4);
	vec3 day = mix(vec3(1.0, 0.8, 0.5), vec3(0.36, 0.56, 0.86), smoothstep(0.0, 0.9, ee));
	day = mix(day, vec3(0.16, 0.32, 0.62), smoothstep(0.9, 1.4, ee));
	vec3 night = mix(vec3(0.3, 0.22, 0.46), vec3(0.06, 0.05, 0.16), smoothstep(0.0, 0.9, ee));
	night = mix(night, vec3(0.02, 0.02, 0.06), smoothstep(0.9, 1.4, ee));
	vec3 dawn = mix(vec3(1.0, 0.66, 0.5), vec3(0.42, 0.5, 0.78), smoothstep(0.0, 0.7, ee));
	dawn = mix(dawn, vec3(0.12, 0.18, 0.42), smoothstep(0.7, 1.4, ee));
	vec3 skyc = side < 0.5 ? day : side < 1.5 ? night : dawn;
	// 夜空的星
	if (side > 0.5 && side < 1.5) {
		vec2 g = ps / 22.0;
		vec2 id = floor(g);
		float h = hash(id);
		float d = length(fract(g) - 0.5 - (hash2(id) - 0.5) * 0.6);
		skyc += vec3(0.9, 0.92, 1.0) * step(0.86, h) * smoothstep(0.08, 0.0, d) * (0.6 + 0.4 * sin(uTime * 2.0 + h * 40.0)) * smoothstep(0.1, 0.5, ee);
	}
	// 太阳 / 月亮
	vec2 body = side < 0.5 ? vec2(1240.0, 150.0) : side < 1.5 ? vec2(700.0, 140.0) : vec2(960.0, 585.0);
	vec2 bs = toScreen(body, KSK);
	float bd = length(s - bs);
	if (side < 0.5) {
		skyc += vec3(1.0, 0.92, 0.7) * (smoothstep(62.0, 56.0, bd) * 1.2 + exp(-bd / 90.0) * 0.6 + exp(-bd / 420.0) * 0.25);
	} else if (side < 1.5) {
		float moon = smoothstep(52.0, 48.0, bd);
		float cres = smoothstep(46.0, 42.0, length(s - bs - vec2(18.0, -10.0)));
		skyc = mix(skyc, vec3(0.95, 0.92, 1.0), moon * (1.0 - cres * 0.85));
		skyc += vec3(0.7, 0.62, 1.0) * (exp(-bd / 120.0) * 0.35 + exp(-bd / 500.0) * 0.12);
	} else {
		skyc += vec3(1.0, 0.75, 0.5) * (exp(-bd / 160.0) * 0.6 + exp(-bd / 600.0) * 0.3) * uDawnLight;
	}
	// 光被吸走：从上往下变黑，日月消失
	float drain = clamp(dark * 1.35 - (1.0 - ee) * 0.35, 0.0, 1.0);
	skyc = mix(skyc, vec3(0.01, 0.01, 0.016), drain);
	vec3 col = skyc;
	// 远山（波尼岛的山脊）
	vec2 pm = toLayer(s, KH);
	float ridge = HY - 30.0 - 90.0 * fbm(vec2(pm.x * 0.0022, 2.0 + side)) - 60.0 * (sin(pm.x * 0.003 + 1.0) * 0.5 + 0.5);
	vec3 mtn = side < 0.5 ? vec3(0.3, 0.32, 0.42) : side < 1.5 ? vec3(0.07, 0.06, 0.14) : vec3(0.3, 0.24, 0.34);
	mtn = mix(mtn, vec3(0.008), dark);
	float mm = smoothstep(ridge - 1.0, ridge + 1.0, pm.y) * step(pm.y, HY);
	col = mix(col, mtn, mm);
	// 海：倒映天空，太阳 / 月亮下有一道碎光
	if (pm.y > HY) {
		float dd = (pm.y - HY) / 500.0;
		vec3 sea = mix(skyc * 0.62, skyc * 0.22, smoothstep(0.0, 1.0, dd));
		float glitter = smoothstep(0.6, 0.9, noise(vec2(pm.x * 0.05, pm.y * 0.3 - uTime * 0.6))) * exp(-pow((s.x - bs.x) / (60.0 + dd * 260.0), 2.0));
		vec3 gc = side < 0.5 ? vec3(1.0, 0.85, 0.55) : side < 1.5 ? vec3(0.8, 0.75, 1.0) : vec3(1.0, 0.78, 0.6) * uDawnLight;
		sea += gc * glitter * (1.0 - dark) * 0.9;
		col = mix(sea, vec3(0.006), dark * 0.9);
	}
	// 祭坛：前景里一圈圆形石台（透视成椭圆），刻着同心圆与日 / 月纹
	vec2 pa = toLayer(s, KA);
	vec2 ac = vec2(960.0, 905.0);
	vec2 q = (pa - ac) / vec2(640.0, 150.0);
	float r = length(q);
	vec3 stone = side < 0.5 ? vec3(0.64, 0.56, 0.46) : side < 1.5 ? vec3(0.34, 0.31, 0.44) : vec3(0.58, 0.48, 0.46);
	stone *= 0.8 + 0.25 * fbm(pa * 0.02);
	float rings = smoothstep(0.012, 0.0, abs(fract(r * 4.0) - 0.5) - 0.47) * step(r, 1.0);
	float ang = atan(q.y, q.x);
	float emb = side < 0.5
		? smoothstep(0.02, 0.0, abs(fract(ang * 12.0 / 6.2832) - 0.5) - 0.46) * step(0.28, r) * step(r, 0.5)
		: smoothstep(0.03, 0.0, abs(length(q - vec2(0.06, -0.04)) - 0.3)) * step(r, 0.4);
	vec3 top = stone * (0.85 - 0.25 * r) - (rings + emb) * 0.12;
	vec2 q2 = (pa - ac - vec2(0.0, 46.0)) / vec2(640.0, 150.0);
	float sideM = step(length(q2), 1.0) * step(1.0, r);
	vec3 face = stone * 0.4;
	float onTop = smoothstep(1.0, 0.99, r);
	vec3 alt = mix(face, top, onTop);
	float pil = side < 0.5 ? uPillarL : side < 1.5 ? uPillarR : 0.0;
	vec3 pc = side < 0.5 ? vec3(1.0, 0.86, 0.55) : vec3(0.82, 0.72, 1.0);
	alt += pc * pil * exp(-r * 2.0) * 0.6;
	if (side > 1.5) alt *= 0.55 + 0.45 * uDawnLight;
	alt = mix(alt, alt * 0.06, dark);
	float am = side > 1.5 ? 0.0 : max(onTop, sideM);
	col = mix(col, alt, am);
	// 前景：祭坛下方的山岩
	col = mix(col, vec3(0.01, 0.008, 0.012), smoothstep(1040.0, 1120.0, pa.y) * (1.0 - am));
	// 光柱
	if (pil > 0.001) {
		float dx = abs(pa.x - 960.0);
		float up = smoothstep(915.0, 880.0, pa.y);
		float beam = exp(-pow(dx / 70.0, 2.0)) * 1.3 + exp(-dx / 260.0) * 0.4;
		col += pc * beam * up * pil;
	}
	return col;
}

void main() {
	vec2 s = screenPos();
	vec3 col;
	if (uSplit > 0.5) {
		float right = step(960.0, s.x);
		// 每半边以自己的中心为画面中心
		vec2 ls = vec2(s.x + (right > 0.5 ? -480.0 : 480.0), s.y);
		col = altarScene(ls, right, right > 0.5 ? uDarkR : uDarkL);
		// 分界线：一道细细的棱镜光
		float jag = uCrackLine * 22.0 * (fbm(vec2(s.y * 0.02, uTime * 3.0)) - 0.5);
		float d = abs(s.x - 960.0 - jag);
		vec3 fr = vec3(0.0);
		for (int i = 0; i < 5; i++) fr += hue(float(i) / 6.0) * exp(-pow((d - float(i) * 1.6) / 1.4, 2.0));
		col = col * (1.0 - 0.7 * smoothstep(3.0, 0.0, d) * uLine) + (vec3(1.0) * exp(-d / 1.6) + fr * 0.5 + vec3(0.8, 0.85, 1.0) * exp(-d / 30.0) * 0.25 * (1.0 + 3.0 * uCrackLine)) * uLine;
	} else {
		col = altarScene(s, 2.0, 0.0);
	}
	col += vec3(1.0, 0.98, 0.95) * uFlash;
	outColor = vec4(col, 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────
// 拉纳基拉山顶的雪夜（第 9 段）
// ─────────────────────────────────────────────────────────────────────────
export const SNOW_FRAG =
	LIB +
	/* glsl */ `
uniform vec4 uCrater;    // 雪坑中心（地面层 xy）、半宽、半高
uniform float uGlow;     // 金银两道光落进雪坑
uniform float uDawnMix;  // 天空从黎明过渡到夜（第 8→9 段）

const float KSK = 0.12;
const float KC = 0.35;   // 云海
const float KG = 0.85;   // 山顶雪地

vec3 nightSky(vec2 s) {
	vec2 p = toLayer(s, KSK);
	float ee = clamp((640.0 - p.y) / 800.0, 0.0, 1.3);
	vec3 col = mix(vec3(0.07, 0.1, 0.2), vec3(0.01, 0.015, 0.04), smoothstep(0.0, 1.0, ee));
	vec3 dawn = mix(vec3(0.42, 0.5, 0.78), vec3(0.12, 0.18, 0.42), smoothstep(0.0, 1.2, ee));
	col = mix(col, dawn, uDawnMix);
	float starO = 1.0 - uDawnMix;
	for (int i = 0; i < 3; i++) {
		float fi = float(i);
		float cell = 12.0 + fi * 14.0;
		vec2 g = p / cell + fi * 17.3;
		vec2 id = floor(g);
		float h = hash(id * 1.31 + fi);
		float on = step(0.78 - fi * 0.04, h);
		float d = length((fract(g) - 0.5 - (hash2(id) - 0.5) * 0.7) * cell);
		float tw = 0.6 + 0.4 * sin(uTime * (1.2 + h * 2.5) + h * 40.0);
		float rr = 0.7 + fi * 0.5 + h * 0.6;
		col += on * (smoothstep(rr, 0.0, d) + exp(-d / (rr * 3.0)) * 0.2 * fi) * tw * mix(vec3(0.75, 0.84, 1.0), vec3(1.0, 0.9, 0.78), hash(id + 3.0)) * 0.9 * starO;
	}
	// 银河
	vec2 q = rotv(p - vec2(1100.0, 100.0), -0.7);
	float band = exp(-pow(q.y / 220.0, 2.0));
	col += vec3(0.36, 0.4, 0.62) * band * smoothstep(0.35, 0.85, fbm(q * 0.004 + 2.0)) * 0.3 * starO;
	return col;
}

void main() {
	vec2 s = screenPos();
	vec3 col = nightSky(s);
	// 云海：月光下的银白云层
	vec2 pc = toLayer(s, KC);
	float cloudTop = 700.0 + 20.0 * sin(pc.x * 0.004 + uTime * 0.05);
	if (pc.y > cloudTop) {
		float n = fbm(vec2(pc.x * 0.003 + uTime * 0.01, pc.y * 0.01));
		vec3 cl = mix(vec3(0.2, 0.24, 0.36), vec3(0.46, 0.52, 0.68), n) * (0.8 + 0.2 * smoothstep(cloudTop + 60.0, cloudTop, pc.y));
		col = mix(col, cl, smoothstep(cloudTop, cloudTop + 30.0, pc.y));
	}
	// 山顶雪地：起伏的雪坡，中间一个雪坑
	vec2 pg = toLayer(s, KG);
	float ground = 760.0 - 70.0 * exp(-pow((pg.x - 300.0) / 380.0, 2.0)) - 40.0 * exp(-pow((pg.x - 1650.0) / 300.0, 2.0)) + 14.0 * fbm(vec2(pg.x * 0.01, 1.0));
	if (pg.y > ground - 2.0) {
		vec2 cq = (pg - uCrater.xy) / uCrater.zw;
		float cr = length(cq);
		float depth = smoothstep(1.0, 0.0, cr);
		float sn = fbm(pg * vec2(0.01, 0.04));
		vec3 snow = vec3(0.6, 0.68, 0.84) * (0.75 + 0.25 * sn);
		float wall = smoothstep(0.7, 1.0, cr) * step(cr, 1.05) * step(cq.y, 0.0);
		snow *= 1.0 - 0.55 * depth;
		snow += vec3(0.5, 0.56, 0.7) * wall * 0.35;
		snow += vec3(0.7, 0.78, 0.95) * exp(-pow((cr - 1.0) / 0.05, 2.0)) * 0.12 * step(cq.y, 0.0);
		snow += vec3(0.9, 0.95, 1.0) * step(0.985, hash(floor(pg * 0.5))) * (0.5 + 0.5 * sin(uTime * 3.0 + hash(floor(pg)) * 30.0)) * 0.6;
		snow += vec3(1.0, 0.9, 0.75) * uGlow * exp(-cr * 1.4) * 0.35;
		snow *= 1.0 - 0.45 * smoothstep(900.0, 1150.0, pg.y);
		col = mix(col, snow, smoothstep(ground - 1.0, ground + 1.5, pg.y));
	}
	outColor = vec4(col, 1.0);
}
`;
