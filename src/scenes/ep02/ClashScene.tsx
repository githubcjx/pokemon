import {AbsoluteFill, Easing, Img, interpolate, staticFile} from 'remotion';
import {Cam, shake, track} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer, Vignette} from '../../components/CamLayer';
import {Coast, CoastProps} from '../../components/Elements';
import {Impact} from '../../components/effects/Impact';
import {Lightning} from '../../components/effects/Lightning';
import {Rain} from '../../components/effects/Rain';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {ArtLighting, PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// ─── 第 2 期 · 第 2 段「大地与海洋」（750 帧 = 25 秒）──────────────────────
// 海岸线航拍：大地推进 → 海洋反扑 → 烈日 / 暴雨交替快切 → 正面对撞 → 战局失控（交给下一段）
export const CLASH_SCENE_FRAMES = 750;

const T = {
	whiteIn: [0, 22] as const,
	land: [0, 210] as const,
	sea: [210, 390] as const,
	cuts: [390, 570] as const,
	faceOff: [570, 604] as const,
	impact: 640,
	subG: [40, 186] as const,
	subK: [228, 372] as const,
	subN: [398, 562] as const,
};

const ART = {
	groudon: staticFile('pokemon/groudon/art-primal.png'),
	kyogre: staticFile('pokemon/kyogre/art-primal.png'),
};

// 快切：烈日（固拉多）与暴雨（盖欧卡）交替，越切越快
const CUT_LENGTHS = [36, 32, 28, 24, 20, 16, 14, 10];
const CUTS = CUT_LENGTHS.reduce<{from: number; to: number; kind: 'sun' | 'rain'; i: number}[]>((acc, len, i) => {
	const from = i === 0 ? T.cuts[0] : acc[i - 1].to;
	acc.push({from, to: from + len, kind: i % 2 === 0 ? 'sun' : 'rain', i});
	return acc;
}, []);

// 闪电：航拍段、暴雨快切、对撞后的混乱
const BOLTS = [
	{at: 262, from: [1500, -60], to: [1420, 520], x: 0.74},
	{at: 330, from: [1760, -60], to: [1830, 560], x: 0.9},
	...CUTS.filter((c) => c.kind === 'rain').map((c, i) => ({at: c.from + 2, from: [1300 + i * 140, -60], to: [1200 + i * 160, 620], x: 0.65 + i * 0.07})),
	{at: 588, from: [1640, -60], to: [1560, 480], x: 0.82},
	{at: 668, from: [1380, -60], to: [1300, 560], x: 0.68},
	{at: 690, from: [1780, -60], to: [1860, 520], x: 0.92},
	{at: 712, from: [560, -60], to: [640, 520], x: 0.3},
	{at: 731, from: [1500, -60], to: [1420, 600], x: 0.76},
	{at: 744, from: [1180, -60], to: [1080, 500], x: 0.6},
] as {at: number; from: [number, number]; to: [number, number]; x: number}[];

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

const Bolts: React.FC<{only?: (at: number) => boolean}> = ({only = () => true}) => (
	<>
		{BOLTS.filter((b) => only(b.at)).map((b) => (
			<Lightning key={b.at} at={b.at} from={b.from} to={b.to} seed={`ep02c-${b.at}`} />
		))}
	</>
);

// ─── 光照预设 ─────────────────────────────────────────────────────
const lavaFlicker = (f: number) => 0.85 + 0.1 * Math.sin(f * 0.37) + 0.05 * Math.sin(f * 1.13 + 2);

const groudonLight = (f: number, flash: number, sun: number): ArtLighting => {
	const lava = lavaFlicker(f);
	return {
		depthScale: 0.5,
		ambient: [0.32 + 0.15 * sun, 0.28 + 0.12 * sun, 0.26 + 0.06 * sun],
		dirLights: [
			{dir: [-0.5, -0.85, 0.45], color: [0.65 + 0.9 * sun, 0.54 + 0.75 * sun, 0.42 + 0.45 * sun], wrap: 0.15},
			{dir: [1, -0.4, 0.2], color: [1.6 * flash, 1.8 * flash, 2.2 * flash], wrap: 0},
		],
		pointLights: [{pos: [0.05, 0.8, 0.25], color: [2.4 * lava, 0.85 * lava, 0.22], radius: 0.7}],
		rim: {dir: [1, -0.15], color: [0.35, 0.55, 0.95], power: 2.2},
		emissive: 0.3,
		emissiveTint: [1.0, 0.72, 0.38],
	};
};

const kyogreLight = (f: number, flash: number, rain: number): ArtLighting => {
	const lava = lavaFlicker(f);
	return {
		depthScale: 0.5,
		ambient: [0.28 - 0.06 * rain, 0.32 - 0.05 * rain, 0.4],
		dirLights: [
			{dir: [0.1, -1, 0.5], color: [0.45, 0.52, 0.66], wrap: 0.25},
			{dir: [0.7, -0.6, 0.3], color: [2.2 * flash, 2.4 * flash, 2.9 * flash], wrap: 0},
		],
		pointLights: [{pos: [-0.75, 0.45, 0.3], color: [1.5 * lava * (1 - rain * 0.6), 0.5 * lava * (1 - rain * 0.6), 0.12], radius: 0.6}],
		rim: {dir: [-1, 0.2], color: [1.0 * (1 - rain * 0.5), 0.45 * (1 - rain * 0.5), 0.15], power: 2.2},
		emissive: 0.3 + 0.3 * rain,
		emissiveTint: [0.85, 1.0, 1.2],
	};
};

// ─── 镜头 1：海岸线航拍（大地推进 → 海洋反扑）───────────────────────────
const AerialShot: React.FC = () => {
	const frame = useFrame();
	const flash = flashAt(frame);
	const cam: Cam = {
		x: track(frame, [
			[0, 900],
			[T.land[1], 860],
			[T.sea[1], 1060],
		]),
		y: 540,
		zoom: track(frame, [
			[0, 1.12],
			[T.land[1], 1.02],
			[T.sea[1], 1.08],
		]),
		roll: track(frame, [
			[0, -1.2],
			[T.land[1], 0],
			[T.sea[1], 1.2],
		]),
	};
	const coast: CoastProps = {
		front: track(frame, [
			[0, -3],
			[T.land[1], 4.5, Easing.inOut(Easing.cubic)],
			[T.sea[1], -5, Easing.inOut(Easing.cubic)],
		]),
		scroll: track(frame, [
			[0, -1],
			[T.land[1], 1],
			[T.sea[1], -1],
		]),
		dolly: frame * 0.05,
		sun: interpolate(frame, [0, 120, T.sea[0] + 20, T.sea[0] + 60], [0.15, 0.35, 0.35, 0], clamp),
		rain: interpolate(frame, [T.sea[0], T.sea[0] + 50], [0, 0.6], clamp),
		heat: interpolate(frame, [0, T.land[1], T.sea[1]], [1.0, 1.3, 0.9], clamp),
		storm: interpolate(frame, [0, T.sea[0], T.sea[1]], [0.8, 0.9, 1.4], clamp),
		clash: 0.9,
		flash: flash.v,
		flashX: flash.x,
	};

	// 固拉多从左下入画，海洋反扑时被镜头甩出画面；盖欧卡随浪从右下涌入
	const gIn = interpolate(frame, [12, 80], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const gOut = interpolate(frame, [T.sea[0], T.sea[0] + 50], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	const kIn = interpolate(frame, [T.sea[0] + 8, T.sea[0] + 70], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const gx = 260 + 300 * gIn - 700 * gOut;
	const gy = 960 - 260 * gIn;
	const kx = 1760 - 380 * kIn;
	const ky = 940 - 290 * kIn + Math.sin(frame / 24) * 8;
	const yaw = (cam.x - 960) * 0.06;

	return (
		<AbsoluteFill>
			<CamLayer cam={cam} k={0.3}>
				<Coast {...coast} />
			</CamLayer>
			<CamLayer cam={cam} k={0.35}>
				<Bolts only={(at) => at < T.cuts[0]} />
			</CamLayer>
			<CamLayer cam={cam} k={1}>
				{gOut < 1 && (
					<PokemonArt3D dir="pokemon/groudon" variant="-primal" x={gx} y={gy} size={880} yaw={yaw + 3} pitch={2} {...groudonLight(frame, flash.v, coast.sun ?? 0)} />
				)}
				{kIn > 0 && (
					<PokemonArt3D dir="pokemon/kyogre" variant="-primal" x={kx} y={ky} size={880} yaw={yaw - 3} pitch={2} {...kyogreLight(frame, flash.v, coast.rain ?? 0)} />
				)}
			</CamLayer>
			<Rain opacity={interpolate(frame, [T.sea[0], T.sea[0] + 40], [0, 0.85], clamp)} />
		</AbsoluteFill>
	);
};

// ─── 镜头 2：烈日 / 暴雨交替快切（大特写）────────────────────────────────
const CloseCut: React.FC<{cut: (typeof CUTS)[number]}> = ({cut}) => {
	const frame = useFrame();
	const t = frame - cut.from;
	const len = cut.to - cut.from;
	const s = shake(frame, cut.from, 10, 12);
	const sun = cut.kind === 'sun';
	const cam: Cam = {
		x: 960 + s.x + (sun ? -1 : 1) * t * 0.8,
		y: 540 + s.y,
		zoom: interpolate(t, [0, len], [1.0, 1.07], clamp),
		roll: s.roll + (sun ? -1.5 : 1.5),
	};
	const flash = flashAt(frame);
	const coast: CoastProps = sun
		? {front: 9, scroll: 4 + cut.i, dolly: 40 + frame * 0.08, sun: 1, rain: 0, heat: 1.5, storm: 0.6, clash: 0.6}
		: {front: -9, scroll: -4 - cut.i, dolly: 60 + frame * 0.08, sun: 0, rain: 1, heat: 0.8, storm: 1.6, clash: 0.6, flash: flash.v, flashX: flash.x};
	return (
		<AbsoluteFill>
			<CamLayer cam={cam} k={0.3}>
				<Coast {...coast} />
			</CamLayer>
			{sun ? (
				// 灼目的烈日：左上方的强光晕
				<AbsoluteFill style={{background: 'radial-gradient(circle at 18% 8%, rgba(255,245,215,0.85) 0%, rgba(255,200,120,0.35) 18%, transparent 45%)', mixBlendMode: 'screen'}} />
			) : (
				<CamLayer cam={cam} k={0.35}>
					<Bolts only={(at) => at >= cut.from && at < cut.to} />
				</CamLayer>
			)}
			<CamLayer cam={cam} k={1}>
				{sun ? (
					<PokemonArt3D dir="pokemon/groudon" variant="-primal" x={760} y={700} size={1550} yaw={4} pitch={3} {...groudonLight(frame, 0, 1)} />
				) : (
					<PokemonArt3D dir="pokemon/kyogre" variant="-primal" x={1180} y={600} size={1550} yaw={-4} pitch={2} {...kyogreLight(frame, flash.v, 1)} />
				)}
			</CamLayer>
			{!sun && <Rain opacity={1} />}
			{/* 热浪 / 暴雨的整体色偏 */}
			<AbsoluteFill style={{background: sun ? 'rgba(255,170,80,0.10)' : 'rgba(40,70,120,0.16)', mixBlendMode: sun ? 'screen' : 'multiply'}} />
		</AbsoluteFill>
	);
};

// ─── 镜头 3：对撞与失控 ──────────────────────────────────────────────
export const ClashShot: React.FC = () => {
	const frame = useFrame();
	const flash = flashAt(frame);
	const s1 = shake(frame, T.impact, 34, 44);
	const rumble = interpolate(frame, [T.impact + 20, CLASH_SCENE_FRAMES], [2, 6], clamp) * (frame > T.impact ? 1 : 0);
	const cam: Cam = {
		x: 960 + s1.x + rumble * Math.sin(frame * 2.3),
		y: 560 + s1.y + rumble * Math.cos(frame * 2.9),
		zoom: track(frame, [
			[T.cuts[1], 1.0],
			[T.impact - 1, 1.1, Easing.in(Easing.cubic)],
			[T.impact + 6, 1.38, Easing.out(Easing.cubic)],
			[T.impact + 50, 1.12],
			[CLASH_SCENE_FRAMES, 1.2],
		]),
		roll: s1.roll,
	};
	const chaos = interpolate(frame, [T.impact, CLASH_SCENE_FRAMES], [0, 1], clamp);
	const coast: CoastProps = {
		front: Math.sin(frame * 0.05) * 0.6,
		scroll: 0,
		dolly: 90 + frame * 0.03,
		sun: 0.25,
		rain: 0.4 + 0.3 * chaos,
		heat: 1.2 + 0.4 * chaos,
		storm: 1.2 + 0.5 * chaos,
		clash: interpolate(frame, [T.cuts[1], T.impact, T.impact + 10], [0.8, 0.9, 1.6], clamp),
		flash: Math.max(flash.v, interpolate(frame, [T.impact, T.impact + 20], [1, 0], clamp)),
		flashX: frame >= T.impact && frame < T.impact + 20 ? 0.5 : flash.x,
	};
	// 冲锋：缓起急停；对撞后被震开，再相互角力
	const charge = interpolate(frame, [T.faceOff[1], T.impact], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	const recoil = interpolate(frame, [T.impact, T.impact + 14, T.impact + 40], [0, 1, 0.8], {...clamp, easing: Easing.out(Easing.cubic)});
	const strain = frame > T.impact + 40 ? Math.sin((frame - T.impact) * 0.25) * 10 : 0;
	const crouch = interpolate(frame, [T.faceOff[0], T.faceOff[1]], [0, 1], clamp);
	const gx = 360 + 470 * charge - 290 * recoil + strain;
	const kx = 1560 - 470 * charge + 290 * recoil - strain;
	const gy = 730 + 14 * crouch * (1 - charge);
	const ky = 690 + Math.sin(frame / 22) * 6;
	const brightPeak = interpolate(frame, [T.impact - 2, T.impact, T.impact + 24], [1, 1.5, 1], clamp);

	// 冲锋时的残影（平面立绘，低透明度）
	const trail = (src: string, x: number, y: number, dir: number, size: number) =>
		charge > 0.1 && charge < 1
			? [1, 2, 3].map((k) => (
					<Img
						key={k}
						src={src}
						style={{
							position: 'absolute',
							left: x - dir * k * 60 * charge - size / 2,
							top: y - size / 2,
							width: size,
							height: size,
							opacity: 0.22 / k,
							filter: 'blur(6px) brightness(1.3)',
						}}
					/>
				))
			: null;

	const whiteFlash = interpolate(frame, [T.impact - 1, T.impact + 1, T.impact + 30], [0, 0.92, 0], clamp);

	return (
		<AbsoluteFill>
			<CamLayer cam={cam} k={0.3}>
				<Coast {...coast} />
			</CamLayer>
			<CamLayer cam={cam} k={0.35}>
				<Bolts only={(at) => at >= T.cuts[1]} />
			</CamLayer>
			<CamLayer cam={cam} k={1}>
				{trail(ART.groudon, gx, gy, 1, 660)}
				{trail(ART.kyogre, kx, ky, -1, 640)}
				<PokemonArt3D
					dir="pokemon/groudon"
					variant="-primal"
					x={gx}
					y={gy}
					size={660}
					yaw={4 * charge - 3 * recoil}
					pitch={2}
					brightness={brightPeak}
					{...groudonLight(frame, Math.max(flash.v, whiteFlash), 0.25)}
				/>
				<PokemonArt3D
					dir="pokemon/kyogre"
					variant="-primal"
					x={kx}
					y={ky}
					size={640}
					yaw={-4 * charge + 3 * recoil}
					pitch={2}
					brightness={brightPeak}
					{...kyogreLight(frame, Math.max(flash.v, whiteFlash), 0.6)}
				/>
				<Impact at={T.impact} x={960} y={720} scale={1.2} />
			</CamLayer>
			<Rain opacity={0.7 + 0.3 * chaos} />
			{whiteFlash > 0 && (
				<AbsoluteFill
					style={{
						background: `radial-gradient(ellipse 60% 70% at 50% 62%, rgba(255,250,240,${whiteFlash}) 0%, rgba(255,235,205,${whiteFlash * 0.7}) 45%, rgba(255,225,190,${whiteFlash * 0.35}) 100%)`,
					}}
				/>
			)}
		</AbsoluteFill>
	);
};

export const ClashScene: React.FC = () => {
	const frame = useFrame();
	const cut = CUTS.find((c) => frame >= c.from && frame < c.to);
	const white = interpolate(frame, [T.whiteIn[0], T.whiteIn[1]], [1, 0], {...clamp, easing: Easing.out(Easing.quad)});

	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			{frame < T.cuts[0] && <AerialShot />}
			{cut && <CloseCut cut={cut} />}
			{frame >= T.cuts[1] && <ClashShot />}
			<Vignette strength={0.55} />

			<SubtitleBackdrop />
			{/* 旁白（制作者根据设定撰写）：依据固拉多 / 盖欧卡《X》图鉴与《欧米伽红宝石·阿尔法蓝宝石》图鉴 */}
			<BiSubtitle
				from={T.subG[0]}
				to={T.subG[1]}
				zh="大地向前推进，熔岩所到之处，海水尽数蒸发。"
				en="The land pushed forward; wherever the magma flowed, the sea boiled away."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<BiSubtitle
				from={T.subK[0]}
				to={T.subK[1]}
				zh="海洋随即反扑，暴雨与巨浪又将大地吞没。"
				en="Then the sea struck back, drowning the land beneath torrential rain and towering waves."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<BiSubtitle
				from={T.subN[0]}
				to={T.subN[1]}
				zh="为了争夺自然的能量，双方的争斗无休无止，人们只能束手无策。"
				en="Each fighting to claim the power of nature, their battle raged without end, and people could only watch, powerless."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<Grain />
			{white > 0 && <AbsoluteFill style={{background: '#fff8ec', opacity: white}} />}
		</AbsoluteFill>
	);
};
