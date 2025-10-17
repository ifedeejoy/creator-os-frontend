"use client";

import { useEffect, useState } from "react";
import { useChat } from "ai/react";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LogOut,
  Sparkles,
  TrendingUp,
  Users,
  RefreshCw,
  Menu,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface User {
  username: string;
  displayName?: string;
  avatarUrl?: string;
  followerCount?: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput, append } =
    useChat({
      api: "/api/chat",
    });

  const sendMessage = (text: string) => {
    if (!isLoading) {
      append({
        role: "user",
        content: text,
      });
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      window.location.href = "/";
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (res.ok) {
        alert("Synced successfully! Your latest data has been updated.");
      } else {
        alert("Failed to sync data. Please try again.");
      }
    } catch (error) {
      console.error("Sync error:", error);
      alert("Failed to sync data. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-tiktok-pink/10 via-background to-tiktok-blue/10">
        <div className="text-center space-y-4">
          <div className="animate-spin-slow">
            <Sparkles className="h-12 w-12 text-tiktok-pink mx-auto" />
          </div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-tiktok-pink/5 via-background to-tiktok-blue/5">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 20 }}
            className="w-80 bg-card border-r border-border flex flex-col"
          >
            {/* User Profile */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-4 mb-4">
                <Avatar className="h-16 w-16 border-2 border-tiktok-pink">
                  <AvatarImage src={user?.avatarUrl} alt={user?.username} />
                  <AvatarFallback className="bg-gradient-to-br from-tiktok-pink to-tiktok-blue text-white text-xl">
                    {user?.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-lg truncate">
                    {user?.displayName || user?.username}
                  </h2>
                  <p className="text-sm text-muted-foreground truncate">
                    @{user?.username}
                  </p>
                  {user?.followerCount !== undefined && (
                    <p className="text-xs text-tiktok-pink font-medium mt-1">
                      {user.followerCount.toLocaleString()} followers
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`}
                  />
                  Sync TikTok Data
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex-1 p-6 space-y-4 overflow-auto">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <QuickActionCard
                    icon={<TrendingUp className="h-5 w-5 text-tiktok-pink" />}
                    title="View Top Videos"
                    description="See your best performing content"
                    onClick={() => sendMessage("Show me my top 10 videos by engagement")}
                  />
                  <QuickActionCard
                    icon={<Users className="h-5 w-5 text-tiktok-blue" />}
                    title="Discover Creators"
                    description="Find trending creators to collaborate with"
                    onClick={() => sendMessage("Find creators with 100k-500k followers")}
                  />
                  <QuickActionCard
                    icon={<Sparkles className="h-5 w-5 text-yellow-500" />}
                    title="Trigger Scraping"
                    description="Queue new creator discovery jobs"
                    onClick={() => sendMessage("Scrape tiktokshop and tiktokmademebuy hashtags")}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  Example Questions
                </h3>
                <div className="space-y-2 text-sm">
                  <ExampleQuestion
                    text="Show my top 10 videos by engagement"
                    onClick={() => sendMessage("Show my top 10 videos by engagement")}
                  />
                  <ExampleQuestion
                    text="What's my average engagement this month?"
                    onClick={() => sendMessage("What's my average engagement this month?")}
                  />
                  <ExampleQuestion
                    text="Find creators with 100k-500k followers"
                    onClick={() => sendMessage("Find creators with 100k-500k followers")}
                  />
                  <ExampleQuestion
                    text="Scrape tiktokshop hashtag"
                    onClick={() => sendMessage("Scrape tiktokshop hashtag")}
                  />
                  <ExampleQuestion
                    text="Show me the database schema"
                    onClick={() => sendMessage("Show me the database schema")}
                  />
                </div>
              </div>
            </div>

            {/* Logout */}
            <div className="p-6 border-t border-border">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-card border-b border-border p-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-tiktok-pink" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-tiktok-pink to-tiktok-blue bg-clip-text text-transparent">
              Lumo AI Chat
            </h1>
          </div>
          <div className="flex-1"></div>
          <div className="text-sm text-muted-foreground">
            Powered by Gemini 2.0 Flash
          </div>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12 space-y-4"
              >
                <Sparkles className="h-16 w-16 text-tiktok-pink mx-auto animate-pulse-fast" />
                <h2 className="text-2xl font-bold">
                  Welcome to Lumo AI Chat!
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Ask me anything about your TikTok analytics, discover new
                  creators, or trigger scraping jobs. I can query your data,
                  provide insights, and help you grow your presence.
                </p>
              </motion.div>
            )}
            {messages.map((message) => {
              // Filter out non-user/assistant messages
              if (message.role !== 'user' && message.role !== 'assistant') {
                return null;
              }
              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  avatarUrl={
                    message.role === "user" ? user?.avatarUrl : undefined
                  }
                />
              );
            })}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <Sparkles className="h-4 w-4 animate-spin" />
                <span>Lumo AI is thinking...</span>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-4 bg-card">
          <div className="max-w-4xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) {
                  handleSubmit(e);
                }
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask about your creators, metrics, or type 'scrape' to discover new creators..."
                disabled={isLoading}
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tiktok-pink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                variant="tiktok"
                size="icon"
                className="shrink-0"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="p-3 bg-muted/50 rounded-lg hover:bg-muted active:scale-95 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-background rounded-md group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ExampleQuestion({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="p-2 bg-muted/30 rounded hover:bg-muted/50 active:scale-95 transition-all cursor-pointer"
    >
      <p className="text-xs text-muted-foreground hover:text-foreground transition-colors">
        💬 {text}
      </p>
    </div>
  );
}
