import {AbsoluteFill} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {BASE_FPS} from '../../time';
import {TrainerSilhouette} from '../regi/DoorsSeg';
import {AIR_FRAG, VEIL_FRAG} from './air';
import {K, ramp, SEG_START} from './common';
import {AltarStone} from './elements';
import {EvolutionHalo, evolutionAt, MegaMark, rainbowShadow} from './EvolutionFx';
import {H, LightPool, ScreenSvg, W} from './finishFx';

const OFFERING = 5632;
const RITE_HITS = [6315, 6360, 6420];

const AltarPlatform: React.FC<{light: number; seal: number}> = ({light, seal}) => (
	<ScreenSvg>
		<defs>
			<linearGradient id="wish-altar-floor" x1="0" y1="0" x2="0" y2="1">
				<stop stopColor="#293d4c" />
				<stop offset=".44" stopColor="#202b38" />
				<stop offset="1" stopColor="#111924" />
			</linearGradient>
			<linearGradient id="wish-altar-post">
				<stop stopColor="#142330" />
				<stop offset=".78" stopColor="#344c60" />
				<stop offset="1" stopColor="#596e7b" />
			</linearGradient>
			<clipPath id="wish-altar-clipping">
				<path d="M-159 1074 185 731 404 617 1511 618 1736 726 2079 1074Z" />
			</clipPath>
		</defs>
		<path d="M-158 1111 181 744 406 623 1515 623 1739 744 2080 1111Z" fill="#0c1521" stroke="#1f2c39" strokeWidth="8" />
		<path d="M-159 1074 185 731 404 617 1511 618 1736 726 2079 1074Z" fill="url(#wish-altar-floor)" stroke="#6d8a98" strokeOpacity=".43" strokeWidth="3" />
		<g clipPath="url(#wish-altar-clipping)" fill="none">
			{Array.from({length: 14}, (_, i) => {
				const x = 383 + i * 87;
				return <path key={i} d={`M${x} 612 L${960 + (x - 960) * 2.22} 1110`} stroke="#718496" strokeWidth="1.65" opacity=".20" />;
			})}
			{[637, 664, 701, 751, 815, 892, 990, 1080].map((y) => <path key={y} d={`M0 ${y}H1920`} stroke="#7d91a0" strokeWidth="2" opacity=".23" />)}
			<ellipse cx="958" cy="759" rx="499" ry="129" fill="#314453" fillOpacity=".42" stroke="#728893" strokeWidth="3" />
			<ellipse cx="958" cy="755" rx="474" ry="115" stroke="#90adad" strokeWidth="1.6" opacity={.28 + seal * .42} />
			<ellipse cx="958" cy="755" rx="454" ry="106" stroke="#668e90" strokeWidth="2" strokeDasharray="6 11" opacity={.42 + seal * .23} />
			<path d="M958 659 1228 818 688 818Z M958 694 1130 796H786Z" stroke="#98bfae" strokeWidth="2" opacity={.14 + seal * .63} />
			<ellipse cx="958" cy="758" rx="147" ry="39" stroke="#9ebbb6" strokeWidth="1.4" opacity={.19 + seal * .44} />
		</g>
		<path d="M254 585 404 539 1516 540 1666 587M253 635 404 581 1516 581 1666 638" fill="none" stroke="#4b6373" strokeWidth="5" strokeOpacity=".62" />
		{[264, 404, 536, 675, 818, 1100, 1246, 1385, 1517, 1660].map((x) => {
			const d = Math.abs(958 - x) / 720;
			const y = 621 + Math.max(0, d - .75) * 164;
			return (
				<g key={x} transform={`translate(${x} ${y})`}>
					<path d="M-19 2-14-93-22-102 20-102 13-93 18 2Z" fill="url(#wish-altar-post)" stroke="#70838f" strokeOpacity=".52" strokeWidth="1.8" />
					<path d="M-23-102-13-110H11L21-102Z" fill="#56737c" />
					<path d="M-16 5H17" stroke="#87aca9" strokeWidth="1.3" opacity={.21 + light * .39} />
				</g>
			);
		})}
	</ScreenSvg>
);

