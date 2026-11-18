import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {CINZEL, SERIF} from '../../fonts';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {DM_PEAK, DW_PEAK, HIT, LUN_PEAK, REVEAL, SOL_PEAK, ULTRA} from './common';
import {inT, outT} from './continuity';
import {fadeOut} from './fx';
import {ShotAltar, ShotDawn, ShotLusamine, ShotSnow, ShotWarp} from './ShotsAlola';
import {ShotBook, ShotHookPage} from './ShotsBook';
import {ShotCity} from './ShotsCity';

/**
 * 《夺走的光辉》整期总时间轴（30fps 帧号，全部为整期帧号）。
 * 各段只是这条时间轴的窗口（见 SegmentWindow.tsx），所以段落交界天然无缝；段内的转场都由画面里的光来接：
 *
 *   1 黑暗里的烧焦书页，一束光照亮"光之掠夺者" → 光打在黑色晶体上折成光谱扇 → 光谱化成另一个世界天上的金光 → 片名
 *   2 镜头降到远古究极大都会：金光下的棱柱楼群、仰望的人
 *   3 聚光塔升起抽光 → 光团裂开、炸散 → 黑色晶体飞进究极之洞 → 城市只剩塔里囚住的光；天上悬着一个漆黑的影子
 *   4 奈克洛兹玛显色 → 把聚光塔里的光一束束吸回去 → 城市陷入黑暗
 *   5 黑暗中拔起究极大都会塔（人造的太阳）→ 光笼 → 镜头推进塔顶的光，曝白
 *   6 白光褪成书页：阿罗拉的古书，墨线插图一幅幅显出来（左太阳之兽、右月亮之兽）→ 年轻人与守护神的金光 → 整页烧起来
 *   7 烧穿处露出漆黑的城市，塔顶的光笼在颤 → 撕开究极之洞 → 露莎米奈闯进究极空间 → 左右对称分屏的日轮 / 月轮祭坛：
 *     太阳之兽、月亮之兽降临 → 奈克洛兹玛冲出来、合体 → 阿罗拉的光被吸走，天上各处撕开究极之洞
 *   8 究极空间跳跃骑行（左骑露奈雅拉、右骑索尔迦雷欧）→ 塔顶究极爆发 → 光子喷涌对上Ｚ力量（全片最大爆发点）
 *     → 反转：Ｚ力量本来就是它的光 → 光碎成光点，落回黎明的阿罗拉
 *   9 依然漆黑的究极大都会 → 拉纳基拉山顶的雪坑里，失去光的它 → 金银两道光落在它身边
 *
 * 各镜头按"内部帧号"编写；第 2、5 段提速播放（continuity.ts 的 inT / outT），字幕、名称卡、叫声换回输出时间。
 */

