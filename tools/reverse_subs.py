"""Generate the subtitle tables for reverse-texts.md and check reading speed.

Each line lasts from its start to the next line's start (the last one to bar 72).
Chinese chars + digits only are counted, like space-texts.md.
"""
import re, sys

BAR, BEAT, T0 = 2.1257, 0.5314, 0.087
END = (72, 0)
LIMIT = 5.7

def t(b):
    n, k = b
    return T0 + BAR * n + BEAT * k

SEGS = [
    ("hook", "钩子与片名", 0), ("shadow", "影子立起来", 6), ("name", "名字", 14),
    ("banish", "来历", 22), ("flip", "翻到背面", 30), ("distort", "规则不同的世界", 36),
    ("balance", "两个世界", 44), ("origin", "原本的样子", 52), ("home", "它的两个样子", 55),
    ("back", "另一面", 66),
]

# (bar, beat, type, zh, en, basis)
L = [
    (0, 0, "旁", "枪之柱上，时间与空间之神都到了。", "At the Spear Pillar, the gods of time and space had both arrived.", "白金剧情；接《空间的形状》第 7 段；第 0 帧就显现"),
    (1, 2, "旁", "地上却多了第三个影子。", "But on the ground, there was a third shadow.", "白金：湖之三神出现后，一道\"神秘的影子\"出现（52poke「枪之柱」）"),
    (2, 2, "旁", "它不属于这个世界。", "It did not belong to this world.", "铺垫\"背面\"：DP / BDSP 图鉴\"栖息在位于这个世界背面的世界里\"；第 4 小节片名期间这句继续留着"),
    (5, 0, "旁", "被放逐的那一位，回来了。", "The one who was banished had come back.", "加码：提前挂出第 4 段的放逐"),
    (6, 0, "旁", "银河队首领赤日，想借它们的力量重造世界。", "Cyrus, boss of Team Galactic, meant to use their power to remake the world.", "白金赤日 *I am resetting everything to zero*；赤日、银河队为官方中文"),
    (8, 0, "旁", "这时，影子从地上立了起来。", "Then the shadow rose up from the ground.", "白金剧情；第 8 小节全乐队进入，只出影子"),
    (9, 0, "旁", "赤日说：「原来有宝可梦，只能以影子现身。」", "Cyrus said, \"So there is a Pokémon that can only appear as a shadow.\"", "白金赤日 *Interesting. So, there is a Pokémon that can only appear as a shadow.* 改写"),
    (10, 2, "旁", "影子随即把他拖走了。", "At once, the shadow dragged him away.", "白金：影子吞噬赤日，带进毁坏的世界（52poke「枪之柱」；Bulbapedia *engulfed me*）"),
    (11, 2, "旁", "原地留下一道口子，", "It left an opening behind,", "白金：留下通往毁坏的世界的入口"),
    (12, 2, "旁", "石柱开始扭曲，像要被拉进另一边。", "and the pillars began to warp, as if pulled to the other side.", "白金竹兰 *The pillars are distorting... It's because of that portal. It's joined us to the other world.*"),
    (14, 0, "旁", "神奥冠军竹兰赶到了。", "Cynthia, Sinnoh's Champion, arrived.", "白金剧情；竹兰为官方中文"),
    (15, 0, "旁", "「世界诞生时，还有第三位。」", "\"When this world was made, there was a third.\"", "白金竹兰 *When this world was made, Dialga and Palkia appeared. Apparently, there was one more Pokémon that appeared at the same time.*"),
    (16, 0, "旁", "「力量不输时间与空间，名字却不能说出口。」", "\"As powerful as time and space, yet its name was never to be spoken.\"", "同上 *A Pokémon with as much power as Dialga and Palkia... But also one whose name was never to be spoken*；**骑拉帝纳显色 + 叫声 + 名称卡**"),
    (17, 2, "旁", "「它叫骑拉帝纳。」", "\"Giratina.\"", "同上 *—Giratina!*"),
    (18, 2, "旁", "据说它住在这个世界背面的另一个世界。", "It is said to live in another world, on the reverse side of ours.", "DP / BDSP 图鉴（官方中文\"据说这种宝可梦栖息在位于这个世界背面的世界里\"）改写"),
    (20, 0, "旁", "它为什么会在那一边？得从世界诞生时说起。", "Why is it over there? That story begins with the birth of the world.", "转入来历"),
    (22, 0, "旁", "洗翠的石板上写着：三只宝可梦一同诞生，", "The Hisuian plates say three Pokémon were born together", "LA 龙之石板（官方中文\"三只宝可梦由其而生，一齐连结时间与空间\"）改写"),
    (23, 2, "旁", "一起连结时间与空间。", "to bind time and space.", "同上"),
    (24, 2, "旁", "第三只太过粗暴，被放逐了。", "The third was too violent, and was banished.", "Pt / BW / Y / αS 图鉴（官方中文\"因为性格粗暴而被驱逐\"）改写；LA 望罗\"遭到放逐\""),
    (25, 2, "原", "其狂暴的分身，被赐予了世界的背面。", "The other side of this world was given by the Original One to its raging third.", "LA 妖怪石板（官方中文）；石板文字不算人物说话，不加「」"),
    (27, 0, "旁", "后来神奥的神话，只写了时间和空间。", "Later, Sinnoh's myths spoke only of time and space.", "BDSP 水脉图书馆《起始的故事》只有\"２个分身\"\"３个生命\"，没有骑拉帝纳"),
    (28, 2, "旁", "它在洗翠真的反抗过：撕开了天上的裂缝。", "In Hisui, it truly rebelled: it tore open a rift in the sky.", "LA 望罗（官方中文\"找出想要挑战阿尔宙斯的骑拉帝纳，让它打开时空裂缝\"）；《神奥之名》讲过，只点一句"),
    (30, 0, "旁", "回到枪之柱：竹兰和主角追了进去——", "Back at the Spear Pillar, Cynthia and the player chased after it—", "白金剧情；第 30 小节落拍整张纸翻面"),
    (31, 2, "旁", "这里就是世界的背面，毁坏的世界。", "This is the other side of the world: the Distortion World.", "\"毁坏的世界\"为官方中文"),
    (33, 0, "旁", "竹兰发现，这里时间不流动，", "Cynthia found that time does not flow here,", "白金竹兰 *Time isn't flowing and space isn't stable.*"),
    (34, 0, "旁", "空间也不安稳，", "space is never stable,", "同上"),
    (35, 0, "旁", "一切常规都和这边不同。", "and every rule is different from ours.", "HGSS / X / ΩR 图鉴（官方中文\"那里所有的常规都与这个世界不同\"）改写"),
    (36, 0, "旁", "岛浮在半空，树倒着长，", "Islands float in midair; trees grow upside down;", "白金场景（52poke / Bulbapedia「毁坏的世界」）"),
    (37, 2, "旁", "瀑布倒挂，墙也能当路走，", "waterfalls hang inverted, and walls can be walked on.", "同上：倒挂的瀑布，可以在墙上行走、冲浪"),
    (38, 2, "旁", "分不清哪边是天，哪边是地。", "There is no telling which way is sky and which is ground.", "LA 起源形态图鉴\"没有天地之分\"的意思（原句《神奥之名》用过，不引）"),
    (39, 2, "旁", "剧场版里它穿镜面来去，游戏里靠裂口。", "In the movies, it travels through mirrors. In the games, it uses rifts.", "动画与游戏的差别（Bulbapedia「Giratina」：电影里只通过反光的表面开门；游戏里是枪之柱的口子、归途洞窟、洗翠的裂缝）"),
    (41, 0, "旁", "这里没有别的宝可梦。", "No other Pokémon live here.", "白金竹兰 *There are no Pokémon here at all.*；钓鱼也钓不到；第 41–43 小节最空"),
    (42, 0, "旁", "竹兰想不通：「它为什么一直独自待在这里？」", "Cynthia wondered, \"Why is Giratina here all alone?\"", "白金竹兰 *Why is Giratina here all alone?*"),
    (44, 0, "旁", "赤日在最深处等着。", "Cyrus was waiting in the depths.", "白金剧情"),
    (45, 0, "旁", "他看出：这两个世界是互相撑着的，", "He saw that the two worlds hold each other up.", "白金赤日 *The two worlds must be balancing each other to remain in existence.*"),
    (46, 2, "旁", "少一个，另一个也不能存在。", "Without one, the other cannot exist.", "同上 *Without one, the other cannot exist.*"),
    (47, 2, "旁", "就像一张纸：撕掉一面，另一面也跟着没了。", "Like a sheet of paper: tear away one side, and the other goes with it.", "比喻（赤日原话用 DNA 双链，片中换成纸，和画面的翻面一致）"),
    (49, 0, "旁", "它拖走赤日，是因为两个世界都有了危险。", "It dragged Cyrus away because both worlds were in danger.", "白金竹兰 *Giratina is enraged because the two worlds are endangered. It has merged the Distortion World and our world at the Spear Pillar.*；接回第 8 句影子拖走赤日"),
    (50, 2, "旁", "赤日却只想打倒它，抹掉背面的世界。", "But Cyrus only wanted to defeat it and erase the other side.", "白金赤日 *What matters is defeating that Pokémon and making this world disappear.*；第 50–51 小节上扬，它从画面上方降下"),
    (52, 0, "旁", "在这里，它变了样子——", "Here, it changes shape—", "白金：在毁坏的世界里是起源形态；**起源形态显色 + 起源形态叫声**，小标签\"起源形态 · Origin Forme\""),
    (53, 0, "旁", "它的专属招式，叫“暗影潜袭”：", "Its signature move is Shadow Force:", "暗影潜袭是骑拉帝纳的专属招式（官方中文招式名）；写法同前两期\"它的绝招叫……\"；第 53 小节全片最暗，它消失"),
    (54, 0, "旁", "先消失踪影，下一回合才出手，", "it vanishes first, then strikes on the next turn,", "招式说明（日月 / 剑盾官方中文\"第１回合消失踪影，第２回合攻击对手\"）改写；第 54 小节全片最大爆发"),
    (55, 2, "旁", "对手防得再严，也照样打中。", "and it hits even a target that protects itself.", "同上（官方中文\"即使对手正受保护，也能击中\"）改写"),
    (56, 2, "旁", "交手过后，它明白了人与宝可梦的羁绊，扭曲停了下来。", "After the battle, it understood the bond between people and Pokémon, and the distortion stopped.", "白金竹兰 *You can defeat Giratina and show the tight bond you share with your Pokémon… Giratina will understand. The distortion of the two worlds will stop!* / *Giratina seems to have understood us!*"),
    (58, 2, "旁", "随后，它沉回了背面的深处。", "Then it sank back into the depths of the other side.", "白金剧情：战斗结束（上一句已说交手过后）；画面上它往下沉、淡去"),
    (60, 0, "旁", "在这里，它是起源形态；", "Here, it takes its Origin Forme;", "白金：在毁坏的世界里是起源形态；形态名为官方中文；画面：天花板（地面的背面）下倒挂的起源形态"),
    (61, 0, "旁", "到了这一边，就成了别种形态。", "on our side, it becomes its Altered Forme.", "白金：离开毁坏的世界就是别种形态（不带白金宝珠时；道具不提）；画面：镜头升到与地面同高，上面刻出别种形态"),
    (62, 2, "原", "石板上写着：满盈在世界背面者，足可令生灵改变身姿。", "A plate reads: \"That which fills the other side of the world can shape the rage and mold it.\"", "LA 钢铁石板（官方中文；英文 Bulbapedia「Iron Plate」，英文的 *the rage* 指的就是骑拉帝纳）；63.0 别种形态显色，一道金光沿镜面线走过"),
    (65, 0, "旁", "背面世界的力量，让它换了模样。", "The power of the other side changes its shape.", "解释上一句"),
    (66, 2, "旁", "所以我们在这一边见过的骑拉帝纳，", "So the Giratina we have seen on our side", "收尾；66.2 镜头升到地面上方，倒挂的起源形态被地面挡住"),
    (68, 0, "旁", "都只是它的一面；", "is only one side of it;", "同上"),
    (69, 0, "旁", "另一面，留在了世界的背面。", "the other remains on the reverse side of the world.", "收尾；留到片尾跟画面一起淡出，不回到第 0 帧"),
]

