import {AbsoluteFill, Sequence} from 'remotion';
import {toFrames} from '../../time';
import {PARTS, SEG_FRAMES, SEG_START, SegName, TOTAL_FRAMES} from './common';
import {TimeMaster} from './Master';

/** 整期总时间轴上的一个窗口：从 start 帧开始放（各段、各部分、整期都用它） */
const SegmentWindow: React.FC<{start: number}> = ({start}) => (
	<AbsoluteFill>
		<Sequence from={-toFrames(start)}>
			<TimeMaster />
		</Sequence>
	</AbsoluteFill>
);

const seg = (name: SegName) => {
	const C: React.FC = () => <SegmentWindow start={SEG_START[name]} />;
	return C;
};

/** 各段：合成 ID 为 TIME-<段名>（首字母大写） */
export const TIME_SEGMENTS = (Object.keys(SEG_START) as SegName[]).map((name) => ({
	id: `TIME-${name[0].toUpperCase()}${name.slice(1)}`,
	component: seg(name),
	frames: SEG_FRAMES[name],
}));

/** 交付的三个文件：上（第 1–3 段）、中（第 4–5 段）、下（第 6–7 段）；以及整期 */
export const TIME_PARTS = [
	...(Object.keys(PARTS) as (keyof typeof PARTS)[]).map((k, i) => {
		const [a, b] = PARTS[k];
		const C: React.FC = () => <SegmentWindow start={a} />;
		return {id: `TIME-Part${i + 1}`, component: C, frames: b - a};
	}),
	{id: 'TIME', component: (() => <SegmentWindow start={0} />) as React.FC, frames: TOTAL_FRAMES},
];
