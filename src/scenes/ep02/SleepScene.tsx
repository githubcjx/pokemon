import {AbsoluteFill, Easing, interpolate, Sequence} from 'remotion';
import {Cam} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer, Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Abyss, MagmaCave} from '../../components/Elements';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {ArtLighting, PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {toFrames, useFrame} from '../../time';
import {RAYQUAZA_SCENE_FRAMES, RayquazaFinale} from './RayquazaScene';

// ─── 第 2 期 · 第 4 段「沉睡」（540 帧 = 18 秒）──────────────────────────
// 接续平静的全景 → 烈空坐飞离 → 画面从正中竖着裂开，左沉地底、右沉海沟 → 沉睡 → 海沟铺满画面（交给下一段）
export const SLEEP_SCENE_FRAMES = 540;

const T = {
	rise: [0, 70] as const,
	seam: [50, 80] as const,
	descend: [74, 170] as const,
	subG: [176, 290] as const,
	subK: [300, 414] as const,
	subEnd: [424, 528] as const,
	close: [470, 540] as const,
};

// 上一段结尾两只在屏幕上的位置 / 尺寸（由上一段的镜头与景深层换算）
const FROM = {
	g: {x: 615.6, y: 805.7, size: 433},
	k: {x: 1314, y: 786, size: 423},
};
const TO = {
	g: {x: 480, y: 600, size: 780},
	k: {x: 1440, y: 560, size: 760},
};

const ease = Easing.inOut(Easing.cubic);

const useBreath = () => {
	const frame = useFrame();
	return 0.5 + 0.5 * Math.sin(((frame - T.descend[1]) / 120) * Math.PI * 2);
};

/** 一半画面里的地底 / 海沟背景：随镜头下沉从下方升起 */
const Underworld: React.FC<{side: 'left' | 'right'; cam: Cam}> = ({side, cam}) => {
	const frame = useFrame();
	const p = interpolate(frame, [T.descend[0], T.descend[1]], [0, 1], {
		...clamp,
		easing: ease,
	});
	const breath = useBreath();
	if (p <= 0) return null;
	return (
		<AbsoluteFill style={{transform: `translateY(${(1 - p) * 1150}px)`}}>
			{/* 地表与地底 / 海面与深海之间的过渡层，避免生硬的横向切边 */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: -420,
					height: 780,
					background:
						side === 'left'
							? // 接缝位于 54% 处，前后一段完全不透明
								'linear-gradient(180deg, rgba(40,26,18,0) 0%, rgba(40,24,14,1) 24%, rgba(18,9,5,1) 44%, rgba(14,7,4,1) 66%, rgba(14,7,4,0) 100%)'
							: 'linear-gradient(180deg, rgba(150,190,205,0) 0%, rgba(90,140,160,0.85) 18%, rgba(20,60,80,1) 42%, rgba(8,36,50,1) 66%, rgba(4,30,42,0) 100%)',
					zIndex: 1,
				}}
			/>
			<CamLayer cam={cam} k={0.3}>
				{side === 'left' ? (
					<>
						<MagmaCave centerX={0.25} pulse={breath} />
						<DustMotes rgb="255,140,60" opacity={0.8} />
					</>
				) : (
					<Abyss centerX={0.75} caustic={interpolate(frame, [T.descend[1], T.close[0]], [1, 0.35], clamp)} />
				)}
			</CamLayer>
		</AbsoluteFill>
	);
};

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const mix3 = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [
	mix(a[0], b[0], k),
	mix(a[1], b[1], k),
	mix(a[2], b[2], k),
];

