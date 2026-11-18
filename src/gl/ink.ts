import {COMMON} from './shaders';

/**
 * 古纸水墨（第 3 期）：泛黄古宣纸 + 墨滴入水晕染 + 水波 + 泥金箔 + 墨潮。
 *
 * 摄像机在着色器里换算（不用 CSS 缩放画布），镜头推近时纸纹仍然清晰，也不需要 overscan。
 * uCam: (x, y, zoom)，uRoll: 侧倾（度），uK: 景深系数，与 camera.ts 的 layerStyle 一致。
 * 下面的坐标（墨滴、墨潮中心）都是该景深层上的 1920×1080 坐标。
 * uDropN: (x, y, 落下时刻·秒)；uDropSize: 三滴墨各自的最终半径（px，0 = 不启用）
 * uFloodC: 墨潮 (x, y, 半径 px)，半径为 0 时不启用
 * uClearC: 墨退 (x, y, 半径 px)：墨潮从这里向外退开、露出纸面（开场用），半径为 0 时不启用
 * uGold: 金箔强度；uRipple: 水波强度；uLight: 金箔反光的相位（随镜头变化即可）
 */
/** 水墨着色器的公共部分：镜头换算、古宣纸、墨潮 / 墨退、泥金 */
export const INK_LIB = `${COMMON}
uniform vec3 uCam;
uniform float uRoll;
uniform vec3 uFloodC;
uniform vec3 uClearC;
uniform float uGold;
uniform float uLight;
uniform float uBright;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

float fbm4(vec2 p) {
	float v = 0.0, a = 0.5;
	mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
	for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
	return v;
}

// 屏幕坐标（CSS 像素）→ 景深层 k 上的坐标，等同 camera.ts 的 unproject
vec2 toLayer(vec2 p, float k) {
	vec2 C = vec2(960.0, 540.0);
	float s = 1.0 + (uCam.z - 1.0) * k;
	float a = -uRoll * 3.14159265 / 180.0;
	vec2 d = p - C;
	vec2 r = vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a));
	return r / s + (uCam.xy - C) * k + C;
}

// ─── 古宣纸 ───────────────────────────────────────────
vec3 paper(vec2 q) {
	float lo = fbm4(q * 1.3 + 11.0);
	vec3 col = mix(vec3(0.76, 0.645, 0.46), vec3(0.88, 0.80, 0.635), smoothstep(0.28, 0.75, lo));
	// 霉斑与水渍，水渍边缘有一圈略深的痕
	float st = fbm(q * 2.2 + 31.0);
	col = mix(col, col * vec3(0.88, 0.80, 0.66), smoothstep(0.5, 0.8, st) * 0.4);
	// 三个方向的长纤维
	float fib = 0.0;
	for (int i = 0; i < 3; i++) {
		vec2 r = rot(float(i) * 2.1 + 0.4) * q;
		float n = noise(vec2(r.x * 12.0, r.y * 300.0) + float(i) * 17.0);
		fib += smoothstep(0.78, 0.96, n) * (0.4 + 0.6 * noise(r * 9.0 + float(i)));
	}
	col = mix(col, col * 1.06 + 0.012, clamp(fib, 0.0, 1.0) * 0.32);
	// 细小的杂质黑点
	col *= 1.0 - step(0.9993, hash(floor(q * 700.0))) * 0.4;
	// 纸面的细微起伏（频率与幅度都压低：镜头移动时逐像素的细纹最耗码率）
	col *= 0.985 + 0.03 * noise(q * 420.0);
	return col;
}

// ─── 墨滴入水 ─────────────────────────────────────────
float inkDrop(vec2 q, vec3 drop, float size, float seed) {
	float tau = uTime - drop.z;
	if (tau <= 0.0 || size <= 0.0) return 0.0;
	vec2 c = drop.xy / 1080.0;
	float S = size / 1080.0;
	vec2 d = q - c;
	float g = 1.0 - exp(-tau / 0.9);           // 先快后慢地化开
	float R = S * (0.1 + 0.9 * g + 0.035 * tau);  // 之后仍缓缓洇开
	// 水流的回旋
	float r0 = length(d);
	d = rot(0.55 * g * exp(-r0 / (S * 1.2)) + 0.04 * tau) * d;
	// 域扭曲 → 墨丝
	vec2 w = vec2(
		fbm4(d / S * 1.4 + seed + vec2(0.0, uTime * 0.11)),
		fbm4(d / S * 1.4 + seed + 5.7 - vec2(uTime * 0.09, 0.0))
	) - 0.5;
	d += w * S * (0.15 + 0.55 * g);
	float r = length(d);
	// 参差的边缘（用方向向量取噪声，避免角度接缝）
	float fing = fbm4(normalize(d + 1e-5) * 2.2 + seed * 3.0 + r / S * 1.0);
	float dn = r / R * (0.74 + 0.56 * fing);
	float body = smoothstep(1.05, 0.72, dn);
	float rim = smoothstep(0.62, 0.98, dn) * smoothstep(1.06, 0.95, dn);   // 积墨的湿边
	// 墨在水中翻卷的云团：低频噪声决定浓淡，随时间缓慢流动
	float cloud = fbm4(d / S * 1.6 + seed * 2.3 + vec2(uTime * 0.09, -uTime * 0.07));
	float core = exp(-dn * dn * 2.5);
	float dens = body * (0.16 + 0.62 * smoothstep(0.32, 0.78, cloud) + 0.32 * core * (1.0 - 0.6 * g)) + rim * 0.3;
	// 脊状噪声 → 贴着墨团边缘伸出的细墨丝
	float vn = 1.0 - abs(2.0 * fbm4(d / S * 2.6 + seed * 1.7 + uTime * 0.03) - 1.0);
	vn = pow(vn, 16.0);
	dens += vn * smoothstep(1.3, 0.92, dn) * (1.0 - body * 0.6) * 0.3 * g;
	dens *= mix(1.0, 0.85, smoothstep(0.0, 8.0, tau));
	// 落下瞬间溅出的墨点
	for (int j = 0; j < 4; j++) {
		float fj = float(j);
		float h1 = hash(vec2(seed * 7.1, fj + 0.5));
		float h2 = hash(vec2(fj * 3.3, seed + 3.1));
		float h3 = hash(vec2(seed + fj, 9.7));
		float an = h1 * 6.2831;
		vec2 pc = c + vec2(cos(an), sin(an)) * S * (0.4 + 0.8 * h2) * (0.55 + 0.45 * smoothstep(0.0, 0.2, tau));
		float rad = S * (0.008 + 0.018 * h3) * (1.0 + 0.7 * g);
		float dd = length(q - pc) / rad * (0.8 + 0.4 * noise((q - pc) / rad * 2.0 + fj));
		dens = max(dens, smoothstep(1.0, 0.65, dd) * (0.55 + 0.25 * h3));
	}
	return clamp(dens, 0.0, 1.0);
}

// 落墨时的水波：返回纸面的折射位移，sheen 累加水面高光
vec2 ripple(vec2 q, vec3 drop, float size, inout float sheen) {
	float tau = uTime - drop.z;
	if (tau <= 0.0 || size <= 0.0) return vec2(0.0);
	vec2 d = q - drop.xy / 1080.0;
	float r = length(d);
	vec2 disp = vec2(0.0);
	for (int i = 0; i < 3; i++) {
		float t = tau - float(i) * 0.16;
		if (t <= 0.0) continue;
		float x = r - t * 0.42;
		float env = exp(-t * 1.5) * exp(-x * x / 0.0012) * (1.0 - float(i) * 0.25);
		float wave = sin(x * 210.0) * env;
		disp += d / max(r, 1e-4) * wave * 0.0045;
		sheen += max(wave, 0.0) * env;
	}
	return disp;
}

// ─── 墨潮：大片浓墨漫过画面（段落转场）──────────────
// 参差边界的圆形区域：C = (x, y, 半径 px)，seed 区分不同的边界形状
float tide(vec2 q, vec3 C, float seed) {
	vec2 d = q - C.xy / 1080.0;
	float R = C.z / 1080.0;
	vec2 w = vec2(fbm4(q * 2.0 + seed + uTime * 0.1), fbm4(q * 2.0 + seed + 4.3 - uTime * 0.08)) - 0.5;
	d += w * 0.22;
	float fing = fbm4(normalize(d + 1e-5) * 3.0 + length(d) * 2.5 + seed - uTime * 0.15);
	float dn = length(d) / R * (0.78 + 0.5 * fing);
	return smoothstep(1.0, 0.84, dn);
}
float flood(vec2 q) {
	if (uFloodC.z <= 0.0) return 0.0;
	float body = tide(q, uFloodC, 0.0);
	vec2 d = q - uFloodC.xy / 1080.0;
	float dn = length(d) / (uFloodC.z / 1080.0);
	float vn = pow(1.0 - abs(2.0 * fbm4(q * 5.0 + uTime * 0.05) - 1.0), 12.0);
	float f = clamp(body * (0.9 + 0.1 * fbm4(q * 6.0)) + vn * smoothstep(1.4, 0.95, dn) * 0.5 * (1.0 - body), 0.0, 1.0);
	// 墨退：从 uClearC 向外让出纸面，退开的边缘是一圈柔和的淡墨，留下几缕墨丝
	if (uClearC.z > 0.0) {
		vec2 dc = q - uClearC.xy / 1080.0;
		vec2 wc = vec2(fbm4(q * 1.6 + 23.0 + uTime * 0.08), fbm4(q * 1.6 + 29.0 - uTime * 0.07)) - 0.5;
		dc += wc * 0.25;
		float lobes = fbm4(normalize(dc + 1e-5) * 1.6 + 31.0 + uTime * 0.05);
		float dn = length(dc) / (uClearC.z / 1080.0) * (0.75 + 0.5 * lobes);
		float hole = smoothstep(1.0, 0.55, dn);
		float wisp = pow(1.0 - abs(2.0 * fbm4(q * 4.0 + 37.0 + uTime * 0.06) - 1.0), 10.0);
		f *= 1.0 - hole * (1.0 - wisp * 0.6 * smoothstep(0.2, 0.9, dn));
	}
	return f;
}

// ─── 泥金：洒金箔与金粉 ───────────────────────────────
vec3 gold(vec2 q, vec3 col, float dens) {
	vec2 g = q * 15.0;
	vec2 id = floor(g);
	vec2 f = fract(g);
	float cover = 0.0;
	vec3 gc = vec3(0.0);
	for (int j = -1; j <= 1; j++)
	for (int i = -1; i <= 1; i++) {
		vec2 o = vec2(float(i), float(j));
		vec2 cid = id + o;
		if (hash(cid * 1.7 + 0.3) > 0.08) continue;
		vec2 pt = o + vec2(hash(cid + 2.1), hash(cid + 7.7)) - f;
		float sz = 0.06 + 0.2 * hash(cid + 5.3);
		vec2 pr = rot(hash(cid + 9.1) * 6.28) * pt;
		pr.x *= 0.65 + 0.7 * hash(cid + 1.9);
		float sh = length(pr) / sz + (noise(pr / sz * 3.0 + cid) - 0.5) * 1.0;
		float m = smoothstep(1.0, 0.86, sh);
		// 金箔的折痕在光下明暗起伏
		float crinkle = noise(pr / sz * 6.0 + cid * 3.0);
		float glint = pow(0.5 + 0.5 * sin(hash(cid + 4.4) * 40.0 + crinkle * 5.0 + uLight * 2.2), 6.0);
		vec3 c = mix(vec3(0.55, 0.38, 0.13), vec3(1.0, 0.9, 0.62), 0.15 + 0.85 * glint) * (0.8 + 0.4 * crinkle);
		gc = mix(gc, c, m);
		cover = max(cover, m);
	}
	col = mix(col, gc * mix(1.0, 0.6, dens), cover * uGold);
	// 金粉：散落纸面，入墨处更密，像泥金调进了墨里
	vec2 qd = q + 0.02 * vec2(fbm4(q * 3.0 + uTime * 0.05), fbm4(q * 3.0 - uTime * 0.04));
	vec2 gq = qd * 230.0;
	vec2 cell = floor(gq);
	float th = mix(0.994, 0.975, smoothstep(0.25, 0.8, dens));
	vec2 off = vec2(hash(cell + 1.3), hash(cell + 8.1)) * 0.6 + 0.2;
	float dust = step(th, hash(cell)) * smoothstep(0.24, 0.08, length(fract(gq) - off));
	float tw = 0.5 + 0.5 * sin(hash(cell + 3.0) * 30.0 + uTime * 1.2 + uLight);
	col = mix(col, vec3(1.0, 0.84, 0.5), dust * (0.35 + 0.65 * tw) * uGold * 0.85);
	return col;
}

`;

