import { expect, it } from 'bun:test';
import { Schema } from 'effect';
import type { GeminiKeyStatus } from '../bindings/GeminiKeyStatus';
import { bindingSchema } from './binding-schema';
import { GeminiKeyStatusSchema } from './gemini-key-status';

it('accepts a schema that decodes to exactly the binding', () => {
  const schema = bindingSchema<GeminiKeyStatus>()(
    Schema.Struct({
      configured: Schema.Boolean,
      source: Schema.NullOr(Schema.Literals(['settings', 'environment'])),
    }),
  );
  expect(Schema.decodeUnknownSync(schema)({ configured: false, source: null })).toEqual({
    configured: false,
    source: null,
  });
});

const SOURCE = Schema.Literals(['settings', 'environment']);

it('rejects a schema with a missing field', () => {
  const schema = Schema.Struct({ configured: Schema.Boolean });
  // @ts-expect-error The schema lacks `source`, so it is not the binding.
  bindingSchema<GeminiKeyStatus>()(schema);
});

it('rejects a schema with a wider field type', () => {
  const schema = Schema.Struct({
    configured: Schema.Boolean,
    source: Schema.NullOr(Schema.String),
  });
  // @ts-expect-error `source` is a free string, wider than the binding's KeySource.
  bindingSchema<GeminiKeyStatus>()(schema);
});

it('rejects a schema that is narrower than the binding', () => {
  const schema = Schema.Struct({ configured: Schema.Literal(true), source: Schema.NullOr(SOURCE) });
  // @ts-expect-error `configured` is only `true`; Rust may also send `false`.
  bindingSchema<GeminiKeyStatus>()(schema);
});

it('rejects a union of the two valid shapes: ts-rs generates one struct, not a union', () => {
  const schema = Schema.Union([
    Schema.Struct({ configured: Schema.Literal(false), source: Schema.Null }),
    Schema.Struct({ configured: Schema.Literal(true), source: SOURCE }),
  ]);
  // @ts-expect-error The decoded type is a union, the binding is a single struct.
  bindingSchema<GeminiKeyStatus>()(schema);
});

it('keeps the Schema usable after the check', () => {
  expect(
    Schema.decodeUnknownSync(GeminiKeyStatusSchema)({ configured: true, source: 'settings' }),
  ).toEqual({ configured: true, source: 'settings' });
  expect(() =>
    Schema.decodeUnknownSync(GeminiKeyStatusSchema)({ configured: true, source: 'keychain' }),
  ).toThrow();
});
