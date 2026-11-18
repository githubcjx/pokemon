import {Series} from 'remotion';
import {toFrames} from '../../time';
import {CLASH_SCENE_FRAMES, ClashScene} from './ClashScene';
import {CONTINENT_SCENE_FRAMES, ContinentScene} from './ContinentScene';
import {ENDING2_SCENE_FRAMES, EndingScene} from './EndingScene';
import {PRIMAL_SCENE_FRAMES, PrimalScene} from './PrimalScene';
import {RAYQUAZA_SCENE_FRAMES, RayquazaScene} from './RayquazaScene';
import {SLEEP_SCENE_FRAMES, SleepScene} from './SleepScene';

// 第 2 期《大地与海洋之战》：各段按顺序拼接（段与段之间用白闪、画面接续、暗场吞没衔接）
const SEGMENTS = [
	{component: PrimalScene, frames: PRIMAL_SCENE_FRAMES},
	{component: ClashScene, frames: CLASH_SCENE_FRAMES},
	{component: RayquazaScene, frames: RAYQUAZA_SCENE_FRAMES},
	{component: SleepScene, frames: SLEEP_SCENE_FRAMES},
	{component: ContinentScene, frames: CONTINENT_SCENE_FRAMES},
	{component: EndingScene, frames: ENDING2_SCENE_FRAMES},
];

export const EPISODE02_FRAMES = SEGMENTS.reduce((sum, s) => sum + s.frames, 0);

export const Episode02: React.FC = () => (
	<Series>
		{SEGMENTS.map(({component: Scene, frames}, i) => (
			<Series.Sequence key={i} durationInFrames={toFrames(frames)}>
				<Scene />
			</Series.Sequence>
		))}
	</Series>
);
