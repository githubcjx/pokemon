import {bf, ease, easeOutExpo, sat, shakeAt} from './common';

/**
 * 星图平面与镜头。整期画面画在一张无限的二维"星图"上，一台镜头（中心 cx, cy，倍率 z）在上面连续移动，
 * 段与段之间不切镜，转场就是镜头的运动。世界坐标 1 单位 = 倍率 1 时的 1 像素；屏幕 = (世界 − 中心) × z + (960, 540)。
 */

export type Cam = {cx: number; cy: number; z: number};
type Ease = (t: number) => number;
/** [帧, cx, cy, z, 到下一个关键帧的缓动（默认缓入缓出）] */
type Key = [number, number, number, number, Ease?];

// ── 世界里几个固定的点 ──
/** 第 2 段：水面与悬空的水滴 */
export const WATER_Y = 1500;
export const DROP0: [number, number] = [0, 1236];
/** 帝牙卢卡（通常形态，官方立绘 art.png，侧身朝右）在星图上的位置与边长；胸口钻石在立绘里的位置 (0.795, 0.59) */
export const DIALGA = {x: -760, y: 1470, size: 600};
export const GEM_UV: [number, number] = [0.795, 0.59];
export const GEM: [number, number] = [DIALGA.x + (GEM_UV[0] - 0.5) * DIALGA.size, DIALGA.y + (GEM_UV[1] - 0.5) * DIALGA.size];
/** 起源形态（官方立绘镜像，面朝右）：第 30 小节在同一个位置显形；胸前晶体在立绘 (0.70, 0.27) */
export const ORIGIN = {x: DIALGA.x, y: DIALGA.y - 20, size: 660};
export const ORIGIN_GEM_UV: [number, number] = [0.7, 0.27];
export const ORIGIN_GEM: [number, number] = [ORIGIN.x + (ORIGIN_GEM_UV[0] - 0.5) * ORIGIN.size, ORIGIN.y + (ORIGIN_GEM_UV[1] - 0.5) * ORIGIN.size];

/** 第 3 段的对数刻度尺：1 秒在钻石右边 520（让开帝牙卢卡的剪影），每个数量级 330 */
export const RULER_X0 = GEM[0] + 520;
export const DECADE = 330;
export const rulerX = (sec: number) => RULER_X0 + DECADE * Math.log10(sec);

/** 第 3 段显形后的构图：帝牙卢卡在屏幕左中（中心约 x 720），面朝右边时间流去的方向；名称卡在右上 */
const REVEAL_Z = 1.37;
const REVEAL: [number, number] = [DIALGA.x - (720 - 960) / REVEAL_Z, DIALGA.y - (500 - 540) / REVEAL_Z];

