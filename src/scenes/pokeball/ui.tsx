import {AbsoluteFill} from 'remotion';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {CINZEL, CORMORANT, SERIF} from '../../fonts';
import {COLORS} from '../../theme';
import {BASE_FPS} from '../../time';
import {Era, ERAS, prog, smooth, Source, SOURCES} from './common';
import {BACKDROP_FRAG, BALL_FRAG} from './gl';

export const GOLD_TEXT = 'linear-gradient(180deg, #fff3d2 0%, #f0cd80 45%, #b8833a 80%, #e8c67e 100%)';
const goldClip: React.CSSProperties = {background: GOLD_TEXT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'};

// ════════════════════════════════════════════════════════════════════════
// 背景
// ════════════════════════════════════════════════════════════════════════

export type BackdropState = {
	spot: [number, number];
	spotR: number;
	spotAmt: number;
	ringC: [number, number];
	ringR: number;
	rings: number;
	ringRot: number;
	floorY: number;
	floor: number;
	bright: number;
};

export const Backdrop: React.FC<{f: number; s: BackdropState}> = ({f, s}) => (
	<AbsoluteFill>
		<ShaderCanvas
			frag={BACKDROP_FRAG}
			width={1920}
			height={1080}
			uniforms={{
				uTime: f / BASE_FPS,
				uSpot: s.spot,
				uSpotR: s.spotR,
				uSpotAmt: s.spotAmt,
				uRingC: s.ringC,
				uRingR: s.ringR,
				uRings: s.rings,
				uRingRot: s.ringRot,
				uFloorY: s.floorY,
				uFloor: s.floor,
				uBright: s.bright,
			}}
		/>
	</AbsoluteFill>
);

// ════════════════════════════════════════════════════════════════════════
// 现代精灵球（代码绘制的实物）
// ════════════════════════════════════════════════════════════════════════

export type BallPose = {x: number; y: number; r: number; yaw: number; pitch: number; roll: number; glow?: number; dim?: number; gold?: number; opacity?: number};

/** 球心在 (x, y)，半径 r（像素）；角度单位为度 */
export const ModernBall: React.FC<{p: BallPose; f: number; shadow?: number}> = ({p, f, shadow = 1}) => {
	const size = Math.ceil((p.r * 2) / 0.8 / 2) * 2 + 4;
	const toRad = Math.PI / 180;
	return (
		<>
			{shadow > 0 && (
				<div
					style={{
						position: 'absolute',
						left: p.x - p.r * 1.1,
						top: p.y + p.r * 0.86,
						width: p.r * 2.2,
						height: p.r * 0.36,
						borderRadius: '50%',
						background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0) 100%)',
						opacity: shadow * (p.opacity ?? 1),
					}}
				/>
			)}
			<div style={{position: 'absolute', left: p.x - size / 2, top: p.y - size / 2, width: size, height: size}}>
				<ShaderCanvas
					frag={BALL_FRAG}
					width={size}
					height={size}
					uniforms={{
						uTime: f / BASE_FPS,
						uYaw: p.yaw * toRad,
						uPitch: p.pitch * toRad,
						uRoll: p.roll * toRad,
						uGlow: p.glow ?? 0.25,
						uDim: p.dim ?? 0,
						uGold: p.gold ?? 0,
						uFade: p.opacity ?? 1,
					}}
				/>
			</div>
		</>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 左上角：时代标签（换时代时旧字上滑淡出、新字从下方滑入，同参考片的年份翻牌）
// ════════════════════════════════════════════════════════════════════════

const ROLL = 16;

const current = <T extends {at: number}>(list: T[], f: number) => {
	let idx = -1;
	for (let i = 0; i < list.length; i++) if (list[i].at <= f) idx = i;
	return idx;
};

const rollStyle = (t: number, out: boolean): React.CSSProperties => {
	const k = smooth(t);
	return out
		? {opacity: 1 - k, transform: `translateY(${-26 * k}px)`, filter: `blur(${6 * k}px)`}
		: {opacity: k, transform: `translateY(${26 * (1 - k)}px)`, filter: `blur(${6 * (1 - k)}px)`};
};

export const EraLabel: React.FC<{f: number; opacity?: number}> = ({f, opacity = 1}) => {
	const i = current(ERAS, f);
	if (i < 0) return null;
	const cur = ERAS[i];
	const prev: Era | undefined = ERAS[i - 1];
	const t = prog(f, cur.at, cur.at + ROLL);
	const eraChanged = !prev || prev.era !== cur.era;
	const placeChanged = !prev || prev.place !== cur.place;
	const first = i === 0;
	const appear = first ? smooth(prog(f, cur.at, cur.at + 20)) : 1;
	const lineW = first ? 320 * smooth(prog(f, cur.at + 4, cur.at + 30)) : 320;

	const eraText = (text: string, style: React.CSSProperties) => (
		<div style={{position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', fontFamily: SERIF, fontWeight: 700, fontSize: 60, letterSpacing: 10, lineHeight: 1, ...goldClip, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))', ...style}}>
			{text}
		</div>
	);
	const placeText = (text: string, style: React.CSSProperties) => (
		<div style={{position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', fontFamily: SERIF, fontSize: 22, letterSpacing: 6, color: COLORS.parchmentDim, ...style}}>{text}</div>
	);

	return (
		<div style={{position: 'absolute', left: 76, top: 58, opacity: opacity * appear}}>
			<div style={{position: 'relative', height: 66, width: 520, overflow: 'visible'}}>
				{eraChanged && prev && t < 1 && eraText(prev.era, rollStyle(t, true))}
				{eraText(cur.era, eraChanged && !first ? rollStyle(t, false) : {})}
			</div>
			<div style={{width: lineW, height: 1.5, marginTop: 10, background: `linear-gradient(90deg, rgba(${COLORS.goldRgb},0.9), rgba(${COLORS.goldRgb},0))`}} />
			<div style={{position: 'relative', height: 34, marginTop: 12}}>
				{placeChanged && prev && t < 1 && placeText(prev.place, rollStyle(t, true))}
				{placeText(cur.place, placeChanged && !first ? rollStyle(t, false) : {})}
			</div>
		</div>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 右上角：游戏出处卡（作品英文名 / 中文名 / 出处，旁边一方朱印）
// ════════════════════════════════════════════════════════════════════════

const Seal: React.FC<{text: string; style?: React.CSSProperties}> = ({text, style}) => (
	<div
		style={{
			position: 'absolute',
			width: 46,
			height: 46,
			borderRadius: 3,
			background: 'radial-gradient(circle at 40% 35%, #b5372a 0%, #942519 70%, #7d1d13 100%)',
			boxShadow: 'inset 0 0 0 2px rgba(245,214,190,0.35), 0 2px 6px rgba(0,0,0,0.6)',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			fontFamily: SERIF,
			fontWeight: 700,
			fontSize: 17,
			lineHeight: 1.05,
			color: '#f5e2c8',
			transform: 'rotate(-3deg)',
			...style,
		}}
	>
		{text.split('').map((c, i) => (
			<span key={i}>{c}</span>
		))}
	</div>
);

export const SourceCard: React.FC<{f: number; opacity?: number}> = ({f, opacity = 1}) => {
	const i = current(SOURCES, f);
	if (i < 0) return null;
	const cur = SOURCES[i];
	const prev: Source | undefined = SOURCES[i - 1];
	const t = prog(f, cur.at, cur.at + ROLL);
	if (cur.hide) {
		// 出处卡收起：上一张整体淡出
		if (!prev || prev.hide || t >= 1) return null;
		return <SourceCardBody s={prev} prev={undefined} t={1} first={false} opacity={opacity * (1 - smooth(t))} />;
	}
	// 收起后再出现：当作第一张，整体淡入
	const first = i === 0 || !!prev?.hide;
	return <SourceCardBody s={cur} prev={first ? undefined : prev} t={t} first={first} opacity={opacity * (first ? smooth(prog(f, cur.at, cur.at + 20)) : 1)} />;
};

const SourceCardBody: React.FC<{s: Source; prev: Source | undefined; t: number; first: boolean; opacity: number}> = ({s: cur, prev, t, first, opacity}) => {
	const appear = 1;
	const titleChanged = !prev || prev.zh !== cur.zh;
	const noteChanged = !prev || prev.note !== cur.note;
	const sealChanged = !prev || prev.seal !== cur.seal;

	const right: React.CSSProperties = {position: 'absolute', right: 0, top: 0, whiteSpace: 'nowrap', textAlign: 'right'};
	const titleBlock = (s: Source, style: React.CSSProperties) => (
		<div style={{...right, ...style}}>
			<div style={{fontFamily: CORMORANT, fontStyle: 'italic', fontSize: 23, color: 'rgba(239,226,196,0.6)', letterSpacing: 0.5}}>{s.en}</div>
			<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 27, letterSpacing: 3, marginTop: 4, ...goldClip}}>《{s.zh}》</div>
		</div>
	);
	const noteBlock = (s: Source, style: React.CSSProperties) => (
		<div style={{...right, fontFamily: SERIF, fontSize: 18, letterSpacing: 3, color: 'rgba(239,226,196,0.62)', ...style}}>{s.note}</div>
	);

	return (
		<div style={{position: 'absolute', right: 76, top: 56, width: 560, opacity: opacity * appear}}>
			<div style={{position: 'absolute', right: 62, top: 0, width: 520, height: 120}}>
				<div style={{position: 'absolute', right: 0, top: 0, width: 520, height: 76}}>
					{titleChanged && prev && t < 1 && titleBlock(prev, rollStyle(t, true))}
					{titleBlock(cur, titleChanged && !first ? rollStyle(t, false) : {})}
				</div>
				<div style={{position: 'absolute', right: 0, top: 84, width: 400, height: 1.5, background: `linear-gradient(270deg, rgba(${COLORS.goldRgb},0.8), rgba(${COLORS.goldRgb},0))`}} />
				<div style={{position: 'absolute', right: 0, top: 94, width: 520, height: 30}}>
					{noteChanged && prev && t < 1 && noteBlock(prev, rollStyle(t, true))}
					{noteBlock(cur, noteChanged && !first ? rollStyle(t, false) : {})}
				</div>
			</div>
			{sealChanged && prev && t < 1 && <Seal text={prev.seal} style={{right: 0, top: 4, ...rollStyle(t, true)}} />}
			<Seal text={cur.seal} style={{right: 0, top: 4, ...(sealChanged && !first ? rollStyle(t, false) : {})}} />
		</div>
	);
};

// ════════════════════════════════════════════════════════════════════════
// 片名
// ════════════════════════════════════════════════════════════════════════

export const TitleCard: React.FC<{f: number; at: number; out: number; lineY: number}> = ({f, at, out, lineY}) => {
	if (f < at - 2 || f > out + 2) return null;
	const fadeOut = 1 - smooth(prog(f, out - 18, out));
	const chars = '人造容器'.split('');
	return (
		<AbsoluteFill style={{opacity: fadeOut}}>
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: lineY - 236,
					textAlign: 'center',
					fontFamily: CINZEL,
					fontSize: 21,
					letterSpacing: 9,
					color: `rgba(${COLORS.goldRgb},0.72)`,
					opacity: smooth(prog(f, at + 26, at + 50)),
				}}
			>
				THE VESSEL OF HUMANKIND'S INVENTION
			</div>
			<div style={{position: 'absolute', left: 0, right: 0, top: lineY - 196, display: 'flex', justifyContent: 'center'}}>
				{chars.map((c, i) => {
					const t = prog(f, at + 6 + i * 6, at + 26 + i * 6);
					return (
						<span
							key={i}
							style={{
								fontFamily: SERIF,
								fontWeight: 800,
								fontSize: 128,
								lineHeight: 1.15,
								margin: '0 22px',
								opacity: smooth(t),
								transform: `translateY(${18 * (1 - smooth(t))}px)`,
								filter: `blur(${10 * (1 - smooth(t))}px) drop-shadow(0 0 22px rgba(${COLORS.glowRgb},0.35)) drop-shadow(0 3px 3px rgba(30,15,0,0.9))`,
								...goldClip,
							}}
						>
							{c}
						</span>
					);
				})}
			</div>
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: lineY + 34,
					textAlign: 'center',
					fontFamily: SERIF,
					fontSize: 27,
					letterSpacing: 14,
					color: COLORS.parchment,
					opacity: smooth(prog(f, at + 40, at + 62)) * 0.9,
				}}
			>
				一颗精灵球的编年史
			</div>
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: lineY + 80,
					textAlign: 'center',
					fontFamily: CINZEL,
					fontSize: 15,
					letterSpacing: 8,
					color: `rgba(${COLORS.goldRgb},0.55)`,
					opacity: smooth(prog(f, at + 50, at + 72)),
				}}
			>
				A CHRONICLE OF THE POKÉ BALL
			</div>
		</AbsoluteFill>
	);
};
