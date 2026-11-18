import {SubtitleSource} from '../../components/BiSubtitle';

/**
 * 《时间的心跳》整期时间轴（30fps 帧号）。各段只是这条时间轴的窗口，段落交界天然无缝。
 *
 * 全片按用户给的 C:\Users\Admin\Music\千年之后.mp3 卡点（用户剪辑时从第 0 帧放）：
 *   112.905 BPM，一拍 0.5314 秒，一小节 2.1257 秒；第 0 小节的强拍在 0.087 秒。
 *   乐段：前奏 0–4 / 静段 5–7 / 全乐队 8 / 主段 A 8–13 / 上扬 14–15 / 落拍 16 / 主段 A 16–21
 *         / 主段 B 22–27 / 上扬 28–29 / 落拍 30 / 主段 B 30–35 / 变柔、静段 36–43 / 主段 B 44–49
 *         / 上扬 50–51 / 落拍 52（全片最大爆发点）/ 主段 B 52–63 / 上扬 64–65 / 落拍 66 / 第 72 小节强拍结束
 * 字幕与卡点的对应见 script/time-texts.md。
 */

export const BPM = 112.905;
export const BEAT_SEC = 60 / BPM;
export const BAR_SEC = BEAT_SEC * 4;
export const DOWNBEAT0_SEC = 0.087;

/** 第 bar 小节第 beat 拍（0–3，可带小数）对应的 30fps 帧号（小数） */
export const bf = (bar: number, beat = 0) => (DOWNBEAT0_SEC + bar * BAR_SEC + beat * BEAT_SEC) * 30;
/** 一拍 / 一小节有多少个 30fps 帧 */
export const BEAT = BEAT_SEC * 30;
export const BAR = BAR_SEC * 30;

/** 各段起点（取整帧，供分段窗口用；段内动画仍按 bf() 的小数帧卡点） */
export const SEG_START = {
	hook: 0,
	still: Math.round(bf(6)),
	beat: Math.round(bf(14)),
	arrow: Math.round(bf(22)),
	speed: Math.round(bf(34)),
	roar: Math.round(bf(44)),
	heart: Math.round(bf(61)),
} as const;
export type SegName = keyof typeof SEG_START;
/** 第 72 小节强拍结束（153.14 秒） */
export const TOTAL_FRAMES = Math.round(bf(72));

const ORDER = Object.keys(SEG_START) as SegName[];
export const SEG_FRAMES = Object.fromEntries(
	ORDER.map((n, i) => [n, (i + 1 < ORDER.length ? SEG_START[ORDER[i + 1]] : TOTAL_FRAMES) - SEG_START[n]]),
) as Record<SegName, number>;

/** 交付的三个文件：上（第 1–3 段）、中（第 4–5 段）、下（第 6–7 段） */
export const PARTS = {
	part1: [0, SEG_START.arrow],
	part2: [SEG_START.arrow, SEG_START.roar],
	part3: [SEG_START.roar, TOTAL_FRAMES],
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
export const ease = (t: number) => easeIO(sat(t));
/** 淡入淡出包络：a 起淡入 inLen 帧，b 前 outLen 帧淡出 */
export const env = (f: number, a: number, b: number, inLen = 12, outLen = 12) =>
	Math.min(smooth(prog(f, a, a + inLen)), 1 - smooth(prog(f, b - outLen, b)));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - sat(t), 3);
export const easeInQuad = (t: number) => sat(t) * sat(t);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * sat(t)));
/** 确定性伪随机，0–1 */
export const rnd = (i: number) => {
	const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};
/** 拍点脉冲：每 every 拍一次，在拍点上为 1，按 decay 帧衰减 */
export const pulse = (f: number, from: number, to: number, every = 1, decay = 10) => {
	if (f < from || f > to + decay * 4) return 0;
	const step = BEAT * every;
	const k = Math.floor((Math.min(f, to) - from) / step);
	const t0 = from + k * step;
	return Math.exp(-(f - t0) / decay);
};

// ── 时间的流速 ──
/**
 * 画面里"流动的东西"（浮尘、刻度、颗粒）用的时间 τ：正常时 τ 与 f 同速；
 * 第 5 小节后半起慢下来，第 6–7 小节（音乐的静段）完全停住，第 8 小节强拍（全乐队进入）一下恢复。
 */
