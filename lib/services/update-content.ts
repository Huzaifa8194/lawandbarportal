import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "img",
  "hr",
  "span",
];

const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "title", "class", "data-storage-path"];

export function sanitizeUpdateHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
  });
}

export function stripHtml(html: string) {
  return sanitizeUpdateHtml(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function excerptFromContent(html: string, maxLength = 160) {
  const plain = stripHtml(html);
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trim()}…`;
}
