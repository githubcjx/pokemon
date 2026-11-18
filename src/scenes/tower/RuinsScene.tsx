import {ThreeCanvas} from '@remotion/three';
import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {flow} from '../../camera';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Grain, SubtitleBackdrop} from '../../components/Grain';
import {NightSky} from '../../components/screen/GoldScreen';
import {PODIUM_TOP} from '../../three/pagodaGeometry';
import {AshField, Pagoda, PagodaRuin, Signboard} from '../../three/Pagoda';
import {CameraRig, MoonLights, orbit, projectToScreen, V3} from '../../three/stage';
import {clamp} from '../../theme';
import {useFrame} from '../../time';

// ─── 第 1 段《废墟》（600 帧 = 20 秒，今·冷，一镜到底）─────────────────────────
// 月夜远景缓缓推近烧焦塔的废墟（字幕一）→ 镜头经过塔前的告示牌（字幕二）
// → 绕到塔的南面、沿折断的心柱缓缓升起，越过断柱望向远处月雾里完好的东塔（字幕三：另一个故事；为第 7 段凤王降临东塔埋下伏笔）
// → 落向地上的一粒余烬
// → 余烬重新燃起，金光漫满画面，接第 2 段的金屏风
export const RUINS_SCENE_FRAMES = 600;

const T = {
	sub1: [40, 180] as const,
	sub2: [215, 355] as const,
	sub3: [395, 535] as const,
	/** 余烬开始复燃 */
	kindle: 500,
	/** 金光漫满画面 */
	flood: [560, 594] as const,
};

/** 主角余烬：在镜头最后落向的方向上 */
const EMBER_DIR = 40;
const EMBER: V3 = (() => {
	const a = (EMBER_DIR * Math.PI) / 180;
	return [Math.sin(a) * 2.2, PODIUM_TOP + 0.07, Math.cos(a) * 2.2];
})();

const SIGN: V3 = [6, 0, 16];

/** 远处东边、月雾里的铃铛塔剪影（东 = +x） */
const BELL_TOWER: V3 = [38, 0, -120];

