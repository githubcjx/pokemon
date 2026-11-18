import {Img, random, staticFile} from 'remotion';

/**
 * 今天的合众：人物与建筑的纯黑剪影。
 * 有名有姓的人物（魁奇思、Ｎ、主角）用 52poke 的官方立绘做剪影（只压成纯黑 + 逆光，不改形状、不镜像）；
 * 人群、建筑没有官方形象，用代码画（不画任何标志、徽记）。
 */

/** 官方立绘（public/trainers/），尺寸用于按高度换算宽度；hand 为手的位置（立绘内 0–1 坐标），用来放石头的光 */
const ART = {
	'ghetsis-bw': {src: 'trainers/ghetsis/bw.png', w: 845, h: 1600},
	'ghetsis-b2w2': {src: 'trainers/ghetsis/b2w2.png', w: 964, h: 1600},
	'n-bw': {src: 'trainers/n/bw.png', w: 1025, h: 1600},
	'n-b2w2': {src: 'trainers/n/b2w2.png', w: 1009, h: 1600},
	'hilbert-bw': {src: 'trainers/hilbert/bw.png', w: 668, h: 1600, hand: [0.78, 0.5] as [number, number]},
	'nate-b2w2': {src: 'trainers/nate/b2w2.png', w: 734, h: 1600},
	'drayden-bw': {src: 'trainers/drayden/bw.png', w: 859, h: 1600, hand: [0.05, 0.22] as [number, number]},
	'shadow-b2w2': {src: 'trainers/shadow-triad/b2w2.png', w: 588, h: 1105},
};
export type Who = keyof typeof ART;

/**
 * 人物剪影：x 为水平中心、y 为脚底、h 为身高（像素）。
 * 立绘压成纯黑，外圈一层逆光（rimRgb）。orb：手里那块石头的光。
 */
export const ArtFigure: React.FC<{
	who: Who;
	x: number;
	y: number;
	h: number;
	rimRgb?: string;
	rim?: number;
	opacity?: number;
	/** 低头 / 前倾（度，绕脚底，只做轻微的角度） */
	bow?: number;
	orb?: {rgb: string; amt: number};
	/** 剪影的颜色（墙上的影子可以用更淡的黑） */
	shade?: number;
}> = ({who, x, y, h, rimRgb = '255,255,255', rim = 0.6, opacity = 1, bow = 0, orb, shade = 0}) => {
	const a = ART[who];
	const w = (h * a.w) / a.h;
	const k = h / 300;
	const hand = 'hand' in a ? a.hand : undefined;
	return (
		<div style={{position: 'absolute', left: x - w / 2, top: y - h, width: w, height: h, opacity, transform: `rotate(${bow}deg)`, transformOrigin: '50% 100%'}}>
			<Img
				src={staticFile(a.src)}
				style={{
					width: w,
					height: h,
					filter: `brightness(${shade}) drop-shadow(0 0 ${2 * k + 1}px rgba(${rimRgb},${rim})) drop-shadow(0 0 ${10 * k + 4}px rgba(${rimRgb},${rim * 0.5}))`,
				}}
			/>
			{orb && hand && orb.amt > 0 && (
				<div
					style={{
						position: 'absolute',
						left: hand[0] * w - 12 * k,
						top: hand[1] * h - 12 * k,
						width: 24 * k,
						height: 24 * k,
						borderRadius: '50%',
						background: '#fff',
						opacity: Math.min(1, orb.amt),
						boxShadow: `0 0 ${10 * k}px rgba(${orb.rgb},${orb.amt}), 0 0 ${30 * k}px rgba(${orb.rgb},${orb.amt})`,
					}}
				/>
			)}
		</div>
	);
};

/** 人群：几排头肩剪影（从背后看，面朝舞台） */
const CROWD = Array.from({length: 4}, (_, row) =>
	Array.from({length: 26 - row * 2}, (_, i) => ({
		x: -40 + i * (80 + row * 6) + random(`cx${row}-${i}`) * 30 + (row % 2) * 30,
		s: 1 - row * 0.16 + random(`cs${row}-${i}`) * 0.12,
		row,
	})),
).flat();

