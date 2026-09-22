import { _decorator, Node, Tween, UIOpacity, UITransform, tween } from 'cc';
import { STRINGS } from '../config/strings';
import type { RenderPayload, ScenePage } from '../game/bus';
import { BusEvent } from '../game/bus';
import { BusComponent } from '../game/busComponent';
import { createOutlinedText, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/** 引导行字号（设计像素） */
const GUIDE_FONT = 26;
/** 引导行离配料盘顶边的空隙：既不压住盘里的格子，也不贴到碗区面板的下沿 */
const GUIDE_GAP_ABOVE_TRAY = 6;
/** 淡入 / 淡出时长（秒） */
const GUIDE_FADE_IN = 0.3;
const GUIDE_FADE_OUT = 0.2;

/**
 * 首局引导：配料盘上方浮一行"把配料拖进碗里，凑齐即出餐"。
 *
 * 只出现到"首单出餐"为止——那一刻玩家已经知道怎么玩了，提示立刻收起来，
 * 本次运行里再也不会冒出来（包括重开一局）；刷新页面等于新玩家，提示会重新来一遍。
 *
 * 纯表现：只认"现在切到哪一页"与核心给的出餐事件，不读核心内部状态、不参与任何判定。
 * 位置从配料盘节点算出来，版面挪动时跟着走，不需要在这里写死坐标。
 */
@ccclass('GuideHint')
export class GuideHint extends BusComponent {
  /** 本次运行里是否已经出过餐（出过一次就再也不提示） */
  private servedOnce = false;
  /** 当前是否摆在屏幕上：淡入淡出期间也要能说清"该显示还是该收起" */
  private shown = false;
  private box: Node | null = null;
  private opacity: UIOpacity | null = null;
  private fadeTween: Tween<UIOpacity> | null = null;

  protected onViewLoad(): void {
    this.box = this.buildBox();
    // Render 由基类按"覆写了 onRendered"自动订阅；中文注释见 game/busComponent.ts
    this.listen(BusEvent.PageShown, this.onPageShown);
  }

  protected onViewDestroy(): void {
    this.fadeTween?.stop();
  }

  /** 进单局就浮出来（还没出过餐的话）；开始页与结算页不归它管，页面一藏自然看不见 */
  private onPageShown(page: ScenePage): void {
    if (page === 'game' && !this.servedOnce) this.show();
  }

  /** 首单出餐 = 教会了：收起提示，之后整局与重开的新局都不再现身 */
  protected onRendered(payload: RenderPayload): void {
    if (this.servedOnce) return;
    if (!payload.events.some((event) => event.type === 'served')) return;
    this.servedOnce = true;
    this.hide();
  }

  /** 造出引导行：正文与字形描边由 createOutlinedText 一次设好，初始不出现在屏幕上 */
  private buildBox(): Node {
    const box = createOutlinedText(
      this.node,
      'GuideHintBox',
      STRINGS.guide,
      GUIDE_FONT,
      UI_COLOR.guideText,
      UI_COLOR.textOutline,
    ).node;
    this.opacity = box.getComponent(UIOpacity);

    // 以配料盘顶边为基准往上让一点：引导属于"配料盘上方"，配料盘动了它也动
    const tray = this.node.getChildByName('TrayArea');
    const trayTop = tray ? tray.position.y + (tray.getComponent(UITransform)?.height ?? 0) / 2 : 0;
    // 高度读节点自己的，不在这儿再算一遍"字号 × 行高比"
    const boxHeight = box.getComponent(UITransform)?.height ?? 0;
    box.setPosition(0, trayTop + GUIDE_GAP_ABOVE_TRAY + boxHeight / 2, 0);

    box.active = false;
    return box;
  }

  /** 浮出：淡入。已经在屏幕上的话什么都不做，避免反复进局把动画重启 */
  private show(): void {
    if (!this.box || this.shown) return;
    this.shown = true;
    this.box.active = true;
    this.fade(0, 255, GUIDE_FADE_IN, null);
  }

  /** 收起：淡出之后才真正藏起来 */
  private hide(): void {
    if (!this.box || !this.shown) return;
    this.shown = false;
    this.fade(this.opacity?.opacity ?? 255, 0, GUIDE_FADE_OUT, () => {
      // 淡出的这 0.2 秒里又被叫回显示的话，不能反手把它藏掉
      if (this.box && !this.shown) this.box.active = false;
    });
  }

  /** 透明度补间：同一时刻只允许一条在跑，重入局不会被上一条按在原地 */
  private fade(from: number, to: number, duration: number, onDone: (() => void) | null): void {
    if (!this.opacity) {
      if (onDone) onDone();
      return;
    }
    this.fadeTween?.stop();
    this.opacity.opacity = from;
    const running = tween(this.opacity).to(duration, { opacity: to });
    this.fadeTween = onDone ? running.call(onDone) : running;
    this.fadeTween.start();
  }
}
