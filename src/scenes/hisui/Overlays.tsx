import {Img, interpolate, staticFile} from 'remotion';
import {Person, Pose} from '../../components/unown/Silhouette';
import {CINZEL, SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {projectToScreen, V3} from '../../three/stage';

// ─── 《神奥之名》画面上的 2D 层：剪影、市镇的灯、片名与篇章卡 ───────────────────
// 位置都由 3D 点按同一个相机投影到画面上（projectToScreen），和 3D 场景对齐。

export type View = {pos: V3; target: V3; fov: number};

/** 3D 点投到画面；s 为该处 1 米对应的像素 */
export const toScreen = (v: View, p: V3) => {
	// far 放到 3000：第 2 段的天冠山在六百多米外
	const a = projectToScreen(v.pos, v.target, v.fov, p, 3000);
	const b = projectToScreen(v.pos, v.target, v.fov, [p[0], p[1] + 1, p[2]], 3000);
	return {x: a.x, y: a.y, s: Math.abs(a.y - b.y), behind: a.behind};
};

/** 立绘尺寸（public/ 下的 png，用来按高度换算宽度） */
const ART: Record<string, {src: string; w: number; h: number}> = {
	cyrus: {src: 'trainers/cyrus/dp.png', w: 629, h: 1600},
	wyrdeer: {src: 'pokemon/wyrdeer/art.png', w: 1600, h: 1600},
	ursaluna: {src: 'pokemon/ursaluna/art.png', w: 520, h: 520},
	basculegion: {src: 'pokemon/basculegion/art.png', w: 585, h: 585},
	'electrode-hisui': {src: 'pokemon/electrode-hisui/art.png', w: 390, h: 390},
	'braviary-hisui': {src: 'pokemon/braviary-hisui/art.png', w: 1600, h: 1600},
	kleavor: {src: 'pokemon/kleavor/art.png', w: 1600, h: 1600},
	'lilligant-hisui': {src: 'pokemon/lilligant-hisui/art.png', w: 490, h: 490},
	'arcanine-hisui': {src: 'pokemon/arcanine-hisui/art.png', w: 546, h: 546},
	sneasler: {src: 'pokemon/sneasler/art.png', w: 512, h: 512},
	'avalugg-hisui': {src: 'pokemon/avalugg-hisui/art.png', w: 451, h: 451},
};

/**
 * 官方立绘压成的黑色剪影（宝可梦、有官方形象的人物）：脚底在 3D 点 foot，屏幕上高 h 米（按投影换算）。
 * 立绘是方形画布，宝可梦不一定占满，高度按整张画布算。rim：轮廓微光。
 */
export const ArtSil: React.FC<{v: View; who: string; foot: V3; h: number; rimRgb: string; rim: number; opacity: number; flip?: boolean}> = ({v, who, foot, h, rimRgb, rim, opacity, flip}) => {
	if (opacity <= 0.001) return null;
	const a = ART[who];
	const p = toScreen(v, foot);
	if (p.behind) return null;
	const hp = h * p.s;
	const wp = (hp * a.w) / a.h;
	const k = hp / 300;
	return (
		<Img
			src={staticFile(a.src)}
			style={{
				position: 'absolute',
				left: p.x - wp / 2,
				top: p.y - hp,
				width: wp,
				height: hp,
				opacity,
				transform: flip ? 'scaleX(-1)' : undefined,
				filter: `brightness(0) drop-shadow(0 0 ${1.5 * k + 1}px rgba(${rimRgb},${rim})) drop-shadow(0 0 ${8 * k + 3}px rgba(${rimRgb},${rim * 0.5}))`,
			}}
		/>
	);
};

/** 没有官方形象的人（古人）：代码画的剪影，脚底在 3D 点 foot，身高 1.7 米 */
export const Folk: React.FC<{v: View; foot: V3; pose: Pose; t?: number; flip?: boolean; rimDir?: [number, number]; rimColor?: string; rim?: number; opacity?: number}> = ({
	v,
	foot,
	pose,
	t = 0,
	flip,
	rimDir = [0, -1],
	rimColor = '#ffd38a',
	rim = 0.75,
	opacity = 1,
}) => {
	if (opacity <= 0.001) return null;
	const p = toScreen(v, foot);
	if (p.behind) return null;
	return <Person x={p.x} y={p.y} height={1.7 * p.s} pose={pose} t={t} flip={flip} rimDir={rimDir} rimColor={rimColor} rim={rim} opacity={opacity} />;
};

/** 一点暖光（3D 点处的光晕），市镇的灯、远处的火 */
export const Glow: React.FC<{v: View; p: V3; r: number; rgb: string; a: number}> = ({v, p, r, rgb, a}) => {
	if (a <= 0.003) return null;
	const s = toScreen(v, p);
	if (s.behind) return null;
	return (
		<div
			style={{
				position: 'absolute',
				left: s.x - r,
				top: s.y - r,
				width: r * 2,
				height: r * 2,
				borderRadius: '50%',
				background: `radial-gradient(circle, rgba(255,250,235,${a}) 0%, rgba(${rgb},${a * 0.8}) 18%, rgba(${rgb},${a * 0.22}) 45%, rgba(${rgb},0) 72%)`,
				mixBlendMode: 'screen',
			}}
		/>
	);
};

/** 片名《神奥之名》：字从星空里亮起，下面一行英文 */
export const TitleCard: React.FC<{f: number; from: number; to: number}> = ({f, from, to}) => {
	if (f < from - 1 || f > to + 1) return null;
	const a = interpolate(f, [from, from + 40, to - 30, to], [0, 1, 1, 0], clamp);
	const blur = interpolate(f, [from, from + 46], [10, 0], clamp);
	const spread = interpolate(f, [from, to], [30, 36], clamp);
	const line = interpolate(f, [from + 20, from + 70], [0, 1], clamp);
	return (
		<div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: a}}>
			<div
				style={{
					fontFamily: SERIF,
					fontWeight: 700,
					fontSize: 118,
					letterSpacing: spread,
					paddingLeft: spread,
					background: 'linear-gradient(180deg, #ffffff 0%, #e9eef8 45%, #c9b27a 80%, #f3e2b0 100%)',
					WebkitBackgroundClip: 'text',
					color: 'transparent',
					filter: `blur(${blur}px) drop-shadow(0 0 22px rgba(170,195,255,0.45)) drop-shadow(0 0 60px rgba(120,150,230,0.3))`,
				}}
			>
				神奥之名
			</div>
			<div style={{width: 560 * line, height: 1.5, margin: '18px 0 20px', background: 'linear-gradient(90deg, rgba(230,215,170,0), rgba(230,215,170,0.85), rgba(230,215,170,0))'}} />
			<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 32, letterSpacing: 14, paddingLeft: 14, color: 'rgba(236,240,250,0.9)', filter: `blur(${blur * 0.6}px)`, textShadow: '0 0 18px rgba(150,175,240,0.6)'}}>
				THE NAME OF SINNOH
			</div>
		</div>
	);
};

/** 篇章卡：「上篇 · 两个神」 */
export const PartCard: React.FC<{f: number; from: number; to: number; zh: string; en: string}> = ({f, from, to, zh, en}) => {
	if (f < from - 1 || f > to + 1) return null;
	const a = interpolate(f, [from, from + 20, to - 20, to], [0, 1, 1, 0], clamp);
	return (
		<div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: a}}>
			<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 60, letterSpacing: 16, paddingLeft: 16, color: '#eef1f7', textShadow: '0 0 20px rgba(140,165,230,0.55), 0 2px 8px rgba(0,0,0,0.8)'}}>{zh}</div>
			<div style={{marginTop: 14, fontFamily: CINZEL, fontSize: 24, letterSpacing: 10, paddingLeft: 10, color: 'rgba(225,230,242,0.8)', textShadow: '0 0 12px rgba(0,0,0,0.9)'}}>{en}</div>
		</div>
	);
};
