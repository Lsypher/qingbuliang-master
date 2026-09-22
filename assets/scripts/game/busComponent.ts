import { _decorator, Component } from 'cc';
import type { BusPayloadMap, RenderPayload } from './bus';
import { BusEvent, bus } from './bus';

const { ccclass } = _decorator;

/**
 * 订阅事件总线的组件基类：把"登记 / 注销"这对样板收成一处。
 *
 * 存在的理由：这对样板原先在 9 个文件里逐字重复（26 行 on/off 配对），漏写一次 off 就是跨局的幽灵订阅
 * ——组件销毁后仍收到 Render，转头去碰已经回收的节点。现在注销由基类在销毁时统一做，子类只管"听什么"。
 *
 * **子类不要再写 `onLoad` / `onDestroy`**：生命周期由本类接管（JS 里子类覆写后基类那份就不再执行，
 * 没有自动串链），要建节点写 `onViewLoad`，要收尾写 `onViewDestroy`。
 * `onEnable` / `onDisable` 仍归子类——只有订阅总线的组件才继承本类，那两个钩子与订阅无关。
 *
 * 本类必须 `import 'cc'`，所以进不了 vitest：它的收益是局部性与杠杆，不是可测性。
 * 可测的那部分（各视图的渲染签名）另在 ui/renderSignatures.ts，由各视图自己调——
 * 守卫不进基类是有意的：那样"值没变就不重绘"会被当成"事件投递的门"，
 * 将来某个视图想在渲染载荷里接核心事件就会被静默吃掉。
 *
 * 它是骨架类，**不要挂到节点上**。
 */
@ccclass('BusComponent')
export class BusComponent extends Component {
  /**
   * 已登记的订阅：注销要按登记时那一对「事件 + 函数引用」退订，所以留着。
   * `this.onXxx` 取到的是原型上的方法引用，登记与注销两次拿到的是同一个，不会退不掉。
   */
  private readonly subscriptions: Array<[keyof BusPayloadMap, (payload: never) => void]> = [];

  protected onLoad(): void {
    this.onViewLoad();
    // 覆写了 onRendered 才订阅 Render：没覆写的组件（适配层、背景层这些）不必每帧白收一次调用
    if (this.onRendered !== BusComponent.prototype.onRendered) this.listen(BusEvent.Render, this.onRendered);
  }

  protected onDestroy(): void {
    for (const [event, handler] of this.subscriptions) bus.off(event, handler, this);
    this.subscriptions.length = 0;
    this.onViewDestroy();
  }

  /** 建节点、摆版面、listen 都写这里（代替 onLoad） */
  protected onViewLoad(): void {}

  /** 停补间、收拖动之类的收尾（代替 onDestroy）；退订不用管，基类已经做了 */
  protected onViewDestroy(): void {}

  /**
   * 订阅一条总线事件，`this` 自动作为回调目标——不必像 `bus.on` 那样再传第三个参数。
   * 退订由基类在销毁时统一处理。
   */
  protected listen<E extends keyof BusPayloadMap>(event: E, handler: (payload: BusPayloadMap[E]) => void): void {
    bus.on(event, handler, this);
    // 各处理器的载荷签名互不相同，这里只当"可退订的函数引用"存着：
    // never 参数位能让任意签名的处理器都存得下，且与 tsconfig 的 strict 开关无关
    this.subscriptions.push([event, handler]);
  }

  /** 覆写它就自动订阅 Render；不覆写则本组件对 Render 一无所知 */
  protected onRendered(_payload: RenderPayload): void {}
}
