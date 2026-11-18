import {useMemo} from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Grain} from '../../components/Grain';
import {CINZEL, SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {cellCount, cellsOf, cellTexture, DOT_R, MAX_COLS, MAX_LINES, PANELS, SLOT} from './braille';
import {Cam, camFrom, flow, PART_CARD, project, T, track} from './common';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {DotMorph, Stage} from './DotMorph';
import {bookDots, CONT, MAP_N, Pt} from './shapes';
import {GLView} from './GLView';
import {MapLinks, RegirockLayer, rockStages, StrataView} from './RockSeg';
import {useArtMask} from './Rocks';
import {CoastView, coastOpacity, Dots, KingRopes, MapBehind, Pressure, RegiceLayer, RegigigasLayer, RegisteelLayer, Threads} from './GiantsSeg';
import {NameTag} from '../../components/NameTag';
import {Cry} from '../../components/Cry';
import {HALL_FRAG, SEA_FRAG} from './gl';
import {DoorActors, DoorFront, DoorLabels, DoorsSixFx, DoorsView, SnowFront, TundraActors, TundraView} from './FearSeg';
import {Notebook, Peony, UnovaFx, UnovaView} from './DoorsSeg';
import {DoorLight, GiantsAtDoor, KingChamber} from './KingSeg';
import {AncientDoor, AweWords, GalarCity, HALL_CAM_F, hotF, LockedEleki} from './AweSeg';
import {BasementDoor, BasementFx, BasementGigas, GalarBed, hisuiOpacity, HisuiView, KingDots, TempleHall, TodayScene, TodayWall} from './KeySeg';
import {Dust, hallCamC, Letters, RiddleFx, RiddleView, SeaGuests, TABLET_READ} from './TrialSeg';

/**
 * 《敬畏》整期总时间轴。镜头、光、读字进度都是整期帧号 f 的函数；各段（Segments.tsx）只是窗口。
 */

const SPEED = 1.25;

// ── 1 海底的石室 ──

/** 深海镜头：下潜到岩缝；离开石室后一路升向海面 */
const SEA_CAM: [number, number[]][] = [
	[T.sea, [0, -8, 40, 0, -0.3, 55]],
	[90, [0, -27, 25, 0, -0.55, 55]],
	[T.dive, [0, -50, 9, 0, -0.86, 55]],
	[T.splashIn, [0, -58.4, 0.35, 0, -1.36, 55]],
];
const SEA_CAM_OUT: [number, number[]][] = [
	[T.splashOut, [0, -58.5, 0.4, 0, -1.5, 55]],
	[1040, [0, -45, 2.6, 0, -1.42, 55]],
	[T.title, [0, -29, 8, 0, -1.0, 55]],
	[1200, [0, -19, 13, 0, -0.32, 55]],
	[T.end1, [0, -15.5, 15, 0, -0.14, 55]],
];

/** 第 2 段：停在片名的机位，讲完传说后慢慢低头看向海底 */
const SEA_CAM_LEGEND: [number, number[]][] = [
	[T.end1, [0, -15.5, 15, 0, -0.14, 55]],
	[1700, [0, -16, 15, 0, -0.14, 55]],
	[T.end2, [0, -26, 12.5, 0, -0.8, 55]],
];

/** 第 3 段：再一次潜向岩缝，光点没入地里 */
const SEA_CAM_ROCK: [number, number[]][] = [
	[T.end2, [0, -26, 12.5, 0, -0.8, 55]],
	[T.strata + 16, [0, -59.0, 0.3, 0, -1.5, 55]],
];

/** 石室镜头：墙面在 z = 0 */
const HALL_CAM: [number, number[]][] = [
	[T.splashIn, [0, 0.1, 7.4, 0, 0.1, 58]],
	[260, [0, 1.3, 7.2, 0, 0.1, 56]],
	[340, [0, 2.75, 6.1, 0, 0.0, 52]],
	[395, [-3.86, 4.23, 0.78, 0, 0, 38]],
	[440, [-3.84, 4.23, 0.7, 0, 0, 38]],
	[475, [-3.15, 4.12, 2.3, 0, 0, 40]],
	[530, [-2.85, 4.1, 2.4, 0, 0, 40]],
	[548, [0, 4.05, 3.3, 0, 0, 42]],
	[566, [2.95, 4.1, 2.5, 0, 0, 40]],
	[600, [3.1, 4.1, 2.4, 0, 0, 40]],
	[616, [0, 2.95, 3.3, 0, 0, 42]],
	[634, [-3.0, 2.72, 2.5, 0, 0, 40]],
	[700, [-2.8, 2.72, 2.4, 0, 0, 40]],
	[716, [0, 2.75, 3.3, 0, 0, 42]],
	[734, [3.0, 2.72, 2.3, 0, 0, 40]],
	[785, [3.05, 2.72, 1.85, 0, 0, 40]],
	[850, [0, 3.4, 5.8, 0, 0, 50]],
	[915, [0, 3.35, 6.2, 0, 0, 50]],
	[960, [0, 1.0, 8.2, 0, -0.02, 54]],
	[T.splashOut, [0, 0.06, 8.7, 0, -0.08, 56]],
];
/** 第 4 段结尾：从门缝的光里回到石室，慢慢拉远看到整面墙 */
const HALL_CAM_B: [number, number[]][] = [
	[T.back - 10, [-0.4, 1.9, 3.3, 0, 0.02, 48]],
	[T.endB, [0, 2.45, 6.7, 0, 0, 52]],
];

/** 第 6 段结尾：回到石室，读最后两块石板（左下、右下），再拉远看整面墙 */
const HALL_CAM_D: [number, number[]][] = [
	[T.last - 10, [0, 2.3, 6.4, 0, 0, 52]],
	[T.courage - 6, [-3.0, 1.34, 2.5, 0, 0, 40]],
	[T.courage + 56, [-2.9, 1.34, 2.4, 0, 0, 40]],
	[T.courage + 90, [3.0, 1.34, 2.5, 0, 0, 40]],
	[T.eternal + 44, [3.05, 1.34, 2.4, 0, 0, 40]],
	[T.endD, [0, 2.6, 6.8, 0, 0, 52]],
];

/** 各块石板读到第几格 */
const readAt = (f: number): number[] => {
	const r = PANELS.map(() => 0);
	r[0] = track(f, [[405, 0], [418, 1], [T.read1 + 4, 1], [T.read1 + 78, cellCount(0)]], (t) => t);
	r[1] = track(f, [[T.read2, 0], [T.read2 + 54, cellCount(1)]], (t) => t);
	r[2] = track(f, [[T.read3 + 4, 0], [T.read3 + 86, cellCount(2)]], (t) => t);
	r[3] = track(f, [[T.read4 + 6, 0], [T.read4 + 58, cellCount(3)]], (t) => t);
	r[6] = track(f, TABLET_READ, (t) => t);
	r[4] = track(f, [[T.courage + 4, 0], [T.courage + 60, cellCount(4)]], (t) => t);
	r[5] = track(f, [[T.courage + 90, 0], [T.courage + 108, 12], [T.eternal + 2, 12], [T.eternal + 40, cellCount(5)]], (t) => t);
	return r;
};
const hotAt = (f: number): number[] => {
	if (f >= T.awe) return hotF(f);
	const base = track(f, [[T.both, 0.55], [T.both + 30, 0.3], [T.leave, 0.3], [T.splashOut, 0.25]]);
	const key = track(f, [[T.both, 0.55], [T.both + 30, 1.1], [T.leave, 1.1], [T.splashOut, 0.5]]);
	// 第 5 段：大石板读完后留着光，地震时整块亮起
	const tab = interpolate(f, [T.tablet + 120, T.tablet + 150], [0, 0.5], clamp) + interpolate(f, [T.quake, T.quake + 6, T.quake + 60], [0, 1.3, 0.5], clamp);
	// 第 6 段：最后两块读完后留着光；读完"永恒的宝可梦"时整面墙一起亮起（中篇完）
	const fin = interpolate(f, [T.eternal + 46, T.eternal + 62, T.endD], [0, 1, 0.7], clamp);
	const p4 = interpolate(f, [T.courage + 60, T.courage + 80], [0, 0.5], clamp);
	const p5 = interpolate(f, [T.eternal + 40, T.eternal + 56], [0, 0.5], clamp);
	return [base + fin, key + fin, base + fin, key + fin, p4 + fin, p5 + fin, tab + fin];
};

const CELLS = cellTexture();
const TABLET_WHICH = [6];
const LAST_WHICH = [4, 5];
const AWE_WHICH = [1, 3];
const PANEL_U = PANELS.flatMap((p) => [p.cx, p.cy, p.w, p.h]);
const LINES_U = PANELS.map((p) => p.lines.length);

/** 读到的点字格上方浮出对应的字母；"这是点字"那句时，第一格画出六个点位 */
const BrailleOverlay: React.FC<{f: number; cam: Cam; read: number[]}> = ({f, cam, read}) => {
	const cells = useMemo(() => [0, 1, 2, 3].map((i) => cellsOf(i)), []);
	const show = interpolate(f, [395, 410, T.leave - 20, T.leave + 10], [0, 1, 1, 0], clamp);
	const explain = interpolate(f, [372, 390, 440, 462], [0, 1, 1, 0], clamp);
	const first = cells[0][0];
	const fp = project(cam, [first.x, first.y, 0.03]);
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
			{explain > 0 && fp
				? SLOT.map(([dx, dy], k) => {
						const p = project(cam, [first.x + dx, first.y + dy, 0.03])!;
						const raised = k === 1 || k === 3; // I = 点 2、4
						return (
							<g key={k} opacity={explain}>
								<circle cx={p.x} cy={p.y} r={DOT_R * p.s * 1.55} fill="none" stroke="rgba(255,226,170,0.85)" strokeWidth={2} strokeDasharray={raised ? undefined : '5 6'} />
								<text x={p.x + (k < 3 ? -1 : 1) * DOT_R * p.s * 2.6} y={p.y} fill="rgba(255,226,170,0.8)" fontFamily={CINZEL} fontSize={DOT_R * p.s * 1.1} textAnchor="middle" dominantBaseline="central">
									{k + 1}
								</text>
							</g>
						);
					})
				: null}
			{show > 0
				? cells.map((cs, pi) =>
						cs.map((c) => {
							if (c.ch === ' ') return null;
							const lit = Math.min(Math.max(read[pi] - c.order, 0), 1);
							if (lit <= 0) return null;
							const p = project(cam, [c.x, c.y + 0.112, 0.04]);
							if (!p) return null;
							const fs = p.s * 0.068;
							const vis = Math.min(Math.max((fs - 9) / 8, 0), 1);
							if (vis <= 0 || p.x < -50 || p.x > 1970) return null;
							return (
								<text
									key={`${pi}-${c.order}`}
									x={p.x}
									y={p.y}
									fill="#ffe2a8"
									opacity={show * vis * lit}
									fontFamily={CINZEL}
									fontWeight={600}
									fontSize={fs}
									textAnchor="middle"
									dominantBaseline="central"
									style={{filter: `drop-shadow(0 0 ${fs * 0.3}px rgba(255,180,80,0.9))`}}
								>
									{c.ch}
								</text>
							);
						}),
					)
				: null}
		</svg>
	);
};

