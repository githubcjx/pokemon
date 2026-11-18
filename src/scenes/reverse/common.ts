import {bf} from '../time/common';

/**
 * 《世界的背面》整期时间轴（30fps 帧号）。各段只是这条时间轴的窗口，段落交界天然无缝。
 *
 * 配乐和前两期是同一个文件 C:\Users\Admin\Music\千年之后.mp3（用户剪辑时从第 0 帧放），
 * 节拍工具沿用 time/common：112.905 BPM，一小节 2.1257 秒，第 0 小节强拍在 0.087 秒。
 * 字幕与卡点的对应见 script/reverse-texts.md（由 tools/reverse_subs.py 生成）。
 */
export {BAR, BEAT, bf, ease, easeInQuad, easeOutCubic, easeOutExpo, env, lerp, prog, rnd, sat, smooth, track} from '../time/common';

/** 各段起点（取整帧，供分段窗口用；段内动画仍按 bf() 的小数帧卡点） */
export const SEG_START = {
	hook: 0,
	shadow: Math.round(bf(6)),
	name: Math.round(bf(14)),
	banish: Math.round(bf(22)),
	flip: Math.round(bf(30)),
	distort: Math.round(bf(36)),
	balance: Math.round(bf(44)),
	origin: Math.round(bf(52)),
	home: Math.round(bf(55)),
	back: Math.round(bf(66)),
} as const;
export type SegName = keyof typeof SEG_START;
/** 第 72 小节强拍结束（153.14 秒） */
export const TOTAL_FRAMES = Math.round(bf(72));

const ORDER = Object.keys(SEG_START) as SegName[];
export const SEG_FRAMES = Object.fromEntries(
	ORDER.map((n, i) => [n, (i + 1 < ORDER.length ? SEG_START[ORDER[i + 1]] : TOTAL_FRAMES) - SEG_START[n]]),
) as Record<SegName, number>;

/** 交付的三个文件：上（第 1–3 段）、中（第 4–6 段）、下（第 7–10 段） */
export const PARTS = {
	part1: [0, SEG_START.banish],
	part2: [SEG_START.banish, SEG_START.balance],
	part3: [SEG_START.balance, TOTAL_FRAMES],
} as const;

// ── 字幕 ──
/** 中英同时显现、字号 1.12、英文加粗；暗晕垫底由 Master 里一层连续的 SubScrim 负责，不随每句闪 */
export const SUB = {sync: true, scale: 1.12, enStrong: true, scrim: 0, fade: 6} as const;

