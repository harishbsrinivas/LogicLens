// Renders model output as sanitized Markdown (arch §8): raw HTML off in the parser, then a
// sanitizer, and only http(s) links. Model output is untrusted data.
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

const ALLOWED_TAGS = [
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'em',
  's',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(md.render(source), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'start'],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}
