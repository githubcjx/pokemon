import {ATLAS_GRID} from './shaders';

// 字形图集的排布（着色器里按下标区间取字，改动时同步 shaders.ts 的 seaGlyph / starGlyph）
const LAYOUT: string[] = [
	'A', 'T', 'G', 'C', // 0-3 碱基
	'腺', '胸', '鸟', '胞', // 4-7 四种碱基的中文首字
	'デ', 'オ', 'キ', 'シ', 'ス', // 8-12
	'Δ', // 13
	...'0123456789', // 14-23
	'·', '+', '∗', '×', '°', ':', '.', '—', // 24-31
	...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', // 32-57
	...'神奥关都合众卡洛斯丰缘阿罗拉陨石星光极宇宙病毒激变异形态代欧奇希', // 58+
	...'精神增强力量自我再生画龙点睛', // 招式名
];

export const GLYPH = {
	A: 0,
	T: 1,
	G: 2,
	C: 3,
	DELTA: 13,
	DOT: 24,
	DASH: 31,
	digit: (d: number) => 14 + d,
	index: (ch: string) => {
		const i = LAYOUT.indexOf(ch);
		return i < 0 ? 24 : i;
	},
};

/** 碱基互补：A–T、G–C；中文首字同理 */
export const complement = (g: number) => (g < 4 ? [1, 0, 3, 2][g] : g < 8 ? 4 + [1, 0, 3, 2][g - 4] : g);

const CELL = 128;

export const buildAtlas = (mono: string, cjk: string): HTMLCanvasElement => {
	const size = CELL * ATLAS_GRID;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	ctx.clearRect(0, 0, size, size);
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	LAYOUT.forEach((ch, i) => {
		const cx = (i % ATLAS_GRID) * CELL + CELL / 2;
		const cy = Math.floor(i / ATLAS_GRID) * CELL + CELL / 2;
		const isCjk = /[\u3040-\u30ff\u4e00-\u9fff]/.test(ch);
		ctx.font = isCjk ? `500 92px "${cjk}"` : ch === '·' ? `700 120px "${mono}"` : `500 100px "${mono}", "${cjk}"`;
		ctx.fillText(ch, cx, cy + (isCjk ? 4 : 6));
	});
	return canvas;
};
