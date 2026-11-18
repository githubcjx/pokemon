import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {flow} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {Seal} from '../../components/ink/Seal';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {PAGODA_TOP} from '../../three/pagodaGeometry';
import {projectToScreen, V3} from '../../three/stage';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {BELL_TOWER, lookFrom, NightField} from './NightField';
import {pxPerUnit} from './RebirthScene';
import {getWaitCamera, WAIT_SCENE_FRAMES, waitCorona, waitWarmCore} from './WaitScene';

// ─── 第 7 段《降临》（900 帧 = 30 秒，今·破晓，全片收尾）──────────────────────────
// 接第 6 段最后一帧（月亮、七色月晕、东塔）：东边的天慢慢亮起，月晕褪去（字幕一：心灵相通时，虹色的宝可梦从天而降）
// → 镜头仰起迎接、再随凤王一同落下；凤王拖着七色的光从天而降，墨影 → 水墨画 → 淡彩（不放叫声：用户 2026-10-02 要求）
// → 第一缕阳光恰好照亮东塔塔顶，凤王落在被照亮的塔顶上空，身上带着日出方向的暖色轮廓光
// → 画面完全静止，再出字幕二（水晶·三贤人对主角的原话）：你，就是传说宝可梦所等待的那个人吗？
// → 晨光中浮现本期标题《看不见的信任》，淡出收尾
export const DESCEND_SCENE_FRAMES = 900;

const T = {
	dawn: [0, 260] as const,
	sub1: [40, 210] as const,
	hoSil: [215, 262] as const,
	hoReveal: [255, 305] as const,
	hoTint: [285, 340] as const,
	descend: [215, 400] as const,
	sunTop: [300, 385] as const,
	/** 此后镜头完全静止 */
	still: 420,
	sub2: [452, 592] as const,
	title: 612,
	titleEn: 678,
	seal: 706,
	out: [852, 900] as const,
};

const W = WAIT_SCENE_FRAMES;
const HOOH_SIZE = 18;

const getCamera = (f: number) => {
	const start = getWaitCamera(W);
	// 先仰起迎接凤王，再随它一同落下；T.still 之后完全静止
	const yaw = flow(f, [
		[0, start.yaw],
		[300, -195],
		[T.still, -196.5],
	]);
	const pitch = flow(f, [
		[0, start.pitch],
		[170, 16],
		[250, 23],
		[T.still, 19.5],
	]);
	const fov = flow(f, [
		[0, start.fov],
		[250, 33],
		[T.still, 30],
	]);
	return lookFrom(start.pos, yaw, pitch, fov);
};

const TITLE = '看不见的信任';
const TITLE_X = 560;
const TITLE_Y = 610;