const Sleeper: React.FC<{which: 'groudon' | 'kyogre'}> = ({which}) => {
	const frame = useFrame();
	const p = interpolate(frame, [T.descend[0], T.descend[1]], [0, 1], {
		...clamp,
		easing: ease,
	});
	const breath = useBreath();
	const s = interpolate(frame, [T.descend[0] + 30, T.descend[1] + 30], [0, 1], clamp); // 光照过渡到沉睡
	const sink = interpolate(frame, [T.descend[1], T.close[1]], [0, 24], clamp);
	const lava = 0.85 + 0.1 * Math.sin(frame * 0.37);

	const groudon: ArtLighting = {
		depthScale: 0.5,
		ambient: mix3([0.42, 0.36, 0.3], [0.05, 0.035, 0.03], s),
		dirLights: [
			{
				dir: [0.2, -1, 0.5],
				color: mix3([0.9, 0.75, 0.5], [0, 0, 0], s),
				wrap: 0.3,
			},
		],
		pointLights: [
			{
				pos: [0.05, 0.85, 0.3],
				color: mix3([0.36, 0.13, 0.03], [2.3 * (0.7 + 0.3 * breath), 0.72 * (0.7 + 0.3 * breath), 0.15], s),
				radius: 0.75,
			},
		],
		rim: {
			dir: [0.2, 1],
			color: mix3([0, 0, 0], [1.0 * (0.4 + 0.6 * breath), 0.38 * (0.4 + 0.6 * breath), 0.1], s),
			power: 2,
		},
		emissive: mix(0, 0.12 + 0.45 * breath, s),
		emissiveTint: [1.0, 0.65, 0.3],
	};
	const kyogre: ArtLighting = {
		depthScale: 0.5,
		ambient: mix3([0.4, 0.42, 0.44], [0.02, 0.035, 0.06], s),
		dirLights: [
			{
				dir: [0, -1, 0.4],
				color: mix3([0.95, 0.92, 0.86], [0.08, 0.2, 0.28], s),
				wrap: 0.3,
			},
		],
		rim: {
			dir: [0, -1],
			color: mix3([0, 0, 0], [0.18 * (0.4 + 0.6 * breath), 0.6 * (0.4 + 0.6 * breath), 0.72 * (0.4 + 0.6 * breath)], s),
			power: 2,
		},
		emissive: mix(0, 0.1 + 0.4 * breath, s),
		emissiveTint: [0.6, 1.0, 1.2],
	};
	const dimG = mix(0.7, 1, p);
	const dimK = mix(0.7, 1, p);

	return which === 'groudon' ? (
		<PokemonArt3D
			dir="pokemon/groudon"
			variant="-primal"
			x={mix(FROM.g.x, TO.g.x, p)}
			y={mix(FROM.g.y, TO.g.y, p) + sink}
			size={mix(FROM.g.size, TO.g.size, p)}
			yaw={mix(2, 4, p)}
			pitch={4}
			brightness={dimG}
			{...groudon}
		/>
	) : (
		<PokemonArt3D
			dir="pokemon/kyogre"
			variant="-primal"
			x={mix(FROM.k.x, TO.k.x, p)}
			y={mix(FROM.k.y, TO.k.y, p) + sink + Math.sin(frame / 40) * 5 * s}
			size={mix(FROM.k.size, TO.k.size, p)}
			yaw={mix(-2, -4, p)}
			pitch={4}
			brightness={dimK}
			{...kyogre}
		/>
	);
};

