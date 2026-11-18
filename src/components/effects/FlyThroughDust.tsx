import {AbsoluteFill, random} from 'remotion';
import {COLORS} from '../../theme';

const COUNT = 320;
const DEPTH = 4; // 粒子分布的纵深范围
const FOCAL = 0.9;

const PARTICLES = Array.from({length: COUNT}, (_, i) => {
	const a = random(`fa${i}`) * Math.PI * 2;
	// 避开正中心，免得粒子直冲镜头
	const r = 0.12 + Math.sqrt(random(`fr${i}`)) * 1.3;
	return {x: Math.cos(a) * r * 1.7, y: Math.sin(a) * r, z: random(`fz${i}`) * DEPTH, size: 3.5 + random(`fs${i}`) * 6};
});

/**
 * 穿越式粒子：镜头沿纵深前进时，粒子从画面中心向外扑来、越近越大，并按速度拉出拖影。
 * travel 为镜头已前进的距离，speed 为当前速度（用来决定拖影长短）。
 */
export const FlyThroughDust: React.FC<{travel: number; speed: number; opacity?: number}> = ({travel, speed, opacity = 1}) => {
	if (opacity <= 0) return null;
	return (
		<AbsoluteFill style={{opacity, mixBlendMode: 'screen', pointerEvents: 'none'}}>
			{PARTICLES.map((p, i) => {
				const d = ((((p.z - travel) % DEPTH) + DEPTH) % DEPTH) + 0.08;
				const sx = 960 + ((p.x * FOCAL) / d) * 540;
				const sy = 540 + ((p.y * FOCAL) / d) * 540;
				if (sx < -200 || sx > 2120 || sy < -200 || sy > 1280) return null;
				const size = (p.size * FOCAL) / d;
				// 远处淡入、贴近镜头时淡出
				const a = Math.min(1, (DEPTH - d) / 1.2) * Math.min(1, d / 0.35);
				const radial = Math.atan2(sy - 540, sx - 960);
				const stretch = 1 + (speed * 40) / d;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: sx,
							top: sy,
							width: size * stretch,
							height: size,
							borderRadius: size,
							opacity: a,
							transform: `translate(-100%, -50%) rotate(${(radial * 180) / Math.PI}deg)`,
							transformOrigin: '100% 50%',
							background: `linear-gradient(90deg, transparent, rgba(${COLORS.glowRgb},0.9))`,
							boxShadow: `0 0 ${size * 2}px rgba(${COLORS.glowRgb},0.6)`,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};
