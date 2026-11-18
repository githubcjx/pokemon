/**
 * 《敬畏》整期总时间轴（30fps 帧号）。各段只是这条时间轴的窗口，段落交界天然无缝。
 * 分段计划见 script/regi-plan.md，脚本见 script/regi-story.md。
 *
 *   1 海底的石室：下潜 → 钻进海底岩缝 → 从水里浮出到石室 → 读前四块点字石板 → 退回海里、升向海面 → 海雪聚成点阵片名
 *   2 存疑的传说：片名的光点散成分散的大陆 → 巨人剪影浮现、金色绳索把大陆拖到今天的位置 → 光点收成一本图鉴
 *     → 只剩"一丝真理"那颗光点亮着 → 它坠向海底
 *   3 岩石巨人：光点没入岩缝 → 地层剖面 → 各层飞出碎石拼成雷吉洛克 → 扫描（没有大脑和心脏）→ 点阵地图上各地的地层柱
 *     → 只留南美和非洲，两岸拼合（岩层、化石的色带对上）再漂开 → 地图的光点流进雷吉洛克
 *   （以上第 2 段）
 *   第 3 段 冰河、地底与造物主：海水冻成冰川、冰里的雷吉艾斯、熔岩化不开 → 海岸剖面：海面降 120 米再涨回、淹没洞穴
 *     → 往下穿过地壳到地幔，雷吉斯奇鲁浮上来、压力与中空、金属光泽 → 三联画 → 七个点 → 雷吉奇卡斯现身（上篇完）
 *   第 4 段 古人怕的是什么：王冠雪原的风雪、山脊上五个巨人的剪影 → 雷吉艾勒奇点亮山下的灯、闪电成灾、圆环锁住电
 *     → 结晶拼成雷吉铎拉戈、没做完的身体 → 石门合拢，丰缘和伽勒尔的门一扇扇关上，门缝留着光 → 回到石室
 *   第 5 段 解封仪式与三道题：读正中的大石板 → 古空棘鱼、吼鲸王游到墙前 → 地震 → 丰缘三道门同时打开 → 推进门里
 *     → 三座遗迹的点字（沙漠暖黄：力量；小岛冷蓝：耐心；古墓发白：爱与希望）→ 绿宝石的另一句 → 回到三道门，巨人在等
 *   第 6 段 各地的门：合众地底遗迹的石壁（三个巨人的浮雕、刻字、日与月）→ 王冠雪原、皮欧尼 → 传说笔记２（官方残缺原文）
 *     → 三扇门依次打开 → 三个巨人聚到抉择遗迹的门前 → 门开，二选一 → 五道门的记号一起亮起 → 回到石室，读最后两块石板（中篇完）
 *   第 7 段 雪峰神殿：篇章卡「下篇 · 钥匙」→ 七个光点 → 洗翠的雪原、山崖上的神殿 → 殿内的巨人石像和岩、冰、钢的记号
 *     → 地底的门前、刚石 → 三块石板 → 门开 → 今天：石像一样的雷吉奇卡斯，三个巨人站到面前 → 反过来：地上的七个点
 *     → 互为钥匙 → 伽勒尔的巨人睡榻 → 动画与游戏的不同
 *   第 8 段 敬畏：回到石室，"感谢"和"害怕"两块石板一起亮起 → 敬、畏两个字 → 合成"敬畏" → 天平 → 套着圆环的雷吉艾勒奇
 *     → 伽勒尔夜里的城市、洛兹的剪影 → 闇夜 → 古人留下的那扇门
 *   第 9 段 王醒来：门前的七个记号随三种品质亮起 → 三个巨人一个个出现 → 门开、推进最深处 → 石像裂开剥落、七个圆孔点亮、
 *     第二次叫声（全片爆发点）→ 敞开的门里透出光，淡出
 */
