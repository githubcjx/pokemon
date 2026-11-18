import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Grain} from '../../components/Grain';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {CODA_SCENE_FRAMES, SEG_START, globalTime} from './continuity';
import {GhetsisEnd} from './FusionScene';
import {IceCave} from './HuskScene';
import {ACCENT, DragonArt, DragonVoid, ElementBg, HeroFigure} from './Mono';
import {ArtFigure} from './People';

export {CODA_SCENE_FRAMES};

/**
 * 第 8 段《尾声》（20 秒）：
 * 过渡（用户 2026-10-04 选定）：冰窟里静了一会儿，酋雷姆化进冰雾消失（游戏里战后它从洞窟消失）→
 * 镜头升出巨人洞窟、升到合众的夜空（"它失去的身体，依然没有找回来"）→
 * 左：远古的双子英雄（对峙，暖 / 蓝逆光）；右：魁奇思的剪影 ——"把它撕开的是人，把它强行合上的也是人" →
 * 一条龙的空洞重新出现，三只龙的剪影环绕（呼应开场）——"可真实与理想，本不必对立" →
 * 停在这个画面上淡出（标题已放在开头，结尾不放标题、不列来源、不做下期预告）。
 */

// 巨人洞窟的崖口：两侧岩壁高、中间低的 V 形（dy 为整体下移，bottom 为岩壁填到哪里为止，不能盖住下面的冰窟）
const CRATER = (dy: number, bottom: number) => {
	const pts: [number, number][] = [
		[-20, 600], [110, 640], [240, 700], [380, 780], [520, 860], [660, 930], [800, 985], [960, 1005],
		[1120, 985], [1260, 930], [1400, 860], [1540, 780], [1680, 700], [1810, 640], [1940, 600],
	];
	const jag = pts.map(([x, y], i) => `L${x},${y + dy + (i % 2 ? 14 : -10)}`).join(' ');
	return `M-20,${bottom} ${jag} L1940,${bottom} Z`;
};

const VANISH: [number, number] = [24, 100];
const RISE: [number, number] = [96, 186];
const PEOPLE = 200;
const ONE = 376;
const END_HOLD = 512;

