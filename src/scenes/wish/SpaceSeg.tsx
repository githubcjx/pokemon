import {AbsoluteFill, random} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {BASE_FPS} from '../../time';
import {TrainerSilhouette} from '../regi/DoorsSeg';
import {K, ramp, SEG_START} from './common';
import {Dissolve, H, LightPool, ScreenSvg, W} from './finishFx';
import {METEOR_BODY_FRAG, ORBIT_FRAG} from './orbitGl';

const IMPACT_X = 1282;
const IMPACT_Y = 396;
const ASTEROID_SIZE = 820;
const COMET_ANGLE = -15;

const fragments = Array.from({length: 48}, (_, i) => {
	const a = random('wish-debris-direction-' + i) * Math.PI * 2;
	const velocity = 185 + random('wish-debris-speed-' + i) * 831;
	const shape = 0.59 + random('wish-debris-shape-' + i) * .47;
	return {
		a,
		vx: Math.cos(a) * velocity + 134,
		vy: Math.sin(a) * velocity * .81 - 49,
		size: 3.5 + random('wish-debris-size-' + i) ** 2 * 36,
		spread: 53 + random('wish-debris-spread-' + i) * 187,
		spin: 50 + random('wish-debris-spin-' + i) * 240,
		d: `M-1 -.35 -.35 -1 .66 ${-shape} 1 .15 .19 1 -.88 .51Z`,
	};
});

const MeteorBody: React.FC<{frame: number; x: number; y: number; zoom: number; heat: number}> = ({frame, x, y, zoom, heat}) => (
	<ShaderCanvas frag={METEOR_BODY_FRAG} width={ASTEROID_SIZE} height={ASTEROID_SIZE} scale={.88}
		uniforms={{uTime: frame / BASE_FPS, uTurn: (frame - 6756) * .0038, uHeat: heat}}
		style={{position: 'absolute', left: x - ASTEROID_SIZE / 2, top: y - ASTEROID_SIZE / 2, transform: `scale(${zoom})`}} />
);

const Shockwave: React.FC<{frame: number}> = ({frame}) => {
	const age = Math.max(0, (frame - K.impactAt) / BASE_FPS);
	const opening = ramp(frame, K.impactAt, K.impactAt + 9);
	const linger = 1 - ramp(frame, 7104, 7201);
	return (
		<>
			<ScreenSvg>
				<defs>
					<radialGradient id="wish-impact-ring">
						<stop stopColor="#eefff1" stopOpacity="0" />
						<stop offset=".58" stopColor="#b4f4d8" stopOpacity="0" />
						<stop offset=".76" stopColor="#eaffdb" stopOpacity=".69" />
						<stop offset=".87" stopColor="#85d6d9" stopOpacity=".48" />
						<stop offset="1" stopColor="#81c4e8" stopOpacity="0" />
					</radialGradient>
				</defs>
				<ellipse cx={IMPACT_X} cy={IMPACT_Y} rx={99 + age * 562} ry={60 + age * 292} transform={`rotate(-24 ${IMPACT_X} ${IMPACT_Y})`}
					fill="url(#wish-impact-ring)" opacity={opening * Math.exp(-age * 1.87)} />
				{fragments.map(({a, vx, vy, size, spread, spin, d}, i) => {
					const distance = (1 - Math.exp(-age * .85)) / .85;
					const x = IMPACT_X + Math.cos(a) * spread + vx * distance;
					const y = IMPACT_Y + Math.sin(a) * spread * .72 + vy * distance;
					const s = size * (.94 + opening * .28);
					return (
						<g key={i} transform={`translate(${x} ${y}) rotate(${a * 57 + age * spin}) scale(${s})`}
							opacity={opening * linger * (.43 + .46 / (1 + age * .54))}>
							<path d={d} fill={i % 3 ? '#59483f' : '#374351'} stroke={i % 3 ? '#df9f6e' : '#97a5b5'} strokeWidth=".065" />
							<path d="M-.86-.32 .18-.2 .1 .68 .72 .32" fill="none" stroke="#e5b381" strokeWidth=".057" opacity=".68" />
						</g>
					);
				})}
			</ScreenSvg>
			<LightPool x={IMPACT_X} y={IMPACT_Y} radius={722 + age * 124} color="212,251,202" opacity={opening * Math.exp(-age * 2.1)} />
		</>
	);
};

const tailSeeds = Array.from({length: 31}, (_, i) => ({
	phase: random('wish-comet-phase-' + i),
	height: random('wish-comet-offset-' + i) * 2 - 1,
	length: 7 + random('wish-comet-length-' + i) * 28,
}));

