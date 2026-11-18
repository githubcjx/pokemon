import {AbsoluteFill, Sequence} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import type {V3} from '../../three/stage';
import {toFrames, useFrame} from '../../time';
import {cameraAt, CameraShot, DepthCave, DepthForest, figurePose, perspective, terrain} from './DepthWorld';
import {Cells, Cocoon, LegendFigure, LifeGather, NewLeaves, RockPass} from './EndingEffects';
import {MiddleScene, MIDDLE_END_CAMERA, MIDDLE_SCENE_FRAMES, MIDDLE_START} from './MiddleScene';
import {OpeningArt, smooth} from './OpeningArt';

export const ENDING_SCENE_FRAMES = 750;
const LAST_MIDDLE_FRAME = MIDDLE_SCENE_FRAMES - 0.5;
const WORLD_START = MIDDLE_START + LAST_MIDDLE_FRAME;
const Y_CRY = 83;
const Z_CRY = 452;

const Y = 'https://dex.pokemon.cn/play/pokedex/0717';
const PAIR = 'https://www.pokemon.co.jp/ex/xy/pokemon/legend/02.html';
const Z = 'https://www.pokemon.co.jp/ex/legends_z-a/sc/pokemon/250227_02/';
const LEGEND = 'https://bulbapedia.bulbagarden.net/wiki/Walkthrough:Pok%C3%A9mon_X_and_Y/Part_10#Learn_the_Story_of_the_Legendary';
const source = (url: string) => ({zh: `旁白。${url}`, en: `Narration. ${url}`});

const CUES = [
	{from: 24, to: 113, source: source(PAIR), zh: '与它成对的，是伊裴尔塔尔。', en: 'Its counterpart is Yveltal.'},
	{from: 125, to: 280, source: source(Y), zh: '寿命走到尽头时，它会吸取生灵的生命力，变回一枚茧。', en: 'At the end of its life, it absorbs life force from living things and returns to its cocoon.'},
	{from: 291, to: 385, source: source(LEGEND), zh: '一个把生命分出去，一个把生命收回来。', en: 'One shares life. The other draws it in.'},
	{from: 397, to: 555, source: source(Z), zh: '基格尔德由许多细胞聚成，监视并守护着这片土地的生态。', en: 'Zygarde gathers from many Cells, watching over and protecting the land’s ecosystem.'},
	{from: 567, to: 709, source: source(LEGEND), zh: '哲尔尼亚斯睡着以后，它分出去的生命，还在森林里生长。', en: 'After Xerneas falls asleep, the life it shared keeps growing in the forest.'},
];

const SKY_CAMERA: CameraShot[] = [
	{...MIDDLE_END_CAMERA, at: 0},
	{...MIDDLE_END_CAMERA, at: 8},
	{at: 44, eye: [-1.1, 9.7, -25], aim: [0, 10.4, 2], fov: 45, roll: -2.7},
	{at: Y_CRY, eye: [-5.9, 16.3, -24.6], aim: [0, 15, 4], fov: 43, roll: 1.6},
	{at: 160, eye: [-3.1, 18.4, -21.8], aim: [1, 15.9, 6], fov: 45, roll: -1},
	{at: 241, eye: [3.1, 17, -20], aim: [5, 13.8, 6], fov: 48, roll: 2.8},
];
const CAVE_CAMERA: CameraShot[] = [
	{at: 232, eye: [-4.8, 5.8, -12.8], aim: [1.4, 5.3, 21], fov: 54, roll: -2.5},
	{at: 291, eye: [-1.5, 4.1, -7.9], aim: [0.5, 5, 21], fov: 50, roll: 0},
	{at: 346, eye: [1.1, 4.9, -6.8], aim: [-0.8, 5.3, 21], fov: 46, roll: 0.8},
	{at: 408, eye: [3.7, 5.6, -3.1], aim: [0.1, 5.7, 24], fov: 48, roll: 2},
];
const GROVE_CAMERA: CameraShot[] = [
	{at: 379, eye: [-12, 4.8, -28], aim: [1, 5.3, 1], fov: 50, roll: -1.7},
	{at: Z_CRY, eye: [-8.4, 4.1, -23.4], aim: [0, 5.3, 1], fov: 48, roll: -0.5},
	{at: 529, eye: [-4.6, 5.1, -23], aim: [1, 5.4, 1], fov: 47, roll: 0.5},
	{at: 604, eye: [0.8, 5.2, -24.5], aim: [0, 4.8, 1.6], fov: 46, roll: -0.4},
	{at: 701, eye: [5.6, 11.4, -30], aim: [0.2, 4.7, 6], fov: 48, roll: 0.5},
	{at: ENDING_SCENE_FRAMES, eye: [7.7, 15.8, -36], aim: [0, 3.6, 8], fov: 50, roll: 0},
];

const pulse = (f: number, a: number, b: number, c: number, d: number) => smooth(f, a, b) * (1 - smooth(f, c, d));

