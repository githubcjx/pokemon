import {Series} from 'remotion';
import {toFrames} from '../../time';
import {GIFT_SCENE_FRAMES, GiftScene} from './GiftScene';
import {HOOK_SCENE_FRAMES, HookScene} from './HookScene';
import {WAR_SCENE_FRAMES, WarScene} from './WarScene';

// 《永恒之花》上篇：第 1–3 段连着做、合成一个文件交付（用户 2026-10-04 同意按剧情分组）
const SEGMENTS = [
	{component: HookScene, frames: HOOK_SCENE_FRAMES},
	{component: GiftScene, frames: GIFT_SCENE_FRAMES},
	{component: WarScene, frames: WAR_SCENE_FRAMES},
];

export const ETERNAL_PART1_FRAMES = SEGMENTS.reduce((sum, s) => sum + s.frames, 0);

export const EternalPart1: React.FC = () => (
	<Series>
		{SEGMENTS.map(({component: Scene, frames}, i) => (
			<Series.Sequence key={i} durationInFrames={toFrames(frames)}>
				<Scene />
			</Series.Sequence>
		))}
	</Series>
);
