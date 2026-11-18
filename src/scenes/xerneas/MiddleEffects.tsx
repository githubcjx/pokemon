import {AbsoluteFill, Img, staticFile} from 'remotion';
import {groundOf, smooth, XerneasPose} from './OpeningArt';

const PALETTE = ['#FF879F', '#FFB077', '#F8DB83', '#9DE4B7', '#93E4E9', '#A7BDF9', '#CEA7F1'];
const TIPS = [[149, -215], [227, -184], [-231, -185], [-140, -159], [-7, -181], [74, -190], [47, -190]];

export const CrownLight: React.FC<{pose: XerneasPose; amount: number}> = ({pose, amount}) => {
	if (amount <= 0) return null;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
			<defs>
				{PALETTE.map((color, i) => (
					<radialGradient key={color} id={`kalos-crown-${i}`}>
						<stop offset={0} stopColor="#FAFCFF" stopOpacity={0.88} />
						<stop offset={0.23} stopColor={color} stopOpacity={0.49} />
						<stop offset={1} stopColor={color} stopOpacity={0} />
					</radialGradient>
				))}
			</defs>
			<g transform={`translate(${pose.x} ${pose.y}) scale(${pose.scale})`} opacity={amount * 0.83}>
				{TIPS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={22 + amount * 22} fill={`url(#kalos-crown-${i})`} />)}
			</g>
		</svg>
	);
};

export const EyeInset: React.FC<{pose: XerneasPose; amount: number}> = ({pose, amount}) => {
	if (amount <= 0) return null;
	const x = 488;
	const y = 462;
	const radius = 191;
	const eyeX = pose.x + 23.5 * pose.scale;
	const eyeY = pose.y + 15.6 * pose.scale;
	const detailScale = 1.66;
	return (
		<AbsoluteFill style={{opacity: amount, pointerEvents: 'none'}} aria-hidden="true">
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} fill="none" stroke="#9DCCE9" strokeWidth={1.8}>
				<path d={`M${x + radius - 3} ${y - 38} H${eyeX - 113} L${eyeX - 10} ${eyeY + 2}`} opacity={0.48} />
				<circle cx={eyeX} cy={eyeY} r={13 + 6 * (1 - amount)} opacity={0.77} />
				<circle cx={x} cy={y} r={radius + 12} strokeDasharray="44 10 3 10" opacity={0.29} />
			</svg>
			<div style={{position: 'absolute', left: x - radius, top: y - radius, width: 2 * radius, height: 2 * radius, borderRadius: '50%', overflow: 'hidden', background: 'radial-gradient(ellipse at center, #1B2E45, #111B2C 74%)', border: '1.8px solid rgba(157,204,233,0.63)', boxShadow: '0 0 26px rgba(141,199,240,0.12)', boxSizing: 'border-box'}}>
				<Img src={staticFile('pokemon/xerneas/art-eye-line.png')} style={{position: 'absolute', width: 345 * detailScale, height: 240 * detailScale, left: radius - 164 * detailScale, top: radius - 120 * detailScale}} />
			</div>
		</AbsoluteFill>
	);
};

const RAYS = [
	{dx: -448, dy: 9, lean: -151, rise: 509, wait: 0.12},
	{dx: -313, dy: 31, lean: -124, rise: 685, wait: 0.02},
	{dx: -187, dy: -18, lean: -69, rise: 694, wait: 0},
	{dx: -57, dy: 35, lean: -63, rise: 542, wait: 0.17},
	{dx: 165, dy: -18, lean: 85, rise: 716, wait: 0.05},
	{dx: 317, dy: 29, lean: 153, rise: 662, wait: 0.09},
	{dx: 447, dy: 5, lean: 187, rise: 550, wait: 0.22},
];

