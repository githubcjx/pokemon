import {AbsoluteFill, Easing, interpolate, staticFile} from 'remotion';
import {Cam, project, shake, track, unproject} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer, Vignette} from '../../components/CamLayer';
import {Dawn} from '../../components/Dawn';
import {DustMotes} from '../../components/DustMotes';
import {FloatingRocks} from '../../components/effects/FloatingRocks';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {PokemonArt} from '../../components/PokemonArt';
import {CINZEL, SERIF} from '../../fonts';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {DISTORTION_FRAG} from '../../gl/shaders';
import {clamp, COLORS} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {DAWN_END, TWINS_END_CAM} from './TwinsScene';
import {Cry} from '../../components/Cry';

// ─── 时间轴（30fps 单位，650 帧 ≈ 21.7 秒）─────────────────────────
export const GIRATINA_SCENE_FRAMES = 650;

const T = {
	flip: [50, 140] as const, // 世界翻转 180°
	crossfade: [110, 165] as const, // 黎明 → 毁坏的世界
	rocksIn: 120,
	alteredIn: 175,
	alteredReveal: [198, 218, 238] as [number, number, number],
	tagIn: 228,
	strongLight: [425, 455] as const, // 强光照
	shadow: [440, 545] as const, // 暗影生
	alteredDark: [440, 465] as const,
	alteredOut: [465, 490] as const,
	originIn: 470,
	originReveal: [505, 522, 540] as [number, number, number],
	formSwitch: 505,
	fadeOut: 612, // 文字与标签淡出
	engulf: [596, 642] as const, // 暗影吞没整个画面，转场到下一段
	black: [628, 650] as const,
};

const W = 1920;
const H = 1080;
const GIRATINA = {x: 960, y: 590};
const BG_K = 0.3;
const OVERSCAN = 1.3;
const CW = W * OVERSCAN;
const CH = H * OVERSCAN;
const OX = (CW - W) / 2;
const OY = (CH - H) / 2;
// 翻转后，上一段黎明的地平线（y=830）位于背景层顶部 y=250 处（换算到放大后的画布）
const HORIZON_TOP = 1 - (250 + OY) / CH;

// ─── 镜头：仰望原世界 → 下沉 → 倾斜推近 → 仰看强光 → 下摇找回暗影 ────────
const getCam = (frame: number): Cam => {
	const x = track(frame, [
		[0, TWINS_END_CAM.x],
		[230, 942],
		[400, 952],
		[GIRATINA_SCENE_FRAMES, 960],
	]);
	const y = track(frame, [
		[0, TWINS_END_CAM.y],
		[T.flip[1], 540],
		[178, 390], // 仰望倒悬的原世界
		[262, 590], // 下沉到深处，找到骑拉帝纳
		[400, 470], // 推近脸部
		[428, 470],
		[T.strongLight[1], 300], // 强光照：仰头看向光
		[520, 600], // 暗影生：低头下摇
		[600, 585],
		[GIRATINA_SCENE_FRAMES, 610],
	]);
	const zoom = track(frame, [
		[0, TWINS_END_CAM.zoom],
		[T.flip[0], TWINS_END_CAM.zoom],
		[T.flip[1], 1],
		[262, 1.02],
		[400, 1.18],
		[428, 1.18],
		[T.strongLight[1], 1.02],
		[520, 1.1],
		[596, 1.12],
		[GIRATINA_SCENE_FRAMES, 1.35, Easing.in(Easing.cubic)], // 推进黑暗
	]);
	const roll = track(frame, [
		[0, 0],
		[205, 0],
		[262, -6], // 倾斜构图，制造不安
		[428, -6],
		[T.strongLight[1], 0],
		[520, 4],
		[GIRATINA_SCENE_FRAMES, 2],
	]);
	const hits = [shake(frame, T.strongLight[1] - 6, 8, 20), shake(frame, T.originReveal[0], 10, 22)];
	return {
		x: x + hits.reduce((a, h) => a + h.x, 0),
		y: y + hits.reduce((a, h) => a + h.y, 0),
		zoom,
		roll: roll + hits.reduce((a, h) => a + h.roll, 0),
	};
};
const VIOLET = '176,122,206';

const ART = {
	altered: staticFile('pokemon/giratina/art.png'),
	origin: staticFile('pokemon/giratina/art-origin.png'),
};

