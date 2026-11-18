import React from 'react';
import {Tapestry, TapestryDefs} from './Tapestry';

export type VaultCamera = {x: number; y: number; zoom: number};
export const PANEL_X = [130, 630, 1130, 1630] as const;
export const PANEL_Y = 145;
export const EMPTY_ROD_X = 2190;

const STONES = (() => {
	const stones: Array<{d: string; marks: string; x: number; y: number; w: number; h: number; tone: number; chip: number}> = [];
	const heights = [121, 168, 92, 146, 109, 185, 101, 137, 113, 162, 96, 151, 123, 173, 105, 140, 120, 160];
	const widths = [174, 288, 216, 405, 153, 326, 245, 370, 192, 275, 338];
	let y = -600;
	heights.forEach((h, row) => {
		let x = -800 - (row * 83 % 290);
		let i = 0;
		while (x < 3900) {
			const w = widths[(i * 3 + row * 5) % widths.length] + (row * 19 + i * 13) % 37;
			const chip = 3 + (i * 7 + row * 3) % 10;
			const top = y + 2 + (i * 3 + row) % 4;
			const bottom = y + h - 4 - (i + row * 2) % 5;
			const d = `M${x + 4} ${top + chip} L${x + chip} ${top + 1} L${x + w * .24} ${top + 3} L${x + w * .28} ${top + 6} L${x + w * .32} ${top + 2} L${x + w - chip - 3} ${top} L${x + w - 4} ${top + chip} L${x + w - 5 - chip * .4} ${top + (bottom - top) * .53} L${x + w - 5} ${bottom - chip} L${x + w - chip - 2} ${bottom} L${x + w * .63} ${bottom - 2} L${x + w * .57} ${bottom - 6} L${x + w * .53} ${bottom - 2} L${x + chip} ${bottom + 1} L${x + 3} ${bottom - chip} L${x + 4 + chip * .4} ${top + (bottom - top) * .37}Z`;
			const marks = Array.from({length: 11}, (_, k) => {
				const px = x + 16 + ((i * 79 + row * 53 + k * 71 + k * k * 17) % Math.floor(w - 36));
				const py = top + 12 + ((i * 17 + row * 29 + k * 31 + k * k * 11) % Math.floor(bottom - top - 24));
				return `M${px} ${py}l${3 + (k * 5 + i) % 12} ${(k + row) % 5 - 2}`;
			}).join(' ');
			stones.push({d, marks, x, y: top, w, h: bottom - top, tone: (i * 7 + row * 11) % 9, chip});
			x += w;
			i++;
		}
		y += h;
	});
	return stones;
})();

