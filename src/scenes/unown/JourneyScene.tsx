import {AbsoluteFill, Easing, Img, interpolate, random, staticFile} from 'remotion';
import {Cam, flow} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Grain} from '../../components/Grain';
import {Person} from '../../components/unown/Silhouette';
import {PartCard} from '../../components/unown/TitleCards';
import {projectSnow, SinjohSnow, SnowCam} from '../../components/unown/SinjohSnow';
import {clamp} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {FORMS, HERO} from './wall';
import {F3, WORDS_SCENE_FRAMES, wordsCam, WordsView} from './WordsScene';

// ─── 第 5 段《故事走得更远》（1270 帧，约 42 秒；下篇的开头，前黑后白的转折）─────────────────────
// 用户 2026-10-03：全片分上下两篇（1–4 段阿露福遗迹 / 5 段起神都遗迹），交界处要跟观众说清楚。
// 接第 4 段末帧（整面睁眼的墙）→ 篇章卡「下篇 · 神都遗迹」（阿露福遗迹的故事，还藏着一段很少有人见过的后续）
// → 墙上所有眼睛一起眨眼、亮起，像同时盯着镜头（在心金魂银里，带着阿尔宙斯走进这座遗迹，墙上的未知图腾仿佛都在盯着来人——）
// → 镜头推进门边那只 F 的眼白，白色铺满画面（下一刻，人就被送到了遥远的北方。）
// → 白场里浮现风雪中的雪原，一列披兜帽的人走过（人们迁徙时，宝可梦的神话也随人一起流传）
// → 镜头升起，越过雪墙夹着的雪径，尽头是积雪的神殿（在那片雪原上，有一座被冰雪封住的神殿）
// → 神殿檐下刻着一排未知图腾，金光一闪（它继承了阿露福遗迹的传说）→ 镜头沿雪径走向神殿门洞
// （那一族人后来去了哪里，没有人知道。/ 可他们的故事，走得比他们更远。）→ 门洞的黑暗占满画面，深处一点金光。
// 布局参照心金魂银神都遗迹的地图（雪墙、雪径、门前冰晶）；迁徙的人不画成一族的样子（游戏没说一族去了哪里）。
/** 下篇开场（篇章卡 + 交代游戏里的触发方式）比原来多出的帧数；雪原部分的时间轴整体后移这么多 */
const D = 330;
export const JOURNEY_SCENE_FRAMES = 940 + D;

export const F4 = F3 + WORDS_SCENE_FRAMES;

const T = {
	card: [6, 118] as const,
	sub0: [100, 206] as const,
	sub1a: [214, 300] as const,
	sub1c: [304, 380] as const,
	blink: [306, 334] as const,
	push: [376, 498] as const,
	sub1b: [400, 484] as const,
	white: [448, 496] as const,
	cut: 498,
	// 以下为雪原部分（原第 5 段的帧号，渲染时减去 D）
	unwhite: [168, 280] as const, // 原帧号
	sub1: [200, 322] as const,
	sub2: [420, 532] as const,
	frieze: [560, 660] as const,
	sub3: [556, 668] as const,
	sub4: [690, 800] as const,
	sub5: [815, 928] as const,
};

const ease = Easing.inOut(Easing.sin);