const getCamera = (f: number) => {
	const deg = flow(f, [
		[0, 62],
		[180, 42],
		[300, 16],
		[400, -16],
		[470, -26],
		[530, 8],
		[600, EMBER_DIR],
	]);
	const radius = flow(f, [
		[0, 46],
		[180, 30],
		[300, 20],
		[400, 16],
		[470, 15],
		[530, 9.5],
		[600, 6.4],
	]);
	const height = flow(f, [
		[0, 3.2],
		[180, 2.3],
		[300, 2.4],
		[400, 9],
		[470, 12],
		[512, 4.0],
		[540, 3.0],
		[600, 2.5],
	]);
	const ty = flow(f, [
		[0, 6.5],
		[180, 4.5],
		[300, 4.8],
		[430, 11],
		[530, 3.4],
		[600, EMBER[1]],
	]);
	// 字幕三：视线越过断柱，落到远处月雾里完好的东塔上，停一拍再回来
	const look = interpolate(f, [370, 420, 470, 510], [0, 1, 1, 0], {...clamp, easing: Easing.inOut(Easing.sin)});
	// 后段视线从塔心移向余烬
	const k = interpolate(f, [470, 590], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
	const base: V3 = [EMBER[0] * k, ty, EMBER[2] * k];
	const target: V3 = [base[0] + (BELL_TOWER[0] - base[0]) * look, base[1] + (BELL_TOWER[1] + 16 - base[1]) * look, base[2] + (BELL_TOWER[2] - base[2]) * look];
	const fov = flow(f, [
		[0, 32],
		[370, 32],
		[430, 22],
		[470, 22],
		[530, 34],
		[600, 38],
	]);
	return {pos: orbit(deg, radius, height), target, fov};
};

export const RuinsScene: React.FC = () => {
	const f = useFrame();
	const {pos, target, fov} = getCamera(f);

	// 余烬复燃：先微微变亮，最后猛地燃起
	const kindle = interpolate(f, [T.kindle, 565, 600], [0, 0.3, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const breathe = 0.5 + 0.5 * Math.sin(f * 0.12);
	const emberGlow = 0.8 + breathe * 0.6 + kindle * 14;
	const ember2D = projectToScreen(pos, target, fov, EMBER);
	const haloR = interpolate(f, [T.kindle, 565, 600], [30, 140, 1700], {...clamp, easing: Easing.in(Easing.cubic)});
	const haloO = interpolate(f, [T.kindle, 540, 600], [0, 0.55, 1], clamp);
	const flood = interpolate(f, T.flood, [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const warm = interpolate(f, [540, 600], [0, 1], clamp);

	return (
		<AbsoluteFill style={{background: '#000'}}>
			<NightSky />
			<AbsoluteFill>
				<ThreeCanvas width={1920} height={1080} shadows gl={{alpha: true, antialias: true}}>
					<CameraRig pos={pos} target={target} fov={fov} />
					<MoonLights fogFar={175} />
					{/* 余烬堆的暖光（随帧明灭），复燃时整片转暖 */}
					<pointLight
						position={[0.5, 2.2, 0.3]}
						intensity={(28 + 10 * Math.sin(f * 0.31) * Math.sin(f * 0.13 + 1.7)) * (1 + warm * 1.5)}
						distance={20}
						decay={2}
						color="#ff6a22"
					/>
					<pointLight position={[EMBER[0], EMBER[1] + 0.4, EMBER[2]]} intensity={kindle * 60} distance={12} decay={2} color="#ffb04a" />
					<PagodaRuin frame={f} />
					<Signboard p={SIGN} ry={0.6} scale={1.25} />
					<group position={BELL_TOWER}>
						<Pagoda />
					</group>
					{/* 主角余烬 */}
					<mesh position={EMBER} scale={[1 + kindle * 0.8, 0.4 + kindle * 0.6, 1 + kindle * 0.8]}>
						<sphereGeometry args={[0.13, 14, 8]} />
						<meshStandardMaterial color="#2a120a" emissive="#ff7a28" emissiveIntensity={emberGlow} />
					</mesh>
					<AshField frame={f} />
				</ThreeCanvas>
			</AbsoluteFill>
			{/* 暗角 */}
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 100% 85% at 50% 45%, transparent 55%, rgba(8,10,16,0.5) 100%)'}} />
			{/* 余烬的光晕：跟住 3D 位置，越燃越大 */}
			{!ember2D.behind ? (
				<AbsoluteFill
					style={{
						opacity: haloO,
						mixBlendMode: 'screen',
						background: `radial-gradient(circle at ${ember2D.x}px ${ember2D.y}px, rgba(255,214,140,0.95) 0px, rgba(255,150,60,0.55) ${haloR * 0.25}px, rgba(255,120,40,0.18) ${haloR * 0.6}px, transparent ${haloR}px)`,
					}}
				/>
			) : null}
			<SubtitleBackdrop />
			{/* 冷色转暖 */}
			<AbsoluteFill style={{background: 'rgba(255,170,90,1)', mixBlendMode: 'soft-light', opacity: warm * 0.3}} />
			{/* 金光漫满：接第 2 段的金屏风 */}
			<AbsoluteFill style={{background: '#efcf88', opacity: flood}} />

			{/* 旁白（制作者撰写）：位置依据 52poke / Bulbapedia「烧焦塔」 */}
			<BiSubtitle
				from={T.sub1[0]}
				to={T.sub1[1]}
				zh="缘朱市的西北角，立着一座烧焦的塔。"
				en="In the northwest of Ecruteak City stands a tower scarred by fire."
				source={{zh: '旁白', en: 'NARRATION'}}
			/>
			{/* 旁白（制作者撰写）：依据水晶 / 心金魂银告示牌 "It was destroyed by a mysterious fire." */}
			<BiSubtitle
				from={T.sub2[0]}
				to={T.sub2[1]}
				zh="告示牌上只写着：它毁于一场神秘的大火。"
				en="Its sign says only that it was destroyed by a mysterious fire."
				source={{zh: '旁白（依据水晶 / 心金魂银告示牌）', en: 'NARRATION (after the sign in CRYSTAL / HGSS)'}}
			/>
			{/* 旁白（制作者撰写）：依据心金魂银 "We have been passing down the Bell Tower legend for generations in Ecruteak City." */}
			<BiSubtitle
				from={T.sub3[0]}
				to={T.sub3[1]}
				zh="可在缘朱，人们世代相传着另一个故事。"
				en="But in Ecruteak, another story has been passed down for generations."
				source={{zh: '旁白（依据心金魂银·铃铛塔）', en: 'NARRATION (after HGSS · Bell Tower)'}}
			/>
			<Grain opacity={0.12 * (1 - flood * 0.4)} />
		</AbsoluteFill>
	);
};
