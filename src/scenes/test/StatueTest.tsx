import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill} from 'remotion';
import {StoneStatue} from '../../three/hisui/statue';
import {CameraRig} from '../../three/stage';

export const STATUE_TEST_FRAMES = 30;

/** 石像单独测试：两尊并排，侧前方打光 */
export const StatueTest: React.FC = () => (
	<AbsoluteFill style={{background: '#556'}}>
		<ThreeCanvas width={1920} height={1080}>
			<CameraRig pos={[0, 2.2, 9]} target={[0, 1.7, 0]} fov={40} />
			<ambientLight intensity={0.6} />
			<directionalLight position={[6, 8, 10]} intensity={2.5} />
			<StoneStatue dir="pokemon/wyrdeer" pos={[-2, 0, 0]} ry={0.3} height={3.3} opacity={1} />
			<StoneStatue dir="pokemon/kleavor" pos={[2, 0, 0]} ry={-0.3} height={3.3} opacity={1} />
		</ThreeCanvas>
	</AbsoluteFill>
);
