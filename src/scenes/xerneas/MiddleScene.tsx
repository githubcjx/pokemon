import {AbsoluteFill, Sequence} from 'remotion';
import {track} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Grain} from '../../components/Grain';
import {toFrames, useFrame} from '../../time';
import {cameraAt, CameraShot, DepthForest, figurePose, perspective} from './DepthWorld';
import {LifeLight} from './LifeLight';
import {CrownLight, EyeInset, GroundGeomancy} from './MiddleEffects';
import {OpeningArt, OPENING_END_POSE, smooth, XerneasPose} from './OpeningArt';
import {OpeningPicture, OpeningTitle, OPENING_SCENE_FRAMES} from './OpeningScene';

export const MIDDLE_SCENE_FRAMES = 1620;
export const MIDDLE_START = OPENING_SCENE_FRAMES - 0.5;

const DEX = {
	zh: '原文。https://dex.pokemon.cn/play/pokedex/0716',
	en: 'Pokémon Y Pokédex flavor text. https://pokeapi.co/api/v2/pokemon-species/716/',
};
const ANISTAR = 'https://bulbapedia.bulbagarden.net/wiki/Walkthrough:Pok%C3%A9mon_X_and_Y/Part_10#Learn_the_Story_of_the_Legendary';
const LEGEND = {zh: `旁白，依据百刻市口述传说。${ANISTAR}`, en: `Narration based on the tale told in Anistar City in Pokémon X. ${ANISTAR}`};
const ART = {zh: '旁白，依据官方立绘。https://zukan.pokemon.co.jp/detail/0716', en: 'Narration based on the official artwork. https://zukan.pokemon.co.jp/detail/0716'};
const MOVE = {zh: '旁白，依据官方招式展示。https://www.pokemon.co.jp/ex/xy/pokemon/legend/01.html', en: 'Narration based on the official Geomancy demonstration. https://www.pokemon.co.jp/ex/xy/pokemon/legend/01.html'};

const CUES = [
	{from: 27, to: 188, source: DEX, zh: '据说，当头上的角闪着七色光时，会分享永恒的生命。', en: 'When the horns on its head shine in seven colors, it is said to be sharing everlasting life.'},
	{from: 200, to: 305, source: LEGEND, zh: '百刻市流传着一个故事。', en: 'An old tale is told in Anistar City.'},
	{from: 316, to: 449, source: LEGEND, zh: '很久以前，哲尔尼亚斯的鹿角曾照亮卡洛斯。', en: 'Long ago, Xerneas lit up Kalos with its shining antlers.'},
	{from: 460, to: 603, source: LEGEND, zh: '一整片森林，就在它身边长了出来。', en: 'An entire forest sprang up around it.'},
	{from: 614, to: 766, source: LEGEND, zh: '寿命将尽时，它把剩下的力量分给附近的生灵。', en: 'As its life drew to a close, it shared its remaining strength with nearby living things.'},
	{from: 778, to: 928, source: LEGEND, zh: '它自己，则化成了森林深处的一棵枯树。', en: 'It became a withered tree, hidden deep in the forest.'},
	{from: 951, to: 1097, source: ART, zh: '鹿角一层层分岔，像把树冠长在了头上。', en: 'Its branching antlers look like the crown of a tree.'},
	{from: 1111, to: 1246, source: ART, zh: '仔细看，连它的瞳孔也是 X 形的。', en: 'Look closely. Even its pupils are shaped like an X.'},
	{from: 1259, to: 1394, source: MOVE, zh: '它的专属招式叫「大地掌控」。', en: 'Its signature move is Geomancy.'},
	{from: 1405, to: 1571, source: MOVE, zh: '七色光又出现了。这一回，能量从它周围的地面涌出来。', en: 'The seven colors return. This time, energy surges from the ground around it.'},
];

