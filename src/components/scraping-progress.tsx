"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, Users, TrendingUp } from "lucide-react";

interface ScrapingProgressProps {
  onComplete?: () => void;
}

interface ProgressData {
  pendingJobs: number;
  processingJobs: number;
  recentCreators: Array<{
    username: string;
    followers: number;
  }>;
  timestamp: string;
}

export function ScrapingProgress({ onComplete }: ScrapingProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      eventSource = new EventSource('/api/scrape/progress');

      eventSource.onmessage = (event) => {
        try {
          const data: ProgressData = JSON.parse(event.data);
          setProgress(data);

          // If no jobs are processing/pending, mark as complete
          if (data.pendingJobs === 0 && data.processingJobs === 0) {
            setIsActive(false);
            onComplete?.();
            eventSource?.close();
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = () => {
        console.error('SSE connection error');
        eventSource?.close();
        // Retry connection after 5 seconds
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, [onComplete]);

  if (!progress && !isActive) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="border border-border rounded-lg p-4 bg-gradient-to-br from-tiktok-pink/5 to-tiktok-blue/5"
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          {isActive ? (
            <Loader2 className="h-4 w-4 animate-spin text-tiktok-pink" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          <span className="text-sm font-medium">
            {isActive ? 'Discovering Creators...' : 'Discovery Complete!'}
          </span>
        </div>

        {/* Progress Stats */}
        {progress && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
              <TrendingUp className="h-3 w-3 text-tiktok-blue" />
              <div>
                <div className="text-muted-foreground">Processing</div>
                <div className="font-medium">{progress.processingJobs} jobs</div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
              <Users className="h-3 w-3 text-tiktok-pink" />
              <div>
                <div className="text-muted-foreground">Queued</div>
                <div className="font-medium">{progress.pendingJobs} jobs</div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Creators */}
        {progress && progress.recentCreators.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Recently Discovered:
            </div>
            <div className="space-y-1">
              <AnimatePresence mode="popLayout">
                {progress.recentCreators.slice(0, 3).map((creator, index) => (
                  <motion.div
                    key={creator.username}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.1 }}
                    className="text-xs bg-muted/30 rounded px-2 py-1 flex items-center justify-between"
                  >
                    <span className="font-mono">@{creator.username}</span>
                    <span className="text-muted-foreground">
                      {(creator.followers / 1000).toFixed(1)}K
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Timestamp */}
        {progress && (
          <div className="text-[10px] text-muted-foreground text-right">
            Last update: {new Date(progress.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </motion.div>
  );
}
