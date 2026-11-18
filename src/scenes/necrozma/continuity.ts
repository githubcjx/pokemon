import {BASE_FPS} from '../../time';

/**
 * 《夺走的光辉》整期时间轴（30fps 帧号）。
 *
 * 整期画面写成一条连续的总时间轴（Master.tsx），每段只是它的一个窗口：
 * 段落交界处下一段第一帧天然接着上一段最后一帧，镜头、光照、纹理流动全都连续。
 */
export const HOOK_SCENE_FRAMES = 540; // 1 两个名字 → 片名
export const RADIANCE_SCENE_FRAMES = 357; // 2 光辉大神（内部 420 帧，提速播放）
export const GREED_SCENE_FRAMES = 780; // 3 贪心
export const DARK_SCENE_FRAMES = 600; // 4 漆黑
export const TOWER_SCENE_FRAMES = 408; // 5 牢塔（内部 480 帧，提速播放）
export const BOOK_SCENE_FRAMES = 960; // 6 光之掠夺者
export const RETURN_SCENE_FRAMES = 960; // 7 再临
export const BURST_SCENE_FRAMES = 820; // 8 追击与究极爆发
export const CODA_SCENE_FRAMES = 960; // 9 尾声

const ORDER = [
	['hook', HOOK_SCENE_FRAMES],
	['radiance', RADIANCE_SCENE_FRAMES],
	['greed', GREED_SCENE_FRAMES],
	['dark', DARK_SCENE_FRAMES],
	['tower', TOWER_SCENE_FRAMES],
	['book', BOOK_SCENE_FRAMES],
	['return', RETURN_SCENE_FRAMES],
	['burst', BURST_SCENE_FRAMES],
	['coda', CODA_SCENE_FRAMES],
] as const;

export type SegName = (typeof ORDER)[number][0];

export const SEG_START = {} as Record<SegName, number>;
export const SEG_FRAMES = {} as Record<SegName, number>;
{
	let t = 0;
	for (const [name, frames] of ORDER) {
		SEG_START[name] = t;
		SEG_FRAMES[name] = frames;
		t += frames;
	}
}

export const NECROZMA_TOTAL_FRAMES = ORDER.reduce((s, [, f]) => s + f, 0);

/** 整期帧号 → 秒（着色器 uTime） */
export const secs = (frame: number) => frame / BASE_FPS;

/**
 * 输出时间 ↔ 内部时间。各镜头按"内部帧号"编写；第 2、5 段（内部 540–960、2340–2820）提速播放，
 * 输出时长分别压成 357、408 帧，之后的内容整体提前 63 + 72 帧。字幕、名称卡、叫声都要用 outT 换回输出时间。
 */
const R2 = [540, 960, 357] as const;
const R5 = [2340, 2820, 408] as const;
const D2 = R2[1] - R2[0] - R2[2];
const D5 = R5[1] - R5[0] - R5[2];

export const inT = (o: number) => {
	if (o <= R2[0]) return o;
	if (o <= R2[0] + R2[2]) return R2[0] + ((o - R2[0]) * (R2[1] - R2[0])) / R2[2];
	const o5 = R5[0] - D2;
	if (o <= o5) return o + D2;
	if (o <= o5 + R5[2]) return R5[0] + ((o - o5) * (R5[1] - R5[0])) / R5[2];
	return o + D2 + D5;
};

export const outT = (i: number) => {
	if (i <= R2[0]) return i;
	if (i <= R2[1]) return R2[0] + ((i - R2[0]) * R2[2]) / (R2[1] - R2[0]);
	if (i <= R5[0]) return i - D2;
	if (i <= R5[1]) return R5[0] - D2 + ((i - R5[0]) * R5[2]) / (R5[1] - R5[0]);
	return i - D2 - D5;
};
