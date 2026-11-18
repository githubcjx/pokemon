import {LIB} from './gl';

/**
 * 究极空间跳跃骑行（第 8 段开头）：光的隧道。左右对称分屏，每半边以自己的中心为消失点；
 * 左边偏金（究极之日：骑露奈雅拉），右边偏银紫（究极之月：骑索尔迦雷欧）。
 */
export const WARP_FRAG =
	LIB +
	/* glsl */ `
uniform float uSplit;   // 1 = 左右分屏
uniform float uSpeed;   // 隧道流速
uniform float uFlash;
uniform float uLine;

vec3 tunnel(vec2 s, vec2 vp, float side) {
	vec2 d = s - vp;
	float r = length(d) + 1.0;
	float a = atan(d.y, d.x);
	float lr = log(r);
	float t = uTime * uSpeed;
	// 底色：究极空间的深紫蓝，越靠中心越亮
	vec3 col = mix(vec3(0.03, 0.02, 0.08), vec3(0.12, 0.08, 0.26), smoothstep(6.5, 3.5, lr));
	// 往外飞的光纹：按角度分成细条，沿半径流动
	float bins = 70.0;
	float ab = floor(a / 6.2832 * bins);
	float h = hash(vec2(ab, side * 3.0));
	float streak = pow(fract(lr * (0.8 + h) - t * (1.2 + h * 1.5) + h * 10.0), 10.0) * step(0.45, h);
	float edge = smoothstep(0.0, 0.25, fract(a / 6.2832 * bins)) * smoothstep(1.0, 0.75, fract(a / 6.2832 * bins));
	vec3 sc = side < 0.5 ? mix(vec3(1.0, 0.82, 0.45), prism(h), 0.45) : mix(vec3(0.78, 0.66, 1.0), prism(h), 0.45);
	col += sc * streak * edge * 1.8 * smoothstep(3.2, 5.0, lr);
	// 隧道的肋环
	float ring = exp(-pow((fract(lr * 1.6 - t * 1.6) - 0.5) / 0.04, 2.0)) * smoothstep(3.6, 5.6, lr);
	col += (side < 0.5 ? vec3(1.0, 0.86, 0.6) : vec3(0.85, 0.75, 1.0)) * ring * 0.35;
	// 消失点的白光
	col += vec3(1.0, 0.98, 0.94) * (exp(-r / 40.0) * 1.4 + exp(-r / 220.0) * 0.5);
	return col;
}

void main() {
	vec2 s = screenPos();
	vec3 col;
	if (uSplit > 0.5) {
		float right = step(960.0, s.x);
		vec2 vp = vec2(right > 0.5 ? 1440.0 : 480.0, 470.0);
		col = tunnel(s, vp, right);
		float d = abs(s.x - 960.0);
		vec3 fr = vec3(0.0);
		for (int i = 0; i < 5; i++) fr += hue(float(i) / 6.0) * exp(-pow((d - float(i) * 1.6) / 1.4, 2.0));
		col = col * (1.0 - 0.7 * smoothstep(3.0, 0.0, d) * uLine) + (vec3(1.0) * exp(-d / 1.6) + fr * 0.5) * uLine;
	} else {
		col = tunnel(s, vec2(960.0, 470.0), 0.0);
	}
	col += vec3(1.0, 0.98, 0.95) * uFlash;
	outColor = vec4(col, 1.0);
}
`;
