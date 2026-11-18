import {COMPOSITE_FRAG, DOWN_FRAG, ENV_FRAG, ENV_VERT, PARTICLE_FRAG, PARTICLE_VERT, QUAD_VERT, UP_FRAG} from './shaders';

// 画面内的 2.39:1 遮幅区域
export const OUT_W = 1920;
export const OUT_H = 1080;
export const SCENE_W = 1920;
export const SCENE_H = 804;

/** 每个字符粒子 14 个浮点：位置 xyz、字号（世界单位）、速度 xyz（拖尾方向）、字形下标、颜色 rgb、亮度、失焦、拖尾倍数 */
export const STRIDE = 14;

export type Camera = {pos: [number, number, number]; yaw: number; pitch: number; fov: number};

export type Env = {
	time: number;
	seaAmt: number;
	seaY: number;
	starAmt: number;
	spaceAmt: number;
	auroraAmt: number;
	auroraWarm: number;
	dustAmt: number;
	dustOff: [number, number];
	skyWarm: number;
	flash: number;
	l0Pos: [number, number, number];
	l0Col: [number, number, number];
	l1Pos: [number, number, number];
	l1Col: [number, number, number];
	planetAmt: number;
	planetC: [number, number, number];
	planetR: number;
	limbAurora: number;
	wave: number;
};

export type Post = {threshold: number; bloom: number; exposure: number; glitch: number; aberr: number; vignette: number; fade: number; focus: number; dofK: number};

export type FrameData = {cam: Camera; env: Env; post: Post; particles: Float32Array; count: number};

export const cameraBasis = (cam: Camera) => {
	const cp = Math.cos(cam.pitch);
	const f: [number, number, number] = [Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp];
	const r: [number, number, number] = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
	const u: [number, number, number] = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
	return {f, r, u, tanH: Math.tan(cam.fov / 2), aspect: SCENE_W / SCENE_H};
};

type Prog = {p: WebGLProgram; loc: Map<string, WebGLUniformLocation | null>};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
	const s = gl.createShader(type)!;
	gl.shaderSource(s, src);
	gl.compileShader(s);
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'compile failed');
	return s;
};

type Target = {fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number};

export class GlyphEngine {
	private gl: WebGL2RenderingContext;
	private env: Prog;
	private part: Prog;
	private down: Prog;
	private up: Prog;
	private comp: Prog;
	private quadVao: WebGLVertexArrayObject;
	private partVao: WebGLVertexArrayObject;
	private instBuf: WebGLBuffer;
	private instCap = 0;
	private atlas: WebGLTexture;
	private scene: Target;
	private levels: Target[] = [];

	constructor(canvas: HTMLCanvasElement, atlasCanvas: HTMLCanvasElement, sceneHeight = SCENE_H) {
		const gl = canvas.getContext('webgl2', {preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: false})!;
		this.gl = gl;
		const half = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
		const mk = (vs: string, fs: string): Prog => {
			const p = gl.createProgram()!;
			gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
			gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
			gl.bindAttribLocation(p, 0, 'aPos');
			gl.bindAttribLocation(p, 0, 'aCorner');
			gl.linkProgram(p);
			if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link failed');
			return {p, loc: new Map()};
		};
		this.env = mk(ENV_VERT, ENV_FRAG);
		this.part = mk(PARTICLE_VERT, PARTICLE_FRAG);
		this.down = mk(QUAD_VERT, DOWN_FRAG);
		this.up = mk(QUAD_VERT, UP_FRAG);
		this.comp = mk(QUAD_VERT, COMPOSITE_FRAG);

		// 全屏三角形
		this.quadVao = gl.createVertexArray()!;
		gl.bindVertexArray(this.quadVao);
		const qb = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, qb);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

