import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, flow} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer} from '../../components/CamLayer';
import {Grain} from '../../components/Grain';
import {InkDuo, PaperVignette} from '../../components/ink/InkPaper';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {SUB} from './subtitles';

// ─── 第 3 期 · 第 7 段「两种命运」（660 帧 = 22 秒）──────────────────────
// 接上段暗下来的洞窟：超梦仍静静待在浓墨里 → 镜头向左拉开，墨缝扫过，左边从墨里显出淡彩的丛林
// → 梦幻在林间洇出、浮游，随心所欲地隐去身形，又在另一处出现 → 两边的墨在中间交汇、卷成 S 形，
// 丛林的光透进洞窟一侧，照到超梦身上 → 收尾旁白，墨缝里涌出浓墨吞没画面，接尾声。
// 梦幻已在第 1 段放过叫声，这里不再放。
export const FATES_SCENE_FRAMES = 660;

const T = {
	cave: [0, 60] as const, // 洞窟从上一段的暗里稍稍亮起
	seam: [30, 190] as const, // 墨缝扫过，丛林显出
	subMewtwo: [30, 128] as const,
	mewIn: [150, 206] as const,
	subMew: [134, 244] as const,
	subHide: [254, 384] as const,
	vanish: [272, 302] as const, // 梦幻隐去身形
	swap: 315,
	reappear: [330, 372] as const,
	subPure: [392, 494] as const,
	meet: [470, 570] as const, // 两边的墨交汇
	subHeart: [504, 624] as const,
	flood: [606, 660] as const,
};

// 主体层上的位置
const MT = {x: 1460, y: 560, size: 640};
const MEW_A = {x: 470, y: 470};
const MEW_B = {x: 660, y: 380};
const MEW_SIZE = 360;

const getCam = (f: number): Cam => ({
	// 开场与上一段末尾的超梦在画面上的位置、大小一致
	x: flow(f, [
		[0, 1584],
		[190, 980],
		[470, 950],
		[570, 960],
		[660, 960],
	]),
	y: flow(f, [
		[0, 569],
		[190, 540],
		[570, 530],
		[660, 540],
	]),
	zoom: flow(f, [
		[0, 1.35],
		[190, 1.0],
		[470, 1.03],
		[570, 1.12],
		[660, 1.55],
	]),
	roll: flow(f, [
		[0, 0.5],
		[190, 0],
		[470, -0.3],
		[660, 0.8],
	]),
});

