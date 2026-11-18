import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, flow} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer} from '../../components/CamLayer';
import {Grain} from '../../components/Grain';
import {Branch, InkBranches} from '../../components/ink/InkBranches';
import {InkMountains, PaperVignette} from '../../components/ink/InkPaper';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {SUB} from './subtitles';

// ─── 第 3 期 · 第 2 段「祖先」（600 帧 = 20 秒）──────────────────────────
// 接上段梦幻飞出画面：梦幻从左侧飞入云雾远山 → 周身泛起泥金光 → 墨丝与金线向天空分枝生长，
// 枝头洇出各种宝可梦的纯墨剪影（像一棵谱系树），镜头拉远看全 → 墨潮自梦幻漫开，吞没画面接下一段
// 剪影只作象征，不算正式登场，不放叫声。
export const ANCESTOR_SCENE_FRAMES = 600;

const T = {
	enter: [0, 100] as const,
	subGene: [26, 150] as const,
	glow: [100, 170] as const,
	branch: 150, // 第一根墨丝开始生长
	subTrace: [236, 356] as const,
	subFound: [388, 492] as const,
	flood: [486, 600] as const,
};

const MEW = {x: 960, y: 620};

// 枝头的宝可梦（从左到右排成一道弧）
const KIN = [
	{dir: 'pokemon/bulbasaur', size: 280},
	{dir: 'pokemon/charmander', size: 280},
	{dir: 'pokemon/squirtle', size: 280},
	{dir: 'pokemon/pikachu', size: 280},
	{dir: 'pokemon/eevee', size: 280},
	{dir: 'pokemon/gengar', size: 300},
	{dir: 'pokemon/snorlax', size: 320},
	{dir: 'pokemon/dragonite', size: 320},
];
// 生长顺序：从中间向两边交替
const ORDER = [3, 4, 2, 5, 1, 6, 0, 7];

const BRANCHES: Branch[] = KIN.map((_, i) => {
	const a = ((192 + (i * (348 - 192)) / (KIN.length - 1)) * Math.PI) / 180;
	return {
		to: {x: MEW.x + Math.cos(a) * 820, y: MEW.y + Math.sin(a) * 470},
		start: T.branch + ORDER.indexOf(i) * 13,
		dur: 82,
		bend: i % 2 ? 0.16 : -0.16,
		width: 24,
		seed: i * 3.7 + 1.1,
	};
});

const getCam = (f: number): Cam => ({
	x: flow(f, [
		[0, 780],
		[100, 940],
		[330, 960],
		[600, 975],
	]),
	y: flow(f, [
		[0, 560],
		[150, 580],
		[330, 490],
		[480, 488],
		[600, 600],
	]),
	zoom: flow(f, [
		[0, 1.12],
		[150, 1.1],
		[340, 0.8],
		[480, 0.78],
		[600, 1.05],
	]),
	roll: flow(f, [
		[0, 0.8],
		[300, -0.4],
		[600, 0.6],
	]),
});