const TrainerMeteorite: React.FC<{x: number; y: number; strength: number}> = ({x, y, strength}) => (
	<>
		<LightPool x={x} y={y} radius={124} color="255,204,114" opacity={strength} />
		<ScreenSvg style={{opacity: strength}}>
			<g transform={`translate(${x} ${y})`}>
				<path d="M-20 1-16-12 1-18 15-13 21 3 12 15-6 18-18 12Z" fill="#7d6652" stroke="#ffdc9b" strokeWidth="2.3" />
				<path d="M-16-12 1-18 15-13 5-1-9 2Z" fill="#e7b66d" />
				<path d="M5-1 21 3 12 15-6 18-9 2Z" fill="#b18754" />
			</g>
		</ScreenSvg>
	</>
);

const BattleBall: React.FC<{frame: number; x: number; y: number; opacity: number}> = ({frame, x, y, opacity}) => (
	<ScreenSvg style={{opacity}}>
		<g transform={`translate(${x} ${y}) rotate(${8 * Math.sin(frame / 3.5) * (1 - ramp(frame, 5882, 5918))})`}>
			<ellipse cx="0" cy="21" rx="44" ry="8" fill="#05090f" opacity=".62" />
			<circle r="24" fill="#b1c0c6" stroke="#0d1724" strokeWidth="2" />
			<path d="M-23 0a23 23 0 0 1 46 0Z" fill="#964341" />
			<path d="M-23 0h46" stroke="#151c26" strokeWidth="4" />
			<circle r="7" fill="#e5ebde" stroke="#26333c" strokeWidth="2.6" />
		</g>
	</ScreenSvg>
);

const MoveArc: React.FC<{opacity: number; progress: number}> = ({opacity, progress}) => (
	<ScreenSvg style={{opacity, mixBlendMode: 'screen'}}>
		<defs>
			<linearGradient id="wish-ascent-rehearsal" x1="0" y1="1" x2="1" y2="0">
				<stop stopColor="#93d5bd" stopOpacity=".13" />
				<stop offset=".46" stopColor="#b8ead0" stopOpacity=".62" />
				<stop offset="1" stopColor="#ffedb7" stopOpacity=".93" />
			</linearGradient>
		</defs>
		{[0, 1, 2].map((i) => (
			<path key={i} d={`M${933 - i * 48} 743 C ${465 - i * 55} 632 ${694 - i * 40} 335 ${1302 + i * 48} ${158 + i * 22}`}
				pathLength="1" fill="none" stroke="url(#wish-ascent-rehearsal)" strokeWidth={i ? 2.3 : 7.5}
				strokeLinecap="round" strokeDasharray={`${Math.max(0, progress - i * .14)} 1`} opacity={i ? .63 : .92} />
		))}
	</ScreenSvg>
);

const BattleLight: React.FC<{frame: number; power: number}> = ({frame, power}) => {
	if (power <= 0) return null;
	return (
		<>
			<LightPool x={957} y={678} radius={483} color="176,222,214" opacity={power * .74} />
			<ScreenSvg style={{opacity: power, mixBlendMode: 'screen'}}>
				<defs>
					<linearGradient id="wish-rite-l" x1="0" x2="1">
						<stop stopColor="#c88e65" stopOpacity=".08" />
						<stop offset="1" stopColor="#fbe9b5" stopOpacity=".94" />
					</linearGradient>
					<linearGradient id="wish-rite-r" x1="0" x2="1">
						<stop stopColor="#ecffdf" stopOpacity=".93" />
						<stop offset="1" stopColor="#7ccee6" stopOpacity=".12" />
					</linearGradient>
				</defs>
				{Array.from({length: 7}, (_, i) => {
					const y = 657 + 9 * i;
					const p = 56 * Math.sin(frame / (16 + i) + i);
					return (
						<g key={i}>
							<path d={`M462 ${y + p}Q702 ${y - 76 + p} 957 678`} fill="none" stroke="url(#wish-rite-l)" strokeWidth={i % 3 === 0 ? 5 : 1.8} />
							<path d={`M1451 ${y - p}Q1166 ${y - 83 - p} 957 678`} fill="none" stroke="url(#wish-rite-r)" strokeWidth={i % 3 === 0 ? 5 : 1.8} />
						</g>
					);
				})}
				<ellipse cx="957" cy="696" rx={193 + power * 119} ry={39 + power * 22} fill="none" stroke="#a1dbc9" strokeWidth="3.1" opacity=".58" />
			</ScreenSvg>
		</>
	);
};

