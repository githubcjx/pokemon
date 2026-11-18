import * as THREE from 'three';
import {V3} from '../../three/stage';
import {bf, rnd, track} from './common';

/**
 * 整期一台连续的 3D 镜头（世界单位：枪之柱祭坛在原点，断柱一圈半径 12.5）。写法同《空间的形状》：
 * 关键帧之间用 Hermite 插值，标了"停"的关键帧速度为 0；其余关键帧按前后两点自动求切线。
 */

/** [帧, 位置, 目标, fov, 停] */
type Key = [number, V3, V3, number, boolean?];

const KEYS: Key[] = [
	// 1 钩子：从祭坛正前方偏高处慢慢推近，看着地上的影子
	[0, [0, 8.6, 34], [0, 4.6, -4], 40],
	[bf(4), [0.7, 8.0, 29], [0.3, 4.8, -4], 40],
	[bf(6), [1.4, 6.9, 24.5], [0.8, 4.2, -2], 40],
	// 2 影子立起来 → 推近赤日 → 影子把他拖走 → 退开看口子与扭曲的石柱
	[bf(8), [2.4, 5.0, 19.5], [1.8, 4.2, 0.5], 40],
	[bf(9), [2.4, 2.6, 17.8], [1.6, 4.6, 0], 40],
	[bf(10, 2), [2.0, 2.7, 16.6], [1.4, 4.4, 0.4], 40],
	[bf(11, 2), [0.6, 8.6, 18.8], [0.7, 0.9, 0], 40],
	[bf(14), [-1.6, 6.4, 21.5], [0.2, 3.4, 0.5], 40],
	// 3 竹兰 → 骑拉帝纳从口子里升起、显色 → 绕到口子侧面压低，看见口子下面倒挂的世界 → 升到正上方俯看
	[bf(15, 2), [-2.2, 4.6, 21.5], [0.8, 4.8, 1.5], 40],
	[bf(16), [-2.2, 4.3, 22.2], [0.9, 5.4, 2.2], 40],
	[bf(18, 2), [-1.4, 4.2, 21.2], [0.9, 5.6, 2.2], 40, true],
	[bf(20), [7.5, 2.6, 12.5], [1.2, -0.6, 2.4], 42],
	[bf(21), [4.2, 14, 9.5], [0.9, 0, 2.6], 41],
	[bf(22), [0.8, 30, 2.62], [0.8, 0, 2.6], 40, true],
	// 4 来历：俯看那张纸，慢慢升高一点
	[bf(29, 2), [0.8, 33, 2.62], [0.8, 0, 2.6], 40],
	[bf(30, 1), [0.8, 33, 2.62], [0.8, 0, 2.6], 40, true],
	// 5 翻面后从口子钻下去 → 抬头：头顶是世界的背面（倒挂的金色断柱），下面浮着岛 → 退开看全景
	[bf(31), [0.8, 6, 2.63], [0.8, -20, 2.6], 46],
	[bf(31, 2), [0.8, -6, 4.5], [0.8, -24, -2], 50],
	[bf(32, 2), [1.5, -15, 19], [0.8, -5, -1], 44],
	[bf(34), [-6, -24, 38], [0, -14, 0], 42],
	[bf(36), [-14, -30, 44], [4, -26, -6], 42],
	// 6 规则不同的世界：贴近浮岛 → 横滚 90°（墙变地面）→ 空荡荡的水面 → 远处独自一个的骑拉帝纳
	[bf(37, 2), [14, -36, 18], [26, -40, -8], 42],
	[bf(39), [30, -40, 4], [38, -44, -18], 42],
	[bf(40, 2), [40, -50, -6], [44, -56, -22], 40],
	[bf(42), [22, -44, 12], [-6, -50, -60], 40],
	[bf(44), [21, -43.6, 13], [-6, -50, -60], 40, true],
	// 7 两个世界：最深处的岛上站着赤日（脚下 (-16,-78,-30)），旁边浮着一张纸 → 抬头看骑拉帝纳降下来
	[bf(45, 2), [-3, -71, 3], [-16, -73, -30], 40],
	[bf(47, 2), [-4.5, -71.5, 1.5], [-16, -71, -30], 40],
	[bf(49, 2), [-3.5, -72.5, 3], [-16, -70, -30], 40],
	[bf(51), [-5, -76.5, 6], [-16, -63, -32], 40],
	// 8 起源形态（在 (-16,-64,-34)）：显色 → 消失时推近 → 出手 → 慢慢退开
	[bf(52), [-6.5, -75.5, 7], [-16, -64.5, -33], 40, true],
	[bf(53), [-9, -73, -1], [-16, -64.5, -33], 36],
	[bf(54), [-9.6, -72.6, -2.2], [-16, -64.5, -33], 38],
	[bf(55), [-6, -72, 4], [-16, -66, -32], 40],
	// 9 它的两个样子：它沉回深处 → 镜头一路升到天花板（地面的背面）下，看倒挂在祭坛下的起源形态
	//   → 升到与地面同高（y = 0，地面成一道镜面线），上面是别种形态 → 66.2 升到地面上方、慢慢退开
	[bf(57, 2), [3, -68, 17], [-16, -72, -30], 40],
	[bf(58, 2), [8, -60, 30], [-6, -66, -14], 40],
	[bf(59, 2), [4, -32, 40], [0.6, -14, -6], 40],
	[bf(60), [0.4, -10, 40], [0.4, -6, -0.5], 40],
	[bf(61), [0.4, -2.5, 44], [0.4, -3, -0.5], 40],
	[bf(61, 2), [0.4, 0, 44], [0.4, -3, -0.5], 40, true],
	[bf(64), [0.4, 0, 42.5], [0.4, -3, -0.5], 40],
	[bf(66, 2), [0.4, 0, 41.5], [0.4, -3, -0.5], 40, true],
	[bf(68), [0.4, 5, 44], [0.4, 0, -0.5], 40],
	[bf(72), [0.4, 8, 47], [0.4, 1, -0.5], 40, true],
];

