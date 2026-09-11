import { _decorator, Component } from 'cc';
import { STRINGS } from '../config/strings';
import { readBestScore } from '../game/bestScore';
import { setLabelText } from './uiFactory';

const { ccclass } = _decorator;

/**
 * 开始页：本切片（05）只负责最高分那一行，每次页面显示时从本地存储重读一次。
 *
 * 标题、玩法一句话、首局引导、破纪录提示与素材致谢归 11 切片。
 */
@ccclass('StartView')
export class StartView extends Component {
  /** 每次显示都重读：上一局刚破的纪录，回到开始页立刻看得见 */
  protected onEnable(): void {
    setLabelText(this.node, 'BestScore', `${STRINGS.bestScoreLabel} ${readBestScore()}`);
  }
}
