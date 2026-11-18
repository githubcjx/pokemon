import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, project, track} from '../../camera';
import {CamLayer} from '../../components/CamLayer';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {FX_OFF, P, riftUniforms, V4} from './common';
import {Backdrop, Crystal, Embers, fadeIn, fadeOut, win} from './fx';
import {FX_FRAG, PAGE_FRAG} from './gl';

/**
 * 阿罗拉的古书：开场（0–290）的烧焦书页与光谱扇；第 6 段（2785–3790）摊开的书页上，
 * 插图（官方立绘推算的墨线画）一幅幅显出来，最后整页从四周烧进来。
 */

const PAGE = {x: 960, y: 540, hw: 900, hh: 600};
const HEAD = {x: 1390, y: 262};
const SHARD = {x: 1565, y: 470};
const BEAM_FROM = {x: 560, y: -520};

export const pageUniforms = (o: {light: number; beam?: number; beamEnd?: P; ember: number; burn?: number; white?: number; ink?: V4; gold?: V4; text?: number}) => ({
	uPage: [PAGE.x, PAGE.y, PAGE.hw, PAGE.hh] as V4,
	uSpread: 1,
	uLight: o.light,
	uBeamA: [BEAM_FROM.x, BEAM_FROM.y, o.beamEnd?.x ?? 0, o.beamEnd?.y ?? 0] as V4,
	uBeamW: [70, o.beam ?? 0] as [number, number],
	uInk: o.ink ?? ([0, 0, 0, 0] as V4),
	uGoldP: o.gold ?? ([0, 0, 0, 0] as V4),
	uBurn: o.burn ?? 0,
	uEmber: o.ember,
	uWhite: o.white ?? 0,
	uText: o.text ?? 1,
});

/** 书页上的标题：光之掠夺者（印在纸上） */
const Heading: React.FC<{opacity?: number}> = ({opacity = 0.92}) => (
	<>
		<div
			style={{
				position: 'absolute',
				left: HEAD.x - 260,
				top: HEAD.y - 52,
				width: 520,
				textAlign: 'center',
				fontFamily: SERIF,
				fontWeight: 800,
				fontSize: 70,
				letterSpacing: 16,
				color: 'rgb(48,28,14)',
				filter: 'blur(0.4px)',
				opacity,
			}}
		>
			光之掠夺者
		</div>
		<div style={{position: 'absolute', left: HEAD.x - 220, top: HEAD.y + 46, width: 440, height: 3, background: 'rgb(60,36,18)', opacity: opacity * 0.65}} />
	</>
);

// ════════════════════════════════════════════════════════════════════════
// 开场：黑暗里的烧焦书页（0–290）
// ════════════════════════════════════════════════════════════════════════

const hookCam = (f: number): Cam => ({
	x: track(f, [
		[0, 1380],
		[150, 1440],
		[262, 1560, Easing.in(Easing.cubic)],
	]),
	y: track(f, [
		[0, 300],
		[150, 350],
		[262, -160, Easing.in(Easing.cubic)],
	]),
	zoom: track(f, [
		[0, 2.1],
		[150, 1.75],
		[262, 1.45],
	]),
	roll: 0,
});

const beamEnd = (f: number): P => ({
	x: interpolate(f, [20, 110, 150], [1120, HEAD.x, SHARD.x], clamp),
	y: interpolate(f, [20, 110, 150], [120, HEAD.y, SHARD.y], clamp),
});

