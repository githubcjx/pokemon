import {AbsoluteFill, interpolate, random} from 'remotion';
import {Cam, project} from '../../camera';
import {CamLayer} from '../../components/CamLayer';
import {clamp} from '../../theme';
import {ACCENT, DragonVoid, HeroFigure, LandBg} from './Mono';

/**
 * 远古合众的舞台（第 2、3 段共用，保证两段交界处画面完全一致）：
 * 大地（着色器）+ 英雄站立的岩台 + 双子英雄剪影 + 城邦剪影 + 天上的空洞（那条龙）。
 * 世界坐标沿用 camera.ts：近景层 k = 1。
 */

/** 空洞在天空层（k = 0.25）上的世界位置与半径 */
export const VOID_W = {x: 960, y: 360, r: 126, k: 0.25};
/** 英雄：哥哥在左、弟弟在右，脚底在岩台上 */
export const HEROES = {elder: {x: 922}, younger: {x: 1000}, feet: 772, h: 150};
/** 近处平原的地面高度（与 LAND_FRAG 的 y3 一致，约 868） */
const PLAIN = 872;

export const voidScreen = (cam: Cam) => {
	const p = project(cam, VOID_W.k, VOID_W);
	const s = 1 + (cam.zoom - 1) * VOID_W.k;
	return {x: p.x, y: p.y, r: VOID_W.r * s};
};

// 岩台（英雄脚下）：一块突出的崖石，顶上一小片平台，两侧参差地向下张开，一直延伸到画面外
const OUTCROP = (() => {
	const top = HEROES.feet;
	const left: string[] = [];
	const right: string[] = [];
	const n = 14;
	for (let i = 0; i <= n; i++) {
		const k = i / n; // 0 顶 → 1 底
		const y = top + 4 + k * 230;
		const spread = 70 + Math.pow(k, 1.6) * 340;
		const jl = (random(`ol${i}`) - 0.5) * 26 * (0.3 + k);
		const jr = (random(`or${i}`) - 0.5) * 26 * (0.3 + k);
		left.push(`${(960 - spread + jl).toFixed(1)},${y.toFixed(1)}`);
		right.push(`${(960 + spread + jr).toFixed(1)},${y.toFixed(1)}`);
	}
	// 顶面：略有起伏的平台
	const ridge: string[] = [];
	for (let i = 0; i <= 8; i++) {
		const x = 890 + i * 17.5;
		ridge.push(`${x.toFixed(1)},${(top + (random(`ot${i}`) - 0.5) * 3 + (i === 0 || i === 8 ? 3 : 0)).toFixed(1)}`);
	}
	return `M${left.reverse().join(' L')} L${ridge.join(' L')} L${right.join(' L')} L1500,1500 L420,1500 Z`;
})();

// 城邦剪影：房屋、塔、城墙（世界坐标，底部埋进地面以下）
const BUILDINGS = Array.from({length: 16}, (_, i) => {
	const x = 1390 + i * 22 + random(`bx${i}`) * 14;
	const w = 18 + random(`bw${i}`) * 22;
	const tall = random(`bt${i}`);
	const h = tall > 0.86 ? 70 + random(`bh${i}`) * 30 : 22 + random(`bh${i}`) * 28;
	const roof = tall > 0.86 ? 'spire' : random(`br${i}`) > 0.5 ? 'gable' : 'flat';
	return {x, w, h, roof, delay: i * 3 + random(`bd${i}`) * 10, win: random(`bwn${i}`)};
});

const building = (b: (typeof BUILDINGS)[number]) => {
	const base = PLAIN;
	const top = base - b.h;
	const roofH = b.roof === 'spire' ? b.w * 1.4 : b.roof === 'gable' ? b.w * 0.45 : 0;
	return `M${b.x},${base + 60} L${b.x},${top} L${b.x + b.w / 2},${top - roofH} L${b.x + b.w},${top} L${b.x + b.w},${base + 60} Z`;
};

