import {AbsoluteFill, interpolate} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {CINZEL, SERIF} from '../../fonts';
import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {clamp} from '../../theme';
import {BASE_FPS, useFrame} from '../../time';
import {TrainerSilhouette} from '../regi/DoorsSeg';
import {AIR_FRAG} from './air';
import {K, ramp, SEG_START} from './common';
import {AltarStone, Meteor} from './elements';

const W = 1920;
const H = 1080;
const ALTAR_Y = 490;
const AX = 1295;

const Title: React.FC<{frame: number}> = ({frame}) => {
	const start = K.titleAt + 3;
	const opacity = ramp(frame, start, start + 24);
	if (opacity <= 0) return null;
	const shine = interpolate(frame, [start + 15, start + 77], [-1, 4.5], clamp);
	return (
		<div style={{position: 'absolute', top: 470, left: 190, opacity}}>
			<div style={{display: 'flex', gap: 20, fontFamily: SERIF, fontSize: 142, fontWeight: 700, lineHeight: 1.26}}>
				{Array.from('迎着流星', (char, i) => {
					const reveal = ramp(frame, start + i * 7, start + i * 7 + 21);
					const glint = Math.max(0, 1 - Math.abs(i - shine) * 1.45);
					return (
						<span key={char} style={{
							opacity: reveal,
							transform: `translateY(${(1 - reveal) * 14}px)`,
							color: '#e1ebee',
							textShadow: `0 3px 8px #04070a, 0 0 42px rgba(170,235,220,${.08 + glint * .43})`,
						}}>{char}</span>
					);
				})}
			</div>
			<div style={{height: 1, width: 530 * ramp(frame, start + 17, start + 60), margin: '18px 0 23px', background: 'linear-gradient(90deg, #97c6ba, #6995b27a 55%, transparent)'}} />
			<div style={{fontFamily: CINZEL, fontSize: 28, fontWeight: 600, letterSpacing: 7, color: '#bacdd7', textShadow: '0 2px 9px #04070a'}}>
				{Array.from('TO MEET THE METEOR', (char, i) => (
					<span key={i} style={{opacity: ramp(frame, start + 24 + i * 1.4, start + 43 + i * 1.4)}}>{char}</span>
				))}
			</div>
		</div>
	);
};

/** 唤龙之祭坛。右缘吃一点冷光，塔脚退入云海。 */
const TowerTop: React.FC = () => (
	<svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
		<defs>
			<linearGradient id="wish-tower-stone">
				<stop stopColor="#0b101b" />
				<stop offset=".55" stopColor="#172436" />
				<stop offset="1" stopColor="#2a3b4a" />
			</linearGradient>
			<linearGradient id="wish-tower-shadow" x2="0" y2="1">
				<stop stopColor="#0a121d" stopOpacity="0" />
				<stop offset="1" stopColor="#0b1420" stopOpacity=".82" />
			</linearGradient>
		</defs>
		<g transform={`translate(${AX} ${ALTAR_Y})`}>
			<path d="M-179 650 -116 306 -64 24 64 24 116 306 179 650Z" fill="url(#wish-tower-stone)" />
			<path d="M0 27 64 24 116 306 179 650 36 650Z" fill="#728c9e" opacity=".10" />
			<path d="M-82 15 -57-7 60-7 83 15 69 37 -67 37Z" fill="#182734" stroke="#4e6472" strokeWidth="2" />
			<path d="M-57-7 60-7 83 15 -82 15Z" fill="#435261" />
			{Array.from({length: 6}, (_, i) => {
				const y = 64 + i * 93;
				const edge = 71 + i * 17;
				return (
					<g key={i}>
						<path d={`M${-edge - 8} ${y} H${edge + 8} l-4 12 H${-edge - 4}Z`} fill="#14202b" />
						<path d={`M${-edge - 8} ${y} H${edge + 8}`} stroke="#50697a" strokeWidth="2" opacity=".46" />
						<path d={`M-12 ${y + 58} v-19 q12-12 24 0 v19Z`} fill="#091019" />
					</g>
				);
			})}
			<path d="M64 36 116 306 179 650" fill="none" stroke="#839da7" strokeWidth="2" opacity=".42" />
			<path d="M-78-3 -77-49 Q-42-65-25-53 M40-52 Q64-51 78-39 V-3" fill="none" stroke="#506673" strokeWidth="3" />
			<path d="M-61-5 V-55 M-45-5 V-57 M57-5 V-49 M68-5 V-45" fill="none" stroke="#4b626e" strokeWidth="2" />
			<path d="M-179 650 -116 306 -64 24 64 24 116 306 179 650Z" fill="url(#wish-tower-shadow)" />
		</g>
	</svg>
);

