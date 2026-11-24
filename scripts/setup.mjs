import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual as equal } from 'node:util';
import jsonc from 'jsonc-parser';

const script = fileURLToPath(import.meta.url);
const project = path.resolve(path.dirname(script), '..');
const config = path.join(os.homedir(), '.config/cmux/cmux.json');
const stateDir = path.join(os.homedir(), '.local/state/claude-code-on-mac');
const receipt = path.join(stateDir, 'install.json');
const format = { formattingOptions: { insertSpaces: true, tabSize: 2 } };

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function atomicWrite(file, data) {
  const temp = path.join(path.dirname(file), '.' + randomUUID());
  try {
    fs.writeFileSync(temp, data, { flag: 'wx', mode: 0o600 });
    if (fs.existsSync(file)) fs.chmodSync(temp, fs.statSync(file).mode & 0o777);
    fs.renameSync(temp, file);
  } finally { fs.rmSync(temp, { force: true }); }
}

function object(text) {
  const errors = [];
  const value = jsonc.parse(text, errors, { allowTrailingComma: true });
  if (errors.length || !value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('cmux.json 需要是有效的 JSONC 对象。请先运行 cmux config doctor。');
  return value;
}

function at(root, keys) {
  return keys.reduce((value, key) => value?.[key], root);
}

function edit(text, keys, value) {
  return jsonc.applyEdits(text, jsonc.modify(text, keys, value, format));
}

function templateEntries() {
  const { actions, ui, shortcuts } = JSON.parse(fs.readFileSync(path.join(project, 'cmux/settings.json')));
  const picker = path.join(project, 'cmux/open-folder.zsh');
  const quoted = "'" + picker.replaceAll("'", "'\\''") + "'";
  actions['ccmac.openFolder'].workspace.layout.pane.surfaces[0].command = 'source ' + quoted;
  return [
    ...Object.entries(actions).map(([id, value]) => ({ keys: ['actions', id], value })),
    { keys: ['ui', 'newWorkspace', 'action'], value: ui.newWorkspace.action },
    { keys: ['shortcuts', 'bindings', 'openFolder'], value: shortcuts.bindings.openFolder },
  ];
}

function plan(before) {
  const root = object(before ?? '{}');
  const entries = templateEntries();
  const additions = [];
  for (const entry of entries) {
    const { keys, value } = entry;
    for (let i = 1; i < keys.length; i++) {
      const ancestor = keys.slice(0, i);
      const existing = at(root, ancestor);
      if (existing !== undefined && (!existing || typeof existing !== 'object' || Array.isArray(existing))) {
        throw new Error('现有配置类型冲突：' + ancestor.join('.'));
      }
    }
    const old = at(root, keys);
    if (old === undefined) additions.push(entry);
    else if (!equal(old, value)) throw new Error('已有自定义配置：' + keys.join('.') + '。可手动合并 cmux/settings.json。');
  }
  for (const [name, action] of Object.entries(root.actions ?? {})) {
    if (['ccmac.openFolder', 'cmux.newTerminal'].includes(name)) continue;
    if ([action?.shortcut].flat().some(s => ['cmd+o', 'cmd+t'].includes(s?.toLowerCase?.())))
      throw new Error('快捷键已用于自定义动作：' + name);
  }
  for (const [name, binding] of Object.entries(root.shortcuts?.bindings ?? {})) {
    if (name === 'openFolder' || name === 'newSurface') continue;
    if ([binding].flat().some(s => ['cmd+o', 'cmd+t'].includes(s?.toLowerCase?.())))
      throw new Error('快捷键已绑定：' + name);
  }
  let after = before ?? '{}\n';
  for (const { keys, value } of additions) after = edit(after, keys, value);
  return { before, after, additions };
}

function commitConfig(expected, next) {
  if (read(config) !== expected) throw new Error('cmux.json 已在其他程序中改变，请重试。');
  if (expected === next) return;
  if (fs.lstatSync(config, { throwIfNoEntry: false })?.isSymbolicLink())
    throw new Error('cmux.json 是符号链接，请在它的配置管理工具中合并示例。');
  if (next === null) fs.unlinkSync(config);
  else {
    fs.mkdirSync(path.dirname(config), { recursive: true });
    atomicWrite(config, next);
  }
}

function run(mode) {
  if (fs.lstatSync(config, { throwIfNoEntry: false })?.isSymbolicLink())
    throw new Error('cmux.json 是符号链接，请在它的配置管理工具中合并示例。');
  const before = read(config);
  const saved = read(receipt);
  if (mode === 'uninstall') {
    if (saved === null) return console.log('没有本工具的安装记录。');
    const previous = JSON.parse(saved);
    if (before === previous.after) commitConfig(before, previous.before);
    else if (before !== null && before !== previous.before) {
      const current = object(before);
      let next = before;
      for (const { keys, value } of previous.additions) {
        if (equal(at(current, keys), value)) next = edit(next, keys, undefined);
      }
      // Keep sections the user has edited, including comments inside an empty section.
      commitConfig(before, next);
    }
    fs.unlinkSync(receipt);
    return console.log('已撤销本工具仍在使用的配置。');
  }
  if (saved !== null) {
    const previous = JSON.parse(saved);
    if (before === previous.before && mode === 'install') {
      commitConfig(before, previous.after);
      return console.log('安装已完成。');
    }
    if (!templateEntries().every(e => equal(at(object(before ?? '{}'), e.keys), e.value)))
      throw new Error('已有安装记录，配置或仓库位置已改变。先运行 npm run undo，再预览。');
    return console.log('已安装，无需重复写入。');
  }
  const changes = plan(before);
  for (const item of changes.additions) console.log('+ ' + item.keys.join('.') + ' ' + JSON.stringify(item.value));
  if (mode === 'preview' || !changes.additions.length) return;
  atomicWrite(receipt, JSON.stringify(changes));
  commitConfig(before, changes.after);
  console.log('已安装。回到 cmux 按 ⌘⇧, 重载配置。');
}

try {
  const [mode, locked] = process.argv.slice(2);
  if (!['preview', 'install', 'uninstall'].includes(mode)) throw new Error('用法：setup.mjs preview|install|uninstall');
  if (mode === 'preview' || locked === '--locked') run(mode);
  else {
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    const child = spawnSync('/usr/bin/lockf', ['-t', '10', path.join(stateDir, 'setup.lock'),
      process.execPath, script, mode, '--locked'], { stdio: 'inherit' });
    if (child.error) throw child.error;
    process.exitCode = child.status ?? 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
