import {Audio, interpolate, Sequence, staticFile} from 'remotion';
import {clamp} from '../theme';
import {toFrames} from '../time';

/**
 * 宝可梦叫声（游戏原版，来自 PokeAPI cries，文件在 public/cries/）。
 * at / fadeOut 均为本段时间轴的 30fps 帧号；fadeOut 为 [开始, 结束]，用于在下一刀切走时收掉叫声。
 */
export const Cry: React.FC<{name: string; at: number; volume?: number; fadeOut?: [number, number]}> = ({
	name,
	at,
	volume = 0.85,
	fadeOut,
}) => {
	const fade = fadeOut ? [toFrames(fadeOut[0] - at), toFrames(fadeOut[1] - at)] : null;
	return (
		<Sequence from={toFrames(at)} layout="none" name={`叫声 · ${name}`}>
			<Audio
				src={staticFile(`cries/${name}.ogg`)}
				volume={(f) => (fade ? interpolate(f, fade, [volume, 0], clamp) : volume)}
			/>
		</Sequence>
	);
};
