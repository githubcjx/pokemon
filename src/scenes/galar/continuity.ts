import {HOOK_LAST_FRAME} from './HookScene';

export const STAR_SCENE_FRAMES = 1150;
export const NIGHT_SCENE_FRAMES = 1260;
/** 各段第一帧在整期时间轴上的位置（30fps），随时间流动的纹理按它接续 */
export const STAR_START = HOOK_LAST_FRAME;
export const NIGHT_START = STAR_START + STAR_SCENE_FRAMES - .5;
/** ③ 的故事时间 T = 本段帧号 + NIGHT_T0，与 ② 的末帧相接 */
export const NIGHT_T0 = STAR_SCENE_FRAMES - .5;

/** ③ 末帧：地画上奔逃的人群（世界坐标 / 每单位像素），④ 从这里推近 */
export const NIGHT_END_CAMERA = {x: 500, y: 505, z: 3.4} as const;
