import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, Users, Zap } from "lucide-react";

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-tiktok-pink/10 via-background to-tiktok-blue/10">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center space-y-8 text-center">
          {/* Logo & Branding */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-tiktok-pink blur-2xl opacity-50 animate-pulse-fast"></div>
                <Sparkles className="h-16 w-16 text-tiktok-pink relative z-10" />
              </div>
              <h1 className="text-7xl font-black bg-gradient-to-r from-tiktok-pink to-tiktok-blue bg-clip-text text-transparent">
                Lumo
              </h1>
            </div>
            <p className="text-2xl text-muted-foreground max-w-2xl">
              Discover TikTok creators, analyze performance, and grow your brand with AI-powered insights
            </p>
          </div>

          {/* CTA Button */}
          <div className="flex flex-col items-center gap-4">
            <a href="/auth/tiktok">
              <Button
                variant="tiktok"
                size="lg"
                className="text-lg px-12 py-6 h-auto"
              >
                <svg
                  className="h-6 w-6 mr-2"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
                Sign in with TikTok
              </Button>
            </a>
            <p className="text-sm text-muted-foreground">
              Connect your TikTok account to get started
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-16 w-full max-w-5xl">
            <FeatureCard
              icon={<TrendingUp className="h-8 w-8 text-tiktok-pink" />}
              title="Performance Analytics"
              description="Track your videos, engagement rates, and growth metrics in real-time"
            />
            <FeatureCard
              icon={<Users className="h-8 w-8 text-tiktok-blue" />}
              title="Creator Discovery"
              description="Find and analyze trending creators in your niche with automated scraping"
            />
            <FeatureCard
              icon={<Zap className="h-8 w-8 text-yellow-500" />}
              title="AI-Powered Chat"
              description="Ask questions about your data and get instant insights powered by Gemini AI"
            />
          </div>

          {/* Demo Section */}
          <div className="mt-16 w-full max-w-4xl">
            <div className="bg-card border-2 border-tiktok-pink/20 rounded-2xl p-8 shadow-2xl">
              <h3 className="text-2xl font-bold mb-4 text-center">
                What you can do with Lumo
              </h3>
              <div className="grid md:grid-cols-2 gap-6 text-left">
                <DemoItem text="Ask: 'Show me my top 10 videos by engagement'" />
                <DemoItem text="Ask: 'Find creators with 100k-500k followers'" />
                <DemoItem text="Ask: 'Scrape tiktokshop hashtag for new creators'" />
                <DemoItem text="Ask: 'What's my average engagement rate this week?'" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 text-center text-sm text-muted-foreground">
            <p>
              Powered by Google Gemini 2.0 Flash • Built with Next.js & Vercel AI SDK
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group relative bg-card hover:bg-accent transition-all duration-300 rounded-xl p-6 border-2 border-transparent hover:border-tiktok-pink/30 hover:shadow-lg hover:scale-105">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="p-4 bg-gradient-to-br from-tiktok-pink/10 to-tiktok-blue/10 rounded-full group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function DemoItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
      <Sparkles className="h-5 w-5 text-tiktok-pink flex-shrink-0 mt-0.5" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
