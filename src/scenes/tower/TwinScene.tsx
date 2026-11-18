import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, flow} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {InkMountains, PaperVignette} from '../../components/ink/InkPaper';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {Seal} from '../../components/ink/Seal';
import {PaperMist} from '../../components/screen/PaperMist';
import {PAGODA_TOP} from '../../three/pagodaGeometry';
import {Pagoda} from '../../three/Pagoda';
import {CameraRig, GoldLights, projectToScreen, V3} from '../../three/stage';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// ─── 第 2 段《双塔》（780 帧 = 26 秒，昔·泛黄古纸水墨）──────────────────────────
// 金光退去，古纸上的水墨远山里立着两座九重塔（字幕一、二）→ 镜头缓缓推向东边铃铛塔的塔顶（字幕三）
// → 塔顶上空金光聚起，凤王剪影 → 显色 + 叫声 + 名称卡 + 图鉴 → 镜头平移到西边的金钟塔
// → 塔顶上空只有洛奇亚的银色剪影（字幕五），接第 3 段的雷击
export const TWIN_SCENE_FRAMES = 780;

const T = {
	unflood: [0, 40] as const,
	sub1: [36, 160] as const,
	sub2: [175, 305] as const,
	sub3: [320, 440] as const,
	glow: 370,
	hoSil: [395, 440] as const,
	hoReveal: [440, 480] as const,
	hoTint: [470, 525] as const,
	cry: 478,
	tag: 488,
	seal: 530,
	sub4: [495, 615] as const,
	lugia: [640, 700] as const,
	sub5: [650, 770] as const,
};

/** 东 = +x：铃铛塔；西 = -x：金钟塔 */
const EAST: V3 = [28, 0, 0];
const WEST: V3 = [-28, 0, 0];
const HOOH: V3 = [EAST[0], PAGODA_TOP + 13, 0];
const LUGIA: V3 = [WEST[0], PAGODA_TOP + 13, 0];
const FOV = 30;

const getCamera = (f: number) => {
	const pos: V3 = [
		flow(f, [
			[0, 0],
			[300, 10],
			[420, 24],
			[610, 26],
			[700, -24],
			[780, -26],
		]),
		flow(f, [
			[0, 24],
			[300, 32],
			[420, 40],
			[610, 42],
			[780, 42],
		]),
		flow(f, [
			[0, 150],
			[300, 110],
			[420, 80],
			[610, 74],
			[700, 76],
			[780, 73],
		]),
	];
	const target: V3 = [
		flow(f, [
			[0, 0],
			[300, 8],
			[420, 27],
			[610, 28],
			[700, -27],
			[780, -28],
		]),
		flow(f, [
			[0, 22],
			[300, 28],
			[420, 43],
			[610, 44],
			[780, 44],
		]),
		0,
	];
	return {pos, target};
};

/** 3D 物体在画面上的像素尺寸：worldSize 个单位在该距离上占多少像素 */
const pxPerUnit = (pos: V3, p: V3) => {
	const d = Math.hypot(pos[0] - p[0], pos[1] - p[1], pos[2] - p[2]);
	return 1080 / (2 * d * Math.tan((FOV * Math.PI) / 360));
};

