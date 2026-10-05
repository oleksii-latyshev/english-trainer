import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../../src-tauri/src/providers/agy/conversation.rs', import.meta.url),
  'utf8',
);
const schemaText = source.split('fn response_schema()')[1].split('r#"')[1].split('"#')[0];
const schema = JSON.parse(schemaText);
function accepts(field, value) {
  const rules = schema.properties[field];
  return (
    Array.from(value).length >= rules.minLength &&
    Array.from(value).length <= rules.maxLength &&
    rules.allOf.every(({ pattern }) => new RegExp(pattern, 'u').test(value))
  );
}
describe('conversation output schema', () => {
  it('declares the same word, length and plain-text constraints enforced at the Rust boundary', () => {
    expect(accepts('spoken_reply', 'That sounds interesting.')).toBe(true);
    expect(accepts('spoken_reply', 'A well-designed app can help.')).toBe(true);
    expect(accepts('question', 'What would you like to improve?')).toBe(true);
    expect(accepts('spoken_reply', Array(31).fill('I').join(' '))).toBe(false);
    expect(accepts('question', `${Array(21).fill('I').join(' ')}?`)).toBe(false);
    for (const text of [
      'What?',
      '```json```',
      '{reply}',
      '# heading',
      '> quote',
      '- list',
      'one\ntwo',
      'a'.repeat(181),
    ]) {
      expect(accepts('spoken_reply', text)).toBe(false);
    }
    for (const text of ['No punctuation', 'Why? What?', '[Question]?', `${'a'.repeat(140)}?`]) {
      expect(accepts('question', text)).toBe(false);
    }
  });
});
