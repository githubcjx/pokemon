// 《坠落的序列》的着色器：字符环境（海面 / 星空 / 极光 / 尘埃）、字符粒子、泛光、合成。
// 所有画面元素都是字符：环境着色器在每个像素里算出它落在哪个“字格”，再到字形图集里取样；
// 字格随距离缩小，远处的字由 mipmap 自然融成颗粒与纹理。

export const ATLAS_GRID = 16;

const COMMON = /* glsl */ `
precision highp float;
uniform vec3 uCamPos;
uniform vec3 uCamF;
uniform vec3 uCamR;
uniform vec3 uCamU;
uniform float uTanH;
uniform float uAspect;
uniform sampler2D uAtlas;
const float G = ${ATLAS_GRID.toFixed(1)};

float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
	p3 = fract(p3 * 0.1031);
	p3 += dot(p3, p3.zyx + 31.32);
	return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
	float s = 0.0;
	float a = 0.5;
	for (int i = 0; i < 4; i++) {
		s += a * vnoise(p);
		p = p * 2.03 + 17.1;
		a *= 0.5;
	}
	return s;
}
// 字形取样：f 为字格内坐标（0..1，y 朝上），gx / gy 为字格坐标的屏幕导数（决定 mip 级别）
float glyph(float idx, vec2 f, vec2 gx, vec2 gy) {
	vec2 cell = vec2(mod(idx, G), floor(idx / G));
	vec2 uv = (cell + vec2(f.x, 1.0 - f.y)) / G;
	float inside = step(0.0, f.x) * step(f.x, 1.0) * step(0.0, f.y) * step(f.y, 1.0);
	return textureGrad(uAtlas, uv, gx / G, gy / G).a * inside;
}
`;

export const ENV_VERT = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

