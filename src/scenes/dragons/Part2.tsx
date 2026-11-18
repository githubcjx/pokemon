import {Series} from 'remotion';
import {toFrames} from '../../time';
import {HUSK_SCENE_FRAMES, HuskScene} from './HuskScene';
import {WAR_SCENE_FRAMES, WarScene} from './WarScene';

// 《真实与理想》第 4–5 段合成一个文件交付（战争与空壳）
const SEGMENTS = [
	{component: WarScene, frames: WAR_SCENE_FRAMES},
	{component: HuskScene, frames: HUSK_SCENE_FRAMES},
];

export const DRAGONS_PART2_FRAMES = SEGMENTS.reduce((sum, s) => sum + s.frames, 0);

export const DragonsPart2: React.FC = () => (
	<Series>
		{SEGMENTS.map(({component: Scene, frames}, i) => (
			<Series.Sequence key={i} durationInFrames={toFrames(frames)}>
				<Scene />
			</Series.Sequence>
		))}
	</Series>
);
