import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Heart, Bot, Rocket, Users, Facebook, Youtube, Plus } from "lucide-react";
import cuteImage from "@assets/images (3)_1753763874813.jpeg";
import AudioPlayer from "@/components/AudioPlayer";
import BotCard from "@/components/BotCard";
import BotConfigModal from "@/components/BotConfigModal";
import BotConfigForm from "@/components/BotConfigForm";
import BotScreen from "@/components/BotScreen";
import VipPricing from "@/components/VipPricing";
import WebConsole from "@/components/WebConsole";
import { useBots } from "@/hooks/use-bots";

export default function Home() {
  const { bots, isLoading, addBot } = useBots();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [newBotForm, setNewBotForm] = useState({ username: "", server: "" });

  // WebSocket logs được xử lý trong WebConsole component

  const handleAddBot = async () => {
    if (newBotForm.username && newBotForm.server) {
      await addBot.mutateAsync({
        username: newBotForm.username,
        server: newBotForm.server,
        autoReconnect: true,
        chatEnabled: true,
        movementPattern: "random",
        responseDelay: 1000,
      });
      setNewBotForm({ username: "", server: "" });
    }
  };

  const handleConfigBot = (botId: string) => {
    setSelectedBotId(botId);
    setIsConfigModalOpen(true);
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass-effect">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center animate-pulse">
                <Bot className="text-white text-xl" />
              </div>
              <h1 className="text-2xl font-bold text-purple-600">🎮 Quản Lý Bot</h1>
            </div>

            <div className="hidden md:flex items-center space-x-6">
              <a href="#home" className="text-purple-600 hover:text-pink-500 transition-colors font-medium">Trang Chủ</a>
              <a href="#dashboard" className="text-purple-600 hover:text-pink-500 transition-colors font-medium">Bảng Điều Khiển</a>
              <a href="#vip" className="text-purple-600 hover:text-pink-500 transition-colors font-medium">Tính Năng VIP</a>
              <a href="#contact" className="text-purple-600 hover:text-pink-500 transition-colors font-medium">Liên Hệ</a>
            </div>

            <div className="flex items-center space-x-3">
              <a href="https://www.facebook.com/le.van.nam.21737" target="_blank" rel="noopener noreferrer"
                 className="w-10 h-10 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-all transform hover:scale-110">
                <Facebook className="text-white w-5 h-5" />
              </a>
              <a href="https://m.youtube.com/@duythien2k6" target="_blank" rel="noopener noreferrer"
                 className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all transform hover:scale-110">
                <Youtube className="text-white w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-purple-600 mb-8 animate-bounce-slow">
            🌸 embeloli.vn - Quản Lý Bot Minecraft 🌸
          </h1>
          <p className="text-xl text-gray-700 mb-12 max-w-2xl mx-auto">
            <strong>embeloli.vn</strong> - Trang web số 1 Việt Nam về quản lý bot Minecraft! Giao diện màu hồng đáng yêu, tính năng VIP mạnh mẽ, và công nghệ mineflayer tiên tiến. Dễ dàng tạo và điều khiển bot cho server Minecraft của bạn.
          </p>

          {/* Cute Character Image */}
          <div className="flex justify-center mb-12">
            <div className="animate-float">
              <img src={cuteImage} 
                   alt="Cute character" 
                   className="rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 max-w-md w-full h-auto object-cover border-4 border-pink-200" />
            </div>
          </div>

          <AudioPlayer />
        </div>
      </section>

      {/* Bot Management Dashboard */}
      <section id="dashboard" className="py-20 px-4 bg-white/50">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-purple-600 text-center mb-8">
            🤖 Bảng Điều Khiển Bot
          </h2>
          
          {/* Bot Configuration Section */}
          <div className="mb-8 flex justify-center">
            <BotConfigForm />
          </div>

          {/* Bot Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {isLoading ? (
              Array.from({ length: 3 }, (_, i) => (
                <Card key={i} className="bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="h-6 bg-gray-200 rounded mb-4"></div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                {bots?.map((bot) => (
                  <BotCard 
                    key={bot.id} 
                    bot={bot} 
                    onConfigure={() => handleConfigBot(bot.id)}
                  />
                ))}

                {/* Add New Bot Card */}
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Thêm Bot Mới</h3>
                    <div className="space-y-3">
                      <input 
                        type="text" 
                        placeholder="Tên Bot" 
                        value={newBotForm.username}
                        onChange={(e) => setNewBotForm(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full px-4 py-2 border border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none"
                      />
                      <input 
                        type="text" 
                        placeholder="Địa chỉ Server" 
                        value={newBotForm.server}
                        onChange={(e) => setNewBotForm(prev => ({ ...prev, server: e.target.value }))}
                        className="w-full px-4 py-2 border border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none"
                      />
                      <Button 
                        onClick={handleAddBot}
                        disabled={addBot.isPending || !newBotForm.username || !newBotForm.server}
                        className="w-full bg-pink-500 hover:bg-pink-600 text-white"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {addBot.isPending ? "Đang thêm..." : "Thêm Bot"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Bot Screen Section */}
          <div className="mt-12">
            <h3 className="text-2xl font-bold text-purple-600 text-center mb-6">
              🖥️ ScreenBot - Màn Hình Bot Real-time
            </h3>
            <div className="max-w-6xl mx-auto mb-8">
              <BotScreen 
                botId={selectedBotId || (bots && bots.length > 0 ? bots[0].id : "")} 
                botName={selectedBotId ? bots?.find(b => b.id === selectedBotId)?.username || "Bot" : (bots && bots.length > 0 ? bots[0].username : "No Bot")}
              />
            </div>
          </div>

          {/* Web Console Section */}
          <div className="mt-12">
            <h3 className="text-2xl font-bold text-purple-600 text-center mb-6">
              💻 Console Điều Khiển Real-time
            </h3>
            <div className="max-w-6xl mx-auto">
              <WebConsole bots={bots || []} />
            </div>
          </div>
        </div>
      </section>

      {/* VIP Features Section */}
      <VipPricing />

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 bg-white/50">
        <div className="container mx-auto text-center max-w-4xl">
          <h2 className="text-4xl font-bold text-purple-600 mb-8">
            📞 Liên Hệ & Hỗ Trợ
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Facebook className="text-white text-2xl" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">Facebook</h3>
                <p className="text-gray-600 mb-4">Chat trực tiếp với chúng mình để được hỗ trợ nhanh nhất!</p>
                <Button asChild className="bg-blue-500 hover:bg-blue-600">
                  <a href="https://www.facebook.com/le.van.nam.21737" target="_blank" rel="noopener noreferrer">
                    Messenger ngay
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Youtube className="text-white text-2xl" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">YouTube</h3>
                <p className="text-gray-600 mb-4">Đón xem video mới nhất và hướng dẫn sử dụng bot!</p>
                <Button asChild className="bg-red-500 hover:bg-red-600">
                  <a href="https://m.youtube.com/@duythien2k6" target="_blank" rel="noopener noreferrer">
                    Subscribe ngay
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-pink-100">
            <CardContent className="p-8">
              <h3 className="text-2xl font-semibold text-purple-600 mb-4">🎯 Tại sao chọn chúng mình?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Heart className="text-white text-sm" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Giao diện cute</h4>
                    <p className="text-gray-600 text-sm">Thiết kế đáng yêu, dễ sử dụng với màu hồng đặc trưng</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Rocket className="text-white text-sm" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Hiệu suất cao</h4>
                    <p className="text-gray-600 text-sm">Bot chạy ổn định, ít lag với công nghệ mineflayer</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Users className="text-white text-sm" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Hỗ trợ 24/7</h4>
                    <p className="text-gray-600 text-sm">Team support nhiệt tình, sẵn sàng giúp đỡ bạn</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="gradient-pink text-white py-12 px-4">
        <div className="container mx-auto text-center">
          <div className="mb-8">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="text-white text-2xl" />
            </div>
            <h3 className="text-2xl font-bold mb-2">embeloli.vn</h3>
            <p className="text-pink-100">Quản lý bot Minecraft một cách cute và hiệu quả! 🌸</p>
          </div>

          <div className="flex justify-center space-x-6 mb-8">
            <a href="https://www.facebook.com/le.van.nam.21737" target="_blank" rel="noopener noreferrer"
               className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all">
              <Facebook className="text-xl" />
            </a>
            <a href="https://m.youtube.com/@duythien2k6" target="_blank" rel="noopener noreferrer"
               className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all">
              <Youtube className="text-xl" />
            </a>
          </div>

          <div className="border-t border-white/20 pt-8">
            <p className="text-pink-100">&copy; 2024 embeloli.vn - Quản Lý Bot Minecraft. Được tạo với 💖 cho cộng đồng Minecraft!</p>
          </div>
        </div>
      </footer>

      {/* Bot Configuration Modal */}
      {selectedBotId && (
        <BotConfigModal
          botId={selectedBotId}
          open={isConfigModalOpen}
          onClose={() => {
            setIsConfigModalOpen(false);
            setSelectedBotId(null);
          }}
        />
      )}
    </div>
  );
}