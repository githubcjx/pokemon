import {BASE_FPS} from '../../time';

/**
 * 《真实与理想》整期时间轴：各段在整期里的起始帧（30fps）。
 * 随时间流动的纹理（火焰、雷云、空洞的旋转）一律按整期时间计时，段落交界才能无缝。
 */
export const HOOK_SCENE_FRAMES = 380;
export const FOUNDING_SCENE_FRAMES = 330;
export const SPLIT_SCENE_FRAMES = 880;
export const WAR_SCENE_FRAMES = 730;
export const HUSK_SCENE_FRAMES = 800;
export const REVIVAL_SCENE_FRAMES = 1230;
export const FUSION_SCENE_FRAMES = 1790;
export const CODA_SCENE_FRAMES = 590;

export const SEG_START = {
	hook: 0,
	founding: HOOK_SCENE_FRAMES,
	split: HOOK_SCENE_FRAMES + FOUNDING_SCENE_FRAMES,
	war: HOOK_SCENE_FRAMES + FOUNDING_SCENE_FRAMES + SPLIT_SCENE_FRAMES,
	husk: HOOK_SCENE_FRAMES + FOUNDING_SCENE_FRAMES + SPLIT_SCENE_FRAMES + WAR_SCENE_FRAMES,
	revival: HOOK_SCENE_FRAMES + FOUNDING_SCENE_FRAMES + SPLIT_SCENE_FRAMES + WAR_SCENE_FRAMES + HUSK_SCENE_FRAMES,
	fusion: HOOK_SCENE_FRAMES + FOUNDING_SCENE_FRAMES + SPLIT_SCENE_FRAMES + WAR_SCENE_FRAMES + HUSK_SCENE_FRAMES + REVIVAL_SCENE_FRAMES,
	coda:
		HOOK_SCENE_FRAMES + FOUNDING_SCENE_FRAMES + SPLIT_SCENE_FRAMES + WAR_SCENE_FRAMES + HUSK_SCENE_FRAMES + REVIVAL_SCENE_FRAMES + FUSION_SCENE_FRAMES,
};

/** 本段帧号 → 整期时间（秒），给着色器的 uTime 用 */
export const globalTime = (seg: keyof typeof SEG_START, frame: number) => (SEG_START[seg] + frame) / BASE_FPS;

/** 第 1 段结尾 / 第 2 段开头的空洞（屏幕坐标与半径） */
export const VOID_HANDOFF = {x: 960, y: 540, r: 170};
