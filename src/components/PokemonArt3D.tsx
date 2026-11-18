import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

/**
 * 2.5D 立绘：官方立绘贴在按深度图起伏的网格上，可做小角度转身与动态打光。
 * 深度图 / 法线图由 tools/depth3d.py 从立绘轮廓推算（纯算法，不改动立绘像素）。
 * 默认参数（ambient=1、无光源、无转角）的输出与原立绘完全一致。
 *
 * 坐标系（模型空间）：x 右、y 下、z 朝向观众，立绘宽度 = 1。
 */

type Vec3 = [number, number, number];

export type DirLight = {
	/** 指向光源的方向（模型空间，y 向下） */
	dir: Vec3;
	/** 颜色 × 强度，线性空间 */
	color: Vec3;
	/** 半兰伯特包裹，0 = 硬朗，1 = 柔和 */
	wrap?: number;
};

export type PointLight = {
	/** 位置（模型空间，立绘中心为原点） */
	pos: Vec3;
	color: Vec3;
	/** 衰减半径（模型单位） */
	radius: number;
};

export type Rim = {
	/** 轮廓光来自的屏幕方向（x 右、y 下） */
	dir: [number, number];
	color: Vec3;
	power?: number;
};

/** 一组光照参数，方便在场景里整体定义、复用 */
export type ArtLighting = {
	depthScale?: number;
	/** 纹路自发光强度（原始回归的纹路、发光的眼睛等） */
	emissive?: number;
	emissiveTint?: Vec3;
	/** 自发光的取色阈值，见 Art3DProps.emissiveKey */
	emissiveKey?: [number, number, number, number];
	ambient?: Vec3;
	dirLights?: DirLight[];
	pointLights?: PointLight[];
	rim?: Rim;
};

const MAX_DIR = 3;
const MAX_POINT = 2;
const GRID = 320;