export const ENV_FRAG = /* glsl */ `#version 300 es
${COMMON}
in vec2 vNdc;
out vec4 outColor;
uniform float uTime;
uniform float uSeaAmt;
uniform float uSeaY;
uniform float uStarAmt;
uniform float uSpaceAmt;
uniform float uAuroraAmt;
uniform float uAuroraWarm;
uniform float uDustAmt;
uniform vec2 uDustOff;
uniform float uSkyWarm;
uniform float uFlash;
uniform vec3 uL0Pos;
uniform vec3 uL0Col;
uniform vec3 uL1Pos;
uniform vec3 uL1Col;
uniform vec2 uRes;
uniform float uPlanetAmt;
uniform vec3 uPlanetC;
uniform float uPlanetR;
uniform float uLimbAurora;
uniform float uWave;

const vec3 COLD_DIM = vec3(0.337, 0.392, 0.435);
const vec3 COLD_HI = vec3(0.624, 0.706, 0.749);

// 海面字符：ATGC 为主，混少量碱基中文、片假名、数字
float seaGlyph(float r) {
	if (r < 0.62) return floor(r / 0.62 * 4.0);
	if (r < 0.80) return 4.0 + floor((r - 0.62) / 0.18 * 4.0);
	if (r < 0.90) return 8.0 + floor((r - 0.80) / 0.10 * 5.0);
	return 14.0 + floor((r - 0.90) / 0.10 * 10.0);
}
float starGlyph(float r) { return 14.0 + floor(r * 18.0); }

float swell(vec2 p, float t) {
	float h = sin(p.x * 0.9 + p.y * 0.35 + t * 0.55) * 0.5;
	h += sin(p.x * -0.4 + p.y * 1.3 + t * 0.8) * 0.35;
	h += (fbm(p * 0.45 + vec2(t * 0.05, t * 0.11)) - 0.5) * 1.4;
	return h;
}

vec3 skyColor(vec3 d) {
	float up = clamp(d.y, -0.2, 1.0);
	vec3 zen = vec3(0.027, 0.027, 0.047);
	vec3 hor = vec3(0.075, 0.078, 0.106);
	vec3 zen1 = vec3(0.07, 0.06, 0.09);
	vec3 hor1 = vec3(0.255, 0.235, 0.298);
	vec3 zen2 = vec3(0.13, 0.085, 0.12);
	vec3 hor2 = vec3(0.388, 0.286, 0.337);
	float w1 = clamp(uSkyWarm, 0.0, 1.0);
	float w2 = clamp(uSkyWarm - 1.0, 0.0, 1.0);
	vec3 z = mix(mix(zen, zen1, w1), zen2, w2);
	vec3 h = mix(mix(hor, hor1, w1), hor2, w2);
	float k = smoothstep(-0.05, 0.55, up);
	vec3 c = mix(h, z, k);
	// 太空里没有地平线：上下都是暗场
	c = mix(c, mix(z, h * 0.6, 0.35), uSpaceAmt * (1.0 - uSeaAmt));
	return c;
}

// 极光的平滑场（不含字形），也用于海面倒影
float auroraField(vec3 d, float t) {
	float az = atan(d.x, d.z);
	float el = asin(clamp(d.y, -1.0, 1.0));
	// 一条在方位上蜿蜒的光带：下沿锐利、向上渐隐，带少量褶皱
	float base = 0.1 + 0.05 * sin(az * 1.6 + t * 0.035) + 0.025 * sin(az * 4.3 - t * 0.06);
	float v = el - base;
	float curtain = 0.06 + 0.94 * smoothstep(0.4, 0.7, fbm(vec2(az * 2.2 + t * 0.012, t * 0.02)));
	curtain *= 0.72 + 0.28 * sin(az * 11.0 + fbm(vec2(az * 4.0, t * 0.04)) * 7.0 + t * 0.05);
	float h = 0.1 + 0.16 * fbm(vec2(az * 2.4 + 5.0, t * 0.015));
	float prof = v < 0.0 ? exp(v * 90.0) : exp(-v / h);
	float win = smoothstep(1.4, 0.5, abs(az));
	return max(curtain, 0.0) * prof * win;
}
vec3 auroraColor(float el) {
	float k = clamp(el * 3.0, 0.0, 1.0);
	vec3 cold = mix(vec3(0.36, 0.72, 0.62), vec3(0.55, 0.58, 0.85), k);
	vec3 warm = mix(vec3(0.86, 0.45, 0.60), vec3(0.95, 0.76, 0.46), k);
	return mix(cold, warm, uAuroraWarm);
}

vec3 lightReflect(vec3 rr, vec3 p, vec3 lp, vec3 lc) {
	vec3 dl = normalize(lp - p);
	float c = max(dot(rr, dl), 0.0);
	return lc * (pow(c, 180.0) * 2.2 + pow(c, 24.0) * 0.28);
}

void main() {
	vec3 d = normalize(uCamF + vNdc.x * uTanH * uAspect * uCamR + vNdc.y * uTanH * uCamU);
	vec3 col = skyColor(d);
	float t = uTime;
	float az = atan(d.x, d.z);
	float el = asin(clamp(d.y, -1.0, 1.0));
	float skyMask = mix(1.0, smoothstep(-0.002, 0.004, d.y), uSeaAmt);

	// 屏幕导数一律在分支外求（分支内求导数是未定义行为）
	vec2 sg = vec2(az, el) / 0.0105;
	vec2 sgx = dFdx(sg), sgy = dFdy(sg);
	vec2 sg2 = vec2(az, el) / 0.0058;
	vec2 sg2x = dFdx(sg2), sg2y = dFdy(sg2);
	vec2 ag = vec2(az / 0.0082, el / 0.0118);
	vec2 agx = dFdx(ag), agy = dFdy(ag);
	float hgt = max(uCamPos.y - uSeaY, 0.05);
	float tt = hgt / max(-d.y, 1e-4);
	vec2 xz = uCamPos.xz + d.xz * tt;
	vec2 cs = vec2(0.085, 0.3) * hgt;
	vec2 g = xz / cs;
	vec2 gdx = dFdx(g), gdy = dFdy(g);

	// 行星：射线与球求交；经纬网格以“右 = 纬度方向、前 = 经度方向”展开，镜头正下方是赤道
	vec3 oc = uCamPos - uPlanetC;
	float pb = dot(oc, d);
	float pc = dot(oc, oc) - uPlanetR * uPlanetR;
	float disc = pb * pb - pc;
	float th = -pb - sqrt(max(disc, 0.0));
	vec3 ps = oc + d * max(th, 0.0);
	float hCam = max(length(oc) - uPlanetR, 0.05);
	vec2 pcs = vec2(0.085, 0.3) * hCam;
	vec2 pg = vec2(asin(clamp(ps.x / length(ps), -1.0, 1.0)), atan(ps.z, ps.y)) * uPlanetR / pcs;
	vec2 pgx = dFdx(pg), pgy = dFdy(pg);
	float hit = (uPlanetAmt > 0.001 && disc > 0.0 && th > 0.0) ? 1.0 : 0.0;
	float alt = (pb < 0.0 ? sqrt(max(dot(oc, oc) - pb * pb, 0.0)) : length(oc)) - uPlanetR;
	vec3 q = oc + d * max(-pb, 0.0);
	float latQ = asin(clamp(q.x / max(length(q), 1e-3), -1.0, 1.0));
	vec2 lg = vec2(latQ * uPlanetR / 0.34, alt / 0.42);
	vec2 lgx = dFdx(lg), lgy = dFdy(lg);
	skyMask *= 1.0 - hit * uPlanetAmt;

	// ---- 星：星表数字与符号 ----
	if (uStarAmt > 0.001) {
		vec2 id = floor(sg);
		vec2 f = fract(sg);
		float h = hash12(id);
		if (h < 0.2) {
			float sc = 0.42 + 0.45 * hash12(id + 3.7);
			vec2 fg = (f - 0.5) / sc + 0.5;
			float g = glyph(starGlyph(hash12(id + 9.2)), fg, sgx / sc, sgy / sc);
			float b = 0.05 + 1.1 * pow(hash12(id + 1.3), 9.0);
			b *= 0.7 + 0.3 * sin(t * (0.8 + 3.0 * h) + h * 40.0);
			col += mix(COLD_HI, vec3(0.80, 0.83, 0.88), 0.5) * g * b * uStarAmt * skyMask;
		}
		// 太空：更细的一层星尘，沿一条斜带聚成银河
		if (uSpaceAmt > 0.001) {
			vec2 id2 = floor(sg2);
			float h2 = hash12(id2 + 51.0);
			float band = exp(-pow((el - 0.35 * sin(az * 0.8 + 0.6)) * 3.2, 2.0)) * (0.4 + 0.9 * fbm(vec2(az, el) * 4.0));
			if (h2 < 0.12 + 0.35 * band) {
				vec2 fg2 = (fract(sg2) - 0.5) / 0.6 + 0.5;
				float g2 = glyph(starGlyph(hash12(id2 + 2.0)), fg2, sg2x / 0.6, sg2y / 0.6);
				col += COLD_HI * g2 * (0.05 + 0.18 * band) * uSpaceAmt * skyMask;
			}
			col += mix(vec3(0.10, 0.12, 0.15), vec3(0.30, 0.18, 0.24), clamp(uSkyWarm - 0.5, 0.0, 1.0)) * band * 0.18 * uSpaceAmt * skyMask;
		}
	}

	// ---- 极光：竖向流动的字符列 ----
	if (uAuroraAmt > 0.001 && d.y > -0.01) {
		float field = auroraField(d, t);
		if (field > 0.002) {
			float colId = floor(ag.x);
			float fall = t * (0.25 + 0.5 * hash12(vec2(colId, 4.0)));
			vec2 a2 = vec2(ag.x, ag.y + fall);
			vec2 id = floor(a2);
			vec2 f = fract(a2);
			float r = hash12(id + floor(t * 0.4 + hash12(id) * 7.0) * 3.1);
			float g = glyph(seaGlyph(r), (f - 0.5) / 0.82 + 0.5, agx / 0.82, agy / 0.82);
			float lit = step(0.35, hash12(id + 2.9));
			float b = field * (0.35 + 0.65 * hash12(id + 0.7)) * lit;
			col += auroraColor(el) * (g * b * 1.25 + field * 0.10) * uAuroraAmt;
		}
	}

	// ---- 行星：夜面上铺满的字、大气边缘的冷光、沿边缘升起的极光 ----
	if (uPlanetAmt > 0.001) {
		vec3 atm = vec3(0.30, 0.48, 0.64);
		if (hit > 0.5) {
			vec2 id = floor(pg);
			vec2 f = fract(pg);
			float rnd = hash12(id);
			float epoch = floor(t * (0.1 + 0.3 * hash12(id + 7.1)) + rnd * 10.0);
			vec2 sc = vec2(0.78, 0.86);
			float a = glyph(seaGlyph(hash12(id + epoch * 1.37)), (f - 0.5) / sc + 0.5, pgx / sc, pgy / sc);
			vec3 n = normalize(ps);
			float mu = clamp(dot(n, -d), 0.0, 1.0);
			float cloud = fbm(pg * pcs / hCam * 0.08 + vec2(t * 0.01, 0.0));
			float base = (0.05 + 0.2 * cloud * cloud) * (0.5 + 0.9 * rnd * rnd);
			vec3 surf = mix(COLD_DIM, COLD_HI, cloud) * base * a;
			float haze = pow(1.0 - mu, 4.0);
			vec3 pcol = surf * (1.0 - haze * 0.6) + atm * haze * 0.35;
			col = mix(col, pcol, uPlanetAmt);
		} else {
			float rim = 0.45 * exp(-alt / (0.012 * uPlanetR)) + 0.9 * exp(-alt / (0.0016 * uPlanetR));
			col += atm * rim * uPlanetAmt * step(0.0, alt);
		}
		if (uLimbAurora > 0.001) {
			float a0 = 0.004 * uPlanetR;
			float curtain = 0.2 + 0.8 * smoothstep(0.36, 0.74, fbm(vec2(latQ * 22.0 + t * 0.03, t * 0.02)));
			curtain *= 0.7 + 0.3 * sin(latQ * 140.0 + fbm(vec2(latQ * 40.0, t * 0.05)) * 6.0);
			float hh = 0.012 * uPlanetR * (0.5 + fbm(vec2(latQ * 30.0 + 3.0, t * 0.02)));
			float prof = alt < a0 ? exp((alt - a0) / (0.0012 * uPlanetR)) : exp(-(alt - a0) / hh);
			// 镜头水平线以上的视线不再靠近行星（pb >= 0）：alt、latQ 都退化成常数，整片上空会落进同一个字格的同一点，
			// 随字列滚动、变形时的增亮一起整片闪白。让边缘极光在升到水平线之前平滑淡出。
			float limbSin = sqrt(max(1.0 - uPlanetR * uPlanetR / dot(oc, oc), 1e-6));
			float nearLimb = smoothstep(0.08, 0.5, max(-pb, 0.0) / (length(oc) * limbSin));
			float field = curtain * prof * (1.0 - hit * 0.65) * nearLimb;
			float colId = floor(lg.x);
			vec2 l2 = vec2(lg.x, lg.y + t * (0.3 + 0.5 * hash12(vec2(colId, 2.0))));
			vec2 id = floor(l2);
			float r = hash12(id + floor(t * 0.4 + hash12(id) * 7.0) * 3.1);
			float gl = glyph(seaGlyph(r), (fract(l2) - 0.5) / 0.82 + 0.5, lgx / 0.82, lgy / 0.82);
			float lit = step(0.3, hash12(id + 2.9));
			float k = clamp((alt - a0) / (hh * 2.0), 0.0, 1.0);
			col += auroraColor(k * 0.33) * (gl * lit * field * (0.4 + 0.6 * hash12(id + 0.7)) * 1.4 + field * 0.12) * uLimbAurora;
		}
	}

	// ---- 海面：平铺在水平面上的字 ----
	if (uSeaAmt > 0.001 && d.y < 0.0) {
		vec2 id = floor(g);
		vec2 f = fract(g);
		float rnd = hash12(id);
		float epoch = floor(t * (0.12 + 0.4 * hash12(id + 7.1)) + rnd * 10.0);
		float gi = seaGlyph(hash12(id + epoch * 1.37));
		vec2 sc = vec2(0.78, 0.86);
		float a = glyph(gi, (f - 0.5) / sc + 0.5, gdx / sc, gdy / sc);
		vec3 cw = vec3((id.x + 0.5) * cs.x, uSeaY, (id.y + 0.5) * cs.y);
		vec2 wp = cw.xz / hgt;
		float h0 = swell(wp, t) * uWave;
		float hx = swell(wp + vec2(0.08, 0.0), t) * uWave - h0;
		float hz = swell(wp + vec2(0.0, 0.08), t) * uWave - h0;
		vec3 n = normalize(vec3(-hx * 2.4, 1.0, -hz * 2.4));
		vec3 vd = normalize(cw - uCamPos);
		vec3 rr = reflect(vd, n);
		float wave = clamp(0.5 + h0 * 0.45, 0.0, 1.0);
		float base = (0.08 + 0.3 * wave * wave) * (0.55 + 0.9 * rnd * rnd);
		base *= 0.8 + 0.2 * sin(t * (0.6 + rnd * 2.0) + rnd * 30.0);
		vec3 refl = lightReflect(rr, cw, uL0Pos, uL0Col) + lightReflect(rr, cw, uL1Pos, uL1Col);
		if (uAuroraAmt > 0.001) refl += auroraColor(0.1) * auroraField(rr, t) * 1.3 * uAuroraAmt;
		refl += skyColor(rr) * 0.25;
		float fres = 0.25 + 0.75 * pow(1.0 - clamp(-vd.y, 0.0, 1.0), 5.0);
		vec3 gc = mix(COLD_DIM, COLD_HI, wave) * base + refl * fres;
		float fog = exp(-tt / hgt * 0.018);
		vec3 sea = gc * a;
		// 远处：字融成颗粒，再融进海雾
		vec3 haze = skyColor(vec3(d.x, 0.0, d.z)) * 0.9 + refl * 0.08;
		vec3 seaCol = mix(haze, sea + col * 0.15, fog);
		col = mix(col, seaCol, uSeaAmt);
	}

	// ---- 尘埃：三层不同远近的细小字符，近的一层失焦 ----
	if (uDustAmt > 0.001) {
		for (int k = 0; k < 3; k++) {
			float fk = float(k);
			float cell = mix(64.0, 15.0, fk / 2.0);
			float par = mix(1.0, 0.25, fk / 2.0);
			vec2 p = (vNdc * vec2(uAspect, 1.0) * 0.5 * uRes.y + uDustOff * par * uRes.y + vec2(t * 3.0, t * 1.2) * par) / cell;
			vec2 id = floor(p);
			float h = hash13(vec3(id, fk));
			if (h < 0.10) {
				float blurK = fk < 0.5 ? 6.0 : 1.0;
				vec2 fg = (fract(p) - 0.5) / 0.55 + 0.5;
				vec2 px = vec2(1.0 / cell, 0.0) / 0.55 * blurK;
				float g = glyph(seaGlyph(hash13(vec3(id, fk + 9.0))), fg, px, px.yx);
				float b = (fk < 0.5 ? 0.10 : 0.16) * (0.3 + hash13(vec3(id, 5.0 + fk)));
				b *= 0.6 + 0.4 * sin(t * (0.5 + h * 6.0) + h * 50.0);
				col += COLD_HI * g * b * uDustAmt;
			}
		}
	}

	col += vec3(0.95, 0.93, 0.9) * uFlash;
	outColor = vec4(col, 1.0);
}`;

