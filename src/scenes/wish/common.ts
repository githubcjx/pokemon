import {Easing, interpolate} from 'remotion';
import type {SubtitleSource} from '../../components/BiSubtitle';
import {clamp} from '../../theme';

/**
 * 《迎着流星》整期时间轴（30fps 帧号）。各段只是这条时间轴的窗口，段落交界天然无缝。
 *
 * **不按配乐卡点**（2026-11-08 起）：用户自己配乐剪辑。各句时长按阅读速度排
 * （中文 6.6 字/秒、英文 3.6 词/秒，最短 1.1 秒，句间 0.25 秒，段间 0.8 秒），
 * 由 script/wish-texts.md 的逐句表生成。
 */

/** 各段起点（整期总时间轴上的帧号） */
export const SEG_START = {
	hook: 0,
	unseen: 437,
	food: 917,
	clash: 1336,
	mural1: 1890,
	mural2: 2686,
	super: 3615,
	inherit: 4420,
	altar: 5355,
	rite: 5918,
	burst: 6716,
	ending: 7305,
} as const;
export type SegName = keyof typeof SEG_START;
/** 最后一句字幕收在 7792 帧，留白到 7912 帧淡出。 */
export const TOTAL_FRAMES = 7912;

const ORDER = Object.keys(SEG_START) as SegName[];
export const SEG_FRAMES = Object.fromEntries(
	ORDER.map((n, i) => [n, (i + 1 < ORDER.length ? SEG_START[ORDER[i + 1]] : TOTAL_FRAMES) - SEG_START[n]]),
) as Record<SegName, number>;

/** 交付的三个文件：上（第 2–4 段）、中（第 5–7 段）、下（第 8–12 段）；片头单独输出。 */
export const PARTS = {
	part1: [SEG_START.unseen, SEG_START.mural1],
	part2: [SEG_START.mural1, SEG_START.inherit],
	part3: [SEG_START.inherit, TOTAL_FRAMES],
} as const;

// ── 字幕 ──
export const SUB = {speed: 1.25, sync: true, scale: 1.12, enStrong: true, scrim: 1, fade: 10} as const;

export const ramp = (frame: number, from: number, to: number) =>
	interpolate(frame, [from, to], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});

const alphaSapphire = {zh: '阿尔法蓝宝石图鉴', en: 'Pokémon Alpha Sapphire Pokédex'};

type Sub = [number, number, string, string, SubtitleSource?];
/** 30fps 帧号 → 30fps 帧号（不按小节卡点；逐句时长按阅读速度排，见 script/wish-texts.md） */
const s = (from: number, to: number, zh: string, en: string, source?: SubtitleSource): Sub => [from, to, zh, en, source];

