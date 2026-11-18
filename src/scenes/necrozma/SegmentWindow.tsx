import {AbsoluteFill, Sequence} from 'remotion';
import {toFrames} from '../../time';
import {SEG_START, SegName} from './continuity';
import {NecrozmaMaster} from './Master';

/** 整期总时间轴上的一个窗口：从 seg 段开始放（各段、各部分、整期都用它） */
export const SegmentWindow: React.FC<{seg: SegName}> = ({seg}) => (
	<AbsoluteFill>
		<Sequence from={-toFrames(SEG_START[seg])}>
			<NecrozmaMaster />
		</Sequence>
	</AbsoluteFill>
);
