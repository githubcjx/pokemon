import {AbsoluteFill, random} from 'remotion';
import {useFrame} from '../../time';

const DROPS = Array.from({length: 160}, (_, i) => ({
	x: random(`rx${i}`) * 2400 - 240,
	y0: random(`ry${i}`) * 1300,
	len: 40 + random(`rl${i}`) * 90,
	speed: 38 + random(`rs${i}`) * 30,
	alpha: 0.25 + random(`ra${i}`) * 0.5,
}));

/** 斜向暴雨：细长雨线高速落下 */
export const Rain: React.FC<{rgb?: string; opacity?: number; angle?: number; frameOffset?: number}> = ({
	rgb = '190,220,255',
	opacity = 1,
	angle = 14,
	frameOffset = 0,
}) => {
	const frame = useFrame() + frameOffset;
	return (
		<AbsoluteFill style={{opacity, transform: `rotate(${angle}deg)`, transformOrigin: '960px 540px'}}>
			{DROPS.map((d, i) => {
				const y = ((d.y0 + frame * d.speed) % 1400) - 200;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: d.x,
							top: y,
							width: 1.6,
							height: d.len,
							background: `linear-gradient(to bottom, transparent, rgba(${rgb},${d.alpha}))`,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};
