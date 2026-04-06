import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Collaboration from "@tiptap/extension-collaboration"
import Placeholder from "@tiptap/extension-placeholder"
import { HocuspocusProvider } from "@hocuspocus/provider"
import * as Y from "yjs"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Undo,
  Redo,
  Code,
  Users,
} from "lucide-react"

const HOCUSPOCUS_URL =
  import.meta.env.VITE_HOCUSPOCUS_URL || "wss://guidesforge-hocuspocus.onrender.com"

interface CollaborativeEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  editable?: boolean
  documentName?: string
  token?: string
}

export default function CollaborativeEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  className = "",
  editable = true,
  documentName,
  token,
}: CollaborativeEditorProps) {
  const [connected, setConnected] = useState(false)
  const [peerCount, setPeerCount] = useState(0)
  const providerRef = useRef<HocuspocusProvider | null>(null)

  // Create Yjs document and Hocuspocus provider when documentName is provided
  const ydoc = useMemo(() => new Y.Doc(), [])

  useEffect(() => {
    if (!documentName) return

    const provider = new HocuspocusProvider({
      url: HOCUSPOCUS_URL,
      name: documentName,
      document: ydoc,
      token: token || "",
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
      onAwarenessChange: ({ states }: { states: unknown[] }) => {
        setPeerCount(states.length)
      },
    })

    providerRef.current = provider

    return () => {
      provider.destroy()
      providerRef.current = null
    }
  }, [documentName, token, ydoc])

  // Build extensions list based on whether collaboration is enabled
  const extensions = useMemo(() => {
    const baseConfig: Record<string, unknown> = {
      heading: { levels: [2, 3] },
    }
    // Disable history when using collaboration (Yjs handles undo/redo)
    if (documentName) {
      baseConfig.history = false
    }

    const exts: Parameters<typeof useEditor>[0]["extensions"] = [
      StarterKit.configure(baseConfig),
      Placeholder.configure({ placeholder }),
    ]

    if (documentName) {
      exts.push(
        Collaboration.configure({
          document: ydoc,
        })
      )
    }

    return exts
  }, [documentName, placeholder, ydoc])

  const editor = useEditor({
    extensions,
    content: documentName ? undefined : content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[80px] px-4 py-3",
      },
    },
  })

  if (!editor) return null

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/5 overflow-hidden ${className}`}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/5 bg-white/[0.02]">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          active={editor.isActive("heading", { level: 2 })}
          title="Heading"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Ordered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code Block"
        >
          <Code className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="flex-1" />
        {/* Collaboration status indicator */}
        {documentName && (
          <div className="flex items-center gap-1.5 mr-2 text-xs">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? "bg-green-400" : "bg-red-400"
              }`}
            />
            <span className="text-gray-500">
              {connected ? "Live" : "Offline"}
            </span>
            {peerCount > 1 && (
              <span className="flex items-center gap-0.5 text-indigo-400">
                <Users className="w-3 h-3" />
                {peerCount}
              </span>
            )}
          </div>
        )}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          active={false}
          title="Undo"
        >
          <Undo className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          active={false}
          title="Redo"
        >
          <Redo className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition ${
        active
          ? "bg-indigo-500/20 text-indigo-400"
          : "text-gray-500 hover:text-white hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  )
}
