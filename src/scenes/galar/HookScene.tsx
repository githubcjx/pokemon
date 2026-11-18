import React from 'react';
import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Vignette} from '../../components/CamLayer';
import {DustMotes} from '../../components/DustMotes';
import {Grain} from '../../components/Grain';
import {CINZEL, SERIF} from '../../fonts';
import {useFrame} from '../../time';
import {PANEL_X, PANEL_Y, Vault, VaultCamera} from './Vault';

export const HOOK_SCENE_FRAMES = 1000;
export const HOOK_LAST_FRAME = HOOK_SCENE_FRAMES - .5;
export const HOOK_END_CAMERA: VaultCamera = {x: PANEL_X[0] + 275, y: PANEL_Y + 185, zoom: 3};

const CAMERA_KEYS: Array<{frame: number; camera: VaultCamera}> = [
	{frame: 0, camera: {x: 1060, y: 500, zoom: .77}},
	{frame: 110, camera: {x: 1150, y: 500, zoom: .81}},
	{frame: 155, camera: {x: 340, y: 515, zoom: 1.12}},
	{frame: 245, camera: {x: 350, y: 505, zoom: 1.18}},
	{frame: 285, camera: {x: 840, y: 505, zoom: 1.18}},
	{frame: 365, camera: {x: 850, y: 500, zoom: 1.21}},
	{frame: 400, camera: {x: 1340, y: 500, zoom: 1.18}},
	{frame: 480, camera: {x: 1350, y: 495, zoom: 1.21}},
	{frame: 515, camera: {x: 1840, y: 505, zoom: 1.18}},
	{frame: 590, camera: {x: 1850, y: 495, zoom: 1.21}},
	{frame: 635, camera: {x: 1110, y: 490, zoom: .78}},
	{frame: 725, camera: {x: 1190, y: 490, zoom: .78}},
	{frame: 790, camera: {x: 1210, y: 490, zoom: .78}},
	{frame: 870, camera: {x: 1210, y: 490, zoom: .78}},
	{frame: HOOK_LAST_FRAME, camera: HOOK_END_CAMERA},
];

const cameraAt = (frame: number): VaultCamera => {
	const next = CAMERA_KEYS.findIndex((key) => key.frame > frame);
	if (next < 0) return HOOK_END_CAMERA;
	if (next === 0) return CAMERA_KEYS[0].camera;
	const a = CAMERA_KEYS[next - 1], b = CAMERA_KEYS[next];
	const p = interpolate(frame, [a.frame, b.frame], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin)});
	return {x: a.camera.x + (b.camera.x - a.camera.x) * p, y: a.camera.y + (b.camera.y - a.camera.y) * p, zoom: a.camera.zoom + (b.camera.zoom - a.camera.zoom) * p};
};

const SUBTITLES = [
	{from: 28, to: 145, zh: '伽勒尔，拳关市的宝物库里，挂着四幅古老的挂毯。', en: 'In Hammerlocke, Galar, four ancient tapestries hang in the Vault.', source: {zh: '旁白', en: 'Narration'}},
	{from: 155, to: 265, zh: '第一幅，两个年轻人望着一颗坠落的星。', en: 'In the first, two youths watch a star fall from the sky.', source: {zh: '改写自 52poke「拳关市」官方挂毯文字', en: 'Adapted from the in-game Vault tapestry text'}},
	{from: 270, to: 380, zh: '第二幅，灾厄降临，他们不知所措。', en: 'In the second, disaster descends, and they stand lost.', source: {zh: '改写自 52poke「拳关市」官方挂毯文字', en: 'Adapted from the in-game Vault tapestry text'}},
	{from: 385, to: 495, zh: '第三幅，一把剑和一面盾驱散了灾厄。', en: 'In the third, a sword and a shield drive the disaster away.', source: {zh: '改写自 52poke「拳关市」官方挂毯文字', en: 'Adapted from the in-game Vault tapestry text'}},
	{from: 500, to: 610, zh: '第四幅，两个年轻人戴上了王冠。', en: 'In the fourth, the two youths are crowned.', source: {zh: '改写自 52poke「拳关市」官方挂毯文字', en: 'Adapted from the in-game Vault tapestry text'}},
	{from: 620, to: 785, zh: '这就是伽勒尔的英雄传说。可是，这四幅挂毯并没有把故事讲完。', en: "This is Galar's legend of its heroes. But these four tapestries do not tell the whole story.", source: {zh: '旁白', en: 'Narration'}},
];

