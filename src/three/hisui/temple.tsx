import {useMemo} from 'react';
import * as THREE from 'three';
import {agedTexture, rng} from '../pagodaGeometry';
import {V3} from '../stage';
import {heightAt} from './coronet';

// ─── 神奥神殿（《神奥之名》）────────────────────────────────────────────────
// 照《传说 阿尔宙斯》的样式：阶梯式台基上一圈带凹槽的大理石圆柱（整根同一种石色，柱脚上沿一道石环；用户 2026-10-24 要求柱子不用蓝色），
// 额枋、薄荷绿的檐壁、檐口，前后三角山墙，山墙正中一枚金色徽记，两坡屋顶。
// 所有构件共用一套数据，每件都有"完好"和"废墟"（今天的枪之柱）两个位置，还有一个建造顺序：
//   ruin  0 = 完好，1 = 废墟（断柱削尖像枪头，其余构件散落、滚下山坡）
//   build 0 = 还没建（只剩雪顶），1 = 建好；建造时构件从上方落到位

const STEP_TOP = 1.5; // 台基顶面
const PLINTH_H = 0.4;
const DRUM_H = 2.25;
const DRUMS = 4;
const SHAFT_TOP = STEP_TOP + PLINTH_H + DRUM_H * DRUMS; // 10.9
const ECH_H = 0.4;
const ABA_H = 0.45;
const COL_TOP = SHAFT_TOP + ECH_H + ABA_H; // 11.75
const ARCH_H = 1.0;
const FRIEZE_H = 0.8;
const CORN_H = 0.45;
const EAVE_Y = COL_TOP + ARCH_H + FRIEZE_H + CORN_H; // 14.0
const RIDGE_H = 3.2;
const COL_X = [-10, -6, -2, 2, 6, 10];
const COL_Z = [-18, -14, -10, -6, -2, 2, 6, 10, 14, 18];
const HALF_X = 11.6;
const HALF_Z = 20.4;

export const TEMPLE = {stepTop: STEP_TOP, colTop: COL_TOP, eave: EAVE_Y, ridge: EAVE_Y + RIDGE_H, halfX: HALF_X, halfZ: HALF_Z};

type GeoKey = 'pedestal' | 'step0' | 'step1' | 'step2' | 'plinth' | 'drum' | 'ring' | 'ech' | 'aba' | 'archX' | 'archZ' | 'friezeX' | 'friezeZ' | 'cornX' | 'cornZ' | 'pediment' | 'roof' | 'emblem' | 'tip';
type MatKey = 'marble' | 'gold' | 'frieze';
type Pose = {p: V3; r: V3};
type Piece = {
	geo: GeoKey;
	mat: MatKey;
	intact: Pose;
	/** 废墟里的位置；tip（断口的尖）只在废墟里存在 */
	ruin: Pose;
	tip?: boolean;
	/** 时间倒流时开始飞回原位的时刻（0–1 的进度内） */
	delay: number;
	/** 建造顺序（0–1） */
	order: number;
	scale?: V3;
};

/** 柱子上的凹槽：圆柱侧面按角度向内收一点 */
const flutedCylinder = (rTop: number, rBot: number, h: number) => {
	const g = new THREE.CylinderGeometry(rTop, rBot, h, 72, 1, false);
	const p = g.attributes.position as THREE.BufferAttribute;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i);
		const z = p.getZ(i);
		const r = Math.hypot(x, z);
		if (r < 1e-4) continue;
		const a = Math.atan2(z, x);
		const k = 1 - 0.045 * Math.pow(Math.abs(Math.cos(a * 10)), 0.6);
		p.setX(i, x * k);
		p.setZ(i, z * k);
	}
	g.computeVertexNormals();
	return g;
};

