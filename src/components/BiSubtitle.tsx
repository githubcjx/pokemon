import {Easing, interpolate} from 'remotion';
import {CORMORANT, IM_FELL, SERIF} from '../fonts';
import {clamp, COLORS} from '../theme';
import {useFrame} from '../time';

// 渐显边缘的柔化宽度（占文字宽度的百分比）
const EDGE = 18;

// 从左到右的渐显遮罩
const useWipe = (start: number, frames: number) => {
	const frame = useFrame();
	const p = interpolate(frame, [start, start + frames], [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
	const head = -EDGE + p * (100 + EDGE * 2);
	const mask = `linear-gradient(90deg, #000 ${head - EDGE}%, transparent ${head}%)`;
	return {maskImage: mask, WebkitMaskImage: mask};
};

export type SubtitleSource = {zh: string; en: string};

/**
 * 中英双语字幕。中文在上、英文在下，依次从左到右渐显。
 * source 只作为代码里的出处记录，画面上不显示（素材出处见 public/pokemon/sources.json）。
 * variant="center" 用于开场钩子这类居中大字。
 */
export const BiSubtitle: React.FC<{
	zh: string;
	en: string;
	from: number;
	to: number;
	source?: SubtitleSource;
	variant?: 'bottom' | 'center';
	/**
	 * light：暗底浅字（默认）；ink：古纸上的墨字，外围一圈纸色晕保证压在墨上也能读；mono：黑白片的冷白字（《真实与理想》）；
	 * prism：《夺走的光辉》介绍宝可梦时引用的图鉴原文——冷白字带一点红青色散，两行之间一道光谱细线；
	 * banderole：《剑与盾》的羊皮纸卷轴——卷轴从中间展开，展开到 75 % 后文字再从左到右显现（墨字）；frost：《坠落的序列》冷调浅灰白字（不用纯白）
	 */
	tone?: 'light' | 'ink' | 'mono' | 'prism' | 'banderole' | 'frost';
	/** ink 字幕下垫一片柔边的淡纸色晕染，背景暗（雷云、烟、夜雨）时也读得清 */
	backdrop?: boolean;
	/** 从左到右显现的速度倍数（《敬畏》用 1.25） */
	speed?: number;
	/** 英文和中文同时开始、同时显现完（《神奥之名》起）；默认英文晚半拍 */
	sync?: boolean;
	/** 字号倍数（《神奥之名》用 1.12） */
	scale?: number;
	/** 英文加粗、提亮（light 色调；《神奥之名》起），细斜体在亮画面上看不清 */
	enStrong?: boolean;
	/** light 字幕下垫一片柔边的暗晕（0–1），压在雪地、金光这类亮画面上也读得清；暗画面上几乎看不出（《神奥之名》起） */
	scrim?: number;
	/** 显现用多少帧（30fps）；给了就不按字数 / speed 推算（《光的背面》起按每句时长配） */
	wipe?: number;
	/** 结束前淡出多少帧，默认 14；下一句紧接着出时用短淡出，字幕不会提前消失（《光的背面》起） */
	fade?: number;
}> = ({zh, en, from, to, variant = 'bottom', tone = 'light', backdrop = false, speed = 1, sync = false, scale = 1, enStrong = false, scrim = 0, wipe, fade = 14}) => {
	const frame = useFrame();
	if (tone === 'banderole') return <Banderole zh={zh} en={en} from={from} to={to} frame={frame} />;
	const zhFrames = wipe ?? Math.max(18, zh.length * 2.2) / speed;
	const enStart = sync ? from : from + Math.round(zhFrames * 0.45);
	const enFrames = sync || wipe ? zhFrames : Math.max(22, en.length * 0.75) / speed;
	const zhMask = useWipe(from, zhFrames);
	const enMask = useWipe(enStart, enFrames);
	if (frame < from || frame > to) return null;

	const center = variant === 'center';
	// 一行放不下（约 1780px）时先收字距、再缩字号，保证中文始终一行；以前各期的字幕都放得下，不受影响
	const zhBase = (center ? 60 : 46) * scale;
	const zhGap0 = center ? 10 : 6;
	const room = 1780 - 80;
	const zhGap = Math.max(1, Math.min(zhGap0, room / zh.length - zhBase));
	const zhSize = Math.min(zhBase, room / zh.length - zhGap);
	const opacity = interpolate(frame, [to - fade, to], [1, 0], clamp);
	const ink = tone === 'ink';
	const mono = tone === 'mono';
	const prismT = tone === 'prism';
	const frost = tone === 'frost';
	const shadow = prismT
		? '-1.5px 0 0 rgba(255,70,140,0.42), 1.5px 0 0 rgba(70,210,255,0.42), 0 0 20px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.85)'
		: ink
		? '0 0 3px rgba(242,228,198,0.95), 0 0 14px rgba(242,228,198,0.9), 0 0 30px rgba(242,228,198,0.7)'
		: mono
		? '0 0 3px rgba(0,0,0,0.9), 0 0 16px rgba(0,0,0,0.95), 0 0 34px rgba(0,0,0,0.85)'
		: '0 0 22px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.85)';

	const padIn = interpolate(frame, [from, from + 12], [0, 1], clamp);
	// 衬底宽度随字数变化（中文约 52px / 字，英文约 12px / 字母，取较宽者）
	const padW = Math.max(760, zh.length * 52 * scale + 260, en.length * 12.5 * scale + 260);
	const pad =
		ink && backdrop ? (
			<div
				style={{
					position: 'absolute',
					left: 960 - padW / 2,
					width: padW,
					...(center ? {top: 540 - 150, height: 300} : {bottom: 84 - 60, height: 250}),
					opacity: opacity * padIn,
					background:
						'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(236,222,190,0.9) 0%, rgba(236,222,190,0.78) 38%, rgba(232,216,182,0.32) 70%, rgba(232,216,182,0) 100%)',
					pointerEvents: 'none',
				}}
			/>
		) : scrim > 0 && tone === 'light' ? (
			<div
				style={{
					position: 'absolute',
					left: 960 - (padW + 240) / 2,
					width: padW + 240,
					...(center ? {top: 540 - 160, height: 320} : {bottom: 84 - 70, height: 230}),
					opacity: opacity * padIn * scrim,
					background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(10,8,12,0.62) 0%, rgba(10,8,12,0.5) 40%, rgba(10,8,12,0.18) 72%, rgba(10,8,12,0) 100%)',
					pointerEvents: 'none',
				}}
			/>
		) : null;

	return (
		<>
		{pad}
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				...(center ? {top: 0, bottom: 0, justifyContent: 'center'} : {bottom: 84}),
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				textAlign: 'center',
				opacity,
			}}
		>
			<span
				style={{
					...zhMask,
					display: 'inline-block',
					padding: '8px 40px',
					fontFamily: SERIF,
					fontWeight: 600,
					fontSize: zhSize,
					letterSpacing: zhGap,
					whiteSpace: 'nowrap',
					color: ink ? '#21160c' : mono ? '#f4f4f1' : prismT ? '#f6f8ff' : frost ? '#bec5cf' : COLORS.parchment,
					textShadow: shadow,
				}}
			>
				{zh}
			</span>
			{prismT && (
				<div
					style={{
						...zhMask,
						width: Math.min(1500, Math.max(zh.length * 46, en.length * 11)),
						height: 2,
						margin: '2px 0 4px',
						background: 'linear-gradient(90deg, rgba(255,77,109,0), #ff4d6d 12%, #ffb347 28%, #fff27a 42%, #6dff9a 56%, #4dd8ff 72%, #7a6dff 88%, rgba(122,109,255,0))',
						boxShadow: '0 0 10px rgba(200,220,255,0.55)',
						opacity: 0.85,
					}}
				/>
			)}
			<span
				style={{
					...enMask,
					display: 'inline-block',
					padding: '2px 40px 6px',
					fontFamily: CORMORANT,
					fontStyle: 'italic',
					fontWeight: enStrong ? 600 : 500,
					fontSize: (center ? 32 : 27) * scale,
					letterSpacing: 1,
					color: ink ? (backdrop ? 'rgba(32,22,12,0.95)' : 'rgba(40,28,16,0.85)') : mono ? 'rgba(232,234,236,0.8)' : prismT ? 'rgba(214,230,255,0.86)' : frost ? 'rgba(170,180,192,0.82)' : enStrong ? 'rgba(239,226,196,0.92)' : COLORS.parchmentDim,
					textShadow: shadow,
				}}
			>
				{en}
			</span>
		</div>
		</>
	);
};