export const GroundGeomancy: React.FC<{frame: number; pose: XerneasPose; charge: number; release: number; light: number}> = ({frame, pose, charge, release, light}) => {
	if (charge <= 0 && light <= 0) return null;
	const ground = groundOf(pose) - 9;
	const originX = pose.x + 30 * pose.scale;
	const shimmer = 0.87 + Math.sin(frame * 0.16) * 0.13;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
			<defs>
				<radialGradient id="kalos-ground-gold">
					<stop offset={0} stopColor="#FFEBC3" stopOpacity={0.75} />
					<stop offset={0.38} stopColor="#F2D78C" stopOpacity={0.23} />
					<stop offset={1} stopColor="#F2D78C" stopOpacity={0} />
				</radialGradient>
				{RAYS.map((ray, i) => (
					<linearGradient key={ray.dx} id={`kalos-beam-${i}`} gradientUnits="userSpaceOnUse" x1={ray.dx} y1={ray.dy} x2={ray.dx + ray.lean} y2={ray.dy - ray.rise}>
						<stop offset={0} stopColor="#FFF4D7" />
						<stop offset={0.19} stopColor={PALETTE[i]} />
						<stop offset={0.78} stopColor={PALETTE[i]} stopOpacity={0.7} />
						<stop offset={1} stopColor={PALETTE[i]} stopOpacity={0} />
					</linearGradient>
				))}
			</defs>
			<g transform={`translate(${originX} ${ground})`}>
				<ellipse rx={400 + 220 * release} ry={49 + 58 * release} fill="url(#kalos-ground-gold)" opacity={charge * 0.3 + light * 0.67} />
				<g fill="none" stroke="#F7DCA2" strokeWidth={1.8} opacity={charge * 0.69}>
					{[130, 223, 348, 465, 546].map((r, i) => <ellipse key={r} rx={r * (0.74 + release * 0.36)} ry={(15 + i * 13) * (0.8 + release * 0.26)} opacity={0.68 - i * 0.081} strokeDasharray={i % 2 ? '70 13 8 13' : undefined} strokeDashoffset={frame * (i % 2 ? 0.52 : -0.37)} />)}
				</g>
				{RAYS.map(({dx, dy, lean, rise, wait}, i) => {
					const draw = smooth(release, wait, wait + 0.64);
					if (draw <= 0 || light <= 0) return null;
					const d = `M${dx} ${dy} Q${dx + lean * 0.23} ${dy - rise * 0.48} ${dx + lean} ${dy - rise}`;
					return (
						<g key={dx} opacity={light * shimmer}>
							<path d={d} pathLength={1} strokeDasharray={`${draw} 1`} stroke={`url(#kalos-beam-${i})`} strokeWidth={1.8} fill="none" style={{filter: `drop-shadow(0 0 8px ${PALETTE[i]})`}} />
							<path d={`M${dx + 12} ${dy + 8} Q${dx + lean * 0.42 + 10} ${dy - rise * 0.45} ${dx + lean + 19} ${dy - rise * 0.92}`} pathLength={1} strokeDasharray={`${draw} 1`} stroke={`url(#kalos-beam-${i})`} strokeWidth={1.8} opacity={0.35} fill="none" />
							<ellipse cx={dx} cy={dy} rx={43 + 24 * draw} ry={10 + 7 * draw} fill="url(#kalos-ground-gold)" />
						</g>
					);
				})}
				<g fill="none" strokeWidth={1.8} strokeLinejoin="round" opacity={light * 0.68}>
					{Array.from({length: 28}, (_, i) => {
						const phase = ((frame - 1340 + i * 13) % 87 + 87) % 87 / 87;
						const a = i * 2.399963;
						const x = Math.cos(a) * (79 + 412 * phase);
						const y = Math.sin(a) * (9 + phase * 57) - phase * (77 + (i % 5) * 53);
						return <path key={i} d="M0 -8 Q6 -3 5 3 L0 8 L-5 2Z" transform={`translate(${x} ${y}) rotate(${i * 23 + phase * 64})`} stroke={PALETTE[i % PALETTE.length]} opacity={Math.sin(phase * Math.PI)} />;
					})}
				</g>
			</g>
		</svg>
	);
};