export const SleepScene: React.FC = () => {
	const frame = useFrame();
	const rise = interpolate(frame, [T.rise[0], T.rise[1]], [0, 1300], {
		...clamp,
		easing: Easing.in(Easing.cubic),
	});
	const down = interpolate(frame, [T.descend[0], T.descend[1]], [0, 1], {
		...clamp,
		easing: ease,
	});
	const cam: Cam = {
		x: 960,
		y: 540,
		zoom: interpolate(frame, [T.descend[1], T.close[0]], [1, 1.04], clamp),
		roll: 0,
	};

	// 收尾：左半边暗下去，海沟一侧向左铺满画面，盖欧卡移到正中
	const close = interpolate(frame, [T.close[0], T.close[1]], [0, 1], {
		...clamp,
		easing: ease,
	});
	const boundary = 960 * (1 - close);
	const shiftR = -(960 - boundary) / 2;
	const leftDark = interpolate(frame, [T.close[0] - 20, T.close[0] + 30], [0, 1], clamp);

	const seamDraw = interpolate(frame, [T.seam[0], T.seam[1]], [0, 1], {
		...clamp,
		easing: Easing.out(Easing.cubic),
	});
	const seamO = interpolate(frame, [T.seam[0], T.seam[1], T.close[0], T.close[1]], [0, 1, 0.8, 0], clamp);
	const seamPulse = 0.75 + 0.25 * Math.sin(frame * 0.08);
	const tail = down < 1;

	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			{/* 左半：地底 */}
			<AbsoluteFill
				style={{
					clipPath: `polygon(0 0, ${boundary}px 0, ${boundary}px 100%, 0 100%)`,
				}}
			>
				{tail && (
					<AbsoluteFill style={{transform: `translateY(${-down * 1150}px)`}}>
						<Sequence from={-toFrames(RAYQUAZA_SCENE_FRAMES)} layout="none">
							<RayquazaFinale rise={rise} hidePair />
						</Sequence>
					</AbsoluteFill>
				)}
				<Underworld side="left" cam={cam} />
			</AbsoluteFill>
			{/* 右半：海沟 */}
			<AbsoluteFill
				style={{
					clipPath: `polygon(${boundary}px 0, 100% 0, 100% 100%, ${boundary}px 100%)`,
				}}
			>
				<AbsoluteFill style={{transform: `translateX(${shiftR}px)`}}>
					{tail && (
						<AbsoluteFill style={{transform: `translateY(${-down * 1150}px)`}}>
							<Sequence from={-toFrames(RAYQUAZA_SCENE_FRAMES)} layout="none">
								<RayquazaFinale rise={rise} hidePair />
							</Sequence>
						</AbsoluteFill>
					)}
					<Underworld side="right" cam={cam} />
				</AbsoluteFill>
			</AbsoluteFill>

			{/* 两只跟着镜头一起下沉 */}
			<CamLayer cam={cam} k={1}>
				<AbsoluteFill
					style={{
						clipPath: `polygon(0 0, ${boundary}px 0, ${boundary}px 100%, 0 100%)`,
						opacity: 1 - leftDark,
					}}
				>
					<Sleeper which="groudon" />
				</AbsoluteFill>
				<AbsoluteFill
					style={{
						clipPath: `polygon(${boundary}px 0, 100% 0, 100% 100%, ${boundary}px 100%)`,
					}}
				>
					<AbsoluteFill style={{transform: `translateX(${shiftR}px)`}}>
						<Sleeper which="kyogre" />
					</AbsoluteFill>
				</AbsoluteFill>
			</CamLayer>

			{/* 左半边暗场 */}
			{leftDark > 0 && (
				<AbsoluteFill
					style={{
						clipPath: `polygon(0 0, ${boundary}px 0, ${boundary}px 100%, 0 100%)`,
						background: `rgba(0,0,0,${leftDark * 0.85})`,
					}}
				/>
			)}

			{/* 正中的金线：由上往下描出 */}
			{seamO > 0 && (
				<div
					style={{
						position: 'absolute',
						left: boundary - 1.5,
						top: 0,
						width: 3,
						height: 1080 * seamDraw,
						opacity: seamO * seamPulse,
						background: 'linear-gradient(180deg, rgba(255,240,200,0.95), rgba(230,196,122,0.85))',
						boxShadow: '0 0 12px rgba(255,210,140,0.9), 0 0 36px rgba(255,190,110,0.5)',
					}}
				/>
			)}
			<Vignette strength={0.6} />

			<SubtitleBackdrop />
			{/* 旁白（制作者根据设定撰写）：沉睡依据《钻石·珍珠》图鉴——固拉多睡在地下岩浆里、盖欧卡睡在海沟底部 */}
			<BiSubtitle
				from={T.subG[0]}
				to={T.subG[1]}
				zh="力量耗尽的固拉多，沉入了地底深处的岩浆。"
				en="Its power spent, Groudon sank into the magma deep beneath the earth."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<BiSubtitle
				from={T.subK[0]}
				to={T.subK[1]}
				zh="盖欧卡则退回海沟的最深处，陷入了长眠。"
				en="Kyogre withdrew to the depths of an ocean trench, and fell into a long sleep."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<BiSubtitle
				from={T.subEnd[0]}
				to={T.subEnd[1]}
				zh="大地与海洋，终于归于平静。"
				en="At last, land and sea fell still."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<Grain />
		</AbsoluteFill>
	);
};
