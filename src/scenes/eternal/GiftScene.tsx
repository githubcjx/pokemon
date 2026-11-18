import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {DustMotes} from '../../components/DustMotes';
import {NameTag} from '../../components/NameTag';
import {Cam, track} from '../../camera';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {GIFT_SCENE_FRAMES, HOOK_SCENE_FRAMES, globalFrame, globalTime} from './continuity';
import {HookView} from './HookScene';
import {GOLDEN, Glow, MeadowBg, onScreen} from './Oil';
import {FloetteArt, LAMP_SCREEN_END, MEADOW_CAM0, PastFigures, SUN, sunOnScreen} from './Past';

export {GIFT_SCENE_FRAMES};

/**
 * 第 2 段《母亲的礼物》（22 秒，昔·暖金）：
 * 第 1 段那盏路灯的光涨满画面，化成三千年前卡洛斯原野上的落日 →
 * 年轻的国王与母亲（剪影）；远山上的城堡 → 母亲手里浮起一只花叶蒂（逆光剪影 → 显色，叫声 + 名称卡）→
 * 它飘到国王手边；"他非常爱它"。
 */

const BLOOM = 26; // 灯光涨满
const REVEAL: [number, number] = [218, 300]; // 花叶蒂显色（峰值 = 叫声）

export const giftCam = (f: number): Cam => ({
	x: track(f, [
		[0, MEADOW_CAM0.x],
		[190, 960],
		[300, 950],
		[470, 946],
		[620, 900],
		[GIFT_SCENE_FRAMES, 896],
	]),
	y: track(f, [
		[0, MEADOW_CAM0.y],
		[190, 598],
		[300, 612],
		[470, 614],
		[620, 646],
		[GIFT_SCENE_FRAMES, 648],
	]),
	zoom: track(f, [
		[0, 1],
		[190, 1.06],
		[300, 2.1, Easing.inOut(Easing.cubic)],
		[470, 2.16],
		[620, 1.62],
		[GIFT_SCENE_FRAMES, 1.6],
	]),
	roll: 0,
});

/** 花叶蒂的位置：从母亲手里浮起 → 飘到国王手边，之后轻轻上下浮动 */
export const floettePos = (f: number, time: number) => {
	const x = track(f, [
		[REVEAL[0] - 10, 1010],
		[REVEAL[1], 968],
		[430, 916],
	]);
	const y = track(f, [
		[REVEAL[0] - 10, 628],
		[REVEAL[1], 588],
		[430, 584],
	]);
	return {x, y: y + Math.sin(time * 1.6) * 5};
};

export const GiftScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('gift', frame);
	const cam = giftCam(frame);

	// 开场：路灯的光涨满 → 原野显出，光退成落日
	const bloomUp = interpolate(frame, [0, BLOOM - 6], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const bloomDown = interpolate(frame, [BLOOM + 6, 96], [1, 0], {...clamp, easing: Easing.out(Easing.quad)});
	const bloom = Math.min(bloomUp, bloomDown);
	const cityO = 1 - interpolate(frame, [BLOOM - 6, BLOOM + 4], [0, 1], clamp);
	const bloomR = interpolate(frame, [0, BLOOM - 6, 96], [260, 2600, 900], clamp);
	const sunS = sunOnScreen(cam);
	const bloomX = frame < BLOOM + 6 ? LAMP_SCREEN_END.x : sunS.x;
	const bloomY = frame < BLOOM + 6 ? LAMP_SCREEN_END.y : sunS.y;

	const appear = interpolate(frame, [REVEAL[0] - 14, REVEAL[0] + 10], [0, 1], clamp);
	const reveal = interpolate(frame, REVEAL, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const fp = floettePos(frame, t);
	const fs = onScreen(cam, fp);
	const heartGlow = interpolate(frame, [REVEAL[0], REVEAL[1], REVEAL[1] + 50, 470], [0, 1, 0.7, 0.45], clamp);

	return (
		<AbsoluteFill style={{background: '#0a0705'}}>
			<MeadowBg time={t} cam={cam} sun={SUN} look={GOLDEN} />
			<PastFigures cam={cam} motherPose="hold" kingPose="hold" />

			{/* 花叶蒂身边的暖光 */}
			<Glow x={fs.x} y={fs.y} r={260 * fs.s} rgb="255,214,150" amt={0.35 * heartGlow * appear} />
			{appear > 0 && <FloetteArt cam={cam} p={fp} reveal={reveal} time={t} opacity={appear} />}

			<DustMotes opacity={0.55} rgb="255,214,150" frameOffset={globalFrame('gift', 0)} />

			{/* 第 1 段接续：夜晚的街道，在路灯的光里化开 */}
			{cityO > 0 && <HookView frame={HOOK_SCENE_FRAMES + frame} opacity={cityO} />}
			<Glow x={bloomX} y={bloomY} r={bloomR} rgb="255,228,176" amt={bloom * 1.6} blend="normal" />

			<Vignette strength={interpolate(frame, [0, 60], [0.7, 0.5], clamp)} />

			<BiSubtitle zh="三千年前，他是卡洛斯的国王。" en="Three thousand years ago, he was the king of Kalos." from={84} to={190} source={{zh: 'XY·弗拉达利："和三千年前的一位国王同名"', en: 'X/Y Lysandre: "the same name as a king that lived 3,000 years ago"'}} />
			<BiSubtitle
				zh="母亲送给他一只花叶蒂，它抱着一朵罕见的黑花。"
				en="His mother gave him a Floette, holding a rare black flower."
				from={198}
				to={318}
				source={{zh: 'Z-A·ＡＺ遗书', en: 'Legends: Z-A, AZ\'s letter: "my mother giving me my Floette, grasping her rare black flower"'}}
			/>

			<Cry name="floette-eternal" at={REVEAL[1]} />
			{/* 名称卡背后一层很淡的暗晕（亮天空上也读得清） */}
			<Glow x={330} y={175} r={420} rgb="40,26,20" amt={0.45 * interpolate(frame, [REVEAL[1], REVEAL[1] + 20, 480, 500], [0, 1, 1, 0], clamp)} blend="normal" />
			<NameTag from={REVEAL[1] + 6} x={150} y={110} no="No.0670" category="单朵宝可梦" categoryEn="SINGLE BLOOM POKÉMON" zh="花叶蒂" en="FLOETTE" opacity={interpolate(frame, [480, 500], [1, 0], clamp)} />
			<BiSubtitle
				zh="抱着在远古灭绝的植物，是十分罕见的花叶蒂。据说隐藏着强大的力量。"
				en="This rare Floette holds a plant that died out in ancient times. The Pokémon is said to harbor an incredible power."
				from={326}
				to={482}
				source={{zh: '传说 Z-A 图鉴（永恒之花）', en: 'Legends: Z-A Pokédex (Eternal Flower)'}}
			/>
			<BiSubtitle zh="他非常爱它。" en="He loved it very much." from={500} to={612} source={{zh: 'XY·弗拉达利研究所·ＡＺ', en: 'X/Y AZ: "He loved that Pokémon very much."'}} />

		</AbsoluteFill>
	);
};
