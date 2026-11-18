import {AbsoluteFill} from 'remotion';
import {ShaderCanvas} from '../gl/ShaderCanvas';
import {DAWN_FRAG} from '../gl/shaders';
import {BASE_FPS, useFrame} from '../time';

type Vec3 = [number, number, number];

const W = 1920;
const H = 1080;

/** WebGL「创世黎明」背景：弧形地平线与升起的晨光 */
export const Dawn: React.FC<{
	/** 晨光中心（像素，CSS 坐标） */
	sun: {x: number; y: number};
	/** 地平线顶点的 y（像素） */
	horizonY: number;
	glow?: number;
	rays?: number;
	bright?: number;
	tintL?: Vec3;
	tintR?: Vec3;
	tintAmt?: number;
	zoom?: number;
	/** 画布相对画面的放大倍数，留出镜头平移 / 侧倾的余量 */
	overscan?: number;
}> = ({sun, horizonY, glow = 1, rays = 0.6, bright = 1, tintL = [1, 1, 1], tintR = [1, 1, 1], tintAmt = 0, zoom = 0, overscan = 1}) => {
	const frame = useFrame();
	const cw = W * overscan;
	const ch = H * overscan;
	const ox = (cw - W) / 2;
	const oy = (ch - H) / 2;
	return (
		<AbsoluteFill>
			<ShaderCanvas
				frag={DAWN_FRAG}
				width={cw}
				height={ch}
				style={{position: 'absolute', left: -ox, top: -oy}}
				uniforms={{
					uTime: frame / BASE_FPS,
					uSun: [(sun.x + ox) / cw, (sun.y + oy) / ch],
					uHorizon: (horizonY + oy) / ch,
					uGlow: glow,
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
