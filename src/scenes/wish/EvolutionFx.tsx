import {useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {BASE_FPS} from '../../time';
import {ramp} from './common';
import {LightPool, ScreenSvg} from './finishFx';

const MARK_HOLD = 10;
const MARK_WIDTH = 197;
const MARK_HEIGHT = 240;
const DUST_PADDING = 164;
const CANVAS_WIDTH = MARK_WIDTH + DUST_PADDING * 2;
const CANVAS_HEIGHT = MARK_HEIGHT + DUST_PADDING * 2;

const unit = (value: number) => Math.max(0, Math.min(1, value));

export const evolutionAt = (frame: number, from: number, at: number) => ({
	charge: ramp(frame, from, at - 14) * (1 - ramp(frame, at - 8, at)),
	form: ramp(frame, at - 17, at - 6),
	flash: ramp(frame, at - 19, at - 10) * (1 - ramp(frame, at - 9, at + 4)),
});

export const rainbowShadow = (strength: number) => strength > 0 ? [
	`drop-shadow(-8px -5px 12px rgba(249,122,192,${strength * .78}))`,
	`drop-shadow(8px 8px 16px rgba(88,235,247,${strength * .79}))`,
	`drop-shadow(0 0 24px rgba(247,224,136,${strength * .55}))`,
].join(' ') : undefined;

/** 多色光晕落在立绘后面，立绘自身的虹彩由纹理轮廓裁切。 */
export const EvolutionHalo: React.FC<{
	frame: number;
	x: number;
	y: number;
	size: number;
	strength: number;
}> = ({frame, x, y, size, strength}) => {
	if (strength <= 0) return null;
	return (
		<>
			<LightPool x={x - size * .18} y={y - size * .18} radius={size * .53} color="255,127,174" opacity={strength * .63} />
			<LightPool x={x + size * .16} y={y + size * .12} radius={size * .63} color="82,210,255" opacity={strength * .73} />
			<LightPool x={x + size * .10} y={y - size * .24} radius={size * .44} color="228,241,139" opacity={strength * .64} />
			<ScreenSvg style={{opacity: strength * .78, mixBlendMode: 'screen'}}>
				<defs>
					<linearGradient id="wish-mega-arc" x1="0" y1="1" x2="1" y2="0">
						<stop stopColor="#ff799e" stopOpacity="0" />
						<stop offset=".26" stopColor="#ffd281" stopOpacity=".83" />
						<stop offset=".48" stopColor="#b5f599" stopOpacity=".84" />
						<stop offset=".72" stopColor="#80e9f6" stopOpacity=".77" />
						<stop offset="1" stopColor="#cd9eff" stopOpacity="0" />
					</linearGradient>
				</defs>
				<g transform={`translate(${x} ${y}) rotate(${-20 + 8 * Math.sin(frame * .052)})`} fill="none">
					{[0, 1, 2].map((i) => (
						<ellipse key={i} rx={size * (.36 + i * .082)} ry={size * (.19 + i * .056)}
							transform={`rotate(${i * 14 - 14})`} pathLength="1"
							stroke="url(#wish-mega-arc)" strokeWidth={3.6 - i * .68}
							strokeDasharray=".26 .14 .39 .21" strokeDashoffset={-frame * (.016 + i * .004)} />
					))}
				</g>
			</ScreenSvg>
		</>
	);
};

type Dust = {x: number; y: number; start: number; color: string; vx: number; vy: number; size: number; alpha: number};
type Artwork = {image: HTMLImageElement; mask: HTMLCanvasElement; rgba: Uint8ClampedArray; order: Float32Array; dust: Dust[]};
let artwork: Promise<Artwork> | undefined;

const scatter = (x: number, y: number) => {
	const bits = Math.imul(x + 71, 1619) ^ Math.imul(y + 113, 31337);
	return ((Math.imul(bits ^ (bits >>> 13), 0x45d9f3b) >>> 0) % 65536) / 65536;
};

const loadArtwork = () => artwork ??= new Promise<Artwork>((resolve, reject) => {
	const image = new Image();
	image.onload = () => {
		try {
			const mask = document.createElement('canvas');
			mask.width = MARK_WIDTH;
			mask.height = MARK_HEIGHT;
			const ctx = mask.getContext('2d')!;
			ctx.drawImage(image, 0, 0, MARK_WIDTH, MARK_HEIGHT);
			const rgba = ctx.getImageData(0, 0, MARK_WIDTH, MARK_HEIGHT).data;
			const order = new Float32Array(MARK_WIDTH * MARK_HEIGHT);
			const dust: Dust[] = [];
			for (let y = 0; y < MARK_HEIGHT; y++) {
				for (let x = 0; x < MARK_WIDTH; x++) {
					const p = y * MARK_WIDTH + x;
					if (rgba[p * 4 + 3] === 0) continue;
					const cluster = scatter(Math.floor(x / 8), Math.floor(y / 8));
					const grain = scatter(x, y);
					order[p] = .05 + .72 * (.48 * (1 - x / MARK_WIDTH) + .18 * (y / MARK_HEIGHT) + .27 * cluster + .07 * grain);
					if (x % 4 !== 0 || y % 4 !== 0 || rgba[p * 4 + 3] < 100) continue;
					dust.push({
						x, y, start: order[p],
						color: `rgb(${rgba[p * 4]},${rgba[p * 4 + 1]},${rgba[p * 4 + 2]})`,
						vx: 26 + 99 * grain + (x - MARK_WIDTH * .5) * .42,
						vy: (y - MARK_HEIGHT * .5) * .57 - 92 * cluster,
						size: 1.1 + grain * 2.8,
						alpha: rgba[p * 4 + 3] / 255,
					});
				}
			}
			resolve({image, mask, rgba, order, dust});
		} catch (error) {
			reject(error);
		}
	};
	image.onerror = () => reject(new Error('Failed to load the supplied Mega Evolution mark'));
	image.src = staticFile('wish/mega-evolution.png');
});

const DustCanvas: React.FC<{x: number; y: number; height: number; progress: number}> = ({x, y, height, progress}) => {
	const ref = useRef<HTMLCanvasElement>(null);
	const ready = useRef(false);
	const [handle] = useState(() => delayRender('《迎着流星》超级进化标志'));
	const [data, setData] = useState<Artwork>();
	const scale = height / MARK_HEIGHT;
	useLayoutEffect(() => {
		let mounted = true;
		loadArtwork().then((asset) => {
			if (mounted) setData(asset);
		}, (error) => {
			if (mounted) cancelRender(error);
		});
		return () => {
			mounted = false;
			if (!ready.current) continueRender(handle);
		};
	}, [handle]);

	useLayoutEffect(() => {
		if (!data) return;
		const {image, mask, rgba, order, dust} = data;
		const ctx = ref.current!.getContext('2d')!;
		ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		ctx.globalAlpha = 1;
		if (progress === 0) {
			ctx.drawImage(image, DUST_PADDING, DUST_PADDING, MARK_WIDTH, MARK_HEIGHT);
		} else {
			if (progress < .83) {
				const pixels = new Uint8ClampedArray(rgba);
				for (let i = 0; i < order.length; i++) {
					pixels[i * 4 + 3] *= 1 - unit((progress - order[i]) / .07);
				}
				mask.getContext('2d')!.putImageData(new ImageData(pixels, MARK_WIDTH, MARK_HEIGHT), 0, 0);
				ctx.drawImage(mask, DUST_PADDING, DUST_PADDING);
			}
			for (const mote of dust) {
				const elapsed = progress - mote.start;
				if (elapsed <= 0) continue;
				const life = elapsed / (1 - mote.start);
				const dot = mote.size * (1 - life * .64);
				ctx.globalAlpha = mote.alpha * unit(elapsed / .029) * (1 - life) ** 1.27;
				ctx.fillStyle = mote.color;
				ctx.fillRect(DUST_PADDING + mote.x + mote.vx * elapsed, DUST_PADDING + mote.y + mote.vy * elapsed, dot, dot);
			}
		}
		if (!ready.current) {
			ready.current = true;
			continueRender(handle);
		}
	}, [data, handle, progress]);
	return (
		<canvas ref={ref} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{
			position: 'absolute', left: x - CANVAS_WIDTH * scale / 2, top: y - CANVAS_HEIGHT * scale / 2,
			width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale, pointerEvents: 'none',
			filter: 'drop-shadow(0 1px 2px #101b30) drop-shadow(0 0 12px #b9d8d6a8)',
		}} />
	);
};

/** 标志完整停留片刻，再从原图的颜色和轮廓中散出一秒尘埃。 */
export const MegaMark: React.FC<{frame: number; at: number; x: number; y: number; height: number}> =
	({frame, at, x, y, height}) => {
		const age = frame - at;
		if (age < 0 || age >= MARK_HOLD + BASE_FPS) return null;
		const progress = unit((age - MARK_HOLD) / BASE_FPS);
		const pop = 1 + .12 * (1 - ramp(age, 0, 8));
		return <DustCanvas x={x} y={y} height={height * pop} progress={progress} />;
	};

