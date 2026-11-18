import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {flow} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {Glyph, projectRoom, UnownWall, WallLight} from '../../components/unown/UnownWall';
import {clamp} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {DOOR, FAREWELL, FAREWELL_SIZE, HERO, INSCRIPTION, INSCRIPTION_SIZE, PANELS, WALL} from './wall';
import {GLYPH_T} from './GlyphScene';
import {F4, JOURNEY_SCENE_FRAMES} from './JourneyScene';
import {STAGE_SCENE_FRAMES} from './StageScene';

// ─── 第 7 段《话还在》（470 帧，约 16 秒；全片收尾）────────────────────────────
// 接第 6 段末帧（均匀的金白）→ 金白褪去，回到阿露福石室，俯拍地上那第一句刻文（故事回到了阿露福遗迹。）
// → 刻文最后一次亮起，再慢慢暗下去（可他们刻下的话，还在这里，陪着未知图腾。）→ 镜头升起、转向墙面，
// 推到 F 的眼睛上：F 回到了第 1 段登场时的位置，满墙的眼睛都睁着 → 画面压暗，淡出到黑。
// 本期标题已移到第 1 段开头（用户 2026-10-03），结尾不再显示。
export const END_SCENE_FRAMES = 470;

const F6 = F4 + JOURNEY_SCENE_FRAMES + STAGE_SCENE_FRAMES;

const T = {
	unwhite: [0, 80] as const,
	sub1: [70, 160] as const,
	relight: [176, 230] as const,
	sub2: [180, 318] as const,
	crane: [200, 340] as const,
	dim: [360, 420] as const,
	out: [420, 470] as const,
};

const ease = Easing.inOut(Easing.sin);

/** F 眼睛的位置（第 1 段登场的位置） */
const EYE = {x: HERO.x + (0.3111 - 0.5) * HERO.size, y: HERO.y + (0.2792 - 0.5) * HERO.size};

const camKeys = {
	x: [[0, 1300], [200, 1290], [340, EYE.x - 10], [560, EYE.x - 14]],
	y: [[0, 250], [200, 262], [340, EYE.y + 125], [560, EYE.y + 132]],
	zoom: [[0, 0.53], [200, 0.55], [340, 2.0], [560, 2.2]],
	pitch: [[0, 50], [200, 48], [340, 0], [560, 0]],
	camZ: [[0, 1930], [200, 1950], [340, 2600], [560, 2600]],
} as Record<string, [number, number][]>;