/** 横滚（度）：镜头绕视线方向转。第 37–39 小节转 90°，墙变成地面；第 40 小节转回来 */
const ROLL: [number, number][] = [
	[bf(37), 0],
	[bf(38), 90],
	[bf(39, 2), 90],
	[bf(40, 2), 0],
];
const rollAt = (f: number) => track(f, ROLL);

const hermite = (f: number, i: number, comp: (k: Key) => number) => {
	const k0 = KEYS[i];
	const k1 = KEYS[i + 1];
	const tan = (j: number) => {
		const k = KEYS[j];
		if (k[4]) return 0;
		const a = KEYS[Math.max(0, j - 1)];
		const b = KEYS[Math.min(KEYS.length - 1, j + 1)];
		return (comp(b) - comp(a)) / Math.max(b[0] - a[0], 1e-6);
	};
	const h = k1[0] - k0[0];
	const t = (f - k0[0]) / h;
	const t2 = t * t;
	const t3 = t2 * t;
	return (2 * t3 - 3 * t2 + 1) * comp(k0) + (t3 - 2 * t2 + t) * h * tan(i) + (-2 * t3 + 3 * t2) * comp(k1) + (t3 - t2) * h * tan(i + 1);
};

export type Cam = {pos: V3; tgt: V3; fov: number; roll: number};

const camKeys = (f: number): Cam => {
	if (f <= KEYS[0][0]) return {pos: KEYS[0][1], tgt: KEYS[0][2], fov: KEYS[0][3], roll: 0};
	const last = KEYS[KEYS.length - 1];
	if (f >= last[0]) return {pos: last[1], tgt: last[2], fov: last[3], roll: rollAt(f)};
	let i = 0;
	while (KEYS[i + 1][0] < f) i++;
	const v = (g: (k: Key) => number) => hermite(f, i, g);
	return {
		pos: [v((k) => k[1][0]), v((k) => k[1][1]), v((k) => k[1][2])],
		tgt: [v((k) => k[2][0]), v((k) => k[2][1]), v((k) => k[2][2])],
		fov: v((k) => k[3]),
		roll: rollAt(f),
	};
};

/** 震动：[起始帧, 强度（世界单位）, 衰减帧数]。只在影子扑上来、口子张开、显色时 */
const SHAKES: [number, number, number][] = [
	[bf(10, 2) + 8, 0.06, 7],
	[bf(16), 0.08, 8],
	[bf(52), 0.1, 8],
	[bf(54), 0.32, 12],
];
const shakeAt = (f: number): V3 => {
	let x = 0;
	let y = 0;
	for (const [at, amp, decay] of SHAKES) {
		if (f < at || f > at + decay * 5) continue;
		const k = amp * Math.exp(-(f - at) / decay);
		const n = Math.floor(f * 2);
		x += (rnd(n * 3.1 + at) - 0.5) * 2 * k;
		y += (rnd(n * 5.7 + at + 1) - 0.5) * 2 * k;
	}
	return [x, y, 0];
};

export const camAt = (f: number): Cam => {
	const c = camKeys(f);
	const s = shakeAt(f);
	return {pos: [c.pos[0] + s[0], c.pos[1] + s[1], c.pos[2]], tgt: [c.tgt[0] + s[0], c.tgt[1] + s[1], c.tgt[2]], fov: c.fov, roll: c.roll};
};

/** 对准目标后绕视线方向横滚（Master 里的 RollRig 用同一套算法） */
export const aimCamera = (cam: THREE.PerspectiveCamera, c: Cam) => {
	cam.position.set(...c.pos);
	// 几乎垂直往下看时，(0,1,0) 当上方向会失效：视线稍一偏就转 180°。往下看得越正，上方向越换成 -z（画面上方 = 远处）
	const dir = new THREE.Vector3(c.tgt[0] - c.pos[0], c.tgt[1] - c.pos[1], c.tgt[2] - c.pos[2]).normalize();
	const k = THREE.MathUtils.smoothstep(-dir.y, 0.85, 0.97);
	cam.up.set(0, 1 - k, -k).normalize();
	cam.lookAt(...c.tgt);
	if (c.roll) cam.rotateZ((c.roll * Math.PI) / 180);
	cam.updateMatrixWorld();
};

const threeCam = (c: Cam) => {
	const cam = new THREE.PerspectiveCamera(c.fov, 1920 / 1080, 0.1, 3000);
	aimCamera(cam, c);
	return cam;
};

/** 世界点 → 画面像素与深度（depth ≤ 0 表示在镜头后面） */
export const project = (c: Cam, p: V3) => {
	const cam = threeCam(c);
	const v = new THREE.Vector3(...p);
	const depth = -v.clone().applyMatrix4(cam.matrixWorldInverse).z;
	v.project(cam);
	return {x: ((v.x + 1) / 2) * 1920, y: ((1 - v.y) / 2) * 1080, depth};
};
/** 深度 depth 处、世界里长 h 的东西在画面上有多少像素 */
export const pxOf = (c: Cam, depth: number, h: number) => (h / (2 * depth * Math.tan((c.fov * Math.PI) / 360))) * 1080;
