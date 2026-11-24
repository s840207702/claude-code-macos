import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import jsonc from 'jsonc-parser';

const root = fileURLToPath(new URL('../', import.meta.url));
function fixture(t, initial) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ccmac-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const config = path.join(home, '.config/cmux/cmux.json');
  if (initial !== undefined) {
    fs.mkdirSync(path.dirname(config), { recursive: true });
    fs.writeFileSync(config, initial);
  }
  function run(mode, expected = 0) {
    const r = spawnSync(process.execPath, ['scripts/setup.mjs', mode],
      { cwd: root, env: { ...process.env, HOME: home }, encoding: 'utf8' });
    assert.equal(r.status, expected, r.stderr);
    return r.stdout;
  }
  return { home, config, run, read: () => fs.readFileSync(config, 'utf8') };
}

test('空 HOME 可预览、安装、重复安装、彻底撤销', t => {
  const f = fixture(t);
  assert.match(f.run('preview'), /cmd\+o/);
  assert.ok(!fs.existsSync(f.config));
  f.run('install');
  const installed = f.read();
  const settings = jsonc.parse(installed);
  const picker = settings.actions['ccmac.openFolder'].workspace.layout.pane.surfaces[0].command;
  assert.ok(picker.includes('cmux/open-folder.zsh'));
  assert.equal(settings.actions['cmux.newTerminal'].command, 'claude');
  assert.equal(settings.ui.newWorkspace.action, 'ccmac.newWorkspace');
  f.run('install');
  assert.equal(f.read(), installed);
  f.run('uninstall');
  assert.ok(!fs.existsSync(f.config));
  f.run('uninstall');
});

test('保留旧配置、注释与尾逗号，撤销后逐字相同', t => {
  const initial = '{\n // 我的配置\n "commands": [],\n "actions": {"mine": {"type":"command","command":"pwd"}},\n}\n';
  const f = fixture(t, initial);
  f.run('install');
  assert.match(f.read(), /我的配置/);
  f.run('uninstall');
  assert.equal(f.read(), initial);
});

test('卸载保留安装以后用户修改的值', t => {
  const f = fixture(t, '{}'); f.run('install');
  const current = jsonc.parse(f.read());
  current.actions['cmux.newTerminal'].command = 'my-shell';
  current.app = { appearance: 'dark' };
  fs.writeFileSync(f.config, JSON.stringify(current));
  f.run('uninstall');
  const after = jsonc.parse(f.read());
  assert.equal(after.actions['cmux.newTerminal'].command, 'my-shell');
  assert.equal(after.app.appearance, 'dark');
  assert.ok(!after.actions['ccmac.openFolder']);
});

test('现有快捷键冲突时原文件保持一致', t => {
  const initial = '{"actions":{"existing":{"shortcut":"cmd+o","command":"pwd"}}}';
  const f = fixture(t, initial); f.run('install', 1);
  assert.equal(f.read(), initial);
});

test('手动账号配置将参数原样传给 CLI，并拒绝含路径的配置名', t => {
  const f = fixture(t);
  const cli = path.join(f.home, 'test-cli');
  fs.writeFileSync(cli, '#!/bin/sh\nprintf "%s\\n" "$CLAUDE_CONFIG_DIR" "$PWD" "$@"\n', { mode: 0o700 });
  const opts = { cwd: root, env: { ...process.env, HOME: f.home, CLAUDE_CLI_BIN: cli }, encoding: 'utf8' };
  const res = spawnSync('./scripts/with-profile.zsh', ['work', '--resume', 'two words'], opts);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(res.stdout.trimEnd().split('\n'), [
    path.join(f.home, '.config/claude-code-on-mac/profiles/work'), fs.realpathSync(root), '--resume', 'two words'
  ]);
  assert.equal(spawnSync('./scripts/with-profile.zsh', ['../bad'], opts).status, 2);
});

test('选项目后在选定目录启动 Claude，取消选择时不启动', t => {
  const f = fixture(t);
  const folder = path.join(f.home, "项目 O'Brien");
  fs.mkdirSync(folder);
  const bin = name => path.join(f.home, name);
  for (const [name, body] of Object.entries({
    osascript: 'cat >/dev/null; printf "%s" "$CHOSEN"',
    cmux: 'printf "%s\\n" "$@" > "$HOME/title"',
    claude: 'pwd > "$HOME/launched"',
  })) fs.writeFileSync(bin(name), '#!/bin/sh\n' + body, { mode: 0o700 });
  const opts = { cwd: root, env: { HOME: f.home, PATH: f.home + ':/usr/bin:/bin', CMUX_WORKSPACE_ID: 'test-workspace',
    CMUX_SURFACE_ID: 'test-surface', CMUX_BUNDLED_CLI_PATH: bin('cmux'), CHOSEN: '' }, encoding: 'utf8' };
  const launch = () => spawnSync('/bin/zsh', ['-fc', 'source cmux/open-folder.zsh'], opts);
  assert.equal(launch().status, 0);
  assert.ok(!fs.existsSync(bin('launched')));
  opts.env.CHOSEN = folder;
  const res = launch(); assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.readFileSync(bin('launched'), 'utf8').trimEnd(), folder);
  assert.equal(fs.readFileSync(bin('title'), 'utf8').trimEnd().split('\n').pop(), path.basename(folder));
});

test('符号链接配置由原管理工具维护，拒绝写入且不留安装回执', t => {
  const f = fixture(t, '{}');
  const target = path.join(f.home, 'settings.json');
  fs.renameSync(f.config, target);
  fs.symlinkSync(target, f.config);
  f.run('preview', 1);
  f.run('install', 1);
  assert.equal(fs.readFileSync(target, 'utf8'), '{}');
  assert.equal(fs.readlinkSync(f.config), target);
  assert.ok(!fs.existsSync(path.join(f.home, '.local/state/claude-code-on-mac/install.json')));
});

test('接力模式接管三个入口，单账号模式可独立恢复', t => {
  const f = fixture(t);
  const run = (mode, expected = 0) => {
    const result = spawnSync(process.execPath, ['scripts/setup.mjs', mode, '--relay'], {
      cwd: root, env: { ...process.env, HOME: f.home }, encoding: 'utf8',
    });
    assert.equal(result.status, expected, result.stderr);
  };
  run('preview');
  assert.ok(!fs.existsSync(f.config));
  run('install');
  const settings = jsonc.parse(f.read());
  const launcher = settings.actions['cmux.newTerminal'].command;
  assert.match(launcher, /scripts\/claude-relay/);
  const command = name => settings.actions[name].workspace.layout.pane.surfaces[0].command;
  assert.equal(command('ccmac.newWorkspace'), launcher);
  assert.ok(command('ccmac.openFolder').endsWith(' --relay ' + launcher));
  f.run('install', 1);
  f.run('uninstall');
  f.run('install');
  assert.equal(jsonc.parse(f.read()).actions['cmux.newTerminal'].command, 'claude');
});
