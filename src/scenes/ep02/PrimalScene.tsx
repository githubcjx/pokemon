import {AbsoluteFill, Easing, Img, interpolate, staticFile} from 'remotion';
import {Cam, shake, track} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer, Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {DustMotes} from '../../components/DustMotes';
import {Lightning} from '../../components/effects/Lightning';
import {Rain} from '../../components/effects/Rain';
import {LavaField, StormSea} from '../../components/Elements';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// ─── 第 2 期 · 第 1 段「原始回归」（600 帧 = 20 秒）──────────────────────
// 接上期最后一帧的火水分屏剪影对峙 → 纹路先亮 → 显色爆发 → 名称卡与图鉴 → 双方逼近，蒸汽白闪转入下一段
export const PRIMAL_SCENE_FRAMES = 600;

const T = {
	fadeIn: [0, 24] as const,
	tension: [50, 160] as const, // 分界线颤动、低频震动渐强
	marks: [96, 156] as const, // 原始回归的纹路先亮起
	gPeak: 166, // 固拉多显色峰值（叫声）
	kPeak: 174, // 盖欧卡显色峰值（叫声）
	tags: 196,
	subOpen: [56, 156] as const,
	subG: [228, 358] as const,
	subK: [366, 496] as const,
	build: [500, 600] as const, // 双方逼近，分界线沸腾
	whiteOut: [578, 600] as const,
};

// 上期结尾的分界线（镜头推近到 1.1 倍后的屏幕位置），保证同一画面接续
const SEAM_TOP = 1031.7;
const SEAM_BOT = 888.3;
const LEFT_CLIP = `polygon(0 0, ${SEAM_TOP}px 0, ${SEAM_BOT}px 100%, 0 100%)`;
const RIGHT_CLIP = `polygon(${SEAM_TOP}px 0, 100% 0, 100% 100%, ${SEAM_BOT}px 100%)`;

const FIRE = '255,120,60';
const WATER = '90,160,255';

const ART = {
	groudon: staticFile('pokemon/groudon/art-primal.png'),
	kyogre: staticFile('pokemon/kyogre/art-primal.png'),
};

// 风暴一侧的闪电：位置 / 时间（第 3 道与固拉多显色同时劈下）
const BOLTS = [
	{at: 70, from: [1580, -40], to: [1680, 470], x: 0.82},
	{at: 132, from: [1300, -40], to: [1240, 420], x: 0.66},
	{at: 165, from: [1720, -40], to: [1610, 520], x: 0.86},
	{at: 300, from: [1500, -40], to: [1560, 450], x: 0.78},
	{at: 432, from: [1820, -40], to: [1760, 480], x: 0.92},
	{at: 548, from: [1380, -40], to: [1290, 440], x: 0.7},
	{at: 574, from: [1640, -40], to: [1700, 500], x: 0.85},
] as const;

const flashAt = (frame: number) =>
	BOLTS.reduce(
		(acc, b) => {
			const t = frame - b.at;
			if (t < 0 || t > 14) return acc;
			const v = t < 2 ? 1 : t < 3.5 ? 0.3 : t < 5.5 ? 0.85 : 0.85 * Math.exp(-(t - 5.5) / 3);
			return v > acc.v ? {v, x: b.x} : acc;
		},
		{v: 0, x: 0.8},
	);

// ─── 镜头 ─────────────────────────────────────────────────────────
const getCam = (frame: number): Cam => {
	const s1 = shake(frame, T.gPeak, 26, 32);
	const s2 = shake(frame, T.kPeak, 16, 26);
	// 低频隆隆声：对峙渐强、结尾逼近时再起
	const rumble =
		interpolate(frame, [T.tension[0], T.tension[1]], [0, 3.5], clamp) * interpolate(frame, [T.gPeak, T.gPeak + 20], [1, 0], clamp) +
		interpolate(frame, [T.build[0], T.build[1]], [0, 7], {...clamp, easing: Easing.in(Easing.quad)});
	const rx = rumble * (Math.sin(frame * 2.3) + 0.6 * Math.sin(frame * 5.1 + 1.7));
	const ry = rumble * (Math.cos(frame * 2.9 + 0.4) + 0.6 * Math.sin(frame * 4.3));
	return {
		x:
			track(frame, [
				[0, 960],
				[T.gPeak, 960],
				[260, 960],
				[T.build[0], 942],
				[T.build[1], 960],
			]) +
			s1.x +
			s2.x +
			rx,
		y: 540 + s1.y + s2.y + ry,
		zoom: track(frame, [
			[0, 1.1],
			[T.gPeak - 2, 1.17, Easing.in(Easing.quad)],
			// 爆发：猛推
			[T.gPeak + 6, 1.34, Easing.out(Easing.cubic)],
			// 回拉到全景，让两只完整亮相
			[260, 1.0, Easing.inOut(Easing.cubic)],
			[T.build[0], 1.05],
			// 结尾猛推进分界线
			[T.build[1], 1.42, Easing.in(Easing.cubic)],
		]),
		roll: s1.roll + s2.roll,
	};
};