// ── 前段：推进 F 的眼白（F 在第 4 段回到门边墙上 (4400, 600)）──
const F_REST = {x: 4400, y: 600};
const EYE = {x: F_REST.x + (0.3111 - 0.5) * HERO.size + 0.5 * 0.16 * HERO.size, y: F_REST.y + (0.2792 - 0.5) * HERO.size};
const wallCam = (f: number): Cam => {
	const c0 = wordsCam(WORDS_SCENE_FRAMES).cam;
	const k = interpolate(f, T.push, [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	const zoom = c0.zoom * Math.exp(Math.log(34 / c0.zoom) * k);
	// 推近的同时把眼睛移到画面中央：保持眼睛的屏幕位置随缩放收拢
	const center = interpolate(f, T.push, [0, 1], {...clamp, easing: ease});
	const keep = (c0.zoom / zoom) * (1 - center);
	return {x: EYE.x + (c0.x - EYE.x) * keep, y: EYE.y + (c0.y - EYE.y) * keep, zoom, roll: 0};
};

// ── 后段：神都遗迹的雪原 ──
const snowKeys = {
	x: [[168, 0], [940, 0]],
	y: [[168, 1.8], [400, 2.0], [520, 12], [640, 4.5], [780, 2.2], [900, 1.5], [940, 1.35]],
	z: [[168, 74], [400, 68], [520, 30], [640, -28], [780, -45], [900, -55.5], [940, -57.6]],
	yaw: [[168, -4], [400, 0], [940, 0]],
	pitch: [[168, -2], [400, 0], [520, 16], [640, 5], [780, 1], [940, 0]],
} as Record<string, [number, number][]>;
/** 雪原相机：参数 f 为本段帧号（内部换算回原帧号） */
export const snowCam = (f: number): SnowCam => ({
	x: flow(f - D, snowKeys.x),
	y: flow(f - D, snowKeys.y),
	z: flow(f - D, snowKeys.z),
	yaw: flow(f - D, snowKeys.yaw),
	pitch: flow(f - D, snowKeys.pitch),
	fov: 42,
});

/** 走过雪原的人（披兜帽；不是一族的样子） */
const WALKERS = Array.from({length: 7}, (_, i) => ({
	i,
	x0: -15 + i * 2.3 + (random(`wx${i}`) - 0.5) * 0.8,
	z: 44 + (random(`wz${i}`) - 0.5) * 3,
	h: 1.62 + random(`wh${i}`) * 0.18,
	phase: random(`wp${i}`),
}));

/** 神殿檐下的一排刻文（未知图腾立绘，凹刻在石里） */
const FRIEZE = Array.from({length: 10}, (_, i) => ({
	x: -4.4 + i * 0.98,
	form: FORMS[Math.floor(random(`fr${i}`) * 26)],
}));
const FRIEZE_Y = 3.3;
const FRIEZE_Z = -58.98;
const FRIEZE_SIZE = 0.66;

export const JourneyScene: React.FC = () => {
	const f = useFrame();
	const fA = F4 + f;

	if (f < T.cut) {
		// 墙上所有眼睛一起眨眼，再亮起来
		const blink = 1 - 0.92 * Math.sin(interpolate(f, T.blink, [0, Math.PI], clamp));
		const glow = 1 + interpolate(f, [T.blink[1], T.blink[1] + 46], [0, 1.1], {...clamp, easing: ease});
		const cam = wallCam(f);
		const whiteK = interpolate(f, T.white, [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
		return (
			<AbsoluteFill style={{background: '#000'}}>
				<WordsView f={WORDS_SCENE_FRAMES + f} cam={cam} blink={blink} glow={glow} />
				<PartCard at={T.card} part="下篇" place="神都遗迹" en="PART II · SINJOH RUINS" />
				{whiteK > 0 ? <AbsoluteFill style={{background: '#fff', opacity: whiteK}} /> : null}
				{/* 旁白（制作者撰写）：交代下篇与上篇的关系 */}
				<BiSubtitle from={T.sub0[0]} to={T.sub0[1]} zh="阿露福遗迹的故事，还藏着一段很少有人见过的后续。" en="The story of the Ruins of Alph has a sequel few have ever seen." source={{zh: '旁白', en: 'NARRATION'}} />
				{/* 旁白（制作者撰写）：依据心金魂银·阿尔宙斯活动（以阿尔宙斯为同行宝可梦进入阿露福遗迹触发）与研究员 "The UNOWN pictures on the wall... It feels like they're staring at me!" */}
				<BiSubtitle
					from={T.sub1a[0]}
					to={T.sub1a[1]}
					zh="在心金魂银里，带着阿尔宙斯走进这座遗迹，"
					en="In HeartGold and SoulSilver, bring Arceus into these ruins,"
					source={{zh: '旁白（依据心金魂银·阿尔宙斯活动）', en: 'NARRATION (after HGSS · Arceus event)'}}
				/>
				<BiSubtitle
					from={T.sub1c[0]}
					to={T.sub1c[1]}
					zh="墙上的未知图腾，仿佛都在盯着来人——"
					en="and the Unown on the walls seem to stare right at you—"
					source={{zh: '旁白（依据心金魂银·研究员）', en: 'NARRATION (after HGSS · lead researcher)'}}
				/>
				{/* 旁白（制作者撰写）：依据研究员 "...which sent you to the Sinjoh Ruins...?"；方位依据宝可梦装置地图（城都以北） */}
				<BiSubtitle
					from={T.sub1b[0]}
					to={T.sub1b[1]}
					zh="下一刻，人就被送到了遥远的北方。"
					en="and the next moment, you are sent far to the north."
					source={{zh: '旁白（依据心金魂银·研究员）', en: 'NARRATION (after HGSS · lead researcher)'}}
				/>
			</AbsoluteFill>
		);
	}

	const cam = snowCam(f);
	// 雪原部分沿用原来的帧号
	const g = f - D;
	const white = interpolate(g, T.unwhite, [1, 0], {...clamp, easing: Easing.out(Easing.quad)});
	const haze = interpolate(g, [168, 360, 520, 940], [1.6, 0.9, 0.35, 0.15], clamp);

	// 走过雪原的人
	const walkers = WALKERS.map((w) => {
		const t = (g - 168) / BASE_FPS;
		const x = w.x0 + 1.05 * t;
		const foot = projectSnow(cam, {x, y: 0.45, z: w.z});
		if (foot.behind) return null;
		const head = projectSnow(cam, {x, y: 0.45 + w.h, z: w.z});
		const h = foot.y - head.y;
		const fog = Math.exp(-foot.depth * (0.008 + 0.04 * haze));
		const o = (1 - white) * fog * interpolate(g, [440, 520], [1, 0], clamp);
		if (o <= 0.01 || h < 2) return null;
		return (
			<Person
				key={w.i}
				x={foot.x}
				y={foot.y + h * 0.04}
				height={h}
				pose="walk"
				t={(fA / BASE_FPS) * 0.9 + w.phase}
				rim={0}
				tone="#1b212c"
				hood
				opacity={o}
			/>
		);
	});

	// 檐下刻文：凹刻（深色）+ 金光一闪
	const gold = interpolate(g, [T.frieze[0], T.frieze[0] + 20, T.frieze[1]], [0, 1, 0.25], clamp);
	const frieze = FRIEZE.map((fr, i) => {
		const p = projectSnow(cam, {x: fr.x, y: FRIEZE_Y, z: FRIEZE_Z});
		if (p.behind) return null;
		const size = FRIEZE_SIZE * p.scale;
		const fog = Math.exp(-p.depth * (0.008 + 0.04 * haze));
		const gi = Math.max(0, Math.min(1, gold * 1.4 - i * 0.04));
		const style = {position: 'absolute' as const, left: p.x - size / 2, top: p.y - size / 2, width: size, height: size};
		return (
			<div key={i}>
				<Img src={staticFile(`pokemon/unown/art-${fr.form}.png`)} style={{...style, filter: 'grayscale(1) brightness(0.45)', mixBlendMode: 'multiply', opacity: 0.55 * fog}} />
				{gi > 0 ? (
					<Img
						src={staticFile(`pokemon/unown/art-${fr.form}.png`)}
						style={{...style, filter: `brightness(0) invert(1) sepia(1) saturate(4) hue-rotate(-12deg) drop-shadow(0 0 ${size * 0.12}px rgba(255,190,90,0.9))`, mixBlendMode: 'screen', opacity: gi * fog * 0.85}}
					/>
				) : null}
			</div>
		);
	});

	const doorGlow = interpolate(g, [800, 940], [0, 0.4], {...clamp, easing: ease});

	return (
		<AbsoluteFill style={{background: '#fff'}}>
			<SinjohSnow cam={cam} time={fA / BASE_FPS} white={white} haze={haze} snow={0.9} doorGlow={doorGlow} />
			{frieze}
			{walkers}
			<Vignette strength={0.28 * (1 - white)} />
			{/* 字幕区的冷色衬底（雪地太亮，浅色字需要压一层） */}
			<AbsoluteFill style={{background: 'linear-gradient(to top, rgba(16,20,28,0.5) 0%, rgba(16,20,28,0.22) 17%, transparent 34%)', opacity: 1 - white}} />

			{/* 旁白（制作者撰写）：依据心金魂银·神都遗迹的登山男 "When people moved from place to place, the myths and legends of Pokémon and their power would also be carried with those people." */}
			<BiSubtitle
				from={T.sub1[0] + D}
				to={T.sub1[1] + D}
				zh="人们迁徙时，宝可梦的神话也随人一起流传。"
				en="When people moved from place to place, the myths of Pokémon traveled with them."
				source={{zh: '旁白（依据心金魂银·神都遗迹的登山男）', en: 'NARRATION (after HGSS · Hiker at the Sinjoh Ruins)'}}
			/>
			{/* 旁白（制作者撰写）：依据竹兰 "an icebound temple"、地图说明 "A snow-covered area of old legends, surrounded by a wall of snow."；宝可梦装置的地图指向城都遥远的北方 */}
			<BiSubtitle
				from={T.sub2[0] + D}
				to={T.sub2[1] + D}
				zh="在那片雪原上，有一座被冰雪封住的神殿。"
				en="On that snowfield stands a temple sealed in snow and ice."
				source={{zh: '旁白（依据心金魂银·竹兰、地图说明）', en: 'NARRATION (after HGSS · Cynthia, map description)'}}
			/>
			{/* 旁白（制作者撰写）：依据登山男 "The ancient ruins here have inherited the legends from both the Ruins of Alph in Johto and the Spear Pillar in Sinnoh." */}
			<BiSubtitle
				from={T.sub3[0] + D}
				to={T.sub3[1] + D}
				zh="它继承了阿露福遗迹的传说。"
				en="It inherited the legends of the Ruins of Alph."
				source={{zh: '旁白（依据心金魂银·神都遗迹的登山男）', en: 'NARRATION (after HGSS · Hiker at the Sinjoh Ruins)'}}
			/>
			{/* 旁白（制作者撰写）：游戏没有交代阿露福一族的去向 */}
			<BiSubtitle from={T.sub4[0] + D} to={T.sub4[1] + D} zh="那一族人后来去了哪里，没有人知道。" en="Where the clan went, no one knows." source={{zh: '旁白', en: 'NARRATION'}} />
			<BiSubtitle from={T.sub5[0] + D} to={T.sub5[1] + D} zh="可他们的故事，走得比他们更远。" en="But their story traveled farther than they did." source={{zh: '旁白', en: 'NARRATION'}} />
			<Grain opacity={0.06} frameOffset={F4} />
		</AbsoluteFill>
	);
};
