import React from 'react';

const INK = '#3b2616';

const WOOLS = [
	['indigo', '#304965', '#8999a2', 90],
	['red', '#9f4936', '#d18563', 28],
	['ochre', '#b98732', '#ead399', -40],
	['sage', '#697951', '#a9b18a', 38],
	['dark', '#29242a', '#6d5150', -35],
	['wine', '#612f31', '#b06557', 35],
	['steel', '#849399', '#d0d4c9', -28],
	['indigo-tunic', '#304965', '#8397a3', 0],
	['red-tunic', '#9f4936', '#d99272', 0],
] as const;

/** Shared definitions belong once in the enclosing SVG. */
export const TapestryDefs: React.FC = () => (
	<defs>
		<pattern id="galar-linen" width="16" height="16" patternUnits="userSpaceOnUse">
			<rect width="16" height="16" fill="#d8c8a5" />
			<path d="M0 2H16 M0 6H16 M0 10H16 M0 14H16" stroke="#927c5e" strokeWidth="2.8" opacity=".45" />
			<path d="M0 1H16 M0 5H16 M0 9H16 M0 13H16" stroke="#f6ebd1" strokeWidth="1.5" opacity=".8" />
			<path d="M2 0V16 M6 0V16 M10 0V16 M14 0V16" stroke="#8e795b" strokeWidth="2.5" opacity=".38" />
			<path d="M1 0V4 M1 8V12 M5 4V8 M5 12V16 M9 0V4 M9 8V12 M13 4V8 M13 12V16" stroke="#fff2d8" strokeWidth="1.3" opacity=".8" />
			<path d="M0 7l5 -.6 M10 15l6 -.5 M7 0l-.5 4" stroke="#735d44" strokeWidth="1.2" opacity=".45" />
		</pattern>
		<pattern id="galar-rope" width="9" height="9" patternUnits="userSpaceOnUse">
			<rect width="9" height="9" fill="#302015" />
			<path d="M-3 7L6 -2 M0 12L12 0 M6 12L12 6" stroke="#8d6341" strokeWidth="3" strokeLinecap="round" />
			<path d="M-2 7L6 -1 M1 12L12 1 M7 12L12 7" stroke="#c39967" strokeWidth=".7" opacity=".8" />
		</pattern>
		{WOOLS.map(([name, base, light, angle]) => (
			<pattern key={name} id={`galar-${name}`} width="12" height="24" patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
				<rect width="12" height="24" fill={base} />
				{[0, 1, 2, 3].flatMap((column) => [-1, 0, 1].map((cycle) => {
					const x = 1.4 + column * 3 + (column % 2) * .12;
					const y = cycle * 24 + column * 6;
					const length = 19 + column % 3;
					return <g key={`${column}-${cycle}`} fill="none" strokeLinecap="round">
						<path d={`M${x} ${y}v${length}`} stroke="#211915" strokeWidth="2.7" opacity=".64" />
						<path d={`M${x} ${y + .8}v${length - 1.6}`} stroke={light} strokeWidth="1.8" opacity=".83" />
						<path d={`M${x - .25} ${y + 2}v${length - 4}`} stroke="#fff0cb" strokeWidth=".55" opacity=".38" />
					</g>;
				}))}
			</pattern>
		))}
		<pattern id="galar-fold" width="115" height="800" patternUnits="userSpaceOnUse">
			<rect width="115" height="800" fill="url(#galar-fold-gradient)" />
		</pattern>
		<linearGradient id="galar-fold-gradient">
			<stop stopColor="#49351f" stopOpacity=".22" /><stop offset=".27" stopColor="#fff4da" stopOpacity=".09" />
			<stop offset=".58" stopColor="#60442c" stopOpacity=".08" /><stop offset=".82" stopColor="#fff4da" stopOpacity=".12" />
			<stop offset="1" stopColor="#49351f" stopOpacity=".22" />
		</linearGradient>
		<filter id="galar-fiber">
			<feTurbulence type="fractalNoise" baseFrequency=".4" numOctaves="2" seed="7" />
			<feColorMatrix type="saturate" values="0" />
		</filter>
		<clipPath id="galar-cloth-clip">
			<path d="M10 0 Q210 8 410 0 L410 752 Q370 759 330 753 Q280 760 240 753 Q190 760 150 752 Q95 760 10 752Z" />
		</clipPath>
		<clipPath id="galar-field-clip"><rect x="27" y="61" width="366" height="630" /></clipPath>
	</defs>
);

