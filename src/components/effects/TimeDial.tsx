import {interpolate} from 'remotion';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

const polar = (r: number, deg: number) => {
	const a = ((deg - 90) * Math.PI) / 180;
	return [r * Math.cos(a), r * Math.sin(a)] as const;
};

// 齿轮外廓
const cogPath = (teeth: number, inner: number, outer: number) => {
	const pts: string[] = [];
	for (let i = 0; i < teeth; i++) {
		const base = (i / teeth) * 360;
		const step = 360 / teeth;
		for (const [r, d] of [
			[inner, 0],
			[outer, step * 0.2],
			[outer, step * 0.5],
			[inner, step * 0.7],
		] as const) {
			const [x, y] = polar(r, base + d);
			pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
		}
	}
	return `M ${pts.join(' L ')} Z`;
};

const COG_OUTER = cogPath(60, 318, 334);
const COG_INNER = cogPath(24, 150, 166);

/**
 * 远古时钟纹样（帝牙卢卡 · 时间）：刻度盘、双齿轮、三根指针。
 * 描线浮现，齿轮与指针持续转动。rgb 为线条颜色。
 */
export const TimeDial: React.FC<{
	x: number;
	y: number;
	size: number;
	revealFrom: number;
	revealFrames?: number;
	opacity?: number;
	rgb?: string;
}> = ({x, y, size, revealFrom, revealFrames = 70, opacity = 1, rgb = '214,196,150'}) => {
	const frame = useFrame();
	const reveal = interpolate(frame, [revealFrom, revealFrom + revealFrames], [0, 1], clamp);
	if (reveal <= 0) return null;

	const R = 500;
	const layer = (i: number) => interpolate(reveal, [i * 0.14, i * 0.14 + 0.5], [0, 1], clamp);
	const dash = (i: number) => ({pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - layer(i)});
	const t = frame - revealFrom;
	const stroke = `rgba(${rgb},0.8)`;

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
				filter: `drop-shadow(0 0 6px rgba(${rgb},0.7)) drop-shadow(0 0 20px rgba(${rgb},0.35))`,
			}}
			fill="none"
			stroke={stroke}
		>
			{/* 刻度盘 */}
			<circle r={470} strokeWidth={1.6} {...dash(0)} />
			<circle r={455} strokeWidth={0.8} {...dash(0)} />
			<g opacity={layer(1)}>
				{Array.from({length: 60}, (_, i) => {
					const major = i % 5 === 0;
					const [x1, y1] = polar(452, i * 6);
					const [x2, y2] = polar(major ? 418 : 438, i * 6);
					return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={major ? 3 : 1.2} />;
				})}
				{Array.from({length: 12}, (_, i) => {
					const [cx, cy] = polar(392, i * 30);
					return (
						<rect
							key={i}
							x={cx - 8}
							y={cy - 8}
							width={16}
							height={16}
							transform={`rotate(45 ${cx} ${cy})`}
							fill={i % 3 === 0 ? stroke : 'none'}
							strokeWidth={1.5}
						/>
					);
				})}
			</g>
			{/* 双齿轮，反向转动 */}
			<g transform={`rotate(${t * 0.25})`}>
				<path d={COG_OUTER} strokeWidth={1.4} {...dash(2)} />
				<circle r={300} strokeWidth={0.8} strokeDasharray="3 9" opacity={layer(2)} />
			</g>
			<g transform={`rotate(${-t * 0.6})`}>
				<path d={COG_INNER} strokeWidth={1.4} {...dash(3)} />
			</g>
			{/* 指针：时针、分针、秒针 */}
			<g opacity={layer(4)} strokeLinecap="round">
				<line x1={0} y1={30} x2={0} y2={-230} strokeWidth={6} transform={`rotate(${t * 0.08})`} />
				<line x1={0} y1={40} x2={0} y2={-340} strokeWidth={3.5} transform={`rotate(${t * 0.9 + 120})`} />
				<line x1={0} y1={60} x2={0} y2={-410} strokeWidth={1.2} transform={`rotate(${t * 6 + 240})`} />
				<circle r={14} fill={stroke} />
			</g>
		</svg>
	);
};
