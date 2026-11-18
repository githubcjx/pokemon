const W = 1920;
const H = 1080;

const METEOR = 'M-111 10 -87-42 -55-48 -33-76 19-81 43-64 74-54 92-18 75 20 59 38 21 57 -19 65 -43 51 -83 40Z';
const FACETS = [
	['-111,10 -87,-42 -55,-48 -63,4 -83,40', '#83604a'],
	['-55,-48 -33,-76 19,-81 4,-43 -24,-25', '#624d3f'],
	['19,-81 43,-64 74,-54 50,-31 4,-43', '#3b3430'],
	['-63,4 -55,-48 -24,-25 -13,9 -43,51 -83,40', '#4f4137'],
	['-24,-25 4,-43 50,-31 22,-1 -13,9', '#37312e'],
	['50,-31 74,-54 92,-18 75,20 38,17 22,-1', '#292b27'],
	['-43,51 -13,9 22,-1 38,17 21,57 -19,65', '#3a322b'],
	['38,17 75,20 59,38 21,57', '#272725'],
] as const;

export const MeteorRelief: React.FC<{frame: number; opacity: number}> = ({frame, opacity}) => {
	if (opacity <= 0) return null;
	const x = 1435 - frame * 3.44;
	const y = 270 + frame * 1.14;
	return (
		<svg width={W} height={H} style={{position: 'absolute', inset: 0, opacity}}>
			<defs>
				<linearGradient id="meteor-rust" x1="0" y1="1" x2="1" y2="0">
					<stop stopColor="#ffe0a7" stopOpacity=".8" />
					<stop offset=".23" stopColor="#d58259" stopOpacity=".68" />
					<stop offset="1" stopColor="#954d3c" stopOpacity="0" />
				</linearGradient>
				<radialGradient id="meteor-halo">
					<stop stopColor="#e19267" stopOpacity=".27" />
					<stop offset="1" stopColor="#c86945" stopOpacity="0" />
				</radialGradient>
				<clipPath id="meteor-outline"><path d={METEOR} /></clipPath>
				<filter id="meteor-grit" x="0%" y="0%" width="100%" height="100%">
					<feTurbulence type="fractalNoise" baseFrequency=".091 .22" numOctaves="3" seed="47" />
					<feColorMatrix type="saturate" values="0" />
				</filter>
			</defs>
			<g transform={`translate(${x} ${y})`}>
				<ellipse cx={-45} cy={6} rx={262} ry={145} fill="url(#meteor-halo)" transform="rotate(-20)" />
				<path d="M-106 15 C69-70 197-67 653-232 C428-121 256-41 73 7 Q-22 42-106 15Z" fill="url(#meteor-rust)" opacity=".62" />
				<path d="M-97 33 C76 26 262-48 717-193" fill="none" stroke="url(#meteor-rust)" strokeWidth="3.5" opacity=".61" />
				<path d="M-66-39 C111-123 249-129 554-259" fill="none" stroke="url(#meteor-rust)" strokeWidth="1.7" opacity=".62" />
				<path d="M-54 45 C115 27 257-1 484-95 M2-60 Q205-122 434-191" fill="none" stroke="#d9a575" strokeDasharray="28 15 3 14 11 26" opacity=".29" />
				{Array.from({length: 38}, (_, i) => {
					const drift = ((i * 37 + frame * (1.55 + i % 3 * .19)) % 577) / 577;
					const scatter = Math.sin(i * 34.12) * (16 + drift * 35);
					const px = -52 + drift * 720;
					const py = 12 - drift * 250 + scatter;
					return <path key={i} d={`M${px} ${py} l${2 + i % 6} -${1 + i % 3}`} stroke={i % 3 === 0 ? '#f4cc91' : '#bb795a'} strokeWidth={.7 + (i % 4) * .44} opacity={(1 - drift) * .59} />;
				})}
				<g transform={`rotate(${-11 + frame * .12}) scale(1.11)`}>
					<path d={METEOR} fill="#38302a" stroke="#241d18" strokeWidth="3.7" />
					<g clipPath="url(#meteor-outline)">
						{FACETS.map(([points, fill]) => <polygon key={points} points={points} fill={fill} />)}
						<rect x="-113" y="-85" width="208" height="156" filter="url(#meteor-grit)" opacity=".61" style={{mixBlendMode: 'soft-light'}} />
						<path d="M-102 9 -84-4 -71-2 -56-24 -34-30 -17-54 M-84 36 -57 26 -53 9 -42 0 -27-2 1-22 M-34 53 -19 40 -12 29 2 24 13 9 38 1 M31-72 25-58 40-44 57-45 74-26" stroke="#b58359" fill="none" strokeWidth="1.65" opacity=".72" />
						<path d="M-86-42 -54-47 -35-76 18-80 M-111 10 -87-41 M-109 12 -93 34 -70 45 -46 51" fill="none" stroke="#d59a70" strokeWidth="4" opacity=".82" />
						<path d="M-98 2 -85-24 M-85-38 -70-41 M-47-51 -34-69 M-99 24 -92 29 -82 35" fill="none" stroke="#f3bf83" strokeWidth="2.3" />
					</g>
				</g>
			</g>
		</svg>
	);
};