const stitch = {stroke: 'url(#galar-rope)', strokeWidth: 5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
const thread = (name: string) => `url(#galar-${name})`;

const Border: React.FC<{y: number}> = ({y}) => (
	<g transform={`translate(0 ${y})`}>
		<rect x="10" width="400" height="61" fill={thread('red')} />
		<path d="M10 4H410 M10 57H410" stroke={INK} strokeWidth="4" strokeDasharray="4 2" />
		<path d="M10 10H410 M10 51H410" stroke="#e2c483" strokeWidth="2" strokeDasharray="7 3" />
		{Array.from({length: 8}, (_, i) => (
			<g key={i} transform={`translate(${35 + i * 50} 30)`}>
				<path d="M-21 0 Q-12 -20 0 0 Q12 20 21 0 M-21 0 Q-12 20 0 0 Q12 -20 21 0" fill="none" stroke="#e8ce90" strokeWidth="2.5" strokeDasharray="4 2" />
				<path d="M0 -13 Q9 -8 0 0 Q-9 -8 0 -13 M0 13 Q9 8 0 0 Q-9 8 0 13" fill={thread(i % 2 ? 'sage' : 'ochre')} stroke={INK} strokeWidth="1.5" strokeDasharray="3 2" />
			</g>
		))}
	</g>
);

const Youth: React.FC<{x: number; y: number; color: 'red' | 'indigo'; crown?: boolean; scale?: number; recoil?: boolean; gaze?: boolean; point?: boolean}> = ({x, y, color, crown = false, scale = 1, recoil = false, gaze = false, point = false}) => (
	<g transform={`translate(${x} ${y}) scale(${scale}) rotate(${recoil ? -8 : 0})`}>
		<path d="M-12 86 L-19 121 L-29 126 L-14 127 L-4 90 M7 90 L15 122 L13 127 L30 127 L21 120 L15 86Z" fill={thread('dark')} {...stitch} />
		<path d={point ? 'M-14 25 L-23 27 L-33 55 L-42 50 L-46 56 L-32 65 L-16 43 M14 25 L22 27 L35 14 L43 -3 L49 0 L41 22 L21 43Z' : recoil ? 'M-14 25 L-23 27 L-39 9 L-46 13 L-37 29 L-20 44 M14 25 L23 27 L40 5 L46 9 L40 24 L20 44Z' : 'M-14 25 L-23 27 L-37 52 L-45 47 L-49 53 L-36 62 L-17 43 M14 25 L23 27 L36 52 L44 46 L49 51 L37 62 L17 43Z'} fill={thread(`${color}-tunic`)} {...stitch} />
		<path d="M-16 24 Q0 18 16 24 L21 92 Q0 99 -21 92Z" fill={thread(`${color}-tunic`)} {...stitch} />
		<path d="M-18 85Q0 92 18 85 M-12 34Q0 38 12 34" fill="none" stroke={color === 'red' ? '#e5ad8c' : '#adbdc0'} strokeWidth="2" strokeDasharray="4 2" />
		<path d="M-17 65 Q0 71 18 65" fill="none" stroke="#d9bf85" strokeWidth="3" strokeDasharray="4 2" />
		<g transform={gaze ? 'rotate(-14 0 7)' : undefined}>
			<path d="M-14 -2 Q-13 -17 0 -16 Q13 -16 14 -2 L19 3 L14 7 Q13 24 0 25 Q-14 22 -14 4Z" fill="#c5a981" {...stitch} />
			<path d="M-14 5 Q-18 -14 -5 -17 Q8 -20 14 -9 L14 -2 Q7 -7 0 -6 Q-8 2 -14 5Z" fill={thread(color === 'indigo' ? 'dark' : 'ochre')} stroke={INK} strokeWidth="2.5" strokeDasharray="3 2" />
			<path d="M-13 -6Q-6 -13 2 -12 M-14 -1Q-5 -8 5 -8" fill="none" stroke="#e5cb96" strokeWidth="1" strokeDasharray="3 2" opacity=".7" />
		</g>
		{crown && <path d="M-18 -11 L-18 -27 L-9 -20 L0 -32 L9 -20 L18 -27 L18 -11Z" fill={thread('ochre')} stroke={INK} strokeWidth="2" strokeDasharray="3 2" />}
	</g>
);

const Hill: React.FC = () => (
	<g>
		<path d="M10 554 Q95 475 185 536 Q280 465 410 541 L410 752H10Z" fill={thread('sage')} {...stitch} />
		<path d="M10 625 Q130 560 230 630 Q325 570 410 615 M10 688 Q130 635 242 691 Q330 644 410 675" fill="none" stroke="#d7c38d" strokeWidth="3" strokeDasharray="6 4" opacity=".7" />
		{[45, 80, 325, 365].map((x, i) => <g key={x} transform={`translate(${x} ${560 + i % 2 * 15})`}>
			<path d="M0 43V-5 M0 24Q-18 14 -15 3 Q-3 3 0 16 M0 12 Q14 0 17 -13 Q4 -12 0 0" fill="none" stroke="#d7c38d" strokeWidth="3" strokeDasharray="4 2" />
			<path d="M-15 3q-10 -6 -5 -15 q12 2 15 14 M17 -13q-3 -12 5 -16 q8 10 -4 18" fill={thread('ochre')} stroke={INK} strokeWidth="1.5" strokeDasharray="3 2" />
		</g>)}
		{Array.from({length: 15}, (_, i) => <path key={i} d={`M${25 + i * 26} ${710 - (i % 3) * 14} l5 -12 l5 12 m-5 -12 v17`} fill="none" stroke="#d7c38d" strokeWidth="1.5" strokeDasharray="3 2" opacity=".7" />)}
	</g>
);

const STAR_POINTS = [
	[329, 116], [338, 152], [368, 139], [349, 165], [377, 181], [344, 181], [346, 214],
	[327, 189], [307, 216], [312, 181], [278, 181], [306, 165], [289, 139], [319, 152],
];
const STAR_SHAPE = `M${STAR_POINTS.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
const TRAIL_SHAPE = 'M336 146 Q277 151 229 206 L196 255 Q252 212 293 200 L342 185Z';
const STAR_CENTER = [328, 170] as const;

const StarRay: React.FC<{index: number}> = ({index}) => {
	const tip = STAR_POINTS[index * 2];
	const before = STAR_POINTS[(index * 2 + STAR_POINTS.length - 1) % STAR_POINTS.length];
	const after = STAR_POINTS[(index * 2 + 1) % STAR_POINTS.length];
	const dx = tip[0] - STAR_CENTER[0], dy = tip[1] - STAR_CENTER[1];
	const length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
	const wedge = `M${STAR_CENTER[0]} ${STAR_CENTER[1]}L${before[0]} ${before[1]}L${tip[0]} ${tip[1]}L${after[0]} ${after[1]}Z`;
	return <g>
		<clipPath id={`galar-star-ray-${index}`}><path d={wedge} /></clipPath>
		<path d={wedge} fill={index % 2 ? '#c1934c' : '#d1aa65'} />
		<g clipPath={`url(#galar-star-ray-${index})`}>
			{Array.from({length: 25}, (_, i) => {
				const offset = (i - 12) * 2.1 + (i % 3 - 1) * .13;
				const x = STAR_CENTER[0] - uy * offset, y = STAR_CENTER[1] + ux * offset;
				const d = `M${x - ux * 4} ${y - uy * 4}L${x + ux * (length + 5)} ${y + uy * (length + 5)}`;
				return <g key={i} fill="none" strokeLinecap="round"><path d={d} stroke="#835f34" strokeWidth="2.7" opacity=".7" /><path d={d} stroke={i % 4 === 0 ? '#f1d79b' : '#d6b675'} strokeWidth="1.65" /><path d={d} stroke="#fff0c2" strokeWidth=".45" opacity=".52" /></g>;
			})}
		</g>
		<path d={`M${STAR_CENTER[0]} ${STAR_CENTER[1]}L${tip[0]} ${tip[1]}`} stroke="#76542f" strokeWidth="1.2" opacity=".75" />
	</g>;
};

const FallingStar: React.FC<{progress: number; glow: number}> = ({progress, glow}) => (
	<g id="galar-falling-star" transform={`translate(${-progress * 35} ${progress * 44})`}>
		<clipPath id="galar-star-trail-clip"><path d={TRAIL_SHAPE} /></clipPath>
		<path d={TRAIL_SHAPE} fill="#bb8c4e" {...stitch} />
		<g clipPath="url(#galar-star-trail-clip)">
			{Array.from({length: 42}, (_, i) => {
				const offset = (i - 20) * 2.2 + (i % 4 - 1.5) * .12;
				const d = `M${175 + offset * .54} ${260 + offset * .84} Q${250 + offset * .54} ${200 + offset * .84} ${355 + offset * .54} ${145 + offset * .84}`;
				return <g key={i} fill="none"><path d={d} stroke="#7f5c32" strokeWidth="3" opacity=".7" /><path d={d} stroke={i % 4 ? '#d9b777' : '#f1dba8'} strokeWidth="1.8" /><path d={d} stroke="#fff1c9" strokeWidth=".5" opacity=".45" /></g>;
			})}
		</g>
		<g opacity={glow}><circle cx="329" cy="170" r="55" fill="#f5c765" opacity=".25" /></g>
		<path d={STAR_SHAPE} fill="#bc914e" {...stitch} />
		{Array.from({length: 7}, (_, i) => <StarRay key={i} index={i} />)}
		<path d={STAR_SHAPE} fill="none" {...stitch} />
	</g>
);

const SkyStars: React.FC = () => (
	<g stroke="#dbc58c" strokeWidth="2" strokeDasharray="3 2" fill="none">
		{[[62, 130], [140, 215], [95, 330], [185, 114], [371, 294], [310, 360], [225, 315], [54, 443]].map(([x, y], i) =>
			<path key={i} d={`M${x - 7} ${y}h14 M${x} ${y - 7}v14`} />)}
		<path d="M28 385 Q51 370 76 382 Q96 389 112 378 M264 430 Q287 414 307 424 Q326 433 350 418 M55 268 Q72 256 91 266" opacity=".65" />
		<path d="M39 396 Q57 385 75 393 M283 442 Q302 432 322 437 M63 277 Q78 270 91 276" opacity=".45" />
	</g>
);

const Town: React.FC = () => (
	<g id="galar-town">
		<path d="M62 568V466 L83 450 L104 466V510 H138V431 L159 412 L180 431V489 H217V455 L238 437 L259 455V505 H308V465 L329 447 L350 465V572Z" fill={thread('steel')} {...stitch} />
		<path d="M74 467v-23h10v12h9v-12h10v23 M146 433v-26h10v12h10v-12h10v26 M224 457v-23h10v12h10v-12h10v23 M315 468v-23h10v12h10v-12h10v23" fill={thread('red')} {...stitch} />
		<path d="M190 568v-44q15-24 30 0v44 M95 504v16 M159 466v16 M238 482v16 M330 500v16" fill="none" stroke={INK} strokeWidth="7" strokeDasharray="4 2" />
	</g>
);

const Vortex: React.FC<{faded?: boolean}> = ({faded = false}) => (
	<g id="galar-vortex" opacity={faded ? .65 : 1}>
		<path d="M10 67 H410 V411 Q358 384 324 344 Q280 301 234 324 Q159 360 98 330 Q50 308 10 333Z" fill={thread('dark')} {...stitch} />
		<path d="M-35 204 Q60 44 216 95 Q370 140 381 246 Q389 352 264 346 Q143 340 139 243 Q136 159 231 157 Q319 155 319 235 Q319 299 249 299 Q192 299 196 247 Q200 212 240 215 Q269 216 268 243" fill="none" stroke="#551f28" strokeWidth="30" strokeDasharray="8 2" />
		<path d="M-10 160 Q80 68 210 113 Q330 153 348 236 Q365 321 261 315 Q179 310 177 248 Q177 194 236 193 Q281 193 280 237 Q277 263 249 263" fill="none" stroke="#9a433c" strokeWidth="18" strokeDasharray="5 2" />
		<path d="M-10 160 Q80 68 210 113 Q330 153 348 236 Q365 321 261 315 Q179 310 177 248 Q177 194 236 193 Q281 193 280 237 Q277 263 249 263" fill="none" stroke="#d0846c" strokeWidth="3" strokeDasharray="5 3" opacity=".65" />
		<path d="M58 298 Q102 342 163 325 M52 134 Q111 95 176 104 M329 321 Q367 290 363 251" fill="none" stroke="#b35549" strokeWidth="5" strokeDasharray="6 3" opacity=".7" />
		<ellipse cx="239" cy="246" rx="19" ry="16" fill={thread('dark')} stroke="#180f13" strokeWidth="4" strokeDasharray="4 2" />
		<path d="M30 355 Q36 277 73 260 L85 221 L105 250 L133 237 L125 269 Q158 289 163 351 L143 328 L131 373 L105 337 L82 381 L67 339 L44 380Z" fill={thread('dark')} stroke="#a34c44" strokeWidth="4" strokeDasharray="5 3" />
		<path d="M285 390 Q288 320 317 300 L324 268 L343 287 L369 267 L365 301 Q397 326 404 400 L380 379 L363 406 L343 378 L322 407 L309 376Z" fill={thread('dark')} stroke="#a34c44" strokeWidth="4" strokeDasharray="5 3" />
		<path d="M72 292l12 4 M111 292l12 -4 M323 322l10 3 M358 322l10 -3" stroke="#e37a63" strokeWidth="4" strokeDasharray="2 2" />
	</g>
);

const Arms: React.FC = () => (
	<g id="galar-sword-and-shield">
		{Array.from({length: 20}, (_, i) => {
			const angle = i * Math.PI / 10;
			const x1 = 210 + Math.cos(angle) * 116, y1 = 278 + Math.sin(angle) * 116;
			const x2 = 210 + Math.cos(angle) * 181, y2 = 278 + Math.sin(angle) * 181;
			return <path key={i} d={`M${x1} ${y1}L${x2} ${y2}`} stroke="#cf9c41" strokeWidth="5" strokeDasharray="7 4" />;
		})}
		<g transform="translate(155 270) rotate(-30)">
			<path d="M0 -158 L21 -122 L17 31 L0 53 L-17 31 L-21 -122Z" fill={thread('steel')} {...stitch} />
			<path d="M0 -143V31 M-38 37Q0 28 38 37 L31 49H-31Z" fill="none" stroke={INK} strokeWidth="5" strokeDasharray="5 2" />
			<path d="M-7 45H7V87H-7Z M-14 91 Q0 79 14 91 Q0 106 -14 91Z" fill={thread('ochre')} {...stitch} />
		</g>
		<g transform="translate(276 273) rotate(14)">
			<path d="M-55 -72 Q0 -88 55 -72 V10 Q50 62 0 92 Q-50 62 -55 10Z" fill={thread('red')} {...stitch} />
			<path d="M-44 -60 Q0 -73 44 -60 V9 Q40 51 0 77 Q-40 51 -44 9Z" fill="none" stroke="#e9ce92" strokeWidth="4" strokeDasharray="5 3" />
			<path d="M0 -53V55 M-31 0H31" stroke="#d4b979" strokeWidth="7" strokeDasharray="5 3" />
		</g>
	</g>
);

const CrownScene: React.FC = () => (
	<g id="galar-coronation">
		<path d="M58 590 V260 Q58 120 210 120 Q362 120 362 260 V590 H330 V260 Q330 154 210 154 Q90 154 90 260 V590Z" fill={thread('ochre')} {...stitch} />
		<path d="M75 573V257 Q75 137 210 137 Q345 137 345 257V573" fill="none" stroke="#f0d9a1" strokeWidth="3" strokeDasharray="5 3" />
		<path d="M35 177V410 L67 389 L98 410V177Z M322 177V410 L353 389 L385 410V177Z" fill={thread('red')} {...stitch} />
		<path d="M50 195V385 M82 195V385 M338 195V385 M370 195V385" stroke="#e0bb78" strokeWidth="2" strokeDasharray="5 4" />
		<path d="M10 606 Q210 579 410 606V752H10Z" fill={thread('sage')} {...stitch} />
		<path d="M50 646H370 M50 677H370 M50 708H370" fill="none" stroke="#d7c38d" strokeWidth="2" strokeDasharray="7 4" />
		<Youth x={155} y={463} color="indigo" crown scale={1.18} />
		<Youth x={265} y={463} color="red" crown scale={1.18} />
	</g>
);

export const Tapestry: React.FC<{panel: 1 | 2 | 3 | 4; starProgress?: number; glow?: number; darkSoak?: number}> = ({panel, starProgress = 0, glow = 0, darkSoak = 0}) => (
	<g>
		<g clipPath="url(#galar-cloth-clip)">
			<rect x="10" width="400" height="760" fill="url(#galar-linen)" />
			<g clipPath="url(#galar-field-clip)">
			{panel === 1 && <g id="galar-panel-one">
				<path d="M10 60H410V550 Q285 485 185 536 Q95 475 10 554Z" fill={thread('indigo')} {...stitch} />
				<SkyStars /><FallingStar progress={starProgress} glow={glow} /><Hill />
				<Youth x={141} y={535} color="indigo" scale={.9} gaze point /><Youth x={244} y={536} color="red" scale={.9} gaze />
			</g>}
			{panel === 2 && <g id="galar-panel-two"><Vortex /><Town /><Hill /><Youth x={156} y={578} color="indigo" scale={.67} recoil /><Youth x={245} y={582} color="red" scale={.67} recoil /><rect x="10" y="60" width="400" height="692" fill="#42131b" opacity={darkSoak} /></g>}
			{panel === 3 && <g id="galar-panel-three"><Vortex faded /><Arms /><Hill /><Youth x={148} y={575} color="indigo" scale={.68} gaze /><Youth x={255} y={575} color="red" scale={.68} gaze /></g>}
			{panel === 4 && <CrownScene />}
			</g>
			<Border y={0} /><Border y={691} />
			<path d="M19 60V691 M401 60V691" stroke={INK} strokeWidth="7" strokeDasharray="5 1.5" />
			<path d="M16 61L22 66 M16 69L22 74 M16 77L22 82 M398 61L404 66 M398 69L404 74 M398 77L404 82" stroke="#bc9367" strokeWidth="2" strokeDasharray="4 4" />
			<path d="M27 61V691 M393 61V691" stroke="#d3b97e" strokeWidth="3" strokeDasharray="5 3" />
			<rect x="10" width="400" height="760" fill="url(#galar-fold)" />
			<rect x="10" width="400" height="760" filter="url(#galar-fiber)" opacity=".045" style={{mixBlendMode: 'multiply'}} />
		</g>
		<path d="M10 752 Q95 760 150 752 Q190 760 240 753 Q280 760 330 753 Q370 759 410 752" fill="none" stroke="#4f3925" strokeWidth="3" strokeDasharray="4 2" />
		{Array.from({length: 67}, (_, i) => <path key={i} d={`M${11 + i * 6} 754 q${(i % 3) - 1} ${7 + i % 5} ${(i % 4) - 2} ${17 + i % 7}`} fill="none" stroke={i % 3 === 0 ? '#8b7451' : '#d9c39b'} strokeWidth={i % 4 === 0 ? 2 : 1.1} />)}
	</g>
);
