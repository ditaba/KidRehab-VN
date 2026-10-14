/**
 * Declares one namespace of UI strings. English is the source of truth for the
 * key set; the Vietnamese table must provide exactly the same keys, so a missing
 * translation is a type error rather than a blank label at runtime.
 *
 * Strings may contain `{name}` placeholders, filled from the `vars` argument of `t()`.
 */
export function defineMessages<const E extends Record<string, string>>(en: E, vi: { [K in keyof E]: string }) {
  return { en, vi };
}
