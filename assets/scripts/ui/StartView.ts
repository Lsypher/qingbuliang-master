import { _decorator, Component } from 'cc';
import { STRINGS } from '../config/strings';
import { readBestScore } from '../game/bestScore';
import { setLabelText } from './uiFactory';

const { ccclass } = _decorator;

/**
 * 开始页：标题、副标题、玩法一句话、最高分、开始按钮。
 *
 * 每次页面显示时重刷一遍：文案从 strings.ts 取（场景里那几行只是摆版时的预览值），
 * 最高分重新读一次本地存储——上一局刚破的纪录，回到开始页立刻看得见。
 */
@ccclass('StartView')
export class StartView extends Component {
  protected onEnable(): void {
    setLabelText(this.node, 'Title', STRINGS.title);
    setLabelText(this.node, 'Subtitle', STRINGS.subtitle);
    setLabelText(this.node, 'HowToPlay', STRINGS.howToPlay);
    setLabelText(this.node, 'BestScore', `${STRINGS.bestScoreLabel} ${readBestScore()}`);

    // 按钮文字在按钮节点下的 Label 上，得从按钮节点里找
    const startButton = this.node.getChildByName('StartButton');
    if (startButton) setLabelText(startButton, 'Label', STRINGS.startButton);
  }
}
