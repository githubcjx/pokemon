import {AbsoluteFill, random} from 'remotion';
import {PokemonArt3D} from '../../components/PokemonArt3D';
import {Grain} from '../../components/Grain';
import {Flame, Person, poseAnchor} from '../../components/unown/Silhouette';
import {Glyph, projectRoom, UnownWall, WallLight} from '../../components/unown/UnownWall';
import {CINZEL, SERIF} from '../../fonts';
import {DOOR, FAREWELL_LINES} from './wall';

type Layout = {
	width: number;
	height: number;
	hero: [number, number, number];
	doorX: number;
	cameraY: number;
	zoom: number;
	title: [number, number, number, number];
	hookY: number;
	stacked?: boolean;
};

const WIDE: Layout = {
	width: 1920, height: 1080,
	hero: [1330, 565, 760],
	doorX: 1580, cameraY: 825, zoom: 1.12,
	title: [130, 310, 185, 870],
	hookY: 665,
};

const STANDARD: Layout = {
	width: 1440, height: 1080,
	hero: [995, 570, 700],
	doorX: 1195, cameraY: 825, zoom: 1.12,
	title: [90, 275, 177, 480],
	hookY: 810,
	stacked: true,
};

const PORTRAIT: Layout = {
	width: 1080, height: 1440,
	hero: [520, 850, 820],
	doorX: 805, cameraY: 785, zoom: 0.84,
	title: [65, 186, 183, 950],
	hookY: 1255,
};

const INSCRIPTIONS: Glyph[] = FAREWELL_LINES.flatMap((line, row) => {
	const advance = 94;
	const width = [...line].reduce((sum, ch) => sum + (ch === ' ' ? 54 : advance), 0);
	let x = 3530 - width / 2;
	return [...line].flatMap((ch) => {
		const glyph: Glyph = {x, y: 135 + row * 250, size: 88, form: ch.toLowerCase(), carve: 0, eye: 0, gold: 0.025};
		x += ch === ' ' ? 54 : advance;
		return ch === ' ' ? [] : [glyph];
	});
});

const WATCHERS: Glyph[] = [
	{x: 4250, y: 125, size: 135, form: 'a', carve: 0.65, eye: 1, eyeGlow: 0.08},
	{x: 4370, y: 400, size: 112, form: 'h', carve: 0.45, eye: 1, eyeGlow: 0.08},
	{x: 4210, y: 650, size: 140, form: 'g', carve: 0.35, eye: 1, eyeGlow: 0.06},
	{x: 4310, y: 940, size: 124, form: 'r', carve: 0.45, eye: 1, eyeGlow: 0.07},
	{x: 5250, y: 380, size: 155, form: 'y', carve: 0.4, eye: 1, eyeGlow: 0.05},
	{x: 5320, y: 920, size: 135, form: 'q', carve: 0.35, eye: 1, eyeGlow: 0.05},
];

