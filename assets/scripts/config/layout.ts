/**
 * 版面常量：竖屏设计分辨率。
 * 与 `settings/v2/packages/project.json` 里的设计分辨率（720x1280、FitHeight）保持一致。
 * 背景铺满、自动装配与自检都读这里，别再各写一份 720 / 1280。
 */
export const SCREEN_WIDTH = 720;
export const SCREEN_HEIGHT = 1280;

/**
 * 拖动落区（设计像素）：以碗区节点中心为准的矩形，比三段布局里的碗区面板小一圈，
 * 底边不会探进配料盘顶行，顶边不会贴上订单卡。看得见的高亮框与落点判定都从这里取尺寸，
 * 显示与判定永远一致。
 */
export const BOWL_DROP_ZONE_WIDTH = 600;
export const BOWL_DROP_ZONE_HEIGHT = 380;

/**
 * 拖动落区容差（设计像素）：松手点越出落区边界这么多以内仍算放进碗里。
 * 小屏上碗的边缘难瞄准，判定比看得见的落区大一圈，宁可宽容。
 */
export const DROP_ZONE_TOLERANCE_PX = 40;
