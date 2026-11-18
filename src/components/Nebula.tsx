import {AbsoluteFill} from 'remotion';
import {ShaderCanvas} from '../gl/ShaderCanvas';
import {NEBULA_FRAG} from '../gl/shaders';
import {BASE_FPS, useFrame} from '../time';

type Vec3 = [number, number, number];

export type NebulaProps = {
	/** 漩涡 / 光源中心（像素，CSS 坐标） */
	center: {x: number; y: number};
	converge?: number;
	warm?: number;
	rays?: number;
	bright?: number;
	tintL?: Vec3;
	tintR?: Vec3;
	tintAmt?: number;
	zoom?: number;
	/** 画布相对画面的放大倍数，留出镜头平移 / 侧倾的余量 */
	overscan?: number;
};

const W = 1920;
const H = 1080;

/** WebGL 远古星云背景（全分辨率绘制） */
export const Nebula: React.FC<NebulaProps> = ({
	center,
	converge = 0,
	warm = 0,
	rays = 0,
	bright = 1,
	tintL = [1, 1, 1],
	tintR = [1, 1, 1],
	tintAmt = 0,
	zoom = 0,
	overscan = 1,
}) => {
	const frame = useFrame();
	const cw = W * overscan;
	const ch = H * overscan;
	const ox = (cw - W) / 2;
	const oy = (ch - H) / 2;
	return (
		<AbsoluteFill>
			<ShaderCanvas
				frag={NEBULA_FRAG}
				width={cw}
				height={ch}
				style={{position: 'absolute', left: -ox, top: -oy}}
				uniforms={{
					uTime: frame / BASE_FPS,
					uCenter: [(center.x + ox) / cw, (center.y + oy) / ch],
					uConverge: converge,
					uWarm: warm,
					uRays: rays,
					uBright: bright,
					uTintL: tintL,
					uTintR: tintR,
					uTintAmt: tintAmt,
					uZoom: zoom,
				}}
			/>
		</AbsoluteFill>
	);
};
