import {useLayoutEffect, useRef} from 'react';

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

export type UniformValue = number | number[];
/** 数组 uniform：名字以 [] 结尾的按 vec4 数组上传，例如 'uPanel[]'；以 [1] 结尾的按 float 数组上传 */
export type Uniforms = Record<string, UniformValue>;

export type DataTex = {name: string; w: number; h: number; data: Uint8Array};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
	const sh = gl.createShader(type)!;
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + (gl.getShaderInfoLog(sh) ?? ''));
	return sh;
};

type State = {gl: WebGL2RenderingContext; prog: WebGLProgram; locs: Map<string, WebGLUniformLocation | null>; texs: {name: string; tex: WebGLTexture}[]};

/**
 * 全屏片元着色器，支持 uniform 数组和整数数据纹理（texelFetch 读取）。每帧在 layout 阶段同步绘制。
 * uRes 自动注入。
 */
export const GLView: React.FC<{
	frag: string;
	uniforms: Uniforms;
	textures?: DataTex[];
	width?: number;
	height?: number;
	scale?: number;
	style?: React.CSSProperties;
}> = ({frag, uniforms, textures = [], width = 1920, height = 1080, scale = 1, style}) => {
	const ref = useRef<HTMLCanvasElement>(null);
	const st = useRef<State | null>(null);
	const w = Math.round(width * scale);
	const h = Math.round(height * scale);

	useLayoutEffect(() => {
		const canvas = ref.current!;
		const gl = canvas.getContext('webgl2', {preserveDrawingBuffer: true, premultipliedAlpha: false})!;
		const prog = gl.createProgram()!;
		gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
		gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
		gl.bindAttribLocation(prog, 0, 'aPos');
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed');
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		const texs = textures.map((t) => {
			const tex = gl.createTexture()!;
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, t.w, t.h, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, t.data);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			return {name: t.name, tex};
		});
		st.current = {gl, prog, locs: new Map(), texs};
		return () => {
			gl.getExtension('WEBGL_lose_context')?.loseContext();
			st.current = null;
		};
		// 纹理内容在一期里固定不变，只随着色器重建
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [frag]);

	useLayoutEffect(() => {
		const s = st.current;
		if (!s) return;
		const {gl, prog, locs} = s;
		const loc = (n: string) => {
			if (!locs.has(n)) locs.set(n, gl.getUniformLocation(prog, n));
			return locs.get(n)!;
		};
		gl.viewport(0, 0, w, h);
		gl.useProgram(prog);
		gl.uniform2f(loc('uRes'), w, h);
		for (const [k, v] of Object.entries(uniforms)) {
			if (k.endsWith('[]')) {
				gl.uniform4fv(loc(k.slice(0, -2)), new Float32Array(v as number[]));
				continue;
			}
			if (k.endsWith('[1]')) {
				gl.uniform1fv(loc(k.slice(0, -3)), new Float32Array(v as number[]));
				continue;
			}
			const l = loc(k);
			if (!l) continue;
			if (typeof v === 'number') gl.uniform1f(l, v);
			else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
			else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
			else gl.uniform4f(l, v[0], v[1], v[2], v[3]);
		}
		s.texs.forEach((t, i) => {
			gl.activeTexture(gl.TEXTURE0 + i);
			gl.bindTexture(gl.TEXTURE_2D, t.tex);
			gl.uniform1i(loc(t.name), i);
		});
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	});

	return <canvas ref={ref} width={w} height={h} style={{width, height, display: 'block', position: 'absolute', left: 0, top: 0, ...style}} />;
};
