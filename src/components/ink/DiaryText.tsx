import {Easing, interpolate} from 'remotion';
import {CORMORANT, SERIF} from '../../fonts';
import {clamp} from '../../theme';

const rand = (seed: number) => {
	const x = Math.sin(seed * 91.7 + 47.3) * 43758.5453;
	return x - Math.floor(x);
};

/** 日记的一行中文；strong 的字写得更重、洇得更开（如名字） */
export type DiaryLine = {text: string; strong?: string};

/**
 * 日记字迹：中文逐字写出（每个字由洇开的淡墨收成笔画，带一点手写的歪斜），写完后英文小字从左到右显出。
 * 坐标为 InkDiary 所在层（k = 1）的坐标；y 为第一行的基线，行距与横格一致（66px）。
 * 写完（含英文）所需的帧数可用 diaryDuration 计算。
 */
export const DiaryText: React.FC<{
	frame: number;
	from: number;
	x: number;
	y: number;
	lines: DiaryLine[];
	en: string;
	width: number;
	/** 每个字的书写帧数 */
	rate?: number;
	size?: number;
	seed?: number;
	opacity?: number;
	/** 字迹的歪斜程度（1 = 平常；越大越潦草、越抖） */
	jitter?: number;
	/** CSS 混合模式（写在会被烧穿、被墨盖住的纸上时用 multiply） */
	blend?: React.CSSProperties['mixBlendMode'];
}> = ({frame, from, x, y, lines, en, width, rate = 2.5, size = 38, seed = 1, opacity = 1, jitter = 1, blend}) => {
	if (frame < from) return null;
	let n = 0;
	const total = lines.reduce((a, l) => a + l.text.length, 0);
	const enFrom = from + total * rate + 4;
	const enP = interpolate(frame, [enFrom, enFrom + 26], [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
	const head = -20 + enP * 140;
	const enMask = `linear-gradient(90deg, #000 ${head - 20}%, transparent ${head}%)`;
	return (
		<div style={{position: 'absolute', left: x, top: 0, width, opacity, mixBlendMode: blend}}>
			{lines.map((line, li) => {
				const strongAt = line.strong ? line.text.indexOf(line.strong) : -1;
				return (
					<div key={li} style={{position: 'absolute', left: 0, top: y + li * 66 - size * 1.05, whiteSpace: 'nowrap', display: 'flex'}}>
						{line.text.split('').map((ch, ci) => {
							const idx = n++;
							const t = frame - (from + idx * rate);
							const strong = strongAt >= 0 && ci >= strongAt && ci < strongAt + (line.strong?.length ?? 0);
							const o = interpolate(t, [0, 5], [0, 1], clamp);
							const blur = interpolate(t, [0, 8], [5, 0], clamp);
							const bleed = interpolate(t, [0, 14], [1, strong ? 0.5 : 0.25], clamp);
							const r = rand(seed * 100 + idx);
							return (
								<span
									key={ci}
									style={{
										fontFamily: SERIF,
										fontSize: size * (strong ? 1.18 : 1) * (0.97 + 0.06 * rand(seed * 300 + idx)),
										fontWeight: strong ? 900 : 600,
										color: strong ? '#0d0907' : '#1d150e',
										opacity: o,
										display: 'inline-block',
										width: ch === '　' ? size : undefined,
										transform: `translateY(${(r - 0.5) * 4 * jitter}px) rotate(${(rand(seed * 200 + idx) - 0.5) * 4 * jitter}deg)`,
										filter: `blur(${blur}px)`,
										textShadow: `0 0 ${2 + bleed * 6}px rgba(24,16,10,${0.25 + bleed * 0.3})`,
										letterSpacing: 2,
									}}
								>
									{ch}
								</span>
							);
						})}
					</div>
				);
			})}
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: y + lines.length * 66 - size * 0.95,
					width,
					fontFamily: CORMORANT,
					fontStyle: 'italic',
					fontWeight: 500,
					fontSize: size * 0.62,
					lineHeight: `${33}px`,
					color: 'rgba(46,32,20,0.88)',
					maskImage: enMask,
					WebkitMaskImage: enMask,
					opacity: enP > 0 ? 1 : 0,
				}}
			>
				{en}
			</div>
		</div>
	);
};

/** 一段日记写完（含英文）所需的帧数 */
export const diaryDuration = (lines: DiaryLine[], rate = 2.5) => lines.reduce((a, l) => a + l.text.length, 0) * rate + 30;
