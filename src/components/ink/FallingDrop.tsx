import {Easing, interpolate} from 'remotion';
import {Cam, project} from '../../camera';
import {clamp} from '../../theme';

/**
 * 下落的墨滴（俯视）：由近（大而虚）到远（小而实），在 to 帧落到景深层 k 上的 at 点后消失，
 * 之后由背景着色器里同一位置、同一时刻的墨滴接着晕开。
 */
export const FallingDrop: React.FC<{cam: Cam; frame: number; k: number; at: {x: number; y: number}; from: number; to: number}> = ({
	cam,
	frame,
	k,
	at,
	from,
	to,
}) => {
	if (frame < from || frame >= to) return null;
	const p = interpolate(frame, [from, to], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const s = project(cam, k, at);
	const size = interpolate(p, [0, 1], [150, 15]);
	return (
		<div
			style={{
				position: 'absolute',
				left: s.x - size / 2,
				top: s.y - size / 2 - (1 - p) * 40,
				width: size,
				height: size,
				borderRadius: '50%',
				background: 'radial-gradient(circle at 38% 32%, rgba(90,80,70,0.95) 0%, rgba(14,11,9,1) 45%, rgba(8,6,5,1) 100%)',
				filter: `blur(${(1 - p) * 26}px)`,
				opacity: interpolate(p, [0, 0.35], [0, 1], clamp),
			}}
		/>
	);
};
