import {Series} from 'remotion';
import {toFrames} from '../../time';
import {ARCEUS_SCENE_FRAMES, ArceusScene} from './ArceusScene';
import {ENDING_SCENE_FRAMES, EndingScene} from './EndingScene';
import {GIRATINA_SCENE_FRAMES, GiratinaScene} from './GiratinaScene';
import {LAKE_TRIO_SCENE_FRAMES, LakeTrioScene} from './LakeTrioScene';
import {TWINS_SCENE_FRAMES, TwinsScene} from './TwinsScene';

// 第 1 期《起始之物》：各段按顺序拼接（每段自带淡入淡出）
const SEGMENTS = [
	{component: ArceusScene, frames: ARCEUS_SCENE_FRAMES},
	{component: TwinsScene, frames: TWINS_SCENE_FRAMES},
	{component: GiratinaScene, frames: GIRATINA_SCENE_FRAMES},
	{component: LakeTrioScene, frames: LAKE_TRIO_SCENE_FRAMES},
	{component: EndingScene, frames: ENDING_SCENE_FRAMES},
];

export const EPISODE01_FRAMES = SEGMENTS.reduce((sum, s) => sum + s.frames, 0);

export const Episode01: React.FC = () => (
	<Series>
		{SEGMENTS.map(({component: Scene, frames}, i) => (
			<Series.Sequence key={i} durationInFrames={toFrames(frames)}>
				<Scene />
			</Series.Sequence>
		))}
	</Series>
);