/** 篇章卡：画面正中一行金字，下面七个光点依次亮起（与上篇标题下的"上篇 · 巨人"同一字体） */
const PartCard: React.FC<{f: number; at: number; len: number; text: string}> = ({f, at, len, text}) => {
	const o = interpolate(f, [at, at + 18, at + len - 16, at + len], [0, 1, 1, 0], clamp);
	if (o <= 0) return null;
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: o}}>
			<div style={{position: 'absolute', left: 0, width: 1920, top: 440, textAlign: 'center', fontFamily: SERIF, fontWeight: 600, fontSize: 60, letterSpacing: 20, paddingLeft: 20, color: '#f1d9a6', textShadow: '0 0 22px rgba(255,180,80,0.55), 0 0 6px rgba(0,0,0,0.9)'}}>
				{text}
			</div>
			<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
				{Array.from({length: 7}, (_, i) => {
					const a = interpolate(f, [at + 14 + i * 4, at + 24 + i * 4], [0, 1], clamp);
					return <circle key={i} cx={960 + (i - 3) * 26} cy={560} r={4} fill="#ffd68f" opacity={a * (0.75 + 0.25 * Math.sin(f * 0.15 + i))} style={{filter: 'drop-shadow(0 0 6px rgba(255,180,80,0.9))'}} />;
				})}
			</svg>
		</div>
	);
};

type Sub = {from: number; to: number; zh: string; en: string; src: {zh: string; en: string}};
const NARR = {zh: '旁白', en: 'NARRATION'};
const BRAILLE = (en: string) => ({zh: `旁白（据布告石室点字）`, en: `Narration (Sealed Chamber braille: ${en})`});

