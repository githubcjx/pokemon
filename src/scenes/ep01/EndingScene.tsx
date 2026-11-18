import {AbsoluteFill, Easing, Img, interpolate, staticFile} from 'remotion';
import {Cam, project, shake, track, unproject} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer, Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Orb} from '../../components/effects/Orb';
import {Rain} from '../../components/effects/Rain';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {Nebula} from '../../components/Nebula';
import {SacredRings} from '../../components/SacredRings';
import {clamp, COLORS} from '../../theme';
import {useFrame} from '../../time';
import {Cry} from '../../components/Cry';

// ─── 时间轴（30fps 单位，652 帧 ≈ 21.7 秒）─────────────────────────
export const ENDING_SCENE_FRAMES = 652;

const T = {
	pullBack: [0, 130] as const, // 从星光中拉远，星云展开
	arceusIn: [50, 110] as const, // 星光化作阿尔宙斯
	sleep: [150, 215] as const, // 金光收拢，陷入沉睡
	toBlack: [200, 226] as const,
	groudon: [232, 352] as const, // 两道剪影，各配一句图鉴解说
	kyogre: [352, 472] as const,
	standoff: [472, 652] as const, // 火与水分屏对峙，一直绷到淡出
	fadeOut: [615, 652] as const,
};

const W = 1920;
const H = 1080;
const CENTER = {x: 960, y: 540};
// 上一段结尾那颗星在屏幕上的位置 y=498：以此反推开场镜头，保证衔接
const STAR_SCREEN_Y = 498;
const START_ZOOM = 1.8;

const ART = {
	arceus: staticFile('pokemon/arceus/art.png'),
	groudon: staticFile('pokemon/groudon/art-primal.png'),
	kyogre: staticFile('pokemon/kyogre/art-primal.png'),
};

const FIRE = '255,120,60';
const WATER = '90,160,255';

// ─── 尾声镜头：从星光中后拉，再缓慢推近沉睡的阿尔宙斯 ──────────────────
const getCam = (frame: number): Cam => {
	const startY = CENTER.y - (STAR_SCREEN_Y - CENTER.y) / START_ZOOM;
	return {
		x: 960,
		y: track(frame, [
			[0, startY],
			[T.pullBack[1], 540, Easing.inOut(Easing.cubic)],
		]),
		zoom: track(frame, [
			[0, START_ZOOM],
			[T.pullBack[1], 0.95, Easing.inOut(Easing.cubic)],
			[T.toBlack[1], 1.08],
		]),
		roll: track(frame, [
			[0, 0],
			[T.pullBack[1], -1],
			[T.toBlack[1], 0.5],
		]),
	};
};

const BG_K = 0.3;

const Background: React.FC<{cam: Cam}> = ({cam}) => {
	const frame = useFrame();
	const center = unproject(cam, BG_K, project(cam, 1, CENTER));
	const warm = interpolate(frame, [0, 40, T.sleep[0], T.sleep[1]], [1.6, 1.1, 1.0, 0.15], clamp);
	const rays = interpolate(frame, [20, 80, T.sleep[0], T.sleep[1]], [0, 0.8, 0.8, 0], clamp);
	const bright = interpolate(frame, [0, 30, T.toBlack[0], T.toBlack[1]], [0.3, 1, 1, 0], clamp);
	return (
		<Nebula center={center} converge={0.55} warm={warm} rays={rays} bright={bright} overscan={1.3} />
	);
};

// 开场那颗星：延续上一段天顶汇聚的星光，随拉远逐渐隐入阿尔宙斯的光中
const Star: React.FC = () => {
	const frame = useFrame();
	// 与上一段结尾的星同尺寸、同亮度（屏幕上约 124px、强度 0.7）
	const o = interpolate(frame, [0, T.arceusIn[1]], [0.7, 0], clamp);
	if (o <= 0) return null;
	return <Orb x={CENTER.x} y={CENTER.y} size={124 / START_ZOOM} rgb="255,214,140" intensity={o} />;
};

