import {COMMON} from '../../gl/shaders';

/** 冰蓝弧光外是深空，弧光内可见云带和地表暗纹。 */
export const ORBIT_FRAG = `${COMMON}
uniform float uRise;
uniform float uDrift;
uniform float uGlare;
uniform float uWarm;

void main() {
	vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
	vec2 p = vec2((uv.x - 0.5) * 1.77778, uv.y);
	float t = uTime * 0.017;
	float radius = 1.48;
	vec2 center = vec2(-0.13 + uDrift * 0.13, 0.62 + uRise * 0.29 + radius);
	vec2 globe = p - center;
	float d = length(globe) - radius;

	vec3 col = vec3(0.011, 0.019, 0.043);
	float haze = fbm(vec2(p.x * 2.9 + t, p.y * 4.8 - t)) * exp(-abs(uv.y - 0.39 + 0.10 * sin(uv.x * 6.0)) * 5.6);
	col += vec3(0.09, 0.14, 0.28) * haze * 0.28;
	vec2 grid = vec2(uv.x * 192.0 + uDrift * 8.0, uv.y * 108.0 + uRise * 6.0);
	vec2 cell = floor(grid);
	float seed = hash(cell);
	vec2 centerStar = vec2(hash(cell + 11.0), hash(cell + 7.0)) * 0.68 + 0.16;
	float grain = length(fract(grid) - centerStar);
	float star = (1.0 - smoothstep(0.018, 0.14, grain)) * step(0.939, seed);
	col += vec3(0.57, 0.73, 0.97) * star * (0.32 + 0.22 * sin(seed * 731.0 + uTime * 1.44));

	vec2 terrain = vec2(globe.x * 3.1 + uDrift * 0.75 + t * 0.24, globe.y * 7.9);
	float crag = fbm(terrain * vec2(1.9, 1.4));
	float clouds = fbm(terrain * vec2(1.57, 2.85) + vec2(0.0, crag) * 1.8);
	vec3 planet = mix(vec3(0.033, 0.088, 0.169), vec3(0.119, 0.18, 0.21), smoothstep(0.36, 0.59, crag));
	planet = mix(planet, vec3(0.39, 0.51, 0.62), smoothstep(0.37, 0.72, clouds) * 0.78);
	planet *= 0.35 + 0.56 * smoothstep(0.12, 0.89, uv.x);
	col = mix(col, planet, 1.0 - smoothstep(-0.004, 0.001, d));

	float rim = exp(-abs(d) * 162.0);
	float outer = exp(-max(d, 0.0) * 35.0) * smoothstep(-0.11, -0.014, d);
	vec3 ice = mix(vec3(0.24, 0.55, 0.91), vec3(0.39, 0.72, 0.88), uWarm);
	col += ice * (0.67 * rim + 0.29 * outer) * (0.5 + 0.5 * smoothstep(0.14, 0.89, uv.x));
	col += vec3(0.74, 0.84, 0.87) * uGlare * exp(-length(vec2(uv.x - 0.65, uv.y - 0.42)) * 3.8) * 0.37;
	col *= 1.0 - 0.30 * smoothstep(0.4, 0.93, length((uv - 0.5) * vec2(1.1, 0.8)));
	outColor = vec4(col, 1.0);
}
`;

/** 岩体投影和裂纹随翻滚而移动，撞击前只点亮受光的一面。 */
export const METEOR_BODY_FRAG = `${COMMON}
uniform float uTurn;
uniform float uHeat;

void main() {
	vec2 uv = (gl_FragCoord.xy / uRes - 0.5) * 2.0;
	float cs = cos(uTurn);
	float sn = sin(uTurn);
	vec2 p = mat2(cs, sn, -sn, cs) * uv;
	float a = atan(p.y, p.x);
	float shape = 0.79 + 0.047 * cos(a * 5.0 + 0.3) + 0.037 * sin(a * 9.0) + 0.019 * cos(a * 17.0);
	float dist = length(p) - shape;
	if (dist > 0.01) discard;

	vec2 q = p * vec2(6.5, 5.5);
	float weather = fbm(q + fbm(q * 0.47) * 1.5);
	float granular = noise(q * 12.0);
	float facet = noise(q * 0.62 + 6.0);
	float gully = fbm(q * 1.85 + 9.0 + weather * 2.1);
	float seam = exp(-abs(gully - 0.47) * 67.0) * smoothstep(0.21, 0.67, facet);
	float z = sqrt(max(0.0, 1.0 - dot(p, p) / (shape * shape)));
	vec3 n = normalize(vec3(uv, z * 0.78));
	float day = smoothstep(-0.51, 0.83, dot(n, normalize(vec3(-0.74, -0.46, 0.39))));
	vec3 stone = mix(vec3(0.135, 0.122, 0.135), vec3(0.48, 0.373, 0.301), smoothstep(0.22, 0.68, weather));
	stone *= 0.56 + facet * 0.62 + granular * 0.13;
	stone *= 0.23 + day * 0.89;
	stone *= 1.0 - seam * 0.63;
	stone += vec3(0.54, 0.36, 0.12) * seam * uHeat * day;
	stone += vec3(0.31, 0.37, 0.47) * exp(-abs(dist) * 73.0) * (0.24 + day * 0.67);
	float edge = 1.0 - smoothstep(-0.004, 0.008, dist);
	outColor = vec4(stone, edge);
}
`;
