/**
 * 《人造容器》整期时间轴（30fps 帧号）。各段只是这条时间轴的窗口，段落交界天然无缝。
 *
 * 全片按用户给的音乐文件《千年之后》卡点（参考视频用的也是这首，用户剪辑时从第 0 帧放）：
 *   112.91 BPM，一拍 0.5314 秒，一小节 2.1256 秒；第 0 小节的强拍在 1.092 秒。
 *   乐段：前奏 0–3 / 静段 4–6 / 引入 7 / 主段 8–13 / 上扬 14–15 / 主段 16–27 / 上扬 28–29
 *         / 主段 30–39（36 起变柔）/ 静段 40–42 / 引入 43 / 主段 44–49 / 上扬 50–51 / 尾段 52–61
 *         / 第 62 小节起原曲自然淡出，134.3 秒结束
 * 字幕与卡点的对应见 script/pokeball-texts.md。
 */

export const BPM = 112.91;
export const BEAT_SEC = 60 / BPM;
export const BAR_SEC = BEAT_SEC * 4;
export const DOWNBEAT0_SEC = 1.0918;
/** 音乐文件时长（秒），全片到这里结束 */
export const MUSIC_END_SEC = 134.3;

/** 第 bar 小节第 beat 拍（0–3，可带小数）对应的 30fps 帧号（小数） */
export const bf = (bar: number, beat = 0) => (DOWNBEAT0_SEC + bar * BAR_SEC + beat * BEAT_SEC) * 30;
/** 一拍 / 一小节有多少个 30fps 帧 */
export const BEAT = BEAT_SEC * 30;
export const BAR = BAR_SEC * 30;

/** 各段起点（取整帧，供分段窗口用；段内动画仍按 bf() 的小数帧卡点） */
export const SEG_START = {
	hook: 0,
	before: Math.round(bf(7)),
	invention: Math.round(bf(10)),
	recipe: Math.round(bf(14)),
	electrode: Math.round(bf(20)),
	clans: Math.round(bf(23)),
	origin: Math.round(bf(28)),
	museum: Math.round(bf(34)),
	kurt: Math.round(bf(38)),
	factory: Math.round(bf(43)),
	master: Math.round(bf(47)),
	chain: Math.round(bf(52)),
	broken: Math.round(bf(54)),
	ending: Math.round(bf(56)),
} as const;
export type SegName = keyof typeof SEG_START;
export const TOTAL_FRAMES = Math.round(MUSIC_END_SEC * 30);

const ORDER = Object.keys(SEG_START) as SegName[];
export const SEG_FRAMES = Object.fromEntries(
	ORDER.map((n, i) => [n, (i + 1 < ORDER.length ? SEG_START[ORDER[i + 1]] : TOTAL_FRAMES) - SEG_START[n]]),
) as Record<SegName, number>;

/** 交付的三个文件：第 1–4 段、第 5–8 段、第 9–14 段 */
export const PARTS = {
	part1: [0, SEG_START.electrode],
	part2: [SEG_START.electrode, SEG_START.kurt],
	part3: [SEG_START.kurt, TOTAL_FRAMES],
} as const;

// ── 关键帧工具 ──
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 分段缓入缓出：每个关键帧处速度为 0 */
export function track(f: number, keys: [number, number][], ease = easeIO): number {
	if (f <= keys[0][0]) return keys[0][1];
	for (let i = 0; i < keys.length - 1; i++) {
		const [f0, v0] = keys[i];
		const [f1, v1] = keys[i + 1];
		if (f <= f1) return v0 + (v1 - v0) * ease((f - f0) / Math.max(f1 - f0, 1e-6));
	}
	return keys[keys.length - 1][1];
}

export const sat = (x: number) => Math.min(1, Math.max(0, x));
/** [a, b] 区间内 0→1 的线性进度 */
export const prog = (f: number, a: number, b: number) => sat((f - a) / (b - a));
export const smooth = (t: number) => t * t * (3 - 2 * t);
/** 淡入淡出包络：a 起淡入 inLen 帧，b 前 outLen 帧淡出 */
export const env = (f: number, a: number, b: number, inLen = 12, outLen = 12) =>
	Math.min(smooth(prog(f, a, a + inLen)), 1 - smooth(prog(f, b - outLen, b)));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - sat(t), 3);