// ─── 背景 ─────────────────────────────────────────────────────────
// 上期结尾用的两块渐变（爆发前），爆发后换成熔岩大地 / 暴风雨海洋
const OldFire: React.FC = () => (
	<AbsoluteFill style={{background: 'radial-gradient(ellipse 90% 70% at 50% 110%, #ff7a2e 0%, #a8260c 35%, #2a0703 70%, #0b0302 100%)'}} />
);
const OldWater: React.FC = () => (
	<AbsoluteFill style={{background: 'radial-gradient(ellipse 90% 70% at 50% -10%, #3f7fd6 0%, #123a78 35%, #04112a 70%, #02060f 100%)'}} />
);

const Halves: React.FC<{cam: Cam}> = ({cam}) => {
	const frame = useFrame();
	const oldBg = interpolate(frame, [T.gPeak - 2, T.gPeak + 16], [1, 0], clamp);
	const heat = track(frame, [
		[0, 0.6],
		[T.gPeak, 1.3, Easing.out(Easing.cubic)],
		[260, 0.95],
		[T.build[0], 0.95],
		[T.build[1], 1.4],
	]);
	const storm = track(frame, [
		[0, 0.7],
		[T.gPeak, 1.25],
		[260, 1.0],
		[T.build[0], 1.0],
		[T.build[1], 1.35],
	]);
	const flash = flashAt(frame);
	return (
		<>
			<AbsoluteFill style={{clipPath: LEFT_CLIP}}>
				<CamLayer cam={cam} k={0.3}>
					<LavaField horizon={0.4} heat={heat} />
				</CamLayer>
				{oldBg > 0 && (
					<CamLayer cam={cam} k={1} style={{opacity: oldBg}}>
						<OldFire />
					</CamLayer>
				)}
				<CamLayer cam={cam} k={0.7}>
					<DustMotes rgb="255,150,70" />
				</CamLayer>
			</AbsoluteFill>
			<AbsoluteFill style={{clipPath: RIGHT_CLIP}}>
				<CamLayer cam={cam} k={0.3}>
					<StormSea horizon={0.4} storm={storm} flash={flash.v} flashX={flash.x} />
				</CamLayer>
				{oldBg > 0 && (
					<CamLayer cam={cam} k={1} style={{opacity: oldBg}}>
						<OldWater />
					</CamLayer>
				)}
				<CamLayer cam={cam} k={0.35}>
					{BOLTS.map((b) => (
						<Lightning key={b.at} at={b.at} from={b.from as [number, number]} to={b.to as [number, number]} seed={`ep02-bolt-${b.at}`} />
					))}
				</CamLayer>
				<Rain opacity={interpolate(frame, [0, T.gPeak, T.gPeak + 20], [0.8, 1, 1], clamp)} />
			</AbsoluteFill>
		</>
	);
};

/** 火与水的分界线：对峙时噼啪颤动，爆发后变成翻腾的蒸汽带 */
const Seam: React.FC = () => {
	const frame = useFrame();
	const jitter = interpolate(frame, [T.tension[0], T.gPeak], [0, 9], {...clamp, easing: Easing.in(Easing.quad)}) +
		interpolate(frame, [T.build[0], T.build[1]], [0, 12], clamp);
	const N = 24;
	const pts = Array.from({length: N + 1}, (_, i) => {
		const k = i / N;
		const y = -40 + k * 1160;
		const x = SEAM_TOP + (SEAM_BOT - SEAM_TOP) * ((y - 0) / 1080);
		const j = i === 0 || i === N ? 0 : jitter * Math.sin(frame * 3.7 + i * 2.1) * Math.sin(frame * 1.3 + i * 0.7);
		return `${(x + j).toFixed(1)},${y.toFixed(1)}`;
	}).join(' ');
	const base = 0.3 + 0.2 * Math.abs(Math.sin(frame * 0.37)) * Math.abs(Math.sin(frame * 0.11));
	const burst = interpolate(frame, [T.gPeak - 1, T.gPeak + 1, T.gPeak + 40], [0, 1, 0.25], clamp);
	const build = interpolate(frame, [T.build[0], T.build[1]], [0, 0.8], clamp);
	const steam = Math.max(burst, interpolate(frame, [T.gPeak, T.gPeak + 40], [0, 0.25], clamp)) + build;
	const core = Math.min(1, base + interpolate(frame, [T.tension[0], T.gPeak], [0, 0.4], clamp) + burst + build);
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
			<defs>
				<filter id="steam" x="-50%" y="-10%" width="200%" height="120%">
					<feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves={3} seed={Math.floor(frame / 2)} />
					<feDisplacementMap in="SourceGraphic" scale={60} />
					<feGaussianBlur stdDeviation={14} />
				</filter>
			</defs>
			{steam > 0.01 && (
				<polyline points={pts} fill="none" stroke={`rgba(255,240,225,${Math.min(0.9, steam * 0.7)})`} strokeWidth={40 + 120 * steam} filter="url(#steam)" />
			)}
			<polyline points={pts} fill="none" stroke={`rgba(255,236,210,${core})`} strokeWidth={2 + 3 * burst + 2 * build} style={{filter: 'blur(1.5px)'}} />
		</svg>
	);
};

