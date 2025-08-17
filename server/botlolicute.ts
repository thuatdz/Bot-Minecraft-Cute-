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
let autoFarmActive = false
let isFollowing = false
let isProtecting = false
let isEating = false // Track trạng thái đang ăn
let lastEatTime = 0 // Track lần cuối ăn để tránh spam
let selfDefenseActive = false // Track trạng thái tự vệ
let lastPlayerCommand = Date.now() // Track lần cuối player ra lệnh
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
    startStatusUpdates()
    autoEatSetup()
    collectNearbyItems()
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

  async function equipBestTool() {
    try {
      const pickaxes = bot.inventory.items().filter(item => item.name.includes('pickaxe'))

      if (pickaxes.length > 0) {
        const priority = ['netherite', 'diamond', 'iron', 'stone', 'wooden']
        let bestPickaxe = pickaxes[0]

        for (const material of priority) {
          const pickaxe = pickaxes.find(p => p.name.includes(material))
          if (pickaxe) {
            bestPickaxe = pickaxe
            break
          }
        }

        if (!bot.heldItem || bot.heldItem.name !== bestPickaxe.name) {
          await bot.equip(bestPickaxe, 'hand')
          console.log(`🔨 Trang bị ${bestPickaxe.name}`)
        }
        return true
      } else {
        console.log('Không có pickaxe nào để trang bị.')
        return false
      }
    } catch (error) {
      console.log('Lỗi trang bị tool:', error)
      return false
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

  // ------------------ Random Status Updates ------------------
  function startStatusUpdates() {
    setInterval(() => {
      // Removed flirting, now only provides status updates when needed
      if (Math.random() < 0.1) { // 10% chance every 30s for status
        const statusMessages = [
          "🤖 Tớ đang hoạt động bình thường!",
          "⚡ Hệ thống bot stable!",
          "🔋 Bot ready cho commands!",
          "🌟 Mọi thứ OK!"
        ]
        const randomMessage = statusMessages[Math.floor(Math.random() * statusMessages.length)]
        console.log(`Status: ${randomMessage}`)
      }
    }, 30000) // 30 giây một lần
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
        const now = Date.now()
        if (health < 8 && !isEating && bot.food < 18 && (now - lastEatTime > 3000)) {
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
            
            const eatFood = async () => {
              try {
                await bot.equip(foodItems[0], 'hand')
                
                // Timeout để tránh hanging
                const eatPromise = bot.consume()
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Eating timeout')), 3000)
                )
                
                await Promise.race([eatPromise, timeoutPromise])
                lastEatTime = Date.now()
                console.log(`🍞 Tự vệ: đã ăn ${foodItems[0].name}`)
                
                // Đợi 2 giây trước khi có thể ăn lại
                setTimeout(() => { isEating = false }, 2000)
                
              } catch (error) {
                console.log('⚠️ Tự vệ: không thể ăn, bỏ qua')
                isEating = false
              }
            }
            
            eatFood()
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
          !autoFarmActive && 
          !isFollowing && 
          !isProtecting && 
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
    console.log(`🔍 Xử lý lệnh: "${cleanMessage}" từ player: ${username}`)

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
    } else if (cleanMessage.includes('cất đồ')) {
      storeItemsInChest()
    } else if (cleanMessage.includes('auto farm all') || cleanMessage.includes('farm')) {
      startAutoFarmAll()
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
    // Tìm player entity với nhiều cách khác nhau
    let playerEntity = bot.players[username]?.entity
    
    // Nếu không tìm thấy, thử tìm theo tên không có dấu chấm
    if (!playerEntity && username.startsWith('.')) {
      const nameWithoutDot = username.substring(1)
      playerEntity = bot.players[nameWithoutDot]?.entity
    }
    
    // Nếu vẫn không tìm thấy, thử tìm theo tên có dấu chấm
    if (!playerEntity && !username.startsWith('.')) {
      const nameWithDot = '.' + username
      playerEntity = bot.players[nameWithDot]?.entity
    }
    
    // Tìm trong tất cả players nếu vẫn không thấy
    if (!playerEntity) {
      const allPlayers = Object.keys(bot.players)
      console.log(`🔍 Tìm kiếm player: ${username} trong danh sách:`, allPlayers)
      
      // Tìm player gần đúng
      for (const playerName of allPlayers) {
        if (playerName.toLowerCase().includes(username.toLowerCase()) || 
            username.toLowerCase().includes(playerName.toLowerCase())) {
          playerEntity = bot.players[playerName]?.entity
          console.log(`✅ Tìm thấy player tương ứng: ${playerName}`)
          break
        }
      }
    }

    if (!playerEntity) {
      bot.chat(`🥺 Cậu phải ở trong tầm nhìn của tớ thì tớ mới đi theo được! Tên đầy đủ của cậu là gì?`)
      console.log(`❌ Không tìm thấy player: ${username}`)
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
    // Tìm player entity với nhiều cách khác nhau
    let playerEntity = bot.players[username]?.entity
    
    // Nếu không tìm thấy, thử tìm theo tên không có dấu chấm
    if (!playerEntity && username.startsWith('.')) {
      const nameWithoutDot = username.substring(1)
      playerEntity = bot.players[nameWithoutDot]?.entity
    }
    
    // Nếu vẫn không tìm thấy, thử tìm theo tên có dấu chấm
    if (!playerEntity && !username.startsWith('.')) {
      const nameWithDot = '.' + username
      playerEntity = bot.players[nameWithDot]?.entity
    }
    
    // Tìm trong tất cả players nếu vẫn không thấy
    if (!playerEntity) {
      const allPlayers = Object.keys(bot.players)
      console.log(`🔍 Tìm kiếm player: ${username} trong danh sách:`, allPlayers)
      
      // Tìm player gần đúng
      for (const playerName of allPlayers) {
        if (playerName.toLowerCase().includes(username.toLowerCase()) || 
            username.toLowerCase().includes(playerName.toLowerCase())) {
          playerEntity = bot.players[playerName]?.entity
          console.log(`✅ Tìm thấy player tương ứng: ${playerName}`)
          break
        }
      }
    }

    if (!playerEntity) {
      bot.chat(`🥺 Cậu phải ở gần tớ thì tớ mới bảo vệ được! Tên đầy đủ của cậu là gì?`)
      console.log(`❌ Không tìm thấy player: ${username}`)
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

      // Kiểm tra máu và food sau khi tấn công
      const health = bot.health
      const food = bot.food

      // Chỉ ăn khi thực sự cần và không đang ăn
      const hasNearbyMob = bot.nearestEntity((entity: any) => {
        if (!entity || !entity.position) return false
        const distance = bot.entity.position.distanceTo(entity.position)
        return distance <= 6 && entity.type === 'mob' && !entity.name?.includes('villager')
      })

      // Cải thiện logic ăn: chỉ ăn khi thực sự cần và không spam
      const now = Date.now()
      const shouldEat = (health < 6 || food < 6) && !isEating && food < 20 && (now - lastEatTime > 3000)
      const canEatSafely = !hasNearbyMob || health < 4

      if (shouldEat && canEatSafely) {
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
          try {
            isEating = true
            bot.pvp.stop() // Dừng tấn công để ăn
            
            // Sắp xếp thức ăn theo độ ưu tiên
            const sortedFood = foodItems.sort((a, b) => {
              const aValue = a.name.includes('bread') ? 3 : a.name.includes('meat') ? 2 : 1
              const bValue = b.name.includes('bread') ? 3 : b.name.includes('meat') ? 2 : 1
              return bValue - aValue
            })

            await bot.equip(sortedFood[0], 'hand')
            
            // Thêm timeout để tránh hanging
            const eatPromise = bot.consume()
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Eating timeout')), 3000)
            )
            
            await Promise.race([eatPromise, timeoutPromise])
            lastEatTime = Date.now()
            console.log(`🍞 Bot đã ăn ${sortedFood[0].name} - HP: ${bot.health}/20, Food: ${bot.food}/20`)
            
            // Đợi một chút trước khi có thể ăn lại
            setTimeout(() => { isEating = false }, 2000)
            
          } catch (error) {
            console.log('⚠️ Không thể ăn thức ăn hiện tại, thử lại sau')
            isEating = false
          }
        } else {
          // Không có thức ăn
          if (health < 4) {
            console.log('🥺 Bot đang thiếu thức ăn và máu yếu!')
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

  // Trang bị vũ khí tốt nhất
  function equipBestWeapon() {
    try {
      const weapons = bot.inventory.items().filter(item => 
        item.name.includes('sword') || 
        item.name.includes('axe') ||
        item.name.includes('trident')
      )

      if (weapons.length > 0) {
        // Ưu tiên netherite -> diamond -> iron -> stone -> wood
        const priority = ['netherite', 'diamond', 'iron', 'stone', 'wooden']
        let bestWeapon = weapons[0]

        for (const material of priority) {
          const weapon = weapons.find(w => w.name.includes(material))
          if (weapon) {
            bestWeapon = weapon
            break
          }
        }

        if (!bot.heldItem || bot.heldItem.name !== bestWeapon.name) {
          bot.equip(bestWeapon, 'hand').catch(() => {})
        }
      }
    } catch (error) {
      console.log('Lỗi trang bị weapon:', error)
    }
  }

  function stopAll() {
    stopFollowing()
    stopProtecting()
    targetPlayer = null
    autoFarmActive = false
    selfDefenseActive = false

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
    
    // Tìm player entity với nhiều cách khác nhau
    let playerEntity = bot.players[username]?.entity
    
    // Nếu không tìm thấy, thử tìm theo tên không có dấu chấm
    if (!playerEntity && username.startsWith('.')) {
      const nameWithoutDot = username.substring(1)
      playerEntity = bot.players[nameWithoutDot]?.entity
    }
    
    // Nếu vẫn không tìm thấy, thử tìm theo tên có dấu chấm
    if (!playerEntity && !username.startsWith('.')) {
      const nameWithDot = '.' + username
      playerEntity = bot.players[nameWithDot]?.entity
    }
    
    // Tìm trong tất cả players nếu vẫn không thấy
    if (!playerEntity) {
      const allPlayers = Object.keys(bot.players)
      for (const playerName of allPlayers) {
        if (playerName.toLowerCase().includes(username.toLowerCase()) || 
            username.toLowerCase().includes(playerName.toLowerCase())) {
          playerEntity = bot.players[playerName]?.entity
          break
        }
      }
    }

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
      await bot.pathfinder.goto(goal)

      // Mở rương và cất đồ
      await bot.lookAt(chestBlock.position, true)
      const chest = await bot.openChest(chestBlock)

      let storedCount = 0
      const itemsToKeep = ['sword', 'pickaxe', 'axe', 'shovel', 'hoe', 'helmet', 'chestplate', 'leggings', 'boots', 'bread', 'apple', 'meat', 'fish', 'potato', 'carrot', 'golden_apple', 'shield', 'bow', 'crossbow', 'fishing_rod']

      for (const item of bot.inventory.items()) {
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
          if (distance > 10) return false // Tăng phạm vi tìm kiếm lên 10 blocks

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
    autoFarmActive = false
    isEating = false
    stopAll()

    // Only auto-reconnect for specific reasons, with backoff
    if ((reason === 'socketClosed' || reason === 'disconnect.quitting' || reason === 'disconnect.timeout') && 
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
