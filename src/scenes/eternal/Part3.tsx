import {Series} from 'remotion';
import {toFrames} from '../../time';
import {CODA_SCENE_FRAMES, CodaScene} from './CodaScene';
import {HOTEL_SCENE_FRAMES, HotelScene} from './HotelScene';
import {REUNION_SCENE_FRAMES, ReunionScene} from './ReunionScene';

// 《永恒之花》下篇：第 7–9 段（重逢、旅馆 Z、尾声）连着做、合成一个文件交付
const SEGMENTS = [
	{component: ReunionScene, frames: REUNION_SCENE_FRAMES},
	{component: HotelScene, frames: HOTEL_SCENE_FRAMES},
	{component: CodaScene, frames: CODA_SCENE_FRAMES},
];

export const ETERNAL_PART3_FRAMES = SEGMENTS.reduce((sum, s) => sum + s.frames, 0);

export const EternalPart3: React.FC = () => (
	<Series>
		{SEGMENTS.map(({component: Scene, frames}, i) => (
			<Series.Sequence key={i} durationInFrames={toFrames(frames)}>
				<Scene />
			</Series.Sequence>
		))}
	</Series>
);