export const easeInQuad = (t: number) => sat(t) * sat(t);

// ── 字幕（帧号由小节换算，见 script/pokeball-texts.md） ──
export type Sub = {zh: string; en: string; from: number; to: number; source: string};

const S = (zh: string, en: string, a: number, b: number, source: string): Sub => ({zh, en, from: a, to: b - 2, source});

export const SUBS: Sub[] = [
	S('传说中，时空之神说过，要平息混乱，需要三样东西。', 'Legend says the deity of time and space once named three things needed to calm the chaos.', 1, bf(1), '旁白（LA 神奥神殿的传说）'),
	S('宇宙起始之石。红色锁链。人造容器。', 'The stone of creation\'s beginning. The chain of red. The vessel of humankind\'s invention.', bf(1), bf(2, 2), 'LA 刚石（原文）'),
	S('第三样，几乎每个训练家身上都有。', 'The third, nearly every Trainer carries.', bf(2, 2), bf(4), '旁白'),
	S('在精灵球出现以前，人和宝可梦并肩而行。', 'Before Poké Balls existed, people and Pokémon walked side by side.', bf(7), bf(8, 2), '旁白（HGSS 空木博士）'),
	S('直到古代神奥的洗翠时代，精灵球才刚刚出现。', 'Only in the Hisui era, the Sinnoh of old, did the Poké Ball first appear.', bf(8, 2), bf(10), '旁白（LA）'),
	S('在拉苯博士口中，它还是个刚开发出来的新东西。', 'To Professor Laventon, it was still a brand-new invention.', bf(10), bf(12), '旁白（LA 拉苯博士）'),
	S('可这么小的一颗球，凭什么装得下宝可梦？', 'But how could a ball this small hold a Pokémon?', bf(12), bf(14), '旁白'),
	S('因为宝可梦天生就会变小，精灵球正是利用了这种能力。', 'Pokémon can shrink themselves, and the Poké Ball makes use of that power.', bf(14), bf(16, 2), '旁白（LA 拉苯博士）'),
	S('做球的材料也不复杂：球果做外壳，玉石激发性能。', 'The recipe is simple: an Apricorn for the shell, a tumblestone to draw out its power.', bf(16, 2), bf(18, 2), '旁白（LA 道具说明·球果果、玉石）'),
	S('材料换一换，做出来的球也就不一样。', 'Change the materials, and you get a different ball.', bf(18, 2), bf(20), '旁白（LA 工艺配方）'),
	S('洗翠还有一种宝可梦，长得就像这种手工球。', 'Hisui also had a Pokémon that looked just like these handmade balls.', bf(20), bf(21, 2), '旁白'),
	S('图鉴里说，它体表的组织和球果的成分非常接近。', 'Its Pokédex entry says the tissue on its surface is remarkably close to an Apricorn.', bf(21, 2), bf(23), '旁白（LA 图鉴·洗翠顽皮雷弹）'),
	S('可金刚队和珍珠队向来不用球。', 'Yet the Diamond and Pearl Clans never used Poké Balls.', bf(23), bf(24), '旁白（Bulbapedia 金刚队、珍珠队）'),
	S('直到见过主角，他们才明白：球里的宝可梦，也能是知心的搭档。', 'Only after meeting the protagonist did they see that a Pokémon in a ball can still be a true partner.', bf(24), bf(26), '旁白（LA 珠贝、刚石）'),
	S('不久，帕路奇亚在神奥神殿狂暴起来。要平息它，就得凑齐那三样东西。', 'Soon, Palkia began to rage at the Temple of Sinnoh. To calm it, the three things had to be brought together.', bf(26), bf(28), '旁白（LA 道具说明·起源球）'),
	S('拉苯博士猜到了：所谓人造容器，就是精灵球。', 'Professor Laventon worked it out: the vessel of humankind\'s invention was the Poké Ball.', bf(28), bf(29, 2), '旁白（LA 拉苯博士）'),
	S('三样东西合在一起，成了起源球，收服了狂暴的帕路奇亚。', 'Together, the three became the Origin Ball, and it caught the raging Palkia.', bf(30), bf(32), '旁白（LA 道具说明·起源球）'),
	S('谁也没想到，这么小的一颗球，救下了整个洗翠。', 'No one expected so small a ball to save all of Hisui.', bf(32), bf(34), '旁白（LA 珠贝）'),
	S('很多年后，洗翠的精灵球被摆进了卡洛斯的密阿雷美术馆。', 'Many years later, Hisuian Poké Balls went on display at the Lumiose Museum in Kalos.', bf(34), bf(36), '旁白（Z-A 展品）'),
	S('说明牌上写着：到了现代，自己做球已经是件难事。', 'Its placard reads: in the modern age, crafting your own Poké Ball is no easy task.', bf(36), bf(38), '旁白（Z-A 展品说明）'),
	S('可在城都的桧皮镇，工匠钢铁至今还在用球果做球。', 'Yet in Azalea Town, Johto, the craftsman Kurt still makes them from Apricorns.', bf(38), bf(40), '旁白（金银 / 心金魂银）'),
	S('七种颜色的球果，做出七种不同的精灵球。', 'Seven colors of Apricorn, seven different Poké Balls.', bf(40), bf(42), '旁白'),
	S('如今，精灵球大多是工厂成批造出来的，商店里随处都能买到。', 'Today, most Poké Balls are mass-produced in factories and sold in every shop.', bf(43), bf(45), '旁白'),
	S('也正是精灵球开卖的时候，人们发现了长得像它的霹雳电球。', 'And just as Poké Balls went on sale, people discovered Voltorb, a Pokémon that looks like one.', bf(45), bf(47), '旁白（图鉴·霹雳电球）'),
	S('西尔佛公司还造出了必定能捉到宝可梦的大师球。', 'Silph Co. even made the Master Ball, which never fails to catch a Pokémon.', bf(47), bf(48, 2), '旁白（道具说明·大师球）'),
	S('银河队首领赤日也有一颗，却把它交给了主角。', 'Cyrus, boss of Team Galactic, had one too—and handed it to the protagonist.', bf(48, 2), bf(50), '旁白（BDSP）'),
	S('他说他不需要——他要把宝可梦的力量变成自己的。', 'He had no need for it. He meant to make the power of Pokémon his own.', bf(50), bf(52), '旁白（BDSP 赤日）'),
	S('洗翠的人把锁链做进了球里；赤日却丢开球，又造出了锁链。', 'Hisui forged the chain into a ball. Cyrus cast the ball aside and forged the chain anew.', bf(52), bf(54), '旁白'),
	S('可大师球也有关不住的时候：失控的太乐巴戈斯，把它撑碎了。', 'Yet even a Master Ball can fail to hold: the uncontrolled Terapagos shattered it.', bf(54), bf(56), '旁白（朱紫 零之秘宝）'),
	S('那么，精灵球真正装着的是什么？', 'So what does a Poké Ball truly hold?', bf(56), bf(58), '旁白'),
	S('画里不断增多的精灵球，被认为寄托着想和所有宝可梦连结的心愿。', 'The ever-growing number of Poké Balls in the painting is said to express a wish to connect with every Pokémon.', bf(58), bf(60), '旁白（Z-A 展品说明）'),
	S('它装下的，从来不只是宝可梦。', 'What it holds has never been just a Pokémon.', bf(60), bf(62), '旁白'),
];