const EmbroideredTitle: React.FC<{frame: number}> = ({frame}) => {
	const progress = interpolate(frame, [790, 810], [0, 100], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const opacity = interpolate(frame, [790, 796, 855, 867], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const mask = `linear-gradient(90deg, #000 ${Math.max(0, progress - 4)}%, transparent ${progress}%)`;
	const gold: React.CSSProperties = {
		background: 'repeating-linear-gradient(115deg, #79532d 0px, #d7ac62 1.5px, #ffe4a2 2.4px, #c28b45 4px, #76502a 5px, #dcb975 6px)',
		backgroundPosition: `${Math.sin(frame * .035) * 4}px 0`,
		WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
		filter: 'drop-shadow(0 2px 1px #25170d) drop-shadow(0 0 8px rgba(223,170,87,.22))',
	};
	const sheenX = interpolate(frame, [800, 855], [-50, 150], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const sheen: React.CSSProperties = {
		...gold, position: 'absolute', inset: 0,
		background: `linear-gradient(100deg, transparent ${sheenX - 15}%, rgba(255,244,197,.9) ${sheenX}%, transparent ${sheenX + 15}%)`,
		WebkitBackgroundClip: 'text', backgroundClip: 'text',
	};
	return (
		<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity, pointerEvents: 'none'}}>
			<div style={{position: 'absolute', width: 1550, height: 360, background: 'radial-gradient(ellipse, rgba(10,8,7,.78), transparent 72%)'}} />
			<div style={{textAlign: 'center', maskImage: mask, WebkitMaskImage: mask}}>
				<div style={{position: 'relative', fontFamily: SERIF, fontWeight: 700, fontSize: 100, letterSpacing: 17, paddingLeft: 17}}>
					<div style={gold}>被遗忘的英雄</div><div style={{...sheen, paddingLeft: 17}}>被遗忘的英雄</div>
				</div>
				<svg width="760" height="30" viewBox="0 0 760 30" style={{display: 'block', margin: '6px auto 0'}}>
					<path d="M25 15H329 M431 15H735" stroke="#74502d" strokeWidth="5" strokeDasharray="5 2" />
					<path d="M25 14H329 M431 14H735" stroke="#edcf8a" strokeWidth="2" strokeDasharray="5 3" />
					<path d="M340 15L360 6L380 15L400 6L420 15L400 24L380 15L360 24Z" fill="none" stroke="#e4bf75" strokeWidth="3" strokeDasharray="5 2" />
					<circle cx="25" cy="15" r="4" fill="#dbb36c" /><circle cx="735" cy="15" r="4" fill="#dbb36c" />
				</svg>
				<div style={{position: 'relative', fontFamily: CINZEL, fontWeight: 600, fontSize: 31, letterSpacing: 8, marginTop: 10}}>
					<div style={gold}>THE FORGOTTEN HEROES</div><div style={sheen}>THE FORGOTTEN HEROES</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};

export const VaultBackground: React.FC<{camera: VaultCamera; frameOffset?: number; starProgress?: number; starGlow?: number}> = ({camera, frameOffset = 0, starProgress = 0, starGlow = 0}) => {
	const frame = useFrame() + frameOffset;
	const torchX = 960 + (-100 - camera.x) * camera.zoom;
	const torchY = 540 + (330 - camera.y) * camera.zoom;
	const dustMask = `radial-gradient(ellipse 1100px 750px at ${torchX}px ${torchY}px, #000 0%, rgba(0,0,0,.55) 55%, transparent 100%)`;
	return (
		<AbsoluteFill style={{background: '#110e0c'}}>
			<Vault camera={camera} frame={frame} starProgress={starProgress} starGlow={starGlow} />
			<AbsoluteFill style={{maskImage: dustMask, WebkitMaskImage: dustMask}}><DustMotes frameOffset={frameOffset} opacity={Math.min(.4, frame / 230)} rgb="226,184,115" /></AbsoluteFill>
			<Vignette strength={.6} />
			<Grain frameOffset={frameOffset} opacity={.06} />
		</AbsoluteFill>
	);
};

export const HookScene: React.FC = () => {
	const frame = useFrame();
	return (
		<AbsoluteFill style={{background: '#110e0c'}}>
			<VaultBackground camera={cameraAt(frame)} />
			{SUBTITLES.map((s) => <BiSubtitle key={s.from} {...s} tone="light" scrim={.3} sync wipe={36} />)}
			<EmbroideredTitle frame={frame} />
		</AbsoluteFill>
	);
};