const FLOW: [number, number][] = [
	[0, 1],
	[bf(5, 2), 1],
	[bf(6), 0],
	[bf(8) - 0.01, 0],
	[bf(8), 1],
	// 第 58 小节"下一回合自己将无法动弹"：一切停住，第 60 小节第 3 拍起慢慢恢复
	[bf(58) - 0.01, 1],
	[bf(58), 0],
	[bf(60, 2), 0],
	[bf(61), 1],
];
const flowSpeed = (f: number) => {
	for (let i = 0; i < FLOW.length - 1; i++) {
		const [f0, s0] = FLOW[i];
		const [f1, s1] = FLOW[i + 1];
		if (f < f1) return s0 + (s1 - s0) * sat((f - f0) / (f1 - f0));
	}
	return 1;
};
/** τ(f)：流速的积分（分段线性，解析求和） */
export const flowTime = (f: number) => {
	let acc = 0;
	for (let i = 0; i < FLOW.length - 1; i++) {
		const [f0, s0] = FLOW[i];
		const [f1] = FLOW[i + 1];
		if (f <= f0) return acc;
		const b = Math.min(f, f1);
		const sb = flowSpeed(b);
		acc += ((s0 + sb) / 2) * (b - f0);
		if (f <= f1) return acc;
	}
	return acc + (f - FLOW[FLOW.length - 1][0]);
};
/** 当前是否处在"时间停住"的静段（颗粒也冻住） */
export const isFrozen = (f: number) => (f >= bf(6) && f < bf(8)) || (f >= bf(58) && f < bf(60, 2));
/** 冻住时颗粒停在哪一帧 */
export const frozenAt = (f: number) => (f < bf(20) ? bf(6) : bf(58));

// ── 字幕 ──
export const SUB = {speed: 1.25, sync: true, scale: 1.12, enStrong: true, scrim: 1} as const;

type Sub = [number, number, string, string, SubtitleSource?];
const s = (a: [number, number], b: [number, number], zh: string, en: string, source?: SubtitleSource): Sub => [bf(a[0], a[1]), bf(b[0], b[1]) - 4, zh, en, source];

