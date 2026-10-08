import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../../src-tauri/src/providers/agy/conversation.rs', import.meta.url),
  'utf8',
);
const template = source.split('const RESPONSE_SCHEMA_TEMPLATE')[1].split('r#"')[1].split('"#')[0];
function schemaFor(replyChars, replyWords) {
  return JSON.parse(
    template
      .replaceAll('__REPLY_CHARS__', String(replyChars))
      .replaceAll('__REPLY_WORDS__', String(replyWords))
      .replaceAll('__REPLY_EXTRA_WORDS__', String(replyWords - 1)),
  );
}
let schema = schemaFor(180, 30);
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

  it('widens only the reply for the natural style', () => {
    schema = schemaFor(400, 70);
    expect(accepts('spoken_reply', Array(70).fill('I').join(' '))).toBe(true);
    expect(accepts('spoken_reply', Array(71).fill('I').join(' '))).toBe(false);
    expect(accepts('spoken_reply', 'a'.repeat(401))).toBe(false);
    expect(accepts('question', `${Array(21).fill('I').join(' ')}?`)).toBe(false);
    schema = schemaFor(180, 30);
  });
});
