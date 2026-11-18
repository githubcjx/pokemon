import {AbsoluteFill, Easing, Img, interpolate, staticFile} from 'remotion';
import {Cam, project} from '../../camera';
import {CINZEL, SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {CEMETERY_FRAG, CITY_FRAG, MEADOW_FRAG, PAINT_FRAG, ROOM_FRAG} from './gl';
import {PaintCanvas} from './PaintCanvas';

type V3 = [number, number, number];
type V2 = [number, number];

const camUniforms = (cam: Cam) => ({uCam: [cam.x, cam.y, cam.zoom] as V3, uRoll: cam.roll});

// ─── 远古卡洛斯的原野 ─────────────────────────────────────────────

export type MeadowLook = {
	skyTop: V3;
	skyHor: V3;
	sunCol: V3;
	sunAmt: number;
	hill1: V3;
	hill2: V3;
	field: V3;
	flowers: number;
	castle: number;
	smoke: number;
	fire: number;
	scorch: number;
	desat: number;
	tint: V3;
	dim: number;
	/** 天色发红（愤怒） */
	red: number;
	/** 积雪 / 土路 / 路旁墓石（第 6 段） */
	snow: number;
	road: number;
	stones: number;
};

/** 水晶花：近处的机器 / 远处的最终兵器（不传则不画） */
export type Crystal = {
	machine?: {x: number; y: number; size: number; glow: number};
	weapon?: {x: number; grow: number; open: number; charge: number; scale: number};
	beam?: number;
	rain?: number;
};

/** 落日下的远古卡洛斯（暖金） */
export const GOLDEN: MeadowLook = {
	skyTop: [0.36, 0.42, 0.62],
	skyHor: [1.0, 0.76, 0.48],
	sunCol: [1.0, 0.7, 0.36],
	sunAmt: 1,
	hill1: [0.56, 0.42, 0.44],
	hill2: [0.44, 0.38, 0.24],
	field: [0.56, 0.5, 0.22],
	flowers: 0.9,
	castle: 1,
	smoke: 0,
	fire: 0,
	scorch: 0,
	desat: 0,
	tint: [1, 1, 1],
	dim: 1,
	red: 0,
	snow: 0,
	road: 0,
	stones: 0,
};

/** 战火：天色昏暗、地平线起烟、画面褪成灰褐 */
export const WARTIME: MeadowLook = {
	...GOLDEN,
	skyTop: [0.24, 0.23, 0.25],
	skyHor: [0.6, 0.48, 0.4],
	sunCol: [0.9, 0.55, 0.32],
	sunAmt: 0.25,
	hill1: [0.36, 0.31, 0.32],
	hill2: [0.3, 0.27, 0.2],
	field: [0.42, 0.39, 0.22],
	smoke: 1,
	fire: 0.7,
	desat: 0.82,
	tint: [1.02, 0.97, 0.9],
	dim: 0.82,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** 两种画面之间插值（逐项） */
export const mixLook = (a: MeadowLook, b: MeadowLook, t: number): MeadowLook => {
	const out = {} as Record<string, number | V3>;
	for (const k of Object.keys(a) as (keyof MeadowLook)[]) {
		const va = a[k];
		const vb = b[k];
		out[k] = Array.isArray(va) ? lerp3(va as V3, vb as V3, t) : lerp(va as number, vb as number, t);
	}
	return out as unknown as MeadowLook;
};

/** 水晶花所在的屏幕矩形（细笔触区） */
const crystalFine = (cam: Cam, c: Crystal) => {
	const rect = (cx: number, top: number, bottom: number, halfW: number, k: number): [number, number, number, number] => {
		const a = project(cam, k, {x: cx - halfW, y: top});
		const b = project(cam, k, {x: cx + halfW, y: bottom});
		return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
	};
	const m = c.machine;
	const w = c.weapon;
	// 远处兵器的基座在中景山脊下 30（与着色器一致，ridgeMid 的近似高度取 640）
	return {
		uFine0: m && m.size > 0 ? rect(m.x, m.y - m.size * 1.15, m.y + 10, m.size * 0.6, 1) : ([0, 0, 0, 0] as [number, number, number, number]),
		uFine1: w && w.grow > 0 ? rect(w.x, 670 - w.scale * 1.15 * w.grow, 700, w.scale * 0.62, 0.45) : ([0, 0, 0, 0] as [number, number, number, number]),
	};
};

export const MeadowBg: React.FC<{time: number; cam: Cam; sun: V2; look: MeadowLook; crystal?: Crystal; opacity?: number}> = ({time, cam, sun, look, crystal = {}, opacity = 1}) => (
	<AbsoluteFill style={{opacity}}>
		<PaintCanvas
			scene={MEADOW_FRAG}
			paint={PAINT_FRAG}
			uniforms={{
				uTime: time,
				...camUniforms(cam),
				uBrush: 1,
				uSun: sun,
				uSkyTop: look.skyTop,
				uSkyHor: look.skyHor,
				uSunCol: look.sunCol,
				uSunAmt: look.sunAmt,
				uHill1: look.hill1,
				uHill2: look.hill2,
				uField: look.field,
				uFlowers: look.flowers,
				uCastle: look.castle,
				uSmoke: look.smoke,
				uFire: look.fire,
				uScorch: look.scorch,
				uDesat: look.desat,
				uTint: look.tint,
				uDim: look.dim,
				uRed: look.red,
				uSnow: look.snow,
				uRoad: look.road,
				uStones: look.stones,
				uMach: crystal.machine ? [crystal.machine.x, crystal.machine.y, crystal.machine.size, crystal.machine.glow] : [0, 0, 0, 0],
				uWeap: crystal.weapon ? [crystal.weapon.x, crystal.weapon.grow, crystal.weapon.open, crystal.weapon.charge] : [0, 0, 0, 0],
				uWScale: crystal.weapon?.scale ?? 400,
				uBeam: crystal.beam ?? 0,
				uRain: crystal.rain ?? 0,
				...crystalFine(cam, crystal),
			}}
		/>
	</AbsoluteFill>
);

// ─── 今天的密阿雷 ─────────────────────────────────────────────────

export const CityBg: React.FC<{time: number; cam: Cam; night?: number; lamp?: number; desat?: number; tint?: V3; opacity?: number}> = ({
	time,
	cam,
	night = 1,
	lamp = 1,
	desat = 0,
	tint = [1, 1, 1],
	opacity = 1,
}) => (
	<AbsoluteFill style={{opacity}}>
		<PaintCanvas
			scene={CITY_FRAG}
			paint={PAINT_FRAG}
			uniforms={{uTime: time, ...camUniforms(cam), uBrush: 1, uNight: night, uLamp: lamp, uDesat: desat, uTint: tint}}
		/>
	</AbsoluteFill>
);

// ─── 旅馆 Z 的客厅 / 安息墓地 ──────────────────────────────────────

export const RoomBg: React.FC<{time: number; cam: Cam; lampP: V2; lamp?: number; dim?: number; opacity?: number}> = ({time, cam, lampP, lamp = 1, dim = 1, opacity = 1}) => (
	<AbsoluteFill style={{opacity}}>
		<PaintCanvas scene={ROOM_FRAG} paint={PAINT_FRAG} uniforms={{uTime: time, ...camUniforms(cam), uBrush: 0.8, uNight: 1, uLamp: 1, uDesat: 0, uTint: [1, 1, 1], uLampAmt: lamp, uLampP: lampP, uDim: dim}} />
	</AbsoluteFill>
);

export const CemeteryBg: React.FC<{time: number; cam: Cam; sun: V2; dim?: number; opacity?: number}> = ({time, cam, sun, dim = 1, opacity = 1}) => (
	<AbsoluteFill style={{opacity}}>
		<PaintCanvas scene={CEMETERY_FRAG} paint={PAINT_FRAG} uniforms={{uTime: time, ...camUniforms(cam), uBrush: 1, uNight: 0, uLamp: 0, uDesat: 0, uTint: [1, 1, 1], uSunM: sun, uDim: dim}} />
	</AbsoluteFill>
);

/**
 * 有官方形象的人物（超Z队）投在墙上的影子：官方立绘压成剪影、柔化，不画细节。
 * x：水平中心，y：脚底，h：身高（像素）。
 */
export const WallShadow: React.FC<{src: string; w: number; h: number; x: number; y: number; height: number; opacity: number; blur?: number; skew?: number}> = ({src, w, h, x, y, height, opacity, blur = 9, skew = 0}) => {
	const ww = (height * w) / h;
	return (
		<div style={{position: 'absolute', left: x - ww / 2, top: y - height, width: ww, height, opacity, transform: `skewX(${skew}deg)`, transformOrigin: '50% 100%', mixBlendMode: 'multiply'}}>
			<Img src={staticFile(src)} style={{width: ww, height, filter: `brightness(0) blur(${blur}px) opacity(0.4)`}} />
		</div>
	);
};

/** 暖色 / 冷色的光晕叠层（屏幕空间） */
export const Glow: React.FC<{x: number; y: number; r: number; rgb: string; amt: number; blend?: 'screen' | 'normal'}> = ({x, y, r, rgb, amt, blend = 'screen'}) =>
	amt <= 0 ? null : (
		<AbsoluteFill
			style={{
				mixBlendMode: blend,
				pointerEvents: 'none',
				background: `radial-gradient(circle at ${x}px ${y}px, rgba(${rgb},${Math.min(1, amt)}) 0%, rgba(${rgb},${Math.min(1, amt) * 0.45}) ${r * 0.35}px, rgba(${rgb},0) ${r}px)`,
			}}
		/>
	);

// ─── 人物剪影（没有官方形象的人物：年轻的国王ＡＺ、他的母亲）──────────────

/** 世界坐标（主体平面）→ 屏幕坐标与缩放 */
export const onScreen = (cam: Cam, p: {x: number; y: number}) => ({...project(cam, 1, p), s: cam.zoom});

type Pose = 'stand' | 'hold';

/** 剪影的各个部件（朝右，脚底在 (0, 300)，身高 300 单位，约八头身） */
const KING_PARTS = (pose: Pose) => [
	// 斗篷：从肩头垂下，背后略向外摆
	'M -21 49 C -10 42, 12 42, 21 50 C 25 56, 24 64, 21 74 C 23 112, 25 170, 30 300 L -46 300 C -40 230, -34 150, -29 100 C -28 80, -28 62, -21 49 Z',
	// 垂到背后的长发
	'M -5 12 C -10 14, -13 24, -13 38 C -13 56, -17 74, -14 90 C -8 80, -6 60, -4 44 Z',
	// 脖子
	'M -1 28 L 9 28 L 10 44 L -2 44 Z',
	...(pose === 'hold'
		? [
				'M 12 50 C 20 52, 24 66, 24 88 L 16 90 C 15 74, 12 64, 8 58 Z',
				'M 17 82 C 28 80, 40 76, 50 72 L 52 80 C 42 84, 30 90, 20 92 Z',
			]
		: ['M 12 50 C 20 56, 22 90, 22 130 L 15 131 C 14 100, 12 74, 8 60 Z']),
];
const KING_ELLIPSES = (pose: Pose): [number, number, number, number][] => [
	[4, 20, 11, 14],
	pose === 'hold' ? [52, 76, 7, 5] : [19, 136, 5, 7],
];

/** 母亲：兜帽垂到肩背，长裙，比国王矮 */
const MOTHER_PARTS = (pose: Pose) => [
	'M -14 46 C -4 42, 10 42, 16 48 C 18 60, 16 72, 14 84 C 18 140, 26 220, 36 300 L -38 300 C -32 230, -24 150, -20 100 C -20 80, -20 60, -14 46 Z',
	'M -12 30 C -14 12, -2 4, 8 8 C 14 10, 16 18, 14 26 C 13 30, 14 36, 18 44 L -16 72 C -19 58, -14 42, -12 30 Z',
	...(pose === 'hold'
		? ['M 10 52 C 18 54, 22 68, 22 88 L 14 90 C 13 74, 10 64, 6 58 Z', 'M 15 82 C 25 80, 36 77, 45 74 L 47 82 C 38 85, 27 90, 18 92 Z']
		: ['M 10 52 C 18 58, 20 92, 20 128 L 13 129 C 12 98, 10 74, 6 60 Z']),
];
const MOTHER_ELLIPSES = (pose: Pose): [number, number, number, number][] => [
	[5, 22, 9, 11],
	pose === 'hold' ? [47, 78, 6, 4.5] : [17, 133, 4.5, 6.5],
];

/**
 * 代码画的人物剪影。x / y：脚底的屏幕坐标；h：身高（像素）；face：朝向。
 * 逆光：朝光源一侧（rimDir，屏幕方向）的边缘亮起一道暖光，外面再罩一层柔光。
 */
export const Figure: React.FC<{
	who: 'king' | 'mother';
	pose?: Pose;
	x: number;
	y: number;
	h: number;
	face?: 'right' | 'left';
	rimRgb?: string;
	rim?: number;
	rimDir?: V2;
	fill?: string;
	opacity?: number;
	/** 手的位置回调用：返回手在屏幕上的坐标 */
	id?: string;
}> = ({who, pose = 'stand', x, y, h, face = 'right', rimRgb = '255,196,120', rim = 0.9, rimDir = [1, -0.4], fill = '#120c09', opacity = 1, id = who}) => {
	const parts = who === 'king' ? KING_PARTS(pose) : MOTHER_PARTS(pose);
	const ells = who === 'king' ? KING_ELLIPSES(pose) : MOTHER_ELLIPSES(pose);
	const k = h / 300;
	const fx = face === 'right' ? 1 : -1;
	// 轮廓光的偏移：在剪影的局部坐标里朝光源方向（翻转时 x 取反）
	const len = Math.hypot(rimDir[0], rimDir[1]) || 1;
	const ox = ((rimDir[0] / len) * 3.2 * fx) / k;
	const oy = ((rimDir[1] / len) * 3.2) / k;
	const shape = (color: string) => (
		<>
			{parts.map((d, i) => (
				<path key={i} d={d} fill={color} />
			))}
			{ells.map(([cx, cy, rx, ry], i) => (
				<ellipse key={`e${i}`} cx={cx} cy={cy} rx={rx} ry={ry} fill={color} />
			))}
		</>
	);
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity, pointerEvents: 'none'}}>
			<defs>
				<filter id={`rough-${id}`} x="-20%" y="-20%" width="140%" height="140%">
					<feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={2} seed={who === 'king' ? 3 : 7} />
					<feDisplacementMap in="SourceGraphic" scale={2.4} />
				</filter>
				<filter id={`soft-${id}`} x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation={1.4 / k} />
				</filter>
				<filter id={`halo-${id}`} x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation={9 / k} />
				</filter>
			</defs>
			<g transform={`translate(${x}, ${y}) scale(${k * fx}, ${k}) translate(0, -300)`} filter={`url(#rough-${id})`}>
				{/* 外圈柔光 */}
				<g transform={`translate(${ox * 1.5}, ${oy * 1.5})`} filter={`url(#halo-${id})`} opacity={rim * 0.55}>
					{shape(`rgb(${rimRgb})`)}
				</g>
				{/* 边缘轮廓光 */}
				<g transform={`translate(${ox}, ${oy})`} filter={`url(#soft-${id})`} opacity={rim}>
					{shape(`rgb(${rimRgb})`)}
				</g>
				{shape(fill)}
			</g>
		</svg>
	);
};

