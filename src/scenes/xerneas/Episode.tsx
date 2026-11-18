import {Series} from 'remotion';
import {toFrames} from '../../time';
import {EndingScene, ENDING_SCENE_FRAMES} from './EndingScene';
import {MiddleScene, MIDDLE_SCENE_FRAMES} from './MiddleScene';
import {OpeningScene, OPENING_SCENE_FRAMES} from './OpeningScene';

export const XERNEAS_EPISODE_FRAMES = OPENING_SCENE_FRAMES + MIDDLE_SCENE_FRAMES + ENDING_SCENE_FRAMES;

export const XerneasEpisode: React.FC = () => (
	<Series>
		<Series.Sequence durationInFrames={toFrames(OPENING_SCENE_FRAMES)} name="枯树醒了"><OpeningScene /></Series.Sequence>
		<Series.Sequence durationInFrames={toFrames(MIDDLE_SCENE_FRAMES)} name="林光与鹿角"><MiddleScene /></Series.Sequence>
		<Series.Sequence durationInFrames={toFrames(ENDING_SCENE_FRAMES)} name="林中余光"><EndingScene /></Series.Sequence>
	</Series>
);
