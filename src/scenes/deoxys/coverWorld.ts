import {random} from 'remotion';
import {Camera, FrameData, STRIDE} from './engine';
import {complement, GLYPH} from './glyphs';
import type {FigureSet} from './world';

type Color = [number, number, number];

export type CoverPlacement = {
	figure: [x: number, y: number, height: number];
	strandX: number;
	horizonY: number;
};

const TAU = 2 * Math.PI;
const SILVER: Color = [0.59, 0.76, 0.87];
const AMBER: Color = [1, 0.72, 0.43];
const BLACK: Color = [0, 0, 0];

export const buildCoverFrame = (figure: FigureSet, width: number, height: number, placement: CoverPlacement): FrameData => {
	const cam: Camera = {pos: [0, 0, 0], yaw: 0, pitch: 0, fov: Math.PI / 5};
	const tanHalf = Math.tan(cam.fov / 2);
	const [x, y, scale] = placement.figure;
	const cx = x * width;
	const cy = y * height;
	const size = scale * height;
	const coreX = cx + figure.crystal[0] * size;
	const coreY = cy - figure.crystal[1] * size;
	const strandSteps = 72;
	const dustCount = 470;
	const particles = new Float32Array((figure.n + strandSteps * 6 + dustCount + 2) * STRIDE);
	let count = 0;

	// 以封面像素排构图，再投回透视相机的字粒子空间。
	const emit = (px: number, py: number, z: number, glyphSize: number, letter: number, color: Color, light: number, blur = 0) => {
		const unit = 2 * tanHalf * z / height;
		particles.set([
			(px - width / 2) * unit, (height / 2 - py) * unit, z, glyphSize * unit,
			0, 0, 0, letter,
			...color, light, blur, 0,
		], count * STRIDE);
		count++;
	};

	// 让双螺旋沿斜向弧线变细，在水晶体附近散开。
	const startX = placement.strandX * width;
	const startY = -0.065 * height;
	const bendX = startX * 0.87 + coreX * 0.13;
	const bendY = coreY * 0.41;
	const endX = coreX + size * 0.055;
	const endY = coreY - size * 0.03;
	for (let i = 0; i < strandSteps; i++) {
		const t = i / (strandSteps - 1);
		const u = 1 - t;
		const px = u * u * startX + 2 * u * t * bendX + t * t * endX;
		const py = u * u * startY + 2 * u * t * bendY + t * t * endY;
		const dx = u * (bendX - startX) + t * (endX - bendX);
		const dy = u * (bendY - startY) + t * (endY - bendY);
		const phase = (t * 3.15 + 0.14) * TAU;
		const r = height * 0.061 * (1 - 0.76 * t);
		const length = Math.hypot(dx, dy);
		const spread = r * Math.sin(phase) / length;
		const front = Math.cos(phase);
		const fade = 1 - t ** 4;
		const base = Math.floor(random(487 + i) * 4);
		const glyphSize = height * (0.011 + 0.003 * random(741 + i));

		emit(px - dy * spread, py + dx * spread, 14 - front, glyphSize, base, SILVER, (0.91 + front * 0.34) * fade);
		emit(px + dy * spread, py - dx * spread, 14 + front, glyphSize, complement(base), SILVER, (0.91 - front * 0.34) * fade);
		if (i % 2 === 0) {
			for (const offset of [-0.5, 0, 0.5]) {
				emit(px + dy * spread * offset, py - dx * spread * offset, 14, glyphSize * 0.85, GLYPH.DOT, SILVER, fade * 0.8);
			}
		}
		const drift = (random(982 + i) - 0.5) * 3.6 * r / length;
		emit(px - dy * drift, py + dx * drift, 14, glyphSize * 0.69, base, SILVER, 0.46 * fade, 1.65);
	}

	// 轮廓取自普通形态的官方立绘采样。以原图明暗保留眼睛和触手的层次。
	for (let i = 0; i < figure.n; i++) {
		const seed = 1000 + 7 * i;
		const fx = figure.x[i];
		const fy = figure.y[i];
		const lum = figure.lum[i];
		const cyan = Math.min(1, Math.max(0, figure.b[i] - figure.r[i]) * 2.8);
		const tint: Color = [0.62 + 0.29 * lum - 0.42 * cyan, 0.74 + 0.18 * lum, 0.86 + 0.12 * lum + 0.08 * cyan];
		const light = (0.13 + 2.7 * lum ** 1.48) * (0.83 + 0.25 * (fy + 0.5)) * (0.89 + 0.25 * random(seed));
		emit(
			cx + size * (fx + (random(seed + 1) - 0.5) * 0.005),
			cy - size * (fy + (random(seed + 2) - 0.5) * 0.005),
			11 - figure.z[i] * 2,
			size * figure.cell * (1.26 + 0.59 * random(seed + 3)),
			Math.floor(random(seed + 4) * 4),
			figure.cr[i] ? AMBER : tint,
			figure.cr[i] ? 2.9 + 0.55 * lum : light,
		);
	}
	emit(coreX, coreY, 11, size * 0.067, GLYPH.DOT, AMBER, 2.4, 8);
	emit(coreX, coreY, 10.75, size * 0.027, GLYPH.DOT, [1, 0.89, 0.68], 3.3);

	// 少量字从采样轮廓飘离，留出能辨认的实心轮廓。
	for (let i = 0; i < dustCount; i++) {
		const seed = 50000 + 8 * i;
		const j = Math.floor(random(seed) * figure.n);
		const distance = 0.018 + 0.17 * random(seed + 1) ** 2;
		const angle = random(seed + 2) * TAU;
		emit(
			cx + size * (figure.x[j] + distance * Math.cos(angle) + distance * 0.6),
			cy - size * (figure.y[j] + distance * Math.sin(angle) + distance * 0.33),
			9 + 5 * random(seed + 3),
			height * (0.003 + 0.008 * random(seed + 4) ** 3),
			Math.floor(random(seed + 5) * 4),
			SILVER,
			(0.32 - distance) * (0.45 + random(seed + 6) * 0.55),
			0.35,
		);
	}

	const radius = 300;
	const distance = 318;
	const elevation = Math.atan((1 - 2 * placement.horizonY) * tanHalf) - Math.asin(radius / distance);
	return {
		cam, particles, count,
		env: {
			time: 38.5,
			seaAmt: 0, seaY: 0, starAmt: 1.15, spaceAmt: 0.88,
			auroraAmt: 0, auroraWarm: 0, dustAmt: 0.18, dustOff: [0, 0],
			skyWarm: 0, flash: 0,
			l0Pos: [0, 0, 0], l0Col: BLACK, l1Pos: [0, 0, 0], l1Col: BLACK,
			planetAmt: 0.72, planetC: [0, Math.sin(elevation) * distance, Math.cos(elevation) * distance],
			planetR: radius, limbAurora: 0.55, wave: 0,
		},
		post: {threshold: 0.49, bloom: 1.14, exposure: 1.19, glitch: 0, aberr: 0, vignette: 0.7, fade: 1, focus: 11, dofK: 6},
	};
};
