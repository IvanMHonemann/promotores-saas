import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, ImageIcon, Loader2, Paperclip, Send, User, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { compressImageFile } from "@/lib/imageCompress";
import {
  AI_ACCEPT_ATTR, AI_MAX_ATTACHMENTS, AI_MAX_PDF_BYTES, AI_MAX_PICK_BYTES, AI_MAX_TEXT_CHARS, AI_MAX_TOTAL_CHARS,
  aiAttachmentsSize, classifyAiFile, type AiAttachment,
} from "@shared/aiAttachments";
import { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
  /** Nomes dos anexos enviados junto (o conteúdo não fica salvo no histórico). */
  attachments?: Array<{ name: string; kind: AiAttachment["kind"] }>;
};

/** Anexo pronto para envio, com miniatura para fotos. */
export type PendingAttachment = AiAttachment & { previewUrl?: string; sizeLabel: string };

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const r = String(reader.result || ""); const i = r.indexOf(","); resolve(i >= 0 ? r.slice(i + 1) : r); };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

/** Converte o arquivo escolhido em anexo: foto comprimida, PDF inteiro ou texto (cortado no limite). */
export async function fileToAttachment(file: File): Promise<PendingAttachment> {
  const kind = classifyAiFile(file.name, file.type);
  if (!kind) throw new Error(`Tipo de arquivo não aceito: ${file.name}. Envie fotos, PDF ou arquivos de texto/código.`);
  if (file.size > AI_MAX_PICK_BYTES) throw new Error(`${file.name} passa de 10 MB.`);
  if (kind === "image") {
    const img = await compressImageFile(file);
    return { name: file.name, mimeType: "image/jpeg", kind, data: img.base64, previewUrl: img.dataUrl, sizeLabel: sizeLabel(img.blob.size) };
  }
  if (kind === "pdf") {
    if (file.size > AI_MAX_PDF_BYTES) throw new Error(`${file.name}: PDFs podem ter no máximo 3 MB.`);
    return { name: file.name, mimeType: "application/pdf", kind, data: await readAsBase64(file), sizeLabel: sizeLabel(file.size) };
  }
  let text = await file.text();
  if (text.length > AI_MAX_TEXT_CHARS) { text = `${text.slice(0, AI_MAX_TEXT_CHARS)}\n[... arquivo cortado: muito grande ...]`; toast.info(`${file.name} é grande; enviei só o começo do arquivo.`); }
  return { name: file.name, mimeType: file.type || "text/plain", kind, data: text, sizeLabel: sizeLabel(file.size) };
}

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message.
   * Typically you'll call a tRPC mutation here to invoke the LLM.
   */
  onSendMessage: (content: string, attachments?: PendingAttachment[]) => void;

  /** Mostra o botão de anexar fotos e arquivos. */
  allowAttachments?: boolean;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];
};

