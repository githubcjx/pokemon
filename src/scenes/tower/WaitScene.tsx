import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {flow} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {V3} from '../../three/stage';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {Gust, lookFrom, NightField} from './NightField';

// ─── 第 6 段《等待》（900 帧 = 30 秒，今·月夜）──────────────────────────────────
// 接第 5 段满屏的墨：墨从中间化开，露出月夜里的废墟（字幕一：一百五十年）
// → 镜头降到草丛高度，慢慢转向西边的原野，三阵风先后掠过草丛（字幕二：像风一样飞奔、一遇见就逃走）
// → 草丛里（字幕三：它们只会靠近自己认可的人——把"逃走"接到"信任"上）
// → 继续转向东北，月雾里立着完好的东塔（字幕四：无数人想把凤王唤回来，没有人成功）
// → 微微仰起，月亮挂在东塔上方，起一圈淡淡的七色月晕（字幕五：看不见的信任）→ 接第 7 段的破晓
// 用户 2026-10-02 要求：只用游戏里有明确原文的事件；结尾太突兀，改为第 6 段铺垫"信任"、第 7 段降临收尾。
export const WAIT_SCENE_FRAMES = 900;

const T = {
	clear: [0, 140] as const,
	sub1: [48, 160] as const,
	grass: [190, 300] as const,
	sub2: [232, 392] as const,
	gusts: [262, 298, 336] as const,
	sub3: [412, 540] as const,
	sub4: [566, 712] as const,
	corona: [700, 890] as const,
	sub5: [738, 888] as const,
};

/** 三阵风：从画面右侧掠向左侧（西边的原野深处），各带一点雷 / 火 / 雨的淡彩 */
const GUSTS: Gust[] = T.gusts.map((at, i) => ({at, y: [870, 900, 884][i], wash: ['232,196,96', '206,82,44', '96,140,190'][i]}));

/**
 * 机位：0–170 从废墟西北侧俯看废墟 → 降到草丛高度、转身望向西边的原野 → 继续转到东北的东塔 → 仰望月亮。
 * 第 7 段从本段最后一帧接着走（getWaitCamera(WAIT_SCENE_FRAMES)）。
 */
export const getWaitCamera = (f: number) => {
	const pos: V3 = [
		flow(f, [
			[0, -14],
			[170, -9],
			[320, -4],
			[470, -1],
			[600, 0],
		]),
		flow(f, [
			[0, 9],
			[170, 5],
			[320, 1.5],
			[470, 1.4],
			[900, 1.45],
		]),
		flow(f, [
			[0, -31],
			[170, -24],
			[320, -27],
			[470, -28.5],
			[600, -29],
			[900, -29.4],
		]),
	];
	const yaw = flow(f, [
		[0, 24],
		[170, 20],
		[320, -75],
		[470, -140],
		[590, -184],
		[800, -188],
		[900, -188.3],
	]);
	const pitch = flow(f, [
		[0, -9],
		[170, -6],
		[320, -1],
		[470, 1],
		[600, 5],
		[820, 10.5],
		[900, 11],
	]);
	const fov = flow(f, [
		[0, 36],
		[470, 36],
		[820, 40],
		[900, 40],
	]);
	return lookFrom(pos, yaw, pitch, fov);
};

/** 月晕强度（第 7 段接着用） */
export const waitCorona = (f: number) =>
	interpolate(f, T.corona, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)}) * (0.85 + 0.15 * Math.sin(f / 40));
export const waitWarmCore = (f: number) => interpolate(f, [T.sub5[0], T.sub5[0] + 90], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});

