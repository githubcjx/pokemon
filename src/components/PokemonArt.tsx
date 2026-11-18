import {Easing, Img, interpolate} from 'remotion';
import {clamp} from '../theme';
import {useFrame} from '../time';

type RGB = string; // 形如 '255,200,110'

/**
 * 官方立绘的登场：淡入的金边剪影 → 短暂过曝 → 显出原色。
 * 只做亮度与外发光，不改变立绘本身的造型和配色。
 */
export const PokemonArt: React.FC<{
	src: string;
	x: number;
	y: number;
	size: number;
	/** 开始淡入（剪影）的帧 */
	appear: number;
	/** 剪影 → 显色的三个关键帧：开始、过曝峰值、稳定 */
	reveal: [number, number, number];
	rimRgb?: RGB;
	glowRgb?: RGB;
	/** 显色后残留的柔光强度 */
	restRim?: number;
	floatAmp?: number;
	floatPeriod?: number;
	opacity?: number;
	extraFilter?: string;
}> = ({
	src,
	x,
	y,
	size,
	appear,
	reveal,
	rimRgb = '255,244,214',
	glowRgb = '255,200,110',
	restRim = 0.3,
	floatAmp = 9,
	floatPeriod = 24,
	opacity = 1,
	extraFilter = '',
}) => {
	const frame = useFrame();
	if (frame < appear) return null;

	const [rs, rp, re] = reveal;
	const fadeIn = interpolate(frame, [appear, appear + 20], [0, 1], clamp);
	const scale = interpolate(frame, [appear, re + 40], [0.9, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const floatY = Math.sin(frame / floatPeriod) * floatAmp;
	const brightness = interpolate(frame, [rs, rp, re], [0.05, 1.45, 1], clamp);
	const rim = interpolate(frame, [appear, rs - 6, re], [0, 1, restRim], clamp);

	return (
		<Img
			src={src}
			style={{
				position: 'absolute',
				left: x - size / 2,
				top: y - size / 2 + floatY,
				width: size,
				height: size,
				opacity: fadeIn * opacity,
				transform: `scale(${scale})`,
				filter: `brightness(${brightness}) drop-shadow(0 0 ${3 + rim * 6}px rgba(${rimRgb},${rim})) drop-shadow(0 0 ${8 + rim * 14}px rgba(${glowRgb},${rim})) drop-shadow(0 0 ${28 + rim * 40}px rgba(${glowRgb},${0.3 + rim * 0.45})) ${extraFilter}`,
			}}
		/>
	);
};
