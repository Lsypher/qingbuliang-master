import { _decorator, Button, Component, Node } from 'cc';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../config/layout';
import type { RenderPayload, ScenePage } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import { GameSession } from '../game/GameSession';
import { BackgroundView } from './BackgroundView';
import { MisdropFeedback } from './MisdropFeedback';
import { PrepareTransition } from './PrepareTransition';
import { ResultView } from './ResultView';
import { ServeFeedback } from './ServeFeedback';
import { createUiNode } from './uiFactory';

const { ccclass, property } = _decorator;

/** 准备过场层的节点名：装配时按它认领已有节点，免得重复挂 */
const PREPARE_TRANSITION_NODE = 'PrepareTransition';

/**
 * 界面根节点：负责"开始页 / 单局 / 结算页"三个界面状态的切换。
 *
 * 这是表现层的组合根——只做装配与切换，不承载任何规则判断。
 * 规则一律来自 core 层的事件：能自己订阅的页面组件都自己订阅，
 * 唯一的例外是"点亮结算页的那条 finished 事件"——那时结算页才刚被激活，
 * 订阅不到它，只能由这里转交（见 onRender）。
 *
 * 它现在除了切页，还负责一段过场编排：进单局页不再是一步到位的切换，
 * 而是"亮起准备过场 → 过场放行那一帧再切页并开一局新的"。过场**不是**第 4 个界面状态，
 * 它只是盖在当前页面之上的一层，所以"三页互斥"这条不变式与切页逻辑一字未动。
 */
@ccclass('GameRoot')
export class GameRoot extends Component {
  @property(Node) startPage: Node | null = null;
  @property(Node) gamePage: Node | null = null;
  @property(Node) resultPage: Node | null = null;

  @property(GameSession) gameSession: GameSession | null = null;
  @property(ResultView) resultView: ResultView | null = null;

  @property(Node) startButton: Node | null = null;
  @property(Node) restartButton: Node | null = null;

  /** 准备过场层：运行时装配到画布最上层，场景文件因此不用回编辑器接线 */
  private prepareTransition: PrepareTransition | null = null;
  /**
   * "正在进入"的幂等标志：过场期间、以及交接完的那一两帧内，重复点开摊／重开一律忽略。
   * 它与过场层的整屏吃触摸**分工不同、不重复**：一个挡时间上的重复开局，一个挡空间上的点击穿透。
   */
  private entering = false;

  protected onLoad(): void {
    this.bindClick(this.startButton, this.showGame);
    this.bindClick(this.restartButton, this.showGame);
    bus.on(BusEvent.Render, this.onRender, this);
    this.assembleBackground();
    this.assembleGameFeedback();
    this.assemblePrepareTransition();
    this.showStart();
  }

  /**
   * 兜底装配背景层：场景里没挂 BackgroundView 时补上。
   *
   * 组件挂场景与挂运行时是两条等价的路，编辑器能正常保存场景，这里留着只兜"场景漏挂"——
   * 带存在性判断，所以场景里已经挂了也不会重复挂。
   */
  private assembleBackground(): void {
    const backgroundNode = this.node.getChildByName('Background');
    if (!backgroundNode) {
      console.warn('[GameRoot] 找不到 Background 节点，背景层没装配上');
      return;
    }
    if (!backgroundNode.getComponent(BackgroundView)) {
      backgroundNode.addComponent(BackgroundView);
    }
  }

  /**
   * 兜底装配单局反馈层：错放反馈（弹回 / 红闪 / "-3 秒"）与出餐反馈（得分飘字 / "够劲！"）。
   *
   * 与背景层同理，是兜底补挂、不是唯一装配方式（组件同样可以直接挂进场景）。
   * 都挂到单局页上——反馈节点是单局页的子节点，单局页隐藏时一并隐藏，不会漏到结算页；
   * 带存在性判断，场景里已经挂了也不会重复挂。
   */
  private assembleGameFeedback(): void {
    const gamePage = this.gamePage;
    if (!gamePage) return;
    if (!gamePage.getComponent(MisdropFeedback)) {
      gamePage.addComponent(MisdropFeedback);
    }
    if (!gamePage.getComponent(ServeFeedback)) {
      gamePage.addComponent(ServeFeedback);
    }
  }

