import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

export type CommentHit = { readonly line: number; readonly text: string };
export type Violation = { readonly location: string; readonly message: string };

const TOOL_DIRECTIVE = /^(biome-ignore\b.*:\s*\S|@ts-expect-error\s+\S)/;
const STRICT_LINT_MARKER = 'deny(clippy::unwrap_used';
const GENERATED_BINDINGS_DIR = join('src', 'core', 'ipc', 'bindings');
const LAYER_DIRS = ['app', 'screens', 'core', 'shared'];
const IDENTIFIER_CHARACTER = /[A-Za-z0-9_]/;
const GLOBAL_STYLESHEET = join('src', 'app', 'styles.css');
const LEGACY_UI_LIBRARY_IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*['"]@heroui\//;
const RAW_STRING_OPENING = /b?r(#*)"/y;

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let position = 0; position < index; position += 1) {
    if (source[position] === '\n') line += 1;
  }
  return line;
}

function isDirective(commentText: string): boolean {
  const body = commentText.replace(/^\/\/|^\/\*|\*\/$/g, '').trim();
  return TOOL_DIRECTIVE.test(body);
}

function scriptKindOf(fileName: string): ts.ScriptKind {
  return fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function collectNodes(node: ts.Node, sourceFile: ts.SourceFile, into: ts.Node[]): void {
  into.push(node);
  for (const child of node.getChildren(sourceFile)) collectNodes(child, sourceFile, into);
}

function commentRangesAround(text: string, node: ts.Node): ts.CommentRange[] {
  return [
    ...(ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []),
    ...(ts.getTrailingCommentRanges(text, node.getEnd()) ?? []),
  ];
}

function isInside(range: ts.CommentRange, container: ts.Node): boolean {
  return range.pos >= container.getFullStart() && range.end <= container.getEnd();
}

export function findTypeScriptComments(source: string, fileName = 'file.ts'): CommentHit[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindOf(fileName),
  );
  const nodes: ts.Node[] = [];
  collectNodes(sourceFile, sourceFile, nodes);
  const jsxTexts = nodes.filter((node) => node.kind === ts.SyntaxKind.JsxText);
  const byPosition = new Map<number, ts.CommentRange>();
  for (const node of nodes) {
    if (node.kind === ts.SyntaxKind.JsxText) continue;
    for (const range of commentRangesAround(source, node)) byPosition.set(range.pos, range);
  }
  return [...byPosition.values()]
    .filter((range) => !jsxTexts.some((text) => isInside(range, text)))
    .map((range) => ({ range, text: source.slice(range.pos, range.end) }))
    .filter(({ text }) => !isDirective(text))
    .map(({ range, text }) => ({ line: lineOf(source, range.pos), text }))
    .sort((left, right) => left.line - right.line);
}

export function importsLegacyUiLibrary(source: string): boolean {
  return LEGACY_UI_LIBRARY_IMPORT.test(source);
}

export function isGlobalStylesheet(relativePath: string): boolean {
  return relativePath === GLOBAL_STYLESHEET;
}

function stringEnd(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length && source[index] !== quote) {
    index += source[index] === '\\' ? 2 : 1;
  }
  return index + 1;
}

function rawStringEnd(source: string, start: number): number | null {
  if (start > 0 && IDENTIFIER_CHARACTER.test(source[start - 1] ?? '')) return null;
  RAW_STRING_OPENING.lastIndex = start;
  const opening = RAW_STRING_OPENING.exec(source);
  if (opening === null) return null;
  const closing = `"${opening[1]}`;
  const closingIndex = source.indexOf(closing, start + opening[0].length);
  return closingIndex === -1 ? source.length : closingIndex + closing.length;
}

function charLiteralEnd(source: string, start: number): number | null {
  if (source[start + 1] === '\\') {
    const closingIndex = source.indexOf("'", start + 3);
    return closingIndex === -1 ? null : closingIndex + 1;
  }
  const width = (source.codePointAt(start + 1) ?? 0) > 0xffff ? 2 : 1;
  return source[start + 1 + width] === "'" ? start + 2 + width : null;
}

function lineCommentEnd(source: string, start: number): number {
  const newline = source.indexOf('\n', start);
  return newline === -1 ? source.length : newline;
}

function blockCommentEnd(source: string, start: number): number {
  let depth = 0;
  let index = start;
  while (index < source.length) {
    const pair = source.slice(index, index + 2);
    if (pair === '/*') {
      depth += 1;
      index += 2;
    } else if (pair === '*/') {
      depth -= 1;
      index += 2;
      if (depth === 0) return index;
    } else {
      index += 1;
    }
  }
  return source.length;
}

function rustCommentEnd(source: string, index: number): number | null {
  const pair = source.slice(index, index + 2);
  if (pair === '//') return lineCommentEnd(source, index);
  if (pair === '/*') return blockCommentEnd(source, index);
  return null;
}

function rustLiteralEnd(source: string, index: number): number | null {
  const raw = rawStringEnd(source, index);
  if (raw !== null) return raw;
  if (source[index] === '"') return stringEnd(source, index);
  if (source[index] === "'") return charLiteralEnd(source, index);
  return null;
}