const VERT = `#version 300 es
in vec2 aUV;
uniform sampler2D uDepth;
uniform float uDepthMax;
uniform mat3 uRot;
uniform float uPivot;
uniform float uDist;
uniform float uExtent;
out vec2 vUV;
out vec3 vPos;
void main() {
	vec2 d = texture(uDepth, aUV).rg;
	float h = (d.r * 65280.0 + d.g * 255.0) / 65535.0;
	vec3 p = vec3(aUV - 0.5, h * uDepthMax);
	p.z -= uPivot;
	p = uRot * p;
	p.z += uPivot;
	vUV = aUV;
	vPos = p;
	float w = uDist - p.z;
	gl_Position = vec4(p.x * uDist / uExtent, -p.y * uDist / uExtent, -p.z * 0.9 * w, w);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vPos;
uniform sampler2D uArt;
uniform sampler2D uNormal;
uniform mat3 uRot;
uniform float uDepthScale;
uniform vec3 uAmbient;
uniform vec3 uDirDir[${MAX_DIR}];
uniform vec3 uDirCol[${MAX_DIR}];
uniform float uDirWrap[${MAX_DIR}];
uniform vec3 uPtPos[${MAX_POINT}];
uniform vec3 uPtCol[${MAX_POINT}];
uniform float uPtRad[${MAX_POINT}];
uniform vec2 uRimDir;
uniform vec3 uRimCol;
uniform float uRimPow;
uniform float uBrightness;
uniform float uOpacity;
uniform float uEmissive;
uniform vec3 uEmTint;
uniform vec4 uEmKey;
uniform vec2 uSpectrum;
uniform float uInkOn;
uniform float uInkSil;
uniform float uInkReveal;
uniform float uInkLine;
uniform float uInkHalo;
uniform float uInkWash;
uniform float uInkTime;
uniform vec2 uInkCenter;
uniform float uInkPaint;
uniform float uInkColor;
uniform float uOilOn;
uniform float uOilAmt;
uniform float uOilR;
uniform float uOilWarm;
uniform float uStitchOn;
uniform float uStitchAmount;
uniform float uStitchFreq;
uniform float uSilhouetteOn;
uniform vec3 uSilhouetteColor;
uniform float uHatchOn;
uniform float uHatchAmt;
uniform float uHatchBody;
uniform float uHatchReveal;
uniform vec3 uHatchCol;
uniform float uHatchFreq;
uniform float uHatchTime;
uniform vec2 uHatchCenter;
out vec4 outColor;

// 原立绘的光照着色（输出 sRGB）
vec3 shade(vec4 c) {
	vec3 albedo = pow(c.rgb / max(c.a, 1e-4), vec3(2.2));

	vec3 n = texture(uNormal, vUV).xyz * 2.0 - 1.0;
	n.xy *= uDepthScale;
	n = normalize(uRot * normalize(n));

	vec3 light = uAmbient;
	for (int i = 0; i < ${MAX_DIR}; i++) {
		float w = uDirWrap[i];
		float nd = (dot(n, normalize(uDirDir[i] + 1e-6)) + w) / (1.0 + w);
		light += uDirCol[i] * max(nd, 0.0);
	}
	for (int i = 0; i < ${MAX_POINT}; i++) {
		vec3 L = uPtPos[i] - vPos;
		float dist = length(L);
		float att = 1.0 / (1.0 + pow(dist / max(uPtRad[i], 1e-4), 2.0));
		light += uPtCol[i] * max(dot(n, L / max(dist, 1e-4)), 0.0) * att;
	}
	vec3 col = albedo * light;

	// 轮廓光：法线越贴近画面、越朝向光源一侧越亮
	float fres = pow(clamp(1.0 - n.z, 0.0, 1.0), uRimPow);
	vec2 nxy = n.xy / max(length(n.xy), 1e-4);
	float side = max(dot(nxy, normalize(uRimDir + 1e-6)), 0.0);
	col += uRimCol * fres * side * (0.35 + 0.65 * albedo);

	// 自发光：只点亮立绘里本来就明亮且有颜色的纹路（排除白色、灰色）
	vec3 srgb = c.rgb / max(c.a, 1e-4);
	float mx = max(srgb.r, max(srgb.g, srgb.b));
	float sat = (mx - min(srgb.r, min(srgb.g, srgb.b))) / max(mx, 1e-4);
	float lum = dot(srgb, vec3(0.299, 0.587, 0.114));
	float em = smoothstep(uEmKey.x, uEmKey.y, lum) * smoothstep(uEmKey.z, uEmKey.w, sat);
	col += albedo * uEmTint * em * uEmissive;

	return pow(max(col, 0.0), vec3(1.0 / 2.2)) * uBrightness;
}

// ─── 水墨模式用的噪声 ───
float ihash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
float inoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(ihash(i), ihash(i + vec2(1, 0)), u.x), mix(ihash(i + vec2(0, 1)), ihash(i + vec2(1, 1)), u.x), u.y);
}
float ifbm(vec2 p) {
	float v = 0.0, a = 0.5;
	mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
	for (int i = 0; i < 4; i++) { v += a * inoise(p); p = m * p; a *= 0.5; }
	return v;
}

/**
 * 水墨画：从立绘本身推算——原图的描线 → 毛笔线（略洇开），明暗 → 墨分浓淡（分层、带湿边），
 * 亮面留白（纸色），颜色只留 uInkColor 的一层淡彩；饱和且偏暗的部分（眼睛）多留一些颜色。
 * uv / uvw：立绘坐标与带抖动的坐标；press：笔势
 */
vec3 inkPainting(vec4 c, vec2 uv, vec2 uvw, float press) {
	vec3 srgb = c.rgb / max(c.a, 1e-4);
	float L = dot(srgb, vec3(0.299, 0.587, 0.114));
	float mx = max(srgb.r, max(srgb.g, srgb.b));
	float sat = (mx - min(srgb.r, min(srgb.g, srgb.b))) / max(mx, 1e-4);

	// 留白处是比背景略亮的纸色
	vec3 paperC = vec3(0.94, 0.89, 0.78) * (0.96 + 0.06 * ifbm(uv * vec2(60.0, 85.0)));
	// 淡彩：取原图的色相（按亮度归一后加强），像一层薄薄的胭脂、花青染在纸上
	// 有淡彩时，饱和且偏暗的部分（眼睛）多留一些颜色；纯墨（uInkColor = 0）时不留
	float keep = uInkColor + (1.0 - uInkColor) * 0.8 * min(1.0, uInkColor * 4.0) * smoothstep(0.32, 0.55, sat) * smoothstep(0.75, 0.4, L);
	vec3 hue = clamp(vec3(1.0) + (srgb / max(L, 0.05) - 1.0) * 1.7, 0.0, 1.6);
	float pool = 0.8 + 0.4 * ifbm(uv * 5.0 + 31.0);   // 颜料在纸上积得不匀
	vec3 col = paperC * mix(vec3(1.0), hue, clamp(keep * pool, 0.0, 1.0));

	// 墨分浓淡：明暗分层染墨，层与层之间有积墨的湿边，染墨带一点笔刷方向
	float s = smoothstep(0.9, 0.45, L);
	float n1 = (ifbm(uv * 9.0 + 3.0) - 0.5) * 0.2;
	float n2 = (ifbm(uv * 7.0 + 13.0) - 0.5) * 0.22;
	float stroke = ifbm(vec2(uv.x * 6.0 + uv.y * 3.0, uv.y * 30.0 - uv.x * 12.0) + 50.0);
	float wash = 0.08 * s
		+ 0.16 * smoothstep(0.1, 0.18, s + n1)
		+ 0.34 * smoothstep(0.52, 0.6, s + n2)
		+ 0.16 * exp(-pow((s + n2 - 0.58) / 0.03, 2.0))
		+ 0.08 * exp(-pow((s + n1 - 0.15) / 0.025, 2.0));
	wash *= 0.7 + 0.6 * stroke;
	col = mix(col, vec3(0.27, 0.24, 0.22), clamp(wash, 0.0, 1.0));

	// 毛笔线：原图描线加粗，粗细随笔势变化；外圈洇开一层淡墨
	vec4 c1 = textureLod(uArt, uvw, 1.4);
	float L1 = dot(c1.rgb / max(c1.a, 1e-4), vec3(0.299, 0.587, 0.114));
	vec4 cb = textureLod(uArt, uvw, 2.6);
	float Lb = dot(cb.rgb / max(cb.a, 1e-4), vec3(0.299, 0.587, 0.114));
	float thr = 0.42 + 0.22 * press;
	float line = smoothstep(thr, thr - 0.2, L1);
	float bleed = smoothstep(0.7, 0.45, Lb) * 0.3;
	line *= 0.75 + 0.25 * smoothstep(0.2, 0.5, ifbm(uv * 26.0 + 40.0) + press * 0.3);
	col = mix(col, vec3(0.25, 0.22, 0.2), bleed * (1.0 - line));
	col = mix(col, vec3(0.04, 0.032, 0.027), line);
	return col;
}

/**
 * 水墨模式：形状来自立绘，在外面加"墨"——轮廓外的淡墨晕、显色前的墨影（从最厚处向边缘洇满轮廓）、
 * 显色后沿轮廓的墨线；显色时从中心向外渗开，渗色的前沿积一圈湿墨。
 * uInkPaint：0 = 原色 + 墨感，1 = 水墨画（见 inkPainting）。
 */
vec4 inkMode(vec4 c) {
	vec2 uv = vUV;
	float t = uInkTime;
	vec2 wob = vec2(ifbm(uv * 7.0 + vec2(0.0, t * 0.05)), ifbm(uv * 7.0 + 7.3 - vec2(t * 0.045, 0.0))) - 0.5;
	vec2 uvw = uv + wob * 0.016;
	float aS = textureLod(uArt, uvw, 2.5).a;
	float aM = textureLod(uArt, uvw, 3.5).a;
	float aB = textureLod(uArt, uv + wob * 0.03, 4.5).a;
	float aL = textureLod(uArt, uv + wob * 0.06, 5.5).a;
	float gran = 0.9 + 0.2 * ifbm(uv * 60.0 + 3.0);

	// 1. 轮廓外的淡墨晕：墨顺着纸纤维往外洇，边缘毛糙
	float fiber = ifbm(vec2(uv.x * 40.0, uv.y * 40.0) + wob * 6.0);
	float halo = smoothstep(0.02, 0.55, aL) * (1.0 - smoothstep(0.2, 0.7, aS));
	// 靠近立绘画布边缘时收掉，避免出现直边
	halo *= smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x) * smoothstep(0.0, 0.06, uv.y) * smoothstep(1.0, 0.94, uv.y);
	halo *= smoothstep(0.25, 0.75, fiber + aB * 0.4) * (0.55 + 0.45 * ifbm(uv * 9.0 + t * 0.05)) * uInkHalo * 0.7;

	// 2. 墨影：阈值从厚到薄推进，墨从轮廓最厚处洇满整个形状；中间淡、边缘积墨
	float thr = mix(1.15, 0.2, uInkSil);
	float fillF = aB + (ifbm(uv * 8.0 + 2.0 + t * 0.03) - 0.5) * 0.4;
	// 墨影贴着轮廓，边缘羽化（不越出立绘画布，免得被切出直边）
	float body = smoothstep(thr - 0.1, thr + 0.06, fillF) * smoothstep(0.12, 0.62, aM);
	float wetEdge = body * (1.0 - smoothstep(0.5, 0.97, aB)) * 0.7;
	float cloud = smoothstep(0.25, 0.8, ifbm(uv * 4.0 + 5.0 + vec2(t * 0.07, -t * 0.05)));
	float streak = ifbm(vec2(uv.x * 3.0, uv.y * 14.0) + wob * 4.0 + t * 0.04);
	float dens = clamp(0.22 + 0.55 * cloud + 0.18 * streak + 0.35 * wetEdge, 0.0, 1.0) * gran;
	vec3 inkC = mix(vec3(0.42, 0.39, 0.36), vec3(0.04, 0.032, 0.028), smoothstep(0.2, 0.9, dens));
	float bodyA = body * mix(0.7, 1.0, smoothstep(0.2, 0.8, dens));

	// 3. 显色：从 uInkCenter 向外渗开，边界参差
	float field = 1.0 - length((uv - uInkCenter) * 1.7) + (ifbm(uv * 4.5 + 9.0 + t * 0.02) - 0.5) * 0.6;
	float f0 = mix(1.35, -1.0, uInkReveal);
	float m = smoothstep(f0 - 0.02, f0 + 0.14, field);
	float front = exp(-pow((field - f0 - 0.06) / 0.07, 2.0)) * step(0.001, uInkReveal) * step(uInkReveal, 0.999);

	vec3 col = shade(c);
	float lum = dot(col, vec3(0.299, 0.587, 0.114));
	// 墨染：立绘本身的暗部再染一层淡墨，像水墨的皴染
	col = mix(col, col * vec3(0.62, 0.58, 0.56), smoothstep(0.85, 0.45, lum) * uInkWash);
	// 纸感：轻微的暖调去饱和 + 纸纹透出
	col = mix(col, vec3(lum) * vec3(1.05, 0.98, 0.86), 0.18 * uInkWash);
	col *= 1.0 - uInkWash * 0.1 * (1.0 - ifbm(uv * vec2(70.0, 95.0)));
	// 墨线：沿轮廓内侧的一道笔触，粗细与浓淡随笔势变化，偶有飞白
	float press = ifbm(uv * 6.0 + 21.0);
	float lineW = 0.25 + 0.55 * press;
	float line = 1.0 - smoothstep(0.5, 0.5 + lineW, aM);
	line *= smoothstep(0.18, 0.4, ifbm(uv * 30.0 + 40.0) + press * 0.3);
	if (uInkPaint > 0.0) {
		col = mix(col, inkPainting(c, uv, uv + wob * 0.004, press), uInkPaint);
		// 水墨画也受轮廓光（如火光）勾亮；未设 rim 时 uRimCol = 0，不生效
		vec3 rn = texture(uNormal, vUV).xyz * 2.0 - 1.0;
		rn.xy *= uDepthScale;
		rn = normalize(uRot * normalize(rn));
		float rf = pow(clamp(1.0 - rn.z, 0.0, 1.0), uRimPow);
		float rs = max(dot(rn.xy / max(length(rn.xy), 1e-4), normalize(uRimDir + 1e-6)), 0.0);
		col += uRimCol * rf * rs * 0.5 * uInkPaint;
	}
	col = mix(col, vec3(0.06, 0.048, 0.04), clamp(line * uInkLine, 0.0, 1.0));
	col = mix(col, inkC, front * 0.6);

	// 合成（预乘）：墨晕 < 墨影 < 颜色
	float aCol = c.a * m;
	float aBody = bodyA * uInkSil * (1.0 - m);
	float hA = halo * (1.0 - aBody);
	vec4 P = vec4(vec3(0.28, 0.25, 0.22) * hA, hA);
	P = vec4(inkC * aBody, aBody) + P * (1.0 - aBody);
	P = vec4(col * aCol, aCol) + P * (1.0 - aCol);
	return P * uOpacity;
}


/**
 * 油画模式（《永恒之花》）：从立绘本身推算——
 * 1. Kuwahara 滤波：四个象限里取颜色最平稳的一块的均值，细节合并成一块块色面（像刮刀 / 平头笔铺色），轮廓仍然清楚；
 * 2. 笔触：沿明暗等高线方向拉长的鬃毛纹，凸起处受左上方的光（厚涂的颜料起伏）；
 * 3. 画布纹与一层很薄的暖色罩染（uOilWarm）。
 * 形状（alpha）与原立绘一致，只改颜色的"画法"。
 */
vec3 oilColor(vec2 uv) {
	vec4 best = vec4(0.0);
	float bestV = 1e9;
	float r = uOilR;
	for (int q = 0; q < 4; q++) {
		vec2 sgn = vec2(q == 1 || q == 3 ? 1.0 : -1.0, q >= 2 ? 1.0 : -1.0);
		vec3 sum = vec3(0.0);
		vec3 sum2 = vec3(0.0);
		float wa = 0.0;
		for (int j = 0; j < 3; j++)
			for (int i = 0; i < 3; i++) {
				vec2 o = sgn * vec2(float(i) + 0.5, float(j) + 0.5) / 3.0 * r;
				vec4 c = textureLod(uArt, uv + o, 1.0);
				vec3 u = c.rgb / max(c.a, 1e-4);
				sum += u * c.a;
				sum2 += u * u * c.a;
				wa += c.a;
			}
		if (wa < 0.5) continue;
		vec3 m = sum / wa;
		vec3 v = sum2 / wa - m * m;
		float var = v.r + v.g + v.b;
		if (var < bestV) { bestV = var; best = vec4(m, 1.0); }
	}
	if (best.a < 0.5) {
		vec4 c = texture(uArt, uv);
		return c.rgb / max(c.a, 1e-4);
	}
	return best.rgb;
}

vec4 oilMode(vec4 c) {
	vec2 uv = vUV;
	vec3 base = c.rgb / max(c.a, 1e-4);
	vec3 k = oilColor(uv);
	// 笔触方向：沿明暗的等高线（垂直于亮度梯度）
	float e = uOilR * 0.8;
	float lx = dot(textureLod(uArt, uv + vec2(e, 0.0), 2.5).rgb - textureLod(uArt, uv - vec2(e, 0.0), 2.5).rgb, vec3(0.333));
	float ly = dot(textureLod(uArt, uv + vec2(0.0, e), 2.5).rgb - textureLod(uArt, uv - vec2(0.0, e), 2.5).rgb, vec3(0.333));
	vec2 g = vec2(lx, ly);
	vec2 dir = length(g) > 1e-3 ? normalize(vec2(-g.y, g.x)) : normalize(vec2(0.8, 0.6));
	vec2 nrm = vec2(-dir.y, dir.x);
	float along = dot(uv, dir) / uOilR;
	float across = dot(uv, nrm) / uOilR;
	float bristle = ifbm(vec2(along * 0.9, across * 7.0) + 17.0);
	float dab = ifbm(vec2(along * 0.35, across * 0.8) + 3.0);
	// 厚涂起伏：鬃毛纹的横向导数当作法线，受左上方的光
	float h1 = ifbm(vec2(along * 0.9, (across + 0.15) * 7.0) + 17.0);
	float ridge = (h1 - bristle) * 4.0;
	vec3 col = k * (0.93 + 0.12 * bristle) * (0.96 + 0.08 * dab);
	col += ridge * 0.06 * (0.4 + 0.6 * k);
	// 薄暖罩染 + 画布纹
	float L = dot(col, vec3(0.299, 0.587, 0.114));
	col = mix(col, col * vec3(1.06, 0.98, 0.86) + vec3(0.02, 0.01, 0.0), uOilWarm);
	float weave = (sin(uv.x * 900.0) * sin(uv.y * 900.0)) * 0.5 + 0.5;
	col *= 0.975 + 0.035 * weave;
	col = mix(base, col, uOilAmt);
	vec4 P = vec4(col * c.a, c.a);
	return vec4(shade(P), c.a);
}

vec3 stitchColor(vec4 c) {
	vec2 uv = vUV;
	vec3 base = c.rgb / max(c.a, 1e-4);
	float e = 0.003;
	vec4 a = textureLod(uArt, uv + vec2(e, 0.0), 1.0);
	vec4 b = textureLod(uArt, uv - vec2(e, 0.0), 1.0);
	vec4 d = textureLod(uArt, uv + vec2(0.0, e), 1.0);
	vec4 f = textureLod(uArt, uv - vec2(0.0, e), 1.0);
	float gx = dot(a.rgb - b.rgb, vec3(.299, .587, .114));
	float gy = dot(d.rgb - f.rgb, vec3(.299, .587, .114));
	vec2 g = vec2(gx, gy);
	vec2 normal = texture(uNormal, uv).xy * 2.0 - 1.0;
	vec2 dir = length(g) > .025 ? normalize(vec2(-g.y, g.x)) : normalize(vec2(.8, .6) + normal * .28);
	vec2 side = vec2(-dir.y, dir.x);
	float across = dot(uv, side) * uStitchFreq;
	float row = floor(across);
	float phase = dot(uv, dir) * uStitchFreq * .17 + ihash(vec2(row, 9.0));
	float thread = pow(max(0.0, sin(fract(across) * 3.14159265)), .65);
	float ends = smoothstep(.03, .16, fract(phase)) * smoothstep(.97, .84, fract(phase));
	float fibers = (ihash(floor(uv * uStitchFreq * 4.0)) - .5) * .045;
	vec3 wool = mix(floor(base * 7.0 + .5) / 7.0, base, .38);
	wool *= .76 + .28 * thread * ends + fibers;
	float edge = max(max(abs(c.a - a.a), abs(c.a - b.a)), max(abs(c.a - d.a), abs(c.a - f.a)));
	float innerEdge = smoothstep(.12, .42, length(g));
	float rope = .65 + .35 * sin((across + phase * 3.0) * 6.283185);
	wool = mix(wool, wool * (.43 + .18 * rope), clamp(edge * .85 + innerEdge * .32, 0.0, .8));
	vec4 woven = vec4(mix(base, wool, uStitchAmount) * c.a, c.a);
	return shade(woven);
}

/**
 * 排线模式（《世界的背面》）：从立绘本身推算的版画——暗底上刻出亮线，亮处线粗、暗处线细，
 * 最亮处再加一层交叉线；立绘里偏红的部分（翅尖、条纹）刻成暗红线；轮廓一圈亮线。
 * uHatchBody：轮廓里垫的暗色（影子），uHatchAmt：线的亮度，uHatchReveal：从 uHatchCenter 渗出原色。
 */
vec4 hatchMode(vec4 c) {
	vec2 uv = vUV;
	float t = uHatchTime;
	vec2 wob = vec2(ifbm(uv * 6.0 + vec2(0.0, t * 0.04)), ifbm(uv * 6.0 + 5.1 - vec2(t * 0.035, 0.0))) - 0.5;
	float aS = textureLod(uArt, uv + wob * 0.006, 1.5).a;
	float aB = textureLod(uArt, uv + wob * 0.02, 3.5).a;
	float shape = smoothstep(0.3, 0.6, aS);
	vec3 col = shade(c);
	float L = dot(col, vec3(0.299, 0.587, 0.114));
	vec3 srgb = c.rgb / max(c.a, 1e-4);
	float red = smoothstep(0.06, 0.28, srgb.r - max(srgb.g, srgb.b));

	// 两组排线：主线随亮度变粗，交叉线只在亮处
	float j = (ifbm(uv * 14.0 + 3.0) - 0.5) * 0.35;
	float u1 = dot(uv, vec2(0.82, 0.57)) * uHatchFreq + j;
	float u2 = dot(uv, vec2(-0.6, 0.8)) * uHatchFreq * 0.9 + j * 0.7;
	float d1 = min(fract(u1), 1.0 - fract(u1)) * 2.0;
	float d2 = min(fract(u2), 1.0 - fract(u2)) * 2.0;
	float w1 = clamp(0.03 + L * 0.75, 0.0, 0.8);
	float w2 = clamp((L - 0.5) * 1.2, 0.0, 0.5);
	float aa1 = fwidth(u1) * 2.0;
	float aa2 = fwidth(u2) * 2.0;
	float l1 = 1.0 - smoothstep(w1 - aa1, w1 + aa1, d1);
	float l2 = (1.0 - smoothstep(w2 - aa2, w2 + aa2, d2)) * step(0.001, w2);
	float engr = max(l1, l2 * 0.8);
	float edge = smoothstep(0.08, 0.5, aS) * (1.0 - smoothstep(0.45, 0.9, aB));

	vec3 lineC = mix(uHatchCol, vec3(0.86, 0.16, 0.12), red * 0.85) * (0.55 + 0.7 * L);
	float lineA = clamp((engr * 0.85 + edge * 0.9) * uHatchAmt, 0.0, 1.0) * shape;
	float bodyA = shape * uHatchBody;
	vec4 P = vec4(lineC * lineA, lineA) + vec4(vec3(0.02, 0.017, 0.024) * bodyA, bodyA) * (1.0 - lineA);

	// 显色：原色从 uHatchCenter 向外渗开，前沿一圈金线
	float field = 1.0 - length((uv - uHatchCenter) * 1.6) + (ifbm(uv * 4.0 + 9.0 + t * 0.02) - 0.5) * 0.5;
	float f0 = mix(1.3, -1.0, uHatchReveal);
	float m = smoothstep(f0 - 0.02, f0 + 0.12, field);
	float front = exp(-pow((field - f0 - 0.05) / 0.06, 2.0)) * step(0.001, uHatchReveal) * step(uHatchReveal, 0.999);
	vec4 C = vec4(col * c.a, c.a);
	vec4 O = mix(P, C, m);
	O.rgb += uHatchCol * front * 1.2 * shape;
	return O * uOpacity;
}

void main() {
	vec4 c = texture(uArt, vUV); // 预乘 alpha
	if (uHatchOn > 0.5) {
		vec4 P = hatchMode(c);
		if (P.a < 0.002) discard;
		outColor = P;
		return;
	}
	if (uInkOn > 0.5) {
		vec4 P = inkMode(c);
		if (P.a < 0.002) discard;
		outColor = P;
		return;
	}
	if (c.a < 0.002) discard;
	if (uSilhouetteOn > 0.5) {
		float a = c.a * uOpacity;
		outColor = vec4(uSilhouetteColor * a, a);
		return;
	}
	if (uStitchOn > 0.5) {
		float a = c.a * uOpacity;
		outColor = vec4(stitchColor(c) * a, a);
		return;
	}
	if (uOilOn > 0.5) {
		vec4 o = oilMode(c);
		float oa = o.a * uOpacity;
		outColor = vec4(o.rgb * oa, oa);
		return;
	}
	vec3 col = shade(c);
	if (uSpectrum.x > 0.0) {
		// 在整个立绘的 alpha 轮廓内流动，连原图的暗色部分也会发光。
		float phase = vUV.x * 0.83 - vUV.y * 1.38 + uSpectrum.y;
		vec3 rainbow = 0.59 + 0.41 * cos(6.283185 * (phase + vec3(0.0, 0.66667, 0.33333)));
		float sheen = pow(0.5 + 0.5 * sin(phase * 12.56637), 3.0);
		vec3 radiance = mix(rainbow, vec3(1.0), 0.12 + sheen * 0.27);
		col = mix(col, radiance, uSpectrum.x * 0.82) + radiance * uSpectrum.x * 0.24;
	}
	float a = c.a * uOpacity;
	outColor = vec4(col * a, a);
}`;