const FACE = 'M467 590 682 530 693 622 706 705 699 763 725 856 749 1090 470 1090Z';
const SIDE = 'M349 539 467 590 470 1090 270 1090 301 937 312 876 313 822 332 754Z';

export const PillarRelief: React.FC = () => (
	<svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
		<defs>
			<linearGradient id="pillar-side" x2=".95" y2=".4">
				<stop stopColor="#171e1c" />
				<stop offset="1" stopColor="#363933" />
			</linearGradient>
			<linearGradient id="pillar-front" x1=".05" x2="1" y2=".5">
				<stop stopColor="#2a302b" />
				<stop offset=".6" stopColor="#44483b" />
				<stop offset="1" stopColor="#565645" />
			</linearGradient>
			<linearGradient id="pillar-roof" x1=".15" y1="1" x2=".8" y2="0">
				<stop stopColor="#595746" />
				<stop offset=".56" stopColor="#787661" />
				<stop offset="1" stopColor="#93917b" />
			</linearGradient>
			<filter id="pillar-mineral" x="0%" y="0%" width="100%" height="100%">
				<feTurbulence type="fractalNoise" baseFrequency=".056 .15" numOctaves="4" seed="33" />
				<feColorMatrix type="saturate" values="0" />
			</filter>
			<clipPath id="pillar-wall"><path d={FACE} /><path d={SIDE} /></clipPath>
			<clipPath id="pillar-top"><path d="M342 540 525 479 691 526 467 591Z" /></clipPath>
		</defs>
		<path d={SIDE} fill="url(#pillar-side)" stroke="#171f1b" strokeWidth="4" />
		<path d={FACE} fill="url(#pillar-front)" stroke="#242923" strokeWidth="5" />
		<g clipPath="url(#pillar-wall)">
			{Array.from({length: 13}, (_, i) => {
				const y = 606 + i * 43;
				const leftJoint = 366 + Math.sin(i * 2.2) * 27;
				const rightJoint = 588 + Math.cos(i * 2.6) * 46;
				const path = `M250 ${y - 62} L466 ${y} L776 ${y - 73}`;
				return (
					<g key={i}>
						<path d={path} stroke="#111813" strokeWidth={i % 4 === 3 ? 11 : 4} fill="none" opacity=".75" />
						<path d={path} stroke="#b4a786" strokeWidth="1.5" transform="translate(0 3.5)" fill="none" opacity=".28" />
						<path d={`M${leftJoint} ${y - 26} l-2 45 M${rightJoint} ${y - 29} l4 42`} stroke="#171c17" fill="none" strokeWidth="2.7" opacity=".64" />
					</g>
				);
			})}
			<path d="M468 602 470 1090 M490 590 494 1090" stroke="#b3a785" fill="none" strokeWidth="3" opacity=".33" />
			<path d="M676 622 639 651 634 681 619 706 625 718 610 745 M386 728 369 750 371 777 358 791 361 825 M695 816 664 829 657 865 640 884 643 920" fill="none" stroke="#181e19" strokeWidth="3" opacity=".75" />
			<path d="M532 663 619 642 625 666 531 688Z M542 857 646 831 654 856 544 882Z" fill="#1f2922" stroke="#8b8169" strokeWidth="1.2" opacity=".7" />
			<path d="M550 667 609 653 M550 675 612 660 M560 862 641 842 M561 871 644 851" stroke="#9a8e70" strokeWidth="1.5" strokeDasharray="7 6 2 7 5 7" opacity=".62" />
			<rect x="267" y="528" width="494" height="565" filter="url(#pillar-mineral)" style={{mixBlendMode: 'soft-light'}} opacity=".41" />
		</g>
		<path d="M342 540 525 479 691 526 467 591Z" fill="url(#pillar-roof)" stroke="#a79d7c" strokeWidth="2.3" />
		<g clipPath="url(#pillar-top)">
			<path d="M358 548 535 491 676 531 468 583Z M397 548 530 502 644 532 476 575Z" fill="none" stroke="#312e25" strokeWidth="3.3" opacity=".82" />
			<path d="M442 543 557 519 570 553Z M474 541 548 528 555 547Z" fill="none" stroke="#e2c897" strokeWidth="2.2" opacity=".49" />
			<path d="M386 550 400 552 413 546 420 546 425 536 M615 537 609 529 580 528 569 518 552 513 M477 590 480 581 493 580 510 560" fill="none" stroke="#35372d" strokeWidth="2" opacity=".8" />
			<rect x="342" y="479" width="349" height="112" filter="url(#pillar-mineral)" style={{mixBlendMode: 'soft-light'}} opacity=".37" />
		</g>
		<path d="M342 540 467 591 691 526 687 544 468 610 340 556Z" fill="#4d5042" stroke="#282e25" strokeWidth="2" />
		<path d="M344 541 468 591 689 527 M343 553 467 605 685 542" fill="none" stroke="#ad9f80" strokeWidth="1.6" opacity=".71" />
		<path d="M354 538 355 514 365 506 378 509 380 530 370 537Z M666 530 666 501 674 494 687 500 689 526Z M514 482 514 460 525 453 537 457 537 484Z" fill="#41483b" stroke="#827d63" strokeWidth="2.2" />
	</svg>
);
