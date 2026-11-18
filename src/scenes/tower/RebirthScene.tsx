import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, flow, shake} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {InkMountains, PaperVignette} from '../../components/ink/InkPaper';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {Pagoda, PagodaRuin} from '../../three/Pagoda';
import {CameraRig, projectToScreen, V3, WeatherLights} from '../../three/stage';
import {Rain} from '../../components/effects/Rain';
import {InkBlaze} from '../../components/ink/InkBlaze';
import {PAGODA_TOP, TIERS} from '../../three/pagodaGeometry';
import {SEG_START} from './continuity';
import {TowerMist} from './TowerMist';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// ─── 第 4 段《重生》（810 帧 = 27 秒，昔·雨后黎明，全片高潮）───────────────────────
// 雨停，晨光从水墨远山后升起 → 凤王自天而降，悬停在残塔上空（字幕一）
// → 三点微光从塔脚重新亮起、升起（字幕二）→ 金光爆开（全片最大的爆发点：凤王第二次叫声、震动、猛推）
// → 三点光化作墨影 → 水墨画 → 淡彩：雷公、炎帝、水君同时显形，叫声错开，一张总卡并列三行
// → 雷 / 火 / 雨的淡彩晕染依次在三只身后化开（字幕三、四）
export const REBIRTH_SCENE_FRAMES = 810; // 用户 2026-10-02：字幕四之后的过渡缩短（原 900）

const T = {
	dawn: [0, 90] as const,
	sub1: [40, 175] as const,
	hoSil: [60, 105] as const,
	hoReveal: [100, 150] as const,
	hoTint: [130, 185] as const,
	descend: [60, 210] as const,
	sub2: [200, 330] as const,
	lights: [220, 300] as const,
	burst: 300,
	bSil: [300, 335] as const,
	bReveal: [335, 378] as const,
	bTint: [365, 420] as const,
	cries: [376, 392, 408] as const,
	card: 424,
	sub3: [450, 605] as const,
	sub4: [615, 765] as const,
};

const WEST: V3 = [-28, 0, 0];
/** 第 3 段的帧数：本段的雨、雷云、余烬接着第 3 段的时间往下走 */
const SEG_SFRAME = 900;
const EAST: V3 = [28, 0, 0];
/** 视角：从第 3 段的 30° 渐变到本段的 34° */
export const getRebirthFov = (f: number) => flow(f, [
	[0, 30],
	[110, 34],
]);

/** 三圣兽站在塔基正面：雷公（左）、炎帝（中）、水君（右）——全国图鉴顺序，也是雷 → 火 → 雨的顺序 */
export const BEASTS = [
	{dir: 'raikou', no: 'No.0243', zh: '雷公', en: 'RAIKOU', cat: '天雷宝可梦', catEn: 'THUNDER POKÉMON', x: WEST[0] - 9.8, wash: '232,196,96'},
	{dir: 'entei', no: 'No.0244', zh: '炎帝', en: 'ENTEI', cat: '火山宝可梦', catEn: 'VOLCANO POKÉMON', x: WEST[0], wash: '206,82,44'},
	{dir: 'suicune', no: 'No.0245', zh: '水君', en: 'SUICUNE', cat: '极光宝可梦', catEn: 'AURORA POKÉMON', x: WEST[0] + 9.8, wash: '70,110,150'},
] as const;
export const BEAST_Y = 4.4;
export const BEAST_Z = 13;
export const BEAST_SIZE = 9.2;
export const HOOH_SIZE = 12;

