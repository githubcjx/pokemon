import {Composition, Still} from 'remotion';
import {FPS, toFrames} from './time';
import {SUBTITLE_TEST_FRAMES, SubtitleTest} from './scenes/test/SubtitleTest';
import {STATUE_TEST_FRAMES, StatueTest} from './scenes/test/StatueTest';
import {ARCEUS_SCENE_FRAMES, ArceusScene} from './scenes/ep01/ArceusScene';
import {Ep01CoverPortrait, Ep01CoverStandard, Ep01CoverWide} from './scenes/ep01/Cover';
import {TWINS_SCENE_FRAMES, TwinsScene} from './scenes/ep01/TwinsScene';
import {EPISODE01_FRAMES, Episode01} from './scenes/ep01/Episode01';
import {ENDING_SCENE_FRAMES, EndingScene} from './scenes/ep01/EndingScene';
import {GIRATINA_SCENE_FRAMES, GiratinaScene} from './scenes/ep01/GiratinaScene';
import {LAKE_TRIO_SCENE_FRAMES, LakeTrioScene} from './scenes/ep01/LakeTrioScene';
import {EPISODE02_FRAMES, Episode02} from './scenes/ep02/Episode02';
import {Ep02CoverPortrait, Ep02CoverStandard, Ep02CoverWide} from './scenes/ep02/Cover';
import {PRIMAL_SCENE_FRAMES, PrimalScene} from './scenes/ep02/PrimalScene';
import {CLASH_SCENE_FRAMES, ClashScene} from './scenes/ep02/ClashScene';
import {RAYQUAZA_SCENE_FRAMES, RayquazaScene} from './scenes/ep02/RayquazaScene';
import {SLEEP_SCENE_FRAMES, SleepScene} from './scenes/ep02/SleepScene';
import {CONTINENT_SCENE_FRAMES, ContinentScene} from './scenes/ep02/ContinentScene';
import {ENDING2_SCENE_FRAMES, EndingScene as Ending2Scene} from './scenes/ep02/EndingScene';
import {ART3D_TEST_FRAMES, Art3DTest, Art3DTestSolo} from './scenes/test/Art3DTest';
import {INK_TEST_FRAMES, InkTest} from './scenes/test/InkTest';
import {TOWER3D_TEST_FRAMES, Tower3DTest} from './scenes/test/Tower3DTest';
import {RUINS_SCENE_FRAMES, RuinsScene} from './scenes/tower/RuinsScene';
import {TWIN_SCENE_FRAMES, TwinScene} from './scenes/tower/TwinScene';
import {FIRE_SCENE_FRAMES, FireScene} from './scenes/tower/FireScene';
import {REBIRTH_SCENE_FRAMES, RebirthScene} from './scenes/tower/RebirthScene';
import {FEAR_SCENE_FRAMES, FearScene} from './scenes/tower/FearScene';
import {WAIT_SCENE_FRAMES, WaitScene} from './scenes/tower/WaitScene';
import {DESCEND_SCENE_FRAMES, DescendScene} from './scenes/tower/DescendScene';
import {TowerCoverPortrait, TowerCoverStandard, TowerCoverWide} from './scenes/tower/Cover';
import {MIRAGE_SCENE_FRAMES, MirageScene} from './scenes/ep03/MirageScene';
import {ANCESTOR_SCENE_FRAMES, AncestorScene} from './scenes/ep03/AncestorScene';
import {DIARY_SCENE_FRAMES, DiaryScene} from './scenes/ep03/DiaryScene';
import {RAMPAGE_SCENE_FRAMES, RampageScene} from './scenes/ep03/RampageScene';
import {CREATED_SCENE_FRAMES, CreatedScene} from './scenes/ep03/CreatedScene';
import {BATTLE_SCENE_FRAMES, BattleScene} from './scenes/ep03/BattleScene';
import {FATES_SCENE_FRAMES, FatesScene} from './scenes/ep03/FatesScene';
import {CREDITS_SCENE_FRAMES, CreditsScene} from './scenes/ep03/CreditsScene';
import {EPISODE03_FRAMES, Episode03} from './scenes/ep03/Episode03';
import {Ep03CoverPortrait, Ep03CoverStandard, Ep03CoverWide} from './scenes/ep03/Cover';
import {GLYPH_SCENE_FRAMES, GlyphScene} from './scenes/unown/GlyphScene';
import {CLAN_SCENE_FRAMES, ClanScene} from './scenes/unown/ClanScene';
import {DEPART_SCENE_FRAMES, DepartScene} from './scenes/unown/DepartScene';
import {WORDS_SCENE_FRAMES, WordsScene} from './scenes/unown/WordsScene';
import {JOURNEY_SCENE_FRAMES, JourneyScene} from './scenes/unown/JourneyScene';
import {STAGE_SCENE_FRAMES, StageScene} from './scenes/unown/StageScene';
import {END_SCENE_FRAMES, EndScene} from './scenes/unown/EndScene';
import {UnownCoverPortrait, UnownCoverStandard, UnownCoverWide} from './scenes/unown/Cover';
import {HOOK_SCENE_FRAMES, HookScene} from './scenes/dragons/HookScene';
import {FOUNDING_SCENE_FRAMES, FoundingScene} from './scenes/dragons/FoundingScene';
import {SPLIT_SCENE_FRAMES, SplitScene} from './scenes/dragons/SplitScene';
import {DRAGONS_PART1_FRAMES, DragonsPart1} from './scenes/dragons/Part1';
import {WAR_SCENE_FRAMES, WarScene} from './scenes/dragons/WarScene';
import {HUSK_SCENE_FRAMES, HuskScene} from './scenes/dragons/HuskScene';
import {DRAGONS_PART2_FRAMES, DragonsPart2} from './scenes/dragons/Part2';
import {REVIVAL_SCENE_FRAMES, RevivalScene} from './scenes/dragons/RevivalScene';
import {FUSION_SCENE_FRAMES, FusionScene} from './scenes/dragons/FusionScene';
import {CODA_SCENE_FRAMES, CodaScene} from './scenes/dragons/CodaScene';
import {DRAGONS_PART3_FRAMES, DragonsPart3} from './scenes/dragons/Part3';
import {CoverLandscape, CoverPortrait} from './scenes/dragons/Cover';
import {HOOK_SCENE_FRAMES as ETERNAL_HOOK_FRAMES, HookScene as EternalHookScene} from './scenes/eternal/HookScene';
import {GIFT_SCENE_FRAMES, GiftScene} from './scenes/eternal/GiftScene';
import {WAR_SCENE_FRAMES as ETERNAL_WAR_FRAMES, WarScene as EternalWarScene} from './scenes/eternal/WarScene';
import {ETERNAL_PART1_FRAMES, EternalPart1} from './scenes/eternal/Part1';
import {WEAPON_SCENE_FRAMES, WeaponScene} from './scenes/eternal/WeaponScene';
import {LEAVE_SCENE_FRAMES, LeaveScene} from './scenes/eternal/LeaveScene';
import {AGES_SCENE_FRAMES, AgesScene} from './scenes/eternal/AgesScene';
import {ETERNAL_PART2_FRAMES, EternalPart2} from './scenes/eternal/Part2';
import {REUNION_SCENE_FRAMES, ReunionScene} from './scenes/eternal/ReunionScene';
import {HOTEL_SCENE_FRAMES, HotelScene} from './scenes/eternal/HotelScene';
import {CODA_SCENE_FRAMES as ETERNAL_CODA_FRAMES, CodaScene as EternalCodaScene} from './scenes/eternal/CodaScene';
import {ETERNAL_PART3_FRAMES, EternalPart3} from './scenes/eternal/Part3';
import {HOOK_SCENE_FRAMES as NEC_HOOK_FRAMES, HookScene as NecHookScene} from './scenes/necrozma/HookScene';
import {RADIANCE_SCENE_FRAMES as NEC_RADIANCE_FRAMES, RadianceScene as NecRadianceScene} from './scenes/necrozma/RadianceScene';
import {GREED_SCENE_FRAMES as NEC_GREED_FRAMES, GreedScene as NecGreedScene} from './scenes/necrozma/GreedScene';
import {DARK_SCENE_FRAMES as NEC_DARK_FRAMES, DarkScene as NecDarkScene} from './scenes/necrozma/DarkScene';
import {TOWER_SCENE_FRAMES as NEC_TOWER_FRAMES, TowerScene as NecTowerScene} from './scenes/necrozma/TowerScene';
import {BOOK_SCENE_FRAMES as NEC_BOOK_FRAMES, BookScene as NecBookScene} from './scenes/necrozma/BookScene';
import {RETURN_SCENE_FRAMES as NEC_RETURN_FRAMES, ReturnScene as NecReturnScene} from './scenes/necrozma/ReturnScene';
import {BURST_SCENE_FRAMES as NEC_BURST_FRAMES, BurstScene as NecBurstScene} from './scenes/necrozma/BurstScene';
import {CODA_SCENE_FRAMES as NEC_CODA_FRAMES, CodaScene as NecCodaScene} from './scenes/necrozma/CodaScene';
import {NECROZMA_PART1_FRAMES, NECROZMA_PART2_FRAMES, NECROZMA_PART3_FRAMES, NECROZMA_TOTAL_FRAMES, NecrozmaEpisode, NecrozmaPart1, NecrozmaPart2, NecrozmaPart3} from './scenes/necrozma/Parts';
import {POKEBALL_PARTS, POKEBALL_SEGMENTS} from './scenes/pokeball/Segments';
import {REGI_SEGMENTS} from './scenes/regi/Segments';
import {HISUI_SEGMENTS} from './scenes/hisui/Segments';
import {TIME_PARTS, TIME_SEGMENTS} from './scenes/time/Segments';
import {SPACE_PARTS, SPACE_SEGMENTS} from './scenes/space/Segments';
import {ReverseCoverPortrait, ReverseCoverStandard, ReverseCoverWide} from './scenes/reverse/Cover';
import {REVERSE_PARTS, REVERSE_SEGMENTS} from './scenes/reverse/Segments';
import {WISH_PARTS, WISH_SEGMENTS} from './scenes/wish/Segments';
import {DeoxysCover} from './scenes/deoxys/Cover';
import {DEOXYS_SEGMENTS, DEOXYS_TOTAL_FRAMES, DeoxysEpisode} from './scenes/deoxys/Episode';
import {OPENING_SCENE_FRAMES as XERNEAS_OPENING_FRAMES, OpeningScene as XerneasOpeningScene} from './scenes/xerneas/OpeningScene';
import {MIDDLE_SCENE_FRAMES as XERNEAS_MIDDLE_FRAMES, MiddleScene as XerneasMiddleScene} from './scenes/xerneas/MiddleScene';
import {ENDING_SCENE_FRAMES as XERNEAS_ENDING_FRAMES, EndingScene as XerneasEndingScene} from './scenes/xerneas/EndingScene';
import {XERNEAS_EPISODE_FRAMES, XerneasEpisode} from './scenes/xerneas/Episode';
import {HOOK_SCENE_FRAMES as GALAR_HOOK_FRAMES, HookScene as GalarHookScene} from './scenes/galar/HookScene';
import {GALAR_EPISODE_FRAMES, GalarEpisode} from './scenes/galar/Episode';
import {STAR_SCENE_FRAMES, StarScene as GalarStarScene} from './scenes/galar/StarScene';
import {NIGHT_SCENE_FRAMES, NightScene as GalarNightScene} from './scenes/galar/NightScene';
import {SpaceCoverPortrait, SpaceCoverStandard, SpaceCoverWide} from './scenes/space/Cover';
import {CoverLandscape as NecCoverLandscape, CoverPortrait as NecCoverPortrait} from './scenes/necrozma/Cover';
import {PokeballCoverPortrait, PokeballCoverStandard, PokeballCoverWide} from './scenes/pokeball/Cover';
import {RegiCoverPortrait, RegiCoverStandard, RegiCoverWide} from './scenes/regi/Cover';

