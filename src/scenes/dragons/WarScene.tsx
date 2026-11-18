import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {Lightning} from '../../components/effects/Lightning';
import {Cam, shake, track} from '../../camera';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {SEG_START, WAR_SCENE_FRAMES, globalTime} from './continuity';
import {Faceoff} from './Faceoff';
import {ACCENT, Beams, DragonArt, ElementBg, Flash, HeroFigure} from './Mono';
import {Stage} from './Stage';
import {FallingStones} from './Stones';

export {WAR_SCENE_FRAMES};

/**
 * 第 4 段《双龙之战》（23 秒，全片爆发点）：
 * 接对峙 → 蓄力逼近 → 白焰与蓝雷对撞（猛推猛拉 + 震动，双龙第二次叫声），撞点翻滚成黑白光球、分不出胜负 →
 * 力竭，英雄宣告没有哪一方是对的（弟弟转回身）→ 儿子们再起战火 → 双龙的剪影在天上，火焰与雷电毁掉城邦 → 黑暗 →
 * 两团光坠落（剧场版差异一句）→ 接第 5 段落地化石。
 */

const EASE = Easing.inOut(Easing.cubic);
const CLASH = 150;
const TRUCE = 310;
const SONS = 400;
const RUIN = 480;
const FALL = 600;

const landCam = (frame: number): Cam => ({
	x: track(frame, [
		[TRUCE, 960],
		[RUIN, 960],
		[RUIN + 50, 1240, EASE],
	]),
	y: track(frame, [
		[TRUCE, 640],
		[RUIN, 640],
		[RUIN + 50, 560, EASE],
	]),
	zoom: track(frame, [
		[TRUCE, 1.7],
		[RUIN, 1.62],
		[RUIN + 50, 1.0, EASE],
		[FALL, 0.96],
	]),
	roll: 0,
});