export const PARTICLE_VERT = /* glsl */ `#version 300 es
${COMMON}
in vec2 aCorner;
in vec4 iPosSize;
in vec4 iVelGlyph;
in vec4 iCol;
in vec2 iMisc;
uniform vec2 uRes;
uniform float uFocus;
uniform float uDofK;
out vec2 vUV;
out vec4 vCol;
out float vBias;

vec2 proj(vec3 v, out float z) {
	z = dot(v, uCamF);
	return vec2(dot(v, uCamR) / (max(z, 0.02) * uTanH * uAspect), dot(v, uCamU) / (max(z, 0.02) * uTanH));
}

void main() {
	vec3 v = iPosSize.xyz - uCamPos;
	float z;
	vec2 ndc = proj(v, z);
	if (z < 0.08 || iCol.a <= 0.0) {
		gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
		return;
	}
	float pxPerUnit = uRes.y * 0.5 / (z * uTanH);
	float sizePx = iPosSize.w * pxPerUnit;
	float coc = abs(1.0 / z - 1.0 / uFocus) * uDofK;
	float blur = clamp(iMisc.x + coc, 0.0, 10.0);
	float s = min(max(sizePx, 1.4) + blur * 2.2, 70.0);
	vec2 dir = vec2(1.0, 0.0);
	float len = 0.0;
	if (iMisc.y > 0.0) {
		float z2;
		vec2 n2 = proj(v + iVelGlyph.xyz, z2);
		vec2 dp = (n2 - ndc) * uRes * 0.5;
		float l = length(dp);
		if (l > 1e-3) {
			dir = dp / l;
			len = min(l * iMisc.y, 700.0);
		}
	}
	vec2 perp = vec2(-dir.y, dir.x);
	vec2 off = dir * aCorner.x * (s + len) + perp * aCorner.y * s;
	gl_Position = vec4(ndc + off * 2.0 / uRes, 0.0, 1.0);
	float gi = iVelGlyph.w;
	vec2 cell = vec2(mod(gi, G), floor(gi / G));
	vUV = (cell + vec2(aCorner.x + 0.5, 0.5 - aCorner.y)) / G;
	float spread = max(sizePx, 1.4) / s;
	float energy = clamp(spread * spread, 0.04, 1.0);
	// 小于 1.4px 的远处字只保留一点亮度
	energy *= clamp(sizePx / 1.4, 0.15, 1.0);
	// 贴近镜头的字淡出，不糊满画面
	energy *= smoothstep(0.6, 3.5, z);
	if (sizePx > 70.0) energy *= 70.0 / sizePx;
	// 拖尾：亮度沿长度摊开（运动模糊守恒能量的一半效果）
	energy *= pow(s / (s + len), 0.55);
	vCol = vec4(iCol.rgb * iCol.a * energy, 1.0);
	vBias = log2(s / max(sizePx, 1.4)) + blur * 0.25;
}`;