/** 陨石来袭、塔顶唤龙，随后在同一画面上出片名。 */
export const HookSeg: React.FC<{exit: number}> = ({exit}) => {
	const frame = useFrame();
	const time = frame / BASE_FPS;
	const dive = ramp(frame, 40, 296);
	const towerIn = ramp(frame, 72, 166);
	const dim = ramp(frame, 247, K.titleAt);
	const stoneGlow = interpolate(frame, [105, 200, 267, 335], [.12, .63, .72, .46], clamp);
	const dragon = ramp(frame, 186, 234) * (1 - ramp(frame, 266, 397) * .87);
	const dragonPass = interpolate(frame, [183, SEG_START.unseen + 60], [0, 1], clamp);

	return (
		<AbsoluteFill style={{backgroundColor: '#05080e', overflow: 'hidden', opacity: 1 - exit}}>
			<ShaderCanvas
				width={W}
				height={H}
				scale={.72}
				frag={AIR_FRAG}
				uniforms={{uTime: time, uHorizon: .69 - dive * .15, uDrift: dive * .32, uDim: dim * .72, uAurora: .46}}
				style={{position: 'absolute', inset: 0}}
			/>

			{dragon > 0 && (
				<PokemonArt3D
					dir="pokemon/rayquaza"
					x={1665 - 1080 * dragonPass}
					y={220 + 140 * dragonPass}
					size={526}
					yaw={-4}
					pitch={5}
					resolution={.78}
					depthScale={.50}
					ambient={[.032, .051, .062]}
					rim={{dir: [.55, -.62], color: [.18, .53, .44], power: 2.1}}
					opacity={dragon}
				/>
			)}

			{towerIn > 0 && (
				<AbsoluteFill style={{
					opacity: towerIn,
					transformOrigin: `${AX}px ${ALTAR_Y}px`,
					transform: `translate(${(1 - dive) * 72}px, ${(1 - dive) * 115 - exit * 84}px) scale(${.72 + dive * .28})`,
				}}>
					<TowerTop />
					<TrainerSilhouette
						file="trainers/zinnia/oras.png"
						x={AX + 8}
						top={ALTAR_Y + 6 - 214}
						h={214}
						aspect={994 / 1600}
						o={1}
						from="left"
						rgb="190,194,199"
						lift={.19}
					/>
					<AbsoluteFill style={{transform: 'scale(.66)', transformOrigin: `${AX + 3}px ${ALTAR_Y - 91}px`}}>
						<AltarStone x={AX + 3} y={ALTAR_Y - 91} glow={stoneGlow} />
					</AbsoluteFill>
				</AbsoluteFill>
			)}

			<Meteor frame={frame} from={-18} to={221} x0={1800} y0={115} x1={-1100} y1={995} size={.93} spin={.16} />
			<AbsoluteFill style={{background: 'linear-gradient(180deg, #04070b27 0%, transparent 25%, transparent 65%, #04070bbf 100%)', pointerEvents: 'none'}} />
			<Title frame={frame} />
		</AbsoluteFill>
	);
};

export const HOOK_FRAMES = SEG_START.unseen;