/**
 * 《剑与盾》的羊皮纸卷轴字幕：微微下垂的纸带、两端卷起，一道细墨线勾边。
 * 从中间展开（约半秒），展开到 75 % 后中文、英文依次从左到右显现；结束时文字先淡、卷轴再收起。
 */
const Banderole: React.FC<{zh: string; en: string; from: number; to: number; frame: number}> = ({zh, en, from, to, frame}) => {
	const zhFrames = Math.max(16, zh.length * 1.8);
	const textAt = from + 11;
	const zhMask = useWipe(textAt, zhFrames);
	const enMask = useWipe(textAt + Math.round(zhFrames * 0.45), Math.max(20, en.length * 0.6));
	if (frame < from || frame > to + 2) return null;
	const open = interpolate(frame, [from, from + 14, to - 8, to], [0, 1, 1, 0], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const textO = interpolate(frame, [to - 14, to - 6], [1, 0], clamp) * (open >= 0.75 || frame > from + 14 ? 1 : 0);
	// 纸带宽度：按字数估算，两边留足余量
	const textW = Math.max(zh.length * 46, en.length * 15.5);
	const bodyW = Math.min(1640, textW + 200);
	const w = bodyW * open;
	const H = 136;
	const sag = 10;
	const cx = 960;
	const top = 1080 - 64 - H;
	const x0 = cx - w / 2;
	const x1 = cx + w / 2;
	const curl = 26;
	return (
		<div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
			<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
				<defs>
					<linearGradient id="band-paper" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="#efe2bf" />
						<stop offset="0.55" stopColor="#e4d2a6" />
						<stop offset="1" stopColor="#cdb684" />
					</linearGradient>
					<linearGradient id="band-roll" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0" stopColor="#8f7448" />
						<stop offset="0.45" stopColor="#e2cf9f" />
						<stop offset="1" stopColor="#9c8152" />
					</linearGradient>
					<filter id="band-shadow" x="-10%" y="-40%" width="120%" height="180%">
						<feDropShadow dx="0" dy="6" stdDeviation="9" floodColor="#000" floodOpacity="0.55" />
					</filter>
				</defs>
				{open > 0.02 && (
					<g filter="url(#band-shadow)">
						{/* 两端卷起的纸卷（在纸带后面露出一截尾巴） */}
						<path d={`M ${x0 - curl * 1.6} ${top + 22} L ${x0 + 4} ${top + 12} L ${x0 + 4} ${top + H - 8} L ${x0 - curl * 1.6} ${top + H + 6} L ${x0 - curl * 0.8} ${top + H / 2 + 6} Z`} fill="#b9a172" />
						<path d={`M ${x1 + curl * 1.6} ${top + 22} L ${x1 - 4} ${top + 12} L ${x1 - 4} ${top + H - 8} L ${x1 + curl * 1.6} ${top + H + 6} L ${x1 + curl * 0.8} ${top + H / 2 + 6} Z`} fill="#b9a172" />
						{/* 纸带：上下边都微微下垂 */}
						<path
							d={`M ${x0} ${top} Q ${cx} ${top + sag * 2} ${x1} ${top} L ${x1} ${top + H} Q ${cx} ${top + H + sag * 2} ${x0} ${top + H} Z`}
							fill="url(#band-paper)"
						/>
						<path d={`M ${x0 + 8} ${top + 9} Q ${cx} ${top + 9 + sag * 2} ${x1 - 8} ${top + 9}`} stroke="#5a3e1e" strokeWidth={1.6} fill="none" opacity={0.7} />
						<path d={`M ${x0 + 8} ${top + H - 9} Q ${cx} ${top + H - 9 + sag * 2} ${x1 - 8} ${top + H - 9}`} stroke="#5a3e1e" strokeWidth={1.6} fill="none" opacity={0.7} />
						<rect x={x0 - 12} y={top - 6} width={24} height={H + 12} rx={12} fill="url(#band-roll)" />
						<rect x={x1 - 12} y={top - 6} width={24} height={H + 12} rx={12} fill="url(#band-roll)" />
					</g>
				)}
			</svg>
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: top + sag + 14,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					opacity: textO,
				}}
			>
				<span style={{...zhMask, display: 'inline-block', padding: '0 30px', fontFamily: SERIF, fontWeight: 600, fontSize: 42, letterSpacing: 5, color: '#2a190b', lineHeight: 1.25}}>
					{zh}
				</span>
				<span style={{...enMask, display: 'inline-block', padding: '0 30px', fontFamily: IM_FELL, fontStyle: 'italic', fontSize: 29, color: '#3d2914', lineHeight: 1.3}}>
					{en}
				</span>
			</div>
		</div>
	);
};
