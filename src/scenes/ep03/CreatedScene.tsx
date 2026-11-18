import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {Cam, flow} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {CamLayer} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {InkVortex, PaperVignette} from '../../components/ink/InkPaper';
import {Seal} from '../../components/ink/Seal';
import {NameTag} from '../../components/NameTag';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {SUB} from './subtitles';

// ─── 第 3 期 · 第 5 段「被造之物」（660 帧 = 22 秒）──────────────────────
// 接上段的余烬与黑暗：浓墨云旋转着让出中心的纸面 → 日记与图鉴的两种说法 → 超梦在漩涡中心洇出墨影、
// 显出纯墨的水墨画（叫声）→ 名称卡 + 朱砂印 → 图鉴原文 → 漩涡加速合拢，浓墨吞没画面，接下一段的洞窟
// 超梦用纯墨呈现（用户决定），与梦幻的淡彩对照。
export const CREATED_SCENE_FRAMES = 660;

const T = {
	open: [0, 200] as const, // 墨云旋开
	subDiary: [20, 118] as const,
	subDex: [124, 236] as const,
	sil: [170, 250] as const,
	reveal: [236, 300] as const,
	cry: 298,
	name: 312,
	seal: 356,
	subGene: [330, 440] as const,
	subHeart: [448, 572] as const,
	close: [576, 660] as const, // 漩涡合拢
};

const C = {x: 960, y: 560};

const getCam = (f: number): Cam => ({
	x: flow(f, [
		[0, 960],
		[300, 950],
		[560, 975],
		[660, 960],
	]),
	y: flow(f, [
		[0, 300],
		[200, 520],
		[560, 530],
		[660, 560],
	]),
	zoom: flow(f, [
		[0, 1.3],
		[200, 1.0],
		[300, 1.05],
		[560, 1.12],
		[660, 1.5],
	]),
	roll: flow(f, [
		[0, -2],
		[300, 0],
		[660, 2.2],
	]),
});

export const CreatedScene: React.FC = () => {
	const frame = useFrame();
	const cam = getCam(frame);

	const dark =
		interpolate(frame, [0, 90], [1, 0], {...clamp, easing: Easing.inOut(Easing.sin)}) +
		interpolate(frame, [T.close[0] + 30, T.close[1]], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const open =
		interpolate(frame, [30, T.open[1]], [0, 560], {...clamp, easing: Easing.out(Easing.cubic)}) *
		interpolate(frame, [T.close[0], T.close[1] - 10], [1, 0], {...clamp, easing: Easing.in(Easing.cubic)});
	const swirl = interpolate(frame, [0, 200, T.close[0], T.close[1]], [1.6, 0.9, 0.9, 2.4], clamp);
	const ember = interpolate(frame, [0, 110], [1.4, 0], clamp);

	const sil = interpolate(frame, [T.sil[0], T.sil[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const reveal =
		interpolate(frame, [T.reveal[0], T.reveal[1]], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)}) -
		interpolate(frame, [T.close[0], T.close[0] + 50], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const settled = interpolate(frame, [T.reveal[0] + 20, T.reveal[1] + 20], [0, 1], clamp);
	const mtO = interpolate(frame, [T.sil[0], T.sil[0] + 30, T.close[1] - 30, T.close[1] - 8], [0, 1, 1, 0], clamp);
	const rise = interpolate(frame, [T.sil[0], 420], [0, 1], {...clamp, easing: Easing.out(Easing.sin)});
	const textO = interpolate(frame, [T.close[0], T.close[0] + 14], [1, 0], clamp);

	return (
		<AbsoluteFill style={{background: '#0f0b08', overflow: 'hidden'}}>
			<InkVortex cam={cam} center={C} open={open} swirl={swirl} dark={Math.min(1, dark)} ember={ember} />
			{mtO > 0 && (
				<CamLayer cam={cam} k={1}>
					<PokemonArt3D
						dir="pokemon/mewtwo"
						x={C.x + Math.sin(frame / 61) * 5}
						y={C.y - rise * 14 + Math.sin(frame / 44) * 6}
						size={interpolate(rise, [0, 1], [700, 760])}
						yaw={Math.sin(frame / 75) * 3}
						pitch={-2}
						depthScale={0.5}
						opacity={mtO}
						resolution={2}
						ink={{
							silhouette: sil,
							reveal: Math.max(0, reveal),
							paint: 1,
							color: 0,
							line: 0.9 * settled,
							halo: sil * (1 - 0.3 * settled),
							wash: 0.7 * settled,
							time: frame / 30,
							center: [0.5, 0.4],
						}}
					/>
				</CamLayer>
			)}
			<PaperVignette />

			{/* 旁白（制作者撰写）：日记与图鉴的两种说法 */}
			<BiSubtitle
				{...SUB}
				from={T.subDiary[0]}
				to={T.subDiary[1]}
				zh="日记里写着，超梦是梦幻诞下的孩子。"
				en="The diary says that Mewtwo was born to Mew."
				source={{zh: '旁白（依据宝可梦屋日记）', en: 'NARRATION'}}
			/>
			<BiSubtitle
				{...SUB}
				from={T.subDex[0]}
				to={T.subDex[1]}
				zh="而图鉴记载，它是科学家用梦幻的遗传基因创造出来的。"
				en="But the Pokédex records that a scientist created it from Mew's genes."
				source={{zh: '旁白（依据《红·绿》《钻石·珍珠》图鉴）', en: 'NARRATION'}}
			/>
			<div style={{opacity: textO}}>
				<NameTag tone="ink" from={T.name} x={1330} y={290} no="No.0150" zh="超梦" en="MEWTWO" category="基因宝可梦" categoryEn="GENETIC POKÉMON" />
				<Seal from={T.seal} x={1578} y={388} text="超梦" size={78} seed={7} />
				<BiSubtitle
					{...SUB}
					from={T.subGene[0]}
					to={T.subGene[1]}
					zh="超梦的基因几乎和梦幻完全一样，但是大小和性格却迥异得让人吃惊。"
					en="Its DNA is almost the same as Mew’s. However, its size and disposition are vastly different."
					source={{zh: '超梦图鉴《Let’s Go! 皮卡丘·伊布》', en: 'POKÉDEX · LET’S GO'}}
				/>
				{/* 中文已核实：52poke「超梦」图鉴表《欧米伽红宝石·阿尔法蓝宝石》一行，无 * 标记（官方译文），取后半句 */}
				<BiSubtitle
					{...SUB}
					from={T.subHeart[0]}
					to={T.subHeart[1]}
					zh="人类的科学力量可以造出它的身体，却无法造出一颗温柔的心。"
					en="Even though the scientific power of humans created this Pokémon’s body, they failed to endow Mewtwo with a compassionate heart."
					source={{zh: '超梦图鉴《欧米伽红宝石·阿尔法蓝宝石》', en: 'POKÉDEX · OMEGA RUBY'}}
				/>
			</div>
			<Cry name="mewtwo" at={T.cry} />
			<Grain opacity={0.06} />
		</AbsoluteFill>
	);
};