export const AncestorScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);

	// 梦幻从左侧飞入、由远及近
	const enter = interpolate(frame, [T.enter[0], T.enter[1]], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const mx = interpolate(enter, [0, 1], [-160, MEW.x]) + Math.sin(frame / 53) * 6;
	const my = interpolate(enter, [0, 1], [380, MEW.y]) + Math.sin(frame / 38) * 8;
	const mSize = interpolate(enter, [0, 1], [260, 480]);
	const yaw = Math.max(-7, Math.min(7, (1 - enter) * 6 + Math.sin(frame / 70) * 2));

	const glow = interpolate(frame, [T.glow[0], T.glow[1], T.flood[0], T.flood[0] + 50], [0, 1, 1, 0], clamp);
	const flood = interpolate(frame, [T.flood[0], T.flood[1]], [0, 2700], {...clamp, easing: Easing.in(Easing.quad)});
	const fade = interpolate(frame, [T.flood[0] + 30, T.flood[1] - 16], [1, 0], clamp);
	const ink = frame / 30;

	return (
		<AbsoluteFill style={{background: '#d8c9a6', overflow: 'hidden'}}>
			<InkMountains cam={cam} sun={{x: 1450, y: 250, radius: 110}} flood={flood > 0 ? {x: MEW.x, y: MEW.y, radius: flood} : undefined} />
			<CamLayer cam={cam} k={1}>
				{/* 泥金光：从梦幻周身向外晕开 */}
				<div
					style={{
						position: 'absolute',
						left: MEW.x - 700,
						top: MEW.y - 700,
						width: 1400,
						height: 1400,
						opacity: glow * fade,
						background: 'radial-gradient(circle, rgba(255,222,150,0.75) 0%, rgba(240,190,100,0.35) 22%, rgba(220,170,90,0.1) 45%, transparent 65%)',
					}}
				/>
				<InkBranches frame={frame} origin={{x: MEW.x, y: MEW.y - 20}} branches={BRANCHES} opacity={fade} />
				{KIN.map((k, i) => {
					const b = BRANCHES[i];
					const born = b.start + b.dur - 12;
					if (frame < born) return null;
					const sil = interpolate(frame, [born, born + 36], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
					const reveal = interpolate(frame, [born + 30, born + 74], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
					return (
						<PokemonArt3D
							key={k.dir}
							dir={k.dir}
							x={b.to.x + Math.sin(frame / 47 + i) * 5}
							y={b.to.y - k.size * 0.38 + Math.sin(frame / 41 + i * 2) * 6}
							size={k.size}
							yaw={Math.sin(frame / 80 + i) * 3}
							pitch={2}
							depthScale={0.5}
							opacity={fade}
							resolution={1.6}
							ink={{silhouette: sil, reveal, paint: 1, color: 0, line: 0.6 * reveal, halo: sil * 0.8, wash: 0.6 * reveal, time: ink + i, center: [0.5, 0.55]}}
						/>
					);
				})}
				<PokemonArt3D
					dir="pokemon/mew"
					x={mx}
					y={my}
					size={mSize}
					yaw={yaw}
					pitch={2}
					depthScale={0.5}
					opacity={fade}
					resolution={2}
					emissive={0}
					ink={{silhouette: 1, reveal: 1, paint: 1, color: 0.3, line: 0.85, halo: 0.7, wash: 0.7, time: ink, center: [0.5, 0.45]}}
				/>
			</CamLayer>
			<PaperVignette />

			{/* 旁白（制作者撰写）：依据多版图鉴"梦幻拥有所有宝可梦的遗传基因" */}
			<BiSubtitle
				{...SUB}
				from={T.subGene[0]}
				to={T.subGene[1]}
				zh="据说，梦幻的遗传基因里，含有所有宝可梦的信息。"
				en="It is said that Mew's genes hold the information of every Pokémon."
				source={{zh: '旁白（依据《绿宝石》《欧米伽红宝石》等图鉴）', en: 'NARRATION'}}
			/>
			{/* 旁白（制作者撰写）：承接"许多人认为它是所有宝可梦的祖先"，用假设语气 */}
			<BiSubtitle
				{...SUB}
				from={T.subTrace[0]}
				to={T.subTrace[1]}
				zh="倘若真是如此，世间千千万万的宝可梦，都能追溯到它的身上。"
				en="If that is true, every one of the countless Pokémon in the world can be traced back to it."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			{/* 旁白（制作者撰写）：引出宝可梦屋日记 */}
			<BiSubtitle
				{...SUB}
				from={T.subFound[0]}
				to={T.subFound[1]}
				zh="然而，这只幻之宝可梦，终究还是被人类找到了。"
				en="Yet in the end, this mythical Pokémon was found by humans."
				source={{zh: '旁白（依据宝可梦屋日记）', en: 'NARRATION'}}
			/>
			<Grain opacity={0.06} />
		</AbsoluteFill>
	);
};
