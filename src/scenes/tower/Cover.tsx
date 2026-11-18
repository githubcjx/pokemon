import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, random} from 'remotion';
import {CoverTitle} from '../../components/CoverTitle';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {COMMON, GRAIN_FRAG} from '../../gl/shaders';
import {Pagoda, PagodaRuin} from '../../three/Pagoda';
import {CameraRig, V3} from '../../three/stage';

const SKY = `${COMMON}
uniform vec2 uGlow;
uniform float uHorizon;
void main() {
	vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
	float aspect = uRes.x / uRes.y;
	vec2 q = uv * vec2(aspect, 1.0);
	vec2 p = (uv - uGlow) * vec2(aspect, 1.0);
	float r = length(p);
	float cloud = fbm(q * 3.1 + fbm(q * 2.0 + 5.7));
	vec3 col = mix(vec3(0.015, 0.027, 0.045), vec3(0.17, 0.23, 0.30), smoothstep(0.2, 0.85, cloud));
	float opening = exp(-r * r * 3.5) * (0.5 + cloud * 0.8);
	col += vec3(0.44, 0.32, 0.15) * opening * 0.7;
	float rays = pow(noise(normalize(p + 0.0001) * 10.0 + 3.1), 3.0);
	col += vec3(0.66, 0.49, 0.25) * rays * exp(-r * 1.8) * 0.24;
	for (int i = 0; i < 3; i++) {
		float fi = float(i);
		float ridge = 0.78 + fi * 0.06 - fbm(vec2(q.x * (2.0 + fi), fi * 6.3)) * 0.075;
		col = mix(col, vec3(0.055, 0.083, 0.115) * (1.0 - fi * 0.18), smoothstep(ridge - 0.003, ridge + 0.003, uv.y) * 0.65);
	}
	col = mix(col, vec3(16.0, 25.0, 35.0) / 255.0, smoothstep(uHorizon - 0.15, uHorizon - 0.01, uv.y));
	outColor = vec4(col, 1.0);
}
`;

type Layout = {
	width: number;
	height: number;
	hero: [number, number, number];
	camera: [V3, V3, number];
	tower: V3;
	ruin: V3;
	title: [number, number, number, number];
};

const WIDE: Layout = {
	width: 1920, height: 1080,
	hero: [1160, 434, 850],
	camera: [[0, 10, 65], [0, 14, -18], 34],
	tower: [-24, 0, -65],
	ruin: [15, 0, -3],
	title: [750, 155, 41, 25],
};

const STANDARD: Layout = {
	width: 1440, height: 1080,
	hero: [945, 438, 830],
	camera: [[0, 10, 70], [0, 14, -18], 37],
	tower: [-23, 0, -65],
	ruin: [12, 0, -3],
	title: [770, 143, 36, 24],
};

const PORTRAIT: Layout = {
	width: 1080, height: 1440,
	hero: [610, 540, 920],
	camera: [[0, 10, 66], [0, 20, -18], 38],
	tower: [-18, 0, -65],
	ruin: [4, 0, -7],
	title: [1160, 130, 33, 22],
};

