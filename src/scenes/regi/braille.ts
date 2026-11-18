/**
 * 布告石室（关键之厅）的点字石板。文字取游戏海外版的英文点字原文（52poke「布告石室」页，红宝石·蓝宝石 / 欧米伽红宝石·阿尔法蓝宝石），
 * 按英文一级点字逐格排出；和游戏一样不加大写符号。
 *
 * 游戏里六块刻字岩按 左前、右前、左侧、右侧、左后、右后 的顺序连成一段话，正前方是一块大石刻。
 * 这里把它们排在同一面墙上：左右两列各三块（阅读顺序左右交替），正中是大石板。
 */

/** 点位编号：1-2-3 为左列自上而下，4-5-6 为右列 */
const LETTERS: Record<string, number[]> = {
	A: [1], B: [1, 2], C: [1, 4], D: [1, 4, 5], E: [1, 5], F: [1, 2, 4], G: [1, 2, 4, 5], H: [1, 2, 5], I: [2, 4], J: [2, 4, 5],
	K: [1, 3], L: [1, 2, 3], M: [1, 3, 4], N: [1, 3, 4, 5], O: [1, 3, 5], P: [1, 2, 3, 4], Q: [1, 2, 3, 4, 5], R: [1, 2, 3, 5], S: [2, 3, 4], T: [2, 3, 4, 5],
	U: [1, 3, 6], V: [1, 2, 3, 6], W: [2, 4, 5, 6], X: [1, 3, 4, 6], Y: [1, 3, 4, 5, 6], Z: [1, 3, 5, 6],
	',': [2],
	'.': [2, 5, 6],
	' ': [],
};

export const bits = (ch: string) => (LETTERS[ch] ?? []).reduce((b, d) => b | (1 << (d - 1)), 0);

/** 石板几何（米）：墙面在 z = 0，水面在 y = 0 */
export const PITCH_X = 0.16; // 每格宽
export const PITCH_Y = 0.27; // 行距
export const DOT_GAP = 0.056; // 格内点距
export const DOT_R = 0.021;

export type Panel = {
	/** 中心 x、y，宽、高 */
	cx: number;
	cy: number;
	w: number;
	h: number;
	lines: string[];
	cols: number;
};

const P = (cx: number, cy: number, lines: string[], cols = 14, h = 1.16): Panel => ({cx, cy, w: cols * PITCH_X + 0.42, h, lines, cols});

/** 0–5：六块刻字岩（阅读顺序），6：正中的大石刻 */
export const PANELS: Panel[] = [
	P(-3.0, 4.1, ['IN THIS CAVE', 'WE HAVE LIVED.']),
	P(3.0, 4.1, ['WE OWE ALL TO', 'THE POKEMON.']),
	P(-3.0, 2.72, ['BUT, WE SEALED', 'THE POKEMON', 'AWAY.']),
	P(3.0, 2.72, ['WE FEARED IT.']),
	P(-3.0, 1.34, ['THOSE WITH', 'COURAGE. THOSE', 'WITH HOPE.']),
	P(3.0, 1.34, ['OPEN A DOOR.', 'AN ETERNAL', 'POKEMON WAITS.']),
	P(0, 2.72, ['FIRST COMES', 'RELICANTH.', 'LAST COMES', 'WAILORD.'], 12, 3.5),
];

/**
 * 第 5 段：三座遗迹里的点字（欧米伽红宝石·阿尔法蓝宝石的英文原文，Bulbapedia 各遗迹页），
 * 外加绿宝石古代坟墓的一句。四块石板排在同一面"墙"上，x 相隔较远，各自打不同颜色的光；其余三格放到画面外。
 */
const OFF = (i: number) => P(100 + i * 5, 0, [' ']);
export const RIDDLE_PANELS: Panel[] = [
	P(-6, 1.5, ['RIGHT, RIGHT,', 'DOWN, DOWN,', 'THEN USE YOUR', 'STRENGTH.'], 14, 1.42),
	P(0, 1.5, ['STOP AND WAIT', 'UNMOVING AS', 'TIME PASSES', 'YOU BY TWICE.'], 14, 1.42),
	P(6, 1.5, ['STAND CENTER.', 'AIM TO THE SKY', 'WITH LOVE AND', 'HOPE AND TIME.'], 14, 1.42),
	P(10, 1.5, ['THOSE WHO', 'INHERIT OUR', 'WILL, SHINE IN', 'THE MIDDLE.'], 14, 1.42),
	OFF(0),
	OFF(1),
	OFF(2),
];

export const MAX_COLS = 14;
export const MAX_LINES = 4;

/** 第 i 块石板第 line 行第 col 格的中心（世界坐标）。各行居中排 */
export function cellCenter(pi: number, line: number, col: number, panels: Panel[] = PANELS): [number, number] {
	const p = panels[pi];
	const n = p.lines.length;
	const len = p.lines[line].length;
	const x = p.cx + (col - (len - 1) / 2) * PITCH_X;
	const y = p.cy + ((n - 1) / 2 - line) * PITCH_Y;
	return [x, y];
}

/** 阅读顺序里第 k 格（含空格）对应的行、列、字符 */
export type Cell = {line: number; col: number; ch: string; order: number; x: number; y: number};
export function cellsOf(pi: number, panels: Panel[] = PANELS): Cell[] {
	const out: Cell[] = [];
	let order = 0;
	panels[pi].lines.forEach((s, line) => {
		s.split('').forEach((ch, col) => {
			const [x, y] = cellCenter(pi, line, col, panels);
			out.push({line, col, ch, order, x, y});
			order++;
		});
	});
	return out;
}
export const cellCount = (pi: number, panels: Panel[] = PANELS) => panels[pi].lines.reduce((a, s) => a + s.length, 0);

/**
 * 着色器用的格子数据：宽 MAX_COLS、高 PANELS.length × MAX_LINES。
 * R = 六个点位的位掩码，G = 该格在本块石板里的阅读序号，B = 本行字数，A = 255 表示有格
 */
export function cellTexture(panels: Panel[] = PANELS): Uint8Array {
	const w = MAX_COLS;
	const h = panels.length * MAX_LINES;
	const data = new Uint8Array(w * h * 4);
	panels.forEach((p, pi) => {
		let order = 0;
		p.lines.forEach((s, line) => {
			s.split('').forEach((ch, col) => {
				const i = ((pi * MAX_LINES + line) * w + col) * 4;
				data[i] = bits(ch);
				data[i + 1] = order;
				data[i + 2] = s.length;
				data[i + 3] = 255;
				order++;
			});
		});
	});
	return data;
}

/** 六个点位相对格中心的偏移（米） */
export const SLOT: [number, number][] = [
	[-DOT_GAP / 2, DOT_GAP],
	[-DOT_GAP / 2, 0],
	[-DOT_GAP / 2, -DOT_GAP],
	[DOT_GAP / 2, DOT_GAP],
	[DOT_GAP / 2, 0],
	[DOT_GAP / 2, -DOT_GAP],
];
