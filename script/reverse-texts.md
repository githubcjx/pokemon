# 《世界的背面》字幕表 v3（代码短名 `reverse`，输出 `out/世界的背面/`）

2026-10-30。剧情和核实记录见 [reverse-story.md](reverse-story.md)，分段和每段画面见 [reverse-plan.md](reverse-plan.md)。用户确认：按 `C:\Users\Admin\Music\千年之后.mp3` 卡点，但**字幕不能为了卡点播得太快**，要控制每句的时长，或者把句子改短。

类型：**旁** = 根据设定写的旁白；**原** = 官方原文（只留 2 句）。人物说的话用「」。

## 节奏规则

- 节拍沿用前两期的测量：112.905 BPM，一拍 0.5314 秒，一小节 2.1257 秒，第 0 小节强拍在 0.087 秒；第 n 小节第 k 拍 = 0.087 + 2.1257n + 0.5314k 秒，乘 30 即 30fps 帧号。"24.2"表示第 24 小节第 3 拍（k 取 0–3）。第 72 小节强拍（153.14 秒，4594 帧）结束。
- **每句的时长 = 从它开始到下一句开始**（字幕留到下一句才换，最后一句留到片尾）。字/秒只算中文和数字。
- **上限每秒 5.7 字，本表最快 5.3、平均 4.4**（上期最快 6.6）。超过的句子先改短，改不短就让它多占一两拍；不靠加快显现速度来赶拍。显现动画按句长配（约占这句时长的一半、每字最多约 3 帧）。
- 换句只落在强拍或第 3 拍。卡点主要靠画面：落拍那一帧给最大的变化，字幕跟着落拍出现，但不追每一拍。
- 表格由 `tools/reverse_subs.py` 生成并自动检查字/秒，改句子时改脚本再重新生成。

### `hook` · 钩子与片名

| # | 小节 | 秒 | 帧 | 类型 | 中文 | 英文 | 字/秒 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.0–1.2 | 0.09–3.28 | 0–98 | 旁 | 枪之柱上，时间与空间之神都到了。 | At the Spear Pillar, the gods of time and space had both arrived. | 4.4 | 白金剧情；接《空间的形状》第 7 段；第 0 帧就显现 |
| 2 | 1.2–2.2 | 3.28–5.40 | 98–162 | 旁 | 地上却多了第三个影子。 | But on the ground, there was a third shadow. | 4.7 | 白金：湖之三神出现后，一道"神秘的影子"出现（52poke「枪之柱」） |
| 3 | 2.2–5.0 | 5.40–10.72 | 162–321 | 旁 | 它不属于这个世界。 | It did not belong to this world. | 1.5 | 铺垫"背面"：DP / BDSP 图鉴"栖息在位于这个世界背面的世界里"；第 4 小节片名期间这句继续留着 |
| 4 | 5.0–6.0 | 10.72–12.84 | 321–385 | 旁 | 被放逐的那一位，回来了。 | The one who was banished had come back. | 4.7 | 加码：提前挂出第 4 段的放逐 |

### `shadow` · 影子立起来

