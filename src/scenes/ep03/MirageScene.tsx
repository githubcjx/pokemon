import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, flow, project, unproject} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {FallingDrop} from '../../components/ink/FallingDrop';
import {Grain} from '../../components/Grain';
import {InkDrop, InkPaper, PaperVignette} from '../../components/ink/InkPaper';
import {Seal} from '../../components/ink/Seal';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {SUB} from './subtitles';

// ─── 第 3 期 · 第 1 段「幻之宝可梦」（660 帧 = 22 秒）──────────────────────
// 接上期结尾的黑场：满屏浓墨从中心退开、露出古纸 → 提问 → 一滴墨落下晕开 → 梦幻自墨影中显形
// （先是纯墨的水墨画，再渗入一层淡彩）→ 名称卡 + 朱砂印 → 官方图鉴 → 梦幻向远处飞去，镜头顺势横移接下一段
export const MIRAGE_SCENE_FRAMES = 660;

const T = {
	clear: [0, 150] as const, // 墨退
	subMyth: [34, 104] as const,
	subAsk: [110, 196] as const,
	fall: [150, 176] as const, // 墨滴下落 → 落纸
	subRare: [206, 318] as const,
	sil: [258, 336] as const, // 墨影洇满轮廓
	reveal: [318, 378] as const, // 显出水墨画（纯墨）
	cry: 376,
	tint: [380, 440] as const, // 淡彩渗入
	name: 394,
	seal: 438,
	subDex: [446, 562] as const,
	exit: [556, 660] as const, // 梦幻飞向远处，镜头横移
};

const PAPER_K = 0.7;
const MEW = {x: 960, y: 500};

const getCam = (f: number): Cam => ({
	x: flow(f, [
		[0, 960],
		[176, 960],
		[330, 975],
		[460, 1000],
		[560, 1040],
		[660, 1420],
	]),
	y: flow(f, [
		[0, 540],
		[330, 522],
		[560, 514],
		[660, 498],
	]),
	zoom: flow(f, [
		[0, 1.08],
		[120, 1.0],
		[176, 1.03],
		[330, 1.22],
		[460, 1.28],
		[560, 1.25],
		[660, 1.1],
	]),
	roll: flow(f, [
		[0, -1],
		[330, 0.3],
		[660, -0.8],
	]),
});

// 墨池落在梦幻显形时它在纸面上的正下方
const POOL = (() => {
	const c = getCam(T.sil[1]);
	return unproject(c, PAPER_K, project(c, 1, MEW));
})();

const DROPS: InkDrop[] = [
	{x: POOL.x, y: POOL.y, at: T.fall[1], size: 330},
	{x: POOL.x - 160, y: POOL.y + 95, at: 214, size: 200},
	{x: POOL.x + 175, y: POOL.y - 70, at: 240, size: 170},
];

