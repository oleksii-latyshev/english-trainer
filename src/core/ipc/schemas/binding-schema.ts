import type { Schema } from 'effect';

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

type IsExactly<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type MustMatchBinding<Decoded, Binding> =
  IsExactly<DeepMutable<Decoded>, Binding> extends true
    ? unknown
    : { readonly 'schema does not decode to the generated binding': Binding };

export function bindingSchema<Binding>() {
  return <const S extends Schema.Top>(schema: S & MustMatchBinding<S['Type'], Binding>): S =>
    schema;
}
