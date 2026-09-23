import { Node, Sprite, SpriteFrame, UIOpacity, Vec3, tween } from 'cc';
import type { PreloadTask } from './uiFactory';
import { createSpriteFrameSlot, createUiNode } from './uiFactory';

/**
 * 错放中央弹窗：错放瞬间在碗内上部空档弹出一张"-3 秒"图片，轻微抖动 + 两侧残影，
 * 停留一下再淡出，节点用完即焚（自己销毁，本模块不持有任何运行时状态）。
 *
 * 与顶部那条"-3 秒"飘字（见 ui/MisdropFeedback.ts 的 floatPenalty）是**两处并存的提示**：
 * 飘字锚在倒计时右侧，说清"扣的是时间"；本弹窗锚在屏幕中央，负责"一眼看见"。二者共用同一条
 * `Misdrop` 事件，所以永远同时出现、同时不发生（重复放入走核心的 `rejected`，两处都不触发）。
 *
 * **不拦截交互**：节点只挂 Sprite / UIOpacity，不挂 Button 也不挂 BlockInputEvents，
 * 触摸事件照常穿到碗与配料盘上——错放提示不该让玩家"手停在半空"。
 *
 * **图里的"-3"是画在位图上的**：改扣时值时这张图要跟着重出。同步点见 `config/balance.ts` 的
 * `MISDROP_PENALTY_MS`——那是这条契约唯一的权威说明。
 */

/**
 * 弹窗图路径：`assets/resources/` 下的相对路径，帧由 `uiFactory.loadSpriteFrame` 按名取
 * （路径拼法收口在那里）。改名 / 换图只要同名覆盖文件，不用回编辑器接线。
 */
const POPUP_PATH = 'art/ui/misdrop-penalty';

/**
 * 弹窗显示宽度（设计像素）：素材原图 150×88，放到 240 是约 1.6 倍——屏宽的三分之一，够醒目；
 * 再放大就明显发糊（素材本身只有 150 像素宽）。改了它高度按图片比例跟着变，不用另设一个高度。
 */
const POPUP_WIDTH = 240;

/**
 * 弹窗图的高度比（高 ÷ 宽）——注意是**高比宽**，不是通常说的宽高比。
 *
 * 取 `frame.rect`（与图片内容绑定的裁剪矩形），而不是 `frame.width / frame.height`：后者在引擎里
 * 的实现是 `return this._texture.width` / `_texture.height`，量的是**纹理**，不是图片内容。
 * 本图两种取法眼下只差 2%（content 比例 84/146 对纹理比例 88/150），但这不重要——
 * 纹理尺寸是会被外部改动的量（被打包进图集、被替换），拿它去推内容比例在语义上就是错的。
 *
 * 取不到宽（不该发生）时退到素材原始比例 88/150，只为不产生 NaN。
 */
function popupHeightRatio(frame: SpriteFrame): number {
  const rect = frame.rect;
  return rect.width > 0 ? rect.height / rect.width : 88 / 150;
}

/**
 * 弹窗纵向位置（设计像素，以单局页中心为原点）。
 *
 * 取碗内上部空档，是这一处唯一不压静态文字的落点：屏幕正中央 (0,0) 恰好是碗里的"空碗"提示
 * 与碗内图标行（碗区中心在 -25，"空碗"/图标行在碗区局部 +10，即单局页 -15），压上去就违反
 * "不覆盖页面其他文字"。
 *
 * **这一带与出餐类浮层在纵向是重叠的**：得分飘字锚在碗心 +120（≈95），连击喊话在 +250（≈225），
 * 而弹窗高约 140、纵带约 [70, 210]——无论落在碗上方哪一段都会与其中一条相交。所以
 * "不覆盖页面其他文字"只兑现了一半：**静态文字（空碗、已放进度、订单标题）确实没被压，
 * 出餐浮层躲不开**。两者的实际重叠窗口很窄（得分飘字存活 0.7 秒、喊话约 1.1 秒，要"出餐后
 * 不到一秒就错放"才叠得上），衡量下来不值得为它把弹窗挤出这片空档。
 */
const POPUP_Y = 140;

/**
 * 抖动横向位移序列（设计像素）与每段时长（秒）。
 *
 * 手写一条确定性的序列（不是随机抖动）：每次错放的抖动完全一致，观感可复现、也能一眼看出改了没有。
 * 幅度 10 是"看得出在抖"与"别抖到压住碗内图标"之间的取值；首尾都是 0，所以起手与收尾都回正、
 * 不会在动画结束时留下一个偏移量。
 */
const JITTER_X: readonly number[] = [0, 10, -9, 8, -7, 6, -5, 3, 0];
const JITTER_STEP = 0.03;

/**
 * 残影配置：每个残影滞后主图几帧、以及它自身的不透明度（0~255，之后再与弹窗节点的淡出相乘）。
 *
 * 残影与主图用同一张 SpriteFrame（同一份资源，引擎按 uuid 缓存，不额外读盘、不额外占显存），
 * 尺寸也一致，靠**抖动相位错开**才露出来：滞后 2 / 4 帧时主图已经荡到另一侧，残影还停在这边，
 * 于是两侧各拖出一道虚影。透明度递减（越滞后越淡）才有"拖尾"的层次，两支一样重会像发虚的印刷错版。
 */
const GHOST_LAG_FRAMES: readonly number[] = [2, 4];
const GHOST_ALPHA: readonly number[] = [96, 52];

/** 弹入：从这么小弹到位（backOut 会轻微过冲），以及弹入时长（秒）——短到看不出延迟，又不至于硬生生蹦出来 */
const POP_START_SCALE = 0.7;
const POP_IN = 0.12;
/** 弹入结束后到淡出开始前的一段停顿（秒）；已很短，基本靠弹入+淡出让人看清"-3 秒"，不再单独留长时间 */
const HOLD = 0.12;
/** 淡出时长（秒） */
const FADE_OUT = 0.26;

