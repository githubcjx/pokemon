import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {Cam, project, track, unproject} from '../../camera';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {HOTEL_SCENE_FRAMES, REUNION_SCENE_FRAMES, globalFrame, globalTime} from './continuity';
import {Glow, RoomBg, WallShadow, onScreen} from './Oil';
import {ReunionView, reunionCam, reunionFloette} from './ReunionScene';

export {HOTEL_SCENE_FRAMES};

/**
 * 第 8 段《旅馆 Z》（30 秒，暖色）：
 * 花叶蒂的光涨满画面，化成旅馆客厅里的一盏灯 → ＡＺ坐在扶手椅里（Z-A 官方立绘，油画），花叶蒂在他肩头 →
 * 墙上映出几个年轻人的影子（超Z队，官方立绘压成的剪影）→ "时隔3000年的重逢，应该代表着花叶蒂原谅了我"。
 */

const BLOOM = 28;
const END_T = globalTime('reunion', REUNION_SCENE_FRAMES);
const F_END = project(reunionCam(REUNION_SCENE_FRAMES), 1, reunionFloette(REUNION_SCENE_FRAMES, END_T));

export const ROOM_CAM0: Cam = {x: 960, y: 540, zoom: 1, roll: 0};
/**
 * 落地灯：花叶蒂的光从它在第 7 段结尾的位置（F_END）涨满画面，一边涨一边移到这盏灯上，再收成灯光。
 * 灯固定在画面 (879, 616)（第 7 段改成脸部特写之前，花叶蒂在结尾停的位置），客厅的构图不变。
 */
const LAMP_W = unproject(ROOM_CAM0, 1, {x: 879, y: 616});
export const ROOM_LAMP: [number, number] = [LAMP_W.x, LAMP_W.y];
/** ＡＺ与扶手椅（Z-A 立绘中心，世界坐标） */
export const AZ_CHAIR = {x: 1250, y: 600, size: 860};

export const hotelCam = (f: number): Cam => ({
	x: track(f, [
		[0, ROOM_CAM0.x],
		[HOTEL_SCENE_FRAMES, 1040],
	]),
	y: track(f, [
		[0, ROOM_CAM0.y],
		[HOTEL_SCENE_FRAMES, 560],
	]),
	zoom: track(f, [
		[0, ROOM_CAM0.zoom],
		[HOTEL_SCENE_FRAMES, 1.1],
	]),
	roll: 0,
});

/** 超Z队（塔霓、玳萝、琵鲁、共熙）投在墙上的影子 */
export const FRIENDS = [
	{src: 'trainers/taunie/za.png', w: 665, h: 1600, x: 250, hgt: 470},
	{src: 'trainers/lida/za.png', w: 869, h: 1600, x: 410, hgt: 450},
	{src: 'trainers/naveen/za.png', w: 694, h: 1600, x: 560, hgt: 480},
	{src: 'trainers/paxton/za.png', w: 716, h: 1600, x: 700, hgt: 460},
];

/** ＡＺ在客厅里的样子（第 9 段开头接续时也用） */
export const ChairAZ: React.FC<{cam: Cam; opacity?: number; lamp?: number}> = ({cam, opacity = 1, lamp = 1}) => {
	const a = onScreen(cam, AZ_CHAIR);
	const l = project(cam, 1, {x: ROOM_LAMP[0], y: ROOM_LAMP[1]});
	const amb = 0.42 + 0.18 * lamp;
	return (
		<PokemonArt3D
			dir="trainers/az"
			variant="-za"
			x={a.x}
			y={a.y}
			size={AZ_CHAIR.size * a.s}
			depthScale={0.45}
			ambient={[amb * 1.08, amb * 0.95, amb * 0.82]}
			dirLights={[{dir: [(l.x - a.x) / 500, (l.y - a.y) / 500, 0.7], color: [0.5 * lamp, 0.36 * lamp, 0.2 * lamp], wrap: 0.6}]}
			rim={{dir: [l.x - a.x, l.y - a.y], color: [0.5 * lamp, 0.34 * lamp, 0.16 * lamp], power: 3}}
			oil={{amount: 1, radius: 0.005, warm: 0.3}}
			opacity={opacity}
			resolution={1.4}
		/>
	);
};

