import {SubtitleSource} from '../../components/BiSubtitle';
import {bf} from '../time/common';

/**
 * 《空间的形状》整期时间轴（30fps 帧号）。各段只是这条时间轴的窗口，段落交界天然无缝。
 *
 * 配乐和《时间的心跳》是同一个文件 C:\Users\Admin\Music\千年之后.mp3（用户剪辑时从第 0 帧放），
 * 节拍工具直接沿用 time/common：112.905 BPM，一小节 2.1257 秒，第 0 小节强拍在 0.087 秒。
 * 字幕与卡点的对应见 script/space-texts.md。
 */
export {BAR, BEAT, bf, ease, easeInQuad, easeOutCubic, easeOutExpo, env, lerp, prog, rnd, sat, smooth, track} from '../time/common';

/** 各段起点（取整帧，供分段窗口用；段内动画仍按 bf() 的小数帧卡点） */
export const SEG_START = {
	hook: 0,
	palkia: Math.round(bf(6)),
	infinite: Math.round(bf(14)),
	bend: Math.round(bf(22)),
	origin: Math.round(bf(30)),
	fold: Math.round(bf(36)),
	clash: Math.round(bf(44)),
	fabric: Math.round(bf(55)),
	screen: Math.round(bf(66)),
} as const;
export type SegName = keyof typeof SEG_START;
/** 第 72 小节强拍结束（153.14 秒） */
export const TOTAL_FRAMES = Math.round(bf(72));

const ORDER = Object.keys(SEG_START) as SegName[];
export const SEG_FRAMES = Object.fromEntries(
	ORDER.map((n, i) => [n, (i + 1 < ORDER.length ? SEG_START[ORDER[i + 1]] : TOTAL_FRAMES) - SEG_START[n]]),
) as Record<SegName, number>;

/** 交付的三个文件：上（第 1–3 段）、中（第 4–6 段）、下（第 7–9 段） */
export const PARTS = {
	part1: [0, SEG_START.bend],
	part2: [SEG_START.bend, SEG_START.clash],
	part3: [SEG_START.clash, TOTAL_FRAMES],
} as const;

// ── 字幕 ──
export const SUB = {speed: 1.25, sync: true, scale: 1.12, enStrong: true, scrim: 1} as const;

type Sub = [number, number, string, string, SubtitleSource?];
/** [小节, 拍] → [小节, 拍]；末帧比下一句早 4 帧收完。第 1 句从第 0 帧开始（不等强拍） */
const s = (a: [number, number], b: [number, number], zh: string, en: string, source?: SubtitleSource): Sub => [
	a[0] === 0 && a[1] === 0 ? 0 : bf(a[0], a[1]),
	bf(b[0], b[1]) - 4,
	zh,
	en,
	source,
];
const LA_SITE = {zh: 'LA 官网（简中）', en: 'LA official site'};

