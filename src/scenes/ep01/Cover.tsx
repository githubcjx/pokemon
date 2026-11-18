import {AbsoluteFill, random} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {SacredRings} from '../../components/SacredRings';
import {CINZEL, SERIF} from '../../fonts';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {GRAIN_FRAG, NEBULA_FRAG} from '../../gl/shaders';

type Layout = {
	width: number;
	height: number;
	hero: [number, number, number];
	halo: [number, number, number];
	title: [number, number, number, number];
	eyebrowY: number;
	englishY: number;
	hookY: number;
	stacked?: boolean;
};

const WIDE: Layout = {
	width: 1920, height: 1080,
	hero: [1400, 550, 990],
	halo: [1390, 540, 1030],
	title: [125, 340, 194, 880],
	eyebrowY: 278, englishY: 578, hookY: 737,
};

const STANDARD: Layout = {
	width: 1440, height: 1080,
	hero: [1030, 550, 950],
	halo: [1030, 540, 1040],
	title: [90, 260, 197, 480],
	eyebrowY: 198, englishY: 733, hookY: 856,
	stacked: true,
};

const PORTRAIT: Layout = {
	width: 1080, height: 1440,
	hero: [550, 886, 850],
	halo: [550, 865, 1050],
	title: [60, 182, 201, 960],
	eyebrowY: 125, englishY: 424, hookY: 1320,
};