const EpisodeTitle: React.FC<{f: number; from: number; to: number}> = ({f, from, to}) => {
	if (f < from || f > to) return null;
	const o = interpolate(f, [from, from + 26, to - 20, to], [0, 1, 1, 0], clamp);
	const sp = interpolate(f, [from, to], [40, 24], {...clamp, easing: Easing.out(Easing.cubic)});
	const enO = interpolate(f, [from + 18, from + 44], [0, 1], clamp);
	const disp = interpolate(f, [from, from + 30], [7, 1.6], clamp);
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top: 380, textAlign: 'center', opacity: o}}>
			<div style={{position: 'absolute', left: 360, right: 360, top: -90, height: 380, background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(40,18,4,0.55) 0%, rgba(40,18,4,0.3) 50%, rgba(40,18,4,0) 100%)'}} />
			<div
				style={{
					fontFamily: SERIF,
					fontWeight: 800,
					fontSize: 122,
					letterSpacing: sp,
					paddingLeft: sp,
					position: 'relative',
					color: '#fffaf0',
					textShadow: `${-disp}px 0 0 rgba(255,60,130,0.45), ${disp}px 0 0 rgba(60,210,255,0.45), 0 0 30px rgba(255,220,160,0.55), 0 0 80px rgba(255,200,130,0.35), 0 4px 10px rgba(20,10,0,0.8)`,
				}}
			>
				夺走的光辉
			</div>
			<div
				style={{
					position: 'relative',
					width: interpolate(f, [from + 10, from + 50], [0, 760], {...clamp, easing: Easing.out(Easing.cubic)}),
					height: 2,
					margin: '18px auto 0',
					background: 'linear-gradient(90deg, rgba(255,77,109,0), #ff4d6d 12%, #ffb347 28%, #fff27a 42%, #6dff9a 56%, #4dd8ff 72%, #7a6dff 88%, rgba(122,109,255,0))',
					boxShadow: '0 0 12px rgba(255,240,210,0.6)',
				}}
			/>
			<div style={{position: 'relative', fontFamily: CINZEL, fontWeight: 600, fontSize: 30, letterSpacing: 18, paddingLeft: 18, color: 'rgba(255,246,230,0.95)', marginTop: 16, opacity: enO, textShadow: '0 0 10px rgba(40,18,4,0.9), 0 2px 8px rgba(20,10,0,0.95)'}}>
				THE STOLEN RADIANCE
			</div>
		</div>
	);
};

type Sub = {from: number; to: number; zh: string; en: string; src: {zh: string; en: string}; tone?: 'light' | 'prism'};
const NARR = {zh: '旁白', en: 'NARRATION'};
const SRC = (zh: string, en: string) => ({zh, en});

