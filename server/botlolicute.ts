import mineflayer, { Bot } from 'mineflayer'
import { pathfinder, Movements } from 'mineflayer-pathfinder'
import * as net from 'net'

// Dynamic import for goals
let goals: any = null
const initGoals = async () => {
  if (!goals) {
    const pathfinderModule = await import('mineflayer-pathfinder')
    goals = pathfinderModule.goals
  }
  return goals
}
// import autoEat from 'mineflayer-auto-eat'
import { plugin as pvp } from 'mineflayer-pvp'
import { plugin as collectBlock } from 'mineflayer-collectblock'
import { Vec3 } from 'vec3'

const apiKey = "" // Gemini AI key

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

  // ------------------ Flirting / Chat AI ------------------
  function startFlirting() {
    setInterval(async () => {
      if (!apiKey) return

      const prompt = "Bạn là bot AI dễ thương Minecraft tên botlolicute, gửi tin nhắn thả thính ngọt ngào, xưng 'tớ', gọi 'cậu', dùng emoji."
      
      try {
        const payload = {
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        const result = await response.json()
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text

        if (text) {
          bot.chat(text.substring(0, 100)) // Limit message length
        }
      } catch (error) {
        console.error('Lỗi thả thính:', error)
      }
    }, 30000) // 30 giây một lần
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
    } else if (cleanMessage.startsWith('auto mine')) {
      const oreName = cleanMessage.split(' ')[2]
      if (oreName) startAutoMine(oreName)
    } else if (cleanMessage.includes('tìm rương')) {
      lootNearbyChest()
    } else if (cleanMessage.includes('auto farm all')) {
      startAutoFarmAll()
    } else if (cleanMessage.includes('auto câu')) {
      startFishing()
    } else if (cleanMessage.includes('botlolicute') || cleanMessage.startsWith('bot ơi')) {
      handleChatWithAI(username, cleanMessage)
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
      const systemPrompt = `Bạn là bot AI dễ thương tên botlolicute trong Minecraft. Trả lời ngọt ngão, xưng "tớ", gọi "cậu". Chỉ trả lời trực tiếp không cần dẫn nhập.`

      const payload = {
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }]
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text

      if (generatedText) {
        bot.chat(generatedText.substring(0, 100))
      } else {
        bot.chat(`Tớ xin lỗi, tớ đang bận, cậu thử lại sau nhé! 😥`)
      }
    } catch (error) {
      bot.chat(`Ôi, tớ không hiểu lắm. Cậu có thể nói lại không? 😥`)
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
        const g = await initGoals()
        bot.pathfinder.setGoal(new g.GoalBlock(targetPos.x, targetPos.y, targetPos.z))
        return
      }

      // Giữ khoảng cách 2 block
      const g = await initGoals()
      bot.pathfinder.setGoal(new g.GoalFollow(targetPlayer, 2), true)
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

      // Tìm mob gần để tấn công
      const mob = bot.nearestEntity((entity: any) => {
        const isHostile = entity.type === 'mob' && entity.displayName !== 'Enderman'
        const isVindicator = entity.name === 'vindicator'
        const isPillager = entity.name === 'pillager'
        return (isHostile || isVindicator || isPillager) && 
               bot.entity.position.distanceTo(entity.position) < 10
      })

      if (mob) {
        equipBestWeapon()
        bot.setControlState('sprint', true)
        bot.pvp.attack(mob)
      } else {
        bot.pvp.stop()
        if (distance > 6) {
          const g = await initGoals()
      bot.pathfinder.setGoal(new g.GoalFollow(targetPlayer, 2), true)
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
    bot.chat(`🛑 Được rồi, tớ dừng lại đây!`)
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
        const ore = bot.findBlock({
          matching: (block: any) => block.name === oreName,
          maxDistance: 32
        })

        if (ore) {
          bot.pathfinder.setGoal(new goals.GoalBlock(ore.position.x, ore.position.y, ore.position.z))
          bot.dig(ore).catch(() => {})
        }
      } catch (error) {
        console.log('Lỗi auto mine:', error)
      }
    }, 500)
  }

  // ------------------ Loot Chest ------------------
  async function lootNearbyChest() {
    try {
      const chestBlock = bot.findBlock({
        matching: (block: any) => block.name.includes('chest'),
        maxDistance: 32
      })

      if (!chestBlock) {
        bot.chat('🥺 Không thấy rương')
        return
      }

      const chest = await bot.openChest(chestBlock)
      for (const slot of chest.containerItems()) {
        if (slot) {
          await chest.withdraw(slot.type, null, slot.count)
        }
      }
      chest.close()
      bot.chat('📦 Đã loot xong rương')
    } catch (error) {
      bot.chat('🛑 Không thể mở rương')
      console.log('Lỗi loot chest:', error)
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

  // ------------------ Auto Fishing ------------------
  async function startFishing() {
    try {
      autoFishingActive = true
      bot.chat('🎣 Bắt đầu câu cá')
      
      const rod = bot.inventory.items().find(i => i.name.includes('fishing_rod'))
      if (!rod) {
        bot.chat('🥺 Không có cần câu')
        autoFishingActive = false
        return
      }

      const water = bot.findBlock({
        matching: (block: any) => block.name.includes('water'),
        maxDistance: 32
      })
      
      if (!water) {
        bot.chat('🥺 Không tìm thấy nước')
        autoFishingActive = false
        return
      }

      await bot.equip(rod, 'hand')
      bot.lookAt(water.position, true)

      const fishInterval = setInterval(async () => {
        if (!autoFishingActive) {
          clearInterval(fishInterval)
          return
        }

        try {
          await bot.fish()
          bot.chat('🎣 Nhặt được cá/tài nguyên')
        } catch (e) {
          console.log('🛑 Lỗi câu cá:', e)
        }
      }, 5000)
    } catch (error) {
      bot.chat('🛑 Không thể câu cá')
      console.log('Lỗi fishing:', error)
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
