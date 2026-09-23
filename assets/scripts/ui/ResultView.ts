import { _decorator, Component, Node, Sprite } from 'cc';
import type { SessionEvent } from '../core/session';
import { STRINGS } from '../config/strings';
import type { ScoreRecord } from '../game/bestScore';
import { recordScore } from '../game/bestScore';
import { loadSpriteFrame, setLabelText } from './uiFactory';

const { ccclass } = _decorator;

/** 核心给出的单局结算 */
type FinishedEvent = Extract<SessionEvent, { type: 'finished' }>;

/**
 * 场景里结算页那两处"底板 + 文字"的节点名：标题是 `Title` → `Board` + `Label`，
 * 重启按钮是 `RestartButton` → `Board` + `Label`（底板与文字的子节点名两处相同）。
 *
 * 为什么拆成两个兄弟节点、而不是在同一个节点上叠两个渲染组件：**兄弟的先后就是绘制先后**，
 * `Board` 排在 `Label` 之前底板才不会被文字盖住；而在同一个节点上叠两个渲染组件的先后，
 * 编辑器里看不见、也调不动（按钮那处更硬：`Sprite` 与 `Graphics` 引擎根本不允许共存）。
 * 约束的权威说明见 docs/adr/0013-result-title-board.md 的「结算页底板的导入与场景约定」一节。
 */
const TITLE_NODE = 'Title';
const TITLE_BOARD_NODE = 'Board';
const LABEL_NODE = 'Label';

/**
 * 标题底板图在资源目录里的路径（按文件名取图，与开摊按钮、奖杯同一套约定）：
 * 美术把 `result-title-board.png` 同名覆盖进这个目录即生效——不改代码、也不回编辑器接线。
 *
 * 场景里的 `Title/Board` **已经引用了这张图的帧**（编辑器里所见即所得），所以下面这趟加载多数时候不会跑；
 * 留它是兜底：帧被清空、或图还没重新导入时，这一页仍然自己把木牌找回来。
 * 这张图**不含文字**（与自带"开始游戏"四个字的开摊按钮底图刚好相反）："食饱未？"由引擎渲染在它之上，
 * 分工与理由见 docs/adr/0013-result-title-board.md。
 */
const TITLE_BOARD_PATH = 'art/ui/result-title-board';

/**
 * 重启按钮的底板与节点名（同样是"按文件名取图"）：结构与标题同形——
 * `RestartButton` 是按钮（Button + 一个空的 Graphics）→ `Board`（绿胶囊底板）+ `Label`（"再来一碗"），
 * `Board` 仍排在 `Label` 之前。那张图同样**不含文字**，理由与尺寸见 docs/adr/0014-result-restart-button.md。
 */
const RESTART_BUTTON_NODE = 'RestartButton';
const RESTART_BUTTON_BOARD_NODE = 'Board';
const RESTART_BUTTON_ART_PATH = 'art/ui/restart-button';

/**
 * 结算页：把核心在单局结束时给出的三个数摆出来，落一条最高分，破纪录时补一句"老板娘都服了"。
 *
 * 为什么由 GameRoot 调用而不是自己订阅事件：结算页正是"被 finished 事件点亮"的那一页，
 * 它的组件要等页面激活才会 onLoad，而激活就发生在这次事件的分发当中——订阅得再早也收不到这条事件。
 * 所以由组合根在切页时把事件交过来（页面组件自己订阅会收到的那部分，仍然归自己订阅）。
 *
 * 分数一个都不在这里算：三个数直接取 finished 事件，最高分只做"读出来、比一比、写回去"，
 * "算不算破纪录"也由 bestScore 给出，界面只按结论决定显不显示。
 */
@ccclass('ResultView')
export class ResultView extends Component {
  /** 结算一局；GameRoot 在进入结算页时调用 */
  show(finished: FinishedEvent): void {
    // 先落盘再显示：破纪录的那一局即便没点"再来一碗"，纪录也已经存住了
    this.render(finished, recordScore(finished.score));
  }

  /** 按给定的结算结论摆出这一页，一行字都不自己算；与"记账"分开，便于单独驱动"破纪录才显示"这条规则 */
  render(finished: FinishedEvent, record: ScoreRecord): void {
    // 结算页的标签由场景骨架摆好，这里只改文字、不改布局；
    // 标题的文字在 Title/Label 上（Title 自己只是"底板 + 文字"的容器，见 TITLE_NODE 的说明）
    const title = this.node.getChildByName(TITLE_NODE);
    if (title) {
      setLabelText(title, LABEL_NODE, STRINGS.result.title);
      this.attachBoardArt(title, TITLE_BOARD_NODE, TITLE_BOARD_PATH, '标题');
    }
    setLabelText(this.node, 'ScoreLine', `${STRINGS.result.scoreLabel} ${finished.score}`);
    setLabelText(this.node, 'OrdersLine', `${STRINGS.result.ordersLabel} ${finished.servedOrders}`);
    setLabelText(this.node, 'ComboLine', `${STRINGS.result.comboLabel} ${finished.bestCombo}`);
    setLabelText(this.node, 'BestLine', `${STRINGS.bestScoreLabel} ${record.best}`);
    setLabelText(this.node, 'NewRecordLine', STRINGS.result.newRecord);

    // 按钮的文字与底板也在这页上：文字照旧从文案表取（与开始页的开摊按钮一个规矩），
    // 底板与标题走同一条装帧路径
    const restartButton = this.node.getChildByName(RESTART_BUTTON_NODE);
    if (restartButton) {
      setLabelText(restartButton, LABEL_NODE, STRINGS.result.restartButton);
      this.attachBoardArt(restartButton, RESTART_BUTTON_BOARD_NODE, RESTART_BUTTON_ART_PATH, '重启按钮');
    }

    // 只有这一局真的把纪录往前推了才亮相；没破纪录时整条藏起来，不占视觉
    const recordLine = this.node.getChildByName('NewRecordLine');
    if (recordLine) recordLine.active = record.improved;
  }

  /**
   * 给某一层底板按文件名装帧（按文件名取图，与奖杯、开摊按钮底图同一套做法）。
   *
   * 标题与重启按钮两处走的是同一段逻辑，收在这里一份——两份写法迟早会漂移成两种兜底行为。
   * `where` 是"哪一处"（`'标题'` / `'重启按钮'`），只进日志，用来分辨是哪个底板没接上。
   *
   * 取不到图时**什么都不做**：底板节点上没帧就不渲染，那处只剩带描边的白字压着背景——
   * 与"奖杯缺失时这一行只显示文字"是同一条兜底原则，不出现破图、也不隐藏文字。
   *
   * 底板的位置与尺寸（含整图等比拉伸要用的宽高）都烤在场景里，这里只负责把帧放进去，不碰布局。
   */
  private attachBoardArt(host: Node, boardNodeName: string, path: string, where: string): void {
    const board = host.getChildByName(boardNodeName);
    const sprite = board?.getComponent(Sprite);
    if (!board || !sprite) {
      console.warn(`[ResultView] ${where}的底板节点没接上，这一处只显示文字`);
      return;
    }
    // 已经拿过图（再次进结算页、或一局里被重刷）就直接用，不必等回调
    if (sprite.spriteFrame) return;

    loadSpriteFrame(path, (frame, error) => {
      // 资源是异步加载的：回调回来时节点可能已被销毁（页面被切走、场景重开），得先校验
      if (!board.isValid) return;
      if (!frame) {
        console.warn(`[ResultView] ${where}的底板图没取到，这一处只显示文字`, error);
        return;
      }
      sprite.spriteFrame = frame;
    });
  }
}