// ─── 资源加载（模块级缓存，同一张图只加载一次）──────────────────────────
const imageCache = new Map<string, Promise<HTMLImageElement>>();
const loadImage = (src: string) => {
	if (!imageCache.has(src)) {
		imageCache.set(
			src,
			new Promise((resolve, reject) => {
				const img = new Image();
				img.onload = () => resolve(img);
				img.onerror = () => reject(new Error(`failed to load ${src}`));
				img.src = src;
			}),
		);
	}
	return imageCache.get(src)!;
};
const jsonCache = new Map<string, Promise<{maxDepth: number}>>();
const loadJson = (src: string) => {
	if (!jsonCache.has(src)) jsonCache.set(src, fetch(src).then((r) => r.json()));
	return jsonCache.get(src)!;
};

type Assets = {art: HTMLImageElement; depth: HTMLImageElement; normal: HTMLImageElement; maxDepth: number};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
	const s = gl.createShader(type)!;
	gl.shaderSource(s, src);
	gl.compileShader(s);
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'compile failed');
	return s;
};

const texture = (gl: WebGL2RenderingContext, img: HTMLImageElement, unit: number, color: boolean) => {
	const t = gl.createTexture()!;
	gl.activeTexture(gl.TEXTURE0 + unit);
	gl.bindTexture(gl.TEXTURE_2D, t);
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, color);
	gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
	gl.generateMipmap(gl.TEXTURE_2D);
	// 深度图 R/G 拆分存 16 位：h = R·256 + G 是线性的，双线性插值后再合并仍然正确
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, color ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	return t;
};

