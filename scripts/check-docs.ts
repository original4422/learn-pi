import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, join, relative, dirname } from 'node:path';
const root = resolve('docs');
async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.filter(e => !e.name.startsWith('.')).map(async e => e.isDirectory() ? files(join(directory, e.name)) : [join(directory, e.name)]))).flat();
}
const markdown = (await files(root)).filter(f => f.endsWith('.md'));
const zh = markdown.map(f => relative(root, f)).filter(f => !f.startsWith('en/')).sort();
const en = markdown.map(f => relative(root, f)).filter(f => f.startsWith('en/')).map(f => f.slice(3)).sort();
const errors: string[] = [];
if (JSON.stringify(zh) !== JSON.stringify(en)) errors.push(`Locale page mismatch: zh=${zh.join(',')} en=${en.join(',')}`);
for (const file of markdown) {
  const text = await readFile(file, 'utf8');
  if (file.includes('/chapters/') && text.length < 1800) errors.push(`Chapter too short for a complete lesson: ${relative(root, file)}`);
  if (/^\s*(?:TODO|TBD|COMING SOON|待补充|正文待完善)\s*$/im.test(text)) errors.push(`Placeholder: ${file}`);
}
const built = join(root, '.vitepress/dist');
const pages = (await files(built)).filter(f => f.endsWith('.html'));
const contents = new Map(await Promise.all(pages.map(async f => [f, await readFile(f, 'utf8')] as const)));
let links = 0;
for (const [file, html] of contents) {
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
    const href = match[1]!.replaceAll('&amp;', '&');
    if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue;
    links++;
    const [pathQuery, rawFragment] = href.split('#');
    const urlPath = decodeURIComponent(pathQuery!.split('?')[0]!);
    let target = urlPath ? resolve(urlPath.startsWith('/') ? built : dirname(file), urlPath.replace(/^\//, '')) : file;
    if (target.endsWith('/')) target += 'index.html';
    let exists = false;
    for (const candidate of [target, target + '.html', join(target, 'index.html')]) {
      try { if ((await stat(candidate)).isFile()) { target = candidate; exists = true; break; } } catch {}
    }
    if (!exists) { errors.push(`${relative(built, file)} → missing ${href}`); continue; }
    if (rawFragment && contents.has(target)) {
      const fragment = decodeURIComponent(rawFragment).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
      const targetHtml = contents.get(target)!;
      if (!targetHtml.includes(`id="${fragment}"`) && !targetHtml.includes(`name="${fragment}"`)) errors.push(`${relative(built, file)} → missing anchor ${href}`);
    }
  }
}
if (!contents.get(join(built, 'index.html'))?.includes('lang="zh-CN"')) errors.push('Root locale is not zh-CN');
if (!contents.get(join(built, 'en/index.html'))?.includes('lang="en"')) errors.push('English locale is not en');
if (errors.length) throw new Error([...new Set(errors)].join('\n'));
console.log(`PASS: ${zh.length} Chinese + ${en.length} English pages, ${pages.length} built pages, ${links} local links/anchors; default zh-CN.`);
