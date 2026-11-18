import {AbsoluteFill} from 'remotion';
import {ACCENT, DragonArt, ElementBg} from './Mono';

/**
 * 左右对峙（第 3 段结尾 / 第 4 段开头共用，保证交界无缝）：
 * 左边黑底白焰的莱希拉姆，右边白底雷云的捷克罗姆，中间一道参差的接缝。
 * slide：从两侧滑入（第 3 段用，0 → 1）；push：整体推近；charge：蓄力（逆光与轮廓光增强）；
 * close：两条龙向中间逼近（像素）；flick：右边雷云里的闪光；seam：接缝抖动（像素）。
 */
export const Faceoff: React.FC<{
	time: number;
	slide?: number;
	push?: number;
	charge?: number;
	close?: number;
	flick?: number;
	seam?: number;
}> = ({time, slide = 1, push = 1, charge = 0, close = 0, flick = 0, seam = 0}) => {
	const sx = (v: number) => (50 + (v - 50) * 1 + seam * Math.sin(time * 37 + v) * 0.05).toFixed(2);
	const leftClip = `polygon(0 0, ${sx(52)}% 0, ${sx(47)}% 34%, ${sx(51)}% 52%, ${sx(46)}% 100%, 0 100%)`;
	const rightClip = `polygon(${sx(52)}% 0, 100% 0, 100% 100%, ${sx(46)}% 100%, ${sx(51)}% 52%, ${sx(47)}% 34%)`;
	return (
		<AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '50% 50%'}}>
			{/* 左：黑底白焰 */}
			<AbsoluteFill style={{clipPath: leftClip, transform: `translateX(${(1 - slide) * -120}px)`}}>
				<ElementBg time={time} c={[500, 470]} glow={[1, 0.95, 0.88]} glowAmt={1.0 + charge * 0.8} glowR={0.3 + charge * 0.08} rays={0.45 + charge * 0.4} flame={1} />
				<DragonArt
					name="reshiram"
					x={500 + close}
					y={560}
					size={820}
					reveal={1}
					rim={{dir: [0.5, -1], color: [0.8 + charge * 1.6, 0.7 + charge * 1.4, 0.55 + charge * 1.1], power: 2}}
					rimAfter={1}
				/>
			</AbsoluteFill>
			{/* 右：白底雷云 */}
			<AbsoluteFill style={{clipPath: rightClip, transform: `translateX(${(1 - slide) * 120}px)`}}>
				<ElementBg
					time={time}
					c={[1110, 430]}
					bg={[0.97, 0.975, 0.98]}
					storm={1}
					ink={[0.05, 0.06, 0.07]}
					glow={ACCENT.blue}
					glowAmt={0.15 + flick * 0.4}
					flick={flick}
				/>
				<AbsoluteFill style={{background: 'linear-gradient(to top, #000 0%, #000 11%, rgba(0,0,0,0.7) 21%, transparent 35%)'}} />
				<DragonArt
					name="zekrom"
					x={1420 - close}
					y={560}
					size={840}
					reveal={1}
					rim={{dir: [-0.4, -1], color: [0.36 + charge * 0.7, 0.8 + charge * 1.6, 1.4 + charge * 2.4], power: 2}}
					rimAfter={1}
				/>
			</AbsoluteFill>
			{/* 接缝上的一道电光 */}
			<svg width={1920} height={1080} style={{position: 'absolute', opacity: slide}}>
				<polyline
					points={`${(Number(sx(52)) * 19.2).toFixed(1)},0 ${(Number(sx(47)) * 19.2).toFixed(1)},367 ${(Number(sx(51)) * 19.2).toFixed(1)},562 ${(Number(sx(46)) * 19.2).toFixed(1)},1080`}
					fill="none"
					stroke="#fff"
					strokeWidth={3 + charge * 3}
					style={{filter: `drop-shadow(0 0 ${6 + charge * 10}px rgba(${ACCENT.blueRgb},1)) drop-shadow(0 0 ${14 + charge * 20}px rgba(${ACCENT.warmRgb},0.8))`}}
				/>
			</svg>
		</AbsoluteFill>
	);
};
