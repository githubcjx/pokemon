import {H, W} from './common';
import {rng} from './DotTitle';

export type Pt = [number, number];

/**
 * 粗略的大陆轮廓（经度、纬度）。点阵画面的格子很粗，轮廓只需大致可辨。
 * 这是"传说里的世界"示意，也用于第 3 段大西洋两岸对拼的示意。
 */
export const CONTINENTS: Record<string, Pt[]> = {
	northAmerica: [
		[-165, 65], [-160, 70], [-140, 70], [-120, 72], [-95, 72], [-80, 73], [-65, 60], [-60, 53], [-55, 50], [-66, 45], [-70, 42], [-76, 38], [-80, 32], [-81, 26],
		[-82, 30], [-90, 30], [-97, 26], [-97, 20], [-90, 18], [-87, 15], [-83, 9], [-78, 8], [-86, 12], [-92, 15], [-105, 20], [-110, 24], [-115, 30], [-118, 34],
		[-124, 40], [-124, 48], [-130, 55], [-140, 60], [-150, 60], [-165, 60],
	],
	greenland: [[-45, 60], [-52, 65], [-55, 70], [-60, 76], [-70, 78], [-60, 82], [-35, 83], [-20, 80], [-20, 72], [-30, 68], [-40, 64]],
	southAmerica: [
		[-80, 10], [-75, 11], [-62, 10.5], [-52, 5], [-50, 0], [-44, -2], [-35, -5], [-35, -9], [-39, -15], [-41, -22], [-48, -26], [-53, -34], [-58, -38], [-63, -41],
		[-65, -46], [-68, -52], [-72, -53], [-74, -48], [-73, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -6], [-80, -2], [-78, 2], [-77, 7],
	],
	africa: [
		[-17, 21], [-13, 27], [-9, 32], [-6, 36], [10, 37], [11, 33], [20, 32], [25, 32], [32, 31], [34, 28], [37, 22], [39, 15], [43, 12], [51, 12], [51, 10], [45, 2],
		[41, -2], [40, -10], [40, -16], [35, -22], [33, -27], [27, -34], [20, -35], [18, -30], [15, -27], [12, -18], [13, -12], [9, -2], [9, 4], [5, 5], [-2, 5],
		[-8, 4], [-13, 8], [-17, 14],
	],
	eurasia: [
		[-10, 36], [-9, 43], [-2, 44], [-5, 48], [0, 50], [5, 53], [8, 57], [12, 55], [10, 59], [5, 61], [15, 69], [25, 71], [40, 68], [60, 69], [70, 73], [90, 76],
		[110, 77], [130, 72], [150, 71], [170, 70], [180, 68], [180, 63], [165, 60], [160, 55], [140, 52], [135, 45], [130, 42], [122, 40], [121, 31], [118, 24],
		[110, 20], [108, 15], [105, 10], [103, 2], [100, 8], [98, 15], [94, 18], [90, 22], [80, 15], [77, 8], [72, 20], [66, 25], [57, 25], [56, 20], [52, 16],
		[44, 12], [43, 15], [39, 21], [35, 28], [34, 32], [36, 36], [30, 37], [26, 40], [23, 37], [20, 40], [15, 40], [13, 45], [12, 41], [8, 44], [3, 43], [0, 39],
		[-6, 36],
	],
	australia: [
		[114, -22], [114, -34], [118, -35], [124, -33], [131, -31], [137, -35], [140, -38], [147, -39], [150, -37], [153, -30], [153, -25], [146, -19], [142, -11],
		[137, -12], [135, -15], [130, -12], [125, -14], [122, -18],
	],
};

/** 经纬度 → 屏幕（地图放在画面中上部） */
export const MAP = {x0: 210, x1: 1710, lon0: -170, lon1: 180, latTop: 82, y0: 150};
export const lonLat = ([lon, lat]: Pt): Pt => {
	const s = (MAP.x1 - MAP.x0) / (MAP.lon1 - MAP.lon0);
	return [MAP.x0 + (lon - MAP.lon0) * s, MAP.y0 + (MAP.latTop - lat) * s];
};