export const ShotHookPage: React.FC<{f: number}> = ({f}) => {
	if (f > 290) return null;
	const cam = hookCam(f);
	const be = beamEnd(f);
	const beam = interpolate(f, [16, 40, 200, 240], [0, 1.25, 1.25, 0.4], clamp);
	const light = interpolate(f, [0, 30, 170, 250], [0.08, 0.14, 0.14, 0.04], clamp);
	const o = fadeOut(f, 226, 250);
	const sh = project(cam, 1, SHARD);
	const fanLen = interpolate(f, [150, 236], [0, 2800], {...clamp, easing: Easing.out(Easing.cubic)});
	const fanI = interpolate(f, [150, 168, 240, 288], [0, 1.1, 1.1, 0], clamp);
	const bs = project(cam, 1, BEAM_FROM);
	const bee = project(cam, 1, be);
	const glint = interpolate(f, [140, 152, 175], [0.2, 1, 0.7], clamp);
	const pu = pageUniforms({light, beam, beamEnd: be, ember: 0.9});
	return (
		<AbsoluteFill>
			<AbsoluteFill style={{opacity: o}}>
				<Backdrop frag={PAGE_FRAG} f={f} cam={cam} uniforms={{uMode: 0, ...pu}} />
				<CamLayer cam={cam} k={1} style={{mixBlendMode: 'multiply'}}>
					<Heading />
				</CamLayer>
				<CamLayer cam={cam} k={1}>
					<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
						<ellipse cx={SHARD.x + 6} cy={SHARD.y + 14} rx={36} ry={9} fill="rgba(20,12,6,0.55)" style={{filter: 'blur(4px)'}} />
						<Crystal x={SHARD.x} y={SHARD.y} size={30} rot={-18} seed="pageShard" glint={glint} edge="255,240,215" />
					</svg>
				</CamLayer>
				<Backdrop frag={PAGE_FRAG} f={f} cam={cam} uniforms={{uMode: 1, ...pu}} />
				<Embers f={f} opacity={0.75} />
			</AbsoluteFill>
			<Backdrop
				frag={FX_FRAG}
				f={f}
				cam={cam}
				blend="screen"
				uniforms={{
					...riftUniforms([]),
					...FX_OFF,
					uFan: [sh.x, sh.y, -1.32, 0.46],
					uFanL: [fanLen, fanI],
					uBeamS: [bs.x, bs.y, bee.x, bee.y],
					uBeamSW: [16 * cam.zoom, beam * 0.22 * o],
				}}
			/>
		</AbsoluteFill>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 第 6 段：阿罗拉的古书（2785–3790）
// ════════════════════════════════════════════════════════════════════════

const B0 = 2785;

const bookCam = (f: number): Cam => ({
	x: 960,
	y: track(f, [
		[B0, 520],
		[3400, 560],
		[3790, 600],
	]),
	zoom: track(f, [
		[B0, 0.9],
		[3300, 0.95],
		[3560, 0.97],
		[3790, 1.1, Easing.in(Easing.quad)],
	]),
	roll: 0,
});

/** 古书插图：官方立绘推算的墨线画（水墨模式纯墨），叠在纸上 */
const InkPlate: React.FC<{
	f: number;
	dir: string;
	variant?: string;
	x: number;
	y: number;
	size: number;
	reveal: number;
	opacity: number;
	mirror?: boolean;
	seed: number;
}> = ({f, dir, variant, x, y, size, reveal, opacity, mirror = false, seed}) => {
	if (opacity <= 0.01) return null;
	return (
		<AbsoluteFill style={{opacity, transform: mirror ? 'scaleX(-1)' : undefined, transformOrigin: `${x}px ${y}px`}}>
			<PokemonArt3D
				dir={dir}
				variant={variant}
				x={x}
				y={y}
				size={size}
				depthScale={0.4}
				resolution={1.4}
				ink={{silhouette: 1, reveal, paint: 1, color: 0, line: 0.95, halo: 0.25 * reveal, wash: 0.5, time: f / 30 + seed, center: [0.5, 0.45]}}
				style={{filter: 'sepia(0.55) saturate(0.8) contrast(1.15)'}}
			/>
		</AbsoluteFill>
	);
};

// 守护神不画成宝可梦：四个带颜色的光点（黄、粉、绿、蓝）
const GUARDS = [
	{x: 800, y: 950, c: '255,214,90'},
	{x: 870, y: 880, c: '255,140,190'},
	{x: 1050, y: 880, c: '130,220,120'},
	{x: 1120, y: 950, c: '110,180,255'},
];

/** 举起石头的年轻人（没有官方形象，墨画的剪影） */
const Youth: React.FC<{x: number; y: number; o: number; stone: number}> = ({x, y, o, stone}) => (
	<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: o}}>
		<g fill="rgb(44,26,14)">
			<ellipse cx={x} cy={y - 118} rx={13} ry={15} />
			<path d={`M ${x - 22} ${y - 98} Q ${x} ${y - 106} ${x + 22} ${y - 98} L ${x + 18} ${y - 30} L ${x + 26} ${y + 30} L ${x + 8} ${y + 30} L ${x} ${y - 10} L ${x - 8} ${y + 30} L ${x - 26} ${y + 30} L ${x - 18} ${y - 30} Z`} />
			<path d={`M ${x + 18} ${y - 92} L ${x + 34} ${y - 140} L ${x + 30} ${y - 176}`} stroke="rgb(44,26,14)" strokeWidth={9} strokeLinecap="round" fill="none" />
			<path d={`M ${x - 18} ${y - 92} L ${x - 30} ${y - 50}`} stroke="rgb(44,26,14)" strokeWidth={9} strokeLinecap="round" fill="none" />
		</g>
		<circle cx={x + 30} cy={y - 186} r={11} fill={`rgba(255,${200 + 40 * stone},${120 + 80 * stone},${0.6 + 0.4 * stone})`} style={{filter: `drop-shadow(0 0 ${6 + 18 * stone}px rgba(255,220,140,${stone}))`}} />
	</svg>
);

