import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {clamp} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {TrainerSilhouette} from '../regi/DoorsSeg';
import {MeteorRelief, PillarRelief} from './Reliefs';
import {MIST_FRAG, MURAL_FRAG} from './muralShaders';

export const RAYQUAZA_HOOK_FRAMES = 510;
const W = 1920;
const H = 1080;

const source = {zh: '原创旁白 · 《德尔塔篇》', en: 'Original narration · Delta Episode'};
const lines = [
	{from: 11, to: 111, zh: '一颗陨石正朝丰缘飞来。', en: 'A meteor is hurtling toward Hoenn.'},
	{from: 126, to: 289, zh: '塔顶，一个女孩唤来了那条曾经救过这片土地的龙。', en: 'Atop a tower, a girl called down the dragon that once saved this land.'},
	{from: 296, to: 342, zh: '它真的来了。', en: 'It came.'},
	{from: 348, to: 445, zh: '可她等的那道光，迟迟没有亮起。', en: 'But the light she had hoped for never appeared.'},
];

const ease = (frame: number, from: number, to: number) =>
	interpolate(frame, [from, to], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});

const Title: React.FC<{frame: number}> = ({frame}) => {
	const opacity = ease(frame, 452, 480);
	if (opacity <= 0) return null;
	const shine = interpolate(frame, [452, 492], [-35, 136], clamp);
	return (
		<div
			style={{
				position: 'absolute',
				top: 602 - 9 * opacity,
				left: 710,
				width: 980,
				opacity,
				textAlign: 'center',
			}}
		>
			<div style={{position: 'absolute', inset: '-34px -70px', background: 'radial-gradient(ellipse, #101917a8 8%, transparent 72%)'}} />
			<div
				style={{
					position: 'relative',
					fontFamily: SERIF,
					fontSize: 132,
					fontWeight: 700,
					letterSpacing: 24,
					paddingLeft: 24,
					color: '#e7d7ae',
					lineHeight: 1.26,
					textShadow: '0 3px 3px #0e130f, 0 0 28px #151b16',
				}}
			>
				迎着流星
				<span aria-hidden style={{
					position: 'absolute', inset: 0, paddingLeft: 24, color: 'transparent',
					background: `linear-gradient(104deg, transparent ${shine - 24}%, #fff1cb ${shine}%, transparent ${shine + 24}%)`,
					backgroundClip: 'text', textShadow: 'none', opacity: .57,
				}}>迎着流星</span>
			</div>
			<div style={{
				position: 'relative', margin: '20px auto 0', fontFamily: CINZEL, fontSize: 26, fontWeight: 600,
				letterSpacing: 7, paddingLeft: 7, color: '#dbca9e', textShadow: '0 2px 7px #141b15',
			}}>TO MEET THE METEOR</div>
			<div style={{position: 'relative', height: 1, width: 410 * opacity, margin: '20px auto 0', background: 'linear-gradient(90deg, transparent, #c3a779b5, transparent)'}} />
		</div>
	);
};

export const RayquazaHookScene: React.FC = () => {
	const frame = useFrame();
	const time = frame / BASE_FPS;
	const travel = ease(frame, 91, 161);
	const onTower = ease(frame, 121, 159);
	const descent = ease(frame, 220, 353);
	const dragon = ease(frame, 243, 314);
	const shiftX = -49 + onTower * 39 + frame * .033;
	const shiftY = 43 - onTower * 41 - frame * .028;
	return (
		<AbsoluteFill style={{backgroundColor: '#131b19', overflow: 'hidden'}}>
			<ShaderCanvas
				width={W}
				height={H}
				scale={.68}
				frag={MURAL_FRAG}
				uniforms={{uTime: time, uTravel: travel}}
				style={{position: 'absolute', inset: 0}}
			/>
			<MeteorRelief frame={frame} opacity={1 - ease(frame, 97, 143)} />
			{dragon > 0 && (
				<AbsoluteFill style={{
					opacity: .89 * dragon,
					maskImage: 'linear-gradient(180deg, transparent 3%, #000c 16%, #000 28%, #000a 39%, transparent 54%)',
				}}>
					<PokemonArt3D
						dir="pokemon/rayquaza"
						x={1372 - descent * 125}
						y={285 + descent * 150 + Math.sin(frame / 57) * 5}
						size={845}
						yaw={-2 + descent * 5}
						pitch={3 - descent * 4}
						resolution={.85}
						depthScale={.47}
						ambient={[.11, .22, .16]}
						dirLights={[{dir: [-.42, -.8, .62], color: [.063, .15, .098], wrap: .58}]}
						ink={{silhouette: .94, reveal: .32, paint: .67, color: .43, line: .36, wash: .85, center: [.22, .34], time}}
						style={{filter: 'sepia(.22) hue-rotate(25deg) saturate(.84)'}}
					/>
				</AbsoluteFill>
			)}
			{onTower > 0 && (
				<>
					<AbsoluteFill style={{opacity: onTower, transform: `translate(${shiftX}px, ${shiftY}px)`}}>
						<PillarRelief />
						<TrainerSilhouette
							file="trainers/zinnia/oras.png"
							x={532}
							top={413}
							h={134}
							aspect={994 / 1600}
							o={1}
							from="right"
							rgb="163,188,151"
							lift={.14}
						/>
					</AbsoluteFill>
					<ShaderCanvas
						width={W}
						height={H}
						scale={.63}
						frag={MIST_FRAG}
						uniforms={{uTime: time, uOpacity: onTower * .89, uReveal: descent}}
						style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
					/>
				</>
			)}
			<AbsoluteFill style={{
				background: 'linear-gradient(180deg, #090e0b27 0%, transparent 22%, transparent 66%, #0a100ec4 100%)',
				pointerEvents: 'none',
			}} />
			{lines.map((line) => <BiSubtitle key={line.from} {...line} source={source} sync wipe={20} fade={8} enStrong scrim={.45} />)}
			<Title frame={frame} />
		</AbsoluteFill>
	);
};
