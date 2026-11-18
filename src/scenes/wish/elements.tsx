// ─── 《迎着流星》代码绘制的画面元素 ─────────────────────────────────────
// 宝可梦与人物只用官方立绘（PokemonArt3D / TrainerSilhouette）；这里只画场景、陨石、光效。

const W = 1920;
const H = 1080;

/** 夜空地平线与星尘（2D 层；底色由着色器给，这里只补星点与地球弧光） */
export const StarField: React.FC<{frame: number; seed?: number}> = ({frame, seed = 1}) => {
	const stars = Array.from({length: 90}, (_, i) => {
		const rnd = (n: number) => {
			const v = Math.sin(seed * 1000 + n * 12345.678) * 43758.5453;
			return v - Math.floor(v);
		};
		const x = rnd(i) * W;
		const y = rnd(i + 100) * H * 0.9;
		const r = 0.6 + rnd(i + 200) * 1.8;
		const tw = 0.5 + 0.5 * Math.sin(frame / 45 + i * 1.7);
		return {x, y, r, tw};
	});
	return (
		<svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
			{stars.map((s, i) => (
				<circle key={i} cx={s.x} cy={s.y} r={s.r} fill={`rgba(238,242,255,${0.35 + s.tw * 0.55})`} />
			))}
		</svg>
	);
};

/** 岩石外壳转动，尾迹保持在飞行方向的后方。 */
const METEOR =
	'M-111 10 -87-42 -55-48 -33-76 19-81 43-64 74-54 92-18 75 20 59 38 21 57 -19 65 -43 51 -83 40Z';
const FACETS = [
	['-111,10 -87,-42 -55,-48 -63,4 -83,40', '#83604a'],
	['-55,-48 -33,-76 19,-81 4,-43 -24,-25', '#624d3f'],
	['19,-81 43,-64 74,-54 50,-31 4,-43', '#3b3430'],
	['-63,4 -55,-48 -24,-25 -13,9 -43,51 -83,40', '#4f4137'],
	['-24,-25 4,-43 50,-31 22,-1 -13,9', '#37312e'],
	['50,-31 74,-54 92,-18 75,20 38,17 22,-1', '#292b27'],
	['-43,51 -13,9 22,-1 38,17 21,57 -19,65', '#3a322b'],
	['38,17 75,20 59,38 21,57', '#272725'],
] as const;

