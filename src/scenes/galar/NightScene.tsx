import React from 'react';
import {AbsoluteFill} from 'remotion';
import {BiSubtitle} from '../../components/BiSubtitle';
import {Cry} from '../../components/Cry';
import {useFrame} from '../../time';
import {NIGHT_SCENE_FRAMES, NIGHT_START, NIGHT_T0} from './continuity';
import {GIANT_CRY_AT, GoldWorld} from './GoldWorld';

export {NIGHT_END_CAMERA, NIGHT_SCENE_FRAMES} from './continuity';

const LINES = [
	{from: 45, to: 180, zh: '它拼命吸取这片土地的能量，发出红色的光。', en: 'It drew greedily on the energy of the land and gave off a red light.'},
	{from: 190, to: 320, zh: '黑色的旋涡遮住了天空。', en: 'A black vortex blotted out the sky.'},
	{from: 330, to: 465, zh: '各地的宝可梦被这股力量撑得巨大无比，失去了控制。', en: 'Across Galar, Pokémon swelled to enormous size and lost control.'},
	{from: 480, to: 620, zh: '它们四处作乱，伽勒尔差点就此灭亡。', en: 'They rampaged everywhere, and Galar came close to ruin.'},
	{from: 640, to: 760, zh: '后来的人，把那一天叫作"闇夜"。', en: 'Those who came after called that day the Darkest Day.'},
	{from: 780, to: 945, zh: '草路镇的山坡上，至今留着一幅巨大的地画，', en: 'On a hillside in Turffield, a vast geoglyph remains to this day,'},
	{from: 960, to: 1140, zh: '画的就是闇夜里的巨大宝可梦，和四散奔逃的人们。', en: 'depicting the giant Pokémon of the Darkest Day and the people fleeing from them.'},
];

const smooth = (t: number, a: number, b: number) => {
	const p = Math.max(0, Math.min(1, (t - a) / (b - a)));
	return p * p * (3 - 2 * p);
};

// 地画（世界坐标）：一头头顶极巨红云的巨兽，和右边四散奔逃的人
const BEAST = [
	'M-40 430 C40 360 180 350 300 385 C340 396 360 420 352 446',
	'M20 470 C110 455 220 458 300 470',
	'M300 385 C330 340 380 330 410 345 L372 360 L404 372 C380 380 350 380 330 392',
	'M-40 430 C-90 420 -120 380 -100 350 C-90 335 -70 340 -72 356',
	'M40 478 C30 510 10 530 -10 540', 'M110 470 C112 510 100 540 86 556', 'M220 472 C240 505 262 530 280 540', 'M290 468 C320 495 350 505 372 504',
	'M60 392 L66 356', 'M120 375 L132 334', 'M180 368 L196 326', 'M240 372 L258 336',
	'M330 300 C312 280 338 260 356 278 C362 252 400 256 396 284 C418 274 436 298 416 312',
	'M369 350 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0',
];
const FIGURES = [
	{x: 452, y: 470, s: 1, r: -8}, {x: 488, y: 500, s: 1.05, r: 6}, {x: 442, y: 540, s: .9, r: -4},
	{x: 522, y: 452, s: .85, r: 10}, {x: 532, y: 548, s: .95, r: -10}, {x: 566, y: 505, s: .8, r: 4},
];
const FIGURE = 'M0 -14 m-4.5 0 a4.5 4.5 0 1 0 9 0 a4.5 4.5 0 1 0 -9 0 M0 -9 L2 6 M1 -5 L-8 1 M1 -5 L10 -10 M2 6 L-7 17 M2 6 L11 15';

const Thread: React.FC<{d: string; p: number; w?: number}> = ({d, p, w = 6.5}) => (
	<g fill="none" strokeLinecap="round" strokeLinejoin="round">
		<path d={d} pathLength={1} stroke="#11140a" strokeWidth={w + 2.5} opacity={.55} strokeDasharray={`${p} 1.01`} transform="translate(1.2 1.8)" />
		<path d={d} pathLength={1} stroke="#d9cfa6" strokeWidth={w} strokeDasharray={`${p} 1.01`} />
		<path d={d} pathLength={1} stroke="#fff6d6" strokeWidth={w * .28} strokeDasharray={`${p} 1.01`} opacity={.7} transform="translate(-.8 -.9)" />
		<path d={d} stroke="#8f8664" strokeWidth={w + .5} strokeDasharray=".9 5.5" opacity={p > .99 ? .8 : 0} />
	</g>
);

const Geoglyph: React.FC<{t: number}> = ({t}) => {
	const on = smooth(t, 2080, 2095);
	if (on <= 0) return null;
	const items: Array<{d: string; w: number; f?: typeof FIGURES[number]}> = [...BEAST.map((d) => ({d, w: 11})), ...FIGURES.map((f) => ({d: FIGURE, w: 3.6, f}))];
	return (
		<g opacity={on}>
			{items.map((it, i) => {
				const a = 2090 + i * 14;
				const p = smooth(t, a, a + 55);
				if (p <= 0) return null;
				return it.f
					? <g key={i} transform={`translate(${it.f.x} ${it.f.y}) scale(${it.f.s}) rotate(${it.f.r})`}><Thread d={it.d} p={p} w={it.w} /></g>
					: <Thread key={i} d={it.d} p={p} w={it.w} />;
			})}
		</g>
	);
};

export const NightScene: React.FC = () => {
	const t = useFrame();
	const T = NIGHT_T0 + t;
	return (
		<AbsoluteFill style={{background: '#04050c'}}>
			<GoldWorld t={T} globalFrame={NIGHT_START + t} frameOffset={NIGHT_START}>
				<Geoglyph t={T} />
			</GoldWorld>
			{LINES.map((s) => <BiSubtitle key={s.from} {...s} source={{zh: '改写自 52poke「闇夜」「草路镇」', en: 'Adapted from Darkest Day and Turffield accounts'}} tone="light" scrim={.3} sync wipe={36} />)}
			{['charizard', 'snorlax', 'gengar'].map((n, i) => <Cry key={n} name={n} at={GIANT_CRY_AT[i] - NIGHT_T0} volume={0.55} />)}
		</AbsoluteFill>
	);
};

export const NIGHT_LAST = NIGHT_SCENE_FRAMES - .5;
