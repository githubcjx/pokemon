import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {Lightning} from '../../components/effects/Lightning';
import {shake} from '../../camera';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {FUSION_SCENE_FRAMES, SEG_START, globalTime} from './continuity';
import {IceCave} from './HuskScene';
import {ACCENT, DragonArt, DragonVoid, ElementBg, Flash} from './Mono';
import {ArtFigure, NCastle} from './People';
import {Frigate, Opelucid} from './Plasma';

export {FUSION_SCENE_FRAMES};

/**
 * 第 7 段《合体》（60 秒，今·黑 2 / 白 2；用户 2026-10-04 要求加长）：
 * 接上一段的夜空：等离子驱逐舰驶过（船底透出酋雷姆力量的冷光）→ 冰弹落向双龙市，城市被冻成冰城 →
 * 夏卡（官方立绘剪影）与他家代代相传的基因之楔（官方说明 + 夏卡的说法）→ 黑暗铁三角现身、夺走基因之楔 →
 * 寒气漫开，进入巨人洞窟：魁奇思拄着手杖、Ｎ赶到（"在这里能把整个合众冰封"）→ 两枚楔形的光打进酋雷姆，
 * Ｎ身边一团黑白的光被拽过去吸收 → 焰白酋雷姆（盾图鉴）→ 暗黑酋雷姆（剑图鉴）→ 左右并置、魁奇思压在前景 →
 * 白闪，龙分开，那团光回到Ｎ身边 → 魁奇思失去理智，黑暗铁三角现身把他带走，地上只剩那根手杖。
 */

// 前半：驱逐舰、双龙市、传家宝、黑暗铁三角
const CITY = 200;
const MISSILES = [214, 222, 232, 240, 250];
const HEIR = 340;
const WEDGES_IN = 420;
const TRIAD = 640;
const STOLEN = 690;
// 后半：巨人洞窟（原第 7 段整体后移 O 帧）
const O = 694;
const CAVE = 36 + O;
const WHITE = 330 + O;
const WHITE_REVEAL: [number, number] = [340 + O, 372 + O];
const BLACK = 520 + O;
const BLACK_REVEAL: [number, number] = [530 + O, 562 + O];
const FORCED = 710 + O;
const APART = 830 + O;
const GONE = 960 + O; // 魁奇思的结局

/** 魁奇思的结局：剪影晃了晃（失去理智）→ 黑暗铁三角现身把他带走 → 地上只剩那根手杖（与第 8 段开头共用） */
export const GhetsisEnd: React.FC<{ghetsis: number; triad: number; cane: number; sway?: number}> = ({ghetsis, triad, cane, sway = 0}) => (
	<>
		{ghetsis > 0 && <ArtFigure who="ghetsis-b2w2" x={800} y={1090} h={660} rim={0.7} rimRgb={ACCENT.iceRgb} opacity={ghetsis} bow={sway} />}
		{triad > 0 && (
			<>
				<ArtFigure who="shadow-b2w2" x={620} y={1090} h={560} rim={0.8} rimRgb={ACCENT.iceRgb} opacity={triad} />
				<ArtFigure who="shadow-b2w2" x={990} y={1090} h={560} rim={0.8} rimRgb={ACCENT.iceRgb} opacity={triad} />
				<ArtFigure who="shadow-b2w2" x={1180} y={1070} h={540} rim={0.8} rimRgb={ACCENT.iceRgb} opacity={triad} />
			</>
		)}
		{cane > 0 && (
			<svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible', opacity: cane}}>
				<g
					transform="translate(820, 1040) rotate(-10)"
					fill="#030303"
					style={{filter: `drop-shadow(0 0 2px rgba(${ACCENT.iceRgb},1)) drop-shadow(0 0 10px rgba(${ACCENT.iceRgb},0.7))`}}
				>
					<rect x={-180} y={-5} width={360} height={10} rx={5} />
					<circle cx={-196} cy={0} r={20} fill="none" stroke="#030303" strokeWidth={8} />
				</g>
			</svg>
		)}
	</>
);

