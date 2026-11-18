import {Easing, interpolate} from 'remotion';
import {clamp} from './theme';

/**
 * 2.5D 虚拟摄像机。
 * x / y：镜头对准的世界坐标（主体平面，1920×1080 空间）
 * zoom：推拉（1 = 标准，>1 推近）
 * roll：侧倾角度（度）
 */
export type Cam = {x: number; y: number; zoom: number; roll: number};

const CX = 960;
const CY = 540;

export const DEFAULT_CAM: Cam = {x: CX, y: CY, zoom: 1, roll: 0};

/**
 * 某一景深层的 CSS 变换。k 为距离系数：1 = 主体平面，<1 更远（移动与缩放更少），>1 更近。
 * 侧倾对所有层一致（整个画面旋转）。
 */
export const layerStyle = (cam: Cam, k: number): React.CSSProperties => {
	const s = 1 + (cam.zoom - 1) * k;
	const tx = -(cam.x - CX) * k;
	const ty = -(cam.y - CY) * k;
	return {
		transformOrigin: `${CX}px ${CY}px`,
		transform: `rotate(${cam.roll}deg) scale(${s}) translate(${tx}px, ${ty}px)`,
	};
};

const rotate = (x: number, y: number, deg: number) => {
	const a = (deg * Math.PI) / 180;
	return {x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a)};
};

/** 景深层 k 上的一点 → 屏幕坐标 */
export const project = (cam: Cam, k: number, p: {x: number; y: number}) => {
	const s = 1 + (cam.zoom - 1) * k;
	const v = {x: (p.x - CX - (cam.x - CX) * k) * s, y: (p.y - CY - (cam.y - CY) * k) * s};
	const r = rotate(v.x, v.y, cam.roll);
	return {x: r.x + CX, y: r.y + CY};
};

/** 屏幕坐标 → 景深层 k 上的局部坐标（project 的逆运算） */
export const unproject = (cam: Cam, k: number, p: {x: number; y: number}) => {
	const s = 1 + (cam.zoom - 1) * k;
	const r = rotate(p.x - CX, p.y - CY, -cam.roll);
	return {x: r.x / s + (cam.x - CX) * k + CX, y: r.y / s + (cam.y - CY) * k + CY};
};

type Key = [frame: number, value: number, easing?: (t: number) => number];

const SMOOTH = Easing.inOut(Easing.sin);

/** 分段关键帧：每段可单独指定缓动（默认正弦缓入缓出，运镜更柔和） */
export const track = (frame: number, keys: Key[]) => {
	if (frame <= keys[0][0]) return keys[0][1];
	for (let i = 1; i < keys.length; i++) {
		const [f1, v1, ease] = keys[i];
		const [f0, v0] = keys[i - 1];
		if (frame <= f1) {
			return interpolate(frame, [f0, f1], [v0, v1], {...clamp, easing: ease ?? SMOOTH});
		}
	}
	return keys[keys.length - 1][1];
};

/**
 * 流动关键帧：三次 Hermite 样条穿过各关键帧，中间关键帧处速度连续、不停顿（Catmull-Rom 切线），
 * 只在首尾缓入缓出。适合水墨这类需要一气呵成的运镜。
 */
export const flow = (frame: number, keys: [frame: number, value: number][]) => {
	const n = keys.length;
	if (frame <= keys[0][0]) return keys[0][1];
	if (frame >= keys[n - 1][0]) return keys[n - 1][1];
	let i = 1;
	while (keys[i][0] < frame) i++;
	const [f0, v0] = keys[i - 1];
	const [f1, v1] = keys[i];
	const h = f1 - f0;
	// 每个关键帧处的斜率（值 / 帧）：首尾为 0，中间取两侧割线斜率按间隔加权
	const slope = (k: number) => {
		if (k === 0 || k === n - 1) return 0;
		const [a, va] = keys[k - 1];
		const [b, vb] = keys[k + 1];
		return (vb - va) / (b - a);
	};
	const m0 = slope(i - 1) * h;
	const m1 = slope(i) * h;
	const t = (frame - f0) / h;
	const t2 = t * t;
	const t3 = t2 * t;
	return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * m1;
};

/** 冲击震动：at 起在 duration 帧内衰减的抖动（确定性，可复现） */
export const shake = (frame: number, at: number, amp: number, duration = 24) => {
	if (frame < at || frame > at + duration) return {x: 0, y: 0, roll: 0};
	const t = frame - at;
	const decay = (1 - t / duration) ** 2;
	return {
		x: (Math.sin(t * 2.9) + Math.sin(t * 5.3 + 1.3) * 0.5) * amp * decay,
		y: (Math.cos(t * 3.4 + 0.7) + Math.sin(t * 6.1) * 0.5) * amp * decay,
		roll: Math.sin(t * 2.3 + 0.4) * amp * 0.06 * decay,
	};
};
