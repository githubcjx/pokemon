import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Cam, track} from '../../camera';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {GIFT_SCENE_FRAMES, WAR_SCENE_FRAMES, globalFrame, globalTime} from './continuity';
import {floettePos, giftCam} from './GiftScene';
import {GOLDEN, Glow, MeadowBg, TinyBox, WARTIME, handOf, mixLook, onScreen} from './Oil';
import {FloetteArt, GROUND, KING, PastFigures, SUN} from './Past';

export {WAR_SCENE_FRAMES};

/**
 * 第 3 段《战争》（20 秒，色彩褪去）：
 * 接第 2 段的近景，镜头拉远；母亲的身影淡去（她已不在）→ 地平线上升起烟柱与火光，原野一点点褪成灰褐 →
 * 花叶蒂被带向远处的战火，越来越小、褪色、消失 → 几年后，国王手里只有一个小小的箱子；镜头推近，静止。
 * ＡＺ亲口的原话加「」（传说 Z-A 屋顶自白，官方中文）。
 */

const TAKEN: [number, number] = [150, 292]; // 花叶蒂被带走
const BOX_IN = 330; // 箱子出现

const cam0 = giftCam(GIFT_SCENE_FRAMES);

export const warCam = (f: number): Cam => ({
	x: track(f, [
		[0, cam0.x],
		[170, 960],
		[320, 972],
		[470, 900],
		[WAR_SCENE_FRAMES, 896],
	]),
	y: track(f, [
		[0, cam0.y],
		[170, 600],
		[320, 604],
		[470, 690],
		[WAR_SCENE_FRAMES, 694],
	]),
	zoom: track(f, [
		[0, cam0.zoom],
		[170, 1.08],
		[320, 1.1],
		[470, 2.3, Easing.inOut(Easing.cubic)],
		[WAR_SCENE_FRAMES, 2.4],
	]),
	roll: 0,
});

/** 色彩褪去的进度 */
export const warFade = (f: number) => interpolate(f, [30, 440], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
/** 原野的样子：色彩褪去、烟柱升起 */
export const warLook = (f: number) => ({...mixLook(GOLDEN, WARTIME, warFade(f)), smoke: interpolate(f, [30, 280], [0, 1], clamp), fire: interpolate(f, [60, 260], [0, 0.75], clamp)});
/** 剪影的逆光颜色（由暖转灰） */
export const warRim = (w: number) => [255 + (196 - 255) * w, 190 + (176 - 190) * w, 110 + (160 - 110) * w].map(Math.round).join(',');

export const WarScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('war', frame);
	const cam = warCam(frame);

	const w = warFade(frame);
	const look = warLook(frame);

	// 花叶蒂：先停在国王手边，然后被带向远处的战火
	const base = floettePos(GIFT_SCENE_FRAMES + frame, t);
	const go = interpolate(frame, TAKEN, [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	const fp = {x: base.x + (1530 - base.x) * go, y: base.y + (640 - base.y) * go - Math.sin(go * Math.PI) * 60};
	const fSize = 116 * (1 - go * 0.82);
	const fO = 1 - interpolate(frame, [TAKEN[1] - 50, TAKEN[1]], [0, 1], clamp);
	const fDesat = interpolate(frame, [TAKEN[0], TAKEN[1]], [0, 0.9], clamp);
	const fs = onScreen(cam, fp);
	const heart = interpolate(frame, [0, TAKEN[0] + 40], [0.45, 0], clamp);

	// 剪影：母亲淡去；逆光由暖转灰
	const motherO = 1 - interpolate(frame, [20, 130], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const rimRgb = warRim(w);

	// 小小的箱子
	const king = onScreen(cam, {x: KING.x, y: GROUND});
	const hand = handOf('king', king.x, king.y, KING.h * king.s, 'right');
	const boxO = interpolate(frame, [BOX_IN, BOX_IN + 36], [0, 1], clamp);

	return (
		<AbsoluteFill style={{background: '#0a0705'}}>
			<MeadowBg time={t} cam={cam} sun={SUN} look={look} />
			<PastFigures cam={cam} motherOpacity={motherO} kingPose="hold" rim={0.9 - 0.35 * w} rimRgb={rimRgb} />

			<Glow x={fs.x} y={fs.y} r={260 * fs.s} rgb="255,214,150" amt={0.35 * heart} />
			{fO > 0 && <FloetteArt cam={cam} p={fp} reveal={1} time={t} desat={fDesat} opacity={fO} size={fSize} />}
			{boxO > 0 && <TinyBox x={hand.x - 6 * king.s} y={hand.y + 4 * king.s} w={44 * king.s} opacity={boxO} rimRgb={rimRgb} rim={0.35} />}

			<DustMotes opacity={0.55 * (1 - w)} rgb="255,214,150" frameOffset={globalFrame('war', 0)} />

			<Vignette strength={0.5 + 0.2 * w} />

			<BiSubtitle zh="「3000年前的那场战争夺走了很多东西。」" en={'"In the war that occurred three thousand years ago, many things were lost."'} from={20} to={148} source={{zh: '传说 Z-A·ＡＺ屋顶自白（官方中文）', en: 'Legends: Z-A, AZ on the roof'}} />
			<BiSubtitle zh="「我的花叶蒂也被赶上战场……失去了性命。」" en={'"And my Floette was sent to the front line... where she lost her life."'} from={158} to={302} source={{zh: '传说 Z-A·ＡＺ屋顶自白（官方中文）', en: 'Legends: Z-A, AZ on the roof'}} />
			<BiSubtitle zh="几年后，他只得到了一个小小的箱子。" en="Years later, all he was given was a tiny box." from={336} to={476} source={{zh: 'XY·弗拉达利研究所·ＡＺ（日：小さな 箱を 渡された）', en: 'X/Y AZ: "Several years passed." "He was given a tiny box."'}} />

		</AbsoluteFill>
	);
};