export const Meteor: React.FC<{
	frame: number;
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	from: number;
	to: number;
	size?: number;
	spin?: number;
	opacity?: number;
}> = ({frame, x0, y0, x1, y1, from, to, size = 1, spin = 0.12, opacity = 1}) => {
	if (frame < from || frame > to || opacity <= 0) return null;
	const p = (frame - from) / (to - from);
	const x = x0 + (x1 - x0) * p;
	const y = y0 + (y1 - y0) * p;
	const ang = (frame - from) * spin;
	const heading = Math.atan2(y0 - y1, x0 - x1) * 180 / Math.PI;
	return (
		<svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity}}>
			<defs>
				<linearGradient id={`meteor-trail-${from}`} gradientUnits="userSpaceOnUse" x1="-66" y1="0" x2="940" y2="0">
					<stop stopColor="#ffecd2" stopOpacity=".92" />
					<stop offset=".16" stopColor="#ffc384" stopOpacity=".68" />
					<stop offset=".48" stopColor="#df7f54" stopOpacity=".23" />
					<stop offset="1" stopColor="#d86c64" stopOpacity="0" />
				</linearGradient>
				<radialGradient id={`meteor-halo-${from}`}>
					<stop stopColor="#ffab6b" stopOpacity=".46" />
					<stop offset="1" stopColor="#c86945" stopOpacity="0" />
				</radialGradient>
				<clipPath id={`meteor-clip-${from}`}><path d={METEOR} /></clipPath>
				<filter id={`meteor-grit-${from}`} x="0%" y="0%" width="100%" height="100%">
					<feTurbulence type="fractalNoise" baseFrequency=".091 .22" numOctaves="2" seed="47" />
					<feColorMatrix type="saturate" values="0" />
				</filter>
			</defs>
			<g transform={`translate(${x} ${y}) rotate(${heading}) scale(${size})`}>
				<ellipse cx={24} cy={0} rx={280} ry={154} fill={`url(#meteor-halo-${from})`} />
				<path d="M-63-41 Q19-98 133-62 C345-29 591-28 980 0 C639 25 333 33 127 62 Q30 77-63 33Z" fill={`url(#meteor-trail-${from})`} opacity=".36" />
				<path d="M-68-29 Q32-51 146-31 C420-14 667-18 935 0 C566 12 328 20 107 30 Q8 51-68 22Z" fill={`url(#meteor-trail-${from})`} />
				{Array.from({length: 9}, (_, i) => {
					const life = ((frame - from) * (0.011 + i * 0.0007) + i * 0.317) % 1;
					const sparkX = 40 + life * (600 + i * 19);
					const sparkY = (i - 4) * (6 + life * 9) + Math.sin(life * 8 + i) * 12;
					return <path key={i} d={`M${sparkX} ${sparkY} h${15 + life * 40}`} stroke="#ffd0a4" strokeWidth={2 + i % 3} opacity={(1 - life) * .62} strokeLinecap="round" />;
				})}
				<g transform={`rotate(${ang})`}>
					<path d={METEOR} fill="#38302a" stroke="#241d18" strokeWidth="3.7" />
					<g clipPath={`url(#meteor-clip-${from})`}>
						{FACETS.map(([points, fill]) => (
							<polygon key={points} points={points} fill={fill} />
						))}
						<rect x="-113" y="-85" width="208" height="156" filter={`url(#meteor-grit-${from})`} opacity=".61" style={{mixBlendMode: 'soft-light'}} />
						<path d="M-102 9 -84-4 -71-2 -56-24 -34-30 -17-54 M-84 36 -57 26 -53 9 -42 0 -27-2 1-22 M-34 53 -19 40 -12 29 2 24 13 9 38 1 M31-72 25-58 40-44 57-45 74-26" stroke="#b58359" fill="none" strokeWidth="1.65" opacity=".72" />
						<path d="M-86-42 -54-47 -35-76 18-80 M-111 10 -87-41 M-109 12 -93 34 -70 45 -46 51" fill="none" stroke="#f6b283" strokeWidth="4" opacity=".87" />
					</g>
				</g>
			</g>
		</svg>
	);
};

/** 小陨石群（臭氧层觅食段）：数颗陨石从画面一侧掠到另一侧 */
export const MeteorSwarm: React.FC<{frame: number; opacity?: number}> = ({frame, opacity = 1}) => {
	if (opacity <= 0) return null;
	type M = {x0: number; y0: number; dur: number; delay: number; size: number};
	const ms: M[] = [
		{x0: 2100, y0: 180, dur: 260, delay: 0, size: 0.5},
		{x0: 2150, y0: 340, dur: 300, delay: 40, size: 0.34},
		{x0: 2080, y0: 520, dur: 240, delay: 80, size: 0.42},
		{x0: 2200, y0: 120, dur: 320, delay: 120, size: 0.28},
	];
	return (
		<div style={{position: 'absolute', inset: 0, opacity}}>
			{ms.map((m, i) => {
				const local = frame - m.delay;
				if (local < 0 || local > m.dur) return null;
				const p = local / m.dur;
				const x = m.x0 - (m.x0 + 240) * p;
				const y = m.y0 + p * 160;
				return (
					<svg key={i} width={W} height={H} style={{position: 'absolute', inset: 0}} viewBox={`0 0 ${W} ${H}`}>
						<g transform={`translate(${x} ${y}) scale(${m.size}) rotate(${frame * 0.3 + i * 40})`}>
							<ellipse cx={-45} cy={6} rx={240} ry={130} fill="rgba(225,146,103,0.18)" transform="rotate(-20)" />
							<path d={METEOR} fill="#38302a" stroke="#241d18" strokeWidth="5" />
							{FACETS.slice(0, 4).map(([points, fill]) => (
								<polygon key={points} points={points} fill={fill} />
							))}
							<path d={`M-100 0 C30 -80 240 -150 640 -260`} fill="none" stroke="#d58259" strokeWidth="10" opacity=".35" strokeLinecap="round" />
						</g>
					</svg>
				);
			})}
		</div>
	);
};

