/** A link that would leave this Koog for the web. */
export function leavesTheComputer(href: string): boolean {
  return /^https?:/i.test(href.trim())
}
