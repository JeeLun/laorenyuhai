# 老人与海 · 鲨口余生

## 目录

- `index.html`：主游戏入口
- `style.css`、`game.js`：可编辑源码，最终会内联进 `index.html`
- `boss/manifest.json`：BOSS 清单
- `changelogs/`：更新日志，按分钟保存，manifest.json 列出所有版本

- `boss/<boss-id>/`：每个 BOSS 独立目录
  - `boss.js`：BOSS 模块（绘制、移动、受击）
  - `config.json`：元数据
  - `boss-theme.ogg`：专属音乐
  - `textures/`、`sfx/`：贴图和音效资源

## 本地运行

因为 BOSS 使用 ES Module 加载，直接双击 `index.html` 会被浏览器的 `file://` 同源策略拦截。请在项目根目录启动一个静态服务器，例如：

```
python -m http.server 8000
```

然后访问 `http://localhost:8000/`。

GitHub Pages 本身通过 HTTP 提供文件，可以直接运行。

## 当前 BOSS

- 死神利维坦：`boss/leviathan/`
- 同学利维坦：`boss/classmate/`（同一个利维坦逻辑，头部由同学头像覆盖）
- CARRION：`boss/carrion/`（多头颅、多触手血肉 BOSS）
