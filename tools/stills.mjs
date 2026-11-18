// 批量截帧自检：只打包一次，按 30fps 帧号截多张图并拼成一张总览。
// 用法：node tools/stills.mjs <合成ID> <输出目录> <30fps 帧号,逗号分隔> [缩放=0.4]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const [, , id, outDir, framesArg, scaleArg] = process.argv;
const frames = framesArg.split(',').map(Number);
const scale = Number(scaleArg ?? 0.4);
fs.mkdirSync(outDir, {recursive: true});

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id, chromiumOptions: {gl: 'angle'}});
for (const f of frames) {
	const output = path.join(outDir, `${id}-${String(f).padStart(5, '0')}.png`);
	await renderStill({serveUrl, composition, output, frame: f * 2, scale, chromiumOptions: {gl: 'angle'}, overwrite: true});
	console.log('done', f);
}