export const HotelScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('hotel', frame);
	const cam = hotelCam(frame);

	const up = interpolate(frame, [0, BLOOM - 6], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const down = interpolate(frame, [BLOOM + 6, 100], [1, 0], {...clamp, easing: Easing.out(Easing.quad)});
	const bloom = Math.min(up, down);
	const prevO = 1 - interpolate(frame, [BLOOM - 6, BLOOM + 4], [0, 1], clamp);
	const lampS = project(cam, 1, {x: ROOM_LAMP[0], y: ROOM_LAMP[1]});
	// 光晕在涨满的过程中，从花叶蒂的位置慢慢移到灯上
	const drift = interpolate(frame, [6, BLOOM + 20], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const bloomR = interpolate(frame, [0, BLOOM - 6, 100], [200, 2600, 700], clamp);

	const friendsO = interpolate(frame, [300, 400], [0, 1], clamp);

	return (
		<AbsoluteFill style={{background: '#120a06'}}>
			<RoomBg time={t} cam={cam} lampP={ROOM_LAMP} />
			{/* 墙上年轻人的影子 */}
			{friendsO > 0 &&
				FRIENDS.map((f, i) => {
					const p = project(cam, 0.85, {x: f.x, y: 820});
					return <WallShadow key={i} src={f.src} w={f.w} h={f.h} x={p.x} y={p.y} height={f.hgt * cam.zoom} opacity={friendsO * 0.9} skew={Math.sin(t * 0.8 + i * 1.7) * 1.5 - 4} />;
				})}
			<ChairAZ cam={cam} />

			<DustMotes opacity={0.4} rgb="255,214,150" frameOffset={globalFrame('hotel', 0)} />

			{/* 第 7 段接续：花叶蒂的光涨满画面，化成这盏灯 */}
			{prevO > 0 && (
				<AbsoluteFill style={{opacity: prevO}}>
					<ReunionView frame={REUNION_SCENE_FRAMES} time={t} />
					<DustMotes opacity={0.5} rgb="255,214,150" frameOffset={globalFrame('hotel', 0)} />
				</AbsoluteFill>
			)}
			<Glow x={F_END.x + (lampS.x - F_END.x) * drift} y={F_END.y + (lampS.y - F_END.y) * drift} r={bloomR} rgb="255,226,176" amt={bloom * 1.6} blend="normal" />

			<Vignette strength={0.58} />

			<BiSubtitle zh="后来，他在密阿雷开了一家旅馆。" en="Later, he opened a hotel in Lumiose." from={70} to={176} source={{zh: '传说 Z-A（旅馆Z）', en: 'Legends: Z-A (Hotel Z)'}} />
			<BiSubtitle zh="「这里对我来说是人生最后的住处，这就是旅馆『Z』的意义。」" en={'"This place was intended to be my final residence. That is why I called it Hotel \'Z.\'"'} from={186} to={318} source={{zh: '传说 Z-A·ＡＺ（官方中文；外层加引号，原文的「Z」改为『Z』）', en: 'Legends: Z-A, AZ'}} />
			<BiSubtitle zh="身边有花叶蒂，还有一群年轻的朋友。" en="Floette was by his side, and so were a group of young friends." from={328} to={446} source={{zh: '传说 Z-A（超Z队）', en: 'Legends: Z-A (Team MZ)'}} />
			<BiSubtitle
				zh="「因为有宝可梦在身边，我才能更容易地和别人搭话……也就是说，宝可梦给了我认识世界的契机。」"
				en={'"Having a Pokémon by one\'s side makes it easier to speak to others... even those we don\'t yet know."'}
				from={456}
				to={650}
				source={{zh: '传说 Z-A·ＡＺ（官方中文）', en: 'Legends: Z-A, AZ（⚠ 英文后半句与中文不同，待核实对应）'}}
			/>
			<BiSubtitle zh="「时隔3000年的重逢应该代表着花叶蒂原谅了我……」" en={'"Floette returning to my side again after three thousand years was an act of forgiveness."'} from={664} to={830} source={{zh: '传说 Z-A·ＡＺ屋顶自白（官方中文）', en: 'Legends: Z-A, AZ on the roof'}} />

		</AbsoluteFill>
	);
};