/** 全片字幕（与 script/space-texts.md 一一对应） */
export const SUBS: Sub[] = [
	// 1 钩子
	s([0, 0], [1, 0], '这块屏幕，是平的。', 'This screen is flat.'),
	s([1, 0], [2, 0], '如果有谁，能把空间撕开——', 'What if something could tear space open?'),
	s([2, 0], [3, 0], '后面，会是什么？', 'What would lie behind it?'),
	s([3, 0], [4, 0], '宝可梦的传说里，就有一位。', 'Pokémon legend tells of one who can.'),
	s([5, 0], [6, 0], '有人曾想借它的力量，改写世界。', 'Someone once tried to use its power to rewrite the world.', {zh: '白金剧情（加码，预告第 7 段）', en: 'Bulbapedia「Spear Pillar」'}),
	// 2 呼吸与登场
	s([6, 0], [7, 0], '传说它每呼吸一次，', 'Legend says that with its every breath,', {zh: '改写自白金 / 黑白图鉴', en: "It is said that space becomes more stable with Palkia's every breath."}),
	s([7, 0], [8, 0], '空间就更安稳一些。', 'space grows a little steadier.', {zh: '改写自白金 / 黑白图鉴', en: "It is said that space becomes more stable with Palkia's every breath."}),
	s([8, 2], [10, 0], '它能扭曲空间，被神奥的神话奉为神。', "It can distort space, and Sinnoh's myths revere it as a deity.", {zh: '改写自钻石 / Y / αS / BD 图鉴', en: 'Diamond Pokédex'}),
	s([10, 0], [11, 2], '据说它住在两层空间之间的缝隙里，', 'It is said to live in a gap between parallel spaces,', {zh: '改写自珍珠 / X / ΩR / SP 图鉴', en: 'Pearl Pokédex'}),
	s([11, 2], [12, 2], '就像书页之间的那道缝。', 'like the gap between two pages of a book.'),
	s([12, 2], [13, 2], '可空间，到底是什么？', 'But what is space, really?'),
	s([13, 2], [14, 0], '从一个点说起。', 'Start with a single point.'),
	// 3 长宽高与无边无际
	s([14, 0], [15, 0], '拉成线，就有了长短；', 'Stretch it into a line, and it has length.'),
	s([15, 0], [16, 0], '铺成面，立起来，有了宽和高。', 'Spread it flat and raise it up: width and height.'),
	s([16, 0], [17, 2], '洗翠的神话说，它诞生的那一刻——', 'Hisuian legend says that the moment it was born,', {zh: '改写自 LA 图鉴', en: 'LA Pokédex'}),
	s([17, 2], [18, 2], '隔开世界的墙消失了，', 'the walls that closed in the world vanished,', {zh: '改写自 LA 图鉴', en: 'LA Pokédex'}),
	s([18, 2], [19, 2], '空间从此无边无际。', 'and space became boundless.', {zh: '改写自 LA 图鉴', en: 'LA Pokédex'}),
	s([19, 2], [20, 2], '从你出发，一路往外飞：', 'Now fly outward, starting from you.'),
	s([20, 2], [21, 2], '光一秒钟，能绕地球七圈半；', 'In one second, light can circle the Earth seven and a half times;', {zh: '299,792 km ÷ 40,075 km ≈ 7.5', en: ''}),
	s([21, 2], [22, 2], '可要横穿银河系，它得跑十万年。', 'yet to cross the Milky Way, it would need 100,000 years.', {zh: '银河系直径约 10 万光年', en: ''}),
	// 4 胀大与弯曲
	s([22, 2], [23, 2], '要看懂帕路奇亚，得先看懂空间：', 'To understand Palkia, first understand space.'),
	s([23, 2], [24, 2], '空间在胀大，像发酵的葡萄干面包：', "Space is swelling, like raisin bread rising in the oven."),
	s([24, 2], [25, 2], '葡萄干没动，是面团在长。', "The raisins don't move. The dough grows."),
	s([25, 2], [26, 2], '星系之间，空间也这样被撑开。', "That's how space between galaxies is stretching."),
	s([26, 2], [27, 0], '空间还会弯。', 'Space can bend, too.'),
	s([27, 0], [28, 0], '把保龄球放在蹦床上，', 'Put a bowling ball on a trampoline,'),
	s([28, 0], [29, 0], '旁边的弹珠，就会绕着它滚。', 'and a marble nearby rolls around it.'),
	s([29, 0], [30, 0], '太阳，也这样压弯了空间。', 'The Sun bends space the same way.'),
	// 5 起源形态与亚空裂斩
	s([30, 2], [31, 2], '这才是它原本的样子——', 'This is its original form,', LA_SITE),
	s([31, 2], [32, 2], '像极了创造万物的那位神。', 'one that closely resembles the creator of all things.', {zh: '改写自 LA 起源形态图鉴', en: 'LA Pokédex (Origin Forme)'}),
	s([32, 2], [33, 3], '它能把空间扭曲、打碎，再重新造出来。', 'It can warp space, shatter it, and create it anew.', LA_SITE),
	s([33, 3], [34, 3], '它的绝招叫“亚空裂斩”：', 'Its signature move is Spacial Rend:', LA_SITE),
	s([34, 3], [35, 3], '连对手带周围的空间，一起斩开。', 'it tears the target apart, along with the space around it.', {zh: '改写自招式说明（日月 / 剑盾）', en: 'LA official site'}),
	// 6 折纸与捷径
	s([36, 0], [37, 1], '裂缝后面，据说是它的世界：空间支离破碎。', 'Behind the rift, they say, lies its world, where space is torn to ribbons.', LA_SITE),
	s([37, 1], [38, 1], '它还能随意接通空间，', 'It can also link places in space at will,', {zh: '改写自心金魂银图鉴', en: 'HGSS Pokédex'}),
	s([38, 1], [39, 1], '一步就到远方，甚至别的空间。', 'reaching faraway places, even other dimensions.', {zh: '改写自心金魂银图鉴', en: 'HGSS Pokédex'}),
	s([39, 1], [40, 1], '怎么做到的？拿一张纸。', 'How? Take a sheet of paper.'),
	s([40, 1], [41, 1], '纸上两点，本来隔得很远；', 'Two dots on it are far apart.'),
	s([41, 1], [42, 1], '对折一下，两点就贴在一起。', 'Fold it, and the two dots touch.'),
	s([42, 1], [43, 1], '科学家把这种捷径叫“虫洞”，', 'Scientists call such a shortcut a wormhole.'),
	s([43, 1], [44, 0], '至今只是设想。', "So far, it's only an idea."),
	// 7 枪之柱
	s([44, 0], [45, 0], '空间之神的力量，有人想据为己有：', 'Someone wanted the power of the god of space.'),
	s([45, 0], [46, 0], '银河队的首领，赤日。', 'Cyrus, the boss of Team Galactic.'),
	s([46, 0], [47, 2], '他想用时间和空间，造一个新世界。', 'He meant to use time and space to make a new world.', {zh: '52poke「枪之柱」', en: 'Bulbapedia「Spear Pillar」'}),
	s([47, 2], [48, 2], '在天冠山顶的枪之柱，', 'At the Spear Pillar atop Mount Coronet,'),
	s([48, 2], [49, 2], '他用两条红色锁链，', 'with two Red Chains,', {zh: '白金剧情', en: 'Bulbapedia「Spear Pillar」'}),
	s([49, 2], [50, 3], '同时召来了帝牙卢卡和帕路奇亚。', 'he summoned Dialga and Palkia at once.', {zh: '白金剧情', en: 'Bulbapedia「Spear Pillar」'}),
	s([50, 3], [51, 3], '时间和空间，被拽到了一起——', 'Time and space, dragged together—'),
	s([52, 2], [53, 2], '两股力量，叠在了一起。', 'Their powers combined.', {zh: '白金剧情', en: 'Bulbapedia「Spear Pillar」'}),
	s([53, 2], [54, 3], '整个神奥的时空，都开始扭曲。', 'Space and time began to warp all across Sinnoh.', {zh: 'DP / Pt 剧情', en: 'Bulbapedia「Spear Pillar」'}),
	s([54, 3], [55, 3], '世界，差一点就被改写。', 'The world came close to being rewritten.'),
	// 8 一块布
	s([55, 3], [56, 3], '时间和空间，为什么分不开？', "Why can't time and space be pulled apart?"),
	s([56, 3], [58, 0], '在我们的世界里，它们本是一块布。', 'In our world, they are one fabric.'),
	s([58, 0], [59, 0], '你看到的太阳，是八分钟前的；', 'The Sun you see is the Sun of eight minutes ago.', {zh: '日地距离 ÷ 光速 ≈ 499 秒', en: ''}),
	s([59, 0], [60, 0], '看得越远，看到的就越早。', 'The farther you look, the further back you see.'),
	s([60, 0], [61, 0], '空间里，藏着时间。', 'Time is hidden inside space.'),
	s([61, 0], [62, 0], '神话里，它们也是一起出生的：', 'In myth, too, they were born together.'),
	s([62, 0], [63, 1], '时间于是开始流动，空间于是开始扩张。', 'Time started to spin. Space began to expand.', {zh: 'BDSP《起始的故事》', en: 'DP The Original Story'}),
	s([63, 1], [64, 0], '一起祈祷，才有了“物质”。', 'Together they wished, and matter came to be.', {zh: '改写自 BDSP《起始的故事》', en: 'DP The Original Story'}),
	s([64, 0], [65, 0], '造出世界的，是它们俩；', 'They made the world together;'),
	s([65, 0], [66, 0], '差点改写世界的，也是这股力量。', 'and that same power nearly rewrote it.'),
	// 9 回到屏幕
	s([66, 0], [67, 0], '眼前这块屏幕，看起来还是平的。', 'The screen in front of you still looks flat.'),
	s([67, 0], [68, 2], '它离你大约半米，光要走 1.7 纳秒。', "It's about half a meter away. Light takes 1.7 nanoseconds to cross it.", {zh: '0.5 m ÷ c ≈ 1.67 ns', en: ''}),
	s([68, 2], [69, 1], '隔开你们的，是空间；', 'What lies between you is space;'),
	s([69, 1], [70, 1], '让你晚一点看见的，是时间。', 'what makes you see it a moment late is time.'),
	s([70, 1], [71, 1], '一个在呼吸，一个在心跳——', 'One breathes. One beats.'),
	s([71, 1], [72, 0], '你就在它们中间。', 'And you are right between them.'),
];
