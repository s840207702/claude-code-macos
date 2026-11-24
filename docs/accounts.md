# 登录、续聊与额度

## 一个账号

从终端运行 `claude auth login`，在官方页面完成登录，再运行 `claude auth status` 核对身份。进入 Claude Code 后可以用 `/usage` 查看该账号的用量。请在本机查看邮箱和账户信息。[Claude 官方登录说明](https://code.claude.com/docs/en/authentication)

在项目目录运行 `claude --resume`，从列表选中要继续的对话。cmux 退出后可以恢复布局。Claude 的对话恢复还需要有效的会话记录，自动执行自定义恢复命令需在 cmux 中批准。[cmux 恢复说明](https://cmux.com/docs/session-restore)

## 手动使用另一份登录配置

如果你有分别使用的个人和工作账号，可以给第二个账号命名为 work。在仓库目录里运行：

```sh
./scripts/with-profile.zsh work auth login
./scripts/with-profile.zsh work auth status
```

核对邮箱后，进入项目目录，用此脚本的绝对路径启动会话。例如在仓库目录先执行：

```sh
profile_launcher="$PWD/scripts/with-profile.zsh"
cd "/你的项目目录"
"$profile_launcher" work
# 下次在相同目录和配置下选取原对话
"$profile_launcher" work --resume
```

该脚本为子进程设置 CLAUDE_CONFIG_DIR，设置、插件和会话历史按配置目录区分。cmux 的常用快捷键使用终端中默认的 Claude 登录。操作前若配过 API key 或第三方供应商环境变量，先核对实际登录方式和计费来源。[Claude 配置目录说明](https://code.claude.com/docs/en/settings)

## 在 cmux 启用 5% 自动接力

这是可选的本地启动器。需要 macOS、Python 3.9 或更高版本、原生 Claude Code CLI，以及至少两个本人有权使用的 Claude Pro 账号。跨账号接力时，下一账号的会话会读取上一账号保存的对话内容及其中的工具输出。请先确认项目内容可以在这些账号之间使用。官方文档介绍了独立登录和会话分支，5% 调度由本项目实现。[官方多账号说明](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts) · [续聊参数](https://code.claude.com/docs/en/cli-reference) · [个人服务条款](https://www.anthropic.com/legal/consumer-terms)

### 1. 登录自己的账号

进入仓库目录，把下面的名称当作本机标签。每次在浏览器里确认实际选中的账号。工具通过官方 CLI 完成授权，接力名单只保存标签和用于比对身份的邮箱摘要。

```sh
./scripts/claude-relay --login alpha
./scripts/claude-relay --login bravo
./scripts/claude-relay --enroll alpha bravo
./scripts/claude-relay --check
```

最后一条会检查身份并列出每个账号的五小时和周剩余额度。如果两个标签登成了同一个邮箱，登记时就会提示。要加第三个账号，先用 `--login charlie` 登录，再用 `--enroll alpha bravo charlie` 登记完整顺序。曾用本仓库单独登录过的配置可以直接按原名登记。

### 2. 在项目里启动

只想先在一个窗格试用，可以在仓库目录记下启动器的位置，再进入自己的项目：

```sh
relay="$PWD/scripts/claude-relay"
cd "/你的项目目录"
"$relay"
```

希望今后用 **⌘O、⌘N、⌘T** 都打开原生接力界面，就在仓库目录执行以下命令。先前装过本仓库的单账号配置时，先执行 `npm run undo`。

```sh
npm ci --ignore-scripts
npm run preview:relay
npm run setup:relay
```

回到 cmux 按 **⌘⇧,** 重载，另开标签即可。已打开的会话可以继续用原来的方式。撤销入口用 `npm run undo` 并重载。登录配置保存在 `~/.config/claude-code-on-mac/profiles/`，名单和本地恢复记录在同级的 `relay/`。原生 CLI 默认从 `~/.local/bin` 或 PATH 查找，也可用 `CLAUDE_CLI_BIN` 指定官方可执行文件。

### 3. 它会在什么时候交接

- 启动时从登记顺序选取两个额度窗口都高于 5% 的账号。每轮完成并空闲后检查，之后每隔约 60 秒复查一次，所以其他窗格消耗的共享额度也能触发接力。每个窗格独立判断，任一窗口剩余 **小于或等于 5%** 才会尝试换到下一个。
- 接力模式会在当前 Claude 子进程禁用自动后台任务和 Agent View，便于确认交接时没有后台工作。交接要等当前会话空闲，确认没有后台任务、定时任务或正在输入的草稿。下一账号在原窗格、原项目目录里通过 `--resume` 和 `--fork-session` 从保存的记录另开分支。终端焦点回报、滚轮和按键释放不会被当作草稿；查额度期间仍可打字，有未发送的输入就保留当前窗格。下一句可以接着问。单轮耗尽额度时可能提前中断。
- 身份失效、账号受限、本轮失败、额度格式无法识别或没有合适的下一账号时暂停。排除原因后，在原项目目录运行启动时打印的恢复命令。cmux 的自动恢复还需在界面中批准。
- 启动器沿用已有的命令式状态栏。切换时优先使用当前账号配置的状态栏，缺省时读取默认 Claude 配置。每次查询额度使用官方 CLI 的 `/usage`。这套解析针对 Claude Code 2.1.325 的英文输出，升级后可先用 `--check` 验证。

`npm test` 使用模拟 CLI 在本机伪终端测试交接，不需要真实账号或订阅额度。
