import {AbsoluteFill, Easing, interpolate, random} from 'remotion';
import {Cam, flow, project} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {Flame, Person, Pose, poseAnchor, Sparks} from '../../components/unown/Silhouette';
import {FLOOR_Y, Glyph, projectRoom, UnownWall, WallLight} from '../../components/unown/UnownWall';
import {clamp} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {GLYPH_SCENE_FRAMES, GLYPH_T, glyphCam, glyphHeroGlow, glyphState, glyphTorch, wakeAt} from './GlyphScene';
import {flicker, HERO, INSCRIPTION, INSCRIPTION_LINES, INSCRIPTION_SIZE, PANELS, TORCH_RGB, WALL} from './wall';

// ─── 第 2 段《一族》（780 帧 = 26 秒）──────────────────────────────────────────
// 接第 1 段末帧（黑暗里满墙的眼睛）→ 金色浮尘里浮现出一族人的剪影：举火把的人、提火把走来的向导、
// 向未知图腾伸手的人；F 飘到他的手边，几只未知图腾离开墙面绕着人飞（很久以前，有一族人和未知图腾一起住在这里）
// → 镜头升起、俯拍地面：两个跪着的人一字一字凿出刻文，熔金随后灌进刻痕（吾等一族之言，刻于此地）
// → 移到右侧：火光里众人凿着、拉着一块巨石，石像始终背光（还为它们造了宝可梦的石像）
// → 墙上四块拼图石板：化石盔、菊石兽、化石翼龙、凤王的浮雕依次亮起；未知图腾聚在石板前，
//   石板上洒下一层冷白的天光（也许，那是他们刻给未知图腾看的，外面的世界）。末帧即第 3 段首帧。
export const CLAN_SCENE_FRAMES = 780;

/** 第 1 段结束时在整期时间轴上的位置：随时间流动的东西（火光明灭、浮尘、F 的上下浮动）接着第 1 段算 */
export const F1 = GLYPH_SCENE_FRAMES;

export const CLAN_T = {
	memory: [8, 120] as const,
	sub1: [30, 152] as const,
	carve: [178, 322] as const,
	sub2: [190, 338] as const,
	sub3: [378, 492] as const,
	sub4: [515, 642] as const,
	/** 旁白念到各块石板的时刻 */
	panelGold: [548, 572, 596, 620],
	sub5: [652, 778] as const,
	daylight: [660, 745] as const,
};

export const PERSON_H = 420;

const camKeys = {
	x: [[0, 1000], [140, 1060], [230, 950], [330, 1650], [440, 2150], [550, 2850], [670, 3300], [780, 3360]],
	y: [[0, 560], [140, 690], [230, 260], [330, 240], [440, 600], [550, 640], [670, 630], [780, 620]],
	zoom: [[0, 0.82], [140, 0.95], [230, 0.74], [330, 0.76], [440, 0.9], [550, 0.92], [670, 0.93], [780, 0.97]],
	pitch: [[0, 0], [140, 5], [230, 49], [330, 52], [440, 6], [550, 2], [670, 0], [780, 0]],
	// 推轨：俯拍刻文时相机推到刻文跟前（离墙 1950），墙面出画
	camZ: [[0, 2600], [140, 2600], [230, 1950], [330, 1900], [440, 2600], [780, 2600]],
} as Record<string, [number, number][]>;

export const clanCam = (f: number): {cam: Cam; pitch: number; camZ: number} => ({
	cam: {x: flow(f, camKeys.x), y: flow(f, camKeys.y), zoom: flow(f, camKeys.zoom), roll: 0},
	pitch: flow(f, camKeys.pitch),
	camZ: flow(f, camKeys.camZ),
});

export type V3 = {x: number; y: number; z: number};

/** 人：脚底在地面 (x, z)；alpha 为浮现进度 */
export type Actor = {key: string; pose: Pose; x: number; z: number; flip?: boolean; t?: number; alpha: number; torch?: boolean; h?: number};