/** 剪影的手在屏幕上的位置（pose = hold 时捧在胸前的手） */
export const handOf = (who: 'king' | 'mother', x: number, y: number, h: number, face: 'right' | 'left' = 'right') => {
	const [hx, hy] = who === 'king' ? [52, 76] : [47, 78];
	const k = h / 300;
	const fx = face === 'right' ? 1 : -1;
	return {x: x + hx * k * fx, y: y + (hy - 300) * k};
};

/** 小小的木箱（第 3 段：他只得到了一个小小的箱子） */
export const TinyBox: React.FC<{x: number; y: number; w: number; opacity?: number; rimRgb?: string; rim?: number}> = ({x, y, w, opacity = 1, rimRgb = '220,200,180', rim = 0.4}) => {
	const h = w * 0.62;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity, pointerEvents: 'none'}}>
			<g transform={`translate(${x - w / 2}, ${y - h})`} style={{filter: `drop-shadow(${w * 0.02}px ${-w * 0.02}px ${w * 0.04}px rgba(${rimRgb},${rim}))`}}>
				<rect x={0} y={h * 0.24} width={w} height={h * 0.76} rx={w * 0.02} fill="#2a1f18" />
				<rect x={-w * 0.03} y={0} width={w * 1.06} height={h * 0.28} rx={w * 0.02} fill="#3a2b21" />
				<line x1={0} y1={h * 0.28} x2={w} y2={h * 0.28} stroke="rgba(0,0,0,0.6)" strokeWidth={w * 0.015} />
				<rect x={w * 0.45} y={h * 0.2} width={w * 0.1} height={h * 0.16} fill="#5a4636" />
			</g>
		</svg>
	);
};