const KEYS: Key[] = [
	// 1 钩子：杯子落下、碎裂、倒流拼回；缓慢推近，再升起让出片名
	[0, 0, -20, 1.0],
	[bf(3), 0, -30, 1.06],
	[bf(4), 0, -150, 1.0],
	[bf(5), 0, -150, 1.0],
	// 第 5 小节：往下摇到静止的水滴（第 6–7 小节镜头完全不动）
	[bf(6), 0, 1360, 1.1],
	[bf(8), 0, 1360, 1.1],
	// 水滴落下、涟漪 → 星盘（俯视）
	[bf(10), 0, 1420, 1.02],
	[bf(11), 0, 1500, 0.9],
	[bf(12, 2), -150, 1520, 0.88],
	[bf(13, 2), -200, 1560, 0.95],
	// 3 节拍：沿刻度尺往右推远
	[bf(14), -170, 1575, 0.92],
	[bf(15), 560, 1570, 0.72],
	[bf(15, 2), 1060, 1560, 0.62],
	[bf(15, 3), 1080, 1562, 0.62, (t) => t * t * t],
	// 所有节拍飞回原点：甩到钻石上，再急拉开
	[bf(16), GEM[0], GEM[1], 3.4, easeOutExpo],
	[bf(17), REVEAL[0], REVEAL[1], REVEAL_Z, (t) => t],
	[bf(22), REVEAL[0] + 26, REVEAL[1] - 4, 1.45],
	// 4 时间之箭：沿着箭头往右——水杯、牌、灰点
	[bf(23), 300, 1400, 1.12],
	[bf(24, 2), 420, 1395, 1.1],
	[bf(25), 1350, 1360, 1.0],
	[bf(26, 2), 1350, 1335, 0.98],
	[bf(27, 2), 1350, 1335, 0.92],
	[bf(28, 2), 1250, 1400, 0.85],
	// 拉远：所有东西顺着箭头流；再逆着箭头摇回帝牙卢卡（光明涌来）
	[bf(29), 700, 1460, 0.56],
	[bf(30), -430, 1430, 1.02],
	[bf(31, 2), -250, 1440, 1.0],
	[bf(34), -230, 1445, 1.02],
	// 5 快与慢：往下摇到"我们的世界"，再升回来
	[bf(35, 2), 640, 2540, 0.95],
	[bf(36, 3), 700, 2580, 0.98],
	[bf(38), 780, 2620, 1.02],
	[bf(39), -230, 1380, 0.95],
	[bf(41), -260, 1390, 0.98],
	[bf(43, 2), -520, 1380, 1.15],
	[bf(44), -540, 1378, 1.18],
	// 6 时光咆哮：蓄力时慢推 → 星图合拢时拉开 → 上扬推近 → 咆哮一下弹开
	[bf(46, 2), -600, 1370, 1.3],
	[bf(47), -610, 1372, 1.3],
	[bf(48), -700, 1410, 0.86],
	[bf(50), -700, 1405, 0.9],
	[bf(51, 3), -650, 1330, 1.22, (t) => t * t],
	[bf(52), -660, 1360, 0.96, easeOutExpo],
	[bf(53), -680, 1390, 0.9],
	[bf(55), -700, 1405, 0.88],
	// 第 58 小节起一动不动，第 59 小节慢慢后退
	[bf(58), -700, 1405, 0.9],
	[bf(59), -700, 1405, 0.9],
	[bf(60, 2), -720, 1430, 0.8],
	// 7 心跳：回到开场那只杯子
	[bf(61, 3), 0, 40, 1.0],
	[bf(66), 0, 30, 1.04],
	[bf(71), 0, 20, 1.1],
	[bf(72), 0, 18, 1.12],
];

/** 镜头：位置按缓动插值，倍率按对数插值（推拉更自然） */
export const camAt = (f: number): Cam => {
	const c = camKeys(f);
	const [sx, sy] = shakeAt(f);
	return {cx: c.cx + sx / c.z, cy: c.cy + sy / c.z, z: c.z};
};

const camKeys = (f: number): Cam => {
	if (f <= KEYS[0][0]) return {cx: KEYS[0][1], cy: KEYS[0][2], z: KEYS[0][3]};
	for (let i = 0; i < KEYS.length - 1; i++) {
		const [f0, x0, y0, z0, e] = KEYS[i];
		const [f1, x1, y1, z1] = KEYS[i + 1];
		if (f <= f1) {
			const t = (e ?? ease)(sat((f - f0) / (f1 - f0)));
			return {cx: x0 + (x1 - x0) * t, cy: y0 + (y1 - y0) * t, z: Math.exp(Math.log(z0) + (Math.log(z1) - Math.log(z0)) * t)};
		}
	}
	const k = KEYS[KEYS.length - 1];
	return {cx: k[1], cy: k[2], z: k[3]};
};

export const toScreen = (c: Cam, x: number, y: number): [number, number] => [(x - c.cx) * c.z + 960, (y - c.cy) * c.z + 540];
/** SVG 世界层的 transform */
export const worldTransform = (c: Cam) => `translate(960 540) scale(${c.z}) translate(${-c.cx} ${-c.cy})`;
/** 镜头看得到的世界范围（加 margin） */
export const viewBounds = (c: Cam, margin = 100) => {
	const hw = 960 / c.z + margin;
	const hh = 540 / c.z + margin;
	return {x0: c.cx - hw, x1: c.cx + hw, y0: c.cy - hh, y1: c.cy + hh};
};