const inPoly = (x: number, y: number, poly: Pt[]) => {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const [xi, yi] = poly[i];
		const [xj, yj] = poly[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
};

/** 一块大陆的点阵（屏幕坐标），以及它的中心 */
export function continentDots(name: string, step: number): {pts: Pt[]; c: Pt} {
	const poly = CONTINENTS[name].map(lonLat);
	const xs = poly.map((p) => p[0]);
	const ys = poly.map((p) => p[1]);
	const pts: Pt[] = [];
	const x0 = Math.floor(Math.min(...xs) / step) * step + step / 2;
	const y0 = Math.floor(Math.min(...ys) / step) * step + step / 2;
	for (let y = y0; y <= Math.max(...ys); y += step) for (let x = x0; x <= Math.max(...xs); x += step) if (inPoly(x, y, poly)) pts.push([x, y]);
	const c: Pt = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
	return {pts, c};
}

/** 一本摊开的图鉴：两页的边框、中缝，右页是一行行"字"，左页是一幅小小的大陆和绳子的速写 */
export function bookDots(): {pts: Pt[]; truth: number} {
	const r = rng(77);
	const pts: Pt[] = [];
	const cx = 960;
	const cy = 470;
	const pw = 430;
	const ph = 560;
	const step = 13;
	// 页边
	for (const side of [-1, 1]) {
		const x0 = side < 0 ? cx - pw - 10 : cx + 10;
		for (let x = x0; x <= x0 + pw; x += step) {
			pts.push([x, cy - ph / 2 + Math.abs(x - cx) * 0.04]);
			pts.push([x, cy + ph / 2 + Math.abs(x - cx) * 0.02]);
		}
		for (let y = cy - ph / 2; y <= cy + ph / 2; y += step) pts.push([side < 0 ? x0 : x0 + pw, y]);
	}
	for (let y = cy - ph / 2; y <= cy + ph / 2; y += step) pts.push([cx, y]);
	// 右页的字：一行行长短不一的"词"
	let truth = 0;
	const rows = 13;
	for (let k = 0; k < rows; k++) {
		const y = cy - ph / 2 + 60 + k * 36;
		let x = cx + 50;
		const end = cx + pw - 40 - (k === rows - 1 ? 150 : 0);
		while (x < end) {
			const n = 2 + Math.floor(r() * 5);
			for (let i = 0; i < n && x < end; i++, x += 9) pts.push([x, y]);
			x += 14;
		}
		if (k === rows - 1) truth = pts.length - 1;
	}
	// 左页：大陆和绳子的小速写
	const sk = (p: Pt): Pt => [cx - pw / 2 - 5 + (p[0] - 960) * 0.24, cy - 30 + (p[1] - 450) * 0.24];
	for (const name of Object.keys(CONTINENTS)) {
		const {pts: cp} = continentDots(name, 40);
		cp.forEach((p) => pts.push(sk(p)));
	}
	for (let i = 0; i < 18; i++) pts.push([cx - pw / 2 - 150 + i * 16, cy + 150 + Math.sin(i * 0.6) * 6]);
	return {pts, truth};
}

/** 画面四处的散点（海雪一样，偏下方） */
export function scatter(n: number, seed: number): Pt[] {
	const r = rng(seed);
	return Array.from({length: n}, () => [r() * W, H * (0.1 + r() * 1.05)] as Pt);
}

/** 世界地图点阵（13px 网格），各大陆按固定顺序排列；k 为序号 */
export const CONT_ORDER = ['northAmerica', 'greenland', 'southAmerica', 'africa', 'eurasia', 'australia'];
export const CONT = CONT_ORDER.map((name, k) => ({name, ...continentDots(name, 13), k}));
export const MAP_N = CONT.reduce((a, c) => a + c.pts.length, 0);