// ─── 宝可梦 ───────────────────────────────────────────────────────
// 上期剪影的外发光：只用立绘轮廓，显色后渐渐收掉
const SilhouetteGlow: React.FC<{src: string; x: number; y: number; size: number; rgb: string; glow: number; opacity: number}> = ({
	src,
	x,
	y,
	size,
	rgb,
	glow,
	opacity,
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

/** 显色过程：r 从 0 到 1（剪影 → 原色），over 为显色瞬间的过曝 */
const revealAt = (frame: number, peak: number) => ({
	r: interpolate(frame, [peak - 10, peak], [0, 1], {...clamp, easing: Easing.in(Easing.quad)}),
	over: interpolate(frame, [peak - 10, peak, peak + 34], [1, 1.6, 1], clamp),
	marks: interpolate(frame, [T.marks[0] + (peak - T.gPeak), T.marks[1] + (peak - T.gPeak), peak, peak + 40], [0, 1.5, 1.8, 0.3], clamp),
});

const Pokemon: React.FC<{cam: Cam}> = ({cam}) => {
	const frame = useFrame();
	const flash = flashAt(frame).v;
	const approach =
		25 +
		interpolate(frame, [T.gPeak, T.gPeak + 10, T.gPeak + 60], [0, -18, 0], clamp) + // 爆发时被冲击推开
		interpolate(frame, [T.build[0], T.build[1]], [0, 70], {...clamp, easing: Easing.in(Easing.quad)});
	// 两者的轮廓光交替起伏（延续上期的试探）
	const t = frame;
	const fireGlow = 0.85 + 0.35 * Math.sin(t * 0.16);
	const waterGlow = 0.85 + 0.35 * Math.sin(t * 0.16 + Math.PI);
	// 镜头横移时小幅转身，增强视差
	const camYaw = (cam.x - 960) * 0.12;

	const g = revealAt(frame, T.gPeak);
	const k = revealAt(frame, T.kPeak);
	const lavaHeat = 0.85 + 0.1 * Math.sin(frame * 0.37) + 0.05 * Math.sin(frame * 1.13 + 2);
	const silOut = (peak: number) => interpolate(frame, [peak - 4, peak + 30], [1, 0], clamp);

	const gx = 500 + approach;
	const kx = 1440 - approach;
	const ky = 560 + Math.sin(frame / 26) * 6;

	return (
		<>
			<SilhouetteGlow src={ART.groudon} x={gx} y={600} size={820} rgb={FIRE} glow={fireGlow} opacity={silOut(T.gPeak)} />
			<SilhouetteGlow src={ART.kyogre} x={kx} y={ky} size={800} rgb={WATER} glow={waterGlow} opacity={silOut(T.kPeak)} />
			<PokemonArt3D
				dir="pokemon/groudon"
				variant="-primal"
				x={gx}
				y={600}
				size={820}
				yaw={camYaw + interpolate(frame, [T.build[0], T.build[1]], [0, 4], clamp)}
				pitch={1.5}
				depthScale={0.5}
				brightness={g.over}
				ambient={[0.32 * g.r, 0.28 * g.r, 0.26 * g.r]}
				dirLights={[
					{dir: [-0.6, -0.8, 0.5], color: [0.65 * g.r, 0.54 * g.r, 0.42 * g.r], wrap: 0.2},
					// 对面风暴的闪电从右侧打来
					{dir: [1, -0.4, 0.2], color: [1.6 * flash * g.r, 1.8 * flash * g.r, 2.2 * flash * g.r], wrap: 0},
				]}
				pointLights={[{pos: [0.05, 0.8, 0.25], color: [2.4 * lavaHeat * g.r, 0.85 * lavaHeat * g.r, 0.22 * g.r], radius: 0.7}]}
				// 朝向海洋一侧的冷色轮廓光
				rim={{dir: [1, -0.15], color: [0.35 * g.r, 0.55 * g.r, 0.95 * g.r], power: 2.2}}
				emissive={g.marks}
				emissiveTint={[1.0, 0.72, 0.38]}
			/>
			<PokemonArt3D
				dir="pokemon/kyogre"
				variant="-primal"
				x={kx}
				y={ky}
				size={800}
				yaw={camYaw - interpolate(frame, [T.build[0], T.build[1]], [0, 4], clamp)}
				pitch={1.5 + Math.sin(frame / 26) * 0.8}
				depthScale={0.5}
				brightness={k.over}
				ambient={[0.28 * k.r, 0.32 * k.r, 0.4 * k.r]}
				dirLights={[
					{dir: [0.1, -1, 0.5], color: [0.45 * k.r, 0.52 * k.r, 0.66 * k.r], wrap: 0.25},
					{dir: [0.7, -0.6, 0.3], color: [2.0 * flash * k.r, 2.2 * flash * k.r, 2.7 * flash * k.r], wrap: 0},
				]}
				// 对面熔岩从左下方映过来
				pointLights={[{pos: [-0.75, 0.45, 0.3], color: [1.5 * lavaHeat * k.r, 0.5 * lavaHeat * k.r, 0.12 * k.r], radius: 0.6}]}
				rim={{dir: [-1, 0.2], color: [1.0 * k.r, 0.45 * k.r, 0.15 * k.r], power: 2.2}}
				emissive={k.marks}
				emissiveTint={[0.85, 1.0, 1.2]}
			/>
		</>
	);
};

/** 爆发白光：从分界线中心炸开 */
const BurstFlash: React.FC = () => {
	const frame = useFrame();
	const a = Math.max(
		interpolate(frame, [T.gPeak - 1, T.gPeak + 1, T.gPeak + 28], [0, 0.85, 0], clamp),
		interpolate(frame, [T.kPeak - 1, T.kPeak + 1, T.kPeak + 22], [0, 0.45, 0], clamp),
	);
	if (a <= 0) return null;
	return (
		<AbsoluteFill
			style={{
				background: `radial-gradient(ellipse 40% 90% at 50% 50%, rgba(255,248,235,${a}) 0%, rgba(255,230,200,${a * 0.6}) 40%, rgba(255,220,180,${a * 0.15}) 100%)`,
				mixBlendMode: 'screen',
			}}
		/>
	);
};

export const PrimalScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);
	const tagsOut = interpolate(frame, [T.build[0], T.build[0] + 20], [1, 0], clamp);
	const fadeIn = interpolate(frame, [T.fadeIn[0], T.fadeIn[1]], [1, 0], clamp);
	const white = interpolate(frame, [T.whiteOut[0], T.whiteOut[1] - 1], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});

	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			<Halves cam={cam} />
			<Seam />
			<CamLayer cam={cam} k={1}>
				<Pokemon cam={cam} />
			</CamLayer>
			<BurstFlash />
			<Vignette strength={0.55} />

			<NameTag
				from={T.tags}
				x={100}
				y={70}
				no="No.0383"
				zh="原始固拉多"
				en="PRIMAL GROUDON"
				category="大陆宝可梦"
				categoryEn="CONTINENT POKÉMON"
				opacity={tagsOut}
			/>
			<NameTag
				from={T.tags + 10}
				x={1820}
				y={70}
				align="right"
				no="No.0382"
				zh="原始盖欧卡"
				en="PRIMAL KYOGRE"
				category="海底宝可梦"
				categoryEn="SEA BASIN POKÉMON"
				opacity={tagsOut}
			/>

			<SubtitleBackdrop />
			{/* 旁白（制作者根据设定撰写）：依据《欧米伽红宝石·阿尔法蓝宝石》剧情与两条原始回归图鉴 */}
			<BiSubtitle
				from={T.subOpen[0]}
				to={T.subOpen[1]}
				zh="远古之时，世界充满了自然的能量。"
				en="In ancient times, the world overflowed with the energy of nature."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<BiSubtitle
				from={T.subG[0]}
				to={T.subG[1]}
				zh="借着这股力量，固拉多与盖欧卡恢复了原本的样子。"
				en="Drawing on that power, Groudon and Kyogre returned to their true, primal forms."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<BiSubtitle
				from={T.subK[0]}
				to={T.subK[1]}
				zh="一方能让熔岩喷涌、扩张大地，另一方能呼风唤雨、扩张海洋。"
				en="One could make magma erupt and spread the land; the other could summon storms and swell the seas."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>

			<Cry name="groudon-primal" at={T.gPeak} />
			<Cry name="kyogre-primal" at={T.kPeak} />
			<Grain />
			{fadeIn > 0 && <AbsoluteFill style={{background: '#000', opacity: fadeIn}} />}
			{white > 0 && <AbsoluteFill style={{background: '#fff8ec', opacity: white}} />}
		</AbsoluteFill>
	);
};
