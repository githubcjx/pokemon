import {Series} from 'remotion';
import {toFrames} from '../../time';
import {FOUNDING_SCENE_FRAMES, FoundingScene} from './FoundingScene';
import {HOOK_SCENE_FRAMES, HookScene} from './HookScene';
import {SPLIT_SCENE_FRAMES, SplitScene} from './SplitScene';

// 《真实与理想》第 1–3 段合成一个文件交付（用户 2026-10-04 要求）
const SEGMENTS = [
	{component: HookScene, frames: HOOK_SCENE_FRAMES},
	{component: FoundingScene, frames: FOUNDING_SCENE_FRAMES},
	{component: SplitScene, frames: SPLIT_SCENE_FRAMES},
];

export const DRAGONS_PART1_FRAMES = SEGMENTS.reduce((sum, s) => sum + s.frames, 0);

export const DragonsPart1: React.FC = () => (
	<Series>
		{SEGMENTS.map(({component: Scene, frames}, i) => (
			<Series.Sequence key={i} durationInFrames={toFrames(frames)}>
				<Scene />
			</Series.Sequence>
		))}
	</Series>
);
