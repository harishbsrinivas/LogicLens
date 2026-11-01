// Prepares model output for an editor comment's MarkdownString (arch §8). Pure.
// VS Code already renders it with HTML, command links, and theme icons off. This also turns
// images into plain links, so nothing loads a remote URL, and keeps links only for http(s).
const HTTP = /^https?:\/\//i;
const IMAGE_START = /!\[/g;
const INLINE_LINK = /\[([^\]\n]*)\]\(\s*<?([^\s)>]*)>?(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/g;
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]\n]+\]:[ \t]*<?([^\s>]*)>?.*$/gm;
const AUTOLINK = /<([a-z][a-z0-9+.-]{1,31}:[^\s<>]*)>/gi;

export function safeMarkdown(source: string): string {
  return source
    .replace(IMAGE_START, '[')
    .replace(INLINE_LINK, (whole, text: string, href: string) => (HTTP.test(href) ? whole : text))
    .replace(REFERENCE_DEFINITION, (whole, href: string) => (HTTP.test(href) ? whole : ''))
    .replace(AUTOLINK, (whole, href: string) => (HTTP.test(href) ? whole : `\`${href}\``));
}
