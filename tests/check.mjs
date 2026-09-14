import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

// Static contracts and distribution checks, not a model-behavior evaluator.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(root, path), 'utf8');
const manifest = JSON.parse(read('package.json'));
const names = ['ic-research', 'ic-prepare', 'ic-design-review', 'ic-do', 'ic-code-review'];

function walk(path) {
  assert(!lstatSync(path).isSymbolicLink(), `Unexpected symlink: ${path}`);
  return lstatSync(path).isDirectory()
    ? readdirSync(path).sort().flatMap(name => walk(join(path, name)))
    : [path];
}

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert(match, 'Missing frontmatter');
  const fields = {};
  for (const line of match[1].split('\n')) {
    const entry = line.match(/^([a-z-]+): (.+)$/);
    assert(entry, `Unsupported frontmatter syntax: ${line}`);
    const [, key, raw] = entry;
    assert(!Object.hasOwn(fields, key), `Duplicate field: ${key}`);
    fields[key] = raw === 'true' ? true : raw.startsWith('"') ? JSON.parse(raw) : raw;
  }
  return fields;
}

function checkLinks(file, boundary) {
  const text = readFileSync(file, 'utf8');
  const links = [];
  for (const [, link] of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const path = resolve(dirname(file), decodeURIComponent(link.split('#')[0]));
    const rel = relative(boundary, path);
    assert(rel !== '..' && !rel.startsWith('../'), `Link escapes owner: ${file} -> ${link}`);
    assert(existsSync(path), `Broken link: ${file} -> ${link}`);
    links.push(path);
  }
  return links;
}

assert.equal(manifest.name, 'intentcraft');
assert.equal(manifest.private, true, 'Do not accidentally publish to npm');
assert.deepEqual(manifest.pi, {
  extensions: ['./extensions'],
  skills: names.map(name => `./skills/${name}`),
});
assert(!manifest.dependencies && !manifest.devDependencies, 'Keep runtime dependency-free');
assert.deepEqual(manifest.peerDependencies, { '@earendil-works/pi-coding-agent': '*' });
const extension = read('extensions/intentcraft.ts');
assert(extension.includes('for (const [name, url] of Object.entries(SKILLS))'), 'Register plugin commands');
for (const name of names) {
  assert(extension.includes(`new URL("../skills/${name}/SKILL.md", import.meta.url)`), `${name} plugin path`);
}
assert(extension.includes('pi.sendUserMessage(message'), 'Forward plugin commands to the agent');
assert(extension.includes('descriptionFrom(skill, name)'), 'Read command descriptions from skill frontmatter');
assert(extension.includes('const projectRoot = process.cwd()'), 'Pass the target project root to the model');
assert(!extension.includes('const DESCRIPTIONS'), 'Do not duplicate skill descriptions in the extension');
assert.deepEqual(Object.keys(manifest.scripts), ['test'], 'No installation hooks');
assert(manifest.keywords.includes('pi-package'));

for (const name of names) {
  const main = read(`skills/${name}/SKILL.md`);
  assert(main.includes(`docs/${name}/YYYY-MM-DD-<topic>.md`), `${name}: missing dated output path contract`);
  assert(main.includes('默认要求落盘') && main.includes('必须落盘'), `${name}: missing explicit default persistence rule`);
  assert(main.includes('已落盘：<path>') && main.includes('未落盘：<理由>'), `${name}: missing persistence report`);
  assert(main.includes('不机械地在结尾追加'), `${name}: missing in-place document update rule`);
  if (name === 'ic-do') {
    assert(main.includes('版本或工作区快照'), `${name}: missing version-bound execution evidence`);
  }
  if (name === 'ic-code-review') {
    assert(main.includes('执行证据对应的版本或工作区快照'), `${name}: missing version-bound review evidence`);
    assert(main.includes('仅允许按本 skill 的产出契约创建或更新审查报告'), `${name}: unclear read-only report exception`);
  }
}
for (const obsolete of ['docs/ic-review', 'skills/ic-review']) {
  assert(!existsSync(join(root, obsolete)), `Obsolete path remains: ${obsolete}`);
}
const skillFiles = walk(join(root, 'skills'));
assert.equal(skillFiles.filter(path => path.endsWith('/SKILL.md')).length, 5);
for (const name of names) {
  const owner = join(root, 'skills', name);
  const main = read(`skills/${name}/SKILL.md`);
  const fields = frontmatter(main);
  assert.equal(fields.name, name);
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 64);
  assert.equal(fields['disable-model-invocation'], true, `${name} must be a bare boolean true`);
  assert(fields.description.length > 0 && fields.description.length <= 1024);
  assert(fields.compatibility.length > 0 && fields.compatibility.length <= 500);
  assert.equal(fields.license, 'MIT');
  assert(main.includes(`/skill:${name}`), 'Document the real Pi command');
  const reachable = new Set();
  function visit(file) {
    if (reachable.has(file)) return;
    reachable.add(file);
    assert(file.endsWith('.md'), 'Skills contain instructions only');
    for (const link of checkLinks(file, owner)) visit(link);
  }
  visit(join(owner, 'SKILL.md'));
  assert.deepEqual([...reachable].sort(), walk(owner).sort(), `${name}: unreachable skill resource`);
}

for (const file of [...walk(join(root, 'tests')), ...walk(join(root, 'docs')), join(root, 'README.md'), join(root, 'ATTRIBUTION.md')]
  .filter(path => path.endsWith('.md'))) checkLinks(file, root);

const ignore = read('.gitignore').split('\n');
assert(ignore.includes('/example/') && ignore.includes('/.pi/'));
const cases = read('tests/scenarios.md').match(/^## S\d+ /gm) ?? [];
assert(cases.length >= 12, 'Keep representative behavior scenarios');

const cache = mkdtempSync(join(tmpdir(), 'intentcraft-npm-'));
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: cache, npm_config_update_notifier: 'false' },
    maxBuffer: 2 * 1024 * 1024,
  }))[0].files.map(file => file.path).sort();
  const expected = ['package.json', 'README.md', 'LICENSE', 'ATTRIBUTION.md',
    ...['extensions', 'skills', 'tests', 'docs'].flatMap(dir => walk(join(root, dir)).map(path => relative(root, path)))
  ].sort();
  assert.deepEqual(packed, expected, 'Unexpected distribution files or missing resources');
  assert(!packed.some(path => /^(example|\.pi|\.agents|node_modules)\//.test(path)));
  assert(packed.some(path => path === 'skills/ic-code-review/SKILL.md'));
  console.log(`PASS: ${names.length} manual-only skills, dated output contracts, reachable resources, contract text, ${cases.length} scenario definitions, ${packed.length} packed files.`);
  console.log('Static checks passed; model behavior and host enforcement require separate evidence.');
} finally {
  rmSync(cache, { recursive: true, force: true });
}
