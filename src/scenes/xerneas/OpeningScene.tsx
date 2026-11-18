import {AbsoluteFill} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {Cry} from '../../components/Cry';
import {Grain} from '../../components/Grain';
import {NameTag} from '../../components/NameTag';
import {CINZEL, SERIF} from '../../fonts';
import {useFrame} from '../../time';
import {OpeningArt, smooth, XERNEAS_BLUE, XERNEAS_REVEAL} from './OpeningArt';

export const OPENING_SCENE_FRAMES = 300;
const TITLE_FROM = 233;

const SUBTITLES = [
	{from: 5, to: 105, zh: '卡洛斯的传说里，有一棵树睡了一千年。', en: 'Kalos tells of a tree that slept for a thousand years.'},
	{from: 108, to: 171, zh: '醒来的，是一头鹿。', en: 'When it awoke, it was a deer.'},
	{from: 174, to: 230, zh: '它叫哲尔尼亚斯。', en: 'Its name is Xerneas.'},
];
const SOURCE = {
	zh: '旁白，依据哲尔尼亚斯官方图鉴。https://dex.pokemon.cn/play/pokedex/0716',
	en: 'Narration based on the Xerneas Pokédex entry. https://pokeapi.co/api/v2/pokemon-species/716/',
};

const TITLE_LINES = [
	{text: '卡洛斯那棵', size: 43, spacing: 12, color: '#BAD7EB', start: TITLE_FROM},
	{text: '沉睡千年的树', size: 86, spacing: 9, color: '#F0F7FF', start: TITLE_FROM + 8},
];

export const OpeningTitle: React.FC<{frame: number; opacity?: number}> = ({frame, opacity = 1}) => {
	if (frame < TITLE_FROM || opacity <= 0) return null;
	const line = smooth(frame, TITLE_FROM + 6, TITLE_FROM + 32);
	return (
		<div style={{position: 'absolute', left: 155, top: 362, color: '#EEF7FF', opacity}}>
			{TITLE_LINES.map(({text, size, spacing, color, start}) => (
				<div key={text} style={{display: 'flex', fontFamily: SERIF, fontWeight: 700, fontSize: size, letterSpacing: spacing, lineHeight: 1.24, color}}>
					{[...text].map((char, i) => {
						const show = smooth(frame, start + i * 2.5, start + i * 2.5 + 15);
						return (
							<span key={i} style={{opacity: show, transform: `translateY(${(1 - show) * 9}px)`, textShadow: '0 0 20px rgba(143,211,255,0.38)'}}>
								{char}
							</span>
						);
					})}
				</div>
			))}
			<div style={{width: 428 * line, height: 1.8, margin: '20px 0 16px', background: `linear-gradient(90deg, ${XERNEAS_BLUE}, transparent)`}} />
			<div style={{fontFamily: CINZEL, fontWeight: 600, fontSize: 22, letterSpacing: 5, opacity: smooth(frame, TITLE_FROM + 19, TITLE_FROM + 39)}}>
				THE SLEEPING TREE OF KALOS
			</div>
		</div>
	);
};

export const OpeningPicture: React.FC = () => {
	const frame = useFrame();
	const nameOpacity = 1 - smooth(frame, 218, TITLE_FROM);
	return (
		<>
			<OpeningArt frame={frame} />
			<Vignette strength={0.58} />
			<Grain />
			<NameTag
				from={XERNEAS_REVEAL - 3}
				x={155}
				y={383}
				no="0716 ·"
				category="生命宝可梦"
				categoryEn="Life Pokémon"
				zh="哲尔尼亚斯"
				en="XERNEAS"
				tone="mono"
				glowRgb="143,211,255"
				opacity={nameOpacity}
			/>
			<OpeningTitle frame={frame} />
			{SUBTITLES.map((cue) => <BiSubtitle key={cue.from} {...cue} source={SOURCE} sync wipe={18} fade={8} enStrong />)}
		</>
	);
};

export const OpeningScene: React.FC = () => (
	<AbsoluteFill>
		<OpeningPicture />
		<Cry name="xerneas" at={XERNEAS_REVEAL} volume={0.8} />
	</AbsoluteFill>
);