// ─── 背景：黎明翻转 → 毁坏的世界 ─────────────────────────────────
const FlippingDawn: React.FC = () => {
	const frame = useFrame();
	const opacity = interpolate(frame, [T.crossfade[0], T.crossfade[1]], [1, 0], clamp);
	if (opacity <= 0) return null;
	const p = interpolate(frame, [T.flip[0], T.flip[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const mid = Math.sin(Math.PI * p);
	return (
		<AbsoluteFill
			style={{
				opacity,
				transform: `rotate(${p * 180}deg) scale(${1 + 0.55 * mid})`,
				filter: `blur(${mid * 3}px) brightness(${1 - 0.4 * mid})`,
			}}
		>
			<Dawn {...DAWN_END} overscan={OVERSCAN} />
		</AbsoluteFill>
	);
};

const DistortionWorld: React.FC<{cam: Cam}> = ({cam}) => {
	const frame = useFrame();
	const c = unproject(cam, BG_K, project(cam, 1, {x: GIRATINA.x, y: GIRATINA.y + 40}));
	const glow = interpolate(frame, [T.crossfade[0], T.crossfade[1], T.strongLight[0], T.strongLight[1], T.fadeOut], [0.6, 0.8, 0.8, 1.7, 1.3], clamp);
	const rays = interpolate(frame, [T.crossfade[1], T.strongLight[0], T.strongLight[1]], [0.35, 0.4, 1.1], clamp);
	const shadow =
		interpolate(frame, [T.shadow[0], T.shadow[1]], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)}) +
		interpolate(frame, [T.engulf[0], T.engulf[1]], [0, 3], {...clamp, easing: Easing.in(Easing.quad)});
	const bright = interpolate(frame, [T.crossfade[0], T.crossfade[1]], [0, 1], clamp);
	if (bright <= 0) return null;
	return (
		<AbsoluteFill>
			<ShaderCanvas
				frag={DISTORTION_FRAG}
				width={CW}
				height={CH}
				style={{position: 'absolute', left: -OX, top: -OY}}
				uniforms={{
					uTime: frame / BASE_FPS,
					uCenter: [(c.x + OX) / CW, (c.y + OY) / CH],
					uHorizonTop: HORIZON_TOP,
					uGlow: glow,
					uRays: rays,
					uShadow: shadow,
					uBright: bright,
				}}
			/>
		</AbsoluteFill>
	);
};

// ─── 骑拉帝纳：别种形态 → 化为暗影 → 起源形态 ────────────────────────
const Giratina: React.FC = () => {
	const frame = useFrame();
	const dark = interpolate(frame, [T.alteredDark[0], T.alteredDark[1]], [1, 0.04], clamp);
	const alteredOpacity = interpolate(frame, [T.alteredOut[0], T.alteredOut[1]], [1, 0], clamp);
	const out = interpolate(frame, [T.engulf[0] + 10, T.engulf[1]], [1, 0], clamp);
	return (
		<>
			{alteredOpacity > 0 ? (
				<PokemonArt
					src={ART.altered}
					x={GIRATINA.x}
					y={GIRATINA.y}
					size={820}
					appear={T.alteredIn}
					reveal={T.alteredReveal}
					rimRgb="238,224,255"
					glowRgb={VIOLET}
					opacity={alteredOpacity}
					extraFilter={`brightness(${dark})`}
				/>
			) : null}
			<PokemonArt
				src={ART.origin}
				x={GIRATINA.x}
				y={GIRATINA.y - 10}
				size={880}
				appear={T.originIn}
				reveal={T.originReveal}
				rimRgb="238,224,255"
				glowRgb={VIOLET}
				restRim={0.4}
				floatPeriod={30}
				opacity={out}
			/>
		</>
	);
};

// 名称标签下方的形态名：别种形态 → 起源形态
const FormLabel: React.FC = () => {
	const frame = useFrame();
	if (frame < T.tagIn + 30) return null;
	const inA = interpolate(frame, [T.tagIn + 30, T.tagIn + 50], [0, 1], clamp);
	const swap = interpolate(frame, [T.formSwitch, T.formSwitch + 20], [0, 1], clamp);
	const out = interpolate(frame, [T.fadeOut, T.fadeOut + 12], [1, 0], clamp);
	const label = (zh: string, en: string, o: number, dy: number) => (
		<div
			style={{
				position: 'absolute',
				left: 0,
				top: dy,
				display: 'flex',
				alignItems: 'baseline',
				gap: 14,
				opacity: o,
				whiteSpace: 'nowrap',
			}}
		>
			<span style={{fontFamily: SERIF, fontSize: 24, letterSpacing: 8, color: `rgba(${COLORS.goldRgb},0.95)`}}>{zh}</span>
			<span style={{fontFamily: CINZEL, fontSize: 15, letterSpacing: 4, color: `rgba(${COLORS.goldRgb},0.65)`}}>{en}</span>
		</div>
	);
	return (
		<div style={{position: 'absolute', left: 100, top: 282, opacity: out}}>
			{label('别种形态', 'ALTERED FORME', inA * (1 - swap), -swap * 12)}
			{label('起源形态', 'ORIGIN FORME', swap, (1 - swap) * 12)}
		</div>
	);
};

const FadeOut: React.FC = () => {
	const frame = useFrame();
	const opacity = interpolate(frame, [T.black[0], T.black[1] - 1], [0, 1], clamp);
	return <AbsoluteFill style={{background: '#000', opacity}} />;
};

export const GiratinaScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);
	const tagOut = interpolate(frame, [T.fadeOut, T.fadeOut + 12], [1, 0], clamp);
	const dust = interpolate(frame, [T.rocksIn, T.rocksIn + 40, T.engulf[0], T.engulf[1]], [0, 0.9, 0.9, 0], clamp);
	const rocks = interpolate(frame, [T.engulf[0], T.engulf[1]], [1, 0], clamp);

	return (
		<AbsoluteFill style={{background: '#050306', overflow: 'hidden'}}>
			<CamLayer cam={cam} k={BG_K}>
				<DistortionWorld cam={cam} />
				<FlippingDawn />
			</CamLayer>
			<CamLayer cam={cam} k={0.55}>
				<FloatingRocks from={T.rocksIn} depthRange={[0, 0.5]} opacity={rocks} />
			</CamLayer>
			<CamLayer cam={cam} k={0.75}>
				<DustMotes rgb="196,150,226" opacity={dust * 0.7} />
			</CamLayer>
			<CamLayer cam={cam} k={1}>
				<Giratina />
			</CamLayer>
			{/* 近景：大块碎岩与浮尘从镜头前掠过 */}
			<CamLayer cam={cam} k={1.7}>
				<FloatingRocks from={T.rocksIn} depthRange={[0.5, 1]} opacity={rocks} />
			</CamLayer>
			<CamLayer cam={cam} k={1.6} style={{filter: 'blur(1.5px)'}}>
				<DustMotes rgb="196,150,226" opacity={dust} />
			</CamLayer>
			<Vignette />

			<NameTag
				from={T.tagIn}
				x={100}
				y={70}
				no="No.0487"
				zh="骑拉帝纳"
				en="GIRATINA"
				category="反抗宝可梦"
				categoryEn="RENEGADE POKÉMON"
				opacity={tagOut}
			/>
			<FormLabel />

			<SubtitleBackdrop />
			<BiSubtitle
				from={15}
				to={135}
				zh="但并非所有被创造者，都留在了这个世界。"
				en="But not all that was created remained in this world."
			/>
			<BiSubtitle
				from={235}
				to={310}
				zh="因为性格粗暴而被驱逐，"
				en="It was banished for its violence."
				source={{zh: '骑拉帝纳图鉴', en: 'POKÉDEX · PLATINUM'}}
			/>
			<BiSubtitle
				from={316}
				to={400}
				zh="一直待在毁坏的世界里，静静地看着原来的世界。"
				en="It silently gazed upon the old world from the Distortion World."
				source={{zh: '骑拉帝纳图鉴', en: 'POKÉDEX · PLATINUM'}}
			/>
			<BiSubtitle
				from={406}
				to={500}
				zh="洗翠地区自古流传着这样一句话：强光照而暗影生。"
				en="There is one Hisuian verse that tells of a powerful light creating a deep shadow."
				source={{zh: '骑拉帝纳图鉴《传说 阿尔宙斯》', en: 'POKÉDEX · LEGENDS: ARCEUS'}}
			/>
			<BiSubtitle
				from={506}
				to={615}
				zh="在本人的想象中，暗影指的正是这种宝可梦。"
				en="I imagine that this deep shadow is Giratina."
				source={{zh: '骑拉帝纳图鉴《传说 阿尔宙斯》', en: 'POKÉDEX · LEGENDS: ARCEUS'}}
			/>

			{/* 叫声：别种形态显形时（起源形态是同一只，不重复） */}
			<Cry name="giratina" at={T.alteredReveal[1]} />
			<Grain />
			<FadeOut />
		</AbsoluteFill>
	);
};