export const FatesScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);

	const caveDark = interpolate(frame, [T.cave[0], T.cave[1]], [0.75, 0.35], {...clamp, easing: Easing.inOut(Easing.sin)});
	const seam = interpolate(frame, [T.seam[0], T.seam[1]], [-300, 960], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const meet = interpolate(frame, [T.meet[0], T.meet[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const floodR = interpolate(frame, [T.flood[0], T.flood[1]], [0, 1500], {...clamp, easing: Easing.in(Easing.quad)});

	// 梦幻：墨里洇出 → 像水汽一样淡去（隐形）→ 在另一处淡淡浮现
	const atB = frame >= T.swap;
	const mewSil = atB ? 1 : interpolate(frame, [T.mewIn[0], T.mewIn[0] + 26], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const mewReveal = atB ? 1 : interpolate(frame, [T.mewIn[0] + 16, T.mewIn[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const mewO = atB
		? interpolate(frame, [T.reappear[0], T.reappear[1], T.flood[0], T.flood[0] + 30], [0, 1, 1, 0], {...clamp, easing: Easing.inOut(Easing.sin)})
		: interpolate(frame, [T.mewIn[0], T.mewIn[0] + 16, T.vanish[0], T.vanish[1]], [0, 1, 1, 0], {...clamp, easing: Easing.inOut(Easing.sin)});
	// 隐形与浮现时身形化开（模糊）
	const mewBlur = atB
		? interpolate(frame, [T.reappear[0], T.reappear[1]], [12, 0], clamp)
		: interpolate(frame, [T.vanish[0], T.vanish[1]], [0, 12], clamp);
	const mewPos = atB ? MEW_B : MEW_A;
	const mewColor = interpolate(mewReveal, [0.6, 1], [0, 0.3], clamp);
	// 墨潮吞没时一起隐去

	// 交汇时，丛林的光照到超梦朝向梦幻的一侧
	const glow = meet * 0.9;
	const mtO = interpolate(frame, [T.flood[0] + 6, T.flood[0] + 36], [1, 0], {...clamp, easing: Easing.inOut(Easing.sin)});

	return (
		<AbsoluteFill style={{background: '#0f0b08', overflow: 'hidden'}}>
			<InkDuo
				cam={cam}
				seam={seam}
				meet={meet}
				caveDark={caveDark}
				flood={floodR > 0 ? {x: 960 + meet * 40, y: 520, radius: floodR} : undefined}
			/>
			<CamLayer cam={cam} k={1}>
				<PokemonArt3D
					dir="pokemon/mewtwo"
					x={MT.x}
					y={MT.y}
					size={MT.size}
					yaw={2}
					pitch={-2}
					depthScale={0.5}
					opacity={mtO}
					resolution={2}
					rim={{dir: [-1, -0.3], color: [1.1 * glow, 0.95 * glow, 0.6 * glow], power: 1.8}}
					ink={{silhouette: 1, reveal: 1, paint: 1, color: 0, line: 0.9, halo: 0.6, wash: 0.7, time: frame / 30, center: [0.5, 0.4]}}
				/>
				{mewO > 0 && (
					<PokemonArt3D
						dir="pokemon/mew"
						x={mewPos.x + Math.sin(frame / 50) * 16}
						y={mewPos.y + Math.sin(frame / 34) * 11}
						size={MEW_SIZE}
						yaw={Math.sin(frame / 60) * 4}
						depthScale={0.5}
						opacity={mewO}
						resolution={2.2}
						style={mewBlur > 0.05 ? {filter: `blur(${mewBlur}px)`} : undefined}
						ink={{
							silhouette: mewSil,
							reveal: mewReveal,
							paint: 1,
							color: mewColor,
							line: 0.9 * mewReveal,
							halo: 0.6 * mewSil,
							wash: 0.6 * mewReveal,
							time: frame / 30,
							center: [0.5, 0.5],
						}}
					/>
				)}
			</CamLayer>
			<PaperVignette strength={0.85} />

			{/* 旁白（制作者撰写） */}
			<BiSubtitle
				{...SUB}
				from={T.subMewtwo[0]}
				to={T.subMewtwo[1]}
				zh="超梦独自留在了漆黑的洞窟深处。"
				en="Mewtwo remained alone, deep in the pitch-dark cave."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			{/* 旁白：依据《蓝》图鉴"至今仍被人称为幻之宝可梦……几乎没有几个人目睹过它的身姿" */}
			<BiSubtitle
				{...SUB}
				from={T.subMew[0]}
				to={T.subMew[1]}
				zh="而梦幻依旧自由自在，几乎无人见过它的身影。"
				en="Mew, meanwhile, still roams free, and almost no one has ever seen it."
				source={{zh: '旁白（依据《蓝》图鉴）', en: 'NARRATION'}}
			/>
			<BiSubtitle
				{...SUB}
				from={T.subHide[0]}
				to={T.subHide[1]}
				zh="因为可以随心所欲地隐形，所以就算接近人类也完全不会被察觉。"
				en="It is capable of making itself invisible at will, so it entirely avoids notice even if it approaches people."
				source={{zh: '梦幻图鉴《欧米伽红宝石·阿尔法蓝宝石》', en: 'POKÉDEX · OMEGA RUBY / ALPHA SAPPHIRE'}}
			/>
			{/* 旁白：依据《金》图鉴（52poke 中文为站内译文，不引用原文） */}
			<BiSubtitle
				{...SUB}
				from={T.subPure[0]}
				to={T.subPure[1]}
				zh="据说，只有心灵纯洁、又真心想见它的人，才能见到它。"
				en="It is said that only those who are pure of heart and truly wish to see it ever can."
				source={{zh: '旁白（依据《金》图鉴）', en: 'NARRATION'}}
			/>
			{/* 旁白：本期主题（用户确认） */}
			<BiSubtitle
				{...SUB}
				from={T.subHeart[0]}
				to={T.subHeart[1]}
				zh="几乎相同的基因，却是截然不同的心。"
				en="Almost identical genes, yet utterly different hearts."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<Grain opacity={0.06} />
		</AbsoluteFill>
	);
};
