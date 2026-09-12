import { _decorator, Button, Component, Label, Node, Sprite, UITransform, Vec3, director } from 'cc';
import { DIFFICULTY_STAGES, ROUND_DURATION_MS } from '../config/balance';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../config/layout';
import { ALL_INGREDIENTS, ingredientName } from '../config/ingredients';
import { STRINGS } from '../config/strings';
import { readBestScore } from '../game/bestScore';
import { BusEvent, bus } from '../game/bus';
import { UI_COLOR } from '../ui/uiFactory';

const { ccclass } = _decorator;

/** 自检需要伸进去的手：手动推一把时间，让 60 秒的规则不必真等 60 秒 */
type SessionDriver = { update: (deltaTime: number) => void };

/**
 * 开发期自检：预览启动后脚本化地打一局，把每条验收结论打到控制台（前缀 [SELFTEST]）。
 *
 * 为什么需要它：单局页在启动时是隐藏的，页面内组件的 onLoad 不会执行，
 * 靠"启动无报错"证明不了任何东西；而 Game View 面板又截不到图、
 * 编辑态脚本也点不到运行中的按钮。让游戏自己点自己，是唯一可靠的运行时验证通道。
 *
 * 时间怎么走：真实帧照常推进，另外用 GameSession.update(秒) 手动补时——
 * 走的仍是"核心推进 → 事件 → 视图重绘"这条真链路，只是不必真等 60 秒。
 *
 * 只做验证、不参与玩法；12 号切片（上线构建）前整个 debug 目录一起删掉。
 */
@ccclass('SelfCheck')
export class SelfCheck extends Component {
  private readonly results: string[] = [];
  /** 自检自己打出来的战绩：用来核对界面上的数字，不把期望值写死 */
  private servedCount = 0;
  private streak = 0;
  private bestStreak = 0;
  /** 开局时的最高分，用来判断这一局有没有破纪录 */
  private bestAtBoot = 0;

  protected async start(): Promise<void> {
    await wait(600);
    try {
      await this.run();
    } catch (error) {
      this.check('自检未抛异常', false, String(error));
    }
    this.report();
    this.backToStartPage();
  }

