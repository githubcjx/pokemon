import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, flow, shake} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Lightning} from '../../components/effects/Lightning';
import {Rain} from '../../components/effects/Rain';
import {Grain} from '../../components/Grain';
import {Glow, InkBlaze} from '../../components/ink/InkBlaze';
import {InkMountains, PaperVignette} from '../../components/ink/InkPaper';
import {PAGODA_TOP, TIERS} from '../../three/pagodaGeometry';
import {Pagoda, PagodaRuin, PagodaVariant} from '../../three/Pagoda';
import {CameraRig, projectToScreen, V3, WeatherLights} from '../../three/stage';
import {SEG_START} from './continuity';
import {TowerMist} from './TowerMist';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// ─── 第 3 段《雷火》（900 帧 = 30 秒，昔·古纸水墨，风雨夜）────────────────────────
// 接第 2 段停在西塔塔顶：墨云压顶（字幕一）→ 一道雷劈中相轮，白闪、震动、镜头猛拉（爆发点）
// → 火从塔顶往下烧，浓墨烟柱翻卷（字幕二：动画与游戏的差别）→ 镜头绕塔，天色三明三暗（字幕三：三天）
// → 塔脚火中的三点微光一一熄灭（字幕四：机位完全静止，只有天光与火光在变——用户 2026-10-02 认可的"关键句停住"）→ 骤雨倾盆，火势退去、水汽腾起（字幕五）
// → 烟雨散开，只剩焦黑的残塔（字幕六）
export const FIRE_SCENE_FRAMES = 900;

const T = {
	storm: [10, 100] as const,
	sub1: [20, 150] as const,
	strike: 105,
	sub2: [168, 330] as const,
	days: [330, 560] as const,
	sub3: [345, 440] as const,
	lights: [455, 485] as const,
	out: [515, 540, 565] as const,
	sub4: [458, 585] as const,
	rain: [588, 640] as const,
	quench: [600, 710] as const,
	sub5: [600, 725] as const,
	toRuin: [700, 770] as const,
	sub6: [748, 870] as const,
};

const WEST: V3 = [-28, 0, 0];
const EAST: V3 = [28, 0, 0];
const FOV = 30;
const FINIAL: V3 = [WEST[0], PAGODA_TOP + 8.6, 0];
/** 与第 2 段一致：洛奇亚淡墨影的位置 */
const LUGIA: V3 = [WEST[0], PAGODA_TOP + 13, 0];

/** 火中三点微光（三只无名的宝可梦）：塔基正面 */
const LIGHTS: V3[] = [
	[WEST[0] - 2.4, 4.6, 4.6],
	[WEST[0] + 0.2, 4.0, 4.9],
	[WEST[0] + 2.6, 4.9, 4.5],
];

const getCamera = (f: number) => {
	const key = (vals: [number, number][]) => flow(f, vals);
	const pos: V3 = [
		key([
			[0, -26],
			[T.strike, -25],
			[150, 2],
			[330, -5],
			[468, -15],
			[592, -15],
			[720, -12],
			[900, -2],
		]),
		key([
			[0, 42],
			[T.strike, 41],
			[150, 26],
			[330, 22],
			[468, 9],
			[592, 9],
			[720, 12],
			[900, 21],
		]),
		key([
			[0, 73],
			[T.strike, 76],
			[150, 150],
			[330, 136],
			[468, 62],
			[592, 62],
			[720, 80],
			[900, 128],
		]),
	];
	const target: V3 = [
		key([
			[0, -28],
			[T.strike, -28],
			[150, -20],
			[330, -22],
			[468, -28],
			[592, -28],
			[720, -28],
			[900, -22],
		]),
		key([
			[0, 44],
			[T.strike, 44],
			[150, 26],
			[330, 24],
			[468, 7],
			[592, 7],
			[720, 11],
			[900, 15],
		]),
		0,
	];
	return {pos, target};
};