/** 断口的尖：底面与柱身同粗，越往上越细，侧面随机凹凸，尖端偏向一侧——像一截削尖的枪头（高 1，按断柱缩放） */
const jaggedTip = () => {
	const g = new THREE.CylinderGeometry(0.06, 0.82, 1, 9, 5, false);
	const p = g.attributes.position as THREE.BufferAttribute;
	const r = rng(5);
	const jit = Array.from({length: 9 * 6}, () => r());
	for (let i = 0; i < p.count; i++) {
		const y = p.getY(i) + 0.5;
		const x = p.getX(i);
		const z = p.getZ(i);
		const k = 1 + (jit[i % jit.length] - 0.5) * 0.5 * y * (1 - y) * 4;
		p.setXYZ(i, x * k + y * y * 0.28, p.getY(i), z * k + y * y * 0.12);
	}
	g.computeVertexNormals();
	return g;
};

/** 三角山墙：沿 z 方向有厚度的三角柱 */
const pedimentGeo = () => {
	const s = new THREE.Shape();
	s.moveTo(-HALF_X, 0);
	s.lineTo(HALF_X, 0);
	s.lineTo(0, RIDGE_H);
	s.closePath();
	const g = new THREE.ExtrudeGeometry(s, {depth: 1.2, bevelEnabled: false});
	g.translate(0, 0, -0.6);
	return g;
};

const ROOF_LEN = Math.hypot(HALF_X, RIDGE_H);
const ROOF_ANG = Math.atan2(RIDGE_H, HALF_X);

const useGeos = () =>
	useMemo(() => {
		const g: Record<GeoKey, THREE.BufferGeometry> = {
			pedestal: new THREE.BoxGeometry(2.8, PEDESTAL_H, 2.8),
			step0: new THREE.BoxGeometry(28, 0.5, 44.8),
			step1: new THREE.BoxGeometry(26, 0.5, 42.8),
			step2: new THREE.BoxGeometry(24.4, 0.5, 41.2),
			plinth: new THREE.BoxGeometry(2.1, PLINTH_H, 2.1),
			drum: flutedCylinder(0.8, 0.84, DRUM_H),
			ring: new THREE.TorusGeometry(0.86, 0.09, 10, 48),
			ech: new THREE.CylinderGeometry(1.12, 0.8, ECH_H, 48),
			aba: new THREE.BoxGeometry(2.4, ABA_H, 2.4),
			archX: new THREE.BoxGeometry(4.2, ARCH_H, 1.6),
			archZ: new THREE.BoxGeometry(1.6, ARCH_H, 4.2),
			friezeX: new THREE.BoxGeometry(4.2, FRIEZE_H, 1.45),
			friezeZ: new THREE.BoxGeometry(1.45, FRIEZE_H, 4.2),
			cornX: new THREE.BoxGeometry(4.4, CORN_H, 2.3),
			cornZ: new THREE.BoxGeometry(2.3, CORN_H, 4.4),
			pediment: pedimentGeo(),
			roof: new THREE.BoxGeometry(ROOF_LEN + 0.6, 0.45, 4.1),
			emblem: new THREE.CylinderGeometry(1.15, 1.15, 0.25, 48),
			tip: jaggedTip(),
		};
		g.ring.rotateX(Math.PI / 2);
		return g;
	}, []);

const MARBLE = new THREE.Color('#ffffff');
const MARBLE_OLD = new THREE.Color('#a9a8a6');
const GOLD = new THREE.Color('#d0a64c');
const GOLD_OLD = new THREE.Color('#8d8576');
const FRIEZE = new THREE.Color('#86ccbb');

const useMats = () =>
	useMemo(
		() => ({
			marble: new THREE.MeshStandardMaterial({
				map: agedTexture('#ece8de', 'rgba(96,86,74,0.12)', {seed: 21, grimeH: 0.04, streaks: 7, mottle: 0.14}),
				roughness: 0.62,
			}),
			gold: new THREE.MeshStandardMaterial({color: GOLD.clone(), roughness: 0.34, metalness: 0.8}),
			frieze: new THREE.MeshStandardMaterial({color: FRIEZE.clone(), roughness: 0.5}),
		}),
		[],
	);

/** 某处的地面高度：台基范围内是台基顶，外面是山体 */
export const groundAt = (x: number, z: number) => (Math.abs(x) < 12 && Math.abs(z) < 20.4 ? STEP_TOP : heightAt(x, z));

