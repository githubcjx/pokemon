import {COMMON} from '../../gl/shaders';

/** 火光沿着不平整的石灰岩移动，照出颜料、石缝和凿痕。 */
export const PILLAR_WALL_FRAG = `${COMMON}
uniform vec2 uLamp;
uniform float uRelief;
uniform float uGlow;

void main() {
	vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
	vec2 p = (uv - 0.5) * vec2(1.77778, 1.0);
	vec2 stone = p * vec2(5.9, 8.4) + vec2(0.4, 8.0);
	float grain = noise(stone * 13.0);
	float ridge = fbm(stone + vec2(fbm(stone * 0.53)) * 0.72);
	float veins = fbm(vec2(stone.x * 0.66 + ridge * 1.9, stone.y * 1.16));
	float scale = 0.15 + 0.16 * uRelief;
	vec2 tile = uv * vec2(4.0, 5.4) + vec2(0.11, -0.52);
	tile.x += 0.51 * mod(floor(tile.y), 2.0);
	vec2 face = abs(fract(tile + (ridge - 0.48) * 0.057) - 0.5);
	float seam = smoothstep(0.45, 0.499, max(face.x, face.y));
	float pocket = smoothstep(0.68, 0.98, grain + ridge * 0.27);
	float faceEdge = smoothstep(0.40, 0.455, max(face.x, face.y)) * (1.0 - seam);
	float field = smoothstep(0.02, 0.11, uv.x) * (1.0 - smoothstep(0.89, 0.98, uv.x));
	field *= smoothstep(0.08, 0.21, uv.y) * (1.0 - smoothstep(0.77, 0.87, uv.y));

	vec2 lamp = (uv - uLamp) * vec2(1.55, 1.0);
	float flicker = 0.95 + 0.05 * sin(uTime * 5.3) * sin(uTime * 3.2 + 1.1);
	float wash = exp(-dot(lamp, lamp) * (2.8 + 0.6 * uRelief)) * flicker;
	vec3 base = mix(vec3(0.073, 0.034, 0.024), vec3(0.324, 0.192, 0.111), ridge);
	base += vec3(0.25, 0.13, 0.052) * veins * scale;
	base *= 1.0 - (0.50 - 0.30 * uRelief * field) * seam - pocket * 0.13;
	base += vec3(0.16, 0.094, 0.049) * faceEdge * (1.0 - 0.62 * field * uRelief) * wash;
	base *= mix(0.44, 1.67, wash) * (0.59 + 0.41 * field);
	base += vec3(0.20, 0.095, 0.040) * wash * uGlow;
	base *= 1.0 - 0.42 * smoothstep(0.39, 0.93, length(p * vec2(0.8, 1.14)));
	outColor = vec4(base, 1.0);
}
`;