| # | 小节 | 秒 | 帧 | 类型 | 中文 | 英文 | 字/秒 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 5 | 6.0–8.0 | 12.84–17.09 | 385–513 | 旁 | 银河队首领赤日，想借它们的力量重造世界。 | Cyrus, boss of Team Galactic, meant to use their power to remake the world. | 4.2 | 白金赤日 *I am resetting everything to zero*；赤日、银河队为官方中文 |
| 6 | 8.0–9.0 | 17.09–19.22 | 513–577 | 旁 | 这时，影子从地上立了起来。 | Then the shadow rose up from the ground. | 5.2 | 白金剧情；第 8 小节全乐队进入，只出影子 |
| 7 | 9.0–10.2 | 19.22–22.41 | 577–672 | 旁 | 赤日说：「原来有宝可梦，只能以影子现身。」 | Cyrus said, "So there is a Pokémon that can only appear as a shadow." | 5.0 | 白金赤日 *Interesting. So, there is a Pokémon that can only appear as a shadow.* 改写 |
| 8 | 10.2–11.2 | 22.41–24.53 | 672–736 | 旁 | 影子随即把他拖走了。 | At once, the shadow dragged him away. | 4.2 | 白金：影子吞噬赤日，带进毁坏的世界（52poke「枪之柱」；Bulbapedia *engulfed me*） |
| 9 | 11.2–12.2 | 24.53–26.66 | 736–800 | 旁 | 原地留下一道口子， | It left an opening behind, | 3.8 | 白金：留下通往毁坏的世界的入口 |
| 10 | 12.2–14.0 | 26.66–29.85 | 800–895 | 旁 | 石柱开始扭曲，像要被拉进另一边。 | and the pillars began to warp, as if pulled to the other side. | 4.4 | 白金竹兰 *The pillars are distorting... It's because of that portal. It's joined us to the other world.* |

### `name` · 名字

| # | 小节 | 秒 | 帧 | 类型 | 中文 | 英文 | 字/秒 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 11 | 14.0–15.0 | 29.85–31.97 | 895–959 | 旁 | 神奥冠军竹兰赶到了。 | Cynthia, Sinnoh's Champion, arrived. | 4.2 | 白金剧情；竹兰为官方中文 |
| 12 | 15.0–16.0 | 31.97–34.10 | 959–1023 | 旁 | 「世界诞生时，还有第三位。」 | "When this world was made, there was a third." | 4.7 | 白金竹兰 *When this world was made, Dialga and Palkia appeared. Apparently, there was one more Pokémon that appeared at the same time.* |
| 13 | 16.0–17.2 | 34.10–37.29 | 1023–1119 | 旁 | 「力量不输时间与空间，名字却不能说出口。」 | "As powerful as time and space, yet its name was never to be spoken." | 5.3 | 同上 *A Pokémon with as much power as Dialga and Palkia... But also one whose name was never to be spoken*；**骑拉帝纳显色 + 叫声 + 名称卡** |
| 14 | 17.2–18.2 | 37.29–39.41 | 1119–1182 | 旁 | 「它叫骑拉帝纳。」 | "Giratina." | 2.8 | 同上 *—Giratina!* |
| 15 | 18.2–20.0 | 39.41–42.60 | 1182–1278 | 旁 | 据说它住在这个世界背面的另一个世界。 | It is said to live in another world, on the reverse side of ours. | 5.3 | DP / BDSP 图鉴（官方中文"据说这种宝可梦栖息在位于这个世界背面的世界里"）改写 |
| 16 | 20.0–22.0 | 42.60–46.85 | 1278–1406 | 旁 | 它为什么会在那一边？得从世界诞生时说起。 | Why is it over there? That story begins with the birth of the world. | 4.2 | 转入来历 |

### `banish` · 来历

| # | 小节 | 秒 | 帧 | 类型 | 中文 | 英文 | 字/秒 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 17 | 22.0–23.2 | 46.85–50.04 | 1406–1501 | 旁 | 洗翠的石板上写着：三只宝可梦一同诞生， | The Hisuian plates say three Pokémon were born together | 5.3 | LA 龙之石板（官方中文"三只宝可梦由其而生，一齐连结时间与空间"）改写 |
| 18 | 23.2–24.2 | 50.04–52.17 | 1501–1565 | 旁 | 一起连结时间与空间。 | to bind time and space. | 4.2 | 同上 |
| 19 | 24.2–25.2 | 52.17–54.29 | 1565–1629 | 旁 | 第三只太过粗暴，被放逐了。 | The third was too violent, and was banished. | 5.2 | Pt / BW / Y / αS 图鉴（官方中文"因为性格粗暴而被驱逐"）改写；LA 望罗"遭到放逐" |
| 20 | 25.2–27.0 | 54.29–57.48 | 1629–1724 | 原 | 其狂暴的分身，被赐予了世界的背面。 | The other side of this world was given by the Original One to its raging third. | 4.7 | LA 妖怪石板（官方中文）；石板文字不算人物说话，不加「」 |
| 21 | 27.0–28.2 | 57.48–60.67 | 1724–1820 | 旁 | 后来神奥的神话，只写了时间和空间。 | Later, Sinnoh's myths spoke only of time and space. | 4.7 | BDSP 水脉图书馆《起始的故事》只有"２个分身""３个生命"，没有骑拉帝纳 |
| 22 | 28.2–30.0 | 60.67–63.86 | 1820–1916 | 旁 | 它在洗翠真的反抗过：撕开了天上的裂缝。 | In Hisui, it truly rebelled: it tore open a rift in the sky. | 5.3 | LA 望罗（官方中文"找出想要挑战阿尔宙斯的骑拉帝纳，让它打开时空裂缝"）；《神奥之名》讲过，只点一句 |

