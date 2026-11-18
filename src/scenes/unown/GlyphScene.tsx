import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, flow, project} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {DustMotes} from '../../components/DustMotes';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {EpisodeTitle, PartCard} from '../../components/unown/TitleCards';
import {Glyph, UnownWall, WallLight} from '../../components/unown/UnownWall';
import {clamp} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {flicker, HERO, TORCH_RGB, WALL} from './wall';

// ─── 第 1 段《字》（600 帧 = 20 秒，钩子）──────────────────────────────────────
// 漆黑的石室，火把光从左边扫过墙上一行行凹刻的符号 → 光停在一个符号上：金光流进刻痕、眼睑张开、
// 刻文变成未知图腾，从墙里浮出（叫声 + 名称卡）→ 四周的刻文接连睁眼 → 图鉴：先有文字还是先有未知图腾
// → 镜头拉远，满墙的眼睛（城都的阿露福遗迹，是它们的家）。末帧即第 2 段首帧。
export const GLYPH_SCENE_FRAMES = 600;

export const GLYPH_T = {
	lightIn: [0, 50] as const,
	heroGold: [190, 228] as const,
	heroEye: [228, 248] as const,
	heroCarve: [248, 270] as const,
	/** 墙上的刻文换成立体的立绘，开始浮出 */
	heroOut: 272,
	cry: 286,
	name: 296,
	nameOut: [440, 462] as const,
	/** 四周刻文开始接连睁眼 */
	cascade: 262,
	sub1a: [325, 405] as const,
	sub1b: [410, 522] as const,
	sub2: [530, 598] as const,
};

export const glyphCam = (f: number): Cam => ({
	x: flow(f, [
		[0, 560],
		[200, 900],
		[280, 1060],
		[440, 1080],
		[600, 1000],
	]),
	y: flow(f, [
		[0, 650],
		[280, 625],
		[440, 612],
		[600, 560],
	]),
	zoom: flow(f, [
		[0, 1.85],
		[200, 1.7],
		[285, 2.05],
		[440, 1.92],
		[600, 0.82],
	]),
	roll: 0,
});

/** 火把：拿火把的人在画面外左下方，光从左扫到主角左前方 */
export const glyphTorch = (f: number): WallLight => {
	const x = flow(f, [
		[0, -150],
		[60, 300],
		[200, 820],
		[285, 880],
		[600, 930],
	]);
	const on = interpolate(f, GLYPH_T.lightIn, [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
	const k = on * flicker(f) * 8;
	const y = flow(f, [
		[0, 780],
		[285, 730],
		[600, 780],
	]);
	return {pos: [x, y, 230], color: [TORCH_RGB[0] * k, TORCH_RGB[1] * k, TORCH_RGB[2] * k], radius: 330};
};

/** 主角浮出时的一团暖光 */
export const glyphHeroGlow = (f: number): WallLight => {
	const g = interpolate(f, [GLYPH_T.heroGold[0], GLYPH_T.heroOut, GLYPH_T.cry, 360], [0, 0.6, 1.4, 0.25], clamp);
	return {pos: [HERO.x, HERO.y, 160], color: [1.0 * g, 0.72 * g, 0.36 * g], radius: 260};
};

/** 墙上每个刻文睁眼的时刻：离主角越远越晚 */
export const wakeAt = (x: number, y: number, seed: number) => GLYPH_T.cascade + Math.hypot(x - HERO.x, y - HERO.y) / 13 + seed * 26;

export const glyphState = (f: number, tw: number) => ({
	gold: interpolate(f, [tw - 14, tw, tw + 24], [0, 0.75, 0], clamp),
	eye: interpolate(f, [tw, tw + 14], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)}),
	carve: interpolate(f, [tw + 6, tw + 34], [0, 1], clamp),
	eyeGlow: interpolate(f, [tw, tw + 10], [0, 0.7], clamp),
});

