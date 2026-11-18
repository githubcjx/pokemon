import {BASE_FPS} from '../../time';

/**
 * 《永恒之花》整期时间轴：各段在整期里的起始帧（30fps）。
 * 随时间流动的东西（云、花草摇曳、烟、颗粒）一律按整期时间计时，段落交界才能无缝。
 */
export const HOOK_SCENE_FRAMES = 330;
export const GIFT_SCENE_FRAMES = 660;
export const WAR_SCENE_FRAMES = 600;
export const WEAPON_SCENE_FRAMES = 940;
export const LEAVE_SCENE_FRAMES = 660;
export const AGES_SCENE_FRAMES = 840;
export const REUNION_SCENE_FRAMES = 1200;
export const HOTEL_SCENE_FRAMES = 900;
export const CODA_SCENE_FRAMES = 750;

const W0 = HOOK_SCENE_FRAMES + GIFT_SCENE_FRAMES + WAR_SCENE_FRAMES;
export const SEG_START = {
	hook: 0,
	gift: HOOK_SCENE_FRAMES,
	war: HOOK_SCENE_FRAMES + GIFT_SCENE_FRAMES,
	weapon: W0,
	leave: W0 + WEAPON_SCENE_FRAMES,
	ages: W0 + WEAPON_SCENE_FRAMES + LEAVE_SCENE_FRAMES,
	reunion: W0 + WEAPON_SCENE_FRAMES + LEAVE_SCENE_FRAMES + AGES_SCENE_FRAMES,
	hotel: W0 + WEAPON_SCENE_FRAMES + LEAVE_SCENE_FRAMES + AGES_SCENE_FRAMES + REUNION_SCENE_FRAMES,
	coda: W0 + WEAPON_SCENE_FRAMES + LEAVE_SCENE_FRAMES + AGES_SCENE_FRAMES + REUNION_SCENE_FRAMES + HOTEL_SCENE_FRAMES,
};

/** 本段帧号 → 整期时间（秒），给着色器的 uTime 用 */
export const globalTime = (seg: keyof typeof SEG_START, frame: number) => (SEG_START[seg] + frame) / BASE_FPS;

/** 本段帧号 → 整期帧号（颗粒等用） */
export const globalFrame = (seg: keyof typeof SEG_START, frame: number) => SEG_START[seg] + frame;

/** 第 1 段的路灯（世界坐标，主体平面 k=1）：第 1 段结尾镜头推向它，第 2 段由它的光化成远古的落日 */
export const LAMP = {x: 1290, y: 410};