		// 粒子：一个四边形 × 实例
		this.partVao = gl.createVertexArray()!;
		gl.bindVertexArray(this.partVao);
		const cb = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, cb);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		this.instBuf = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
		const attrs: [string, number, number][] = [
			['iPosSize', 4, 0],
			['iVelGlyph', 4, 4],
			['iCol', 4, 8],
			['iMisc', 2, 12],
		];
		for (const [name, n, off] of attrs) {
			const l = gl.getAttribLocation(this.part.p, name);
			if (l < 0) continue;
			gl.enableVertexAttribArray(l);
			gl.vertexAttribPointer(l, n, gl.FLOAT, false, STRIDE * 4, off * 4);
			gl.vertexAttribDivisor(l, 1);
		}
		gl.bindVertexArray(null);

		// 字形图集（带 mipmap，远处的字自然融成纹理）
		this.atlas = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, this.atlas);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
		if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);

		const target = (w: number, h: number): Target => {
			const tex = gl.createTexture()!;
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texImage2D(gl.TEXTURE_2D, 0, half ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			const fb = gl.createFramebuffer()!;
			gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
			return {fb, tex, w, h};
		};
		this.scene = target(canvas.width, sceneHeight);
		let w = this.scene.w;
		let h = this.scene.h;
		for (let i = 0; i < 6; i++) {
			w = Math.max(1, Math.round(w / 2));
			h = Math.max(1, Math.round(h / 2));
			this.levels.push(target(w, h));
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	private set(prog: Prog, name: string, v: number | number[]) {
		const gl = this.gl;
		if (!prog.loc.has(name)) prog.loc.set(name, gl.getUniformLocation(prog.p, name));
		const l = prog.loc.get(name);
		if (!l) return;
		if (typeof v === 'number') gl.uniform1f(l, v);
		else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
		else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
	}

	private camUniforms(prog: Prog, cam: Camera) {
		const b = cameraBasis(cam);
		this.set(prog, 'uCamPos', cam.pos);
		this.set(prog, 'uCamF', b.f);
		this.set(prog, 'uCamR', b.r);
		this.set(prog, 'uCamU', b.u);
		this.set(prog, 'uTanH', b.tanH);
		this.set(prog, 'uAspect', this.scene.w / this.scene.h);
		const gl = this.gl;
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.atlas);
		const l = gl.getUniformLocation(prog.p, 'uAtlas');
		if (l) gl.uniform1i(l, 0);
	}

	private bindTex(prog: Prog, name: string, tex: WebGLTexture, unit: number) {
		const gl = this.gl;
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, tex);
		const l = gl.getUniformLocation(prog.p, name);
		if (l) gl.uniform1i(l, unit);
	}

	render(d: FrameData) {
		const gl = this.gl;
		const {env, post, cam} = d;
		const {w, h} = this.scene;
		const outW = gl.drawingBufferWidth;
		const outH = gl.drawingBufferHeight;
		const band = (outH - h) / 2;

		// 1. 环境
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
		gl.viewport(0, 0, w, h);
		gl.disable(gl.BLEND);
		gl.useProgram(this.env.p);
		this.camUniforms(this.env, cam);
		this.set(this.env, 'uRes', [w, h]);
		this.set(this.env, 'uTime', env.time);
		this.set(this.env, 'uSeaAmt', env.seaAmt);
		this.set(this.env, 'uSeaY', env.seaY);
		this.set(this.env, 'uStarAmt', env.starAmt);
		this.set(this.env, 'uSpaceAmt', env.spaceAmt);
		this.set(this.env, 'uAuroraAmt', env.auroraAmt);
		this.set(this.env, 'uAuroraWarm', env.auroraWarm);
		this.set(this.env, 'uDustAmt', env.dustAmt);
		this.set(this.env, 'uDustOff', env.dustOff);
		this.set(this.env, 'uSkyWarm', env.skyWarm);
		this.set(this.env, 'uFlash', env.flash);
		this.set(this.env, 'uL0Pos', env.l0Pos);
		this.set(this.env, 'uL0Col', env.l0Col);
		this.set(this.env, 'uL1Pos', env.l1Pos);
		this.set(this.env, 'uL1Col', env.l1Col);
		this.set(this.env, 'uPlanetAmt', env.planetAmt);
		this.set(this.env, 'uPlanetC', env.planetC);
		this.set(this.env, 'uPlanetR', env.planetR);
		this.set(this.env, 'uLimbAurora', env.limbAurora);
		this.set(this.env, 'uWave', env.wave);
		gl.bindVertexArray(this.quadVao);
		gl.drawArrays(gl.TRIANGLES, 0, 3);

		// 2. 字符粒子（叠加混合，与绘制顺序无关）
		if (d.count > 0) {
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.useProgram(this.part.p);
			this.camUniforms(this.part, cam);
			this.set(this.part, 'uRes', [w, h]);
			this.set(this.part, 'uFocus', post.focus);
			this.set(this.part, 'uDofK', post.dofK);
			gl.bindVertexArray(this.partVao);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
			const bytes = d.count * STRIDE * 4;
			if (bytes > this.instCap) {
				this.instCap = Math.max(bytes, this.instCap * 2);
				gl.bufferData(gl.ARRAY_BUFFER, this.instCap, gl.DYNAMIC_DRAW);
			}
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.particles, 0, d.count * STRIDE);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, d.count);
			gl.disable(gl.BLEND);
		}

		// 3. 泛光：逐级降采样，再帐篷滤波逐级叠回
		gl.bindVertexArray(this.quadVao);
		gl.useProgram(this.down.p);
		let src: Target = this.scene;
		for (const lv of this.levels) {
			this.set(this.down, 'uThresh', src === this.scene ? post.threshold : 0);
			gl.bindFramebuffer(gl.FRAMEBUFFER, lv.fb);
			gl.viewport(0, 0, lv.w, lv.h);
			this.bindTex(this.down, 'uSrc', src.tex, 0);
			this.set(this.down, 'uTexel', [1 / src.w, 1 / src.h]);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			src = lv;
		}
		gl.useProgram(this.up.p);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE);
		for (let i = this.levels.length - 1; i > 0; i--) {
			const from = this.levels[i];
			const to = this.levels[i - 1];
			gl.bindFramebuffer(gl.FRAMEBUFFER, to.fb);
			gl.viewport(0, 0, to.w, to.h);
			this.bindTex(this.up, 'uSrc', from.tex, 0);
			this.set(this.up, 'uTexel', [1 / from.w, 1 / from.h]);
			this.set(this.up, 'uWeight', 0.85);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		}
		gl.disable(gl.BLEND);

		// 4. 合成到画布：遮幅、色调映射、暗角、色散、偶发切片故障
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, outW, outH);
		gl.useProgram(this.comp.p);
		this.bindTex(this.comp, 'uScene', this.scene.tex, 0);
		this.bindTex(this.comp, 'uBloom', this.levels[0].tex, 1);
		this.set(this.comp, 'uOut', [outW, outH]);
		this.set(this.comp, 'uBand0', band);
		this.set(this.comp, 'uBand1', band + h);
		this.set(this.comp, 'uBloomAmt', post.bloom);
		this.set(this.comp, 'uExposure', post.exposure);
		this.set(this.comp, 'uGlitch', post.glitch);
		this.set(this.comp, 'uAberr', post.aberr);
		this.set(this.comp, 'uVignette', post.vignette);
		this.set(this.comp, 'uFade', post.fade);
		this.set(this.comp, 'uTime', env.time);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	dispose() {
		this.gl.getExtension('WEBGL_lose_context')?.loseContext();
	}
}
