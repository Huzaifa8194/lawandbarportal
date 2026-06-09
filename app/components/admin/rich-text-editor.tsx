"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef } from "react";
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
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      } disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  onImageUploaded,
  disabled = false,
  placeholder = "Write your update…",
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);

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
    },
  });

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

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor || uploadingRef.current) return;
      uploadingRef.current = true;
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
      } finally {
        uploadingRef.current = false;
      }
    },
    [editor, onImageUploaded],
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous || "https://");
    if (url === null) return;
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
        <ToolbarButton
          title="Bold"
          disabled={disabled}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          disabled={disabled}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
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
        <ToolbarButton title="Insert link" disabled={disabled} onClick={setLink}>
          Link
        </ToolbarButton>
        <ToolbarButton
          title="Insert image"
          disabled={disabled}
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
      <EditorContent editor={editor} />
    </div>
  );
}
