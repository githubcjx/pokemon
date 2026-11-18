import {useCurrentFrame, useVideoConfig} from 'remotion';

// 所有时间轴都以 30fps 的帧号编写；实际以 60fps 渲染，动画节奏不变、运动更顺滑
export const BASE_FPS = 30;
export const FPS = 60;

/** 30fps 时间轴帧数 → 实际渲染帧数 */
export const toFrames = (baseFrames: number) => Math.round((baseFrames * FPS) / BASE_FPS);

/** 当前时间轴帧号（30fps 单位，60fps 渲染时为 0.5 步进的小数） */
export const useFrame = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return (frame * BASE_FPS) / fps;
};