// 沉睡的阿尔宙斯：金光由强转弱，最后只剩一圈淡淡的轮廓光
const SleepingArceus: React.FC = () => {
	const frame = useFrame();
	const appear = interpolate(frame, [T.arceusIn[0], T.arceusIn[1]], [0, 1], clamp);
	if (appear <= 0) return null;
	const brightness = interpolate(frame, [T.arceusIn[0], T.arceusIn[1], T.sleep[0], T.sleep[1]], [1.6, 1, 1, 0.12], clamp);
	const rim = interpolate(frame, [T.sleep[0], T.sleep[1]], [0.45, 0.8], clamp);
	const out = interpolate(frame, [T.toBlack[0], T.toBlack[1]], [1, 0], clamp);
	const size = 760;
	const floatY = Math.sin(frame / 30) * 6;
	return (
		<Img
			src={ART.arceus}
			style={{
				position: 'absolute',
				left: CENTER.x - size / 2,
				top: CENTER.y - size / 2 + floatY,
				width: size,
				height: size,
				opacity: appear * out,
				filter: `brightness(${brightness}) drop-shadow(0 0 8px rgba(255,236,190,${rim})) drop-shadow(0 0 40px rgba(${COLORS.glowRgb},${rim * 0.7}))`,
			}}
		/>
	);
};

// ─── 结尾：两道剪影的对峙 ────────────────────────────────────────
// 剪影：只用官方立绘的轮廓，边缘带元素色的轮廓光
const Silhouette: React.FC<{src: string; x: number; y: number; size: number; rgb: string; opacity?: number; glow?: number}> = ({
	src,
	x,
	y,
	size,
	rgb,
	opacity = 1,
	glow = 1,
}) => (
	<Img
		src={src}
		style={{
			position: 'absolute',
			left: x - size / 2,
			top: y - size / 2,
			width: size,
			height: size,
			opacity,
			filter: `brightness(0) drop-shadow(0 0 3px rgba(${rgb},${Math.min(1, glow)})) drop-shadow(0 0 ${10 + 8 * glow}px rgba(${rgb},${0.9 * glow})) drop-shadow(0 0 ${40 + 30 * glow}px rgba(${rgb},${0.6 * glow}))`,
		}}
	/>
);

const FireBackdrop: React.FC<{opacity?: number}> = ({opacity = 1}) => (
	<AbsoluteFill style={{opacity}}>
		<AbsoluteFill style={{background: 'radial-gradient(ellipse 90% 70% at 50% 110%, #ff7a2e 0%, #a8260c 35%, #2a0703 70%, #0b0302 100%)'}} />
		<DustMotes rgb="255,150,70" />
	</AbsoluteFill>
);

const WaterBackdrop: React.FC<{opacity?: number}> = ({opacity = 1}) => (
	<AbsoluteFill style={{opacity}}>
		<AbsoluteFill style={{background: 'radial-gradient(ellipse 90% 70% at 50% -10%, #3f7fd6 0%, #123a78 35%, #04112a 70%, #02060f 100%)'}} />
		<Rain />
	</AbsoluteFill>
);

/** 预告快切：每个镜头自带推近与冲击震动 */
const Cut: React.FC<{range: readonly [number, number]; hit: number; children: React.ReactNode; push?: [number, number]}> = ({
	range,
	hit,
	children,
	push = [1.0, 1.12],
}) => {
	const frame = useFrame();
	if (frame < range[0] || frame >= range[1]) return null;
	const s = shake(frame, hit, 18, 18);
	const zoom = interpolate(frame, range as unknown as [number, number], push, clamp);
	const cam: Cam = {x: 960 + s.x, y: 540 + s.y, zoom, roll: s.roll};
	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			<CamLayer cam={cam} k={1}>
				{children}
			</CamLayer>
		</AbsoluteFill>
	);
};

const Standoff: React.FC = () => {
	const frame = useFrame();
	const t = frame - T.standoff[0];
	const approach = interpolate(frame, [T.standoff[0], T.standoff[1]], [0, 25], {...clamp, easing: Easing.out(Easing.quad)});
	// 两者的轮廓光交替起伏，像是在彼此试探
	const fireGlow = 0.85 + 0.35 * Math.sin(t * 0.16);
	const waterGlow = 0.85 + 0.35 * Math.sin(t * 0.16 + Math.PI);
	const seam = 0.25 + 0.2 * Math.abs(Math.sin(t * 0.37)) * Math.abs(Math.sin(t * 0.11));
	return (
		<>
			{/* 分屏：左火右水 */}
			<AbsoluteFill style={{clipPath: 'polygon(0 0, 54% 0, 46% 100%, 0 100%)'}}>
				<FireBackdrop />
			</AbsoluteFill>
			<AbsoluteFill style={{clipPath: 'polygon(54% 0, 100% 0, 100% 100%, 46% 100%)'}}>
				<WaterBackdrop />
			</AbsoluteFill>
			{/* 火与水交界处的一道微光 */}
			<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
				<line x1={1037} y1={-40} x2={883} y2={1120} stroke={`rgba(255,236,210,${seam})`} strokeWidth={2} style={{filter: 'blur(1.5px)'}} />
			</svg>
			<Silhouette src={ART.groudon} x={500 + approach} y={600} size={820} rgb={FIRE} glow={fireGlow} />
			<Silhouette src={ART.kyogre} x={1440 - approach} y={560} size={800} rgb={WATER} glow={waterGlow} />
		</>
	);
};

