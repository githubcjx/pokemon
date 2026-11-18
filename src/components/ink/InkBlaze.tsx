import {AbsoluteFill} from 'remotion';
import {INK_BLAZE_FRAG} from '../../gl/inkBlaze';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {BASE_FPS, useFrame} from '../../time';

export type TowerBox = {x: number; top: number; base: number; hwBase: number; hwTop: number; tier0: number; tierStep: number};
export type Glow = {x: number; y: number; a: number};

const NONE: [number, number, number] = [0, 0, 0];

/** 水墨大火叠层：雷云、火舌、烟柱、水汽、火中微光（透明，叠在 3D 塔之上，屏幕坐标） */
export const InkBlaze: React.FC<{
	tower: TowerBox;
	fire: number;
	front: number;
	smoke: number;
	storm: number;
	steam: number;
	lights?: Glow[];
	lightR?: number;
	/** 时间偏移（30fps 帧）：分段接续时用整期时间轴 */
	timeOffset?: number;
}> = ({tower, fire, front, smoke, storm, steam, lights = [], lightR = 26, timeOffset = 0}) => {
	const frame = useFrame() + timeOffset;
	const L = (i: number): [number, number, number] => (lights[i] ? [lights[i].x, lights[i].y, lights[i].a] : NONE);
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<ShaderCanvas
				frag={INK_BLAZE_FRAG}
				width={1920}
				height={1080}
				uniforms={{
					uTime: frame / BASE_FPS,
					uCam: [960, 540, 1],
					uRoll: 0,
					uFloodC: [0, 0, 0],
					uClearC: [0, 0, 0],
					uGold: 0,
					uLight: 0,
					uBright: 1,
					uTower: [tower.x, tower.top, tower.base] as [number, number, number],
					uTowerW: tower.hwBase,
					uHwTop: tower.hwTop,
					uFire: fire,
					uFront: front,
					uSmoke: smoke,
					uStorm: storm,
					uSteam: steam,
					uL0: L(0),
					uL1: L(1),
					uL2: L(2),
					uLightR: lightR,
					uTiers: [tower.tier0, tower.tierStep],
				}}
			/>
		</AbsoluteFill>
	);
};
