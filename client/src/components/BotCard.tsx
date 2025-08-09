import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Settings } from "lucide-react";
import { Bot } from "@shared/schema";
import { useBots } from "@/hooks/use-bots";

interface BotCardProps {
  bot: Bot;
  onConfigure: () => void;
}

export default function BotCard({ bot, onConfigure }: BotCardProps) {
  const { startBot, stopBot } = useBots();

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusShadow = (status: string) => {
    switch (status) {
      case 'online':
        return 'bot-status-online';
      case 'error':
        return 'bot-status-offline';
      default:
        return '';
    }
  };

  const handleStart = async () => {
    await startBot.mutateAsync(bot.id);
  };

  const handleStop = async () => {
    await stopBot.mutateAsync(bot.id);
  };

  return (
    <Card className={`bg-white/80 backdrop-blur-sm shadow-lg ${getStatusShadow(bot.status)}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-800">{bot.username}</h3>
          <Badge className={`${getStatusColor(bot.status)} text-white`}>
            {bot.status.charAt(0).toUpperCase() + bot.status.slice(1)}
          </Badge>
        </div>
        
        <div className="space-y-2 mb-4">
          <p className="text-gray-600">
            Server: <span className="font-medium">{bot.server}</span>
          </p>
          <p className="text-gray-600">
            Username: <span className="font-medium">{bot.username}</span>
          </p>
          <p className="text-gray-600">
            {bot.status === 'online' ? 'Uptime' : 'Last seen'}: 
            <span className="font-medium ml-1">
              {bot.status === 'online' 
                ? formatUptime(bot.uptime ?? 0) 
                : bot.lastSeen 
                  ? new Date(bot.lastSeen).toLocaleString()
                  : 'Never'
              }
            </span>
          </p>
        </div>
        
        <div className="flex space-x-2">
          {bot.status === 'online' ? (
            <Button
              onClick={handleStop}
              disabled={stopBot.isPending}
              className="bg-red-500 hover:bg-red-600 text-white flex-1"
              size="sm"
            >
              <Square className="mr-2 h-4 w-4" />
              {stopBot.isPending ? "Stopping..." : "Stop"}
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={startBot.isPending}
              className="bg-green-500 hover:bg-green-600 text-white flex-1"
              size="sm"
            >
              <Play className="mr-2 h-4 w-4" />
              {startBot.isPending ? "Starting..." : "Start"}
            </Button>
          )}
          <Button
            onClick={onConfigure}
            variant="outline"
            className="border-pink-200 text-pink-600 hover:bg-pink-50 flex-1"
            size="sm"
          >
            <Settings className="mr-2 h-4 w-4" />
            Config
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