const rotation = (yawDeg: number, pitchDeg: number): number[] => {
	const y = (yawDeg * Math.PI) / 180;
	const p = (pitchDeg * Math.PI) / 180;
	const cy = Math.cos(y);
	const sy = Math.sin(y);
	const cp = Math.cos(p);
	const sp = Math.sin(p);
	// R = Rx(pitch) · Ry(yaw)，列主序
	// yaw > 0：右侧转向观众；pitch > 0：顶部转向观众（模型 y 向下）
	const r = [
		[cy, 0, -sy],
		[sp * sy, cp, sp * cy],
		[cp * sy, -sp, cp * cy],
	];
	return [r[0][0], r[1][0], r[2][0], r[0][1], r[1][1], r[2][1], r[0][2], r[1][2], r[2][2]];
};

/** 水墨模式参数，都是 0–1 */
export type InkStyle = {
	/** 墨影：0 = 无，1 = 墨洇满整个轮廓（显色前） */
	silhouette?: number;
	/** 显色进度：0 = 尚未显色，1 = 原色完全显出 */
	reveal?: number;
	/** 沿轮廓的墨线强度 */
	line?: number;
	/** 轮廓外的淡墨晕 */
	halo?: number;
	/** 纸感（轻微暖调去饱和、纸纹透出） */
	wash?: number;
	/** 墨边缓慢流动用的时间（秒） */
	time?: number;
	/** 显色从哪里开始（立绘 UV，0–1） */
	center?: [number, number];
	/** 0 = 原色 + 墨感；1 = 水墨画（描线成毛笔线、明暗成墨分浓淡、亮面留白） */
	paint?: number;
	/** 水墨画里保留的颜色：0 = 纯墨，约 0.3 = 淡彩，1 = 原色 */
	color?: number;
};

