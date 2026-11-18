import {AbsoluteFill} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {Cam, track} from '../../camera';
import {useFrame} from '../../time';
import {HOOK_SCENE_FRAMES, LAMP, globalFrame, globalTime} from './continuity';
import {CityBg, EpisodeTitle, onScreen} from './Oil';

export {HOOK_SCENE_FRAMES};

/**
 * 第 1 段《三千年》（开场钩子 + 标题，11 秒）：
 * 夜晚的密阿雷，一盏路灯下，一个高大的身影（ＡＺ XY 立绘，逆光剪影、看不清面目）。
 * 镜头慢慢推近 → 本期标题《永恒之花》（夜空里）。结尾路灯在画面右侧，第 2 段由这盏灯的光化成远古的落日。
 */

/** ＡＺ（世界坐标，立绘中心） */
export const AZ = {x: 1120, y: 690, size: 450};

export const hookCam = (frame: number): Cam => ({
	x: track(frame, [
		[0, 1040],
		[HOOK_SCENE_FRAMES, 967],
	]),
	y: track(frame, [
		[0, 570],
		[HOOK_SCENE_FRAMES, 464],
	]),
	zoom: track(frame, [
		[0, 1.0],
		[HOOK_SCENE_FRAMES, 1.3],
	]),
	roll: 0,
});

/**
 * 第 1 段的画面（夜晚街道 + ＡＺ剪影）。第 2 段开头、第 6 段结尾（回到这条街）也用它：
 * time / night / desat / tint 可单独指定（整期时间轴、黄昏、冷色调）。
 */
export const HookView: React.FC<{frame: number; time?: number; night?: number; desat?: number; tint?: [number, number, number]; opacity?: number}> = ({
	frame,
	time,
	night = 1,
	desat = 0,
	tint = [1, 1, 1],
	opacity = 1,
}) => {
	const t = time ?? globalTime('hook', frame);
	const cam = hookCam(frame);
	const az = onScreen(cam, AZ);
	const lamp = onScreen(cam, LAMP);
	return (
		<AbsoluteFill style={{opacity}}>
			<CityBg time={t} cam={cam} night={night} lamp={1} desat={desat} tint={tint} />
			{/* ＡＺ：路灯下的逆光剪影 */}
			<PokemonArt3D
				dir="trainers/az"
				variant="-xy"
				x={az.x}
				y={az.y}
				size={AZ.size * az.s}
				depthScale={0.5}
				ambient={[0.004, 0.0045, 0.007]}
				dirLights={[{dir: [-0.6, -0.3, 0.5], color: [0.006, 0.009, 0.016], wrap: 0.5}]}
				rim={{dir: [lamp.x - az.x, lamp.y - az.y], color: [0.55, 0.32, 0.14], power: 3}}
			/>
		</AbsoluteFill>
	);
};

export const HookScene: React.FC = () => {
	const frame = useFrame();

	return (
		<AbsoluteFill style={{background: '#05070d'}}>
			<HookView frame={frame} />

			<Vignette strength={0.7} />

			<BiSubtitle zh="有一个人，等了三千年。" en="There was a man who waited three thousand years." from={24} to={126} />
			<BiSubtitle zh="他在等一只宝可梦。" en="He was waiting for a Pokémon." from={134} to={214} />

			<EpisodeTitle from={222} to={HOOK_SCENE_FRAMES - 4} y={300} />

		</AbsoluteFill>
	);
};
