import {random} from 'remotion';

// ─── 《为彼而去》阿露福石室：墙上未知图腾的排布（各段共用，保证段落交界一致）────────────
// 世界坐标以像素计（1920×1080 为一屏，y 向下）。石块高 250，未知图腾按石块中线成行排列，像一行行文字。

export const FORMS = [...'abcdefghijklmnopqrstuvwxyz'.split(''), 'ex', 'qu'];

export type WallGlyph = {id: number; x: number; y: number; size: number; rot: number; form: string; seed: number};

/** 第 1 段登场的主角：F（现行官方立绘的形态） */
export const HERO = {x: 1060, y: 625, size: 210, form: 'f'};

const ROW_H = 250;

/** 四块拼图石板（游戏里四间石室的拼图）：按旁白的顺序——化石盔、菊石兽、化石翼龙、凤王 */
export const PANEL_Y = 625;
export const PANELS = ['kabuto', 'omanyte', 'aerodactyl', 'ho-oh'].map((form, i) => ({form, x: 2790 + i * 375, y: PANEL_Y, size: 318}));

/** 通往外面的门洞（第 3 段起；第 1、2 段的画面里看不到这一带） */
export const DOOR = {x: 4820, halfWidth: 230, springY: 700};

/** 地面上的刻文（心金魂银·化石盔石室）：两行，用未知图腾的字形拼写 */
export const INSCRIPTION_LINES = ['OUR CLAN ENGRAVED', 'WORDS IN THIS PLACE'];
export const INSCRIPTION = (() => {
	const out: {form: string; x: number; z: number; row: number; i: number}[] = [];
	const ADV = 100;
	const SPACE = 62;
	INSCRIPTION_LINES.forEach((line, row) => {
		const width = [...line].reduce((w, c) => w + (c === ' ' ? SPACE : ADV), 0) - ADV;
		let x = 1300 - width / 2;
		let i = 0;
		for (const c of line) {
			if (c === ' ') {
				x += SPACE;
				continue;
			}
			out.push({form: c.toLowerCase(), x, z: row === 0 ? 990 : 1115, row, i: i++});
			x += ADV;
		}
	});
	return out;
})();
export const INSCRIPTION_SIZE = 94;

const build = (): WallGlyph[] => {
	const out: WallGlyph[] = [];
	let id = 0;
	for (let row = -3; row <= 7; row++) {
		const y = ROW_H * row + ROW_H / 2;
		const off = random(`row${row}`) * 120;
		for (let x = -1700 + off; x < 3700; x += 168) {
			const k = `${row}:${Math.round(x)}`;
			// 行内留出词与词之间的空隙
			if (random(`gap${k}`) < 0.26) continue;
			const gx = x + (random(`jx${k}`) - 0.5) * 24;
			const gy = y + (random(`jy${k}`) - 0.5) * 14;
			// 主角四周留空
			if (Math.abs(gy - HERO.y) < 60 && Math.abs(gx - HERO.x) < 230) continue;
			// 第 2 段的拼图石板处留空（第 1 段的画面里看不到这一带）
			if (Math.abs(gy - PANEL_Y) < 60 && gx > PANELS[0].x - 260 && gx < PANELS[3].x + 260) continue;
			// 门洞四周留空（第 3 段加的；仍占一个编号，前两段各只未知图腾的编号不变）
			if (Math.abs(gx - DOOR.x) < DOOR.halfWidth + 170 && gy > DOOR.springY - DOOR.halfWidth - 120) {
				id++;
				continue;
			}
			const formIdx = Math.floor(random(`f${k}`) * 26.999);
			const punct = random(`p${k}`);
			const form = punct < 0.025 ? 'ex' : punct < 0.05 ? 'qu' : FORMS[formIdx];
			out.push({
				id: id++,
				x: gx,
				y: gy,
				size: 128 + (random(`s${k}`) - 0.5) * 18,
				rot: (random(`r${k}`) - 0.5) * 7,
				form,
				seed: random(`seed${k}`),
			});
		}
	}
	return out;
};

/**
 * 墙脚（地面 y = 1250）以下的几行不要：有地面的镜头里它们会被画在地面上，像倒影、像埋在地底（用户 2026-10-03 指出）。
 * 第 1 段没有地面，这几行也从未进入画面，删掉不影响第 1 段；编号在 build 里已定，不受影响。
 */
export const WALL: WallGlyph[] = build().filter((g) => g.y < 1250);

/** 火把的明灭（确定性）：返回强度倍数 */
export const flicker = (f: number, seed = 0) =>
	1 + 0.07 * Math.sin(f * 0.93 + seed) + 0.05 * Math.sin(f * 2.31 + 1.7 + seed) + 0.04 * Math.sin(f * 5.7 + seed * 3);

/** 火把光的颜色（线性空间，未乘强度） */
export const TORCH_RGB: [number, number, number] = [1.0, 0.52, 0.2];

/** 最后一句话（心金魂银·凤王石室地面文字）：四行，刻在门洞前的地上 */
export const FAREWELL_LINES = ['WE HUMANS NEED', 'TO WALK WITH THEM', 'WE LEAVE HERE', 'FOR THE SAKE OF THEM'];
export const FAREWELL_SIZE = 82;
export const FAREWELL = (() => {
	const out: {form: string; x: number; z: number; row: number; i: number; n: number}[] = [];
	const ADV = 90;
	const SPACE = 56;
	let n = 0;
	FAREWELL_LINES.forEach((line, row) => {
		const width = [...line].reduce((w, c) => w + (c === ' ' ? SPACE : ADV), 0) - ADV;
		let x = 4150 - width / 2;
		let i = 0;
		for (const c of line) {
			if (c === ' ') {
				x += SPACE;
				continue;
			}
			out.push({form: c.toLowerCase(), x, z: 560 + row * 112, row, i: i++, n: n++});
			x += ADV;
		}
	});
	return out;
})();
