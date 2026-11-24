# 在 Mac 上稳健地使用 Claude Code

用自己的 Claude 账号，在 cmux 里选一个本地项目就能开工。仓库提供可撤销的 cmux 配置、一套网络排查步骤，以及按需分开个人和工作账号的方法。

## 第一次使用

准备好 macOS、zsh、Node.js 20 或更高版本（含 npm），并安装 cmux 和 Claude Code。先在终端运行 `claude auth status`，如果尚未登录，运行 `claude auth login`。[cmux 官网](https://cmux.com/) · [Claude Code 安装说明](https://code.claude.com/docs/en/setup)

把仓库放在准备长期保留的位置，进入仓库目录后执行：

```sh
./scripts/doctor.zsh
npm ci --ignore-scripts
npm run preview
```

预览会列出将写入 `~/.config/cmux/cmux.json` 的项目。遇到已有动作或快捷键冲突时会显示具体名称并停止。确认预览符合预期后，运行 `npm run setup`，回到 cmux 按 **⌘⇧,** 重载配置，然后按 **⌘O** 选一个项目文件夹。

## 日常用法

| 我想做什么 | 怎么操作 |
| --- | --- |
| 打开一个已有项目 | **⌘O** 选文件夹，Claude 在该目录启动，左侧工作区采用文件夹名。 |
| 另开一个工作区 | **⌘N** 新建工作区并启动 Claude。要选具体目录用 **⌘O**。 |
| 在同一项目另聊一个任务 | 在项目窗格按 **⌘T**，在当前窗格新增 Claude 标签页。两个对话各自保留历史。 |
| 并排看两个终端 | **⌘D** 分割窗格。新窗格需要 Claude 时输入 `claude`。 |
| 找回之前的对话 | 在原项目目录、原登录配置下运行 `claude --resume`，选中对应记录。 |

左侧点一个工作区，右侧显示它的窗格和标签。比如同一个「我的项目」可以这样用：

```text
左侧工作区       右侧当前窗格
▸ 我的项目   →   [写代码] [审改动]
```

切回这个工作区，两个仍打开的标签都能找到。退出应用后，cmux 负责恢复布局，Claude 根据保存的记录续聊。自定义命令能否自动重跑取决于 cmux 的恢复设置。[cmux 工作区说明](https://cmux.com/docs/concepts) · [恢复说明](https://cmux.com/docs/session-restore)

## 网络与账号

- **确认 Claude 实际走哪个出口**。从一次真实请求核对域名、规则和最终节点，再检查 DNS 和浏览器 WebRTC。单独运行 `./scripts/doctor.zsh --network` 可以测试 API 域名连通性。[网络检查](docs/network.md) · [mihomo 分流示例](examples/claude-routing.yaml)
- **分别使用个人和工作账号**。额外账号通过独立配置手动登录、启动和续聊。五小时或周额度剩余 5% 时跨账号接力仍是本地实验。首版快捷键启动默认账号。[登录与接力说明](docs/accounts.md)

## 撤销与验证

在仓库目录运行 `npm run undo`，然后在 cmux 按 **⌘⇧,**。安装器保存了原配置，撤销时会保留安装后手动修改的动作。选目录脚本使用仓库的绝对路径，移动仓库前请先撤销。

运行 `npm test` 可以在临时目录复验安装、撤销、配置冲突、项目选择和账号启动器。脚本与配置在 macOS 上以 cmux 0.65.2、Claude Code 2.1.325 和 mihomo 1.19.33 检查过。测试里的 Claude 启动使用替身，真实账号和模型用量需在自己的终端验证。

[MIT 许可证](LICENSE)