const Cover: React.FC<{layout: Layout}> = ({layout: L}) => {
	const {width: W, height: H} = L;
	const portrait = H > W;
	const scale = H / 1080;
	const offset = (W - 1920 * scale) / 2;
	const cam = {x: DOOR.x - ((L.doorX - offset) / scale - 960) / L.zoom, y: L.cameraY, zoom: L.zoom, roll: 0};
	const lights: WallLight[] = [
		{pos: [DOOR.x - 220, 720, 540], color: [2.6, 1.2, 0.35], radius: 650},
		{pos: [cam.x - 720, 460, 700], color: [1.2, 0.63, 0.24], radius: 920},
		{pos: [DOOR.x + 100, 470, 80], color: [0.15, 0.22, 0.36], radius: 650},
	];
	const people = Array.from({length: 5}, (_, i) => {
		const p = projectRoom(cam, {x: DOOR.x + 110 + i * 90, y: 1250, z: -600 - i * 720});
		const height = 245 * p.scale;
		const phase = 0.2 + i * 0.17;
		const anchor = poseAnchor('walk', phase, 'torch')!;
		return {...p, height, phase, tx: p.x + anchor[0] * height / 100, ty: p.y + anchor[1] * height / 100, size: 26 * p.scale, opacity: 0.95 - i * 0.13};
	});
	const [hx, hy, size] = L.hero;
	const [tx, ty, fontSize, textWidth] = L.title;
	const englishY = ty + fontSize * (L.stacked ? 2.3 : 1.2) + 18;
	const dust = Array.from({length: 58}, (_, i) => ({
		x: W * (0.4 + random(`unown-cover-x${i}`) * 0.6),
		y: H * (0.12 + random(`unown-cover-y${i}`) * 0.8),
		r: 0.7 + random(`unown-cover-r${i}`) * 1.8,
		opacity: 0.12 + random(`unown-cover-a${i}`) * 0.35,
	}));

	return (
		<AbsoluteFill style={{background: '#090a0b', overflow: 'hidden'}}>
			<div style={{position: 'absolute', left: offset, top: 0, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: '0 0'}}>
				<UnownWall
					cam={cam}
					time={32.5}
					lights={lights}
					ambient={[0.022, 0.019, 0.017]}
					glyphs={[...INSCRIPTIONS, ...WATCHERS]}
					floor
					door={DOOR}
					outside={0.65}
					resolution={1.5}
				/>
				{[...people].reverse().map((p, i) => (
					<div key={i} style={{opacity: p.opacity}}>
						<Person x={p.x} y={p.y} height={p.height} pose="walk" t={p.phase} rim={0.34} rimDir={[1, -0.5]} rimColor="#b48243" />
						<Flame x={p.tx} y={p.ty} size={p.size} f={975} seed={i + 5} glow={1.1} />
					</div>
				))}
			</div>
			<AbsoluteFill style={{background: `radial-gradient(ellipse ${W * 0.36}px ${H * 0.62}px at ${L.doorX}px ${H * 0.58}px, rgba(230,157,68,0.12), transparent 75%)`, mixBlendMode: 'screen'}} />
			<AbsoluteFill style={{background: portrait
				? 'linear-gradient(180deg, rgba(6,8,10,0.8) 0%, rgba(6,8,10,0.5) 24%, transparent 44%, transparent 77%, rgba(6,8,10,0.88) 100%)'
				: 'linear-gradient(90deg, rgba(6,8,10,0.88) 0%, rgba(6,8,10,0.64) 35%, rgba(6,8,10,0.08) 62%, transparent 100%)'}} />
			<div style={{position: 'absolute', left: hx - size * 0.3, top: hy + size * 0.43, width: size * 0.55, height: size * 0.065, borderRadius: '50%', background: '#000', filter: 'blur(18px)', opacity: 0.75}} />
			<PokemonArt3D
				dir="pokemon/unown"
				variant="-f"
				x={hx}
				y={hy}
				size={size}
				yaw={-4}
				pitch={2}
				depthScale={0.5}
				ambient={[0.11, 0.09, 0.075]}
				dirLights={[{dir: [-0.8, -0.6, 0.6], color: [0.15, 0.2, 0.28], wrap: 0.45}]}
				pointLights={[{pos: [0.9, -0.18, 0.65], color: [3.4, 1.8, 0.55], radius: 1.15}]}
				rim={{dir: [1, -0.2], color: [0.8, 0.43, 0.14], power: 2.7}}
				emissive={0.52}
				emissiveKey={[0.6, 0.85, -1, 0]}
				resolution={2}
				style={{filter: 'drop-shadow(-22px 24px 22px rgba(0,0,0,0.6))'}}
			/>
			<svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
				{dust.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#ffd895" opacity={d.opacity} />)}
			</svg>
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 76% 80% at 50% 48%, transparent 45%, rgba(1,3,6,0.64) 100%)'}} />
			<div style={{position: 'absolute', left: portrait ? 0 : tx, top: portrait ? 62 : 72, width: portrait ? W : textWidth, display: 'flex', alignItems: 'center', justifyContent: portrait ? 'center' : 'flex-start', gap: 18, color: '#b4aa96', fontFamily: SERIF, fontSize: 25, fontWeight: 600, letterSpacing: 9}}>
				<span style={{width: 7, height: 7, background: '#b7965d', transform: 'rotate(45deg)'}} />
				宝可梦志异
			</div>
			<div style={{position: 'absolute', left: tx, top: ty - 62, width: textWidth, textAlign: portrait ? 'center' : 'left', fontFamily: SERIF, fontSize: portrait ? 31 : 29, fontWeight: 500, letterSpacing: 6, color: '#cbb792'}}>
				未知图腾 · 阿露福遗迹
			</div>
			<div style={{position: 'absolute', left: tx - fontSize * 0.025, top: ty, width: textWidth, fontFamily: SERIF, fontSize, fontWeight: 800, lineHeight: 1.15, letterSpacing: fontSize * 0.055, textAlign: portrait ? 'center' : 'left', color: 'transparent', background: 'linear-gradient(165deg, #fff4d7 4%, #f5d99b 34%, #cca053 70%, #efcf8c 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', filter: 'drop-shadow(0 2px 1px #160f06) drop-shadow(0 0 24px rgba(233,175,76,0.15))'}}>
				{(L.stacked ? ['为彼', '而去'] : ['为彼而去']).map((line) => <div key={line}>{line}</div>)}
			</div>
			<div style={{position: 'absolute', left: tx, top: englishY, width: textWidth, fontFamily: CINZEL, fontSize: L.stacked ? 18 : 23, letterSpacing: L.stacked ? 3.1 : 4.8, color: '#c5ab77', textAlign: portrait ? 'center' : 'left', whiteSpace: 'nowrap'}}>
				FOR THE SAKE OF THEM
			</div>
			<div style={{position: 'absolute', left: tx, top: L.hookY - 30, width: portrait ? textWidth : 100, height: 1, background: portrait ? 'linear-gradient(90deg, transparent, rgba(207,168,94,0.55), transparent)' : 'linear-gradient(90deg, rgba(207,168,94,0.7), transparent)'}} />
			<div style={{position: 'absolute', left: tx, top: L.hookY, width: textWidth, fontFamily: SERIF, fontSize: portrait ? 46 : L.stacked ? 39 : 43, fontWeight: 500, lineHeight: 1.6, letterSpacing: 4, color: '#e5ddd0', textAlign: portrait ? 'center' : 'left', textShadow: '0 2px 12px #000'}}>
				{L.stacked ? <><div>为了它们，</div><div>选择离开。</div></> : '为了它们，选择离开。'}
			</div>
			<Grain opacity={0.075} />
		</AbsoluteFill>
	);
};

export const UnownCoverWide: React.FC = () => <Cover layout={WIDE} />;
export const UnownCoverStandard: React.FC = () => <Cover layout={STANDARD} />;
export const UnownCoverPortrait: React.FC = () => <Cover layout={PORTRAIT} />;