export const Vault: React.FC<{camera: VaultCamera; frame: number; starProgress?: number; starGlow?: number}> = ({camera, frame, starProgress = 0, starGlow = 0}) => {
	const flicker = .91 + .06 * Math.sin(frame * .13) + .03 * Math.sin(frame * .31);
	const reveal = Math.min(1, .08 + frame / 70);
	return (
		<svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, background: '#120f0e'}}>
			<TapestryDefs />
			<defs>
				<pattern id="galar-stone-grain" width="96" height="96" patternUnits="userSpaceOnUse">
					<rect width="96" height="96" filter="url(#galar-fiber)" />
					<path d="M4 23l8 -2 M48 7l5 1 M72 48l11 -3 M17 77l6 2 M59 87l10 -1" stroke="#d7c6a7" strokeWidth="1" opacity=".5" />
				</pattern>
				<filter id="galar-stone-mottle"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="13" /><feColorMatrix type="saturate" values="0" /></filter>
				<pattern id="galar-stone-mottle-pattern" width="180" height="180" patternUnits="userSpaceOnUse"><rect width="180" height="180" filter="url(#galar-stone-mottle)" /></pattern>
				<radialGradient id="galar-torchlight" gradientUnits="userSpaceOnUse" cx="-60" cy="340" r="2850" gradientTransform="translate(0 140) scale(1 .58)">
					<stop stopColor="#e99a4c" stopOpacity=".34" /><stop offset=".23" stopColor="#b96836" stopOpacity=".17" />
					<stop offset=".56" stopColor="#70452d" stopOpacity=".035" /><stop offset="1" stopColor="#1b1512" stopOpacity=".08" />
				</radialGradient>
				<linearGradient id="galar-darkness" x1="0" y1="0" x2="1" y2="0">
					<stop stopColor="#130f0e" stopOpacity=".02" /><stop offset=".35" stopColor="#100d0c" stopOpacity=".1" />
					<stop offset=".65" stopColor="#080708" stopOpacity=".56" /><stop offset="1" stopColor="#080708" stopOpacity=".93" />
				</linearGradient>
				<radialGradient id="galar-flame"><stop stopColor="#fff4be" /><stop offset=".38" stopColor="#ffc865" /><stop offset="1" stopColor="#cd5425" stopOpacity="0" /></radialGradient>
				<linearGradient id="galar-damp" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#0d100f" stopOpacity="0" /><stop offset="1" stopColor="#0d100f" stopOpacity=".7" /></linearGradient>
				<filter id="galar-shadow" x="-30%" y="-20%" width="160%" height="150%"><feGaussianBlur stdDeviation="13" /></filter>
				<filter id="galar-haze" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="25" /></filter>
			</defs>
			<g transform={`translate(960 540) scale(${camera.zoom}) translate(${-camera.x} ${-camera.y})`}>
				<rect x="-800" y="-600" width="4700" height="2300" fill="#211d1a" />
				{STONES.map((s, i) => <g key={i}>
					<path d={s.d} fill="#110f0d" transform="translate(1 4)" opacity=".6" />
					<path d={s.d} fill={['#4a433b', '#544b40', '#454039', '#574e43', '#49433d', '#51483d', '#423d36', '#554d43', '#4c453d'][s.tone]} />
					<path d={`M${s.x + s.w * .18} ${s.y + s.h * .38}q${s.w * .17} -${s.h * .13} ${s.w * .32} ${s.h * .04}t${s.w * .22} ${s.h * .08}q-${s.w * .24} ${s.h * .08} -${s.w * .54} -${s.h * .02}Z`} fill="#ad9a7f" opacity=".035" />
					<path d={s.marks} stroke="#c6b39a" strokeWidth="1.2" strokeLinecap="round" opacity=".16" />
					<path d={s.marks} transform="translate(2 3)" stroke="#211c19" strokeWidth="1.5" strokeLinecap="round" opacity=".17" />
					<path d={`M${s.x + 6} ${s.y + s.h * .46}l${s.chip} 3l-4 4 M${s.x + s.w - 7} ${s.y + s.h * .7}l-${s.chip} -4l3 -4`} fill="none" stroke="#231e1a" strokeWidth="2" opacity=".6" />
				</g>)}
				<rect x="-800" y="-600" width="4700" height="2300" fill="url(#galar-stone-mottle-pattern)" opacity=".18" style={{mixBlendMode: 'multiply'}} />
				<rect x="-800" y="-600" width="4700" height="2300" fill="url(#galar-stone-grain)" opacity=".2" style={{mixBlendMode: 'multiply'}} />
				<rect x="-800" y="730" width="4700" height="350" fill="url(#galar-damp)" />
				<path d="M-800 1010H3900V1700H-800Z" fill="#28231f" />
				<path d="M-800 1004H3900 M-800 1035H3900" stroke="#181513" strokeWidth="14" />
				<path d="M-80 280 L650 80 L760 150 L-80 335Z M-80 350 L900 330 L870 405 L-80 385Z" fill="#ffd098" opacity={.045 * flicker} filter="url(#galar-haze)" />
				{PANEL_X.map((x, i) => (
					<g key={x}>
						<rect x={x + 20} y={PANEL_Y + 24} width="400" height="760" fill="#080605" opacity=".8" filter="url(#galar-shadow)" />
						<path d={`M${x - 14} ${PANEL_Y - 10} H${x + 434}`} stroke="#191919" strokeWidth="12" strokeLinecap="round" />
						<path d={`M${x - 14} ${PANEL_Y - 13} H${x + 434}`} stroke="#777269" strokeWidth="3" strokeLinecap="round" />
						<circle cx={x - 14} cy={PANEL_Y - 10} r="8" fill="#282522" /><circle cx={x + 434} cy={PANEL_Y - 10} r="8" fill="#282522" />
						<g transform={`translate(${x} ${PANEL_Y}) rotate(${Math.sin(frame * .015 + i * 1.1) * .12} 210 0)`}>
							<Tapestry panel={(i + 1) as 1 | 2 | 3 | 4} starProgress={i === 0 ? starProgress : 0} glow={i === 0 ? starGlow : 0} />
						</g>
					</g>
				))}
				<g opacity=".48">
					<path d={`M${EMPTY_ROD_X} ${PANEL_Y - 10} H${EMPTY_ROD_X + 400}`} stroke="#151313" strokeWidth="12" strokeLinecap="round" />
					<path d={`M${EMPTY_ROD_X} ${PANEL_Y - 13} H${EMPTY_ROD_X + 400}`} stroke="#8a7c68" strokeWidth="2.5" />
					<circle cx={EMPTY_ROD_X} cy={PANEL_Y - 10} r="8" fill="#1b1918" /><circle cx={EMPTY_ROD_X + 400} cy={PANEL_Y - 10} r="8" fill="#1b1918" />
					<path d={`M${EMPTY_ROD_X + 25} ${PANEL_Y - 11}v23 M${EMPTY_ROD_X + 375} ${PANEL_Y - 11}v23`} stroke="#292521" strokeWidth="7" />
				</g>
				<rect x="-800" y="-600" width="4700" height="2300" fill="url(#galar-torchlight)" opacity={flicker} />
				<rect x="-800" y="-600" width="4700" height="2300" fill="url(#galar-darkness)" />
				<rect x="-800" y="-600" width="4700" height="2300" fill="#100b09" opacity={(1 - flicker) * .45} />
				<g transform="translate(-100 370)">
					<path d="M-40 58Q-20 72 -5 45 M-40 45V78 M-49 45H-31 M-49 78H-31" fill="none" stroke="#171512" strokeWidth="9" />
					<path d="M-14 13 L-7 79 L4 79 L14 13Z" fill="#2c211a" stroke="#100e0d" strokeWidth="5" />
					<path d="M-14 20H14 M-12 34H11 M-10 48H9 M-8 63H7" stroke="#a08361" strokeWidth="3" strokeDasharray="4 2" />
					<path d="M-21 13Q0 23 21 13 M-17 24Q0 34 17 24" fill="none" stroke="#151413" strokeWidth="6" />
					<ellipse cx="0" cy="-18" rx="100" ry="135" fill="url(#galar-flame)" opacity={flicker * .65} />
					<path d={`M0 20 Q-29 2 -17 -28 Q-12 -45 ${Math.sin(frame * .19) * 12} -79 Q9 -50 15 -41 Q29 -15 18 4 Q12 17 0 20Z`} fill="#c45627" opacity=".95" />
					<path d={`M0 18 Q-21 0 -9 -27 Q-4 -43 ${Math.sin(frame * .25) * 7 + 4} -58 Q21 -26 12 0 Q10 12 0 18Z`} fill="#f4a849" />
					<path d={`M0 16 Q-10 3 -3 -13 Q1 -21 ${Math.sin(frame * .21) * 4 + 1} -31 Q12 -12 7 4 Q5 12 0 16Z`} fill="#fff0b5" />
					{Array.from({length: 7}, (_, i) => {
						const age = (frame * (1.1 + i * .08) + i * 37) % 170;
						return <circle key={i} cx={Math.sin(frame * .04 + i * 2) * (5 + age * .12)} cy={-45 - age} r={1.5 + i % 3 * .55} fill="#f3b665" opacity={(1 - age / 170) * .75} />;
					})}
				</g>
			</g>
			<rect width="1920" height="1080" fill="#080707" opacity={1 - reveal} />
		</svg>
	);
};
