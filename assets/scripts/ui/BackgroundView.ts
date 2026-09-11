import { _decorator, Component, Node, Sprite, SpriteFrame, resources } from 'cc';
import type { RenderPayload } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import { createUiNode, paintPanel, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/** 背景铺满设计分辨率：720x1280 正好 9:16，与图源比例一致，拉满不形变 */
const SCREEN_WIDTH = 720;
const SCREEN_HEIGHT = 1280;

/**
 * 背景池：文件名即资源 id，换图只换文件——不动代码，也不用回编辑器接线
 * （与配料图标"id 同时用作文件名"是同一套约定）。
 * 放在 assets/resources 下才能按路径动态加载。
 */
const BACKGROUND_DIR = 'art/backgrounds';
const BACKGROUND_NAMES = [
  'qilou-street-night',
  'qingbuliang-stall-night',
  'palm-coast-dusk',
  'li-brocade-pattern',
];

/**
 * 背景层：每局从背景池随机抽一张铺满全屏，同一局内不切换；开始页与结算页把它压暗。
 *
 * 纯表现，不参与任何规则判定——连"这一局开始了"也是听适配层的开局广播，
 * 所以它既不在核心层里，也没有规则可测。
 *
 * 层级：图和压暗层都是本节点的子节点，界面全在 Pages 下，天然盖在背景之上；
 * 图没加载出来之前，本节点原有的占位底色会先垫着。
 */
@ccclass('BackgroundView')
export class BackgroundView extends Component {
  private imageNode: Node | null = null;
  private dimNode: Node | null = null;
  /** 加载好的背景池；加载完成前抽不出图，界面上就是占位底色 */
  private pool: SpriteFrame[] = [];

  protected onLoad(): void {
    const image = createUiNode(this.node, 'BackgroundImage', SCREEN_WIDTH, SCREEN_HEIGHT);
    const sprite = image.addComponent(Sprite);
    // 用节点尺寸而不是图片自身尺寸：这样图片被拉满全屏，而不是把节点改成图片大小
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.imageNode = image;

    const dim = createUiNode(this.node, 'BackgroundDim', SCREEN_WIDTH, SCREEN_HEIGHT);
    paintPanel(dim, UI_COLOR.backgroundDim);
    this.dimNode = dim;

    bus.on(BusEvent.Render, this.onRender, this);
    bus.on(BusEvent.RoundStarted, this.onRoundStarted, this);

    this.loadPool();
    // 启动时是开始页：先抽一张压暗着垫底
    this.pickRandom();
    this.setDimmed(true);
  }

  protected onDestroy(): void {
    bus.off(BusEvent.Render, this.onRender, this);
    bus.off(BusEvent.RoundStarted, this.onRoundStarted, this);
  }

  /** 一次性把背景池读进来；失败只告警不抛错——背景没了也不该让玩法崩 */
  private loadPool(): void {
    const paths = BACKGROUND_NAMES.map((name) => `${BACKGROUND_DIR}/${name}/spriteFrame`);
    resources.load(paths, SpriteFrame, (error, frames) => {
      if (error) {
        console.warn('[BackgroundView] 背景池加载失败，保留占位底色', error);
        return;
      }
      this.pool = frames;
      this.pickRandom();
    });
  }

  /** 开局广播：换一张背景、收掉压暗层；这一局里就不会再变了 */
  private onRoundStarted(): void {
    this.pickRandom();
    this.setDimmed(false);
  }

  /** 单局结束：把背景压暗，交给结算页当底 */
  private onRender(payload: RenderPayload): void {
    if (!payload.events.some((event) => event.type === 'finished')) return;
    this.setDimmed(true);
  }

  /** 随机抽一张；池子还没加载好就留空，不报错 */
  private pickRandom(): void {
    const sprite = this.imageNode?.getComponent(Sprite);
    if (!sprite || this.pool.length === 0) return;
    sprite.spriteFrame = this.pool[Math.floor(Math.random() * this.pool.length)];
  }

  private setDimmed(dimmed: boolean): void {
    if (this.dimNode) this.dimNode.active = dimmed;
  }
}
