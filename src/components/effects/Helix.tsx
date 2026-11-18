import {interpolate} from 'remotion';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

const N = 64; // 每条链上的节点数

/**
 * 金色 DNA 双螺旋：绕水平轴旋转，从中心向两端描出。
 * layer="back" 只画转到背面的部分，"front" 只画正面的部分，宝可梦夹在两层之间形成环绕感。
 */
export const Helix: React.FC<{
	x: number;
	y: number;
	length: number;
	radius: number;
	turns?: number;
	tilt?: number;
	revealFrom: number;
	revealFrames?: number;
	layer: 'back' | 'front';
	opacity?: number;
}> = ({x, y, length, radius, turns = 3, tilt = -12, revealFrom, revealFrames = 70, layer, opacity = 1}) => {
	const frame = useFrame();
	const reveal = interpolate(frame, [revealFrom, revealFrom + revealFrames], [0, 1], clamp);
	if (reveal <= 0 || opacity <= 0) return null;
	const phase = frame * 0.045;
	const nodes = Array.from({length: N}, (_, i) => {
		const u = i / (N - 1) - 0.5; // -0.5 … 0.5
		const theta = u * turns * Math.PI * 2 + phase;
		return {
			u,
			sx: u * length,
			a: {y: Math.sin(theta) * radius, d: Math.cos(theta)},
			b: {y: Math.sin(theta + Math.PI) * radius, d: Math.cos(theta + Math.PI)},
		};
	}).filter((n) => Math.abs(n.u) <= reveal * 0.5);
	const show = (d: number) => (layer === 'front' ? d >= 0 : d < 0);
	const dot = (sx: number, sy: number, d: number, key: string) => (
		<circle key={key} cx={sx} cy={sy} r={3 + 2.5 * (d + 1)} fill={`rgba(255,${210 + 30 * d},${140 + 60 * d},${0.45 + 0.4 * (d + 1) / 2})`} />
	);
	return (
		<svg
			width={1920}
			height={1080}
			style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity, filter: 'drop-shadow(0 0 6px rgba(255,200,120,0.8)) drop-shadow(0 0 18px rgba(255,170,90,0.45))'}}
		>
			<g transform={`translate(${x},${y}) rotate(${tilt})`}>
				{/* 碱基对横档：两端都在本层时才画 */}
				{nodes
					.filter((_, i) => i % 3 === 0)
					.filter((n) => show((n.a.d + n.b.d) / 2 + (layer === 'front' ? 0.001 : -0.001)) && Math.abs(n.a.d) < 0.6)
					.map((n, i) => (
						<line key={`r${i}`} x1={n.sx} y1={n.a.y} x2={n.sx} y2={n.b.y} stroke="rgba(255,226,170,0.35)" strokeWidth={1.5} />
					))}
				{nodes.map((n, i) => (show(n.a.d) ? dot(n.sx, n.a.y, n.a.d, `a${i}`) : null))}
				{nodes.map((n, i) => (show(n.b.d) ? dot(n.sx, n.b.y, n.b.d, `b${i}`) : null))}
			</g>
		</svg>
	);
};
