import {AbsoluteFill, interpolate} from 'remotion';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {clamp} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {AIR_FRAG, LAND_AND_SEA_FRAG, VEIL_FRAG} from './air';
import {K, ramp, SEG_START} from './common';
import {Meteor} from './elements';

const W = 1920;
const H = 1080;
const CONTACT = 1065;

const AirVeil: React.FC<{
	frame: number;
	center: number;
	width: number;
	density: number;
	tint: [number, number, number];
}> = ({frame, center, width, density, tint}) => {
	if (density <= 0) return null;
	return (
		<ShaderCanvas
			frag={VEIL_FRAG}
			width={W}
			height={H}
			scale={.46}
			uniforms={{uTime: frame / BASE_FPS, uCenter: center, uWidth: width, uDensity: density, uTint: tint}}
			style={{position: 'absolute', inset: 0}}
		/>
	);
};

export const OpeningVeil: React.FC = () => {
	const frame = useFrame();
	const inCloud = ramp(frame, SEG_START.unseen, 504) * (1 - ramp(frame, 506, 597));
	const travel = ramp(frame, SEG_START.unseen, 597);
	return <AirVeil frame={frame} center={.79 - travel * .66} width={.53} density={inCloud * 1.31} tint={[.49, .59, .68]} />;
};

const rayPose = (frame: number) => {
	const approach = ramp(frame, K.shadowAt - 27, K.nameAt);
	const feeding = ramp(frame, 952, 1081);
	const glide = interpolate(frame, [672, 1310], [0, 1], clamp);
	return {
		x: 1518 - 230 * approach - 91 * feeding - 80 * glide,
		y: 397 + 59 * approach + 7 * feeding + 12 * Math.sin(frame / 41),
		size: 206 + 466 * approach + 135 * feeding,
	};
};

const onRay = (pose: ReturnType<typeof rayPose>, x: number, y: number): [number, number] => [
	pose.x + (x - .5) * pose.size,
	pose.y + (y - .5) * pose.size,
];

const [mouthX, mouthY] = onRay(rayPose(CONTACT), .105, .417);

const FoodLight: React.FC<{frame: number; pose: ReturnType<typeof rayPose>}> = ({frame, pose}) => {
	const pulse = ramp(frame, CONTACT - 6, CONTACT + 1) * (1 - ramp(frame, CONTACT + 4, CONTACT + 26));
	const stored = ramp(frame, CONTACT + 7, CONTACT + 22) * (1 - ramp(frame, 1209, 1270));
	if (pulse <= 0 && stored <= 0) return null;
	const p = (x: number, y: number) => onRay(pose, x, y).join(' ');
	const path = `M${p(.105, .417)} Q${p(.19, .29)} ${p(.33, .34)} C${p(.55, .42)} ${p(.62, .58)} ${p(.48, .71)} S${p(.22, .86)} ${p(.11, .76)}`;
	const [x, y] = onRay(pose, .105, .417);
	const charge = interpolate(frame, [CONTACT + 12, 1220], [0, 1.06], clamp);
	return (
		<svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
			<defs>
				<radialGradient id="wish-swallow">
					<stop stopColor="#fff2cc" stopOpacity=".88" />
					<stop offset=".29" stopColor="#ffd288" stopOpacity=".48" />
					<stop offset="1" stopColor="#ffa259" stopOpacity="0" />
				</radialGradient>
				<filter id="wish-energy-bloom"><feGaussianBlur stdDeviation="9" /></filter>
			</defs>
			<circle cx={x} cy={y} r={35 + (1 - pulse) * 33} fill="url(#wish-swallow)" opacity={pulse} />
			<g opacity={stored}>
				<path d={path} pathLength={1} fill="none" stroke="#ffe297" strokeWidth="18" strokeDasharray={`${charge} 1`} filter="url(#wish-energy-bloom)" opacity=".67" />
				<path d={path} pathLength={1} fill="none" stroke="#fff3bf" strokeWidth="2.2" strokeDasharray={`${charge} 1`} strokeLinecap="round" opacity=".52" />
				{[[.32, .34], [.51, .46], [.54, .63], [.36, .785], [.22, .806]].map(([u, v], i) => {
					const [cx, cy] = onRay(pose, u, v);
					const lit = ramp(frame, CONTACT + 26 + i * 23, CONTACT + 42 + i * 23);
					return (
						<g key={i} opacity={lit}>
							<circle cx={cx} cy={cy} r={32} fill="url(#wish-swallow)" opacity=".73" />
							<circle cx={cx} cy={cy} r={2.3} fill="#fff5d8" />
						</g>
					);
				})}
			</g>
		</svg>
	);
};

