# 验证 Claude Code 的网络路径

## 出口 IP 和域名分流

1. 打开 Clash Verge 的规则模式。在已有配置的 rules 列表中加入示例的两条规则，将 CLAUDE-EXIT 替换成自己的策略组，放在 MATCH 前面。使用订阅时，在客户端的本地覆写中维护规则，以免订阅更新覆盖修改。[分流片段](../examples/claude-routing.yaml) · [mihomo 规则语法](https://wiki.metacubex.one/en/config/rules/)
2. 看一眼该策略组选了哪个节点。在 cmux 中向 Claude 发送一个正常的简短请求，按时间在 Clash 的连接记录或日志中找到 API 域名，记录命中的规则、最终节点和时间。使用系统代理、TUN 或终端 HTTPS_PROXY 时，分别以这次请求的记录为准。安装、登录和更新还可能用到额外域名。[Claude Code 网络要求](https://code.claude.com/docs/en/network-config)
3. 想核对公网出口 IP，可以让自己信任的 IP 回显服务临时走同一策略组和节点，在同一个终端请求它，再查该请求的连接记录。测试后撤销临时规则。回显服务会收到访问者 IP。对外分享时用“出口 A”代替具体地址。API 服务器的 IP 是目的地址。

## DNS 解析

运行 `scutil --dns` 看 Mac 的系统解析器，再看 Clash 当前生效配置的 DNS、nameserver、nameserver-policy，以及 TUN 模式下的 dns-hijack。fake-ip 地址是代理分配给域名的本地映射，仅凭这个结果无法判断上游解析器。[mihomo DNS 文档](https://wiki.metacubex.one/en/config/dns/)

如果实际解析器不符合预期，在生效配置中把相关域名的 nameserver-policy 指向预期解析器。使用 TUN 接管明文 DNS 时，检查 dns-hijack 是否覆盖实际的 DNS 流量。浏览器自带的加密 DNS 需要在浏览器里单独核对。

要实测，可向自己控制的测试域名发送一次带随机前缀的查询，用唯一域名和时间对照代理日志与权威 DNS 查询日志，确认实际递归解析服务是否符合预期。浏览器启用安全 DNS 时另测一次。没有权威日志时，把结果记为“看到本机解析路径，上游未核实”。

## 浏览器 WebRTC

在实际使用的浏览器打开 Trickle ICE，选用你信任的 STUN 服务，点击 Gather candidates。浏览器会向测试服务发送探测请求。观察 srflx 候选的公网地址是否与预期出口一致，同时记录网络、浏览器和代理模式。host 可能是局域网地址或 mDNS 名称，relay 是 TURN 中继。没有返回 srflx 时，公网路径仍未确定。[WebRTC 官方测试页](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)

如果出现意外公网地址，先检查该浏览器的 UDP 流量是否也经过预期代理。调整浏览器或代理设置后用同一测试复查。WebRTC 的结果描述该浏览器，CLI 的实际出口仍以第一节的请求记录为准。