export const T = {
	// 1 海底的石室
	sea: 0,
	dive: 170,
	splashIn: 215,
	wall: 250,
	cell: 352,
	read1: 450,
	read2: 540,
	read3: 608,
	read4: 712,
	both: 790,
	leave: 920,
	splashOut: 985,
	title: 1100,
	end1: 1330,
	// 2 存疑的传说
	legend: 1330,
	giant: 1430,
	drag: 1480,
	book: 1590,
	truth: 1730,
	fall: 1840,
	end2: 1960,
	// 3 岩石巨人
	rock: 1960,
	strata: 2032,
	regirock: 2140,
	scan: 2150,
	lands: 2292,
	columns: 2436,
	atlantic: 2556,
	fit: 2660,
	drift: 2786,
	home: 2912,
	end3: 3060,
	// 第 3 段 冰河、地底与造物主
	giants: 3060,
	regice: 3165,
	magma: 3276,
	coast: 3350,
	seaDrop: 3380,
	melt: 3556,
	cave: 3690,
	deep: 3850,
	registeel: 4000,
	pressure: 4082,
	metal: 4240,
	tri: 4335,
	dots: 4590,
	cluster: 4672,
	holes: 4782,
	regigigas: 4910,
	made: 4988,
	drag2: 5142,
	king: 5276,
	why: 5358,
	endA: 5480,
	// 第 4 段 古人怕的是什么
	tundra: 5480,
	notThree: 5716,
	elekiLine: 5806,
	eleki: 5850,
	power: 5890,
	disaster: 5996,
	rings: 6102,
	dragoLine: 6230,
	drago: 6290,
	crystal: 6322,
	doom: 6490,
	seal: 6636,
	might: 6730,
	ruins: 6876,
	path: 7030,
	back: 7136,
	endB: 7300,
	// 第 5 段 解封仪式与三道题
	tablet: 7300,
	relicanth: 7450,
	wailord: 7556,
	bring: 7636,
	quake: 7710,
	open: 7772,
	riddle: 7886,
	desert: 8026,
	strength: 8182,
	island: 8256,
	patience: 8416,
	tomb: 8572,
	record: 8722,
	will: 8812,
	wait: 8916,
	wait2: 9032,
	endC: 9240,
	// 第 6 段 各地的门
	unova: 9240,
	unovaWall: 9328,
	protect: 9498,
	moon: 9624,
	honor: 9840,
	peony: 9976,
	notes: 10166,
	note1: 10292,
	note2: 10422,
	note3: 10522,
	solve: 10632,
	pass: 10866,
	gather: 10970,
	choose: 11070,
	split: 11236,
	every: 11306,
	last: 11466,
	courage: 11562,
	eternal: 11676,
	endD: 11820,
	// 第 7 段 雪峰神殿（开头留给篇章卡「下篇 · 钥匙」）
	keyCard: 11820,
	king2: 11916,
	hisui: 12052,
	temple: 12194,
	statues: 12330,
	adaman: 12526,
	adamanSay: 12642,
	stuck: 12792,
	plates: 12882,
	stuff: 13026,
	unseal: 13116,
	today: 13256,
	statue: 13366,
	three: 13482,
	reverse: 13632,
	keys: 13832,
	bed: 13922,
	anime: 14112,
	endE: 14380,
	// 第 8 段 敬畏
	awe: 14380,
	pair: 14462,
	virtue: 14556,
	aweWord: 14648,
	balance: 14810,
	lock: 14916,
	rose: 15058,
	quote: 15160,
	dark: 15302,
	lesson: 15466,
	endF: 15680,
	// 第 9 段 王醒来
	door9: 15680,
	seek: 15796,
	before: 15972,
	wake: 16058,
	dread: 16250,
	revere: 16330,
	endG: 16490,
};

/** 第 4 段开头留给篇章卡「中篇 · 考卷」的时长（2026-10-23 加入，之后的关键帧整体后移） */
export const PART_CARD = 90;

/** 分段（2026-10-22 按用户要求由 18 段合并为 9 段，见 script/regi-plan.md）：1 海底的石室；2 传说与岩石巨人（原 2+3）…… */
export const SEG_START = {
	chamber: T.sea,
	legend: T.legend,
	giants: T.giants,
	fear: T.tundra,
	trial: T.tablet,
	doors: T.unova,
	temple: T.keyCard,
	awe: T.awe,
	king: T.door9,
} as const;
export type SegName = keyof typeof SEG_START;
const ORDER = Object.keys(SEG_START) as SegName[];
const SEG_END: Record<SegName, number> = {chamber: T.end1, legend: T.end3, giants: T.endA, fear: T.endB, trial: T.endC, doors: T.endD, temple: T.endE, awe: T.endF, king: T.endG};
export const SEG_FRAMES = Object.fromEntries(ORDER.map((n) => [n, SEG_END[n] - SEG_START[n]])) as Record<SegName, number>;
export const TOTAL_FRAMES = T.endG;

// ── 关键帧工具 ──
export const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const lin = (t: number) => t;

/** 分段缓入缓出：每个关键帧处速度为 0 */
export function track(f: number, keys: [number, number][], ease = easeIO): number {
	if (f <= keys[0][0]) return keys[0][1];
	for (let i = 0; i < keys.length - 1; i++) {
		const [f0, v0] = keys[i];
		const [f1, v1] = keys[i + 1];
		if (f <= f1) return v0 + (v1 - v0) * ease((f - f0) / Math.max(f1 - f0, 1e-6));
	}
	return keys[keys.length - 1][1];
}

