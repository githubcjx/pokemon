import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {Cam, project, track} from '../../camera';
import {clamp} from '../../theme';
import {useFrame} from '../../time';
import {CODA_SCENE_FRAMES, HOTEL_SCENE_FRAMES, globalFrame, globalTime} from './continuity';
import {AZ_CHAIR, ChairAZ, FRIENDS, ROOM_LAMP, hotelCam} from './HotelScene';
import {CemeteryBg, RoomBg, WallShadow, onScreen} from './Oil';

export {CODA_SCENE_FRAMES};

/**
 * 第 9 段《尾声》（25 秒）：
 * 灯光暗下来，扶手椅空了，花叶蒂停在椅背上 → 清晨的安息墓地，他的墓碑（只画轮廓）→ 墓志铭逐句浮现（传说 Z-A 官方中文）→
 * 回到扶手椅里微笑的他（Z-A 立绘，花叶蒂在肩头），淡出。不放标题。
 */

const TO_GRAVE: [number, number] = [170, 224];
const BACK: [number, number] = [700, 730];
const OUT: [number, number] = [724, CODA_SCENE_FRAMES];

const cam0 = hotelCam(HOTEL_SCENE_FRAMES);
const codaRoomCam = (f: number): Cam => ({
	x: track(f, [
		[0, cam0.x],
		[TO_GRAVE[1], 1066],
	]),
	y: track(f, [
		[0, cam0.y],
		[TO_GRAVE[1], 566],
	]),
	zoom: track(f, [
		[0, cam0.zoom],
		[TO_GRAVE[1], 1.14],
	]),
	roll: 0,
});
const graveCam = (f: number): Cam => ({
	x: 960,
	y: track(f, [
		[TO_GRAVE[0], 560],
		[BACK[0], 640],
	]),
	zoom: track(f, [
		[TO_GRAVE[0], 1.0],
		[BACK[0], 1.32],
	]),
	roll: 0,
});

/** 空了的扶手椅：与 Z-A 立绘里的椅子对齐（立绘内 0–1 坐标量出的位置），代码画 */
const EmptyChair: React.FC<{cam: Cam; opacity: number}> = ({cam, opacity}) => {
	const a = onScreen(cam, AZ_CHAIR);
	const S = AZ_CHAIR.size * a.s;
	const x0 = a.x - S / 2;
	const y0 = a.y - S / 2;
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity, overflow: 'visible'}}>
			<defs>
				<filter id="chairRough" x="-10%" y="-10%" width="120%" height="120%">
					<feTurbulence type="fractalNoise" baseFrequency="22" numOctaves={2} seed={5} />
					<feDisplacementMap in="SourceGraphic" scale={0.004} />
				</filter>
				<linearGradient id="chairShade" x1="0" x2="1" y1="0" y2="0">
					<stop offset="0" stopColor="#a4544f" />
					<stop offset="0.6" stopColor="#c86e68" />
					<stop offset="1" stopColor="#d98a80" />
				</linearGradient>
			</defs>
			<g filter="url(#chairRough)" transform={`translate(${x0}, ${y0}) scale(${S})`}>
				{/* 椅腿 */}
				<path d="M 0.6 0.86 L 0.622 0.86 L 0.616 0.935 L 0.606 0.935 Z" fill="#3a2416" />
				<path d="M 0.856 0.86 L 0.878 0.86 L 0.872 0.935 L 0.862 0.935 Z" fill="#3a2416" />
				{/* 椅背 */}
				<path d="M 0.70 0.866 L 0.70 0.56 C 0.70 0.49, 0.74 0.465, 0.80 0.465 C 0.87 0.465, 0.905 0.49, 0.905 0.56 L 0.905 0.866 Z" fill="url(#chairShade)" />
				{/* 坐垫 */}
				<path d="M 0.58 0.866 L 0.58 0.75 C 0.58 0.728, 0.62 0.718, 0.70 0.72 L 0.9 0.73 L 0.9 0.866 Z" fill="#c26a64" />
				<path d="M 0.6 0.735 C 0.66 0.722, 0.8 0.724, 0.9 0.734 L 0.9 0.746 C 0.8 0.738, 0.66 0.738, 0.6 0.75 Z" fill="#de958a" opacity={0.8} />
				{/* 前面的扶手 */}
				<path d="M 0.552 0.866 L 0.552 0.66 C 0.552 0.625, 0.58 0.61, 0.632 0.61 C 0.684 0.61, 0.712 0.625, 0.712 0.66 L 0.712 0.866 Z" fill="url(#chairShade)" />
				<ellipse cx={0.632} cy={0.626} rx={0.074} ry={0.017} fill="#e3a093" opacity={0.85} />
			</g>
		</svg>
	);
};

