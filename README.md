# Super Pixel Run

> 一款打开网页就能玩的横向像素闯关小游戏。

## 在线试玩

[点击开始游戏](https://chenzehao929.github.io/meadow-dash-legends/)

GitHub Pages 直接发布根目录的 `index.html`，无需安装依赖或构建项目。

## 游戏内容

- 穿过阳光草地、砖块、管道和花丛，抵达终点高塔。
- 收集金币和蘑菇，利用体力奔跑并完成更高跳跃。
- 拿到炸药后靠近终点，按 `F` 引爆障碍。
- 支持桌面键盘和移动设备触控按钮。
- 内置 Canvas 绘制后备方案，单个素材加载失败时仍可继续游玩。

## 操作方式

| 按键 | 操作 |
| --- | --- |
| `A` / `D` | 左右移动 |
| `Shift` | 奔跑，消耗体力 |
| `Space` | 跳跃 |
| `S` / `↓` | 下蹲 |
| `F` | 引爆炸药 |
| `P` | 暂停或继续 |
| `R` | 重新开始当前关卡 |
| `O` | 无敌测试模式 |

移动设备可以直接使用游戏画面底部的方向、跳跃、下蹲和引爆按钮。

## 本地运行

项目是纯静态 HTML、CSS 和 JavaScript，不需要安装 npm 依赖。

```bash
python -m http.server 8000
```

然后访问 <http://localhost:8000>。

## 项目结构

```text
index.html                         游戏页面和核心逻辑
assets/characters/                 玩家和敌人素材
assets/items/                      金币、蘑菇、灌木和终点旗帜
assets/tiles/                      草地、砖块和背景素材
assets/LICENSES.txt                内置素材许可记录
tests/game.test.mjs                游戏核心逻辑测试
docs/superpowers/                  设计说明和实施计划
```

## 测试

```bash
node --test tests/game.test.mjs
```

## 素材许可

内置 PNG 素材来自 Kenney Platformer Pack Redux，具体来源和许可信息见 [`assets/LICENSES.txt`](assets/LICENSES.txt)。
