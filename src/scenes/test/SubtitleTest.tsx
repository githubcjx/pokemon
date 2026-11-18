import {AbsoluteFill} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';

export const SUBTITLE_TEST_FRAMES = 90;

const ZH = '往古来今谓之宙，四方上下谓之宇。';
const EN = 'The expanse from antiquity to eternity and the expanse to all sides, above, and below...';

/** 字幕对比：上半是旧样式（英文晚半拍、原字号），下半是《神奥之名》的样式（同时显现、字号 1.12） */
export const SubtitleTest: React.FC = () => (
	<AbsoluteFill style={{background: 'linear-gradient(#1d2433, #3b4252 60%, #8b8f99)'}}>
		<div style={{position: 'absolute', inset: 0, transform: 'translateY(-430px)'}}>
			<BiSubtitle zh={ZH} en={EN} from={0} to={200} speed={1.25} />
		</div>
		<BiSubtitle zh={ZH} en={EN} from={0} to={200} speed={1.25} sync scale={1.12} enStrong />
	</AbsoluteFill>
);
