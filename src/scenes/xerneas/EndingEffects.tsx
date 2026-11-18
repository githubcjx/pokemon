import {AbsoluteFill, Img, staticFile} from 'remotion';
import type {V3} from '../../three/stage';
import {terrain, View} from './DepthWorld';
import {smooth} from './OpeningArt';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const AIR = {yveltal: {aspect: 1385 / 1260, glow: '255,110,137'}, zygarde: {aspect: 1228 / 1260, glow: '133,232,163'}};

export const LegendFigure: React.FC<{name: keyof typeof AIR; view: View; point: V3; height: number; amount: number; glow: number; roll?: number}> = ({name, view, point, height, amount, glow, roll = 0}) => {
	if (amount <= 0) return null;
	const screen = view.project(point);
	if (!screen) return null;
	const pixels = height * view.focal / screen.depth;
	const asset = AIR[name];
	const fit: React.CSSProperties = {position: 'absolute', inset: 0, width: '100%', height: '100%'};
	return (
		<div style={{position: 'absolute', left: screen.x, top: screen.y, width: pixels * asset.aspect, height: pixels, transform: `translate(-50%, -50%) rotate(${roll}deg)`, opacity: amount, pointerEvents: 'none'}}>
			<Img src={staticFile(`pokemon/${name}/art-fill.png`)} style={{...fit, opacity: 0.88}} />
			<Img src={staticFile(`pokemon/${name}/art-line.png`)} style={{...fit, filter: `drop-shadow(0 0 ${5 + glow * 12}px rgba(${asset.glow},${0.44 + glow * 0.48}))`}} />
		</div>
	);
};

export const LifeGather: React.FC<{view: View; point: V3; amount: number; time: number}> = ({view, point, amount, time}) => {
	if (amount <= 0) return null;
	const end = view.project(point);
	if (!end) return null;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} fill="none" strokeWidth={1.8} aria-hidden="true">
			{Array.from({length: 14}, (_, i) => {
				const start = view.project([(i - 6.5) * 4.9, 1.2 + i % 4, 9 + (i * 7) % 30]);
				if (!start) return null;
				const t = ((time * 0.015 + i * 0.147) % 1 + 1) % 1;
				const midX = lerp(start.x, end.x, 0.26) + (i - 6.5) * 7;
				const midY = lerp(start.y, end.y, 0.62) - 98;
				const x = lerp(lerp(start.x, midX, t), lerp(midX, end.x, t), t);
				const y = lerp(lerp(start.y, midY, t), lerp(midY, end.y, t), t);
				return (
					<g key={i} opacity={amount * Math.sin(t * Math.PI)}>
						<path d={`M${start.x} ${start.y} Q${midX} ${midY} ${end.x} ${end.y}`} pathLength={1} strokeDasharray="0.28 1" strokeDashoffset={-t} stroke="#F4B7B3" opacity={0.6} />
						<circle cx={x} cy={y} r={2.5 + (i % 3) * 0.55} fill="#FFD3C2" />
					</g>
				);
			})}
		</svg>
	);
};

export const RockPass: React.FC<{progress: number; reverse?: boolean}> = ({progress, reverse = false}) => {
	if (progress <= 0 || progress >= 1) return null;
	const x = 1930 - 4630 * progress;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
			<g transform={reverse ? 'translate(1920 0) scale(-1 1)' : undefined}>
				<g transform={`translate(${x} 0)`}>
					<path d="M200 -120 L-18 98 L121 275 L61 505 L132 689 L-27 929 L58 1190 H2610 L2510 904 L2620 628 L2507 389 L2604 171 L2545 -120Z" fill="#151523" />
					<g fill="none" stroke="#B085A0" strokeWidth={1.8} strokeLinecap="round" opacity={0.25}>
						<path d="M235 -30 L62 109 L179 278 L115 492 L181 691 L40 925 L112 1130 M322 -45 L168 121 L236 287 L189 521 L259 702 L126 933 L171 1080" />
						<path d="M2420 -35 L2511 171 L2417 394 L2527 624 L2417 907 L2537 1110 M2334 -80 L2441 163 L2339 395 L2459 640 L2358 903 L2422 1120" />
					</g>
				</g>
			</g>
		</svg>
	);
};

