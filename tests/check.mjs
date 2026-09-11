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
const names = ['intentcraft', 'intentcraft-review'];

function walk(path) {
  assert(!lstatSync(path).isSymbolicLink(), `Unexpected symlink: ${path}`);
  return lstatSync(path).isDirectory()
    ? readdirSync(path).sort().flatMap(name => walk(join(path, name)))
    : [path];
}

// Validate this project's deliberately small frontmatter subset. No YAML parser claims.
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
  for (const [, link] of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const path = resolve(dirname(file), decodeURIComponent(link.split('#')[0]));
    const rel = relative(boundary, path);
    assert(rel !== '..' && !rel.startsWith('../'), `Link escapes owner: ${file} -> ${link}`);
    assert(existsSync(path), `Broken link: ${file} -> ${link}`);
  }
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
assert(extension.includes('new URL("../skills/intentcraft/SKILL.md", import.meta.url)'));
assert(extension.includes('new URL("../skills/intentcraft-review/SKILL.md", import.meta.url)'));
assert(extension.includes('pi.sendUserMessage(message'), 'Forward plugin commands to the agent');
assert.deepEqual(Object.keys(manifest.scripts), ['test'], 'No installation hooks');
assert(manifest.keywords.includes('pi-package'));

const skillFiles = walk(join(root, 'skills'));
assert.equal(skillFiles.filter(path => path.endsWith('/SKILL.md')).length, 2);
const markers = {
  intentcraft: ['manual-only', 'proportional', 'surface-aware', 'evidence-before-claim', 'readiness-not-authority'],
  'intentcraft-review': ['manual-only', 'read-only', 'independent-evidence', 'review-coverage'],
};

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
  for (const marker of markers[name]) assert(main.includes(`<!-- rule: ${marker} -->`), marker);
  for (const file of walk(owner)) {
    assert(file.endsWith('.md'), 'Skills contain instructions only');
    checkLinks(file, owner); // Each skill must be independently installable.
  }
}

const referenceMarkers = {
  'research.md': ['chain-coverage', 'evidence-types', 'bounded-negative', 'competitor-research'],
  'discussion.md': ['combination-check'],
  'requirements.md': ['requirements-ready'],
  'planning.md': ['outcome-units', 'plan-ready'],
  'continuity.md': ['decision-continuity', 'invalidate-affected'],
  'probes.md': ['prototype-self-review-loop'],
};
for (const [file, required] of Object.entries(referenceMarkers)) {
  const text = read(`skills/intentcraft/references/${file}`);
  for (const marker of required) assert(text.includes(`<!-- rule: ${marker} -->`), marker);
}

for (const file of [join(root, 'README.md'), join(root, 'ATTRIBUTION.md'),
  ...walk(join(root, 'tests')), ...walk(join(root, 'docs'))].filter(path => path.endsWith('.md'))) {
  checkLinks(file, root);
}
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
  console.log(`PASS: 2 manual-only skills, local links, rule markers, ${cases.length} scenario definitions, ${packed.length} packed files.`);
  console.log('Static checks passed; model behavior and host enforcement require separate evidence.');
} finally {
  rmSync(cache, { recursive: true, force: true });
}
