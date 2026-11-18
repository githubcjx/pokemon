import {useThree} from '@react-three/fiber';
import {useMemo} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

// ─── 3D 场景的公共部件：镜头、环境反射、两套布光（金屏风 / 月夜废墟）────────────

export type V3 = [number, number, number];

export const SCREEN = {w: 1920, h: 1080};

export const CameraRig: React.FC<{pos: V3; target: V3; fov: number; far?: number}> = ({pos, target, fov, far = 600}) => {
	const {camera} = useThree();
	const cam = camera as THREE.PerspectiveCamera;
	cam.position.set(...pos);
	cam.fov = fov;
	cam.near = 0.3;
	cam.far = far;
	cam.updateProjectionMatrix();
	cam.lookAt(...target);
	return null;
};

/** 3D 点 → 画面像素坐标（与 CameraRig 用同一套参数），用来把 2D 光晕、字幕对齐到 3D 物体 */
export const projectToScreen = (pos: V3, target: V3, fov: number, p: V3, far = 600) => {
	const cam = new THREE.PerspectiveCamera(fov, SCREEN.w / SCREEN.h, 0.3, far);
	cam.position.set(...pos);
	cam.lookAt(...target);
	cam.updateMatrixWorld();
	const v = new THREE.Vector3(...p).project(cam);
	return {x: ((v.x + 1) / 2) * SCREEN.w, y: ((1 - v.y) / 2) * SCREEN.h, behind: v.z > 1};
};

/** 绕塔的机位：角度（度，0 = 正面 +z）、半径、高度 */
export const orbit = (deg: number, radius: number, height: number): V3 => {
	const a = (deg * Math.PI) / 180;
	return [Math.sin(a) * radius, height, Math.cos(a) * radius];
};

/** 室内环境贴图，只给金属（旧金、相轮）一点反射 */
export const Env: React.FC<{intensity: number}> = ({intensity}) => {
	const {gl, scene} = useThree();
	useMemo(() => {
		const pm = new THREE.PMREMGenerator(gl);
		scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
		pm.dispose();
	}, [gl, scene]);
	scene.environmentIntensity = intensity;
	return null;
};

/** 金屏风前的暖光（昔） */
export const GoldLights: React.FC<{fog?: string; fogNear?: number; fogFar?: number}> = ({fog = '#cfa862', fogNear = 110, fogFar = 260}) => (
	<>
		<Env intensity={0.35} />
		<fog attach="fog" args={[fog, fogNear, fogFar]} />
		<ambientLight intensity={0.4} color="#ffe2b8" />
		<hemisphereLight args={['#fbe6be', '#5a3a1c', 0.85]} />
		<directionalLight
			position={[38, 60, 30]}
			intensity={2.8}
			color="#ffdba0"
			castShadow
			shadow-mapSize={[4096, 4096]}
			shadow-camera-left={-24}
			shadow-camera-right={24}
			shadow-camera-top={52}
			shadow-camera-bottom={-6}
			shadow-camera-near={1}
			shadow-camera-far={160}
			shadow-bias={-0.0004}
			shadow-normalBias={0.03}
		/>
		<directionalLight position={[-35, 20, -30]} intensity={0.8} color="#ffc878" />
	</>
);

/**
 * 月夜废墟（今）：月光是主光（冷白、偏亮），加一层月光下的灰蓝薄雾与冷色环境光，
 * 背面一盏轮廓光勾出焦木的边；余烬的暖光由场景自己加。
 */
export const MoonLights: React.FC<{moonDir?: V3; fogFar?: number}> = ({moonDir = [-22, 40, -26], fogFar = 140}) => (
	<>
		<fog attach="fog" args={['#3a4352', 34, fogFar]} />
		<ambientLight intensity={0.55} color="#93a6c6" />
		<hemisphereLight args={['#9db0d0', '#2a2622', 0.85]} />
		<directionalLight
			position={moonDir}
			intensity={2.9}
			color="#c6d4ec"
			castShadow
			shadow-mapSize={[4096, 4096]}
			shadow-camera-left={-22}
			shadow-camera-right={22}
			shadow-camera-top={24}
			shadow-camera-bottom={-22}
			shadow-camera-near={1}
			shadow-camera-far={140}
			shadow-bias={-0.0005}
			shadow-normalBias={0.03}
		/>
		{/* 前侧补光：让朝向镜头的一面不至于死黑 */}
		<directionalLight position={[18, 12, 30]} intensity={0.6} color="#7f93b8" />
	</>
);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpColor = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;

/**
 * 可连续过渡的天气光（《烧焦塔的大火》第 3、4 段）：
 * storm = 0、day = 1 时与 GoldLights 完全一致；storm = 1 为风雨夜。fire / front 为西塔的火光。
 */
export const WeatherLights: React.FC<{storm: number; day: number; fire?: number; front?: number; fireX?: number}> = ({
	storm,
	day,
	fire = 0,
	front = 0,
	fireX = -28,
}) => {
	const s = storm;
	const stormDay = (base: number, k: number) => base + k * day;
	const fireTop = 41;
	const fireY = fireTop - front * fireTop * 0.5;
	return (
		<>
			<Env intensity={lerp(0.35, 0.2 * day, s)} />
			<fog attach="fog" args={[lerpColor('#d9c7a0', '#8f8574', s), 90, lerp(300, 320, s)]} />
			<ambientLight intensity={lerp(0.4, stormDay(0.3, 0.35), s)} color={lerpColor('#ffe2b8', '#d8cbb0', s)} />
			<hemisphereLight args={[lerpColor('#fbe6be', '#cfc3a8', s), lerpColor('#5a3a1c', '#3a2c1c', s), lerp(0.85, stormDay(0.35, 0.5), s)]} />
			<directionalLight
				position={[38, 60, 30]}
				intensity={lerp(2.8, stormDay(0.5, 1.6), s)}
				color={lerpColor('#ffdba0', '#f2dcb0', s)}
				castShadow
				shadow-mapSize={[4096, 4096]}
				shadow-camera-left={-24}
				shadow-camera-right={24}
				shadow-camera-top={52}
				shadow-camera-bottom={-6}
				shadow-camera-near={1}
				shadow-camera-far={160}
				shadow-bias={-0.0004}
				shadow-normalBias={0.03}
			/>
			<directionalLight position={[-35, 20, -30]} intensity={0.8 * (1 - s)} color="#ffc878" />
			{fire > 0 ? (
				<>
					<pointLight position={[fireX + 7, fireY, 8]} intensity={1600 * fire} distance={70} decay={2} color="#ff6a26" />
					<pointLight position={[fireX - 6, fireY * 0.6 + 4, 7]} intensity={900 * fire * front} distance={60} decay={2} color="#ff8a3a" />
				</>
			) : null}
		</>
	);
};

/** 两色之间插值（CSS 用） */
export const mixHex = lerpColor;