export const PARTICLE_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
in vec2 vUV;
in vec4 vCol;
in float vBias;
out vec4 outColor;
void main() {
	float a = texture(uAtlas, vUV, vBias).a;
	outColor = vec4(vCol.rgb * a, 0.0);
}`;

export const QUAD_VERT = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// 13 点降采样（Jimenez 2014）
export const DOWN_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThresh;
in vec2 vUv;
out vec4 o;
void main() {
	vec2 t = uTexel;
	vec3 a = texture(uSrc, vUv + t * vec2(-2, 2)).rgb;
	vec3 b = texture(uSrc, vUv + t * vec2(0, 2)).rgb;
	vec3 c = texture(uSrc, vUv + t * vec2(2, 2)).rgb;
	vec3 d = texture(uSrc, vUv + t * vec2(-2, 0)).rgb;
	vec3 e = texture(uSrc, vUv).rgb;
	vec3 f = texture(uSrc, vUv + t * vec2(2, 0)).rgb;
	vec3 g = texture(uSrc, vUv + t * vec2(-2, -2)).rgb;
	vec3 h = texture(uSrc, vUv + t * vec2(0, -2)).rgb;
	vec3 i = texture(uSrc, vUv + t * vec2(2, -2)).rgb;
	vec3 j = texture(uSrc, vUv + t * vec2(-1, 1)).rgb;
	vec3 k = texture(uSrc, vUv + t * vec2(1, 1)).rgb;
	vec3 l = texture(uSrc, vUv + t * vec2(-1, -1)).rgb;
	vec3 m = texture(uSrc, vUv + t * vec2(1, -1)).rgb;
	vec3 r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
	// 只让亮部泛光（软阈值），暗场保持干净
	if (uThresh > 0.0) {
		float br = max(r.r, max(r.g, r.b));
		float soft = clamp(br - uThresh * 0.5, 0.0, uThresh);
		soft = soft * soft / (2.0 * uThresh + 1e-4);
		r *= max(soft, br - uThresh) / max(br, 1e-4);
	}
	o = vec4(r, 1.0);
}`;