/** [小节, 拍, 中文, 英文]（与 script/reverse-texts.md 一一对应） */
const LINES: [number, number, string, string][] = [
	// hook · 钩子与片名
	[0, 0, "枪之柱上，时间与空间之神都到了。", "At the Spear Pillar, the gods of time and space had both arrived."],
	[1, 2, "地上却多了第三个影子。", "But on the ground, there was a third shadow."],
	[2, 2, "它不属于这个世界。", "It did not belong to this world."],
	[5, 0, "被放逐的那一位，回来了。", "The one who was banished had come back."],
	// shadow · 影子立起来
	[6, 0, "银河队首领赤日，想借它们的力量重造世界。", "Cyrus, boss of Team Galactic, meant to use their power to remake the world."],
	[8, 0, "这时，影子从地上立了起来。", "Then the shadow rose up from the ground."],
	[9, 0, "赤日说：「原来有宝可梦，只能以影子现身。」", "Cyrus said, \"So there is a Pokémon that can only appear as a shadow.\""],
	[10, 2, "影子随即把他拖走了。", "At once, the shadow dragged him away."],
	[11, 2, "原地留下一道口子，", "It left an opening behind,"],
	[12, 2, "石柱开始扭曲，像要被拉进另一边。", "and the pillars began to warp, as if pulled to the other side."],
	// name · 名字
	[14, 0, "神奥冠军竹兰赶到了。", "Cynthia, Sinnoh's Champion, arrived."],
	[15, 0, "「世界诞生时，还有第三位。」", "\"When this world was made, there was a third.\""],
	[16, 0, "「力量不输时间与空间，名字却不能说出口。」", "\"As powerful as time and space, yet its name was never to be spoken.\""],
	[17, 2, "「它叫骑拉帝纳。」", "\"Giratina.\""],
	[18, 2, "据说它住在这个世界背面的另一个世界。", "It is said to live in another world, on the reverse side of ours."],
	[20, 0, "它为什么会在那一边？得从世界诞生时说起。", "Why is it over there? That story begins with the birth of the world."],
	// banish · 来历
	[22, 0, "洗翠的石板上写着：三只宝可梦一同诞生，", "The Hisuian plates say three Pokémon were born together"],
	[23, 2, "一起连结时间与空间。", "to bind time and space."],
	[24, 2, "第三只太过粗暴，被放逐了。", "The third was too violent, and was banished."],
	[25, 2, "其狂暴的分身，被赐予了世界的背面。", "The other side of this world was given by the Original One to its raging third."],  // 原文
	[27, 0, "后来神奥的神话，只写了时间和空间。", "Later, Sinnoh's myths spoke only of time and space."],
	[28, 2, "它在洗翠真的反抗过：撕开了天上的裂缝。", "In Hisui, it truly rebelled: it tore open a rift in the sky."],
	// flip · 翻到背面
	[30, 0, "回到枪之柱：竹兰和主角追了进去——", "Back at the Spear Pillar, Cynthia and the player chased after it—"],
	[31, 2, "这里就是世界的背面，毁坏的世界。", "This is the other side of the world: the Distortion World."],
	[33, 0, "竹兰发现，这里时间不流动，", "Cynthia found that time does not flow here,"],
	[34, 0, "空间也不安稳，", "space is never stable,"],
	[35, 0, "一切常规都和这边不同。", "and every rule is different from ours."],
	// distort · 规则不同的世界
	[36, 0, "岛浮在半空，树倒着长，", "Islands float in midair; trees grow upside down;"],
	[37, 2, "瀑布倒挂，墙也能当路走，", "waterfalls hang inverted, and walls can be walked on."],
	[38, 2, "分不清哪边是天，哪边是地。", "There is no telling which way is sky and which is ground."],
	[39, 2, "剧场版里它穿镜面来去，游戏里靠裂口。", "In the movies, it travels through mirrors. In the games, it uses rifts."],
	[41, 0, "这里没有别的宝可梦。", "No other Pokémon live here."],
	[42, 0, "竹兰想不通：「它为什么一直独自待在这里？」", "Cynthia wondered, \"Why is Giratina here all alone?\""],
	// balance · 两个世界
	[44, 0, "赤日在最深处等着。", "Cyrus was waiting in the depths."],
	[45, 0, "他看出：这两个世界是互相撑着的，", "He saw that the two worlds hold each other up."],
	[46, 2, "少一个，另一个也不能存在。", "Without one, the other cannot exist."],
	[47, 2, "就像一张纸：撕掉一面，另一面也跟着没了。", "Like a sheet of paper: tear away one side, and the other goes with it."],
	[49, 0, "它拖走赤日，是因为两个世界都有了危险。", "It dragged Cyrus away because both worlds were in danger."],
	[50, 2, "赤日却只想打倒它，抹掉背面的世界。", "But Cyrus only wanted to defeat it and erase the other side."],
	// origin · 原本的样子
	[52, 0, "在这里，它变了样子——", "Here, it changes shape—"],
	[53, 0, "它的专属招式，叫“暗影潜袭”：", "Its signature move is Shadow Force:"],
	[54, 0, "先消失踪影，下一回合才出手，", "it vanishes first, then strikes on the next turn,"],
	// home · 它的两个样子
	[55, 2, "对手防得再严，也照样打中。", "and it hits even a target that protects itself."],
	[56, 2, "交手过后，它明白了人与宝可梦的羁绊，扭曲停了下来。", "After the battle, it understood the bond between people and Pokémon, and the distortion stopped."],
	[58, 2, "随后，它沉回了背面的深处。", "Then it sank back into the depths of the other side."],
	[60, 0, "在这里，它是起源形态；", "Here, it takes its Origin Forme;"],
	[61, 0, "到了这一边，就成了别种形态。", "on our side, it becomes its Altered Forme."],
	[62, 2, "石板上写着：满盈在世界背面者，足可令生灵改变身姿。", "A plate reads: \"That which fills the other side of the world can shape the rage and mold it.\""],  // 原文
	[65, 0, "背面世界的力量，让它换了模样。", "The power of the other side changes its shape."],
	// back · 另一面
	[66, 2, "所以我们在这一边见过的骑拉帝纳，", "So the Giratina we have seen on our side"],
	[68, 0, "都只是它的一面；", "is only one side of it;"],
	[69, 0, "另一面，留在了世界的背面。", "the other remains on the reverse side of the world."],
];

const zhChars = (s: string) => (s.match(/[\u4e00-\u9fff0-9]/g) ?? []).length;

export type Sub = {from: number; to: number; zh: string; en: string; wipe: number};
/**
 * 每句一直留到下一句出现（最后一句留到片尾）；第 1 句从第 0 帧开始。
 * 从左到右的显现按这句的时长配：约占一半，每字最多 3 帧。
 */
export const SUBS: Sub[] = LINES.map(([n, k, zh, en], i) => {
	const from = i === 0 ? 0 : bf(n, k);
	const next = LINES[i + 1];
	const to = next ? bf(next[0], next[1]) : TOTAL_FRAMES;
	const wipe = Math.max(14, Math.min((to - from) * 0.5, zhChars(zh) * 3));
	return {from, to, zh, en, wipe};
});
