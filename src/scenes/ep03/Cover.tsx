import {AbsoluteFill, random} from 'remotion';
import {CoverTitle} from '../../components/CoverTitle';
import {Helix} from '../../components/effects/Helix';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {INK_DUO_FRAG} from '../../gl/inkDuo';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {GRAIN_FRAG} from '../../gl/shaders';

type Layout = {
	width: number;
	height: number;
	mew: [number, number, number];
	mewtwo: [number, number, number];
	title: [number, number, number, number];
	dna: [number, number, number];
};

const WIDE: Layout = {
	width: 1920, height: 1080,
	mew: [510, 431, 760],
	mewtwo: [1390, 484, 970],
	title: [732, 184, 41, 25],
	dna: [960, 225, 300],
};

const STANDARD: Layout = {
	width: 1440, height: 1080,
	mew: [380, 421, 670],
	mewtwo: [1070, 493, 925],
	title: [748, 176, 36, 24],
	dna: [720, 190, 255],
};

const PORTRAIT: Layout = {
	width: 1080, height: 1440,
	mew: [275, 350, 550],
	mewtwo: [727, 790, 860],
	title: [1104, 185, 32, 23],
	dna: [620, 220, 235],
};

const Cover: React.FC<{layout: Layout}> = ({layout: L}) => {
	const {width: W, height: H} = L;
	const portrait = H > W;
	const [mx, my, ms] = L.mew;
	const [mtx, mty, mts] = L.mewtwo;
	const [dnaX, dnaY, dnaLength] = L.dna;

	return (
		<AbsoluteFill style={{background: '#090b0e', overflow: 'hidden'}}>
			<AbsoluteFill style={{filter: 'saturate(0.18) brightness(0.27)'}}>
				<ShaderCanvas frag={INK_DUO_FRAG} width={W} height={H} uniforms={{
				uTime: 15.6, uCam: [960, 540, 1], uRoll: 0,
				uSeam: 960, uMeet: 0.15, uCaveDark: 0.3,
				uSun: 0.6, uWaterY: 980, uFloodC: [0, 0, 0], uClearC: [0, 0, 0],
				uGold: 0.28, uLight: 11, uBright: 1.03,
				}} />
			</AbsoluteFill>
			<AbsoluteFill style={{background: `radial-gradient(ellipse ${ms * 0.85}px ${ms * 0.95}px at ${mx}px ${my}px, rgba(216,181,122,0.52), transparent 78%), radial-gradient(ellipse ${mts * 0.8}px ${mts * 0.85}px at ${mtx}px ${mty}px, rgba(105,94,158,0.42), transparent 76%)`, mixBlendMode: 'screen'}} />
			<AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(133,104,60,0.14), transparent 45%, rgba(30,20,66,0.22))'}} />
			<Helix x={dnaX} y={dnaY} length={dnaLength} radius={portrait ? 28 : 38} turns={2.3} tilt={90} revealFrom={-100} layer="back" opacity={0.8} />
			<Helix x={dnaX} y={dnaY} length={dnaLength} radius={portrait ? 28 : 38} turns={2.3} tilt={90} revealFrom={-100} layer="front" opacity={0.8} />
			<PokemonArt3D dir="pokemon/mew" x={mx} y={my} size={ms} yaw={3} pitch={1} depthScale={0.5} resolution={2}
				ambient={[0.62, 0.52, 0.46]}
				dirLights={[{dir: [0.5, -0.8, 1], color: [1.0, 0.87, 0.72], wrap: 0.55}]}
				rim={{dir: [0.8, -0.4], color: [1.2, 0.9, 0.55], power: 2.5}}
				style={{filter: 'drop-shadow(0 14px 25px rgba(0,0,0,0.45))'}} />
			<div style={{position: 'absolute', inset: 0, transform: 'scaleX(-1)'}}>
				<PokemonArt3D dir="pokemon/mewtwo" x={W - mtx} y={mty} size={mts} yaw={3} pitch={-1} depthScale={0.5} resolution={2}
					ambient={[0.25, 0.23, 0.34]}
					dirLights={[{dir: [-0.65, -0.75, 1], color: [0.72, 0.82, 1.15], wrap: 0.4}]}
					rim={{dir: [-0.8, -0.4], color: [0.74, 0.58, 1.2], power: 2.4}}
					style={{filter: 'drop-shadow(0 18px 24px rgba(0,0,0,0.55))'}} />
			</div>
			<svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
				{Array.from({length: 46}, (_, i) => <circle key={i} cx={W * random(`ep03-cover-x${i}`)} cy={H * random(`ep03-cover-y${i}`)} r={0.7 + random(`ep03-cover-r${i}`) * 1.7} fill="#ebd2a1" opacity={0.1 + random(`ep03-cover-a${i}`) * 0.35} />)}
			</svg>
			<AbsoluteFill style={{background: portrait
				? 'linear-gradient(to top, #030407 0%, rgba(3,4,7,0.94) 14%, rgba(3,4,7,0.28) 30%, transparent 43%)'
				: 'linear-gradient(to top, #030407 0%, rgba(3,4,7,0.89) 20%, rgba(3,4,7,0.18) 42%, transparent 56%)'}} />
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 83% 85% at 50% 43%, transparent 52%, rgba(0,0,0,0.55) 100%)'}} />
			<CoverTitle title="同源异心" hook="基因几乎相同，心为何截然不同？" english="ONE ORIGIN, TWO HEARTS" layout={L.title} />
			<AbsoluteFill style={{mixBlendMode: 'overlay', opacity: 0.05, pointerEvents: 'none'}}>
				<ShaderCanvas frag={GRAIN_FRAG} width={W} height={H} uniforms={{uTime: 15.6}} />
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

export const Ep03CoverWide: React.FC = () => <Cover layout={WIDE} />;
export const Ep03CoverStandard: React.FC = () => <Cover layout={STANDARD} />;
export const Ep03CoverPortrait: React.FC = () => <Cover layout={PORTRAIT} />;