export const INK_PAPER_FRAG = `${INK_LIB}
uniform float uK;
uniform vec3 uDrop0;
uniform vec3 uDrop1;
uniform vec3 uDrop2;
uniform vec3 uDropSize;
uniform float uRipple;

void main() {
	vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(1920.0, 1080.0);
	vec2 q = toLayer(p, uK) / 1080.0;

	float sheen = 0.0;
	vec2 disp = ripple(q, uDrop0, uDropSize.x, sheen)
		+ ripple(q, uDrop1, uDropSize.y, sheen)
		+ ripple(q, uDrop2, uDropSize.z, sheen);
	q += disp * uRipple;

	vec3 col = paper(q);

	float d0 = inkDrop(q, uDrop0, uDropSize.x, 1.3);
	float d1 = inkDrop(q, uDrop1, uDropSize.y, 4.7);
	float d2 = inkDrop(q, uDrop2, uDropSize.z, 8.2);
	float dens = 1.0 - (1.0 - d0) * (1.0 - d1) * (1.0 - d2);
	// 墨色颗粒（颜料沉淀在纸纹里）
	dens *= 0.9 + 0.2 * fbm4(q * 40.0);
	dens = 1.0 - (1.0 - dens) * (1.0 - flood(q));
	dens = clamp(dens, 0.0, 1.0);

	// 淡墨是透明的灰褐，浓墨是暖黑
	col *= mix(vec3(1.0), vec3(0.5, 0.47, 0.44), clamp(dens * 1.7, 0.0, 1.0));
	col = mix(col, vec3(0.045, 0.036, 0.03), smoothstep(0.4, 0.95, dens));

	col = gold(q, col, dens);
	col += vec3(1.0, 0.96, 0.88) * sheen * uRipple * 0.12;
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 水墨远山（第 3 期第 2 段）：古纸上的四层山峦（各自的景深系数，镜头移动时有视差），
 * 山脊浓、山脚淡入云雾，近山遮住远山处留白成雾；云带缓缓横移；泥金日轮。
 * uSun: 日轮 (x, y, 半径 px)，在最远层（k = 0.12）上；uMist: 云雾强度；
 * 墨潮 uFloodC / uClearC 的坐标在主体层（k = 1）上。
 */
export const INK_MOUNTAIN_FRAG = `${INK_LIB}
uniform vec3 uSun;
uniform float uMist;

