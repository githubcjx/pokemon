import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, track} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer, Vignette} from '../../components/CamLayer';
import {PrimordialSea} from '../../components/Elements';
import {Helix} from '../../components/effects/Helix';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// ─── 第 2 期 · 第 6 段「尾声」（600 帧 = 20 秒）──────────────────────────
// 从大陆间的海沉入远古之海 → 一点生命之光 → 金色双螺旋展开 → 梦幻的剪影 → 官方图鉴解说 → 淡出
// 按规则：不出现"下一期"等字眼；梦幻只以剪影出现，不配叫声。
export const ENDING2_SCENE_FRAMES = 600;

const T = {
	lightIn: [0, 90] as const,
	subAsk: [40, 156] as const,
	helix: [150, 240] as const,
	mewIn: [200, 300] as const,
	subDex: [306, 470] as const,
	fadeOut: [540, 600] as const,
};

const LIGHT = {x: 960, y: 500};

const getCam = (frame: number): Cam => ({
	x: 960,
	y: 520,
	zoom: track(frame, [
		[0, 0.94],
		[T.mewIn[1], 1.02],
		[ENDING2_SCENE_FRAMES, 1.08],
	]),
	roll: 0,
});

export const EndingScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);
	const glow = interpolate(frame, [T.lightIn[0], T.lightIn[1], T.mewIn[0], T.mewIn[1]], [0, 0.7, 0.7, 1], clamp);
	const fromDark = interpolate(frame, [0, 36], [1, 0], clamp);
	const fadeOut = interpolate(frame, [T.fadeOut[0], T.fadeOut[1] - 1], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});

	// 梦幻的剪影：从生命之光中浮现，逆光只留粉色轮廓
	const mewIn = interpolate(frame, [T.mewIn[0], T.mewIn[1]], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const floatY = Math.sin(frame / 34) * 10;
	const helixO = interpolate(frame, [T.fadeOut[0] - 20, T.fadeOut[1]], [1, 0.4], clamp);

	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			<CamLayer cam={cam} k={0.3}>
				<PrimordialSea light={[LIGHT.x / 1920, LIGHT.y / 1080]} glow={glow} />
			</CamLayer>
			<CamLayer cam={cam} k={1}>
				<Helix x={LIGHT.x} y={LIGHT.y + 30} length={1500} radius={150} turns={3.2} revealFrom={T.helix[0]} revealFrames={T.helix[1] - T.helix[0]} layer="back" opacity={helixO} />
				{mewIn > 0 && (
					<PokemonArt3D
						dir="pokemon/mew"
						x={LIGHT.x}
						y={LIGHT.y + floatY}
						size={interpolate(mewIn, [0, 1], [560, 640])}
						yaw={Math.sin(frame / 60) * 3}
						pitch={2}
						opacity={mewIn}
						depthScale={0.5}
						// 剪影：不受正面光照，只有身后生命之光勾出的轮廓
						ambient={[0, 0, 0]}
						rim={{dir: [0, -0.3], color: [1.4, 0.65, 1.0], power: 1.4}}
						style={{filter: `drop-shadow(0 0 4px rgba(255,170,215,${0.9 * mewIn})) drop-shadow(0 0 24px rgba(255,150,200,${0.6 * mewIn})) drop-shadow(0 0 60px rgba(255,190,150,${0.35 * mewIn}))`}}
					/>
				)}
				<Helix x={LIGHT.x} y={LIGHT.y + 30} length={1500} radius={150} turns={3.2} revealFrom={T.helix[0]} revealFrames={T.helix[1] - T.helix[0]} layer="front" opacity={helixO} />
			</CamLayer>
			<Vignette strength={0.6} />

			<SubtitleBackdrop />
			{/* 旁白（制作者撰写）：引出下一个主题，不出现"下一期"字样 */}
			<BiSubtitle
				from={T.subAsk[0]}
				to={T.subAsk[1]}
				zh="然而，宝可梦又是从何而来？"
				en="But where did Pokémon themselves come from?"
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<BiSubtitle
				from={T.subDex[0]}
				to={T.subDex[1]}
				zh="因为能使用所有的招式，所以有很多学者认为它是宝可梦的祖先。"
				en="Because it can use all kinds of moves, many scientists believe Mew to be the ancestor of Pokémon."
				source={{zh: '梦幻图鉴《晶灿钻石·明亮珍珠》', en: 'POKÉDEX · DIAMOND'}}
			/>
			<Grain />
			{fromDark > 0 && <AbsoluteFill style={{background: '#000', opacity: fromDark}} />}
			{fadeOut > 0 && <AbsoluteFill style={{background: '#000', opacity: fadeOut}} />}
		</AbsoluteFill>
	);
};
