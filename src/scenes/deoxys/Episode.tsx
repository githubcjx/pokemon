import {AbsoluteFill, Sequence} from 'remotion';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {toFrames, useFrame} from '../../time';
import {GlyphWorld} from './GlyphWorld';
import {Overlay} from './Overlay';

// 《坠落的序列》：各段都是整期时间轴上的窗口（offset = 本段在整期里的起点），段间天然无缝
export const DEOXYS_SEG: [string, number, number][] = [
	['Fall', 0, 400],
	['Helix', 400, 900],
	['Birth', 900, 1400],
	['Forms', 1400, 2065],
	['Meteorites', 2065, 2665],
	['Island', 2665, 3385],
	['Alarm', 3385, 3865],
	['Hoenn', 3865, 4205],
	['Delta', 4205, 4600],
	['Battle', 4600, 5230],
	['Shower', 5230, 5800],
	['Coda', 5800, 6120],
];
export const DEOXYS_TOTAL_FRAMES = 6120;

// 叫声（整期帧号）：代欧奇希斯首次登场 = 水晶体亮起；超级烈空坐升空；高潮（从陨石里现身）再放一次代欧奇希斯
const CRIES: [string, number, number][] = [
	['deoxys-normal', 1010, 0.85],
	['rayquaza-mega', 4095, 0.8],
	['deoxys-normal', 4475, 0.9],
];
// 内部整体平移到整期时间轴：BiSubtitle 等组件里的 useFrame() 直接拿到整期帧号
const WindowBody: React.FC<{offset: number; frames: number}> = ({offset, frames}) => {
	const frame = useFrame();
	// 只修第二、十段的边界帧；颗粒与字幕也复用同一时刻，其余分段不变。
	const f = (frame === 400 || frame === 4600) ? frame - 0.5 : frame === 899.5 ? 900 : frame;
	return (
		<>
			<GlyphWorld frame={f} />
			<Overlay f={f} />
			<Grain opacity={0.12} frameOffset={f - frame} />
			{CRIES.filter(([, at]) => at >= offset && at < offset + frames).map(([name, at, v]) => (
				<Cry key={name + at} name={name} at={at} volume={v} />
			))}
		</>
	);
};

const DeoxysWindow: React.FC<{offset: number; frames: number}> = ({offset, frames}) => (
	<AbsoluteFill style={{background: '#07070c'}}>
		<Sequence from={-toFrames(offset)} layout="none">
			<WindowBody offset={offset} frames={frames} />
		</Sequence>
	</AbsoluteFill>
);

export const DEOXYS_SEGMENTS = DEOXYS_SEG.map(([name, a, b]) => ({
	id: `DEOXYS-${name}`,
	component: () => <DeoxysWindow offset={a} frames={b - a} />,
	frames: b - a,
}));

export const DeoxysEpisode: React.FC = () => <DeoxysWindow offset={0} frames={DEOXYS_TOTAL_FRAMES} />;