const SUBS: Sub[] = [
	{from: 18, to: 104, zh: '丰缘的海底深处，藏着一间石室。', en: 'Deep beneath the sea of Hoenn lies a stone chamber.', src: NARR},
	{from: 262, to: 348, zh: '墙上没有画，只有一排排凸起的小点。', en: 'Its walls bear no paintings—only rows of tiny raised dots.', src: NARR},
	{from: 356, to: 442, zh: '这是点字，一种用指尖去读的文字。', en: 'This is braille, a script read with the fingertips.', src: NARR},
	{from: T.read1 + 2, to: T.read2 - 6, zh: '写下它的人说：我们在这个洞里生活，', en: 'Those who wrote it said: we have lived in this cave,', src: BRAILLE('IN THIS CAVE WE HAVE LIVED.')},
	{from: T.read2 + 2, to: T.read3 - 6, zh: '一切都要感谢宝可梦。', en: 'and we owe everything to the Pokémon.', src: BRAILLE('WE OWE ALL TO THE POKéMON.')},
	{from: T.read3 + 2, to: T.read4 - 10, zh: '可下一句却是：我们把那只宝可梦封印了。', en: 'Yet the next line reads: we sealed that Pokémon away.', src: BRAILLE('BUT, WE SEALED THE POKéMON AWAY.')},
	{from: T.read4 + 6, to: T.both - 8, zh: '因为我们害怕它。', en: 'Because we feared it.', src: BRAILLE('WE FEARED IT.')},
	{from: T.both + 4, to: T.leave - 6, zh: '心怀感激，却又把它关了起来。他们关住的，究竟是什么？', en: 'Grateful, and yet they locked it away. What exactly did they lock up?', src: NARR},
	{from: T.leave + 4, to: 1068, zh: '还有一件怪事：他们说自己住在这里，可这间石室，如今沉在海底。', en: 'And something stranger: they said they lived here—yet this chamber now lies at the bottom of the sea.', src: NARR},
	// 2 存疑的传说
	{from: T.legend + 10, to: T.giant - 4, zh: '要找答案，得先从一个更古老的传说说起。', en: 'To find the answer, we must start with an older legend.', src: NARR},
	{from: T.giant + 4, to: T.book - 8, zh: '传说很久以前，有个巨人用绳子捆住大陆，把它们拖到了今天的位置。', en: 'Long ago, legend says, a giant bound the continents with rope and dragged them to where they lie today.', src: {zh: '旁白（据晶灿钻石·明亮珍珠、盾 图鉴）', en: 'Narration (after BDSP / Shield Pokédex)'}},
	{from: T.book + 2, to: T.truth - 6, zh: '在洗翠时代，一位博士把它写进了图鉴，还在后面加了一句：', en: 'In the Hisui era, a professor recorded it in the Pokédex, and added a note:', src: NARR},
	{from: T.truth + 2, to: T.fall - 6, zh: '传说内容虽存疑，但其中或许蕴藏着一丝真理。', en: 'Though I have my doubts, the story could well contain a shred of truth.', src: {zh: '图鉴原文：传说 阿尔宙斯', en: 'Pokédex: Legends: Arceus'}},
	{from: T.fall + 2, to: T.end2 - 22, zh: '如果真有这一丝真理，它就藏在三个巨人的身上。', en: 'If that shred of truth exists, it lies within three giants.', src: NARR},
	// 3 岩石巨人
	{from: 2052, to: 2128, zh: '第一个巨人，全身都是岩石。', en: 'The first giant is made entirely of rock.', src: NARR},
	{from: T.scan, to: T.lands - 7, zh: '人们用最新的技术调查过它的身体，却连大脑和心脏都没找到。', en: 'Studied with the latest technology, its body showed no brain—and no heart.', src: {zh: '旁白（据盾 图鉴）', en: 'Narration (after Shield Pokédex)'}},
	{from: T.lands, to: T.columns - 8, zh: '更奇怪的是，构成它的石头，是从许多不同的土地里挖出来的。', en: 'Stranger still, its rocks were dug from many different lands.', src: {zh: '旁白（据蓝宝石 / 阿尔法蓝宝石 英文图鉴）', en: 'Narration (after Sapphire / Alpha Sapphire Pokédex)'}},
	{from: T.columns, to: T.atlantic - 6, zh: '世界各地的地层里，都能找到和它身上一样的石头。', en: 'Rocks just like its own can be found in strata all over the world.', src: {zh: '旁白（据心金魂银 / Y 图鉴）', en: 'Narration (after HGSS / Y Pokédex)'}},
	{from: T.atlantic, to: T.fit - 6, zh: '在我们的世界，科学家也注意过类似的事：', en: 'In our world, scientists noticed something similar:', src: NARR},
	{from: T.fit, to: T.drift - 6, zh: '大西洋两岸的岩层和化石，竟然能像拼图一样对上。', en: 'the rock layers and fossils on both sides of the Atlantic fit together like a puzzle.', src: NARR},
	{from: T.drift, to: T.home - 6, zh: '他们由此推断，大陆曾经连成一片，后来才慢慢漂开。', en: 'From this they concluded the continents were once joined, and slowly drifted apart.', src: NARR},
	{from: T.home, to: T.end3 - 18, zh: '一个用各地石头拼成的巨人，正好对上了拖动大陆的传说。', en: 'A giant pieced together from the stones of many lands—it matches the legend of the moving continents.', src: NARR},
	// 第 3 段 冰河、地底与造物主
	{from: T.giants + 6, to: T.giants + 82, zh: '第二个巨人，来自一个更寒冷的过去。', en: 'The second giant comes from a colder past.', src: NARR},
	{from: T.regice - 20, to: T.magma - 6, zh: '它诞生在冰河时期厚厚的冰层下，又在冰河里睡了几千年。', en: 'Born beneath thick ice in the ice age, it slept in a glacier for thousands of years.', src: {zh: '旁白（据盾、心金魂银 / X 图鉴）', en: 'Narration (after Shield / HGSS / X Pokédex)'}},
	{from: T.magma, to: T.coast - 8, zh: '它的身体冷到连熔岩都化不开。', en: 'Its body is so cold that not even magma can melt it.', src: {zh: '旁白（据心金魂银 / X 图鉴）', en: 'Narration (after HGSS / X Pokédex)'}},
	{from: T.coast + 6, to: T.seaDrop + 86, zh: '在我们的世界，冰河时期有大量的海水冻成了冰川，', en: 'In our world, during the ice age, vast amounts of seawater froze into glaciers,', src: NARR},
	{from: T.seaDrop + 92, to: T.melt - 6, zh: '那时的海面，比今天低一百多米。', en: 'and the sea stood more than a hundred meters lower than today.', src: NARR},
	{from: T.melt, to: T.cave - 8, zh: '冰川融化以后，海面上涨，古人住过的许多海岸都沉进了海里。', en: 'When the glaciers melted, the sea rose, and many coasts where ancient people lived sank beneath it.', src: NARR},
	{from: T.cave, to: T.cave + 92, zh: '丰缘的那间石室为什么沉在海底，没有人留下记载。', en: 'No record tells why the chamber in Hoenn lies under the sea.', src: NARR},
	{from: T.cave + 98, to: T.deep - 4, zh: '但它也许，经历过同样的事。', en: 'But perhaps it went through the very same thing.', src: NARR},
	{from: T.deep + 8, to: T.deep + 80, zh: '第三个巨人，来自更深的地方。', en: 'The third giant comes from somewhere deeper.', src: NARR},
	{from: T.deep + 88, to: T.pressure - 6, zh: '据说它诞生在地壳之下的地幔里，大约一万年前才来到地面。', en: 'It is said to have been born in the mantle beneath the crust, reaching the surface about ten thousand years ago.', src: {zh: '旁白（据盾 图鉴）', en: 'Narration (after Shield Pokédex)'}},
	{from: T.pressure, to: T.metal - 8, zh: '几万年的地下压力，把它锤炼得刀枪不入，可它的身体里面却是空的。', en: 'Tens of thousands of years of pressure forged it nearly indestructible—yet its body is hollow inside.', src: {zh: '旁白（据白金 / 晶灿钻石、心金魂银 / Y 图鉴）', en: 'Narration (after Pt / BDSP / HGSS / Y Pokédex)'}},
	{from: T.metal, to: T.tri - 6, zh: '有人认为，构成它的金属，是地球上不存在的物质。', en: 'Some believe the metal that forms it exists nowhere else on earth.', src: {zh: '旁白（据阿尔法蓝宝石 英文图鉴）', en: 'Narration (after Alpha Sapphire Pokédex)'}},
	{from: T.tri + 6, to: T.tri + 90, zh: '地面的岩层，远古的冰河，地底的地幔。', en: 'The rock of the surface. The ice of the ancient past. The mantle far below.', src: NARR},
	{from: T.tri + 96, to: T.tri + 190, zh: '三个巨人，是用地球的表面、过去和深处做成的。', en: "The three giants were made from the earth's surface, its past, and its depths.", src: NARR},
	{from: T.tri + 196, to: T.dots - 6, zh: '那么，是谁做了它们？', en: 'So who made them?', src: NARR},
	{from: T.dots, to: T.cluster - 6, zh: '三个巨人的脸上，都有七个小点。', en: 'Each of the three giants bears seven dots on its face.', src: NARR},
	{from: T.cluster, to: T.holes - 6, zh: '排法各不相同，就像石室墙上的点字，是一种记号。', en: 'Each pattern differs—like the braille on the chamber wall, a kind of mark.', src: NARR},
	{from: T.holes, to: T.regigigas - 6, zh: '而在它们身后，还站着一个更大的身影，身上也有七个圆孔。', en: 'And behind them stands a far greater figure, bearing seven holes of its own.', src: NARR},
	{from: T.regigigas + 2, to: T.made - 6, zh: '它就是传说中拖动大陆的巨人。', en: 'This is the giant from the legend, the one who moved the continents.', src: NARR},
	{from: T.made, to: T.drag2 - 6, zh: '据说，它用特殊的冰山、岩石和熔岩，做出了和自己相像的宝可梦。', en: 'It is said to have made Pokémon in its own image, from a special iceberg, rocks, and magma.', src: {zh: '旁白（据白金 图鉴）', en: 'Narration (after Platinum Pokédex)'}},
	{from: T.drag2, to: T.king - 6, zh: '做完这些巨人，它才去拖动大陆，把它们放到了今天的位置。', en: 'Only after making these giants did it move the continents to where they lie today.', src: {zh: '旁白（据盾 图鉴）', en: 'Narration (after Shield Pokédex)'}},
	{from: T.king, to: T.why - 6, zh: '一个能造出巨人、能拖动大陆的王。', en: 'A king who could make giants, and move continents.', src: NARR},
	{from: T.why, to: T.endA - 20, zh: '可古人为什么要把它们关起来？', en: 'So why did the ancients lock them away?', src: NARR},
	// 第 4 段 古人怕的是什么
	{from: T.tundra + PART_CARD + 6, to: T.notThree - 6, zh: '要知道古人怕什么，得去另一片土地看看：伽勒尔的王冠雪原。', en: 'To learn what the ancients feared, we must visit another land: the Crown Tundra of Galar.', src: NARR},
	{from: T.notThree + 4, to: T.elekiLine - 4, zh: '那里也沉睡着巨人，而且不止三个。', en: 'Giants sleep there too—and not only three.', src: NARR},
	{from: T.elekiLine + 4, to: T.power - 6, zh: '其中一个，全身都是电。', en: 'One of them is made entirely of electricity.', src: NARR},
	{from: T.power, to: T.disaster - 6, zh: '它一个，就能造出整个伽勒尔需要的电力。', en: 'On its own, it can generate all the electricity Galar needs.', src: {zh: '旁白（据盾 图鉴）', en: 'Narration (after Shield Pokédex)'}},
	{from: T.disaster, to: T.rings - 6, zh: '可在古时候，这股力量曾给人们带来灾祸。', en: 'But in ancient times, this power brought disaster upon people.', src: {zh: '旁白（据剑／盾 扩展票官网）', en: 'Narration (after Sword / Shield Expansion Pass website)'}},
	{from: T.rings, to: T.dragoLine - 10, zh: '于是古人在它身上装了几个圆环，把电锁在里面。', en: 'So the ancients fitted it with rings, locking the current inside.', src: {zh: '旁白（据剑 图鉴、扩展票官网）', en: 'Narration (after Sword Pokédex / Expansion Pass website)'}},
	{from: T.dragoLine + 6, to: T.crystal - 6, zh: '另一个巨人，只有一颗龙头。', en: "Another giant is little more than a dragon's head.", src: NARR},
	{from: T.crystal, to: T.doom - 6, zh: '传说雷吉奇卡斯想用龙之能量的结晶做它，可结晶不够，只做出了头。', en: 'Legend says Regigigas tried to build it from crystallized dragon energy, but ran short, and finished only the head.', src: {zh: '旁白（据扩展票官网）', en: 'Narration (after Expansion Pass website)'}},
	{from: T.doom, to: T.seal - 6, zh: '古人害怕，要是哪天它的身体被做完，整个国家都会毁灭。', en: 'The ancients feared that if its body were ever finished, their whole nation would be destroyed.', src: {zh: '旁白（据扩展票官网）', en: 'Narration (after Expansion Pass website)'}},
	{from: T.seal, to: T.might - 6, zh: '于是，他们把它封进了神殿深处。', en: 'So they sealed it deep inside a temple.', src: {zh: '旁白（据扩展票官网）', en: 'Narration (after Expansion Pass website)'}},
	{from: T.might, to: T.ruins - 6, zh: '古人怕的，不只是巨人做过的事，还有它们可能会做的事。', en: 'The ancients feared not only what the giants had done, but what they might do.', src: NARR},
	{from: T.ruins, to: T.path - 6, zh: '就这样，在丰缘，在伽勒尔，巨人被一个接一个关进了遗迹。', en: 'And so, in Hoenn and in Galar, the giants were shut away in ruins, one after another.', src: {zh: '旁白（据雷吉洛克、雷吉斯奇鲁 图鉴）', en: 'Narration (after Regirock / Registeel Pokédex)'}},
	{from: T.path, to: T.back - 6, zh: '可封印它们的古人，并没有把路堵死。', en: 'Yet the ancients who sealed them did not close the way for good.', src: NARR},
	{from: T.back, to: T.endB - 24, zh: '回到丰缘的那间石室，墙上的点字还没有读完。', en: "Back in Hoenn's chamber, the braille on the wall isn't finished.", src: NARR},
	// 第 5 段 解封仪式与三道题
	{from: T.tablet + 40, to: T.relicanth - 16, zh: '正面的石壁上写着：古空棘鱼为始，吼鲸王为终。', en: 'The great tablet reads: first comes Relicanth, last comes Wailord.', src: BRAILLE('FIRST COMES RELICANTH. LAST COMES WAILORD.')},
	{from: T.relicanth - 10, to: T.wailord - 8, zh: '古空棘鱼是一亿年来模样从没变过的活化石，', en: 'Relicanth is a living fossil, unchanged for a hundred million years,', src: {zh: '旁白（据盾 图鉴）', en: 'Narration (after Shield Pokédex)'}},
	{from: T.wailord - 2, to: T.bring - 6, zh: '吼鲸王，是人们所知最大的宝可梦。', en: 'and Wailord is the largest Pokémon known.', src: {zh: '旁白（据欧米伽红宝石 英文图鉴）', en: 'Narration (after Omega Ruby Pokédex)'}},
	{from: T.bring, to: T.open - 6, zh: '带着最古老的和最巨大的宝可梦来到墙前，大地就会震动，', en: 'Bring the most ancient and the most immense before the wall, and the earth will shake—', src: NARR},
	{from: T.open, to: T.riddle - 6, zh: '沙漠、小岛和古墓里的三座遗迹，同时打开了门。', en: 'and the three ruins in the desert, on the island, and in the old tomb open their doors at once.', src: NARR},
	{from: T.riddle, to: T.desert - 6, zh: '可门开了，巨人还在里面。每座遗迹的墙上，又刻着一道题。', en: 'But even with the doors open, the giants stay inside. Each ruin bears another riddle.', src: NARR},
	{from: T.desert, to: T.strength - 6, zh: '沙漠里的遗迹写着：向右，向右，向下，向下，然后使出你的怪力。', en: 'The desert ruin reads: right, right, down, down, then use your Strength.', src: {zh: '旁白（据沙漠遗迹点字）', en: 'Narration (Desert Ruins braille: RIGHT, RIGHT, DOWN, DOWN, THEN USE YOUR STRENGTH.)'}},
	{from: T.strength, to: T.island - 6, zh: '这道题，考的是力量。', en: 'This riddle tests strength.', src: NARR},
	{from: T.island, to: T.patience - 6, zh: '小岛上的洞穴写着：停下脚步，一动不动，等时间从你身边流过两次。', en: 'The island cave reads: stop and wait, unmoving, as time passes you by twice.', src: {zh: '旁白（据小岛洞穴点字）', en: 'Narration (Island Cave braille: STOP AND WAIT UNMOVING AS TIME PASSES YOU BY TWICE.)'}},
	{from: T.patience, to: T.tomb - 6, zh: '来访的人真要站着不动两分钟，门才会打开。这道题，考的是耐心。', en: 'Visitors must stand perfectly still for two minutes before the door opens. This one tests patience.', src: NARR},
	{from: T.tomb, to: T.record - 6, zh: '最后，古墓里写着：站在中央，带着爱、希望和时间，飞向天空。', en: 'Last, the tomb reads: stand in the center, and aim for the sky with love, hope, and time.', src: {zh: '旁白（据古代坟墓点字）', en: 'Narration (Ancient Tomb braille: STAND CENTER. AIM TO THE SKY WITH LOVE AND HOPE AND TIME.)'}},
	{from: T.record, to: T.will - 6, zh: '这句话，在另一份记载里写得更直白：', en: 'Another record puts it more plainly:', src: NARR},
	{from: T.will, to: T.wait - 6, zh: '继承我们意志的人，在中央发出光芒。', en: 'Those who inherit our will, shine in the middle.', src: {zh: '旁白（据绿宝石 古代坟墓点字）', en: 'Narration (Emerald Ancient Tomb braille: THOSE WHO INHERIT OUR WILL, SHINE IN THE MIDDLE.)'}},
	{from: T.wait, to: T.wait2 - 6, zh: '原来，古人关上门，不是要让巨人永远睡下去。', en: "So the ancients didn't shut the doors to keep the giants asleep forever.", src: NARR},
	{from: T.wait2, to: T.endC - 20, zh: '他们在等。等一个有力量、有耐心、心怀爱与希望，能继承他们意志的人。', en: 'They were waiting—for someone with strength, patience, love and hope; someone who could inherit their will.', src: NARR},
	// 第 6 段 各地的门
	{from: T.unova + 6, to: T.unovaWall - 6, zh: '留下题目的，不只丰缘的古人。', en: 'The ancients of Hoenn were not the only ones to leave riddles.', src: NARR},
	{from: T.unovaWall, to: T.protect - 6, zh: '在合众的地底遗迹，墙上也刻着字，只是那里的人，对巨人有另一种称呼。', en: "In Unova's Underground Ruins, words are carved too—but the people there called the giants by another name.", src: {zh: '旁白（据黑2白2 地底遗迹）', en: 'Narration (after B2W2 Underground Ruins)'}},
	{from: T.protect, to: T.moon - 6, zh: '他们叫它们守护者：守护者，诞生于岩石、冰与熔岩。', en: 'They called them protectors: the protectors were born of rock, ice, and magma.', src: {zh: '旁白（据黑2白2 地底遗迹石刻 英文）', en: 'Narration (after B2W2 Underground Ruins inscription)'}},
	{from: T.moon, to: T.honor - 6, zh: '刻字的人还说：勇敢的人，我把我知道的答案告诉你，另一个答案，要等月亮升起时才找得到。', en: "The carver adds: courageous one, I'll tell you the answer I know; the other can only be found when the moon is in the sky.", src: {zh: '旁白（据黑2白2 地底遗迹石刻 英文）', en: 'Narration (after B2W2 Underground Ruins inscription)'}},
	{from: T.honor, to: T.peony - 6, zh: '同样的巨人，丰缘人怕它们，合众人却把它们当成守护者。', en: 'The same giants were feared in Hoenn, yet honored as protectors in Unova.', src: NARR},
	{from: T.peony, to: T.notes - 6, zh: '再回到王冠雪原。皮欧尼听说，巨人沉睡的遗迹大门紧闭，从没人打开过。', en: "Back in the Crown Tundra, Peony heard that the giants' ruins had stayed shut—no one had ever opened them.", src: {zh: '旁白（据传说笔记２、皮欧尼台词）', en: 'Narration (after Legendary Clue 2 / Peony)'}},
	{from: T.notes, to: T.note1 - 6, zh: '他在笔记里抄下了门上的字，可那些字早已残缺不全。', en: 'He copied the words on the doors into his notes—but they had long since crumbled.', src: {zh: '旁白（据传说笔记２）', en: 'Narration (after Legendary Clue 2)'}},
	{from: T.note1, to: T.note2 - 6, zh: '第一扇门，大意是让第一只宝可梦带上一颗不变的石头；', en: 'The first door seems to ask that the first Pokémon hold a never-changing stone;', src: {zh: '旁白（据传说笔记２ 英文）', en: 'Narration (after Legendary Clue 2)'}},
	{from: T.note2, to: T.note3 - 6, zh: '第二扇门，要你和有生命的雪之结晶同行；', en: 'the second, that you walk with a living crystal of snow;', src: {zh: '旁白（据传说笔记２ 英文）', en: 'Narration (after Legendary Clue 2)'}},
	{from: T.note3, to: T.solve - 6, zh: '第三扇门，要你吹响能唤醒钢之巨人的声音。', en: 'the third, that you sound a note to wake the giant of steel.', src: {zh: '旁白（据传说笔记２ 英文）', en: 'Narration (after Legendary Clue 2)'}},
	{from: T.solve, to: T.pass - 6, zh: '带上一颗不变之石，带着形似雪花结晶的几何雪花同行，再在门前吹一声口哨，三扇门就依次打开了。', en: 'Carry an Everstone, walk beside a Cryogonal shaped like a snow crystal, whistle before the door—and the three doors open in turn.', src: {zh: '旁白（据剑／盾 王冠雪原）', en: 'Narration (after Sword / Shield: The Crown Tundra)'}},
	{from: T.pass, to: T.gather - 6, zh: '而在更远的三岔平原，还有一扇门，上面说的是：', en: 'And farther off, on Three-Point Pass, another door says:', src: {zh: '旁白（据传说笔记２）', en: 'Narration (after Legendary Clue 2)'}},
	{from: T.gather, to: T.choose - 6, zh: '三个巨人聚齐的时候，命运之门就会打开。', en: 'When the three giants gather, the door of destiny shall open.', src: {zh: '旁白（据传说笔记２ 英文）', en: 'Narration (after Legendary Clue 2)'}},
	{from: T.choose, to: T.split - 6, zh: '门后睡着雷吉艾勒奇和雷吉铎拉戈，可走进去的人，只能唤醒其中一个。', en: 'Behind it sleep Regieleki and Regidrago—but whoever enters may wake only one.', src: NARR},
	{from: T.split, to: T.every - 6, zh: '所以，这里叫做抉择遗迹。', en: "That is why it's called the Split-Decision Ruins.", src: NARR},
	{from: T.every, to: T.last - 6, zh: '各地的古人，用不同的方式关上了门，却都在门上留下了开门的办法。', en: 'The ancients of every land shut their doors in different ways—but all of them left a way to open them.', src: NARR},
	{from: T.last, to: T.courage - 6, zh: '就像丰缘那间石室里，最后的两句点字：', en: "Just like the last two lines of braille in Hoenn's chamber:", src: NARR},
	{from: T.courage, to: T.eternal - 6, zh: '勇敢的人，心怀希望的人，打开门吧。', en: 'Those with courage, those with hope—open the door.', src: BRAILLE('THOSE WITH COURAGE. THOSE WITH HOPE. OPEN A DOOR.')},
	{from: T.eternal, to: T.endD - 24, zh: '永恒的宝可梦，就在里面。', en: 'An eternal Pokémon waits within.', src: BRAILLE('AN ETERNAL POKEMON WAITS.')},
	// 第 7 段 雪峰神殿
	{from: T.king2, to: T.hisui - 6, zh: '巨人的门，一扇扇被打开了。可是造出它们的王，又在哪里？', en: "One by one, the giants' doors were opened. But where was the king who made them?", src: NARR},
	{from: T.hisui, to: T.temple - 6, zh: '它沉睡的那片大地，古时候叫做洗翠，也就是今天的神奥。', en: "The land where it sleeps was once called Hisui—today's Sinnoh.", src: NARR},
	{from: T.temple, to: T.statues - 6, zh: '洗翠北方的雪原上，有一座建在山崖上的神殿：雪峰神殿。', en: 'On the snowfields of northern Hisui, a temple stands upon the cliffs: Snowpoint Temple.', src: {zh: '旁白（据52poke「雪峰神殿」）', en: 'Narration (after Snowpoint Temple)'}},
	{from: T.statues, to: T.adaman - 6, zh: '殿里摆满巨人的石像，按正确顺序触碰岩、冰、钢的记号，门才会打开。', en: 'Inside stand statues of the giants; only by touching the marks of rock, ice, and steel in the right order do the doors open.', src: {zh: '旁白（据传说 阿尔宙斯 神殿谜题）', en: 'Narration (after Legends: Arceus temple puzzle)'}},
	{from: T.adaman, to: T.adamanSay - 6, zh: '金刚队的队长刚石，站在神殿地底的门前说过：', en: "Standing before the door to the temple's depths, Adaman, leader of the Diamond Clan, once said:", src: {zh: '旁白（据传说 阿尔宙斯 任务 24）', en: 'Narration (after Legends: Arceus Mission 24)'}},
	{from: T.adamanSay, to: T.stuck - 6, zh: '听说这扇门后面，睡着一只能把南边的大陆整个拖动的宝可梦。', en: 'They say behind this door sleeps a Pokémon that could tow the continents to the south.', src: {zh: '旁白（据刚石台词 英文）', en: 'Narration (after Adaman)'}},
	{from: T.stuck, to: T.plates - 6, zh: '可是不管怎么试，这扇门都打不开。', en: 'But no matter what anyone tried, the door would not open.', src: {zh: '旁白（据山葵台词 英文）', en: 'Narration (after Sabi)'}},
	{from: T.plates, to: T.stuff - 6, zh: '直到有人集齐了三块石板：岩石石板，冰柱石板，钢铁石板。', en: 'Until someone gathered three plates: the Stone Plate, the Icicle Plate, and the Iron Plate.', src: {zh: '旁白（据52poke「雪峰神殿」）', en: 'Narration (after Snowpoint Temple)'}},
	{from: T.stuff, to: T.unseal - 6, zh: '岩石、冰、钢，正是三个巨人的材料。', en: 'Rock, ice, and steel—the very stuff of the three giants.', src: NARR},
	{from: T.unseal, to: T.today - 6, zh: '门开了。地底最深处，那个被封闭的巨人，就等在那里。', en: 'The door opened. In the deepest chamber below, the sealed giant was waiting.', src: {zh: '旁白（据传说 阿尔宙斯 任务 24）', en: 'Narration (after Legends: Arceus Mission 24)'}},
	{from: T.today, to: T.statue - 6, zh: '到了今天，神殿还在，它也还睡在最深处。', en: 'Today the temple still stands, and it still sleeps in the deepest room.', src: {zh: '旁白（据钻石·珍珠 / 晶灿钻石·明亮珍珠）', en: 'Narration (after DPPt / BDSP)'}},
	{from: T.statue, to: T.three - 6, zh: '它看上去就像一尊石像，不管谁来，都叫不醒它。', en: 'It looks like nothing but a statue; no visitor can wake it.', src: {zh: '旁白（据钻石·珍珠 / 晶灿钻石·明亮珍珠）', en: 'Narration (after DPPt / BDSP)'}},
	{from: T.three, to: T.reverse - 6, zh: '它只为一件事醒来：它亲手做出的三个巨人，一起站到它的面前。', en: 'It wakes for one thing only: when the three giants it made stand before it together.', src: NARR},
	{from: T.reverse, to: T.reverse + 104, zh: '反过来也一样。带着雷吉奇卡斯走进神奥的遗迹，', en: "It works the other way too: bring Regigigas into Sinnoh's ruins,", src: {zh: '旁白（据白金）', en: 'Narration (after Platinum)'}},
	{from: T.reverse + 110, to: T.keys - 6, zh: '地上会浮现七个点，巨人也跟着醒来。', en: 'and seven dots appear on the floor as the giants awaken.', src: {zh: '旁白（据白金）', en: 'Narration (after Platinum)'}},
	{from: T.keys, to: T.bed - 6, zh: '造物主和它的造物，互为彼此的钥匙。', en: "The creator and its creations are each other's keys.", src: NARR},
	{from: T.bed, to: T.bed + 84, zh: '在伽勒尔也是这样：五个巨人聚齐，', en: 'So too in Galar: gather all five giants,', src: {zh: '旁白（据剑／盾 王冠雪原）', en: 'Narration (after Sword / Shield: The Crown Tundra)'}},
	{from: T.bed + 90, to: T.anime - 6, zh: '雷吉奇卡斯就会出现在一个叫巨人睡榻的地方。', en: "and Regigigas appears at a place called the Giant's Bed.", src: {zh: '旁白（据剑／盾 王冠雪原）', en: 'Narration (after Sword / Shield: The Crown Tundra)'}},
	{from: T.anime, to: T.anime + 132, zh: '动画里，雷吉奇卡斯曾被闯进神殿的猎人惊醒，一醒来就暴走；', en: 'In the anime, Regigigas was startled awake by a hunter who broke into its temple, and went berserk;', src: {zh: '旁白（据动画 DP129（52poke 记为第 127 集））', en: 'Narration (after anime DP129)'}},
	{from: T.anime + 138, to: T.endE - 24, zh: '可在游戏里，它等的，从来只有自己的巨人。', en: 'but in the games, it only ever waits for its own giants.', src: NARR},
	// 第 8 段 敬畏
	{from: T.awe + 50, to: T.pair - 6, zh: '再回头看看石室里的那两句话。', en: 'Look back once more at those two lines in the chamber.', src: NARR},
	{from: T.pair, to: T.virtue - 6, zh: '一切都要感谢宝可梦。我们害怕它。', en: 'We owe all to the Pokémon. We feared it.', src: BRAILLE('WE OWE ALL TO THE POKEMON. / WE FEARED IT.')},
	{from: T.virtue, to: T.aweWord - 6, zh: '感激，是敬；害怕，是畏。', en: 'Gratitude is reverence. Fear is dread.', src: NARR},
	{from: T.aweWord, to: T.balance - 6, zh: '人在面对比自己强大得多的力量时，心里装着的正是这两个字：敬畏。', en: 'Facing a power far greater than themselves, people hold both at once: awe.', src: NARR},
	{from: T.balance, to: T.lock - 6, zh: '可是敬与畏的分量，会随着时代改变。', en: 'But the balance of reverence and dread shifts with the times.', src: NARR},
	{from: T.lock, to: T.rose - 6, zh: '古人给雷吉艾勒奇套上圆环，锁住了能点亮整个伽勒尔的电。', en: 'The ancients ringed Regieleki, locking away enough power to light all of Galar.', src: {zh: '旁白（据剑／盾 图鉴、扩展票官网）', en: 'Narration (after Sword / Shield Pokédex, Expansion Pass website)'}},
	{from: T.rose, to: T.quote - 6, zh: '很久以后，伽勒尔的联盟会长洛兹却说：', en: "Long after, Rose, Chairman of Galar's League, would say:", src: NARR},
	{from: T.quote, to: T.dark - 6, zh: '让这里璀璨生辉的能源再过１０００年就不复存在了！', en: 'The energy that makes this place shine will be gone in a thousand years!', src: {zh: '官方原文：剑／盾 洛兹台词', en: 'Sword / Shield: Rose'}},
	{from: T.dark, to: T.lesson - 6, zh: '为了能源，他唤醒了无极汰那，却控制不住它，让伽勒尔陷入了闇夜。', en: 'For energy, he woke Eternatus—but could not control it, and Galar was plunged into the Darkest Day.', src: {zh: '旁白（据剑／盾 剧情、洛兹台词"没想到我根本控制不住它"）', en: 'Narration (after Sword / Shield story)'}},
	{from: T.lesson, to: T.endF - 24, zh: '畏惧，教会了古人等待；只剩渴望的人，却忘了有些力量是控制不住的。', en: 'Dread taught the ancients to wait; those left with only desire forgot that some powers cannot be controlled.', src: NARR},
	// 第 9 段 王醒来
	{from: T.door9 + 10, to: T.seek - 6, zh: '而古人留下的那扇门，一直在等一个对的人。', en: 'And the door the ancients left has been waiting all along for the right person.', src: NARR},
	{from: T.seek, to: T.before - 6, zh: '要有力量，要有耐心，要心怀爱与希望，还要把巨人一个一个找回来。', en: 'Strength. Patience. Love and hope. And the will to find the giants, one by one.', src: NARR},
	{from: T.before, to: T.wake - 6, zh: '当三个巨人终于站到它的面前——', en: 'When at last the three giants stand before it—', src: NARR},
	{from: T.wake + 4, to: T.wake + 110, zh: '沉睡的王，睁开了眼睛。', en: 'the sleeping king opens its eyes.', src: NARR},
	{from: T.dread, to: T.revere - 6, zh: '把巨人关起来的，是畏。', en: 'What locked the giants away was dread.', src: NARR},
	{from: T.revere, to: T.endG - 50, zh: '把钥匙留下来的，是敬。', en: 'What left the key behind was reverence.', src: NARR},
];

