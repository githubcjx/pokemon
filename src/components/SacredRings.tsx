import {interpolate} from 'remotion';
import {clamp, COLORS} from '../theme';
import {useFrame} from '../time';

const polar = (r: number, deg: number) => {
	const a = ((deg - 90) * Math.PI) / 180;
	return [r * Math.cos(a), r * Math.sin(a)] as const;
};

const arcPath = (r: number, startDeg: number, endDeg: number) => {
	const [x1, y1] = polar(r, startDeg);
	const [x2, y2] = polar(r, endDeg);
	const large = endDeg - startDeg > 180 ? 1 : 0;
	return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

// 刻度环：主刻度 + 次刻度
const Ticks: React.FC<{r: number; count: number; long: number; short: number}> = ({r, count, long, short}) => (
	<>
		{Array.from({length: count}, (_, i) => {
			const deg = (i / count) * 360;
			const len = i % 5 === 0 ? long : short;
			const [x1, y1] = polar(r, deg);
			const [x2, y2] = polar(r - len, deg);
			return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={i % 5 === 0 ? 2 : 1} />;
		})}
	</>
);

/**
 * 远古日晷式的金色纹样光环：多层同心环、刻度、弧段与菱形节点，
 * 以描线动画浮现，各层以不同速度反向旋转。
 * reveal: 0–1 描线进度；size: 最外环直径
 */
export const SacredRings: React.FC<{
	x: number;
	y: number;
	size: number;
	revealFrom: number;
	revealFrames?: number;
	opacity?: number;
}> = ({x, y, size, revealFrom, revealFrames = 60, opacity = 1}) => {
	const frame = useFrame();
	const reveal = interpolate(frame, [revealFrom, revealFrom + revealFrames], [0, 1], clamp);
	if (reveal <= 0) return null;

	const R = 500; // viewBox 半径
	const stroke = `rgba(${COLORS.goldRgb},0.75)`;
	// 每一层依次描出
	const layer = (i: number) => interpolate(reveal, [i * 0.12, i * 0.12 + 0.5], [0, 1], clamp);
	const dash = (i: number) => ({pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - layer(i)});
	const rot = (speed: number) => `rotate(${frame * speed})`;

	return (
		<svg
			viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`}
			style={{
				position: 'absolute',
				left: x - size / 2,
				top: y - size / 2,
				width: size,
				height: size,
				opacity,
				overflow: 'visible',
				filter: `drop-shadow(0 0 6px rgba(${COLORS.glowRgb},0.7)) drop-shadow(0 0 18px rgba(${COLORS.glowRgb},0.35))`,
			}}
			fill="none"
			stroke={stroke}
		>
			{/* 最外双环 */}
			<g transform={rot(0.05)}>
				<circle r={490} strokeWidth={1.5} {...dash(0)} />
				<circle r={478} strokeWidth={0.8} {...dash(0)} />
				<g opacity={layer(1)}>
					<Ticks r={476} count={120} long={16} short={7} />
				</g>
			</g>
			{/* 断续弧段 + 菱形节点 */}
			<g transform={rot(-0.09)}>
				{Array.from({length: 12}, (_, i) => (
					<path key={i} d={arcPath(420, i * 30 + 4, i * 30 + 26)} strokeWidth={3} {...dash(2)} />
				))}
				{Array.from({length: 12}, (_, i) => {
					const [cx, cy] = polar(420, i * 30 + 15);
					return (
						<rect
							key={i}
							x={cx - 7}
							y={cy - 7}
							width={14}
							height={14}
							transform={`rotate(45 ${cx} ${cy})`}
							fill={`rgba(${COLORS.goldRgb},0.9)`}
							stroke="none"
							opacity={layer(2)}
						/>
					);
				})}
			</g>
			{/* 内环：细线 + 点列 */}
			<g transform={rot(0.14)}>
				<circle r={360} strokeWidth={1} {...dash(3)} />
				{Array.from({length: 48}, (_, i) => {
					const [cx, cy] = polar(345, i * 7.5);
					return <circle key={i} cx={cx} cy={cy} r={i % 4 === 0 ? 3.5 : 1.8} fill={stroke} stroke="none" opacity={layer(3)} />;
				})}
			</g>
			{/* 十字放射线（呼应阿尔宙斯的千宙腕） */}
			<g transform={rot(-0.03)} opacity={layer(4) * 0.8}>
				{Array.from({length: 8}, (_, i) => {
					const [x1, y1] = polar(250, i * 45);
					const [x2, y2] = polar(330, i * 45);
					return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={i % 2 === 0 ? 2.5 : 1} />;
				})}
				<circle r={250} strokeWidth={0.8} strokeDasharray="2 10" />
			</g>
		</svg>
	);
};