export function findCssComments(source: string): CommentHit[] {
  const hits: CommentHit[] = [];
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('/*', index)) {
      const end = blockCommentEnd(source, index);
      hits.push({ line: lineOf(source, index), text: source.slice(index, end) });
      index = end;
      continue;
    }
    const quote = source[index];
    index = quote === '"' || quote === "'" ? stringEnd(source, index) : index + 1;
  }
  return hits;
}

export function findRustComments(source: string): CommentHit[] {
  const hits: CommentHit[] = [];
  let index = 0;
  while (index < source.length) {
    const commentEnd = rustCommentEnd(source, index);
    if (commentEnd !== null) {
      hits.push({ line: lineOf(source, index), text: source.slice(index, commentEnd) });
      index = commentEnd;
      continue;
    }
    index = rustLiteralEnd(source, index) ?? index + 1;
  }
  return hits;
}

export function listLegacyFeatures(biomeConfig: string): string[] {
  const names = [...biomeConfig.matchAll(/"!src\/features\/([^/*"]+)\/\*\*"/g)].map(
    (match) => match[1] ?? '',
  );
  return [...new Set(names)];
}

export function hasSequenceDiagram(markdown: string): boolean {
  const blocks = [...markdown.matchAll(/```mermaid\n([\s\S]*?)```/g)];
  return blocks.some((block) => /^\s*sequenceDiagram\b/m.test(block[1] ?? ''));
}

function filesUnder(directory: string, extensions: readonly string[]): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path, extensions);
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
  });
}

function directoriesIn(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function newStructureFeatures(root: string): string[] {
  const legacy = listLegacyFeatures(readFileSync(join(root, 'biome.json'), 'utf8'));
  return directoriesIn(join(root, 'src', 'features')).filter((name) => !legacy.includes(name));
}

function newStructureFiles(root: string, extensions: readonly string[]): string[] {
  const layerDirs = LAYER_DIRS.map((name) => join(root, 'src', name));
  const featureDirs = newStructureFeatures(root).map((name) => join(root, 'src', 'features', name));
  return [...layerDirs, ...featureDirs]
    .flatMap((directory) => filesUnder(directory, extensions))
    .filter((file) => !relative(root, file).startsWith(GENERATED_BINDINGS_DIR));
}

function migratedRustContexts(root: string): string[] {
  const sourceRoot = join(root, 'src-tauri', 'src');
  const migrated = directoriesIn(sourceRoot).filter((name) => {
    const modFile = join(sourceRoot, name, 'mod.rs');
    return existsSync(modFile) && readFileSync(modFile, 'utf8').includes(STRICT_LINT_MARKER);
  });
  return [...new Set([...migrated, 'core'])].map((name) => join(sourceRoot, name));
}

function commentViolations(root: string, files: string[], find: (file: string) => CommentHit[]) {
  return files.flatMap((file) =>
    find(file).map((hit) => ({
      location: `${relative(root, file)}:${hit.line}`,
      message: `comment is not allowed: ${hit.text.split('\n')[0]}`,
    })),
  );
}

function flowViolations(root: string): Violation[] {
  return newStructureFeatures(root).flatMap((name) => {
    const flowFile = join(root, 'src', 'features', name, 'flow.md');
    const location = relative(root, flowFile);
    if (!existsSync(flowFile)) return [{ location, message: 'feature has no flow.md' }];
    if (hasSequenceDiagram(readFileSync(flowFile, 'utf8'))) return [];
    return [{ location, message: 'flow.md has no mermaid sequenceDiagram block' }];
  });
}

export function collectViolations(root: string): Violation[] {
  const typeScript = commentViolations(root, newStructureFiles(root, ['.ts', '.tsx']), (file) =>
    findTypeScriptComments(readFileSync(file, 'utf8'), file),
  );
  const rustFiles = migratedRustContexts(root).flatMap((directory) =>
    filesUnder(directory, ['.rs']),
  );
  const rust = commentViolations(root, rustFiles, (file) =>
    findRustComments(readFileSync(file, 'utf8')),
  );
  const cssFiles = newStructureFiles(root, ['.css']);
  const strayCss = cssFiles
    .filter((file) => !isGlobalStylesheet(relative(root, file)))
    .map((file) => ({
      location: relative(root, file),
      message: `.css is not allowed; style with Tailwind classes (only ${GLOBAL_STYLESHEET} exists)`,
    }));
  const globalCss = commentViolations(
    root,
    cssFiles.filter((file) => isGlobalStylesheet(relative(root, file))),
    (file) => findCssComments(readFileSync(file, 'utf8')),
  );
  const legacyUi = newStructureFiles(root, ['.ts', '.tsx'])
    .filter((file) => importsLegacyUiLibrary(readFileSync(file, 'utf8')))
    .map((file) => ({
      location: relative(root, file),
      message: 'HeroUI is legacy; use the kit in src/shared/ui',
    }));
  return [...typeScript, ...strayCss, ...globalCss, ...legacyUi, ...rust, ...flowViolations(root)];
}

function main(): void {
  const violations = collectViolations(process.cwd());
  for (const violation of violations) console.error(`${violation.location}: ${violation.message}`);
  if (violations.length > 0) {
    console.error(`${violations.length} convention violation(s)`);
    process.exit(1);
  }
}

if (import.meta.main) main();
