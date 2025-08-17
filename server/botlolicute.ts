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
let isEating = false // Track trạng thái đang ăn
let selfDefenseActive = false // Track trạng thái tự vệ
let lastPlayerCommand = Date.now() // Track lần cuối player ra lệnh
let isFishing = false // Track trạng thái câu cá
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

  // Tăng MaxListeners để tránh warning
  bot.setMaxListeners(100)

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
    setupFishingEventListener()
    checkAutoSelfDefense()
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

  // ------------------ Self Defense ------------------
  function startSelfDefense() {
    selfDefenseActive = true
    stopAll() // Dừng các hoạt động khác
    bot.chat('🛡️ Chế độ tự vệ đã bật! Tớ sẽ đứng yên và giết quái gần.')
    
    const selfDefenseInterval = setInterval(() => {
      if (!selfDefenseActive) {
        clearInterval(selfDefenseInterval)
        return
      }

      try {
        const health = bot.health
        
        // Ăn thức ăn nếu máu yếu và không đang ăn
        if (health < 10 && !isEating) {
          const foodItems = bot.inventory.items().filter(item => 
            item.name.includes('bread') || 
            item.name.includes('apple') || 
            item.name.includes('meat') ||
            item.name.includes('fish') ||
            item.name.includes('potato') ||
            item.name.includes('carrot') ||
            item.name.includes('beef') ||
            item.name.includes('pork') ||
            item.name.includes('chicken')
          )
          
          if (foodItems.length > 0) {
            isEating = true
            bot.equip(foodItems[0], 'hand').then(() => {
              return bot.consume()
            }).then(() => {
              isEating = false
              console.log('🍞 Tự vệ: đã ăn để hồi máu')
            }).catch(() => {
              isEating = false
            })
          }
        }
        
        // Tìm mob gần để tấn công (trong phạm vi 8 block)
        const mob = bot.nearestEntity((entity: any) => {
          if (!entity || !entity.position) return false
          
          const distance = bot.entity.position.distanceTo(entity.position)
          if (distance > 8) return false
          
          // Các loại mob thù địch
          const hostileMobs = ['zombie', 'skeleton', 'creeper', 'spider', 'witch', 'pillager', 'vindicator', 'evoker', 'husk', 'stray', 'phantom', 'drowned']
          const mobName = entity.name ? entity.name.toLowerCase() : ''
          const displayName = entity.displayName ? entity.displayName.toLowerCase() : ''
          
          const isHostile = hostileMobs.some(mobType => 
            mobName.includes(mobType) || displayName.includes(mobType)
          )
          
          const isMobType = entity.type === 'mob' && 
                           !mobName.includes('villager') && 
                           !mobName.includes('iron_golem') && 
                           !displayName.includes('enderman')
          
          return isHostile || isMobType
        })

        if (mob && health > 6 && !isEating) {
          equipBestWeapon()
          bot.setControlState('sprint', false) // Không chạy, đứng yên
          bot.pvp.attack(mob)
          console.log(`🛡️ Tự vệ: tấn công ${mob.name || mob.displayName} cách ${Math.round(bot.entity.position.distanceTo(mob.position))} blocks`)
        } else {
          bot.pvp.stop()
        }
        
      } catch (error) {
        console.log('Lỗi tự vệ:', error)
      }
    }, 1000)
  }

  function stopSelfDefense() {
    selfDefenseActive = false
    bot.pvp.stop()
    bot.chat('🛡️ Đã tắt chế độ tự vệ.')
  }

  // Auto tự vệ sau 3 phút không có lệnh
  function checkAutoSelfDefense() {
    setInterval(() => {
      const timeSinceLastCommand = Date.now() - lastPlayerCommand
      
      // Nếu không có lệnh nào trong 3 phút và không đang hoạt động gì
      if (timeSinceLastCommand > 180000 && // 3 phút
          !autoMineActive && 
          !autoFarmActive && 
          !isFollowing && 
          !isProtecting && 
          !autoFishingActive && 
          !selfDefenseActive) {
        
        console.log('🛡️ Auto tự vệ: Không có hoạt động trong 3 phút, bật chế độ tự vệ')
        startSelfDefense()
      }
    }, 30000) // Kiểm tra mỗi 30 giây
  }

  // ------------------ Chat Commands ------------------
  bot.on('chat', async (username: string, message: string) => {
    console.log(`💬 Chat nhận được: [${username}]: ${message}`)
    
    if (username === bot.username || username === 'server' || username === 'console') {
      return
    }

    // Update last command time
    lastPlayerCommand = Date.now()

    const cleanMessage = message.toLowerCase().trim()
    console.log(`🔍 Xử lý lệnh: "${cleanMessage}"`)

    // Xử lý các lệnh chat
    if (cleanMessage.includes('theo')) {
      startFollowingPlayer(username)
    } else if (cleanMessage.includes('bảo vệ')) {
      startProtectingPlayer(username)
    } else if (cleanMessage.includes('tự vệ') || cleanMessage.includes('self defense')) {
      startSelfDefense()
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
      startAutoFish()
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

      // Nếu quá xa thì teleport
      if (distance > 15) {
        try {
          bot.chat(`/tp ${targetPlayer.username}`)
        } catch (e) {
          // Nếu không thể tp, thì đào đường và di chuyển
          bot.pathfinder.setGoal(new goals.GoalBlock(targetPos.x, targetPos.y, targetPos.z))
          
          // Cho phép đập mọi khối cản
          const movements = new Movements(bot)
          movements.canDig = true
          movements.allow1by1towers = true
          movements.allowParkour = true
          movements.allowSprinting = true
          movements.allowEntityDetection = true
          movements.allowFreeMotion = true
          movements.canOpenDoors = true
          
          bot.pathfinder.setMovements(movements)
        }
        return
      }

      // Giữ khoảng cách 2 block và luôn theo dõi
      try {
        bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer, 2), true)
      } catch (error) {
        console.log('Lỗi follow:', error)
      }
    }, 300)
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

      // Kiểm tra máu sau khi tấn công và ăn thức ăn nếu cần
      const health = bot.health
      const food = bot.food
      
      // Chỉ ăn khi không có mob gần hoặc máu rất thấp
      const hasNearbyMob = bot.nearestEntity((entity: any) => {
        if (!entity || !entity.position) return false
        const distance = bot.entity.position.distanceTo(entity.position)
        return distance <= 6 && entity.type === 'mob' && !entity.name?.includes('villager')
      })
      
      if ((health < 8 || food < 8) && (!hasNearbyMob || health < 6)) {
        const foodItems = bot.inventory.items().filter(item => 
          item.name.includes('bread') || 
          item.name.includes('apple') || 
          item.name.includes('meat') ||
          item.name.includes('fish') ||
          item.name.includes('potato') ||
          item.name.includes('carrot') ||
          item.name.includes('beef') ||
          item.name.includes('pork') ||
          item.name.includes('chicken')
        )
        
        if (foodItems.length > 0 && !isEating && !bot.consume.inProgress) {
          try {
            isEating = true
            bot.pvp.stop() // Dừng tấn công để ăn
            await bot.equip(foodItems[0], 'hand')
            await bot.consume()
            console.log('🍞 Bot đã ăn xong để hồi máu')
            isEating = false
          } catch (error) {
            console.log('Lỗi ăn thức ăn:', error)
            isEating = false
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

      // Logic tấn công thông minh
      if (distance > 9) {
        // Quá xa player, ưu tiên đi theo
        bot.pvp.stop()
        bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer, 2), true)
      } else if (mob && distance <= 9 && health > 6 && !isEating) { 
        // Có mob gần và máu đủ, tấn công
        equipBestWeapon()
        bot.setControlState('sprint', true)
        bot.pvp.attack(mob)
        console.log(`⚔️ Đang tấn công ${mob.name || mob.displayName} cách ${Math.round(bot.entity.position.distanceTo(mob.position))} blocks`)
      } else if (health <= 6) {
        // Máu yếu, dừng tấn công và ưu tiên ăn
        bot.pvp.stop()
        bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer, 2), true)
      } else {
        // Không có mob hoặc không cần tấn công
        bot.pvp.stop()
        if (distance > 6) {
          bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer, 2), true)
        }
      }
    }, 800) // Tăng interval để giảm load và spam
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
    selfDefenseActive = false
    isFishing = false
    
    if (bot && bot.pathfinder) {
      bot.pathfinder.setGoal(null)
    }
    if (bot && bot.pvp) {
      bot.pvp.stop()
    }
    
    // Chỉ chat nếu bot còn kết nối
    if (bot && bot._client && bot._client.state === 'play') {
      bot.chat(`🛑 Được rồi cậu, tớ dừng tất cả hoạt động đây! 💕`)
    }
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
      if (!autoMineActive || !bot || !bot.entity) {
        clearInterval(mineInterval)
        return
      }

      try {
        // Trang bị pickaxe tốt nhất
        const currentItem = bot.heldItem
        if (!currentItem || !currentItem.name.includes('pickaxe')) {
          equipBestTool()
          await new Promise(resolve => setTimeout(resolve, 300))
        }
        
        // Tìm ore gần nhất
        const ore = bot.findBlock({
          matching: (block: any) => block.name.includes(oreName),
          maxDistance: 128
        })

        if (ore) {
          console.log(`⛏️ Tìm thấy ${oreName} tại ${ore.position}`)
          
          // Kiểm tra khoảng cách đến ore
          const distance = bot.entity.position.distanceTo(ore.position)
          
          if (distance > 4.5) {
            // Thiết lập movements cho di chuyển với khả năng đào
            const movements = new Movements(bot)
            movements.canDig = true // Cho phép đào block cản đường
            movements.digCost = 1 // Cost thấp để đào block
            movements.placeCost = 1 // Cost thấp để đặt block
            movements.allow1by1towers = true
            movements.allowParkour = true
            movements.allowSprinting = true
            movements.allowEntityDetection = true
            movements.blocksCantBreak = new Set() // Không cấm đào block nào
            bot.pathfinder.setMovements(movements)
            
            // Di chuyển đến gần ore
            const goal = new goals.GoalNear(ore.position.x, ore.position.y, ore.position.z, 1)
            bot.pathfinder.setGoal(goal)
            
            // Đợi di chuyển xong hoặc timeout
            let moveTimeout = 0
            while (bot.entity.position.distanceTo(ore.position) > 4.5 && moveTimeout < 60) {
              await new Promise(resolve => setTimeout(resolve, 100))
              moveTimeout++
            }
            
            // Dừng di chuyển
            bot.pathfinder.setGoal(null)
            await new Promise(resolve => setTimeout(resolve, 200))
          }
          
          try {
            // Kiểm tra lại khoảng cách và đào
            const finalDistance = bot.entity.position.distanceTo(ore.position)
            if (finalDistance <= 4.5) {
              // Nhìn về phía ore trước khi đào
              await bot.lookAt(ore.position.clone().add(0.5, 0.5, 0.5))
              await new Promise(resolve => setTimeout(resolve, 100))
              
              await bot.dig(ore)
              console.log(`✅ Đã đào xong ${oreName}`)
              
              // Thu thập item rơi ra
              setTimeout(() => {
                const entities = Object.values(bot.entities)
                for (const entity of entities) {
                  if (entity.name === 'item' && entity.position && 
                      bot.entity.position.distanceTo(entity.position) < 5) {
                    bot.collectBlock.collect(entity).catch(() => {})
                  }
                }
              }, 500)
              
            } else {
              console.log(`❌ Quá xa để đào ${oreName} (khoảng cách: ${finalDistance.toFixed(2)})`)
            }
          } catch (digError) {
            console.log('Lỗi đào:', digError)
          }
        } else {
          console.log(`🔍 Không tìm thấy ${oreName} trong phạm vi 128 block`)
          // Thử di chuyển xung quanh để tìm ore
          const randomX = Math.floor(Math.random() * 21) - 10 // -10 to 10
          const randomZ = Math.floor(Math.random() * 21) - 10
          const currentPos = bot.entity.position
          const goal = new goals.GoalXZ(currentPos.x + randomX, currentPos.z + randomZ)
          bot.pathfinder.setGoal(goal)
        }
      } catch (error) {
        console.log('Lỗi auto mine:', error)
        // Reset pathfinder nếu có lỗi
        bot.pathfinder.setGoal(null)
      }
    }, 3000) // Giảm interval để hoạt động nhanh hơn
  }

  // ------------------ Simple Chest Hunt ------------------
  async function smartChestHunt() {
    try {
      stopAll()
      autoChestHuntActive = true
      bot.chat('🗃️ Bắt đầu tìm và lụm rương trong phạm vi 128 block!')
      
      const chestHuntInterval = setInterval(async () => {
        if (!autoChestHuntActive) {
          clearInterval(chestHuntInterval)
          return
        }

        try {
          // Tìm tất cả rương trong phạm vi 128 block
          const chest = bot.findBlock({
            matching: (block: any) => {
              return block.name.includes('chest') || 
                     block.name.includes('barrel') ||
                     block.name.includes('shulker')
            },
            maxDistance: 128
          })

          if (chest) {
            const chestId = `${chest.position.x}_${chest.position.y}_${chest.position.z}`
            
            // Kiểm tra xem rương này đã loot chưa
            if (lootedChests.has(chestId)) {
              console.log(`📦 Rương tại ${chest.position} đã được loot, tìm rương khác...`)
              
              // Tìm rương khác chưa loot
              const allChests = bot.findBlocks({
                matching: (block: any) => {
                  return block.name.includes('chest') || 
                         block.name.includes('barrel') ||
                         block.name.includes('shulker')
                },
                maxDistance: 128,
                count: 50
              })
              
              // Tìm rương chưa loot
              let foundNewChest = false
              for (const chestPos of allChests) {
                const newChestId = `${chestPos.x}_${chestPos.y}_${chestPos.z}`
                if (!lootedChests.has(newChestId)) {
                  const newChest = bot.blockAt(chestPos)
                  if (newChest) {
                    await lootChest(newChest, newChestId)
                    foundNewChest = true
                    break
                  }
                }
              }
              
              if (!foundNewChest) {
                bot.chat('✅ Đã lụm hết tất cả rương trong khu vực!')
                autoChestHuntActive = false
                clearInterval(chestHuntInterval)
              }
              
              return
            }

            await lootChest(chest, chestId)
            
          } else {
            console.log('🔍 Không tìm thấy rương nào trong phạm vi 128 block')
            bot.chat('🔍 Không tìm thấy rương nào gần đây, tớ sẽ di chuyển tìm!')
            
            // Di chuyển ngẫu nhiên để tìm rương
            const randomX = Math.floor(Math.random() * 41) - 20 // -20 to 20
            const randomZ = Math.floor(Math.random() * 41) - 20
            const currentPos = bot.entity.position
            const goal = new goals.GoalXZ(currentPos.x + randomX, currentPos.z + randomZ)
            bot.pathfinder.setGoal(goal)
          }
          
        } catch (error) {
          console.log('Lỗi trong chest hunt loop:', error)
        }
      }, 2000)
      
    } catch (error) {
      bot.chat('🥺 Có lỗi khi tìm rương...')
      console.log('Lỗi chest hunt:', error)
      autoChestHuntActive = false
    }
  }

  async function lootChest(chest: any, chestId: string) {
    try {
      console.log(`📦 Tìm thấy rương tại ${chest.position}`)
      
      // Di chuyển đến áp sát rương
      const distance = bot.entity.position.distanceTo(chest.position)
      
      if (distance > 3) {
        const movements = new Movements(bot)
        movements.canDig = true
        movements.allow1by1towers = true
        movements.allowParkour = true
        movements.allowSprinting = true
        bot.pathfinder.setMovements(movements)
        
        // Di chuyển sát rương
        const goal = new goals.GoalBlock(chest.position.x, chest.position.y, chest.position.z, 1)
        bot.pathfinder.setGoal(goal)
        
        // Đợi di chuyển xong
        let moveTimeout = 0
        while (bot.entity.position.distanceTo(chest.position) > 3 && moveTimeout < 100) {
          await new Promise(resolve => setTimeout(resolve, 100))
          moveTimeout++
        }
        
        bot.pathfinder.setGoal(null)
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      
      // Kiểm tra khoảng cách cuối cùng
      const finalDistance = bot.entity.position.distanceTo(chest.position)
      if (finalDistance <= 4) {
        // Nhìn về phía rương
        await bot.lookAt(chest.position.clone().add(0.5, 0.5, 0.5))
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Mở rương
        const chestWindow = await bot.openChest(chest)
        
        if (chestWindow) {
          bot.chat(`📦 Đã mở rương! Có ${chestWindow.slots.length} slot`)
          
          // Lấy tất cả item từ rương
          const promises = []
          for (let i = 0; i < chestWindow.slots.length; i++) {
            const item = chestWindow.slots[i]
            if (item) {
              promises.push(
                bot.moveSlotItem(i, bot.inventory.firstEmptySlotRange(0, 35))
                  .catch(() => {}) // Ignore errors nếu inventory đầy
              )
            }
          }
          
          await Promise.all(promises)
          
          // Đóng rương
          bot.closeWindow(chestWindow)
          
          // Đánh dấu rương đã loot
          lootedChests.add(chestId)
          
          bot.chat(`✅ Đã lụm xong rương! Tổng cộng đã loot ${lootedChests.size} rương`)
          console.log(`✅ Đã loot rương tại ${chest.position}`)
          
        } else {
          console.log('❌ Không thể mở rương')
        }
        
      } else {
        console.log(`❌ Quá xa để mở rương (khoảng cách: ${finalDistance.toFixed(2)})`)
      }
      
    } catch (error) {
      console.log('Lỗi khi loot rương:', error)
      // Vẫn đánh dấu là đã thử để tránh lặp lại
      lootedChests.add(chestId)
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
    bot.chat('🗡️ Bắt đầu farm tất cả mob')
    
    const farmInterval = setInterval(async () => {
      if (!autoFarmActive) {
        clearInterval(farmInterval)
        return
      }

      try {
        // Trang bị vũ khí tốt nhất
        equipBestWeapon()
        
        // Tìm mob gần nhất
        const mob = bot.nearestEntity((entity: any) => {
          if (!entity || !entity.position) return false
          
          const distance = bot.entity.position.distanceTo(entity.position)
          if (distance > 16) return false // Tăng phạm vi tìm kiếm
          
          // Các loại mob cần farm
          const farmableMobs = [
            'zombie', 'skeleton', 'creeper', 'spider', 'witch', 'slime',
            'cow', 'pig', 'chicken', 'sheep', 'rabbit', 'horse',
            'zombie_villager', 'husk', 'stray', 'phantom', 'drowned',
            'pillager', 'vindicator', 'evoker', 'ravager'
          ]
          
          const mobName = entity.name ? entity.name.toLowerCase() : ''
          const displayName = entity.displayName ? entity.displayName.toLowerCase() : ''
          
          // Loại trừ các mob không nên farm
          if (displayName.includes('enderman') || 
              mobName.includes('villager') || 
              mobName.includes('iron_golem') ||
              mobName.includes('wolf') ||
              entity.username) { // Không farm player
            return false
          }
          
          // Kiểm tra theo tên
          const isFarmable = farmableMobs.some(mobType => 
            mobName.includes(mobType) || displayName.includes(mobType)
          )
          
          // Hoặc kiểm tra theo type
          const isMobType = entity.type === 'mob'
          
          return isFarmable || isMobType
        })

        if (mob) {
          console.log(`🗡️ Tấn công ${mob.name || mob.displayName} (${Math.round(bot.entity.position.distanceTo(mob.position))} blocks)`)
          
          // Di chuyển đến gần mob nếu cần
          const distance = bot.entity.position.distanceTo(mob.position)
          if (distance > 6) {
            const movements = new Movements(bot)
            movements.canDig = false // Không đào khi farm
            movements.allowSprinting = true
            movements.allowParkour = true
            bot.pathfinder.setMovements(movements)
            
            bot.pathfinder.setGoal(new goals.GoalFollow(mob, 2))
            
            // Đợi di chuyển một chút
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          
          // Tấn công mob
          bot.setControlState('sprint', true)
          bot.pvp.attack(mob)
          
          // Thu thập item sau khi giết
          setTimeout(() => {
            const entities = Object.values(bot.entities)
            for (const entity of entities) {
              if (entity.name === 'item' && entity.position && 
                  bot.entity.position.distanceTo(entity.position) < 8) {
                bot.collectBlock.collect(entity).catch(() => {})
              }
            }
          }, 1000)
          
        } else {
          // Không có mob gần, di chuyển ngẫu nhiên để tìm
          if (Math.random() < 0.3) { // 30% cơ hội di chuyển
            const randomX = Math.floor(Math.random() * 21) - 10
            const randomZ = Math.floor(Math.random() * 21) - 10
            const currentPos = bot.entity.position
            const goal = new goals.GoalXZ(currentPos.x + randomX, currentPos.z + randomZ)
            bot.pathfinder.setGoal(goal)
          }
        }
      } catch (error) {
        console.log('Lỗi auto farm:', error)
        bot.pathfinder.setGoal(null)
        bot.pvp.stop()
      }
    }, 500) // Tăng tốc độ farm
  }

  // ------------------ Auto Fishing với Event Listener ------------------
  function setupFishingEventListener() {
    // Lắng nghe world_event để phát hiện cá cắn
    bot._client.on('world_event', (packet: any) => {
      console.log('[DEBUG] world_event nhận được:', packet);
      
      // Kiểm tra nếu đây là event cá cắn (fishing rod pull)
      if (isFishing && packet.eventId === 1022) { // 1022 là event fishing rod pull
        console.log('🐟 Cá cắn – kéo cần!');
        bot._client.write('use_item', { hand: 0 });
        isFishing = false;
        setTimeout(() => {
          if (autoFishingActive) {
            startFishing();
          }
        }, 2000);
      }
    });
  }

  async function startFishing() {
    if (!autoFishingActive) return

    try {
      // Tìm cần câu
      const fishingRod = bot.inventory.items().find(item => item.name.includes('fishing_rod'))
      if (!fishingRod) {
        bot.chat('🎣 Tớ không có cần câu.')
        stopFishing()
        return
      }

      await bot.equip(fishingRod, 'hand')
      
      // Tìm nước gần đó
      const water = bot.findBlock({
        matching: (block: any) => block.name === 'water',
        maxDistance: 10
      })

      if (!water) {
        bot.chat('💧 Không tìm thấy nước gần đây để câu cá.')
        stopFishing()
        return
      }

      // Nhìn về phía nước và ném cần
      await bot.lookAt(water.position.clone().add(0.5, 0.5, 0.5))
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Ném cần câu
      isFishing = true
      bot.activateItem()
      console.log('🎣 Đã thả cần xuống nước, đợi cá cắn...')
      
    } catch (error) {
      console.log('Lỗi câu cá:', error)
      isFishing = false
      if (autoFishingActive) {
        setTimeout(() => startFishing(), 3000)
      }
    }
  }

  function startAutoFish() {
    autoFishingActive = true
    fishingActive = true
    bot.chat('🎣 Bắt đầu câu cá tự động với event listener!')
    startFishing()
  }


  
  function stopFishing() {
    fishingActive = false
    autoFishingActive = false
    isFishing = false
    if (bot && bot._client && bot._client.state === 'play') {
      bot.chat('🛑 Tớ dừng câu cá rồi! 💕')
    }
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
    
    // Clear all activities when disconnected
    autoMineActive = false
    autoFarmActive = false
    autoChestHuntActive = false
    isEating = false
    stopAll()
    
    // Only auto-reconnect for specific reasons, with backoff
    if ((reason === 'socketClosed' || reason === 'disconnect.quitting') && 
        reason !== 'keepAliveError' && 
        reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
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
