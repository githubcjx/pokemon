import {AbsoluteFill} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {DustMotes} from '../../components/DustMotes';
import {Grain} from '../../components/Grain';
import {useFrame} from '../../time';
import {bf, CRIES, SUBS, track} from './common';
import {BeforeLayer, HisuiLayer, HookLayer, TITLE_LINE_Y} from './Part1Layers';
import {ClansOriginLayer, ElectrodeLayer, MuseumLayer} from './Part2Layers';
import {EndingLayer, FactoryLayer, FINAL_FADE_FROM, finalFade, KurtLayer, MasterLayer} from './Part3Layers';
import {Backdrop, BackdropState, EraLabel, SourceCard} from './ui';

/**
 * 《人造容器》整期总时间轴。各段 / 各部分都是它的窗口（见 Segments.tsx）。
 *
 *   1 钩子：现代精灵球在第一个强拍落地 → 三样东西按拍亮起 → 第三样（空圆）收紧 → 球缩成装饰线中央的小金球，出片名
 *   2 没有球的年代：人和宝可梦的脚印每拍一步，并排向前
 *   3 洗翠时代：对着木木枭投球，第一次落空、几道虚影、第三次命中
 *   4 第一次上扬：木木枭化成金色剪影缩进球里，每拍摇一下，强拍收服、冒蒸汽 → 球果果 + 玉石 → 九种洗翠精灵球每半拍亮一格
 */