  private async run(): Promise<void> {
    const canvas = director.getScene()?.getChildByName('Canvas');
    if (!canvas) {
      this.check('能拿到 Canvas 节点', false);
      return;
    }

    const pages = canvas.getChildByName('Pages');
    const gamePage = pages?.getChildByName('GamePage') ?? null;
    const resultPage = pages?.getChildByName('ResultPage') ?? null;
    const startButton = findNode(canvas, 'StartButton');
    this.check('场景结构完整（GamePage 与开始按钮都在）', gamePage !== null && startButton !== null);
    if (!gamePage) return;

    const session = gamePage.getComponent('GameSession') as unknown as SessionDriver | null;
    this.check('单局页挂着 GameSession（时间由它推进）', session !== null);

    // 切页与开局都由组合根负责：自检要反复进单局（验证背景每局重抽）就得走它
    const gameRoot = canvas.getComponent('GameRoot') as unknown as {
      showStart(): void;
      showGame(): void;
    } | null;
    this.check('Canvas 挂着 GameRoot（切页与开局的入口）', gameRoot !== null);

    // ⓪ 开始页的最高分与本地存储对得上——"刷新浏览器后最高分仍在"靠的就是这条
    const startPage = pages?.getChildByName('StartPage') ?? null;
    this.bestAtBoot = readBestScore();
    this.check(
      '开始页最高分与本地存储一致',
      numberIn(labelText(startPage, 'BestScore')) === this.bestAtBoot,
      `页面=${labelText(startPage, 'BestScore')} 存储=${this.bestAtBoot}`,
    );

    // ⓪′ 背景层：开始页应当是压暗的
    this.check('开始页把背景压暗', backgroundState(canvas).dimmed === true);

    // ① 点"开摊"：走真实按钮事件，顺带验证 GameRoot 的绑定
    emitClick(startButton);
    await wait(120);

    this.check('点开摊后进入单局页', gamePage.active);
    this.check('开始页已隐藏', findNode(canvas, 'StartPage')?.active === false);

    // 订单卡改用图标行展示，节点名形如 Icon_<id>_<index>；自检从图标行读回所需配料
    const orderIconsNode = findNode(gamePage, 'OrderIcons');
    const bowlLabel = findLabel(gamePage, 'BowlItems');

    // ② 订单是否渲染成"1 汤底 + 3 小料"
    const requiredNames = orderRequiredNames(orderIconsNode);
    this.check('订单渲染为 1 汤底 + 3 小料', requiredNames.length === 4, requiredNames.join('|'));
    this.check('碗初始为空碗', (bowlLabel?.string ?? '') === '空碗', bowlLabel?.string ?? '');

    // ③ 倒计时起步：数字 60，且进度条与数字取自同一次状态
    this.check('开局倒计时显示 60', countdownSeconds(gamePage) === 60, countdownText(gamePage));
    this.check('进度条比例与倒计时数字一致', barMatchesCountdown(gamePage), barDetail(gamePage));

    session?.update(2);
    const afterTwoSeconds = countdownSeconds(gamePage);
    this.check('倒计时随时间递减', afterTwoSeconds <= 58 && afterTwoSeconds >= 56, countdownText(gamePage));
    this.check('递减后进度条仍与数字一致', barMatchesCountdown(gamePage), barDetail(gamePage));

    // ③‴ 告警段之前：倒计时是常态色、也没有被放大——"变红脉冲"只属于最后 10 秒
    this.check(
      '10 秒之前倒计时不变红、不脉冲',
      labelHasColor(gamePage, 'CountdownLabel', UI_COLOR.textAccent) && countdownScale(gamePage) === 1,
      `颜色=${countdownColorText(gamePage)} 缩放=${countdownScale(gamePage)}`,
    );

    // ③′ 排版：Game View 截不到图，重叠与越界只能靠节点包围盒来兜
    this.checkHudLayout(canvas, gamePage);

    // ③″ 背景：单局里不压暗；图要铺满 720x1280，且图源本身就是 9:16（拉满不变形）
    // 先等这一局的图落定再取样：背景是异步加载的，新图到手前屏幕上还是上一张（有意为之，避免闪空）
    const roundBackground = await this.settleBackground(canvas);
    this.check('单局中背景不压暗', roundBackground.dimmed === false);
    this.check('背景图已加载', roundBackground.frame !== null, roundBackground.name);
    this.check(
      '背景铺满 720x1280',
      roundBackground.width === SCREEN_WIDTH && roundBackground.height === SCREEN_HEIGHT,
      describeBackground(roundBackground),
    );
    this.check('背景图源比例是 9:16（拉满不变形）', roundBackground.ratioKept, describeBackground(roundBackground));

    // ④ 故意反序点击，验证"集合匹配与放入顺序无关"；最后一下凑齐即出餐
    const tray = findNode(gamePage, 'TrayArea');
    const scoreBeforeServe = numberIn(hudText(gamePage));
    for (const name of [...requiredNames].reverse()) {
      emitClick(findSlotByName(tray, name));
      await wait(30);
    }
    this.countServe();

    // ④′ 出餐反馈：碗口上方飘出的得分，必须等于核心给出的本单得分（HUD 分数增量就是它）
    const servedScore = numberIn(hudText(gamePage)) - scoreBeforeServe;
    const floatedScore = numberIn(newestLabelText(gamePage, 'ScoreFloatText'));
    this.check('出餐时碗口上方飘出得分', findNode(gamePage, 'ScoreFloat') !== null);
    this.check(
      '得分飘字数值与核心给出的本单得分一致',
      servedScore > 0 && floatedScore === servedScore,
      `飘字=${floatedScore} 本单=${servedScore}`,
    );
    this.check('1 连出餐不冒"够劲！"', findNode(gamePage, 'ComboShout') === null);

    // ⑤ 出餐过渡（0.4 秒）期间计时暂停：同步补时 0.3 秒，倒计时数值必须一动不动
    const frozen = countdownSeconds(gamePage);
    session?.update(0.3);
    this.check('出餐过渡的 0.4 秒内倒计时数值不变', countdownSeconds(gamePage) === frozen, `${frozen} -> ${countdownSeconds(gamePage)}`);

    // 等过出餐过渡——新顾客与他的订单是在过渡结束那一刻才生成的
    await wait(700);

    this.check('凑齐后自动出餐（碗已清空）', (bowlLabel?.string ?? '') === '空碗', bowlLabel?.string ?? '');
    this.check('完成订单数变为 1', hudText(gamePage).includes('完成订单 1'), hudText(gamePage));
    this.check('分数已增长', !hudText(gamePage).includes('分数 0'), hudText(gamePage));

    const nextOrderNames = orderRequiredNames(orderIconsNode);
    this.check('已换下一位顾客（订单变化）', nextOrderNames.join('|') !== requiredNames.join('|'));

    // ⑥ 错放：点一个不在订单里的配料，碗必须仍是空的；连击清零、红闪出现、倒计时扣 3 秒
    const outsiderName = firstOutsider(tray, nextOrderNames);
    const beforeMisdrop = countdownSeconds(gamePage);
    emitClick(findSlotByName(tray, outsiderName));
    this.countMisdrop();
    await wait(60);
    this.check('点订单外的配料不会进碗', (bowlLabel?.string ?? '') === '空碗', bowlLabel?.string ?? '');
    this.check('错放后连击清零（界面同步归零）', hudText(gamePage).includes('连击 0'), hudText(gamePage));
    this.check('错放后红闪反馈出现', findNode(gamePage, 'MisdropFlash')?.active === true);
    const misdropDrop = beforeMisdrop - countdownSeconds(gamePage);
    this.check('错放扣时 3 秒（倒计时立刻减少）', misdropDrop >= 2 && misdropDrop <= 4, `${beforeMisdrop} -> ${countdownSeconds(gamePage)}`);

    // ⑥′ 拖拽：高亮、落碗接受、落碗外不收。松手判定在适配层，
    // 自检直接以世界坐标驱动总线事件，走的仍是"适配层判定 → 核心放入 → 视图重绘"这条真链路。
    const bowlCenter = worldCenter(findNode(gamePage, 'BowlArea'));
    const trayPoint = worldCenter(findNode(gamePage, 'TrayArea'));

    bus.emit(BusEvent.DragMoved, { x: bowlCenter.x, y: bowlCenter.y });
    this.check('拖到碗上时碗区高亮', findNode(gamePage, 'BowlHighlight')?.active === true);

    bus.emit(BusEvent.DragMoved, trayPoint);
    this.check('拖回配料盘时高亮熄灭', findNode(gamePage, 'BowlHighlight')?.active === false);

    // ⑥″ 拖拽错放：把订单外的配料拖进碗，碗不变、红闪出现、倒计时再减 3 秒、连击保持 0
    const beforeDragMis = countdownSeconds(gamePage);
    const dragOutsiderId = ingredientIdByName(firstOutsider(tray, nextOrderNames));
    bus.emit(BusEvent.DragEnded, { ingredientId: dragOutsiderId, x: bowlCenter.x, y: bowlCenter.y });
    await wait(60);
    this.check('拖拽错放：订单外配料不进碗', (bowlLabel?.string ?? '') === '空碗', bowlLabel?.string ?? '');
    this.check('拖拽错放：红闪反馈出现', findNode(gamePage, 'MisdropFlash')?.active === true);
    const dragMisDrop = beforeDragMis - countdownSeconds(gamePage);
    this.check('拖拽错放：倒计时再减 3 秒', dragMisDrop >= 2 && dragMisDrop <= 4, `${beforeDragMis} -> ${countdownSeconds(gamePage)}`);
    this.check('拖拽错放：连击仍为 0', hudText(gamePage).includes('连击 0'), hudText(gamePage));

    const dragInName = nextOrderNames[1] ?? '';
    const dragInId = ingredientIdByName(dragInName);
    bus.emit(BusEvent.DragEnded, { ingredientId: dragInId, x: bowlCenter.x, y: bowlCenter.y });
    await wait(30);
    // 碗里放的东西从 08 切片起改用图标行展示（不再有文字），所以这里读图标行而不是标签
    this.check('拖进碗里的配料被接受', bowlIconIds(gamePage).includes(dragInId), bowlIconIds(gamePage).join('|'));
    this.check('拖入后已放进度为 1', numberIn(labelText(gamePage, 'ProgressLine')) === 1, labelText(gamePage, 'ProgressLine'));

    // ⑥⁗ 订单卡："还差哪几项"靠已放入的打勾变暗来表达，未放入的保持原样
    const placedIcon = orderIconFor(orderIconsNode, ingredientIdByName(dragInName));
    this.check('订单卡把已放入的项打勾变暗', isIconChecked(placedIcon), describeOrderIcon(placedIcon));
    const pendingIcons = nextOrderNames
      .filter((name) => name !== dragInName)
      .map((name) => orderIconFor(orderIconsNode, ingredientIdByName(name)));
    this.check(
      '订单卡里还没放进碗的项保持原样',
      pendingIcons.length > 0 && pendingIcons.every((icon) => icon !== null && !isIconChecked(icon)),
      `${pendingIcons.length} 项待放入，其中误标 ${pendingIcons.filter((icon) => isIconChecked(icon)).length} 项`,
    );

    // ⑥‴ 重复放入：碗里已有时再放一次，核心走 rejected，界面无任何变化（碗不变、不扣时、不红闪）
    const beforeDup = bowlIconIds(gamePage).join('|');
    const beforeDupCountdown = countdownSeconds(gamePage);
    emitClick(findSlotByName(tray, dragInName));
    await wait(60);
    this.check('重复放入同一配料：碗内容不变', bowlIconIds(gamePage).join('|') === beforeDup, beforeDup);
    this.check('重复放入同一配料：不扣时（无错放）', countdownSeconds(gamePage) === beforeDupCountdown, `${beforeDupCountdown} -> ${countdownSeconds(gamePage)}`);

    const dragOutName = nextOrderNames[2] ?? '';
    bus.emit(BusEvent.DragEnded, { ingredientId: ingredientIdByName(dragOutName), x: trayPoint.x, y: trayPoint.y });
    await wait(30);
    this.check(
      '松手在碗外的配料不被接受（进度不变）',
      numberIn(labelText(gamePage, 'ProgressLine')) === 1,
      labelText(gamePage, 'ProgressLine'),
    );
    this.check('松手后高亮熄灭', findNode(gamePage, 'BowlHighlight')?.active === false);

    // ⑦ 难度换档：越过配置里的分段点之后，新订单的小料数按曲线走
    // （断言名沿用验收里的"20 秒 / 40 秒"，期望值则从曲线算，改数值配置不会被写死的期望卡住）
    session?.update(DIFFICULTY_STAGES[0].untilMs / 1000 + 1);
    await this.serveOrder(tray, orderRequiredNames(orderIconsNode));
    await wait(700);
    const stage2Names = orderRequiredNames(orderIconsNode);
    this.check(
      '20 秒后新订单要 4 种小料',
      stage2Names.length === DIFFICULTY_STAGES[1].toppingCount + 1,
      stage2Names.join('|'),
    );

    session?.update((DIFFICULTY_STAGES[1].untilMs - DIFFICULTY_STAGES[0].untilMs) / 1000 + 1);
    await this.serveOrder(tray, stage2Names);
    this.check('2 连仍不冒"够劲！"', findNode(gamePage, 'ComboShout') === null);
    await wait(700);
    const stage3Names = orderRequiredNames(orderIconsNode);
    this.check(
      '40 秒后新订单要 5 种小料',
      stage3Names.length === DIFFICULTY_STAGES[2].toppingCount + 1,
      stage3Names.join('|'),
    );
    this.check('换档后进度条仍与数字一致', barMatchesCountdown(gamePage), barDetail(gamePage));

    // ⑦′ 连击喊话：这一单是第三连，该冒出"够劲！"了（前两单的"不冒"在上面已核对）
    await this.serveOrder(tray, stage3Names);
    this.check(
      '3 连冒出"够劲！"',
      findNode(gamePage, 'ComboShout') !== null && newestLabelText(gamePage, 'ComboShoutText') === STRINGS.comboShout,
      newestLabelText(gamePage, 'ComboShoutText'),
    );

    // ⑦″ 最后 10 秒：数字与进度条一起转红，数字开始脉冲
    // （"每局只触发一次"由核心的 warned 保证，这里核对表现：一直亮着、且动画没被反复重启）
    this.check('最后 10 秒倒计时变红', labelHasColor(gamePage, 'CountdownLabel', UI_COLOR.countdownWarning), countdownColorText(gamePage));
    const pulseMax = await this.maxCountdownScale(gamePage);
    this.check('最后 10 秒倒计时在脉冲', pulseMax > 1.02, `采样到的最大缩放=${pulseMax.toFixed(3)}`);

    // ⑧ 时间归零：自动进结算页；此后再点配料不得有任何反应
    session?.update(60);
    await wait(80);
    this.check('时间归零自动进入结算页', resultPage?.active === true && gamePage.active === false);
    this.check('归零后倒计时显示 0', countdownSeconds(gamePage) === 0, countdownText(gamePage));

    const hudBeforeFinished = hudText(gamePage);
    emitClick(findSlotByName(tray, stage3Names[0] ?? ''));
    await wait(80);
    this.check('归零后点击配料不再改变单局状态', hudText(gamePage) === hudBeforeFinished, hudText(gamePage));
    this.check('归零后仍停在结算页', resultPage?.active === true && gamePage.active === false);

    // ⑨ 结算页：三个数来自核心的 finished 事件，最高分只增不减地落盘
    const finalScore = numberIn(hudText(gamePage));
    const resultScore = numberIn(labelText(resultPage, 'ScoreLine'));
    const resultOrders = numberIn(labelText(resultPage, 'OrdersLine'));
    const resultCombo = numberIn(labelText(resultPage, 'ComboLine'));
    const resultBest = numberIn(labelText(resultPage, 'BestLine'));
    this.check(
      '结算页三项数值与当局一致',
      resultScore === finalScore && resultOrders === this.servedCount && resultCombo === this.bestStreak,
      `结算页=${resultScore}/${resultOrders}/${resultCombo} 当局=${finalScore}/${this.servedCount}/${this.bestStreak}`,
    );
    this.check(
      '最高分已写入本地存储',
      readBestScore() === Math.max(this.bestAtBoot, finalScore),
      `存储=${readBestScore()} 开局时=${this.bestAtBoot} 本局=${finalScore}`,
    );
    this.check('结算页最高分与存储一致', resultBest === readBestScore(), `结算页=${resultBest} 存储=${readBestScore()}`);

    // ⑨′ 背景：结算页压暗，且这一局自始至终是同一张
    this.check('结算页把背景压暗', backgroundState(canvas).dimmed === true);
    this.check(
      '同一局内背景不切换',
      backgroundState(canvas).name === roundBackground.name,
      `${roundBackground.name} -> ${backgroundState(canvas).name}`,
    );

    // ⑩ "再来一碗"：单局状态必须全部复位
    emitClick(findNode(resultPage, 'RestartButton'));
    await wait(80);
    this.check('点再来一碗回到单局页', gamePage.active && resultPage?.active === false);
    const freshHud = hudText(gamePage);
    this.check(
      '重开后分数、完成订单、连击全部复位',
      freshHud.includes('分数 0') && freshHud.includes('完成订单 0') && freshHud.includes('连击 0'),
      freshHud,
    );
    this.check('重开后倒计时回到 60', countdownSeconds(gamePage) === 60, countdownText(gamePage));
    this.check('重开后碗是空的', (bowlLabel?.string ?? '') === '空碗', bowlLabel?.string ?? '');
    const freshOrder = orderRequiredNames(orderIconsNode);
    this.check('重开后是新的 1 汤底 + 3 小料订单', freshOrder.length === 4, freshOrder.join('|'));
    // 上一局末尾倒计时正红着脉冲，新一局必须把它按回常态
    this.check(
      '重开后倒计时恢复常态（不变红、不脉冲）',
      labelHasColor(gamePage, 'CountdownLabel', UI_COLOR.textAccent) && countdownScale(gamePage) === 1,
      `颜色=${countdownColorText(gamePage)} 缩放=${countdownScale(gamePage)}`,
    );

    // ⑩′ 连击链断了就不该再"够劲"：新一局时间充裕，正好把连击这条线走完整——
    // 先连出 3 单（够劲出现），再错放断连击，紧接着的那一单不许再冒
    await this.serveOrder(tray, orderRequiredNames(orderIconsNode));
    this.check('重开一局后连击从 1 数起', hudText(gamePage).includes('连击 1'), hudText(gamePage));
    await wait(700);

    // 第二单带上连击加分：飘字数值仍要等于核心给的分数增量，说明飘的是本单总分而不是写死的数
    const beforeComboServe = numberIn(hudText(gamePage));
    await this.serveOrder(tray, orderRequiredNames(orderIconsNode));
    const comboScore = numberIn(hudText(gamePage)) - beforeComboServe;
    const comboFloat = numberIn(newestLabelText(gamePage, 'ScoreFloatText'));
    this.check(
      '带连击加分的单，飘字数值仍与核心一致',
      comboScore > 0 && comboFloat === comboScore,
      `飘字=${comboFloat} 本单=${comboScore}`,
    );
    this.check('2 连仍不冒"够劲！"', findNode(gamePage, 'ComboShout') === null);
    await wait(700);

    await this.serveOrder(tray, orderRequiredNames(orderIconsNode));
    this.check(
      '3 连冒出"够劲！"',
      findNode(gamePage, 'ComboShout') !== null && newestLabelText(gamePage, 'ComboShoutText') === STRINGS.comboShout,
      newestLabelText(gamePage, 'ComboShoutText'),
    );
    // 等"够劲！"自己演完再断连击，确保后面看到的"没有"不是残留
    this.check('"够劲！"是短促过场（会自己消失）', await this.waitUntilGone(gamePage, 'ComboShout', 1500));

    emitClick(findSlotByName(tray, firstOutsider(tray, orderRequiredNames(orderIconsNode))));
    await wait(60);
    this.check('错放断连击（界面连击归零）', hudText(gamePage).includes('连击 0'), hudText(gamePage));
    await this.serveOrder(tray, orderRequiredNames(orderIconsNode));
    this.check('错放断连击后不再冒"够劲！"', findNode(gamePage, 'ComboShout') === null);

    // ⑩″ 背景每局重抽：连进 8 次单局，看抽到几张不同的（背景是异步加载，每次让出一小段时间）
    const pickedBackgrounds = new Set<string>();
    for (let i = 0; i < 8; i++) {
      gameRoot?.showGame();
      await wait(60);
      pickedBackgrounds.add(backgroundState(canvas).name);
    }
    this.check('每局重新抽背景（8 局抽到多张）', pickedBackgrounds.size >= 2, Array.from(pickedBackgrounds).join(','));

    // ⑪ 回开始页：刚打出的最高分立刻看得见，背景也要重新压暗
    // （压暗曾经由 onLoad / 单局结束 / 开局三处拼出来，回开始页这一路漏了——现在压暗只有一个来源）
    gameRoot?.showStart();
    await wait(80);
    this.check(
      '回到开始页显示最新最高分',
      numberIn(labelText(startPage, 'BestScore')) === readBestScore(),
      `${labelText(startPage, 'BestScore')} 存储=${readBestScore()}`,
    );
    this.check('回到开始页背景重新压暗', backgroundState(canvas).dimmed === true, describeBackground(backgroundState(canvas)));
  }

