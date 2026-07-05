/**
 * Joins conditional class fragments into one className string.
 * Nothing in the repo offered this yet (no clsx dependency, and adding one
 * for a three-line function is not worth the manifest entry).
 */
export function joinClassNames(
  ...fragments: ReadonlyArray<string | false | null | undefined>
): string {
  return fragments.filter(Boolean).join(" ");
}