export const CodaScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('coda', frame);

	// 酋雷姆消失 → 镜头升出洞窟（洞窟整体往下移出画面，露出上方的崖口与夜空）
	const kGone = interpolate(frame, VANISH, [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
	const rise = interpolate(frame, RISE, [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const caveOut = 1 - interpolate(frame, [PEOPLE - 10, PEOPLE + 20], [0, 1], clamp);
	const leftIn = interpolate(frame, [PEOPLE, PEOPLE + 24], [0, 1], clamp);
	const rightIn = interpolate(frame, [PEOPLE + 56, PEOPLE + 80], [0, 1], clamp);
	const peopleOut = 1 - interpolate(frame, [ONE - 20, ONE + 6], [0, 1], clamp);

	const oneIn = interpolate(frame, [ONE, ONE + 30], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const trio = interpolate(frame, [ONE + 30, ONE + 70], [0, 1], clamp);
	const push = interpolate(frame, [ONE, CODA_SCENE_FRAMES], [1, 1.08], clamp);
	const endFade = interpolate(frame, [CODA_SCENE_FRAMES - 30, CODA_SCENE_FRAMES], [0, 1], clamp);

	return (
		<AbsoluteFill style={{background: '#000'}}>
			{/* 过渡：合众的夜空（镜头升出洞窟后看到的） */}
			{frame >= RISE[0] && caveOut > 0 && (
				<AbsoluteFill style={{opacity: caveOut}}>
					<ElementBg time={t} bg={[0.012, 0.016, 0.024]} frost={0.4} frostCol={[0.8, 0.85, 0.9]} glow={ACCENT.ice} glowAmt={0.25} c={[960, 1000]} glowR={0.4} />
				</AbsoluteFill>
			)}
			{/* 接上一段末帧：冰窟里的Ｎ、训练师、手杖；酋雷姆化进冰雾消失，镜头随后升起 */}
			{caveOut > 0 && rise < 1 && (
				<AbsoluteFill style={{transform: `translateY(${rise * 1160}px)`}}>
					<IceCave time={t} push={1.0} reveal={1} yaw={0} kyurem={1 - kGone} glow={0.9 - kGone * 0.25} />
					<DragonVoid time={t} p={[1640, 700]} r={64} amt={0} />
					<ArtFigure who="n-b2w2" x={1640} y={1080} h={470} rim={0.91} rimRgb={ACCENT.iceRgb} />
					<ArtFigure who="nate-b2w2" x={360} y={1090} h={600} rim={0.8} rimRgb={ACCENT.iceRgb} />
					<GhetsisEnd ghetsis={0} triad={0} cane={1} />
					{/* 洞窟上方的岩壁与崖口：镜头升起时从上方经过，最后停在画面底部 */}
					<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: -1080, overflow: 'visible'}}>
						<path d={CRATER(0, 1080)} fill="#020203" style={{filter: `drop-shadow(0 -1px 2px rgba(${ACCENT.iceRgb},0.6))`}} />
					</svg>
				</AbsoluteFill>
			)}
			{/* 升到顶后，崖口留在画面底部（与移动层里的同一条轮廓，下移 80 像素） */}
			{rise >= 1 && caveOut > 0 && (
				<svg width={1920} height={1080} style={{position: 'absolute', opacity: caveOut, overflow: 'visible'}}>
					<path d={CRATER(80, 1200)} fill="#020203" style={{filter: `drop-shadow(0 -1px 2px rgba(${ACCENT.iceRgb},0.6))`}} />
				</svg>
			)}

			{/* 撕开它的，强行合上它的 */}
			{frame >= PEOPLE && frame < ONE + 8 && (
				<AbsoluteFill style={{opacity: peopleOut}}>
					<AbsoluteFill style={{opacity: leftIn}}>
						<ElementBg time={t} c={[480, 560]} glow={[1, 1, 1]} glowAmt={0.5} glowR={0.26} />
						<AbsoluteFill style={{background: `radial-gradient(ellipse 22% 40% at 18% 60%, rgba(${ACCENT.warmRgb},0.25), transparent), radial-gradient(ellipse 22% 40% at 32% 60%, rgba(${ACCENT.blueRgb},0.25), transparent)`}} />
						<HeroFigure x={400} y={900} h={420} facing={1} time={t} rimRgb={ACCENT.warmRgb} rim={0.95} />
						<HeroFigure x={560} y={900} h={420} facing={-1} time={t} phase={1.3} rimRgb={ACCENT.blueRgb} rim={0.95} />
					</AbsoluteFill>
					<AbsoluteFill style={{clipPath: 'inset(0 0 0 50%)', opacity: rightIn}}>
						<ElementBg time={t} bg={[0.06, 0.06, 0.065]} c={[1440, 1150]} glow={[1, 1, 1]} glowAmt={0.9} glowR={0.4} />
						<ArtFigure who="ghetsis-b2w2" x={1440} y={960} h={600} rim={0.75} />
					</AbsoluteFill>
					<svg width={1920} height={1080} style={{position: 'absolute', opacity: rightIn}}>
						<line x1={960} y1={0} x2={960} y2={1080} stroke="rgba(255,255,255,0.45)" strokeWidth={2} />
					</svg>
					<AbsoluteFill style={{background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.8) 12%, transparent 28%)'}} />
				</AbsoluteFill>
			)}

			{/* 一条龙，三只龙 */}
			{frame >= ONE - 6 && (
				<AbsoluteFill style={{transform: `scale(${push})`, opacity: oneIn}}>
					<ElementBg time={t} c={[960, 420]} glow={[1, 1, 1]} glowAmt={0.35} glowR={0.4} rays={0.25} />
					<AbsoluteFill style={{opacity: trio}}>
						<DragonArt name="reshiram" x={420} y={600} size={560} reveal={0} rim={{dir: [0.6, -1], color: [2.6, 2.3, 1.9], power: 2}} />
						<DragonArt name="kyurem" x={960} y={720} size={560} reveal={0} rim={{dir: [0, -1], color: [1.7, 2.6, 3.0], power: 2}} />
						<DragonArt name="zekrom" x={1500} y={600} size={560} reveal={0} rim={{dir: [-0.6, -1], color: [0.9, 1.9, 3.2], power: 2}} />
					</AbsoluteFill>
					<DragonVoid time={t} p={[960, 420]} r={interpolate(frame, [ONE, ONE + 40], [20, 150], {...clamp, easing: Easing.out(Easing.cubic)})} amt={oneIn} />
				</AbsoluteFill>
			)}

			<Vignette strength={0.75} />

			<BiSubtitle
				tone="mono"
				zh="酋雷姆消失在洞窟深处——它失去的身体，依然没有找回来。"
				en="Kyurem vanished into the depths of the chasm, the missing parts of its body still unfilled."
				from={30}
				to={PEOPLE - 6}
				source={{zh: 'Bulbapedia「Giant Chasm」：Kyurem will disappear from the cave；图鉴"失去的身体"', en: 'B2/W2 Giant Chasm; Kyurem Pokédex (B2W2)'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="把它撕开的，是人；把它强行合上的，也是人。"
				en="It was people who tore it apart. And people who forced it back together."
				from={PEOPLE + 6}
				to={ONE - 6}
				source={{zh: '对前文的归纳：兄弟之争导致分裂、魁奇思强行合体', en: 'Summary of B/W, B2/W2'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="可真实与理想，本不必对立。"
				en="Yet truth and ideals need not stand against each other."
				from={ONE + 8}
				to={END_HOLD - 4}
				source={{zh: '黑2白2·夏卡', en: "B2/W2 Drayden: ...even though ideals and truth don't need to be in opposition!"}}
			/>

			<AbsoluteFill style={{background: '#000', opacity: endFade}} />
			<Grain opacity={0.12} frameOffset={SEG_START.coda} />
		</AbsoluteFill>
	);
};