/** 屋檐在塔高里的比例（给火舌用）：与 InkBlaze 的 t 一致，塔基取 PAGODA_TOP × 0.04 */
const TIER_T = (() => {
	const y0 = PAGODA_TOP * 0.04;
	const tt = (y: number) => (y - y0) / (PAGODA_TOP - y0);
	return {tier0: tt(TIERS[0].roofOut), tierStep: tt(TIERS[2].roofOut) - tt(TIERS[1].roofOut)};
})();

const pxPerUnit = (pos: V3, p: V3) => {
	const d = Math.hypot(pos[0] - p[0], pos[1] - p[1], pos[2] - p[2]);
	return 1080 / (2 * d * Math.tan((FOV * Math.PI) / 360));
};

/** 一块 3D 画布：西塔（指定状态）+ 东边完好的铃铛塔 */
const TowerLayer: React.FC<{
	f: number;
	pos: V3;
	target: V3;
	west: PagodaVariant | 'ruin';
	storm: number;
	day: number;
	fire: number;
	front: number;
	opacity: number;
}> = ({f, pos, target, west, storm, day, fire, front, opacity}) => {
	if (opacity <= 0.001) return null;
	return (
		<AbsoluteFill style={{opacity}}>
			<ThreeCanvas width={1920} height={1080} shadows gl={{alpha: true, antialias: true}}>
				<CameraRig pos={pos} target={target} fov={FOV} />
				<WeatherLights storm={storm} day={day} fire={fire} front={front} fireX={WEST[0]} />
				<group position={EAST}>
					<Pagoda variant="tin" />
				</group>
				<group position={WEST}>{west === 'ruin' ? <PagodaRuin frame={f} ground={false} /> : <Pagoda variant={west} />}</group>
			</ThreeCanvas>
		</AbsoluteFill>
	);
};