/** 全片字幕（与 script/time-texts.md 一一对应；末帧比下一句早 4 帧收完） */
export const SUBS: Sub[] = [
	// 1 钩子
	s([0, 0], [1, 0], '打碎的杯子，不会自己拼回去。', 'A broken cup never puts itself back together.'),
	s([1, 0], [2, 0], '我们的时间，只往一个方向走。', 'In our world, time runs only one way.'),
	s([2, 0], [3, 0], '可宝可梦的传说里，有一个地方——', 'But in Pokémon legend, there is a place'),
	s([3, 0], [4, 0], '时间流动的方向，会不断变化。', "where time's flow keeps moving in different directions.", {zh: 'LA 官网：据说在它所存在的世界里，时间流动的方向会不断变化', en: 'LA official site: always moving in different directions'}),
	// 2 静止与流动
	s([6, 0], [7, 0], '想象一个什么都不变的世界。', 'Imagine a world where nothing ever changes.'),
	s([7, 0], [8, 0], '过了一秒，还是一万年？', 'Has a second passed, or ten thousand years?'),
	s([8, 0], [9, 0], '直到有一样东西动了——', 'Until something moves.'),
	s([9, 0], [10, 0], '时间，是靠“变化”才被看见的。', 'Time is seen only through change.'),
	s([10, 0], [11, 0], '神奥的神话，讲过时间的开始。', "Sinnoh's myths tell of how time began."),
	s([11, 0], [12, 0], '起初存在的，只有混沌的波澜。', 'In the beginning, there was only a churning turmoil of chaos.', {zh: 'BDSP《起始的故事》', en: 'DP The Original Story'}),
	s([12, 0], [13, 0], '起始之物创造出了２个分身。', 'From itself, two beings the Original One did make.', {zh: 'BDSP《起始的故事》', en: 'DP The Original Story'}),
	s([13, 0], [14, 0], '时间于是开始流动。', 'And so time began to flow.', {zh: 'BDSP《起始的故事》', en: '按 BDSP 中日文意译'}),
	// 3 节拍
	s([14, 0], [15, 0], '可时间看不见，人要怎么量它？', 'But time is invisible. How do we measure it?'),
	s([15, 0], [16, 0], '答案是：数那些重复的东西。', 'We count the things that repeat.'),
	s([16, 0], [17, 0], '传说里，时间本身也有心跳。', 'In legend, time itself has a heartbeat.', {zh: '改写自白金 / 黑白图鉴', en: "It is said that time flows when Dialga's heart beats."}),
	s([17, 0], [19, 0], '拥有操纵时间的力量，在神奥地区的神话里被描述成神。', 'It has the power to control time. It appears in Sinnoh-region myths as an ancient deity.', {zh: '钻石 / Y / αS / BD 图鉴', en: 'Diamond Pokédex'}),
	s([19, 0], [20, 2], '它的心脏每跳一下，时间就往前走一格。', 'Each time its heart beats, time moves forward.', {zh: '改写自白金 / 黑白图鉴', en: "It is said that time flows when Dialga's heart beats."}),
	s([20, 2], [22, 0], '我们数着节拍量时间，而它，就是那个节拍。', 'We measure time by counting beats. Dialga is the beat.'),
	// 4 时间之箭
	s([22, 0], [23, 0], '时间还有一个怪脾气：只往前走。', 'Time has one more quirk: it only moves forward.'),
	s([23, 0], [24, 2], '墨滴落进水里会散开，却不会自己聚回去。', 'Ink spreads through water, but never gathers itself back.'),
	s([24, 2], [25, 2], '为什么？拿一副牌来算一算。', "Why? Let's do the math with a deck of cards."),
	s([25, 2], [26, 2], '52 张牌，大约有 8×10⁶⁷ 种排法。', '52 cards can be arranged in about 8×10⁶⁷ ways.', {zh: '52! ≈ 8.07×10⁶⁷', en: '52! ≈ 8.07×10⁶⁷'}),
	s([26, 2], [27, 2], '按顺序排好的，只有 1 种。', 'Only one of them is in order.'),
	s([27, 2], [28, 2], '洗乱容易，洗回去几乎不可能。', 'Shuffling is easy. Unshuffling is almost impossible.'),
	s([28, 2], [29, 2], '这就是时间的箭头。', 'That is the arrow of time.'),
	s([29, 2], [30, 0], '可在它那里——', 'But for Dialga—'),
	s([30, 0], [31, 2], '光明乃是促使形态变化的导火线。', 'Radiant light caused Dialga to take on a form bearing a striking resemblance to the creator Pokémon.', {zh: 'LA 起源形态图鉴', en: 'LA Pokédex (Origin Forme), Bulbapedia'}),
	s([31, 2], [32, 2], '据说在它所存在的世界里，', 'In the world where it resides, the flow of time is said to be in constant flux—', {zh: 'LA 官网（简中）', en: 'LA official site'}),
	s([32, 2], [33, 2], '时间流动的方向会不断变化，', 'always moving in different directions', {zh: 'LA 官网（简中）', en: 'LA official site'}),
	s([33, 2], [34, 0], '其速度也不固定。', 'and different speeds.', {zh: 'LA 官网（简中）', en: 'LA official site'}),
	// 5 快与慢
	s([34, 0], [35, 2], '速度这件事，我们的世界也一样。', 'Speed is not fixed in our world either.'),
	s([35, 2], [36, 3], 'GPS 卫星上的钟，每天比地面快约 38 微秒。', 'Clocks on GPS satellites run about 38 microseconds a day faster than on the ground.', {zh: 'Ashby 2003：+45.9 −7.2 ≈ +38 μs/天', en: 'Ashby 2003'}),
	s([36, 3], [38, 0], '不修正的话，导航每天会偏出约 10 公里。', 'Left uncorrected, navigation would drift about 10 km a day.', {zh: '38 μs × 光速 ≈ 11 km', en: '38 μs × c ≈ 11 km'}),
	s([38, 0], [39, 0], '可我们只能测量快慢，', 'We can only measure it.'),
	s([39, 0], [40, 2], '而传说中的它，能自如地操纵时间的流动，', 'Dialga, legend says, controls the flow of time at will,', {zh: '改写自心金魂银图鉴', en: 'HGSS Pokédex'}),
	s([40, 2], [41, 2], '去往过去，也去往未来。', 'traveling into the past and the future.', {zh: '改写自心金魂银图鉴', en: 'HGSS Pokédex'}),
	s([42, 0], [43, 0], '如果它全力出手，又会怎样？', 'What happens when it unleashes its full power?'),
	// 6 时光咆哮
	s([44, 0], [45, 0], '它最擅长的招式，叫“时光咆哮”。', "Dialga's signature move is called Roar of Time.", {zh: 'LA 官网（简中）', en: 'LA official site'}),
	s([45, 0], [46, 2], '释放出扭曲时间般的强大力量攻击对手。', 'The user blasts the target with power that distorts even time.', {zh: '招式说明（日月 / 剑盾）', en: 'Move description (PokeAPI)'}),
	s([47, 0], [48, 0], '我们用来理解时间的一切：', 'Everything we use to understand time—'),
	s([48, 0], [49, 0], '变化、节拍、箭头、快慢——', 'change, beats, the arrow, speed—'),
	s([49, 0], [50, 0], '全都画在这张图上。', 'all drawn on this one chart.'),
	s([50, 0], [51, 0], '它拥有将时间——', 'Dialga has the power to—', {zh: 'LA 官网（简中）', en: 'LA official site'}),
	s([52, 0], [53, 0], '扭曲、', 'warp,', {zh: 'LA 官网（简中）', en: 'LA official site'}),
	s([53, 0], [54, 0], '破坏、', 'destroy,', {zh: 'LA 官网（简中）', en: 'LA official site'}),
	s([54, 0], [55, 0], '和再生的力量。', 'and create time itself.', {zh: 'LA 官网（简中）', en: 'LA official site'}),
	s([57, 0], [58, 0], '招式说明里还有一句：', 'The move description has one more line:'),
	s([58, 0], [59, 0], '下一回合自己将无法动弹。', "The user can't move on the next turn.", {zh: '招式说明', en: 'Move description (PokeAPI)'}),
	s([59, 0], [60, 2], '掌管时间的它，也有停下来的时候。', 'Even the master of time must stand still for a moment.'),
	// 7 心跳
	s([61, 0], [62, 0], '回到我们的世界。', 'Back to our world.'),
	s([62, 0], [63, 0], '在你看这段视频的两分多钟里，', "In the two-plus minutes you've spent watching this,"),
	s([63, 0], [64, 0], '你的心，已经跳了一百多下。', 'your heart has beaten more than a hundred times.'),
	s([64, 0], [65, 0], '每一下，都是时间走过的痕迹。', 'Each beat is a trace of time passing.'),
	s([65, 0], [66, 0], '神话里，时间和空间出现之后，', 'In the myth, after time and space came to be,'),
	s([66, 0], [67, 2], '在３个生命祈祷后，所谓的“心灵”就此诞生。', 'The three living things wished, and from them, spirit came to be.', {zh: 'BDSP《起始的故事》', en: 'DP The Original Story'}),
	s([67, 2], [68, 2], '有了心，时间才能被感受到。', 'Only with a mind can time be felt.', {zh: '改写自 LA 吾思的台词', en: ''}),
	s([68, 2], [69, 2], '它的心跳，推着时间往前；', 'Its heartbeat moves time forward.'),
	s([69, 2], [71, 0], '你的心跳，让你知道它在流动。', 'Yours lets you know that time is flowing.'),
];

/** 屏幕震动（屏幕像素）：第 52 小节咆哮、第 53 小节碎裂 */
export const shakeAt = (f: number): [number, number] => {
	const roar = bf(52);
	const brk = bf(53);
	const k = Math.max(f >= roar ? Math.exp(-(f - roar) / 14) : 0, f >= brk ? 0.6 * Math.exp(-(f - brk) / 10) : 0);
	if (k < 0.01) return [0, 0];
	return [Math.sin(f * 4.1) * 14 * k, Math.cos(f * 5.3) * 10 * k];
};
