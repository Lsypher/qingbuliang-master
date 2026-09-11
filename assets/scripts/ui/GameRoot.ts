import { _decorator, Button, Component, Node } from 'cc';
import type { RenderPayload, ScenePage } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import { GameSession } from '../game/GameSession';
import { BackgroundView } from './BackgroundView';
import { ResultView } from './ResultView';

const { ccclass, property } = _decorator;

/**
 * 界面根节点：负责"开始页 / 单局 / 结算页"三个界面状态的切换。
 *
 * 这是表现层的组合根——只做装配与切换，不承载任何规则判断。
 * 规则一律来自 core 层的事件：能自己订阅的页面组件都自己订阅，
 * 唯一的例外是"点亮结算页的那条 finished 事件"——那时结算页才刚被激活，
 * 订阅不到它，只能由这里转交（见 onRender）。
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

  protected onLoad(): void {
    this.bindClick(this.startButton, this.showGame);
    this.bindClick(this.restartButton, this.showGame);
    bus.on(BusEvent.Render, this.onRender, this);
    this.assembleBackground();
    this.showStart();
  }

  /**
   * 装配背景层。
   *
   * 临时措施：BackgroundView 本该直接挂在场景的 Background 节点上，但编辑器当前拒绝保存场景改动
   * （scene:save-scene 持续返回 false，soft-reload 也复位不了），只能由组合根在运行时补挂。
   * 编辑器恢复正常后，把这里换回"在场景里挂组件"即可，行为完全一致——
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

  /** 进入单局页并开一局新的：重开走的也是这里 */
  showGame(): void {
    this.switchTo(this.gamePage, 'game');
    this.gameSession?.startRound();
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