export const FireScene: React.FC = () => {
	const f = useFrame();
	const {pos, target} = getCamera(f);
	const sk = shake(f, T.strike, 26, 34);

	// 天光：墨云压顶后变暗；三天里三明三暗；雨后略回亮
	const storm = interpolate(f, [T.storm[0], T.storm[1], T.rain[0], 900], [0, 1, 1, 0.5], clamp);
	const dayPulse = f > T.days[0] && f < T.days[1] ? Math.max(0, Math.sin((Math.PI * (f - T.days[0]) * 3) / (T.days[1] - T.days[0]))) : 0;
	const day = interpolate(f, [0, T.storm[1], T.rain[1], 900], [1, 0.35, 0.3, 0.55], clamp) + dayPulse * 0.35;

	// 火势
	const fire = interpolate(f, [T.strike, T.strike + 25, 300, T.quench[0], T.quench[1]], [0, 0.6, 1, 1, 0], clamp);
	const front = interpolate(f, [T.strike, 300, 420], [0.06, 0.6, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const smoke = interpolate(f, [T.strike, 250, T.quench[0], 780, 900], [0.15, 1, 1, 0.45, 0.2], clamp);
	const steam = interpolate(f, [T.quench[0] + 10, 690, 900], [0, 1, 0.35], clamp);
	const rain = interpolate(f, [T.rain[0], T.rain[1], 860, 900], [0, 1, 0.6, 0.45], clamp);

	// 三层塔：完好 → 烧焦 → 废墟（交替藏在火光与水汽里）
	const charK = interpolate(f, [200, 420], [0, 1], clamp);
	const ruinK = interpolate(f, T.toRuin, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});

	// 塔在画面上的位置（给火与烟用）
	const pBase = projectToScreen(pos, target, FOV, [WEST[0], PAGODA_TOP * 0.04, 0]);
	const pTop = projectToScreen(pos, target, FOV, [WEST[0], PAGODA_TOP, 0]);
	const k = pxPerUnit(pos, [WEST[0], PAGODA_TOP * 0.5, 0]);
	const tower = {x: (pBase.x + pTop.x) / 2, top: pTop.y, base: pBase.y, hwBase: 6.6 * k, hwTop: 3.6 * k, ...TIER_T};

	// 三点微光：亮起、摇曳，再一一熄灭
	const glows: Glow[] = LIGHTS.map((L, i) => {
		const p = projectToScreen(pos, target, FOV, L);
		const on = interpolate(f, [T.lights[0] + i * 8, T.lights[1] + i * 8], [0, 1], clamp);
		const off = interpolate(f, [T.out[i], T.out[i] + 16], [1, 0], {...clamp, easing: Easing.in(Easing.quad)});
		const flicker = 0.8 + 0.2 * Math.sin(f * 0.9 + i * 2.1) * Math.sin(f * 0.37 + i);
		return {x: p.x, y: p.y, a: on * off * flicker * 0.95};
	});

	const finial = projectToScreen(pos, target, FOV, FINIAL);
	const flash = interpolate(f, [T.strike - 1, T.strike, T.strike + 3, T.strike + 5, T.strike + 14], [0, 1, 0.35, 0.8, 0], clamp);

	const inkCam: Cam = {x: 960 + target[0] * 5, y: 540 - (pos[1] - 24) * 4.5, zoom: 1 + (150 - pos[2]) / 500, roll: 0};
	const gF = SEG_START.fire + f;

	// 接第 2 段：洛奇亚的淡墨影、泥金日轮与洒金都还在，随墨云压上来才隐去
	const gold = interpolate(f, [0, 90], [0.7, 0.12], clamp);
	const luFade = interpolate(f, [0, 55], [1, 0], {...clamp, easing: Easing.in(Easing.quad)});
	const lu = projectToScreen(pos, target, FOV, LUGIA);
	const luSize = 15 * pxPerUnit(pos, LUGIA);
	// 震动时才放大 3%，盖住画面边缘
	const shakeZoom = interpolate(f, [T.strike - 2, T.strike, T.strike + 34, T.strike + 50], [0, 1, 1, 0], clamp);

	return (
		<AbsoluteFill style={{background: '#2a241d', overflow: 'hidden'}}>
			<AbsoluteFill style={{transform: `translate(${sk.x}px, ${sk.y}px) rotate(${sk.roll}deg) scale(${1 + 0.03 * shakeZoom})`}}>
				<InkMountains cam={inkCam} sun={{x: 1060, y: 250, radius: 105}} gold={gold} mist={1} bright={0.45 + 0.55 * day} timeOffset={SEG_START.fire} />
				<AbsoluteFill style={{filter: `sepia(0.35) saturate(0.78) contrast(${0.92 + 0.03 * storm}) brightness(${0.87 + 0.15 * day})`}}>
					<TowerLayer f={f} pos={pos} target={target} west="ruin" storm={storm} day={day} fire={fire} front={front} opacity={ruinK} />
					<TowerLayer f={f} pos={pos} target={target} west="char" storm={storm} day={day} fire={fire} front={front} opacity={charK * (1 - ruinK)} />
					<TowerLayer f={f} pos={pos} target={target} west="brass" storm={storm} day={day} fire={fire} front={front} opacity={1 - charK} />
				</AbsoluteFill>
				<InkBlaze tower={tower} fire={fire} front={front} smoke={smoke} storm={storm} steam={steam} />
				<TowerMist pos={pos} target={target} fov={FOV} globalFrame={gF} storm={storm} idPrefix="fMist" />
				{luFade > 0 && !lu.behind ? (
					<PokemonArt3D
						dir="pokemon/lugia"
						x={lu.x}
						y={lu.y}
						size={luSize}
						yaw={2}
						pitch={-3}
						opacity={0.8 * luFade}
						ink={{silhouette: 1, reveal: 0, halo: 0.7, time: gF / 30, center: [0.5, 0.45]}}
					/>
				) : null}
				{/* 火中三点微光：画在雾之上，避免被前景雾带盖住 */}
				{glows.map((g, i) =>
					g.a > 0.01 ? (
						<AbsoluteFill
							key={i}
							style={{
								mixBlendMode: 'screen',
								background: `radial-gradient(circle at ${g.x}px ${g.y}px, rgba(255,250,232,${g.a}) 0px, rgba(255,236,190,${g.a * 0.7}) ${k * 0.5}px, rgba(255,200,120,${g.a * 0.25}) ${k * 1.4}px, transparent ${k * 2.6}px)`,
							}}
						/>
					) : null,
				)}
				<Lightning at={T.strike} from={[finial.x + 160, -60]} to={[finial.x, finial.y]} seed="tower-strike" rgb="255,236,200" width={4} />
				<Rain rgb="58,52,44" opacity={rain * 0.85} angle={12} />
			</AbsoluteFill>
			<PaperVignette strength={0.85 + 0.1 * storm} />
			<AbsoluteFill style={{background: '#fff8e6', opacity: flash, pointerEvents: 'none'}} />

			{/* 旁白（制作者撰写）：依据水晶·三人众 "About 150 years ago, a lightning bolt struck one of the TOWERS." */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub1[0]}
				to={T.sub1[1]}
				zh="大约一百五十年前，一道雷击中了西边的塔。"
				en="About 150 years ago, a bolt of lightning struck the western tower."
				source={{zh: '旁白（依据水晶·三人众）', en: 'NARRATION (after CRYSTAL · Wise Trio)'}}
			/>
			{/* 旁白（制作者撰写）：TV 动画金银篇 EP181 / EP182 是争夺凤王之力的战乱烧毁 */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub2[0]}
				to={T.sub2[1]}
				zh="动画里，这座塔毁于争夺凤王之力的战乱；而在游戏里，起因只是一道雷。"
				en="In the anime, the tower fell in a war over Ho-Oh's power. In the games, it took only a single bolt of lightning."
				source={{zh: '旁白（动画与游戏的差别）', en: 'NARRATION (anime vs. games)'}}
			/>
			{/* 旁白（制作者撰写）：依据水晶·三人众 "It was engulfed in flames that raged for three days." */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub3[0]}
				to={T.sub3[1]}
				zh="大火整整烧了三天。"
				en="The flames raged for three days."
				source={{zh: '旁白（依据水晶·三人众）', en: 'NARRATION (after CRYSTAL · Wise Trio)'}}
			/>
			{/* 旁白（制作者撰写）：依据水晶 / 心金魂银 "three nameless Pokémon perished in it" */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub4[0]}
				to={T.sub4[1]}
				zh="三只无名的宝可梦，葬身在火海之中。"
				en="Three nameless Pokémon perished in the blaze."
				source={{zh: '旁白（依据水晶 / 心金魂银）', en: 'NARRATION (after CRYSTAL / HGSS)'}}
			/>
			{/* 旁白（制作者撰写）：依据水晶·三人众 "A sudden downpour finally put out the blaze." */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub5[0]}
				to={T.sub5[1]}
				zh="直到一场骤雨，才终于浇灭了大火。"
				en="At last, a sudden downpour put out the blaze."
				source={{zh: '旁白（依据水晶·三人众）', en: 'NARRATION (after CRYSTAL · Wise Trio)'}}
			/>
			{/* 旁白（制作者撰写）：依据《缘朱历史》"one of the towers burned to the ground" */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub6[0]}
				to={T.sub6[1]}
				zh="可那座塔，已经所剩无几。"
				en="But by then, little of the tower remained."
				source={{zh: '旁白（依据《缘朱历史》）', en: 'NARRATION (after "History of Ecruteak")'}}
			/>
			<Grain opacity={0.06 - 0.01 * storm} />
		</AbsoluteFill>
	);
};
