// ==================================================
// 🤖 XO BOT — Inline Play + Shop System
// اللعب: @Bot play
// المتجر: /shop
// ==================================================

require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// ==================================================
// 🔐 BOT TOKEN
const token = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.trim() : null;
console.log('🔍 فحص BOT_TOKEN...');
if (!token) {
  console.error('❌ BOT_TOKEN غير موجود في البيئة!');
  process.exit(1);
}

// ==================================================
// 🚀 إنشاء البوت
const bot = new TelegramBot(token, { polling: true });
let botUsername = null;

// ==================================================
// 💾 بيانات اللاعبين
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
  if (!players[id]) {
    players[id] = {
      id: user.id,
      name: user.first_name || user.username || 'لاعب',
      points: 0,
      coins: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      ownedSkins: ['default'],
      activeSkin: 'default',
    };
  } else {
    players[id].name = user.first_name || user.username || players[id].name;
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

// ==================================================
// 🎨 سكينات الأزرار (المتجر)
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
  const skin = SHOP_SKINS[skinId] || SHOP_SKINS.default;
  return skin.icons;
}

// ==================================================
// 🎮 XO Board Helpers
function newBoard() {
  return [
    [' ', ' ', ' '],
    [' ', ' ', ' '],
    [' ', ' ', ' '],
  ];
}

// game: { id, inline_message_id, board, status, turn, pX, pO, icons }
const games = {};

