import {Easing, interpolate} from 'remotion';
import {CINZEL, SERIF} from '../fonts';
import {clamp, COLORS} from '../theme';
import {useFrame} from '../time';

/** gold：暗底上的金字（第 1、2 期）；ink：古纸上的浓墨字（第 3 期水墨，中文名从墨里洇出）；prism：《夺走的光辉》的棱镜色散字 */
const TONES = {
	gold: {
		no: COLORS.gold,
		cat: `rgba(${COLORS.goldRgb},0.85)`,
		catEn: `rgba(${COLORS.goldRgb},0.6)`,
		lineRgb: COLORS.goldRgb,
		en: COLORS.parchment,
		name: 'linear-gradient(180deg, #fff6dc 0%, #f1cb72 48%, #b78330 78%, #e9c57a 100%)',
		nameShadow: `drop-shadow(0 0 18px rgba(${COLORS.glowRgb},0.4)) drop-shadow(0 3px 2px rgba(40,20,0,0.8))`,
		textShadow: undefined as string | undefined,
	},
	ink: {
		no: '#1c140d',
		cat: 'rgba(24,17,11,0.9)',
		catEn: 'rgba(24,17,11,0.68)',
		lineRgb: '24,17,11',
		en: '#1a120b',
		// 浓墨：中心最黑、边缘带一点洇开的淡墨
		name: 'linear-gradient(180deg, #1e1610 0%, #0c0806 55%, #241a12 100%)',
		nameShadow: 'drop-shadow(0 0 1.5px rgba(20,14,9,0.55)) drop-shadow(0 0 6px rgba(20,14,9,0.25)) drop-shadow(0 0 18px rgba(242,228,198,0.85))',
		// 小字压在墨上也能读：一圈纸色晕
		textShadow: '0 0 4px rgba(242,228,198,0.95), 0 0 12px rgba(242,228,198,0.85)',
	},
	// 黑白片（《真实与理想》）：冷白字，名字的光晕取 glowRgb（各宝可梦的点睛色）
	mono: {
		no: '#f2f2f0',
		cat: 'rgba(240,240,238,0.88)',
		catEn: 'rgba(240,240,238,0.6)',
		lineRgb: '240,240,238',
		en: '#ecedee',
		name: 'linear-gradient(180deg, #ffffff 0%, #f1f2f3 50%, #b9bec4 82%, #e8eaec 100%)',
		nameShadow: 'drop-shadow(0 0 18px rgba(GLOW,0.55)) drop-shadow(0 3px 3px rgba(0,0,0,0.9))',
		textShadow: '0 0 6px rgba(0,0,0,0.95), 0 0 16px rgba(0,0,0,0.8)' as string | undefined,
	},
	// 黑白片的白底画面：黑字，外圈白晕
	monoDark: {
		no: '#0b0c0d',
		cat: 'rgba(10,11,12,0.9)',
		catEn: 'rgba(10,11,12,0.65)',
		lineRgb: '10,11,12',
		en: '#0b0c0d',
		name: 'linear-gradient(180deg, #24272b 0%, #050506 55%, #1d2024 100%)',
		nameShadow: 'drop-shadow(0 0 14px rgba(GLOW,0.5)) drop-shadow(0 0 3px rgba(255,255,255,0.9))',
		textShadow: '0 0 5px rgba(255,255,255,0.95), 0 0 14px rgba(255,255,255,0.85)' as string | undefined,
	},
	// 《夺走的光辉》：棱镜。冷白字，名字带一圈色散（红、青错开）和光晕，下划线是一道光谱
	prism: {
		no: '#eef3ff',
		cat: 'rgba(232,238,255,0.9)',
		catEn: 'rgba(214,226,255,0.62)',
		lineRgb: '235,242,255',
		en: '#eef2fb',
		name: 'linear-gradient(180deg, #ffffff 0%, #f1f5ff 46%, #c3cde8 80%, #f6f8ff 100%)',
		nameShadow:
			'drop-shadow(-2px 0 0 rgba(255,60,130,0.38)) drop-shadow(2px 0 0 rgba(60,210,255,0.38)) drop-shadow(0 0 18px rgba(GLOW,0.5)) drop-shadow(0 3px 3px rgba(0,0,0,0.9))',
		textShadow: '0 0 6px rgba(0,0,0,0.9), 0 0 16px rgba(0,0,0,0.7)' as string | undefined,
		lineBg: 'linear-gradient(90deg, #ff4d6d, #ffb347, #fff27a, #6dff9a, #4dd8ff, #7a6dff, rgba(200,110,255,0))',
	},
};