const SUBS: Sub[] = [
	// 第 1 段
	{from: 30, to: 140, zh: '阿罗拉的一本古书里，它被叫作“光之掠夺者”。', en: 'In an old book from Alola, it is called "the pillager of light."', src: NARR},
	{from: 256, to: 342, zh: '可在另一个世界，人们曾叫它“光辉大神”。', en: 'But in another world, people once called it "the Blinding One."', src: NARR},
	{from: 350, to: 428, zh: '同一只宝可梦，为什么会有两个名字？', en: 'Why would a single Pokémon bear two such names?', src: NARR},
	// 第 2 段
	{from: 562, to: 662, zh: '很久以前，在另一个世界里，有一座城市。', en: 'Long ago, in another world, there stood a city.', src: NARR},
	{from: 676, to: 790, zh: '照亮这座城市的，是一只宝可梦的光。', en: 'The light that lit it came from a single Pokémon.', src: NARR},
	// 第 3 段
	{from: 975, to: 1045, zh: '可人们并不满足。', en: 'But the people were not content.', src: NARR},
	{from: 1054, to: 1150, zh: '他们想把那份光，变成自己的东西。', en: 'They wanted to make that light their own.', src: NARR},
	{from: 1300, to: 1410, zh: '它受了伤，失去了身体的一部分，也失去了光。', en: 'It was wounded. It lost a part of its body, and its light.', src: NARR},
	{from: 1420, to: 1545, zh: '有人认为，它碎落的身体落到了阿罗拉，成了今天的Ｚ纯晶。', en: "Some believe the shards of its body fell to Alola and became today's Z-Crystals.", src: NARR},
	{from: 1558, to: 1700, zh: '动画里，它的光是为别的世界付出的；游戏里，是被人夺走的。', en: 'In the anime, it gave its light for other worlds. In the games, its light was taken.', src: NARR},
	// 第 4 段
	{from: 1862, to: 1992, zh: '为了寻找作为能量的光而发狂的样子看上去有些痛苦。', en: 'It looks somehow pained as it rages around in search of light, which serves as its energy.', src: SRC('奈克洛兹玛图鉴《究极之日》', 'POKÉDEX · ULTRA SUN'), tone: 'prism'},
	{from: 2050, to: 2180, zh: '它夺回了城里的光。那个世界，从此陷入了黑暗。', en: "It took back the city's light, and that world fell into darkness.", src: NARR},
	// 第 5 段
	{from: 2395, to: 2530, zh: '人们造起一座高塔，用人造的光代替失去的太阳，', en: 'The people raised a tower, its false light standing in for the sun they had lost,', src: NARR},
	{from: 2550, to: 2650, zh: '也用这座塔，把它关了起来。', en: 'and in that same tower, they locked it away.', src: NARR},
	{from: 2662, to: 2778, zh: '它也曾逃出来过。阿罗拉的古书，记下了那一次。', en: 'Once, it escaped. An old book from Alola recorded what happened.', src: NARR},
	// 第 6 段（烧焦的书页：官方中文；英文自译）
	{from: 2870, to: 2990, zh: '来自广袤天空的光之掠夺者现身了，世界被黑暗包围。', en: 'The pillager of light appeared from the vast sky, and the world was wrapped in darkness.', src: SRC('烧焦的书页《究极之日》', 'BURNT PAGE · ULTRA SUN')},
	{from: 3000, to: 3135, zh: '残页上，被它夺走的，有的写着吞食太阳之兽，有的写着邀引月亮之兽。', en: 'The pages disagree on what it seized: some say the beast that devours the sun, others the beast that calls the moon.', src: NARR},
	{from: 3145, to: 3240, zh: '吞食太阳之兽被夺走，成为了黄昏之鬃。', en: 'The beast that devours the sun was taken, and became Dusk Mane.', src: SRC('烧焦的书页《究极之日》', 'BURNT PAGE · ULTRA SUN')},
	{from: 3248, to: 3345, zh: '邀引月亮之兽被夺走，成为了拂晓之翼。', en: 'The beast that calls the moon was taken, and became Dawn Wings.', src: SRC('烧焦的书页《究极之月》', 'BURNT PAGE · ULTRA MOON')},
	{from: 3365, to: 3445, zh: '年轻人和守护神使用石头，放出光明，', en: 'A youth and the guardians used the stones to release light,', src: SRC('烧焦的书页《究极之日》', 'BURNT PAGE · ULTRA SUN')},
	{from: 3452, to: 3530, zh: '……赶走了阿罗拉的黑暗。', en: '...and drove the darkness from Alola.', src: SRC('烧焦的书页《究极之日》', 'BURNT PAGE · ULTRA SUN')},
	{from: 3552, to: 3690, zh: '据说，当时的国王为了不让人们害怕，烧掉了所有写着它的书。', en: 'It is said the king of that time burned every book about it, so the people would not be afraid.', src: NARR},
	// 第 7 段（第三部分从内部帧 3780 开始，第一句不能早于它）
	{from: 3800, to: 3878, zh: '很多年后，高塔快要关不住它了。', en: 'Many years later, the tower could barely hold it.', src: NARR},
	{from: 3884, to: 3962, zh: '就在这时，有人从阿罗拉打开了究极之洞。', en: 'Just then, someone opened an Ultra Wormhole from Alola.', src: NARR},
	{from: 3968, to: 4044, zh: '是以太基金会的露莎米奈。她要一个人去对付它。', en: 'It was Lusamine of the Aether Foundation. She meant to face it alone.', src: NARR},
	{from: 4050, to: 4120, zh: '另一边，年轻人和莉莉艾在祭坛上吹响了笛子。', en: 'Meanwhile, at the altar, a youth and Lillie played the flutes.', src: NARR},
	{from: 4126, to: 4196, zh: '莉莉艾的宝可梦进化了——索尔迦雷欧，或是露奈雅拉。', en: "Lillie's Pokémon evolved—into Solgaleo, or into Lunala.", src: NARR},
	{from: 4202, to: 4260, zh: '祭坛上空，突然撕开了究极之洞——', en: 'Above the altar, an Ultra Wormhole tore open—', src: NARR},
	{from: 4265, to: 4328, zh: '露莎米奈被甩了回来。她输了。', en: 'Lusamine was thrown back out. She had lost.', src: NARR},
	{from: 4334, to: 4396, zh: '追着她冲出来的，是奈克洛兹玛。', en: 'And right behind her came Necrozma.', src: NARR},
	{from: 4402, to: 4456, zh: '古书上的事，又发生了一次。', en: 'What the old book told of happened once again.', src: NARR},
	{from: 4462, to: 4580, zh: '它吞下了莉莉艾那只宝可梦的光，成了古书里的黄昏之鬃、拂晓之翼。', en: "It swallowed the light of Lillie's Pokémon, and became the Dusk Mane, the Dawn Wings of the old book.", src: NARR},
	{from: 4594, to: 4666, zh: '阿罗拉的光被吸走了，天上到处裂开究极之洞。', en: "Alola's light was drained away, and Ultra Wormholes split the sky.", src: NARR},
	{from: 4672, to: 4738, zh: '它带着抢来的光，逃回了究极大都会。', en: 'With the stolen light, it fled back to Ultra Megalopolis.', src: NARR},
	// 第 8 段
	{from: 4746, to: 4822, zh: '究极调查队还有另一只，是他们往来两个世界时骑的。', en: 'The Ultra Recon Squad had another one—the one they rode between worlds.', src: NARR},
	{from: 4828, to: 4895, zh: '年轻人骑上它，穿过究极之洞追了上去。', en: 'The youth climbed on and gave chase through the wormhole.', src: NARR},
	{from: 4905, to: 4990, zh: '在塔顶，它想用夺来的光，变回原来的样子——', en: 'At the top of the tower, it tried to use the stolen light to become what it once was—', src: NARR},
	{from: 5030, to: 5165, zh: '吸收压倒性的光能量后变化而成的样子。从全身发射出激光。', en: 'This is its form when it has absorbed overwhelming light energy. It fires laser beams from all over its body.', src: SRC('究极奈克洛兹玛图鉴《究极之日》', 'POKÉDEX · ULTRA SUN'), tone: 'prism'},
	{from: 5172, to: 5250, zh: '年轻人举起Ｚ手环，放出了Ｚ力量。', en: 'The youth raised the Z-Power Ring and unleashed Z-Power.', src: NARR},
	{from: 5262, to: 5338, zh: '还记得吗？Ｚ纯晶，可能就是它碎落的身体。', en: 'Remember? The Z-Crystals may be shards of its own body.', src: NARR},
	{from: 5345, to: 5425, zh: 'Ｚ力量的光，本来就是它的光。', en: 'The light of Z-Power had always been its own.', src: NARR},
	{from: 5448, to: 5545, zh: '打败它的，从头到尾，都是它自己的光。', en: 'From beginning to end, what defeated it was its own light.', src: NARR},
	// 第 9 段
	{from: 5552, to: 5630, zh: '光，回到了阿罗拉。', en: 'And light returned to Alola.', src: NARR},
	{from: 5655, to: 5755, zh: '可究极大都会的天空，依然是黑的。', en: 'But the sky over Ultra Megalopolis is still dark.', src: NARR},
	{from: 5800, to: 5910, zh: '后来，年轻人在拉纳基拉山上，找到了虚弱的它。', en: 'Later, on Mount Lanakila, the youth found it, weakened.', src: NARR},
	{from: 5925, to: 6025, zh: '年轻人把Ｚ手环的光，分了一些给它。', en: 'The youth shared some of the Z-Power Ring\'s light with it.', src: NARR},
	{from: 6040, to: 6190, zh: '莉莉艾说，只要能留在她的宝可梦身边，它就不会再那么痛苦。', en: 'Lillie says that if it can stay close to her Pokémon, it will not suffer so.', src: NARR},
	{from: 6205, to: 6300, zh: '被夺走光辉的，成了光之掠夺者。', en: 'The one robbed of its radiance became the pillager of light.', src: NARR},
	{from: 6315, to: 6450, zh: '可它夺走的，不过是它自己曾经给出去的光。', en: 'Yet all it ever took was the light it once gave away.', src: NARR},
];