/** 排线模式参数（《世界的背面》），都是 0–1（freq 除外） */
export type HatchStyle = {
	/** 线的亮度：0 = 没有线 */
	amount?: number;
	/** 轮廓里垫的暗色：1 = 实心的影子，0 = 只有线 */
	body?: number;
	/** 显色进度：0 = 只有排线，1 = 原色完全显出 */
	reveal?: number;
	/** 线的颜色（偏红的部分自动刻成暗红），线性 0–1 */
	color?: Vec3;
	/** 横跨立绘的线数，默认 90 */
	freq?: number;
	/** 边缘缓慢流动用的时间（秒） */
	time?: number;
	/** 显色从哪里开始（立绘 UV） */
	center?: [number, number];
};

/** 油画模式参数（《永恒之花》） */
export type OilStyle = {
	/** 0 = 原立绘，1 = 完全油画化 */
	amount?: number;
	/** 色块 / 笔触尺寸（立绘 UV，约 0.004–0.012） */
	radius?: number;
	/** 暖色罩染 0–1 */
	warm?: number;
};

export type StitchStyle = {
	amount?: number;
	frequency?: number;
};

type GLState = {
	gl: WebGL2RenderingContext;
	program: WebGLProgram;
	count: number;
	loc: (name: string) => WebGLUniformLocation | null;
};

