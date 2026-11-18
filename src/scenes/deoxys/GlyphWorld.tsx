import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile, useVideoConfig} from 'remotion';
import {GlyphEngine, OUT_H, OUT_W, SCENE_H} from './engine';
import {buildAtlas} from './glyphs';
import {Assets, buildFrame, parseFigure} from './world';

const MONO = loadMono('normal', {weights: ['500', '700'], subsets: ['latin', 'greek']});
const ATLAS_CJK = 'DeoxysAtlasSerif';

type Loaded = {assets: Assets; atlas: HTMLCanvasElement};
let loading: Promise<Loaded> | null = null;

const load = (): Promise<Loaded> => {
	if (loading) return loading;
	loading = (async () => {
		const face = new FontFace(ATLAS_CJK, `url('${staticFile('fonts/NotoSerifSC-VF.ttf')}') format('truetype')`, {weight: '200 900'});
		await face.load();
		document.fonts.add(face);
		await MONO.waitUntilDone();
		await document.fonts.load(`500 100px "${MONO.fontFamily}"`);
		const get = async (p: string) => parseFigure(await (await fetch(staticFile(p))).json());
		const [normal, attack, defense, speed, ray] = await Promise.all([
			get('pokemon/deoxys/glyphs-normal.json'),
			get('pokemon/deoxys/glyphs-attack.json'),
			get('pokemon/deoxys/glyphs-defense.json'),
			get('pokemon/deoxys/glyphs-speed.json'),
			get('pokemon/rayquaza/glyphs-mega.json'),
		]);
		return {assets: {normal, attack, defense, speed, ray}, atlas: buildAtlas(MONO.fontFamily, ATLAS_CJK)};
	})();
	return loading;
};

type GlyphWorldProps = {
	frame: number;
	fullBleed?: boolean;
	getFrame?: typeof buildFrame;
};

/** frame 为整期 30fps 时间轴帧号（小数）。 */
export const GlyphWorld: React.FC<GlyphWorldProps> = ({frame, fullBleed = false, getFrame = buildFrame}) => {
	const config = useVideoConfig();
	const width = fullBleed ? config.width : OUT_W;
	const height = fullBleed ? config.height : OUT_H;
	const sceneHeight = fullBleed ? height : SCENE_H;
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<GlyphEngine | null>(null);
	const [data, setData] = useState<Loaded | null>(null);
	const [handle] = useState(() => delayRender('Deoxys glyph world'));
	const continued = useRef(false);

	useEffect(() => {
		load()
			.then((d) => setData(d))
			.catch((e) => cancelRender(e));
	}, []);

	useLayoutEffect(() => {
		if (!data) return;
		engineRef.current = new GlyphEngine(canvasRef.current!, data.atlas, sceneHeight);
		return () => {
			engineRef.current?.dispose();
			engineRef.current = null;
		};
	}, [data, sceneHeight, width]);

	useLayoutEffect(() => {
		if (!data || !engineRef.current) return;
		engineRef.current.render(getFrame(frame, data.assets));
		if (!continued.current) {
			continued.current = true;
			continueRender(handle);
		}
	}, [data, frame, getFrame, handle, sceneHeight, width]);

	return <canvas key={`${width}x${height}/${sceneHeight}`} ref={canvasRef} width={width} height={height} style={{position: 'absolute', inset: 0, width, height, display: 'block'}} />;
};