/**
 * A ready-to-use AI chat box component that integrates with the LLM system.
 *
 * Features:
 * - Matches server-side Message interface for seamless integration
 * - Markdown rendering with Streamdown
 * - Auto-scrolls to latest message
 * - Loading states
 * - Uses global theme colors from index.css
 *
 * @example
 * ```tsx
 * const ChatPage = () => {
 *   const [messages, setMessages] = useState<Message[]>([
 *     { role: "system", content: "You are a helpful assistant." }
 *   ]);
 *
 *   const chatMutation = trpc.ai.chat.useMutation({
 *     onSuccess: (response) => {
 *       // Assuming your tRPC endpoint returns the AI response as a string
 *       setMessages(prev => [...prev, {
 *         role: "assistant",
 *         content: response
 *       }]);
 *     },
 *     onError: (error) => {
 *       console.error("Chat error:", error);
 *       // Optionally show error message to user
 *     }
 *   });
 *
 *   const handleSend = (content: string) => {
 *     const newMessages = [...messages, { role: "user", content }];
 *     setMessages(newMessages);
 *     chatMutation.mutate({ messages: newMessages });
 *   };
 *
 *   return (
 *     <AIChatBox
 *       messages={messages}
 *       onSendMessage={handleSend}
 *       isLoading={chatMutation.isPending}
 *       suggestedPrompts={[
 *         "Explain quantum computing",
 *         "Write a hello world in Python"
 *       ]}
 *     />
 *   );
 * };
 * ```
 */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
  allowAttachments = false,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [reading, setReading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (list: FileList | File[] | null) => {
    const files = Array.from(list || []);
    if (!files.length) return;
    setReading(true);
    try {
      let next = [...pending];
      for (const file of files) {
        if (next.length >= AI_MAX_ATTACHMENTS) { toast.error(`Máximo de ${AI_MAX_ATTACHMENTS} anexos por mensagem.`); break; }
        try {
          const att = await fileToAttachment(file);
          if (aiAttachmentsSize([...next, att]) > AI_MAX_TOTAL_CHARS) { toast.error(`${file.name} não coube: os anexos passam de ~4 MB no total.`); continue; }
          next = [...next, att];
        } catch (error) {
          toast.error(error instanceof Error ? error.message : `Não foi possível anexar ${file.name}.`);
        }
      }
      setPending(next);
    } finally {
      setReading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter out system messages
  const displayMessages = messages.filter((msg) => msg.role !== "system");

  // Calculate min-height for last assistant message to push user message to top
  const [minHeightForLastMessage, setMinHeightForLastMessage] = useState(0);

  useEffect(() => {
    if (containerRef.current && inputAreaRef.current) {
      const containerHeight = containerRef.current.offsetHeight;
      const inputHeight = inputAreaRef.current.offsetHeight;
      const scrollAreaHeight = containerHeight - inputHeight;

      // Reserve space for:
      // - padding (p-4 = 32px top+bottom)
      // - user message: 40px (item height) + 16px (margin-top from space-y-4) = 56px
      // Note: margin-bottom is not counted because it naturally pushes the assistant message down
      const userMessageReservedHeight = 56;
      const calculatedHeight = scrollAreaHeight - 32 - userMessageReservedHeight;

      setMinHeightForLastMessage(Math.max(0, calculatedHeight));
    }
  }, []);

  // Scroll to bottom helper function with smooth animation
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if ((!trimmedInput && !pending.length) || isLoading || reading) return;

    if (pending.length) onSendMessage(trimmedInput || "Veja os anexos.", pending);
    else onSendMessage(trimmedInput);
    setInput("");
    setPending([]);

    // Scroll immediately after sending
    scrollToBottom();

    // Keep focus on input
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-card text-card-foreground rounded-lg border shadow-sm",
        className
      )}
      style={{ height }}
    >
      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <Sparkles className="size-12 opacity-20" />
                <p className="text-sm">{emptyStateMessage}</p>
              </div>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 p-4">
              {displayMessages.map((message, index) => {
                // Apply min-height to last message only if NOT loading (when loading, the loading indicator gets it)
                const isLastMessage = index === displayMessages.length - 1;
                const shouldApplyMinHeight =
                  isLastMessage && !isLoading && minHeightForLastMessage > 0;

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user"
                        ? "justify-end items-start"
                        : "justify-start items-start"
                    )}
                    style={
                      shouldApplyMinHeight
                        ? { minHeight: `${minHeightForLastMessage}px` }
                        : undefined
                    }
                  >
                    {message.role === "assistant" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="size-4 text-primary" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "min-w-0 max-w-[80%] rounded-lg px-4 py-2.5",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <Streamdown>{message.content}</Streamdown>
                        </div>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {message.content}
                          </p>
                          {message.attachments?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {message.attachments.map((att, i) => (
                                <span key={i} className="inline-flex max-w-full items-center gap-1 rounded-md bg-black/15 px-2 py-0.5 text-xs">
                                  {att.kind === "image" ? <ImageIcon className="size-3 shrink-0" /> : <FileText className="size-3 shrink-0" />}
                                  <span className="truncate">{att.name}</span>
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div
                  className="flex items-start gap-3"
                  style={
                    minHeightForLastMessage > 0
                      ? { minHeight: `${minHeightForLastMessage}px` }
                      : undefined
                  }
                >
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="rounded-lg bg-muted px-4 py-2.5">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 p-3 sm:p-4 border-t bg-background/50"
        onDragOver={allowAttachments ? (e) => e.preventDefault() : undefined}
        onDrop={allowAttachments ? (e) => { e.preventDefault(); void addFiles(e.dataTransfer.files); } : undefined}
      >
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pending.map((att, i) => (
              <div key={i} className="relative flex max-w-[220px] items-center gap-2 rounded-lg border bg-card p-1.5 pr-7 text-xs">
                {att.previewUrl
                  ? <img src={att.previewUrl} alt={att.name} className="size-10 shrink-0 rounded object-cover" />
                  : <div className="grid size-10 shrink-0 place-items-center rounded bg-muted"><FileText className="size-5" /></div>}
                <div className="min-w-0"><p className="truncate font-medium">{att.name}</p><p className="text-muted-foreground">{att.sizeLabel}</p></div>
                <button type="button" aria-label={`Remover ${att.name}`} onClick={() => setPending((cur) => cur.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded p-0.5 hover:bg-muted"><X className="size-3.5" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
        {allowAttachments && (
          <>
            <input ref={fileInputRef} type="file" multiple accept={AI_ACCEPT_ATTR} className="hidden" onChange={(e) => void addFiles(e.target.files)} />
            <Button type="button" variant="outline" size="icon" aria-label="Anexar fotos ou arquivos" title="Anexar fotos ou arquivos (até 5, 10 MB cada)" disabled={isLoading || reading || pending.length >= AI_MAX_ATTACHMENTS} onClick={() => fileInputRef.current?.click()} className="shrink-0 h-[38px] w-[38px]">
              {reading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            </Button>
          </>
        )}
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={allowAttachments ? (e) => { const files = Array.from(e.clipboardData?.files || []); if (files.length) { e.preventDefault(); void addFiles(files); } } : undefined}
          placeholder={placeholder}
          className="flex-1 max-h-32 resize-none min-h-9"
          rows={1}
        />
        <Button
          type="submit"
          size="icon"
          disabled={(!input.trim() && !pending.length) || isLoading || reading}
          className="shrink-0 h-[38px] w-[38px]"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
        </div>
      </form>
    </div>
  );
}