### `flip` · 翻到背面

| # | 小节 | 秒 | 帧 | 类型 | 中文 | 英文 | 字/秒 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 23 | 30.0–31.2 | 63.86–67.05 | 1916–2011 | 旁 | 回到枪之柱：竹兰和主角追了进去—— | Back at the Spear Pillar, Cynthia and the player chased after it— | 4.4 | 白金剧情；第 30 小节落拍整张纸翻面 |
| 24 | 31.2–33.0 | 67.05–70.24 | 2011–2107 | 旁 | 这里就是世界的背面，毁坏的世界。 | This is the other side of the world: the Distortion World. | 4.4 | "毁坏的世界"为官方中文 |
| 25 | 33.0–34.0 | 70.24–72.36 | 2107–2171 | 旁 | 竹兰发现，这里时间不流动， | Cynthia found that time does not flow here, | 5.2 | 白金竹兰 *Time isn't flowing and space isn't stable.* |
| 26 | 34.0–35.0 | 72.36–74.49 | 2171–2235 | 旁 | 空间也不安稳， | space is never stable, | 2.8 | 同上 |
| 27 | 35.0–36.0 | 74.49–76.61 | 2235–2298 | 旁 | 一切常规都和这边不同。 | and every rule is different from ours. | 4.7 | HGSS / X / ΩR 图鉴（官方中文"那里所有的常规都与这个世界不同"）改写 |

### `distort` · 规则不同的世界

| # | 小节 | 秒 | 帧 | 类型 | 中文 | 英文 | 字/秒 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 28 | 36.0–37.2 | 76.61–79.80 | 2298–2394 | 旁 | 岛浮在半空，树倒着长， | Islands float in midair; trees grow upside down; | 2.8 | 白金场景（52poke / Bulbapedia「毁坏的世界」） |
| 29 | 37.2–38.2 | 79.80–81.93 | 2394–2458 | 旁 | 瀑布倒挂，墙也能当路走， | waterfalls hang inverted, and walls can be walked on. | 4.7 | 同上：倒挂的瀑布，可以在墙上行走、冲浪 |
| 30 | 38.2–39.2 | 81.93–84.05 | 2458–2522 | 旁 | 分不清哪边是天，哪边是地。 | There is no telling which way is sky and which is ground. | 5.2 | LA 起源形态图鉴"没有天地之分"的意思（原句《神奥之名》用过，不引） |
| 31 | 39.2–41.0 | 84.05–87.24 | 2522–2617 | 旁 | 剧场版里它穿镜面来去，游戏里靠裂口。 | In the movies, it travels through mirrors. In the games, it uses rifts. | 5.0 | 动画与游戏的差别（Bulbapedia「Giratina」：电影里只通过反光的表面开门；游戏里是枪之柱的口子、归途洞窟、洗翠的裂缝） |
| 32 | 41.0–42.0 | 87.24–89.37 | 2617–2681 | 旁 | 这里没有别的宝可梦。 | No other Pokémon live here. | 4.2 | 白金竹兰 *There are no Pokémon here at all.*；钓鱼也钓不到；第 41–43 小节最空 |
| 33 | 42.0–44.0 | 89.37–93.62 | 2681–2809 | 旁 | 竹兰想不通：「它为什么一直独自待在这里？」 | Cynthia wondered, "Why is Giratina here all alone?" | 4.0 | 白金竹兰 *Why is Giratina here all alone?* |