def nchars(s):
    return len(re.findall(r"[一-鿿0-9０-９]", s))

def fmtbar(b):
    return f"{b[0]}.{b[1]}"

out = []
bad = []
seg_i = -1
for i, (n, k, ty, zh, en, basis) in enumerate(L):
    st = (n, k)
    nx = (L[i + 1][0], L[i + 1][1]) if i + 1 < len(L) else END
    while seg_i + 1 < len(SEGS) and n >= SEGS[seg_i + 1][2]:
        seg_i += 1
        name, title, _ = SEGS[seg_i]
        out.append(f"\n### `{name}` · {title}\n")
        out.append("| # | 小节 | 秒 | 帧 | 类型 | 中文 | 英文 | 字/秒 | 依据 |")
        out.append("|---|---|---|---|---|---|---|---|---|")
    s0, s1 = t(st), t(nx)
    f0 = 0 if i == 0 else round(s0 * 30)
    f1 = round(s1 * 30)
    c = nchars(zh)
    cps = c / (s1 - s0)
    if cps > LIMIT:
        bad.append((i + 1, zh, round(cps, 2)))
    out.append(f"| {i+1} | {fmtbar(st)}–{fmtbar(nx)} | {s0:.2f}–{s1:.2f} | {f0}–{f1} | {ty} | {zh} | {en} | {cps:.1f} | {basis} |")

sys.stdout.reconfigure(encoding="utf-8")
print("\n".join(out))
cpss = []
for i in range(len(L)):
    nx = (L[i + 1][0], L[i + 1][1]) if i + 1 < len(L) else END
    cpss.append(nchars(L[i][3]) / (t(nx) - t((L[i][0], L[i][1]))))
print(f"\n<!-- lines={len(L)} max={max(cpss):.2f} mean={sum(cpss)/len(cpss):.2f} over={bad} -->", file=sys.stderr)