export const MirageScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);

	// 开场：满屏浓墨（接上期黑场），从中心向外退开
	// 最后 40 帧继续放大，让残留的墨丝也淡出纸面，关掉墨潮时不会跳变
	const clearR = interpolate(frame, [T.clear[0], T.clear[1] - 40, T.clear[1]], [60, 1900, 6000], {...clamp, easing: Easing.inOut(Easing.sin)});
	const covered = frame < T.clear[1];
	const center = unproject(cam, PAPER_K, {x: 960, y: 560});

	// 梦幻：墨影 → 纯墨的水墨画 → 淡彩
	const sil = interpolate(frame, [T.sil[0], T.sil[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const reveal = interpolate(frame, [T.reveal[0], T.reveal[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const tint = interpolate(frame, [T.tint[0], T.tint[1]], [0, 0.3], {...clamp, easing: Easing.inOut(Easing.sin)});
	const settled = interpolate(frame, [T.reveal[0] + 20, T.reveal[1] + 20], [0, 1], clamp);
	const rise = interpolate(frame, [T.sil[0], 430], [0, 1], {...clamp, easing: Easing.out(Easing.sin)});

	// 飞向远处：先缓后快，往右上方变小
	const exit = interpolate(frame, [T.exit[0], T.exit[1]], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
	const size = interpolate(rise, [0, 1], [520, 580]) * interpolate(exit, [0, 1], [1, 0.45]);
	const mx = MEW.x + Math.sin(frame / 53) * 6 + exit * 780;
	const my = MEW.y + Math.sin(frame / 38) * 8 - rise * 10 - exit * 170;
	const mewO = interpolate(frame, [T.sil[0], T.sil[0] + 30], [0, 1], clamp);
	// 镜头横移时，立绘跟着小幅转身
	const yaw = Math.max(-7, Math.min(7, Math.sin(frame / 70) * 2.5 + (cam.x - 1000) / 25));

	const textO = interpolate(frame, [T.exit[0], T.exit[0] + 16], [1, 0], clamp);

	return (
		<AbsoluteFill style={{background: '#0f0b08', overflow: 'hidden'}}>
			<InkPaper
				cam={cam}
				k={PAPER_K}
				drops={DROPS}
				flood={covered ? {x: center.x, y: center.y, radius: 4200} : undefined}
				clear={covered ? {x: center.x, y: center.y, radius: clearR} : undefined}
			/>
			<FallingDrop cam={cam} frame={frame} k={PAPER_K} at={DROPS[0]} from={T.fall[0]} to={T.fall[1]} />
			{mewO > 0 && (
				<CamLayer cam={cam} k={1}>
					<PokemonArt3D
						dir="pokemon/mew"
						x={mx}
						y={my}
						size={size}
						yaw={yaw}
						pitch={2}
						depthScale={0.5}
						opacity={mewO}
						resolution={2}
						ink={{
							silhouette: sil,
							reveal,
							paint: 1,
							color: tint,
							line: 0.85 * settled,
							halo: sil * (1 - 0.3 * settled),
							wash: 0.7 * settled,
							time: frame / 30,
							center: [0.5, 0.45],
						}}
					/>
				</CamLayer>
			)}
			<PaperVignette />

			{/* 旁白（制作者撰写）：接上期结尾的提问 */}
			<BiSubtitle
				{...SUB}
				from={T.subMyth[0]}
				to={T.subMyth[1]}
				zh="神话讲述了世界如何诞生。"
				en="The myths tell how the world came to be."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			<BiSubtitle
				{...SUB}
				from={T.subAsk[0]}
				to={T.subAsk[1]}
				zh="然而，宝可梦又是从何而来？"
				en="But where did Pokémon themselves come from?"
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			{/* 旁白（制作者撰写）：依据《红·绿》图鉴"许多专家认为它只是幻影" */}
			<BiSubtitle
				{...SUB}
				from={T.subRare[0]}
				to={T.subRare[1]}
				zh="有一种宝可梦，稀有到许多专家都认为它只是幻影。"
				en="There is a Pokémon so rare that many experts believe it is only a mirage."
				source={{zh: '旁白（依据《红·绿》图鉴）', en: 'NARRATION (after POKÉDEX · RED / BLUE)'}}
			/>
			<div style={{opacity: textO}}>
				<NameTag tone="ink" from={T.name} x={1330} y={290} no="No.0151" zh="梦幻" en="MEW" category="新种宝可梦" categoryEn="NEW SPECIES POKÉMON" />
				<Seal from={T.seal} x={1578} y={388} text="梦幻" size={78} />
				<BiSubtitle
					{...SUB}
					from={T.subDex[0]}
					to={T.subDex[1]}
					zh="许多人认为它是所有宝可梦的祖先。有着很高的智力，能够使用一切的招式。"
					en="It’s very intelligent and can use an incredible variety of moves. Many believe that all other Pokémon are descendants of this one."
					source={{zh: '梦幻图鉴《剑》', en: 'POKÉDEX · SWORD'}}
				/>
			</div>
			<Cry name="mew" at={T.cry} />
			<Grain opacity={0.06} />
		</AbsoluteFill>
	);
};