### `balance` · 两个世界

| # | 小节 | 秒 | 帧 | 类型 | 中文 | 英文 | 字/秒 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 34 | 44.0–45.0 | 93.62–95.74 | 2809–2872 | 旁 | 赤日在最深处等着。 | Cyrus was waiting in the depths. | 3.8 | 白金剧情 |
| 35 | 45.0–46.2 | 95.74–98.93 | 2872–2968 | 旁 | 他看出：这两个世界是互相撑着的， | He saw that the two worlds hold each other up. | 4.4 | 白金赤日 *The two worlds must be balancing each other to remain in existence.* |
| 36 | 46.2–47.2 | 98.93–101.06 | 2968–3032 | 旁 | 少一个，另一个也不能存在。 | Without one, the other cannot exist. | 5.2 | 同上 *Without one, the other cannot exist.* |
| 37 | 47.2–49.0 | 101.06–104.25 | 3032–3127 | 旁 | 就像一张纸：撕掉一面，另一面也跟着没了。 | Like a sheet of paper: tear away one side, and the other goes with it. | 5.3 | 比喻（赤日原话用 DNA 双链，片中换成纸，和画面的翻面一致） |
| 38 | 49.0–50.2 | 104.25–107.43 | 3127–3223 | 旁 | 它拖走赤日，是因为两个世界都有了危险。 | It dragged Cyrus away because both worlds were in danger. | 5.3 | 白金竹兰 *Giratina is enraged because the two worlds are endangered. It has merged the Distortion World and our world at the Spear Pillar.*；接回第 8 句影子拖走赤日 |
| 39 | 50.2–52.0 | 107.43–110.62 | 3223–3319 | 旁 | 赤日却只想打倒它，抹掉背面的世界。 | But Cyrus only wanted to defeat it and erase the other side. | 4.7 | 白金赤日 *What matters is defeating that Pokémon and making this world disappear.*；第 50–51 小节上扬，它从画面上方降下 |

### `origin` · 原本的样子

| # | 小节 | 秒 | 帧 | 类型 | 中文 | 英文 | 字/秒 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 40 | 52.0–53.0 | 110.62–112.75 | 3319–3382 | 旁 | 在这里，它变了样子—— | Here, it changes shape— | 3.8 | 白金：在毁坏的世界里是起源形态；**起源形态显色 + 起源形态叫声**，小标签"起源形态 · Origin Forme" |
| 41 | 53.0–54.0 | 112.75–114.87 | 3382–3446 | 旁 | 它的专属招式，叫“暗影潜袭”： | Its signature move is Shadow Force: | 5.2 | 暗影潜袭是骑拉帝纳的专属招式（官方中文招式名）；写法同前两期"它的绝招叫……"；第 53 小节全片最暗，它消失 |
| 42 | 54.0–55.2 | 114.87–118.06 | 3446–3542 | 旁 | 先消失踪影，下一回合才出手， | it vanishes first, then strikes on the next turn, | 3.8 | 招式说明（日月 / 剑盾官方中文"第１回合消失踪影，第２回合攻击对手"）改写；第 54 小节全片最大爆发 |

### `home` · 它的两个样子