const SeaView: React.FC<{f: number; cam: Cam; splash: number}> = ({f, cam, splash}) => (
	// 钻进岩缝前把光压下来，避免一片白
	<GLView
		frag={SEA_FRAG}
		uniforms={{
			uTime: f / BASE_FPS,
			uCamPos: [cam.x, cam.y, cam.z],
			uCamRot: [cam.yaw, cam.pitch],
			uFov: cam.fov,
			uCrack: track(f, [[T.sea, 0.9], [T.dive, 0.75], [T.splashIn, 0.22], [T.splashOut, 0.22], [1060, 0.9], [T.end2, 0.9], [T.strata - 20, 0.5], [T.strata + 14, 0]]),
			uRays: 1,
			uSnow: 1,
			uSplash: splash,
			uExposure: track(f, [[T.end1, 1.6], [T.giant, 1.25], [T.book + 60, 1.25], [T.end2, 1.45]]),
			uFade: interpolate(f, [0, 16], [1, 0], clamp),
		}}
	/>
);

/** 读字光跟着镜头；"一排排凸起的小点"那句时从左到右扫过整面墙 */
const lampAt = (f: number, cam: Cam, i: number): number[] => {
	const follow = [cam.x + 0.25, cam.y + 0.45, Math.min(cam.z * 0.6, 1.4)];
	const sweep = interpolate(f, [258, 280, 330, 352], [0, 1, 1, 0], clamp);
	const sx = interpolate(f, [258, 352], [-4.6, 4.6], clamp);
	const pos = follow.map((v, k) => v + ([sx, 3.0, 1.1][k] - v) * sweep);
	return [...pos, i + sweep * 0.9];
};

