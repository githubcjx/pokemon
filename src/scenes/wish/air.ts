import {COMMON} from '../../gl/shaders';

/** 镜头掠过云顶时，远处的云层压薄，近处的云团随距离拉开。 */
export const AIR_FRAG = `${COMMON}
uniform float uHorizon;
uniform float uDrift;
uniform float uAurora;
uniform float uDim;

float curtain(vec2 uv, float y, float phase, float t) {
	float x = uv.x + 0.14 * uv.y;
	float edge = y + 0.072 * sin(x * 5.2 + phase + t) + 0.032 * sin(x * 13.0 + phase - t);
	float folds = noise(vec2(x * 54.0 + 0.6 * sin(x * 19.0), phase));
	float d = uv.y - edge;
	float body = exp(min(0.0, d) * (13.0 + 9.0 * folds)) * exp(-max(0.0, d) * 85.0);
	return body * (0.25 + 0.75 * folds) * sin(3.14159 * clamp(x * 0.94, 0.0, 1.0));
}

void main() {
	vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
	float x = uv.x - 0.5;
	float horizon = uHorizon + 0.27 * x * x - 0.05 * x;
	float h = uv.y - horizon;
	float t = uTime * 0.05;
	vec3 col = mix(vec3(0.025, 0.036, 0.085), vec3(0.128, 0.196, 0.282), exp(-abs(h) * 3.4));
	col += vec3(0.19, 0.38, 0.53) * exp(-abs(h + 0.008) * 70.0) * 0.45;
	col += vec3(0.34, 0.46, 0.89) * curtain(uv, 0.26, 2.2, t) * uAurora * 0.40;
	col += vec3(0.33, 0.75, 0.59) * curtain(uv, 0.39, 4.9, -t * 0.65) * uAurora * 0.37;

	// 星点固定在天空上，闪烁和云层都走整期时间。
	vec2 grid = vec2(uv.x * 183.0 + uDrift * 3.0, uv.y * 97.0);
	vec2 cell = floor(grid);
	float seed = hash(cell);
	vec2 star = vec2(hash(cell + 3.0), hash(cell + 17.0)) * 0.62 + 0.19;
	float sparkle = 1.0 - smoothstep(0.02, 0.14, length(fract(grid) - star));
	col += vec3(0.56, 0.72, 0.94) * sparkle * step(0.934, seed) * (0.27 + 0.20 * sin(seed * 311.0 + t * 20.0));

	float d = max(h + 0.073, 0.0);
	vec2 plane = vec2((x + uDrift * 0.10) / (0.17 + d * 1.6), 1.25 / (0.39 + d * 3.8));
	plane += vec2(t * 0.35, t * 0.17);
	float billows = fbm(plane * 2.25 + vec2(0.0, noise(plane * 1.4) * 0.85));
	float fine = noise(plane * 13.5);
	float top = fbm(vec2(x * 5.6 - t * 0.18, 4.7 + uDrift)) - 0.47;
	float deck = smoothstep(-0.075, 0.032, h + top * 0.17);
	float cover = smoothstep(0.23, 0.58, billows + 0.12 * fine);
	vec3 cloud = mix(vec3(0.076, 0.109, 0.174), vec3(0.44, 0.57, 0.67), cover);
	cloud += vec3(0.13, 0.20, 0.29) * exp(-abs(h + top * 0.16) * 13.0);
	col = mix(col, cloud, deck * 0.96);

	col *= 1.0 - 0.47 * smoothstep(0.32, 0.79, length(vec2(x, (uv.y - 0.5) * 0.8)));
	col = mix(col, col * vec3(0.27, 0.31, 0.39) + vec3(0.008, 0.010, 0.016), uDim);
	outColor = vec4(col, 1.0);
}
`;

/** 贴近镜头的薄云。上下两次穿云与对峙时的海雾共用这一层。 */
export const VEIL_FRAG = `${COMMON}
uniform float uCenter;
uniform float uWidth;
uniform float uDensity;
uniform vec3 uTint;

void main() {
	vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
	float t = uTime * 0.09;
	vec2 p = vec2(uv.x * 4.2 + t, uv.y * 5.6 - t * 0.16);
	float n = fbm(p + vec2(noise(p * 0.62), 0.0));
	float streaks = fbm(p * vec2(1.0, 1.9) - vec2(t * 0.23, 0.0));
	float bank = 1.0 - smoothstep(0.12, 1.0, abs(uv.y - uCenter + (n - 0.46) * 0.38) / uWidth);
	float a = bank * smoothstep(0.16, 0.67, n * 0.78 + streaks * 0.22) * uDensity;
	outColor = vec4(uTint * (0.61 + streaks * 0.75), a);
}
`;