export const EndScene: React.FC = () => {
	const f = useFrame();
	const fA = F6 + f;
	const cam = {x: flow(f, camKeys.x), y: flow(f, camKeys.y), zoom: flow(f, camKeys.zoom), roll: 0};
	const pitch = flow(f, camKeys.pitch);
	const camZ = flow(f, camKeys.camZ);
	const proj = (p: {x: number; y: number; z: number}) => projectRoom(cam, p, pitch, camZ);

	const white = interpolate(f, T.unwhite, [1, 0], {...clamp, easing: Easing.out(Easing.quad)});
	// 刻文的金光：从金白里带出来，渐暗；最后亮起一次，再暗下去
	// 刻文本身一直灌满金光（话还在）；照亮四周的光从金白里退下去，最后亮起一次，再暗下去
	const relight = interpolate(f, [T.relight[0], T.relight[0] + 16, T.relight[1], 360], [0, 1, 0.6, 0.35], clamp);
	const inscLight = Math.max(interpolate(f, [0, 150], [1, 0.3], clamp), relight);
	const inscGold = 1;
	const dim = interpolate(f, T.dim, [0, 1], {...clamp, easing: ease});

	// 光：地上刻文的金光（从下方）+ F 眼前的微光
	const L0: WallLight = {pos: [1300, 1180, 1050], color: [2.6 * inscLight, 1.75 * inscLight, 0.85 * inscLight], radius: 900};
	const fGlow = 0.5 + 0.6 * interpolate(f, T.crane, [0, 1], clamp);
	const L1: WallLight = {pos: [HERO.x + 60, HERO.y + 40, 260], color: [fGlow, fGlow * 0.72, fGlow * 0.38], radius: 420};
	const lights = [L0, L1];

	const glyphs: Glyph[] = [];
	for (const w of WALL) glyphs.push({...w, carve: 1, eye: 1, eyeGlow: 0.5, gold: 0.08});
	glyphs.push({x: HERO.x, y: HERO.y, size: HERO.size, form: HERO.form, carve: 0, eye: 0});
	INSCRIPTION.forEach((l) => glyphs.push({form: l.form, x: l.x, y: l.z, size: INSCRIPTION_SIZE, plane: 1, carve: 0, eye: 0, gold: inscGold}));
	FAREWELL.forEach((l) => glyphs.push({form: l.form, x: l.x, y: l.z, size: FAREWELL_SIZE, plane: 1, carve: 0, eye: 0, gold: 0.5}));
	PANELS.forEach((p) => glyphs.push({form: p.form, x: p.x, y: p.y, size: p.size, relief: true, carve: 0, eye: 0, gold: 0.4}));

	// F：回到登场时的位置，微微浮在墙前
	const bob = Math.sin((fA - GLYPH_T.heroOut) / 26) * 6;
	const heroP = {x: HERO.x, y: HERO.y + bob, z: 30};
	const hs = proj(heroP);
	const toModel = (l: WallLight): [number, number, number] => [(l.pos[0] - heroP.x) / HERO.size, (l.pos[1] - heroP.y) / HERO.size, (l.pos[2] - heroP.z) / HERO.size];

	return (
		<AbsoluteFill style={{background: '#000'}}>
			<UnownWall
				cam={cam}
				pitch={pitch}
				camZ={camZ}
				floor
				door={DOOR}
				outside={0.6}
				gold={0.35}
				goldPhase={fA * 0.06}
				time={fA / BASE_FPS}
				lights={lights}
				glyphs={glyphs}
			/>
			{!hs.behind ? (
				<PokemonArt3D
					dir="pokemon/unown"
					variant="-f"
					x={hs.x}
					y={hs.y}
					size={HERO.size * hs.scale}
					yaw={Math.sin((fA - GLYPH_T.heroOut) / 40) * 4}
					pitch={-2}
					depthScale={0.5}
					ambient={[0.004, 0.004, 0.005]}
					pointLights={[
						{pos: toModel(L0), color: L0.color, radius: L0.radius / HERO.size},
						{pos: toModel(L1), color: L1.color, radius: L1.radius / HERO.size},
					]}
					rim={{dir: [-0.7, 0.55], color: [0.55, 0.32, 0.12], power: 2.5}}
					emissive={0.75}
					emissiveKey={[0.6, 0.85, -1, 0]}
					resolution={2.4}
				/>
			) : null}
			<DustMotes opacity={0.4} frameOffset={F6} />
			<AbsoluteFill style={{background: 'rgba(255,186,96,1)', mixBlendMode: 'soft-light', opacity: 0.12}} />
			<Vignette strength={0.75} />
			{/* 片尾：压暗，留下眼睛的微光 */}
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 60% 60% at 50% 46%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.85) 100%)', opacity: dim}} />
			<SubtitleBackdrop />
			{/* 从第 6 段的金白接过来 */}
			<AbsoluteFill style={{background: '#fff3dc', opacity: white}} />

			{/* 旁白（制作者撰写） */}
			<BiSubtitle from={T.sub1[0]} to={T.sub1[1]} zh="故事回到了阿露福遗迹。" en="And the story returns to the Ruins of Alph." source={{zh: '旁白', en: 'NARRATION'}} />
			{/* 旁白（制作者撰写）：呼应心金魂银·化石盔石室地面文字 "Our clan engraved words in this place"（日文只写"刻于此地"，不说"永远"） */}
			<BiSubtitle
				from={T.sub2[0]}
				to={T.sub2[1]}
				zh="可他们刻下的话，还在这里，陪着未知图腾。"
				en="But the words they carved are still here, keeping the Unown company."
				source={{zh: '旁白（呼应心金魂银·化石盔石室地面文字）', en: 'NARRATION (echoing HGSS · Kabuto chamber floor)'}}
			/>

			<AbsoluteFill style={{background: '#000', opacity: interpolate(f, T.out, [0, 1], clamp)}} />
			<Grain frameOffset={F6} />
		</AbsoluteFill>
	);
};