const Cover: React.FC<{layout: Layout}> = ({layout: L}) => {
	const {width: W, height: H} = L;
	const portrait = H > W;
	const [hx, hy, size] = L.hero;
	const [pos, target, fov] = L.camera;
	const far = 600;
	const horizon = 0.5 + ((target[1] - pos[1]) / Math.hypot(target[0] - pos[0], target[2] - pos[2]) + pos[1] / far) / (2 * Math.tan(fov * Math.PI / 360));
	const dust = Array.from({length: 56}, (_, i) => ({
		x: hx + (random(`tower-cover-x${i}`) - 0.5) * size * 1.2,
		y: H * (0.2 + random(`tower-cover-y${i}`) * 0.75),
		r: 0.7 + random(`tower-cover-r${i}`) * 1.5,
		opacity: 0.14 + random(`tower-cover-a${i}`) * 0.42,
	}));

	return (
		<AbsoluteFill style={{background: '#101923', overflow: 'hidden'}}>
			<AbsoluteFill>
				<ShaderCanvas frag={SKY} width={W} height={H} uniforms={{uTime: 24, uGlow: [hx / W, (hy - size * 0.12) / H], uHorizon: horizon}} />
			</AbsoluteFill>
			<AbsoluteFill>
				<ThreeCanvas width={W} height={H} gl={{alpha: true, antialias: true}}>
					<CameraRig pos={pos} target={target} fov={fov} far={far} />
					<fog attach="fog" args={['#101923', 72, 235]} />
					<ambientLight intensity={0.55} color="#9baec6" />
					<hemisphereLight args={['#a6bdd8', '#252529', 0.75]} />
					<directionalLight position={[-35, 60, 40]} intensity={2.6} color="#a6c1e7" />
					<directionalLight position={[28, 55, 18]} intensity={3.0} color="#ffd69a" />
					<mesh rotation={[-Math.PI / 2, 0, 0]}>
						<planeGeometry args={[2000, 2000]} />
						<meshStandardMaterial color="#161d25" roughness={1} />
					</mesh>
					<group position={L.tower} scale={portrait ? 0.92 : 1}>
						<Pagoda variant="tin" />
					</group>
					<group position={L.ruin} scale={portrait ? 1.3 : 1.4}>
						<PagodaRuin frame={420} ground={false} />
					</group>
				</ThreeCanvas>
			</AbsoluteFill>
			<AbsoluteFill style={{background: `radial-gradient(ellipse ${size * 0.7}px ${size * 0.65}px at ${hx}px ${hy}px, rgba(246,193,112,0.14), transparent 78%)`, mixBlendMode: 'screen'}} />
			<PokemonArt3D dir="pokemon/ho-oh" x={hx} y={hy} size={size} yaw={-3} pitch={-1} depthScale={0.5} resolution={2}
				ambient={[0.42, 0.32, 0.24]}
				dirLights={[
					{dir: [-0.65, -0.8, 1], color: [1.35, 1.0, 0.6], wrap: 0.5},
					{dir: [0.7, 0, 0.5], color: [0.26, 0.36, 0.55], wrap: 0.35},
				]}
				rim={{dir: [-0.6, -0.6], color: [1.4, 0.82, 0.32], power: 2.6}}
				style={{filter: 'drop-shadow(0 0 24px rgba(248,189,82,0.18)) drop-shadow(0 15px 23px rgba(0,0,0,0.4))'}} />
			<svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
				{dust.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#f2d49c" opacity={d.opacity} />)}
			</svg>
			<AbsoluteFill style={{background: portrait
				? 'linear-gradient(to top, #030609 0%, rgba(3,6,9,0.95) 13%, rgba(3,6,9,0.2) 33%, transparent 45%)'
				: 'linear-gradient(to top, #030609 0%, rgba(3,6,9,0.9) 20%, rgba(3,6,9,0.15) 43%, transparent 55%)'}} />
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 83% 86% at 50% 44%, transparent 50%, rgba(0,0,0,0.55) 100%)'}} />
			<CoverTitle title="看不见的信任" hook="救回生命，换来的却是恐惧" english="THE INVISIBLE TRUST" layout={L.title} />
			<AbsoluteFill style={{mixBlendMode: 'overlay', opacity: 0.065, pointerEvents: 'none'}}>
				<ShaderCanvas frag={GRAIN_FRAG} width={W} height={H} uniforms={{uTime: 24}} />
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

export const TowerCoverWide: React.FC = () => <Cover layout={WIDE} />;
export const TowerCoverStandard: React.FC = () => <Cover layout={STANDARD} />;
export const TowerCoverPortrait: React.FC = () => <Cover layout={PORTRAIT} />;