const SkyDragon: React.FC<{frame: number}> = ({frame}) => {
	const visible = ramp(frame, 682, 738) * (1 - ramp(frame, 1282, 1335));
	if (visible <= 0) return null;
	const pose = rayPose(frame);
	const color = ramp(frame, K.shadowAt + 5, K.nameAt);
	const eat = ramp(frame, CONTACT - 47, CONTACT + 2) * (1 - ramp(frame, CONTACT + 5, CONTACT + 31));
	const charged = ramp(frame, CONTACT, 1198) * (1 - ramp(frame, 1219, 1309));
	return (
		<AbsoluteFill style={{opacity: visible}}>
			<PokemonArt3D
				dir="pokemon/rayquaza"
				x={pose.x}
				y={pose.y}
				size={760}
				style={{transform: `scale(${pose.size / 760})`}}
				yaw={-1.2 + 1.1 * Math.sin(frame / 77)}
				pitch={1.9 + 1.2 * Math.sin(frame / 54)}
				depthScale={.5}
				resolution={.94}
				ambient={[.07 + color * .65, .10 + color * .65, .15 + color * .58]}
				dirLights={[
					{dir: [0.58, -.74, .5], color: [.13, .22, .25], wrap: .35},
					{dir: [-.89, -.29, .43], color: [.74 * eat, .42 * eat, .16 * eat]},
				]}
				rim={{dir: [.64, -.74], color: [.19, .59, .53], power: 2.9}}
				emissive={.26 * charged}
				emissiveTint={[1, .72, .22]}
				emissiveKey={[.42, .72, .22, .46]}
			/>
			<Meteor
				frame={frame} from={1002} to={CONTACT} x0={-95} y0={270} x1={mouthX} y1={mouthY}
				size={.19} spin={.42} opacity={1 - ramp(frame, CONTACT - 4, CONTACT)}
			/>
			<FoodLight frame={frame} pose={pose} />
			<NameTag
				from={K.nameAt} x={212} y={392} no="No.0384" zh="烈空坐" en="RAYQUAZA"
				category="天空宝可梦" categoryEn="SKY HIGH POKÉMON" tone="mono" glowRgb="112,206,180"
				opacity={1 - ramp(frame, 921, 958)}
			/>
		</AbsoluteFill>
	);
};

const Bolts: React.FC<{first: number; second: number}> = ({first, second}) => (
	<svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
		<defs><filter id="wish-bolt-glow"><feGaussianBlur stdDeviation="10" /></filter></defs>
		{[
			{opacity: first, path: 'M1455 55l-37 67 51 43-36 39 14 51-43 71 13 36-60 75 m81-183 49 16 29 53 57 18'},
			{opacity: second, path: 'M1670 25l35 63-27 37 53 50-22 42 39 54-46 86 m9-139-43 32-27 67'},
		].map(({opacity, path}) => (
			<g key={path} opacity={opacity} fill="none" strokeLinejoin="round">
				<path d={path} stroke="#88baff" strokeWidth="16" filter="url(#wish-bolt-glow)" />
				<path d={path} stroke="#c8ddff" strokeWidth="1.8" />
			</g>
		))}
	</svg>
);

