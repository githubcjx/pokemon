import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, flow, project, unproject} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {InkDrop, InkPaper, PaperVignette} from '../../components/ink/InkPaper';
import {Seal} from '../../components/ink/Seal';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// ─── 水墨风测试片（390 帧 = 13 秒，一镜到底）─────────────────────────────
// 古纸泥金 → 一滴墨落下、水波荡开、墨丝晕散 → 镜头顺着墨流推近 → 梦幻自墨影中显形、颜色从中心渗开
// → 名称卡 + 朱砂印 + 图鉴字幕 → 颜色退回墨中，墨潮漫过画面
export const INK_TEST_FRAMES = 390;

const T = {
	fall: [12, 40] as const,
	sil: [118, 196] as const,
	reveal: [182, 240] as const,
	cry: 232,
	name: 248,
	seal: 292,
	sub: [262, 348] as const,
	unreveal: [334, 376] as const,
	flood: [326, 390] as const,
};

const PAPER_K = 0.7;
const MEW = {x: 960, y: 500};

const getCam = (f: number): Cam => ({
	x: flow(f, [
		[0, 960],
		[40, 962],
		[150, 975],
		[240, 1000],
		[330, 1085],
		[390, 1110],
	]),
	y: flow(f, [
		[0, 545],
		[150, 522],
		[390, 508],
	]),
	zoom: flow(f, [
		[0, 1.0],
		[40, 1.03],
		[150, 1.2],
		[240, 1.3],
		[330, 1.27],
		[390, 1.42],
	]),
	roll: flow(f, [
		[0, -1.2],
		[200, 0.3],
		[390, 1.0],
	]),
});

// 墨池落在梦幻显形时它在纸面上的正下方
const POOL = (() => {
	const c = getCam(200);
	return unproject(c, PAPER_K, project(c, 1, MEW));
})();

const DROPS: InkDrop[] = [
	{x: POOL.x, y: POOL.y, at: T.fall[1], size: 330},
	{x: POOL.x - 160, y: POOL.y + 95, at: 78, size: 200},
	{x: POOL.x + 175, y: POOL.y - 70, at: 104, size: 170},
];

/** 下落的墨滴：俯视，由近（大而虚）到远（小而实），落在纸面的瞬间消失 */
const FallingDrop: React.FC<{cam: Cam; frame: number}> = ({cam, frame}) => {
	if (frame < T.fall[0] || frame >= T.fall[1]) return null;
	const p = interpolate(frame, [T.fall[0], T.fall[1]], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const at = project(cam, PAPER_K, DROPS[0]);
	const size = interpolate(p, [0, 1], [150, 15]);
	return (
		<div
			style={{
				position: 'absolute',
				left: at.x - size / 2,
				top: at.y - size / 2 - (1 - p) * 40,
				width: size,
				height: size,
				borderRadius: '50%',
				background: 'radial-gradient(circle at 38% 32%, rgba(90,80,70,0.95) 0%, rgba(14,11,9,1) 45%, rgba(8,6,5,1) 100%)',
				filter: `blur(${(1 - p) * 26}px)`,
				opacity: interpolate(p, [0, 0.35], [0, 1], clamp),
			}}
		/>
	);
};

export const InkTest: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);

	const sil = interpolate(frame, [T.sil[0], T.sil[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const reveal =
		interpolate(frame, [T.reveal[0], T.reveal[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)}) -
		interpolate(frame, [T.unreveal[0], T.unreveal[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const settled = interpolate(frame, [T.reveal[0] + 20, T.reveal[1] + 20], [0, 1], clamp);
	const mewO = interpolate(frame, [T.sil[0], T.sil[0] + 30, T.flood[1] - 38, T.flood[1] - 6], [0, 1, 1, 0], clamp);
	// 在水中浮起：缓慢变大、轻微漂移
	const rise = interpolate(frame, [T.sil[0], 280], [0, 1], {...clamp, easing: Easing.out(Easing.sin)});
	const size = interpolate(rise, [0, 1], [520, 580]);
	const floatX = Math.sin(frame / 53) * 6;
	const floatY = Math.sin(frame / 38) * 8 - rise * 10;
	// 镜头横移时，立绘跟着小幅转身
	const yaw = Math.max(-7, Math.min(7, Math.sin(frame / 70) * 2.5 + (cam.x - 1000) / 25));

	const flood = interpolate(frame, [T.flood[0], T.flood[1]], [0, 2900], {...clamp, easing: Easing.in(Easing.quad)});
	const textO = interpolate(frame, [T.flood[0] + 6, T.flood[0] + 26], [1, 0], clamp);

	return (
		<AbsoluteFill style={{background: '#cdb88f', overflow: 'hidden'}}>
			<InkPaper
				cam={cam}
				k={PAPER_K}
				drops={DROPS}
				flood={flood > 0 ? {x: POOL.x - 520, y: POOL.y + 430, radius: flood} : undefined}
				gold={1}
				ripple={1}
			/>
			<FallingDrop cam={cam} frame={frame} />
			{mewO > 0 && (
				<CamLayer cam={cam} k={1}>
					<PokemonArt3D
						dir="pokemon/mew"
						x={MEW.x + floatX}
						y={MEW.y + floatY}
						size={size}
						yaw={yaw}
						pitch={2}
						depthScale={0.5}
						opacity={mewO}
						resolution={2}
						ink={{
							silhouette: sil,
							reveal: Math.max(0, reveal),
							line: 0.85 * settled,
							halo: sil * (1 - 0.3 * settled),
							wash: 0.7 * settled,
							time: frame / 30,
							center: [0.5, 0.45],
							paint: 1,
							color: 0.3,
						}}
					/>
				</CamLayer>
			)}
			<PaperVignette />

			<div style={{opacity: textO}}>
				<NameTag tone="ink" from={T.name} x={1330} y={290} no="No.0151" zh="梦幻" en="MEW" category="新种宝可梦" categoryEn="NEW SPECIES POKÉMON" />
				<Seal from={T.seal} x={1578} y={388} text="梦幻" size={78} />
				<BiSubtitle
					tone="ink"
					from={T.sub[0]}
					to={T.sub[1]}
					zh="因为能使用所有的招式，所以有很多学者认为它是宝可梦的祖先。"
					en="Because it can use all kinds of moves, many scientists believe Mew to be the ancestor of Pokémon."
					source={{zh: '梦幻图鉴《晶灿钻石·明亮珍珠》', en: 'POKÉDEX · DIAMOND'}}
				/>
			</div>
			<Cry name="mew" at={T.cry} />
			<Grain opacity={0.06} />
		</AbsoluteFill>
	);
};