  /**
   * 装配准备过场层：挂到画布最上层。
   *
   * 与背景层、反馈层同一套路（运行时装配 + 存在性判断），场景文件只多出最小改动、不必回编辑器接线。
   * 节点尺寸取整屏：过场要盖住整屏，而"整屏吃触摸"就是靠这个尺寸（见 PrepareTransition.build）；
   * 追加在最后 = 盖在背景与三页之上；面板与文案由组件自己在第一次亮起时建，这里只管"挂到哪一层、多大"。
   */
  private assemblePrepareTransition(): void {
    const existing = this.node.getChildByName(PREPARE_TRANSITION_NODE);
    const node = existing ?? createUiNode(this.node, PREPARE_TRANSITION_NODE, SCREEN_WIDTH, SCREEN_HEIGHT);
    node.setSiblingIndex(this.node.children.length - 1);
    this.prepareTransition = node.getComponent(PrepareTransition) ?? node.addComponent(PrepareTransition);
    // 过场只在"正在进入"那一小段时间亮着，其余时候（含开局第一帧）都是隐藏的
    node.active = false;
  }

  protected onDestroy(): void {
    bus.off(BusEvent.Render, this.onRender, this);
  }

  /**
   * 单局结束由核心的 finished 事件驱动：时间一到自动进结算页，玩家不必再点一次。
   * 这里只认事件、不自己看时间——"归零"的判定权始终在核心。
   *
   * 结算页是在这次分发里才被激活的，它自己的组件那时才开始 onLoad，
   * 所以订阅不到"让它显示"的这条事件：必须先切页、再把事件交给它，顺序不能反。
   */
  private onRender(payload: RenderPayload): void {
    const finished = payload.events.find((event) => event.type === 'finished');
    if (!finished || finished.type !== 'finished') return;
    this.showResult();
    this.resultView?.show(finished);
  }

  showStart(): void {
    this.switchTo(this.startPage, 'start');
  }

  /**
   * 进入单局页：点开摊与点重开走的都是这里。
   *
   * 改版后不再"点下去就开跑"：先亮起准备过场，由它按放行判据（core，最短展示时长 / 超时）决定
   * 什么时候放行，放行那一帧才走原来那两步。单局计时由"开一局新的"建立，它落在过场之后，
   * 于是准备时间不占那 60 秒，也不需要额外的暂停机制。
   *
   * 过场期间连点这里只会被 `entering` 挡下：过场层的整屏吃触摸能挡掉"点到底下按钮"，
   * 但挡不掉已经落在按钮上、过场出现后才抬起的第二根手指，那一路只有这个标志能挡。
   */
  showGame(): void {
    if (this.entering) return;
    this.entering = true;
    if (this.prepareTransition) this.prepareTransition.begin(() => this.enterGame());
    // 过场层没装配上（场景缺节点又建不出来）时退回改动前的直接进入：宁可没有过场，也不能把玩家挡在开始页
    else this.enterGame();
  }

  /**
   * 交接：切页与新开一局这两步的顺序与内容都与改动前完全一致，只是被过场的亮起与熄灭包住。
   * 熄过场排在这次调用之后，由过场自己完成（见 PrepareTransition.handOff）。
   */
  private enterGame(): void {
    this.switchTo(this.gamePage, 'game');
    this.gameSession?.startRound();
    // 过场熄灭与切页都在上一步那一帧里做完了；标志延到下一帧（延迟 0 的定时器）才解开，
    // 挡掉"过场刚熄、页面刚切"那一两帧内落在已隐藏按钮上的连点
    this.scheduleOnce(() => {
      this.entering = false;
    }, 0);
  }

  showResult(): void {
    this.switchTo(this.resultPage, 'result');
  }

  /** 把按钮的点击接到方法上；refs 未接好时静默跳过，避免空节点报错 */
  private bindClick(button: Node | null, handler: () => void): void {
    if (!button) return;
    button.on(Button.EventType.CLICK, handler, this);
  }

  /** 三页互斥显示：靠 active 切换，不销毁重建，所以来回切不会留残留节点 */
  private switchTo(target: Node | null, page: ScenePage): void {
    const pages = [this.startPage, this.gamePage, this.resultPage];
    for (const node of pages) {
      if (node) node.active = node === target;
    }
    // "当前是哪一页"只在这一处产生并广播；跟着页面走的表现（背景换图与压暗）据此响应
    bus.emit(BusEvent.PageShown, page);
  }
}
