import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, flow} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer} from '../../components/CamLayer';
import {Grain} from '../../components/Grain';
import {DiaryLine, DiaryText} from '../../components/ink/DiaryText';
import {FallingDrop} from '../../components/ink/FallingDrop';
import {InkDiary, PaperVignette} from '../../components/ink/InkPaper';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {SUB} from './subtitles';

// ─── 第 3 期 · 第 3 段「日记」（720 帧 = 24 秒）──────────────────────────
// 接上段的满屏浓墨：墨退开，露出宝可梦屋里那本页角烧焦的研究日记 → 日记逐条写出
// （发现 → 命名，左页画着梦幻的白描速写 → 梦幻生下孩子，取名超梦）→ 一滴浓墨落在纸上洇开，镜头推进墨渍，接下一段
// 日记字迹就是这几句的字幕（中文 + 英文小字），不再另出底部字幕。
export const DIARY_SCENE_FRAMES = 720;

// 日记：中文为 52poke「宝可梦屋」页面的译文（第一、三世代版本，保留"圭亚那"；初代原文没有官方中文，用户决定采用）；
// 英文为初代游戏原文（Bulbapedia「Pokémon Mansion journals」）。
const ENTRIES: {lines: DiaryLine[]; en: string; source: string}[] = [
	{
		lines: [{text: '日记　7月5日'}, {text: '这里是南美洲的圭亚那。'}, {text: '在丛林的深处发现了一种新的宝可梦。'}],
		en: 'Diary: July 5. Guyana, South America. A new Pokémon was discovered deep in the jungle.',
		source: '宝可梦屋日记（52poke 译文 / 初代英文）',
	},
	{
		lines: [{text: '日记　7月10日'}, {text: '我给新发现的宝可梦取名为梦幻。', strong: '梦幻'}],
		en: 'Diary: July 10. We christened the newly discovered Pokémon, Mew.',
		source: '宝可梦屋日记（52poke 译文 / 初代英文）',
	},
	{
		lines: [{text: '日记　2月6日'}, {text: '梦幻诞生了一个孩子。'}, {text: '就把刚出生的少年叫做超梦吧……', strong: '超梦'}],
		en: 'Diary: Feb. 6. Mew gave birth. We named the newborn Mewtwo.',
		source: '宝可梦屋日记（52poke 译文 / 初代英文）',
	},
];

const RATE = 2.6;
const T = {
	clear: [0, 120] as const,
	subIntro: [44, 150] as const,
	e1: 156,
	sketch: [240, 320] as const,
	e2: 318,
	e3: 452,
	fall: [580, 602] as const, // 第 3 条日记约在 565 帧写完
	flood: [640, 720] as const, // 墨渍里涌出浓墨，收成黑场接下一段
};

// 书页上的位置（横格基线 y = 253 + 66n）
const POS = [
	{x: 222, y: 253},
	{x: 222, y: 253 + 66 * 5},
	{x: 1048, y: 253},
];
const SKETCH = {x: 640, y: 852, size: 270};
const BLOT = {x: 1390, y: 760, at: T.fall[1], size: 300};

const getCam = (f: number): Cam => ({
	x: flow(f, [
		[0, 960],
		[120, 940],
		[160, 600],
		[300, 610],
		[420, 640],
		[470, 1320],
		[580, 1350],
		[720, BLOT.x],
	]),
	y: flow(f, [
		[0, 540],
		[120, 540],
		[160, 380],
		[300, 560],
		[420, 640],
		[470, 400],
		[580, 560],
		[720, BLOT.y],
	]),
	zoom: flow(f, [
		[0, 1.12],
		[120, 1.0],
		[160, 1.42],
		[300, 1.4],
		[420, 1.25],
		[470, 1.42],
		[580, 1.3],
		[720, 3.8],
	]),
	roll: flow(f, [
		[0, -0.6],
		[300, 0.5],
		[470, -0.4],
		[720, 1.2],
	]),
});

export const DiaryScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);

	const clearR = interpolate(frame, [T.clear[0], T.clear[1] - 40, T.clear[1]], [60, 1900, 6000], {...clamp, easing: Easing.inOut(Easing.sin)});
	const covered = frame < T.clear[1];
	const floodR = interpolate(frame, [T.flood[0], T.flood[1]], [0, 700], {...clamp, easing: Easing.in(Easing.quad)});

	// 梦幻的白描速写：先洇出墨影，再显出线条
	const sil = interpolate(frame, [T.sketch[0], T.sketch[0] + 30], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const reveal = interpolate(frame, [T.sketch[0] + 20, T.sketch[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});

	return (
		<AbsoluteFill style={{background: '#120e0b', overflow: 'hidden'}}>
			<InkDiary
				cam={cam}
				blot={BLOT}
				flood={covered ? {x: 960, y: 540, radius: 4200} : floodR > 0 ? {x: BLOT.x, y: BLOT.y, radius: floodR} : undefined}
				clear={covered ? {x: 960, y: 540, radius: clearR} : undefined}
			/>
			<CamLayer cam={cam} k={1}>
				{frame >= T.sketch[0] && (
					<PokemonArt3D
						dir="pokemon/mew"
						x={SKETCH.x}
						y={SKETCH.y}
						size={SKETCH.size}
						yaw={0}
						depthScale={0.5}
						resolution={2.4}
						// 画在纸上：正片叠底，留白处就是纸色
						style={{mixBlendMode: 'multiply'}}
						ink={{silhouette: 0.45 * sil * (1 - reveal), reveal, paint: 1, color: 0, line: 0.9 * reveal, halo: 0.25 * sil, wash: 0.35, time: frame / 30, center: [0.5, 0.45]}}
					/>
				)}
				{ENTRIES.map((e, i) => (
					<DiaryText key={i} frame={frame} from={[T.e1, T.e2, T.e3][i]} x={POS[i].x} y={POS[i].y} lines={e.lines} en={e.en} width={680} rate={RATE} size={37} seed={i + 1} />
				))}
			</CamLayer>
			<FallingDrop cam={cam} frame={frame} k={1} at={BLOT} from={T.fall[0]} to={T.fall[1]} />
			<PaperVignette strength={0.8} />

			{/* 旁白（制作者撰写）：日记所在地。宝可梦屋位于红莲岛 */}
			<BiSubtitle
				{...SUB}
				from={T.subIntro[0]}
				to={T.subIntro[1]}
				zh="红莲岛上，荒废的宝可梦屋里，留下了几页日记。"
				en="In the abandoned Pokémon Mansion on Cinnabar Island, a few pages of a diary remain."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			{ENTRIES.map((entry, i) => (
				<BiSubtitle
					key={i}
					{...SUB}
					from={[T.e1, T.e2, T.e3][i]}
					to={[T.e2 - 6, T.e3 - 6, T.flood[0] - 8][i]}
					zh={entry.lines.map(({text}) => text).join('　')}
					en={entry.en}
					source={{zh: entry.source, en: entry.source}}
					wipe={30}
				/>
			))}
			<Grain opacity={0.06} />
		</AbsoluteFill>
	);
};