type Art3DProps = {
	/** 立绘目录，如 'pokemon/groudon' */
	dir: string;
	/** 文件名后缀，如 '-primal'（对应 art-primal.png / depth-primal.png …） */
	variant?: string;
	x: number;
	y: number;
	/** 立绘显示边长（与 PokemonArt 相同） */
	size: number;
	yaw?: number;
	pitch?: number;
	/** 深度强度：1 = 完整的半球，建议 0.3–0.6 */
	depthScale?: number;
	ambient?: Vec3;
	dirLights?: DirLight[];
	pointLights?: PointLight[];
	rim?: Rim;
	/** 纹路自发光：只点亮明亮且有颜色的部分，不受环境光影响 */
	emissive?: number;
	emissiveTint?: Vec3;
	/** 自发光的取色阈值 [亮度下限, 亮度上限, 饱和度下限, 饱和度上限] */
	emissiveKey?: [number, number, number, number];
	/** 整个轮廓内的虹彩发光强度与相位。 */
	spectrum?: {strength: number; phase: number};
	brightness?: number;
	opacity?: number;
	/** 水墨模式（第 3 期）：不传则与原立绘完全一致 */
	ink?: InkStyle;
	/** 油画模式（《永恒之花》）：不传则与原立绘完全一致 */
	oil?: OilStyle;
	stitch?: StitchStyle;
	silhouette?: {color?: Vec3};
	/** 排线模式（《世界的背面》）：不传则与原立绘完全一致 */
	hatch?: HatchStyle;
	/** 渲染分辨率倍数，镜头推近时保持清晰 */
	resolution?: number;
	style?: React.CSSProperties;
};