export const ShotBook: React.FC<{f: number}> = ({f}) => {
	if (f < B0 - 2 || f > 3792) return null;
	const cam = bookCam(f);
	const white = interpolate(f, [B0, B0 + 70], [1, 0], {...clamp, easing: Easing.out(Easing.quad)});
	const inkR = f < 3440 ? interpolate(f, [2880, 3010], [0, 1250], {...clamp, easing: Easing.out(Easing.cubic)}) : interpolate(f, [3440, 3540], [1250, 260], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const inkA = f < 3440 ? 0.85 : interpolate(f, [3440, 3540], [0.85, 0.2], clamp);
	const goldR = interpolate(f, [3372, 3450], [0, 1050], {...clamp, easing: Easing.out(Easing.cubic)});
	const goldA = interpolate(f, [3372, 3420, 3600, 3700], [0, 0.85, 0.6, 0.35], clamp);
	const burn = interpolate(f, [3560, 3760], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const ember = interpolate(f, [3560, 3620], [0.8, 1.7], clamp);
	const pu = pageUniforms({light: 1.0, ember, burn, white, ink: [860, 300, inkR, inkA], gold: [960, 900, goldR, goldA]});
	// 插图
	const necReveal = interpolate(f, [2858, 2905], [0, 1], clamp);
	const necO = f < 3440 ? fadeIn(f, 2850, 2862) : interpolate(f, [3440, 3530], [1, 0.25], clamp);
	const necY = interpolate(f, [3440, 3540], [330, 250], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const solO = win(f, 2998, 3200, 12, 50) + fadeIn(f, 3445, 3505) * 0.9;
	const lunO = win(f, 3008, 3300, 12, 55) + fadeIn(f, 3445, 3505) * 0.9;
	const dmO = win(f, 3150, 3505, 50, 60);
	const dwO = win(f, 3245, 3505, 55, 60);
	const youthO = fadeIn(f, 3350, 3380);
	const stone = interpolate(f, [3365, 3380, 3460], [0, 1, 0.7], clamp);
	return (
		<AbsoluteFill>
			<Backdrop frag={PAGE_FRAG} f={f} cam={cam} uniforms={{uMode: 0, ...pu}} />
			<CamLayer cam={cam} k={1} style={{mixBlendMode: 'multiply'}}>
				<Heading opacity={0.85} />
				{/* 天上的空洞（墨线） */}
				<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: necO}}>
					<ellipse cx={860} cy={necY - 210} rx={34} ry={92} fill="none" stroke="rgb(40,24,12)" strokeWidth={4} />
					<ellipse cx={860} cy={necY - 210} rx={18} ry={70} fill="rgba(40,24,12,0.25)" />
				</svg>
				<InkPlate f={f} dir="pokemon/necrozma" x={860} y={necY} size={420} reveal={necReveal} opacity={necO} seed={1} />
				<InkPlate f={f} dir="pokemon/solgaleo" x={500} y={700} size={500} reveal={interpolate(f, [3000, 3045], [0, 1], clamp)} opacity={Math.min(1, solO)} seed={2} />
				<InkPlate f={f} dir="pokemon/lunala" x={1420} y={690} size={540} reveal={interpolate(f, [3010, 3055], [0, 1], clamp)} opacity={Math.min(1, lunO)} seed={3} />
				<InkPlate f={f} dir="pokemon/necrozma" variant="-dusk" x={500} y={700} size={560} reveal={interpolate(f, [3150, 3200], [0, 1], clamp)} opacity={dmO} mirror seed={4} />
				<InkPlate f={f} dir="pokemon/necrozma" variant="-dawn" x={1420} y={690} size={600} reveal={interpolate(f, [3245, 3300], [0, 1], clamp)} opacity={dwO} seed={5} />
				<Youth x={960} y={1010} o={youthO} stone={stone} />
			</CamLayer>
			<CamLayer cam={cam} k={1}>
				{/* 守护神的光点 */}
				{GUARDS.map((g, i) => {
					const o = fadeIn(f, 3360 + i * 8, 3385 + i * 8) * (1 - burn);
					return (
						<div
							key={i}
							style={{
								position: 'absolute',
								left: g.x - 40,
								top: g.y - 40,
								width: 80,
								height: 80,
								borderRadius: '50%',
								opacity: o,
								background: `radial-gradient(circle, rgba(${g.c},0.95) 0%, rgba(${g.c},0.5) 25%, rgba(${g.c},0) 70%)`,
							}}
						/>
					);
				})}
			</CamLayer>
			<Backdrop frag={PAGE_FRAG} f={f} cam={cam} uniforms={{uMode: 1, ...pu}} />
			<Embers f={f} opacity={0.5 + 0.5 * burn} rise={1 + burn} />
		</AbsoluteFill>
	);
};