const HallView: React.FC<{f: number; cam: Cam; splash: number; read: number[]}> = ({f, cam, splash, read}) => {
	const lampI = track(f, [[T.splashIn, 0.15], [T.wall + 40, 0.35], [395, 0.9], [T.read1, 1.2], [T.both, 1.2], [T.both + 40, 0.75], [T.leave, 0.6], [T.splashOut, 0.2], [T.back - 10, 0.2], [T.back + 30, 0.85]]);
	return (
		<GLView
			frag={HALL_FRAG}
			textures={[{name: 'uCells', w: MAX_COLS, h: PANELS.length * MAX_LINES, data: CELLS}]}
			uniforms={{
				uTime: f / BASE_FPS,
				uCamPos: [cam.x, cam.y, cam.z],
				uCamRot: [cam.yaw, cam.pitch],
				uFov: cam.fov,
				'uPanel[]': PANEL_U,
				'uLines[1]': LINES_U,
				'uRead[1]': read,
				'uHot[1]': hotAt(f),
				uLamp: lampAt(f, cam, lampI),
				uPool: 1,
				uSplash: splash,
				uExposure: 1.5,
				uFade: 0,
			}}
		/>
	);
};

// ── 2 存疑的传说 ──

/** 大陆原本散落的位置（相对今天的偏移，像素） */
const SCATTER: Record<string, Pt> = {
	northAmerica: [-170, -70],
	greenland: [-110, -130],
	southAmerica: [-230, 150],
	africa: [40, 190],
	eurasia: [150, -100],
	australia: [250, 140],
};
/** 第 k 块大陆被拖回原位的进度 */
const dragP = (f: number, k: number) => track(f, [[T.drag + k * 13, 0], [T.drag + k * 13 + 72, 1]]);
const mapAt = (f: number): Pt[] =>
	CONT.flatMap((c) => {
		const p = 1 - dragP(f, c.k);
		const [dx, dy] = SCATTER[c.name];
		return c.pts.map((q) => [q[0] + dx * p, q[1] + dy * p] as Pt);
	});