const LandAndSea: React.FC<{frame: number; visibility: number}> = ({frame, visibility}) => {
	const descent = ramp(frame, SEG_START.clash, 1452);
	const groudon = ramp(frame, 1398, K.groudonAt);
	const kyogre = ramp(frame, 1420, K.kyogreAt);
	const wave = ramp(frame, 1552, 1634) * (1 - ramp(frame, 1659, 1760));
	const ray = ramp(frame, 1628, 1694);
	const calm = ramp(frame, 1690, 1853);
	const firstBolt = ramp(frame, 1567, 1570) * (1 - ramp(frame, 1571, 1586));
	const secondBolt = ramp(frame, 1626, 1629) * (1 - ramp(frame, 1629, 1643)) * .72;
	const flash = Math.max(firstBolt, secondBolt);
	const tags = 1 - ramp(frame, 1558, 1590);
	return (
		<AbsoluteFill style={{opacity: visibility}}>
			<ShaderCanvas
				frag={LAND_AND_SEA_FRAG}
				width={W}
				height={H}
				scale={.72}
				uniforms={{uTime: frame / BASE_FPS, uDescent: descent, uRift: ray, uFlash: flash, uCalm: calm}}
				style={{position: 'absolute', inset: 0}}
			/>
			{flash > 0 && <Bolts first={firstBolt} second={secondBolt} />}
			<AbsoluteFill style={{opacity: Math.max(groudon, kyogre), background: 'radial-gradient(ellipse 16% 5% at 27% 81%, #0f0b16b8, transparent), radial-gradient(ellipse 17% 4% at 75% 68%, #08142696, transparent)', pointerEvents: 'none'}} />
			{ray > 0 && (
				<PokemonArt3D
					dir="pokemon/rayquaza"
					x={1045 - ray * 39} y={102 + ray * 177 - calm * 39} size={414}
					yaw={-3} pitch={4} resolution={.93} depthScale={.5}
					opacity={ray * .89}
					ambient={[.29, .43, .42]}
					dirLights={[{dir: [-.24, -.88, .64], color: [.26, .52, .46]}]}
					rim={{dir: [.03, -.91], color: [.29, .66, .54], power: 2.9}}
				/>
			)}
			{groudon > 0 && (
				<PokemonArt3D
					dir="pokemon/groudon"
					x={462 + 57 * groudon + 29 * wave} y={643 - 11 * wave + 15 * calm} size={692}
					yaw={3 + 2 * wave} pitch={1.7} depthScale={.5} resolution={.88}
					opacity={groudon * (1 - calm * .32)}
					ambient={[.08 + groudon * .30, .043 + groudon * .18, .06 + groudon * .17]}
					dirLights={[{dir: [-.37, .91, .27], color: [.64, .30, .13], wrap: .34}]}
					rim={{dir: [-.52, .56], color: [.91, .49, .22], power: 2.8}}
				/>
			)}
			{kyogre > 0 && (
				<PokemonArt3D
					dir="pokemon/kyogre"
					x={1503 - kyogre * 59 - wave * 39} y={636 - kyogre * 52 + 15 * Math.sin(frame / 34) + calm * 60}
					size={734} yaw={-3 - 2 * wave} pitch={-3.2} depthScale={.5} resolution={.88}
					opacity={kyogre * (1 - calm * .32)}
					ambient={[.12 + kyogre * .22, .15 + kyogre * .28, .23 + kyogre * .34]}
					dirLights={[{dir: [.62, -.64, .47], color: [.26 + .33 * flash, .40 + .45 * flash, .57 + .49 * flash], wrap: .36}]}
					rim={{dir: [.67, -.47], color: [.38, .63, .88], power: 2.6}}
				/>
			)}
			<AirVeil frame={frame} center={.77 + calm * .09} width={.27} density={.30 + wave * .54 + ray * .13} tint={[.48, .57, .63]} />
			<AbsoluteFill style={{background: 'linear-gradient(180deg, transparent 73%, #070b16a3)', pointerEvents: 'none'}} />
			{tags > 0 && (
				<>
					<NameTag compact from={K.groudonAt - 26} x={214} y={271} no="No.0383" zh="固拉多" en="GROUDON"
						category="大陆宝可梦" categoryEn="CONTINENT POKÉMON" tone="mono" glowRgb="221,123,85" opacity={tags} />
					<NameTag compact from={K.kyogreAt - 26} x={1706} y={271} no="No.0382" zh="盖欧卡" en="KYOGRE"
						category="海底宝可梦" categoryEn="SEA BASIN POKÉMON" align="right" tone="mono" glowRgb="101,160,230" opacity={tags} />
				</>
			)}
		</AbsoluteFill>
	);
};

/** 片名退场以后，镜头从云海转向臭氧层，再下探到陆地和海洋。 */
export const UpperSeg: React.FC = () => {
	const frame = useFrame();
	const toSky = ramp(frame, SEG_START.unseen, 677);
	const toClash = ramp(frame, SEG_START.clash, 1454);
	const cloud = ramp(frame, 1291, 1378) * (1 - ramp(frame, 1380, 1475));
	return (
		<AbsoluteFill>
			{toClash < 1 && (
				<>
					<ShaderCanvas
						frag={AIR_FRAG}
						width={W}
						height={H}
						scale={.72}
						uniforms={{
							uTime: frame / BASE_FPS,
							uHorizon: .54 + toSky * .215 - cloud * .37,
							uDrift: .32 + toSky * .83 + cloud * .30,
							uAurora: .46 + toSky * .94,
							uDim: .72 * (1 - toSky),
						}}
						style={{position: 'absolute', inset: 0}}
					/>
					<Meteor frame={frame} from={897} to={1006} x0={-230} y0={198} x1={2160} y1={322} size={.23} />
					<Meteor frame={frame} from={935} to={1108} x0={-170} y0={302} x1={2120} y1={540} size={.115} />
					<Meteor frame={frame} from={1019} to={1198} x0={-310} y0={119} x1={2140} y1={215} size={.15} />
					<SkyDragon frame={frame} />
					<Meteor frame={frame} from={960} to={1051} x0={-320} y0={634} x1={2260} y1={769} size={.28} />
				</>
			)}
			{toClash > 0 && <LandAndSea frame={frame} visibility={toClash} />}
			<AirVeil frame={frame} center={.73 - ramp(frame, 1291, 1475) * .63} width={.61} density={cloud * 1.29} tint={[.44, .49, .55]} />
		</AbsoluteFill>
	);
};
