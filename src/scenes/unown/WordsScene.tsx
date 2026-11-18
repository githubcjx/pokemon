import {AbsoluteFill, Easing, interpolate, random} from 'remotion';
import {Cam, flow, shake} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {Flame, Person, Pose, poseAnchor} from '../../components/unown/Silhouette';
import {FLOOR_Y, Glyph, projectRoom, UnownWall, WallLight} from '../../components/unown/UnownWall';
import {clamp} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {CLAN_SCENE_FRAMES, F1, PERSON_H, STATUE, V3} from './ClanScene';
import {DEPART_SCENE_FRAMES} from './DepartScene';
import {GLYPH_T} from './GlyphScene';
import {DOOR, FAREWELL, FAREWELL_SIZE, flicker, HERO, INSCRIPTION, INSCRIPTION_SIZE, PANELS, TORCH_RGB, WALL} from './wall';

// ─── 第 4 段《话留下了》（880 帧，约 29 秒；上篇的结尾）────────────────────────────
// 接第 3 段末帧（人走后的黑暗石室，门外月光）→ 延时摄影：门外日夜交替，F 飘回门边的墙上睡去；
// 后来的旅人（戴帽、背包，与一族区分）举着火把进出，只是看，不碰墙（他们走了，遗迹却一直完好 /
// 没有被盗掘，也没有涂鸦 / 好像有什么，让来到这里的人都想守护它）；化石盔拼图的拼块一块块滑落到墙脚
// → 夜里，一个旅人走到拼图前，把拼块一块块装回去（直到有一天，石室的拼图被解开），最后一块亲手按进去
// → 爆发点一：金光一闪、猛推猛拉 + 震动，金光从拼图沿着刻槽扩散到整面墙，所有未知图腾睁眼、涌出墙面
// （它像一把钥匙，唤醒了沉睡的未知图腾）→ 镜头拉开，涌出的未知图腾回到墙上，满墙睁着眼
// （一族人走了，未知图腾留了下来。）→ 上篇在这里结束；第 5 段先出「下篇 · 神都遗迹」篇章卡。
// （入口那句没人读懂的话已删去：用户 2026-10-03 认为与唤醒前后对不上。）
export const WORDS_SCENE_FRAMES = 880;

/** 第 3 段结束时在整期时间轴上的位置 */
export const F3 = F1 + CLAN_SCENE_FRAMES + DEPART_SCENE_FRAMES;

const T = {
	lapse: [0, 380] as const,
	sub1: [20, 130] as const,
	sub2: [144, 256] as const,
	sub3: [270, 384] as const,
	sub4: [404, 504] as const,
	place: [412, 500] as const,
	/** 最后一块按进去的一刻 */
	click: 536,
	sub5: [560, 672] as const,
	sub6: [700, 812] as const,
};

const ease = Easing.inOut(Easing.sin);

const camKeys = {
	x: [
		[0, 3940],
		[150, 3880],
		[330, 3720],
		[420, 2800],
		[536, 2805],
		[620, 3150],
		[880, 3050],
	],
	y: [
		[0, 600],
		[330, 640],
		[420, 690],
		[536, 690],
		[620, 600],
		[880, 560],
	],
	zoom: [
		[0, 0.6],
		[330, 0.66],
		[420, 1.22],
		[536, 1.32],
		[620, 0.6],
		[880, 0.62],
	],
	pitch: [
		[0, 0],
		[880, 0],
	],
	camZ: [
		[0, 2600],
		[880, 2600],
	],
} as Record<string, [number, number][]>;

export const wordsCam = (f: number): {cam: Cam; pitch: number; camZ: number} => {
	// 爆发点：猛推一下再拉开，同时震动
	const punch = interpolate(f, [T.click, T.click + 6, T.click + 40], [0, 1, 0], {...clamp, easing: Easing.out(Easing.quad)});
	const zoom = flow(f, camKeys.zoom) + 0.3 * punch;
	const sh = shake(f, T.click, 30, 50);
	return {
		cam: {
			x: flow(f, camKeys.x) + sh.x / zoom,
			y: flow(f, camKeys.y) + sh.y / zoom,
			zoom,
			roll: sh.roll,
		},
		pitch: flow(f, camKeys.pitch),
		camZ: flow(f, camKeys.camZ),
	};
};

