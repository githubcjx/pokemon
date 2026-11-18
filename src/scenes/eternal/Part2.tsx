import {Series} from 'remotion';
import {toFrames} from '../../time';
import {AGES_SCENE_FRAMES, AgesScene} from './AgesScene';
import {LEAVE_SCENE_FRAMES, LeaveScene} from './LeaveScene';
import {WEAPON_SCENE_FRAMES, WeaponScene} from './WeaponScene';

// 《永恒之花》中篇：第 4–6 段（最终兵器、离开、三千年）连着做、合成一个文件交付
const SEGMENTS = [
	{component: WeaponScene, frames: WEAPON_SCENE_FRAMES},
	{component: LeaveScene, frames: LEAVE_SCENE_FRAMES},
	{component: AgesScene, frames: AGES_SCENE_FRAMES},
];

export const ETERNAL_PART2_FRAMES = SEGMENTS.reduce((sum, s) => sum + s.frames, 0);

export const EternalPart2: React.FC = () => (
	<Series>
		{SEGMENTS.map(({component: Scene, frames}, i) => (
			<Series.Sequence key={i} durationInFrames={toFrames(frames)}>
				<Scene />
			</Series.Sequence>
		))}
	</Series>
);
