import {Series} from 'remotion';
import {toFrames} from '../../time';
import {CODA_SCENE_FRAMES, CodaScene} from './CodaScene';
import {FUSION_SCENE_FRAMES, FusionScene} from './FusionScene';
import {REVIVAL_SCENE_FRAMES, RevivalScene} from './RevivalScene';

// 《真实与理想》第 6–8 段合成一个文件交付（今天的合众）
const SEGMENTS = [
	{component: RevivalScene, frames: REVIVAL_SCENE_FRAMES},
	{component: FusionScene, frames: FUSION_SCENE_FRAMES},
	{component: CodaScene, frames: CODA_SCENE_FRAMES},
];

export const DRAGONS_PART3_FRAMES = SEGMENTS.reduce((sum, s) => sum + s.frames, 0);

export const DragonsPart3: React.FC = () => (
	<Series>
		{SEGMENTS.map(({component: Scene, frames}, i) => (
			<Series.Sequence key={i} durationInFrames={toFrames(frames)}>
				<Scene />
			</Series.Sequence>
		))}
	</Series>
);
