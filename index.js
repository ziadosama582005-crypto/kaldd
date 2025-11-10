// ==================================================
// 🤖 XO BOT — Inline Play + Shop + Gifts + Bot AI + Global Leaderboard
// اللعب الأساسي عبر: @Bot play
// ==================================================

require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// ================== BOT TOKEN ======================
const token = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.trim() : null;
console.log('🔍 فحص BOT_TOKEN...');
if (!token) {
  console.error('❌ BOT_TOKEN غير موجود في البيئة!');
  process.exit(1);
}

// ================== BOT INIT =======================
const bot = new TelegramBot(token, { polling: true });
let botUsername = null;

// ================== PLAYERS DATA ===================
const PLAYERS_FILE = 'players.json';
let players = {};

function loadPlayers() {
  try {
    if (!fs.existsSync(PLAYERS_FILE)) {
      fs.writeFileSync(PLAYERS_FILE, '{}', 'utf8');
    }
    const data = fs.readFileSync(PLAYERS_FILE, 'utf8');
    players = data && data.trim() ? JSON.parse(data) : {};
  } catch (err) {
    console.error('⚠️ خطأ في قراءة players.json:', err.message);
    players = {};
  }
}

function savePlayers() {
  try {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ خطأ أثناء حفظ بيانات اللاعبين:', err.message);
  }
}

function ensurePlayer(user) {
  if (!user || !user.id) return null;
  const id = String(user.id);
  const username = user.username || null;
  if (!players[id]) {
    players[id] = {
      id: user.id,
      name: user.first_name || username || 'لاعب',
      username,
      points: 0,     // نقاط التصنيف
      coins: 0,      // عملات المتجر / الهدايا
      wins: 0,
      losses: 0,
      draws: 0,
      ownedSkins: ['default'],
      activeSkin: 'default',
    };
  } else {
    players[id].name = user.first_name || username || players[id].name;
    players[id].username = username || players[id].username || null;
    players[id].points = players[id].points || 0;
    players[id].coins = players[id].coins || 0;
    players[id].wins = players[id].wins || 0;
    players[id].losses = players[id].losses || 0;
    players[id].draws = players[id].draws || 0;
    players[id].ownedSkins = players[id].ownedSkins || ['default'];
    if (!players[id].ownedSkins.includes('default')) {
      players[id].ownedSkins.push('default');
    }
    players[id].activeSkin = players[id].activeSkin || 'default';
  }
  return players[id];
}

loadPlayers();

// ================== SKINS / SHOP ===================
const SHOP_SKINS = {
  default: {
    id: 'default',
    name: '🎲 النمط العادي',
    price: 0,
    icons: { X: '❌', O: '⭕', empty: '⬜' },
  },
  fire: {
    id: 'fire',
    name: '🔥 لهب النار',
    price: 40,
    icons: { X: '🔥', O: '⚡', empty: '⬛' },
  },
  ice: {
    id: 'ice',
    name: '❄️ الجليد',
    price: 40,
    icons: { X: '❄️', O: '💙', empty: '🧊' },
  },
  skull: {
    id: 'skull',
    name: '💀 الظلام',
    price: 60,
    icons: { X: '💀', O: '☠️', empty: '⬛' },
  },
  neon: {
    id: 'neon',
    name: '🌈 نيون',
    price: 70,
    icons: { X: '🟩', O: '🟦', empty: '⬜' },
  },
  crown: {
    id: 'crown',
    name: '👑 الملكي',
    price: 100,
    icons: { X: '👑', O: '⚜️', empty: '⬜' },
  },
};

function getSkinIcons(player) {
  if (!player) return SHOP_SKINS.default.icons;
  const skinId = player.activeSkin || 'default';
  return (SHOP_SKINS[skinId] || SHOP_SKINS.default).icons;
}

// ================== GAME HELPERS ===================
function newBoard() {
  return [
    [' ', ' ', ' '],
    [' ', ' ', ' '],
    [' ', ' ', ' '],
  ];
}

const games = {};    // PvP inline games
const botGames = {}; // Bot AI games

