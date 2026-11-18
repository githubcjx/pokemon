import {INK_LIB} from './ink';

/**
 * 水墨大火（《烧焦塔的大火》第 3 段）：透明叠层，画在 3D 塔之上，屏幕空间坐标（1920×1080，y 向下）。
 * uTower: (塔中心 x, 塔顶 y, 塔基 y)；uTowerW: 塔基半宽；uHwTop: 塔顶半宽。
 * uFire: 火势；uFront: 从塔顶往下烧到的比例（0–1）；uSmoke: 烟；uStorm: 压顶的墨色雷云；uSteam: 雨中腾起的水汽。
 * uL0–uL2: 火中三点微光 (x, y, 亮度)；uLightR: 微光半径（px）。
 */
export const INK_BLAZE_FRAG = `${INK_LIB}
uniform vec3 uTower;
uniform float uTowerW;
uniform float uHwTop;
uniform float uFire;
uniform float uFront;
uniform float uSmoke;
uniform float uStorm;
uniform float uSteam;
uniform vec3 uL0;
uniform vec3 uL1;
uniform vec3 uL2;
uniform float uLightR;
uniform vec2 uTiers;   // (第一层屋檐的高度比例, 相邻屋檐的间距比例)

// 直通 alpha 的叠加（下层 acc 在下，c 盖在上面）
vec4 over(vec4 acc, vec3 c, float a) {
	a = clamp(a, 0.0, 1.0);
	float oa = a + acc.a * (1.0 - a);
	vec3 oc = oa > 1e-4 ? (c * a + acc.rgb * acc.a * (1.0 - a)) / oa : vec3(0.0);
	return vec4(oc, oa);
}

float glowAt(vec2 p, vec3 L) {
	float d = length(p - L.xy);
	return L.z * exp(-d * d / (uLightR * uLightR));
}

void main() {
	vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(1920.0, 1080.0);
	vec4 acc = vec4(0.0);

	// ─── 压顶的墨色雷云：只在画面上半部，半透明 ───
	float sky = 1.0 - p.y / 1080.0;
	vec2 cq = p * 0.0021 + vec2(uTime * 0.045, uTime * 0.012);
	float c = fbm4(cq) + 0.38 * fbm4(cq * 2.4 + 5.0);
	float cloud = uStorm * smoothstep(0.55, 0.95, c * 0.9) * smoothstep(0.42, 0.85, sky);
	vec3 cloudCol = mix(vec3(0.3, 0.275, 0.25), vec3(0.1, 0.09, 0.08), smoothstep(0.75, 1.1, c + sky * 0.25));
	acc = over(acc, cloudCol, cloud * 0.8);

	float H = uTower.z - uTower.y;
	float t = (uTower.z - p.y) / H;           // 0 = 塔基，1 = 塔顶
	float hw = mix(uTowerW, uHwTop, clamp(t, 0.0, 1.0));
	float dx = p.x - uTower.x;
	float ax = abs(dx) / hw;

	// ─── 浓墨烟柱：从塔顶往上翻卷，越高越宽、被风吹向右 ───
	float rise = (uTower.y - p.y) / H;
	float sw = uHwTop * 1.1 + max(rise, 0.0) * H * 0.4;
	float sdx = dx - max(rise, 0.0) * H * 0.45;
	float sn = fbm4(vec2(sdx / sw * 1.3 + uTime * 0.04, p.y * 0.0045 + uTime * 0.32));
	float sn2 = fbm4(vec2(sdx * 0.006 - uTime * 0.03, p.y * 0.009 + uTime * 0.5) + 7.0);
	float smoke = smoothstep(1.0, 0.2, abs(sdx) / sw + (sn - 0.5) * 1.1) * smoothstep(-0.15, 0.12, rise);
	smoke *= smoothstep(2.0, 0.6, rise) * smoothstep(0.35, 0.75, sn2 + 0.15);
	vec3 smokeCol = mix(vec3(0.1, 0.085, 0.075), vec3(0.36, 0.33, 0.3), smoothstep(0.0, 1.5, rise));
	acc = over(acc, smokeCol, uSmoke * smoke * 0.7);

	// ─── 火舌：从各层屋檐的边缘与门窗里窜出，朱砂与赭石的晕染，塔身剪影透得出来 ───
	float burnFrom = 1.0 - uFront;
	float n = fbm4(vec2(dx * 0.013, p.y * 0.008 + uTime * 1.6));
	float n2 = fbm4(vec2(dx * 0.03 + 3.0, p.y * 0.016 + uTime * 2.6));
	float band = smoothstep(burnFrom - 0.05, burnFrom + 0.05, t + (n2 - 0.5) * 0.08);
	float base = smoothstep(-0.04, 0.05, t);
	float tongue = smoothstep(1.25, 1.0, t + (n - 0.5) * 0.3);
	// 每一层屋檐：火从檐口往上舔、往外飘，到上一层檐下渐弱
	float phase = (t - uTiers.x) / uTiers.y;
	float fr = fract(phase);
	float eave = exp(-fr * 1.5) * smoothstep(-0.4, 0.0, phase);
	float lean = (n - 0.5) * 0.7 + fr * 0.25;                    // 风把焰尖吹向外
	float rim = smoothstep(1.75, 0.85, ax - lean) * smoothstep(0.2, 0.7, ax);
	// 门窗里透出的火：每层塔身中间
	float win = smoothstep(0.5, 0.0, ax) * smoothstep(0.5, 0.85, fbm4(vec2(dx * 0.02, p.y * 0.03 - uTime * 0.8))) * smoothstep(0.15, 0.6, fr);
	// 塔顶上方的火冠
	float crown = smoothstep(1.3, 0.45, ax + (n - 0.5) * 0.9) * smoothstep(0.9, 1.02, t) * smoothstep(1.32, 1.05, t + (n - 0.5) * 0.35);
	float f = uFire * base * (band * tongue * (eave * rim * (0.65 + 1.0 * n2) + win * 0.55) + crown * 1.05 * (0.5 + 0.8 * n2));
	vec3 fireCol = mix(vec3(0.5, 0.13, 0.06), vec3(0.8, 0.27, 0.1), smoothstep(0.1, 0.4, f));
	fireCol = mix(fireCol, vec3(0.95, 0.55, 0.2), smoothstep(0.45, 0.85, f));
	fireCol = mix(fireCol, vec3(1.0, 0.82, 0.5), smoothstep(0.9, 1.15, f));
	float halo = uFire * smoothstep(1.8, 0.4, ax) * band * smoothstep(1.4, 0.9, t) * base;
	acc = over(acc, vec3(1.0, 0.48, 0.18), halo * 0.14);
	acc = over(acc, fireCol, smoothstep(0.08, 0.55, f) * 0.92);

	// ─── 火中的三点微光（三只无名的宝可梦） ───
	float g = glowAt(p, uL0) + glowAt(p, uL1) + glowAt(p, uL2);
	acc = over(acc, vec3(1.0, 0.96, 0.84), clamp(g, 0.0, 1.0));

	// ─── 雨中的水汽：塔身周围翻起的白雾 ───
	float st = fbm4(vec2(dx * 0.004 + uTime * 0.05, p.y * 0.006 + uTime * 0.45) + 11.0);
	float steamMask = smoothstep(2.4, 0.6, ax) * smoothstep(-0.1, 0.3, t) * smoothstep(1.6, 0.9, t);
	acc = over(acc, vec3(0.86, 0.83, 0.77), uSteam * steamMask * smoothstep(0.35, 0.75, st) * 0.85);

	outColor = acc;
}
`;