/** 全片字幕（与 script/wish-texts.md 一一对应；末帧比下一句早 4 帧收完） */
export const SUBS: Sub[] = [
	s(0, 60, "一颗陨石正朝着丰缘飞来。", "A meteor is hurtling toward Hoenn."), // ORAS 德尔塔篇：超巨大陨石即将撞击丰缘的 131 号水路
	s(71, 192, "塔顶，一个女孩正呼唤那条曾经救过这片土地的龙。", "Atop the tower, a girl called to the dragon that once saved this land."), // ORAS 天空之柱顶层「唤龙之祭坛」；希嘉娜的召唤仪式
	s(203, 235, "它真的来了。", "It came."), // ——
	s(257, 337, "可她等的那道光，迟迟没有亮起。", "But the light she had hoped for never appeared."), // ORAS 塔顶：召唤成功，但烈空坐未能超级进化
	s(437, 514, "那道光为什么没亮？我们稍后再解。", "Why did the light never come? We’ll get to that."), // ——（承接开场悬念）
	s(526, 597, "先来认识一位住在高空的古老居民。", "First, meet an ancient resident of the high sky."), // ——（引出图鉴）
	s(608, 720, "在臭氧层中生活了数亿年的宝可梦。", "It has lived for hundreds of millions of years in the ozone layer.", {zh: '火红图鉴', en: 'Pokémon FireRed Pokédex'}),
	s(732, 811, "可它飞得太高，从地面根本看不见它。", "It flew so high that it couldn't be seen from the ground."), // 钻石等图鉴（改写）
	s(917, 980, "有时，一道火光会从它身边掠过。", "Now and then, a trail of fire crossed its path."), // 承接陨石掠过的镜头
	s(991, 1087, "不断在臭氧层飞行，吞食陨石作为食物。", "It flies forever through the ozone layer, consuming meteoroids for sustenance.", alphaSapphire),
	s(1098, 1219, "用储存在体内的陨石能量来超级进化。", "The many meteoroids in its body provide the energy it needs to Mega Evolve.", alphaSapphire),
	s(1244, 1299, "先记住「超级进化」这四个字。", "Keep Mega Evolution in mind."), // 伏笔
	s(1336, 1423, "在它脚下的世界，盘踞着两位太古的霸主。", "Below it, two ancient tyrants held sway."), // ORAS 传说「固拉多与盖欧卡之间争斗」
	s(1435, 1547, "一位是大地之神，一位是海洋之神。", "One the god of the earth, the other the god of the sea."), // ——
	s(1559, 1638, "它们一旦交战，天地都会被撕开。", "When they fight, the world itself is torn apart."), // 绿宝石剧情语气
	s(1649, 1770, "世间流传着其调解固拉多与盖欧卡之间争斗的传说。", "Legends remain of how it put to rest the clash between Kyogre and Groudon.", {zh: '欧米伽红宝石图鉴', en: 'Pokémon Omega Ruby Pokédex'}),
	s(1782, 1859, "每当两位霸主开战，它便降临地面。", "Whenever the two clash, it descends to the ground."), // 绿宝石图鉴「当盖欧卡与固拉多互相战斗时，牠就会降临地面」（改写）
	s(1890, 1995, "现在回到那座塔，那道光没亮的答案，就在壁画里。", "Back at the tower, why the light failed is told in its murals."), // ——（呼应第 5 句，把开场钩子挂回正文）
	s(2006, 2197, "那个女孩叫希嘉娜。她指着石壁，上面刻着流星之民世代相传的故事。", "The girl was Zinnia. She pointed to the wall, where the Draconids carved the stories they had handed down."), // 德尔塔篇壁画第一层（转述）
	s(2209, 2296, "数千年前，丰缘大地满溢着自然能量。", "Thousands of years ago, the land overflowed with natural energy."), // 壁画第一层（改写）
	s(2308, 2431, "原始回归的固拉多与盖欧卡，为争夺这份能量不停厮杀。", "Primal Groudon and Primal Kyogre fought over that energy endlessly."), // 壁画第一层（改写）
	s(2442, 2480, "人们束手无策。", "People could do nothing."), // 壁画第一层
	s(2491, 2655, "就在这时，陨石从比天空更高的地方落下，砸中了流星之民栖居的瀑布。", "Then meteoroids fell from far beyond the sky and struck the waterfall where the Draconids lived."), // 壁画第一层（改写）
	s(2686, 2815, "坠落的陨石渐渐亮起，透出了七彩的光。", "The fallen stones began to glow in all the colors of the rainbow."), // 德尔塔篇壁画第二层（转述）
	s(2827, 2968, "就在那片光芒中，一道草绿色的身影从天而降。那是烈空坐。", "An emerald figure descended toward the light. It was Rayquaza."), // 德尔塔篇壁画第二层（转述）
	s(2980, 3103, "烈空坐制伏了原始回归的两位霸主，世间重归和平。", "Rayquaza subdued the two Primal titans, and peace returned."), // 壁画第二层（改写）
	s(3114, 3194, "人们自此把烈空坐奉为救世之神。", "The people of Hoenn revered Rayquaza as a savior."), // 壁画第二层
	s(3205, 3317, "一千年后，更大的陨石砸进海里，撞出了琉璃市所在的巨坑。", "A thousand years later, a greater meteoroid carved the crater of Sootopolis."), // 壁画第二层（改写）
	s(3329, 3416, "撞击震裂了大地，两位霸主再次苏醒。", "The impact cracked the earth, and the two titans woke again."), // 壁画第三层（改写）
	s(3428, 3460, "人们祈祷着。", "The people prayed."), // 壁画第三层
	s(3472, 3584, "祈愿之中，琉璃市中央的巨石亮了起来，仿佛一颗巨大的钥石。", "As they prayed, the stone at the heart of Sootopolis lit up like a giant Key Stone."), // 德尔塔篇壁画第三层（转述）
	s(3615, 3720, "烈空坐再度降临，人们献上了更真挚的祈祷。", "Rayquaza descended once more, and the people offered a truer prayer."), // 壁画第四层（改写）
	s(3732, 3800, "于是，烈空坐的身姿产生了变化。", "And so the Legendary Pokémon changed."), // 壁画第四层
	s(3812, 3953, "光把它整个包裹起来。待到光芒散去，壁画里的龙已换了一副身姿。", "Light enveloped it. As the glare receded, the dragon in the mural had changed."), // 德尔塔篇壁画第四层（转述）
	s(3964, 4069, "人们把那次变化，归于自己的祈愿和那块七彩之石。", "The people credited the change to their prayers and the rainbow stone."), // 德尔塔篇壁画第四层（转述）
	s(4081, 4204, "而在流星之民看来，是祈愿把心意传给了那条龙。", "To the Draconids, it was the prayers that carried their hopes to the dragon."), // 德尔塔篇壁画第四层（转述）
	s(4216, 4320, "后来，一位异乡人把这股平息动乱的力量，称作「德尔塔」。", "Later, a visitor called the power that quelled the chaos ‘Delta’."), // 德尔塔篇壁画第四层（转述）
	s(4420, 4516, "那就是超级进化，通常要靠训练家的钥石和超级石。", "That was Mega Evolution, usually needing a Key Stone and a Mega Stone."), // 《欧米伽红宝石／阿尔法蓝宝石》超级进化机制
	s(4528, 4578, "烈空坐不需要超级石。", "Rayquaza needs no Mega Stone."), // ORAS「烈空坐之所以不需要超级石就能超级进化」
	s(4590, 4719, "得文公司的研究员发现，它体内有一种器官，能起到超级石的作用。", "Devon researchers found that an organ inside Rayquaza can act like a Mega Stone."), // 得文公司研究员关于 Mikado organ 的说明（转述）
	s(4730, 4843, "它能把吞下的陨石能量，和自身的能量汇合起来。", "It combines energy from the meteorites it swallows with its own."), // 得文公司研究员关于能量的说明（转述）
	s(4854, 4936, "而这个秘密，被流星之民一代代传了下来。", "That secret was passed down by the Draconids, generation to generation."), // 希嘉娜：传承了守护世界的方法的祖先
	s(4948, 5039, "他们还预言：一千年后，会有第三颗陨石降临。", "They also foretold a third meteoroid a thousand years on."), // 壁画第五层（改写）
	s(5051, 5155, "而那一颗，会比前两次都更巨大。", "And that one would be greater than both of the last two."), // 壁画第五层
	s(5166, 5303, "于是，流星之民定下计划：在陨石撞来之前，唤下烈空坐。", "The Draconids planned to summon Rayquaza before the meteor struck."), // 德尔塔篇壁画第五层（转述）
	s(5355, 5442, "回到唤龙之祭坛，希嘉娜终于唤来了烈空坐。", "Back at the Dragonhark Altar, Zinnia finally summoned Rayquaza."), // 德尔塔篇天空之柱塔顶
	s(5453, 5545, "可它的身姿没有变化，体内的陨石能量已经不够了。", "Its form stayed the same. Its meteorite reserves had run too low."), // 德尔塔篇天空之柱塔顶（转述）
	s(5556, 5635, "这时，烈空坐吞下了主角带来的那块陨石。", "Then Rayquaza swallowed the meteorite the Trainer had brought."), // 德尔塔篇天空之柱塔顶（转述）
	s(5681, 5785, "恢复力量之后，烈空坐想亲自试试主角的本领。", "With its strength restored, Rayquaza wanted to test the Trainer itself."), // 德尔塔篇天空之柱塔顶（转述）
	s(5797, 5884, "主角必须迎战，设法收服它。", "The Trainer had to face Rayquaza and try to catch it."), // 德尔塔篇天空之柱塔顶（转述）
	s(5918, 6014, "收服烈空坐后，希嘉娜才教它那一招。", "Once Rayquaza was caught, Zinnia taught it one final move."), // 德尔塔篇天空之柱塔顶（转述）
	s(6026, 6117, "那是烈空坐的招牌招式，画龙点睛。", "It was Rayquaza’s signature move, Dragon Ascent."), // 德尔塔篇天空之柱塔顶（转述）
	s(6129, 6238, "学会画龙点睛，烈空坐就具备了超级进化的条件。", "Learning Dragon Ascent made Mega Evolution possible for Rayquaza."), // 德尔塔篇天空之柱塔顶及超级进化机制
	s(6250, 6400, "随后希嘉娜发起对战，让主角学会驾驭这股力量。这是流星之民最后一道传承仪式。", "Zinnia challenged the Trainer to master that power in battle. It was the Draconids’ final rite."), // 德尔塔篇天空之柱塔顶（转述）
	s(6411, 6471, "她想看看，新的传承者能走多远。", "She wondered how far this successor would go."), // 德尔塔篇天空之柱塔顶（转述）
	s(6511, 6607, "对战结束后，她接受了烈空坐的选择，把使命交给主角。", "After the battle, she accepted Rayquaza’s choice and entrusted the mission to the Trainer."), // 德尔塔篇天空之柱塔顶（转述）
	s(6716, 6795, "主角乘上超级烈空坐，冲出大气层。", "The Trainer rode Mega Rayquaza out of the atmosphere."), // ORAS：成为传承者的主角乘坐超级烈空坐击破超巨大陨石
	s(6806, 6894, "陨石就在眼前，比过去两次都更大。", "There it was — greater than both of the last two."), // 壁画第五层
	s(6922, 6951, "画龙点睛。", "Dragon Ascent."), // 招式名（官方简中）
	s(6991, 7045, "一道绿光贯穿了陨石。", "A streak of green light pierced the meteor."), // ORAS 德尔塔篇终局
	s(7056, 7192, "陨石粉碎，发现陨石的核心里，藏着另一只宝可梦", "The meteor shattered, revealing another Pokémon hidden at its core."), // ORAS 德尔塔篇陨石过场（旁白）
	s(7305, 7392, "千年前人们的祈祷，在这一天终于有了回应。", "The prayer of a thousand years was answered that day."), // ——（收钩子：光终于亮起）
	s(7404, 7500, "此后，云层之上，烈空坐依旧以陨石为食。", "Above the clouds, Rayquaza still feeds on meteorites."), // 《阿尔法蓝宝石》图鉴（转述）
	s(7511, 7634, "下次再看见流星划过夜空，那也许是超级烈空坐在追逐陨石。", "Next time a streak crosses the night sky, it may be Mega Rayquaza chasing a meteor."), // 《宝可梦传说 Z-A》超级烈空坐图鉴（转述）
	s(7674, 7788, "希嘉娜留下一封信，字里行间，似乎盼着故事能够续写。", "Zinnia left a letter, hoping the story might go on."), // 德尔塔篇希嘉娜告别信（转述）
];

// ── 镜头锚点（30fps 帧号，不再按小节卡点，按阅读速度排出的时间轴取） ──
export const K = {
	/** 第 8 句收尾：镜头还在云海下，烈空坐剪影只出现轮廓，不显色 */
	shadowAt: 815,
	/** 名称卡「烈空坐」+ 叫声（866 帧） */
	nameAt: 866,
	/** 两位霸主各自在显色峰值播放原版叫声。 */
	groudonAt: 1484,
	kyogreAt: 1515,
	/** 壁画里的两种原始回归形态。 */
	primalGroudonAt: 2346,
	primalKyogreAt: 2384,
	/** 壁画的超级进化。标志和第一次原版叫声在形态完成时出现。 */
	megaStart: 3729,
	megaAt: 3836,
	megaNameAt: 4295,
	/** 塔顶紧接使命交接，再次完整表现超级进化。 */
	riteMegaStart: 6611,
	riteMegaAt: 6665,
	/** 画龙点睛出力与陨石撞击的两个时点。 */
	ascentAt: 6940,
	impactAt: 6987,
	/** 片名浮现（第 4 句收尾之后，341 帧） */
	titleAt: 341,
};
