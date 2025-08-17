import mineflayer, { Bot } from 'mineflayer'
import { pathfinder, Movements } from 'mineflayer-pathfinder'
import * as net from 'net'

// Import goals using createRequire for CommonJS module
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { goals } = require('mineflayer-pathfinder')
// import autoEat from 'mineflayer-auto-eat'
import { plugin as pvp } from 'mineflayer-pvp'
import { plugin as collectBlock } from 'mineflayer-collectblock'
import { Vec3 } from 'vec3'

const apiKey = "AIzaSyB8gZxjT6hFiOCeNS7ZNzVG-M_bDZ_CVNk" // Gemini AI key

// Bot configuration
const BOT_CONFIG = {
  host: process.env.MINECRAFT_SERVER_HOST || 'thuatzai123.aternos.me',
  port: parseInt(process.env.MINECRAFT_SERVER_PORT || '38893'),
  username: process.env.MINECRAFT_BOT_USERNAME || 'botlolicute',
  version: process.env.MINECRAFT_VERSION || '1.19.4',
  auth: 'offline' as const
}

// Biến trạng thái global
let bot: Bot
let targetPlayer: any = null
let followInterval: NodeJS.Timeout | null = null
let protectInterval: NodeJS.Timeout | null = null
let autoMineActive = false
let autoFarmActive = false
let autoFishingActive = false
let isFollowing = false
let isProtecting = false
let autoChestHuntActive = false
let fishingActive = false
let lootedChests: Set<string> = new Set() // Ghi nhớ rương đã loot
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5

async function testServerConnection() {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    
    socket.setTimeout(5000) // 5 second timeout
    
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    
    socket.on('error', () => {
      resolve(false)
    })
    
    socket.connect(BOT_CONFIG.port, BOT_CONFIG.host)
  })
}

