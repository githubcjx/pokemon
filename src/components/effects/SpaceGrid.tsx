import {interpolate} from 'remotion';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

/**
 * 空间网格（帕路奇亚 · 空间）：以中心为消失点、不断向外扩张的菱形层 + 放射线。
 * speed 为每帧扩张速度（层/帧），可在屏障破碎后加快。
 */
export const SpaceGrid: React.FC<{
	x: number;
	y: number;
	revealFrom: number;
	/** 已累计的扩张相位（由调用方积分速度得到） */
	phase: number;
	/** 网格覆盖半径（像素） */
	radius?: number;
	opacity?: number;
	rgb?: string;
}> = ({x, y, revealFrom, phase, radius = 900, opacity = 1, rgb = '232,196,200'}) => {
	const frame = useFrame();
	const reveal = interpolate(frame, [revealFrom, revealFrom + 50], [0, 1], clamp);
	if (reveal <= 0) return null;

	const LAYERS = 9;
	const rays = 16;

	return (
		<svg
			width={1920}
			height={1080}
			style={{position: 'absolute', left: 0, top: 0, opacity: opacity * reveal, overflow: 'visible'}}
			fill="none"
		>
			<defs>
				<radialGradient id="spaceGridFade" cx={x} cy={y} r={radius} gradientUnits="userSpaceOnUse">
					<stop offset="0" stopColor="#fff" stopOpacity={0} />
					<stop offset="0.12" stopColor="#fff" stopOpacity={0.9} />
					<stop offset="0.7" stopColor="#fff" stopOpacity={0.5} />
					<stop offset="1" stopColor="#fff" stopOpacity={0} />
				</radialGradient>
				<mask id="spaceGridMask">
					<rect x={-2000} y={-2000} width={6000} height={6000} fill="url(#spaceGridFade)" />
				</mask>
			</defs>
			<g mask="url(#spaceGridMask)" stroke={`rgba(${rgb},0.75)`}>
				{/* 放射线，随描线进度向外伸展 */}
				{Array.from({length: rays}, (_, i) => {
					const a = (i / rays) * Math.PI * 2 + Math.PI / rays;
					const len = radius * 1.2 * reveal;
					return (
						<line
							key={`r${i}`}
							x1={x}
							y1={y}
							x2={x + Math.cos(a) * len}
							y2={y + Math.sin(a) * len * 0.8}
							strokeWidth={i % 4 === 0 ? 1.4 : 0.7}
						/>
					);
				})}
				{/* 菱形层：指数间距，frac(phase) 连续推进，形成无限扩张 */}
				{Array.from({length: LAYERS}, (_, k) => {
					const f = k + (phase % 1);
					const s = 18 * Math.pow(1.55, f);
					const w = s * 1.25;
					const h = s;
					const a = interpolate(f, [0, 1.5, LAYERS - 1.5, LAYERS], [0, 1, 1, 0], clamp);
					return (
						<path
							key={`d${k}`}
							d={`M ${x} ${y - h} L ${x + w} ${y} L ${x} ${y + h} L ${x - w} ${y} Z`}
							strokeWidth={0.6 + f * 0.18}
							opacity={a}
						/>
					);
				})}
			</g>
		</svg>
	);
};