// ── 配色 ──
export const INK = {
	line: 'rgba(214,228,250,0.92)',
	lineSoft: 'rgba(190,210,245,0.5)',
	faint: 'rgba(160,185,235,0.18)',
	cobalt: '#3d7bff',
	cobaltRgb: '61,123,255',
	cyan: '#8fd8ff',
	cyanRgb: '143,216,255',
	silver: '#dfe8f5',
	gold: '#f0d38a',
	goldRgb: '240,211,138',
	pinkRgb: '255,170,215',
};

/** 星图的网格：细格 60、粗格 300，线宽不随镜头缩放 */
export const Grid: React.FC<{c: Cam; opacity: number}> = ({c, opacity}) => {
	if (opacity <= 0.002) return null;
	const b = viewBounds(c, 0);
	const minor = 60;
	const lines: React.ReactNode[] = [];
	const step = c.z < 0.7 ? minor * 2 : minor;
	for (let x = Math.floor(b.x0 / step) * step; x <= b.x1; x += step) {
		const major = Math.round(x) % 300 === 0;
		lines.push(<line key={`x${x}`} x1={x} y1={b.y0} x2={x} y2={b.y1} stroke={major ? 'rgba(150,180,240,0.16)' : 'rgba(150,180,240,0.06)'} strokeWidth={major ? 1 : 0.8} vectorEffect="non-scaling-stroke" />);
	}
	for (let y = Math.floor(b.y0 / step) * step; y <= b.y1; y += step) {
		const major = Math.round(y) % 300 === 0;
		lines.push(<line key={`y${y}`} x1={b.x0} y1={y} x2={b.x1} y2={y} stroke={major ? 'rgba(150,180,240,0.16)' : 'rgba(150,180,240,0.06)'} strokeWidth={major ? 1 : 0.8} vectorEffect="non-scaling-stroke" />);
	}
	// 粗格交点上的小十字
	for (let x = Math.ceil(b.x0 / 300) * 300; x <= b.x1; x += 300) {
		for (let y = Math.ceil(b.y0 / 300) * 300; y <= b.y1; y += 300) {
			lines.push(<path key={`c${x},${y}`} d={`M${x - 7} ${y}H${x + 7}M${x} ${y - 7}V${y + 7}`} stroke="rgba(190,210,250,0.32)" strokeWidth={1} vectorEffect="non-scaling-stroke" />);
		}
	}
	return <g opacity={opacity}>{lines}</g>;
};

// ── 画风 B：机芯 ──
/** 齿轮外形：teeth 个梯形齿 */
export const gearPath = (r: number, teeth: number, depth: number, hole = 0) => {
	const pts: string[] = [];
	for (let i = 0; i < teeth; i++) {
		const a0 = (i / teeth) * Math.PI * 2;
		const da = (Math.PI * 2) / teeth;
		const seq: [number, number][] = [
			[a0, r - depth],
			[a0 + da * 0.18, r],
			[a0 + da * 0.5, r],
			[a0 + da * 0.68, r - depth],
		];
		for (const [a, rr] of seq) pts.push(`${(Math.cos(a) * rr).toFixed(2)} ${(Math.sin(a) * rr).toFixed(2)}`);
	}
	let d = `M${pts.join('L')}Z`;
	if (hole > 0) d += `M${hole} 0A${hole} ${hole} 0 1 0 ${-hole} 0A${hole} ${hole} 0 1 0 ${hole} 0Z`;
	return d;
};
/** 擒纵轮：尖齿 */
export const escapePath = (r: number, teeth: number) => {
	const pts: string[] = [];
	for (let i = 0; i < teeth; i++) {
		const a0 = (i / teeth) * Math.PI * 2;
		const da = (Math.PI * 2) / teeth;
		const seq: [number, number][] = [
			[a0, r * 0.8],
			[a0 + da * 0.62, r],
			[a0 + da * 0.7, r * 0.8],
		];
		for (const [a, rr] of seq) pts.push(`${(Math.cos(a) * rr).toFixed(2)} ${(Math.sin(a) * rr).toFixed(2)}`);
	}
	return `M${pts.join('L')}Z`;
};