/** 冷暖两团风暴在海岸会合，中心的云顶随烈空坐降临逐渐打开。 */
export const LAND_AND_SEA_FRAG = `${COMMON}
uniform float uDescent;
uniform float uRift;
uniform float uFlash;
uniform float uCalm;

void main() {
	vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
	float x = uv.x - 0.5;
	float t = uTime * 0.08;
	float horizon = 0.67 - uDescent * 0.22 + 0.12 * x * x + x * 0.06;
	float h = uv.y - horizon;
	float d = max(0.0, h + 0.04);
	vec2 ground = vec2(x / (0.21 + d * 1.95), 1.0 / (0.25 + d * 2.45));
	float shore = -0.06 + 0.095 * sin(ground.y * 4.4) + 0.12 * (noise(ground * 4.8) - 0.5);
	float land = 1.0 - smoothstep(-0.019, 0.026, ground.x - shore);
	float elevation = fbm(ground * vec2(5.0, 4.0));
	float fracture = fbm(ground * 7.0 + vec2(elevation * 0.9, 4.0));
	float hot = exp(-abs(fracture - 0.47) * 66.0) * smoothstep(0.28, 0.65, elevation);
	vec3 rock = mix(vec3(0.052, 0.026, 0.038), vec3(0.20, 0.086, 0.066), elevation);
	rock += vec3(0.85, 0.26, 0.069) * hot * (0.39 + 0.35 * noise(ground * 12.0 - t));
	float swell = noise(ground * vec2(2.0, 7.0) + vec2(t, t * 0.48));
	float foam = pow(0.5 + 0.5 * sin(ground.y * 48.0 + swell * 5.0 + t * 11.0), 9.0);
	float shoreFoam = exp(-abs(ground.x - shore) * 32.0) * smoothstep(0.42, 0.68, swell);
	vec3 sea = mix(vec3(0.032, 0.077, 0.140), vec3(0.119, 0.252, 0.396), swell);
	sea += vec3(0.26, 0.42, 0.58) * (foam * 0.31 * swell + shoreFoam * 0.35);

	float east = smoothstep(-0.4, 0.39, x);
	vec2 sky = vec2(x * 5.4 + (east - 0.5) * t, uv.y * 7.9 + t * 0.21);
	float clouds = fbm(sky + vec2(noise(sky * 0.75), noise(sky * 0.81)) * 1.4);
	float edge = fbm(sky * 1.7 + vec2(1.5, 5.0));
	vec3 dusk = mix(vec3(0.24, 0.09, 0.064), vec3(0.079, 0.169, 0.28), east);
	vec3 col = mix(vec3(0.041, 0.049, 0.075), dusk, smoothstep(0.20, 0.78, clouds));
	col += dusk * 0.62 * exp(-abs(h) * 8.0) * edge;
	col += vec3(0.35, 0.52, 0.84) * uFlash * smoothstep(0.1, 0.7, east) * smoothstep(0.14, 0.76, clouds) * 0.29;
	col = mix(col, mix(sea, rock, land), smoothstep(-0.045, 0.079, h));

	float split = x - 0.043 * sin(uv.y * 5.0 + edge * 1.8);
	float beam = exp(-pow(split / (0.022 + uv.y * 0.26), 2.0));
	float slit = exp(-abs(split) * 38.0) * smoothstep(0.28, 0.62, edge);
	col += vec3(0.23, 0.52, 0.42) * (beam * 0.36 + slit * 0.62) * uRift * (1.0 - uv.y * 0.59);
	col = mix(col, vec3(dot(col, vec3(0.22, 0.65, 0.13))) * vec3(0.84, 1.07, 1.10), uCalm * 0.57);
	col *= 1.0 - 0.50 * smoothstep(0.31, 0.73, length(vec2(x, (uv.y - 0.41) * 0.83)));
	outColor = vec4(col, 1.0);
}
`;