const backdrop = (f: number): BackdropState => {
	const k = (keys: [number, number][]) => track(f, keys);
	return {
		spot: [
			k([
				[0, 0.5],
				[bf(10), 0.5],
				[bf(10, 3), 0.68],
				[bf(16), 0.64],
				[bf(17), 0.36],
				[bf(19), 0.5],
				[bf(20), 0.5],
				[bf(21), 0.6],
				[bf(22, 2), 0.6],
				[bf(23), 0.5],
				[bf(34), 0.5],
				[bf(35, 2), 0.5],
				[bf(38), 0.5],
				[bf(56), 0.5],
				[bf(57), 0.7],
				[bf(60), 0.7],
				[bf(61), 0.5],
			]),
			k([
				[0, 0.46],
				[bf(4), 0.5],
				[bf(7), 0.55],
				[bf(10), 0.5],
				[bf(10, 3), 0.44],
				[bf(17), 0.44],
				[bf(19), 0.42],
				[bf(26), 0.42],
				[bf(27, 2), 0.38],
				[bf(29), 0.42],
				[bf(34), 0.42],
				[bf(35), 0.45],
				[bf(38), 0.45],
				[bf(43), 0.5],
				[bf(47), 0.42],
				[bf(56), 0.42],
				[bf(57), 0.44],
				[bf(60), 0.44],
				[bf(61), 0.47],
			]),
		],
		spotR: k([
			[0, 0.36],
			[bf(4), 0.42],
			[bf(7), 0.62],
			[bf(10), 0.5],
			[bf(10, 3), 0.38],
			[bf(19), 0.46],
			[bf(22, 2), 0.46],
			[bf(23, 2), 0.4],
			[bf(26), 0.4],
			[bf(27, 2), 0.3],
			[bf(29, 2), 0.32],
			[bf(30), 0.5],
			[bf(32), 0.4],
			[bf(34), 0.48],
			[bf(36), 0.55],
			[bf(38), 0.6],
			[bf(43), 0.7],
			[bf(47), 0.4],
			[bf(54), 0.42],
			[bf(55), 0.6],
			[bf(56), 0.42],
			[bf(60), 0.42],
			[bf(61), 0.36],
		]),
		spotAmt: k([
			[0, 0.0],
			[bf(0), 1.0],
			[bf(4), 0.85],
			[bf(7), 0.6],
			[bf(10), 0.7],
			[bf(10, 3), 1.05],
			[bf(19), 0.95],
			[bf(26), 0.95],
			[bf(27, 2), 0.7],
			[bf(29, 2), 0.7],
			[bf(30), 1.5],
			[bf(31), 1.05],
			[bf(34), 0.95],
			[bf(36), 0.8],
			[bf(38), 0.75],
			[bf(47), 0.95],
			[bf(50), 0.8],
			[bf(52), 1.0],
			[bf(54), 1.4],
			[bf(55), 0.9],
			[bf(56), 0.9],
			[bf(60), 0.9],
			[bf(61), 1.0],
		]),
		ringC: [
			k([
				[0, 960],
				[bf(10), 960],
				[bf(10, 3), 1390],
				[bf(16), 1300],
				[bf(17), 640],
				[bf(19), 960],
				[bf(20), 960],
				[bf(21), 1330],
				[bf(22, 2), 1330],
				[bf(23), 960],
				[bf(34), 960],
				[bf(35), 640],
				[bf(38), 640],
				[bf(39), 960],
				[bf(56), 960],
				[bf(56, 2), 1340],
				[bf(60), 1340],
				[bf(61), 960],
			]),
			k([
				[0, 500],
				[bf(4), 500],
				[bf(4, 2), TITLE_LINE_Y],
				[bf(7), TITLE_LINE_Y],
				[bf(10), 500],
				[bf(10, 3), 455],
				[bf(17), 470],
				[bf(19), 455],
				[bf(20), 455],
				[bf(21), 430],
				[bf(22, 2), 430],
				[bf(23), 450],
				[bf(34), 450],
				[bf(35), 470],
				[bf(38), 470],
				[bf(39), 470],
				[bf(47), 445],
				[bf(56), 445],
				[bf(56, 2), 470],
				[bf(60), 470],
				[bf(61), 500],
			]),
		],
		ringR: k([
			[0, 228],
			[bf(4), 228],
			[bf(5), 430],
			[bf(7), 520],
			[bf(10), 320],
			[bf(10, 3), 300],
			[bf(17), 250],
			[bf(19, 2), 330],
			[bf(20), 330],
			[bf(21), 260],
			[bf(22, 2), 260],
			[bf(23, 2), 230],
			[bf(29), 220],
			[bf(30), 210],
			[bf(31), 420],
			[bf(33), 300],
			[bf(34), 300],
			[bf(35), 240],
			[bf(38), 240],
			[bf(39), 520],
			[bf(47), 260],
			[bf(53), 260],
			[bf(54), 240],
			[bf(55), 460],
			[bf(56), 300],
			[bf(57), 210],
			[bf(60), 210],
			[bf(61), 228],
		]),
		rings: k([
			[0, 0],
			[bf(0), 0],
			[bf(1), 0.9],
			[bf(4), 1],
			[bf(5), 0.55],
			[bf(7), 0.12],
			[bf(10), 0.0],
			[bf(10, 3), 0.35],
			[bf(14), 0.6],
			[bf(16), 0.25],
			[bf(17), 0.55],
			[bf(19, 2), 0.7],
			[bf(22, 2), 0.6],
			[bf(23), 0.35],
			[bf(26), 0.35],
			[bf(27), 0.6],
			[bf(29), 0.9],
			[bf(30), 1.2],
			[bf(31, 2), 0.8],
			[bf(34), 0.5],
			[bf(35), 0.15],
			[bf(38), 0.15],
			[bf(39), 0.1],
			[bf(46), 0.1],
			[bf(47), 0.8],
			[bf(49), 0.5],
			[bf(52), 0.4],
			[bf(54), 1.1],
			[bf(55), 0.5],
			[bf(56), 0.3],
			[bf(57), 0.8],
			[bf(60), 0.8],
			[bf(61), 1.0],
		]),
		ringRot: f * 0.0016,
		floorY: f < bf(20) ? (500 + 150 * 0.98) / 1080 : f < bf(50) ? (300 + 300 + 64 + 6) / 1080 : (500 + 150 * 0.98) / 1080,
		floor: k([
			[0, 0],
			[bf(0), 0.9],
			[bf(3, 2), 0.9],
			[bf(4), 0],
			[bf(34), 0],
			[bf(35), 0.6],
			[bf(38), 0.6],
			[bf(38, 2), 0],
			[bf(56), 0],
			[bf(57), 0.7],
		]),
		bright: 1,
	};
};

const SUB_LIST = SUBS;

export const PokeballMaster: React.FC = () => {
	const f = useFrame();
	return (
		<AbsoluteFill style={{background: '#090603'}}>
			<Backdrop f={f} s={backdrop(f)} />
			<DustMotes opacity={0.45} frameOffset={0} />
			<HookLayer f={f} />
			<BeforeLayer f={f} />
			<HisuiLayer f={f} />
			<ElectrodeLayer f={f} />
			<ClansOriginLayer f={f} />
			<MuseumLayer f={f} />
			<KurtLayer f={f} />
			<FactoryLayer f={f} />
			<MasterLayer f={f} />
			<EndingLayer f={f} />
			<Vignette strength={0.62} />
			<EraLabel f={f} />
			<SourceCard f={f} />
			{SUB_LIST.map((s, i) => (
				<BiSubtitle key={i} zh={s.zh} en={s.en} from={s.from} to={s.to} />
			))}
			{f > FINAL_FADE_FROM && <AbsoluteFill style={{background: '#000', opacity: finalFade(f)}} />}
			<Grain opacity={0.12} />
			{CRIES.map((c) => (
				<Cry key={c.name + c.at} name={c.name} at={c.at} />
			))}
		</AbsoluteFill>
	);
};
