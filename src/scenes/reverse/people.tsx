import {Img, staticFile} from 'remotion';
import {V3} from '../../three/stage';
import {Cam, project, pxOf} from './cam';

/**
 * 有官方形象的人物：官方立绘压暗去饱和，侧面一层按轮廓遮罩的弱光 + 一圈细轮廓光（同《敬畏》的 TrainerSilhouette），
 * 脚底对齐 3D 点，大小随镜头远近变化。h 为人物身高（世界单位）。
 */
export const TrainerSil: React.FC<{
	c: Cam;
	file: string;
	aspect: number;
	foot: V3;
	h: number;
	o: number;
	from: 'left' | 'right';
	rgb: string;
	lift?: number;
}> = ({c, file, aspect, foot, h, o, from, rgb, lift = 0.14}) => {
	if (o <= 0.001) return null;
	const p = project(c, foot);
	if (p.depth <= 0.3) return null;
	const hp = pxOf(c, p.depth, h);
	const w = hp * aspect;
	const url = `url(${staticFile(file)})`;
	const dx = from === 'left' ? -2 : 2;
	return (
		<div style={{position: 'absolute', left: p.x - w / 2, top: p.y - hp, width: w, height: hp, opacity: o}}>
			<Img
				src={staticFile(file)}
				style={{
					position: 'absolute',
					inset: 0,
					width: w,
					height: hp,
					filter: `brightness(${lift}) saturate(0.18) contrast(1.15) drop-shadow(${dx}px -1px 1.5px rgba(${rgb},0.55)) drop-shadow(0 0 14px rgba(0,0,0,0.65))`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					WebkitMaskImage: url,
					WebkitMaskSize: '100% 100%',
					maskImage: url,
					maskSize: '100% 100%',
					mixBlendMode: 'screen',
					background: `linear-gradient(${from === 'left' ? 100 : 260}deg, rgba(${rgb},${0.2 + lift * 0.5}) 0%, rgba(${rgb},0.06) 32%, rgba(0,0,0,0) 58%), linear-gradient(180deg, rgba(${rgb},0.05) 0%, rgba(0,0,0,0) 40%)`,
				}}
			/>
		</div>
	);
};