| # | 小节 | 秒 | 帧 | 类型 | 中文 | 英文 | 字/秒 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 43 | 55.2–56.2 | 118.06–120.19 | 3542–3606 | 旁 | 对手防得再严，也照样打中。 | and it hits even a target that protects itself. | 5.2 | 同上（官方中文"即使对手正受保护，也能击中"）改写 |
| 44 | 56.2–58.2 | 120.19–124.44 | 3606–3733 | 旁 | 交手过后，它明白了人与宝可梦的羁绊，扭曲停了下来。 | After the battle, it understood the bond between people and Pokémon, and the distortion stopped. | 5.2 | 白金竹兰 *You can defeat Giratina and show the tight bond you share with your Pokémon… Giratina will understand. The distortion of the two worlds will stop!* / *Giratina seems to have understood us!* |
| 45 | 58.2–60.0 | 124.44–127.63 | 3733–3829 | 旁 | 随后，它沉回了背面的深处。 | Then it sank back into the depths of the other side. | 3.4 | 白金剧情：战斗结束（上一句已说交手过后）；画面上它往下沉、淡去 |
| 46 | 60.0–61.0 | 127.63–129.75 | 3829–3893 | 旁 | 在这里，它是起源形态； | Here, it takes its Origin Forme; | 4.2 | 白金：在毁坏的世界里是起源形态；形态名为官方中文；画面：天花板（地面的背面）下倒挂的起源形态 |
| 47 | 61.0–62.2 | 129.75–132.94 | 3893–3988 | 旁 | 到了这一边，就成了别种形态。 | on our side, it becomes its Altered Forme. | 3.8 | 白金：离开毁坏的世界就是别种形态（不带白金宝珠时；道具不提）；画面：镜头升到与地面同高，上面刻出别种形态 |
| 48 | 62.2–65.0 | 132.94–138.26 | 3988–4148 | 原 | 石板上写着：满盈在世界背面者，足可令生灵改变身姿。 | A plate reads: "That which fills the other side of the world can shape the rage and mold it." | 4.1 | LA 钢铁石板（官方中文；英文 Bulbapedia「Iron Plate」，英文的 *the rage* 指的就是骑拉帝纳）；63.0 别种形态显色，一道金光沿镜面线走过 |
| 49 | 65.0–66.2 | 138.26–141.45 | 4148–4243 | 旁 | 背面世界的力量，让它换了模样。 | The power of the other side changes its shape. | 4.1 | 解释上一句 |

### `back` · 另一面

| # | 小节 | 秒 | 帧 | 类型 | 中文 | 英文 | 字/秒 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 50 | 66.2–68.0 | 141.45–144.63 | 4243–4339 | 旁 | 所以我们在这一边见过的骑拉帝纳， | So the Giratina we have seen on our side | 4.7 | 收尾；66.2 镜头升到地面上方，倒挂的起源形态被地面挡住 |
| 51 | 68.0–69.0 | 144.63–146.76 | 4339–4403 | 旁 | 都只是它的一面； | is only one side of it; | 3.3 | 同上 |
| 52 | 69.0–72.0 | 146.76–153.14 | 4403–4594 | 旁 | 另一面，留在了世界的背面。 | the other remains on the reverse side of the world. | 1.7 | 收尾；留到片尾跟画面一起淡出，不回到第 0 帧 |

## 名称卡与叫声

| 小节 | 宝可梦 | 名称卡 | 叫声 |
|---|---|---|---|
| 8.0 | 骑拉帝纳（影子） | — | 不放（只是影子，不算登场） |
| 16.0 | 骑拉帝纳（别种形态） | No.0487 · 反抗宝可梦 / Renegade Pokémon / 骑拉帝纳（逐字浮现）/ Giratina，和第 13 句同时出 | `public/cries/giratina.ogg`（显色峰值帧） |
| 22.1 | 帝牙卢卡（纸左边，排线刻画，朝右） | — | `public/cries/dialga.ogg`（本期第一次露面） |
| 23.0 | 帕路奇亚（纸右边，排线刻画，朝左） | — | `public/cries/palkia.ogg`（本期第一次露面） |
| 52.0 | 骑拉帝纳（起源形态） | 小标签：起源形态 · Origin Forme | `public/cries/giratina-origin.ogg`（PokeAPI 10007） |
| 54.0 | 骑拉帝纳（起源形态） | — | 全片最大爆发点再放一次 |

