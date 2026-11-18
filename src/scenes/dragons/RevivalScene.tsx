import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Grain} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {REVIVAL_SCENE_FRAMES, SEG_START, globalTime} from './continuity';
import {Faceoff} from './Faceoff';
import {IceCave} from './HuskScene';
import {ACCENT, DragonVoid, ElementBg, Flash} from './Mono';
import {ArtFigure, Crowd, DragonspiralTower, NCastle} from './People';
import {Stone} from './Stones';

export {REVIVAL_SCENE_FRAMES};

/**
 * 第 6 段《英雄再现》（41 秒，今·黑 / 白）：
 * 三联画（光明石 / 冰窟里的酋雷姆 / 黑暗石：都在等英雄）→ 魁奇思与Ｎ → 人群与演讲台 →
 * 风雪中的龙螺旋之塔，塔顶迸出黑白交缠的光（不点明是哪条龙：黑版是捷克罗姆、白版是莱希拉姆）→
 * 手握石头的训练师 → 升起的Ｎ的城堡，石头苏醒 → 双龙对峙，两位英雄的剪影 → Ｎ输了 →
 * 魁奇思在底光里说出真话 → 一道光从城堡飞向月亮（Ｎ骑龙离开）。
 */

const EASE = Easing.inOut(Easing.cubic);
const GHETSIS = 110;
const CROWD = 296;
const TOWER = 385;
const AWAKEN = 445;
const TRAINER = 520;
const CASTLE = 600;
const FACE = 700;
const LOSE = 830;
const TRUTH = 910;
const LEAVE = 1060;

