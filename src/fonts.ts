import {loadFont as loadCinzel} from '@remotion/google-fonts/Cinzel';
import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadFell} from '@remotion/google-fonts/IMFellEnglish';
import {continueRender, delayRender, staticFile} from 'remotion';

// 中文：思源宋体可变字重（本地文件）
export const SERIF = 'NotoSerifSC';
// 英文标题：罗马碑文风格
export const CINZEL = loadCinzel('normal', {weights: ['400', '600', '700'], subsets: ['latin']}).fontFamily;
// 英文正文：古典衬线斜体
export const CORMORANT = loadCormorant('italic', {weights: ['400', '500'], subsets: ['latin', 'latin-ext']}).fontFamily;

// 《剑与盾》卷轴字幕的英文：IM Fell English（17 世纪铅字的复刻）
export const IM_FELL = loadFell('italic', {weights: ['400'], subsets: ['latin']}).fontFamily;

const handle = delayRender('Loading Noto Serif SC');
const face = new FontFace(SERIF, `url('${staticFile('fonts/NotoSerifSC-VF.ttf')}') format('truetype')`, {
	weight: '200 900',
});

face
	.load()
	.then(() => {
		document.fonts.add(face);
		continueRender(handle);
	})
	.catch((err) => {
		console.error(err);
		continueRender(handle);
	});