/**
 * 弹窗图的帧槽：预载（过场期间）与显示（错放瞬间）是两处调用，缓存放模块里才不必把帧传来传去。
 * 「缓存 + 已决标记 + 预载任务」这套形状由 uiFactory 的 `createSpriteFrameSlot` 提供，
 * 本模块只负责"路径"这一段，不再自己维护两个变量。
 */
const popupSlot = createSpriteFrameSlot(POPUP_PATH);

/**
 * 交出弹窗图的预载任务：在准备过场期间跑（见 ui/GameRoot.ts 的 showGame）。
 *
 * 预载不是优化而是**正确性**要求：错放的反馈要"触发即显示"，而 `resources.load` 是异步的，
 * 首次错放现拉图会晚一两帧才冒出来。过场正好是一段天然的加载窗口，把它也算作一项已决任务即可。
 * 加载失败也回调 `done`（已决不区分成败）：缺图只是不显示弹窗，不该卡住进局。
 */
export function preloadMisdropPopup(): PreloadTask {
  return popupSlot.preload();
}

/**
 * 弹一次"错放"弹窗。`parent` 要在单局页上（弹窗是它的子节点，随单局页一起隐藏）。
 *
 * 帧已到手就同步建节点（正常路径，预载过），这一条路不产生任何延迟。
 * 帧还没到手（没走过过场、或预载失败后重试）时只有两件事可做：抛在后台加载、拿到再建；
 * 或者判定"已决但失败"，直接不显示——**不能卡在这儿等**，反馈晚到就等于没有。
 */
export function showMisdropPopup(parent: Node): void {
  const frame = popupSlot.frame();
  if (frame) {
    buildPopup(parent, frame);
    return;
  }
  if (popupSlot.resolved()) return;
  popupSlot.load((loaded) => {
    // 等待期间单局页可能已经切走/销毁：父节点没了就放弃，别往废弃节点上挂东西
    if (loaded && parent.isValid) buildPopup(parent, loaded);
  });
}

/**
 * 建出弹窗并跑完整段动画。
 *
 * 层级顺序有意固定为"先残影、后主图"：同尺寸同位置时，后建的画在上层，
 * 主图压住残影，只有抖动把相位错开、残影荡到旁边时才露出来——这正是"残影"该有的样子。
 * 反过来建就成了主图被两层虚影盖住，整张图发糊。
 */
function buildPopup(parent: Node, frame: SpriteFrame): void {
  // 高度一律由"图片高度比 × 目标宽度"推出来（比例的取法见 popupHeightRatio），不出现写死的高度
  const height = Math.round(POPUP_WIDTH * popupHeightRatio(frame));
  const popup = createUiNode(parent, 'MisdropPopup', POPUP_WIDTH, height, POPUP_Y);
  // 弹窗节点上这层不透明度管整组（主图 + 残影）的淡入淡出；残影自己那层固定低值，两层在引擎里相乘
  const opacity = popup.addComponent(UIOpacity);

  GHOST_LAG_FRAMES.forEach((lag, index) => {
    const ghost = createSprite(popup, frame, height, `Ghost${index}`);
    ghost.addComponent(UIOpacity).opacity = GHOST_ALPHA[index];
    jitter(ghost, [...Array<number>(lag).fill(0), ...JITTER_X]);
  });

  const main = createSprite(popup, frame, height, 'Image');
  jitter(main, JITTER_X);

  // 弹入：从小弹到位（backOut 轻微过冲）并且淡入，"立刻出现"与"不显突兀"各让一步
  popup.setScale(POP_START_SCALE, POP_START_SCALE, 1);
  opacity.opacity = 0;
  tween(popup).to(POP_IN, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();

  // 淡入 → 停留 → 淡出 串成一条链，销毁只挂在这一条上：两条补间都调 destroy 会重复销毁报错
  // （同 uiFactory.floatAway 的约定）。停留从弹入结束起算；抖动约 0.27 秒比停留长，会跨进淡出期——这是缩短 HOLD 后的已知表现，不是 bug。
  tween(opacity)
    .to(POP_IN, { opacity: 255 })
    .delay(HOLD)
    .to(FADE_OUT, { opacity: 0 }, { easing: 'quadIn' })
    .call(() => popup.destroy())
    .start();
}

/**
 * 建一个只显示弹窗图的节点（挂 Sprite，尺寸已定好，不参与交互）。
 *
 * `CUSTOM` 是有意的：`TRIMMED` 下引擎会把 contentSize 改写成裁剪后的像素尺寸（本图是 146×84），
 * 弹窗大小就随素材四周的透明边变化；CUSTOM 保住外面按图片比例算好的 (宽度, 高度)。
 * 引擎在 CUSTOM 下把绘制矩形铺满 contentSize、不额外拉伸内容，所以比例由调用方保证。
 */
function createSprite(parent: Node, frame: SpriteFrame, height: number, name: string): Node {
  const node = createUiNode(parent, name, POPUP_WIDTH, height);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = frame;
  return node;
}

/**
 * 按位移序列抖一遍：每段都补到"绝对横向位置"、末项为 0，所以抖动结束时必定回正。
 *
 * 序列是确定性的，所以残影只要把同一段序列整体后移若干帧（调用处补前导 0），
 * 就得到一条滞后跟随的轨迹——不必逐帧采样主图位置，也就没有常驻的采样状态。
 */
function jitter(node: Node, track: readonly number[]): void {
  const action = tween(node);
  for (const x of track) {
    action.to(JITTER_STEP, { position: new Vec3(x, 0, 0) }, { easing: 'linear' });
  }
  action.start();
}