export const WarScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('war', frame);
	const g = SEG_START.war + frame;

	// ── 对峙 → 蓄力 ──
	const facePush = interpolate(frame, [0, CLASH], [1, 1.1], {...clamp, easing: Easing.in(Easing.quad)});
	const charge = interpolate(frame, [50, CLASH], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const close = interpolate(frame, [96, CLASH], [0, 70], {...clamp, easing: Easing.in(Easing.cubic)});
	const faceBolts = [70, 108, 132];
	const faceFlick = faceBolts.reduce((m, b) => Math.max(m, interpolate(frame - b, [0, 1, 6], [0, 1, 0], clamp)), 0);

	// ── 对撞 ──
	const c: [number, number] = [985 + Math.sin((frame - CLASH) / 13) * 46 + Math.sin((frame - CLASH) / 5.3) * 10, 352];
	const pow = interpolate(frame, [CLASH, CLASH + 5, 262, 300], [0, 1, 1, 0], clamp);
	const ball = interpolate(frame, [CLASH, CLASH + 10, 262, 300], [0, 160, 150, 0], {...clamp, easing: Easing.out(Easing.cubic)}) * (1 + 0.06 * Math.sin(frame * 0.9));
	const shock1 = interpolate(frame, [CLASH, CLASH + 40], [0, 1], clamp);
	const shock2 = interpolate(frame, [205, 245], [0, 1], clamp);
	const punch = track(frame, [
		[CLASH, 1.28],
		[CLASH + 26, 1.0, Easing.out(Easing.cubic)],
		[300, 1.08],
	]);
	const sk1 = shake(frame, CLASH, 24, 42);
	const sk2 = shake(frame, 205, 11, 26);
	const sk = {x: sk1.x + sk2.x, y: sk1.y + sk2.y, roll: sk1.roll + sk2.roll};
	const tired = interpolate(frame, [262, 305], [1, 0.3], clamp);
	const clashDark = interpolate(frame, [296, TRUCE], [0, 1], clamp);

	// ── 远古合众：停战、儿子们、毁灭 ──
	const cam = landCam(frame);
	const youngerFacing = interpolate(frame, [TRUCE + 30, TRUCE + 52], [-1, 1], {...clamp, easing: EASE});
	const rimCalm = interpolate(frame, [TRUCE + 20, TRUCE + 80], [0, 1], clamp);
	const mixRgb = (a: string, k: number) =>
		a
			.split(',')
			.map(Number)
			.map((v) => Math.round(v + (255 - v) * k))
			.join(',');
	const skySplit = interpolate(frame, [TRUCE, TRUCE + 80, SONS + 10, SONS + 50], [0.85, 0, 0, 0.9], clamp);
	const landBolts = [SONS + 40, SONS + 62, RUIN + 20, RUIN + 40, RUIN + 65, RUIN + 80];
	const landFlick = landBolts.reduce((m, b) => Math.max(m, interpolate(frame - b, [0, 1, 6], [0, 1, 0], clamp)), 0);
	const heroAlpha = interpolate(frame, [SONS, SONS + 20], [1, 0], clamp);
	const sonsIn = interpolate(frame, [SONS + 8, SONS + 30], [0, 1], clamp);
	const town = interpolate(frame, [RUIN + 40, RUIN + 105], [1, 0], {...clamp, easing: Easing.in(Easing.quad)});
	const lights = interpolate(frame, [RUIN + 20, RUIN + 50], [1, 0], clamp);
	const landDark = Math.max(
		interpolate(frame, [TRUCE, TRUCE + 16], [1, 0], clamp),
		interpolate(frame, [FALL - 28, FALL], [0, 1], clamp),
	);
	const burn = interpolate(frame, [RUIN + 25, RUIN + 50, FALL - 30, FALL], [0, 1, 1, 0], clamp);
	const dragonsSky = interpolate(frame, [RUIN + 5, RUIN + 25, FALL - 40, FALL - 15], [0, 1, 1, 0], clamp);

	const phase = frame < CLASH ? 'face' : frame < TRUCE ? 'clash' : frame < FALL ? 'land' : 'fall';

	return (
		<AbsoluteFill style={{background: '#000'}}>
			{phase === 'face' && <Faceoff time={t} push={facePush} charge={charge} close={close} flick={faceFlick} seam={charge * 30} />}

			{phase === 'clash' && (
				<AbsoluteFill style={{transform: `translate(${sk.x}px, ${sk.y}px) rotate(${sk.roll}deg) scale(${punch})`, transformOrigin: `${c[0]}px ${c[1]}px`}}>
					<Beams time={t} a={[610, 318]} b={[1478, 372]} c={c} pow={pow} ball={ball} shock={shock1 > 0 && shock1 < 1 ? shock1 : shock2} dust={1} />
					<DragonArt
						name="reshiram"
						x={330}
						y={560}
						size={760}
						reveal={1}
						brightness={tired}
						rim={{dir: [1, -0.3], color: [2.2, 2.0, 1.8].map((v) => v * pow) as [number, number, number], power: 2}}
						rimAfter={1}
					/>
					<DragonArt
						name="zekrom"
						x={1590}
						y={560}
						size={780}
						reveal={1}
						brightness={tired}
						rim={{dir: [-1, -0.3], color: [1.2, 2.0, 3.0].map((v) => v * pow) as [number, number, number], power: 2}}
						rimAfter={1}
					/>
					<AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 14%, transparent 30%)'}} />
					<AbsoluteFill style={{background: '#000', opacity: clashDark}} />
				</AbsoluteFill>
			)}

			{phase === 'land' && (
				<>
					<Stage
						time={t}
						cam={cam}
						dark={landDark}
						hideVoid
						sunAmt={0.25}
						skySplit={skySplit}
						flick={landFlick}
						town={town}
						lights={lights}
						youngerFacing={youngerFacing}
						heroAlpha={heroAlpha}
						elderRim={{rgb: mixRgb(ACCENT.warmRgb, rimCalm), amt: 0.95 - rimCalm * 0.5}}
						youngerRim={{rgb: mixRgb(ACCENT.blueRgb, rimCalm), amt: 0.95 - rimCalm * 0.5}}
					>
						{/* 英雄的儿子们：站在岩台两侧的平原上，面对面 */}
						<HeroFigure x={790} y={874} h={138} facing={1} time={t} phase={2.1} rimRgb={ACCENT.warmRgb} rim={0.9} opacity={sonsIn * (1 - landDark)} />
						<HeroFigure x={1130} y={874} h={138} facing={-1} time={t} phase={3.4} rimRgb={ACCENT.blueRgb} rim={0.9} opacity={sonsIn * (1 - landDark)} />
					</Stage>
					{/* 城邦被火焰吞没 */}
					<AbsoluteFill
						style={{
							opacity: burn,
							mixBlendMode: 'screen',
							WebkitMaskImage: 'radial-gradient(ellipse 40% 34% at 66% 84%, #000 40%, transparent 100%)',
							maskImage: 'radial-gradient(ellipse 40% 34% at 66% 84%, #000 40%, transparent 100%)',
						}}
					>
						<ElementBg time={t} c={[1270, 860]} glow={[1, 0.9, 0.8]} glowAmt={1.0} glowR={0.16} flame={1.4} />
					</AbsoluteFill>
					{landBolts.map((b, i) => (
						<Lightning
							key={b}
							at={b}
							seed={`wl${i}`}
							from={[[1500, 1700, 1180, 1320, 1060, 1260][i], -20]}
							to={[[1560, 1640, 1190, 1300, 1120, 1240][i], i < 2 ? 520 : 820]}
							rgb={ACCENT.blueRgb}
							width={3}
						/>
					))}
					{/* 天上的双龙剪影 */}
					<AbsoluteFill style={{opacity: dragonsSky}}>
						<DragonArt name="reshiram" x={520} y={250} size={330} reveal={0} rim={{dir: [0.6, -1], color: [2.6, 2.3, 1.9], power: 2}} />
						<DragonArt name="zekrom" x={1520} y={240} size={330} reveal={0} rim={{dir: [-0.6, -1], color: [0.9, 1.9, 3.2], power: 2}} />
					</AbsoluteFill>
				</>
			)}

			{phase === 'fall' && (
				<>
					<ElementBg time={t} bg={[0, 0, 0]} frost={0.35} frostCol={[0.55, 0.55, 0.55]} />
					<FallingStones g={g} />
				</>
			)}

			<Flash at={CLASH - 3} len={16} peak={1} />
			<Flash at={205} len={8} peak={0.45} />
			<Flash at={RUIN + 65} len={10} peak={0.5} />

			<Vignette strength={0.75} />

			<Cry name="reshiram" at={CLASH + 1} volume={0.9} />
			<Cry name="zekrom" at={CLASH + 8} volume={0.9} />

			<BiSubtitle tone="mono" zh="可它们本是一体，力量不分上下。" en="But they had been one, and they were evenly matched." from={6} to={98} source={{zh: '黑白·夏卡', en: 'B/W Drayden'}} />
			<BiSubtitle
				tone="mono"
				zh="这场战斗，永远分不出胜负。"
				en="The battle raged on, and neither could win."
				from={CLASH + 22}
				to={262}
				source={{zh: '黑白·夏卡', en: 'B/W Drayden: ...their battle raged endlessly and neither one could be declared the winner'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="最后，英雄宣告：没有哪一方是对的。"
				en="At last the heroes proclaimed that neither side was right."
				from={TRUCE + 6}
				to={SONS - 4}
				source={{zh: '黑白·夏卡', en: 'B/W Drayden: The twin heroes proclaimed that there was no one side that was right'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="可到了英雄的儿子们，战火又起。"
				en="But the heroes' sons started the war again."
				from={SONS + 4}
				to={RUIN - 4}
				source={{zh: '黑白·艾莉丝', en: "B/W Iris: The two heroes' sons started the battle again!"}}
			/>
			<BiSubtitle
				tone="mono"
				zh="双龙用火焰和雷电毁灭了合众，然后消失了。"
				en="The dragons destroyed Unova with fire and lightning, then vanished."
				from={RUIN + 6}
				to={FALL - 6}
				source={{zh: '黑白·艾莉丝', en: 'B/W Iris: Reshiram and Zekrom destroyed Unova with fire and lightning! Then, they disappeared!'}}
			/>
			<BiSubtitle
				tone="mono"
				zh="剧场版把这段故事改成了国王的双胞胎王子；在游戏里，双龙本是一条龙。"
				en="The movie made it a tale of a king's twin princes. In the games, the two dragons were once one."
				from={FALL + 4}
				to={WAR_SCENE_FRAMES - 2}
				source={{zh: '剧场版第 14 部（动画差异）', en: 'Movie 14 vs. B/W'}}
			/>

			<Grain opacity={0.12} frameOffset={SEG_START.war} />
		</AbsoluteFill>
	);
};