export const Cocoon: React.FC<{view: View; amount: number}> = ({view, amount}) => {
	if (amount <= 0) return null;
	const s = view.project([4.5, 4.5, 20]);
	if (!s) return null;
	const scale = view.focal * 8.2 / (118 * s.depth);
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
			<defs>
				<radialGradient id="kalos-cocoon-air"><stop offset={0} stopColor="#E37D97" stopOpacity={0.24} /><stop offset={1} stopColor="#A55972" stopOpacity={0} /></radialGradient>
			</defs>
			<g transform={`translate(${s.x} ${s.y}) scale(${scale})`} opacity={amount}>
				<ellipse rx={105} ry={88} fill="url(#kalos-cocoon-air)" />
				{/* 参考《XYZの伝説！》的收拢翼缘、三枚凸尖与中线菱纹。 */}
				<g transform="rotate(24) translate(-131 -77)" fill="none" stroke="#DB93AA" strokeWidth={0.68} strokeLinejoin="round">
					<path d="M129 135 Q109 132 98 115 Q86 99 89 78 Q90 54 113 32 Q114 25 120 18 Q125 24 126 31 Q129 22 134 18 Q140 23 139 34 Q142 27 147 22 Q152 29 150 37 Q167 54 173 74 Q176 97 162 116 Q148 132 129 135Z" fill="#191625" />
					<path d="M98 110 Q117 100 127 104 Q147 97 163 109 Q153 128 129 135 Q109 132 98 110Z" fill="#0F101C" opacity={0.86} />
					<path d="M114 35 Q106 57 108 76 Q110 94 125 105 M151 38 Q157 61 153 80 Q148 97 129 105 M119 28 L117 38 M134 24 L131 39 M147 30 L143 40" opacity={0.65} />
					<path d="M124 44 L128 47 L130 54 L126 62 L122 56 L121 50Z M123 70 L128 72 L130 79 L124 89 L120 82 L119 76Z M123 98 L126 101 L126 105 L123 111 L120 107 L120 102Z M168 56 L171 63 L171 68 L166 61Z M172 72 L173 81 L170 90 L169 84Z" fill="#5A3C4B" stroke="#E1A5B5" />
				</g>
				<g fill="none" stroke="#A76F88" strokeWidth={0.64} opacity={0.28}>
					<ellipse cy={56} rx={76} ry={8.5} /><ellipse cy={58} rx={93} ry={12} />
				</g>
			</g>
		</svg>
	);
};

export const Cells: React.FC<{view: View; target: V3; frame: number; amount: number}> = ({view, target, frame, amount}) => {
	if (amount <= 0) return null;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
			{Array.from({length: 28}, (_, i) => {
				const phase = smooth(frame, 384 + (i * 7) % 41, 443 + (i * 7) % 46);
				const angle = i * 2.39996 + phase * 0.85;
				const radius = 5.8 + i % 5 * 3.5;
				const p = view.project([
					target[0] + Math.cos(angle) * radius * (1 - phase),
					lerp(0.9 + i % 6 * 0.62, target[1] + Math.sin(angle * 1.7) * 3.1, phase),
					target[2] + Math.sin(angle) * radius * (1 - phase),
				]);
				if (!p) return null;
				const r = Math.min(26, view.focal * (0.11 + i % 4 * 0.037) / p.depth);
				return (
					<g key={i} transform={`translate(${p.x} ${p.y}) rotate(${i * 23 + phase * 49}) scale(${r / 8})`} opacity={amount * (0.79 - phase * 0.32)}>
						<path d="M0 -8 L6.9 -4 L6.9 4 L0 8 L-6.9 4 L-6.9 -4Z" fill="#18302C" stroke="#A2EDB6" strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
						<circle r={2.2} fill="#D8F9D8" />
					</g>
				);
			})}
		</svg>
	);
};

export const NewLeaves: React.FC<{view: View; frame: number}> = ({view, frame}) => {
	if (frame < 558) return null;
	const plants = [[-7.4,-6.4], [-4.8,-2.8], [-1.4,-4.8], [4.7,-6.5], [7.8,-2.3], [12,1], [-10.9,1.8], [5.8,5.4], [11,8.2]];
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}} aria-hidden="true">
			{plants.map(([x,z],i) => {
				const a = smooth(frame, 558 + i * 6, 623 + i * 6);
				const base = view.project([x, terrain(x,z), z]);
				if (!base || a <= 0) return null;
				const k = Math.min(2.8, view.focal / (65 * base.depth));
				return <g key={i} transform={`translate(${base.x} ${base.y}) scale(${k})`} opacity={a * (0.4 + Math.sin(frame * 0.056 + i * 0.7) * 0.16)}>
				<path d="M0 0 Q-5 -17 1 -38 M-1 -23 Q-19 -22 -22 -43 Q-7 -39 -1 -23 M0 -31 Q5 -47 20 -49 Q14 -35 0 -31" pathLength={1} strokeDasharray={`${a} 1`} stroke="#ABDBB6" strokeWidth={1.8} vectorEffect="non-scaling-stroke" fill="none" />
				</g>;
			})}
		</svg>
	);
};