function generateGameId() {
  return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function renderBoardInline(gameId, game) {
  const icons = game.icons || SHOP_SKINS.default.icons;
  return {
    inline_keyboard: game.board.map((row, i) =>
      row.map((cell, j) => ({
        text: cell === ' ' ? icons.empty : cell === 'X' ? icons.X : icons.O,
        callback_data: `mv:${gameId}:${i}:${j}`,
      }))
    ),
  };
}

function renderBoardBot(gameId, game) {
  const icons = game.icons || SHOP_SKINS.default.icons;
  return {
    inline_keyboard: game.board.map((row, i) =>
      row.map((cell, j) => ({
        text: cell === ' ' ? icons.empty : cell === 'X' ? icons.X : icons.O,
        callback_data: `botmv:${gameId}:${i}:${j}`,
      }))
    ),
  };
}

function checkWinner(b) {
  for (let i = 0; i < 3; i++) {
    if (b[i][0] === b[i][1] && b[i][1] === b[i][2] && b[i][0] !== ' ') return b[i][0];
    if (b[0][i] === b[1][i] && b[1][i] === b[2][i] && b[0][i] !== ' ') return b[0][i];
  }
  if (b[0][0] === b[1][1] && b[1][1] === b[2][2] && b[0][0] !== ' ') return b[0][0];
  if (b[0][2] === b[1][1] && b[1][1] === b[2][0] && b[0][2] !== ' ') return b[0][2];
  return null;
}

function escapeHTML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ================== POINTS / TITLES =================
function awardPoints(game, winnerSymbol) {
  if (!game.pX || !game.pO) return;

  const pX = ensurePlayer({ id: game.pX.id, first_name: game.pX.name, username: game.pX.username });
  const pO = ensurePlayer({ id: game.pO.id, first_name: game.pO.name, username: game.pO.username });

  if (!winnerSymbol) {
    pX.draws++;
    pO.draws++;
    pX.coins += 3;
    pO.coins += 3;
  } else if (winnerSymbol === 'X') {
    pX.wins++;
    pO.losses++;
    pX.points += 10;
    pX.coins += 10;
  } else if (winnerSymbol === 'O') {
    pO.wins++;
    pX.losses++;
    pO.points += 10;
    pO.coins += 10;
  }

  savePlayers();
}

function getTitle(p) {
  const pts = p.points || 0;
  if (pts >= 300) return '🔥 أسطورة XO';
  if (pts >= 150) return '👑 محترف XO';
  if (pts >= 50) return '🎯 لاعب نشيط';
  return '🌱 مبتدئ';
}

// ================== BOT READY ======================
bot.getMe().then((me) => {
  botUsername = me.username;
  console.log(`✅ البوت جاهز: @${botUsername}`);

  bot.setMyCommands([
    { command: 'start', description: 'شرح استخدام البوت' },
    { command: 'profile', description: 'عرض ملفك الشخصي' },
    { command: 'board', description: 'لوحة المتصدرين العالمية' },
    { command: 'shop', description: 'متجر السكينات' },
    { command: 'gift', description: 'إرسال هدية عملات لصديق' },
    { command: 'bank', description: 'عرض رصيد البنك الذهبي' },
    { command: 'bot', description: 'تحدي البوت الذكي' },
  ]);
});

// ================== /start =========================
bot.onText(/\/start(?:\s+(.+))?/, (msg) => {
  if (msg.chat.type !== 'private') return;
  const player = ensurePlayer(msg.from);

  const text =
    '👋 أهلاً <b>' + escapeHTML(player.name) + '</b>\n' +
    'اللعب الأساسي يتم عبر <b>Inline Mode</b>.\n\n' +
    '🎮 الطريقة:\n' +
    '1️⃣ في أي قروب أو خاص اكتب: <code>@' + escapeHTML(botUsername) + ' play</code>\n' +
    '2️⃣ اختر: "بدء لعبة XO (أنا ❌)" أو "بدء لعبة XO (أنا ⭕)".\n' +
    '3️⃣ أرسل البطاقة.\n' +
    '4️⃣ يظهر زر خصم واحد فقط، أول من يضغطه يصبح منافسك.\n' +
    '5️⃣ اللعب بالكامل من نفس الرسالة.\n\n' +
    '🏦 البنك الذهبي:\n' +
    '• تربح <b>نقاط</b> للتصنيف.\n' +
    '• تربح <b>عملات</b> للهدايا والمتجر.\n' +
    '• لا يسمح لك بالدخول في أوضاع معينة إذا رصيدك لا يكفي.\n\n' +
    '🧠 أوامر:\n' +
    '• /profile — ملفك الشخصي\n' +
    '• /board — التصنيف العالمي\n' +
    '• /shop — متجر السكينات\n' +
    '• /gift @user 10 — هدية عملات\n' +
    '• /bank — البنك الذهبي\n' +
    '• /bot — تحدي البوت 🤖';

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ================== /profile =======================
bot.onText(/^\/(?:profile|ملفي)(?:@\w+)?$/, (msg) => {
  const p = ensurePlayer(msg.from);
  const title = getTitle(p);
  const text =
    `👤 <b>${escapeHTML(p.name)}</b>\n` +
    `🏆 اللقب: <b>${title}</b>\n` +
    `🏅 النقاط: <code>${p.points}</code>\n` +
    `💰 العملات: <code>${p.coins}</code>\n` +
    `✅ الفوز: <code>${p.wins}</code>\n` +
    `❌ الخسارة: <code>${p.losses}</code>\n` +
    `🤝 التعادل: <code>${p.draws}</code>\n` +
    `🎨 السكين النشط: <b>${(SHOP_SKINS[p.activeSkin] && SHOP_SKINS[p.activeSkin].name) || '🎲 النمط العادي'}</b>`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ================== /board (Global Leaderboard) ====
bot.onText(/^\/(?:board|اللوحة)(?:@\w+)?$/, (msg) => {
  const list = Object.values(players).sort((a, b) => (b.points || 0) - (a.points || 0));
  if (!list.length) {
    return bot.sendMessage(
      msg.chat.id,
      'لا توجد بيانات بعد.\nابدأ أول مباراة عبر @' + botUsername + ' play'
    );
  }
  const top = list.slice(0, 20);
  const lines = top.map((p, i) => {
    const title = getTitle(p);
    return `${i + 1}. ${p.name} — ${p.points} نقطة (${title})`;
  });
  bot.sendMessage(msg.chat.id, '🌍 التصنيف العالمي (أعلى اللاعبين في كل المجموعات):\n' + lines.join('\n'));
});

// ================== /bank ==========================
bot.onText(/^\/(?:bank|wallet|بنك)(?:@\w+)?$/, (msg) => {
  const p = ensurePlayer(msg.from);
  const text =
    `🏦 <b>البنك الذهبي</b>\n` +
    `👤 <b>${escapeHTML(p.name)}</b>\n\n` +
    `🏅 نقاط التصنيف: <code>${p.points}</code>\n` +
    `💰 العملات المتاحة: <code>${p.coins}</code>\n\n` +
    `💡 اكسب النقاط والعملات من الفوز.\n` +
    `🔐 لن يسمح لك بالدخول في أوضاع مدفوعة إذا رصيدك لا يكفي.`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ================== /gift ==========================
// /gift @user 10  أو  /gift 123456789 10
bot.onText(/^\/gift(?:@\w+)?\s+(.+)\s+(\d+)$/, (msg, match) => {
  const fromPlayer = ensurePlayer(msg.from);
  const targetRef = (match[1] || '').trim();
  const amount = parseInt(match[2], 10);

  if (!amount || amount <= 0) {
    return bot.sendMessage(msg.chat.id, '❌ قيمة غير صالحة للهدية.');
  }

  if (fromPlayer.coins < amount) {
    return bot.sendMessage(msg.chat.id, '💰 رصيدك لا يكفي لإرسال هذه الهدية.');
  }

  let targetPlayer = null;

  if (targetRef.startsWith('@')) {
    const uname = targetRef.slice(1).toLowerCase();
    targetPlayer = Object.values(players).find(
      (p) => p.username && p.username.toLowerCase() === uname
    );
  } else if (/^\d+$/.test(targetRef)) {
    const id = targetRef;
    if (players[id]) targetPlayer = players[id];
  }

  if (!targetPlayer) {
    return bot.sendMessage(
      msg.chat.id,
      '❌ لم يتم العثور على اللاعب. تأكد أنه استخدم البوت مرة واحدة على الأقل.'
    );
  }

  if (targetPlayer.id === fromPlayer.id) {
    return bot.sendMessage(msg.chat.id, '❌ لا يمكنك إرسال هدية لنفسك.');
  }

  fromPlayer.coins -= amount;
  if (fromPlayer.coins < 0) fromPlayer.coins = 0;
  targetPlayer.coins += amount;
  savePlayers();

  bot.sendMessage(
    msg.chat.id,
    `🎁 ${fromPlayer.name} أهدى ${amount} عملة إلى ${targetPlayer.name}!`
  );
});

// ================== /bot — Bot AI Mode =============
bot.onText(/^\/(?:bot|ai|solo)(?:@\w+)?$/, (msg) => {
  const p = ensurePlayer(msg.from);
  const chatId = msg.chat.id;

  const text =
    '🤖 <b>تحدي البوت الذكي</b>\n\n' +
    '🟢 سهل: +5 نقاط عند الفوز، لا خصم عند الخسارة.\n' +
    '🟡 متوسط: +5 نقاط فوز، +1 تعادل.\n' +
    '🔴 صعب: فوز +10، تعادل +2، خسارة -20 (بدون نزول أقل من 0).\n\n' +
    '💰 لا يستخدم العملات، فقط يعدل نقاط التصنيف.';

  bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🟢 سهل', callback_data: `botlvl:easy:${p.id}` },
          { text: '🟡 متوسط', callback_data: `botlvl:medium:${p.id}` },
          { text: '🔴 صعب', callback_data: `botlvl:hard:${p.id}` },
        ],
      ],
    },
  });
});

// ================== Bot AI Helpers =================
function createBotGame(level, player, chatId, messageId) {
  const gameId = 'ai_' + generateGameId();
  const icons = getSkinIcons(player);

  botGames[gameId] = {
    id: gameId,
    type: 'bot',
    level,
    player: { id: player.id, name: player.name },
    board: newBoard(),
    turn: 'X', // اللاعب دائماً X
    chatId,
    messageId,
    status: 'playing',
    icons,
  };

  const header =
    `🤖 تحدي ضد البوت (${level === 'easy' ? '🟢 سهل' : level === 'medium' ? '🟡 متوسط' : '🔴 صعب'})\n` +
    `❌ ${player.name} vs 🤖 بوت\n` +
    `🎯 دور ${player.name}`;

  return { gameId, header };
}

function botChooseMove(game) {
  const b = game.board;
  const empties = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (b[i][j] === ' ') empties.push([i, j]);
    }
  }
  if (!empties.length) return null;

  // Medium & Hard: حاول الفوز ثم المنع
  if (game.level === 'hard' || game.level === 'medium') {
    // فوز بـ O
    for (const [i, j] of empties) {
      b[i][j] = 'O';
      if (checkWinner(b) === 'O') {
        b[i][j] = ' ';
        return [i, j];
      }
      b[i][j] = ' ';
    }
    // منع X
    for (const [i, j] of empties) {
      b[i][j] = 'X';
      if (checkWinner(b) === 'X') {
        b[i][j] = ' ';
        return [i, j];
      }
      b[i][j] = ' ';
    }
    // Hard: وسط ثم زوايا
    if (game.level === 'hard') {
      if (b[1][1] === ' ') return [1, 1];
      const corners = empties.filter(
        ([i, j]) => (i === 0 || i === 2) && (j === 0 || j === 2)
      );
      if (corners.length) {
        return corners[Math.floor(Math.random() * corners.length)];
      }
    }
  }

  // افتراضي: عشوائي
  return empties[Math.floor(Math.random() * empties.length)];
}