/** 废墟里断柱的情况（固定种子，各段一致） */
export type ColumnRuin = {x: number; z: number; keep: number; capital: boolean; tipH: number; tipTilt: [number, number]};

const isPerimeter = (x: number, z: number) => Math.abs(x) === 10 || Math.abs(z) === 18;
/** 废墟里还架着额枋的几跨（两端的柱子都完整，留下残拱） */
const ARCHES: [V3, V3][] = [
	[[-10, 0, 18], [-6, 0, 18]],
	[[10, 0, -6], [10, 0, -2]],
	[[-10, 0, 2], [-10, 0, 6]],
	[[2, 0, -18], [6, 0, -18]],
];
const inArch = (x: number, z: number) => ARCHES.some(([a, b]) => (a[0] === x && a[2] === z) || (b[0] === x && b[2] === z));

export const COLUMNS: ColumnRuin[] = (() => {
	const r = rng(77);
	const out: ColumnRuin[] = [];
	for (const x of COL_X)
		for (const z of COL_Z) {
			if (!isPerimeter(x, z)) continue;
			const forced = inArch(x, z);
			const u = r();
			const keep = forced ? 4 : u < 0.25 ? 1 : u < 0.82 ? 2 + Math.floor(r() * 2) : 4;
			const tipH = forced || keep === 4 ? 0 : 2.2 + r() * 2.6;
			out.push({x, z, keep, capital: forced, tipH, tipTilt: [(r() - 0.5) * 0.36, (r() - 0.5) * 0.36]});
		}
	return out;
})();

/** 断柱顶端（废墟里），镜头对准用 */
export const ruinTop = (c: ColumnRuin): V3 => [c.x, STEP_TOP + PLINTH_H + DRUM_H * c.keep + c.tipH * 0.9, c.z];

// ── 神像的位置：殿内两侧各五尊，面朝门口稍向中间转 ──
// 从入口往里看，左侧：诡角鹿、月月熊、幽尾玄鱼、顽皮雷弹、勇士雄鹰；右侧：劈斧螳螂、裙儿小姐、风速狗、大狃拉、冰岩怪（52poke「神奥神殿」）

export type StatueSpot = {name: string; dir: string; x: number; z: number; ry: number; noble: boolean};
const ROW_Z = [12.5, 7, 1.5, -4, -9.5];
const LEFT = [
	['wyrdeer', 'wyrdeer', false],
	['ursaluna', 'ursaluna', false],
	['basculegion', 'basculegion', false],
	['electrode-hisui', 'electrode-hisui', true],
	['braviary-hisui', 'braviary-hisui', false],
] as const;
const RIGHT = [
	['kleavor', 'kleavor', true],
	['lilligant-hisui', 'lilligant-hisui', true],
	['arcanine-hisui', 'arcanine-hisui', true],
	['sneasler', 'sneasler', false],
	['avalugg-hisui', 'avalugg-hisui', true],
] as const;
export const STATUES: StatueSpot[] = [
	...LEFT.map(([name, dir, noble], i) => ({name, dir: `pokemon/${dir}`, x: -4, z: ROW_Z[i], ry: 0.32, noble})),
	...RIGHT.map(([name, dir, noble], i) => ({name, dir: `pokemon/${dir}`, x: 4, z: ROW_Z[i], ry: -0.32, noble})),
];
export const PEDESTAL_H = 1.1;