const vec3 MIST = vec3(0.86, 0.79, 0.64);

// 山脊高度（0–1）：圆缓的主峰 + 脊状噪声的峰尖
float ridge(float x, float seed) {
	// 圆缓的山势：低频起伏为主，只带一点峰尖
	float h = smoothstep(0.2, 0.85, fbm4(vec2(x + seed, seed * 3.1)));
	h += 0.12 * pow(1.0 - abs(2.0 * noise(vec2(x * 2.0 + seed * 1.7, seed)) - 1.0), 3.0);
	return h;
}

// 一层山：返回墨的浓度，occ 返回该处是否在山体内（用来遮住更远的山）
float mountain(vec2 L, float base, float amp, float freq, float fade, float seed, out float occ) {
	float yr = base - amp * ridge(L.x * freq, seed);
	float dy = L.y - yr;
	occ = smoothstep(0.0, 3.0, dy);
	// 山脊处最浓，向下逐渐淡入云雾；披麻皴似的竖向笔触
	float body = occ * exp(-max(dy, 0.0) / fade);
	float cun = fbm4(vec2(L.x * 0.01, L.y * 0.016) + seed * 5.0);
	float strokes = 0.8 + 0.4 * smoothstep(0.3, 0.8, cun);
	float edge = occ * exp(-max(dy, 0.0) / 7.0) * 0.35;  // 山脊的墨线
	return clamp(body * strokes + edge, 0.0, 1.0);
}

