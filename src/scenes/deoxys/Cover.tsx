import {useCallback} from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {GlyphWorld} from './GlyphWorld';
import {OPEN, SANS} from './Overlay';
import {buildCoverFrame, CoverPlacement} from './coverWorld';
import type {Assets} from './world';

type Layout = CoverPlacement & {
	title: {x: number; y: number; size: number; center?: boolean};
};

const WIDE: Layout = {
	figure: [0.725, 0.472, 0.728],
	strandX: 0.993,
	horizonY: 0.85,
	title: {x: 0.074, y: 0.385, size: 0.116},
};

const STANDARD: Layout = {
	figure: [0.695, 0.475, 0.6],
	strandX: 0.999,
	horizonY: 0.84,
	title: {x: 0.066, y: 0.392, size: 0.097},
};

const PORTRAIT: Layout = {
	figure: [0.543, 0.379, 0.507],
	strandX: 1.012,
	horizonY: 0.93,
	title: {x: 0.5, y: 0.709, size: 0.128, center: true},
};

export const DeoxysCover: React.FC = () => {
	const {width, height} = useVideoConfig();
	const aspect = width / height;
	const layout = aspect < 1 ? PORTRAIT : aspect > 1.5 ? WIDE : STANDARD;
	const getFrame = useCallback((_: number, assets: Assets) => buildCoverFrame(assets.normal, width, height, layout), [width, height, layout]);
	const {x, y, size, center} = layout.title;
	const em = size * Math.min(width, height);

	return (
		<AbsoluteFill style={{background: '#07070c'}}>
			<GlyphWorld frame={0} getFrame={getFrame} fullBleed />
			<AbsoluteFill style={{
				background: `radial-gradient(ellipse ${0.43 * Math.min(width, height)}px ${0.45 * height}px at ${layout.figure[0] * 100}% ${layout.figure[1] * 88}%, #2a536541, transparent)`,
				mixBlendMode: 'screen',
			}} />
			<div style={{
				position: 'absolute', left: x * width, top: y * height,
				transform: center ? 'translateX(-50%)' : undefined,
				textAlign: center ? 'center' : 'left', whiteSpace: 'nowrap',
				fontFamily: SANS, textShadow: '0 2px 24px #07070c',
			}}>
				<div style={{
					fontSize: em * 0.18, fontWeight: 450, letterSpacing: '0.2em', color: '#a0b2c5',
					lineHeight: 1.25, marginBottom: em * 0.13,
				}}>
					No.0386 · 代欧奇希斯
				</div>
				<div style={{
					fontSize: em, fontWeight: 650, letterSpacing: '0.064em', color: 'transparent',
					lineHeight: 1.21, marginRight: '-0.064em',
					background: 'linear-gradient(175deg, #f1f6fa 17%, #d7e4ed 84%)',
					backgroundClip: 'text', textShadow: 'none',
				}}>
					坠落的序列
				</div>
				<div style={{
					fontFamily: OPEN, fontSize: em * 0.217, fontWeight: 400, letterSpacing: '0.35em',
					color: '#aec0d0', lineHeight: 1.36, marginTop: em * 0.125, marginRight: '-0.35em',
				}}>
					THE FALLEN SEQUENCE
				</div>
			</div>
		</AbsoluteFill>
	);
};