// ================== INLINE QUERY (PVP) =============
bot.on('inline_query', async (query) => {
  try {
    const q = (query.query || '').trim().toLowerCase();
    const host = query.from;
    const hostPlayer = ensurePlayer(host);
    const hostName = hostPlayer.name;

    if (!q || q === 'play' || q === 'xo') {
      const baseId = generateGameId();
      const hostId = host.id;

      const resultX = {
        type: 'article',
        id: `${baseId}:X:${hostId}`,
        title: 'بدء لعبة XO (أنا ❌)',
        description: 'أنت ❌ والخصم ⭕ — زر واحد للخصم',
        input_message_content: {
          message_text:
            `🎮 تحدي XO جديد!\n` +
            `👤 اللاعب الأول: ${hostName} (❌)\n` +
            `🕓 بانتظار لاعب يضغط زر ⭕ للانضمام.\n` +
            `⬜ أول من يضغط الزر يصبح الخصم وتبدأ المباراة هنا.`,
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '⭕ انضم كخصم',
                callback_data: `join:${baseId}:${hostId}:O`,
              },
            ],
          ],
        },
      };

      const resultO = {
        type: 'article',
        id: `${baseId}:O:${hostId}`,
        title: 'بدء لعبة XO (أنا ⭕)',
        description: 'أنت ⭕ والخصم ❌ — زر واحد للخصم',
        input_message_content: {
          message_text:
            `🎮 تحدي XO جديد!\n` +
            `👤 اللاعب الأول: ${hostName} (⭕)\n` +
            `🕓 بانتظار لاعب يضغط زر ❌ للانضمام.\n` +
            `⬜ أول من يضغط الزر يصبح الخصم وتبدأ المباراة هنا.`,
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '❌ انضم كخصم',
                callback_data: `join:${baseId}:${hostId}:X`,
              },
            ],
          ],
        },
      };

      await bot.answerInlineQuery(query.id, [resultX, resultO], {
        cache_time: 0,
        is_personal: false,
      });
    } else {
      await bot.answerInlineQuery(query.id, [], {
        switch_pm_text: 'اكتب play لبدء تحدي XO',
        switch_pm_parameter: 'start',
      });
    }
  } catch (err) {
    console.error('inline_query error:', err.message);
  }
});

