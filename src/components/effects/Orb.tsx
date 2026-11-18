/** 发光能量球：核心近白，外圈为主色 */
export const Orb: React.FC<{x: number; y: number; size: number; rgb: string; intensity?: number}> = ({
	x,
	y,
	size,
	rgb,
	intensity = 1,
}) => (
	<div
		style={{
			position: 'absolute',
			left: x - size / 2,
			top: y - size / 2,
			width: size,
			height: size,
			borderRadius: '50%',
			opacity: Math.min(1, intensity),
			background: `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,250,240,0.95) 18%, rgba(${rgb},0.85) 42%, rgba(${rgb},0) 70%)`,
			boxShadow: `0 0 ${size * 0.6 * intensity}px ${size * 0.15 * intensity}px rgba(${rgb},0.55), 0 0 ${size * 1.6 * intensity}px ${size * 0.3 * intensity}px rgba(${rgb},0.2)`,
		}}
	/>
);