// 起点 = 第 3 段最后一帧的机位（远处风雨中的残塔），约 110 帧内落到本段的构图
export const getRebirthCamera = (f: number) => {
	const push = interpolate(f, [T.burst - 4, T.burst + 18], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const relax = interpolate(f, [T.burst + 18, REBIRTH_SCENE_FRAMES], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const z = flow(f, [
		[0, 128],
		[110, 72],
		[T.burst - 4, 68],
	]);
	const pos: V3 = [
		flow(f, [
			[0, -2],
			[110, WEST[0] + 6],
			[T.burst, WEST[0] + 1],
			[REBIRTH_SCENE_FRAMES, WEST[0] - 2],
		]),
		flow(f, [
			[0, 21],
			[110, 11],
			[T.burst, 9],
			[REBIRTH_SCENE_FRAMES, 9],
		]),
		f < T.burst - 4 ? z : 68 - push * 9 + relax * 7,
	];
	const target: V3 = [
		flow(f, [
			[0, -22],
			[110, WEST[0] + 2],
			[T.burst, WEST[0]],
			[REBIRTH_SCENE_FRAMES, WEST[0] - 1],
		]),
		flow(f, [
			[0, 15],
			[110, 19],
			[200, 15],
			[T.burst, 9.5],
			[420, 7],
			[REBIRTH_SCENE_FRAMES, 7],
		]),
		0,
	];
	return {pos, target};
};

/** 凤王悬停的位置（第 5 段接续时用同一个函数） */
export const hoWorldAt = (f: number, descend: number): V3 => [WEST[0] + 1.5, 40 - 22.5 * descend + Math.sin(f / 40) * 0.35, 0];

export const pxPerUnit = (pos: V3, p: V3, fov: number) => {
	const d = Math.hypot(pos[0] - p[0], pos[1] - p[1], pos[2] - p[2]);
	return 1080 / (2 * d * Math.tan((fov * Math.PI) / 360));
};

export const RebirthScene: React.FC = () => {
	const f = useFrame();
	const {pos, target} = getRebirthCamera(f);
	const FOV = getRebirthFov(f);
	const sk = shake(f, T.burst, 20, 30);

	// 接第 3 段：雨停、雷云散开、水汽落下，晨光渐亮（全部从第 3 段最后一帧的数值出发）
	const clear = interpolate(f, [0, 120], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const dawn = interpolate(f, [30, 200], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const storm = 0.5 * (1 - clear);
	const day = 0.55 + 0.45 * clear;
	const gF = SEG_START.rebirth + f;
	const inkCam: Cam = {x: 960 + target[0] * 5, y: 540 - (pos[1] - 24) * 4.5, zoom: 1 + (150 - pos[2]) / 500, roll: 0};
	const rain = 0.45 * interpolate(f, [0, 70], [1, 0], clamp);
	const steam = 0.35 * interpolate(f, [0, 100], [1, 0], clamp);
	const smoke = 0.2 * interpolate(f, [0, 70], [1, 0], clamp);
	const pBase = projectToScreen(pos, target, FOV, [WEST[0], PAGODA_TOP * 0.04, 0]);
	const pTop = projectToScreen(pos, target, FOV, [WEST[0], PAGODA_TOP, 0]);
	const kT = pxPerUnit(pos, [WEST[0], PAGODA_TOP * 0.5, 0], FOV);
	const y0 = PAGODA_TOP * 0.04;
	const tt = (y: number) => (y - y0) / (PAGODA_TOP - y0);
	const tower = {
		x: (pBase.x + pTop.x) / 2,
		top: pTop.y,
		base: pBase.y,
		hwBase: 6.6 * kT,
		hwTop: 3.6 * kT,
		tier0: tt(TIERS[0].roofOut),
		tierStep: tt(TIERS[2].roofOut) - tt(TIERS[1].roofOut),
	};

	// 凤王：自天而降，悬停在残塔上空
	const descend = interpolate(f, T.descend, [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const hoWorld = hoWorldAt(f, descend);
	const ho = projectToScreen(pos, target, FOV, hoWorld);
	const hoSize = HOOH_SIZE * pxPerUnit(pos, hoWorld, FOV);
	const hoIn = interpolate(f, [T.hoSil[0], T.hoSil[0] + 24], [0, 1], clamp);
	const hoSil = interpolate(f, T.hoSil, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const hoReveal = interpolate(f, T.hoReveal, [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const hoTint = interpolate(f, T.hoTint, [0, 0.38], {...clamp, easing: Easing.inOut(Easing.sin)});
	const hoSettled = interpolate(f, [T.hoReveal[0] + 20, T.hoReveal[1] + 20], [0, 1], clamp);
	const hoGlow = interpolate(f, [T.hoSil[0], T.hoReveal[1], T.burst - 10, T.burst, T.burst + 60, REBIRTH_SCENE_FRAMES], [0, 0.6, 0.75, 1, 0.65, 0.55], clamp);

	// 三点微光：从塔脚亮起、升起，爆开时化为墨影
	const lightOn = interpolate(f, [T.lights[0], T.lights[0] + 30, T.burst - 6, T.burst + 20], [0, 1, 1, 0], clamp);
	const lightRise = interpolate(f, T.lights, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});

	// 三圣兽：墨影 → 水墨画 → 淡彩（同时显形）
	const bIn = interpolate(f, [T.bSil[0], T.bSil[0] + 18], [0, 1], clamp);
	const bSil = interpolate(f, T.bSil, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const bReveal = interpolate(f, T.bReveal, [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const bTint = interpolate(f, T.bTint, [0, 0.3], {...clamp, easing: Easing.inOut(Easing.sin)});
	const bSettled = interpolate(f, [T.bReveal[0] + 20, T.bReveal[1] + 20], [0, 1], clamp);

	// 爆发：金光与一圈向外推开的光环
	const flash = interpolate(f, [T.burst - 2, T.burst, T.burst + 4, T.burst + 22], [0, 1, 0.75, 0], clamp);
	const ringR = interpolate(f, [T.burst, T.burst + 40], [0, 2200], {...clamp, easing: Easing.out(Easing.cubic)});
	const ringO = interpolate(f, [T.burst, T.burst + 10, T.burst + 40], [0, 0.85, 0], clamp);

	// 雷 / 火 / 雨的淡彩晕染：跟着字幕三逐字出现的节奏
	const washAt = [T.sub3[0] + 8, T.sub3[0] + 22, T.sub3[0] + 38];
	const washOut = interpolate(f, [768, 805], [1, 0.4], clamp);

	return (
		<AbsoluteFill style={{background: '#e6d6b2', overflow: 'hidden'}}>
			<AbsoluteFill style={{transform: `translate(${sk.x}px, ${sk.y}px) rotate(${sk.roll}deg) scale(${1 + 0.03 * interpolate(f, [T.burst - 2, T.burst, T.burst + 30, T.burst + 46], [0, 1, 1, 0], clamp)})`}}>
				<InkMountains cam={inkCam} sun={{x: 1060, y: 250, radius: 105}} gold={0.12 + 0.78 * dawn} mist={1} bright={0.7525 + 0.27 * dawn} timeOffset={SEG_START.rebirth} />
				<AbsoluteFill style={{filter: `sepia(0.35) saturate(0.78) contrast(${0.92 + 0.03 * storm}) brightness(${0.87 + 0.15 * day})`}}>
					<ThreeCanvas width={1920} height={1080} shadows gl={{alpha: true, antialias: true}}>
						<CameraRig pos={pos} target={target} fov={FOV} />
						<WeatherLights storm={storm} day={day} />
						<group position={EAST}>
							<Pagoda variant="tin" />
						</group>
						<group position={WEST}>
							<PagodaRuin frame={SEG_SFRAME + f} ground={false} />
						</group>
					</ThreeCanvas>
				</AbsoluteFill>
				<InkBlaze tower={tower} fire={0} front={1} smoke={smoke} storm={storm} steam={steam} timeOffset={SEG_SFRAME} />
				<TowerMist pos={pos} target={target} fov={FOV} globalFrame={gF} storm={storm} idPrefix="rMist" />

				{/* 凤王身后的金光与虹晕 */}
				{hoIn > 0 ? (
					<>
						<AbsoluteFill
							style={{
								opacity: hoGlow,
								mixBlendMode: 'screen',
								background: `radial-gradient(circle at ${ho.x}px ${ho.y}px, rgba(255,236,190,0.85) 0px, rgba(255,214,140,0.35) ${hoSize * 0.38}px, transparent ${hoSize * 0.85}px)`,
							}}
						/>
						<AbsoluteFill
							style={{
								opacity: hoGlow * 0.6,
								background: `radial-gradient(circle at ${ho.x}px ${ho.y}px, transparent ${hoSize * 0.5}px, rgba(255,110,90,0.22) ${hoSize * 0.53}px, rgba(255,200,90,0.22) ${hoSize * 0.56}px, rgba(140,210,120,0.18) ${hoSize * 0.59}px, rgba(110,170,240,0.16) ${hoSize * 0.62}px, rgba(170,120,230,0.13) ${hoSize * 0.65}px, transparent ${hoSize * 0.69}px)`,
							}}
						/>
					</>
				) : null}

				{/* 雷 / 火 / 雨的淡彩晕染（三只身后） */}
				{BEASTS.map((b, i) => {
					const w = interpolate(f, [washAt[i], washAt[i] + 30], [0, 1], {...clamp, easing: Easing.out(Easing.quad)}) * washOut;
					if (w <= 0) return null;
					const p = projectToScreen(pos, target, FOV, [b.x, BEAST_Y + 0.6, BEAST_Z - 0.5]);
					const r = BEAST_SIZE * pxPerUnit(pos, [b.x, BEAST_Y, BEAST_Z], FOV) * (0.35 + 0.25 * w);
					return (
						<AbsoluteFill
							key={b.dir}
							style={{
								mixBlendMode: 'multiply',
								opacity: w * 0.95,
								background: `radial-gradient(ellipse ${r * 1.15}px ${r}px at ${p.x}px ${p.y}px, rgba(${b.wash},0.75) 0%, rgba(${b.wash},0.4) 55%, rgba(${b.wash},0) 100%)`,
							}}
						/>
					);
				})}

				{/* 三点微光 */}
				{lightOn > 0
					? BEASTS.map((b) => {
							const p = projectToScreen(pos, target, FOV, [b.x, 1.8 + (BEAST_Y - 1.8) * lightRise, BEAST_Z]);
							const k = pxPerUnit(pos, [b.x, BEAST_Y, BEAST_Z], FOV);
							const fl = 0.85 + 0.15 * Math.sin(f * 0.7 + b.x);
							return (
								<AbsoluteFill
									key={b.dir}
									style={{
										mixBlendMode: 'screen',
										background: `radial-gradient(circle at ${p.x}px ${p.y}px, rgba(255,250,232,${lightOn * fl}) 0px, rgba(255,236,190,${lightOn * 0.7 * fl}) ${k * 0.45}px, rgba(255,200,120,${lightOn * 0.25}) ${k * 1.3}px, transparent ${k * 2.4}px)`,
									}}
								/>
							);
						})
					: null}

				{/* 三圣兽 */}
				{bIn > 0
					? BEASTS.map((b, i) => {
							const world: V3 = [b.x, BEAST_Y, BEAST_Z];
							const p = projectToScreen(pos, target, FOV, world);
							return (
								<PokemonArt3D
									key={b.dir}
									dir={`pokemon/${b.dir}`}
									x={p.x}
									y={p.y}
									size={BEAST_SIZE * pxPerUnit(pos, world, FOV)}
									yaw={(i - 1) * 2 + Math.sin(f / 60 + i) * 1.2}
									pitch={2}
									opacity={bIn}
									resolution={1.3}
									ink={{
										silhouette: bSil,
										reveal: bReveal,
										paint: 1,
										color: bTint,
										line: 0.85 * bSettled,
										halo: bSil * (1 - 0.3 * bSettled),
										wash: 0.7 * bSettled,
										time: f / 30 + i * 3,
										center: [0.5, 0.5],
									}}
								/>
							);
						})
					: null}

				{/* 凤王 */}
				{hoIn > 0 ? (
					<PokemonArt3D
						dir="pokemon/ho-oh"
						x={ho.x}
						y={ho.y}
						size={hoSize}
						yaw={-2 + Math.sin(f / 70) * 1.5}
						pitch={-4}
						opacity={hoIn}
						resolution={1.4}
						ink={{
							silhouette: hoSil,
							reveal: hoReveal,
							paint: 1,
							color: hoTint,
							line: 0.85 * hoSettled,
							halo: hoSil * (1 - 0.3 * hoSettled),
							wash: 0.7 * hoSettled,
							time: f / 30,
							center: [0.5, 0.42],
						}}
					/>
				) : null}

				{/* 爆发的光环 */}
				{ringO > 0 ? (
					<AbsoluteFill
						style={{
							opacity: ringO,
							mixBlendMode: 'screen',
							background: `radial-gradient(circle at ${ho.x}px ${ho.y}px, transparent ${ringR * 0.82}px, rgba(255,232,170,0.9) ${ringR * 0.92}px, transparent ${ringR}px)`,
						}}
					/>
				) : null}
				<Rain rgb="58,52,44" opacity={rain * 0.85} angle={12} frameOffset={SEG_SFRAME} />
			</AbsoluteFill>
			<PaperVignette strength={0.85 + 0.1 * storm} />
			<AbsoluteFill style={{background: '#fff4d8', opacity: flash, pointerEvents: 'none'}} />

			{/* 三圣兽总卡：并列三行（不加"三圣兽"总称：没有官方中文用例） */}
			{BEASTS.map((b, i) => (
				<NameTag
					key={b.dir}
					tone="ink"
					compact
					from={T.card + i * 10}
					x={110}
					y={150 + i * 132}
					no={b.no}
					zh={b.zh}
					en={b.en}
					category={b.cat}
					categoryEn={b.catEn}
					opacity={interpolate(f, [600, 640], [1, 0], clamp)}
				/>
			))}

			{/* 旁白（制作者撰写）：依据水晶 / 心金魂银 "a rainbow-colored / rainbow-hued Pokémon descended from the sky" */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub1[0]}
				to={T.sub1[1]}
				zh="这时，虹色的宝可梦从天而降。"
				en="Then the rainbow-colored Pokémon descended from the sky."
				source={{zh: '旁白（依据水晶 / 心金魂银）', en: 'NARRATION (after CRYSTAL / HGSS)'}}
			/>
			{/* 旁白（制作者撰写）：依据水晶·铃铛塔 1F 僧侣 "HO-OH descended from the sky and gave new life to the three #MON." */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub2[0]}
				to={T.sub2[1]}
				zh="它让三只宝可梦，重新获得了生命。"
				en="It gave new life to the three Pokémon."
				source={{zh: '旁白（依据水晶·铃铛塔僧侣）', en: 'NARRATION (after CRYSTAL · Tin Tower sage)'}}
			/>
			{/* 旁白（制作者撰写）：依据水晶·米那季 "The lightning that struck the TOWER. The fire that burned the TOWER. And the rain that put out the fire…" */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub3[0]}
				to={T.sub3[1]}
				zh="击中塔的雷，烧毁塔的火，浇灭大火的雨——"
				en="The lightning that struck the tower. The fire that burned it. And the rain that put the fire out—"
				source={{zh: '旁白（依据水晶·米那季）', en: 'NARRATION (after CRYSTAL · Eusine)'}}
			/>
			{/* 旁白（制作者撰写）：依据水晶·米那季 "The legendary #MON are said to embody three powers…" */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub4[0]}
				to={T.sub4[1]}
				zh="据说，它们就是这三种力量的化身。"
				en="They are said to embody these three powers."
				source={{zh: '旁白（依据水晶·米那季）', en: 'NARRATION (after CRYSTAL · Eusine)'}}
			/>
			{/* 凤王第二次叫声：全片最大的爆发点 */}
			<Cry name="ho-oh" at={T.burst} />
			{BEASTS.map((b, i) => (
				<Cry key={b.dir} name={b.dir} at={T.cries[i]} volume={0.75} />
			))}
			<Grain opacity={0.06 - 0.01 * storm} />
		</AbsoluteFill>
	);
};
