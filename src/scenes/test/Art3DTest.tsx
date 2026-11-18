import {AbsoluteFill, Easing, Img, interpolate, staticFile} from 'remotion';
import {Cam, track} from '../../camera';
import {CamLayer, Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Grain} from '../../components/Grain';
import {ArtLighting, PokemonArt3D} from '../../components/PokemonArt3D';
import {SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// 2.5D 立绘测试：左 = 现状（平面立绘 + 外发光），右 = 深度网格 + 动态光
export const ART3D_TEST_FRAMES = 180;

const LIGHTNING = [96, 106];
const SIZE = 860;

const getCam = (frame: number): Cam => ({
	x: track(frame, [
		[0, 900],
		[180, 1020],
	]),
	y: 540,
	zoom: track(frame, [
		[0, 1],
		[180, 1.08],
	]),
	roll: 0,
});

/** 熔岩光的闪烁（确定性） */
const lavaFlicker = (f: number) => 0.82 + 0.1 * Math.sin(f * 0.37) + 0.06 * Math.sin(f * 1.13 + 2) + 0.04 * Math.sin(f * 2.71);

/** 两道闪电：瞬间亮起后快速衰减 */
const lightning = (f: number) =>
	LIGHTNING.reduce((acc, at, i) => {
		if (f < at) return acc;
		const t = f - at;
		return Math.max(acc, (i === 0 ? 1 : 0.7) * Math.exp(-t / 3.2));
	}, 0);

/** 两边共用的光照：左上主光、底部熔岩点光、右侧闪电、底部熔岩轮廓光 */
const lighting = (lava: number, flash: number): ArtLighting => ({
	depthScale: 0.5,
	ambient: [0.3, 0.27, 0.25],
	dirLights: [
		{dir: [-0.6, -0.8, 0.5], color: [0.75, 0.62, 0.5], wrap: 0.15},
		{dir: [1, -0.3, 0.15], color: [3.0 * flash, 3.2 * flash, 3.6 * flash], wrap: 0},
	],
	pointLights: [{pos: [0.05, 0.8, 0.25], color: [2.6 * lava, 0.9 * lava, 0.25 * lava], radius: 0.7}],
	rim: {dir: [0.3, 1], color: [1.5 * lava, 0.6 * lava, 0.15 * lava], power: 2},
});

const Backdrop: React.FC<{flash: number; lava: number}> = ({flash, lava}) => (
	<AbsoluteFill>
		<AbsoluteFill style={{background: 'radial-gradient(ellipse 80% 70% at 50% 40%, #2a170b 0%, #120904 60%, #070402 100%)'}} />
		<AbsoluteFill
			style={{
				background: `radial-gradient(ellipse 70% 35% at 50% 105%, rgba(255,110,30,${0.75 * lava}) 0%, rgba(160,40,10,${0.35 * lava}) 45%, transparent 75%)`,
			}}
		/>
		<AbsoluteFill style={{background: `rgba(170,200,255,${0.22 * flash})`}} />
	</AbsoluteFill>
);

/** 一个半屏：整幅 1920 的场景，裁出中间 960 宽 */
const Half: React.FC<{mode: 'flat' | '3d'; left: number; label: string}> = ({mode, left, label}) => {
	const frame = useFrame();
	const cam = getCam(frame);
	const lava = lavaFlicker(frame);
	const flash = lightning(frame);
	// 摄像机向右移动 → 看到主体右侧更多 → 主体右侧转向观众
	const yaw = interpolate(frame, [0, 180], [-7, 7], {...clamp, easing: Easing.inOut(Easing.sin)});
	const pitch = interpolate(frame, [0, 180], [3, 1], clamp);

	return (
		<div style={{position: 'absolute', left, top: 0, width: 960, height: 1080, overflow: 'hidden'}}>
			<div style={{position: 'absolute', left: -480, top: 0, width: 1920, height: 1080}}>
				<CamLayer cam={cam} k={0.3}>
					<Backdrop flash={flash} lava={lava} />
				</CamLayer>
				<CamLayer cam={cam} k={1}>
					{mode === '3d' ? (
						<PokemonArt3D
							dir="pokemon/groudon"
							variant="-primal"
							x={960}
							y={560}
							size={SIZE}
							yaw={yaw}
							pitch={pitch}
							{...lighting(lava, flash)}
						/>
					) : (
						<Img
							src={staticFile('pokemon/groudon/art-primal.png')}
							style={{
								position: 'absolute',
								left: 960 - SIZE / 2,
								top: 560 - SIZE / 2,
								width: SIZE,
								height: SIZE,
								filter: `brightness(${0.85 + 0.6 * flash}) drop-shadow(0 0 6px rgba(255,140,60,${0.5 * lava})) drop-shadow(0 0 30px rgba(255,100,30,${0.45 * lava}))`,
							}}
						/>
					)}
				</CamLayer>
				<DustMotes rgb="255,140,60" opacity={0.8} />
			</div>
			<div
				style={{
					position: 'absolute',
					top: 40,
					width: '100%',
					textAlign: 'center',
					fontFamily: SERIF,
					fontSize: 34,
					letterSpacing: 6,
					color: 'rgba(239,226,196,0.85)',
				}}
			>
				{label}
			</div>
		</div>
	);
};

export const Art3DTest: React.FC = () => (
	<AbsoluteFill style={{background: '#000'}}>
		<Half mode="flat" left={0} label="平面立绘（现状）" />
		<Half mode="3d" left={960} label="2.5D 深度 + 动态光" />
		<div style={{position: 'absolute', left: 959, top: 0, width: 2, height: 1080, background: 'rgba(230,196,122,0.5)'}} />
		<Vignette strength={0.5} />
		<Grain />
	</AbsoluteFill>
);

/** 单独全屏查看 2.5D 效果 */
export const Art3DTestSolo: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);
	const lava = lavaFlicker(frame);
	const flash = lightning(frame);
	const yaw = interpolate(frame, [0, 180], [-7, 7], {...clamp, easing: Easing.inOut(Easing.sin)});
	const pitch = interpolate(frame, [0, 180], [3, 1], clamp);
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<CamLayer cam={cam} k={0.3}>
				<Backdrop flash={flash} lava={lava} />
			</CamLayer>
			<CamLayer cam={cam} k={1}>
				<PokemonArt3D
					dir="pokemon/groudon"
					variant="-primal"
					x={960}
					y={560}
					size={1050}
					yaw={yaw}
					pitch={pitch}
					{...lighting(lava, flash)}
				/>
			</CamLayer>
			<DustMotes rgb="255,140,60" opacity={0.8} />
			<Vignette strength={0.6} />
			<Grain />
		</AbsoluteFill>
	);
};
