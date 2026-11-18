import {Cam} from '../../camera';

/** 《夺走的光辉》各镜头共用的常量与小工具（帧号都是整期 30fps 帧号） */

export type P = {x: number; y: number};
export type V4 = [number, number, number, number];
export type V3 = [number, number, number];

// 究极大都会（与 CITY_FRAG 一致）
export const KS = 0.12; // 天空层
export const KT = 0.5; // 聚光塔 / 高塔层
export const KPPL = 0.9; // 平台上的人群
export const YB = 1010; // 楼群底线
export const SPH = 760; // 聚光塔高度
export const SPIRES = [330, 760, 1210, 1640];
export const ORB = {x: 1210, y: 116, r: 120};
export const PPL_BASE = 1070;
export const CROWN = {x: 960, y: 82}; // 究极大都会塔顶（KT 层）

// 关键时刻
export const BURST_AT = 1258; // 光团炸开
export const REVEAL = 1846; // 奈克洛兹玛显色峰值（叫声）
export const ABSORB = [2030, 2080, 2130, 2180]; // 四座聚光塔的光依次被吸走
export const TOWER_UP = 2370; // 究极大都会塔升起
export const ESCAPE = 3870; // 塔顶撕开究极之洞
export const LUSA = 3935; // 露莎米奈闯进究极空间
export const SOL_PEAK = 4100; // 索尔迦雷欧显色峰值
export const LUN_PEAK = 4130; // 露奈雅拉显色峰值
export const NEC_OUT = 4190; // 祭坛背后撕开究极之洞，奈克洛兹玛出来
export const LUNGE = 4270; // 奈克洛兹玛扑上去
export const FUSE = 4400; // 合体的白闪
export const DM_PEAK = 4414;
export const DW_PEAK = 4450;
export const DARKEN = 4590; // 阿罗拉的光被吸走，各处撕开究极之洞
export const WARP = 4740; // 究极空间跳跃骑行
export const ULTRA = 5000; // 究极爆发
export const CLASH = 5240; // 光子喷涌对上Ｚ力量
export const HIT = 5430; // Ｚ力量压过去、命中
export const CITY_DARK = 5640; // 尾声：依然漆黑的究极大都会

export const add = (a: Cam, s: {x: number; y: number; roll: number}): Cam => ({x: a.x + s.x, y: a.y + s.y, zoom: a.zoom, roll: a.roll + s.roll});

// 着色器里 6 个光源（屏幕 xy、半径、强度 + 颜色）
export type Light = {p: P; r: number; i: number; c: V3};
export const lightUniforms = (lights: Light[]) => {
	const u: Record<string, V4 | V3> = {};
	for (let i = 0; i < 6; i++) {
		const L = lights[i];
		u[`uLP[${i}]`] = L ? [L.p.x, L.p.y, L.r, L.i] : [0, 0, 1, 0];
		u[`uLC[${i}]`] = L ? L.c : [0, 0, 0];
	}
	return u;
};

export type Rift = {x: number; y: number; h: number; a: number; open: number};
export const riftUniforms = (rifts: Rift[]) => {
	const u: Record<string, V4 | number> = {};
	for (let i = 0; i < 6; i++) {
		const r = rifts[i];
		u[`uR[${i}]`] = r ? [r.x, r.y, r.h, r.open] : [0, 0, 0, 0];
		u[`uRA[${i}]`] = r ? r.a : 0;
	}
	return u;
};

export const FX_OFF = {
	uFan: [0, 0, 0, 0] as V4,
	uFanL: [0, 0] as [number, number],
	uBeamS: [0, 0, 0, 0] as V4,
	uBeamSW: [0, 0] as [number, number],
	uBeamG: [0, 0, 0, 0] as V4,
	uBeamGW: [0, 0] as [number, number],
	uBeamZ: [0, 0, 0, 0] as V4,
	uBeamZW: [0, 0] as [number, number],
	uClash: [0, 0, 1, 0] as V4,
};