const DragonTrail: React.FC<{x: number; y: number; size: number; drive: number; aura: number; frame: number}> =
	({x, y, size, drive, aura, frame}) => {
		if (drive <= 0 && aura <= 0) return null;
		const tail = 290 + drive * 950;
		const radius = size * .40;
		const head = size * .46;
		return (
			<ScreenSvg style={{mixBlendMode: 'screen'}}>
				<defs>
					<linearGradient id="wish-dragon-ascent" gradientUnits="userSpaceOnUse" x1={-tail} y1="0" x2={head} y2="0">
						<stop stopColor="#52dfe0" stopOpacity="0" />
						<stop offset=".38" stopColor="#35cba8" stopOpacity=".27" />
						<stop offset=".72" stopColor="#38e884" stopOpacity=".74" />
						<stop offset=".91" stopColor="#9dff9b" stopOpacity=".94" />
						<stop offset="1" stopColor="#f2ffca" stopOpacity=".63" />
					</linearGradient>
					<radialGradient id="wish-ascent-corona">
						<stop stopColor="#deffd5" stopOpacity=".73" />
						<stop offset=".41" stopColor="#81fc9b" stopOpacity=".64" />
						<stop offset=".72" stopColor="#47f79a" stopOpacity=".37" />
						<stop offset="1" stopColor="#34cfa5" stopOpacity="0" />
					</radialGradient>
				</defs>
				<g transform={`translate(${x} ${y}) rotate(${COMET_ANGLE})`}>
					<ellipse cx={size * .04} rx={radius * 1.91} ry={radius * 1.33}
						fill="url(#wish-ascent-corona)" opacity={aura * .93} />
					<g opacity={drive}>
						<path d={`M${head} 0 C${head * .78} ${-radius * .96} ${-tail * .16} ${-radius * .83} ${-tail} 0 C${-tail * .34} ${radius * .34} ${head * .83} ${radius * .99} ${head} 0Z`}
							fill="url(#wish-dragon-ascent)" opacity=".76" />
						{[-.77, -.43, -.15, .22, .52, .82].map((lane, i) => {
							const y0 = lane * radius;
							const drift = Math.sin(frame / 6 + i) * (5 + i);
							return (
								<path key={i} d={`M${-tail * (.81 + .028 * i)} ${y0 * .09 + drift} Q${-tail * .39} ${y0 * .29} -78 ${y0 * .75} Q${head * .62} ${y0} ${head} ${y0 * .14}`}
									fill="none" stroke="url(#wish-dragon-ascent)" strokeWidth={i === 2 ? 10 : 2.5 + i * .72}
									strokeLinecap="round" opacity={.83 - Math.abs(lane) * .40} />
							);
						})}
						{tailSeeds.map(({phase, height, length}, i) => {
							const p = (phase + frame * (.026 + i % 6 * .002)) % 1;
							const tx = -tail * p + head * .38;
							const ty = height * (radius * (.19 + .66 * Math.sin(Math.PI * p)));
							return <path key={i} d={`M${tx} ${ty}h${length * (1.18 - p)}`} stroke={i % 4 ? '#92ffc0' : '#e9ffd0'}
								strokeWidth={1.3 + i % 3} strokeLinecap="round" opacity={.77 * Math.sin(Math.PI * p)} />;
						})}
					</g>
				</g>
			</ScreenSvg>
		);
	};