const EndingStage: React.FC<{frame: number}> = ({frame}) => {
	const sky = frame < 326;
	const airView = perspective(cameraAt(frame, sky ? SKY_CAMERA : GROVE_CAMERA));
	const caveView = perspective(cameraAt(frame, CAVE_CAMERA));
	const cave = pulse(frame, 243, 258, 386, 403);
	const moon = sky ? smooth(frame, 11, 86) : 0;
	const woods = 1.19;
	const sleeping = sky ? 0 : 1;
	const tree = sky ? 1 - smooth(frame, 17, 68) : smooth(frame, 517, 591);
	const yveltal: V3 = [7.2 - smooth(frame, 140, 224) * 2.8, 15.6 + Math.sin(frame * 0.024) * 0.6, 4.9 - smooth(frame, 42, 166) * 2];
	const zygarde: V3 = [6.2, terrain(6.2, 2.6) + 5.7, 2.6];
	const red = pulse(frame, 32, Y_CRY, 208, 251);
	const green = pulse(frame, 414, Z_CRY, 511, 565);
	const treeEcho = pulse(frame, 286, 311, 359, 391);
	const warmth = sky ? red * 0.2 : green * 0.35 + 0.11 * smooth(frame, 560, 690);
	const foreground = sky ? 1 - moon * 0.9 : 0.37 + 0.63 * smooth(frame, 510, 595);
	return (
		<>
			{cave < 1 && <AbsoluteFill>
				<OpeningArt frame={WORLD_START + frame} pose={figurePose(airView)} figure={tree} sleep={sleeping} shadow={0.85} flat={0}
					landscape={<DepthForest view={airView} growth={woods} light={warmth} sky={moon} />}>
					<NewLeaves view={airView} frame={frame} />
				</OpeningArt>
				{sky && <>
					<LifeGather view={airView} point={yveltal} amount={pulse(frame, 119, 153, 212, 239)} time={frame} />
					<LegendFigure name="yveltal" view={airView} point={yveltal} height={14.7} amount={red} glow={Math.exp(-((frame - Y_CRY) ** 2) / 529)} roll={-2 + smooth(frame, 88, 194) * 5} />
				</>}
				{!sky && <>
					<Cells view={airView} target={zygarde} frame={frame} amount={pulse(frame, 377, 418, 465, 510)} />
					<LegendFigure name="zygarde" view={airView} point={zygarde} height={11.4} amount={green} glow={Math.exp(-((frame - Z_CRY) ** 2) / 676)} />
				</>}
				<AbsoluteFill style={{opacity: foreground}}><DepthForest view={airView} growth={woods} light={warmth} front /></AbsoluteFill>
			</AbsoluteFill>}
			{cave > 0 && <AbsoluteFill style={{opacity: cave}}>
				<DepthCave view={caveView} light={0.39 + 0.22 * Math.sin(frame * 0.047)} />
				<Cocoon view={caveView} amount={smooth(frame, 247, 272)} />
				{treeEcho > 0 && <AbsoluteFill style={{opacity: treeEcho * 0.91, maskImage: 'radial-gradient(ellipse 420px 455px at 500px 531px, black 53%, transparent 99%)'}}>
					<OpeningArt frame={WORLD_START + frame} pose={{x: 492 - 21 * smooth(frame, 286, 386), y: 394, scale: 0.68}} sleep={1} />
				</AbsoluteFill>}
			</AbsoluteFill>}
			<RockPass progress={smooth(frame, 224, 278)} />
			<RockPass progress={smooth(frame, 363, 421)} reverse />
			<Vignette strength={0.58} />
		</>
	);
};

export const EndingScene: React.FC = () => {
	const frame = useFrame();
	if (frame === 0) {
		return (
			<AbsoluteFill>
				<Sequence from={-toFrames(LAST_MIDDLE_FRAME)} durationInFrames={toFrames(MIDDLE_SCENE_FRAMES)} layout="none">
					<MiddleScene />
				</Sequence>
			</AbsoluteFill>
		);
	}
	return (
		<AbsoluteFill>
			<EndingStage frame={frame} />
			<Grain frameOffset={WORLD_START} />
			<NameTag from={Y_CRY - 14} x={129} y={355} no="0717 ·" category="破坏宝可梦" categoryEn="Destruction Pokémon" zh="伊裴尔塔尔" en="YVELTAL" tone="mono" glowRgb="255,113,148" opacity={pulse(frame, Y_CRY - 14, Y_CRY + 6, 130, 155)} />
			<NameTag from={Z_CRY - 11} x={129} y={361} no="0718 ·" category="秩序宝可梦" categoryEn="Order Pokémon" zh="基格尔德" en="ZYGARDE" tone="mono" glowRgb="143,238,168" opacity={pulse(frame, Z_CRY - 11, Z_CRY + 8, 513, 553)} />
			{CUES.map((cue) => <BiSubtitle key={cue.from} {...cue} sync wipe={18} fade={10} enStrong scrim={0.54} />)}
			<AbsoluteFill style={{background: '#000', opacity: smooth(frame, 711, 748)}} />
			<Cry name="yveltal" at={Y_CRY} volume={0.73} />
			<Cry name="zygarde" at={Z_CRY} volume={0.76} />
		</AbsoluteFill>
	);
};