帝牙卢卡、帕路奇亚在第 22–30 小节以官方立绘推算的排线刻画出现在纸两边，面对面（蓝线、粉线，对应纸上那两条线），第 27 小节变亮，翻面前淡掉；湖之三神只以三点小光出现，不显形、不放叫声。第 60–66 小节镜面上下的两种形态都已登场过，不再放叫声。

## 旁白与官方原文

- **官方原文**只留 2 句：第 20 句 LA 妖怪石板"其狂暴的分身，被赐予了世界的背面。"、第 48 句 LA 钢铁石板"满盈在世界背面者，足可令生灵改变身姿。"（英文 *That which fills the other side of the world can shape the rage and mold it.*，"the rage"指的就是骑拉帝纳）。
- **改写自官方内容的旁白**：第 15、17–19、22、27、30、41–43 句（图鉴、石板、望罗台词、招式说明，都有官方中文）；第 1–2、5–14、23–26、32–40、44–47 句按白金的游戏剧情和台词写（白金没有官方中文，台词按英文改写；人名地名、形态名用官方中文）。依据栏写了每句出自哪段。
- **自己写的旁白**：第 3、4、16、21（依据《起始的故事》的内容）、28–29（描写白金的场景）、31（动画与游戏的差别）、49（解释第 48 句）、50–52 句（收尾）。比喻只有一个：第 37 句"纸的两面"。

## v3 的修改（下篇结尾换成"它的两个样子"）

- 第 45 句起重写，只讲骑拉帝纳：在背面是起源形态、到这一边是别种形态，用钢铁石板的原文解释为什么，最后落到"我们见过的只是它的一面"。不再出现赤日留下、竹兰的话、送行之泉、归途洞窟和铭文。
- 画面：第 58.2 小节它沉下去 → 镜头升到天花板（地面的背面）下，起源形态倒挂在祭坛下方 → 镜头升到与地面同高，地面只剩一道镜面线，上面刻出别种形态、63.0 显色 → 66.2 镜头升到地面上方，起源形态被地面挡住 → 淡出。送行之泉一整场（`spring.tsx`）删掉，镜头全程连续、不再用白光转场。

## v2 的修改（用户看完三篇后）

- 第 38 句交代开头影子为什么拖走赤日；第 41–43 句按前两期的写法讲绝招（先报招式名，再讲招式说明）；"好像听懂了"和"扭曲停了下来"并成第 44 句，并说清它明白的是什么（竹兰原话：主角打赢或收服它，让它看到人和宝可梦的羁绊）。
- 删掉"还想造一个没有心的世界"和竹兰"有悲伤，才有快乐；有愤怒，才懂得体贴"：后者在白金里是战后的感慨，不是回赤日的话，片里接不上。

## 和草案 v0 的差别

- 官方原文从 8 句减到 2 句（"官方原话要润色"）：DP 图鉴、龙之石板、剧毒石板、HGSS 图鉴、送行之泉地图说明都改写成旁白或不用；v3 起钢铁石板那句作为原文用在第 48 句，归途洞窟铭文不再用。
- 删掉"湖之三神也压不住"一句（第 6–7 小节只在画面上让三点光被推开）、洗翠石像那句（《神奥之名》讲过）。
- 起源形态不说"原本的样子"：帕路奇亚、帝牙卢卡有官方网站这样写，骑拉帝纳没找到同样的说法，改成"在这里，它变了样子"。
- 原定的三处 5.6 字/秒改短：第 8、22、31 句。

## 片中没有说的

见 [reverse-story.md](reverse-story.md)「片中不说的」。另外：主角是收服还是击败骑拉帝纳不交代（第 44 句只说"交手过后"）；第 44 句"它明白了"照竹兰原话，不说它从此改变；白金宝珠（带着它在这一边也能保持起源形态）不提，第 47 句只说"到了这一边，就成了别种形态"；赤日的结局、出口通向哪里不交代。