const memoryIn = (f: number, delay: number) => interpolate(f, [CLAN_T.memory[0] + delay, CLAN_T.memory[0] + delay + 70], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
/** 镜头升起俯拍时，墙边的几个人像回忆一样散去 */
const fadeForCrane = (f: number) => interpolate(f, [150, 205], [1, 0], {...clamp, easing: Easing.inOut(Easing.sin)});

/** 向导：提着火把走在镜头前面，依次照亮刻字的人、石像、石板 */
export const guide = (f: number): Actor => {
	const x = flow(f, [
		[0, 1760],
		[170, 1560],
		[330, 1600],
		[440, 2480],
		[520, 2560],
		[620, 3000],
		[780, 3030],
	]);
	const z = flow(f, [
		[0, 520],
		[170, 760],
		[330, 780],
		[440, 820],
		[520, 760],
		[620, 380],
		[780, 360],
	]);
	const moving = (f > 0 && f < 175) || (f > 335 && f < 440) || (f > 525 && f < 615);
	// 俯拍刻文时向导出画（只留地上的火把照着刻字的人）
	const away = interpolate(f, [160, 200, 330, 370], [1, 0, 0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	return {key: 'guide', pose: moving ? 'walk' : 'raise', x, z, flip: true, t: f / 26, alpha: memoryIn(f, 30) * away, torch: true};
};

export const actorsAt = (f: number): Actor[] => {
	const p = interpolate(f, CLAN_T.carve, [0, 1], clamp);
	const rowX = (row: number) => {
		const letters = INSCRIPTION.filter((g) => g.row === row);
		const i = Math.min(letters.length - 1, Math.floor(p * letters.length));
		return letters[i].x + 40;
	};
	return [
		{key: 'p1', pose: 'raise', x: 862, z: 230, alpha: memoryIn(f, 0) * fadeForCrane(f), torch: true},
		{key: 'p3', pose: 'stand', x: 560, z: 380, alpha: memoryIn(f, 18) * fadeForCrane(f)},
		{key: 'p4', pose: 'reach', x: 1270, z: 430, flip: true, alpha: memoryIn(f, 10) * fadeForCrane(f)},
		guide(f),
		// 刻字的两个人：跪在刻文前面，跟着刻到的位置挪动
		{key: 'c1', pose: 'kneel', x: flow(f, [[150, 520], [178, 560], [322, rowX(0)]]), z: 1035, t: f / 8, alpha: memoryIn(f, 60)},
		{key: 'c2', pose: 'kneel', x: flow(f, [[150, 470], [178, 500], [322, rowX(1)]]), z: 1165, t: f / 8 + 0.5, alpha: memoryIn(f, 70)},
		// 石像旁
		{key: 's1', pose: 'kneel', x: 2180, z: 700, t: f / 9, alpha: memoryIn(f, 200)},
		{key: 's2', pose: 'pull', x: 2660, z: 780, flip: true, t: f / 40, alpha: memoryIn(f, 220)},
		{key: 's3', pose: 'stand', x: 2050, z: 860, alpha: memoryIn(f, 230)},
		// 石板前
		{key: 'q1', pose: 'reach', x: 3480, z: 420, flip: true, alpha: memoryIn(f, 420)},
	];
};

/** 人手里火把的火焰位置（世界坐标） */
export const torchTip = (a: Actor): V3 | null => {
	const tip = poseAnchor(a.pose, a.t ?? 0, 'torch');
	if (!tip) return null;
	const k = (a.h ?? PERSON_H) / 100;
	return {x: a.x + tip[0] * k * (a.flip ? -1 : 1), y: FLOOR_Y + (tip[1] - 6) * k, z: a.z};
};

/** 石像（背光的巨石，看不出形状）与石板旁的火盆 */
export const STATUE = {x: 2380, z: 640, w: 330, h: 640};
export const BRAZIER: V3 = {x: 2420, y: 1010, z: 90};

/** F：从第 1 段末的位置（换算成房间里的 3D 点）飘到伸手的人手边，再跟着向导去看石板 */
const heroStart = (() => {
	const fA = F1;
	const cam = glyphCam(fA);
	const lift = 1;
	const k = 1 + lift * 0.2;
	const bob = Math.sin((fA - GLYPH_T.heroOut) / 26) * 6;
	const scr = project(cam, k, {x: HERO.x, y: HERO.y + bob});
	const scale = (1 + (cam.zoom - 1) * k) * 1.06;
	// 针孔相机里同样大小、同样位置的点
	const z = 2600 - (2600 * cam.zoom) / (scale * (HERO.size / HERO.size));
	const s3 = (cam.zoom * 2600) / (2600 - z);
	return {x: cam.x + (scr.x - 960) / s3, y: cam.y + (scr.y - 540) / s3, z};
})();

export const heroPos = (f: number): V3 => {
	const bob = Math.sin((F1 + f - GLYPH_T.heroOut) / 26) * 6;
	const x = flow(f, [
		[0, heroStart.x],
		[120, 1140],
		[220, 1230],
		[330, 1480],
		[440, 2330],
		[560, 2560],
		[680, 2540],
		[780, 2530],
	]);
	const y = flow(f, [
		[0, heroStart.y - bob],
		[120, 860],
		[220, 900],
		[330, 960],
		[440, 760],
		[560, 700],
		[680, 690],
		[780, 680],
	]);
	const z = flow(f, [
		[0, heroStart.z],
		[120, 400],
		[220, 420],
		[330, 760],
		[440, 520],
		[560, 320],
		[680, 300],
		[780, 290],
	]);
	return {x, y: y + bob, z};
};

/** 离开墙面、绕着人飞的未知图腾：从墙上选几只，飞出后在空中缓缓漂浮 */
export const FLYERS = (() => {
	const near = (cx: number, cy: number, n: number, salt: string) =>
		[...WALL]
			.filter((g) => Math.abs(g.x - cx) < 700 && Math.abs(g.y - cy) < 380)
			.sort((a, b) => random(`${salt}${a.id}`) - random(`${salt}${b.id}`))
			.slice(0, n);
	const a = near(1000, 700, 9, 'fa').map((g, i) => ({g, start: 40 + i * 9, z: 160 + random(`fz${g.id}`) * 420, dx: (random(`fx${g.id}`) - 0.5) * 300, dy: 120 + random(`fy${g.id}`) * 200}));
	const b = near(3260, 620, 8, 'fb').map((g, i) => ({g, start: 560 + i * 10, z: 140 + random(`fz${g.id}`) * 220, dx: (random(`fx${g.id}`) - 0.5) * 260, dy: 40 + random(`fy${g.id}`) * 90}));
	return [...a, ...b];
})();
const FLYER_IDS = new Set(FLYERS.map((x) => x.g.id));


/** 石像（第 2、3 段共用）：还在凿的巨石，始终背光、看不出形状；脚手架、拉绳 */
export const statueEl = (f: number, proj: (p: V3) => {x: number; y: number; scale: number}, actors: Actor[]) => {
	const statueS = proj({x: STATUE.x, y: FLOOR_Y, z: STATUE.z});
	const s2 = actors.find((a) => a.key === 's2')!;
	const ropeHand = poseAnchor('pull', s2.t ?? 0, 'rope')!;
	const ropeA = proj({x: s2.x - ropeHand[0] * (PERSON_H / 100), y: FLOOR_Y + ropeHand[1] * (PERSON_H / 100), z: s2.z});
	const ropeB = proj({x: STATUE.x + 70, y: FLOOR_Y - STATUE.h + 40, z: STATUE.z});
	return (
			<svg key="statue" width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: interpolate(f, [200, 300], [0, 1], clamp)}}>
				<defs>
					<linearGradient id="statueLit" x1="0" x2="1" y1="0" y2="0">
						<stop offset="0" stopColor="#050403" />
						<stop offset="0.7" stopColor="#0b0806" />
						<stop offset="1" stopColor="#2a1a0e" />
					</linearGradient>
				</defs>
				<g transform={`translate(${statueS.x},${statueS.y}) scale(${statueS.scale})`}>
					{/* 台座 */}
					<path d="M -210,0 L 210,0 L 200,-60 L -200,-60 Z M -186,-60 L 186,-60 L 176,-118 L -176,-118 Z" fill="url(#statueLit)" />
					{/* 粗凿的石料 */}
					<path
						d="M -160,-118 L -168,-232 L -150,-300 L -160,-398 L -128,-470 L -96,-540 L -40,-600 L 18,-640 L 70,-612 L 104,-560 L 138,-470 L 152,-380 L 146,-300 L 164,-226 L 158,-118 Z"
						fill="url(#statueLit)"
					/>
					{/* 凿面上的反光（火光在右侧） */}
					<g fill="rgba(255,160,80,0.10)">
						<path d="M 104,-560 L 138,-470 L 96,-452 L 80,-540 Z" />
						<path d="M 152,-380 L 146,-300 L 108,-312 L 116,-392 Z" />
						<path d="M 164,-226 L 158,-118 L 124,-130 L 130,-236 Z" />
					</g>
					<path d="M 70,-612 L 104,-560 L 138,-470 L 152,-380 L 146,-300 L 164,-226 L 158,-118" fill="none" stroke="rgba(255,170,90,0.35)" strokeWidth={3} strokeLinejoin="round" />
					{/* 脚手架 */}
					<g stroke="#060403" strokeLinecap="round">
						<line x1={-250} y1={0} x2={-236} y2={-560} strokeWidth={10} />
						<line x1={248} y1={0} x2={236} y2={-500} strokeWidth={10} />
						<line x1={-262} y1={-330} x2={262} y2={-318} strokeWidth={12} />
						<line x1={-250} y1={-180} x2={-120} y2={-330} strokeWidth={6} />
						<line x1={248} y1={-170} x2={130} y2={-320} strokeWidth={6} />
					</g>
				</g>
				{/* 拉绳 */}
				<line x1={ropeA.x} y1={ropeA.y} x2={ropeB.x} y2={ropeB.y} stroke="#0a0705" strokeWidth={Math.max(1.5, 3 * statueS.scale)} />
			</svg>
	);
};

export const ClanScene: React.FC = () => {
	const f = useFrame();
	const fA = F1 + f;
	const {cam, pitch, camZ} = clanCam(f);
	const proj = (p: V3) => projectRoom(cam, p, pitch, camZ);

	const actors = actorsAt(f);
	const g = guide(f);
	const p1 = actors[0];

	// ── 光源（最多 3 盏）──
	// L0：第 1 段的火把 → 举火把的人手里；镜头离开后换成 F 的金光
	const t0 = glyphTorch(fA);
	const p1Tip = torchTip(p1)!;
	const hand = interpolate(f, [0, 70], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const l0Fade = fadeForCrane(f);
	const heroP = heroPos(f);
	const heroGlowK = interpolate(f, [440, 480], [0, 1], clamp) * 1.1;
	const L0: WallLight =
		f < 440
			? {
					pos: [t0.pos[0] + (p1Tip.x - t0.pos[0]) * hand, t0.pos[1] + (p1Tip.y - t0.pos[1]) * hand, t0.pos[2] + (p1Tip.z - t0.pos[2]) * hand],
					color: [t0.color[0] * l0Fade, t0.color[1] * l0Fade, t0.color[2] * l0Fade],
					radius: t0.radius,
			  }
			: {pos: [heroP.x, heroP.y, heroP.z], color: [heroGlowK, heroGlowK * 0.72, heroGlowK * 0.36], radius: 260};
	// L1：向导的火把
	const gTip = torchTip(g)!;
	const gk = g.alpha * flicker(fA, 1.3) * 7.5;
	const L1: WallLight = {pos: [gTip.x, gTip.y, gTip.z], color: [TORCH_RGB[0] * gk, TORCH_RGB[1] * gk, TORCH_RGB[2] * gk], radius: 360};
	// L2：第 1 段 F 的余光 → 刻字处地上的火把 → 石板旁的火盆
	const heroG = glyphHeroGlow(fA);
	const floorTorch: V3 = {x: flow(f, [[150, 900], [322, 2050]]), y: FLOOR_Y - 40, z: 1075};
	const ftK = interpolate(f, [140, 180, 360, 400], [0, 1, 1, 0], clamp) * flicker(fA, 4.1) * 6.5;
	const brK = interpolate(f, [470, 540], [0, 1], clamp) * flicker(fA, 2.2) * 6;
	const L2: WallLight =
		f < 140
			? {pos: heroG.pos, color: heroG.color.map((c) => c * interpolate(f, [0, 100], [1, 0], clamp)) as [number, number, number], radius: heroG.radius}
			: f < 440
			? {pos: [floorTorch.x, floorTorch.y, floorTorch.z], color: [TORCH_RGB[0] * ftK, TORCH_RGB[1] * ftK, TORCH_RGB[2] * ftK], radius: 400}
			: {pos: [BRAZIER.x, BRAZIER.y - 40, BRAZIER.z], color: [TORCH_RGB[0] * brK, TORCH_RGB[1] * brK, TORCH_RGB[2] * brK], radius: 420};
	const lights = [L0, L1, L2];

	// ── 墙上、地上、空中的未知图腾 ──
	const glyphs: Glyph[] = [];
	// 回忆里墙上的眼睛不那么亮，屋里的主角是人和火光
	const glowK = 1 - 0.6 * interpolate(f, CLAN_T.memory, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	for (const w of WALL) {
		if (FLYER_IDS.has(w.id)) continue;
		const st = glyphState(fA, wakeAt(w.x, w.y, w.seed));
		glyphs.push({...w, ...st, eyeGlow: st.eyeGlow * glowK});
	}
	// 第 1 段 F 留在墙上的空凹槽
	glyphs.push({x: HERO.x, y: HERO.y, size: HERO.size, form: HERO.form, carve: 0, eye: 0});
	for (const {g: w, start, z, dx, dy} of FLYERS) {
		const st0 = glyphState(fA, wakeAt(w.x, w.y, w.seed));
		const st = {...st0, eyeGlow: st0.eyeGlow * (0.4 + 0.6 * glowK)};
		const out = interpolate(f, [start, start + 90], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
		const drift = Math.sin((f + w.seed * 200) / 34) * 18;
		glyphs.push({
			...w,
			...st,
			plane: out > 0 ? 2 : 0,
			x: w.x + dx * out + Math.cos((f + w.seed * 90) / 47) * 14 * out,
			y: w.y + dy * out + drift * out,
			z: z * out,
			size: w.size * (1 - 0.08 * out),
		});
	}
	// 地面刻文：随刻随灌金
	const pc = interpolate(f, CLAN_T.carve, [0, 1], clamp);
	const strikes: {x: number; z: number; at: number; seed: number}[] = [];
	INSCRIPTION_LINES.forEach((_, row) => {
		const letters = INSCRIPTION.filter((g) => g.row === row);
		letters.forEach((l) => {
			const ti = CLAN_T.carve[0] + (l.i / letters.length) * (CLAN_T.carve[1] - CLAN_T.carve[0]);
			const alpha = interpolate(pc * letters.length - l.i, [0, 0.6], [0, 1], clamp);
			glyphs.push({
				form: l.form,
				x: l.x,
				y: l.z,
				size: INSCRIPTION_SIZE,
				plane: 1,
				carve: 0,
				eye: 0,
				gold: interpolate(f, [ti + 10, ti + 42], [0, 0.95], clamp),
				alpha,
			});
			if (f >= ti - 2 && f < ti + 14) strikes.push({x: l.x, z: l.z, at: ti, seed: l.i + row * 40});
		});
	});
	// 拼图石板
	PANELS.forEach((p, i) => {
		const at = CLAN_T.panelGold[i];
		glyphs.push({
			form: p.form,
			x: p.x,
			y: p.y,
			size: p.size,
			relief: true,
			carve: 0,
			eye: 0,
			gold: interpolate(f, [at - 6, at + 18, at + 70], [0, 0.85, 0.32], clamp),
			daylight: interpolate(f, CLAN_T.daylight, [0, 0.55], {...clamp, easing: Easing.inOut(Easing.sin)}),
		});
	});

	// ── F（PokemonArt3D）──
	const hs = proj(heroP);
	const heroPx = HERO.size * hs.scale;
	const toModel = (l: WallLight): [number, number, number] => [(l.pos[0] - heroP.x) / HERO.size, (l.pos[1] - heroP.y) / HERO.size, (l.pos[2] - heroP.z) / HERO.size];
	const heroYaw = Math.sin((fA - GLYPH_T.heroOut) / 40) * 4;
	// F 的打光：开头与第 1 段末帧的算法完全一致（火把 + F 自己的余光），再慢慢换成房间里的光
	const ws = HERO.size * 1.06;
	const bob0 = Math.sin((fA - GLYPH_T.heroOut) / 26) * 6;
	const m1 = (p: [number, number, number]): [number, number, number] => [(p[0] - HERO.x) / ws, (p[1] - HERO.y - bob0) / ws, (p[2] + 60) / ws];
	const mix3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
	const lateL = f < 440 ? L0 : L2;
	const heroLights = [
		{pos: mix3(m1(t0.pos), toModel(L0), hand), color: L0.color, radius: t0.radius / ws + (L0.radius / HERO.size - t0.radius / ws) * hand},
		f < 140
			? {pos: mix3(m1([heroG.pos[0] - 120, heroG.pos[1] + 60, 260]), toModel(L1), hand), color: mix3(heroG.color, L1.color, hand), radius: 2.2 + (L1.radius / HERO.size - 2.2) * hand}
			: {pos: toModel(L1), color: L1.color, radius: L1.radius / HERO.size},
		...(f >= 140 ? [{pos: toModel(lateL), color: lateL.color, radius: lateL.radius / HERO.size}] : []),
	].slice(0, 2);

	// ── 人（远的先画）与投在墙上的影子 ──
	const floorLine = proj({x: cam.x, y: FLOOR_Y, z: 0}).y;
	const rimDir = (a: Actor): [number, number] => {
		const tip = torchTip(g)!;
		return [tip.x - a.x, -0.4];
	};
	const shadows = actors
		.filter((a) => a.alpha > 0.01 && a.key !== 'guide' && gTip.z > a.z + 40 && f < 360)
		.map((a) => {
			// 从向导的火把把人投到墙面（z = 0）上
			const L = gTip;
			const toWall = (q: V3) => {
				const t = L.z / (L.z - q.z);
				return {x: L.x + (q.x - L.x) * t, y: L.y + (q.y - L.y) * t, z: 0};
			};
			const feet = toWall({x: a.x, y: FLOOR_Y, z: a.z});
			const head = toWall({x: a.x, y: FLOOR_Y - PERSON_H, z: a.z});
			const sf = proj(feet);
			const sh = proj(head);
			return {a, x: sf.x, y: sf.y, h: sf.y - sh.y};
		});

	const people = [...actors]
		.filter((a) => a.alpha > 0.01)
		.map((a) => ({a, s: proj({x: a.x, y: FLOOR_Y, z: a.z})}))
		.filter(({s}) => !s.behind && s.x > -500 && s.x < 2420);

	const statueS = proj({x: STATUE.x, y: FLOOR_Y, z: STATUE.z});
	const brazierS = proj(BRAZIER);

	// 回忆的色调：暖金
	const memory = interpolate(f, CLAN_T.memory, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	// 第 1 段的火把烟光：接着画，随后交给各个火焰自己的光晕
	const hazeScr = project(cam, 1, {x: L0.pos[0], y: L0.pos[1]});
	const hazeO = 0.28 * flicker(fA, 2) * interpolate(f, [0, 80], [1, 0], clamp);

	const drawn: {z: number; el: React.ReactNode}[] = [];
	for (const {a, s} of people) {
		// 俯拍时按透视把人压短（头顶也按 3D 投影），宽度不变
		const head = proj({x: a.x, y: FLOOR_Y - (a.h ?? PERSON_H), z: a.z});
		const h = Math.max(1, s.y - head.y);
		const aspect = ((a.h ?? PERSON_H) * s.scale) / h;
		const blur = (1 - a.alpha) * 10;
		drawn.push({
			z: a.z,
			el: (
				<div key={a.key} style={{position: 'absolute', inset: 0, filter: blur > 0.2 ? `blur(${blur}px)` : undefined}}>
					<Person x={s.x} y={s.y} height={h} aspect={aspect} pose={a.pose} t={a.t} flip={a.flip} rimDir={rimDir(a)} rim={0.75} opacity={a.alpha} />
					{a.torch
						? (() => {
								const tip = torchTip(a)!;
								const ts = proj(tip);
								return <Flame x={ts.x} y={ts.y + 8 * ts.scale} size={34 * ts.scale} f={fA} seed={a.x} opacity={a.alpha} />;
						  })()
						: null}
				</div>
			),
		});
	}
	drawn.push({
		z: heroP.z,
		el: (
			<PokemonArt3D
				key="hero"
				dir="pokemon/unown"
				variant="-f"
				x={hs.x}
				y={hs.y}
				size={heroPx}
				yaw={heroYaw}
				pitch={-2}
				depthScale={0.5}
				ambient={[0.004, 0.004, 0.005]}
				pointLights={heroLights}
				rim={{dir: [-0.7, 0.55], color: [0.55, 0.32, 0.12], power: 2.5}}
				emissive={0.7}
				emissiveKey={[0.6, 0.85, -1, 0]}
				resolution={1.6}
				style={{filter: `drop-shadow(54px -36px 34px rgba(0,0,0,${0.7 * interpolate(f, [0, 90], [1, 0], clamp)}))`}}
			/>
		),
	});
	drawn.push({z: STATUE.z, el: statueEl(f, proj, actors)});
	drawn.sort((p, q) => p.z - q.z);

	const carverSparks = actors
		.filter((a) => a.pose === 'kneel' && a.alpha > 0.5)
		.map((a) => {
			const strikeAt = Math.floor((a.t ?? 0) + 0.5) * (a.key.startsWith('s') ? 9 : 8) - (a.key === 'c2' ? 4 : 0);
			const s = proj({x: a.x + (a.flip ? -1 : 1) * 27 * (PERSON_H / 100), y: FLOOR_Y - 6, z: a.z});
			return <Sparks key={`sp${a.key}`} x={s.x} y={s.y} scale={s.scale * 1.4} f={f} at={strikeAt} seed={a.x} />;
		});

	return (
		<AbsoluteFill style={{background: '#000'}}>
			<UnownWall cam={cam} pitch={pitch} camZ={camZ} floor time={fA / BASE_FPS} lights={lights} glyphs={glyphs} />
			{/* 投在墙上的人影 */}
			<AbsoluteFill style={{clipPath: `inset(0 0 ${Math.max(0, 1080 - floorLine)}px 0)`, filter: 'blur(5px)'}}>
				{shadows.map(({a, x, y, h}) => (
					<Person key={`sh${a.key}`} x={x} y={y} height={h} pose={a.pose} t={a.t} flip={a.flip} rim={0} opacity={a.alpha * 0.55} tone="#000" />
				))}
			</AbsoluteFill>
			<AbsoluteFill style={{mixBlendMode: 'screen', opacity: hazeO, background: `radial-gradient(ellipse 60% 55% at ${hazeScr.x}px ${hazeScr.y}px, rgba(255,140,60,0.32) 0%, rgba(255,110,40,0.1) 45%, transparent 75%)`}} />
			{drawn.map((d) => d.el)}
			{carverSparks}
			{/* 刻字处地上的火把、石板旁的火盆 */}
			{f > 130 && f < 420 ? (
				(() => {
					const s = proj(floorTorch);
					return <Flame x={s.x} y={s.y} size={30 * s.scale} f={fA} seed={7} opacity={interpolate(f, [140, 180, 360, 400], [0, 1, 1, 0], clamp)} />;
				})()
			) : null}
			{f > 440 ? (
				<>
					<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
						<g transform={`translate(${brazierS.x},${brazierS.y}) scale(${brazierS.scale})`} fill="#090705">
							<path d="M -46,0 Q 0,34 46,0 L 40,-8 L -40,-8 Z" />
							<rect x={-9} y={0} width={18} height={240} />
						</g>
					</svg>
					<Flame x={brazierS.x} y={brazierS.y - 4 * brazierS.scale} size={46 * brazierS.scale} f={fA} seed={3} opacity={interpolate(f, [470, 540], [0, 1], clamp)} glow={1.3} />
				</>
			) : null}
			<DustMotes opacity={0.45 + memory * 0.25} frameOffset={F1} />
			{/* 外面的天光：从高处斜斜地落在石板上 */}
			{(() => {
				const day = interpolate(f, CLAN_T.daylight, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
				if (day <= 0) return null;
				const c = proj({x: (PANELS[0].x + PANELS[3].x) / 2, y: PANELS[0].y, z: 0});
				return (
					<AbsoluteFill
						style={{
							mixBlendMode: 'screen',
							opacity: day * 0.75,
							background: `linear-gradient(${100}deg, transparent ${c.x / 19.2 - 34}%, rgba(170,200,255,0.22) ${c.x / 19.2 - 18}%, rgba(200,220,255,0.3) ${c.x / 19.2}%, rgba(170,200,255,0.2) ${c.x / 19.2 + 20}%, transparent ${c.x / 19.2 + 36}%)`,
							maskImage: `linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.9) ${c.y / 10.8}%, rgba(0,0,0,0.15) ${c.y / 10.8 + 22}%, transparent 100%)`,
							WebkitMaskImage: `linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.9) ${c.y / 10.8}%, rgba(0,0,0,0.15) ${c.y / 10.8 + 22}%, transparent 100%)`,
						}}
					/>
				);
			})()}
			{/* 回忆的暖金色调 */}
			<AbsoluteFill style={{background: 'rgba(255,186,96,1)', mixBlendMode: 'soft-light', opacity: memory * 0.14}} />
			<Vignette strength={0.75} />
			<SubtitleBackdrop />

			{/* 旁白（制作者撰写）：依据心金魂银·研究员 "It seems that UNOWN were living at the ruins with a human clan." */}
			<BiSubtitle
				from={CLAN_T.sub1[0]}
				to={CLAN_T.sub1[1]}
				zh="很久以前，有一族人和未知图腾一起住在这里。"
				en="Long ago, a human clan lived here together with the Unown."
				source={{zh: '旁白（依据心金魂银·阿露福遗迹研究员）', en: 'NARRATION (after HGSS · Ruins of Alph researcher)'}}
			/>
			{/* 旁白（制作者撰写）；引号内依据心金魂银·化石盔石室地面文字 "Our clan engraved words in this place"（日文：わたしたち いちぞく ことば ここに きざむ） */}
			<BiSubtitle
				from={CLAN_T.sub2[0]}
				to={CLAN_T.sub2[1]}
				zh="他们在地上刻下文字：「吾等一族之言，刻于此地。」"
				en={'They carved words into the floor: "Our clan engraved words in this place."'}
				source={{zh: '旁白（依据心金魂银·化石盔石室地面文字）', en: 'NARRATION (after HGSS · Kabuto chamber floor)'}}
			/>
			{/* 旁白（制作者撰写）：依据心金魂银·研究员 "this clan made the Pokémon statues underground"、化石翼龙石室地面文字 */}
			<BiSubtitle
				from={CLAN_T.sub3[0]}
				to={CLAN_T.sub3[1]}
				zh="还为它们造了宝可梦的石像。"
				en="They also made Pokémon statues for them."
				source={{zh: '旁白（依据心金魂银·研究员、化石翼龙石室地面文字）', en: 'NARRATION (after HGSS · researcher, Aerodactyl chamber floor)'}}
			/>
			{/* 旁白（制作者撰写）：四间石室的拼图（金银水晶 / 心金魂银） */}
			<BiSubtitle
				from={CLAN_T.sub4[0]}
				to={CLAN_T.sub4[1]}
				zh="石室的拼图上，刻着化石盔、菊石兽、化石翼龙和凤王。"
				en="The stone puzzles show Kabuto, Omanyte, Aerodactyl, and Ho-Oh."
				source={{zh: '旁白（依据金银水晶 / 心金魂银·阿露福遗迹拼图）', en: 'NARRATION (after GSC / HGSS · Ruins of Alph puzzles)'}}
			/>
			{/* 旁白（制作者撰写，推测，用户 2026-10-03 同意以"也许"呈现）：依据化石翼龙石室日文「そとの ポケモン ぞう つくる」与菊石兽石室"拒绝外界" */}
			<BiSubtitle
				from={CLAN_T.sub5[0]}
				to={CLAN_T.sub5[1]}
				zh="也许，那是他们刻给未知图腾看的，外面的世界。"
				en="Perhaps they were the outside world, carved for the Unown to see."
				source={{zh: '旁白（推测）', en: 'NARRATION (speculation)'}}
			/>
			<Grain frameOffset={F1} />
		</AbsoluteFill>
	);
};
