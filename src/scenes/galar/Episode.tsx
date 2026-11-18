import {Series} from 'remotion';
import {toFrames} from '../../time';
import {HookScene, HOOK_SCENE_FRAMES} from './HookScene';
import {StarScene, STAR_SCENE_FRAMES} from './StarScene';
import {NightScene, NIGHT_SCENE_FRAMES} from './NightScene';

export const GALAR_EPISODE_FRAMES = HOOK_SCENE_FRAMES + STAR_SCENE_FRAMES + NIGHT_SCENE_FRAMES;

export const GalarEpisode: React.FC = () => (
	<Series>
		<Series.Sequence durationInFrames={toFrames(HOOK_SCENE_FRAMES)} name="四幅挂毯"><HookScene /></Series.Sequence>
		<Series.Sequence durationInFrames={toFrames(STAR_SCENE_FRAMES)} name="坠落的星"><StarScene /></Series.Sequence>
		<Series.Sequence durationInFrames={toFrames(NIGHT_SCENE_FRAMES)} name="闇夜"><NightScene /></Series.Sequence>
	</Series>
);
