import {useLayoutEffect, useRef} from 'react';

/**
 * 两遍渲染的油画画布：
 * 1. scene 着色器把"景"画进一张纹理（rgb = 颜色，a = 笔势角度 / π）；
 * 2. paint 着色器在世界坐标里撒笔触，每一笔从纹理里取笔心处的颜色与笔势。
 * 景只需逐像素算一次（原先每个像素要沿笔触算十几次），复杂的景也能快速渲染、快速编译。
 * 两个着色器收到同一组 uniform；uRes 自动注入。
 */

type Uniforms = Record<string, number | [number, number] | [number, number, number] | [number, number, number, number]>;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
	const sh = gl.createShader(type)!;
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader compile failed');
	return sh;
};

const link = (gl: WebGL2RenderingContext, frag: string) => {
	const p = gl.createProgram()!;
	gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
	gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
	gl.linkProgram(p);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link failed');
	return p;
};

type State = {
	gl: WebGL2RenderingContext;
	scene: WebGLProgram;
	paint: WebGLProgram;
	fbo: WebGLFramebuffer;
	tex: WebGLTexture;
	locs: Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>;
};

export const PaintCanvas: React.FC<{scene: string; paint: string; uniforms: Uniforms; width?: number; height?: number; style?: React.CSSProperties}> = ({
	scene,
	paint,
	uniforms,
	width = 1920,
	height = 1080,
	style,
}) => {
	const ref = useRef<HTMLCanvasElement>(null);
	const st = useRef<State | null>(null);

	useLayoutEffect(() => {
		const canvas = ref.current!;
		const gl = canvas.getContext('webgl2', {preserveDrawingBuffer: true, premultipliedAlpha: false})!;
		const sceneP = link(gl, scene);
		const paintP = link(gl, paint);
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		for (const p of [sceneP, paintP]) {
			const loc = gl.getAttribLocation(p, 'aPos');
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		}
		const tex = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const fbo = gl.createFramebuffer()!;
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		st.current = {gl, scene: sceneP, paint: paintP, fbo, tex, locs: new Map([[sceneP, new Map()], [paintP, new Map()]])};
		return () => {
			gl.getExtension('WEBGL_lose_context')?.loseContext();
			st.current = null;
		};
	}, [scene, paint, width, height]);

	useLayoutEffect(() => {
		const s = st.current;
		if (!s) return;
		const {gl} = s;
		const setAll = (p: WebGLProgram) => {
			const m = s.locs.get(p)!;
			const set = (name: string, v: Uniforms[string]) => {
				if (!m.has(name)) m.set(name, gl.getUniformLocation(p, name));
				const l = m.get(name);
				if (!l) return;
				if (typeof v === 'number') gl.uniform1f(l, v);
				else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
				else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
				else gl.uniform4f(l, v[0], v[1], v[2], v[3]);
			};
			set('uRes', [width, height]);
			for (const [k, v] of Object.entries(uniforms)) set(k, v);
		};
		gl.viewport(0, 0, width, height);
		// 第 1 遍：景 → 纹理
		gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo);
		gl.useProgram(s.scene);
		setAll(s.scene);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		// 第 2 遍：笔触 → 画布
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.useProgram(s.paint);
		setAll(s.paint);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, s.tex);
		const ls = gl.getUniformLocation(s.paint, 'uScene');
		gl.uniform1i(ls, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	});

	return <canvas ref={ref} width={width} height={height} style={{width, height, display: 'block', ...style}} />;
};
