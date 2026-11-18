import {AbsoluteFill, random} from 'remotion';
import {COLORS} from '../theme';
import {useFrame} from '../time';

// 三层景深的金色浮尘：远处细小清晰，近处大而虚化
const LAYERS = [
	{count: 120, size: [2, 4], speed: 0.25, blurFalloff: 0.2, opacity: 0.55},
	{count: 44, size: [6, 14], speed: 0.6, blurFalloff: 0.45, opacity: 0.35},
	{count: 15, size: [40, 90], speed: 1.2, blurFalloff: 0.9, opacity: 0.12},
] as const;

const MOTES = LAYERS.flatMap((layer, li) =>
	Array.from({length: layer.count}, (_, i) => {
		const k = `${li}-${i}`;
		return {
			// 分布范围比画面宽，镜头平移后边缘也有浮尘
			x: -600 + random(`mx${k}`) * 3120,
			y: random(`my${k}`) * 1080,
			size: layer.size[0] + random(`ms${k}`) * (layer.size[1] - layer.size[0]),
			drift: (random(`md${k}`) - 0.5) * 0.4,
			phase: random(`mp${k}`) * Math.PI * 2,
			layer,
		};
	}),
);

/** frameOffset：跨段接续时用整期时间轴计时（段落交界不跳） */
export const DustMotes: React.FC<{opacity?: number; rgb?: string; frameOffset?: number}> = ({opacity = 1, rgb = COLORS.glowRgb, frameOffset = 0}) => {
	const frame = useFrame() + frameOffset;
	return (
		<AbsoluteFill style={{opacity, pointerEvents: 'none'}}>
			{MOTES.map((m, i) => {
				const {speed, blurFalloff} = m.layer;
				// 缓慢上浮 + 左右摆动，循环回到底部
				const y = ((m.y - frame * speed + 1200) % 1200) - 60;
				const x = m.x + Math.sin(frame * 0.012 * (1 + speed) + m.phase) * 30 + frame * m.drift;
				const tw = 0.6 + 0.4 * Math.sin(frame * 0.05 + m.phase);
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: y,
							width: m.size,
							height: m.size,
							borderRadius: '50%',
							opacity: m.layer.opacity * tw,
							background: `radial-gradient(circle, rgba(${rgb},1) 0%, rgba(${rgb},0.6) ${(1 - blurFalloff) * 45}%, transparent 70%)`,
							transform: 'translate(-50%, -50%)',
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};
