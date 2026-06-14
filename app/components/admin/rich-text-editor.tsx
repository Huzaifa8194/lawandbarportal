"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadPortalFile } from "@/lib/services/storage-upload";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  onImageUploaded?: (path: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

function ToolbarButton({
  active,
  disabled,
  loading,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled || loading}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      } disabled:opacity-50`}
    >
      {loading ? "…" : children}
    </button>
  );
}

function normalizeLinkUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function RichTextEditor({
  value,
  onChange,
  onImageUploaded,
  disabled = false,
  placeholder = "Write your update…",
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const insertImageRef = useRef<(file: File) => void>(() => {});

  const [, setEditorTick] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(
    null,
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full rounded-lg",
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      onChange(current.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none min-h-[12rem] px-4 py-3 text-sm leading-relaxed focus:outline-none [&_img]:my-4 [&_img]:max-h-96 [&_img]:w-auto",
      },
      handleDrop: (_view, event) => {
        const file = Array.from(event.dataTransfer?.files ?? []).find((item) =>
          item.type.startsWith("image/"),
        );
        if (!file) return false;
        event.preventDefault();
        insertImageRef.current(file);
        return true;
      },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
          item.type.startsWith("image/"),
        );
        if (!file) return false;
        event.preventDefault();
        insertImageRef.current(file);
        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const refresh = () => setEditorTick((tick) => tick + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!linkOpen) return;
    linkInputRef.current?.focus();
    linkInputRef.current?.select();
  }, [linkOpen]);

  useEffect(() => {
    if (!status || status.type === "error") return;
    const timer = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor || uploadingRef.current || disabled) return;
      uploadingRef.current = true;
      setImageUploading(true);
      setStatus({ type: "info", message: `Uploading ${file.name}…` });
      try {
        const uploaded = await uploadPortalFile("sqe/updates", file);
        editor
          .chain()
          .focus()
          .setImage({
            src: uploaded.url,
            alt: file.name,
            title: file.name,
            "data-storage-path": uploaded.path,
          } as { src: string; alt?: string; title?: string })
          .run();
        onImageUploaded?.(uploaded.path);
        setStatus({ type: "success", message: `Image inserted: ${file.name}` });
      } catch (error) {
        setStatus({
          type: "error",
          message: error instanceof Error ? error.message : "Image upload failed. Try again.",
        });
      } finally {
        uploadingRef.current = false;
        setImageUploading(false);
      }
    },
    [editor, onImageUploaded, disabled],
  );

  useEffect(() => {
    insertImageRef.current = (file: File) => {
      void insertImage(file);
    };
  }, [insertImage]);

  const openLinkEditor = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    setLinkDraft(previous || "");
    setLinkOpen(true);
    setStatus(null);
  }, [editor]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    const url = normalizeLinkUrl(linkDraft);
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setStatus({ type: "success", message: "Link removed." });
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      setStatus({ type: "success", message: "Link applied." });
    }
    setLinkOpen(false);
  }, [editor, linkDraft]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
    setStatus({ type: "success", message: "Link removed." });
  }, [editor]);

  if (!editor) {
    return (
      <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
        Loading editor…
      </div>
    );
  }

  const hasLink = editor.isActive("link");

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 p-2">
        <div className="flex flex-wrap gap-1">
          <ToolbarButton
            title="Bold (Ctrl+B)"
            disabled={disabled}
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <span className="font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton
            title="Italic (Ctrl+I)"
            disabled={disabled}
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <span className="italic">I</span>
          </ToolbarButton>
          <ToolbarButton
            title="Underline (Ctrl+U)"
            disabled={disabled}
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <span className="underline">U</span>
          </ToolbarButton>
          <ToolbarButton
            title="Heading 2"
            disabled={disabled}
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            title="Heading 3"
            disabled={disabled}
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            H3
          </ToolbarButton>
          <ToolbarButton
            title="Bullet list"
            disabled={disabled}
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            • List
          </ToolbarButton>
          <ToolbarButton
            title="Numbered list"
            disabled={disabled}
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1. List
          </ToolbarButton>
          <ToolbarButton
            title="Blockquote"
            disabled={disabled}
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            Quote
          </ToolbarButton>
          <ToolbarButton
            title={hasLink ? "Edit link" : "Insert link"}
            disabled={disabled}
            active={hasLink}
            onClick={openLinkEditor}
          >
            Link
          </ToolbarButton>
          <ToolbarButton
            title="Insert image"
            disabled={disabled}
            loading={imageUploading}
            onClick={() => imageInputRef.current?.click()}
          >
            Image
          </ToolbarButton>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void insertImage(file);
              event.target.value = "";
            }}
          />
        </div>

        {linkOpen ? (
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-medium text-slate-700">
              {hasLink ? "Edit link URL" : "Add link URL"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Select text first, then paste a URL. Leave empty and apply to remove an existing link.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                ref={linkInputRef}
                type="url"
                value={linkDraft}
                onChange={(event) => setLinkDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setLinkOpen(false);
                  }
                }}
                placeholder="https://example.com"
                disabled={disabled}
                className="min-w-[12rem] flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none ring-slate-300 focus:ring disabled:opacity-60"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={applyLink}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Apply
              </button>
              {hasLink ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={removeLink}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
              <button
                type="button"
                disabled={disabled}
                onClick={() => setLinkOpen(false)}
                className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {status ? (
          <p
            className={`mt-2 rounded-md px-2.5 py-1.5 text-xs ${
              status.type === "success"
                ? "border border-green-200 bg-green-50 text-green-800"
                : status.type === "error"
                  ? "border border-red-200 bg-red-50 text-red-700"
                  : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {status.message}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Tip: drag and drop or paste an image into the editor. Use Link to wrap selected text.
          </p>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