export const Crowd: React.FC<{y: number; opacity?: number; rimRgb?: string; time: number}> = ({y, opacity = 1, rimRgb = '255,255,255', time}) => (
	<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity}}>
		{[...CROWD]
			.sort((a, b) => b.row - a.row)
			.map((c, i) => {
				const yy = y - c.row * 38 + Math.sin(time * 1.3 + i) * 1.5;
				const sc = c.s * 1.6;
				return (
					<g key={i} transform={`translate(${c.x}, ${yy}) scale(${sc})`} style={{filter: c.row === 3 ? `drop-shadow(0 -1px 1.5px rgba(${rimRgb},0.6))` : undefined}}>
						<path d="M-30,60 C-30,20 -22,6 -10,2 C-16,-6 -16,-24 0,-28 C16,-24 16,-6 10,2 C22,6 30,20 30,60 Z" fill={c.row === 3 ? '#0a0a0b' : '#030303'} />
					</g>
				);
			})}
	</svg>
);

/** 龙螺旋之塔：合众最古老的高塔（粗圆柱塔身 + 一圈圈斜向的螺旋外廊，塔顶残破如齿） */
export const DragonspiralTower: React.FC<{x: number; base: number; h: number; rim?: string; glow?: number}> = ({x, base, h, rim = '255,255,255', glow = 0}) => {
	const wb = h * 0.34; // 塔底宽
	const wt = h * 0.26; // 塔顶宽
	const top = base - h;
	const teeth = Array.from({length: 9}, (_, i) => {
		const xx = x - wt / 2 + (i / 8) * wt;
		const yy = top + (i % 2 === 0 ? 0 : 14 + random(`tt${i}`) * 26);
		return `L${xx.toFixed(1)},${yy.toFixed(1)}`;
	}).join(' ');
	const body = `M${x - wb / 2},${base} L${x - wt / 2},${top + 10} ${teeth} L${x + wt / 2},${top + 10} L${x + wb / 2},${base} Z`;
	const bands = 7;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
			<g style={{filter: `drop-shadow(0 0 2.5px rgba(${rim},0.45))`}}>
				<path d={body} fill="#030303" />
			</g>
			{Array.from({length: bands}, (_, i) => {
				const k = (i + 0.7) / bands;
				const yy = base - k * h;
				const ww = wb + (wt - wb) * k;
				const tilt = ww * 0.16;
				return (
					<g key={i}>
						<path d={`M${x - ww / 2 - 10},${yy + tilt} L${x + ww / 2 + 10},${yy - tilt} L${x + ww / 2 + 10},${yy - tilt + 16} L${x - ww / 2 - 10},${yy + tilt + 16} Z`} fill="#050505" />
						<line x1={x - ww / 2 - 10} y1={yy + tilt} x2={x + ww / 2 + 10} y2={yy - tilt} stroke={`rgba(${rim},0.28)`} strokeWidth={1.5} />
						{/* 外廊上的拱窗 */}
						{[-0.28, 0, 0.28].map((f) => (
							<rect key={f} x={x + f * ww - 5} y={yy - f * 2 * tilt + 26} width={10} height={20} rx={5} fill={`rgba(${rim},0.08)`} />
						))}
					</g>
				);
			})}
			{glow > 0 && <circle cx={x} cy={top + 4} r={10 + glow * 30} fill="#fff" opacity={Math.min(1, glow)} style={{filter: `drop-shadow(0 0 24px rgba(255,255,255,${glow}))`}} />}
		</svg>
	);
};

/** Ｎ的城堡：从地面升起的城堡（尖塔林立） */
export const NCastle: React.FC<{cx: number; base: number; scale: number; rise?: number; rim?: string}> = ({cx, base, scale, rise = 1, rim = '255,255,255'}) => {
	const towers = [
		{x: -300, w: 60, h: 300},
		{x: -210, w: 80, h: 420},
		{x: -110, w: 70, h: 360},
		{x: 0, w: 120, h: 560},
		{x: 120, w: 70, h: 380},
		{x: 220, w: 84, h: 440},
		{x: 310, w: 58, h: 290},
	];
	const dy = (1 - rise) * 600 * scale;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
			<g transform={`translate(${cx}, ${base + dy}) scale(${scale})`} style={{filter: `drop-shadow(0 0 2px rgba(${rim},0.55))`}}>
				<rect x={-360} y={-200} width={720} height={260} fill="#030303" />
				{towers.map((t, i) => (
					<path
						key={i}
						d={`M${t.x - t.w / 2},0 L${t.x - t.w / 2},${-t.h} L${t.x},${-t.h - t.w * 1.3} L${t.x + t.w / 2},${-t.h} L${t.x + t.w / 2},0 Z`}
						fill="#030303"
					/>
				))}
				{/* 一排窗：冷光 */}
				{towers.map((t, i) => (
					<rect key={`w${i}`} x={t.x - 4} y={-t.h * 0.7} width={8} height={18} fill={`rgba(${rim},0.5)`} />
				))}
			</g>
		</svg>
	);
};