const Preview: React.FC = () => (
	<>
		<Cut range={T.groudon} hit={T.groudon[0]}>
			<FireBackdrop />
			<Silhouette src={ART.groudon} x={900} y={560} size={1100} rgb={FIRE} />
		</Cut>
		<Cut range={T.kyogre} hit={T.kyogre[0]}>
			<WaterBackdrop />
			<Silhouette src={ART.kyogre} x={1020} y={520} size={1050} rgb={WATER} />
		</Cut>
		<Cut range={T.standoff} hit={T.standoff[0]} push={[1.0, 1.1]}>
			<Standoff />
		</Cut>
	</>
);

const FadeOut: React.FC = () => {
	const frame = useFrame();
	const opacity = interpolate(frame, [T.fadeOut[0], T.fadeOut[1] - 1], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	return <AbsoluteFill style={{background: '#000', opacity}} />;
};

export const EndingScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);
	const ringsOut = interpolate(frame, [T.sleep[0], T.sleep[1]], [0.5, 0], clamp);

	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			{frame < T.toBlack[1] ? (
				<>
					<CamLayer cam={cam} k={BG_K}>
						<Background cam={cam} />
					</CamLayer>
					<CamLayer cam={cam} k={0.7}>
						<DustMotes opacity={interpolate(frame, [0, 40, T.toBlack[0], T.toBlack[1]], [0, 0.6, 0.6, 0], clamp)} />
					</CamLayer>
					<CamLayer cam={cam} k={1}>
						{ringsOut > 0 && <SacredRings x={CENTER.x} y={CENTER.y} size={980} revealFrom={T.arceusIn[0]} revealFrames={80} opacity={ringsOut} />}
						<SleepingArceus />
						<Star />
					</CamLayer>
					<Vignette />
				</>
			) : null}

			<Preview />

			<SubtitleBackdrop />
			<BiSubtitle
				from={45}
				to={200}
				zh="创造出世界后，起始之物便陷入了沉睡之中。"
				en="The world created, the Original One took to unyielding sleep..."
				source={{zh: '神奥传说《起始的故事》', en: 'THE ORIGINAL STORY · SINNOH MYTH'}}
			/>
			<BiSubtitle
				from={T.groudon[0] + 10}
				to={T.groudon[1] - 6}
				zh="该宝可梦据说是大地的化身。"
				en="Groudon is said to be the personification of the land itself."
				source={{zh: '固拉多图鉴《欧米伽红宝石》', en: 'POKÉDEX · OMEGA RUBY'}}
			/>
			<BiSubtitle
				from={T.kyogre[0] + 10}
				to={T.kyogre[1] - 6}
				zh="该宝可梦据说是海洋的化身。"
				en="Kyogre is said to be the personification of the sea itself."
				source={{zh: '盖欧卡图鉴《阿尔法蓝宝石》', en: 'POKÉDEX · ALPHA SAPPHIRE'}}
			/>
			<BiSubtitle
				from={T.standoff[0] + 16}
				to={T.fadeOut[0] + 8}
				zh="传说，为了寻求自然的能量，它曾不断与固拉多争斗。"
				en="Legends tell of its many clashes against Groudon, as each sought to gain the power of nature."
				source={{zh: '盖欧卡图鉴《阿尔法蓝宝石》', en: 'POKÉDEX · ALPHA SAPPHIRE'}}
			/>

			{/* 叫声：两道剪影各自出现时 */}
			<Cry name="groudon-primal" at={T.groudon[0]} />
			<Cry name="kyogre-primal" at={T.kyogre[0]} />
			<Grain />
			<FadeOut />
		</AbsoluteFill>
	);
};
