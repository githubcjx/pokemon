import {groundOf, smooth, XerneasPose} from './OpeningArt';

type Point = {x: number; y: number};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (seed: number) => {
	const v = Math.sin(seed * 91.773 + 17.21) * 43758.5453;
	return v - Math.floor(v);
};
const quadratic = (a: Point, b: Point, c: Point, t: number) => {
	const u = 1 - t;
	return {x: u * u * a.x + 2 * u * t * b.x + t * t * c.x, y: u * u * a.y + 2 * u * t * b.y + t * t * c.y};
};
const pt = ({x, y}: Point) => `${x.toFixed(1)} ${y.toFixed(1)}`;

const ENERGY_TIPS = Array.from({length: 14}, (_, i) => ({
	x: i * 151 + rand(i + 4) * 66 - 38,
	y: 658 + rand(i + 23) * 230,
	delay: rand(i + 4) * 0.33,
}));

export const LifeLight: React.FC<{pose: XerneasPose; gleam: number; wave: number; transfer: number}> = ({pose, gleam, wave, transfer}) => {
	const origin = {x: pose.x + 25 * pose.scale, y: groundOf(pose) - 7};
	const waveLight = Math.sin(Math.PI * wave);
	if (gleam <= 0 && waveLight < 0.001 && (transfer <= 0 || transfer >= 1)) return null;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
			<defs>
				<radialGradient id="kalos-light" gradientUnits="userSpaceOnUse" cx={pose.x} cy={pose.y - 76 * pose.scale} r={530}>
					<stop offset={0} stopColor="#F7DFA5" stopOpacity={0.26} />
					<stop offset={0.42} stopColor="#F2D78C" stopOpacity={0.12} />
					<stop offset={1} stopColor="#F2D78C" stopOpacity={0} />
				</radialGradient>
			</defs>
			<rect width={1920} height={1080} fill="url(#kalos-light)" opacity={gleam} />
			<g transform={`translate(${origin.x} ${origin.y})`} fill="none" stroke="#F2D78C" strokeWidth={1.8} opacity={waveLight}>
				<ellipse rx={65 + wave * 1210} ry={12 + wave * 172} opacity={0.57} />
				<ellipse rx={49 + wave * 1150} ry={9 + wave * 165} opacity={0.29} />
			</g>
			<g stroke="#F1D99D" strokeWidth={1.8} fill="none" strokeLinecap="round">
				{ENERGY_TIPS.map((tip) => {
					const t = smooth(transfer, tip.delay, tip.delay + 0.66);
					if (t <= 0 || t >= 1) return null;
					const bend = {x: mix(origin.x, tip.x, 0.58), y: mix(origin.y, tip.y, 0.52) - 110};
					const head = quadratic(origin, bend, tip, t);
					const alpha = Math.sin(t * Math.PI);
					return (
						<g key={tip.x} opacity={alpha}>
							<path d={`M${pt(origin)} Q${pt(bend)} ${pt(tip)}`} pathLength={1} strokeDasharray={`${t} 1`} opacity={0.35} />
							<circle cx={head.x} cy={head.y} r={3} fill="#FDF1C8" stroke="none" />
						</g>
					);
				})}
			</g>
		</svg>
	);
};