// ================== CHOSEN INLINE RESULT ===========
bot.on('chosen_inline_result', (res) => {
  try {
    const { result_id, inline_message_id } = res;
    const parts = result_id.split(':'); // [gameId, symbol, hostId]
    if (parts.length < 3) return;
    const [gameId, symbol, hostIdStr] = parts;
    const hostId = Number(hostIdStr);

    const hostPlayerData =
      players[String(hostId)] ||
      ensurePlayer({ id: hostId, first_name: 'لاعب', username: null });

    const host = {
      id: hostPlayerData.id,
      name: hostPlayerData.name,
      username: hostPlayerData.username,
    };

    const icons = getSkinIcons(hostPlayerData);

    games[gameId] = {
      id: gameId,
      inline_message_id,
      board: newBoard(),
      status: 'waiting_opponent',
      turn: null,
      pX: symbol === 'X' ? host : null,
      pO: symbol === 'O' ? host : null,
      icons,
    };
  } catch (err) {
    console.error('chosen_inline_result error:', err.message);
  }
});

// ================== CALLBACK QUERY HANDLER =========
bot.on('callback_query', async (query) => {
  const { from, data, message, inline_message_id } = query;
  const user = ensurePlayer(from);

  try {
    // ---------- متجر ----------
    if (data && data.startsWith('shop:')) {
      const parts = data.split(':');
      const action = parts[1];
      const itemId = parts[2];

      if (action === 'none') {
        await bot.answerCallbackQuery(query.id, { text: '✅ هذا السكين مفعّل.' });
        return;
      }

      const item = SHOP_SKINS[itemId];
      if (!item) {
        await bot.answerCallbackQuery(query.id, { text: '❌ عنصر غير معروف.' });
        return;
      }

      if (action === 'info') {
        await bot.answerCallbackQuery(query.id, {
          text: `${item.name}\nالسعر: ${item.price} عملة`,
          show_alert: true,
        });
        return;
      }

      if (action === 'buy') {
        if (user.ownedSkins.includes(itemId)) {
          await bot.answerCallbackQuery(query.id, { text: '✅ تملك هذا السكين.' });
          return;
        }
        if (user.coins < item.price) {
          await bot.answerCallbackQuery(query.id, { text: '💰 رصيدك لا يكفي.' });
          return;
        }
        user.coins -= item.price;
        user.ownedSkins.push(itemId);
        user.activeSkin = itemId;
        savePlayers();
        await bot.answerCallbackQuery(query.id, {
          text: `✅ تم شراء ${item.name} وتفعيله.`,
          show_alert: true,
        });
        return;
      }

      if (action === 'use') {
        if (!user.ownedSkins.includes(itemId)) {
          await bot.answerCallbackQuery(query.id, { text: '❌ يجب شراءه أولاً.' });
          return;
        }
        user.activeSkin = itemId;
        savePlayers();
        await bot.answerCallbackQuery(query.id, {
          text: `🎨 تم تفعيل ${item.name}.`,
        });
        return;
      }

      await bot.answerCallbackQuery(query.id, { text: '⚠️ أمر متجر غير معروف.' });
      return;
    }

    // ---------- اختيار مستوى البوت ----------
    if (data && data.startsWith('botlvl:')) {
      const [, level, ownerIdStr] = data.split(':');
      const ownerId = Number(ownerIdStr);

      if (from.id !== ownerId) {
        await bot.answerCallbackQuery(query.id, { text: '❌ هذا التحدي لكاتب الأمر فقط.' });
        return;
      }

      if (!['easy', 'medium', 'hard'].includes(level)) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ مستوى غير صالح.' });
        return;
      }

      const chatId = message.chat.id;
      const msgId = message.message_id;
      const player = ensurePlayer(from);

      const { gameId, header } = createBotGame(level, player, chatId, msgId);

      try {
        await bot.editMessageText(header, {
          chat_id: chatId,
          message_id: msgId,
          reply_markup: renderBoardBot(gameId, botGames[gameId]),
        });
      } catch (e) {
        console.error('edit bot game start error:', e.message);
      }

      await bot.answerCallbackQuery(query.id, { text: '✅ بدأ تحدي البوت.' });
      return;
    }

    // ---------- حركات ضد البوت ----------
    if (data && data.startsWith('botmv:')) {
      const [, gameId, si, sj] = data.split(':');
      const i = Number(si);
      const j = Number(sj);
      const game = botGames[gameId];

      if (!game || game.status !== 'playing') {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ لا توجد لعبة نشطة ضد البوت.' });
        return;
      }

      if (from.id !== game.player.id) {
        await bot.answerCallbackQuery(query.id, { text: '❌ هذه ليست لعبتك.' });
        return;
      }

      if (!game.board[i] || game.board[i][j] === undefined) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ حركة غير صالحة.' });
        return;
      }

      if (game.board[i][j] !== ' ') {
        await bot.answerCallbackQuery(query.id, { text: '❗ هذه الخانة مشغولة.' });
        return;
      }

      const target = { chat_id: game.chatId, message_id: game.messageId };
      const player = ensurePlayer({ id: game.player.id, first_name: game.player.name });

      // حركة اللاعب X
      game.board[i][j] = 'X';

      let winner = checkWinner(game.board);
      let full = game.board.flat().every((c) => c !== ' ');

      if (winner || full) {
        game.status = 'finished';
        let txt;
        if (winner === 'X') {
          if (game.level === 'hard') player.points += 10;
          else player.points += 5;
          player.wins += 1;
          txt = `🏆 فزت على البوت!\nنقاطك الآن: ${player.points}`;
        } else if (!winner && full) {
          if (game.level === 'hard') player.points += 2;
          else player.points += 1;
          player.draws += 1;
          txt = `🤝 تعادل مع البوت.\nنقاطك الآن: ${player.points}`;
        } else {
          txt = 'انتهت اللعبة.';
        }
        savePlayers();
        try {
          await bot.editMessageText(txt, {
            ...target,
            reply_markup: renderBoardBot(gameId, game),
          });
        } catch (e) {}
        delete botGames[gameId];
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // حركة البوت O
      const move = botChooseMove(game);
      if (move) {
        const [bi, bj] = move;
        game.board[bi][bj] = 'O';
      }

      winner = checkWinner(game.board);
      full = game.board.flat().every((c) => c !== ' ');

      if (winner || full) {
        game.status = 'finished';
        let txt;
        if (winner === 'X') {
          if (game.level === 'hard') player.points += 10;
          else player.points += 5;
          player.wins += 1;
          txt = `🏆 فزت على البوت!\nنقاطك الآن: ${player.points}`;
        } else if (winner === 'O') {
          player.losses += 1;
          if (game.level === 'hard') {
            player.points = Math.max(0, player.points - 20);
          }
          txt = `💀 البوت فاز عليك.\nنقاطك الآن: ${player.points}`;
        } else {
          if (game.level === 'hard') player.points += 2;
          else player.points += 1;
          player.draws += 1;
          txt = `🤝 تعادل مع البوت.\nنقاطك الآن: ${player.points}`;
        }
        savePlayers();
        try {
          await bot.editMessageText(txt, {
            ...target,
            reply_markup: renderBoardBot(gameId, game),
          });
        } catch (e) {}
        delete botGames[gameId];
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // استمرار
      const header =
        `🤖 تحدي ضد البوت (${game.level === 'easy' ? '🟢 سهل' : game.level === 'medium' ? '🟡 متوسط' : '🔴 صعب'})\n` +
        `❌ ${game.player.name} vs 🤖 بوت\n` +
        `🎯 دورك الآن`;

      try {
        await bot.editMessageText(header, {
          ...target,
          reply_markup: renderBoardBot(gameId, game),
        });
      } catch (e) {}

      await bot.answerCallbackQuery(query.id);
      return;
    }

    // ---------- انضمام خصم PVP ----------
    if (data && data.startsWith('join:')) {
      const [, gameId, hostIdStr, needSymbol] = data.split(':');
      const hostId = Number(hostIdStr);

      let game = games[gameId];

      const target = inline_message_id
        ? { inline_message_id }
        : message
        ? { chat_id: message.chat.id, message_id: message.message_id }
        : null;

      // Fallback إذا ما وصل chosen_inline_result
      if (!game) {
        const hostPlayerData =
          players[String(hostId)] ||
          ensurePlayer({ id: hostId, first_name: 'اللاعب الأول', username: null });

        const host = {
          id: hostPlayerData.id,
          name: hostPlayerData.name,
          username: hostPlayerData.username,
        };

        const hostSymbol = needSymbol === 'X' ? 'O' : 'X';

        game = games[gameId] = {
          id: gameId,
          inline_message_id: inline_message_id || null,
          board: newBoard(),
          status: 'waiting_opponent',
          turn: null,
          pX: hostSymbol === 'X' ? host : null,
          pO: hostSymbol === 'O' ? host : null,
          icons: getSkinIcons(hostPlayerData),
        };
      }

      if (!target || game.status !== 'waiting_opponent') {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ هذا التحدي غير متاح.' });
        return;
      }

      // منع الهوست من الانضمام لنفسه
      if (
        (game.pX && game.pX.id === from.id) ||
        (game.pO && game.pO.id === from.id)
      ) {
        await bot.answerCallbackQuery(query.id, { text: '❌ لا يمكنك تحدي نفسك.' });
        return;
      }

      // تحقق من الرمز المطلوب
      if (needSymbol === 'X' && game.pX) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ ❌ محجوز.' });
        return;
      }
      if (needSymbol === 'O' && game.pO) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ ⭕ محجوز.' });
        return;
      }

      const opp = { id: user.id, name: user.name, username: user.username };
      if (needSymbol === 'X') game.pX = opp;
      if (needSymbol === 'O') game.pO = opp;

      if (!game.pX || !game.pO) {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ خطأ في إعداد التحدي.',
          show_alert: true,
        });
        delete games[gameId];
        return;
      }

      // بدء اللعبة
      game.status = 'playing';
      game.turn = 'X';
      game.board = newBoard();

      // السكين حسب لاعب X
      const xPlayerData =
        players[String(game.pX.id)] ||
        ensurePlayer({ id: game.pX.id, first_name: game.pX.name, username: game.pX.username });
      game.icons = getSkinIcons(xPlayerData);

      const header =
        `🎮 لعبة XO بدأت!\n` +
        `❌ ${game.pX.name}\n` +
        `⭕ ${game.pO.name}\n` +
        `🎯 دور ${game.pX.name}`;

      try {
        await bot.editMessageText(header, {
          ...target,
          reply_markup: renderBoardInline(gameId, game),
        });
      } catch (e) {}

      await bot.answerCallbackQuery(query.id, { text: '✅ انضممت للتحدي.' });
      return;
    }

    // ---------- حركات PVP ----------
    if (data && data.startsWith('mv:')) {
      const [, gameId, si, sj] = data.split(':');
      const i = Number(si);
      const j = Number(sj);
      const game = games[gameId];

      const target = game
        ? game.inline_message_id
          ? { inline_message_id: game.inline_message_id }
          : message
          ? { chat_id: message.chat.id, message_id: message.message_id }
          : null
        : null;

      if (!game || !target || game.status !== 'playing') {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ لا توجد لعبة نشطة.' });
        return;
      }

      if (!game.board[i] || game.board[i][j] === undefined) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ حركة غير صالحة.' });
        return;
      }

      if (game.board[i][j] !== ' ') {
        await bot.answerCallbackQuery(query.id, { text: '❗ هذه الخانة مشغولة.' });
        return;
      }

      const expectedId =
        game.turn === 'X'
          ? (game.pX && game.pX.id)
          : (game.pO && game.pO.id);

      if (from.id !== expectedId) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ ليس دورك الآن.' });
        return;
      }

      game.board[i][j] = game.turn;

      const winnerSymbol = checkWinner(game.board);
      const isFull = game.board.flat().every((c) => c !== ' ');

      if (winnerSymbol || isFull) {
        game.status = 'finished';
        let txt;
        if (winnerSymbol) {
          const winner = winnerSymbol === 'X' ? game.pX : game.pO;
          awardPoints(game, winnerSymbol);
          const icons = game.icons || SHOP_SKINS.default.icons;
          const winIcon = winnerSymbol === 'X' ? icons.X : icons.O;
          txt = `🏆 انتهت المباراة!\nالفائز: ${winner.name} (${winIcon})`;
        } else {
          awardPoints(game, null);
          txt = '🤝 انتهت المباراة بالتعادل!';
        }

        try {
          await bot.editMessageText(txt, {
            ...target,
            reply_markup: renderBoardInline(gameId, game),
          });
        } catch (e) {}

        delete games[gameId];
        await bot.answerCallbackQuery(query.id);
        return;
      }

      game.turn = game.turn === 'X' ? 'O' : 'X';
      const turnName = game.turn === 'X' ? game.pX.name : game.pO.name;

      const header =
        `🎮 لعبة XO\n` +
        `❌ ${game.pX.name} — ⭕ ${game.pO.name}\n` +
        `🎯 دور ${turnName}`;

      try {
        await bot.editMessageText(header, {
          ...target,
          reply_markup: renderBoardInline(gameId, game),
        });
      } catch (e) {}

      await bot.answerCallbackQuery(query.id);
      return;
    }

    await bot.answerCallbackQuery(query.id, { text: '⚠️ إجراء غير معروف.' });
  } catch (err) {
    console.error('callback_query error:', err.message);
    try {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ حدث خطأ غير متوقع.' });
    } catch {}
  }
});

console.log('🚀 XO Inline + Gifts + Bank + Bot AI + Global Board جاهز.'); 