async function createBot() {
  console.log(`🚀 Đang tạo bot mới... (Thử lần ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`)
  console.log(`📡 Kết nối tới: ${BOT_CONFIG.host}:${BOT_CONFIG.port}`)
  
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('❌ Đã vượt quá số lần thử kết nối tối đa. Dừng bot.')
    console.log('💡 Gợi ý: Kiểm tra xem server Minecraft có đang online không:')
    console.log(`   - Truy cập https://${BOT_CONFIG.host} để kiểm tra status`)
    console.log('   - Hoặc thay đổi MINECRAFT_SERVER_HOST trong file .env')
    return
  }
  
  // Test server connectivity first
  console.log('🔍 Kiểm tra kết nối server...')
  const serverOnline = await testServerConnection()
  
  if (!serverOnline) {
    console.log('❌ Server không phản hồi. Server có thể đang offline.')
    console.log('💡 Gợi ý:')
    console.log('   1. Kiểm tra server Aternos có đang chạy không')
    console.log('   2. Thử kết nối bằng Minecraft client trước')
    console.log('   3. Kiểm tra địa chỉ server và port có đúng không')
    console.log('⏳ Sẽ thử lại sau...')
    
    // Still attempt connection but with warning
  } else {
    console.log('✅ Server phản hồi, đang kết nối bot...')
  }
  
  bot = mineflayer.createBot({
    host: BOT_CONFIG.host,
    port: BOT_CONFIG.port,
    username: BOT_CONFIG.username,
    version: BOT_CONFIG.version,
    auth: BOT_CONFIG.auth,
    keepAlive: true,
    hideErrors: false
  })

  // Load plugins with error handling
  try {
    bot.loadPlugin(pathfinder)
    // bot.loadPlugin(autoEat) // Disabled due to import issues
    bot.loadPlugin(pvp)
    bot.loadPlugin(collectBlock)
    console.log('✅ Plugins loaded successfully')
  } catch (pluginError) {
    console.log('⚠️ Warning loading plugins:', pluginError)
  }

  // Connection events
  bot.on('login', () => {
    console.log('🔑 Bot đang đăng nhập...')
  })

  bot.on('spawn', () => {
    console.log('🎉 Bot đã spawn thành công!')
    reconnectAttempts = 0 // Reset on successful connection
    
    const defaultMove = new Movements(bot)
    bot.pathfinder.setMovements(defaultMove)

    // Auto-eat disabled due to plugin issues

    // Start các chức năng
    startFlirting()
    autoEatSetup()
    collectNearbyItems()
  })

  bot.on('health', () => {
    // Handle health updates silently
  })

  // Note: The physicTick deprecation warning might be coming from plugins
  // We use the correct event name here, but plugins may still use the old one

  // ------------------ Trang bị ------------------
  function equipBestWeapon() {
    try {
      const weapons = bot.inventory.items().filter(item => 
        item.name.includes('sword') || 
        item.name.includes('axe') || 
        item.name.includes('pickaxe') ||
        item.name.includes('shovel')
      )
      
      if (weapons.length > 0) {
        // Sort by attack damage if available, otherwise by item tier
        const bestWeapon = weapons.sort((a, b) => {
          const getTier = (name: string) => {
            if (name.includes('diamond')) return 4
            if (name.includes('iron')) return 3
            if (name.includes('stone')) return 2
            if (name.includes('wood')) return 1
            return 0
          }
          return getTier(b.name) - getTier(a.name)
        })[0]
        
        bot.equip(bestWeapon, 'hand').catch(() => {})
      }
    } catch (error) {
      console.log('Lỗi trang bị vũ khí:', error)
    }
  }

  function equipBestArmor() {
    try {
      const armorSlots: {[key: string]: any} = {
        head: null,
        torso: null,
        legs: null,
        feet: null
      }

      for (const item of bot.inventory.items()) {
        if (item.name.includes('helmet') && (!armorSlots.head || item.maxDurability > armorSlots.head.maxDurability)) {
          armorSlots.head = item
        } else if (item.name.includes('chestplate') && (!armorSlots.torso || item.maxDurability > armorSlots.torso.maxDurability)) {
          armorSlots.torso = item
        } else if (item.name.includes('leggings') && (!armorSlots.legs || item.maxDurability > armorSlots.legs.maxDurability)) {
          armorSlots.legs = item
        } else if (item.name.includes('boots') && (!armorSlots.feet || item.maxDurability > armorSlots.feet.maxDurability)) {
          armorSlots.feet = item
        }
      }

      // Equip armor
      Object.entries(armorSlots).forEach(([slot, item]) => {
        if (item) {
          const destination = slot === 'torso' ? 'torso' : slot
          bot.equip(item, destination as any).catch(() => {})
        }
      })
    } catch (error) {
      console.log('Lỗi trang bị giáp:', error)
    }
  }

  function equipBestTool() {
    try {
      const tools = ['pickaxe', 'axe', 'shovel', 'hoe']
      let bestTool = null
      let highestTier = 0
      
      for (const item of bot.inventory.items()) {
        for (const toolType of tools) {
          if (item.name.includes(toolType)) {
            let tier = 0
            if (item.name.includes('diamond')) tier = 4
            else if (item.name.includes('iron')) tier = 3  
            else if (item.name.includes('stone')) tier = 2
            else if (item.name.includes('wooden')) tier = 1
            
            if (tier > highestTier) {
              highestTier = tier
              bestTool = item
            }
          }
        }
      }
      
      if (bestTool) {
        bot.equip(bestTool, 'hand').catch(() => {})
        console.log(`⚒️ Bot đã trang bị ${bestTool.name}`)
      }
    } catch (error) {
      console.log('Lỗi trang bị tool:', error)
    }
  }

  function equipOffhand() {
    try {
      const totem = bot.inventory.items().find(item => item.name === 'totem_of_undying')
      const shield = bot.inventory.items().find(item => item.name.includes('shield'))

      if (totem) {
        bot.equip(totem, 'off-hand').catch(() => {})
        console.log(`✨ Bot đã trang bị Vật Tổ vào tay trái.`)
      } else if (shield) {
        bot.equip(shield, 'off-hand').catch(() => {})
        console.log(`🛡️ Bot đã trang bị Khiên vào tay trái.`)
      }
    } catch (error) {
      console.log('Lỗi trang bị offhand:', error)
    }
  }

  // Tự động trang bị định kỳ
  setInterval(() => {
    equipBestWeapon()
    equipBestArmor()
    equipOffhand()
  }, 10000)

  // ------------------ Auto eat ------------------
  function autoEatSetup() {
    console.log('🍽️ Auto eat feature temporarily disabled')
  }

  // ------------------ Nhặt item ------------------
  function collectNearbyItems() {
    setInterval(() => {
      try {
        const entities = Object.values(bot.entities)
        for (const entity of entities) {
          if (entity.name === 'item' && entity.position && bot.entity.position.distanceTo(entity.position) < 5) {
            bot.lookAt(entity.position, true).catch(() => {})
            bot.collectBlock.collect(entity).catch(() => {})
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }, 2000)
  }

  // ------------------ Random Cute Chat / Flirting ------------------
  function startFlirting() {
    setInterval(async () => {
      if (Math.random() < 0.4) { // 40% chance mỗi 20s
        if (apiKey) {
          // Dùng AI để tạo câu thả thính
          const prompts = [
            "Tạo câu thả thính cute cho bot Minecraft tên Loli. Ngắn dưới 60 ký tự. Xưng tớ, gọi cậu.",
            "Bot Loli nói câu ngọt ngào với người chơi. Dưới 60 ký tự, có emoji, xưng tớ gọi cậu.",
            "Loli bot muốn thả thính cute. Tạo câu ngắn dưới 60 ký tự, đáng yêu, xưng tớ gọi cậu."
          ]
          
          try {
            const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)]
            const payload = {
              contents: [{ parts: [{ text: randomPrompt }] }]
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })

            const result = await response.json()
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text

            if (text) {
              bot.chat(text.substring(0, 70))
            } else {
              throw new Error('No AI response')
            }
          } catch (error) {
            // Fallback messages nếu AI không hoạt động
            const fallbackMessages = [
              "Cậu có nhớ tớ không? 💕",
              "Tớ đang nghĩ về cậu đó! 😊",
              "Cậu đẹp trai quá! 😘", 
              "Tớ thích chơi với cậu! 💖",
              "Cậu có thương tớ không? 🥺",
              "Tớ muốn ở bên cậu mãi! 💕",
              "Cậu làm tớ tim đập nhanh! 💓"
            ]
            const randomMessage = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)]
            bot.chat(randomMessage)
          }
        } else {
          // Không có API key thì dùng messages có sẵn
          const simpleMessages = [
            "Cậu có nhớ tớ không? 💕",
            "Tớ thích chơi với cậu! 💖",
            "Cậu đẹp trai quá! 😘",
            "Tớ sẽ bảo vệ cậu! 🛡️"
          ]
          const randomMessage = simpleMessages[Math.floor(Math.random() * simpleMessages.length)]
          bot.chat(randomMessage)
        }
      }
    }, 20000) // 20 giây một lần
  }

  // ------------------ Chat Commands ------------------
  bot.on('chat', async (username: string, message: string) => {
    console.log(`💬 Chat nhận được: [${username}]: ${message}`)
    
    if (username === bot.username || username === 'server' || username === 'console') {
      return
    }

    const cleanMessage = message.toLowerCase().trim()
    console.log(`🔍 Xử lý lệnh: "${cleanMessage}"`)

    // Xử lý các lệnh chat
    if (cleanMessage.includes('theo')) {
      startFollowingPlayer(username)
    } else if (cleanMessage.includes('bảo vệ')) {
      startProtectingPlayer(username)
    } else if (cleanMessage.includes('dừng') || cleanMessage.includes('stop')) {
      stopAll()
    } else if (cleanMessage.includes('ngủ')) {
      goSleep()
    } else if (cleanMessage.startsWith('cần')) {
      giveItemToPlayer(username, cleanMessage)
    } else if (cleanMessage.startsWith('auto mine') || cleanMessage.includes('đào')) {
      if (cleanMessage.includes('diamond')) {
        startAutoMine('diamond_ore')
      } else if (cleanMessage.includes('iron')) {
        startAutoMine('iron_ore') 
      } else if (cleanMessage.includes('coal')) {
        startAutoMine('coal_ore')
      } else if (cleanMessage.includes('gold')) {
        startAutoMine('gold_ore')
      } else {
        startAutoMine('diamond_ore') // default
      }
    } else if (cleanMessage.includes('rương') || cleanMessage.includes('chest')) {
      smartChestHunt()
    } else if (cleanMessage.includes('cất đồ')) {
      storeItemsInChest()
    } else if (cleanMessage.includes('dừng câu cá')) {
      stopFishing()
    } else if (cleanMessage.includes('auto farm all') || cleanMessage.includes('farm')) {
      startAutoFarmAll()
    } else if (cleanMessage.includes('câu') || cleanMessage.includes('fish')) {
      startFishing()
    } else if (cleanMessage.includes('botlolicute') || cleanMessage.startsWith('bot ơi')) {
      handleChatWithAI(username, cleanMessage)
    } else {
      // Random AI chat response
      if (Math.random() < 0.6) { // 60% chance để phản hồi
        handleChatWithAI(username, cleanMessage)
      }
    }
  })

  // ------------------ Chat AI Response ------------------
  async function handleChatWithAI(username: string, message: string) {
    if (!apiKey) {
      bot.chat('🥺 Tớ chưa được cấu hình AI, cậu liên hệ admin nhé!')
      return
    }

    try {
      const prompt = message.replace('botlolicute', '').replace('bot ơi', '').trim()
      const cutePrompts = [
        `Tớ là Loli bot cute trong Minecraft. ${username} nói: "${prompt}". Trả lời ngắn dưới 80 ký tự, đáng yêu, hơi thả thính. Xưng tớ, gọi cậu.`,
        `Tớ là bot AI tên Loli, đang chơi với ${username}. Phản hồi "${prompt}" theo kiểu cute girl, ngắn gọn, có emoji. Dùng tớ/cậu.`,
        `Tớ là Loli bot đáng yêu. ${username}: "${prompt}". Trả lời ngọt ngào, hơi flirt, dưới 80 ký tự. Xưng tớ gọi cậu.`
      ]
      
      const systemPrompt = cutePrompts[Math.floor(Math.random() * cutePrompts.length)]

      const payload = {
        contents: [{ parts: [{ text: systemPrompt }] }]
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text

      if (generatedText) {
        bot.chat(generatedText.substring(0, 80))
      } else {
        const fallbackResponses = [
          `Hmm... tớ đang nghĩ về cậu đó! 💕`,
          `Cậu nói gì vậy? Tớ hơi mơ màng nè! 😊`,
          `Ôi tớ đang bận... nhưng luôn có time cho cậu! 😘`
        ]
        const randomFallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
        bot.chat(randomFallback)
      }
    } catch (error) {
      const errorResponses = [
        `Ôi, tớ hơi rối... cậu nói lại không? 🥺`,
        `Tớ không nghe rõ, cậu thương tớ thì nói lại! 💕`,
        `Hmm? Tớ đang mơ về cậu nè! 😊`
      ]
      const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)]
      bot.chat(randomError)
      console.error('Lỗi chat AI:', error)
    }
  }

  // ------------------ Follow / Protect ------------------
  function startFollowingPlayer(username: string) {
    const playerEntity = bot.players[username]?.entity
    if (!playerEntity) {
      bot.chat(`🥺 Cậu phải ở trong tầm nhìn của tớ thì tớ mới đi theo được!`)
      return
    }

    targetPlayer = playerEntity
    bot.chat(`❤️ Tớ sẽ theo cậu đến cùng trời cuối đất!`)
    stopProtecting()
    startFollowing()
    console.log(`✅ Bắt đầu theo ${username}`)
  }

  function startFollowing() {
    isFollowing = true
    if (followInterval) clearInterval(followInterval)
    
    followInterval = setInterval(async () => {
      if (!targetPlayer || !targetPlayer.isValid) {
        stopFollowing()
        return
      }

      const targetPos = targetPlayer.position
      const distance = bot.entity.position.distanceTo(targetPos)

      // Kiểm tra boat logic chỉ khi player gần
      const botInBoat = bot.vehicle !== null
      
      if (distance <= 10) {
        // Kiểm tra xem player có ngồi thuyền không
        const playerInBoat = targetPlayer.vehicle !== null
        
        if (playerInBoat && !botInBoat) {
          // Player ngồi thuyền, bot chưa ngồi -> tìm thuyền để ngồi
          const availableBoat = Object.values(bot.entities).find((entity: any) => 
            entity.name === 'boat' && 
            entity.position && 
            entity.position.distanceTo(bot.entity.position) < 8 && 
            (!entity.passengers || entity.passengers.length === 0)
          )
          
          if (availableBoat) {
            try {
              bot.chat('🚤 Tớ cũng ngồi thuyền theo cậu!')
              await bot.mount(availableBoat as any)
            } catch (error) {
              console.log('Lỗi ngồi thuyền:', error)
            }
          }
        } else if (!playerInBoat && botInBoat) {
          // Player không ngồi thuyền, bot đang ngồi -> xuống thuyền
          try {
            bot.chat('🚶‍♀️ Cậu xuống thuyền rồi, tớ cũng xuống!')
            bot.dismount()
          } catch (error) {
            console.log('Lỗi xuống thuyền:', error)
          }
        }
      }

      // Nếu quá xa thì teleport
      if (distance > 15) {
        try {
          bot.chat(`/tp ${targetPlayer.username}`)
        } catch (e) {
          // Nếu không thể tp, thì đào đường và bơi
          bot.pathfinder.setGoal(new goals.GoalBlock(targetPos.x, targetPos.y, targetPos.z))
          
          // Cho phép đập mọi khối cản
          const movements = new Movements(bot)
          movements.canDig = true
          movements.allow1by1towers = true
          movements.allowParkour = false
          movements.allowSprinting = true
          movements.allowEntityDetection = true
          
          // Cho phép lặn
          movements.allowFreeMotion = true
          movements.canOpenDoors = true
          
          bot.pathfinder.setMovements(movements)
        }
        return
      }

      // Giữ khoảng cách 2 block  
      if (!botInBoat) {
        bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer, 2), true)
      }
    }, 200)
  }

  function stopFollowing() {
    isFollowing = false
    if (followInterval) {
      clearInterval(followInterval)
      followInterval = null
    }
    bot.pathfinder.setGoal(null)
  }

  function startProtectingPlayer(username: string) {
    const playerEntity = bot.players[username]?.entity
    if (!playerEntity) {
      bot.chat(`🥺 Cậu phải ở gần tớ thì tớ mới bảo vệ được!`)
      return
    }

    targetPlayer = playerEntity
    bot.chat(`🛡️ Tớ sẽ bảo vệ cậu khỏi tất cả nguy hiểm!`)
    stopFollowing()
    startProtecting()
    console.log(`✅ Bắt đầu bảo vệ ${username}`)
  }

  function startProtecting() {
    isProtecting = true
    if (protectInterval) clearInterval(protectInterval)
    
    protectInterval = setInterval(async () => {
      if (!targetPlayer || !targetPlayer.isValid) {
        stopProtecting()
        return
      }

      const targetPos = targetPlayer.position
      const distance = bot.entity.position.distanceTo(targetPos)

      // Kiểm tra máu và ăn thức ăn nếu cần
      const health = bot.health
      const food = bot.food
      
      if (health < 15 || food < 15) { // Máu dưới 15 hoặc đói
        const foodItems = bot.inventory.items().filter(item => 
          item.name.includes('bread') || 
          item.name.includes('apple') || 
          item.name.includes('meat') ||
          item.name.includes('fish') ||
          item.name.includes('potato') ||
          item.name.includes('carrot')
        )
        
        if (foodItems.length > 0) {
          try {
            await bot.equip(foodItems[0], 'hand')
            bot.consume()
            bot.chat('🍞 Tớ ăn thức ăn để hồi máu rồi đánh tiếp!')
            await new Promise(resolve => setTimeout(resolve, 1000))
          } catch (error) {
            console.log('Lỗi ăn thức ăn:', error)
          }
        }
      }

      // Tìm mob gần để tấn công (chỉ trong phạm vi 7 block)
      const mob = bot.nearestEntity((entity: any) => {
        if (!entity || !entity.position) return false
        
        const distance = bot.entity.position.distanceTo(entity.position)
        if (distance >= 7) return false
        
        // Các loại mob cần tấn công
        const hostileMobs = ['zombie', 'skeleton', 'creeper', 'spider', 'witch', 'pillager', 'vindicator', 'evoker', 'husk', 'stray', 'phantom', 'drowned']
        const mobName = entity.name ? entity.name.toLowerCase() : ''
        const displayName = entity.displayName ? entity.displayName.toLowerCase() : ''
        
        // Kiểm tra theo tên hoặc displayName
        const isHostile = hostileMobs.some(mobType => 
          mobName.includes(mobType) || displayName.includes(mobType)
        )
        
        // Hoặc kiểm tra theo type và loại trừ các mob thân thiện
        const isMobType = entity.type === 'mob' && 
                         !mobName.includes('villager') && 
                         !mobName.includes('iron_golem') && 
                         !displayName.includes('enderman')
        
        return isHostile || isMobType
      })

      // Nếu cách xa player quá 9 block thì ưu tiên đi theo player
      if (distance > 9) {
        bot.pvp.stop()
        bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer, 2), true)
      } else if (mob && distance <= 9 && health > 10) { // Chỉ đánh khi máu đủ
        equipBestWeapon()
        bot.setControlState('sprint', true)
        bot.pvp.attack(mob)
        console.log(`⚔️ Đang tấn công ${mob.name || mob.displayName} cách ${Math.round(bot.entity.position.distanceTo(mob.position))} blocks`)
      } else {
        bot.pvp.stop()
        if (distance > 6) {
          bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer, 2), true)
        }
      }
    }, 200)
  }

  function stopProtecting() {
    isProtecting = false
    if (protectInterval) {
      clearInterval(protectInterval)
      protectInterval = null
    }
    bot.pvp.stop()
    bot.pathfinder.setGoal(null)
  }

  function stopAll() {
    stopFollowing()
    stopProtecting()
    targetPlayer = null
    autoMineActive = false
    autoFarmActive = false
    autoFishingActive = false
    autoChestHuntActive = false
    fishingActive = false
    
    bot.pathfinder.setGoal(null)
    bot.pvp.stop()
    
    bot.chat(`🛑 Được rồi cậu, tớ dừng tất cả hoạt động đây! 💕`)
    console.log('⏹️ Dừng tất cả hoạt động')
  }

  // ------------------ Sleep ------------------
  async function goSleep() {
    console.log('😴 Yêu cầu bot đi ngủ')
    
    if (bot.time.isDay) {
      bot.chat(`☀️ Trời đang sáng mà cậu, chưa đi ngủ được đâu!`)
      return
    }

    const bedBlock = bot.findBlock({
      matching: (block: any) => block.name.includes('bed'),
      maxDistance: 16
    })

    if (bedBlock) {
      bot.chat(`😴 Tớ buồn ngủ quá, đi ngủ thôi nào!`)
      try {
        await bot.sleep(bedBlock)
        bot.chat(`Zzz... 😴`)
      } catch (err) {
        bot.chat(`😢 Tớ không ngủ được ở đây. Cậu tìm chỗ khác nhé.`)
        console.log('Lỗi ngủ:', err)
      }
    } else {
      bot.chat(`🛌 Tớ không tìm thấy giường nào gần đây cả.`)
    }
  }

  // ------------------ Give Item ------------------
  function giveItemToPlayer(username: string, msg: string) {
    const match = msg.match(/cần (\d+) (\w+)/)
    if (!match) return

    const qty = parseInt(match[1])
    const name = match[2]
    const playerEntity = bot.players[username]?.entity
    
    if (!playerEntity) {
      bot.chat(`🥺 Không thấy cậu để đưa ${name}`)
      return
    }

    const item = bot.inventory.items().find(i => i.name.includes(name))
    if (!item) {
      bot.chat(`🥺 Không có ${name}`)
      return
    }

    const throwItem = async () => {
      try {
        const distance = bot.entity.position.distanceTo(playerEntity.position)
        if (distance > 3) {
          bot.pathfinder.setGoal(new goals.GoalFollow(playerEntity, 2))
        } else {
          await bot.toss(item.type, null, qty)
          bot.chat(`🎁 Đã ném ${item.name} cho ${username}`)
        }
      } catch (error) {
        console.log('Lỗi ném item:', error)
      }
    }

    throwItem()
  }

  // ------------------ Auto Mine ------------------
  function startAutoMine(oreName: string) {
    if (!oreName) return
    
    autoMineActive = true
    bot.chat(`⛏️ Bắt đầu đào ${oreName}`)
    
    const mineInterval = setInterval(async () => {
      if (!autoMineActive) {
        clearInterval(mineInterval)
        return
      }

      try {
        // Chỉ trang bị tool nếu chưa có hoặc không phù hợp
        const currentItem = bot.heldItem
        if (!currentItem || !currentItem.name.includes('pickaxe')) {
          equipBestTool()
        }
        
        const ore = bot.findBlock({
          matching: (block: any) => block.name.includes(oreName),
          maxDistance: 64
        })

        if (ore) {
          console.log(`⛏️ Tìm thấy ${oreName} tại ${ore.position}`)
          
          // Kiểm tra khoảng cách đến ore
          const distance = bot.entity.position.distanceTo(ore.position)
          
          if (distance > 4.5) {
            // Thiết lập movements để di chuyển
            const movements = new Movements(bot)
            movements.canDig = true
            movements.allow1by1towers = true
            movements.allowParkour = true
            movements.allowSprinting = true
            bot.pathfinder.setMovements(movements)
            
            // Di chuyển đến ore
            bot.pathfinder.setGoal(new goals.GoalBlock(ore.position.x, ore.position.y, ore.position.z))
            
            // Đợi di chuyển xong
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
          
          // Dừng pathfinder trước khi đào
          bot.pathfinder.setGoal(null)
          
          // Đợi một chút để đảm bảo pathfinder đã dừng
          await new Promise(resolve => setTimeout(resolve, 500))
          
          try {
            // Kiểm tra lại khoảng cách trước khi đào
            const finalDistance = bot.entity.position.distanceTo(ore.position)
            if (finalDistance <= 4.5) {
              await bot.dig(ore)
              bot.chat(`✅ Đã đào xong ${oreName}`)
            } else {
              console.log(`❌ Quá xa để đào ${oreName} (khoảng cách: ${finalDistance.toFixed(2)})`)
            }
          } catch (digError) {
            console.log('Lỗi đào:', digError)
          }
        } else {
          console.log(`🔍 Không tìm thấy ${oreName} trong phạm vi 128 block`)
        }
      } catch (error) {
        console.log('Lỗi auto mine:', error)
      }
    }, 5000) // Tăng interval để tránh spam
  }

  // ------------------ Simple Chest Hunt ------------------
  async function smartChestHunt() {
    try {
      stopAll()
      autoChestHuntActive = false // Tạm thời disable
      bot.chat('🗃️ Tính năng tìm rương đang được cải tiến, thử lại sau nhé! 💕')
      
    } catch (error) {
      bot.chat('🥺 Có lỗi khi tìm rương...')
      console.log('Lỗi chest hunt:', error)
      autoChestHuntActive = false
    }
  }
  
  // Simple chest finding (will be improved later)
  async function findSingleChest() {
    try {
      bot.chat('🔍 Tìm rương đơn giản...')
      // Basic implementation without recursion
      const chestBlock = bot.findBlocks({
        matching: ['chest', 'barrel', 'ender_chest'],
        maxDistance: 32,
        count: 1
      })

      if (chestBlock.length > 0) {
        bot.chat(`📦 Tìm thấy rương gần nhất!`)
        // Simple navigation without complex logic
        const goal = new goals.GoalNear(chestBlock[0].x, chestBlock[0].y, chestBlock[0].z, 2)
        bot.pathfinder.setGoal(goal)
      } else {
        bot.chat('🥺 Không tìm thấy rương gần đây')
      }
    } catch (error) {
      bot.chat('🛑 Lỗi tìm rương')
      console.log('Lỗi find chest:', error)
    }
  }
  
  function stopChestHunt() {
    autoChestHuntActive = false
    bot.chat('🛑 Tớ dừng tìm rương rồi!')
  }
  
  // ------------------ Cất đồ vào rương ------------------
  async function storeItemsInChest() {
    try {
      bot.chat('📦 Tớ sẽ cất đồ vào rương gần nhất nhé!')
      
      // Tìm rương gần nhất
      const chestBlock = bot.findBlock({
        matching: (block: any) => {
          return block.name.includes('chest') || 
                 block.name.includes('barrel') ||
                 block.name.includes('shulker')
        },
        maxDistance: 32
      })

      if (!chestBlock) {
        bot.chat('🥺 Tớ không tìm thấy rương nào gần để cất đồ...')
        return
      }

      // Di chuyển đến rương
      const goal = new goals.GoalNear(chestBlock.position.x, chestBlock.position.y, chestBlock.position.z, 1)
      bot.pathfinder.setGoal(goal)
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout'))
        }, 15000)
        
        const checkDistance = setInterval(async () => {
          const distance = bot.entity.position.distanceTo(chestBlock.position)
          
          if (distance <= 1.5) {
            clearInterval(checkDistance)
            clearTimeout(timeout)
            resolve(true)
          }
        }, 500)
      })

      // Mở rương và cất đồ
      await bot.lookAt(chestBlock.position, true)
      const chest = await bot.openChest(chestBlock)
      
      let storedCount = 0
      const itemsToKeep = ['sword', 'pickaxe', 'axe', 'shovel', 'hoe', 'helmet', 'chestplate', 'leggings', 'boots', 'bread', 'apple', 'meat', 'fish', 'potato', 'carrot', 'golden_apple', 'shield', 'bow', 'crossbow', 'fishing_rod']
      
      for (const item of bot.inventory.items()) {
        // Kiểm tra xem có phải đồ cần giữ không
        const shouldKeep = itemsToKeep.some(keepItem => 
          item.name.toLowerCase().includes(keepItem) || 
          item.displayName?.toLowerCase().includes(keepItem)
        )
        
        if (!shouldKeep) {
          try {
            await chest.deposit(item.type, null, item.count)
            storedCount++
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (error) {
            console.log('Lỗi cất đồ:', error)
          }
        }
      }
      
      chest.close()
      bot.chat(`✅ Đã cất ${storedCount} vật phẩm vào rương! Giữ lại đồ quan trọng cho cậu 💕`)
      
    } catch (error) {
      bot.chat('🥺 Có lỗi khi cất đồ...')
      console.log('Lỗi store items:', error)
    }
  }

  // ------------------ Auto Farm All ------------------
  function startAutoFarmAll() {
    autoFarmActive = true
    bot.chat('🗡️ Bắt đầu farm mob')
    
    const farmInterval = setInterval(async () => {
      if (!autoFarmActive) {
        clearInterval(farmInterval)
        return
      }

      try {
        const mob = bot.nearestEntity((entity: any) => {
          return entity.type === 'mob' && 
                 bot.entity.position.distanceTo(entity.position) < 10 &&
                 entity.displayName !== 'Enderman'
        })

        if (mob) {
          equipBestWeapon()
          bot.pvp.attack(mob)
        }
      } catch (error) {
        console.log('Lỗi auto farm:', error)
      }
    }, 200)
  }

  // ------------------ Auto Fishing Fixed ------------------
  async function startFishing() {
    try {
      stopAll()
      fishingActive = true
      autoFishingActive = true
      bot.chat('🎣 Tớ bắt đầu câu cá cho cậu nhé! 💕')
      
      const rod = bot.inventory.items().find(i => i.name.includes('fishing_rod'))
      if (!rod) {
        bot.chat('🥺 Tớ không có cần câu... cậu có thể cho tớ cần câu không?')
        fishingActive = false
        autoFishingActive = false
        return
      }

      // Tìm nước và di chuyển đến vị trí tốt
      const water = bot.findBlock({
        matching: (block: any) => block.name === 'water',
        maxDistance: 32
      })
      
      if (!water) {
        bot.chat('🥺 Tớ không tìm thấy nước gần đây...')
        fishingActive = false
        autoFishingActive = false
        return
      }

      // Di chuyển đến cạnh nước
      const goal = new goals.GoalNear(water.position.x, water.position.y + 1, water.position.z, 2)
      bot.pathfinder.setGoal(goal)
      await new Promise(resolve => setTimeout(resolve, 3000))
      bot.pathfinder.setGoal(null)

      // Trang bị cần câu và đảm bảo không đổi
      await bot.equip(rod, 'hand')
      
      // Bắt đầu câu cá liên tục
      await continuousFishing(water)
      
    } catch (error) {
      bot.chat('🥺 Có lỗi khi câu cá...')
      console.log('Lỗi fishing:', error)
      fishingActive = false
      autoFishingActive = false
    }
  }
  
  async function continuousFishing(water: any) {
    while (fishingActive && autoFishingActive) {
      try {
        // Đảm bảo vẫn cầm cần câu
        const currentItem = bot.heldItem
        if (!currentItem || !currentItem.name.includes('fishing_rod')) {
          const rod = bot.inventory.items().find(i => i.name.includes('fishing_rod'))
          if (rod) {
            await bot.equip(rod, 'hand')
          } else {
            bot.chat('🥺 Mất cần câu rồi...')
            fishingActive = false
            return
          }
        }
        
        // Nhìn về phía nước
        await bot.lookAt(water.position)
        await new Promise(resolve => setTimeout(resolve, 500))
        
        console.log('🎣 Thả câu...')
        
        // Sử dụng bot.fish() và chờ kết quả
        try {
          const caughtItem = await bot.fish()
          if (caughtItem) {
            const itemName = caughtItem.displayName || caughtItem.name || 'cá'
            bot.chat(`🐟 Tớ câu được ${itemName}! Cậu thấy tớ giỏi không? 💕`)
            console.log(`🎣 Câu được: ${itemName}`)
          }
        } catch (fishError) {
          console.log('Lỗi khi câu:', fishError)
        }
        
        // Nghỉ trước khi câu tiếp
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error) {
        if (fishingActive) {
          console.log('Lỗi trong chu trình câu cá:', error)
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }
    }
  }
  
  function stopFishing() {
    fishingActive = false
    autoFishingActive = false
    bot.chat('🛑 Tớ dừng câu cá rồi! 💕')
  }



  // Error handling
  bot.on('error', (err: any) => {
    console.log('🛑 Bot gặp lỗi:', err)
    
    // Don't auto-reconnect on certain critical errors
    if (err.message.includes('ENOTFOUND') || 
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('Invalid username') ||
        err.message.includes('ECONNRESET')) {
      console.log('❌ Lỗi nghiêm trọng, dừng auto-reconnect')
      return
    }
  })

  bot.on('end', (reason: string) => {
    console.log('💔 Bot đã ngắt kết nối:', reason)
    
    // Only auto-reconnect for specific reasons, with backoff
    if ((reason === 'socketClosed' || reason === 'disconnect.quitting') && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++
      const delay = Math.min(30000 * reconnectAttempts, 120000) // Exponential backoff, max 2 minutes
      console.log(`⏳ Sẽ thử kết nối lại sau ${delay/1000} giây... (Lần thử ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`)
      setTimeout(() => {
        console.log('🔄 Đang thử kết nối lại...')
        createBot()
      }, delay)
    } else {
      console.log('❌ Dừng auto-reconnect (quá số lần thử hoặc lý do ngắt kết nối không phù hợp)')
    }
  })
}

// Khởi tạo bot
createBot()
