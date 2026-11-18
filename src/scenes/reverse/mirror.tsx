import {AbsoluteFill} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {V3} from '../../three/stage';
import {Cam, project, pxOf} from './cam';
import {bf, easeOutCubic, prog, smooth} from './common';

/**
 * 第 9–10 段：它的两个样子。枪之柱的地面就是两个世界之间的那面"镜子"：
 * 战斗结束它沉回深处 → 镜头一路升到天花板（地面的背面）下，起源形态倒挂在祭坛下方（60.0）
 * → 镜头升到与地面同高，地面只剩线、看上去是一道镜面线：上面是别种形态（61.0 起刻出、63.0 显色），
 * 下面是倒过来的起源形态 → 66.2 镜头升到地面上方，地面重新不透明，起源形态被挡在背面 → 淡出。
 */

/** 镜子两边的骑拉帝纳站在祭坛上 */
export const MIRROR: V3 = [0.4, 0, -0.5];

/** 正面的世界（断柱、远山）重新亮起来 */
export const relightAt = (f: number) => smooth(prog(f, bf(60, 2), bf(61, 2)));
/** 地面变成只剩线的"镜面"：镜头升到与地面同高前开始，升到地面上方后恢复 */
export const glassAt = (f: number) => smooth(prog(f, bf(60, 2), bf(61))) * (1 - smooth(prog(f, bf(66, 2), bf(67, 2))));
/** 地上的口子在第 58.2–60 小节合上；断柱在第 56.2–58.2 小节（"扭曲停了下来"）直回来 */
export const portalCloseAt = (f: number) => smooth(prog(f, bf(58, 2), bf(60)));
export const unbendAt = (f: number) => smooth(prog(f, bf(56, 2), bf(58, 2)));

const ORIGIN_IN = bf(59, 2);
const ALTERED_IN = bf(61);
const ALTERED_REVEAL = bf(63);
const ORIGIN_OUT = bf(66, 2);

/** 别种形态立绘里脚底的位置（同 Master 的 GIRA_FOOT_V）；起源形态立绘里身体最低处 */
const ALTERED_FOOT_V = 0.955;
const ORIGIN_LOW_V = 0.86;

const clipAbove = (y: number) => `inset(0 0 ${Math.max(0, 1080 - y)}px 0)`;

export const MirrorGiratina: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	if (f < ORIGIN_IN - 2) return null;
	const base = project(c, MIRROR);
	if (base.depth <= 0) return null;
	const sizeA = pxOf(c, base.depth, 12.5);
	const sizeO = pxOf(c, base.depth, 13);
	const originA = smooth(prog(f, ORIGIN_IN, ORIGIN_IN + 24)) * (1 - smooth(prog(f, ORIGIN_OUT, ORIGIN_OUT + 22)));
	const alteredA = smooth(prog(f, ALTERED_IN, ALTERED_IN + 20));
	const rv = easeOutCubic(prog(f, ALTERED_REVEAL, ALTERED_REVEAL + 40));
	const lit = smooth(prog(f, ALTERED_REVEAL, ALTERED_REVEAL + 30));
	const sway = Math.sin(f * 0.02) * 2;
	return (
		<>
			{/* 起源形态：画成站在镜面上，再整个沿镜面线翻下去 */}
			{originA > 0.001 ? (
				<AbsoluteFill style={{transform: 'scaleY(-1)', transformOrigin: `50% ${base.y}px`}}>
					<AbsoluteFill style={{clipPath: clipAbove(base.y)}}>
						<PokemonArt3D
							dir="pokemon/giratina"
							variant="-origin"
							x={base.x}
							y={base.y - sizeO * (ORIGIN_LOW_V - 0.5)}
							size={sizeO}
							yaw={-sway}
							pitch={-1.5}
							depthScale={0.5}
							ambient={[0.42, 0.38, 0.42]}
							dirLights={[{dir: [0, 0.85, 0.5], color: [0.85, 0.6, 0.3], wrap: 0.5}]}
							rim={{dir: [1, -0.3], color: [0.85, 0.2, 0.12], power: 2.2}}
							opacity={originA}
							resolution={1.3}
						/>
					</AbsoluteFill>
				</AbsoluteFill>
			) : null}
			{/* 别种形态：先是珍珠白的排线，63.0 起原色从脚底往上渗开 */}
			{alteredA > 0.001 ? (
				<AbsoluteFill style={{clipPath: clipAbove(base.y)}}>
					<PokemonArt3D
						dir="pokemon/giratina"
						x={base.x}
						y={base.y - sizeA * (ALTERED_FOOT_V - 0.5)}
						size={sizeA}
						yaw={sway}
						pitch={-1}
						depthScale={0.5}
						ambient={[0.4 + 0.12 * lit, 0.4 + 0.12 * lit, 0.46 + 0.1 * lit]}
						dirLights={[{dir: [-0.4, -0.6, 0.6], color: [0.32 * lit, 0.34 * lit, 0.44 * lit], wrap: 0.4}]}
						rim={{dir: [-1, -0.2], color: [0.7, 0.72, 0.9], power: 2.4}}
						hatch={{amount: 0.85, body: 1, reveal: rv, color: [0.92, 0.9, 1.0], freq: 88, time: f / 30, center: [0.5, 0.95]}}
						opacity={alteredA}
						resolution={1.3}
					/>
				</AbsoluteFill>
			) : null}
		</>
	);
};

/** 镜面线：镜头与地面同高时，地面是一道线；63.0（石板那句）一道金光沿线走过 */
export const MirrorLine: React.FC<{f: number; c: Cam}> = ({f, c}) => {
	const a = glassAt(f) * smooth(prog(f, bf(60, 3), bf(61, 1)));
	if (a <= 0.01) return null;
	const y = project(c, MIRROR).y;
	const sweep = prog(f, ALTERED_REVEAL, ALTERED_REVEAL + 50);
	const sx = 960 + (sweep - 0.5) * 2400;
	const sweepA = Math.sin(Math.PI * sweep) * (f > ALTERED_REVEAL ? 1 : 0);
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: a}}>
			<defs>
				<linearGradient id="rv-mirror" x1="0" x2="1" y1="0" y2="0">
					<stop offset="0" stopColor="rgba(255,200,120,0)" />
					<stop offset="0.5" stopColor="rgba(255,236,200,0.9)" />
					<stop offset="1" stopColor="rgba(255,200,120,0)" />
				</linearGradient>
				<filter id="rv-mirror-g" x="-10%" y="-200%" width="120%" height="500%">
					<feGaussianBlur stdDeviation="6" />
				</filter>
			</defs>
			<rect x={0} y={y - 5} width={1920} height={10} fill="url(#rv-mirror)" opacity={0.45} filter="url(#rv-mirror-g)" />
			<rect x={0} y={y - 0.75} width={1920} height={1.5} fill="url(#rv-mirror)" />
			{sweepA > 0.01 ? <ellipse cx={sx} cy={y} rx={260} ry={7} fill={`rgba(255,214,140,${0.9 * sweepA})`} filter="url(#rv-mirror-g)" /> : null}
		</svg>
	);
};