const PIECES: Piece[] = (() => {
	const r = rng(91);
	const pcs: Piece[] = [];
	const lying = (x: number, z: number, rad: number): Pose => {
		const ang = r() * Math.PI * 2;
		const d = 1.8 + r() * 4.2;
		const px = x + Math.cos(ang) * d;
		const pz = z + Math.sin(ang) * d;
		return {p: [px, groundAt(px, pz) + rad - 0.18, pz], r: [Math.PI / 2, r() * Math.PI * 2, 0]};
	};
	const tumbled = (x: number, z: number, hh: number, spread = 4.5): Pose => {
		const ang = r() * Math.PI * 2;
		const d = 1.5 + r() * spread;
		const px = x + Math.cos(ang) * d;
		const pz = z + Math.sin(ang) * d;
		return {p: [px, groundAt(px, pz) + hh - 0.15, pz], r: [(r() - 0.5) * 0.7, r() * Math.PI * 2, (r() - 0.5) * 0.7]};
	};
	/** 滚下山坡、半埋在雪里 */
	const downhill = (x: number, z: number): Pose => {
		const ang = Math.atan2(z, x) + (r() - 0.5) * 0.9;
		const d = 25 + r() * 22;
		const px = Math.cos(ang) * d;
		const pz = Math.sin(ang) * d;
		return {p: [px, heightAt(px, pz) - 0.3, pz], r: [(r() - 0.5) * 2, r() * Math.PI * 2, (r() - 0.5) * 2]};
	};
	const order = (y: number) => Math.min(0.97, 0.06 + (y / (EAVE_Y + RIDGE_H)) * 0.84 + r() * 0.05);
	const same = (p: V3, rot: V3 = [0, 0, 0]): Pose => ({p, r: rot});

	// 台基三级（废墟里还在）
	(['step0', 'step1', 'step2'] as const).forEach((g, i) => {
		const pos: V3 = [0, 0.25 + i * 0.5, 0];
		pcs.push({geo: g, mat: 'marble', intact: same(pos), ruin: same(pos), delay: 0, order: i * 0.02});
	});

	for (const c of COLUMNS) {
		const {x, z} = c;
		const y0 = STEP_TOP + PLINTH_H / 2;
		pcs.push({geo: 'plinth', mat: 'marble', intact: same([x, y0, z]), ruin: same([x, y0, z]), delay: 0, order: 0.08 + r() * 0.03});
		for (let d = 0; d < DRUMS; d++) {
			const y = STEP_TOP + PLINTH_H + DRUM_H * (d + 0.5);
			const kept = d < c.keep;
			pcs.push({
				geo: 'drum',
				mat: 'marble',
				intact: same([x, y, z]),
				ruin: kept ? same([x, y, z]) : lying(x, z, 0.82),
				delay: kept ? 0 : r() * 0.45,
				order: order(y),
			});
			if (d === 0) {
				const ry = STEP_TOP + PLINTH_H + DRUM_H;
				pcs.push({geo: 'ring', mat: 'marble', intact: same([x, ry, z]), ruin: kept ? same([x, ry, z]) : tumbled(x, z, 0.1), delay: kept ? 0 : r() * 0.45, order: order(ry) + 0.005});
			}
		}
		const ey = SHAFT_TOP + ECH_H / 2;
		const ay = SHAFT_TOP + ECH_H + ABA_H / 2;
		pcs.push({geo: 'ech', mat: 'marble', intact: same([x, ey, z]), ruin: c.capital ? same([x, ey, z]) : tumbled(x, z, 0.4), delay: c.capital ? 0 : r() * 0.45, order: order(ey)});
		pcs.push({geo: 'aba', mat: 'marble', intact: same([x, ay, z]), ruin: c.capital ? same([x, ay, z]) : tumbled(x, z, 0.24), delay: c.capital ? 0 : r() * 0.45, order: order(ay)});
		if (c.tipH > 0 && c.keep < DRUMS) {
			const ty = STEP_TOP + PLINTH_H + DRUM_H * c.keep + c.tipH / 2 - 0.05;
			pcs.push({
				geo: 'tip',
				mat: 'marble',
				intact: same([x, ty, z]),
				ruin: same([x, ty, z], [c.tipTilt[0], 0, c.tipTilt[1]]),
				tip: true,
				delay: 0,
				order: 0,
				scale: [1, c.tipH, 1],
			});
		}
	}

	// 神像的底座（废墟里早已不在）
	for (const s of STATUES) {
		const y = STEP_TOP + PEDESTAL_H / 2;
		pcs.push({geo: 'pedestal', mat: 'marble', intact: same([s.x, y, s.z], [0, s.ry, 0]), ruin: downhill(s.x * 3, s.z), delay: r() * 0.3, order: 0.1 + r() * 0.02});
	}

	// 额枋、檐壁、檐口：每一跨各一段
	const bays: {x: number; z: number; alongX: boolean}[] = [];
	for (let i = 0; i < COL_X.length - 1; i++) {
		const x = (COL_X[i] + COL_X[i + 1]) / 2;
		bays.push({x, z: 18, alongX: true}, {x, z: -18, alongX: true});
	}
	for (let i = 0; i < COL_Z.length - 1; i++) {
		const z = (COL_Z[i] + COL_Z[i + 1]) / 2;
		bays.push({x: 10, z, alongX: false}, {x: -10, z, alongX: false});
	}
	const keepArch = (b: {x: number; z: number}) =>
		ARCHES.some(([a, c]) => Math.abs((a[0] + c[0]) / 2 - b.x) < 0.01 && Math.abs((a[2] + c[2]) / 2 - b.z) < 0.01);
	for (const b of bays) {
		const ya = COL_TOP + ARCH_H / 2;
		const yf = COL_TOP + ARCH_H + FRIEZE_H / 2;
		const yc = COL_TOP + ARCH_H + FRIEZE_H + CORN_H / 2;
		const out = b.alongX ? [0, 0, Math.sign(b.z) * 0.35] : [Math.sign(b.x) * 0.35, 0, 0];
		const fall = (h: number) => (r() < 0.5 ? tumbled(b.x, b.z, h, 6) : downhill(b.x, b.z));
		const kept = keepArch(b);
		pcs.push({geo: b.alongX ? 'archX' : 'archZ', mat: 'marble', intact: same([b.x, ya, b.z]), ruin: kept ? same([b.x, ya, b.z]) : fall(0.5), delay: kept ? 0 : r() * 0.4, order: order(ya)});
		pcs.push({geo: b.alongX ? 'friezeX' : 'friezeZ', mat: 'frieze', intact: same([b.x, yf, b.z]), ruin: fall(0.4), delay: r() * 0.35, order: order(yf)});
		pcs.push({geo: b.alongX ? 'cornX' : 'cornZ', mat: 'marble', intact: same([b.x + out[0], yc, b.z + out[2]]), ruin: fall(0.22), delay: r() * 0.3, order: order(yc)});
	}

	// 山墙、徽记、屋顶
	for (const s of [1, -1]) {
		pcs.push({geo: 'pediment', mat: 'marble', intact: same([0, EAVE_Y, s * 19.6]), ruin: downhill(0, s * 30), delay: r() * 0.25, order: 0.9});
	}
	pcs.push({geo: 'emblem', mat: 'gold', intact: same([0, EAVE_Y + 1.25, 20.25], [Math.PI / 2, 0, 0]), ruin: downhill(0, 30), delay: 0.2, order: 0.95});
	for (let i = 0; i < 10; i++) {
		const z = -18 + i * 4;
		for (const s of [1, -1]) {
			pcs.push({
				geo: 'roof',
				mat: 'marble',
				intact: same([(s * HALF_X) / 2, EAVE_Y + RIDGE_H / 2 + 0.2, z], [0, 0, -s * ROOF_ANG]),
				ruin: downhill(s * 8, z),
				delay: r() * 0.25,
				order: 0.92 + r() * 0.04,
			});
		}
	}
	return pcs;
})();

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const cl = (v: number) => Math.min(1, Math.max(0, v));