/** 塔顶只换光和机位。补足能量、收服、传招和传承对战沿同一座祭坛完成。 */
export const AltarSeg: React.FC<{frame: number}> = ({frame}) => {
	const time = frame / BASE_FPS;
	const landing = ramp(frame, 5368, 5447);
	const failed = ramp(frame, 5452, 5514);
	const energy = ramp(frame, OFFERING - 5, OFFERING + 14) * (1 - ramp(frame, 5694, 5755));
	const catchRay = ramp(frame, 5843, 5927);
	const thrown = ramp(frame, 5798, 5853);
	const recall = ramp(frame, 5848, 5863) * (1 - ramp(frame, 5869, 5908));
	const releaseRay = ramp(frame, 6058, 6186);
	const pass = ramp(frame, 6507, 6640);
	const {charge, flash, form: mega} = evolutionAt(frame, K.riteMegaStart, K.riteMegaAt);
	const spectrum = {strength: charge, phase: (frame - K.riteMegaStart) * .034};
	const lift = ramp(frame, K.riteMegaAt + 40, SEG_START.burst + 97);
	const gem = ramp(frame, 5531, 5554) * (1 - ramp(frame, OFFERING - 4, OFFERING + 2));
	const gemTravel = ramp(frame, 5566, OFFERING);
	const arc = ramp(frame, 6027, 6140);
	const arcOut = 1 - ramp(frame, 6220, 6284);
	const hit = Math.max(...RITE_HITS.map((at) => ramp(frame, at - 16, at) * (1 - ramp(frame, at + 5, at + 35))));
	const ray = Math.max(landing * (1 - catchRay), releaseRay * (1 - lift));
	const rayX = 952 + 205 * (1 - landing) + 62 * pass;
	const rayY = 409 - 222 * (1 - landing) - 371 * lift + 9 * Math.sin(frame / 53);
	const shake = Math.sin(frame * .92) * hit * 7;
	const track = -38 * ramp(frame, 5355, 5576) + 59 * ramp(frame, 5906, 6128);
	const zinniaX = 518 - pass * 112;
	const heroX = 1392 - 63 * pass;
	const stoneX = zinniaX + 1;
	const rockX = 1370 - gemTravel * 175;
	const rockY = 613 - gemTravel * 252;
	return (
		<AbsoluteFill>
			<ShaderCanvas frag={AIR_FRAG} width={W} height={H} scale={.70}
				uniforms={{uTime: time, uHorizon: .49 + lift * .18, uDrift: .58 + pass * .31, uDim: .31 + failed * .23 - energy * .19 - charge * .13, uAurora: .48 + energy * .38 + lift * .53 + charge * .86}}
				style={{position: 'absolute', inset: 0}} />
			<AbsoluteFill style={{transform: `translate(${track + shake}px,${-31 * pass + shake * .52}px) scale(${1 + hit * .022})`}}>
				<AltarPlatform light={energy + hit + charge} seal={energy * .79 + arc * arcOut * .71 + hit * .43 + charge * .57} />
				<LightPool x={956} y={628} radius={578} color="127,203,192" opacity={.18 + energy * .51 + hit * .36 + charge * .24} />
				<EvolutionHalo frame={frame} x={rayX} y={rayY} size={673} strength={charge} />
				{ray > 0 && mega < 1 && (
					<PokemonArt3D dir="pokemon/rayquaza" x={rayX} y={rayY} size={618}
						yaw={-3.2 + energy * 2.7} pitch={4.6 - pass * 4} depthScale={.49} resolution={.9}
						spectrum={spectrum}
						style={{
							transform: `scale(${-1 + catchRay * (1 - releaseRay) * .21}, ${1 - catchRay * (1 - releaseRay) * .21})`,
							filter: rainbowShadow(charge),
						}}
						ambient={[.25 - failed * .08 + energy * .27 + releaseRay * .14, .38 - failed * .11 + energy * .28 + releaseRay * .14, .41 - failed * .10 + energy * .17 + releaseRay * .13]}
						dirLights={[{dir: [-.42, .54, .63], color: [.27 + energy * .46, .42 + energy * .28, .38 + energy * .13]}]}
						rim={{dir: [.19, -.74], color: [.24, .51, .46], power: 2.8}}
						emissive={energy * .56 + releaseRay * .15} emissiveTint={[1, .81, .39]}
						opacity={ray * (.90 - hit * .12 + charge * .10) * (1 - mega)} />
				)}
				{mega > 0 && lift < 1 && (
					<PokemonArt3D dir="pokemon/rayquaza" variant="-mega" x={rayX} y={rayY} size={687}
						yaw={-2.2 + lift * 2.6} pitch={2.4 - lift * 4.4} depthScale={.50} resolution={.92}
						spectrum={spectrum} style={{transform: 'scaleX(-1)', filter: rainbowShadow(charge)}}
						ambient={[.61, .72, .63]} dirLights={[{dir: [.55, .53, .56], color: [.23, .39, .31], wrap: .49}]}
						rim={{dir: [.21, -.84], color: [.56, .76, .57], power: 2.65}}
						emissive={.35 + charge * .34} emissiveTint={[1, .91, .52]} opacity={mega * (1 - lift)} />
				)}
				<TrainerSilhouette file="trainers/zinnia/oras.png" x={zinniaX} top={450 - 10 * pass} h={328} aspect={994 / 1600}
					o={1 - pass * .68} from="right" rgb="202,178,163" lift={.17 + hit * .06} />
				<TrainerSilhouette file="trainers/may/oras.png" x={heroX} top={459 + 11 * pass} h={319} aspect={595 / 1600}
					o={ramp(frame, 5418, 5547)} from="left" rgb="162,207,219" lift={.15 + energy * .10 + hit * .06} />
				{frame < 5690 && (
					<AbsoluteFill style={{transformOrigin: `${stoneX}px 630px`, transform: 'scale(.40)', opacity: 1 - ramp(frame, 5549, 5690)}}>
						<AltarStone x={stoneX} y={630} glow={.42 + landing * .23 - failed * .37} />
					</AbsoluteFill>
				)}
				{gem > 0 && <TrainerMeteorite x={rockX} y={rockY} strength={gem} />}
				<LightPool x={1194} y={362} radius={210} color="249,223,156" opacity={energy * .73} />
				{thrown > 0 && releaseRay < 1 && (
					<BattleBall frame={frame} x={1344 - 387 * thrown} y={555 + 191 * thrown - 416 * thrown * (1 - thrown)}
						opacity={ramp(frame, 5798, 5815) * (1 - releaseRay)} />
				)}
				{recall > 0 && (
					<>
						<LightPool x={957} y={745} radius={258} color="239,113,95" opacity={recall * .54} />
						<ScreenSvg style={{opacity: recall, mixBlendMode: 'screen'}}>
							<path d="M957 745Q1021 556 1019 434Q993 559 950 740Z" fill="#e78d84" opacity=".42" />
							<path d="M957 745Q1008 562 1019 434" fill="none" stroke="#ffd4bd" strokeWidth="3.2" />
						</ScreenSvg>
					</>
				)}
				{arc > 0 && arcOut > 0 && <MoveArc opacity={arcOut * .85} progress={arc} />}
				<BattleLight frame={frame} power={hit} />
				<LightPool x={rayX} y={rayY} radius={618} color="252,242,231" opacity={flash * .97} />
				<MegaMark frame={frame} at={K.riteMegaAt} x={rayX} y={rayY + 13} height={206} />
			</AbsoluteFill>
			<ShaderCanvas frag={VEIL_FRAG} width={W} height={H} scale={.44}
				uniforms={{uTime: time, uCenter: .86 - lift * .46, uWidth: .24 + lift * .16, uDensity: .19 + lift * .56, uTint: [.41, .52, .60]}}
				style={{position: 'absolute', inset: 0}} />
			<AbsoluteFill style={{background: 'linear-gradient(180deg, #050a1a26, transparent 31%, transparent 72%, #060d18a6)', pointerEvents: 'none'}} />
		</AbsoluteFill>
	);
};