export const FusionScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('fusion', frame);

	// 驱逐舰驶过夜空（船头朝左，从右往左）
	const shipX = interpolate(frame, [10, CITY + 40], [2300, 700], clamp);
	const shipY = 300 + Math.sin(frame / 22) * 6;
	// 冰弹与冰封
	const ice = interpolate(frame, [244, 330], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
	const hit = MISSILES.reduce((m, b) => Math.max(m, interpolate(frame - b - 12, [0, 2, 16], [0, 1, 0], clamp)), 0);
	// 传家宝与黑暗铁三角
	const wedgesIn = interpolate(frame, [WEDGES_IN, WEDGES_IN + 20], [0, 1], clamp);
	const stolen = interpolate(frame, [STOLEN, STOLEN + 10], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const triadIn = interpolate(frame, [TRIAD + 18, TRIAD + 24, 708, 716], [0, 1, 1, 0], clamp);
	const chill = interpolate(frame, [700, CAVE], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const heirPush = interpolate(frame, [HEIR, CAVE], [1, 1.08], clamp);
	// 冰窟里：Ｎ赶到
	const nIn = interpolate(frame, [60 + O, 84 + O], [0, 1], clamp);
	// 控制与吸收
	const wedge = interpolate(frame, [158 + O, 186 + O], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const pull = interpolate(frame, [192 + O, 238 + O], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	const orbAmt = interpolate(frame, [176 + O, 190 + O, 230 + O, 240 + O], [0, 1, 1, 0], clamp);
	const strain = interpolate(frame, [190 + O, 240 + O, 300 + O, WHITE], [0, 1, 1, 1.4], clamp);
	const sk = shake(frame, 238 + O, 10, 40);
	const sk2 = shake(frame, WHITE, 18, 34);
	const kBright = interpolate(frame, [CAVE, CAVE + 20], [0.35, 0.45], clamp) + strain * 0.25 * (0.5 + 0.5 * Math.sin(frame * 1.7));
	// 焰白
	const wReveal = interpolate(frame, WHITE_REVEAL, [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
	const wPush = interpolate(frame, [WHITE, BLACK], [1, 1.06], clamp);
	// 暗黑
	const bReveal = interpolate(frame, BLACK_REVEAL, [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
	const bPush = interpolate(frame, [BLACK, FORCED], [1, 1.06], clamp);
	const bBolts = [BLACK - 4, 560 + O, 610 + O, 660 + O];
	const bFlick = bBolts.reduce((m, b) => Math.max(m, interpolate(frame - b, [0, 1, 7], [0, 1, 0], clamp)), 0);
	// 并置
	const fIn = interpolate(frame, [FORCED, FORCED + 16], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const gIn = interpolate(frame, [FORCED + 20, FORCED + 50], [0, 1], clamp);
	// 分开
	const back = interpolate(frame, [APART + 26, APART + 92], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const backAmt = interpolate(frame, [APART + 10, APART + 24, APART + 88, APART + 100], [0, 1, 1, 0], clamp);
	const nGlow = interpolate(frame, [APART + 90, APART + 104, FUSION_SCENE_FRAMES], [0, 1, 0.7], clamp);
	// 魁奇思的结局：失去理智 → 黑暗铁三角现身把他带走 → 只剩手杖
	const gEnd = interpolate(frame, [GONE + 4, GONE + 20, GONE + 76, GONE + 82], [0, 1, 1, 0], clamp);
	const gTriad = interpolate(frame, [GONE + 46, GONE + 52, GONE + 76, GONE + 82], [0, 1, 1, 0], clamp);
	const cane = interpolate(frame, [GONE + 76, GONE + 84], [0, 1], clamp);
	const gSway = Math.sin(frame * 0.35) * interpolate(frame, [GONE + 10, GONE + 40], [0, 3], clamp);

	const phase =
		frame < CITY
			? 'sky'
			: frame < HEIR
			? 'city'
			: frame < CAVE
			? 'heir'
			: frame < WHITE
			? 'cave'
			: frame < BLACK
			? 'white'
			: frame < FORCED
			? 'black'
			: frame < APART
			? 'forced'
			: 'apart';

	// Ｎ身边那团光（他的龙）：从Ｎ身边被拽进酋雷姆 / 分开后飞回Ｎ身边
	const nPos = {x: 1640, y: 700};
	const kPos = {x: 1150, y: 450};
	const orbP = phase === 'apart' ? {x: kPos.x + (nPos.x - kPos.x) * back, y: kPos.y + (nPos.y - kPos.y) * back} : {x: nPos.x + (kPos.x - nPos.x) * pull, y: nPos.y + (kPos.y - nPos.y) * pull};

	return (
		<AbsoluteFill style={{background: '#000'}}>
			{phase === 'sky' && (
				<>
					<ElementBg time={t} bg={[0.02, 0.022, 0.028]} storm={0.45} ink={[0.09, 0.1, 0.12]} glow={[0.95, 0.97, 1]} glowAmt={0.55} c={[1500, 260]} glowR={0.06} />
					{/* 接上一段末帧：远处的Ｎ的城堡 */}
					<NCastle cx={960} base={1120} scale={0.62} />
					<AbsoluteFill style={{background: 'linear-gradient(to top, #000 0%, #000 6%, transparent 22%)'}} />
					<Frigate x={shipX} y={shipY} scale={0.95} />
				</>
			)}

			{(phase === 'city' || phase === 'heir') && (
				<AbsoluteFill style={{transform: `scale(${phase === 'heir' ? heirPush : 1})`, transformOrigin: '40% 60%'}}>
					<ElementBg time={t} bg={[0.02, 0.024, 0.03]} storm={0.35} ink={[0.08, 0.09, 0.1]} frost={0.3 + ice * 0.7} glow={ACCENT.ice} glowAmt={0.2 + hit * 0.6 + ice * 0.25} c={[960, 900]} glowR={0.5} />
					<Opelucid ice={ice} time={t} />
					{phase === 'city' && <Frigate x={760} y={210 + Math.sin(frame / 22) * 6} scale={0.62} glow={1} />}
					{phase === 'city' && (
						<svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible'}}>
							{MISSILES.map((m, i) => {
								const p = interpolate(frame, [m, m + 12], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
								if (p <= 0 || p >= 1) return null;
								const x0 = 700 + (i - 2) * 60;
								const x1 = [360, 820, 1180, 560, 1500][i];
								const tail = Math.max(0, p - 0.25);
								return (
									<g key={m} style={{filter: `drop-shadow(0 0 10px rgba(${ACCENT.iceRgb},1))`}}>
										<line
											x1={x0 + (x1 - x0) * tail}
											y1={240 + 690 * tail}
											x2={x0 + (x1 - x0) * p}
											y2={240 + 690 * p}
											stroke={`rgba(${ACCENT.iceRgb},0.9)`}
											strokeWidth={4}
											strokeLinecap="round"
										/>
										<circle cx={x0 + (x1 - x0) * p} cy={240 + 690 * p} r={7} fill="#fff" />
									</g>
								);
							})}
						</svg>
					)}
					{phase === 'heir' && (
						<>
							<AbsoluteFill style={{background: 'rgba(0,0,0,0.35)'}} />
							<ArtFigure who="drayden-bw" x={640} y={1090} h={740} rim={0.8} rimRgb={ACCENT.iceRgb} />
							{/* 基因之楔：两枚楔形的光（不画道具的具体外观），被夺走时飞向黑暗铁三角 */}
							{wedgesIn > 0 && stolen < 1 && (
								<svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible', opacity: wedgesIn}}>
									{[-1, 1].map((d) => {
										const bx = 420 + d * 34;
										const by = 450 + Math.sin(frame / 10 + d) * 6;
										const x = bx + (1350 - bx) * stolen;
										const y = by + (520 - by) * stolen;
										return (
											<polygon
												key={d}
												points={`${x - 28 * d},${y - 8} ${x + 28 * d},${y} ${x - 28 * d},${y + 8}`}
												fill="#fff"
												style={{filter: `drop-shadow(0 0 8px rgba(${ACCENT.iceRgb},1)) drop-shadow(0 0 22px rgba(255,255,255,0.8))`}}
											/>
										);
									})}
								</svg>
							)}
							<ArtFigure who="shadow-b2w2" x={1110} y={1090} h={620} rim={0.85} rimRgb={ACCENT.iceRgb} opacity={triadIn} />
							<ArtFigure who="shadow-b2w2" x={1360} y={1070} h={600} rim={0.85} rimRgb={ACCENT.iceRgb} opacity={triadIn} />
							<ArtFigure who="shadow-b2w2" x={1610} y={1090} h={620} rim={0.85} rimRgb={ACCENT.iceRgb} opacity={triadIn} />
							<AbsoluteFill style={{background: `rgba(220,245,255,${chill * 0.6})`}} />
						</>
					)}
				</AbsoluteFill>
			)}

			{(phase === 'cave' || phase === 'apart') && (
				<AbsoluteFill style={{transform: `translate(${sk.x + sk2.x}px, ${sk.y + sk2.y}px)`}}>
					<IceCave time={t} push={1.0} reveal={1} yaw={0} brightness={phase === 'apart' ? 1 : kBright} glow={phase === 'apart' ? 0.9 : 0.5 + strain * 0.3}>
						{/* 两枚楔形的光：从手杖飞进酋雷姆 */}
						{phase === 'cave' && wedge > 0 && wedge < 1 && (
							<svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible'}}>
								{[-1, 1].map((d) => {
									const x = 520 + (1120 - 520) * wedge;
									const y = 600 + (430 - 600) * wedge + d * 40 * (1 - wedge);
									return (
										<polygon
											key={d}
											points={`${x - 26},${y - 7} ${x + 26},${y} ${x - 26},${y + 7}`}
											fill="#fff"
											style={{filter: `drop-shadow(0 0 8px rgba(${ACCENT.iceRgb},1)) drop-shadow(0 0 18px rgba(255,255,255,0.8))`}}
										/>
									);
								})}
							</svg>
						)}
					</IceCave>
					<DragonVoid time={t} p={[orbP.x, orbP.y]} r={phase === 'apart' ? 64 : 64 * (1 - pull * 0.7)} amt={phase === 'apart' ? backAmt : orbAmt} />
					{phase === 'cave' && <ArtFigure who="ghetsis-b2w2" x={430} y={1090} h={680} rim={0.75} rimRgb={ACCENT.iceRgb} />}
					<ArtFigure who="n-b2w2" x={nPos.x} y={1080} h={470} rim={0.7 + nGlow * 0.3} rimRgb={ACCENT.iceRgb} opacity={phase === 'apart' ? 1 : nIn} />
					{phase === 'apart' && <ArtFigure who="nate-b2w2" x={360} y={1090} h={600} rim={0.8} rimRgb={ACCENT.iceRgb} />}
					{phase === 'apart' && <GhetsisEnd ghetsis={gEnd} triad={gTriad} cane={cane} sway={gSway} />}
				</AbsoluteFill>
			)}

			{phase === 'white' && (
				<AbsoluteFill style={{transform: `translate(${sk2.x}px, ${sk2.y}px) scale(${wPush})`, transformOrigin: '55% 50%'}}>
					<ElementBg time={t} c={[1210, 430]} glow={[1, 0.95, 0.88]} glowAmt={0.9} glowR={0.3} rays={0.4} flame={0.8} frost={0.55} />
					<DragonArt name="kyurem" variant="-white" x={1210} y={560} size={1120} reveal={wReveal} rim={{dir: [0.2, -1], color: [2.6, 2.4, 2.2], power: 2}} rimAfter={0.35} />
					<AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 14%, transparent 30%)'}} />
				</AbsoluteFill>
			)}

			{phase === 'black' && (
				<AbsoluteFill style={{transform: `scale(${bPush})`, transformOrigin: '45% 50%'}}>
					<ElementBg time={t} c={[840, 430]} bg={[0.97, 0.975, 0.98]} storm={1} ink={[0.05, 0.06, 0.07]} glow={ACCENT.blue} glowAmt={0.15 + bFlick * 0.4} flick={bFlick} frost={0.35} frostCol={[0.4, 0.75, 0.95]} />
					<AbsoluteFill style={{background: 'linear-gradient(to top, #000 0%, #000 11%, rgba(0,0,0,0.7) 21%, transparent 35%)'}} />
					{bBolts.map((b, i) => (
						<Lightning key={b} at={b} seed={`bk${i}`} from={[[620, 1100, 480, 1240][i], -30]} to={[[700, 1020, 560, 1160][i], 600]} rgb={ACCENT.blueRgb} width={3.5} />
					))}
					<DragonArt name="kyurem" variant="-black" x={720} y={560} size={1120} reveal={bReveal} rim={{dir: [-0.2, -1], color: [0.8, 1.8, 3.2], power: 2}} rimAfter={0.45} />
				</AbsoluteFill>
			)}

			{phase === 'forced' && (
				<>
					<AbsoluteFill style={{clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)', transform: `translateX(${(1 - fIn) * -100}px)`}}>
						<ElementBg time={t} c={[480, 430]} bg={[0.06, 0.07, 0.08]} storm={0.8} ink={[0.02, 0.025, 0.03]} glow={ACCENT.blue} glowAmt={0.5} glowR={0.3} frost={0.5} />
						<DragonArt name="kyurem" variant="-black" x={470} y={520} size={860} reveal={1} brightness={0.62} rim={{dir: [-0.2, -1], color: [0.5, 1.1, 2.0], power: 2}} rimAfter={1} />
					</AbsoluteFill>
					<AbsoluteFill style={{clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)', transform: `translateX(${(1 - fIn) * 100}px)`}}>
						<ElementBg time={t} c={[1440, 430]} glow={[1, 0.95, 0.88]} glowAmt={0.55} glowR={0.3} flame={0.5} frost={0.5} />
						<DragonArt name="kyurem" variant="-white" x={1450} y={520} size={860} reveal={1} brightness={0.62} rim={{dir: [0.2, -1], color: [1.4, 1.3, 1.2], power: 2}} rimAfter={1} />
					</AbsoluteFill>
					<svg width={1920} height={1080} style={{position: 'absolute', opacity: fIn}}>
						<line x1={960} y1={0} x2={960} y2={1080} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
					</svg>
					<AbsoluteFill style={{background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.9) 16%, transparent 46%)'}} />
					<ArtFigure who="ghetsis-b2w2" x={960} y={1200} h={880} rim={0.55} opacity={gIn} />
				</>
			)}

			<Flash at={CITY} len={8} peak={0.4} rgb={ACCENT.iceRgb} />
			<Flash at={256} len={10} peak={0.5} rgb={ACCENT.iceRgb} />
			<Flash at={HEIR} len={8} peak={0.35} />
			<Flash at={TRIAD + 18} len={6} peak={0.4} />
			<Flash at={CAVE} len={10} peak={0.9} rgb="230,248,255" />
			<Flash at={WHITE} len={16} peak={1} rgb="255,248,236" />
			<Flash at={BLACK} len={12} peak={0.9} rgb={ACCENT.blueRgb} />
			<Flash at={FORCED} len={8} peak={0.5} />
			<Flash at={APART} len={16} peak={1} />
			<Flash at={GONE + 76} len={8} peak={0.35} />

			<Vignette strength={phase === 'black' ? 0.45 : 0.75} />

			{phase === 'white' && (
				<NameTag
					tone="mono"
					glowRgb={ACCENT.warmRgb}
					from={WHITE_REVEAL[1] + 6}
					x={100}
					y={300}
					no="No.0646"
					category="境界宝可梦"
					categoryEn="BOUNDARY POKÉMON"
					zh="焰白酋雷姆"
					en="WHITE KYUREM"
				/>
			)}
			{phase === 'black' && (
				<NameTag
					tone="monoDark"
					glowRgb={ACCENT.blueRgb}
					from={BLACK_REVEAL[1] + 6}
					x={1360}
					y={470}
					no="No.0646"
					category="境界宝可梦"
					categoryEn="BOUNDARY POKÉMON"
					zh="暗黑酋雷姆"
					en="BLACK KYUREM"
				/>
			)}

			<Cry name="kyurem-white" at={WHITE_REVEAL[1]} fadeOut={[BLACK - 16, BLACK]} />
			<Cry name="kyurem-black" at={BLACK_REVEAL[1]} fadeOut={[FORCED - 16, FORCED]} />

			<BiSubtitle tone="mono" zh="两年后，等离子队卷土重来。" en="Two years later, Team Plasma returned." from={6} to={80} />
			<BiSubtitle
				tone="mono"
				zh="他们的驱逐舰，装着用酋雷姆的力量造出的冰冻装置。"
				en="Their frigate carried a freezing device built with Kyurem's power."
				from={86}
				to={CITY - 4}
				source={{zh: '黑2白2·维奥', en: "B2/W2 Zinzolin: This ship itself is a device that uses the Pokémon Kyurem's power!"}}
			/>
			<BiSubtitle
				tone="mono"
				zh="冰弹落下，双龙市被冻成了一座冰城。"
				en="Ice missiles rained down, and Opelucid City was frozen solid."
				from={CITY + 6}
				to={HEIR - 4}
				source={{zh: '黑2白2·维奥；Bulbapedia「Opelucid City」', en: "B2/W2 Zinzolin: The ice missiles we fired into Opelucid City were created with Kyurem's power..."}}
			/>
			<BiSubtitle
				tone="mono"
				zh="他们要的，是夏卡家代代相传的宝物——基因之楔。"
				en="What they wanted was a treasure passed down in Drayden's family: the DNA Splicers."
				from={HEIR + 4}
				to={432}
				source={{zh: 'Bulbapedia「DNA Splicers」', en: "Originally in Drayden's possession and hidden in the Opelucid Gym"}}
			/>
			<BiSubtitle
				tone="mono"
				zh="据说是能让原本为一体的酋雷姆和某宝可梦合体的一对楔子。"
				en="A splicer that fuses Kyurem and a certain Pokémon. They are said to have been one in the beginning."
				from={438}
				to={536}
				source={{zh: '基因之楔道具说明（官方中文）', en: 'DNA Splicers (B2W2)'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="夏卡说，它也许能证明：酋雷姆也诞生于双龙分裂的那个时代。"
				en="Drayden believed it might prove that Kyurem, too, came into being in that era."
				from={542}
				to={TRIAD - 2}
				source={{zh: '黑2白2·夏卡', en: 'B2/W2 Drayden: a third dragon Pokémon, Kyurem, also came into existence in that era. And there may be proof of this...'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="趁着冰封，黑暗铁三角偷走了基因之楔。"
				en="In the frozen chaos, the Shadow Triad stole the DNA Splicers."
				from={TRIAD + 4}
				to={CAVE - 4}
				source={{zh: 'Bulbapedia「DNA Splicers」（"黑暗铁三角"为 52poke 名称）', en: 'they are stolen by the Shadow Triad after Team Plasma freezes Opelucid City'}}
			/>
			<BiSubtitle tone="mono" zh="魁奇思把Ｎ骗到了巨人洞窟。" en="Ghetsis lured N to the Giant Chasm." from={CAVE + 4} to={CAVE + 70} source={{zh: '黑2白2', en: 'B2/W2: Ghetsis tricked N into coming here'}} />
			<BiSubtitle
				tone="mono"
				zh="在这里，酋雷姆能使出全部力量，把整个合众冰封。"
				en="Here, Kyurem could unleash its full power and cover all of Unova in ice."
				from={CAVE + 76}
				to={150 + O}
				source={{zh: '黑2白2·魁奇思', en: 'B2/W2 Ghetsis: Here, Kyurem can use the full extent of its power and easily cover all of Unova in ice!'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="他控制了酋雷姆，用基因之楔让它吸收了Ｎ的龙。"
				en="He seized control of Kyurem and used the DNA Splicers to make it absorb N's dragon."
				from={156 + O}
				to={WHITE - 4}
				source={{zh: '黑2白2（Bulbapedia「Giant Chasm」）', en: "B2/W2: using his cane to control Kyurem... fuse with N's dragon with the DNA Splicers"}}
			/>
			<BiSubtitle
				tone="mono"
				zh="已经看出宝可梦和人类之间的真实世界将会到来，它试图去保护这样的未来。"
				en="It has foreseen that a world of truth will arrive for people and Pokémon. It strives to protect that future."
				from={398 + O}
				to={BLACK - 4}
				source={{zh: '焰白酋雷姆·盾（官方中文）', en: 'White Kyurem, Shield (Pokémon HOME)'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="传说它是为了保护宝可梦与人类之间那将在未来实现的理想世界而战斗。"
				en="It's said that this Pokémon battles in order to protect the ideal world that will exist in the future for people and Pokémon."
				from={588 + O}
				to={FORCED - 4}
				source={{zh: '暗黑酋雷姆·剑（官方中文）', en: 'Black Kyurem, Sword (Pokémon HOME)'}}
			/>
			<BiSubtitle tone="mono" zh="分开的龙第一次合在了一起——却是被人强行合上的。" en="The sundered dragon was joined at last—forced together by human hands." from={FORCED + 4} to={APART - 4} />
			<BiSubtitle
				tone="mono"
				zh="训练师打败了它。龙分开了，回到了Ｎ的身边。"
				en="The Trainer defeated it. The dragons came apart, and N's dragon returned to him."
				from={APART + 6}
				to={GONE - 4}
				source={{zh: '黑2白2', en: 'B2/W2: Zekrom/Reshiram will be separated from Kyurem and return to N'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="魁奇思失去了理智，被黑暗铁三角带走，只留下了那根手杖。"
				en="Ghetsis lost his mind and was carried off by the Shadow Triad, leaving only his cane behind."
				from={GONE + 4}
				to={FUSION_SCENE_FRAMES - 4}
				source={{zh: 'Bulbapedia「Giant Chasm」', en: 'After defeating Ghetsis, he descends into madness, causing the Shadow Triad to appear and take him away, leaving his cane.'}}
			/>

			<Grain opacity={phase === 'black' ? 0.08 : 0.12} frameOffset={SEG_START.fusion} />
		</AbsoluteFill>
	);
};