export function vecAt(f: number, keys: [number, number[]][], ease = easeIO): number[] {
	return keys[0][1].map((_, i) => track(f, keys.map(([t, v]) => [t, v[i]] as [number, number]), ease));
}

/**
 * 单调三次样条插值（镜头连续运动、途经关键帧时不停顿；相邻两段方向相反或其中一段静止时，
 * 该关键帧处速度为 0，不会冲过头）。首尾关键帧处速度为 0。keys 的时间可以不等距。
 */
export function flow(f: number, keys: [number, number[]][]): number[] {
	const n = keys.length;
	if (f <= keys[0][0]) return keys[0][1];
	if (f >= keys[n - 1][0]) return keys[n - 1][1];
	let i = 0;
	while (i < n - 2 && f > keys[i + 1][0]) i++;
	const [t1, p1] = keys[i];
	const [t2, p2] = keys[i + 1];
	const h = t2 - t1;
	const u = (f - t1) / h;
	const tangent = (k: number, c: number) => {
		if (k <= 0 || k >= n - 1) return 0;
		const s0 = (keys[k][1][c] - keys[k - 1][1][c]) / (keys[k][0] - keys[k - 1][0]);
		const s1 = (keys[k + 1][1][c] - keys[k][1][c]) / (keys[k + 1][0] - keys[k][0]);
		if (s0 * s1 <= 0) return 0;
		return 2 / (1 / s0 + 1 / s1);
	};
	return p1.map((_, c) => {
		const m1 = tangent(i, c) * h;
		const m2 = tangent(i + 1, c) * h;
		const u2 = u * u;
		const u3 = u2 * u;
		return (2 * u3 - 3 * u2 + 1) * p1[c] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[c] + (u3 - u2) * m2;
	});
}

// ── 相机：y 轴向上，yaw = pitch = 0 时看向 -z；先 pitch（抬头为正）再 yaw ──
export type Cam = {x: number; y: number; z: number; yaw: number; pitch: number; fov: number};
export const camFrom = (v: number[]): Cam => ({x: v[0], y: v[1], z: v[2], yaw: v[3], pitch: v[4], fov: v[5]});

export const W = 1920;
export const H = 1080;

/** 世界坐标 → 屏幕像素（与着色器里的相机完全一致）；在相机背后时返回 null。s 为该点处 1 米对应的像素 */
export function project(cam: Cam, p: [number, number, number]): {x: number; y: number; s: number} | null {
	let vx = p[0] - cam.x;
	let vy = p[1] - cam.y;
	let vz = p[2] - cam.z;
	// 逆 yaw
	const cy = Math.cos(-cam.yaw);
	const sy = Math.sin(-cam.yaw);
	const x1 = vx * cy + vz * sy;
	const z1 = -vx * sy + vz * cy;
	vx = x1;
	vz = z1;
	// 逆 pitch
	const cp = Math.cos(-cam.pitch);
	const sp = Math.sin(-cam.pitch);
	const y2 = vy * cp - vz * sp;
	const z2 = vy * sp + vz * cp;
	vy = y2;
	vz = z2;
	if (vz > -1e-3) return null;
	const tanF = Math.tan(((cam.fov * Math.PI) / 180) / 2);
	const nx = vx / -vz / ((W / H) * tanF);
	const ny = vy / -vz / tanF;
	return {x: (nx * 0.5 + 0.5) * W, y: (1 - (ny * 0.5 + 0.5)) * H, s: H / (2 * -vz * tanF)};
}

/** 着色器里的相机代码（与 project 一致） */
export const GLSL_CAM = `
uniform vec3 uCamPos;
uniform vec2 uCamRot; // yaw, pitch
uniform float uFov;   // 垂直视角（度）
vec3 camRay(vec2 frag) {
	vec2 ndc = frag / uRes * 2.0 - 1.0;
	float t = tan(radians(uFov) * 0.5);
	vec3 d = normalize(vec3(ndc.x * (uRes.x / uRes.y) * t, ndc.y * t, -1.0));
	float cp = cos(uCamRot.y), sp = sin(uCamRot.y);
	d = vec3(d.x, d.y * cp - d.z * sp, d.y * sp + d.z * cp);
	float cy = cos(uCamRot.x), sy = sin(uCamRot.x);
	d = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);
	return d;
}
`;
