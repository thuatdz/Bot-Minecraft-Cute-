// Import các thư viện cần thiết.
import mineflayer from 'mineflayer'
import pathfinderPlugin from 'mineflayer-pathfinder'
// import autoEatPlugin from 'mineflayer-auto-eat'
// import pvpPlugin from 'mineflayer-pvp'
import { Vec3 } from 'vec3'

// Khai báo API Key cho Gemini AI.
const apiKey = "" 

// Khởi tạo các biến toàn cục để quản lý trạng thái của bot.
let targetPlayer = null
let followInterval = null
let protectInterval = null
let isFollowing = false
let isProtecting = false

// Tạo và cấu hình bot.
function createBot() {
  const bot = mineflayer.createBot({
    host: 'thuatzai123.aternos.me',
    port: 38893,
    username: 'botlolicute',
    version: '1.19.4',
    auth: 'offline'
  })

  // Tải các plugin cần thiết.
  bot.loadPlugin(pathfinderPlugin.pathfinder)
  // bot.loadPlugin(autoEatPlugin)
  // bot.loadPlugin(pvpPlugin)

  // Hàm để trang bị vũ khí tốt nhất.
  function equipBestWeapon() {
    let bestWeapon = null
    let bestDamage = -1

    for (const item of bot.inventory.slots) {
      if (item && item.nbt) {
        const attributes = item.nbt.value.tag.value.AttributeModifiers?.value?.value
        if (attributes) {
          for (const attr of attributes) {
            if (attr.AttributeName?.value === 'generic.attack_damage' || attr.AttributeName?.value === 'minecraft:generic.attack_damage') {
              const damage = attr.Amount?.value
              if (damage > bestDamage) {
                bestDamage = damage
                bestWeapon = item
              }
            }
          }
        }
      }
    }
    if (bestWeapon) {
      bot.equip(bestWeapon, 'hand')
      console.log(`🗡️ Bot đã trang bị vũ khí mạnh nhất: ${bestWeapon.displayName}`)
    }
  }

  // Hàm để trang bị giáp tốt nhất.
  function equipBestArmor() {
    const armorSlots = {
      head: null,
      chest: null,
      legs: null,
      feet: null
    }

    // Tìm kiếm các món giáp tốt nhất.
    for (const item of bot.inventory.slots) {
      if (item) {
        // Tên slot của giáp tương ứng với tên tiếng Anh.
        if (item.name.includes('helmet') && (!armorSlots.head || item.durability > armorSlots.head.durability)) {
          armorSlots.head = item
        } else if (item.name.includes('chestplate') && (!armorSlots.chest || item.durability > armorSlots.chest.durability)) {
          armorSlots.chest = item
        } else if (item.name.includes('leggings') && (!armorSlots.legs || item.durability > armorSlots.legs.durability)) {
          armorSlots.legs = item
        } else if (item.name.includes('boots') && (!armorSlots.feet || item.durability > armorSlots.feet.durability)) {
          armorSlots.feet = item
        }
      }
    }

    // Trang bị giáp đã tìm được.
    for (const slot in armorSlots) {
      const item = armorSlots[slot]
      if (item) {
        bot.equip(item, slot)
      }
    }
    console.log(`🛡️ Bot đã trang bị giáp tốt nhất.`)
  }

  // Hàm để trang bị vật tổ hoặc khiên vào tay trái.
  function equipOffhand() {
    const totem = bot.inventory.items().find(item => item.name === 'totem_of_undying')
    const shield = bot.inventory.items().find(item => item.name.includes('shield'))

    if (totem) {
      bot.equip(totem, 'off-hand')
      console.log(`✨ Bot đã trang bị Vật Tổ vào tay trái.`)
    } else if (shield) {
      bot.equip(shield, 'off-hand')
      console.log(`🛡️ Bot đã trang bị Khiên vào tay trái.`)
    }
  }

  // Hàm kiểm tra và trang bị định kỳ.
  const checkInventoryInterval = setInterval(() => {
    equipBestArmor()
    equipOffhand()
  }, 10000)

  // Sự kiện khi bot đã spawn thành công vào thế giới.
  bot.on('spawn', () => {
    console.log('🎉 Bot đã spawn thành công!')
    const defaultMove = new pathfinderPlugin.Movements(bot)
    defaultMove.allowOpenDoors = true
    defaultMove.allowOpenGates = true
    defaultMove.allowSprinting = true
    defaultMove.canDig = true // Cho phép đào để đi qua.
    bot.pathfinder.setMovements(defaultMove)

    // Cấu hình auto-eat.
    // bot.autoEat.options = {
    //   priority: 'foodPoints',
    //   startAt: 14, // Tự động ăn khi chỉ số thức ăn dưới 14.
    //   bannedFood: []
    // }

    // Bắt đầu thả thính định kỳ.
    startFlirting()
  })

  // Hàm bắt đầu "thả thính" với Gemini.
  function startFlirting() {
    setInterval(async () => {
      // Prompt cho Gemini để tạo câu "thả thính" dễ thương.
      const flirtPrompt = "Bạn là một bot AI dễ thương trong Minecraft tên là botlolicute. Hãy gửi một tin nhắn 'thả thính' hoặc nói một điều ngọt ngào với mọi người trong game. Hãy xưng 'tớ' và gọi người khác là 'cậu'. Chỉ trả lời trực tiếp không có lời dẫn. Ví dụ: 'Tớ thích cậu nhiều lắm đấy! ❤️'. Dùng nhiều emoji nhé."

      try {
        const payload = {
            contents: [{ role: "user", parts: [{ text: flirtPrompt }] }]
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText) {
          bot.chat(generatedText)
        }
      } catch (error) {
        console.error('Lỗi khi thả thính:', error)
      }
    }, 30000); // 30 giây một lần.
  }

  // Sự kiện khi bot nhận được tin nhắn chat.
  bot.on('chat', async (username, message) => {
    console.log(`💬 Chat nhận được: [${username}]: ${message}`)
    
    if (username === bot.username || username === 'server' || username === 'console') {
      console.log(`⏭️ Bỏ qua tin nhắn từ: ${username}`)
      return
    }

    const cleanMessage = message.toLowerCase().trim()
    const botName = 'botlolicute'
    console.log(`🔍 Xử lý lệnh: "${cleanMessage}"`)

    // Xử lý các lệnh chat.
    if (cleanMessage.includes('theo')) {
      // Lệnh đi theo.
      const playerEntity = bot.players[username]?.entity
      if (playerEntity) {
        targetPlayer = playerEntity
        bot.chat(`❤️ Tớ sẽ theo cậu đến cùng trời cuối đất!`)
        stopProtecting()
        startFollowing()
        console.log(`✅ Bắt đầu theo ${username}`)
      } else {
        bot.chat(`🥺 Cậu phải ở trong tầm nhìn của tớ thì tớ mới đi theo được!`)
        console.log(`❌ Không tìm thấy player: ${username}`)
      }
    } else if (cleanMessage.includes('bảo vệ')) {
      // Lệnh bảo vệ.
      const playerEntity = bot.players[username]?.entity
      if (playerEntity) {
        targetPlayer = playerEntity
        bot.chat(`🛡️ Tớ sẽ bảo vệ cậu khỏi tất cả nguy hiểm!`)
        stopFollowing()
        startProtecting()
        console.log(`✅ Bắt đầu bảo vệ ${username}`)
      } else {
        bot.chat(`🥺 Cậu phải ở gần tớ thì tớ mới bảo vệ được!`)
        console.log(`❌ Không tìm thấy player để bảo vệ: ${username}`)
      }
    } else if (cleanMessage.includes('dừng') || cleanMessage.includes('stop')) {
      // Lệnh dừng tất cả hoạt động
      stopFollowing()
      stopProtecting()
      targetPlayer = null
      bot.chat(`🛑 Được rồi, tớ dừng lại đây!`)
      console.log(`⏹️ Dừng tất cả hoạt động theo lệnh của ${username}`)
    } else if (cleanMessage.includes('ngủ')) {
      // Lệnh ngủ.
      console.log(`😴 ${username} yêu cầu bot đi ngủ`)
      if (bot.time.isDay) {
        bot.chat(`☀️ Trời đang sáng mà cậu, chưa đi ngủ được đâu!`)
        return
      }

      const bedBlock = bot.findBlock({
        matching: (block) => bot.is = block.name.includes('bed'),
        maxDistance: 16
      })

      if (bedBlock) {
        bot.chat(`😴 Tớ buồn ngủ quá, đi ngủ thôi nào!`)
        try {
          await bot.sleep(bedBlock)
          bot.chat(`Zzz... 😴`)
        } catch (err) {
          bot.chat(`😢 Tớ không ngủ được ở đây. Cậu tìm chỗ khác nhé.`)
        }
      } else {
        bot.chat(`🛌 Tớ không tìm thấy giường nào gần đây cả.`)
      }
    } else if (cleanMessage.includes(botName.toLowerCase()) || cleanMessage.startsWith('bot ơi')) {
      // Lệnh chat thông thường.
      try {
        const prompt = cleanMessage.replace(botName.toLowerCase(), '').replace('bot ơi', '').trim()

        const systemPrompt = `Bạn là một bot AI dễ thương, có tên là ${botName}. Bạn đang ở trong game Minecraft. Hãy trả lời các câu hỏi hoặc bình luận của người chơi một cách ngọt ngào, vui vẻ và thân thiện. Khi trả lời, hãy xưng "tớ" và gọi người chơi là "cậu". Chỉ trả lời trực tiếp mà không cần thêm bất kỳ câu dẫn nào.`

        let chatHistory = []
        chatHistory.push({ role: "user", parts: [{ text: `${systemPrompt}\n\n${prompt}` }] });

        const payload = {
            contents: chatHistory
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText) {
          bot.chat(generatedText)
        } else {
          bot.chat(`Tớ xin lỗi, tớ đang gặp một chút vấn đề, cậu thử lại sau nhé!`)
        }
      } catch (error) {
        bot.chat(`Ôi, tớ không hiểu lắm. Cậu có thể nói lại không? 😥`)
      }
    }
  })

  // Hàm bắt đầu đi theo người chơi.
  function startFollowing() {
    isFollowing = true
    if (followInterval) clearInterval(followInterval)
    followInterval = setInterval(() => {
      if (!targetPlayer || !targetPlayer.isValid || bot.entity.dead) {
        stopFollowing()
        return
      }

      const targetPos = targetPlayer.position
      const distance = bot.entity.position.distanceTo(targetPos)

      // Kiểm tra khoảng cách quá xa để dịch chuyển tức thời.
      if (distance > 15) {
        bot.chat(` teleport!`)
        bot.pathfinder.setGoal(new pathfinderPlugin.goals.GoalBlock(targetPos.x, targetPos.y, targetPos.z))
        return
      }

      // Đặt mục tiêu đi theo và giữ khoảng cách 2 block.
      bot.pathfinder.setGoal(new pathfinderPlugin.goals.GoalFollow(targetPlayer, 2), true)

    }, 200) // Cập nhật vị trí mỗi 0.2 giây.
  }

  // Hàm dừng đi theo.
  function stopFollowing() {
    isFollowing = false
    if (followInterval) {
      clearInterval(followInterval)
      followInterval = null
    }
    bot.pathfinder.setGoal(null)
  }

  // Hàm bắt đầu bảo vệ người chơi.
  function startProtecting() {
    isProtecting = true
    if (protectInterval) clearInterval(protectInterval)
    protectInterval = setInterval(() => {
      if (!targetPlayer || !targetPlayer.isValid || bot.entity.dead) {
        stopProtecting()
        return
      }

      const targetPos = targetPlayer.position
      const distance = bot.entity.position.distanceTo(targetPos)

      // Kiểm tra quái vật gần nhất để tấn công.
      const mob = bot.nearestEntity(entity => {
        const isHostile = entity.type === 'mob' && entity.displayName !== 'Enderman' // Không tấn công Enderman
        const isVindicator = entity.name === 'vindicator'
        const isIllager = entity.name === 'pillager'
        const isVillagerRaid = isIllager || isVindicator
        return isHostile || isVillagerRaid
      })

      if (mob && bot.entity.position.distanceTo(mob.position) < 10) {
        // Trang bị vũ khí và tấn công.
        equipBestWeapon()
        bot.setControlState('sprint', true)
        // bot.pvp.attack(mob)
      } else {
        // Nếu không có quái vật, quay lại đi theo.
        // bot.pvp.stop()
        if (distance > 6) {
          bot.pathfinder.setGoal(new pathfinderPlugin.goals.GoalFollow(targetPlayer, 2), true)
        }
      }
    }, 200) // Cập nhật mỗi 0.2 giây.
  }

  // Hàm dừng bảo vệ.
  function stopProtecting() {
    isProtecting = false
    if (protectInterval) {
      clearInterval(protectInterval)
      protectInterval = null
    }
    // bot.pvp.stop()
    bot.pathfinder.setGoal(null)
  }

  // Xử lý lỗi.
  bot.on('error', (err) => console.log('🛑 Bot gặp lỗi:', err))
  bot.on('end', (reason) => console.log('💔 Bot đã ngắt kết nối:', reason))
}

// Gọi hàm để chạy bot.
createBot()