function generateGameId() {
  return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function renderBoardInline(gameId, game) {
  const icons = game.icons || SHOP_SKINS.default.icons;
  return {
    inline_keyboard: game.board.map((row, i) =>
      row.map((cell, j) => ({
        text:
          cell === ' ' ? icons.empty : cell === 'X' ? icons.X : icons.O,
        callback_data: `mv:${gameId}:${i}:${j}`,
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

// ==================================================
// 🏅 نظام النقاط + العملات
function awardPoints(game, winnerSymbol) {
  if (!game.pX || !game.pO) return;

  const pX = ensurePlayer({ id: game.pX.id, first_name: game.pX.name });
  const pO = ensurePlayer({ id: game.pO.id, first_name: game.pO.name });

  if (!winnerSymbol) {
    // تعادل
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

// لقب على حسب النقاط
function getTitle(p) {
  const pts = p.points || 0;
  if (pts >= 300) return '🔥 أسطورة XO';
  if (pts >= 150) return '👑 محترف XO';
  if (pts >= 50) return '🎯 لاعب نشيط';
  return '🌱 مبتدئ';
}

// ==================================================
// 🔔 جاهزية البوت
bot.getMe().then((me) => {
  botUsername = me.username;
  console.log(`✅ البوت جاهز: @${botUsername}`);

  bot.setMyCommands([
    { command: 'start', description: 'شرح استخدام البوت' },
    { command: 'profile', description: 'عرض ملفك الشخصي' },
    { command: 'board', description: 'عرض قائمة المتصدرين' },
    { command: 'shop', description: 'متجر السكينات والأزرار' },
  ]);
});

// ==================================================
// /start — في الخاص فقط
bot.onText(/\/start(?:\s+(.+))?/, (msg) => {
  if (msg.chat.type !== 'private') return;
  const player = ensurePlayer(msg.from);

  const text =
    '👋 أهلاً <b>' + escapeHTML(player.name) + '</b>\n' +
    'اللعب في أي مكان عن طريق <b>Inline Mode</b>.\n\n' +
    '🎮 الطريقة:\n' +
    '1️⃣ اكتب: <code>@' + escapeHTML(botUsername) + ' play</code>\n' +
    '2️⃣ اختر "أنا ❌" أو "أنا ⭕".\n' +
    '3️⃣ أرسل البطاقة → يظهر زر واحد للخصم.\n' +
    '4️⃣ أول من يضغط الزر يصبح خصمك وتبدأ المباراة في نفس الرسالة.\n\n' +
    '💰 كل فوز يعطيك عملات ونقاط.\n' +
    '🛒 استخدم /shop لشراء سكينات وأزرار خاصة.\n' +
    '🏅 /profile لعرض ملفك و /board لعرض المتصدرين.';

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ==================================================
// /profile — ملف اللاعب
bot.onText(/^\/(?:profile|ملفي)(?:@\w+)?$/, (msg) => {
  const p = ensurePlayer(msg.from);
  const title = getTitle(p);
  const text =
    `👤 <b>${escapeHTML(p.name)}</b>\n` +
    `🏆 اللقب: <b>${title}</b>\n` +
    `🏅 النقاط: <code>${p.points}</code>\n` +
    `💰 العملات: <code>${p.coins}</code>\n` +
    `✅ الانتصارات: <code>${p.wins}</code>\n` +
    `❌ الخسائر: <code>${p.losses}</code>\n` +
    `🤝 التعادلات: <code>${p.draws}</code>\n` +
    `🎨 السكين النشط: <b>${(SHOP_SKINS[p.activeSkin] && SHOP_SKINS[p.activeSkin].name) || '🎲 النمط العادي'}</b>`;

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ==================================================
// /board — المتصدرين
bot.onText(/^\/(?:board|اللوحة)(?:@\w+)?$/, (msg) => {
  const list = Object.values(players).sort(
    (a, b) => (b.points || 0) - (a.points || 0)
  );
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
  bot.sendMessage(msg.chat.id, '📊 لوحة المتصدرين:\n' + lines.join('\n'));
});

// ==================================================
// /shop — متجر السكينات
bot.onText(/^\/(?:shop|المتجر)(?:@\w+)?$/, (msg) => {
  const p = ensurePlayer(msg.from);

  let text = `🛒 <b>متجر XO</b>\n`;
  text += `💰 رصيدك: <b>${p.coins}</b> عملة\n\n`;
  text += `اختر سكين للأزرار واللوحة. السكين يطبق على تحدياتك عندما تكون أنت اللاعب الأول.\n`;

  const keyboard = [];

  Object.values(SHOP_SKINS).forEach((item) => {
    const owned = p.ownedSkins.includes(item.id);
    const active = p.activeSkin === item.id;

    let label;
    let action;

    if (item.id === 'default') {
      label = active ? '✅ مستخدم حالياً' : '🎲 تفعيل النمط العادي';
      action = 'use';
    } else if (!owned) {
      label = `💰 شراء (${item.price})`;
      action = 'buy';
    } else if (active) {
      label = '✅ مفعّل';
      action = 'none';
    } else {
      label = '🎨 تفعيل';
      action = 'use';
    }

    const row = [
      {
        text: item.name,
        callback_data: 'shop:info:' + item.id,
      },
      {
        text: label,
        callback_data:
          action === 'none' ? 'shop:none' : `shop:${action}:${item.id}`,
      },
    ];
    keyboard.push(row);
  });

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  });
});

// ==================================================
// 🎮 Inline Mode — @Bot play
// أول لاعب يختار نفسه ❌ أو ⭕ من شريط الاقتراح
bot.on('inline_query', async (query) => {
  try {
    const q = (query.query || '').trim().toLowerCase();
    const host = query.from;
    const hostPlayer = ensurePlayer(host);
    const hostName = hostPlayer.name;

    if (!q || q === 'play' || q === 'xo') {
      const baseId = generateGameId();

      const resultX = {
        type: 'article',
        id: `${baseId}:X`,
        title: 'بدء لعبة XO (أنا ❌)',
        description: 'أرسل التحدي، أنت ❌ والخصم ⭕',
        input_message_content: {
          message_text:
            `🎮 تحدي XO جديد!\n` +
            `👤 اللاعب الأول: ${hostName} (❌)\n` +
            `🕓 بانتظار لاعب يضغط زر ⭕ للانضمام.\n` +
            `⬜ بعد انضمام الخصم تبدأ اللعبة في هذه الرسالة.`,
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '⭕ انضم كخصم',
                callback_data: `join:${baseId}:O`,
              },
            ],
          ],
        },
      };

      const resultO = {
        type: 'article',
        id: `${baseId}:O`,
        title: 'بدء لعبة XO (أنا ⭕)',
        description: 'أرسل التحدي، أنت ⭕ والخصم ❌',
        input_message_content: {
          message_text:
            `🎮 تحدي XO جديد!\n` +
            `👤 اللاعب الأول: ${hostName} (⭕)\n` +
            `🕓 بانتظار لاعب يضغط زر ❌ للانضمام.\n` +
            `⬜ بعد انضمام الخصم تبدأ اللعبة في هذه الرسالة.`,
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '❌ انضم كخصم',
                callback_data: `join:${baseId}:X`,
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

// ==================================================
// 🎮 chosen_inline_result — نحدد اللاعب الأول فعلياً
bot.on('chosen_inline_result', (res) => {
  try {
    const { from, result_id, inline_message_id } = res;
    const [gameId, symbol] = result_id.split(':');
    if (!gameId || !symbol) return;

    const hostPlayer = ensurePlayer(from);

    // استخدم سكين اللاعب الأول
    const icons = getSkinIcons(hostPlayer);

    games[gameId] = {
      id: gameId,
      inline_message_id,
      board: newBoard(),
      status: 'waiting_opponent',
      turn: null,
      pX: symbol === 'X' ? { id: hostPlayer.id, name: hostPlayer.name } : null,
      pO: symbol === 'O' ? { id: hostPlayer.id, name: hostPlayer.name } : null,
      icons,
    };

    console.log(`🎮 لعبة ${gameId} أنشأها ${hostPlayer.name} كـ ${symbol}`);
  } catch (err) {
    console.error('chosen_inline_result error:', err.message);
  }
});

// ==================================================
// 🎯 callback_query — متجر + انضمام + لعب
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
        await bot.answerCallbackQuery(query.id, { text: '✅ هذا السكين مفعّل بالفعل.' });
        return;
      }

      if (action === 'info') {
        const item = SHOP_SKINS[itemId];
        if (!item) {
          await bot.answerCallbackQuery(query.id, { text: '❌ عنصر غير معروف.' });
          return;
        }
        await bot.answerCallbackQuery(query.id, {
          text: `${item.name}\nالسعر: ${item.price} عملة`,
          show_alert: true,
        });
        return;
      }

      if (action === 'buy') {
        const item = SHOP_SKINS[itemId];
        if (!item) {
          await bot.answerCallbackQuery(query.id, { text: '❌ عنصر غير معروف.' });
          return;
        }
        if (user.ownedSkins.includes(itemId)) {
          await bot.answerCallbackQuery(query.id, { text: '✅ أنت تملك هذا السكين بالفعل.' });
          return;
        }
        if (user.coins < item.price) {
          await bot.answerCallbackQuery(query.id, { text: '💰 رصيدك لا يكفي للشراء.' });
          return;
        }
        user.coins -= item.price;
        user.ownedSkins.push(itemId);
        user.activeSkin = itemId;
        savePlayers();
        await bot.answerCallbackQuery(query.id, {
          text: `✅ تم شراء ${item.name} وتفعيله!`,
          show_alert: true,
        });

        // تحديث رسالة المتجر (اختياري)
        if (message) {
          // استدعاء /shop من جديد بشكل مبسط
          bot.emit('text', {
            chat: message.chat,
            from,
            text: '/shop',
            message_id: message.message_id,
          });
        }
        return;
      }

      if (action === 'use') {
        const item = SHOP_SKINS[itemId];
        if (!item) {
          await bot.answerCallbackQuery(query.id, { text: '❌ عنصر غير معروف.' });
          return;
        }
        if (!user.ownedSkins.includes(itemId)) {
          await bot.answerCallbackQuery(query.id, { text: '❌ يجب شراء السكين أولاً.' });
          return;
        }
        user.activeSkin = itemId;
        savePlayers();
        await bot.answerCallbackQuery(query.id, {
          text: `🎨 تم تفعيل ${item.name} لخياراتك!`,
          show_alert: false,
        });
        return;
      }

      await bot.answerCallbackQuery(query.id, { text: '⚠️ أمر متجر غير معروف.' });
      return;
    }

    // ---------- انضمام الخصم ----------
    if (data && data.startsWith('join:')) {
      const [, gameId, symbol] = data.split(':');
      const game = games[gameId];

      const target = inline_message_id
        ? { inline_message_id }
        : message
        ? { chat_id: message.chat.id, message_id: message.message_id }
        : null;

      if (!game || !target) {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ هذا التحدي غير متاح أو انتهى.',
          show_alert: false,
        });
        return;
      }

      if (game.status !== 'waiting_opponent') {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ تم اختيار الخصم بالفعل.',
        });
        return;
      }

      // منع اللاعب الأول من أن يكون خصم نفسه
      if (
        (game.pX && game.pX.id === from.id) ||
        (game.pO && game.pO.id === from.id)
      ) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ لا يمكنك تحدي نفسك.',
        });
        return;
      }

      // تحقق أن الرمز المطلوب هو الفارغ
      if (symbol === 'X' && game.pX) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ ❌ محجوز بالفعل.' });
        return;
      }
      if (symbol === 'O' && game.pO) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ ⭕ محجوز بالفعل.' });
        return;
      }

      const opp = { id: from.id, name: user.name };

      if (symbol === 'X') game.pX = opp;
      if (symbol === 'O') game.pO = opp;

      // عند هذه النقطة المفروض عندنا pX و pO
      if (!game.pX || !game.pO) {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ حدث خلل، أعد إرسال التحدي.',
          show_alert: true,
        });
        delete games[gameId];
        return;
      }

      // استخدام سكين اللاعب الأول (لو كان محدد)
      const hostPlayerId = game.pX.id; // X يبدأ دائماً
      const hostPlayerData = players[String(hostPlayerId)];
      game.icons = getSkinIcons(hostPlayerData);

      game.status = 'playing';
      game.turn = 'X';
      game.board = newBoard();

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
      } catch (e) {
        console.error('edit start game error:', e.message);
      }

      await bot.answerCallbackQuery(query.id, { text: '✅ انضممت كتحدي.' });
      return;
    }

    // ---------- تنفيذ حركة ----------
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
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ لا توجد لعبة نشطة.',
        });
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
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ ليس دورك الآن.',
        });
        return;
      }

      // تنفيذ الحركة
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
          const winEmoji =
            winnerSymbol === 'X' ? icons.X : icons.O;

          txt =
            `🏆 انتهت المباراة!\n` +
            `الفائز: ${winner.name} (${winEmoji})\n` +
            `🔥 مبروك!`;
        } else {
          awardPoints(game, null);
          txt = '🤝 انتهت المباراة بالتعادل!';
        }

        try {
          await bot.editMessageText(txt, {
            ...target,
            reply_markup: renderBoardInline(gameId, game),
          });
        } catch (e) {
          console.error('edit end game error:', e.message);
        }

        delete games[gameId];
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // استمرار اللعبة
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
      } catch (e) {
        console.error('edit move error:', e.message);
      }

      await bot.answerCallbackQuery(query.id);
      return;
    }

    // أي شيء آخر
    await bot.answerCallbackQuery(query.id, { text: '⚠️ إجراء غير معروف.' });
  } catch (err) {
    console.error('callback_query error:', err.message);
    try {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ حدث خطأ غير متوقع.' });
    } catch (e) {}
  }
});

console.log('🚀 XO Inline + Shop Bot يعمل الآن باستخدام @Bot play و /shop');