// ── 化石盔拼图：16 块拼块（4×4），延时摄影里 12 块滑落到墙脚，夜里的旅人把它们装回去 ──
const KAB = PANELS[0];
const TILE = KAB.size / 4;
const tileHome = (i: number) => ({
	x: KAB.x - KAB.size / 2 + TILE * ((i % 4) + 0.5),
	y: KAB.y - KAB.size / 2 + TILE * (Math.floor(i / 4) + 0.5),
});
/** 最后一块（亲手按进去的那块） */
const LAST = 13;
const FALLEN = [7, 0, 11, 4, 13, 8, 1, 14, 3, 12, 6, 9];
/** 装回去的顺序（不含最后一块） */
const RETURN = [0, 1, 3, 4, 6, 7, 8, 9, 11, 12, 14];
const pieceRest = (i: number) => {
	const k = FALLEN.indexOf(i);
	return {
		x: KAB.x + (random(`prx${i}`) - 0.5) * 640 + (i === LAST ? 0 : 0),
		y: FLOOR_Y - TILE * 0.5 - 4,
		z: 14 + k * 4,
		rot: (random(`prr${i}`) - 0.5) * 50,
		fall: 70 + k * 20,
	};
};
const pieceRestOf = Object.fromEntries(FALLEN.map((i) => [i, pieceRest(i)]));
pieceRestOf[LAST] = {...pieceRestOf[LAST], x: 2735, rot: 14};

/** 旅人站的位置（拼图左下方，面朝墙右侧） */
const VISITOR = {x: 2665, z: 110};

/** 延时摄影里来来去去的旅人（半透明，像残影） */
const GHOSTS = [
	{t0: 40, x: 4300, z: 760, pose: 'look' as Pose},
	{t0: 92, x: 3560, z: 470, pose: 'raise' as Pose},
	{t0: 132, x: 3260, z: 330, pose: 'look' as Pose},
	{t0: 176, x: 4020, z: 300, pose: 'raise' as Pose},
	{t0: 214, x: 3780, z: 430, pose: 'look' as Pose},
	{t0: 222, x: 3880, z: 520, pose: 'raise' as Pose},
	{t0: 262, x: 3420, z: 620, pose: 'look' as Pose},
];
const GHOST_DUR = 84;

/** 门洞外 → 门槛 → 目标点：in 段、停留、out 段 */
const ghostAt = (f: number, g: (typeof GHOSTS)[number]) => {
	const t = f - g.t0;
	if (t < 0 || t > GHOST_DUR) return null;
	const door = {x: DOOR.x, z: 60};
	const out = {x: DOOR.x + 60, z: -900};
	const seg = (a: {x: number; z: number}, b: {x: number; z: number}, k: number) => ({x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k});
	let p: {x: number; z: number};
	let walking = true;
	let facingRight: boolean;
	if (t < 12) {
		p = seg(out, door, t / 12);
		facingRight = false;
	} else if (t < 30) {
		p = seg(door, g, ease((t - 12) / 18));
		facingRight = g.x > DOOR.x;
	} else if (t < 54) {
		p = {x: g.x, z: g.z};
		walking = false;
		facingRight = g.x > 3900;
	} else if (t < 72) {
		p = seg(g, door, ease((t - 54) / 18));
		facingRight = g.x < DOOR.x;
	} else {
		p = seg(door, out, (t - 72) / 12);
		facingRight = true;
	}
	const alpha = interpolate(t, [0, 8, GHOST_DUR - 8, GHOST_DUR], [0, 1, 1, 0], clamp);
	return {
		...p,
		pose: walking ? ('walk' as Pose) : g.pose,
		flip: !facingRight,
		alpha,
	};
};

type Actor = {
	key: string;
	pose: Pose;
	x: number;
	z: number;
	flip?: boolean;
	t?: number;
	alpha: number;
	torch?: boolean;
	ghost?: boolean;
};

export const WordsScene: React.FC = () => <WordsView f={useFrame()} />;

/**
 * 第 4 段的画面。第 5 段开头接着用它（f 超出本段后各项都停在末帧的状态，随时间流动的部分照常流动）：
 * cam 覆盖机位；blink 让墙上所有眼睛一起眨（眼睑开合倍数）；glow 为眼白亮度倍数。
 */