export const RevivalScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('revival', frame);

	// 三联画
	const tri = interpolate(frame, [6, 34], [0, 1], {...clamp, easing: EASE});
	const tagFade = 1 - interpolate(frame, [0, 12], [0, 1], clamp);

	// 魁奇思与Ｎ
	const gPush = interpolate(frame, [GHETSIS, CROWD], [1, 1.06], clamp);
	const nIn = interpolate(frame, [190, 214], [0, 1], clamp);
	// 龙螺旋之塔
	const awake = interpolate(frame, [AWAKEN - 10, AWAKEN + 10], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const awakeFade = 1 - interpolate(frame, [AWAKEN + 30, TRAINER - 10], [0, 0.7], clamp);
	const towerPush = interpolate(frame, [TOWER, TRAINER], [1, 1.12], clamp);
	// 训练师与石头
	const orb = 0.6 + 0.3 * Math.sin(frame * 0.25);
	// 城堡
	const rise = interpolate(frame, [CASTLE, CASTLE + 60], [0.55, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const castleOrb = interpolate(frame, [CASTLE + 40, CASTLE + 82], [0.6, 3], {...clamp, easing: Easing.in(Easing.quad)});
	// 对峙
	const facePush = interpolate(frame, [FACE, LOSE], [1, 1.05], clamp);
	// Ｎ输了
	const bow = interpolate(frame, [LOSE + 20, LOSE + 60], [0, 9], {...clamp, easing: EASE});
	const loseLight = interpolate(frame, [LOSE, TRUTH], [0.8, 0.12], clamp);
	// 底光里的魁奇思
	const under = interpolate(frame, [TRUTH, TRUTH + 20], [0, 1], clamp);
	// 离开
	const streak = interpolate(frame, [LEAVE + 20, LEAVE + 84], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const streakFade = 1 - interpolate(frame, [LEAVE + 84, LEAVE + 120], [0, 1], clamp);

	const phase =
		frame < GHETSIS
			? 'tri'
			: frame < CROWD
			? 'ghetsis'
			: frame < TOWER
			? 'crowd'
			: frame < TRAINER
			? 'tower'
			: frame < CASTLE
			? 'trainer'
			: frame < FACE
			? 'castle'
			: frame < LOSE
			? 'face'
			: frame < TRUTH
			? 'lose'
			: frame < LEAVE
			? 'truth'
			: 'leave';

	const sky = (
		<ElementBg time={t} bg={[0.02, 0.022, 0.028]} storm={0.45} ink={[0.09, 0.1, 0.12]} glow={[0.95, 0.97, 1]} glowAmt={0.55} c={[1500, 260]} glowR={0.06} />
	);
	const streakP = {x: 960 + (1500 - 960) * streak, y: 700 + (260 - 700) * streak};

	return (
		<AbsoluteFill style={{background: '#000'}}>
			{phase === 'tri' && (
				<>
					{/* 中间：冰窟里的酋雷姆（第 5 段末帧收窄成中间一格） */}
					<AbsoluteFill style={{clipPath: `inset(0 ${tri * 33.4}% 0 ${tri * 33.4}%)`}}>
						<AbsoluteFill style={{transform: `translateX(${-tri * 190}px)`}}>
							<IceCave time={t} push={1.06} reveal={1} yaw={2} />
						</AbsoluteFill>
					</AbsoluteFill>
					{/* 左：光明石 */}
					<AbsoluteFill style={{clipPath: 'inset(0 66.6% 0 0)', transform: `translateX(${(1 - tri) * -640}px)`, opacity: tri > 0 ? 1 : 0}}>
						<ElementBg time={t} frost={0.3} frostCol={[0.5, 0.5, 0.5]} />
						<Stone i={0} x={320} y={700} scale={1.7} glow={0.8} />
					</AbsoluteFill>
					{/* 右：黑暗石 */}
					<AbsoluteFill style={{clipPath: 'inset(0 0 0 66.6%)', transform: `translateX(${(1 - tri) * 640}px)`, opacity: tri > 0 ? 1 : 0}}>
						<ElementBg time={t} frost={0.3} frostCol={[0.5, 0.5, 0.5]} />
						<Stone i={1} x={1600} y={700} scale={1.7} glow={0.8} />
					</AbsoluteFill>
					<svg width={1920} height={1080} style={{position: 'absolute', opacity: tri}}>
						<line x1={641} y1={0} x2={641} y2={1080} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
						<line x1={1279} y1={0} x2={1279} y2={1080} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
					</svg>
				</>
			)}

			{phase === 'ghetsis' && (
				<AbsoluteFill style={{transform: `scale(${gPush})`, transformOrigin: '50% 70%'}}>
					<ElementBg time={t} c={[960, -120]} glow={[1, 1, 1]} glowAmt={0.9} glowR={0.75} rays={0.3} />
					<ArtFigure who="ghetsis-bw" x={760} y={980} h={600} rim={0.75} />
					<ArtFigure who="n-bw" x={1180} y={980} h={440} rim={0.8} opacity={nIn} />
					<AbsoluteFill style={{background: 'linear-gradient(to top, #000 0%, #000 10%, transparent 30%)'}} />
				</AbsoluteFill>
			)}

			{phase === 'crowd' && (
				<>
					<ElementBg time={t} c={[960, 300]} glow={[1, 1, 1]} glowAmt={1.0} glowR={0.22} rays={0.6} />
					<svg width={1920} height={1080} style={{position: 'absolute'}}>
						{/* 演讲台：三级台阶，上沿一线逆光 */}
						<g fill="#030303" style={{filter: 'drop-shadow(0 -1px 2px rgba(255,255,255,0.55))'}}>
							<rect x={840} y={560} width={240} height={40} />
							<rect x={780} y={600} width={360} height={40} />
							<rect x={700} y={640} width={520} height={480} />
						</g>
					</svg>
					<ArtFigure who="ghetsis-bw" x={960} y={560} h={210} rim={0.9} />
					<Crowd y={1010} time={t} />
				</>
			)}

			{phase === 'tower' && (
				<AbsoluteFill style={{transform: `scale(${towerPush})`, transformOrigin: '50% 30%'}}>
					<ElementBg
						time={t}
						bg={[0.05, 0.055, 0.06]}
						storm={0.6}
						ink={[0.14, 0.15, 0.16]}
						frost={0.9}
						frostCol={[0.85, 0.88, 0.92]}
						c={[960, 200]}
						glow={[1, 1, 1]}
						glowAmt={awake * 1.3 * awakeFade}
						glowR={0.3}
						rays={awake * 0.8 * awakeFade}
					/>
					<DragonspiralTower x={960} base={1120} h={860} />
					<ArtFigure who="n-bw" x={940} y={262} h={56} rim={0.9} />
					<DragonVoid time={t} p={[960, 160]} r={awake * 110} amt={awake * awakeFade} />
				</AbsoluteFill>
			)}

			{phase === 'trainer' && (
				<>
					<ElementBg time={t} c={[1100, 600]} glow={[0.9, 0.93, 1]} glowAmt={0.45} glowR={0.4} frost={0.25} frostCol={[0.6, 0.6, 0.6]} />
					<ArtFigure who="hilbert-bw" x={900} y={1080} h={760} rim={0.7} orb={{rgb: '225,235,255', amt: orb}} />
				</>
			)}

			{phase === 'castle' && (
				<>
					<ElementBg time={t} bg={[0.03, 0.032, 0.04]} storm={0.7} ink={[0.12, 0.13, 0.15]} c={[960, 300]} glow={[1, 1, 1]} glowAmt={0.35} glowR={0.4} />
					<NCastle cx={1080} base={860} scale={1.05} rise={rise} />
					<AbsoluteFill style={{background: 'linear-gradient(to top, #000 0%, #000 18%, transparent 40%)'}} />
					<ArtFigure who="hilbert-bw" x={420} y={1050} h={380} rim={0.7} orb={{rgb: '225,235,255', amt: castleOrb}} />
				</>
			)}

			{phase === 'face' && (
				<>
					<Faceoff time={t} push={facePush} />
					<AbsoluteFill style={{background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.85) 12%, transparent 30%)'}} />
					<ArtFigure who="hilbert-bw" x={850} y={1060} h={320} rimRgb={ACCENT.warmRgb} rim={0.95} />
					<ArtFigure who="n-bw" x={1080} y={1060} h={320} rimRgb={ACCENT.blueRgb} rim={0.95} />
				</>
			)}

			{phase === 'lose' && (
				<>
					<ElementBg time={t} c={[960, 420]} glow={[1, 1, 1]} glowAmt={loseLight} glowR={0.35} />
					<ArtFigure who="n-bw" x={960} y={1000} h={600} rim={0.4 + loseLight * 0.5} bow={-bow * 0.5} />
					<AbsoluteFill style={{background: 'linear-gradient(to top, #000 0%, #000 8%, transparent 26%)'}} />
				</>
			)}

			{phase === 'truth' && (
				<>
					<ElementBg time={t} bg={[0.07, 0.07, 0.075]} c={[880, 1180]} glow={[1, 1, 1]} glowAmt={under * 1.1} glowR={0.45} />
					{/* 墙上被底光放大的影子 */}
					<ArtFigure who="ghetsis-bw" x={1150} y={1560} h={1600} rim={0} opacity={0.55 * under} />
					<ArtFigure who="ghetsis-bw" x={860} y={1060} h={640} rim={0.4 + under * 0.5} />
					<AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 26%)'}} />
				</>
			)}

			{phase === 'leave' && (
				<>
					{sky}
					<NCastle cx={960} base={1120} scale={0.62} />
					<AbsoluteFill style={{background: 'linear-gradient(to top, #000 0%, #000 6%, transparent 22%)'}} />
					{streak > 0 && streakFade > 0 && (
						<svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible', opacity: streakFade}}>
							<line x1={960} y1={700} x2={streakP.x} y2={streakP.y} stroke={`rgba(${ACCENT.warmRgb},0.55)`} strokeWidth={3} transform="translate(-3,-3)" />
							<line x1={960} y1={700} x2={streakP.x} y2={streakP.y} stroke={`rgba(${ACCENT.blueRgb},0.55)`} strokeWidth={3} transform="translate(3,3)" />
							<circle cx={streakP.x} cy={streakP.y} r={8 * (1 - streak * 0.6)} fill="#fff" style={{filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.9))'}} />
						</svg>
					)}
				</>
			)}

			<Flash at={GHETSIS} len={8} peak={0.35} />
			<Flash at={AWAKEN} len={14} peak={0.9} />
			<Flash at={CASTLE + 82} len={14} peak={1} />
			<Flash at={TRUTH} len={6} peak={0.3} />

			<Vignette strength={0.75} />

			{phase === 'tri' && tagFade > 0 && (
				<NameTag tone="mono" glowRgb={ACCENT.iceRgb} from={-200} x={150} y={290} no="No.0646" category="境界宝可梦" categoryEn="BOUNDARY POKÉMON" zh="酋雷姆" en="KYUREM" opacity={tagFade} />
			)}

			<BiSubtitle tone="mono" zh="两块石头和一具空壳，都在等英雄。" en="Two stones and an empty husk, all waiting for a hero." from={14} to={GHETSIS - 6} />
			<BiSubtitle tone="mono" zh="很久以后，有人想让这个传说重演。" en="Long after, someone set out to make the legend happen again." from={GHETSIS + 4} to={190} />
			<BiSubtitle
				tone="mono"
				zh="等离子队的魁奇思，自己当不成英雄，就培养了Ｎ。"
				en="Ghetsis of Team Plasma could not become the hero himself, so he raised N to be one."
				from={196}
				to={CROWD - 4}
				source={{zh: '黑白·魁奇思', en: "B/W Ghetsis: Since I couldn't become the hero... I prepared someone for that purpose--N!"}}
			/>
			<BiSubtitle
				tone="mono"
				zh="他要让英雄和传说之龙重回合众，赢得人心。"
				en="He would bring back the hero and the legendary dragon, and win the people's hearts."
				from={CROWD + 4}
				to={TOWER - 4}
				source={{zh: '黑白·魁奇思', en: "B/W Ghetsis: We shall bring back the hero and that Pokémon to Unova once again! If we can win people's hearts and minds..."}}
			/>
			<BiSubtitle
				tone="mono"
				zh="在龙螺旋之塔，Ｎ唤醒了其中一条龙。"
				en="At Dragonspiral Tower, N awakened one of the dragons."
				from={TOWER + 4}
				to={TRAINER - 6}
				source={{zh: '黑白（黑版捷克罗姆、白版莱希拉姆）', en: 'B/W Dragonspiral Tower'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="而另一块石头，到了一名年轻的训练师手里。"
				en="The other stone came into the hands of a young Trainer."
				from={TRAINER + 4}
				to={CASTLE - 4}
				source={{zh: '黑白：主角通关古代城后得到', en: 'B/W'}}
			/>
			<BiSubtitle tone="mono" zh="在Ｎ的城堡，它苏醒了。" en="In N's Castle, it awoke." from={CASTLE + 4} to={FACE - 6} source={{zh: '黑白：决战前龙从石头中现身', en: "B/W N's Castle"}} />
			<BiSubtitle tone="mono" zh="两位英雄，两条龙，真实与理想——传说又一次上演。" en="Two heroes, two dragons, truth and ideals: the legend played out once more." from={FACE + 4} to={LOSE - 4} />
			<BiSubtitle tone="mono" zh="这一次，Ｎ输了。" en="This time, N lost." from={LOSE + 4} to={TRUTH - 4} source={{zh: '黑白', en: 'B/W'}} />
			<BiSubtitle
				tone="mono"
				zh="魁奇思这才说出真话：所谓解放宝可梦，是为了只有他们能用宝可梦。"
				en={'Only then did Ghetsis reveal the truth: "liberating" Pokémon meant that they alone could use them.'}
				from={TRUTH + 4}
				to={LEAVE - 4}
				source={{zh: '黑白·魁奇思', en: 'B/W Ghetsis: We alone will be able to use Pokémon!'}}
			/>
			<BiSubtitle tone="mono" zh="Ｎ骑着他的龙，离开了合众。" en="N flew away on his dragon." from={LEAVE + 4} to={1170} source={{zh: '黑白结局', en: 'B/W ending'}} />

			<Grain opacity={0.12} frameOffset={SEG_START.revival} />
		</AbsoluteFill>
	);
};
