import {Series} from 'remotion';
import {toFrames} from '../../time';
import {ANCESTOR_SCENE_FRAMES, AncestorScene} from './AncestorScene';
import {BATTLE_SCENE_FRAMES, BattleScene} from './BattleScene';
import {CREATED_SCENE_FRAMES, CreatedScene} from './CreatedScene';
import {CREDITS_SCENE_FRAMES, CreditsScene} from './CreditsScene';
import {DIARY_SCENE_FRAMES, DiaryScene} from './DiaryScene';
import {FATES_SCENE_FRAMES, FatesScene} from './FatesScene';
import {MIRAGE_SCENE_FRAMES, MirageScene} from './MirageScene';
import {RAMPAGE_SCENE_FRAMES, RampageScene} from './RampageScene';

// 第 3 期《生命之源》：各段按顺序拼接（段与段之间用墨潮、墨退、余烬、漩涡合拢等水墨的流动衔接）
const SEGMENTS = [
	{component: MirageScene, frames: MIRAGE_SCENE_FRAMES},
	{component: AncestorScene, frames: ANCESTOR_SCENE_FRAMES},
	{component: DiaryScene, frames: DIARY_SCENE_FRAMES},
	{component: RampageScene, frames: RAMPAGE_SCENE_FRAMES},
	{component: CreatedScene, frames: CREATED_SCENE_FRAMES},
	{component: BattleScene, frames: BATTLE_SCENE_FRAMES},
	{component: FatesScene, frames: FATES_SCENE_FRAMES},
	{component: CreditsScene, frames: CREDITS_SCENE_FRAMES},
];

export const EPISODE03_FRAMES = SEGMENTS.reduce((sum, s) => sum + s.frames, 0);

export const Episode03: React.FC = () => (
	<Series>
		{SEGMENTS.map(({component: Scene, frames}, i) => (
			<Series.Sequence key={i} durationInFrames={toFrames(frames)}>
				<Scene />
			</Series.Sequence>
		))}
	</Series>
);