export const NecrozmaMaster: React.FC = () => {
	const f = inT(useFrame());
	const endFade = interpolate(f, [6450, 6520], [0, 1], clamp);
	// 浅色的书页上颗粒更明显、更耗码率
	const grain = f > 2790 && f < 3770 ? 0.06 : 0.11;
	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			<ShotCity f={f} />
			<ShotHookPage f={f} />
			<ShotBook f={f} />
			<ShotLusamine f={f} />
			<ShotAltar f={f} />
			<ShotWarp f={f} />
			<ShotDawn f={f} />
			<ShotSnow f={f} />

			<Vignette strength={0.5} />
			<SubtitleBackdrop />
			<EpisodeTitle f={f} from={436} to={538} />
			{SUBS.map((s) => (
				<BiSubtitle key={s.from} from={outT(s.from)} to={outT(s.to)} zh={s.zh} en={s.en} source={s.src} tone={s.tone ?? 'light'} />
			))}

			<NameTag from={outT(REVEAL + 10)} x={100} y={300} no="No.0800" zh="奈克洛兹玛" en="NECROZMA" category="棱镜宝可梦" categoryEn="PRISM POKÉMON" tone="prism" glowRgb="200,215,255" opacity={fadeOut(f, 1995, 2015)} />
			<NameTag from={outT(SOL_PEAK + 8)} x={64} y={64} compact no="No.0791" zh="索尔迦雷欧" en="SOLGALEO" category="日轮宝可梦" categoryEn="SUNNE POKÉMON" tone="prism" glowRgb="255,210,130" opacity={fadeOut(f, 4170, 4190)} />
			<NameTag from={outT(LUN_PEAK + 8)} x={1856} y={64} align="right" compact no="No.0792" zh="露奈雅拉" en="LUNALA" category="月轮宝可梦" categoryEn="MOONE POKÉMON" tone="prism" glowRgb="200,170,255" opacity={fadeOut(f, 4170, 4190)} />
			<NameTag from={outT(DM_PEAK + 8)} x={64} y={64} compact no="No.0800" zh="奈克洛兹玛·黄昏之鬃" en="DUSK MANE NECROZMA" category="棱镜宝可梦" categoryEn="PRISM POKÉMON" tone="prism" glowRgb="255,210,130" opacity={fadeOut(f, 4580, 4600)} />
			<NameTag from={outT(DW_PEAK + 8)} x={1856} y={64} align="right" compact no="No.0800" zh="奈克洛兹玛·拂晓之翼" en="DAWN WINGS NECROZMA" category="棱镜宝可梦" categoryEn="PRISM POKÉMON" tone="prism" glowRgb="200,170,255" opacity={fadeOut(f, 4580, 4600)} />
			<NameTag from={outT(ULTRA + 22)} x={96} y={84} no="No.0800" zh="究极奈克洛兹玛" en="ULTRA NECROZMA" category="棱镜宝可梦" categoryEn="PRISM POKÉMON" tone="prism" glowRgb="255,220,140" opacity={fadeOut(f, 5165, 5185)} />

			<Cry name="necrozma" at={outT(REVEAL)} />
			<Cry name="solgaleo" at={outT(SOL_PEAK)} />
			<Cry name="lunala" at={outT(LUN_PEAK)} />
			<Cry name="necrozma-dusk" at={outT(DM_PEAK)} />
			<Cry name="necrozma-dawn" at={outT(DW_PEAK)} />
			<Cry name="necrozma-ultra" at={outT(ULTRA)} volume={0.95} />
			{/* 全片最大的爆发点：Ｚ力量压过光子喷涌、命中时再放一次 */}
			<Cry name="necrozma-ultra" at={outT(HIT)} volume={1} />

			<Grain opacity={grain} />
			{endFade > 0 && <AbsoluteFill style={{background: `rgba(0,0,0,${endFade})`}} />}
		</AbsoluteFill>
	);
};
