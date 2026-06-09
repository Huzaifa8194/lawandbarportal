"use client";

import { sanitizeUpdateHtml } from "@/lib/services/update-content";

export default function UpdateContent({ html }: { html: string }) {
  const safeHtml = sanitizeUpdateHtml(html);

  return (
    <div
      className="update-content prose prose-slate max-w-none text-[#121f1d]/85 [&_a]:text-[#0d9488] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[#26d9c0]/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:font-[family-name:var(--font-playfair)] [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_img]:my-4 [&_img]:max-h-[28rem] [&_img]:w-auto [&_img]:rounded-xl [&_img]:shadow-sm [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
