import {AbsoluteFill, interpolate, random} from 'remotion';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

const STREAKS = Array.from({length: 110}, (_, i) => ({
	x0: random(`rx${i}`) * 2400,
	lane: (random(`rl${i}`) - 0.5) * 2, // -1..1，偏离河道中线的程度
	speed: 7 + random(`rs${i}`) * 12,
	len: 60 + random(`rn${i}`) * 220,
	width: 1 + random(`rw${i}`) * 2.6,
	phase: random(`rp${i}`) * Math.PI * 2,
	bright: random(`rb${i}`),
}));

/**
 * 时间长河：沿正弦河道从左向右奔流的光带。
 * y 为河道中线，amplitude 为河道摆动幅度，spread 为河道半宽。
 */
export const TimeRiver: React.FC<{
	from: number;
	y: number;
	amplitude?: number;
	spread?: number;
	opacity?: number;
}> = ({from, y, amplitude = 70, spread = 110, opacity = 1}) => {
	const frame = useFrame();
	const fade = interpolate(frame, [from, from + 40], [0, 1], clamp);
	if (fade <= 0) return null;
	const t = frame - from;

	return (
		<AbsoluteFill style={{opacity: fade * opacity, mixBlendMode: 'screen'}}>
			{STREAKS.map((s, i) => {
				const x = ((s.x0 + t * s.speed) % 2400) - 240;
				const riverY = y + Math.sin(x * 0.0035 + t * 0.02) * amplitude;
				const py = riverY + s.lane * spread + Math.sin(t * 0.05 + s.phase) * 6;
				// 河道斜率，用来让光带顺着河道方向倾斜
				const slope = Math.cos(x * 0.0035 + t * 0.02) * amplitude * 0.0035;
				const edge = 1 - Math.abs(s.lane) * 0.75;
				const a = (0.35 + s.bright * 0.65) * edge;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: py,
							width: s.len,
							height: s.width,
							borderRadius: s.width,
							transformOrigin: '100% 50%',
							transform: `translate(-100%, -50%) rotate(${(Math.atan(slope) * 180) / Math.PI}deg)`,
							background: `linear-gradient(90deg, transparent, rgba(220,200,150,${a * 0.6}) 60%, rgba(235,245,255,${a}))`,
							boxShadow: `0 0 10px rgba(200,215,235,${a * 0.5})`,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};