export const TwinScene: React.FC = () => {
	const f = useFrame();
	const {pos, target} = getCamera(f);

	// 水墨远山随 3D 镜头产生视差
	const inkCam: Cam = {x: 960 + target[0] * 5, y: 540 - (pos[1] - 24) * 4.5, zoom: 1 + (150 - pos[2]) / 500, roll: 0};

	// 塔脚的雾带跟住地面
	const ground = projectToScreen(pos, target, FOV, [0, 3, 0]);

	// 凤王（水墨画，同第 3 期梦幻）：墨影洇满轮廓 → 纯墨的水墨画 → 淡彩渗入（色彩略多留一点，保住虹色）
	const ho = projectToScreen(pos, target, FOV, HOOH);
	const hoSize = 15 * pxPerUnit(pos, HOOH);
	const hoIn = interpolate(f, [T.hoSil[0], T.hoSil[0] + 24], [0, 1], clamp);
	const hoSil = interpolate(f, T.hoSil, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const hoReveal = interpolate(f, T.hoReveal, [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const hoTint = interpolate(f, T.hoTint, [0, 0.38], {...clamp, easing: Easing.inOut(Easing.sin)});
	const hoSettled = interpolate(f, [T.hoReveal[0] + 20, T.hoReveal[1] + 20], [0, 1], clamp);
	const glow = interpolate(f, [T.glow, T.hoReveal[1], T.hoReveal[1] + 60], [0, 1, 0.6], clamp);

	// 洛奇亚：只有一团淡墨影，不显色
	const lu = projectToScreen(pos, target, FOV, LUGIA);
	const luSize = 15 * pxPerUnit(pos, LUGIA);
	const luIn = interpolate(f, T.lugia, [0, 1], {...clamp, easing: Easing.out(Easing.quad)});

	const unflood = interpolate(f, T.unflood, [1, 0], {...clamp, easing: Easing.out(Easing.quad)});

	return (
		<AbsoluteFill style={{background: '#e9dcbc'}}>
			<InkMountains cam={inkCam} sun={{x: 1060, y: 250, radius: 105}} gold={0.7} />
			{/* 3D 双塔：压一层古旧的色调，与纸面融在一起 */}
			<AbsoluteFill style={{filter: 'sepia(0.35) saturate(0.78) contrast(0.92) brightness(1.02)'}}>
				<ThreeCanvas width={1920} height={1080} shadows gl={{alpha: true, antialias: true}}>
					<CameraRig pos={pos} target={target} fov={FOV} />
					<GoldLights fog="#d9c7a0" fogNear={90} fogFar={300} />
					<group position={EAST}>
						<Pagoda variant="tin" />
					</group>
					<group position={WEST}>
						<Pagoda variant="brass" />
					</group>
				</ThreeCanvas>
			</AbsoluteFill>
			<PaperMist id="mistBack" y={ground.y - 60} height={240} frame={f} speed={0.25} dx={-target[0] * 3} seed={4} opacity={0.75} />
			<PaperMist id="mistFront" y={ground.y + 40} height={300} frame={f} speed={-0.35} dx={-target[0] * 5} seed={9} toBottom />

			{/* 凤王身后的金光与淡淡的虹晕 */}
			{glow > 0 && !ho.behind ? (
				<AbsoluteFill
					style={{
						opacity: glow,
						mixBlendMode: 'screen',
						background: `radial-gradient(circle at ${ho.x}px ${ho.y}px, rgba(255,236,190,0.8) 0px, rgba(255,214,140,0.35) ${hoSize * 0.35}px, transparent ${hoSize * 0.75}px)`,
					}}
				/>
			) : null}
			{glow > 0 && !ho.behind ? (
				<AbsoluteFill
					style={{
						opacity: glow * 0.55,
						background: `radial-gradient(circle at ${ho.x}px ${ho.y}px, transparent ${hoSize * 0.5}px, rgba(255,110,90,0.22) ${hoSize * 0.53}px, rgba(255,200,90,0.22) ${hoSize * 0.56}px, rgba(140,210,120,0.18) ${hoSize * 0.59}px, rgba(110,170,240,0.16) ${hoSize * 0.62}px, rgba(170,120,230,0.13) ${hoSize * 0.65}px, transparent ${hoSize * 0.69}px)`,
					}}
				/>
			) : null}
			{hoIn > 0 && !ho.behind ? (
				<PokemonArt3D
					dir="pokemon/ho-oh"
					x={ho.x}
					y={ho.y}
					size={hoSize}
					yaw={interpolate(target[0], [0, 28], [-4, 2], clamp)}
					pitch={-3}
					opacity={hoIn}
					resolution={1.5}
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
			{luIn > 0 && !lu.behind ? (
				<PokemonArt3D
					dir="pokemon/lugia"
					x={lu.x}
					y={lu.y}
					size={luSize}
					yaw={2}
					pitch={-3}
					opacity={0.8 * luIn}
					ink={{silhouette: luIn, reveal: 0, halo: 0.7 * luIn, time: f / 30, center: [0.5, 0.45]}}
				/>
			) : null}

			<PaperVignette strength={0.85} />
			{/* 第 1 段结尾的金光退去 */}
			<AbsoluteFill style={{background: '#efcf88', opacity: unflood}} />

			{/* 旁白（制作者撰写）：依据水晶·三人众 "two nine-tier towers"、铃铛塔僧侣 "700 years ago" */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub1[0]}
				to={T.sub1[1]}
				zh="七百年前，缘朱建起了两座九重塔。"
				en="Seven hundred years ago, two nine-tier towers were built in Ecruteak."
				source={{zh: '旁白（依据水晶·三人众、铃铛塔僧侣）', en: 'NARRATION (after CRYSTAL)'}}
			/>
			{/* 旁白（制作者撰写）：依据水晶·铃铛塔 1F 僧侣 "built to foster friendship and hope between Pokémon and people" */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub2[0]}
				to={T.sub2[1]}
				zh="为的是增进人与宝可梦之间的友谊与希望。"
				en="They were built to foster friendship and hope between people and Pokémon."
				source={{zh: '旁白（依据水晶·铃铛塔僧侣）', en: 'NARRATION (after CRYSTAL · Tin Tower)'}}
			/>
			{/* 旁白（制作者撰写）：铃铛塔在东；"rainbow-colored Pokémon" 是游戏里对凤王的称呼 */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub3[0]}
				to={T.sub3[1]}
				zh="东边的塔顶，栖息着一只虹色的宝可梦。"
				en="Atop the eastern tower roosted a rainbow-colored Pokémon."
				source={{zh: '旁白（依据水晶 / 心金魂银）', en: 'NARRATION (after CRYSTAL / HGSS)'}}
			/>
			{!ho.behind ? (
				<NameTag
					tone="ink"
					from={T.tag}
					x={ho.x - hoSize * 0.56}
					y={ho.y - hoSize * 0.12}
					align="right"
					no="No.0250"
					zh="凤王"
					en="HO-OH"
					category="虹色宝可梦"
					categoryEn="RAINBOW POKÉMON"
					opacity={interpolate(f, [600, 640], [1, 0], clamp)}
				/>
			) : null}
			{!ho.behind ? (
				<div style={{opacity: interpolate(f, [600, 640], [1, 0], clamp)}}>
					<Seal from={T.seal} x={ho.x - hoSize * 0.56 - 270} y={ho.y - hoSize * 0.12 + 98} text="凤王" size={70} />
				</div>
			) : null}
			{/* 官方图鉴原文 */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub4[0]}
				to={T.sub4[1]}
				zh="其翅膀闪耀着七种色彩。传说见到凤王的人能够拥有永远的幸福。"
				en="Its feathers are in seven colors. It is said that anyone seeing it is promised eternal happiness."
				source={{zh: '凤王图鉴《晶灿钻石·明亮珍珠》', en: 'POKÉDEX · BRILLIANT DIAMOND / SHINING PEARL'}}
			/>
			{/* 旁白（制作者撰写）：依据水晶·三人众 "an immense, silver-colored #MON was said to make its roost atop the BRASS TOWER" */}
			<BiSubtitle
				tone="ink"
				backdrop
				from={T.sub5[0]}
				to={T.sub5[1]}
				zh="传说西边的塔顶，也曾栖息着一只银色的巨大宝可梦。"
				en="Legend has it that an immense, silver-colored Pokémon once roosted atop the western tower."
				source={{zh: '旁白（依据水晶·三人众）', en: 'NARRATION (after CRYSTAL · Wise Trio)'}}
			/>
			<Cry name="ho-oh" at={T.cry} />
			<Grain opacity={0.06} />
		</AbsoluteFill>
	);
};