/**
 * 倒塌（第 5 段）：不往上抛，自上而下一件件松脱、往下落。屋顶先塌，再是檐口、额枋，最后是柱子上半截的鼓石。
 * 离原位远的构件（废墟里在山坡下）先落到近处的地上，再沿着山坡滑、滚下去。
 */
const TOP = EAVE_Y + RIDGE_H;
const BLAST = (() => {
	const r = rng(303);
	return PIECES.map((pc) => {
		const a = pc.intact.p;
		const z = pc.ruin.p;
		const far = Math.hypot(z[0] - a[0], z[2] - a[2]);
		// 落地点：远的构件先落在原位旁边 2.5–4.5 米处（朝最终位置的方向）
		const d = far > 7 ? 2.5 + r() * 2 : far;
		const k = far > 1e-6 ? d / far : 0;
		const lx = a[0] + (z[0] - a[0]) * k;
		const lz = a[2] + (z[2] - a[2]) * k;
		const off = Math.max(0.2, z[1] - groundAt(z[0], z[2]));
		const delay = Math.max(0, (1 - a[1] / TOP) * 0.5 + r() * 0.12);
		// 第一次（身体相撞）只塌前面一小块：正面高处的屋顶、山墙、檐口
		const early = delay < 0.16 && a[2] > 2;
		return {
			early,
			/** 在各自那一轮里开始落的时刻（0–1） */
			start: early ? (delay / 0.16) * 0.5 : (Math.max(0, delay - 0.14) / 0.86) * 0.58,
			land: [lx, groundAt(lx, lz) + off, lz] as V3,
			off,
			slide: far > 7,
			roll: (r() < 0.5 ? 1 : -1) * Math.PI * 2 * (1 + Math.floor(r() * 2)),
		};
	});
})();
const FALL = 0.42;
/** 断柱的尖在哪一刻出现：这根柱子最下面那节被炸飞的鼓石起飞时 */
const TIP_AT = PIECES.map((pc, i) => {
	if (!pc.tip) return 0;
	let t = 1;
	PIECES.forEach((q, j) => {
		if (q.geo === 'drum' && !q.tip && q.intact.p[0] === pc.intact.p[0] && q.intact.p[2] === pc.intact.p[2] && (q.ruin.p[0] !== q.intact.p[0] || q.ruin.p[2] !== q.intact.p[2])) t = Math.min(t, BLAST[j].start);
	});
	return t;
});