// 镜头对准鹿角根部。首帧沿用片头最后一帧的机位和全局时间。
const SHOTS = [
	[0, OPENING_END_POSE.x, OPENING_END_POSE.y, OPENING_END_POSE.scale],
	[34, OPENING_END_POSE.x, OPENING_END_POSE.y, OPENING_END_POSE.scale],
	[131, 1015, 301, 1.08],
	[198, 1018, 306, 1.065],
	[315, 995, 399, 0.85],
	[450, 979, 398, 0.86],
	[635, 960, 390, 0.865],
	[799, 979, 362, 0.93],
	[931, 956, 354, 0.93],
	[1044, 966, 493, 1.51],
	[1090, 990, 477, 1.43],
	[1130, 1225, 390, 1.28],
	[1220, 1249, 396, 1.28],
	[1297, 1005, 358, 0.93],
	[1425, 963, 333, 0.97],
	[MIDDLE_SCENE_FRAMES, 985, 339, 0.96],
];
const X_KEYS = SHOTS.map(([f, x]): [number, number] => [f, x]);
const Y_KEYS = SHOTS.map(([f, , y]): [number, number] => [f, y]);
const SCALE_KEYS = SHOTS.map(([f, , , scale]): [number, number] => [f, scale]);
const poseAt = (f: number): XerneasPose => ({x: track(f, X_KEYS), y: track(f, Y_KEYS), scale: track(f, SCALE_KEYS)});
const pulse = (f: number, a: number, b: number, c: number, d: number) => smooth(f, a, b) * (1 - smooth(f, c, d));
const FOREST_CAMERA: CameraShot[] = [
	{at: 265, eye: [-15, 25, -36], aim: [0, 1, 4], fov: 50, roll: -2},
	{at: 378, eye: [-19, 30, -37], aim: [0, 1.3, 6], fov: 49, roll: -4},
	{at: 512, eye: [-11, 20, -30], aim: [0, 2.3, 5], fov: 48, roll: -3},
	{at: 641, eye: [-8.2, 7.8, -21.5], aim: [0, 5, 0], fov: 51, roll: 1},
	{at: 739, eye: [3.1, 4.4, -21], aim: [0, 5.6, 1], fov: 46, roll: 2},
	{at: 919, eye: [7.6, 5.1, -21], aim: [0, 5, 0], fov: 44, roll: 0},
	{at: 1030, eye: [5.3, 8.8, -17.3], aim: [0, 7.8, 1], fov: 46, roll: -2},
	{at: 1198, eye: [0, 6.8, -17.5], aim: [0, 7, 0], fov: 47, roll: 0},
	{at: 1315, eye: [-5.4, 2.9, -22.4], aim: [0, 5.4, 1], fov: 48, roll: 1.8},
	{at: 1447, eye: [2.7, 3.9, -22], aim: [0, 5.9, 2], fov: 48, roll: -0.8},
	{at: MIDDLE_SCENE_FRAMES, eye: [4.1, 5.1, -25.5], aim: [0, 5.2, 1], fov: 47, roll: 0},
];
export const MIDDLE_END_CAMERA = cameraAt(MIDDLE_SCENE_FRAMES - 0.5, FOREST_CAMERA);

export const MiddleStage: React.FC<{frame: number}> = ({frame}) => {
	const view = perspective(cameraAt(frame, FOREST_CAMERA));
	const flatPose = poseAt(frame);
	const spatialPose = figurePose(view);
	const depth = smooth(frame, 272, 354);
	const portrait = pulse(frame, 947, 1025, 1225, 1301);
	const cameraBlend = depth * (1 - portrait);
	const pose = {
		x: flatPose.x + (spatialPose.x - flatPose.x) * cameraBlend,
		y: flatPose.y + (spatialPose.y - flatPose.y) * cameraBlend,
		scale: flatPose.scale + (spatialPose.scale - flatPose.scale) * cameraBlend,
	};
	const life = Math.max(pulse(frame, 52, 92, 112, 172), pulse(frame, 333, 372, 405, 492));
	const crest = Math.max(pulse(frame, 72, 91, 105, 138), pulse(frame, 347, 370, 390, 431));
	const growth = smooth(frame, 386, 642) * 1.19;
	const transfer = smooth(frame, 604, 812);
	const sleep = pulse(frame, 772, 899, 942, 1020);
	const charge = pulse(frame, 1260, 1369, 1482, 1587);
	const release = smooth(frame, 1357, 1460);
	const geomancy = pulse(frame, 1370, 1432, 1478, 1592);
	const forestLight = Math.max(life * 0.48, Math.sin(transfer * Math.PI) * 0.72, geomancy * 0.27);
	return (
		<>
			<OpeningArt frame={MIDDLE_START + frame} pose={pose} sleep={sleep} spectrum={life * 0.96} shadow={depth * 0.85} flat={1 - depth}
				landscape={depth > 0 ? <AbsoluteFill style={{opacity: depth}}><DepthForest view={view} growth={growth} light={forestLight} /></AbsoluteFill> : null}>
				<LifeLight pose={pose} gleam={life} wave={smooth(frame, 351, 611)} transfer={transfer} />
				<GroundGeomancy frame={frame} pose={pose} charge={charge} release={release} light={geomancy} />
			</OpeningArt>
			<CrownLight pose={pose} amount={crest} />
			{depth > 0 && <AbsoluteFill style={{opacity: depth * (1 - portrait * 0.79)}}><DepthForest view={view} growth={growth} light={forestLight} front /></AbsoluteFill>}
			<EyeInset pose={pose} amount={pulse(frame, 1103, 1136, 1227, 1260)} />
			<Vignette strength={0.58} />
		</>
	);
};

export const MiddleScene: React.FC = () => {
	const frame = useFrame();
	if (frame === 0) {
		return (
			<AbsoluteFill>
				<Sequence from={-toFrames(MIDDLE_START)} durationInFrames={toFrames(OPENING_SCENE_FRAMES)} layout="none">
					<OpeningPicture />
				</Sequence>
			</AbsoluteFill>
		);
	}
	return (
		<AbsoluteFill>
			<MiddleStage frame={frame} />
			<Grain frameOffset={MIDDLE_START} />
			<OpeningTitle frame={MIDDLE_START + frame} opacity={1 - smooth(frame, 9, 49)} />
			{CUES.map((cue) => <BiSubtitle key={cue.from} {...cue} sync wipe={19} fade={10} enStrong scrim={0.5} />)}
		</AbsoluteFill>
	);
};

