import {useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import {Cam} from '../../camera';
import {MAX_LIGHTS, UNOWN_FRAG, UNOWN_VERT, WALL_FRAG} from '../../gl/unownWall';

/**
 * 阿露福石室的石墙 + 墙上的未知图腾（同一个 WebGL 画布）。
 * 摄像机在着色器里换算，推近时石纹依然清晰；画面上所有宝可梦像素都来自官方立绘图集（tools/unown_atlas.py）。
 */

type Vec3 = [number, number, number];

export type WallLight = {pos: Vec3; color: Vec3; radius: number};

export type Glyph = {
	x: number;
	y: number;
	size: number;
	rot?: number;
	/** 形态：'a'…'z'、'ex'、'qu' */
	form: string;
	/** 0 = 凹刻在石头里，1 = 原立绘 */
	carve: number;
	/** 眼睑张开程度 0..1 */
	eye: number;
	/** 轮廓金光 */
	gold?: number;
	alpha?: number;
	/** 景深系数（1 = 墙面） */
	k?: number;
	/** 眼白微光：暗处只看得见眼睛 */
	eyeGlow?: number;
	/** 所在的面：0 墙面（默认）；1 地面（x, y 改作 x 与离墙距离 z）；2 空中（离墙距离 z） */
	plane?: 0 | 1 | 2;
	z?: number;
	/** 拼图浮雕石板：form 用 'kabuto' | 'omanyte' | 'aerodactyl' | 'ho-oh' */
	relief?: boolean;
	/** 外面的天光（冷白） */
	daylight?: number;
	/** 拼图石板的分块：不填 = 整块；'board' = 空的石槽；0..15 = 单独一块拼块（4×4 按行） */
	tile?: number | 'board';
};

/** 拼图浮雕图集的顺序（tools/unown_atlas.py 的 RELIEFS） */
const RELIEFS = ['kabuto', 'omanyte', 'aerodactyl', 'ho-oh'];

/** 针孔相机到墙面的距离（世界像素）：墙面上的缩放 = zoom，离墙 z 的点再乘 DC / (DC - z) */
export const DC = 2600;
/** 墙脚 / 地面的世界 y */
export const FLOOR_Y = 1250;

/**
 * 针孔透视：世界点 (x, y, 离墙 z) → 屏幕坐标与缩放。相机在 (cam.x, cam.y, DC)，焦距 = zoom × DC，pitch 为俯角（度）。
 * pitch = 0 且 z = 0 时与 camera.ts 的 project(cam, 1, p) 完全一致。
 */
export const projectRoom = (cam: Cam, p: {x: number; y: number; z: number}, pitch = 0, camZ = DC) => {
	const a = (pitch * Math.PI) / 180;
	const dx = p.x - cam.x;
	const dy = p.y - cam.y;
	const dz = p.z - camZ;
	const vy = dy * Math.cos(a) + dz * Math.sin(a);
	const vz = -dy * Math.sin(a) + dz * Math.cos(a);
	const s = (cam.zoom * DC) / -vz;
	const r = (cam.roll * Math.PI) / 180;
	const sx = dx * s;
	const sy = vy * s;
	return {x: sx * Math.cos(r) - sy * Math.sin(r) + 960, y: sx * Math.sin(r) + sy * Math.cos(r) + 540, scale: s, behind: vz >= 0};
};

type Atlas = {cell: number; cols: number; rows: number; forms: string[]; eyes: Record<string, {cx: number; cy: number; r: number}>};

const VERT_FULL = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
	const s = gl.createShader(type)!;
	gl.shaderSource(s, src);
	gl.compileShader(s);
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'compile failed');
	return s;
};

const link = (gl: WebGL2RenderingContext, vs: string, fs: string) => {
	const p = gl.createProgram()!;
	gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
	gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
	gl.linkProgram(p);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link failed');
	return p;
};

const loadImage = (src: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});

const upload = (gl: WebGL2RenderingContext, img: HTMLImageElement, unit: number, mip: boolean) => {
	const t = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0 + unit);
	gl.bindTexture(gl.TEXTURE_2D, t);
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	if (mip) {
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	} else {
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	}
};

type State = {
	gl: WebGL2RenderingContext;
	wall: WebGLProgram;
	unown: WebGLProgram;
	fullVao: WebGLVertexArrayObject;
	quadVao: WebGLVertexArrayObject;
	instBuf: WebGLBuffer;
	atlas: Atlas;
	loc: (p: WebGLProgram, name: string) => WebGLUniformLocation | null;
};

