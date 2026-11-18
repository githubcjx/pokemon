import {AbsoluteFill, random} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {COAST_FRAG, GRAIN_FRAG, NEBULA_FRAG} from '../../gl/shaders';

type Layout = {
	width: number;
	height: number;
	groudon: [number, number, number];
	kyogre: [number, number, number];
	titleY: number;
	titleSize: number;
	englishY: number;
	hookY: number;
};

const WIDE: Layout = {
	width: 1920, height: 1080,
	groudon: [495, 655, 1040],
	kyogre: [1470, 385, 980],
	titleY: 835, titleSize: 164, englishY: 1021, hookY: 775,
};

const STANDARD: Layout = {
	width: 1440, height: 1080,
	groudon: [350, 635, 810],
	kyogre: [1110, 407, 810],
	titleY: 837, titleSize: 147, englishY: 1014, hookY: 777,
};

const PORTRAIT: Layout = {
	width: 1080, height: 1440,
	groudon: [210, 1040, 780],
	kyogre: [880, 813, 780],
	titleY: 207, titleSize: 124, englishY: 367, hookY: 1320,
};

const Cover: React.FC<{layout: Layout}> = ({layout: L}) => {
	const {width: W, height: H} = L;
	const portrait = H > W;
	const [gx, gy, gs] = L.groudon;
	const [kx, ky, ks] = L.kyogre;
	const margin = portrait ? 65 : W * 0.06;
	const boltX = W * (portrait ? 0.88 : 0.86);
	const boltY = H * (portrait ? 0.27 : 0.025);
	const boltScale = portrait ? 0.8 : 1;
	const bolt = `M ${boltX} ${boltY} l -14 ${35 * boltScale} l 8 ${12 * boltScale} l -32 ${45 * boltScale} l 13 ${5 * boltScale} l -36 ${55 * boltScale} l 6 ${18 * boltScale} l -35 ${48 * boltScale}`;
	const branch = `M ${boltX - 38} ${boltY + 92 * boltScale} l 32 ${23 * boltScale} l -5 ${19 * boltScale} l 29 ${27 * boltScale}`;
	const hookSize = portrait ? 34 : 36;

	return (
		<AbsoluteFill style={{background: '#090909', overflow: 'hidden'}}>
			<ShaderCanvas
				frag={COAST_FRAG}
				width={W}
				height={H}
				uniforms={{
					uTime: 12.4, uHorizon: portrait ? 0.35 : 0.38,
					uFront: -0.5, uScroll: 0.3, uDolly: 2,
					uSun: 0.24, uRain: 0.08, uFlash: 0.15, uFlashX: 0.85,
					uClash: 1, uHeat: 1.15, uStorm: 1.25, uBright: 1.06,
					uCool: 0, uPool: [0.5, 0.5, 0],
				}}
			/>
			<AbsoluteFill style={{mixBlendMode: 'screen', opacity: 0.48}}>
				<ShaderCanvas
					frag={NEBULA_FRAG}
					width={W}
					height={H}
					uniforms={{
						uTime: 12.4, uCenter: [0.53, portrait ? 0.61 : 0.48],
						uConverge: 0.12, uWarm: 0.22, uRays: 0.75, uBright: 0.9,
						uTintL: [1, 0.36, 0.1], uTintR: [0.14, 0.6, 1.7],
						uTintAmt: 1, uZoom: 0.15,
					}}
				/>
			</AbsoluteFill>
			<AbsoluteFill style={{background: `radial-gradient(ellipse 48% 39% at 17% ${portrait ? 74 : 57}%, rgba(219,76,19,0.23), transparent 85%), radial-gradient(ellipse 46% 42% at 89% ${portrait ? 52 : 33}%, rgba(63,139,187,0.25), transparent 85%)`}} />
			<svg width={W} height={H} style={{position: 'absolute', inset: 0}} fill="none">
				<defs>
					<linearGradient id="ep02-rain" x1="0" y1="0" x2="0" y2="1">
						<stop stopColor="#c5e5f3" stopOpacity="0" />
						<stop offset="1" stopColor="#c5e5f3" stopOpacity="0.3" />
					</linearGradient>
				</defs>
				<path d={bolt} stroke="#8fcbf2" strokeWidth={8} opacity={0.26} style={{filter: 'blur(8px)'}} />
				<path d={bolt} stroke="#d3ebff" strokeWidth={1.8} opacity={0.75} />
				<path d={branch} stroke="#badcf3" strokeWidth={0.9} opacity={0.4} />
				{Array.from({length: 90}, (_, i) => {
					const x = W * (0.51 + random(`ep02-cover-rain-x-${i}`) * 0.54);
					const y = H * random(`ep02-cover-rain-y-${i}`);
					const length = 18 + random(`ep02-cover-rain-size-${i}`) * 50;
					return <path key={i} d={`M ${x} ${y} l -${length * 0.2} ${length}`} stroke="url(#ep02-rain)" strokeWidth={0.7 + random(`ep02-cover-rain-width-${i}`)} />;
				})}
			</svg>
			<PokemonArt3D
				dir="pokemon/kyogre"
				variant="-primal"
				x={kx}
				y={ky}
				size={ks}
				yaw={3}
				pitch={-1}
				depthScale={0.5}
				ambient={[0.36, 0.43, 0.56]}
				dirLights={[
					{dir: [0.45, -0.85, 1], color: [0.3, 0.48, 0.7], wrap: 0.4},
					{dir: [-0.9, 0.3, 0.6], color: [0.52, 0.24, 0.1], wrap: 0.4},
				]}
				rim={{dir: [0.7, -0.5], color: [0.26, 0.62, 1], power: 2.5}}
				emissive={0.26}
				emissiveTint={[0.88, 0.96, 1.14]}
				resolution={2}
				style={{filter: 'drop-shadow(0 18px 20px rgba(0,0,0,0.65)) drop-shadow(0 0 18px rgba(80,159,220,0.12))'}}
			/>
			<PokemonArt3D
				dir="pokemon/groudon"
				variant="-primal"
				x={gx}
				y={gy}
				size={gs}
				yaw={-3}
				pitch={1}
				depthScale={0.5}
				ambient={[0.51, 0.36, 0.28]}
				dirLights={[
					{dir: [-0.4, -0.7, 1], color: [0.68, 0.42, 0.23], wrap: 0.4},
					{dir: [0.9, -0.4, 0.6], color: [0.2, 0.35, 0.48], wrap: 0.3},
				]}
				pointLights={[{pos: [-0.2, 0.8, 0.5], color: [1.4, 0.42, 0.07], radius: 0.7}]}
				rim={{dir: [-0.5, 0.8], color: [0.85, 0.33, 0.08], power: 2.8}}
				emissive={0.34}
				emissiveTint={[1, 0.78, 0.38]}
				resolution={2}
				style={{filter: 'drop-shadow(0 18px 22px rgba(0,0,0,0.65)) drop-shadow(0 0 18px rgba(255,125,45,0.13))'}}
			/>
			<svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
				{Array.from({length: 48}, (_, i) => {
					const x = W * random(`ep02-cover-ember-x-${i}`) * 0.52;
					const y = H * (0.28 + random(`ep02-cover-ember-y-${i}`) * 0.69);
					const radius = 0.7 + random(`ep02-cover-ember-size-${i}`) * 1.5;
					return <circle key={i} cx={x} cy={y} r={radius} fill="#ffca7c" opacity={0.2 + random(`ep02-cover-ember-alpha-${i}`) * 0.55} />;
				})}
			</svg>
			<AbsoluteFill style={{background: portrait
				? 'linear-gradient(180deg, rgba(6,7,8,0.74), rgba(6,7,8,0.3) 27%, transparent 43%, transparent 80%, rgba(6,7,8,0.87))'
				: 'linear-gradient(180deg, rgba(6,5,4,0.12), transparent 45%, rgba(6,5,4,0.2) 66%, rgba(6,5,4,0.88) 80%, #070606 100%)'}} />
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 86% 88% at 51% 49%, transparent 44%, rgba(3,4,5,0.58) 100%)'}} />
			<div style={{position: 'absolute', left: margin, top: portrait ? 62 : 55, display: 'flex', alignItems: 'center', gap: 14, fontFamily: SERIF, fontSize: portrait ? 24 : 25, fontWeight: 600, letterSpacing: 8, color: '#d6c3a0'}}>
				<span style={{width: 6, height: 6, background: '#d8b779', transform: 'rotate(45deg)'}} />
				宝可梦志异
			</div>
			<div style={{position: 'absolute', left: margin, top: portrait ? 142 : 115, fontFamily: SERIF, fontSize: portrait ? 25 : 27, letterSpacing: 7, color: '#cbb18b'}}>
				丰缘远古神话
			</div>
			<div style={{position: 'absolute', left: 40, top: L.hookY, width: W - 80, textAlign: 'center', fontFamily: SERIF, fontSize: hookSize, fontWeight: 500, letterSpacing: 5, color: '#e5d9c7', textShadow: '0 2px 14px #080706'}}>
				谁平息了这场远古之战？
			</div>
			<div style={{position: 'absolute', left: margin, top: L.titleY, width: W - margin * 2, fontFamily: SERIF, fontSize: L.titleSize, fontWeight: 900, lineHeight: 1.12, letterSpacing: portrait ? 3.5 : 7, textAlign: 'center', whiteSpace: 'nowrap', color: 'transparent', background: 'linear-gradient(155deg, #fff7df 4%, #f1d49c 37%, #d3a45a 67%, #efdab0 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', filter: 'drop-shadow(0 4px 2px #24150a) drop-shadow(0 0 20px rgba(221,173,91,0.16))'}}>
				大地与海洋之战
			</div>
			<div style={{position: 'absolute', left: 0, top: L.englishY, width: W, textAlign: 'center', fontFamily: CINZEL, fontSize: portrait ? 23 : 25, letterSpacing: portrait ? 4 : 6, color: '#c5b89d', whiteSpace: 'nowrap'}}>
				THE WAR OF LAND AND SEA
			</div>
			<AbsoluteFill style={{mixBlendMode: 'overlay', opacity: 0.065, pointerEvents: 'none'}}>
				<ShaderCanvas frag={GRAIN_FRAG} width={W} height={H} uniforms={{uTime: 12.4}} />
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

export const Ep02CoverWide: React.FC = () => <Cover layout={WIDE} />;
export const Ep02CoverStandard: React.FC = () => <Cover layout={STANDARD} />;
export const Ep02CoverPortrait: React.FC = () => <Cover layout={PORTRAIT} />;
