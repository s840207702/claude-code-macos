#!/bin/zsh
# Read-only local checks. Only --network sends an HTTPS request.
emulate -L zsh
if (( $# > 1 )) || [[ -n ${1:-} && $1 != --network ]]; then
  print -u2 '用法：scripts/doctor.zsh [--network]'
  exit 2
fi
result=0
cli=${commands[cmux]:-/Applications/cmux.app/Contents/Resources/bin/cmux}
if [[ -x $cli ]]; then "$cli" version || result=1; else print '缺少 cmux'; result=1; fi
if (( $+commands[claude] )); then command claude --version || result=1; else print 'PATH 中缺少 claude'; result=1; fi
for name in HTTPS_PROXY HTTP_PROXY ALL_PROXY NO_PROXY https_proxy http_proxy all_proxy no_proxy; do
  [[ -n ${(P)name} ]] && print "当前终端设置了 $name"
done
if [[ $1 == --network ]]; then
  # Keep curl's normal proxy environment, skip ~/.curlrc and send no auth header.
  code=$(/usr/bin/curl -q -s -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 12 https://api.anthropic.com/)
  if (( $? == 0 )); then
    print "API 域名返回 HTTP $code。登录和模型请求请在 Claude 内另行验证。"
  else
    print -u2 'API 域名连接失败。请核对 DNS、代理路径和 TLS 证书。'
    result=1
  fi
fi
exit $result