const Art3DInner: React.FC<Art3DProps> = ({
	dir,
	variant = '',
	x,
	y,
	size,
	yaw = 0,
	pitch = 0,
	depthScale = 0.45,
	ambient = [1, 1, 1],
	dirLights = [],
	pointLights = [],
	rim,
	emissive = 0,
	emissiveTint = [1, 1, 1],
	emissiveKey = [0.55, 0.75, 0.08, 0.22],
	spectrum,
	brightness = 1,
	opacity = 1,
	ink,
	oil,
	stitch,
	silhouette,
	hatch,
	resolution = 1.5,
	style,
}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const stateRef = useRef<GLState | null>(null);
	const [assets, setAssets] = useState<Assets | null>(null);
	const [handle] = useState(() => delayRender(`PokemonArt3D ${dir}${variant}`));
	const doneRef = useRef(false);

	// 转身时轮廓会略微外扩，画布四周留出余量
	const PAD = 1.12;
	const px = Math.round(size * PAD * resolution);

	const urls = useMemo(
		() => ({
			art: staticFile(`${dir}/art${variant}.png`),
			depth: staticFile(`${dir}/depth${variant}.png`),
			normal: staticFile(`${dir}/normal${variant}.png`),
			json: staticFile(`${dir}/depth${variant}.json`),
		}),
		[dir, variant],
	);

	useLayoutEffect(() => {
		let alive = true;
		Promise.all([loadImage(urls.art), loadImage(urls.depth), loadImage(urls.normal), loadJson(urls.json)])
			.then(([art, depth, normal, meta]) => alive && setAssets({art, depth, normal, maxDepth: meta.maxDepth}))
			.catch((e) => {
				throw e;
			});
		return () => {
			alive = false;
		};
	}, [urls]);

	useLayoutEffect(() => {
		if (!assets) return;
		const canvas = canvasRef.current!;
		const gl = canvas.getContext('webgl2', {preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: true})!;
		const program = gl.createProgram()!;
		gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
		gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
		gl.useProgram(program);

		// 网格
		const uv = new Float32Array((GRID + 1) * (GRID + 1) * 2);
		for (let j = 0; j <= GRID; j++)
			for (let i = 0; i <= GRID; i++) {
				uv[(j * (GRID + 1) + i) * 2] = i / GRID;
				uv[(j * (GRID + 1) + i) * 2 + 1] = j / GRID;
			}
		const idx = new Uint32Array(GRID * GRID * 6);
		let k = 0;
		for (let j = 0; j < GRID; j++)
			for (let i = 0; i < GRID; i++) {
				const a = j * (GRID + 1) + i;
				const b = a + 1;
				const c = a + GRID + 1;
				const d = c + 1;
				idx.set([a, c, b, b, c, d], k);
				k += 6;
			}
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
		const aUV = gl.getAttribLocation(program, 'aUV');
		gl.enableVertexAttribArray(aUV);
		gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

		texture(gl, assets.art, 0, true);
		texture(gl, assets.depth, 1, false);
		texture(gl, assets.normal, 2, false);

		const cache = new Map<string, WebGLUniformLocation | null>();
		const loc = (name: string) => {
			if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
			return cache.get(name)!;
		};
		gl.uniform1i(loc('uArt'), 0);
		gl.uniform1i(loc('uDepth'), 1);
		gl.uniform1i(loc('uNormal'), 2);
		stateRef.current = {gl, program, count: idx.length, loc};
		return () => {
			gl.getExtension('WEBGL_lose_context')?.loseContext();
			stateRef.current = null;
		};
	}, [assets]);

	// 每一帧同步绘制
	useLayoutEffect(() => {
		const s = stateRef.current;
		if (!s || !assets) return;
		const {gl, loc} = s;
		gl.viewport(0, 0, px, px);
		gl.clearColor(0, 0, 0, 0);
		gl.clearDepth(1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LESS);

		const depthMax = assets.maxDepth * depthScale;
		gl.uniform1f(loc('uDepthMax'), depthMax);
		gl.uniform1f(loc('uDepthScale'), depthScale);
		gl.uniform1f(loc('uPivot'), depthMax * 0.5);
		gl.uniform1f(loc('uDist'), 6);
		gl.uniform1f(loc('uExtent'), PAD / 2);
		gl.uniformMatrix3fv(loc('uRot'), false, rotation(yaw, pitch));
		gl.uniform3fv(loc('uAmbient'), ambient);
		for (let i = 0; i < MAX_DIR; i++) {
			const l = dirLights[i];
			gl.uniform3fv(loc(`uDirDir[${i}]`), l ? l.dir : [0, 0, 1]);
			gl.uniform3fv(loc(`uDirCol[${i}]`), l ? l.color : [0, 0, 0]);
			gl.uniform1f(loc(`uDirWrap[${i}]`), l?.wrap ?? 0.3);
		}
		for (let i = 0; i < MAX_POINT; i++) {
			const l = pointLights[i];
			gl.uniform3fv(loc(`uPtPos[${i}]`), l ? l.pos : [0, 0, 1]);
			gl.uniform3fv(loc(`uPtCol[${i}]`), l ? l.color : [0, 0, 0]);
			gl.uniform1f(loc(`uPtRad[${i}]`), l ? l.radius : 1);
		}
		gl.uniform2fv(loc('uRimDir'), rim ? rim.dir : [0, -1]);
		gl.uniform3fv(loc('uRimCol'), rim ? rim.color : [0, 0, 0]);
		gl.uniform1f(loc('uRimPow'), rim?.power ?? 3);
		gl.uniform1f(loc('uEmissive'), emissive);
		gl.uniform3fv(loc('uEmTint'), emissiveTint);
		gl.uniform4fv(loc('uEmKey'), emissiveKey);
		gl.uniform2f(loc('uSpectrum'), spectrum?.strength ?? 0, spectrum?.phase ?? 0);
		gl.uniform1f(loc('uBrightness'), brightness);
		gl.uniform1f(loc('uOpacity'), opacity);
		gl.uniform1f(loc('uInkOn'), ink ? 1 : 0);
		gl.uniform1f(loc('uInkSil'), ink?.silhouette ?? 0);
		gl.uniform1f(loc('uInkReveal'), ink?.reveal ?? 1);
		gl.uniform1f(loc('uInkLine'), ink?.line ?? 0);
		gl.uniform1f(loc('uInkHalo'), ink?.halo ?? 0);
		gl.uniform1f(loc('uInkWash'), ink?.wash ?? 0);
		gl.uniform1f(loc('uInkTime'), ink?.time ?? 0);
		gl.uniform2fv(loc('uInkCenter'), ink?.center ?? [0.5, 0.5]);
		gl.uniform1f(loc('uInkPaint'), ink?.paint ?? 0);
		gl.uniform1f(loc('uInkColor'), ink?.color ?? 0.3);
		gl.uniform1f(loc('uOilOn'), oil ? 1 : 0);
		gl.uniform1f(loc('uOilAmt'), oil?.amount ?? 1);
		gl.uniform1f(loc('uOilR'), oil?.radius ?? 0.007);
		gl.uniform1f(loc('uOilWarm'), oil?.warm ?? 0.3);
		gl.uniform1f(loc('uStitchOn'), stitch ? 1 : 0);
		gl.uniform1f(loc('uStitchAmount'), stitch?.amount ?? 1);
		gl.uniform1f(loc('uStitchFreq'), stitch?.frequency ?? 280);
		gl.uniform1f(loc('uSilhouetteOn'), silhouette ? 1 : 0);
		gl.uniform3fv(loc('uSilhouetteColor'), silhouette?.color ?? [0.04, 0.025, 0.03]);
		gl.uniform1f(loc('uHatchOn'), hatch ? 1 : 0);
		gl.uniform1f(loc('uHatchAmt'), hatch?.amount ?? 1);
		gl.uniform1f(loc('uHatchBody'), hatch?.body ?? 1);
		gl.uniform1f(loc('uHatchReveal'), hatch?.reveal ?? 0);
		gl.uniform3fv(loc('uHatchCol'), hatch?.color ?? [0.95, 0.78, 0.42]);
		gl.uniform1f(loc('uHatchFreq'), hatch?.freq ?? 90);
		gl.uniform1f(loc('uHatchTime'), hatch?.time ?? 0);
		gl.uniform2fv(loc('uHatchCenter'), hatch?.center ?? [0.5, 0.5]);
		gl.drawElements(gl.TRIANGLES, s.count, gl.UNSIGNED_INT, 0);
		if (!doneRef.current) {
			doneRef.current = true;
			continueRender(handle);
		}
	});

	const box = size * PAD;
	return (
		<canvas
			ref={canvasRef}
			width={px}
			height={px}
			style={{position: 'absolute', left: x - box / 2, top: y - box / 2, width: box, height: box, ...style}}
		/>
	);
};

/**
 * 换一只宝可梦（dir / variant 变化）时整个重新挂载：
 * 失效的 WebGL 上下文不能在同一块画布上复用，且新素材需要重新 delayRender 等待加载。
 */
export const PokemonArt3D: React.FC<Art3DProps> = (props) => <Art3DInner key={`${props.dir}${props.variant ?? ''}`} {...props} />;
