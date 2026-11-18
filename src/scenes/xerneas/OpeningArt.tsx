import {AbsoluteFill, Img, staticFile} from 'remotion';

export const XERNEAS_BLUE = '#8FD3FF';
export const XERNEAS_REVEAL = 168;
const INDIGO = '#0F1626';
const INK = '#D7EBFA';
const STROKE = 1.8;
const GROUND = 832;
const ART = {left: -294, top: -221, width: 549, height: 730};
const HOOF_Y = ART.top + ART.height - 5;
export type XerneasPose = {x: number; y: number; scale: number};
export const OPENING_END_POSE: XerneasPose = {x: 1282, y: GROUND - HOOF_Y * 1.02, scale: 1.02};
export const groundOf = ({y, scale}: XerneasPose) => y + HOOF_Y * scale;

const progress = (frame: number, from: number, to: number) => Math.max(0, Math.min(1, (frame - from) / (to - from)));
export const smooth = (frame: number, from: number, to: number) => {
	const t = progress(frame, from, to);
	return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const revealGlow = (frame: number) => Math.exp(-((frame - XERNEAS_REVEAL) ** 2) / 145);

const TRUNK = [
	'M-168 425 C-138 407 -109 409 -84 391 C-39 367 -57 307 -52 271 C-46 234 -72 203 -62 159 C-52 113 -29 70 -24 21 C-32 1 -48 -13 -67 -28',
	'M-44 418 C-21 396 13 396 25 373 C45 337 12 313 16 278 C13 236 36 206 34 172 C31 130 15 115 24 80 C30 51 22 29 34 1 L55 -23',
	'M26 373 C70 374 79 394 107 402 Q137 407 164 423 M-84 391 Q-105 404 -114 422 L-142 431 M-74 402 Q-76 422 -98 434',
	'M-31 381 C-21 347 -35 325 -27 289 C-19 253 -39 234 -30 208 M-19 173 C-25 135 -12 104 -12 77 M5 251 C-3 224 11 199 12 165 C13 143 0 123 4 106',
	'M-47 255 L-39 224 L-51 193 L-42 153 M12 327 Q26 348 9 369 M-52 161 Q-76 135 -70 106 L-89 81 L-86 61',
	'M24 79 Q61 68 67 31 L92 14 L103 -10 M56 56 L85 52 L113 22 M-20 50 Q-63 46 -94 19 L-130 14 L-151 -7 M-88 23 L-103 -17',
];

const TWIGS = [
	'M-283 -167 l-13 -16 m29 26 l-24 -5 M-229 -182 l-8 -20 m11 25 l-20 -12 M-188 -148 l-17 -21 M-139 -160 l-7 -18',
	'M-6 -178 l-9 -19 M50 -186 l-5 -20 M145 -210 l3 -21 M229 -182 l8 -20 M243 -154 l18 -16 m-21 20 l23 -7',
];

const FAR_TREES = [
	'M90 774 Q116 620 102 434 Q83 312 93 147 L77 33 M95 272 Q41 213 19 130 M108 465 Q160 414 168 325 L193 267',
	'M259 712 Q270 597 265 471 Q251 364 281 246 M267 488 Q225 445 207 396 L174 358 M268 438 Q318 381 324 318',
	'M387 688 Q402 547 382 399 Q357 302 363 207 M386 427 Q339 396 321 356 M389 507 Q440 467 456 388',
	'M575 705 Q571 582 594 485 L578 367 M590 523 L646 474 L670 422 M586 550 L544 512 L526 460',
	'M1474 713 Q1462 584 1489 435 L1484 301 M1485 477 Q1418 414 1407 340 M1487 423 Q1536 379 1544 336',
	'M1596 708 Q1574 568 1603 397 L1607 252 M1599 419 Q1545 395 1520 355 M1595 461 Q1648 427 1672 368 L1693 324',
	'M1761 761 Q1728 579 1756 372 Q1767 240 1739 114 M1747 443 Q1704 390 1693 329 M1756 386 Q1810 330 1819 244',
	'M1890 802 Q1868 624 1883 473 Q1912 320 1885 109 M1882 504 Q1834 470 1822 405 M1896 323 L1939 251',
];

const NEAR_TREES = [
	'M-68 946 Q37 886 34 799 Q-4 608 30 403 Q57 208 20 -31 M32 416 Q111 322 142 233 L135 181 L160 126 M92 345 Q138 321 184 285 L220 218 M147 256 L201 242 L228 191',
	'M1973 968 Q1874 905 1893 793 Q1946 601 1904 475 Q1863 362 1898 169 L1902 -36 M1895 432 Q1817 373 1781 288 L1777 222 L1745 169 M1822 381 L1762 343 L1727 281 M1792 318 L1831 255 L1822 184',
];

const MOTES = Array.from({length: 47}, (_, i) => ({
	x: 80 + ((i * 227.31) % 1780),
	y: 91 + ((i * 139.77) % 737),
	radius: 0.7 + (i % 5) * 0.21,
	phase: i * 2.31,
}));

// 枝冠和显形共用同一张从官方立绘提取的线稿，苏醒时沿纵向逐步显露。
const OfficialLinework: React.FC<XerneasPose & {frame: number; sleep?: number; spectrum: number; amount: number; shadow: number}> = ({frame, x, y, scale, sleep, spectrum, amount, shadow}) => {
	const src = staticFile('pokemon/xerneas/art-line.png');
	const front = mix(27, 109, smooth(frame, 104, XERNEAS_REVEAL));
	const line: React.CSSProperties = {position: 'absolute', ...ART};
	const waking = smooth(frame, 81, 115) * (1 - (sleep ?? 0));
	const mask = `linear-gradient(to bottom, black ${front - 2.6}%, transparent ${front + 2.6}%)`;
	return (
		<div style={{position: 'absolute', left: x, top: y, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none', opacity: amount}}>
			{shadow > 0 && <Img src={staticFile('pokemon/xerneas/art-fill.png')} style={{...line, opacity: waking * shadow}} />}
			<Img src={src} style={{
				...line,
				opacity: 0.53 * (sleep ?? (1 - smooth(frame, 89, 124))),
				maskImage: 'linear-gradient(to bottom, black 27.5%, transparent 31.5%)',
			}} />
			<Img src={src} style={{
				...line,
				opacity: waking * (1 - spectrum),
				maskImage: mask,
				filter: 'drop-shadow(0 0 4px rgba(143,211,255,0.6))',
			}} />
			{spectrum > 0 && <Img src={staticFile('pokemon/xerneas/art-line-spectrum.png')} style={{
				...line,
				opacity: waking * spectrum,
				maskImage: mask,
				filter: 'drop-shadow(0 0 5px rgba(242,215,140,0.62))',
			}} />}
		</div>
	);
};

export const OpeningArt: React.FC<{
	frame: number;
	pose?: XerneasPose;
	sleep?: number;
	spectrum?: number;
	figure?: number;
	shadow?: number;
	flat?: number;
	landscape?: React.ReactNode;
	children?: React.ReactNode;
}> = ({frame, pose, sleep, spectrum = 0, figure = 1, shadow = 0, flat = 1, landscape, children}) => {
	const pan = smooth(frame, 120, 205);
	const push = smooth(frame, 0, 110);
	const x = pose?.x ?? mix(949, OPENING_END_POSE.x, pan);
	const scale = pose?.scale ?? mix(0.90 + 0.12 * push, OPENING_END_POSE.scale, pan);
	const y = pose?.y ?? GROUND - HOOF_Y * scale;
	const ground = pose ? groundOf(pose) : GROUND;
	const slide = pose ? x - OPENING_END_POSE.x : 0;
	const lift = pose ? y - OPENING_END_POSE.y : 0;
	const wake = smooth(frame, 68, 152);
	const flash = revealGlow(frame);
	const sweep = smooth(frame, 65, 138);
	const dry = sleep ?? (1 - smooth(frame, 106, 158));
	const transform = `translate(${x} ${y}) scale(${scale})`;
	return (
		<AbsoluteFill style={{background: INDIGO}}>
			{landscape}
			<svg width={1920} height={1080} viewBox="0 0 1920 1080" style={landscape ? {position: 'absolute', inset: 0} : undefined} aria-hidden="true">
				<defs>
					<radialGradient id="xern-haze" gradientUnits="userSpaceOnUse" cx={x - 8} cy={y + 130} r={790}>
						<stop offset={0} stopColor="#365A7D" stopOpacity={0.38 + 0.14 * wake + 0.1 * flash} />
						<stop offset={0.59} stopColor="#22364F" stopOpacity={0.22} />
						<stop offset={1} stopColor={INDIGO} stopOpacity={0} />
					</radialGradient>
					<linearGradient id="xern-ring-ink" x1={0} x2={1}>
						<stop offset={0} stopColor={XERNEAS_BLUE} stopOpacity={0} />
						<stop offset={0.5} stopColor={XERNEAS_BLUE} stopOpacity={0.35 + 0.15 * flash} />
						<stop offset={1} stopColor={XERNEAS_BLUE} stopOpacity={0} />
					</linearGradient>
					<radialGradient id="xern-glint">
						<stop offset={0} stopColor="#F2FAFF" />
						<stop offset={0.19} stopColor={XERNEAS_BLUE} stopOpacity={0.55} />
						<stop offset={1} stopColor={XERNEAS_BLUE} stopOpacity={0} />
					</radialGradient>
				</defs>
				<g opacity={flat}>
				<rect width={1920} height={1080} fill="url(#xern-haze)" />
				<g fill="none" stroke="#8DAEC8" strokeWidth={STROKE} strokeLinejoin="round" strokeLinecap="round" opacity={0.16} transform={`translate(${pan * 65 + slide * 0.28} ${push * 10 + lift * 0.19})`}>
					{FAR_TREES.map((d) => <path key={d} d={d} />)}
					<path d="M0 701 Q209 673 421 690 T807 707 T1214 697 T1645 690 T1920 696 M0 726 Q164 715 294 719 M1488 730 Q1693 701 1920 724" />
				</g>
				<g fill="none" stroke="url(#xern-ring-ink)" strokeWidth={STROKE} transform={`translate(${x + 31 * pan} ${ground - 14})`}>
					{[148, 243, 368, 512, 681, 875].map((r, i) => (
						<ellipse key={r} cx={i * -3} cy={i * 3} rx={r} ry={14 + i * 13} opacity={0.73 - i * 0.073} />
					))}
					<ellipse rx={65 + sweep * 594} ry={9 + sweep * 55} opacity={Math.sin(Math.PI * sweep) * 0.7} />
				</g>
				{MOTES.map((m) => (
					<circle key={m.phase} cx={m.x + pan * 82 + Math.sin(frame * 0.018 + m.phase) * 12} cy={m.y - frame * 0.09} r={m.radius} fill={INK} opacity={(0.11 + 0.12 * wake) * (0.6 + 0.4 * Math.sin(m.phase + frame * 0.039))} />
				))}
				<g fill="none" stroke="#6B8AA8" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" opacity={0.28} transform={`translate(${pan * -31 + slide * 0.56} ${push * 19 + lift * 0.32})`}>
					{NEAR_TREES.map((d) => <path key={d} d={d} />)}
				</g>
				</g>
				<g transform={transform} opacity={figure}>
					<g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={STROKE} opacity={dry}>
						<g transform="scale(0.8 1.15)" stroke="#87AFCB" opacity={0.77}>
							{TRUNK.map((d) => <path key={d} d={d} vectorEffect="non-scaling-stroke" />)}
						</g>
						<g stroke="#7D9FB7" opacity={0.59}>
							{TWIGS.map((d) => <path key={d} d={d} vectorEffect="non-scaling-stroke" />)}
						</g>
					</g>
					<circle cx={mix(-5, 13, sweep)} cy={mix(HOOF_Y - 24, -8, sweep)} r={44 + sweep * 17} fill="url(#xern-glint)" opacity={Math.sin(Math.PI * sweep) * 0.86} />
					<circle cx={24} cy={14} r={34 + flash * 21} fill="url(#xern-glint)" opacity={flash * 0.72} />
				</g>
			</svg>
			{children}
			<OfficialLinework frame={frame} x={x} y={y} scale={scale} sleep={sleep} spectrum={spectrum} amount={figure} shadow={shadow} />
		</AbsoluteFill>
	);
};
