import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {PokemonArt3D, Rim} from '../../components/PokemonArt3D';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {CINZEL, SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {BEAMS_FRAG, ELEMENT_FRAG, LAND_FRAG, VOID_FRAG} from './gl';

type V3 = [number, number, number];
type V2 = [number, number];

/** 三种点睛色（线性近似值用于着色器，RGB 字符串用于 CSS） */
export const ACCENT = {
	warm: [1.0, 0.88, 0.74] as V3,
	warmRgb: '255,226,192',
	blue: [0.3, 0.64, 1.0] as V3,
	blueRgb: '79,168,255',
	ice: [0.62, 0.93, 1.0] as V3,
	iceRgb: '168,240,255',
};

/** 单只宝可梦的背景（逆光 + 白焰 / 雷云 / 冰雾） */
export const ElementBg: React.FC<{
	time: number;
	c?: V2;
	bg?: V3;
	glow?: V3;
	glowAmt?: number;
	glowR?: number;
	rays?: number;
	flame?: number;
	flameCol?: V3;
	frost?: number;
	frostCol?: V3;
	storm?: number;
	ink?: V3;
	flick?: number;
	style?: React.CSSProperties;
}> = ({
	time,
	c = [960, 540],
	bg = [0, 0, 0],
	glow = [1, 1, 1],
	glowAmt = 0,
	glowR = 0.3,
	rays = 0,
	flame = 0,
	flameCol = [1, 0.95, 0.86],
	frost = 0,
	frostCol = ACCENT.ice,
	storm = 0,
	ink = [0.1, 0.1, 0.11],
	flick = 0,
	style,
}) => (
	<AbsoluteFill style={style}>
		<ShaderCanvas
			frag={ELEMENT_FRAG}
			width={1920}
			height={1080}
			uniforms={{
				uTime: time,
				uC: c,
				uBg: bg,
				uGlow: glow,
				uGlowAmt: glowAmt,
				uGlowR: glowR,
				uRays: rays,
				uFlame: flame,
				uFlameCol: flameCol,
				uFrost: frost,
				uFrostCol: frostCol,
				uStorm: storm,
				uInk: ink,
				uFlick: flick,
			}}
		/>
	</AbsoluteFill>
);

/** 远古合众的大地（着色器内按 camera.ts 的景深换算做推拉与视差） */
export const LandBg: React.FC<{
	time: number;
	cam: {x: number; y: number; zoom: number};
	sun: V2;
	sunAmt?: number;
	split?: number;
	splitX?: number;
	flick?: number;
	hatch?: number;
	dark?: number;
}> = ({time, cam, sun, sunAmt = 0.6, split = 0, splitX = 960, flick = 0, hatch = 0, dark = 0}) => (
	<AbsoluteFill>
		<ShaderCanvas
			frag={LAND_FRAG}
			width={1920}
			height={1080}
			uniforms={{
				uTime: time,
				uCam: [cam.x, cam.y],
				uZoom: cam.zoom,
				uSun: sun,
				uSunAmt: sunAmt,
				uSplit: split,
				uSplitX: splitX,
				uWarm: ACCENT.warm,
				uBlue: ACCENT.blue,
				uFlick: flick,
				uHatch: hatch,
				uDark: dark,
			}}
		/>
	</AbsoluteFill>
);

/** 那条龙：黑白两色光交缠出的空洞（全屏透明叠层，坐标为屏幕像素） */
export const DragonVoid: React.FC<{
	time: number;
	p: V2;
	r: number;
	split?: number;
	sep?: number;
	tear?: number;
	amt?: number;
	/** 空壳：原处结冰的空环（第 5 段） */
	husk?: number;
}> = ({time, p, r, split = 0, sep = 0, tear = 0, amt = 1, husk = 0}) =>
	amt <= 0.001 ? null : (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<ShaderCanvas
				frag={VOID_FRAG}
				width={1920}
				height={1080}
				uniforms={{
					uTime: time,
					uP: p,
					uR: Math.max(r, 0.5),
					uSplit: split,
					uSep: sep,
					uTear: tear,
					uAmt: amt,
					uWarm: ACCENT.warm,
					uBlue: ACCENT.blue,
					uIce: ACCENT.ice,
					uHusk: husk,
				}}
			/>
		</AbsoluteFill>
	);

/** 双龙对撞的光束与光球 */
export const Beams: React.FC<{
	time: number;
	a: V2;
	b: V2;
	c: V2;
	pow: number;
	ball: number;
	shock?: number;
	dust?: number;
}> = ({time, a, b, c, pow, ball, shock = 0, dust = 1}) => (
	<AbsoluteFill>
		<ShaderCanvas
			frag={BEAMS_FRAG}
			width={1920}
			height={1080}
			uniforms={{
				uTime: time,
				uA: a,
				uB: b,
				uC: c,
				uPow: pow,
				uBall: ball,
				uShock: shock,
				uDust: dust,
				uWarm: ACCENT.warm,
				uBlue: ACCENT.blue,
			}}
		/>
	</AbsoluteFill>
);

// ─── 人物剪影（代码画的披风人形，人不是宝可梦）──────────────────────────
type P = [number, number];
/** Catmull-Rom → 三次贝塞尔，闭合平滑路径 */
export const smoothClosed = (pts: P[]) => {
	const n = pts.length;
	let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
	for (let i = 0; i < n; i++) {
		const p0 = pts[(i - 1 + n) % n];
		const p1 = pts[i];
		const p2 = pts[(i + 1) % n];
		const p3 = pts[(i + 2) % n];
		const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
		const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
		d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
	}
	return d + 'Z';
};

/** 披风人形（面朝右，脚底中点为原点，高 300）：头、颈、肩分明，披风向下张开；sway 为风吹披风的摆动 */
const heroPath = (sway: number) =>
	smoothClosed([
		[-56 + sway * 16, 0],
		[-50 + sway * 11, -58],
		[-43 + sway * 5, -124],
		[-38 + sway * 2, -184],
		[-36, -214],
		[-30, -230],
		[-16, -238],
		[-8, -244],
		[-13, -258],
		[-12, -276],
		[-2, -290],
		[11, -289],
		[18, -278],
		[20, -267],
		[24, -262],
		[19, -257],
		[17, -249],
		[9, -244],
		[20, -238],
		[30, -230],
		[33, -212],
		[30, -186],
		[34, -150],
		[38, -96],
		[46 + sway * 4, -34],
		[56 + sway * 7, 0],
	]);

/**
 * 英雄剪影：纯黑，外圈一层逆光（rimRgb）。
 * facing：1 面朝右，-1 面朝左；从一个朝向转到另一个时，用 facing 在 [-1, 1] 之间插值（经过 0 时像侧身转过来）。
 */
export const HeroFigure: React.FC<{
	x: number;
	y: number;
	h: number;
	facing?: number;
	rimRgb?: string;
	rim?: number;
	time: number;
	phase?: number;
	opacity?: number;
}> = ({x, y, h, facing = 1, rimRgb = '255,255,255', rim = 0.6, time, phase = 0, opacity = 1}) => {
	const k = h / 300;
	const sway = Math.sin(time * 1.7 + phase) * 0.6 + Math.sin(time * 3.1 + phase * 2) * 0.25;
	const sx = Math.abs(facing) < 0.12 ? 0.12 * Math.sign(facing || 1) : facing;
	return (
		<svg
			width={220 * k}
			height={330 * k}
			viewBox="-110 -315 220 330"
			style={{
				position: 'absolute',
				left: x - 110 * k,
				top: y - 315 * k,
				overflow: 'visible',
				opacity,
				filter: `drop-shadow(0 0 ${2 * k + 1}px rgba(${rimRgb},${rim})) drop-shadow(0 0 ${10 * k + 4}px rgba(${rimRgb},${rim * 0.55}))`,
			}}
		>
			<g transform={`scale(${sx},1)`}>
				<path d={heroPath(sway)} fill="#020202" />
			</g>
		</svg>
	);
};

/**
 * 宝可梦剪影 → 显色：reveal = 0 时全黑只剩轮廓光，1 时为原色立绘（只做亮度与轮廓光，不改立绘像素）。
 */
export const DragonArt: React.FC<{
	name: string;
	/** 立绘文件后缀，如 '-white'（焰白酋雷姆） */
	variant?: string;
	x: number;
	y: number;
	size: number;
	reveal: number;
	rim?: Rim;
	rimAfter?: number;
	yaw?: number;
	pitch?: number;
	opacity?: number;
	brightness?: number;
}> = ({name, variant, x, y, size, reveal, rim, rimAfter = 0.35, yaw = 0, pitch = 0, opacity = 1, brightness = 1}) => {
	const a = reveal;
	const rimK = interpolate(reveal, [0, 1], [1, rimAfter], clamp);
	return (
		<PokemonArt3D
			dir={`pokemon/${name}`}
			variant={variant}
			x={x}
			y={y}
			size={size}
			yaw={yaw}
			pitch={pitch}
			depthScale={0.5}
			ambient={[a, a, a]}
			rim={rim ? {...rim, color: rim.color.map((v) => v * rimK) as V3} : undefined}
			opacity={opacity}
			brightness={brightness}
			resolution={1.25}
		/>
	);
};

/** 开场钩子里的大字名字：点睛色光晕 */
export const HookName: React.FC<{zh: string; en: string; from: number; to: number; rgb: string; y?: number}> = ({
	zh,
	en,
	from,
	to,
	rgb,
	y = 880,
}) => {
	const frame = useFrame();
	if (frame < from || frame > to) return null;
	const o = interpolate(frame, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
	const sp = interpolate(frame, [from, to], [14, 22], clamp);
	const ys = interpolate(frame, [from, from + 10], [16, 0], {...clamp, easing: Easing.out(Easing.cubic)});
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				top: y + ys,
				textAlign: 'center',
				opacity: o,
			}}
		>
			<div
				style={{
					fontFamily: SERIF,
					fontWeight: 900,
					fontSize: 76,
					letterSpacing: sp,
					color: '#fff',
					textShadow: `0 0 18px rgba(${rgb},0.9), 0 0 44px rgba(${rgb},0.6), 0 3px 4px rgba(0,0,0,0.9)`,
				}}
			>
				{zh}
			</div>
			<div style={{fontFamily: CINZEL, fontSize: 24, letterSpacing: 18, color: `rgba(${rgb},0.95)`, marginTop: 4}}>{en}</div>
		</div>
	);
};

