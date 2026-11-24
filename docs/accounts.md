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

## 实验记录

本地原型曾用三个官方登录配置读取五小时和周额度，任一窗口剩余达到 5% 时，等当前轮次结束、没有后台任务或待发送输入，再尝试从已保存记录创建分支。登录失败、额度不可读或账号受限时暂停。它依赖特定 CLI 版本的用量输出及会话状态，跨账号会涉及将已有对话内容带入另一账号。

本版提供手动配置选择与同账号续聊。阈值自动轮换列为本地实验，发布前还需确认订阅使用条件及版本兼容性。请按账号实际适用的条款使用。[Anthropic 个人服务条款](https://www.anthropic.com/legal/consumer-terms)
