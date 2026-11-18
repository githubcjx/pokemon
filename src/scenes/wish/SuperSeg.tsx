import {AbsoluteFill, random} from 'remotion';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {BASE_FPS} from '../../time';
import {AIR_FRAG} from './air';
import {K, ramp} from './common';
import {MeteorJewel} from './Crater';
import {EvolutionHalo, evolutionAt, MegaMark, rainbowShadow} from './EvolutionFx';
import {Dissolve, H, LightPool, ScreenSvg, W} from './finishFx';
import {PrayerRelief} from './MuralSeg';

const sparks = Array.from({length: 48}, (_, i) => ({
	x: 300 + random('wish-mega-x-' + i) * 1320,
	y: 210 + random('wish-mega-y-' + i) * 650,
	speed: .8 + random('wish-mega-speed-' + i) * 1.6,
	radius: .8 + random('wish-mega-radius-' + i) * 2.8,
}));

const PrayerLight: React.FC<{frame: number; strength: number; spread: number; cx: number; cy: number}> = ({frame, strength, spread, cx, cy}) => {
	if (strength <= 0) return null;
	return (
		<ScreenSvg style={{opacity: strength, mixBlendMode: 'screen'}}>
			<defs>
				<linearGradient id="wish-prayer-filament" x1="0" y1="1" x2="1" y2="0">
					<stop stopColor="#c1f1cb" stopOpacity=".04" />
					<stop offset=".27" stopColor="#ccf6ce" stopOpacity=".74" />
					<stop offset=".51" stopColor="#ffe3a1" stopOpacity=".95" />
					<stop offset=".79" stopColor="#d2b6f0" stopOpacity=".43" />
					<stop offset="1" stopColor="#dfd9f2" stopOpacity="0" />
				</linearGradient>
			</defs>
			<g transform={`translate(${cx} ${cy})`}>
				{Array.from({length: 5}, (_, i) => {
					const width = 233 + i * 37 + spread * 270;
					const arch = 72 + i * 22;
					const y = 326 - i * 70 + 25 * Math.sin(frame / 57 + i);
					const d = `M${-width} ${y} C${-width * .52} ${y + arch} ${width * .20} ${y - arch} ${width} ${y - arch * .61}`;
					return (
						<g key={i} opacity={.34 + .57 * (1 - i / 5)}>
							<path d={d} fill="none" stroke="#73bdae" strokeWidth={18 - i * 2} opacity=".15" />
							<path d={d} pathLength="1" fill="none" stroke="url(#wish-prayer-filament)" strokeWidth={4.6 - i * .58}
								strokeLinecap="round" strokeDasharray=".62 .22 .12 .04" strokeDashoffset={-frame / (220 + i * 24)} />
						</g>
					);
				})}
			</g>
			{sparks.map(({x, y, radius, speed}, i) => {
				const life = ((frame - 3615) * speed / 550 + i * .137) % 1;
				return <circle key={i} cx={x + (cx - x) * life * .54} cy={y - life * 370} r={radius} fill={i % 3 ? '#fee5b1' : '#9ce6cc'} opacity={(1 - life) * .64} />;
			})}
		</ScreenSvg>
	);
};

const ForeignWitness: React.FC<{opacity: number}> = ({opacity}) => (
	<Dissolve opacity={opacity}>
		<LightPool x={506} y={516} radius={382} color="224,174,114" opacity={.52} />
		<ScreenSvg>
			<path d="M445 813 469 689Q454 613 461 561L478 511 495 494 500 458 495 437Q498 401 523 391Q549 386 563 414L561 452 549 469 555 497 578 527 590 608 579 664 602 810Z"
				fill="#171722" stroke="#ddbb8b" strokeOpacity=".45" strokeWidth="2.6" />
			<path d="M555 500l-19 52 22 56m-57-114-19 86 6 58m-4 36 8 127m54-111 17 110" fill="none" stroke="#cdb486" strokeWidth="1.6" opacity=".34" />
			<path d="M573 427 673 244 778 427Z M599 413 673 281 748 413Z" fill="none" stroke="#eccea4" strokeWidth="3.3" opacity=".5" />
			<path d="M658 244h30M563 427h22M765 427h24" stroke="#f4dca9" strokeWidth="4" opacity=".65" />
		</ScreenSvg>
	</Dissolve>
);