// ─── 标题 ────────────────────────────────────────────────────────

export const EpisodeTitle: React.FC<{from: number; to: number; y?: number}> = ({from, to, y = 540}) => {
	const frame = useFrame();
	if (frame < from || frame > to) return null;
	const o = interpolate(frame, [from, from + 24, to - 18, to], [0, 1, 1, 0], clamp);
	const sp = interpolate(frame, [from, to], [40, 26], {...clamp, easing: Easing.out(Easing.cubic)});
	const enO = interpolate(frame, [from + 16, from + 40], [0, 1], clamp);
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top: y - 100, textAlign: 'center', opacity: o}}>
			<div
				style={{
					fontFamily: SERIF,
					fontWeight: 800,
					fontSize: 124,
					letterSpacing: sp,
					paddingLeft: sp,
					color: '#fff3dc',
					textShadow: '0 0 30px rgba(255,190,110,0.55), 0 0 80px rgba(255,160,80,0.3), 0 4px 8px rgba(10,6,4,0.9)',
				}}
			>
				永恒之花
			</div>
			<div style={{fontFamily: CINZEL, fontSize: 32, letterSpacing: 20, paddingLeft: 20, color: 'rgba(255,236,206,0.85)', marginTop: 12, opacity: enO, textShadow: '0 2px 6px rgba(10,6,4,0.9)'}}>
				ETERNAL FLOWER
			</div>
		</div>
	);
};
