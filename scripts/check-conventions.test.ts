import { expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  collectViolations,
  findCssComments,
  findRustComments,
  findTypeScriptComments,
  hasSequenceDiagram,
  importsLegacyUiLibrary,
  isGlobalStylesheet,
  listLegacyFeatures,
} from './check-conventions';

it('finds line, block and JSDoc comments in TypeScript', () => {
  const source = ['// one', 'const a = 1; /* two */', '/** three */', 'export { a };'].join('\n');
  expect(findTypeScriptComments(source).map((hit) => hit.line)).toEqual([1, 2, 3]);
});

it('ignores comment markers inside TypeScript strings, templates and URLs', () => {
  const source = [
    "const url = 'https://example.com/a';",
    'const text = "// not a comment";',
    'const tpl = `/* nope */ http://x`;',
    'const pattern = /\\/\\/x/;',
  ].join('\n');
  expect(findTypeScriptComments(source)).toEqual([]);
});

it('ignores slashes in JSX text but finds JSX expression comments', () => {
  const source = 'export const a = <p>see // here {/* real */}</p>;';
  const hits = findTypeScriptComments(source, 'view.tsx');
  expect(hits.map((hit) => hit.text)).toEqual(['/* real */']);
});

it('allows biome-ignore directives with a reason', () => {
  const source = '// biome-ignore lint/suspicious/noExplicitAny: boundary type\nconst a = 1;';
  expect(findTypeScriptComments(source)).toEqual([]);
});

it('allows @ts-expect-error only when it states a reason', () => {
  expect(findTypeScriptComments('// @ts-expect-error the schema lacks a field\nf();')).toEqual([]);
  expect(findTypeScriptComments('// @ts-expect-error\nf();')).toHaveLength(1);
});

it('flags a biome-ignore directive that gives no reason', () => {
  expect(
    findTypeScriptComments('// biome-ignore lint/suspicious/noExplicitAny\nconst a = 1;'),
  ).toHaveLength(1);
});

it('finds Rust line, doc, inner doc and nested block comments', () => {
  const source = [
    '//! inner',
    '/// doc',
    'fn a() {} // tail',
    '/* a /* b */ c */',
    'fn b() {}',
  ].join('\n');
  expect(findRustComments(source).map((hit) => hit.line)).toEqual([1, 2, 3, 4]);
});

it('ignores comment markers inside Rust strings, raw strings and chars', () => {
  const source = [
    'let a = "http://example.com";',
    'let b = r#"// "quoted" /* x */"#;',
    "let c = '/';",
    "let d = '\\'';",
    "fn e<'a>(x: &'a str) -> &'a str { x } // real",
  ].join('\n');
  const hits = findRustComments(source);
  expect(hits.map((hit) => hit.line)).toEqual([5]);
});

it('reads legacy feature names from negated biome patterns', () => {
  const config =
    '{"includes":["src/features/**","!src/features/coach/**","!src/features/coach/**"]}';
  expect(listLegacyFeatures(config)).toEqual(['coach']);
});

it('requires a mermaid block containing sequenceDiagram', () => {
  expect(hasSequenceDiagram('```mermaid\nsequenceDiagram\n  A->>B: hi\n```')).toBe(true);
  expect(hasSequenceDiagram('```mermaid\nflowchart LR\n```')).toBe(false);
  expect(hasSequenceDiagram('sequenceDiagram')).toBe(false);
});

it('css comments are found but comment markers inside strings are not', () => {
  const source = [
    '.a { content: "/* not a comment */"; }',
    '/* a real comment */',
    ".b { background: url('https://example.com/x.png'); }",
  ].join('\n');

  const hits = findCssComments(source);

  expect(hits.map((hit) => hit.line)).toEqual([2]);
});

it('detects HeroUI imports in static, side-effect and dynamic form', () => {
  expect(importsLegacyUiLibrary("import { Toast } from '@heroui/react';")).toBe(true);
  expect(importsLegacyUiLibrary('import "@heroui/styles";')).toBe(true);
  expect(importsLegacyUiLibrary("const mod = await import('@heroui/react');")).toBe(true);
  expect(importsLegacyUiLibrary("import { Button } from '@base-ui/react/button';")).toBe(false);
});

it('accepts only src/app/styles.css as the global stylesheet', () => {
  expect(isGlobalStylesheet(join('src', 'app', 'styles.css'))).toBe(true);
  expect(isGlobalStylesheet(join('src', 'app', 'other.css'))).toBe(false);
  expect(isGlobalStylesheet(join('src', 'shared', 'ui', 'button', 'styles.css'))).toBe(false);
});

function withProject(files: Record<string, string>, run: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'conventions-'));
  try {
    writeFileSync(join(root, 'biome.json'), '{}');
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

it('reports stray .css files and HeroUI imports in the new structure', () => {
  withProject(
    {
      'src/app/styles.css': '@import "tailwindcss";',
      'src/shared/ui/button/styles.css': '.a { color: red; }',
      'src/shared/ui/button/index.tsx': "import { Button } from '@heroui/react';",
    },
    (root) => {
      const messages = collectViolations(root).map(
        (violation) => `${violation.location}: ${violation.message}`,
      );
      expect(messages).toHaveLength(2);
      expect(messages.some((line) => line.includes('button/styles.css'))).toBe(true);
      expect(messages.some((line) => line.includes('button/index.tsx'))).toBe(true);
    },
  );
});

it('allows the global stylesheet but still rejects comments in it', () => {
  withProject({ 'src/app/styles.css': '@import "tailwindcss";' }, (root) => {
    expect(collectViolations(root)).toEqual([]);
  });
  withProject({ 'src/app/styles.css': '/* note */\n@import "tailwindcss";' }, (root) => {
    expect(collectViolations(root)).toHaveLength(1);
  });
});