/** 天空之柱顶层（唤龙之祭坛）：远景剪影版（高塔锥身、祭坛台、云海下） */
const TOWER_FACE = 'M880 1080 912 660 940 470 960 420 1010 470 1044 660 1075 1080Z';
const TOWER_SIDE = 'M880 1080 912 660 940 470 960 420 1010 470 1044 660 1075 1080';
export const SkyPillarTop: React.FC = () => (
	<svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
		<defs>
			<linearGradient id="pillar-top-night" x1="0" y1="0" x2="0" y2="1">
				<stop stopColor="#1a2132" />
				<stop offset=".55" stopColor="#141b2a" />
				<stop offset="1" stopColor="#0d1220" />
			</linearGradient>
			<linearGradient id="pillar-face" x1=".1" x2="1" y2="0">
				<stop stopColor="#232b3d" />
				<stop offset="1" stopColor="#323d56" />
			</linearGradient>
		</defs>
		{/* 塔身 */}
		<path d={TOWER_FACE} fill="url(#pillar-face)" stroke="#0b0f1c" strokeWidth="4" />
		{/* 塔顶台 */}
		<path d="M912 660 940 470 960 420 1010 470 1044 660Z" fill="#121a2c" stroke="#2a3654" strokeWidth="2.5" />
		<ellipse cx={978} cy={520} rx={46} ry={18} fill="none" stroke="#8ea6d8" strokeWidth="1.6" opacity=".5" />
		{/* 台边石栏 */}
		<path d="M920 640 948 486 M980 640 985 470 M1028 640 1010 486" stroke="#3a4a6e" strokeWidth="3" fill="none" />
		{/* 云海（塔身两侧） */}
		{FACETS.slice(0, 2).map(([, fill], i) => (
			<ellipse key={i} cx={i === 0 ? 760 : 1200} cy={1020 - i * 30} rx={420} ry={90} fill={fill} opacity=".14" />
		))}
		<ellipse cx={960} cy={1075} rx={900} ry={120} fill="#101a30" opacity=".85" />
	</svg>
);

/** 祭坛上的红石（七彩之石 / 陨石）：发光的宝玉 */
export const AltarStone: React.FC<{x: number; y: number; glow: number; rainbow?: number}> = ({x, y, glow, rainbow = 0}) => (
	<svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
		<defs>
			<radialGradient id="stone-halo">
				<stop stopColor="#ff8a7a" stopOpacity={0.75 * glow} />
				<stop offset="1" stopColor="#ff5a4a" stopOpacity="0" />
			</radialGradient>
			<radialGradient id="stone-rainbow">
				<stop stopColor="#ffe9f0" stopOpacity={0.5 * rainbow} />
				<stop offset=".4" stopColor="#a9f0d0" stopOpacity={0.35 * rainbow} />
				<stop offset="1" stopColor="#7fb8ff" stopOpacity="0" />
			</radialGradient>
		</defs>
		<ellipse cx={x} cy={y} rx={150 * (0.4 + glow)} ry={110 * (0.4 + glow)} fill="url(#stone-halo)" />
		<ellipse cx={x} cy={y} rx={220 * rainbow} ry={160 * rainbow} fill="url(#stone-rainbow)" />
		<path d={`M${x - 26} ${y} L${x - 12} ${y - 30} L${x + 8} ${y - 34} L${x + 26} ${y - 10} L${x + 14} ${y + 22} L${x - 16} ${y + 24}Z`} fill="#3a0f0c" stroke="#ff9a8a" strokeWidth="2" />
		<ellipse cx={x} cy={y - 6} rx={10} ry={6} fill="#ffd9c9" opacity={0.4 + glow * 0.6} />
	</svg>
);
