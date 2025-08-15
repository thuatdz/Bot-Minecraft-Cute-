
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Monitor, Heart, Utensils, MapPin, Sword, Shield, RefreshCw } from "lucide-react";

interface BotScreenData {
  connected: boolean;
  health: number;
  food: number;
  position: { x: number; y: number; z: number };
  mode: string;
  currentAction: string;
  nearbyEntities: Array<{ name: string; distance: string }>;
  inventory: Array<{ name: string; count: number }>;
  equipment?: {
    weapon: string | null;
    armor: Array<string | null>;
  };
  targetPlayer?: string | null;
  status?: string;
  reconnectAttempts?: number;
  timestamp: string;
}

interface BotScreenProps {
  botId: string;
  botName: string;
}

export default function BotScreen({ botId, botName }: BotScreenProps) {
  const [screenData, setScreenData] = useState<BotScreenData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchScreenData = async () => {
    if (!botId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/bots/${botId}/screen`);
      if (response.ok) {
        const data = await response.json();
        setScreenData(data);
      }
    } catch (error) {
      console.error("Error fetching bot screen:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScreenData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchScreenData, 2000); // Update mỗi 2 giây
      return () => clearInterval(interval);
    }
  }, [botId, autoRefresh]);

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'protecting': return 'bg-red-500';
      case 'following': return 'bg-blue-500';
      case 'autofarming': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'protecting': return <Shield size={16} />;
      case 'following': return <MapPin size={16} />;
      case 'autofarming': return <Sword size={16} />;
      default: return <Monitor size={16} />;
    }
  };

  if (!screenData) {
    return (
      <Card className="bg-gradient-to-br from-gray-900 to-black border-pink-300/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Monitor className="mr-2 text-pink-400" size={20} />
            🖥️ Bot Screen: {botName}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="text-gray-400">
            {isLoading ? "Đang tải..." : "Chọn bot để xem màn hình"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-black border-pink-300/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center">
            <Monitor className="mr-2 text-pink-400" size={20} />
            🖥️ ScreenBot: {botName}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`border-pink-300/20 text-pink-300 hover:bg-pink-500/20 ${autoRefresh ? 'bg-pink-500/20' : ''}`}
            >
              {autoRefresh ? '🔴 Live' : '⏸️ Paused'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchScreenData}
              disabled={isLoading}
              className="border-pink-300/20 text-pink-300 hover:bg-pink-500/20"
            >
              <RefreshCw size={14} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Badge variant={screenData.connected ? "default" : "destructive"}>
              {screenData.connected ? "🟢 Live" : "🔴 Offline"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Display */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-red-400 mb-2">
              <Heart size={16} />
              <span className="text-sm font-medium">Health</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {screenData.health}/20
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
              <div 
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{ width: `${(screenData.health / 20) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-orange-400 mb-2">
              <Utensils size={16} />
              <span className="text-sm font-medium">Food</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {screenData.food}/20
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
              <div 
                className="bg-orange-500 h-2 rounded-full transition-all"
                style={{ width: `${(screenData.food / 20) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Position & Mode */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-blue-400 mb-2">
              <MapPin size={16} />
              <span className="text-sm font-medium">Position</span>
            </div>
            <div className="text-white text-sm">
              X: {screenData.position.x}<br/>
              Y: {screenData.position.y}<br/>
              Z: {screenData.position.z}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-pink-400 mb-2">
              {getModeIcon(screenData.mode)}
              <span className="text-sm font-medium">Mode</span>
            </div>
            <Badge className={`${getModeColor(screenData.mode)} text-white`}>
              {screenData.mode.toUpperCase()}
            </Badge>
            <div className="text-gray-300 text-xs mt-1">
              {screenData.currentAction}
            </div>
          </div>
        </div>

        {/* Equipment Status */}
        {screenData.equipment && (
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-yellow-400 mb-2">
              <Sword size={16} />
              <span className="text-sm font-medium">Trang Bị</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-white">
              <div>
                <span className="text-gray-400">Vũ khí:</span> {screenData.equipment.weapon || 'Tay không'}
              </div>
              <div>
                <span className="text-gray-400">Giáp:</span> {screenData.equipment.armor.filter(Boolean).length || 0}/4
              </div>
            </div>
          </div>
        )}

        {/* Target Player */}
        {screenData.targetPlayer && (
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-green-400 mb-1">
              <MapPin size={16} />
              <span className="text-sm font-medium">Đang theo dõi:</span>
            </div>
            <Badge className="bg-green-500 text-white">{screenData.targetPlayer}</Badge>
          </div>
        )}

        {/* Nearby Entities */}
        {screenData.nearbyEntities && screenData.nearbyEntities.length > 0 && (
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-red-400 mb-2">
              <Shield size={16} />
              <span className="text-sm font-medium">Quái vật gần đó</span>
            </div>
            <div className="space-y-1">
              {screenData.nearbyEntities.map((entity, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-white">{entity.name}</span>
                  <span className="text-gray-400">{entity.distance}m</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Virtual Screen */}
        <div className="bg-black rounded-lg border border-pink-300/20 p-4 min-h-96">
          <div className="text-green-400 font-mono text-sm space-y-1">
            <div className="text-pink-400 mb-3 text-center">🤖 Bot Lolicute ScreenShare 🖥️</div>
            
            {/* Status Display */}
            <div className="bg-gray-900 rounded p-3 mb-3">
              <div className="text-center text-pink-300 mb-2">🎮 Bot Status</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Mode: <span className="text-yellow-300">{screenData.mode}</span></div>
                <div>HP: <span className="text-red-300">{screenData.health}/20</span></div>
                <div>Food: <span className="text-orange-300">{screenData.food}/20</span></div>
                <div>Status: <span className="text-blue-300">{screenData.connected ? 'Online' : 'Offline'}</span></div>
              </div>
            </div>

            {/* Current Action */}
            <div className="bg-gray-900 rounded p-3 mb-3">
              <div className="text-center text-pink-300 mb-2">💫 Current Action</div>
              <div className="text-center text-green-300 text-xs">
                {screenData.status || screenData.currentAction}
              </div>
            </div>

            {/* ASCII Art Representation */}
            <div className="bg-gray-900 rounded p-3 mb-3">
              <div className="text-center text-cyan-400 text-xs mb-2">┌─ Minecraft World View ─┐</div>
              <div className="font-mono text-xs">
                {screenData.mode === 'protecting' && (
                  <div className="text-center">
                    <div className="text-red-400">    🗡️ [BOT] 🛡️    </div>
                    <div className="text-yellow-400">  ╔═══════════╗  </div>
                    <div className="text-yellow-400">  ║ PROTECTING ║  </div>
                    <div className="text-yellow-400">  ╚═══════════╝  </div>
                    <div className="text-green-400">       👤        </div>
                    <div className="text-gray-400">   [PLAYER]     </div>
                  </div>
                )}
                {screenData.mode === 'following' && (
                  <div className="text-center">
                    <div className="text-green-400">       👤        </div>
                    <div className="text-gray-400">   [PLAYER]     </div>
                    <div className="text-blue-400">       ↑         </div>
                    <div className="text-pink-400">    🤖 [BOT]     </div>
                  </div>
                )}
                {screenData.mode === 'autofarming' && (
                  <div className="text-center">
                    <div className="text-red-400">   🕷️  🧟  🕷️    </div>
                    <div className="text-orange-400">      ⚔️       </div>
                    <div className="text-pink-400">   🤖 [BOT]     </div>
                    <div className="text-green-400">   FARMING...   </div>
                  </div>
                )}
                {screenData.mode === 'idle' && (
                  <div className="text-center">
                    <div className="text-gray-400">   ░░░░░░░░░    </div>
                    <div className="text-pink-400">   🤖 [BOT]     </div>
                    <div className="text-gray-400">   ░░░░░░░░░    </div>
                    <div className="text-cyan-400">    IDLE...     </div>
                  </div>
                )}
              </div>
              <div className="text-center text-cyan-400 text-xs mt-2">└─────────────────────┘</div>
            </div>

            {/* Status Information */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div>Status: <span className="text-blue-400">{screenData.connected ? 'ONLINE' : 'OFFLINE'}</span></div>
                <div>Mode: <span className="text-yellow-400">{screenData.mode.toUpperCase()}</span></div>
                <div>Action: <span className="text-cyan-400">{screenData.currentAction}</span></div>
              </div>
              <div>
                <div>Health: <span className="text-red-400">❤️ {screenData.health}/20</span></div>
                <div>Food: <span className="text-orange-400">🍖 {screenData.food}/20</span></div>
                <div>Pos: <span className="text-blue-400">📍 ({Math.round(screenData.position.x)}, {Math.round(screenData.position.y)}, {Math.round(screenData.position.z)})</span></div>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-2 mt-3">
              <div className="text-pink-400 mb-1">🎬 Live Activity Feed:</div>
              <div className="bg-gray-800 rounded p-2 max-h-24 overflow-y-auto text-xs space-y-1">
                <div className="text-gray-300">• {new Date(screenData.timestamp).toLocaleTimeString()} - Screen updated</div>
                {screenData.mode === 'protecting' && (
                  <>
                    <div className="text-red-400">• Equipped best sword for protection ⚔️</div>
                    <div className="text-blue-400">• Following player closely 👥</div>
                    <div className="text-yellow-400">• Scanning for threats... 👀</div>
                  </>
                )}
                {screenData.mode === 'autofarming' && (
                  <>
                    <div className="text-green-400">• Searching for target mobs 🔍</div>
                    <div className="text-red-400">• Combat mode active ⚔️</div>
                    <div className="text-orange-400">• Using best gear for farming 🛡️</div>
                  </>
                )}
                {screenData.mode === 'following' && (
                  <>
                    <div className="text-blue-400">• Tracking player movement 📍</div>
                    <div className="text-cyan-400">• Maintaining follow distance 📏</div>
                    <div className="text-green-400">• Ready for teleport if needed ✨</div>
                  </>
                )}
                {screenData.mode === 'idle' && (
                  <>
                    <div className="text-gray-400">• Random movement pattern active 🚶</div>
                    <div className="text-pink-400">• Waiting for commands... 💭</div>
                    <div className="text-cyan-400">• Health and food monitoring 📊</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="text-xs text-gray-400 bg-gray-800/30 rounded p-2">
          <div className="text-pink-300 font-semibold mb-1">🎮 Tính năng mới:</div>
          <div>• Auto equip đồ xịn nhất (Diamond {'>'} Iron {'>'} Stone)</div>
          <div>• Chiến thuật đặc biệt với Creeper (hit & run)</div>
          <div>• Auto farm sinh vật với gear tốt nhất</div>
          <div>• Real-time bot screen monitoring</div>
        </div>
      </CardContent>
    </Card>
  );
}
