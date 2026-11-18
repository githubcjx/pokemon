import {CINZEL, SERIF} from '../fonts';

export const CoverTitle: React.FC<{
	title: string;
	hook: string;
	english: string;
	layout: [number, number, number, number];
}> = ({title, hook, english, layout: [top, size, hookSize, enSize]}) => (
	<div style={{position: 'absolute', left: 0, right: 0, top, textAlign: 'center'}}>
		<div style={{fontFamily: SERIF, fontWeight: 600, fontSize: hookSize, lineHeight: 1.4, letterSpacing: hookSize * 0.12, color: '#f0eeeb', textShadow: '0 2px 12px #000, 0 0 28px #000', whiteSpace: 'nowrap'}}>
			{hook}
		</div>
		<div style={{fontFamily: SERIF, fontWeight: 900, fontSize: size, letterSpacing: size * 0.14, paddingLeft: size * 0.14, lineHeight: 1.15, color: '#fff', textShadow: '0 0 24px rgba(220,217,207,0.35), 0 5px 10px #000', marginTop: size * 0.08, whiteSpace: 'nowrap'}}>
			{title}
		</div>
		<div style={{fontFamily: CINZEL, fontSize: enSize, lineHeight: 1.2, letterSpacing: enSize * 0.6, paddingLeft: enSize * 0.6, color: '#c9c7c6', marginTop: enSize * 0.3}}>
			{english}
		</div>
	</div>
);