/** 全屏闪光（白闪 / 带色闪） */
export const Flash: React.FC<{at: number; len?: number; peak?: number; rgb?: string}> = ({at, len = 10, peak = 1, rgb = '255,255,255'}) => {
	const frame = useFrame();
	const t = frame - at;
	if (t < 0 || t > len) return null;
	const o = interpolate(t, [0, 1, len], [0, peak, 0], {...clamp, easing: Easing.out(Easing.quad)});
	return <AbsoluteFill style={{background: `rgb(${rgb})`, opacity: o, pointerEvents: 'none'}} />;
};

/** 本期标题（开场钩子之后出现；结尾不放标题） */
export const EpisodeTitle: React.FC<{from: number; to: number; y?: number}> = ({from, to, y = 800}) => {
	const frame = useFrame();
	if (frame < from || frame > to) return null;
	const o = interpolate(frame, [from, from + 22, to - 16, to], [0, 1, 1, 0], clamp);
	const sp = interpolate(frame, [from, to], [44, 28], {...clamp, easing: Easing.out(Easing.cubic)});
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top: y - 80, textAlign: 'center', opacity: o}}>
			<div
				style={{
					fontFamily: SERIF,
					fontWeight: 900,
					fontSize: 120,
					letterSpacing: sp,
					color: '#fff',
					textShadow: `0 0 26px rgba(${ACCENT.warmRgb},0.55), 0 0 60px rgba(${ACCENT.blueRgb},0.45), 0 4px 6px rgba(0,0,0,0.9)`,
				}}
			>
				真实与理想
			</div>
			<div style={{fontFamily: CINZEL, fontSize: 32, letterSpacing: 22, color: 'rgba(240,240,238,0.85)', marginTop: 10}}>TRUTH AND IDEALS</div>
		</div>
	);
};
