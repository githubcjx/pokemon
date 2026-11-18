import {Cam, project, unproject} from '../../camera';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {HOOK_SCENE_FRAMES, LAMP} from './continuity';
import {hookCam} from './HookScene';
import {Figure, onScreen} from './Oil';

/**
 * 第 2–3 段共用：三千年前的原野上，年轻的国王与他的母亲（代码画的剪影，没有官方形象）、花叶蒂。
 * 世界坐标 = 主体平面（k=1）。
 */

export const GROUND = 930;
export const KING = {x: 820, h: 430};
export const MOTHER = {x: 1085, h: 380};
/** 花叶蒂立绘的显示边长（世界单位；比真实比例大，镜头推近时才看得清） */
export const FLOETTE_SIZE = 116;

/** 第 2 段开头的原野机位 */
export const MEADOW_CAM0: Cam = {x: 1000, y: 560, zoom: 1, roll: 0};

/** 落日：放在第 1 段结尾那盏路灯在画面上的位置（k=0.05 层），路灯的光化成远古的太阳 */
const LAMP_END = project(hookCam(HOOK_SCENE_FRAMES), 1, LAMP);
const SUN_P = unproject(MEADOW_CAM0, 0.05, LAMP_END);
export const SUN: [number, number] = [SUN_P.x, SUN_P.y];
export const LAMP_SCREEN_END = LAMP_END;

/** 太阳在屏幕上的位置 */
export const sunOnScreen = (cam: Cam) => project(cam, 0.05, SUN_P);

type V3 = [number, number, number];

/**
 * 花叶蒂（油画化的官方立绘）。reveal：0 = 逆光剪影，1 = 完全显色。
 * 光从太阳那边来（背光 + 轮廓光），正面补一层暖色的环境光。
 */
export const FloetteArt: React.FC<{cam: Cam; p: {x: number; y: number}; reveal: number; time: number; desat?: number; opacity?: number; size?: number}> = ({
	cam,
	p,
	reveal,
	time,
	desat = 0,
	opacity = 1,
	size = FLOETTE_SIZE,
}) => {
	const sc = onScreen(cam, p);
	const sun = sunOnScreen(cam);
	const r = reveal;
	// 褪色时暖光变灰
	const warm = (c: V3): V3 => {
		const l = (c[0] + c[1] + c[2]) / 3;
		return c.map((v) => v + (l - v) * desat) as V3;
	};
	const amb = 0.004 + 0.78 * r;
	return (
		<PokemonArt3D
			dir="pokemon/floette"
			variant="-eternal"
			x={sc.x}
			y={sc.y}
			size={size * sc.s}
			yaw={Math.sin(time * 0.9) * 4}
			pitch={Math.sin(time * 0.7 + 1) * 2}
			depthScale={0.5}
			ambient={warm([amb * 1.05, amb * 0.92, amb * 0.8])}
			dirLights={[{dir: [0.7, -0.4, 0.35], color: warm([0.9 * r, 0.6 * r, 0.32 * r]), wrap: 0.5}]}
			rim={{dir: [sun.x - sc.x, sun.y - sc.y], color: warm([1.0, 0.62, 0.3]), power: 2.6}}
			oil={{amount: 1, radius: 0.0075, warm: 0.35}}
			opacity={opacity}
			resolution={1.6}
		/>
	);
};

/** 国王与母亲（剪影，朝向彼此；太阳在母亲身后偏右） */
export const PastFigures: React.FC<{cam: Cam; motherOpacity?: number; kingPose?: 'stand' | 'hold'; motherPose?: 'stand' | 'hold'; rim?: number; rimRgb?: string}> = ({
	cam,
	motherOpacity = 1,
	kingPose = 'hold',
	motherPose = 'hold',
	rim = 0.9,
	rimRgb = '255,190,110',
}) => {
	const king = onScreen(cam, {x: KING.x, y: GROUND});
	const mom = onScreen(cam, {x: MOTHER.x, y: GROUND});
	const sun = sunOnScreen(cam);
	return (
		<>
			{motherOpacity > 0 && (
				<Figure
					who="mother"
					pose={motherPose}
					x={mom.x}
					y={mom.y}
					h={MOTHER.h * mom.s}
					face="left"
					rimDir={[sun.x - mom.x, sun.y - (mom.y - MOTHER.h * mom.s * 0.7)]}
					rimRgb={rimRgb}
					rim={rim}
					opacity={motherOpacity}
				/>
			)}
			<Figure
				who="king"
				pose={kingPose}
				x={king.x}
				y={king.y}
				h={KING.h * king.s}
				face="right"
				rimDir={[sun.x - king.x, sun.y - (king.y - KING.h * king.s * 0.7)]}
				rimRgb={rimRgb}
				rim={rim}
			/>
		</>
	);
};
