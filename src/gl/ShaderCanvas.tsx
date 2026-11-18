import {useLayoutEffect, useRef} from 'react';

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

type Uniforms = Record<string, number | [number, number] | [number, number, number] | [number, number, number, number]>;

type GLState = {
	gl: WebGL2RenderingContext;
	program: WebGLProgram;
	locations: Map<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, src);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed');
	}
	return shader;
};

/**
 * 全屏片元着色器画布。每一帧在 layout 阶段同步绘制，保证 Remotion 截图时画面已就绪。
 * uRes（像素尺寸）自动注入，其余 uniform 由调用方按帧传入。
 * scale < 1 时以低分辨率绘制再由 CSS 拉伸，适合柔和的星云类效果。
 */
export const ShaderCanvas: React.FC<{
	frag: string;
	uniforms: Uniforms;
	width: number;
	height: number;
	scale?: number;
	style?: React.CSSProperties;
}> = ({frag, uniforms, width, height, scale = 1, style}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const stateRef = useRef<GLState | null>(null);
	const w = Math.round(width * scale);
	const h = Math.round(height * scale);

	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		const gl = canvas.getContext('webgl2', {preserveDrawingBuffer: true, premultipliedAlpha: false})!;
		const program = gl.createProgram()!;
		gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
		gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(gl.getProgramInfoLog(program) ?? 'program link failed');
		}
		// 覆盖全屏的单个三角形
		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const loc = gl.getAttribLocation(program, 'aPos');
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		stateRef.current = {gl, program, locations: new Map()};
		return () => {
			gl.getExtension('WEBGL_lose_context')?.loseContext();
			stateRef.current = null;
		};
	}, [frag]);

	useLayoutEffect(() => {
		const state = stateRef.current;
		if (!state) return;
		const {gl, program, locations} = state;
		const set = (name: string, value: Uniforms[string]) => {
			if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
			const l = locations.get(name);
			if (!l) return;
			if (typeof value === 'number') gl.uniform1f(l, value);
			else if (value.length === 2) gl.uniform2f(l, value[0], value[1]);
			else if (value.length === 3) gl.uniform3f(l, value[0], value[1], value[2]);
			else gl.uniform4f(l, value[0], value[1], value[2], value[3]);
		};
		gl.viewport(0, 0, w, h);
		gl.useProgram(program);
		set('uRes', [w, h]);
		for (const [k, v] of Object.entries(uniforms)) set(k, v);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	});

	return <canvas ref={canvasRef} width={w} height={h} style={{width, height, display: 'block', ...style}} />;
};
