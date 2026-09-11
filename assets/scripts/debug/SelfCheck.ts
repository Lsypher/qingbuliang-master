import { _decorator, Button, Component, Label, Node, UITransform, director } from 'cc';
import { DIFFICULTY_STAGES, ROUND_DURATION_MS } from '../config/balance';
import { readBestScore } from '../game/bestScore';

const { ccclass } = _decorator;

/** 自检唯一需要伸进去的手：手动推一把时间，让 60 秒的规则不必真等 60 秒 */
type TimeDriver = { update: (deltaTime: number) => void };

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

    const session = gamePage.getComponent('GameSession') as unknown as TimeDriver | null;
    this.check('单局页挂着 GameSession（时间由它推进）', session !== null);

    // ⓪ 开始页的最高分与本地存储对得上——"刷新浏览器后最高分仍在"靠的就是这条
    const startPage = pages?.getChildByName('StartPage') ?? null;
    this.bestAtBoot = readBestScore();
    this.check(
      '开始页最高分与本地存储一致',
      numberIn(labelText(startPage, 'BestScore')) === this.bestAtBoot,
      `页面=${labelText(startPage, 'BestScore')} 存储=${this.bestAtBoot}`,
    );

    // ① 点"开摊"：走真实按钮事件，顺带验证 GameRoot 的绑定
    emitClick(startButton);
    await wait(120);

    this.check('点开摊后进入单局页', gamePage.active);
    this.check('开始页已隐藏', findNode(canvas, 'StartPage')?.active === false);

    const orderLabel = findLabel(gamePage, 'OrderLine');
    const bowlLabel = findLabel(gamePage, 'BowlItems');

    // ② 订单是否渲染成"1 汤底 + 3 小料"
    const requiredNames = splitOrder(orderLabel?.string ?? '');
    this.check('订单渲染为 1 汤底 + 3 小料', requiredNames.length === 4, requiredNames.join('|'));
    this.check('碗初始为空碗', (bowlLabel?.string ?? '') === '空碗', bowlLabel?.string ?? '');

    // ③ 倒计时起步：数字 60，且进度条与数字取自同一次状态
    this.check('开局倒计时显示 60', countdownSeconds(gamePage) === 60, countdownText(gamePage));
    this.check('进度条比例与倒计时数字一致', barMatchesCountdown(gamePage), barDetail(gamePage));

    session?.update(2);
    const afterTwoSeconds = countdownSeconds(gamePage);
    this.check('倒计时随时间递减', afterTwoSeconds <= 58 && afterTwoSeconds >= 56, countdownText(gamePage));
    this.check('递减后进度条仍与数字一致', barMatchesCountdown(gamePage), barDetail(gamePage));

    // ③′ 排版：Game View 截不到图，重叠与越界只能靠节点包围盒来兜
    this.checkHudLayout(canvas, gamePage);

    // ④ 故意反序点击，验证"集合匹配与放入顺序无关"；最后一下凑齐即出餐
    const tray = findNode(gamePage, 'TrayArea');
    for (const name of [...requiredNames].reverse()) {
      emitClick(findSlotByName(tray, name));
      await wait(30);
    }
    this.countServe();

    // ⑤ 出餐过渡（0.4 秒）期间计时暂停：同步补时 0.3 秒，倒计时数值必须一动不动
    const frozen = countdownSeconds(gamePage);
    session?.update(0.3);
    this.check('出餐过渡的 0.4 秒内倒计时数值不变', countdownSeconds(gamePage) === frozen, `${frozen} -> ${countdownSeconds(gamePage)}`);

    // 等过出餐过渡——新顾客与他的订单是在过渡结束那一刻才生成的
    await wait(700);

    this.check('凑齐后自动出餐（碗已清空）', (bowlLabel?.string ?? '') === '空碗', bowlLabel?.string ?? '');
    this.check('完成订单数变为 1', hudText(gamePage).includes('完成订单 1'), hudText(gamePage));
    this.check('分数已增长', !hudText(gamePage).includes('分数 0'), hudText(gamePage));

    const nextOrderNames = splitOrder(orderLabel?.string ?? '');
    this.check('已换下一位顾客（订单变化）', nextOrderNames.join('|') !== requiredNames.join('|'));

    // ⑥ 错放：点一个不在订单里的配料，碗必须仍是空的
    const outsiderName = firstOutsider(tray, nextOrderNames);
    emitClick(findSlotByName(tray, outsiderName));
    this.countMisdrop();
    await wait(60);
    this.check('点订单外的配料不会进碗', (bowlLabel?.string ?? '') === '空碗', bowlLabel?.string ?? '');

    // ⑦ 难度换档：越过配置里的分段点之后，新订单的小料数按曲线走
    // （断言名沿用验收里的"20 秒 / 40 秒"，期望值则从曲线算，改数值配置不会被写死的期望卡住）
    session?.update(DIFFICULTY_STAGES[0].untilMs / 1000 + 1);
    await this.serveOrder(tray, splitOrder(orderLabel?.string ?? ''));
    await wait(700);
    const stage2Names = splitOrder(orderLabel?.string ?? '');
    this.check(
      '20 秒后新订单要 4 种小料',
      stage2Names.length === DIFFICULTY_STAGES[1].toppingCount + 1,
      stage2Names.join('|'),
    );

    session?.update((DIFFICULTY_STAGES[1].untilMs - DIFFICULTY_STAGES[0].untilMs) / 1000 + 1);
    await this.serveOrder(tray, stage2Names);
    await wait(700);
    const stage3Names = splitOrder(orderLabel?.string ?? '');
    this.check(
      '40 秒后新订单要 5 种小料',
      stage3Names.length === DIFFICULTY_STAGES[2].toppingCount + 1,
      stage3Names.join('|'),
    );
    this.check('换档后进度条仍与数字一致', barMatchesCountdown(gamePage), barDetail(gamePage));

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
    const freshOrder = splitOrder(orderLabel?.string ?? '');
    this.check('重开后是新的 1 汤底 + 3 小料订单', freshOrder.length === 4, freshOrder.join('|'));

    // ⑪ 回开始页：刚打出的最高分立刻看得见
    const gameRoot = canvas.getComponent('GameRoot') as { showStart?: () => void } | null;
    gameRoot?.showStart?.();
    await wait(80);
    this.check(
      '回到开始页显示最新最高分',
      numberIn(labelText(startPage, 'BestScore')) === readBestScore(),
      `${labelText(startPage, 'BestScore')} 存储=${readBestScore()}`,
    );
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

/** 在子节点里按名字递归找人（视图是运行时建的，只能按名字找） */
function findNode(root: Node | null | undefined, name: string): Node | null {
  if (!root) return null;
  if (root.name === name) return root;
  for (const child of root.children) {
    const hit = findNode(child, name);
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

/** 把"椰奶 + 西瓜丁 + 芋圆 + 红豆"拆成名字数组 */
function splitOrder(text: string): string[] {
  return text
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
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