const Cover: React.FC<{layout: Layout}> = ({layout: L}) => {
	const {width: W, height: H} = L;
	const portrait = H > W;
	const [hx, hy, size] = L.hero;
	const [cx, cy, diameter] = L.halo;
	const [tx, ty, fontSize, textWidth] = L.title;
	const align = portrait ? 'center' : 'left';
	const dust = Array.from({length: 76}, (_, i) => {
		const angle = random(`ep01-cover-angle-${i}`) * Math.PI * 2;
		const radius = diameter * (0.32 + random(`ep01-cover-distance-${i}`) * 0.42);
		return {
			x: cx + Math.cos(angle) * radius,
			y: cy + Math.sin(angle) * radius * 0.9,
			r: 0.7 + random(`ep01-cover-size-${i}`) * 1.7,
			opacity: 0.16 + random(`ep01-cover-opacity-${i}`) * 0.42,
		};
	});

	return (
		<AbsoluteFill style={{background: '#0b0703', overflow: 'hidden'}}>
			<ShaderCanvas
				frag={NEBULA_FRAG}
				width={W}
				height={H}
				uniforms={{
					uTime: 18.4,
					uCenter: [cx / W, cy / H],
					uConverge: 0.72,
					uWarm: 0.32,
					uRays: 0.68,
					uBright: 0.9,
					uTintL: [0.72, 0.78, 0.92],
					uTintR: [1, 0.94, 0.82],
					uTintAmt: 0.3,
					uZoom: 0.15,
				}}
			/>
			<AbsoluteFill style={{background: `radial-gradient(ellipse ${diameter * 0.48}px ${diameter * 0.52}px at ${cx}px ${cy}px, transparent 45%, rgba(255,204,116,0.1) 65%, transparent 82%)`, mixBlendMode: 'screen'}} />
			<SacredRings x={cx} y={cy} size={diameter} revealFrom={-180} revealFrames={90} opacity={0.46} />
			<svg width={W} height={H} style={{position: 'absolute', inset: 0}} fill="none">
				<defs>
					<linearGradient id="ep01-orbit" x1="0" y1="0" x2="1" y2="1">
						<stop stopColor="#ffedbf" stopOpacity="0.02" />
						<stop offset="0.48" stopColor="#edbe6d" stopOpacity="0.65" />
						<stop offset="1" stopColor="#ffedbf" stopOpacity="0.05" />
					</linearGradient>
				</defs>
				<g transform={`rotate(-24 ${cx} ${cy})`} stroke="url(#ep01-orbit)">
					<ellipse cx={cx} cy={cy} rx={diameter * 0.63} ry={diameter * 0.24} strokeWidth={1.4} />
					<ellipse cx={cx} cy={cy} rx={diameter * 0.65} ry={diameter * 0.25} strokeWidth={0.7} opacity={0.5} />
				</g>
				{dust.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#ffe4b0" opacity={d.opacity} />)}
			</svg>
			<AbsoluteFill style={{background: portrait
				? 'linear-gradient(180deg, rgba(8,6,4,0.78), rgba(8,6,4,0.25) 28%, transparent 43%, transparent 78%, rgba(8,6,4,0.7))'
				: 'linear-gradient(90deg, rgba(8,6,4,0.9), rgba(8,6,4,0.78) 28%, rgba(8,6,4,0.3) 49%, transparent 68%)'}} />
			<PokemonArt3D
				dir="pokemon/arceus"
				x={hx}
				y={hy}
				size={size}
				yaw={-3}
				pitch={1}
				depthScale={0.5}
				ambient={[0.55, 0.49, 0.39]}
				dirLights={[
					{dir: [-0.65, -0.8, 1], color: [0.5, 0.39, 0.25], wrap: 0.5},
					{dir: [0.9, -0.2, 0.7], color: [0.14, 0.18, 0.25], wrap: 0.35},
				]}
				rim={{dir: [0.3, -0.8], color: [0.75, 0.5, 0.2], power: 2.8}}
				emissive={0.1}
				brightness={1.06}
				resolution={2}
				style={{filter: 'drop-shadow(0 14px 20px rgba(0,0,0,0.5)) drop-shadow(0 0 25px rgba(255,211,132,0.18))'}}
			/>
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 82% 85% at 52% 47%, transparent 49%, rgba(4,3,2,0.58) 100%)'}} />
			<div style={{position: 'absolute', left: portrait ? 0 : tx, top: portrait ? 55 : 70, width: portrait ? W : textWidth, display: 'flex', alignItems: 'center', justifyContent: portrait ? 'center' : 'flex-start', gap: 17, fontFamily: SERIF, fontSize: 25, fontWeight: 600, letterSpacing: 9, color: '#c6b18b'}}>
				<span style={{width: 7, height: 7, background: '#cfab68', transform: 'rotate(45deg)'}} />
				宝可梦志异
			</div>
			<div style={{position: 'absolute', left: tx, top: L.eyebrowY, width: textWidth, textAlign: align, fontFamily: SERIF, fontSize: portrait ? 30 : L.stacked ? 27 : 31, fontWeight: 500, letterSpacing: 7, color: '#d2b57e'}}>
				神奥创世神话
			</div>
			<div style={{position: 'absolute', left: tx - (portrait ? 0 : fontSize * 0.025), top: ty, width: textWidth, fontFamily: SERIF, fontSize, fontWeight: 900, lineHeight: 1.12, letterSpacing: fontSize * 0.045, textAlign: align, color: 'transparent', background: 'linear-gradient(166deg, #fff8e1 2%, #f6dea7 31%, #d4aa5b 61%, #bc8c3f 77%, #f2d69a 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', filter: 'drop-shadow(0 3px 1px #251605) drop-shadow(0 0 23px rgba(227,177,84,0.2))'}}>
				{(L.stacked ? ['起始', '之物'] : ['起始之物']).map((line) => <div key={line} style={{whiteSpace: 'nowrap'}}>{line}</div>)}
			</div>
			<div style={{position: 'absolute', left: tx, top: L.englishY, width: textWidth, textAlign: align, fontFamily: CINZEL, fontSize: portrait ? 25 : L.stacked ? 22 : 27, letterSpacing: L.stacked ? 4.5 : 6.5, color: '#ceb47f', whiteSpace: 'nowrap'}}>
				THE ORIGINAL ONE
			</div>
			<div style={{position: 'absolute', left: portrait ? W / 2 - 70 : tx, top: L.hookY - 31, width: 140, height: 1, background: portrait ? 'linear-gradient(90deg, transparent, #b98f4f, transparent)' : 'linear-gradient(90deg, #b98f4f, transparent)'}} />
			<div style={{position: 'absolute', left: tx, top: L.hookY, width: textWidth, textAlign: align, fontFamily: SERIF, fontSize: portrait ? 42 : L.stacked ? 39 : 47, fontWeight: 500, letterSpacing: 6, color: '#f0e4cd', textShadow: '0 2px 14px #090603'}}>
				世界诞生之前
			</div>
			<AbsoluteFill style={{mixBlendMode: 'overlay', opacity: 0.075, pointerEvents: 'none'}}>
				<ShaderCanvas frag={GRAIN_FRAG} width={W} height={H} uniforms={{uTime: 18.4}} />
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

export const Ep01CoverWide: React.FC = () => <Cover layout={WIDE} />;
export const Ep01CoverStandard: React.FC = () => <Cover layout={STANDARD} />;
export const Ep01CoverPortrait: React.FC = () => <Cover layout={PORTRAIT} />;
