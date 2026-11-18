import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, flow} from '../../camera';
import {Grain} from '../../components/Grain';
import {InkPaper, PaperVignette} from '../../components/ink/InkPaper';
import {Seal} from '../../components/ink/Seal';
import {CINZEL, SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// ─── 第 3 期 · 第 8 段「尾声 · 鸣谢」（330 帧 = 11 秒）────────────────────
// 接上段吞没画面的浓墨：墨退开，露出古纸 → 本期引用的资料来源逐行淡入、淡出 → 版权方淡入，盖上本期的朱砂印 → 浓墨合拢收尾。
// 用户决定本期不做下期预告（不出下一期的宝可梦剪影），尾声只放片尾鸣谢。
export const CREDITS_SCENE_FRAMES = 330;

const T = {
	clear: [0, 100] as const,
	head: 48,
	items: 70, // 第一行来源淡入，之后每行间隔 STAGGER
	sourcesOut: [178, 204] as const,
	rights: 206,
	seal: 246,
	rightsOut: [274, 298] as const,
	flood: [294, 330] as const,
};
const STAGGER = 12;

// 只列本期实际用到的来源（见 script/ep03-texts.md）
const SOURCES = [
	{zh: '神奇宝贝百科', en: '52Poké Wiki'},
	{zh: 'PokeAPI', en: ''},
	{zh: 'Bulbapedia', en: ''},
	{zh: 'Serebii.net', en: ''},
];

const INK = '#1a120b';
const GLOW = '0 0 4px rgba(242,228,198,0.95), 0 0 14px rgba(242,228,198,0.8)';

const getCam = (f: number): Cam => ({
	x: flow(f, [
		[0, 960],
		[330, 975],
	]),
	y: flow(f, [
		[0, 540],
		[330, 530],
	]),
	zoom: flow(f, [
		[0, 1.12],
		[120, 1.0],
		[330, 1.08],
	]),
	roll: flow(f, [
		[0, -0.5],
		[330, 0.4],
	]),
});

/** 墨字淡入淡出：从模糊、略淡的洇墨收成清晰的字，淡出时再化开 */
const inkFade = (f: number, from: number, out: readonly [number, number]) => {
	const i = interpolate(f, [from, from + 26], [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
	const o = interpolate(f, [out[0], out[1]], [1, 0], {...clamp, easing: Easing.in(Easing.quad)});
	const v = i * o;
	return {opacity: v, filter: `blur(${(1 - v) * 6}px)`};
};

export const CreditsScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);

	const clearR = interpolate(frame, [T.clear[0], T.clear[1] - 30, T.clear[1]], [60, 1900, 6000], {...clamp, easing: Easing.inOut(Easing.sin)});
	const covered = frame < T.clear[1];
	const floodR = interpolate(frame, [T.flood[0], T.flood[1]], [0, 1600], {...clamp, easing: Easing.in(Easing.quad)});

	return (
		<AbsoluteFill style={{background: '#120e0b', overflow: 'hidden'}}>
			<InkPaper
				cam={cam}
				gold={0.8}
				ripple={0}
				flood={covered ? {x: 960, y: 540, radius: 4200} : floodR > 0 ? {x: 960, y: 560, radius: floodR} : undefined}
				clear={covered ? {x: 960, y: 520, radius: clearR} : undefined}
			/>
			<PaperVignette strength={0.8} />

			{/* 资料来源 */}
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 26, color: INK, textShadow: GLOW}}>
				<div style={{...inkFade(frame, T.head, T.sourcesOut), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 18}}>
					<div style={{fontFamily: SERIF, fontSize: 34, letterSpacing: 14}}>资料来源</div>
					<div style={{fontFamily: CINZEL, fontSize: 15, letterSpacing: 6, opacity: 0.7}}>SOURCES</div>
				</div>
				{SOURCES.map((s, i) => (
					<div key={s.zh} style={{...inkFade(frame, T.items + i * STAGGER, T.sourcesOut), display: 'flex', alignItems: 'baseline', gap: 18}}>
						<span style={{fontFamily: SERIF, fontSize: 50, letterSpacing: 4, fontWeight: 600}}>{s.zh}</span>
						{s.en && <span style={{fontFamily: CINZEL, fontSize: 24, letterSpacing: 3, opacity: 0.75}}>{s.en}</span>}
					</div>
				))}
			</AbsoluteFill>

			{/* 版权方 */}
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, color: INK, textShadow: GLOW}}>
				<div style={{...inkFade(frame, T.rights, T.rightsOut), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
					<div style={{fontFamily: SERIF, fontSize: 32, letterSpacing: 10, opacity: 0.85}}>宝可梦版权所有</div>
					<div style={{fontFamily: CINZEL, fontSize: 36, letterSpacing: 3, fontWeight: 600}}>Nintendo · Creatures · GAME FREAK</div>
					<div style={{fontFamily: CINZEL, fontSize: 36, letterSpacing: 3, fontWeight: 600}}>The Pokémon Company</div>
				</div>
				<div style={{opacity: interpolate(frame, [T.rightsOut[0], T.rightsOut[1]], [1, 0], clamp)}}>
					<Seal from={T.seal} x={960} y={790} text="生命之源" size={92} seed={5} />
				</div>
			</AbsoluteFill>
			<Grain opacity={0.06} />
		</AbsoluteFill>
	);
};