/** 壁画中的第一次超级进化，光从整个身形涌出，再显出新的轮廓。 */
export const SuperSeg: React.FC<{frame: number}> = ({frame}) => {
	const lift = ramp(frame, 3615, 3778);
	const {charge, flash, form: change} = evolutionAt(frame, K.megaStart, K.megaAt);
	const breath = ramp(frame, 3943, 4133);
	const sharpen = ramp(frame, K.megaAt - 9, K.megaAt);
	const settling = ramp(frame, K.megaNameAt + 8, 4486);
	const gleam = ramp(frame, K.megaNameAt - 32, K.megaNameAt) * (1 - ramp(frame, K.megaNameAt + 7, K.megaNameAt + 64));
	const spectrum = {strength: charge, phase: (frame - K.megaStart) * .026};
	const x = 960 + 283 * breath;
	const y = 545 - 108 * lift + 11 * Math.sin(frame / 47);
	return (
		<AbsoluteFill>
			<ShaderCanvas frag={AIR_FRAG} width={W} height={H} scale={.72}
				uniforms={{uTime: frame / BASE_FPS, uHorizon: .72 + breath * .14, uDrift: .79 + lift * .34, uDim: .38 + lift * .15, uAurora: .47 + change * 1.09 + charge * .64}}
				style={{position: 'absolute', inset: 0}} />
			<LightPool x={x} y={y - 28} radius={660} color="125,240,191" opacity={.31 + change * .3 + gleam * .29} />
			<Dissolve opacity={(1 - ramp(frame, 3767, 3825)) * .88}>
				<PrayerRelief opacity={.9} y={866} />
				<MeteorJewel x={960} y={709 - 139 * lift} scale={1.02 - lift * .34} glow={.83 + lift * .16} />
			</Dissolve>
			<EvolutionHalo frame={frame} x={x} y={y} size={784} strength={charge} />
			{lift > 0 && change < 1 && (
				<PokemonArt3D dir="pokemon/rayquaza" x={x} y={y - 35} size={593}
					yaw={-3.5} pitch={2.2} resolution={.84} depthScale={.5} opacity={lift * (1 - change)}
					spectrum={spectrum} style={{filter: rainbowShadow(charge)}}
					ambient={[.27, .43, .37]} rim={{dir: [.12, .92], color: [.44, .74, .54], power: 2.2}} />
			)}
			{change > 0 && (
				<PokemonArt3D dir="pokemon/rayquaza" variant="-mega" x={x} y={y} size={820}
					yaw={-4 + breath * 5.5} pitch={3.1 - breath * 3.6} resolution={.94} depthScale={.5} opacity={change} brightness={.68 + sharpen * .32}
					spectrum={spectrum}
					style={{transform: `scale(${.79 + change * .13 + sharpen * .13 - settling * .04})`, filter: rainbowShadow(charge)}}
					ambient={[.105 + sharpen * .50, .18 + sharpen * .51, .17 + sharpen * .39]}
					dirLights={[
						{dir: [-.34, -.59, .79], color: [.24 + sharpen * .15, .31 + sharpen * .19, .28 + sharpen * .12]},
						{dir: [.57, .67, .43], color: [.15, .28, .22], wrap: .52},
					]}
					rim={{dir: [.36, -.73], color: [.78, .92, .57], power: 2.8}}
					emissive={.32 + gleam * .44} emissiveTint={[1, .83, .48]} emissiveKey={[.45, .76, .32, .61]} />
			)}
			<PrayerLight frame={frame} strength={(.28 + lift * .55 + gleam * .34) * (1 - settling * .54)}
				spread={change} cx={x} cy={y} />
			<LightPool x={x + 48} y={y} radius={631} color="255,243,230" opacity={flash * .96 + gleam * .35} />
			<MegaMark frame={frame} at={K.megaAt} x={x} y={y + 13} height={223} />
			<ForeignWitness opacity={ramp(frame, 4135, 4210) * (1 - ramp(frame, 4252, 4304))} />
			<NameTag from={K.megaNameAt} x={186} y={420} no="No.0384 ·" zh="超级烈空坐" en="MEGA RAYQUAZA"
				category="天空宝可梦" categoryEn="SKY HIGH POKÉMON" tone="mono" glowRgb="193,236,173" opacity={1 - settling * .65} />
		</AbsoluteFill>
	);
};