// ── 左上角时代标签、右上角游戏出处卡 ──
export type Era = {at: number; era: string; place: string};
export const ERAS: Era[] = [
	{at: bf(7), era: '很久以前', place: '没有精灵球的年代'},
	{at: bf(10), era: '洗翠时代', place: '起始海滩 · 拉苯博士'},
	{at: bf(14), era: '洗翠时代', place: '祝庆村 · 拉苯博士'},
	{at: bf(16, 2), era: '洗翠时代', place: '祝庆村 · 工艺制作'},
	{at: bf(20), era: '洗翠时代', place: '天冠山麓'},
	{at: bf(23), era: '洗翠时代', place: '金刚队与珍珠队'},
	{at: bf(26), era: '洗翠时代', place: '神奥神殿'},
	{at: bf(34), era: '现代', place: '卡洛斯 · 密阿雷美术馆'},
	{at: bf(38), era: '现代', place: '城都 · 桧皮镇 · 钢铁'},
	{at: bf(43), era: '现代', place: '关都 · 丰缘 · 卡洛斯'},
	{at: bf(47), era: '现代', place: '关都 · 西尔佛公司'},
	{at: bf(48, 2), era: '现代', place: '神奥 · 银河队基地'},
	{at: bf(54), era: '现代', place: '帕底亚'},
	{at: bf(56), era: '现在', place: '你的手中'},
];

