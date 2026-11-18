import {ShaderCanvas} from '../../gl/ShaderCanvas';
import {SINJOH_FRAG} from '../../gl/sinjoh';

/** 雪原的相机：位置（米）、yaw（度，0 = 朝 -z，正值向右转）、pitch（度，向下为正）、垂直视角 fov（度） */
export type SnowCam = {x: number; y: number; z: number; yaw: number; pitch: number; fov: number};

/** 世界点 → 屏幕坐标与缩放（每米多少像素）；与 gl/sinjoh.ts 的相机一致 */
export const projectSnow = (c: SnowCam, p: {x: number; y: number; z: number}) => {
	const yaw = (c.yaw * Math.PI) / 180;
	const pit = (c.pitch * Math.PI) / 180;
	const fw = [Math.sin(yaw) * Math.cos(pit), -Math.sin(pit), -Math.cos(yaw) * Math.cos(pit)];
	const rt = [Math.cos(yaw), 0, Math.sin(yaw)];
	const up = [Math.sin(yaw) * Math.sin(pit), Math.cos(pit), -Math.cos(yaw) * Math.sin(pit)];
	const d = [p.x - c.x, p.y - c.y, p.z - c.z];
	const dot = (a: number[]) => a[0] * d[0] + a[1] * d[1] + a[2] * d[2];
	const depth = dot(fw);
	const F = 540 / Math.tan((c.fov * Math.PI) / 360);
	return {x: 960 + (dot(rt) / depth) * F, y: 540 - (dot(up) / depth) * F, scale: F / depth, depth, behind: depth <= 0.05};
};

/**
 * 神都遗迹的雪原（光线步进）。white：白场；haze：风雪浓度；snow：飘雪；doorGlow：门洞深处的金光。
 */
export const SinjohSnow: React.FC<{cam: SnowCam; time: number; white?: number; haze?: number; snow?: number; doorGlow?: number; resolution?: number}> = ({
	cam,
	time,
	white = 0,
	haze = 0,
	snow = 1,
	doorGlow = 0,
	resolution = 0.75,
}) => (
	<ShaderCanvas
		frag={SINJOH_FRAG}
		width={1920}
		height={1080}
		scale={resolution}
		style={{position: 'absolute', left: 0, top: 0}}
		uniforms={{
			uTime: time,
			uCamPos: [cam.x, cam.y, cam.z],
			uYaw: cam.yaw,
			uPitch: cam.pitch,
			uFov: cam.fov,
			uWhite: white,
			uHaze: haze,
			uSnow: snow,
			uDoorGlow: doorGlow,
		}}
	/>
);
