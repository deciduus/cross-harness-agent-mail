// Dependency-free checks for this package's simple skill frontmatter and links.
import {readFileSync, readdirSync, existsSync, statSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
const errors = [];
const skill = readFileSync(join(root, 'SKILL.md'), 'utf8').replaceAll('\r\n', '\n');
const fm = skill.match(/^---\n([\s\S]*?)\n---\n/);
if (!fm) errors.push('Missing YAML frontmatter');
else {
  const fields = Object.fromEntries(fm[1].split('\n').map(line => {
    const colon = line.indexOf(':');
    if (colon < 1) errors.push('Unsupported frontmatter line');
    return [line.slice(0, colon), line.slice(colon + 1).trim()];
  }));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.name ?? '') || fields.name.length > 64) errors.push('Invalid skill name');
  if (!fields.description || fields.description.length > 1024) errors.push('Invalid description');
  if (Object.keys(fields).some(k => !['name', 'description'].includes(k))) errors.push('Unexpected frontmatter field');
}
function inspect(dir) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) inspect(file);
    else if (entry.name.endsWith('.md')) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const link = match[1].split('#')[0];
        if (!link || /^[a-z]+:\/\//i.test(link)) continue;
        if (!existsSync(resolve(dirname(file), link))) errors.push(`Broken link in ${entry.name}: ${link}`);
      }
      if (/\[TODO\]|\[INSERT\]|\[REPLACE\]/.test(text)) errors.push(`Scaffold placeholder in ${entry.name}`);
    }
  }
}
inspect(root);
const ui = readFileSync(join(root, 'agents', 'openai.yaml'), 'utf8');
if (!ui.includes('$agent-mail-coordinator')) errors.push('UI prompt missing skill invocation');
if (statSync(join(root, 'SKILL.md')).size > 10000) errors.push('Entrypoint too large');
const retainedHash = createHash('sha256').update(readFileSync(join(root, 'adapters', 'legacy-mail.ps1'))).digest('hex');
if (retainedHash !== 'd922ebc3cb7efaa54436dfe2f55ca7777d874811ebfbcf1e19b4747928a46a86') errors.push('Retained legacy source bytes differ');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('PASS skill name/frontmatter, UI invocation, local references, no scaffold placeholders, retained source hash');
console.log('This checks the simple authored frontmatter subset; it is not a general YAML parser.');
