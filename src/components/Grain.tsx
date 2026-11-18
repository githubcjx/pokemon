import {AbsoluteFill} from 'remotion';
import {ShaderCanvas} from '../gl/ShaderCanvas';
import {GRAIN_FRAG} from '../gl/shaders';
import {BASE_FPS, useFrame} from '../time';

/**
 * 最上层的胶片颗粒（全分辨率，12Hz 刷新；强度偏低，兼顾质感与视频体积）。
 * overlay 混合在浅色画面上远比暗场明显、也更耗码率：第 3 期古纸用 opacity 0.06（码率约 33Mbps）。
 */
export const Grain: React.FC<{opacity?: number; frameOffset?: number}> = ({opacity = 0.12, frameOffset = 0}) => {
	const frame = useFrame() + frameOffset;
	return (
		<AbsoluteFill style={{mixBlendMode: 'overlay', opacity, pointerEvents: 'none'}}>
			<ShaderCanvas frag={GRAIN_FRAG} width={1920} height={1080} uniforms={{uTime: frame / BASE_FPS}} />
		</AbsoluteFill>
	);
};

/** 字幕区的暗色衬底，保证文字在强光下可读 */
export const SubtitleBackdrop: React.FC = () => (
	<AbsoluteFill
		style={{background: 'linear-gradient(to top, rgba(8,5,2,0.82) 0%, rgba(8,5,2,0.45) 16%, transparent 34%)'}}
	/>
);