export type StageProps = {
	time: number;
	cam: Cam;
	dark?: number;
	sunAmt?: number;
	/** 天空分成左暖右蓝 */
	skySplit?: number;
	flick?: number;
	/** 城邦从地面升起 0–1 */
	town?: number;
	/** 城里的灯火 0–1 */
	lights?: number;
	/** 弟弟的朝向：1 = 与哥哥同向（朝右），-1 = 转身面对哥哥 */
	youngerFacing?: number;
	elderRim?: {rgb: string; amt: number};
	youngerRim?: {rgb: string; amt: number};
	void?: {split?: number; sep?: number; tear?: number; amt?: number; jitter?: number; dy?: number};
	/** 空洞（以及分开后的两团光）不画：由场景另行绘制 */
	hideVoid?: boolean;
	/** 弟弟单独的转身（第 4 段兄弟和好时，哥哥不动） */
	elderFacing?: number;
	/** 双子英雄的不透明度（第 4 段换成儿子们时淡出） */
	heroAlpha?: number;
	/** 近景层（k = 1）上另外加的东西，如儿子们的剪影 */
	children?: React.ReactNode;
};

export const Stage: React.FC<StageProps> = ({
	time,
	cam,
	dark = 0,
	sunAmt = 0.6,
	skySplit = 0,
	flick = 0,
	town = 0,
	lights = 0,
	youngerFacing = 1,
	elderRim = {rgb: '255,255,255', amt: 0.45},
	youngerRim = {rgb: '255,255,255', amt: 0.45},
	void: vd = {},
	hideVoid = false,
	elderFacing = 1,
	heroAlpha = 1,
	children,
}) => {
	const vs = voidScreen(cam);
	const jx = (vd.jitter ?? 0) * (Math.sin(time * 47) * 0.6 + Math.sin(time * 83) * 0.4);
	const s = 1 + (cam.zoom - 1) * VOID_W.k;
	const vy = vs.y + (vd.dy ?? 0) * s;
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<LandBg
				time={time}
				cam={cam}
				sun={[vs.x, vy]}
				sunAmt={sunAmt * (vd.amt ?? 1)}
				split={skySplit}
				splitX={vs.x}
				flick={flick}
				dark={dark}
			/>
			{!hideVoid && (
				<DragonVoid
					time={time}
					p={[vs.x + jx, vy]}
					r={vs.r}
					split={vd.split ?? 0}
					sep={(vd.sep ?? 0) * s}
					tear={vd.tear ?? 0}
					amt={(vd.amt ?? 1) * (1 - dark * 0)}
				/>
			)}
			<CamLayer cam={cam} k={1}>
				<svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible', opacity: 1 - dark}}>
					{/* 城邦 */}
					<g>
						{BUILDINGS.map((b, i) => {
							const g = interpolate(town * 60 - b.delay, [0, 18], [0, 1], clamp);
							return <path key={i} d={building(b)} fill="#030303" transform={`translate(0, ${(1 - g) * (b.h + 40)})`} />;
						})}
						{BUILDINGS.map((b, i) => {
							const g = interpolate(town * 60 - b.delay, [0, 18], [0, 1], clamp);
							if (g < 1 || b.win < 0.35) return null;
							const tw = 0.6 + 0.4 * Math.sin(time * 2.3 + i * 1.7);
							return (
								<rect
									key={`w${i}`}
									x={b.x + b.w * 0.35}
									y={PLAIN - b.h * 0.55}
									width={3.2}
									height={4.5}
									fill={`rgba(255,250,236,${lights * tw})`}
									style={{filter: 'drop-shadow(0 0 4px rgba(255,250,236,0.9))'}}
								/>
							);
						})}
						{/* 城墙 */}
						<path
							d={`M1380,${PLAIN + 80} L1380,${PLAIN - 10} L1760,${PLAIN - 10} L1760,${PLAIN + 80} Z`}
							fill="#030303"
							transform={`translate(0, ${(1 - interpolate(town, [0, 0.4], [0, 1], clamp)) * 30})`}
						/>
					</g>
					{/* 英雄脚下的岩台：上沿一线逆光 */}
					<path d={OUTCROP} fill="#020202" style={{filter: 'drop-shadow(0 -1px 1.5px rgba(255,255,255,0.35))'}} />
				</svg>
				<HeroFigure
					x={HEROES.elder.x}
					y={HEROES.feet}
					h={HEROES.h}
					facing={elderFacing}
					time={time}
					phase={0}
					rimRgb={elderRim.rgb}
					rim={elderRim.amt}
					opacity={(1 - dark) * heroAlpha}
				/>
				<HeroFigure
					x={HEROES.younger.x}
					y={HEROES.feet}
					h={HEROES.h}
					facing={youngerFacing}
					time={time}
					phase={1.3}
					rimRgb={youngerRim.rgb}
					rim={youngerRim.amt}
					opacity={(1 - dark) * heroAlpha}
				/>
				{children}
			</CamLayer>
		</AbsoluteFill>
	);
};

export {ACCENT};