void main() {
	vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(1920.0, 1080.0);

	vec3 col = paper(toLayer(p, 0.5) / 1080.0);
	// 天空上部略亮，像晨光
	col = mix(col, col * 1.06 + 0.02, smoothstep(0.7, 0.0, p.y / 1080.0) * 0.5);

	// 泥金日轮（最远层）
	vec2 Ls = toLayer(p, 0.12);
	float ds = length(Ls - uSun.xy);
	float disc = smoothstep(uSun.z, uSun.z - 2.5, ds);
	float leaf = noise(Ls * 0.05) * 0.6 + noise(Ls * 0.17) * 0.4;
	vec3 sunC = mix(vec3(0.72, 0.52, 0.2), vec3(1.0, 0.88, 0.6), smoothstep(0.3, 0.8, leaf + 0.15 * sin(uLight)));
	col += vec3(1.0, 0.8, 0.45) * exp(-pow(max(ds - uSun.z, 0.0) / (uSun.z * 1.4), 2.0)) * 0.16 * uGold;
	col = mix(col, sunC, disc * uGold);

	// 四层山，从远到近；近山的山体遮住远山（留白成雾），再染上自己的墨
	float ks[4] = float[4](0.25, 0.42, 0.62, 0.85);
	float bases[4] = float[4](690.0, 760.0, 860.0, 990.0);
	float amps[4] = float[4](260.0, 300.0, 330.0, 360.0);
	float freqs[4] = float[4](0.0011, 0.0014, 0.0018, 0.0022);
	float fades[4] = float[4](55.0, 70.0, 85.0, 100.0);
	vec3 inks[4] = vec3[4](vec3(0.6, 0.58, 0.55), vec3(0.42, 0.4, 0.37), vec3(0.24, 0.22, 0.2), vec3(0.08, 0.065, 0.055));
	float strength[4] = float[4](0.55, 0.7, 0.85, 0.95);
	for (int i = 0; i < 4; i++) {
		vec2 L = toLayer(p, ks[i]);
		float occ;
		float d = mountain(L, bases[i], amps[i], freqs[i], fades[i], float(i) * 7.3 + 1.0, occ);
		col = mix(col, MIST * (0.97 + 0.05 * noise(L * 0.02)), occ * 0.94);
		col = mix(col, inks[i], d * strength[i]);
		// 层与层之间的云带，随时间横移（远处慢、近处快）
		float band = fbm4(vec2(L.x * 0.0016 - uTime * 0.012 * (0.5 + ks[i]), L.y * 0.006 + float(i) * 3.0));
		float zone = exp(-pow((L.y - bases[i] + amps[i] * 0.15) / 120.0, 2.0));
		col = mix(col, MIST, smoothstep(0.42, 0.72, band) * zone * uMist * 0.85);
	}

	// 洒金（少量）
	vec2 q1 = toLayer(p, 1.0) / 1080.0;
	col = gold(toLayer(p, 0.5) / 1080.0, col, 0.0);

	// 墨潮（段落转场）
	float fl = flood(q1);
	col = mix(col, vec3(0.045, 0.036, 0.03), smoothstep(0.4, 0.95, fl));
	col = mix(col, gold(q1 * 1.3 + 3.0, col, fl), smoothstep(0.3, 0.8, fl));   // 浓墨里的金粉
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 摊开的研究日记（第 3 期第 3 段）：俯视的双页，泛黄纸面、淡横格、中缝阴影、页角焦痕，书外是深色墨地。
 * 书在主体层（k = 1）上，范围见 BOOK。uDrop0 / uDropSize：落在纸上的墨渍；uBurn：页角焦痕的程度。
 */
export const INK_DIARY_FRAG = `${INK_LIB}
uniform vec3 uDrop0;
uniform float uDropSize;
uniform float uBurn;

const vec4 BOOK = vec4(140.0, 70.0, 1780.0, 1010.0);

void main() {
	vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(1920.0, 1080.0);
	vec2 L = toLayer(p, 1.0);
	vec2 q = L / 1080.0;

	// 书外：深色的墨地
	vec3 desk = vec3(0.07, 0.055, 0.045) * (0.75 + 0.5 * fbm4(q * 2.5 + 3.0));

	// 书页下面露出的书页侧边（一叠纸的细线）
	vec4 stack = BOOK + vec4(-8.0, -4.0, 8.0, 14.0);
	vec2 cs = clamp(L, stack.xy, stack.zw);
	float inStack = 1.0 - smoothstep(0.0, 1.5, length(L - cs));
	vec3 stackC = vec3(0.62, 0.53, 0.39) * (0.85 + 0.15 * sin(L.y * 1.9) * sin(L.x * 1.3));

	vec2 cb = clamp(L, BOOK.xy, BOOK.zw);
	float dOut = length(L - cb);
	float inside = 1.0 - smoothstep(0.0, 1.5, dOut);

	vec3 pg = paper(q * 1.3 + 5.0) * vec3(1.06, 1.05, 1.04);
	float gx = abs(L.x - 960.0);
	// 中缝阴影与纸页的弧度
	pg *= 1.0 - 0.38 * exp(-gx / 34.0) - 0.1 * exp(-gx / 170.0);
	pg *= 0.95 + 0.07 * smoothstep(0.0, 260.0, gx) * smoothstep(820.0, 420.0, gx);
	float edgeDist = min(min(L.x - BOOK.x, BOOK.z - L.x), min(L.y - BOOK.y, BOOK.w - L.y));
	pg *= 0.86 + 0.14 * smoothstep(0.0, 70.0, edgeDist);
	// 淡横格
	float ly = mod(L.y - 187.0, 66.0);
	float rule = smoothstep(1.3, 0.0, abs(ly - 33.0)) * step(200.0, L.y) * step(L.y, 960.0) * step(70.0, gx) * step(gx, 770.0);
	pg = mix(pg, pg * vec3(0.74, 0.7, 0.64), rule * 0.4 * (0.7 + 0.6 * noise(L * 0.03)));

	// 页角焦痕：烧焦、发褐，最外角烧缺
	float dc = min(min(length(L - BOOK.xy), length(L - BOOK.zy)), min(length(L - BOOK.xw), length(L - BOOK.zw)));
	float br = 240.0 * uBurn * (0.65 + 0.7 * fbm4(q * 5.0 + 9.0));
	float scorch = smoothstep(br, br * 0.4, dc);
	pg = mix(pg, pg * vec3(0.6, 0.4, 0.22), scorch * 0.85);
	pg = mix(pg, vec3(0.1, 0.06, 0.035), smoothstep(0.55, 0.95, scorch));
	float hole = smoothstep(br * 0.42, br * 0.3, dc);
	inside *= 1.0 - hole;
	inStack *= 1.0 - smoothstep(br * 0.5, br * 0.35, dc);

	// 落在纸上的墨渍
	float dens = inkDrop(q, uDrop0, uDropSize, 2.9);
	dens *= 0.9 + 0.2 * fbm4(q * 40.0);
	pg *= mix(vec3(1.0), vec3(0.5, 0.47, 0.44), clamp(dens * 1.6, 0.0, 1.0));
	pg = mix(pg, vec3(0.045, 0.036, 0.03), smoothstep(0.4, 0.95, dens));

	vec3 col = mix(desk, stackC, inStack);
	col *= 1.0 - exp(-max(dOut - 14.0, 0.0) / 30.0) * (1.0 - inStack) * 0.55;  // 书在墨地上的投影
	col = mix(col, pg, inside);

	// 墨潮 / 墨退
	float fl = flood(q);
	col = mix(col, vec3(0.045, 0.036, 0.03), smoothstep(0.4, 0.95, fl));
	col = mix(col, gold(q * 1.3 + 3.0, col, fl), smoothstep(0.3, 0.8, fl));
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 燃烧的日记页（第 3 期第 4 段）：暗处的一张日记页，被火光照亮；纸边向内烧焦（发亮的火线、焦痕），
 * 墨从纸页中心炸开（放射状墨迹与飞溅的墨点），余烬上升、烟雾翻涌。纸页在主体层（k = 1）上，范围见 PAGE。
 * uBurnR: 火线从纸边向内烧进的距离（px）；uSplash: 墨爆 (x, y, 时刻·秒)，uSplashSize: 墨爆半径（px）；
 * uEmber: 余烬多少；uFire: 火光亮度；uPage: 纸页被照亮的程度（开场从暗处亮起）。
 */
export const INK_FIRE_FRAG = `${INK_LIB}
uniform float uBurnR;
uniform vec3 uSplash;
uniform float uSplashSize;
uniform float uEmber;
uniform float uFire;
uniform float uPage;

const vec4 PAGE = vec4(560.0, 90.0, 1360.0, 990.0);

// 墨爆：快速炸开的不规则墨团 + 放射状的墨迹 + 沿射线飞出的墨点
float splash(vec2 L, vec3 S, float size) {
	float tau = uTime - S.z;
	if (tau <= 0.0 || size <= 0.0) return 0.0;
	vec2 d = L - S.xy;
	float r = length(d);
	vec2 dir = d / max(r, 1e-3);
	float g = 1.0 - exp(-tau / 0.12);
	float R = size * g;
	float edge = 0.7 + 0.6 * fbm4(dir * 2.5 + 11.0);
	float body = smoothstep(R * 0.55 * edge, R * 0.35 * edge, r);
	// 射线：沿方向的高频噪声，越往外越细
	// 方向随距离轻微扭动，墨迹像泼出去的而不是直线
	vec2 wd = normalize(dir + 0.18 * (vec2(noise(vec2(r * 0.008, 1.0)), noise(vec2(r * 0.008, 5.0))) - 0.5));
	float ray = pow(noise(wd * 9.0 + 3.0) * 0.6 + noise(wd * 23.0 + 7.0) * 0.4, 3.0);
	float rays = smoothstep(0.18, 0.5, ray) * smoothstep(R * (0.6 + 0.9 * ray), R * 0.3, r);
	// 飞溅的墨点
	float drops = 0.0;
	for (int i = 0; i < 26; i++) {
		float fi = float(i);
		float a = hash(vec2(fi, 3.3)) * 6.2831;
		float dist = R * (0.45 + 0.9 * hash(vec2(fi, 7.1)));
		vec2 c = S.xy + vec2(cos(a), sin(a)) * dist;
		float rad = size * (0.008 + 0.022 * hash(vec2(fi, 1.7))) * g;
		drops = max(drops, smoothstep(rad, rad * 0.6, length(L - c) * (0.85 + 0.3 * noise((L - c) * 0.1 + fi))));
	}
	return clamp(max(body, max(rays * 0.9, drops)), 0.0, 1.0);
}

void main() {
	vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(1920.0, 1080.0);
	vec2 L = toLayer(p, 1.0);
	vec2 q = L / 1080.0;
	float flick = 0.85 + 0.1 * sin(uTime * 13.0) + 0.05 * sin(uTime * 31.0 + 1.3);

	// 背景：翻涌上升的烟，下方有火光
	float smoke = fbm(q * 2.2 + vec2(0.0, uTime * 0.18) + 0.6 * fbm(q * 3.0 - vec2(uTime * 0.05, uTime * 0.12)));
	vec3 bg = mix(vec3(0.03, 0.022, 0.018), vec3(0.17, 0.12, 0.09), smoothstep(0.35, 0.85, smoke));
	bg += vec3(0.55, 0.22, 0.06) * uFire * flick * smoothstep(0.2, 1.2, L.y / 1080.0) * (0.4 + 0.6 * smoke) * 0.6;

	// 纸页
	vec2 cb = clamp(L, PAGE.xy, PAGE.zw);
	float inside = 1.0 - smoothstep(0.0, 1.5, length(L - cb));
	float edgeDist = min(min(L.x - PAGE.x, PAGE.z - L.x), min(L.y - PAGE.y, PAGE.w - L.y));
	float jag = (fbm4(q * 7.0 + 4.0) - 0.5) * 120.0 + (noise(q * 40.0) - 0.5) * 18.0;
	float front = edgeDist + jag - uBurnR;   // < 0 已烧掉
	vec3 pg = paper(q * 1.3 + 5.0) * vec3(1.05, 1.03, 1.0);
	float ly = mod(L.y - 187.0, 66.0);
	float rule = smoothstep(1.3, 0.0, abs(ly - 33.0)) * step(200.0, L.y) * step(L.y, 940.0) * step(PAGE.x + 60.0, L.x) * step(L.x, PAGE.z - 60.0);
	pg = mix(pg, pg * vec3(0.74, 0.7, 0.64), rule * 0.4);
	pg *= 0.85 + 0.15 * smoothstep(0.0, 60.0, edgeDist);
	// 火光从下方与纸边照上来
	pg *= mix(0.75, 1.05, uFire * flick);
	pg += vec3(0.25, 0.1, 0.02) * uFire * flick * exp(-max(front, 0.0) / 160.0);
	// 焦痕：火线前方发黄发褐，紧挨火线处焦黑
	pg = mix(pg, pg * vec3(0.7, 0.5, 0.3), smoothstep(150.0, 30.0, front) * 0.8);
	pg = mix(pg, vec3(0.08, 0.05, 0.03), smoothstep(40.0, 6.0, front));

	// 墨爆
	float sp = splash(L, uSplash, uSplashSize);
	pg = mix(pg, vec3(0.045, 0.036, 0.03), sp);

	float alive = inside * smoothstep(-1.5, 1.5, front);
	vec3 col = mix(bg, pg * uPage, alive);
	// 火线：沿烧缺的边缘发亮
	float rim = inside * exp(-abs(front) / 5.0) * step(0.5, uBurnR);
	col += vec3(1.0, 0.55, 0.15) * rim * (0.9 + 0.6 * noise(q * 30.0 + uTime * 3.0)) * flick * 1.4;
	col += vec3(1.0, 0.4, 0.08) * inside * exp(-abs(front) / 26.0) * step(0.5, uBurnR) * 0.25 * flick;

	// 余烬：一颗颗发亮的火星向上飘
	for (int k = 0; k < 2; k++) {
		float sc = 34.0 + float(k) * 22.0;
		vec2 eq = q * sc + vec2(sin(q.y * 6.0 + uTime + float(k)) * 0.6, uTime * (2.2 + float(k)));
		vec2 id = floor(eq);
		vec2 f = fract(eq) - 0.5;
		float h = hash(id + float(k) * 13.0);
		if (h > 1.0 - 0.09 * uEmber) {
			vec2 o = vec2(hash(id + 3.1), hash(id + 5.7)) - 0.5;
			float e = smoothstep(0.12, 0.0, length(f - o * 0.6));
			float tw = 0.5 + 0.5 * sin(uTime * 9.0 + h * 50.0);
			col += vec3(1.0, 0.6, 0.2) * e * (0.6 + 0.8 * tw);
		}
	}

	float fl = flood(q);
	col = mix(col, vec3(0.03, 0.024, 0.02), smoothstep(0.4, 0.95, fl));
	outColor = vec4(col * uBright, 1.0);
}
`;

/**
 * 墨云漩涡（第 3 期第 5 段）：纸面上，浓墨云绕中心旋转成漩涡，中心让出一片纸面（超梦所在）。
 * uCenter: 漩涡中心（主体层 k = 1 上的坐标）；uOpen: 中心空出的半径（px）；uSwirl: 旋转的力度；
 * uEmber: 余烬（开场接上一段）；uDark: 整体被墨盖住的程度（0 = 只有漩涡，1 = 满屏浓墨）。
 */
export const INK_VORTEX_FRAG = `${INK_LIB}
uniform vec2 uCenter;
uniform float uOpen;
uniform float uSwirl;
uniform float uEmber;
uniform float uDark;

void main() {
	vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(1920.0, 1080.0);
	vec2 L = toLayer(p, 1.0);
	vec2 q = L / 1080.0;
	vec2 d = (L - uCenter) / 1080.0;
	float r = length(d);
	float ang = atan(d.y, d.x);

	// 旋转：离中心越近转得越多
	float sw = uSwirl * (0.55 / (r + 0.18)) + uTime * 0.22 * uSwirl;
	vec2 rd = rot(sw) * d;
	float cloud = fbm(rd * 2.4 + 0.9 * fbm(rd * 4.0 + uTime * 0.08));
	// 螺旋状的墨带
	float arms = pow(0.5 + 0.5 * sin(ang * 3.0 - log(r + 0.05) * 5.5 + uTime * 1.2 * uSwirl + cloud * 3.0), 3.0);

	float R = uOpen / 1080.0;
	float ring = smoothstep(R * 0.75, R * 1.35, r + (cloud - 0.5) * 0.25);
	// 外圈是纸面上翻卷的墨云（浓淡相间，不是一整片死黑），越往画面外越浓
	float dens = ring * (0.12 + 0.62 * smoothstep(0.38, 0.82, cloud) + arms * 0.3);
	dens += smoothstep(R * 2.0, R * 3.4, r) * 0.25;
	// 中心边缘的淡墨丝
	float wisp = pow(1.0 - abs(2.0 * fbm4(rd * 6.0 + 13.0) - 1.0), 9.0);
	dens += wisp * smoothstep(R * 0.4, R * 1.1, r) * 0.45;
	dens = clamp(mix(dens, 1.0, uDark), 0.0, 1.0);
	dens *= 0.92 + 0.16 * fbm4(q * 40.0);

	vec3 col = paper(q);
	col *= mix(vec3(1.0), vec3(0.5, 0.47, 0.44), clamp(dens * 1.6, 0.0, 1.0));
	col = mix(col, vec3(0.045, 0.036, 0.03), smoothstep(0.42, 0.95, dens));
	col = gold(q, col, dens);

	// 余烬（接上一段）
	for (int k = 0; k < 2; k++) {
		float sc = 34.0 + float(k) * 22.0;
		vec2 eq = q * sc + vec2(sin(q.y * 6.0 + uTime + float(k)) * 0.6, uTime * (2.2 + float(k)));
		vec2 id = floor(eq);
		vec2 f = fract(eq) - 0.5;
		float h = hash(id + float(k) * 13.0);
		if (h > 1.0 - 0.09 * uEmber) {
			vec2 o = vec2(hash(id + 3.1), hash(id + 5.7)) - 0.5;
			float e = smoothstep(0.12, 0.0, length(f - o * 0.6));
			col += vec3(1.0, 0.6, 0.2) * e * (0.6 + 0.8 * (0.5 + 0.5 * sin(uTime * 9.0 + h * 50.0))) * smoothstep(0.3, 0.9, dens);
		}
	}

	float fl = flood(q);
	col = mix(col, vec3(0.045, 0.036, 0.03), smoothstep(0.4, 0.95, fl));
	col = mix(col, gold(q * 1.3 + 3.0, col, fl), smoothstep(0.3, 0.8, fl));
	outColor = vec4(col * uBright, 1.0);
}
`;