export const DescendScene: React.FC = () => {
	const f = useFrame();
	const fw = W + f; // 接着第 6 段的时间
	const cam = getCamera(f);
	const {pos, target, fov} = cam;

	const dawn = interpolate(f, T.dawn, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});

	// 凤王：自天而降，悬停在东塔塔顶上空
	const descend = interpolate(f, T.descend, [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const hoWorld: V3 = [BELL_TOWER[0], PAGODA_TOP + 14 + (1 - descend) * 45 + Math.sin(f / 40) * 0.35, BELL_TOWER[2]];
	const ho = projectToScreen(pos, target, fov, hoWorld);
	const hoSize = HOOH_SIZE * pxPerUnit(pos, hoWorld, fov);
	const hoIn = interpolate(f, [T.hoSil[0], T.hoSil[0] + 24], [0, 1], clamp);
	const hoSil = interpolate(f, T.hoSil, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const hoReveal = interpolate(f, T.hoReveal, [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const hoTint = interpolate(f, T.hoTint, [0, 0.38], {...clamp, easing: Easing.inOut(Easing.sin)});
	const hoSettled = interpolate(f, [T.hoReveal[0] + 20, T.hoReveal[1] + 20], [0, 1], clamp);
	const hoGlow = interpolate(f, [T.hoSil[0], T.descend[1], T.descend[1] + 80], [0, 0.85, 0.6], clamp);

	// 七色的光：凤王身后拖出的一道虹光，降落后慢慢散去
	const trailO = interpolate(f, [T.hoSil[0], T.hoSil[0] + 30, T.descend[1], T.descend[1] + 90], [0, 0.75, 0.55, 0], clamp);
	// 塔顶被照亮
	const top = projectToScreen(pos, target, fov, [BELL_TOWER[0], PAGODA_TOP, BELL_TOWER[2]]);
	const sunTop = interpolate(f, T.sunTop, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const sunDrop = interpolate(f, [T.sunTop[1], 900], [0, 0.6], {...clamp, easing: Easing.inOut(Easing.sin)});
	const topGlow = sunTop;

	const outO = interpolate(f, T.out, [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const titleOut = interpolate(f, [T.out[0] - 10, T.out[1] - 8], [1, 0], clamp);

	return (
		<AbsoluteFill style={{background: '#0d0b09', overflow: 'hidden'}}>
			<NightField f={fw} cam={cam} corona={waitCorona(fw)} warmCore={waitWarmCore(fw)} grassO={1} dawn={dawn} sunTop={sunTop} sunDrop={sunDrop} />

			{/* 塔顶的金光 */}
			{topGlow > 0 ? (
				<AbsoluteFill
					style={{
						opacity: topGlow * 0.9,
						mixBlendMode: 'screen',
						background: `radial-gradient(ellipse ${hoSize * 0.9}px ${hoSize * 1.2}px at ${top.x}px ${top.y}px, rgba(255,222,150,0.7) 0px, rgba(255,190,110,0.25) ${hoSize * 0.5}px, transparent ${hoSize * 1.1}px)`,
					}}
				/>
			) : null}

			{/* 七色的光 */}
			{trailO > 0 ? (
				<svg width={1920} height={1080} style={{position: 'absolute', opacity: trailO, mixBlendMode: 'screen'}}>
					<defs>
						<linearGradient id="hoTrailC" x1="0" y1="0" x2="1" y2="0">
							{['#e86a5a', '#f2a65a', '#f5d66b', '#8fd18a', '#7fb6ea', '#8d8ce0', '#b98ad8'].map((c, i) => (
								<stop key={c} offset={i / 6} stopColor={c} />
							))}
						</linearGradient>
						<linearGradient id="hoTrailM" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0" stopColor="#fff" stopOpacity={0} />
							<stop offset="0.7" stopColor="#fff" stopOpacity={0.8} />
							<stop offset="1" stopColor="#fff" stopOpacity={0} />
						</linearGradient>
						<mask id="hoTrailMask" maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}>
							<rect x={ho.x - hoSize * 0.2} y={-200} width={hoSize * 0.4} height={ho.y + 200} fill="url(#hoTrailM)" />
						</mask>
						<filter id="hoTrailBlur">
							<feGaussianBlur stdDeviation={14} />
						</filter>
					</defs>
					<g filter="url(#hoTrailBlur)">
						<rect x={ho.x - hoSize * 0.2} y={-200} width={hoSize * 0.4} height={ho.y + 200} fill="url(#hoTrailC)" mask="url(#hoTrailMask)" opacity={0.6} />
					</g>
				</svg>
			) : null}

			{/* 凤王身后的金光与虹晕（同第 4 段） */}
			{hoGlow > 0.005 ? (
				<>
					<AbsoluteFill
						style={{
							opacity: hoGlow,
							mixBlendMode: 'screen',
							background: `radial-gradient(circle at ${ho.x}px ${ho.y}px, rgba(255,236,190,0.85) 0px, rgba(255,214,140,0.35) ${hoSize * 0.38}px, transparent ${hoSize * 0.85}px)`,
						}}
					/>
					<AbsoluteFill
						style={{
							opacity: hoGlow * 0.6,
							background: `radial-gradient(circle at ${ho.x}px ${ho.y}px, transparent ${hoSize * 0.5}px, rgba(255,110,90,0.22) ${hoSize * 0.53}px, rgba(255,200,90,0.22) ${hoSize * 0.56}px, rgba(140,210,120,0.18) ${hoSize * 0.59}px, rgba(110,170,240,0.16) ${hoSize * 0.62}px, rgba(170,120,230,0.13) ${hoSize * 0.65}px, transparent ${hoSize * 0.69}px)`,
						}}
					/>
				</>
			) : null}

			{/* 凤王（水墨画，不放叫声） */}
			{hoIn > 0 ? (
				<PokemonArt3D
					dir="pokemon/ho-oh"
					x={ho.x}
					y={ho.y}
					size={hoSize}
					yaw={-2 + Math.sin(f / 70) * 1.5}
					pitch={-4}
					opacity={hoIn}
					resolution={1.4}
					rim={{dir: [1, -0.25], color: [1.1 * sunTop, 0.82 * sunTop, 0.5 * sunTop], power: 2.5}}
					ink={{
						silhouette: hoSil,
						reveal: hoReveal,
						paint: 1,
						color: hoTint,
						line: 0.85 * hoSettled,
						halo: hoSil * (1 - 0.3 * hoSettled),
						wash: 0.7 * hoSettled,
						time: f / 30,
						center: [0.5, 0.42],
					}}
				/>
			) : null}

			<SubtitleBackdrop />

			{/* 本期标题 */}
			{f >= T.title ? (
				<AbsoluteFill style={{opacity: titleOut}}>
					<div style={{position: 'absolute', left: TITLE_X - 960, width: 1920, top: TITLE_Y, display: 'flex', justifyContent: 'center', gap: 6}}>
						{TITLE.split('').map((ch, i) => {
							const v = interpolate(f, [T.title + i * 9, T.title + i * 9 + 28], [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
							return (
								<span
									key={i}
									style={{
										fontFamily: SERIF,
										fontSize: 104,
										fontWeight: 700,
										letterSpacing: 18,
										color: '#fbf3e2',
										opacity: v,
										filter: `blur(${(1 - v) * 8}px)`,
										transform: `translateY(${(1 - v) * 10}px)`,
										textShadow: '0 0 14px rgba(120,70,30,0.55), 0 0 40px rgba(110,60,30,0.35), 0 2px 6px rgba(60,30,10,0.6)',
									}}
								>
									{ch}
								</span>
							);
						})}
					</div>
					<div
						style={{
							position: 'absolute',
							left: TITLE_X - 960,
							width: 1920,
							top: TITLE_Y + 156,
							textAlign: 'center',
							fontFamily: CINZEL,
							fontSize: 30,
							letterSpacing: 10,
							color: 'rgba(252,244,228,0.92)',
							textShadow: '0 0 12px rgba(120,70,30,0.5), 0 1px 4px rgba(60,30,10,0.6)',
							opacity: interpolate(f, [T.titleEn, T.titleEn + 30], [0, 1], clamp),
						}}
					>
						THE INVISIBLE TRUST
					</div>
					<Seal from={T.seal} x={TITLE_X + 435} y={TITLE_Y + 72} text="缘朱" size={78} seed={11} blend="normal" />
				</AbsoluteFill>
			) : null}

			{/* 旁白（制作者撰写）：依据水晶·铃铛塔 1F 僧侣 "According to legend… When the souls of #MON and humans commune, from the heavens descends a #MON of rainbow colors…" */}
			<BiSubtitle
				from={T.sub1[0]}
				to={T.sub1[1]}
				zh="传说，当宝可梦与人的心灵相通，虹色的宝可梦就会从天而降。"
				en="Legend has it that when the souls of Pokémon and people commune, a Pokémon of rainbow colors descends from the heavens."
				source={{zh: '旁白（依据水晶·铃铛塔）', en: 'NARRATION (after CRYSTAL · Tin Tower)'}}
			/>
			{/* 旁白（制作者撰写）：依据水晶·三贤人对主角说的 "You… Are you the trainer who is awaited by the legendary #MON?" */}
			<BiSubtitle
				from={T.sub2[0]}
				to={T.sub2[1]}
				zh="你，就是传说宝可梦所等待的那个人吗？"
				en="Are you the one the legendary Pokémon have been waiting for?"
				source={{zh: '旁白（依据水晶·三贤人）', en: 'NARRATION (after CRYSTAL · Wise Trio)'}}
			/>

			{/* 收尾：整体淡入暗场 */}
			<AbsoluteFill style={{background: '#0d0b09', opacity: outO}} />
			<Grain opacity={0.1 - 0.05 * dawn} />
		</AbsoluteFill>
	);
};
