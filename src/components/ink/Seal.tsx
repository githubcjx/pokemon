import {Easing, interpolate} from 'remotion';
import {SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

/**
 * 朱砂印章（白文印：红底、字为纸色）。from 帧"盖"下：略大 → 压到纸上，印泥带一点斑驳。
 * text 竖排，两字一列；x / y 为印章中心。
 */
export const Seal: React.FC<{from: number; x: number; y: number; text: string; size?: number; rotate?: number; seed?: number; blend?: 'multiply' | 'normal'}> = ({
	from,
	x,
	y,
	text,
	size = 86,
	rotate = -3,
	seed = 3,
	blend = 'multiply',
}) => {
	const frame = useFrame();
	if (frame < from) return null;
	const t = frame - from;
	const s = interpolate(t, [0, 7], [1.35, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const o = interpolate(t, [0, 4], [0, 1], clamp);
	const id = `seal-${seed}`;
	const chars = text.split('');
	const cols = Math.ceil(chars.length / 2);
	const fs = (size * 0.78) / 2;
	return (
		<svg
			width={size * 1.4}
			height={size * 1.4}
			viewBox={`${-size * 0.7} ${-size * 0.7} ${size * 1.4} ${size * 1.4}`}
			style={{
				position: 'absolute',
				left: x - size * 0.7,
				top: y - size * 0.7,
				opacity: o * 0.92,
				transform: `rotate(${rotate}deg) scale(${s})`,
				mixBlendMode: blend,
				overflow: 'visible',
			}}
		>
			<defs>
				<filter id={id} x="-20%" y="-20%" width="140%" height="140%">
					{/* 边缘不规整 */}
					<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={seed} result="warp" />
					<feDisplacementMap in="SourceGraphic" in2="warp" scale={size * 0.05} xChannelSelector="R" yChannelSelector="G" result="d" />
					{/* 印泥斑驳：细噪声挖掉零星的点 */}
					<feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves={2} seed={seed + 5} result="g" />
					<feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.55" result="gm" />
					<feComposite in="d" in2="gm" operator="in" />
				</filter>
			</defs>
			<g filter={`url(#${id})`}>
				<rect x={-size / 2} y={-size / 2} width={size} height={size} rx={size * 0.06} fill="#b3291f" />
				{chars.map((ch, i) => {
					// 竖排、从右往左：第一个字在右列上方
					const col = Math.floor(i / 2);
					const row = i % 2;
					const cx = cols === 1 ? 0 : (cols - 1 - col - (cols - 1) / 2) * fs * 1.05;
					const cy = (row - 0.5) * fs * 1.08;
					return (
						<text
							key={i}
							x={cx}
							y={cy}
							textAnchor="middle"
							dominantBaseline="central"
							fontFamily={SERIF}
							fontWeight={900}
							fontSize={fs}
							fill="#f3e6c8"
						>
							{ch}
						</text>
					);
				})}
			</g>
		</svg>
	);
};