export const WordsView: React.FC<{
	f: number;
	cam?: Cam;
	blink?: number;
	glow?: number;
}> = ({f, cam: camOverride, blink = 1, glow = 1}) => {
	const fA = F3 + f;
	// 被第 5 段借用时，本组件里用 useFrame() 计时的部分（颗粒、浮尘）按整期时间轴接着走，字幕不显示
	const shift = f - useFrame();
	const wc = wordsCam(f);
	const cam = camOverride ?? wc.cam;
	const {pitch, camZ} = wc;
	const proj = (p: V3) => projectRoom(cam, p, pitch, camZ);

	// 延时摄影：门外日夜交替（从夜开始、到夜结束，中间快、两头慢）
	const phase = 4 * interpolate(f, T.lapse, [0, 1], {...clamp, easing: ease});
	const day = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);

	// ── 夜里的旅人 ──
	const visitorAt = (): Actor & {armUp: number} => {
		const x = flow(f, [
			[262, DOOR.x + 40],
			[300, DOOR.x - 20],
			[412, VISITOR.x],
			[540, VISITOR.x],
			[600, VISITOR.x - 30],
		]);
		const z = flow(f, [
			[262, -900],
			[300, 150],
			[412, VISITOR.z],
			[540, VISITOR.z],
			[600, 300],
		]);
		const walking = (f > 262 && f < 408) || (f > 548 && f < 596);
		// 手臂：装拼块时一上一下；最后一块先放低（从地上拾起）再举起按进去
		const work = f < T.place[1] ? 0.55 + 0.45 * Math.sin(((f - T.place[0]) / 8) * Math.PI - Math.PI / 2) : 0;
		const armUp = f < T.place[0] ? 0 : f < T.place[1] ? work : interpolate(f, [T.place[1], T.place[1] + 4, 508, 518, T.click + 4, T.click + 24], [work, 0, 0, 1, 1, 0], {...clamp, easing: ease});
		const pose: Pose = walking ? 'walk' : f < T.click + 24 && f >= T.place[0] - 4 ? 'place' : 'look';
		return {
			key: 'visitor',
			pose,
			x,
			z,
			flip: f > 548 && f < 596,
			t: pose === 'place' ? armUp : fA / 22,
			alpha: 1,
			torch: true,
			armUp,
		};
	};
	const visitor = f >= 262 ? visitorAt() : null;

	// ── 光源 ──
	// L0：F 的微光（第 3 段末尾）→ F 睡去 → 旅人的火把
	const heroP0 = {x: 4520, y: 760, z: 40};
	const bobA = (fa: number) => Math.sin((fa - GLYPH_T.heroOut) / 26) * 6;
	const heroRest = {x: 4400, y: 600};
	const hk = interpolate(f, [10, 170], [0, 1], {...clamp, easing: ease});
	const heroPC: V3 = {
		x: heroP0.x + (heroRest.x - heroP0.x) * hk,
		y: heroP0.y + (heroRest.y - heroP0.y) * hk + bobA(fA) * (1 - hk),
		z: heroP0.z * (1 - hk),
	};
	const heroDim = 0.12 * interpolate(f, [120, 200], [1, 0], clamp);
	const glowK = 1.1 * heroDim * 1.24;
	const vTip = visitor ? torchTipOf(visitor) : {x: DOOR.x, y: 900, z: -400};
	const vOn = visitor ? interpolate(visitor.z, [-800, -150], [0, 1], clamp) : 0;
	const lk = interpolate(f, [190, 290], [0, 1], {...clamp, easing: ease});
	const vk = flicker(fA, 0.7) * 6.5 * vOn;
	const L0: WallLight = {
		pos: [heroPC.x + (vTip.x - heroPC.x) * lk, heroPC.y + (vTip.y - heroPC.y) * lk, heroPC.z + (vTip.z - heroPC.z) * lk],
		color: [glowK + TORCH_RGB[0] * vk, glowK * 0.72 + TORCH_RGB[1] * vk, glowK * 0.36 + TORCH_RGB[2] * vk],
		radius: 260 + 80 * lk,
	};
	// L1：门外照进来的日光 → 爆发的金光 → 整间石室的金色余光
	const burst = interpolate(f, [T.click, T.click + 4, T.click + 40, 660], [0, 7, 1.5, 0.5], clamp);
	const bk = interpolate(f, [T.click, 660], [0, 1], {...clamp, easing: ease});
	const L1: WallLight =
		f < T.click
			? {
					pos: [DOOR.x, 860, -320],
					color: [1.5 * day, 1.62 * day, 1.85 * day],
					radius: 820,
				}
			: {
					pos: [KAB.x + (3300 - KAB.x) * bk, KAB.y + (620 - KAB.y) * bk, 260 + 900 * bk],
					color: [burst, burst * 0.66, burst * 0.32],
					radius: 520 + 1300 * bk,
				};
	// L2：门外的月光（白天时被日光盖过）
	const moon = (1 - day) * interpolate(f, [640, 760], [1, 0.35], clamp);
	const L2: WallLight = {
		pos: [DOOR.x, 520, -200],
		color: [0.5 * moon, 0.62 * moon, 0.95 * moon],
		radius: 650,
	};
	const lights = [L0, L1, L2];

	// ── 未知图腾 ──
	const wakeAt = (x: number, y: number, seed: number) => T.click + 4 + Math.hypot(x - KAB.x, y - KAB.y) / 42 + seed * 14;
	const glyphs: Glyph[] = [];
	for (const w of WALL) {
		const tw = wakeAt(w.x, w.y, w.seed);
		const eye =
			interpolate(f, [tw, tw + 12], [0, 1], {
				...clamp,
				easing: Easing.out(Easing.cubic),
			}) * blink;
		const carve = interpolate(f, [tw + 4, tw + 26], [0, 1], clamp);
		const eyeGlow = interpolate(f, [tw, tw + 10, tw + 60], [0, 0.85, 0.55], clamp) * glow;
		const gold = interpolate(f, [tw - 8, tw, tw + 34], [0, 0.9, 0.2], clamp);
		// 一部分涌出墙面，在空中盘旋，最后回到墙上
		const flies = random(`fly${w.id}`) < 0.32 && w.x > 900 && w.x < 3700;
		if (flies && f > tw + 14) {
			const r = random(`flyr${w.id}`);
			const out =
				interpolate(f, [tw + 14, tw + 58], [0, 1], {...clamp, easing: ease}) *
				(1 -
					interpolate(f, [740 + r * 40, 812 + r * 40], [0, 1], {
						...clamp,
						easing: ease,
					}));
			const dx = (random(`fdx${w.id}`) - 0.5) * 320 + Math.cos((fA + w.seed * 300) / 31) * 26;
			const dy = (random(`fdy${w.id}`) - 0.6) * 220 + Math.sin((fA + w.seed * 200) / 27) * 22;
			glyphs.push({
				...w,
				plane: out > 0 ? 2 : 0,
				x: w.x + dx * out,
				y: w.y + dy * out,
				z: (160 + random(`fz${w.id}`) * 640) * out,
				size: w.size * (1 - 0.08 * out),
				rot: w.rot + Math.sin((fA + w.seed * 90) / 40) * 10 * out,
				carve,
				eye,
				eyeGlow,
				gold,
			});
			continue;
		}
		glyphs.push({...w, carve, eye, eyeGlow, gold});
	}
	// F 原来在墙上的凹刻（第 1 段浮出后留下的）
	glyphs.push({
		x: HERO.x,
		y: HERO.y,
		size: HERO.size,
		form: HERO.form,
		carve: 0,
		eye: 0,
	});
	// F：回到门边的墙上睡去；爆发时跟着醒来
	{
		const tw = wakeAt(heroRest.x, heroRest.y, 0.3);
		glyphs.push({
			x: heroRest.x,
			y: heroRest.y,
			size: HERO.size,
			form: HERO.form,
			alpha: interpolate(f, [150, 176], [0, 1], clamp),
			carve: Math.max(interpolate(f, [176, 236], [1, 0], clamp), interpolate(f, [tw + 4, tw + 26], [0, 1], clamp)),
			eye:
				interpolate(f, [tw, tw + 12], [0, 1], {
					...clamp,
					easing: Easing.out(Easing.cubic),
				}) * blink,
			eyeGlow: interpolate(f, [tw, tw + 10, tw + 60], [0, 0.85, 0.6], clamp) * glow,
			gold: interpolate(f, [tw - 8, tw, tw + 34], [0, 0.9, 0.25], clamp),
		});
	}
	// 地面上的刻文：金光随扩散波亮起
	const floorWake = (x: number) => T.click + 16 + Math.abs(x - KAB.x) / 42;
	INSCRIPTION.forEach((l) => {
		const tw = floorWake(l.x);
		glyphs.push({
			form: l.form,
			x: l.x,
			y: l.z,
			size: INSCRIPTION_SIZE,
			plane: 1,
			carve: 0,
			eye: 0,
			gold: interpolate(f, [tw, tw + 30], [0, 0.85], clamp),
		});
	});
	FAREWELL.forEach((l) => {
		const tw = floorWake(l.x);
		glyphs.push({
			form: l.form,
			x: l.x,
			y: l.z,
			size: FAREWELL_SIZE,
			plane: 1,
			carve: 0,
			eye: 0,
			gold: interpolate(f, [0, 300], [0.3, 0.12], clamp) + interpolate(f, [tw, tw + 30], [0, 0.75], clamp),
		});
	});
	// 其余三块拼图石板：金光扩散到时一亮
	PANELS.forEach((p, i) => {
		if (i === 0) return;
		const tw = wakeAt(p.x, p.y, 0);
		glyphs.push({
			form: p.form,
			x: p.x,
			y: p.y,
			size: p.size,
			relief: true,
			carve: 0,
			eye: 0,
			gold: 0.08 + interpolate(f, [tw - 6, tw + 10, tw + 60], [0, 0.85, 0.42], clamp),
		});
	});
	// 化石盔拼图：石槽 + 16 块拼块
	const placedAt = (i: number) => (i === LAST ? T.click : T.place[0] + RETURN.indexOf(i) * 8 + 14);
	glyphs.push({
		form: KAB.form,
		x: KAB.x,
		y: KAB.y,
		size: KAB.size,
		relief: true,
		tile: 'board',
		carve: 0,
		eye: 0,
		alpha: interpolate(f, [60, 72], [0, 1], clamp),
	});
	for (let i = 0; i < 16; i++) {
		const home = tileHome(i);
		const rest = pieceRestOf[i];
		const flash = (at: number, peak: number) => interpolate(f, [at, at + 3, at + 40], [0, peak, 0], clamp);
		const burstGold = interpolate(f, [T.click, T.click + 4, T.click + 70], [0, 1, 0.5], clamp);
		const base = {
			form: KAB.form,
			size: TILE,
			relief: true,
			carve: 0,
			eye: 0,
			tile: i,
		};
		if (!rest) {
			glyphs.push({...base, x: home.x, y: home.y, gold: 0.08 + burstGold});
			continue;
		}
		const down = interpolate(f, [rest.fall, rest.fall + 18], [0, 1], {
			...clamp,
			easing: Easing.in(Easing.quad),
		});
		const settle = Math.sin(interpolate(f, [rest.fall + 18, rest.fall + 30], [0, Math.PI], clamp)) * 6;
		const fallenPos = {
			x: home.x + (rest.x - home.x) * down,
			y: home.y + (rest.y - home.y) * down - settle,
			z: rest.z * down,
			rot: rest.rot * down,
		};
		let p = fallenPos;
		if (i === LAST && visitor && f >= T.place[1]) {
			// 最后一块：从脚边拾起 → 举到手上 → 按进石槽
			const hand = poseAnchor('place', visitor.armUp, 'hand')!;
			const k = PERSON_H / 100;
			const hp = {
				x: visitor.x + hand[0] * k,
				y: FLOOR_Y + hand[1] * k - 4,
				z: visitor.z,
			};
			const pick = interpolate(f, [T.place[1], T.place[1] + 8], [0, 1], {
				...clamp,
				easing: ease,
			});
			const push = interpolate(f, [518, T.click], [0, 1], {
				...clamp,
				easing: Easing.inOut(Easing.cubic),
			});
			const held = {
				x: fallenPos.x + (hp.x - fallenPos.x) * pick,
				y: fallenPos.y + (hp.y - fallenPos.y) * pick,
				z: fallenPos.z + (hp.z - fallenPos.z) * pick,
				rot: fallenPos.rot * (1 - pick) + 8 * pick,
			};
			p = {
				x: held.x + (home.x - held.x) * push,
				y: held.y + (home.y - held.y) * push,
				z: held.z * (1 - push),
				rot: held.rot * (1 - push),
			};
		} else if (i !== LAST) {
			const at = placedAt(i);
			const k = interpolate(f, [at - 14, at], [0, 1], {
				...clamp,
				easing: Easing.inOut(Easing.cubic),
			});
			if (k > 0) {
				p = {
					x: fallenPos.x + (home.x - fallenPos.x) * k,
					y: fallenPos.y + (home.y - fallenPos.y) * k - Math.sin(k * Math.PI) * 50,
					z: fallenPos.z * (1 - k) + Math.sin(k * Math.PI) * 50,
					rot: fallenPos.rot * (1 - k),
				};
			}
		}
		const placed = f >= (i === LAST ? T.click : placedAt(i));
		glyphs.push({
			...base,
			plane: p.z > 0.01 ? 2 : 0,
			x: p.x,
			y: p.y,
			z: p.z,
			rot: p.rot,
			gold: (f < rest.fall ? 0.08 : 0) + (placed ? flash(placedAt(i), 0.7) + burstGold : 0) + (i === LAST ? interpolate(f, [T.place[1], 512, T.click], [0, 0.35, 0.5], clamp) : 0),
		});
	}

	// ── 画面元素（按离墙远近排序）──
	const drawn: {z: number; outside: boolean; el: React.ReactNode}[] = [];
	const drawPerson = (a: Actor, rimTo: {x: number}) => {
		const s = proj({x: a.x, y: FLOOR_Y, z: a.z});
		if (s.behind || s.x < -400 || s.x > 2320) return;
		const head = proj({x: a.x, y: FLOOR_Y - PERSON_H, z: a.z});
		const h = Math.max(1, s.y - head.y);
		const aspect = (PERSON_H * s.scale) / h;
		const tip = a.torch ? torchTipOf(a) : null;
		const ts = tip ? proj(tip) : null;
		const torchO = interpolate(a.z, [-1100, -500], [0, 1], clamp) * (a.ghost ? 1 - day * 0.8 : 1);
		drawn.push({
			z: a.z,
			outside: a.z < 0,
			el: (
				<div
					key={a.key}
					style={{
						position: 'absolute',
						inset: 0,
						opacity: a.alpha * interpolate(a.z, [-1000, -500], [0, 1], clamp),
					}}
				>
					<Person x={s.x} y={s.y} height={h} aspect={aspect} pose={a.pose} t={a.t} flip={a.flip} rimDir={[rimTo.x - a.x, -0.4]} rim={a.ghost ? 0.35 + 0.4 * day : 0.75} traveler />
					{ts && torchO > 0 ? <Flame x={ts.x} y={ts.y + 8 * ts.scale} size={34 * ts.scale} f={fA} seed={a.x} opacity={torchO} /> : null}
				</div>
			),
		});
	};
	GHOSTS.forEach((g, i) => {
		const p = ghostAt(f, g);
		if (!p) return;
		drawPerson(
			{
				key: `ghost${i}`,
				pose: p.pose,
				x: p.x,
				z: p.z,
				flip: p.flip,
				t: fA / 9 + i,
				alpha: p.alpha * 0.55,
				torch: true,
				ghost: true,
			},
			{x: DOOR.x},
		);
	});
	if (visitor) drawPerson(visitor, f < T.click ? {x: vTip.x} : {x: KAB.x + 300});

	// 石像：一族走后留下的粗凿巨石（脚手架已不在），始终背光
	{
		const ss = proj({x: STATUE.x, y: FLOOR_Y, z: STATUE.z});
		const lit = interpolate(f, [T.click, T.click + 10, 660], [0, 0.5, 0.2], clamp);
		const torchNear = vOn * interpolate(Math.abs(vTip.x - STATUE.x), [200, 900], [1, 0], clamp);
		drawn.push({
			z: STATUE.z,
			outside: false,
			el: (
				<svg key="statue" width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
					<defs>
						<linearGradient id="statueLit4" x1="0" x2="1" y1="0" y2="0">
							<stop offset="0" stopColor="#040302" />
							<stop offset="0.7" stopColor="#0a0705" />
							<stop offset="1" stopColor={`rgb(${Math.round(30 + 50 * torchNear)},${Math.round(19 + 30 * torchNear)},${Math.round(10 + 14 * torchNear)})`} />
						</linearGradient>
					</defs>
					<g transform={`translate(${ss.x},${ss.y}) scale(${ss.scale})`}>
						<path d="M -210,0 L 210,0 L 200,-60 L -200,-60 Z M -186,-60 L 186,-60 L 176,-118 L -176,-118 Z" fill="url(#statueLit4)" />
						<path
							d="M -160,-118 L -168,-232 L -150,-300 L -160,-398 L -128,-470 L -96,-540 L -40,-600 L 18,-640 L 70,-612 L 104,-560 L 138,-470 L 152,-380 L 146,-300 L 164,-226 L 158,-118 Z"
							fill="url(#statueLit4)"
						/>
						<g fill={`rgba(255,160,80,${0.06 + 0.12 * torchNear})`}>
							<path d="M 104,-560 L 138,-470 L 96,-452 L 80,-540 Z" />
							<path d="M 152,-380 L 146,-300 L 108,-312 L 116,-392 Z" />
							<path d="M 164,-226 L 158,-118 L 124,-130 L 130,-236 Z" />
						</g>
						<path
							d="M 70,-612 L 104,-560 L 138,-470 L 152,-380 L 146,-300 L 164,-226 L 158,-118 L 176,-118 L 186,-60 L 200,-60 L 210,0"
							fill="none"
							stroke={`rgba(255,180,90,${0.12 + lit})`}
							strokeWidth={3 / Math.max(ss.scale, 0.3)}
							strokeLinejoin="round"
						/>
					</g>
				</svg>
			),
		});
	}
	// F（第 3 段末停在门槛前）：飘回门边的墙上，变回墙上的刻文
	if (f < 180) {
		const hs = proj(heroPC);
		const toModel = (l: WallLight): [number, number, number] => [(l.pos[0] - heroPC.x) / HERO.size, (l.pos[1] - heroPC.y) / HERO.size, (l.pos[2] - heroPC.z) / HERO.size];
		drawn.push({
			z: heroPC.z,
			outside: false,
			el: (
				<PokemonArt3D
					key="hero"
					dir="pokemon/unown"
					variant="-f"
					x={hs.x}
					y={hs.y}
					size={HERO.size * hs.scale}
					yaw={Math.sin((fA - GLYPH_T.heroOut) / 40) * 4 * (1 - hk)}
					pitch={-2 * (1 - hk)}
					depthScale={0.5}
					ambient={[0.004, 0.004, 0.005]}
					pointLights={[
						{
							pos: toModel(L0),
							color: L0.color,
							radius: L0.radius / HERO.size,
						},
						{
							pos: toModel(L1),
							color: L1.color,
							radius: L1.radius / HERO.size,
						},
					]}
					rim={{dir: [-0.7, 0.55], color: [0.55, 0.32, 0.12], power: 2.5}}
					emissive={0.7 * heroDim}
					emissiveKey={[0.6, 0.85, -1, 0]}
					brightness={heroDim * 1.045}
					opacity={interpolate(f, [150, 176], [1, 0], clamp)}
					resolution={1.6}
				/>
			),
		});
	}
	drawn.sort((p, q) => p.z - q.z);

	// 门洞在屏幕上的形状：门外的东西只在门洞里可见
	const doorPts: string[] = [];
	for (let i = 0; i <= 24; i++) {
		const a = Math.PI + (i / 24) * Math.PI;
		const p = proj({
			x: DOOR.x + Math.cos(a) * DOOR.halfWidth,
			y: DOOR.springY + Math.sin(a) * DOOR.halfWidth,
			z: 0,
		});
		doorPts.push(`${p.x}px ${p.y}px`);
	}
	const dr = proj({x: DOOR.x + DOOR.halfWidth, y: FLOOR_Y, z: 0});
	const dl = proj({x: DOOR.x - DOOR.halfWidth, y: FLOOR_Y, z: 0});
	const doorClip = `polygon(${doorPts.join(', ')}, ${dr.x}px ${dr.y}px, ${dr.x + (dr.x - 960) * 3}px 1400px, ${dl.x + (dl.x - 960) * 3}px 1400px, ${dl.x}px ${dl.y}px)`;

	// 爆发的闪光与落尘
	const ks = proj({x: KAB.x, y: KAB.y, z: 0});
	const flashO = interpolate(f, [T.click, T.click + 3, T.click + 34], [0, 1, 0], clamp);
	const dustO = interpolate(f, [T.click, T.click + 6, T.click + 70], [0, 1, 0], clamp);
	// 金色的余光：醒来之后整间石室泛着金色
	const warm = interpolate(f, [T.click, T.click + 40], [0, 1], clamp);

	return (
		<AbsoluteFill style={{background: '#000'}}>
			<UnownWall
				cam={cam}
				pitch={pitch}
				camZ={camZ}
				floor
				door={DOOR}
				outside={1}
				day={day}
				gold={interpolate(f, [T.click, T.click + 10, 700], [0, 1, 0.55], clamp)}
				goldPhase={fA * 0.06}
				goldWave={f >= T.click ? {x: KAB.x, y: KAB.y, r: (f - T.click) * 48} : undefined}
				time={fA / BASE_FPS}
				lights={lights}
				glyphs={glyphs}
			/>
			<AbsoluteFill style={{clipPath: doorClip}}>{drawn.filter((d) => d.outside).map((d) => d.el)}</AbsoluteFill>
			{drawn.filter((d) => !d.outside).map((d) => d.el)}
			<DustMotes opacity={0.21 + 0.35 * warm} frameOffset={F3 + shift} />
			{dustO > 0 ? <FallingDust f={f - T.click} opacity={dustO} /> : null}
			{flashO > 0 ? (
				<AbsoluteFill
					style={{
						mixBlendMode: 'screen',
						opacity: flashO,
						background: `radial-gradient(circle at ${ks.x}px ${ks.y}px, rgba(255,236,190,1) 0%, rgba(255,190,90,0.75) ${8 + 30 * (1 - flashO)}%, rgba(255,140,50,0.25) ${30 + 40 * (1 - flashO)}%, transparent 85%)`,
					}}
				/>
			) : null}
			<AbsoluteFill
				style={{
					background: 'rgba(255,186,96,1)',
					mixBlendMode: 'soft-light',
					opacity: 0.12 * warm,
				}}
			/>
			<Vignette strength={0.75} />
			<SubtitleBackdrop />
			{shift === 0 ? (
				<>
					{/* 旁白（制作者撰写） */}
					<BiSubtitle from={T.sub1[0]} to={T.sub1[1]} zh="他们走了，遗迹却一直完好。" en="The clan was gone, yet the ruins remained intact." source={{zh: '旁白', en: 'NARRATION'}} />
					{/* 旁白（制作者撰写）：依据心金魂银·遗迹里的人 "The ruins have not been robbed, nor tampered with. No graffiti, either." */}
					<BiSubtitle
						from={T.sub2[0]}
						to={T.sub2[1]}
						zh="没有被盗掘，也没有人在墙上留下涂鸦。"
						en="They were never robbed or tampered with. No graffiti, either."
						source={{
							zh: '旁白（依据心金魂银·遗迹里的人）',
							en: 'NARRATION (after HGSS · man in the ruins)',
						}}
					/>
					{/* 旁白（制作者撰写）：依据心金魂银·遗迹里的人 "Something here must make people feel they should preserve it." */}
					<BiSubtitle
						from={T.sub3[0]}
						to={T.sub3[1]}
						zh="好像有什么，让来到这里的人都想守护它。"
						en="Something here makes people feel they should preserve it."
						source={{
							zh: '旁白（依据心金魂银·遗迹里的人）',
							en: 'NARRATION (after HGSS · man in the ruins)',
						}}
					/>
					{/* 旁白（制作者撰写）：依据心金魂银·未知图腾笔记 "That puzzle was like a key somehow. It woke the UNOWN up from their sleep." */}
					<BiSubtitle
						from={T.sub4[0]}
						to={T.sub4[1]}
						zh="直到有一天，石室的拼图被解开。"
						en="Until one day, a puzzle in the chambers was solved."
						source={{
							zh: '旁白（依据心金魂银·未知图腾笔记）',
							en: 'NARRATION (after HGSS · Unown Notes)',
						}}
					/>
					<BiSubtitle
						from={T.sub5[0]}
						to={T.sub5[1]}
						zh="它像一把钥匙，唤醒了沉睡的未知图腾。"
						en="Like a key, it woke the Unown from their sleep."
						source={{
							zh: '旁白（依据心金魂银·未知图腾笔记）',
							en: 'NARRATION (after HGSS · Unown Notes)',
						}}
					/>
					{/* 旁白（制作者撰写）：上篇的收束 */}
					<BiSubtitle from={T.sub6[0]} to={T.sub6[1]} zh="一族人走了，未知图腾留了下来。" en="The clan was gone. The Unown stayed." source={{zh: '旁白', en: 'NARRATION'}} />
				</>
			) : null}
			<Grain frameOffset={F3 + shift} />
		</AbsoluteFill>
	);
};

