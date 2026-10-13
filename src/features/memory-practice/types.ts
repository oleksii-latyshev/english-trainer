export type ActiveReview =
  | { readonly tag: 'none' }
  | { readonly tag: 'saved'; readonly resolved: number; readonly total: number };