/** 紧凑名称标签：编号 · 分类 / 中文名（逐字浮现）/ 英文名 */
export const NameTag: React.FC<{
	from: number;
	x: number;
	y: number;
	align?: 'left' | 'right' | 'center';
	/** 紧凑尺寸：多只宝可梦同框时使用 */
	compact?: boolean;
	no: string;
	zh: string;
	en: string;
	category: string;
	categoryEn: string;
	opacity?: number;
	tone?: keyof typeof TONES;
	/** mono 色调下名字光晕的颜色（"r,g,b"） */
	glowRgb?: string;
}> = ({from, x, y, align = 'left', compact = false, no, zh, en, category, categoryEn, opacity = 1, tone = 'gold', glowRgb = '255,255,255'}) => {
	const T = {...TONES[tone], nameShadow: TONES[tone].nameShadow.replace('GLOW', glowRgb)} as (typeof TONES)[keyof typeof TONES] & {lineBg?: string};
	const frame = useFrame();
	if (frame < from) return null;

	const fade = (start: number, len = 18) => interpolate(frame, [start, start + len], [0, 1], clamp);
	const lineWidth = interpolate(frame, [from + 18, from + 50], [0, 360], {...clamp, easing: Easing.out(Easing.cubic)});
	const right = align === 'right';
	const center = align === 'center';
	const k = compact ? 0.68 : 1;

	return (
		<div
			style={{
				position: 'absolute',
				top: y,
				...(right ? {right: 1920 - x} : {left: x}),
				...(center ? {transform: 'translateX(-50%)'} : {}),
				display: 'flex',
				flexDirection: 'column',
				alignItems: center ? 'center' : right ? 'flex-end' : 'flex-start',
				whiteSpace: 'nowrap',
				opacity,
			}}
		>
			<div style={{display: 'flex', alignItems: 'baseline', gap: 12, opacity: fade(from), textShadow: T.textShadow}}>
				<span style={{fontFamily: CINZEL, fontSize: 20 * k, letterSpacing: 5 * k, color: T.no}}>{no}</span>
				<span style={{fontFamily: SERIF, fontSize: 19 * k, letterSpacing: 6 * k, color: T.cat}}>
					{category}
				</span>
				<span style={{fontFamily: CINZEL, fontSize: 13 * k, letterSpacing: 3 * k, color: T.catEn}}>
					{categoryEn}
				</span>
			</div>
			<div style={{display: 'flex', marginTop: 2}}>
				{zh.split('').map((ch, i) => {
					const local = frame - (from + 6 + i * 5);
					const o = interpolate(local, [0, 12], [0, 1], clamp);
					const yy = interpolate(local, [0, 16], [22, 0], {...clamp, easing: Easing.out(Easing.cubic)});
					const blur = interpolate(local, [0, 12], [10, 0], clamp);
					return (
						<span
							key={i}
							style={{
								fontFamily: SERIF,
								fontSize: 92 * k,
								fontWeight: 900,
								lineHeight: 1.12,
								letterSpacing: 6 * k,
								opacity: o,
								transform: `translateY(${yy}px)`,
								filter: `blur(${blur}px) ${T.nameShadow}`,
								background: T.name,
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
			<div
				style={{
					width: lineWidth * k,
					height: 2,
					marginTop: 4,
					background: T.lineBg
						? right
							? T.lineBg.replace('90deg', '270deg')
							: T.lineBg
						: center
						? `linear-gradient(90deg, transparent, rgba(${T.lineRgb},0.95), transparent)`
						: right
						? `linear-gradient(270deg, rgba(${T.lineRgb},0.95), transparent)`
						: `linear-gradient(90deg, rgba(${T.lineRgb},0.95), transparent)`,
				}}
			/>
			<div
				style={{
					marginTop: 12 * k,
					fontFamily: CINZEL,
					fontSize: 28 * k,
					fontWeight: 600,
					letterSpacing: 16 * k,
					color: T.en,
					textShadow: T.textShadow,
					opacity: fade(from + 28),
				}}
			>
				{en}
			</div>
		</div>
	);
};
