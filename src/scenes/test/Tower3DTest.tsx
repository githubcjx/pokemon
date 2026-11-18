import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, interpolate, Sequence} from 'remotion';
import {flow} from '../../camera';
import {Grain} from '../../components/Grain';
import {CloudBand, GoldClouds, GoldLeaf, NightSky} from '../../components/screen/GoldScreen';
import {AshField, Pagoda, PagodaRuin} from '../../three/Pagoda';
import {CameraRig, GoldLights, MoonLights, orbit} from '../../three/stage';
import {clamp} from '../../theme';
import {toFrames, useFrame} from '../../time';

// ─── 3D 塔测试片（330 帧 = 11 秒）────────────────────────────────────────────
// 镜头一：金屏风前的完整九重塔，金云遮住塔基，镜头环绕约 70° 并缓缓升高
// 金光一闪
// 镜头二：月夜里的烧焦塔废墟，从塔基边贴地仰拍，边绕边升，灰烬飘落、余烬明灭
export const TOWER3D_TEST_FRAMES = 330;

const CUT = 160;

// 远处与近处的霞：长短不一的胶囊错落叠成阶梯状的"すやり霞"
const BACK_BANDS: CloudBand[] = [
	{y: 180, x: -300, caps: [[0, 420, 44, 0], [160, 520, 52, 34], [560, 300, 40, 6], [760, 220, 34, 30]], speed: 0.22, k: 0.4},
	{y: 360, x: 1180, caps: [[0, 360, 40, 0], [-120, 300, 36, 30], [240, 480, 50, 22], [620, 200, 32, -4]], speed: -0.18, k: 0.55},
];
const FRONT_BANDS: CloudBand[] = [
	{
		y: 860,
		x: -260,
		caps: [[0, 760, 96, 0], [420, 900, 120, 58], [1150, 640, 90, 14], [1600, 760, 110, 62], [-180, 520, 80, 70]],
		speed: 0.35,
		k: 1.6,
	},
	{y: 1030, x: -520, caps: [[0, 1200, 150, 0], [900, 1300, 170, 30], [2050, 900, 140, -6]], speed: -0.28, k: 2.2},
];

const GoldShot: React.FC = () => {
	const f = useFrame();
	const deg = flow(f, [
		[0, -42],
		[CUT, 28],
	]);
	const radius = flow(f, [
		[0, 66],
		[CUT, 54],
	]);
	const height = flow(f, [
		[0, 6],
		[CUT, 30],
	]);
	const targetY = flow(f, [
		[0, 15],
		[CUT, 24],
	]);
	const dx = -deg * 9;
	const dy = height * 6;
	return (
		<AbsoluteFill>
			<GoldLeaf dx={dx * 0.25} dy={dy * 0.1} />
			<GoldClouds bands={BACK_BANDS} frame={f} dx={dx} dy={dy * 0.3} />
			<AbsoluteFill style={{filter: 'sepia(0.28) saturate(0.82) contrast(0.94) brightness(0.97)'}}>
				<ThreeCanvas width={1920} height={1080} shadows gl={{alpha: true, antialias: true}}>
					<CameraRig pos={orbit(deg, radius, height)} target={[0, targetY, 0]} fov={34} />
					<GoldLights />
					<Pagoda />
				</ThreeCanvas>
			</AbsoluteFill>
			<GoldClouds bands={FRONT_BANDS} frame={f} dx={dx} dy={dy * 0.4} />
		</AbsoluteFill>
	);
};

const RuinShot: React.FC = () => {
	const f = useFrame();
	const deg = flow(f, [
		[0, 205],
		[TOWER3D_TEST_FRAMES - CUT, 250],
	]);
	const radius = flow(f, [
		[0, 19],
		[TOWER3D_TEST_FRAMES - CUT, 15],
	]);
	const height = flow(f, [
		[0, 1.9],
		[TOWER3D_TEST_FRAMES - CUT, 5.2],
	]);
	const targetY = flow(f, [
		[0, 5.5],
		[TOWER3D_TEST_FRAMES - CUT, 4.6],
	]);
	const flicker = 0.75 + 0.25 * Math.sin(f * 0.31) * Math.sin(f * 0.13 + 1.7);
	return (
		<AbsoluteFill>
			<NightSky />
			<AbsoluteFill>
				<ThreeCanvas width={1920} height={1080} shadows gl={{alpha: true, antialias: true}}>
					<CameraRig pos={orbit(deg, radius, height)} target={[0, targetY, 0]} fov={42} />
					<MoonLights />
					<pointLight position={[0.5, 2.2, 0.3]} intensity={45 * flicker} distance={22} decay={2} color="#ff6a22" />
					<PagodaRuin frame={f} />
					<AshField frame={f} />
				</ThreeCanvas>
			</AbsoluteFill>
			{/* 暗角 */}
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 100% 85% at 50% 45%, transparent 55%, rgba(8,10,16,0.5) 100%)'}} />
		</AbsoluteFill>
	);
};

export const Tower3DTest: React.FC = () => {
	const f = useFrame();
	const flash = interpolate(f, [CUT - 12, CUT, CUT + 14], [0, 1, 0], clamp);
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Sequence durationInFrames={toFrames(CUT)}>
				<GoldShot />
			</Sequence>
			<Sequence from={toFrames(CUT)} durationInFrames={toFrames(TOWER3D_TEST_FRAMES - CUT)}>
				<RuinShot />
			</Sequence>
			<AbsoluteFill style={{background: '#fff3d6', opacity: flash, pointerEvents: 'none'}} />
			<Grain opacity={f < CUT ? 0.08 : 0.12} />
		</AbsoluteFill>
	);
};