export const CodaScene: React.FC = () => {
	const frame = useFrame();
	const t = globalTime('coda', frame);
	const room = codaRoomCam(frame);
	const lamp = 1 - 0.25 * interpolate(frame, [40, 200], [0, 1], clamp);

	const azO = 1 - interpolate(frame, [40, 150], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const chairO = interpolate(frame, [40, 110], [0, 1], clamp);
	const friendsO = 1 - interpolate(frame, [30, 120], [0, 1], clamp);
	const floetteO = interpolate(frame, [70, 140], [0, 1], clamp);
	const graveO = interpolate(frame, TO_GRAVE, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)}) * (1 - interpolate(frame, BACK, [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)}));
	const backO = interpolate(frame, BACK, [0, 1], clamp);
	const fade = interpolate(frame, OUT, [0, 1], {...clamp, easing: Easing.in(Easing.quad)});

	// 花叶蒂停在椅背上
	const a = onScreen(room, AZ_CHAIR);
	const S = AZ_CHAIR.size * a.s;
	const fp = {x: a.x - S / 2 + 0.83 * S, y: a.y - S / 2 + 0.42 * S + Math.sin(t * 1.6) * 4};
	const l = project(room, 1, {x: ROOM_LAMP[0], y: ROOM_LAMP[1]});

	return (
		<AbsoluteFill style={{background: '#000'}}>
			{/* 客厅：他离开了，椅子空了 */}
			{graveO < 1 && (
				<AbsoluteFill>
					<RoomBg time={t} cam={room} lampP={ROOM_LAMP} lamp={lamp} dim={1 - 0.08 * (1 - lamp)} />
					{friendsO > 0 &&
						FRIENDS.map((f, i) => {
							const p = project(room, 0.85, {x: f.x, y: 820});
							return <WallShadow key={i} src={f.src} w={f.w} h={f.h} x={p.x} y={p.y} height={f.hgt * room.zoom} opacity={friendsO * 0.9} skew={Math.sin(t * 0.8 + i * 1.7) * 1.5 - 4} />;
						})}
					{chairO > 0 && azO < 1 && <EmptyChair cam={room} opacity={chairO} />}
					{azO > 0 && <ChairAZ cam={room} opacity={azO} lamp={lamp} />}
					{floetteO > 0 && azO < 1 && (
						<PokemonArt3D
							dir="pokemon/floette"
							variant="-eternal"
							x={fp.x}
							y={fp.y}
							size={0.13 * S}
							yaw={Math.sin(t * 0.9) * 4}
							depthScale={0.5}
							ambient={[0.62 * lamp, 0.54 * lamp, 0.46 * lamp]}
							dirLights={[{dir: [(l.x - fp.x) / 500, (l.y - fp.y) / 500, 0.7], color: [0.4, 0.28, 0.16], wrap: 0.6}]}
							oil={{amount: 1, radius: 0.0075, warm: 0.35}}
							opacity={floetteO * (1 - 0.0)}
						/>
					)}
					<DustMotes opacity={0.4} rgb="255,214,150" frameOffset={globalFrame('coda', 0)} />
				</AbsoluteFill>
			)}

			{/* 清晨的安息墓地 */}
			{graveO > 0 && <CemeteryBg time={t} cam={graveCam(frame)} sun={[1500, 250]} opacity={graveO} />}

			{/* 回到扶手椅里微笑的他 */}
			{backO > 0 && (
				<AbsoluteFill style={{opacity: backO}}>
					<RoomBg time={t} cam={hotelCam(HOTEL_SCENE_FRAMES)} lampP={ROOM_LAMP} />
					<ChairAZ cam={hotelCam(HOTEL_SCENE_FRAMES)} />
				</AbsoluteFill>
			)}

			<Vignette strength={0.58} />

			<BiSubtitle zh="他安静地走完了一生。" en="In the end, he passed away quietly." from={46} to={166} source={{zh: '传说 Z-A 结局（ＡＺ在画面外自然离世）', en: 'Legends: Z-A ending'}} />
			<BiSubtitle zh="他知晓起始与终结，" en="...who mastered both creation and destruction, a man of beginnings and endings." from={234} to={330} source={{zh: '传说 Z-A·ＡＺ墓志铭（官方中文）', en: 'Legends: Z-A, AZ\'s gravestone'}} />
			<BiSubtitle zh="获得了3000年的寿命，却从未与他人有过生命的交集。" en="For 3,000 years, he lived, finding no fellowship with others as he wandered the world's byways." from={338} to={472} source={{zh: '传说 Z-A·ＡＺ墓志铭（官方中文）', en: 'Legends: Z-A, AZ\'s gravestone'}} />
			<BiSubtitle zh="直到在密阿雷遇到挚爱的宝可梦和值得信任的人们，他的生命才得以完整。" en="But in Lumiose, he discovered faithful friends and was reunited with his most beloved Pokémon." from={480} to={632} source={{zh: '传说 Z-A·ＡＺ墓志铭（官方中文）', en: 'Legends: Z-A, AZ\'s gravestone'}} />
			<BiSubtitle zh="男人名为ＡＺ，长眠于此。" en="Here lies AZ." from={640} to={712} source={{zh: '传说 Z-A·ＡＺ墓志铭（官方中文）', en: 'Legends: Z-A, AZ\'s gravestone ("Here lies AZ," 挪到最后单独显示)'}} />

			{/* 淡出 */}
			<AbsoluteFill style={{background: '#000', opacity: fade}} />
		</AbsoluteFill>
	);
};
