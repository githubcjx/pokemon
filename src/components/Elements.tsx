import {AbsoluteFill} from 'remotion';
import {ShaderCanvas} from '../gl/ShaderCanvas';
import {ABYSS_FRAG, CLOUDS_FRAG, COAST_FRAG, LAVA_FRAG, MAGMA_CAVE_FRAG, PANGAEA_FRAG, PRIMORDIAL_FRAG, STORMSEA_FRAG, STRATO_FRAG} from '../gl/shaders';
import {BASE_FPS, useFrame} from '../time';

const W = 1920;
const H = 1080;

type Uniforms = Record<string, number | [number, number] | [number, number, number]>;

/** 全屏着色器背景，overscan 为画布相对画面的放大倍数（留出镜头移动的余量） */
const Backdrop: React.FC<{frag: string; uniforms: Uniforms; overscan: number}> = ({frag, uniforms, overscan}) => {
	const frame = useFrame();
	const cw = W * overscan;
	const ch = H * overscan;
	return (
		<AbsoluteFill>
			<ShaderCanvas
				frag={frag}
				width={cw}
				height={ch}
				style={{position: 'absolute', left: -(cw - W) / 2, top: -(ch - H) / 2}}
				uniforms={{uTime: frame / BASE_FPS, ...uniforms}}
			/>
		</AbsoluteFill>
	);
};

/** 熔岩大地 */
export const LavaField: React.FC<{horizon?: number; heat?: number; bright?: number; overscan?: number}> = ({
	horizon = 0.42,
	heat = 1,
	bright = 1,
	overscan = 1.3,
}) => <Backdrop frag={LAVA_FRAG} overscan={overscan} uniforms={{uHorizon: horizon, uHeat: heat, uBright: bright}} />;

/** 暴风雨海洋；flashX 为闪电在画面上的横向位置（0–1） */
export const StormSea: React.FC<{
	horizon?: number;
	storm?: number;
	flash?: number;
	flashX?: number;
	bright?: number;
	overscan?: number;
}> = ({horizon = 0.42, storm = 1, flash = 0, flashX = 0.7, bright = 1, overscan = 1.3}) => (
	<Backdrop
		frag={STORMSEA_FRAG}
		overscan={overscan}
		uniforms={{uHorizon: horizon, uStorm: storm, uFlash: flash, uFlashX: flashX, uBright: bright}}
	/>
);

export type CoastProps = {
	horizon?: number;
	/** 海岸线的横向位置（地面坐标），与 scroll 相等时海岸线正对画面中央 */
	front?: number;
	/** 镜头沿横向的平移（地面坐标） */
	scroll?: number;
	/** 镜头沿纵深的推进（地面坐标） */
	dolly?: number;
	sun?: number;
	rain?: number;
	flash?: number;
	flashX?: number;
	clash?: number;
	heat?: number;
	storm?: number;
	bright?: number;
	/** 熔岩冷却：0 = 炽热，1 = 冷却成黑色岩面 */
	cool?: number;
	/** 阳光光池 [中心 x, 中心 y（0–1，y 向下）, 半径]，半径为 0 时不生效 */
	pool?: [number, number, number];
	overscan?: number;
};

/** 海岸线航拍：左熔岩、右海洋，海岸线来回拉锯 */
export const Coast: React.FC<CoastProps> = ({
	horizon = 0.9,
	front = 0,
	scroll = 0,
	dolly = 0,
	sun = 0,
	rain = 0,
	flash = 0,
	flashX = 0.7,
	clash = 1,
	heat = 1,
	storm = 1,
	bright = 1,
	cool = 0,
	pool = [0.5, 0.5, 0],
	overscan = 1.3,
}) => (
	<Backdrop
		frag={COAST_FRAG}
		overscan={overscan}
		uniforms={{
			uHorizon: horizon,
			uFront: front,
			uScroll: scroll,
			uDolly: dolly,
			uSun: sun,
			uRain: rain,
			uFlash: flash,
			uFlashX: flashX,
			uClash: clash,
			uHeat: heat,
			uStorm: storm,
			uBright: bright,
			uCool: cool,
			uPool: pool,
		}}
	/>
);

/** 穿云：travel 每 +1 穿过一整轮云层；tint 0 = 风暴云内部，1 = 云顶金白 */
export const CloudTunnel: React.FC<{travel: number; tint?: number; flash?: number; bright?: number; overscan?: number}> = ({
	travel,
	tint = 0,
	flash = 0,
	bright = 1,
	overscan = 1.3,
}) => <Backdrop frag={CLOUDS_FRAG} overscan={overscan} uniforms={{uTravel: travel, uTint: tint, uFlash: flash, uBright: bright}} />;

/** 平流层：sun 为太阳位置（0–1，y 向下）；ripple / rippleAmt 为臭氧层辉光带上的涟漪 */
export const Stratosphere: React.FC<{
	sun?: [number, number];
	horizon?: number;
	curve?: number;
	ripple?: number;
	rippleAmt?: number;
	bright?: number;
	overscan?: number;
}> = ({sun = [0.2, 0.22], horizon = 0.3, curve = 0.08, ripple = 0.5, rippleAmt = 0, bright = 1, overscan = 1.3}) => (
	<Backdrop
		frag={STRATO_FRAG}
		overscan={overscan}
		uniforms={{uSun: sun, uHorizon: horizon, uCurve: curve, uRipple: ripple, uRippleAmt: rippleAmt, uBright: bright}}
	/>
);

/** 地底岩浆房：centerX 为构图中心（0–1），pulse 为呼吸亮度 0–1 */
export const MagmaCave: React.FC<{centerX?: number; pulse?: number; bright?: number; overscan?: number}> = ({
	centerX = 0.5,
	pulse = 0.5,
	bright = 1,
	overscan = 1.2,
}) => <Backdrop frag={MAGMA_CAVE_FRAG} overscan={overscan} uniforms={{uCenterX: centerX, uPulse: pulse, uBright: bright}} />;

/** 海沟深渊：centerX 为构图中心（0–1），caustic 为上方透下的焦散光强度 */
export const Abyss: React.FC<{centerX?: number; caustic?: number; bright?: number; overscan?: number}> = ({
	centerX = 0.5,
	caustic = 1,
	bright = 1,
	overscan = 1.2,
}) => <Backdrop frag={ABYSS_FRAG} overscan={overscan} uniforms={{uCenterX: centerX, uCaustic: caustic, uBright: bright}} />;

/** 古地图大陆：pull 为被拖动大陆的位移（地面坐标），scale 越大视野越"远" */
export const Pangaea: React.FC<{
	horizon?: number;
	scale?: number;
	offset?: [number, number];
	pull?: [number, number];
	grid?: number;
	bright?: number;
	overscan?: number;
}> = ({horizon = 0.8, scale = 1, offset = [0, 0], pull = [0, 0], grid = 1, bright = 1, overscan = 1.3}) => (
	<Backdrop
		frag={PANGAEA_FRAG}
		overscan={overscan}
		uniforms={{uHorizon: horizon, uScale: scale, uOffset: offset, uPull: pull, uGrid: grid, uBright: bright}}
	/>
);

/** 远古之海：light 为生命之光的位置（0–1，y 向下），glow 为光的强度 */
export const PrimordialSea: React.FC<{light?: [number, number]; glow?: number; bright?: number; overscan?: number}> = ({
	light = [0.5, 0.5],
	glow = 1,
	bright = 1,
	overscan = 1.2,
}) => <Backdrop frag={PRIMORDIAL_FRAG} overscan={overscan} uniforms={{uLight: light, uGlow: glow, uBright: bright}} />;