  /** 自检自己点出来的战绩：只用来核对界面 */
  private countServe(): void {
    this.servedCount += 1;
    this.streak += 1;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
  }

  private countMisdrop(): void {
    this.streak = 0;
  }

  /** 按名字点完一份订单的全部配料：点满最后一份即自动出餐 */
  private async serveOrder(tray: Node | null, names: readonly string[]): Promise<void> {
    for (const name of names) {
      emitClick(findSlotByName(tray, name));
      await wait(30);
    }
    this.countServe();
  }

  /**
   * 采样一小会儿倒计时的缩放并返回最大值。
   * 脉冲是一个来回 0.7 秒的循环，采样窗口盖住它一多半，采不到放大就说明动画没在走
   * （比如被每帧重新启动、按在原地）。
   */
  private async maxCountdownScale(gamePage: Node): Promise<number> {
    let max = 0;
    for (let i = 0; i < 6; i++) {
      max = Math.max(max, countdownScale(gamePage));
      await wait(80);
    }
    return max;
  }

  /** 等某个用完即焚的反馈节点自己消失：超时仍没消失返回 false */
  private async waitUntilGone(root: Node, name: string, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!findNode(root, name)) return true;
      await wait(100);
    }
    return findNode(root, name) === null;
  }

  /**
   * 等背景落定后再取样：新图是异步加载的，还没到手时屏幕上仍留着上一张（避免闪空，有意为之），
   * 所以先让出一个加载窗口，再看连续两次采样是否一致。一致才算这一局的图已经到位，拿它当基准；
   * 之后整局都不该再变——⑨′ 再采一次对比就是"同一局内不切换"。
   *
   * 已知边界：实测请求到回调 150~450ms（编辑器忙时会慢些）。窗口 800ms 加之后每 200ms 一次采样，
   * 能容忍约 1.2 秒以内的加载；再慢就会把"还在加载"误判成"已落定"，这条断言会假失败。
   * 真要根治得让 BackgroundView 报出"本局抽到哪张"（或给回调加序号丢弃过期结果），那属于 09 的范围。
   */
  private async settleBackground(
    canvas: Node,
    loadWindowMs = 800,
    timeoutMs = 2500,
  ): Promise<ReturnType<typeof backgroundState>> {
    await wait(loadWindowMs);
    let current = backgroundState(canvas);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await wait(200);
      const next = backgroundState(canvas);
      const settled = next.frame !== null && next.name === current.name;
      current = next;
      if (settled) return current;
    }
    return current;
  }

  /**
   * 排版断言：顶部三行（倒计时 / 进度条 / 分数行）必须都落在画布内，
   * 且不能与下面的订单卡标题打架——这是"截图看不到内容"时唯一能自动守住的东西。
   */
  private checkHudLayout(canvas: Node, gamePage: Node): void {
    const hudBoxes = ['CountdownLabel', 'CountdownBar', 'HudLine'].map((name) => ({
      name,
      box: worldBox(findNode(gamePage, name)),
    }));
    const canvasBox = worldBox(canvas);

    const inside = hudBoxes.every((item) => item.box !== null && canvasBox !== null && contains(canvasBox, item.box));
    this.check('顶部三行都在屏幕内', inside, hudBoxes.map((item) => `${item.name}=${describeBox(item.box)}`).join(' '));

    const cardTitle = worldBox(findNode(gamePage, 'CardTitle'));
    const collided = hudBoxes.filter((item) => item.box && cardTitle && overlaps(item.box, cardTitle));
    this.check('顶部三行与订单卡标题互不重叠', collided.length === 0, collided.map((item) => item.name).join(',') || '无');

    // 进度条填充靠"缩放 + 位移"从左侧收短：左端必须始终贴着底槽，不能被缩放到槽外
    const trackBox = worldBox(findNode(gamePage, 'CountdownBar'));
    const fillBox = worldBox(findNode(gamePage, 'CountdownBarFill'));
    this.check(
      '进度条填充没越出底槽',
      trackBox !== null && fillBox !== null && contains(trackBox, fillBox),
      `底槽=${describeBox(trackBox)} 填充=${describeBox(fillBox)}`,
    );
  }

  private check(name: string, ok: boolean, detail = ''): void {
    this.results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
  }

  private report(): void {
    const passed = this.results.filter((line) => line.startsWith('PASS')).length;
    console.log(`[SELFTEST] begin, total=${this.results.length}`);
    this.results.forEach((line) => console.log(`[SELFTEST] ${line}`));
    console.log(`[SELFTEST] done ${passed}/${this.results.length}`);
  }

  /** 自检把人放到单局页了，结束时要还回开始页，免得看着奇怪 */
  private backToStartPage(): void {
    const canvas = director.getScene()?.getChildByName('Canvas');
    const gameRoot = canvas?.getComponent('GameRoot') as { showStart?: () => void } | null;
    gameRoot?.showStart?.();
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 在子节点里按名字递归找人（视图是运行时建的，只能按名字找）。
 * `newest` 为真时从后往前找：用完即焚的反馈（得分飘字、喊话）在销毁当帧还留在 children 里，
 * 正着找会先撞上旧的那个，反向找才是刚建出来的这个。
 */
function findNode(root: Node | null | undefined, name: string, newest = false): Node | null {
  if (!root) return null;
  if (root.name === name) return root;
  const children = root.children;
  for (let index = 0; index < children.length; index++) {
    const hit = findNode(children[newest ? children.length - 1 - index : index], name, newest);
    if (hit) return hit;
  }
  return null;
}

function findLabel(root: Node | null | undefined, name: string): Label | null {
  const node = findNode(root, name);
  return node ? node.getComponent(Label) : null;
}

/** 点按钮：直接触发按钮节点的 CLICK 事件，等价于玩家点击，但不需要真实鼠标 */
function emitClick(node: Node | null): void {
  if (!node) return;
  node.emit(Button.EventType.CLICK);
}

/** 从订单卡图标行读出所需配料的中文名数组 */
function orderRequiredNames(orderIcons: Node | null): string[] {
  return iconRowIds(orderIcons).map(ingredientName);
}

/** 取最新那个同名标签上的文本 */
function newestLabelText(root: Node | null, name: string): string {
  return findNode(root, name, true)?.getComponent(Label)?.string ?? '';
}

/** 碗里当前的配料 id：碗用图标行展示，从那里读回 */
function bowlIconIds(gamePage: Node | null): string[] {
  return iconRowIds(findNode(gamePage, 'BowlIcons'));
}

/** 从图标行读回配料 id 数组（图标行按 Icon_<id>_<index> 命名，碗与订单卡共用这套命名） */
function iconRowIds(row: Node | null): string[] {
  if (!row) return [];
  return row.children
    .filter((child) => child.name.startsWith('Icon_'))
    .map((child) => /^Icon_(.+?)_\d+$/.exec(child.name)?.[1] ?? '')
    .filter((id) => id.length > 0);
}

/** 订单卡上某个配料的图标节点：图标行按 Icon_<id>_<index> 命名。从后往前找——重绘时旧图标先被销毁但本帧还在 children 里 */
function orderIconFor(orderIcons: Node | null, id: string): Node | null {
  const children = orderIcons?.children ?? [];
  for (let i = children.length - 1; i >= 0; i--) {
    if (children[i].name.startsWith(`Icon_${id}_`)) return children[i];
  }
  return null;
}

/** 订单卡的图标是否已打勾变暗：勾是子节点，暗是精灵本体的 alpha；"明显压暗"才算，不能只看差一点 */
function isIconChecked(icon: Node | null): boolean {
  if (!icon || !icon.getChildByName('OrderCheck')) return false;
  const sprite = icon.getComponent(Sprite);
  return !!sprite && sprite.color.a < 200;
}

function describeOrderIcon(icon: Node | null): string {
  if (!icon) return '无图标';
  const sprite = icon.getComponent(Sprite);
  return `${icon.name} 勾=${icon.getChildByName('OrderCheck') ? '有' : '无'} alpha=${sprite ? sprite.color.a : '无精灵'}`;
}

/** 配料盘的格子：中文名与节点成对取出，按名字找与找"订单外的那个"都基于它 */
function traySlots(tray: Node | null): { name: string; node: Node }[] {
  const slots: { name: string; node: Node }[] = [];
  for (const slot of tray?.children ?? []) {
    const label = slot.getChildByName('Name')?.getComponent(Label);
    if (label) slots.push({ name: label.string, node: slot });
  }
  return slots;
}

/** 在配料盘里按中文名找格子 */
function findSlotByName(tray: Node | null, ingredientName: string): Node | null {
  return traySlots(tray).find((slot) => slot.name === ingredientName)?.node ?? null;
}

/** 找一个不在订单里的配料名，用来制造错放 */
function firstOutsider(tray: Node | null, orderNames: readonly string[]): string {
  return traySlots(tray).find((slot) => !orderNames.includes(slot.name))?.name ?? '';
}

/** 节点的世界坐标中心点：给拖拽自检当"碗中心"用 */
function worldCenter(node: Node | null): { x: number; y: number } {
  const world = node?.worldPosition ?? new Vec3();
  return { x: world.x, y: world.y };
}

/** 配料中文名 → id：拖拽事件的载荷用的是 id */
function ingredientIdByName(ingredientName: string): string {
  return ALL_INGREDIENTS.find((item) => item.name === ingredientName)?.id ?? '';
}

/** 取某个节点上的标签文本 */
function labelText(root: Node | null, name: string): string {
  return findLabel(root, name)?.string ?? '';
}

function hudText(root: Node | null): string {
  return labelText(root, 'HudLine');
}

function countdownText(root: Node | null): string {
  return labelText(root, 'CountdownLabel');
}

/** 从"倒计时 58"里取回 58；读不到返回 -1 */
function countdownSeconds(root: Node | null): number {
  return numberIn(countdownText(root), true);
}

/** 倒计时标签当前的横向缩放：脉冲是否在走看它 */
function countdownScale(root: Node | null): number {
  return findNode(root, 'CountdownLabel')?.scale.x ?? -1;
}

/** 某个标签当前的颜色是不是指定值（核对"最后 10 秒变红"这类表现） */
function labelHasColor(root: Node | null, name: string, color: { r: number; g: number; b: number }): boolean {
  const label = findLabel(root, name);
  return !!label && label.color.r === color.r && label.color.g === color.g && label.color.b === color.b;
}

/** 倒计时标签当前颜色的可读表示，断言失败时打出来 */
function countdownColorText(root: Node | null): string {
  const label = findLabel(root, 'CountdownLabel');
  return label ? describeColor(label.color) : 'none';
}

function describeColor(color: { r: number; g: number; b: number }): string {
  return `(${color.r},${color.g},${color.b})`;
}

/** 取文本里的数字；fromEnd=true 时取末尾那个（"前缀 + 数字"这类行） */
function numberIn(text: string, fromEnd = false): number {
  const matched = (fromEnd ? /(\d+)\s*$/ : /(\d+)/).exec(text);
  return matched ? Number(matched[1]) : -1;
}

/** 进度条填充的横向缩放就是剩余比例（HudView 约定的表示方式） */
function barRatio(root: Node | null): number {
  return findNode(root, 'CountdownBarFill')?.scale.x ?? -1;
}

/** 数字与进度条都来自同一次状态，允许 1 秒的取整误差 */
function barMatchesCountdown(root: Node | null): boolean {
  const ratio = barRatio(root);
  const seconds = countdownSeconds(root);
  if (ratio < 0 || seconds < 0) return false;
  return Math.abs(ratio * (ROUND_DURATION_MS / 1000) - seconds) <= 1;
}

function barDetail(root: Node | null): string {
  return `bar=${barRatio(root).toFixed(3)} countdown=${countdownText(root)}`;
}

/** 节点在画布坐标系里的包围盒（世界坐标，y 向上） */
interface WorldBox {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

function worldBox(node: Node | null): WorldBox | null {
  const transform = node?.getComponent(UITransform);
  if (!transform) return null;
  const box = transform.getBoundingBoxToWorld();
  return { left: box.x, right: box.x + box.width, bottom: box.y, top: box.y + box.height };
}

function contains(outer: WorldBox, inner: WorldBox): boolean {
  return inner.left >= outer.left && inner.right <= outer.right && inner.bottom >= outer.bottom && inner.top <= outer.top;
}

function overlaps(a: WorldBox, b: WorldBox): boolean {
  return a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top;
}

function describeBox(box: WorldBox | null): string {
  return box ? `${Math.round(box.left)},${Math.round(box.bottom)}~${Math.round(box.right)},${Math.round(box.top)}` : 'none';
}

/** 背景层当前的可见状态：自检用它核对表现，不参与玩法 */
function backgroundState(canvas: Node | null): {
  frame: Sprite['spriteFrame'];
  name: string;
  width: number;
  height: number;
  ratioKept: boolean;
  dimmed: boolean;
} {
  const image = findNode(canvas, 'BackgroundImage');
  const transform = image?.getComponent(UITransform);
  const frame = image?.getComponent(Sprite)?.spriteFrame ?? null;
  return {
    frame,
    name: frame?.name ?? 'none',
    width: transform?.width ?? -1,
    height: transform?.height ?? -1,
    // 铺满 720x1280 时，只有图源同样是 9:16 才不会变形（差一点点肉眼看不出，留 1% 容差）
    ratioKept: !!frame && frame.height > 0 && Math.abs(frame.width / frame.height - SCREEN_WIDTH / SCREEN_HEIGHT) < 0.01,
    dimmed: findNode(canvas, 'BackgroundDim')?.active ?? false,
  };
}

function describeBackground(state: ReturnType<typeof backgroundState>): string {
  return `${state.name} ${state.width}x${state.height} 压暗=${state.dimmed}`;
}