export const WaitScene: React.FC = () => {
	const f = useFrame();
	const cam = getWaitCamera(f);

	// 墨从中间化开（f = 0 时满屏是第 5 段最后的墨色）
	const clearR = interpolate(f, [T.clear[0], T.clear[1]], [0, 1750], {...clamp, easing: Easing.inOut(Easing.sin)});
	const grassO = interpolate(f, T.grass, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});

	return (
		<AbsoluteFill style={{background: '#0d0b09', overflow: 'hidden'}}>
			<NightField f={f} cam={cam} corona={waitCorona(f)} warmCore={waitWarmCore(f)} grassO={grassO} gusts={GUSTS} />
			<SubtitleBackdrop />

			{/* 墨从中间化开 */}
			{f < T.clear[1] ? (
				<svg width={1920} height={1080} style={{position: 'absolute'}}>
					<defs>
						<filter id="inkClearEdge" x="-10%" y="-10%" width="120%" height="120%">
							<feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves={4} seed={23} result="n" />
							<feDisplacementMap in="SourceGraphic" in2="n" scale={180} />
							<feGaussianBlur stdDeviation={18} />
						</filter>
						<mask id="inkClearM" maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}>
							<rect width={1920} height={1080} fill="#fff" />
							<circle cx={960} cy={520} r={clearR} fill="#000" filter="url(#inkClearEdge)" />
						</mask>
					</defs>
					<rect width={1920} height={1080} fill="#0d0b09" mask="url(#inkClearM)" />
				</svg>
			) : null}

			{/* 旁白（制作者撰写） */}
			<BiSubtitle from={T.sub1[0]} to={T.sub1[1]} zh="一百五十年过去了。" en="A hundred and fifty years have passed." source={{zh: '旁白', en: 'NARRATION'}} />
			{/* 旁白（制作者撰写）：依据金·烧焦塔 1F 喷火人 "In the past, there were these #MON that ran through grass at super-high speed. They say that they run like the wind. If you run into one in grass, it will likely bolt." */}
			<BiSubtitle
				from={T.sub2[0]}
				to={T.sub2[1]}
				zh="人们说，草丛里有像风一样飞奔的宝可梦，一旦遇见，它们就会立刻逃走。"
				en="They say some Pokémon run through the grass like the wind. Meet one, and it will likely bolt."
				source={{zh: '旁白（依据金·烧焦塔）', en: 'NARRATION (after GOLD · Burned Tower)'}}
			/>
			{/* 旁白（制作者撰写）：依据心金魂银·烧焦塔地下 米那季 "Ecruteak's legendary Pokémon are said to come to people only when they recognize their talents." */}
			<BiSubtitle
				from={T.sub3[0]}
				to={T.sub3[1]}
				zh="据说，它们只会靠近自己认可的人。"
				en="It is said they come to people only when they recognize them."
				source={{zh: '旁白（依据心金魂银·米那季）', en: 'NARRATION (after HGSS · Eusine)'}}
			/>
			{/* 旁白（制作者撰写）：依据心金魂银·铃铛塔 "So many people have gone up the tower with a Rainbow Wing to try and bring back HO-OH. But none succeeded in making HO-OH appear..." */}
			<BiSubtitle
				from={T.sub4[0]}
				to={T.sub4[1]}
				zh="无数人登上东边的那座塔，想把凤王唤回来，却没有一个人成功。"
				en="So many have climbed the eastern tower to bring Ho-Oh back. None have succeeded."
				source={{zh: '旁白（依据心金魂银·铃铛塔）', en: 'NARRATION (after HGSS · Bell Tower)'}}
			/>
			{/* 旁白（制作者撰写）：依据心金魂银·铃铛塔 "What HO-OH has longed for is the invisible trust between people and Pokémon..." */}
			<BiSubtitle
				from={T.sub5[0]}
				to={T.sub5[1]}
				zh="凤王所期待的，是人与宝可梦之间，那份看不见的信任。"
				en="What Ho-Oh has longed for is the invisible trust between people and Pokémon."
				source={{zh: '旁白（依据心金魂银·铃铛塔）', en: 'NARRATION (after HGSS · Bell Tower)'}}
			/>
			<Grain opacity={interpolate(f, [0, T.clear[1]], [0.05, 0.1], clamp)} />
		</AbsoluteFill>
	);
};