// 3x3 帐篷滤波升采样，叠加到上一级
export const UP_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uWeight;
in vec2 vUv;
out vec4 o;
void main() {
	vec2 t = uTexel * 1.25;
	vec3 s = texture(uSrc, vUv).rgb * 4.0;
	s += (texture(uSrc, vUv + vec2(t.x, 0)).rgb + texture(uSrc, vUv - vec2(t.x, 0)).rgb + texture(uSrc, vUv + vec2(0, t.y)).rgb + texture(uSrc, vUv - vec2(0, t.y)).rgb) * 2.0;
	s += texture(uSrc, vUv + t).rgb + texture(uSrc, vUv - t).rgb + texture(uSrc, vUv + vec2(t.x, -t.y)).rgb + texture(uSrc, vUv + vec2(-t.x, t.y)).rgb;
	o = vec4(s / 16.0 * uWeight, 1.0);
}`;

export const COMPOSITE_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uOut;
uniform float uBand0;
uniform float uBand1;
uniform float uBloomAmt;
uniform float uExposure;
uniform float uGlitch;
uniform float uAberr;
uniform float uVignette;
uniform float uFade;
uniform float uTime;
out vec4 o;
const vec3 FLOOR = vec3(0.027, 0.027, 0.047);
float h12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
vec3 sampleAll(vec2 uv) {
	return texture(uScene, uv).rgb + texture(uBloom, uv).rgb * uBloomAmt;
}
void main() {
	vec2 p = gl_FragCoord.xy;
	if (p.y < uBand0 || p.y >= uBand1) {
		o = vec4(FLOOR + (h12(p + uTime) - 0.5) / 255.0, 1.0);
		return;
	}
	vec2 uv = vec2(p.x / uOut.x, (p.y - uBand0) / (uBand1 - uBand0));
	if (uGlitch > 0.001) {
		float band = floor(uv.y * 46.0);
		float tick = floor(uTime * 15.0);
		float hb = h12(vec2(band, tick));
		if (hb > 1.0 - uGlitch * 0.32) uv.x += (h12(vec2(band, tick + 7.0)) - 0.5) * 0.06 * uGlitch;
	}
	vec2 dc = (uv - 0.5);
	vec3 c;
	c.r = sampleAll(uv + dc * uAberr).r;
	c.g = sampleAll(uv).g;
	c.b = sampleAll(uv - dc * uAberr).b;
	c = 1.0 - exp(-c * uExposure);
	float vig = smoothstep(1.2, 0.3, length(dc * vec2(1.75, 1.0)));
	c *= mix(1.0, vig, uVignette);
	c *= uFade;
	c = FLOOR + c * (1.0 - FLOOR);
	c += (h12(p * 1.37 + uTime) - 0.5) / 255.0;
	o = vec4(c, 1.0);
}`;