const BOOK = bookDots();
const DOT_COUNT = Math.max(MAP_N, BOOK.pts.length, 2000);

const LEGEND_STAGES: Stage[] = [
	{at: T.legend + 14, dur: 62, spread: 46, pts: mapAt, alpha: () => 0.85},
	{at: T.book, dur: 58, spread: 40, pts: () => BOOK.pts, alpha: () => 0.8},
	// "一丝真理"：只剩一颗光点亮着
	{at: T.truth, dur: 34, spread: 0, pts: () => BOOK.pts, alpha: (i) => (i === BOOK.truth ? 3 : 0.12), size: (i) => (i === BOOK.truth ? 5.5 : 1)},
	// 它坠向海底，其余的光点散去
	{
		at: T.fall,
		dur: 80,
		spread: 6,
		pts: () => BOOK.pts.map((p, i) => (i === BOOK.truth ? ([960, 1000] as Pt) : ([p[0], p[1] + 90] as Pt))),
		alpha: (i) => (i === BOOK.truth ? 3 : 0),
		size: (i) => (i === BOOK.truth ? 4 : 1),
	},
];

/** 雷吉奇卡斯剪影的两只手（屏幕坐标），绳子从这里拉向各块大陆 */
const HANDS: [Pt, Pt] = [
	[524, 650],
	[1395, 650],
];
const ropes = (f: number) => (ctx: CanvasRenderingContext2D) => {
	const vis = interpolate(f, [T.giant + 10, T.giant + 40, T.book - 10, T.book + 30], [0, 1, 1, 0], clamp);
	if (vis <= 0) return;
	ctx.globalCompositeOperation = 'lighter';
	CONT.forEach((c) => {
		const p = 1 - dragP(f, c.k);
		const [dx, dy] = SCATTER[c.name];
		const end: Pt = [c.c[0] + dx * p, c.c[1] + dy * p];
		const hand = end[0] < 960 ? HANDS[0] : HANDS[1];
		const reach = track(f, [[T.giant + 14 + c.k * 5, 0], [T.drag - 4 + c.k * 5, 1]]);
		const tip: Pt = [hand[0] + (end[0] - hand[0]) * reach, hand[1] + (end[1] - hand[1]) * reach];
		const len = Math.hypot(tip[0] - hand[0], tip[1] - hand[1]);
		// 绳子绷紧之前微微下垂
		const sag = 40 * (1 - dragP(f, c.k) * 0.8) * reach;
		const n = Math.max(2, Math.floor(len / 9));
		for (let j = 0; j <= n; j++) {
			const t = j / n;
			const x = hand[0] + (tip[0] - hand[0]) * t;
			const y = hand[1] + (tip[1] - hand[1]) * t + Math.sin(t * Math.PI) * sag;
			const flick = 0.55 + 0.45 * Math.sin(j * 0.7 - f * 0.25);
			ctx.globalAlpha = vis * 0.8 * flick;
			ctx.fillStyle = '#ffd58a';
			ctx.beginPath();
			ctx.arc(x, y, 2.8, 0, Math.PI * 2);
			ctx.fill();
		}
	});
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = 'source-over';
};