/**
 * 神殿。ruin：0 完好 → 1 废墟（时间倒流时由 1 走到 0：碎石沿弧线飞回原位，断口的尖先缩掉）。
 * build：0 还没建 → 1 建好（构件从上方落到位，自下而上）。
 * blast：给了就按"倒塌"走（0 完好 → 1 落成废墟）：构件自上而下一件件落下、远的再滑下山坡；断口的尖在柱身断开时出现。
 * early：先塌的一小块（正面高处）的进度，0 → 1；其余构件按 blast 落。
 * 此时 ruin 只管石材的风化（刚炸开的神殿还是新的）。
 */
export const Temple: React.FC<{ruin: number; build: number; blast?: number; early?: number}> = ({ruin, build, blast, early = 0}) => {
	const geos = useGeos();
	const mats = useMats();
	// 风化：废墟发灰发暗，金褪成石色
	mats.marble.color.copy(MARBLE).lerp(MARBLE_OLD, ruin);
	mats.gold.color.copy(GOLD).lerp(GOLD_OLD, ruin);
	mats.gold.metalness = 0.8 * (1 - ruin) + 0.1;
	mats.frieze.color.copy(FRIEZE).lerp(MARBLE_OLD, ruin * 0.8);
	const back = 1 - ruin; // 复原进度
	return (
		<group>
			{PIECES.map((pc, i) => {
				let p: V3;
				let rot: V3;
				let sc: V3 = pc.scale ?? [1, 1, 1];
				if (blast !== undefined) {
					const b = BLAST[i];
					if (pc.tip) {
						const k = cl((blast - TIP_AT[i]) / 0.02);
						if (k <= 0.001) return null;
						return <mesh key={i} geometry={geos.tip} material={mats.marble} position={pc.ruin.p} rotation={new THREE.Euler(pc.ruin.r[0], pc.ruin.r[1], pc.ruin.r[2], 'YXZ')} scale={sc} castShadow receiveShadow />;
					}
					const a = pc.intact.p;
					const z = pc.ruin.p;
					const t = b.early ? cl((early - b.start) / 0.5) : cl((blast - b.start) / FALL);
					const moved = a[0] !== z[0] || a[1] !== z[1] || a[2] !== z[2];
					if (!moved || t <= 0) {
						p = a;
						rot = pc.intact.r;
					} else {
						// 先落：水平慢慢偏出去，竖直按重力加速落到落地点；远的再沿山坡滑到最终位置
						const L = b.land;
						const t1 = b.slide ? cl(t / 0.5) : t;
						const t2 = b.slide ? cl((t - 0.5) / 0.5) : 0;
						if (t2 <= 0) {
							p = [a[0] + (L[0] - a[0]) * t1, a[1] + (L[1] - a[1]) * t1 * t1, a[2] + (L[2] - a[2]) * t1];
						} else {
							const e = easeIO(t2);
							const x = L[0] + (z[0] - L[0]) * e;
							const zz = L[2] + (z[2] - L[2]) * e;
							p = [x, groundAt(x, zz) + b.off, zz];
						}
						const h = easeIO(t);
						const roll = b.slide ? b.roll * easeIO(t2) : 0;
						rot = [pc.intact.r[0] + (pc.ruin.r[0] + roll - pc.intact.r[0]) * h, pc.intact.r[1] + (pc.ruin.r[1] - pc.intact.r[1]) * h, pc.intact.r[2] + (pc.ruin.r[2] - pc.intact.r[2]) * h];
					}
					return <mesh key={i} geometry={geos[pc.geo]} material={mats[pc.mat]} position={p} rotation={new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')} scale={sc} castShadow receiveShadow />;
				}
				if (pc.tip) {
					// 断口的尖：复原一开始就缩掉
					const k = 1 - cl(back * 6);
					if (k <= 0.001) return null;
					sc = [k, sc[1] * k, k];
					p = pc.ruin.p;
					rot = pc.ruin.r;
				} else {
					const t = easeIO(cl((back - pc.delay) / 0.55));
					const a = pc.ruin.p;
					const b = pc.intact.p;
					const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
					const arc = Math.sin(Math.PI * t) * (1.5 + dist * 0.22);
					p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + arc, a[2] + (b[2] - a[2]) * t];
					rot = [pc.ruin.r[0] + (pc.intact.r[0] - pc.ruin.r[0]) * t, pc.ruin.r[1] + (pc.intact.r[1] - pc.ruin.r[1]) * t, pc.ruin.r[2] + (pc.intact.r[2] - pc.ruin.r[2]) * t];
				}
				// 建造：未到顺序的构件不显示；到了就从上方落下
				const v = cl((build - pc.order) / 0.06);
				if (v <= 0.02) return null;
				const drop = (1 - easeOut(v)) * 7;
				if (v < 1) sc = [sc[0] * (0.4 + 0.6 * v), sc[1] * (0.4 + 0.6 * v), sc[2] * (0.4 + 0.6 * v)];
				return (
					<mesh
						key={i}
						geometry={geos[pc.geo]}
						material={mats[pc.mat]}
						position={[p[0], p[1] + drop, p[2]]}
						rotation={new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')}
						scale={sc}
						castShadow
						receiveShadow
					/>
				);
			})}
		</group>
	);
};


// ── 光柱：从天上落下的光（古老诗文３：光落了十次，落在十只宝可梦身上）──

const BEAM_VERT = `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
	vUv = uv;
	vec4 mv = modelViewMatrix * vec4(position, 1.0);
	vN = normalize(normalMatrix * normal);
	vV = normalize(-mv.xyz);
	gl_Position = projectionMatrix * mv;
}`;
const BEAM_FRAG = `
uniform float uI;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
	float core = pow(abs(dot(vN, vV)), 2.2);
	float h = vUv.y;
	float a = uI * core * (0.35 + 0.65 * (1.0 - h)) * smoothstep(0.0, 0.04, h);
	gl_FragColor = vec4(uColor * a, a);
}`;

export const Beam: React.FC<{p: V3; intensity: number; radius?: number}> = ({p, intensity, radius = 1.3}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				vertexShader: BEAM_VERT,
				fragmentShader: BEAM_FRAG,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				fog: false,
				side: THREE.DoubleSide,
				uniforms: {uI: {value: 0}, uColor: {value: new THREE.Color('#ffd98a')}},
			}),
		[],
	);
	mat.uniforms.uI.value = intensity;
	if (intensity <= 0.001) return null;
	const H = 160;
	return (
		<mesh position={[p[0], p[1] + H / 2, p[2]]} material={mat} renderOrder={5}>
			<cylinderGeometry args={[radius * 1.6, radius, H, 32, 1, true]} />
		</mesh>
	);
};