const VIDEO = {fps: FPS, width: 1920, height: 1080};

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition id="EP01" component={Episode01} durationInFrames={toFrames(EPISODE01_FRAMES)} {...VIDEO} />
			<Composition id="EP01-Arceus" component={ArceusScene} durationInFrames={toFrames(ARCEUS_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP01-Twins" component={TwinsScene} durationInFrames={toFrames(TWINS_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP01-Giratina" component={GiratinaScene} durationInFrames={toFrames(GIRATINA_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP01-LakeTrio" component={LakeTrioScene} durationInFrames={toFrames(LAKE_TRIO_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP01-Ending" component={EndingScene} durationInFrames={toFrames(ENDING_SCENE_FRAMES)} {...VIDEO} />
			<Still id="EP01-Cover-16x9" component={Ep01CoverWide} width={1920} height={1080} />
			<Still id="EP01-Cover-4x3" component={Ep01CoverStandard} width={1440} height={1080} />
			<Still id="EP01-Cover-3x4" component={Ep01CoverPortrait} width={1080} height={1440} />
			<Composition id="EP02" component={Episode02} durationInFrames={toFrames(EPISODE02_FRAMES)} {...VIDEO} />
			<Composition id="EP02-Primal" component={PrimalScene} durationInFrames={toFrames(PRIMAL_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP02-Clash" component={ClashScene} durationInFrames={toFrames(CLASH_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP02-Rayquaza" component={RayquazaScene} durationInFrames={toFrames(RAYQUAZA_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP02-Sleep" component={SleepScene} durationInFrames={toFrames(SLEEP_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP02-Continent" component={ContinentScene} durationInFrames={toFrames(CONTINENT_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP02-Ending" component={Ending2Scene} durationInFrames={toFrames(ENDING2_SCENE_FRAMES)} {...VIDEO} />
			<Still id="EP02-Cover-16x9" component={Ep02CoverWide} width={1920} height={1080} />
			<Still id="EP02-Cover-4x3" component={Ep02CoverStandard} width={1440} height={1080} />
			<Still id="EP02-Cover-3x4" component={Ep02CoverPortrait} width={1080} height={1440} />
			<Composition id="EP03-Mirage" component={MirageScene} durationInFrames={toFrames(MIRAGE_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP03-Ancestor" component={AncestorScene} durationInFrames={toFrames(ANCESTOR_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP03-Diary" component={DiaryScene} durationInFrames={toFrames(DIARY_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP03-Rampage" component={RampageScene} durationInFrames={toFrames(RAMPAGE_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP03-Created" component={CreatedScene} durationInFrames={toFrames(CREATED_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP03-Battle" component={BattleScene} durationInFrames={toFrames(BATTLE_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP03-Fates" component={FatesScene} durationInFrames={toFrames(FATES_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP03-Credits" component={CreditsScene} durationInFrames={toFrames(CREDITS_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="EP03" component={Episode03} durationInFrames={toFrames(EPISODE03_FRAMES)} {...VIDEO} />
			<Still id="EP03-Cover-16x9" component={Ep03CoverWide} width={1920} height={1080} />
			<Still id="EP03-Cover-4x3" component={Ep03CoverStandard} width={1440} height={1080} />
			<Still id="EP03-Cover-3x4" component={Ep03CoverPortrait} width={1080} height={1440} />
			<Composition id="TOWER-Ruins" component={RuinsScene} durationInFrames={toFrames(RUINS_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="TOWER-Twin" component={TwinScene} durationInFrames={toFrames(TWIN_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="TOWER-Fire" component={FireScene} durationInFrames={toFrames(FIRE_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="TOWER-Rebirth" component={RebirthScene} durationInFrames={toFrames(REBIRTH_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="TOWER-Fear" component={FearScene} durationInFrames={toFrames(FEAR_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="TOWER-Wait" component={WaitScene} durationInFrames={toFrames(WAIT_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="TOWER-Descend" component={DescendScene} durationInFrames={toFrames(DESCEND_SCENE_FRAMES)} {...VIDEO} />
			<Still id="TOWER-Cover-16x9" component={TowerCoverWide} width={1920} height={1080} />
			<Still id="TOWER-Cover-4x3" component={TowerCoverStandard} width={1440} height={1080} />
			<Still id="TOWER-Cover-3x4" component={TowerCoverPortrait} width={1080} height={1440} />
			<Composition id="UNOWN-Glyph" component={GlyphScene} durationInFrames={toFrames(GLYPH_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="UNOWN-Clan" component={ClanScene} durationInFrames={toFrames(CLAN_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="UNOWN-Depart" component={DepartScene} durationInFrames={toFrames(DEPART_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="UNOWN-Words" component={WordsScene} durationInFrames={toFrames(WORDS_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="UNOWN-Journey" component={JourneyScene} durationInFrames={toFrames(JOURNEY_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="UNOWN-Stage" component={StageScene} durationInFrames={toFrames(STAGE_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="UNOWN-End" component={EndScene} durationInFrames={toFrames(END_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="DRAGONS-Hook" component={HookScene} durationInFrames={toFrames(HOOK_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="DRAGONS-Founding" component={FoundingScene} durationInFrames={toFrames(FOUNDING_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="DRAGONS-Split" component={SplitScene} durationInFrames={toFrames(SPLIT_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="DRAGONS-Part1" component={DragonsPart1} durationInFrames={toFrames(DRAGONS_PART1_FRAMES)} {...VIDEO} />
			<Composition id="DRAGONS-War" component={WarScene} durationInFrames={toFrames(WAR_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="DRAGONS-Husk" component={HuskScene} durationInFrames={toFrames(HUSK_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="DRAGONS-Part2" component={DragonsPart2} durationInFrames={toFrames(DRAGONS_PART2_FRAMES)} {...VIDEO} />
			<Composition id="DRAGONS-Revival" component={RevivalScene} durationInFrames={toFrames(REVIVAL_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="DRAGONS-Fusion" component={FusionScene} durationInFrames={toFrames(FUSION_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="DRAGONS-Coda" component={CodaScene} durationInFrames={toFrames(CODA_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="DRAGONS-Part3" component={DragonsPart3} durationInFrames={toFrames(DRAGONS_PART3_FRAMES)} {...VIDEO} />
			<Composition id="ETERNAL-Hook" component={EternalHookScene} durationInFrames={toFrames(ETERNAL_HOOK_FRAMES)} {...VIDEO} />
			<Composition id="ETERNAL-Gift" component={GiftScene} durationInFrames={toFrames(GIFT_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="ETERNAL-War" component={EternalWarScene} durationInFrames={toFrames(ETERNAL_WAR_FRAMES)} {...VIDEO} />
			<Composition id="ETERNAL-Part1" component={EternalPart1} durationInFrames={toFrames(ETERNAL_PART1_FRAMES)} {...VIDEO} />
			<Composition id="ETERNAL-Weapon" component={WeaponScene} durationInFrames={toFrames(WEAPON_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="ETERNAL-Leave" component={LeaveScene} durationInFrames={toFrames(LEAVE_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="ETERNAL-Ages" component={AgesScene} durationInFrames={toFrames(AGES_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="ETERNAL-Part2" component={EternalPart2} durationInFrames={toFrames(ETERNAL_PART2_FRAMES)} {...VIDEO} />
			<Composition id="ETERNAL-Reunion" component={ReunionScene} durationInFrames={toFrames(REUNION_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="ETERNAL-Hotel" component={HotelScene} durationInFrames={toFrames(HOTEL_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="ETERNAL-Coda" component={EternalCodaScene} durationInFrames={toFrames(ETERNAL_CODA_FRAMES)} {...VIDEO} />
			<Composition id="ETERNAL-Part3" component={EternalPart3} durationInFrames={toFrames(ETERNAL_PART3_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA-Hook" component={NecHookScene} durationInFrames={toFrames(NEC_HOOK_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA-Radiance" component={NecRadianceScene} durationInFrames={toFrames(NEC_RADIANCE_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA-Greed" component={NecGreedScene} durationInFrames={toFrames(NEC_GREED_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA-Dark" component={NecDarkScene} durationInFrames={toFrames(NEC_DARK_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA-Tower" component={NecTowerScene} durationInFrames={toFrames(NEC_TOWER_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA-Book" component={NecBookScene} durationInFrames={toFrames(NEC_BOOK_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA-Return" component={NecReturnScene} durationInFrames={toFrames(NEC_RETURN_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA-Burst" component={NecBurstScene} durationInFrames={toFrames(NEC_BURST_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA-Coda" component={NecCodaScene} durationInFrames={toFrames(NEC_CODA_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA-Part1" component={NecrozmaPart1} durationInFrames={toFrames(NECROZMA_PART1_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA-Part2" component={NecrozmaPart2} durationInFrames={toFrames(NECROZMA_PART2_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA-Part3" component={NecrozmaPart3} durationInFrames={toFrames(NECROZMA_PART3_FRAMES)} {...VIDEO} />
			<Composition id="NECROZMA" component={NecrozmaEpisode} durationInFrames={toFrames(NECROZMA_TOTAL_FRAMES)} {...VIDEO} />
			<Still id="DRAGONS-Cover-H" component={CoverLandscape} width={1920} height={1080} />
			<Still id="DRAGONS-Cover-V" component={CoverPortrait} width={1080} height={1920} />
			<Still id="NECROZMA-Cover-H" component={NecCoverLandscape} width={1440} height={1080} />
			<Still id="NECROZMA-Cover-V" component={NecCoverPortrait} width={1080} height={1440} />
			<Still id="POKEBALL-Cover-16x9" component={PokeballCoverWide} width={1920} height={1080} />
			<Still id="UNOWN-Cover-16x9" component={UnownCoverWide} width={1920} height={1080} />
			<Still id="UNOWN-Cover-4x3" component={UnownCoverStandard} width={1440} height={1080} />
			<Still id="UNOWN-Cover-3x4" component={UnownCoverPortrait} width={1080} height={1440} />
			<Still id="POKEBALL-Cover-4x3" component={PokeballCoverStandard} width={1440} height={1080} />
			<Still id="POKEBALL-Cover-3x4" component={PokeballCoverPortrait} width={1080} height={1440} />
			<Still id="REGI-Cover-16x9" component={RegiCoverWide} width={1920} height={1080} />
			<Still id="REGI-Cover-4x3" component={RegiCoverStandard} width={1440} height={1080} />
			<Still id="REGI-Cover-3x4" component={RegiCoverPortrait} width={1080} height={1440} />
			<Still id="SPACE-Cover-16x9" component={SpaceCoverWide} width={1920} height={1080} />
			<Still id="SPACE-Cover-4x3" component={SpaceCoverStandard} width={1440} height={1080} />
			<Still id="SPACE-Cover-3x4" component={SpaceCoverPortrait} width={1080} height={1440} />
			<Still id="REVERSE-Cover-16x9" component={ReverseCoverWide} width={1920} height={1080} />
			<Still id="REVERSE-Cover-4x3" component={ReverseCoverStandard} width={1440} height={1080} />
			<Still id="REVERSE-Cover-3x4" component={ReverseCoverPortrait} width={1080} height={1440} />
			<Still id="DEOXYS-Cover-16x9" component={DeoxysCover} width={1920} height={1080} />
			<Still id="DEOXYS-Cover-4x3" component={DeoxysCover} width={1440} height={1080} />
			<Still id="DEOXYS-Cover-3x4" component={DeoxysCover} width={1080} height={1440} />
			<Composition id="TEST-Art3D"component={Art3DTest} durationInFrames={toFrames(ART3D_TEST_FRAMES)} {...VIDEO} />
			<Composition id="TEST-Art3D-Solo" component={Art3DTestSolo} durationInFrames={toFrames(ART3D_TEST_FRAMES)} {...VIDEO} />
			<Composition id="TEST-Ink" component={InkTest} durationInFrames={toFrames(INK_TEST_FRAMES)} {...VIDEO} />
			<Composition id="XERNEAS-Opening" component={XerneasOpeningScene} durationInFrames={toFrames(XERNEAS_OPENING_FRAMES)} {...VIDEO} />
			<Composition id="XERNEAS-Middle" component={XerneasMiddleScene} durationInFrames={toFrames(XERNEAS_MIDDLE_FRAMES)} {...VIDEO} />
			<Composition id="XERNEAS-Ending" component={XerneasEndingScene} durationInFrames={toFrames(XERNEAS_ENDING_FRAMES)} {...VIDEO} />
			<Composition id="XERNEAS" component={XerneasEpisode} durationInFrames={toFrames(XERNEAS_EPISODE_FRAMES)} {...VIDEO} />
			<Composition id="GALAR-Hook" component={GalarHookScene} durationInFrames={toFrames(GALAR_HOOK_FRAMES)} {...VIDEO} />
			<Composition id="GALAR-Star" component={GalarStarScene} durationInFrames={toFrames(STAR_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="GALAR-Night" component={GalarNightScene} durationInFrames={toFrames(NIGHT_SCENE_FRAMES)} {...VIDEO} />
			<Composition id="GALAR" component={GalarEpisode} durationInFrames={toFrames(GALAR_EPISODE_FRAMES)} {...VIDEO} />
			{[...POKEBALL_SEGMENTS, ...POKEBALL_PARTS, ...REGI_SEGMENTS, ...HISUI_SEGMENTS, ...TIME_SEGMENTS, ...TIME_PARTS, ...SPACE_SEGMENTS, ...SPACE_PARTS, ...REVERSE_SEGMENTS, ...REVERSE_PARTS, ...WISH_SEGMENTS, ...WISH_PARTS, ...DEOXYS_SEGMENTS].map((c) => (
				<Composition key={c.id} id={c.id} component={c.component} durationInFrames={toFrames(c.frames)} {...VIDEO} />
			))}
			<Composition id="DEOXYS" component={DeoxysEpisode} durationInFrames={toFrames(DEOXYS_TOTAL_FRAMES)} {...VIDEO} />
			<Composition id="TEST-Tower3D" component={Tower3DTest} durationInFrames={toFrames(TOWER3D_TEST_FRAMES)} {...VIDEO} />
			<Composition id="TEST-Statue" component={StatueTest} durationInFrames={toFrames(STATUE_TEST_FRAMES)} {...VIDEO} />
			<Composition id="TEST-Subtitle" component={SubtitleTest} durationInFrames={toFrames(SUBTITLE_TEST_FRAMES)} {...VIDEO} />
		</>
	);
};
