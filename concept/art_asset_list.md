# 《Fortress Sentinel: Last Stand》美术资产清单 (Art Asset Checklist)

### 📌 基本输出规范
- **文件格式：** 所有切图与动画导出为透明背景的 **PNG**。
- **命名规范：** 全小写英文字母与下划线，格式为 `类型_名称_状态/方向_序号.png`。
- **动画对齐：** 同一序列帧动作（如跑步、攻击）的画布尺寸（Canvas Size）必须完全一致，底部中心锚点严格对齐，裁切掉多余的透明区域。

---

## 📂 /bg (背景图相关)
*需具有陈旧纸张或横格本纹理。需要预留充足的 Safe Area 以适应宽屏或平板屏幕比例。*
- [x] `bg_main_notebook.png` - 主战场背景底图 (建议尺寸 1920x1080 级别)

## 📂 /buildings (建筑与场景)
*具有黑色粗线框的手绘涂鸦风格。*
- [x] `bldg_fortress.png` - 堡垒主体
- [x] `bldg_cannon_barrel.png` - 大炮炮管
- [ ] `bldg_cannon_indicator_cyan.png` - 大炮当前武器指示器 (青色发光或旗帜)
- [x] `bldg_barracks.png` - 兵营建筑（手绘帐篷或机械工厂，纯场景展示）

## 📂 /units (角色与单位)
*豆豆眼火柴人设计。约 30x30 视觉大小，建议 8~12 FPS 序列帧。带有 `01` 代表序列帧动画第一帧。*

**敌军 (从右向左冲锋)：**
- [ ] `unit_enemy_cyan_run_01.png` ~ `..._xx.png` - 青色敌人：移动/奔跑
- [ ] `unit_enemy_cyan_fight_01.png` ~ `..._xx.png` - 青色敌人：交战僵持
- [ ] `unit_enemy_orange_run_01.png` ~ `..._xx.png` - 橙色敌人：移动/奔跑
- [ ] `unit_enemy_orange_fight_01.png` ~ `..._xx.png` - 橙色敌人：交战僵持
- [ ] `unit_enemy_purple_run_01.png` ~ `..._xx.png` - 紫色敌人：移动/奔跑
- [ ] `unit_enemy_purple_fight_01.png` ~ `..._xx.png` - 紫色敌人：交战僵持

**友军 (从左向右冲锋，带有特定样式的头盔或旗帜区分)：**
- [ ] `unit_friend_cyan_run_01.png` ~ `..._xx.png` - 青色友军：移动/奔跑
- [ ] `unit_friend_cyan_fight_01.png` ~ `..._xx.png` - 青色友军：交战僵持
- [ ] `unit_friend_orange_run_01.png` ~ `..._xx.png` - 橙色友军：移动/奔跑
- [ ] `unit_friend_orange_fight_01.png` ~ `..._xx.png` - 橙色友军：交战僵持
- [ ] `unit_friend_purple_run_01.png` ~ `..._xx.png` - 紫色友军：移动/奔跑
- [ ] `unit_friend_purple_fight_01.png` ~ `..._xx.png` - 紫色友军：交战僵持

**精英敌军 (高大或带夸张头盔)：**
- [ ] `unit_elite_run_01.png` ~ `..._xx.png` - 精英敌人：移动
- [ ] `unit_elite_fight_01.png` ~ `..._xx.png` - 精英敌人：交战僵持

## 📂 /projectiles (各类子弹与光束)
*手绘涂鸦感特效，支持单图或简单帧序列。*
- [ ] `proj_rapid_cyan_01.png` ~ `..._xx.png` - 快速弹：短促激光或飞镖
- [ ] `proj_blast_orange_01.png` ~ `..._xx.png` - 爆裂弹：火球或炸弹
- [ ] `proj_pierce_purple_01.png` ~ `..._xx.png` - 穿透弹：长矛或粗壮光柱

## 📂 /items (掉落物与道具)
*战场内拾取的道具外观。*
- [ ] `item_drop_bomb.png` - 炸弹（骷髅头圆球）
- [ ] `item_drop_health.png` - 治疗（十字药水瓶）
- [ ] `item_drop_rage.png` - 狂暴（火焰符号）

## 📂 /vfx (视觉特效)
- [ ] `fx_tap_feedback_01.png` ~ `..._xx.png` - **[极度重要]** 触屏点击反馈特效（水波纹/墨汁散开/准星缩放）
- [ ] `fx_hit_cyan_01.png` ~ `..._xx.png` - 受击与死亡特效：青色（墨汁飞溅或星形）
- [ ] `fx_hit_orange_01.png` ~ `..._xx.png` - 受击与死亡特效：橙色
- [ ] `fx_hit_purple_01.png` ~ `..._xx.png` - 受击与死亡特效：紫色
- [ ] `fx_explosion_orange_01.png` ~ `..._xx.png` - 爆裂弹大爆炸（手绘大爆炸）
- [ ] `fx_struggle_sparks_01.png` ~ `..._xx.png` - 兵种交战特效（刀剑碰撞火花）
- [ ] `fx_struggle_sweat_01.png` ~ `..._xx.png` - 兵种交战特效（汗滴）

## 📂 /ui (界面元素、图标与按钮)

**技能/道具大按钮 (如炸弹)：**
- [ ] `ui_btn_bomb_normal.png`
- [ ] `ui_btn_bomb_pressed.png`
- [ ] `ui_btn_bomb_cooldown.png` - CD 中 / 不可用状态（灰化/遮罩）

**顶部状态栏与通用面板：**
- [x] `ui_hud_health_empty.png` - 空血红心底框
- [ ] `ui_icon_coin.png` - 金币小图标
- [ ] `ui_panel_bg_9slice.png` - 通用 UI 弹窗底板（带不规则边缘的黑板/木板/褶皱牛皮纸，必须支持引擎 9-slice 九宫格拉伸，四角清晰）
- [ ] **[建议附加]** 一款用于显示 Combo 和分数的独立风格手写字体 (`.ttf` 或 `.woff` 格式)。

## 📂 /source (源文件)
- [ ] 请提交保留着所有独立图层的原始文件 (PSD, AI, 或 Aseprite 原工程)，切勿合并图层。