/** 震动时从石缝里落下的尘土（屏幕坐标） */
const FallingDust: React.FC<{f: number; opacity: number}> = ({f, opacity}) => (
	<AbsoluteFill style={{opacity, pointerEvents: 'none'}}>
		{Array.from({length: 90}, (_, i) => {
			const x = random(`fdx${i}`) * 1920;
			const delay = random(`fdd${i}`) * 20;
			const t = Math.max(0, f - delay);
			const y = -20 + random(`fdy${i}`) * 300 + 0.5 * (0.6 + random(`fdg${i}`)) * t * t;
			const s = 1.5 + random(`fds${i}`) * 3;
			return (
				<div
					key={i}
					style={{
						position: 'absolute',
						left: x + Math.sin(t / 7 + i) * 6,
						top: y,
						width: s,
						height: s * 2.4,
						borderRadius: s,
						background: 'rgba(200,170,130,0.55)',
						opacity: t > 0 ? 1 : 0,
					}}
				/>
			);
		})}
	</AbsoluteFill>
);

/** 人手里火把的火焰位置（世界坐标） */
function torchTipOf(a: {pose: Pose; t?: number; x: number; z: number; flip?: boolean}): V3 {
	const tip = poseAnchor(a.pose, a.t ?? 0, 'torch') ?? poseAnchor('raise', 0, 'torch')!;
	const k = PERSON_H / 100;
	return {
		x: a.x + tip[0] * k * (a.flip ? -1 : 1),
		y: FLOOR_Y + (tip[1] - 6) * k,
		z: a.z,
	};
}
