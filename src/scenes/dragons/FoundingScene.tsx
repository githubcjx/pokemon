import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Grain} from '../../components/Grain';
import {Cam, track} from '../../camera';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {FOUNDING_SCENE_FRAMES, SEG_START, globalTime} from './continuity';
import {Stage} from './Stage';

export {FOUNDING_SCENE_FRAMES};

/**
 * 第 2 段《建国》（11 秒）：
 * 接第 1 段的空洞 → 镜头拉远，空洞升到天上，露出远古合众的大地与岩台上的双子英雄 →
 * 城邦从地面升起、亮起灯火 → 镜头回到英雄身上（接第 3 段）。
 */

const EASE = Easing.inOut(Easing.cubic);

/** 本段镜头（第 3 段开头沿用末帧） */
export const foundingCam = (frame: number): Cam => ({
	x: track(frame, [
		[0, 960],
		[96, 960, EASE],
		[130, 960],
		[220, 1240],
		[FOUNDING_SCENE_FRAMES, 935],
	]),
	y: track(frame, [
		[0, -180],
		[96, 540, EASE],
		[220, 540],
		[FOUNDING_SCENE_FRAMES, 610],
	]),
	zoom: track(frame, [
		[0, 2.4],
		[96, 1.0, EASE],
		[220, 1.0],
		[FOUNDING_SCENE_FRAMES, 1.28],
	]),
	roll: 0,
});

export const FoundingScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('founding', frame);
	const cam = foundingCam(frame);

	const dark = interpolate(frame, [4, 70], [1, 0], {...clamp, easing: Easing.inOut(Easing.quad)});
	const town = interpolate(frame, [150, 250], [0, 1], clamp);
	const lights = interpolate(frame, [215, 260], [0, 1], clamp);

	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Stage time={t} cam={cam} dark={dark} town={town} lights={lights} />
			<Vignette strength={0.75} />
			<BiSubtitle
				tone="mono"
				zh="很久以前，一对双子英雄和一只龙宝可梦，一起建立了合众。"
				en="Long ago, twin heroes and a single Dragon Pokémon founded Unova together."
				from={34}
				to={160}
				source={{zh: '黑白·艾莉丝；黑2白2·夏卡', en: 'B/W Iris; B2/W2 Drayden'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="人与宝可梦，在这里幸福地生活。"
				en="People and Pokémon lived happy lives there."
				from={172}
				to={FOUNDING_SCENE_FRAMES - 30}
				source={{zh: '黑白·艾莉丝', en: "B/W Iris: And people and Pokémon had happy lives!"}}
			/>
			<Grain opacity={0.12} frameOffset={SEG_START.founding} />
		</AbsoluteFill>
	);
};