export type Source = {at: number; en: string; zh: string; note: string; seal: string; hide?: boolean};
const HIDE = {en: '', zh: '', note: '', seal: '', hide: true};
const BDSP = {en: 'Pokémon Brilliant Diamond & Shining Pearl', zh: '宝可梦 晶灿钻石·明亮珍珠'};
const ZA = {en: 'Pokémon Legends: Z-A', zh: '宝可梦传说 Z-A'};
const LA = {en: 'Pokémon Legends: Arceus', zh: '宝可梦传说 阿尔宙斯'};
export const SOURCES: Source[] = [
	{at: bf(10), ...LA, note: '银河队 · 拉苯博士', seal: '台词'},
	{at: bf(16, 2), ...LA, note: '道具说明 · 球果果 / 玉石', seal: '道具'},
	{at: bf(18, 2), ...LA, note: '工艺制作 · 配方', seal: '道具'},
	{at: bf(20), ...LA, note: '图鉴 · 顽皮雷弹（洗翠的样子）', seal: '图鉴'},
	{at: bf(23), ...LA, note: '金刚队 · 刚石 / 珍珠队 · 珠贝', seal: '台词'},
	{at: bf(26), ...LA, note: '道具说明 · 起源球', seal: '道具'},
	{at: bf(28), ...LA, note: '银河队 · 拉苯博士', seal: '台词'},
	{at: bf(30), ...LA, note: '道具说明 · 起源球', seal: '道具'},
	{at: bf(32), ...LA, note: '珍珠队 · 珠贝', seal: '台词'},
	{at: bf(34), ...ZA, note: '大洗翠展 · 洗翠地区的精灵球', seal: '展品'},
	{at: bf(38), ...HIDE},
	{at: bf(45), en: 'Pokémon X', zh: '宝可梦 X', note: '图鉴 · 霹雳电球', seal: '图鉴'},
	{at: bf(47), ...BDSP, note: '道具说明 · 大师球', seal: '道具'},
	{at: bf(48, 2), ...BDSP, note: '银河队 · 赤日', seal: '台词'},
	{at: bf(52), ...HIDE},
	{at: bf(54), en: 'Pokémon Scarlet & Violet: The Hidden Treasure of Area Zero', zh: '宝可梦 朱／紫 零之秘宝', note: '剧情 · 乌栗与太乐巴戈斯', seal: '剧情'},
	{at: bf(56), ...HIDE},
	{at: bf(58), ...ZA, note: '密阿雷美术馆 · 《精灵球工厂》', seal: '展品'},
	{at: bf(60), ...HIDE},
];

/** 宝可梦叫声（首次登场、显色峰值处，落在拍点上） */
export const CRIES = [
	{name: 'rowlet', at: bf(11)},
	{name: 'electrode-hisui', at: bf(21)},
	{name: 'palkia-origin', at: bf(30)},
	{name: 'voltorb', at: bf(45)},
	{name: 'terapagos-stellar', at: bf(54)},
];