export const GlyphScene: React.FC = () => {
	const f = useFrame();
	const cam = glyphCam(f);
	const lights = [glyphTorch(f), glyphHeroGlow(f)];

	// 主角在墙上的刻文：金光 → 睁眼 → 显出立绘；浮出之后墙上只留下空的凹刻
	const out = f >= GLYPH_T.heroOut;
	const heroGlyph: Glyph = {
		x: HERO.x,
		y: HERO.y,
		size: HERO.size,
		form: HERO.form,
		gold: out ? interpolate(f, [GLYPH_T.heroOut, GLYPH_T.heroOut + 40], [0.8, 0], clamp) : interpolate(f, GLYPH_T.heroGold, [0, 1], clamp),
		eye: out ? 0 : interpolate(f, GLYPH_T.heroEye, [0, 1], {...clamp, easing: Easing.out(Easing.cubic)}),
		carve: out ? 0 : interpolate(f, GLYPH_T.heroCarve, [0, 1], clamp),
		eyeGlow: out ? 0 : interpolate(f, GLYPH_T.heroEye, [0, 0.7], clamp),
	};
	const glyphs: Glyph[] = [
		...WALL.map((g) => ({...g, ...glyphState(f, wakeAt(g.x, g.y, g.seed))})),
		heroGlyph,
	];

	// 浮出：景深从墙面移到墙前，略放大，轻微转身
	const lift = interpolate(f, [GLYPH_T.heroOut, 345], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const heroK = 1 + lift * 0.2;
	const bob = Math.sin((f - GLYPH_T.heroOut) / 26) * 6 * lift;
	const heroScr = project(cam, heroK, {x: HERO.x, y: HERO.y + bob});
	const heroScale = (1 + (cam.zoom - 1) * heroK) * (1 + lift * 0.06);
	const heroPx = HERO.size * heroScale;
	const flash = interpolate(f, [GLYPH_T.heroOut, GLYPH_T.cry, GLYPH_T.cry + 30], [1, 1.32, 1], clamp);
	const t = glyphTorch(f);
	const g = glyphHeroGlow(f);
	const worldSize = HERO.size * (1 + lift * 0.06);
	const toModel = (p: [number, number, number]): [number, number, number] => [
		(p[0] - HERO.x) / worldSize,
		(p[1] - HERO.y - bob) / worldSize,
		(p[2] + lift * 60) / worldSize,
	];
	// 影子投在墙上：朝远离火把的方向，随浮出变长变虚
	const shadowDx = 14 + lift * 40;
	const shadowDy = -10 - lift * 26;

	const nameO = interpolate(f, GLYPH_T.nameOut, [1, 0], clamp);
	const torchScr = project(cam, 1, {x: t.pos[0], y: t.pos[1]});

	return (
		<AbsoluteFill style={{background: '#000'}}>
			<UnownWall cam={cam} time={f / BASE_FPS} lights={lights} glyphs={glyphs} />
			{out ? (
				<PokemonArt3D
					dir="pokemon/unown"
					variant="-f"
					x={heroScr.x}
					y={heroScr.y}
					size={heroPx}
					yaw={Math.sin((f - GLYPH_T.heroOut) / 40) * 4 * lift}
					pitch={-2 * lift}
					depthScale={0.5}
					ambient={[0.004, 0.004, 0.005]}
					pointLights={[
						{pos: toModel(t.pos), color: t.color, radius: t.radius / worldSize},
						{pos: toModel([g.pos[0] - 120, g.pos[1] + 60, 260]), color: g.color, radius: 2.2},
					]}
					rim={{dir: [-0.7, 0.55], color: [0.55, 0.32, 0.12], power: 2.5}}
					emissive={0.7}
					emissiveKey={[0.6, 0.85, -1, 0]}
					brightness={flash}
					resolution={1.6}
					style={{filter: `drop-shadow(${shadowDx}px ${shadowDy}px ${14 + lift * 20}px rgba(0,0,0,${0.55 + lift * 0.15}))`}}
				/>
			) : null}
			{/* 火把的烟光：画面外左下方的一团暖色 */}
			<AbsoluteFill
				style={{
					mixBlendMode: 'screen',
					opacity: 0.28 * interpolate(f, GLYPH_T.lightIn, [0, 1], clamp) * flicker(f, 2),
					background: `radial-gradient(ellipse 60% 55% at ${torchScr.x}px ${torchScr.y}px, rgba(255,140,60,0.32) 0%, rgba(255,110,40,0.1) 45%, transparent 75%)`,
				}}
			/>
			{/* 名称卡的暗色衬底 */}
			<AbsoluteFill
				style={{
					opacity: interpolate(f, [GLYPH_T.name - 10, GLYPH_T.name + 10], [0, 1], clamp) * nameO,
					background: 'radial-gradient(ellipse 22% 20% at 1480px 420px, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.45) 55%, transparent 100%)',
				}}
			/>
			<DustMotes opacity={0.45 * interpolate(f, GLYPH_T.lightIn, [0, 1], clamp)} />
			<Vignette strength={0.75} />
			<SubtitleBackdrop />
			{/* 开头：本期标题 → 上篇篇章卡（用户 2026-10-03 要求标题放在开头、分上下两篇） */}
			<EpisodeTitle at={[4, 122]} />
			<PartCard at={[118, 204]} part="上篇" place="阿露福遗迹" en="PART I · RUINS OF ALPH" />

			<Cry name="unown" at={GLYPH_T.cry} />
			<NameTag
				from={GLYPH_T.name}
				x={1290}
				y={330}
				no="No.0201"
				category="象征宝可梦"
				categoryEn="SYMBOL POKÉMON"
				zh="未知图腾"
				en="UNOWN"
				opacity={nameO}
			/>

			{/* 官方原文：晶灿钻石图鉴（官方中文）；英文同晶灿钻石。一句拆成两条字幕 */}
			<BiSubtitle
				from={GLYPH_T.sub1a[0]}
				to={GLYPH_T.sub1a[1]}
				zh="很像古代文明的文字。"
				en="Because the Pokémon is shaped like ancient writing,"
				source={{zh: '未知图腾图鉴《晶灿钻石》', en: 'POKÉDEX · BRILLIANT DIAMOND'}}
			/>
			<BiSubtitle
				from={GLYPH_T.sub1b[0]}
				to={GLYPH_T.sub1b[1]}
				zh="是先有文字还是先有未知图腾，这是世界七大不可思议之一。"
				en="it is a huge mystery whether written language or Unown came first."
				source={{zh: '未知图腾图鉴《晶灿钻石》', en: 'POKÉDEX · BRILLIANT DIAMOND'}}
			/>
			{/* 旁白（制作者撰写） */}
			<BiSubtitle
				from={GLYPH_T.sub2[0]}
				to={GLYPH_T.sub2[1]}
				zh="城都的阿露福遗迹，是它们的家。"
				en="The Ruins of Alph in Johto are their home."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<Grain />
		</AbsoluteFill>
	);
};