/** 金属渐变（钢、黄铜）与发光滤镜，放在世界层 SVG 的 defs 里 */
export const MetalDefs: React.FC = () => (
	<defs>
		<radialGradient id="tm-steel" cx="35%" cy="30%" r="80%">
			<stop offset="0%" stopColor="#f4f8ff" />
			<stop offset="35%" stopColor="#b9c6d8" />
			<stop offset="70%" stopColor="#5d6b80" />
			<stop offset="100%" stopColor="#222a36" />
		</radialGradient>
		<radialGradient id="tm-brass" cx="35%" cy="28%" r="85%">
			<stop offset="0%" stopColor="#fff2c4" />
			<stop offset="30%" stopColor="#e2bd6a" />
			<stop offset="68%" stopColor="#8f6626" />
			<stop offset="100%" stopColor="#3b2808" />
		</radialGradient>
		<linearGradient id="tm-sheen" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0%" stopColor="rgba(255,255,255,0)" />
			<stop offset="45%" stopColor="rgba(255,255,255,0.0)" />
			<stop offset="50%" stopColor="rgba(255,255,255,0.35)" />
			<stop offset="55%" stopColor="rgba(255,255,255,0)" />
			<stop offset="100%" stopColor="rgba(255,255,255,0)" />
		</linearGradient>
		<radialGradient id="tm-gem" cx="40%" cy="35%" r="75%">
			<stop offset="0%" stopColor="#e6f3ff" />
			<stop offset="30%" stopColor="#6fb0ff" />
			<stop offset="75%" stopColor="#2347c8" />
			<stop offset="100%" stopColor="#0d1a5c" />
		</radialGradient>
		<radialGradient id="tm-glass" cx="30%" cy="20%" r="90%">
			<stop offset="0%" stopColor="rgba(190,220,255,0.22)" />
			<stop offset="60%" stopColor="rgba(80,130,230,0.08)" />
			<stop offset="100%" stopColor="rgba(40,80,200,0.14)" />
		</radialGradient>
		<radialGradient id="tm-pulse">
			<stop offset="0%" stopColor="rgba(190,220,255,0.9)" />
			<stop offset="25%" stopColor="rgba(90,150,255,0.55)" />
			<stop offset="60%" stopColor="rgba(61,123,255,0.18)" />
			<stop offset="100%" stopColor="rgba(61,123,255,0)" />
		</radialGradient>
		<linearGradient id="tm-water" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stopColor="rgba(90,140,230,0.16)" />
			<stop offset="100%" stopColor="rgba(90,140,230,0)" />
		</linearGradient>
		<filter id="tm-glow" x="-50%" y="-50%" width="200%" height="200%">
			<feGaussianBlur stdDeviation="6" result="b" />
			<feMerge>
				<feMergeNode in="b" />
				<feMergeNode in="SourceGraphic" />
			</feMerge>
		</filter>
		<filter id="tm-metal-shadow" x="-30%" y="-30%" width="160%" height="160%">
			<feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.6" />
		</filter>
	</defs>
);

/** 帝牙卢卡胸口那颗五边形钻石（世界坐标，中心 x, y，宽 w） */
export const gemPath = (x: number, y: number, w: number) => {
	const h = w * 0.9;
	return `M${x} ${y - h * 0.5}L${x + w * 0.5} ${y - h * 0.12}L${x + w * 0.32} ${y + h * 0.5}L${x - w * 0.32} ${y + h * 0.5}L${x - w * 0.5} ${y - h * 0.12}Z`;
};

