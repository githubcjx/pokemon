import {AbsoluteFill, random} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {BASE_FPS} from '../../time';
import {TrainerSilhouette} from '../regi/DoorsSeg';
import {AIR_FRAG} from './air';
import {ramp, SEG_START, TOTAL_FRAMES} from './common';
import {Meteor} from './elements';
import {Dissolve, H, LightPool, ScreenSvg, W} from './finishFx';

const shower = Array.from({length: 23}, (_, i) => ({
	at: 7362 + i * 11 + random('wish-shower-time-' + i) * 47,
	x: 425 + random('wish-shower-x-' + i) * 1630,
	y: -63 + random('wish-shower-y-' + i) * 565,
	duration: 19 + random('wish-shower-life-' + i) * 41,
	speed: 7 + random('wish-shower-speed-' + i) * 9,
	strength: .42 + random('wish-shower-light-' + i) * .57,
}));

const StarRain: React.FC<{frame: number; strength: number}> = ({frame, strength}) => (
	<ScreenSvg style={{opacity: strength, mixBlendMode: 'screen'}}>
		<defs>
			<linearGradient id="wish-starry-trace">
				<stop stopColor="#fcf4d8" />
				<stop offset=".28" stopColor="#acdce5" stopOpacity=".77" />
				<stop offset="1" stopColor="#88abd4" stopOpacity="0" />
			</linearGradient>
		</defs>
		{shower.map(({at, x, y, duration, speed, strength: light}, i) => {
			const dt = frame - at;
			if (dt < 0 || dt >= duration) return null;
			const p = dt / duration;
			const tx = x - dt * speed;
			const ty = y + dt * speed * .46;
			return <path key={i} d={`M${tx} ${ty}l${(72 + speed * 9) * Math.sin(p * Math.PI)} ${-(27 + speed * 4) * Math.sin(p * Math.PI)}`}
				fill="none" stroke="url(#wish-starry-trace)" strokeWidth={1.3 + light * 1.9} strokeLinecap="round"
				opacity={Math.sin(p * Math.PI) * light} />;
		})}
	</ScreenSvg>
);

const inkStrokes = Array.from({length: 7}, (_, line) => {
	let x = 37;
	return Array.from({length: 11 - (line % 3)}, (_, i) => {
		const width = 15 + random(`wish-letter-width-${line}-${i}`) * 14;
		const h = 1 + random(`wish-letter-height-${line}-${i}`) * 6.6;
		const y = 85 + line * 35 + random(`wish-letter-slope-${line}-${i}`) * 2;
		const stroke = `M${x} ${y}q${width * .28} ${-h * 1.6} ${width * .54} 0t${width * .46} ${-h * .6}`;
		x += width + 6.8;
		return stroke;
	});
});

const FarewellLetter: React.FC<{frame: number; opacity: number}> = ({frame, opacity}) => (
	<Dissolve opacity={opacity}>
		<AbsoluteFill style={{background: 'radial-gradient(ellipse at 56% 48%, #29304031, #09101ac9 85%)'}} />
		<LightPool x={642} y={507} radius={616} color="223,186,142" opacity={.59} />
		<ScreenSvg>
			<defs>
				<linearGradient id="wish-letter-paper" x1="0" y1="0" x2=".83" y2="1">
					<stop stopColor="#dac4a5" />
					<stop offset=".47" stopColor="#bfa485" />
					<stop offset="1" stopColor="#8b7570" />
				</linearGradient>
			</defs>
			<path d="M0 795 288 740 650 796 978 774 1228 811 1538 753 1920 807V1080H0Z" fill="#192332" opacity=".67" />
			<path d="M1264 747 1732 741 1850 822 1081 852Z" fill="#182531" stroke="#73868f" strokeOpacity=".25" strokeWidth="3" />
			<g transform={`translate(${465 + 25 * ramp(frame, 7658, 7792)} 351) rotate(-7 245 176)`}>
				<path d="M-10 9 485 3 489 343 458 371-8 359Z" fill="#060c14" opacity=".49" transform="translate(16 23)" />
				<path d="M-10 9 485 3 489 343 458 371-8 359Z" fill="url(#wish-letter-paper)" stroke="#f5dcb5" strokeOpacity=".45" strokeWidth="1.7" />
				<path d="M20 41H433 M-6 183Q236 192 488 181 M6 317Q236 312 463 326" fill="none" stroke="#4d3936" strokeWidth="1.6" strokeOpacity=".25" />
				<path d="M456 371 458 340 490 343Z" fill="#e4c49f" opacity=".57" />
				{inkStrokes.map((row, i) => (
					<g key={i} fill="none" stroke="#302c31" strokeLinecap="round" opacity={.71 - i * .037}>
						{row.map((stroke, j) => <path key={j} d={stroke} strokeWidth={j % 3 ? 2.5 : 3.2} />)}
					</g>
				))}
				<path d="M294 332q35 15 68-2l56-11" fill="none" stroke="#50373b" strokeWidth="3.3" strokeLinecap="round" opacity=".56" />
			</g>
		</ScreenSvg>
		<TrainerSilhouette file="trainers/zinnia/oras.png" x={1459 + ramp(frame, 7700, 7822) * 54} top={402} h={375}
			aspect={994 / 1600} o={.86} from="left" rgb="171,186,197" lift={.14} />
	</Dissolve>
);

export const EndingSeg: React.FC<{frame: number}> = ({frame}) => {
	const dusk = ramp(frame, SEG_START.ending, 7548);
	const rain = ramp(frame, 7333, 7410) * (1 - ramp(frame, 7622, 7762));
	const drift = ramp(frame, 7399, 7616);
	const ray = ramp(frame, 7384, 7452) * (1 - ramp(frame, 7526, 7594));
	const letter = ramp(frame, 7625, 7689) * (1 - ramp(frame, 7766, 7832));
	const finalFade = ramp(frame, 7798, TOTAL_FRAMES - .5);
	return (
		<AbsoluteFill>
			<ShaderCanvas frag={AIR_FRAG} width={W} height={H} scale={.72}
				uniforms={{uTime: frame / BASE_FPS, uHorizon: .68 + dusk * .075, uDrift: .49 + dusk * .51, uDim: .30 + letter * .31, uAurora: .81 + dusk * .23}}
				style={{position: 'absolute', inset: 0}} />
			<LightPool x={1153 - dusk * 134} y={350 + dusk * 36} radius={490} color="173,199,238"
				opacity={(1 - ramp(frame, 7346, 7437)) * .44} />
			<StarRain frame={frame} strength={rain} />
			{ray > 0 && (
				<PokemonArt3D dir="pokemon/rayquaza" x={1370 - drift * 786} y={457 - drift * 90} size={286}
					yaw={-2.3} pitch={2.3} depthScale={.5} resolution={.84}
					ambient={[.15, .24, .28]} rim={{dir: [.23, -.58], color: [.29, .61, .53], power: 2.7}}
					opacity={ray * .87} />
			)}
			<Meteor frame={frame} from={7430} to={7507} x0={-98} y0={276} x1={1070} y1={389}
				size={.092} opacity={(1 - ramp(frame, 7495, 7507)) * .70} />
			<Meteor frame={frame} from={7528} to={7606} x0={1840} y0={115} x1={380} y1={407}
				size={.13} opacity={ramp(frame, 7528, 7540) * (1 - ramp(frame, 7588, 7606))} />
			<FarewellLetter frame={frame} opacity={letter} />
			<AbsoluteFill style={{backgroundColor: '#030508', opacity: finalFade}} />
		</AbsoluteFill>
	);
};