/** 起飞、画龙点睛、碎屑里留下一个逆光剪影。 */
export const SpaceSeg: React.FC<{frame: number}> = ({frame}) => {
	const ascent = ramp(frame, SEG_START.burst, 6801);
	const approach = ramp(frame, 6768, 6922);
	const flightStart = K.ascentAt + 3;
	const acceleration = Math.max(0, Math.min(1, (frame - flightStart) / (K.impactAt - flightStart)));
	const drive = acceleration ** 2.35;
	const streak = ramp(frame, K.ascentAt - 8, K.ascentAt + 24) * (1 - ramp(frame, K.impactAt + 2, K.impactAt + 33));
	const aura = ramp(frame, K.ascentAt - 20, K.ascentAt + 13) * (1 - ramp(frame, K.impactAt + 1, K.impactAt + 21));
	const beyond = 1 - Math.max(0, 1 - Math.max(0, frame - K.impactAt) / 42) ** 2;
	const meteor = ramp(frame, 6766, 6817) * (1 - ramp(frame, K.impactAt + 2, K.impactAt + 10));
	const blast = ramp(frame, K.impactAt - .5, K.impactAt + 4) * (1 - ramp(frame, K.impactAt + 6, K.impactAt + 47));
	const fissure = ramp(frame, K.impactAt - .5, K.impactAt + 2.5) * (1 - ramp(frame, K.impactAt + 5, K.impactAt + 27));
	const shadow = ramp(frame, 7080, 7143);
	const afterglow = ramp(frame, 7054, 7146);
	const drift = ramp(frame, 7158, 7314);
	const exitLight = ramp(frame, 7289, 7387);
	const dragonX = 291 + ascent * 176 + drive * 441 + beyond * 1240;
	const dragonY = 824 - ascent * 215 - drive * 113 - beyond * 331;
	const dragonSize = 605 - ascent * 128 - drive * 114;
	const angle = -39 + ascent * 11 - drive * 5;
	const ship = ascent * (1 - ramp(frame, K.impactAt + 2, K.impactAt + 23));
	const shadowX = 1282 - 49 * shadow + drift * 11;
	const shadowY = 437 + 32 * shadow - drift * 19 + 8 * Math.sin(frame / 43);
	return (
		<AbsoluteFill>
			<ShaderCanvas frag={ORBIT_FRAG} width={W} height={H} scale={.75}
				uniforms={{uTime: frame / BASE_FPS, uRise: .15 + ascent * .85 - exitLight * .61, uDrift: approach * .61 + drive * .25 + drift * .21, uGlare: blast + afterglow * .10, uWarm: blast * .61}}
				style={{position: 'absolute', inset: 0}} />
			<DragonTrail x={dragonX} y={dragonY} size={dragonSize} frame={frame}
				drive={ascent * .18 * (1 - drive) + streak * .82} aura={aura} />
			{ship > 0 && (
				<AbsoluteFill style={{opacity: ship, transformOrigin: `${dragonX}px ${dragonY}px`, transform: `rotate(${angle}deg)`}}>
					<PokemonArt3D dir="pokemon/rayquaza" variant="-mega" x={dragonX} y={dragonY} size={dragonSize}
						yaw={-2.6 + drive * 4.1} pitch={5.0 - drive * 7.5} depthScale={.50} resolution={.93}
						style={{
							transform: 'scaleX(-1)',
							filter: aura > 0 ? `drop-shadow(0 0 7px rgba(151,255,162,${aura})) drop-shadow(0 0 23px rgba(48,241,122,${aura * .94}))` : undefined,
						}}
						ambient={[.54 + streak * .21, .70 + streak * .18, .65]}
						dirLights={[{dir: [-.57, -.33, .70], color: [.32, .51 + aura * .49, .50], wrap: .36}]}
						rim={{dir: [-.22, .86], color: [.62, .89 + aura * .59, .82], power: 2.3}}
						emissive={.28 + .62 * streak} emissiveTint={[1 - aura * .38, .94 + aura * .24, .57]} />
					<TrainerSilhouette file="trainers/may/oras.png" x={dragonX + dragonSize * .13}
						top={dragonY - dragonSize * .234} h={dragonSize * .176} aspect={595 / 1600}
						o={1 - drive * .48} from="left" rgb="187,220,219" lift={.11} />
				</AbsoluteFill>
			)}
			<Dissolve opacity={meteor}>
				<MeteorBody frame={frame} x={1524 - approach * 242} y={430 - approach * 34}
					zoom={.46 + .65 * approach + blast * .08} heat={.04 + drive * .42 + blast * .52} />
			</Dissolve>
			{frame >= K.impactAt && frame < K.impactAt + 13 && (
				<LightPool x={1033} y={466} radius={384} color="169,255,153"
					opacity={.87 * (1 - ramp(frame, K.impactAt, K.impactAt + 13))} />
			)}
			{fissure > 0 && (
				<>
					<LightPool x={IMPACT_X} y={IMPACT_Y} radius={570} color="111,253,161" opacity={fissure * .91} />
					<ScreenSvg style={{opacity: fissure, mixBlendMode: 'screen'}}>
						<path d="M921 596 1103 511 1156 452 1282 396 1348 333 1435 316 1661 194 M1156 452l-34-74 29-82-47-99 M1282 396l74 45 51 87-8 141 M1435 316l29-82-23-110"
							fill="none" stroke="#9fe6c1" strokeWidth="19" opacity=".27" />
						<path d="M921 596 1103 511 1156 452 1282 396 1348 333 1435 316 1661 194 M1156 452l-34-74 29-82-47-99 M1282 396l74 45 51 87-8 141 M1435 316l29-82-23-110"
							fill="none" stroke="#fff3bc" strokeWidth="4.7" strokeLinejoin="round" />
					</ScreenSvg>
				</>
			)}
			{afterglow > 0 && (
				<LightPool x={shadowX - 44 - exitLight * 89} y={shadowY - 16} radius={610 + exitLight * 143}
					color="136,155,217" opacity={afterglow * (.58 - exitLight * .14)} />
			)}
			{shadow > 0 && (
				<PokemonArt3D dir="pokemon/deoxys" x={shadowX} y={shadowY} size={669}
					yaw={-1.7 + drift * 3.0} pitch={2.2 - drift * 3.4} depthScale={.5} resolution={.89}
					style={{
						transform: `scale(${.83 + shadow * .12 + drift * .065})`,
						filter: 'brightness(0) drop-shadow(0 0 3px #b0c0ed5c) drop-shadow(0 0 23px #7583cc44)',
					}}
					ambient={[0, 0, 0]} opacity={shadow * (1 - exitLight * .32)} />
			)}
			{frame >= K.impactAt && frame < 7201 && <Shockwave frame={frame} />}
		</AbsoluteFill>
	);
};
