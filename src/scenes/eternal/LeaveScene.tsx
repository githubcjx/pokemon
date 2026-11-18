import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Cam, track} from '../../camera';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {LEAVE_SCENE_FRAMES, WEAPON_SCENE_FRAMES, globalFrame, globalTime} from './continuity';
import {Crystal, Glow, MeadowBg, onScreen} from './Oil';
import {FLOETTE_SIZE, FloetteArt, PastFigures, SUN} from './Past';
import {warRim} from './WarScene';
import {weaponCam, weaponCrystal, weaponFloette, weaponLook} from './WeaponScene';

export {LEAVE_SCENE_FRAMES};

/**
 * 第 5 段《离开》（22 秒，情感低谷）：
 * 焦土上，花叶蒂慢慢飘离国王身边 → 飞向灰色的天空，越来越小，消失 → 国王伸着手，镜头慢慢拉远，只剩他一个人；灰烬飘落。
 */

const cam0 = weaponCam(WEAPON_SCENE_FRAMES);
const look0 = weaponLook(WEAPON_SCENE_FRAMES);
const crystal0 = weaponCrystal(WEAPON_SCENE_FRAMES);

const GO: [number, number] = [180, 335]; // 飞走

export const leaveCam = (f: number): Cam => ({
	x: track(f, [
		[0, cam0.x],
		[170, 950],
		[330, 1000],
		[560, 960],
		[LEAVE_SCENE_FRAMES, 958],
	]),
	y: track(f, [
		[0, cam0.y],
		[170, 590],
		[330, 560],
		[560, 570],
		[LEAVE_SCENE_FRAMES, 572],
	]),
	zoom: track(f, [
		[0, cam0.zoom],
		[170, 1.5],
		[330, 1.4],
		[560, 0.96],
		[LEAVE_SCENE_FRAMES, 0.95],
	]),
	roll: 0,
});

export const leaveLook = () => look0;
export const leaveCrystal = (f: number): Crystal => ({
	...crystal0,
	weapon: crystal0.weapon && {...crystal0.weapon, charge: crystal0.weapon.charge * (1 - 0.6 * interpolate(f, [0, 400], [0, 1], clamp))},
});

export const LeaveScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('leave', frame);
	const cam = leaveCam(frame);

	// 花叶蒂：先慢慢飘离，再飞向天空
	const base = weaponFloette(WEAPON_SCENE_FRAMES + frame, t);
	const drift = interpolate(frame, [0, 170], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const go = interpolate(frame, GO, [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	const p1 = {x: base.x + 70 * drift, y: base.y - 24 * drift};
	const fp = {x: p1.x + (1760 - p1.x) * go, y: p1.y + (240 - p1.y) * go};
	const fSize = FLOETTE_SIZE * (1 - 0.82 * go);
	const fO = 1 - interpolate(frame, [GO[1] - 45, GO[1]], [0, 1], clamp);
	const fs = onScreen(cam, fp);

	// 剪影的逆光由刺白回到灰
	const r = interpolate(frame, [0, 200], [0, 1], clamp);
	const rimRgb = r < 1 ? [255 + (196 - 255) * r, 236 + (176 - 236) * r, 214 + (160 - 214) * r].map(Math.round).join(',') : warRim(1);

	return (
		<AbsoluteFill style={{background: '#0a0705'}}>
			<MeadowBg time={t} cam={cam} sun={SUN} look={leaveLook()} crystal={leaveCrystal(frame)} />
			<PastFigures cam={cam} motherOpacity={0} kingPose="hold" rim={0.69 - 0.14 * r} rimRgb={rimRgb} />

			{fO > 0 && <Glow x={fs.x} y={fs.y} r={300 * fs.s * (1 - 0.6 * go)} rgb="255,214,150" amt={0.2 * fO * (1 - 0.4 * go)} />}
			{fO > 0 && <FloetteArt cam={cam} p={fp} reveal={1} time={t} desat={0.25} opacity={fO} size={fSize} />}

			{/* 灰烬 */}
			<DustMotes opacity={interpolate(frame, [200, 420], [0, 0.5], clamp)} rgb="196,188,180" frameOffset={globalFrame('leave', 0)} />

			<Vignette strength={0.67 + 0.05 * interpolate(frame, [340, 560], [0, 1], clamp)} />

			<BiSubtitle zh="「但花叶蒂应该是知道的。我赋予它的生命是从其他宝可梦那里夺来的。」" en={'"But Floette must have known the truth. She must have realized that the life I had given her was stolen from so many other Pokémon."'} from={16} to={176} source={{zh: '传说 Z-A·ＡＺ屋顶自白（官方中文）', en: 'Legends: Z-A, AZ on the roof'}} />
			<BiSubtitle zh="复活的花叶蒂，离开了他。" en="The revived Floette left him." from={186} to={300} source={{zh: 'XY·ＡＺ："复活的宝可梦离开了男子"', en: 'X/Y AZ: "The resurrected Pokémon left the man."'}} />
			<BiSubtitle zh="明明是为了能再在一起，才让它活过来的。" en="He had brought it back so they could be together." from={352} to={496} source={{zh: 'XY 石香镇·ＡＺ', en: 'X/Y AZ: "He had revived it so they could be together…"'}} />

		</AbsoluteFill>
	);
};
