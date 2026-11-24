#!/bin/zsh
# Run the official CLI with a separate local config directory.
emulate -L zsh
setopt extendedglob
if (( $# < 1 )) || [[ $1 != [a-zA-Z0-9][a-zA-Z0-9_-]# ]]; then
  print -u2 '用法：scripts/with-profile.zsh <配置名> [Claude 参数]'
  exit 2
fi
profile="$HOME/.config/claude-code-on-mac/profiles/$1"
shift
umask 077
mkdir -p -- "$profile" || exit 1
# Prefer the installed CLI to an interactive terminal alias or integration shim.
cli=${CLAUDE_CLI_BIN:-"$HOME/.local/bin/claude"}
[[ -x $cli ]] || cli=${commands[claude]:-}
[[ -x $cli ]] || { print -u2 '找不到 claude。可用 CLAUDE_CLI_BIN 指定官方 CLI 的绝对路径。'; exit 1; }
export CLAUDE_CONFIG_DIR="$profile"
exec "$cli" "$@"
