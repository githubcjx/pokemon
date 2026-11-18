import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {CINZEL, SERIF} from '../../fonts';
import {clamp, COLORS} from '../../theme';
import {useFrame} from '../../time';

// ─── 《为彼而去》的标题与篇章卡（用户 2026-10-03：标题放在开头；分上下两篇，各出一张篇章卡）────────

const GOLD = 'linear-gradient(180deg, #fff6dc 0%, #f1cb72 48%, #b78330 78%, #e9c57a 100%)';

/** 逐字浮现的金色大字 */
const GoldChars: React.FC<{text: string; from: number; size: number; spacing: number; stagger?: number}> = ({text, from, size, spacing, stagger = 9}) => {
	const f = useFrame();
	return (
		<div style={{display: 'flex', justifyContent: 'center', gap: spacing * 0.4}}>
			{text.split('').map((ch, i) => {
				const v = interpolate(f, [from + i * stagger, from + i * stagger + 28], [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
				return (
					<span
						key={i}
						style={{
							fontFamily: SERIF,
							fontSize: size,
							fontWeight: 700,
							letterSpacing: spacing,
							opacity: v,
							transform: `translateY(${(1 - v) * 10}px)`,
							filter: `blur(${(1 - v) * 8}px) drop-shadow(0 0 22px rgba(${COLORS.glowRgb},0.45)) drop-shadow(0 3px 2px rgba(40,20,0,0.8))`,
							background: GOLD,
							WebkitBackgroundClip: 'text',
							backgroundClip: 'text',
							color: 'transparent',
						}}
					>
						{ch}
					</span>
				);
			})}
		</div>
	);
};

const fadeOf = (f: number, [a, b]: readonly [number, number]) => interpolate(f, [a, a + 1, b - 22, b], [0, 1, 1, 0], clamp);

/** 本期标题：《为彼而去》/ FOR THE SAKE OF THEM（凤王石室地面文字原文） */
export const EpisodeTitle: React.FC<{at: readonly [number, number]}> = ({at}) => {
	const f = useFrame();
	if (f < at[0] || f > at[1]) return null;
	return (
		<AbsoluteFill style={{opacity: fadeOf(f, at), pointerEvents: 'none'}}>
			<div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 34% 22% at 50% 46%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)', opacity: interpolate(f, [at[0], at[0] + 24], [0, 1], clamp)}} />
			<div style={{position: 'absolute', left: 0, width: 1920, top: 400}}>
				<GoldChars text="为彼而去" from={at[0]} size={118} spacing={24} />
			</div>
			<div
				style={{
					position: 'absolute',
					left: 0,
					width: 1920,
					top: 575,
					textAlign: 'center',
					fontFamily: CINZEL,
					fontSize: 30,
					letterSpacing: 12,
					color: `rgba(${COLORS.goldRgb},0.85)`,
					textShadow: '0 0 12px rgba(0,0,0,0.8)',
					opacity: interpolate(f, [at[0] + 40, at[0] + 70], [0, 1], clamp),
				}}
			>
				FOR THE SAKE OF THEM
			</div>
		</AbsoluteFill>
	);
};

/** 篇章卡：上篇 · 阿露福遗迹 / 下篇 · 神都遗迹 */
export const PartCard: React.FC<{at: readonly [number, number]; part: string; place: string; en: string}> = ({at, part, place, en}) => {
	const f = useFrame();
	if (f < at[0] || f > at[1]) return null;
	const lineW = interpolate(f, [at[0] + 10, at[0] + 40], [0, 300], {...clamp, easing: Easing.out(Easing.cubic)});
	return (
		<AbsoluteFill style={{opacity: fadeOf(f, at), pointerEvents: 'none'}}>
			<div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 34% 22% at 50% 46%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)', opacity: interpolate(f, [at[0], at[0] + 24], [0, 1], clamp)}} />
			<div
				style={{
					position: 'absolute',
					left: 0,
					width: 1920,
					top: 392,
					textAlign: 'center',
					fontFamily: SERIF,
					fontSize: 34,
					fontWeight: 600,
					letterSpacing: 16,
					color: `rgba(${COLORS.goldRgb},0.9)`,
					textShadow: '0 0 14px rgba(0,0,0,0.9)',
					opacity: interpolate(f, [at[0], at[0] + 20], [0, 1], clamp),
				}}
			>
				{part}
			</div>
			<div style={{position: 'absolute', left: 960 - lineW / 2, width: lineW, top: 450, height: 1, background: `rgba(${COLORS.goldRgb},0.6)`}} />
			<div style={{position: 'absolute', left: 0, width: 1920, top: 470}}>
				<GoldChars text={place} from={at[0] + 14} size={72} spacing={14} stagger={7} />
			</div>
			<div
				style={{
					position: 'absolute',
					left: 0,
					width: 1920,
					top: 580,
					textAlign: 'center',
					fontFamily: CINZEL,
					fontSize: 22,
					letterSpacing: 9,
					color: `rgba(${COLORS.goldRgb},0.75)`,
					textShadow: '0 0 10px rgba(0,0,0,0.85)',
					opacity: interpolate(f, [at[0] + 40, at[0] + 64], [0, 1], clamp),
				}}
			>
				{en}
			</div>
		</AbsoluteFill>
	);
};
