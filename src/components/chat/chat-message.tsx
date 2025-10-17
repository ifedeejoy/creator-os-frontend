"use client";

import { motion } from "framer-motion";
import { Bot, User, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Message } from "ai";
import ReactMarkdown from "react-markdown";
import { ScrapingProgress } from "@/components/scraping-progress";

interface ChatMessageProps {
  message: Message;
  avatarUrl?: string;
}

export function ChatMessage({ message, avatarUrl }: ChatMessageProps) {
  // Guard against undefined messages
  if (!message || !message.role) {
    return null;
  }

  const isAssistant = message.role === "assistant";

  // Extract text content from message
  const textContent = message.content;

  // Check if message has tool invocations
  const hasToolInvocations = message.toolInvocations && message.toolInvocations.length > 0;

  // Check if this message triggered scraping
  const hasScrapingTool = message.toolInvocations?.some(
    (inv: any) => inv.toolName === 'triggerScraping' && inv.state === 'result'
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex gap-3 p-4 rounded-lg",
        isAssistant ? "bg-gradient-to-br from-tiktok-pink/5 to-tiktok-blue/5" : "bg-muted/50"
      )}
    >
      <Avatar className={cn(
        "h-8 w-8 border-2",
        isAssistant ? "border-tiktok-pink" : "border-tiktok-blue"
      )}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={message.role} />}
        <AvatarFallback className={cn(
          isAssistant ? "bg-tiktok-pink text-white" : "bg-tiktok-blue text-black"
        )}>
          {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium">
          {isAssistant ? "Lumo AI" : "You"}
        </p>

        {/* Text content */}
        {textContent && (
          <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert">
            {isAssistant ? (
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  code: ({ children }) => (
                    <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-muted p-2 rounded overflow-x-auto mb-2">
                      {children}
                    </pre>
                  ),
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-tiktok-pink hover:underline"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {textContent}
              </ReactMarkdown>
            ) : (
              <div className="whitespace-pre-wrap">{textContent}</div>
            )}
          </div>
        )}

        {/* Tool invocations */}
        {hasToolInvocations && (
          <div className="space-y-2 mt-2">
            {message.toolInvocations?.map((toolInvocation: any) => (
              <div
                key={toolInvocation.toolCallId}
                className="text-xs bg-muted/50 rounded p-2 border border-border"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  {toolInvocation.state === "result" ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  <span className="font-mono">
                    {toolInvocation.toolName}
                  </span>
                </div>
                {toolInvocation.state === "result" && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    ✓ Tool executed successfully
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Real-time scraping progress */}
        {hasScrapingTool && (
          <div className="mt-3">
            <ScrapingProgress />
          </div>
        )}
      </div>
    </motion.div>
  );
}