export const RegiMaster: React.FC = () => {
	const f = useFrame();
	const hallB = f >= T.back - 10 && f < T.quake + 82;
	const inRiddle = f >= T.riddle + 94 && f < T.wait + 42;
	const hallD = f >= T.last - 10 && f < T.hisui + 34;
	const hallF = f >= T.awe && f < T.lock + 34;
	const inHall = (f >= T.splashIn && f < T.splashOut) || hallB || hallD || hallF;
	const read = readAt(f);
	let view: React.ReactNode;
	let cam: Cam;
	if (!inHall) {
		cam = camFrom(f < T.splashIn ? flow(f, SEA_CAM) : f < T.end1 ? flow(f, SEA_CAM_OUT) : f < T.end2 ? flow(f, SEA_CAM_LEGEND) : flow(f, SEA_CAM_ROCK));
		// 下潜后半段：镜头始终对准岩缝
		const aim = -Math.atan2(cam.y + 59.4, Math.max(cam.z, 0.05));
		if (f < T.splashIn) cam = {...cam, pitch: cam.pitch + (aim - cam.pitch) * interpolate(f, [90, T.dive], [0, 1], clamp)};
		else if (f >= T.end2) cam = {...cam, pitch: cam.pitch + (aim - cam.pitch) * interpolate(f, [T.end2, T.end2 + 40], [0, 1], clamp)};
		const splash = f < T.splashIn ? interpolate(f, [T.splashIn - 16, T.splashIn], [0, 1], clamp) : interpolate(f, [T.splashOut, T.splashOut + 22], [1, 0], clamp);
		view = f < T.strata + 16 ? <SeaView f={f} cam={cam} splash={splash} /> : null;
	} else {
		cam = hallF ? camFrom(flow(f, HALL_CAM_F)) : hallD ? camFrom(flow(f, HALL_CAM_D)) : f >= T.endB ? hallCamC(f) : camFrom(flow(f, hallB ? HALL_CAM_B : HALL_CAM));
		const splash = hallB || hallD || hallF ? 0 : Math.max(interpolate(f, [T.splashIn, T.splashIn + 26], [1, 0], clamp), interpolate(f, [T.splashOut - 14, T.splashOut], [0, 1], clamp));
		view = <HallView f={f} cam={cam} splash={splash} read={read} />;
	}
	if (inRiddle) view = <RiddleView f={f} />;
	const inUnova = f >= T.unova && f < T.peony + 16;
	if (inUnova) view = <UnovaView f={f} />;
	const mask = useArtMask('pokemon/regirock');
	const stages = useMemo(() => [...LEGEND_STAGES, ...rockStages(mask, BOOK)], [mask]);
	const titleOut = interpolate(f, [T.legend + 6, T.legend + 30], [1, 0], clamp);
	const titleIn = interpolate(f, [T.title + 90, T.title + 120], [0, 1], clamp) * titleOut;
	const partIn = interpolate(f, [T.title + 118, T.title + 140], [0, 1], clamp) * titleOut;
	return (
		<AbsoluteFill style={{background: '#000'}}>
			{view}
			{inRiddle ? <RiddleFx f={f} /> : null}
			{inUnova ? <UnovaFx f={f} /> : null}
			{hallD ? <Letters cam={cam} panels={PANELS} which={LAST_WHICH} read={read} show={interpolate(f, [T.courage, T.courage + 12], [0, 1], clamp)} /> : null}
			{f >= T.endB && hallB ? <Letters cam={cam} panels={PANELS} which={TABLET_WHICH} read={read} show={interpolate(f, [T.tablet + 40, T.tablet + 52, T.relicanth + 10, T.relicanth + 34], [0, 1, 1, 0], clamp)} /> : null}
			<DoorsView f={f} layer={0} />
			{f >= T.strata && f < T.tundra + 80 && coastOpacity(f) < 1 ? <StrataView f={f} opacity={interpolate(f, [T.strata, T.strata + 16], [0, 1], clamp)} /> : null}
			<CoastView f={f} />
			<TundraView f={f} />
			{f >= T.drag2 && f < T.king + 45 ? <MapBehind f={f} /> : null}
			{f >= T.holes - 2 && f < T.tundra + 80 ? <RegigigasLayer f={f} /> : null}
			{inHall ? <BrailleOverlay f={f} cam={cam} read={read} /> : null}
			{f < T.endA + 2 ? (
				<>
					<RegirockLayer f={f} mask={mask} light={interpolate(f, [T.holes + 40, T.regigigas], [0, 0.8], clamp)} />
					<MapLinks f={f} mask={mask} />
				</>
			) : null}
			{(f >= T.giants && f < T.coast + 2) || (f >= T.tri - 2 && f < T.endA + 2) ? <RegiceLayer f={f} /> : null}
			{f >= T.registeel - 62 && f < T.endA + 2 ? <RegisteelLayer f={f} /> : null}
			<Pressure f={f} />
			<TundraActors f={f} />
			{(f >= T.honor + 90 && f < T.solve + 24) || f >= T.bed - 26 ? <SnowFront f={f} /> : null}
			<Peony f={f} />
			<SeaGuests f={f} />
			{f >= T.quake - 2 && f < T.quake + 90 ? <Dust f={f} at={T.quake} len={90} rgb="170,160,140" /> : null}
			{f >= T.strength - 2 && f < T.strength + 80 ? <Dust f={f} at={T.strength} len={80} rgb="225,180,115" /> : null}
			<DoorActors f={f} />
			<DoorsView f={f} layer={1} />
			<DoorFront f={f} />
			<DoorsSixFx f={f} />
			<Notebook f={f} />
			{/* 第 7 段 */}
			{f >= T.endD ? (
				<>
					<KingDots f={f} />
					<HisuiView f={f} />
					{f >= T.hisui - 40 && f < T.statues + 34 ? <SnowFront f={f} amount={hisuiOpacity(f) * 0.7} /> : null}
					<TempleHall f={f} layer="bg" />
					<TempleHall f={f} layer="fg" />
					<BasementDoor f={f} layer={0} />
					<BasementGigas f={f} />
					<BasementDoor f={f} layer={1} />
					<BasementFx f={f} />
					<TodayWall f={f} />
					<TodayScene f={f} />
					<GalarBed f={f} part="back" />
					<GalarBed f={f} part="front" />
				</>
			) : null}
			{/* 第 8 段 */}
			{f >= T.awe ? (
				<>
					{hallF ? <Letters cam={cam} panels={PANELS} which={AWE_WHICH} read={read} show={interpolate(f, [T.pair - 6, T.pair + 10, T.aweWord, T.aweWord + 30], [0, 1, 1, 0], clamp)} /> : null}
					{hallF ? <AweWords f={f} cam={cam} /> : null}
					<LockedEleki f={f} />
					<GalarCity f={f} />
					<AncientDoor f={f} layer={0} />
					<AncientDoor f={f} layer={1} />
				</>
			) : null}
			{/* 第 9 段 */}
			{f >= T.door9 ? (
				<>
					<GiantsAtDoor f={f} />
					<KingChamber f={f} />
					<DoorLight f={f} />
				</>
			) : null}
			<DoorLabels f={f} />
			<PokemonArt3D
				dir="pokemon/regigigas"
				x={960}
				y={520}
				size={1040}
				depthScale={0.5}
				ambient={[0.03, 0.035, 0.045]}
				brightness={0.32}
				rim={{dir: [0, -1], color: [1.6, 1.0, 0.45], power: 3.0}}
				opacity={interpolate(f, [T.giant - 10, T.giant + 50, T.book - 20, T.book + 40], [0, 0.9, 0.9, 0], clamp)}
				style={{display: f > T.giant - 12 && f < T.book + 42 ? 'block' : 'none'}}
			/>
			<DotMorph
				f={f}
				title={{start: T.title, text: '敬畏', cy: 455, size: 330, tracking: 60, step: 11, each: 64, spread: 40}}
				stages={stages}
				count={DOT_COUNT}
				under={ropes(f)}
			/>
			<div style={{position: 'absolute', left: 0, width: 1920, top: 690, textAlign: 'center', opacity: titleIn, fontFamily: CINZEL, fontWeight: 600, fontSize: 54, letterSpacing: 34, paddingLeft: 34, color: '#f1d9a6', textShadow: '0 0 18px rgba(255,180,80,0.55)'}}>
				AWE
			</div>
			<div style={{position: 'absolute', left: 0, width: 1920, top: 778, textAlign: 'center', opacity: partIn, fontFamily: SERIF, fontWeight: 600, fontSize: 32, letterSpacing: 12, color: 'rgba(230,214,180,0.85)', textShadow: '0 0 12px rgba(0,0,0,0.8)'}}>
				上篇 · 巨人
			</div>
			<PartCard f={f} at={T.tundra + 24} len={PART_CARD - 22} text="中篇 · 考卷" />
			<PartCard f={f} at={T.keyCard + 24} len={PART_CARD - 22} text="下篇 · 钥匙" />
			{SUBS.map((s, i) => (
				<BiSubtitle key={i} zh={s.zh} en={s.en} from={s.from} to={s.to} source={s.src} speed={SPEED} />
			))}
			{f >= T.dots - 2 && f < T.tundra + 80 ? <Dots f={f} /> : null}
			<Threads f={f} />
			<KingRopes f={f} />
			<NameTag from={T.regice + 6} x={110} y={150} no="No.0378" zh="雷吉艾斯" en="Regice" category="冰山宝可梦" categoryEn="ICEBERG POKÉMON" opacity={interpolate(f, [T.magma - 20, T.magma], [1, 0], clamp)} />
			<NameTag from={T.registeel + 6} x={110} y={150} no="No.0379" zh="雷吉斯奇鲁" en="Registeel" category="黑金宝可梦" categoryEn="IRON POKÉMON" opacity={interpolate(f, [T.pressure - 20, T.pressure], [1, 0], clamp)} />
			<NameTag from={T.regigigas + 8} x={110} y={150} no="No.0486" zh="雷吉奇卡斯" en="Regigigas" category="巨大宝可梦" categoryEn="COLOSSAL POKÉMON" opacity={interpolate(f, [T.made + 40, T.made + 64], [1, 0], clamp)} />
			<Cry name="regice" at={T.regice} />
			<Cry name="registeel" at={T.registeel} />
			<Cry name="regigigas" at={T.regigigas} />
			<NameTag from={T.regirock + 6} x={110} y={150} no="No.0377" zh="雷吉洛克" en="Regirock" category="岩山宝可梦" categoryEn="ROCK PEAK POKÉMON" opacity={interpolate(f, [T.lands - 24, T.lands], [1, 0], clamp)} />
			<Cry name="regirock" at={T.regirock} />
			<NameTag from={T.eleki + 6} x={110} y={150} no="No.0894" zh="雷吉艾勒奇" en="Regieleki" category="电子宝可梦" categoryEn="ELECTRON POKÉMON" opacity={interpolate(f, [T.disaster - 20, T.disaster], [1, 0], clamp)} />
			<NameTag from={T.drago + 6} x={110} y={150} no="No.0895" zh="雷吉铎拉戈" en="Regidrago" category="龙玉宝可梦" categoryEn="DRAGON ORB POKÉMON" opacity={interpolate(f, [T.crystal + 44, T.crystal + 64], [1, 0], clamp)} />
			<Cry name="regieleki" at={T.eleki} />
			<Cry name="regidrago" at={T.drago} />
			<NameTag from={T.relicanth + 6} x={110} y={150} no="No.0369" zh="古空棘鱼" en="Relicanth" category="长寿宝可梦" categoryEn="LONGEVITY POKÉMON" opacity={interpolate(f, [T.wailord - 24, T.wailord - 4], [1, 0], clamp)} />
			<NameTag from={T.wailord + 6} x={110} y={150} no="No.0321" zh="吼鲸王" en="Wailord" category="浮游鲸宝可梦" categoryEn="FLOAT WHALE POKÉMON" opacity={interpolate(f, [T.bring + 30, T.bring + 50], [1, 0], clamp)} />
			<Cry name="relicanth" at={T.relicanth} />
			{/* 全片爆发点：雷吉奇卡斯第二次叫声 */}
			<Cry name="regigigas" at={T.wake + 30} />
			<Cry name="wailord" at={T.wailord} />
			<Grain opacity={0.12} />
		</AbsoluteFill>
	);
};
