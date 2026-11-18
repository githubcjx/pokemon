import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Cry} from '../../components/Cry';
import {NameTag} from '../../components/NameTag';
import {useFrame} from '../../time';
import {STAR_SCENE_FRAMES, STAR_START} from './continuity';
import {ANCHOR_SCREEN, DIVE_RATIO, GoldWorld, IRIS, STAR_HOME, vaultZoomAt, anchoredCam} from './GoldWorld';
import {VaultBackground} from './HookScene';
import {Tapestry, TapestryDefs} from './Tapestry';
import {PANEL_X, PANEL_Y} from './Vault';

export {STAR_SCENE_FRAMES} from './continuity';

const LINES = [
	{from: 125, to: 240, zh: '那是两万年前，一颗陨石坠向伽勒尔。', en: 'Twenty thousand years ago, a meteorite plunged toward Galar.', source: {zh: '改写自无极汰那《盾》图鉴', en: 'Adapted from Eternatus Shield Pokédex'}},
	{from: 265, to: 345, zh: '陨石里，藏着一只宝可梦。', en: 'Inside it was a Pokémon.', source: {zh: '改写自无极汰那《盾》图鉴', en: 'Adapted from Eternatus Shield Pokédex'}},
	{from: 525, to: 695, zh: '它胸口的核心，靠吸收伽勒尔大地涌出的能量活下去。', en: "The core on its chest drew in the energy welling up from Galar's land. That energy kept it alive.", source: {zh: '改写自无极汰那《剑》图鉴', en: 'Adapted from Eternatus Sword Pokédex'}},
	{from: 710, to: 875, zh: '此后，它沉睡了很久很久。', en: 'After that, it slept for a very long time.', source: {zh: '旁白', en: 'Narration'}},
	{from: 940, to: 1095, zh: '直到三千年前，它醒了。', en: 'Then, three thousand years ago, it awoke.', source: {zh: '旁白', en: 'Narration'}},
];

/**
 * 画面递归：挂毯第一幅里绣着一幅更小的第一幅，小的里面还有更小的，三幅的星都叠在同一点。
 * 镜头以星为锚点一路推进两层，画面回到和 ① 末帧一模一样的构图——然后星周围的布面拆开，露出金线世界。
 */
const Recursion: React.FC<{zoom: number; frame: number}> = ({zoom, frame}) => {
	const cam = anchoredCam(zoom);
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
			<TapestryDefs />
			<defs>
				<filter id="galar-copy-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity=".7" /></filter>
			</defs>
			<g transform={`translate(960 540) scale(${zoom}) translate(${-cam.x} ${-cam.y})`}>
				{[1, 2, 3].map((k) => {
					const s = Math.pow(DIVE_RATIO, k);
					return (
						<g key={k} transform={`translate(${STAR_HOME.x} ${STAR_HOME.y}) scale(${s}) translate(${-STAR_HOME.x} ${-STAR_HOME.y})`} filter="url(#galar-copy-shadow)">
							<Tapestry panel={1} glow={0.4 + 0.3 * Math.sin(frame * 0.2 + k)} />
						</g>
					);
				})}
			</g>
		</svg>
	);
};

export const StarScene: React.FC = () => {
	const t = useFrame();
	const vz = vaultZoomAt(t);
	const vaultCam = anchoredCam(vz);
	const irisR = Math.pow(Math.max(0, Math.min(1, (t - IRIS[0]) / (IRIS[1] - IRIS[0]))), 2.2) * 2300;
	const copies = interpolate(t, [0, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const tagOpacity = interpolate(t, [410, 430, 490, 515], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill style={{background: '#04050c'}}>
			{t < IRIS[1] && (
				<AbsoluteFill>
					<VaultBackground camera={{x: PANEL_X[0] + vaultCam.x, y: PANEL_Y + vaultCam.y, zoom: vz}} frameOffset={STAR_START} />
					<AbsoluteFill style={{opacity: copies}}><Recursion zoom={vz} frame={t} /></AbsoluteFill>
				</AbsoluteFill>
			)}
			{t >= IRIS[0] && (
				<AbsoluteFill>
					<GoldWorld t={t} globalFrame={STAR_START + t} frameOffset={STAR_START} iris={t < IRIS[1] ? [ANCHOR_SCREEN.x, ANCHOR_SCREEN.y, irisR, 1] : [0, 0, 0, 0]} />
				</AbsoluteFill>
			)}
			{LINES.map((s) => <BiSubtitle key={s.from} {...s} tone="light" scrim={.3} sync wipe={36} />)}
			{t >= 410 && t < 515 && <NameTag from={410} x={1240} y={250} no="No.0890 ·" category="超极巨宝可梦" categoryEn="Gigantic Pokémon" zh="无极汰那" en="ETERNATUS" tone="gold" opacity={tagOpacity} />}
			<Cry name="eternatus" at={410} />
		</AbsoluteFill>
	);
};