const FLOATS = 16;

export const UnownWall: React.FC<{
	cam: Cam;
	time: number;
	lights: WallLight[];
	ambient?: Vec3;
	glyphs: Glyph[];
	gold?: number;
	goldPhase?: number;
	/** 画地面（第 2 段起） */
	floor?: boolean;
	/** 相机俯角（度） */
	pitch?: number;
	/** 相机离墙的距离（推轨），默认 DC */
	camZ?: number;
	/** 通往外面的门洞（第 3 段起） */
	door?: {x: number; halfWidth: number; springY: number};
	/** 门外夜色的亮度 */
	outside?: number;
	/** 门外的白天 0..1 */
	day?: number;
	/** 墙上金光从一点扩散：中心与半径（世界坐标） */
	goldWave?: {x: number; y: number; r: number};
	/** 渲染分辨率倍数 */
	resolution?: number;
	style?: React.CSSProperties;
}> = ({cam, time, lights, ambient = [0.004, 0.004, 0.005], glyphs, gold = 0, goldPhase = 0, floor = false, pitch = 0, camZ = DC, door, outside = 0, day = 0, goldWave, resolution = 1, style}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const stateRef = useRef<State | null>(null);
	const [assets, setAssets] = useState<{
		art: HTMLImageElement;
		normal: HTMLImageElement;
		relief: HTMLImageElement;
		reliefN: HTMLImageElement;
		atlas: Atlas;
	} | null>(null);
	const [handle] = useState(() => delayRender('UnownWall atlas'));
	const doneRef = useRef(false);
	const w = Math.round(1920 * resolution);
	const h = Math.round(1080 * resolution);

	useLayoutEffect(() => {
		let alive = true;
		Promise.all([
			loadImage(staticFile('pokemon/unown/atlas-art.png')),
			loadImage(staticFile('pokemon/unown/atlas-normal.png')),
			loadImage(staticFile('pokemon/unown/relief-art.png')),
			loadImage(staticFile('pokemon/unown/relief-normal.png')),
			fetch(staticFile('pokemon/unown/atlas.json')).then((r) => r.json() as Promise<Atlas>),
		]).then(([art, normal, relief, reliefN, atlas]) => alive && setAssets({art, normal, relief, reliefN, atlas}));
		return () => {
			alive = false;
		};
	}, []);

	useLayoutEffect(() => {
		if (!assets) return;
		const gl = canvasRef.current!.getContext('webgl2', {preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: true})!;
		const wall = link(gl, VERT_FULL, WALL_FRAG);
		const unown = link(gl, UNOWN_VERT, UNOWN_FRAG);

		const fullVao = gl.createVertexArray()!;
		gl.bindVertexArray(fullVao);
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const aPos = gl.getAttribLocation(wall, 'aPos');
		gl.enableVertexAttribArray(aPos);
		gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

		const quadVao = gl.createVertexArray()!;
		gl.bindVertexArray(quadVao);
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
		const aCorner = gl.getAttribLocation(unown, 'aCorner');
		gl.enableVertexAttribArray(aCorner);
		gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);
		const instBuf = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
		(['aA', 'aB', 'aC', 'aD'] as const).forEach((name, i) => {
			const l = gl.getAttribLocation(unown, name);
			gl.enableVertexAttribArray(l);
			gl.vertexAttribPointer(l, 4, gl.FLOAT, false, FLOATS * 4, i * 16);
			gl.vertexAttribDivisor(l, 1);
		});
		gl.bindVertexArray(null);

		upload(gl, assets.art, 0, true);
		upload(gl, assets.normal, 1, true);
		upload(gl, assets.relief, 2, true);
		upload(gl, assets.reliefN, 3, true);

		const cache = new Map<string, WebGLUniformLocation | null>();
		const programs = new Map([
			[wall, 'w'],
			[unown, 'u'],
		]);
		const loc = (p: WebGLProgram, name: string) => {
			const key = programs.get(p) + name;
			if (!cache.has(key)) cache.set(key, gl.getUniformLocation(p, name));
			return cache.get(key)!;
		};
		stateRef.current = {gl, wall, unown, fullVao, quadVao, instBuf, atlas: assets.atlas, loc};
		return () => {
			gl.getExtension('WEBGL_lose_context')?.loseContext();
			stateRef.current = null;
		};
	}, [assets]);

	useLayoutEffect(() => {
		const s = stateRef.current;
		if (!s) return;
		const {gl, loc, atlas} = s;
		gl.viewport(0, 0, w, h);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		const common = (p: WebGLProgram) => {
			gl.useProgram(p);
			gl.uniform4f(loc(p, 'uCam'), cam.x, cam.y, cam.zoom, cam.roll);
			gl.uniform2f(loc(p, 'uRes'), w, h);
			gl.uniform1f(loc(p, 'uTime'), time);
			for (let i = 0; i < MAX_LIGHTS; i++) {
				const l = lights[i];
				gl.uniform3fv(loc(p, `uLightPos[${i}]`), l ? l.pos : [0, 0, 1000]);
				gl.uniform3fv(loc(p, `uLightCol[${i}]`), l ? l.color : [0, 0, 0]);
				gl.uniform1f(loc(p, `uLightRad[${i}]`), l ? l.radius : 1);
			}
			gl.uniform3fv(loc(p, 'uAmbient'), ambient);
			gl.uniform1f(loc(p, 'uGold'), gold);
			gl.uniform1f(loc(p, 'uGoldPhase'), goldPhase);
			gl.uniform1f(loc(p, 'uFloorOn'), floor ? 1 : 0);
			gl.uniform1f(loc(p, 'uBase'), FLOOR_Y);
			gl.uniform1f(loc(p, 'uDc'), DC);
			gl.uniform1f(loc(p, 'uPitch'), pitch);
			gl.uniform1f(loc(p, 'uCamZ'), camZ);
			gl.uniform4f(loc(p, 'uDoor'), door?.x ?? 0, door?.halfWidth ?? 0, door?.springY ?? 0, door ? 1 : 0);
			gl.uniform1f(loc(p, 'uOutside'), outside);
			gl.uniform1f(loc(p, 'uDay'), day);
			gl.uniform4f(loc(p, 'uGoldWave'), goldWave?.x ?? 0, goldWave?.y ?? 0, goldWave?.r ?? 0, goldWave ? 1 : 0);
		};

		// 石墙
		gl.disable(gl.BLEND);
		common(s.wall);
		gl.bindVertexArray(s.fullVao);
		gl.drawArrays(gl.TRIANGLES, 0, 3);

		// 未知图腾（远的先画：墙面 → 地面 / 空中按离墙距离）
		const depth = (g: Glyph) => ((g.plane ?? 0) === 0 ? (g.k ?? 1) - 1 : (g.plane === 1 ? g.y : g.z ?? 0) / 100);
		const list = [...glyphs].filter((g) => (g.alpha ?? 1) > 0.001).sort((a, b) => depth(a) - depth(b));
		if (list.length) {
			const data = new Float32Array(list.length * FLOATS);
			list.forEach((g, i) => {
				const form = g.relief ? RELIEFS.indexOf(g.form) : atlas.forms.indexOf(g.form);
				data.set(
					[
						g.x, g.y, g.size, g.rot ?? 0,
						form, g.carve, g.eye, g.gold ?? 0,
						g.alpha ?? 1, g.k ?? 1, g.eyeGlow ?? 0, g.plane ?? 0,
						g.z ?? 0, g.relief ? 1 : 0, g.relief ? (g.tile === undefined ? 1 : g.tile === 'board' ? 1.5 : 2 + g.tile) : 0, g.daylight ?? 0,
					],
					i * FLOATS,
				);
			});
			common(s.unown);
			gl.uniform1i(loc(s.unown, 'uArt'), 0);
			gl.uniform1i(loc(s.unown, 'uNormal'), 1);
			gl.uniform1i(loc(s.unown, 'uRelief'), 2);
			gl.uniform1i(loc(s.unown, 'uReliefN'), 3);
			gl.uniform2f(loc(s.unown, 'uGrid'), atlas.cols, atlas.rows);
			const eyes = new Float32Array(28 * 3);
			atlas.forms.forEach((f, i) => eyes.set([atlas.eyes[f].cx, atlas.eyes[f].cy, atlas.eyes[f].r], i * 3));
			gl.uniform3fv(loc(s.unown, 'uEyes'), eyes);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.bindVertexArray(s.quadVao);
			gl.bindBuffer(gl.ARRAY_BUFFER, s.instBuf);
			gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, list.length);
		}
		gl.bindVertexArray(null);
		if (!doneRef.current) {
			doneRef.current = true;
			continueRender(handle);
		}
	});

	return <canvas ref={canvasRef} width={w} height={h} style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...style}} />;
};
