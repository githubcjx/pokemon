import {AbsoluteFill, Sequence} from 'remotion';
import {toFrames} from '../../time';
import {SEG_FRAMES, SEG_START, SegName} from './common';
import {HisuiMaster} from './Master';

/** 整期总时间轴上的一个窗口：从 start 帧开始放 */
const SegmentWindow: React.FC<{start: number}> = ({start}) => (
	<AbsoluteFill>
		<Sequence from={-toFrames(start)}>
			<HisuiMaster />
		</Sequence>
	</AbsoluteFill>
);

const seg = (name: SegName) => {
	const C: React.FC = () => <SegmentWindow start={SEG_START[name]} />;
	return C;
};

/** 各段：合成 ID 为 HISUI-<段名>（首字母大写） */
export const HISUI_SEGMENTS = (Object.keys(SEG_START) as SegName[]).map((name) => ({
	id: `HISUI-${name[0].toUpperCase()}${name.slice(1)}`,
	component: seg(name),
	frames: SEG_FRAMES[name],
}));
