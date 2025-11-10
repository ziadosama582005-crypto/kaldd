// ==================================================
// 🤖 XO BOT — Inline Play Only + Menu + Shop + Gifts + Bot AI
// ==================================================

require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.trim() : null;
if (!token) {
  console.error('❌ BOT_TOKEN غير موجود في البيئة!');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
let botUsername = null;

// ==================================================
// 🧾 اللاعبين
// ==================================================

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
      points: 0,
      coins: 0,
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

// ==================================================
// 🎨 المتجر (Skins)
// ==================================================

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

function escapeHTML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getTitle(p) {
  const pts = p.points || 0;
  if (pts >= 300) return '🔥 أسطورة XO';
  if (pts >= 150) return '👑 محترف XO';
  if (pts >= 50) return '🎯 لاعب نشيط';
  return '🌱 مبتدئ';
}

// ==================================================
// 🎮 لعبة XO
// ==================================================

function newBoard() {
  return [
    [' ', ' ', ' '],
    [' ', ' ', ' '],
    [' ', ' ', ' '],
  ];
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

function generateGameId() {
  return (
    'g_' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6)
  );
}

// ==================================================
// 🧠 حالات الألعاب
// ==================================================

// PvP inline games
// game = { id, inline_message_id, status, board, turn, pX, pO, p1, p2, icons:{X,O,empty} }
const games = {};

// vs Bot games
// botGame = { id, chatId, messageId, board, turn, userId, level }
const botGames = {};

// ==================================================
// 🏅 النقاط
// ==================================================

function awardPoints(game, winnerSymbol) {
  if (!game.pX || !game.pO) return;

  const pX = ensurePlayer({
    id: game.pX.id,
    first_name: game.pX.name,
    username: game.pX.username,
  });
  const pO = ensurePlayer({
    id: game.pO.id,
    first_name: game.pO.name,
    username: game.pO.username,
  });

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
  } else {
    pO.wins++;
    pX.losses++;
    pO.points += 10;
    pO.coins += 10;
  }

  savePlayers();
}

// ==================================================
// 🧩 رسم اللوحة حسب السكينات
// ==================================================

function buildIconsForGame(game) {
  const pXFull = ensurePlayer({
    id: game.pX.id,
    first_name: game.pX.name,
    username: game.pX.username,
  });
  const pOFull = ensurePlayer({
    id: game.pO.id,
    first_name: game.pO.name,
    username: game.pO.username,
  });

  const skinX = SHOP_SKINS[pXFull.activeSkin] || SHOP_SKINS.default;
  const skinO = SHOP_SKINS[pOFull.activeSkin] || SHOP_SKINS.default;

  game.icons = {
    X: skinX.icons.X,
    O: skinO.icons.O,
    empty: '⬜',
  };
}

function renderBoardInline(game) {
  return {
    inline_keyboard: game.board.map((row, i) =>
      row.map((cell, j) => {
        let txt = game.icons.empty;
        if (cell === 'X') txt = game.icons.X;
        else if (cell === 'O') txt = game.icons.O;
        return {
          text: txt,
          callback_data: `mv:${game.id}:${i}:${j}`,
        };
      })
    ),
  };
}

// ==================================================
// 🏠 القائمة الرئيسية
// ==================================================

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🤖 اللعب مع بوت', callback_data: 'menu:bot' }],
      [{ text: '👥 اللعب مع صديق', callback_data: 'menu:friend' }],
      [
        { text: '🏦 البنك', callback_data: 'menu:bank' },
        { text: '🌍 المتصدرين', callback_data: 'menu:board' },
      ],
      [{ text: '🛍 المتجر', callback_data: 'menu:shop' }],
      [{ text: '🎁 هدية', callback_data: 'menu:gift' }],
      [{ text: 'ℹ️ مساعدة', callback_data: 'menu:help' }],
    ],
  };
}

function backHomeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🏠 رجوع للقائمة الرئيسية', callback_data: 'menu:home' }],
    ],
  };
}

function sendMainMenu(chatId, name) {
  const text =
    '👋 أهلاً <b>' +
    escapeHTML(name || '') +
    '</b>\n' +
    'كل شيء الآن من الأزرار و @' +
    escapeHTML(botUsername || 'Bot') +
    ' play:\n\n' +
    '🤖 اللعب مع البوت\n' +
    '👥 اللعب مع صديق (تحديات inline)\n' +
    '🛍 متجر السكينات\n' +
    '🏦 البنك الذهبي\n' +
    '🌍 لوحة المتصدرين\n' +
    '🎁 هدايا بين اللاعبين\n';

  return bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: mainMenuKeyboard(),
  });
}

// ==================================================
// 🛍 المتجر
// ==================================================

function buildShopKeyboard(user) {
  const rows = [];

  Object.values(SHOP_SKINS).forEach((skin) => {
    const owned = user.ownedSkins.includes(skin.id);
    const active = user.activeSkin === skin.id;

    if (skin.id === 'default') {
      rows.push([
        {
          text: active ? `${skin.name} ✅` : `${skin.name}`,
          callback_data: 'shop:none:default',
        },
      ]);
    } else if (!owned) {
      rows.push([
        {
          text: `${skin.name} — ${skin.price}💰`,
          callback_data: `shop:buy:${skin.id}`,
        },
      ]);
    } else if (active) {
      rows.push([
        {
          text: `${skin.name} (مفعل ✅)`,
          callback_data: `shop:none:${skin.id}`,
        },
      ]);
    } else {
      rows.push([
        {
          text: `تفعيل ${skin.name}`,
          callback_data: `shop:use:${skin.id}`,
        },
      ]);
    }
  });

  rows.push([
    { text: '🏠 رجوع', callback_data: 'menu:home' },
  ]);

  return { inline_keyboard: rows };
}

function sendShop(chatId, user) {
  const text =
    '🛍 <b>متجر السكينات</b>\n' +
    `💰 رصيدك: <code>${user.coins}</code> عملة\n\n` +
    'اختر سكين للشراء أو التفعيل:';

  return bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: buildShopKeyboard(user),
  });
}

// ==================================================
// 🚀 جاهزية البوت
// ==================================================

bot.getMe().then((me) => {
  botUsername = me.username;
  console.log(`✅ البوت جاهز: @${botUsername}`);

  bot.setMyCommands([
    { command: 'start', description: 'القائمة الرئيسية' },
    { command: 'profile', description: 'عرض ملفك الشخصي' },
    { command: 'board', description: 'لوحة المتصدرين' },
    { command: 'shop', description: 'متجر السكينات' },
    { command: 'gift', description: 'إرسال هدية عملات' },
    { command: 'bank', description: 'البنك الذهبي' },
    { command: 'bot', description: 'تحدي البوت' },
  ]);
});

// ==================================================
// /start — خاص فقط
// ==================================================

bot.onText(/\/start(?:\s+.*)?/, (msg) => {
  if (msg.chat.type !== 'private') return;
  const p = ensurePlayer(msg.from);
  sendMainMenu(msg.chat.id, p.name);
});

// ==================================================
// /profile
// ==================================================

bot.onText(/^\/(?:profile|ملفي)(?:@\w+)?$/, (msg) => {
  const p = ensurePlayer(msg.from);
  const title = getTitle(p);

  const text =
    `👤 <b>${escapeHTML(p.name)}</b>\n` +
    `🏆 اللقب: <b>${title}</b>\n` +
    `🏅 النقاط: <code>${p.points}</code>\n` +
    `💰 العملات: <code>${p.coins}</code>\n` +
    `✅ الفوز: <code>${p.wins}</code> | ❌ <code>${p.losses}</code> | 🤝 <code>${p.draws}</code>\n` +
    `🎨 السكين النشط: <b>${(SHOP_SKINS[p.activeSkin] && SHOP_SKINS[p.activeSkin].name) || '🎲 النمط العادي'}</b>`;

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'HTML',
    reply_markup: backHomeKeyboard(),
  });
});

// ==================================================
// /board
// ==================================================

bot.onText(/^\/(?:board|اللوحة)(?:@\w+)?$/, (msg) => {
  const list = Object.values(players)
    .sort((a, b) => (b.points || 0) - (a.points || 0));

  if (!list.length) {
    return bot.sendMessage(
      msg.chat.id,
      'لا توجد بيانات بعد.\nابدأ أول تحدي عبر @' + botUsername + ' play'
    );
  }

  const top = list.slice(0, 20);
  const lines = top.map(
    (p, i) => `${i + 1}. ${p.name} — ${p.points} نقطة (${getTitle(p)})`
  );

  bot.sendMessage(msg.chat.id, '🌍 التصنيف العالمي:\n' + lines.join('\n'), {
    reply_markup: backHomeKeyboard(),
  });
});

// ==================================================
// /bank
// ==================================================

bot.onText(/^\/(?:bank|wallet|بنك)(?:@\w+)?$/, (msg) => {
  const p = ensurePlayer(msg.from);
  const text =
    '🏦 <b>البنك الذهبي</b>\n' +
    `👤 ${escapeHTML(p.name)}\n\n` +
    `🏅 نقاطك: <code>${p.points}</code>\n` +
    `💰 عملاتك: <code>${p.coins}</code>\n\n` +
    '💡 اربح العملات من الفوز ووزعها كهدايا أو اشترِ سكينات.\n' +
    'لن يُسمح لك بالدخول في رهانات إذا رصيدك لا يكفي.';

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'HTML',
    reply_markup: backHomeKeyboard(),
  });
});

// ==================================================
// /shop
// ==================================================

bot.onText(/^\/shop(?:@\w+)?$/, (msg) => {
  const p = ensurePlayer(msg.from);
  sendShop(msg.chat.id, p);
});

// ==================================================
// /gift @user amount
// ==================================================

bot.onText(/^\/gift(?:@\w+)?\s+(\S+)\s+(\d+)$/, (msg, match) => {
  const fromPlayer = ensurePlayer(msg.from);
  const targetRef = (match[1] || '').trim();
  const amount = parseInt(match[2], 10);

  if (!amount || amount <= 0) {
    return bot.sendMessage(msg.chat.id, '❌ قيمة غير صالحة.');
  }
  if (fromPlayer.coins < amount) {
    return bot.sendMessage(msg.chat.id, '💰 رصيدك لا يكفي.');
  }

  let targetPlayer = null;

  if (targetRef.startsWith('@')) {
    const uname = targetRef.slice(1).toLowerCase();
    targetPlayer = Object.values(players).find(
      (p) => p.username && p.username.toLowerCase() === uname
    );
  } else if (/^\d+$/.test(targetRef)) {
    targetPlayer = players[targetRef] || null;
  }

  if (!targetPlayer) {
    return bot.sendMessage(
      msg.chat.id,
      '❌ اللاعب غير موجود في النظام أو لم يستخدم البوت بعد.'
    );
  }

  if (targetPlayer.id === fromPlayer.id) {
    return bot.sendMessage(msg.chat.id, '❌ لا يمكنك إهداء نفسك.');
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

// ==================================================
// /bot — فتح قائمة مستويات البوت
// ==================================================

bot.onText(/^\/(?:bot|ai|solo)(?:@\w+)?$/, (msg) => {
  const p = ensurePlayer(msg.from);
  const chatId = msg.chat.id;

  const text =
    '🤖 <b>تحدي البوت</b>\n' +
    'اختر مستوى الصعوبة:';

  bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🟢 سهل', callback_data: `botlvl:easy:${p.id}` },
          { text: '🟡 متوسط', callback_data: `botlvl:medium:${p.id}` },
          { text: '🔴 صعب', callback_data: `botlvl:hard:${p.id}` },
        ],
        [{ text: '🏠 رجوع', callback_data: 'menu:home' }],
      ],
    },
  });
});

// ==================================================
// 🎮 Inline Mode — @Bot play
// ==================================================

bot.on('inline_query', async (query) => {
  try {
    const q = (query.query || '').trim().toLowerCase();

    if (!q || q === 'play' || q === 'xo') {
      const baseId = generateGameId();
      const fromName = query.from.first_name || query.from.username || 'لاعب';

      const textX =
        `🎮 بدء لعبة XO\n` +
        `❌ أنت اللاعب الأول (${fromName})\n` +
        `أرسل الدعوة ثم دَع صديقك يضغط زر الانضمام ليكون ⭕.\n`;
      const textO =
        `🎮 بدء لعبة XO\n` +
        `⭕ أنت اللاعب الأول (${fromName})\n` +
        `أرسل الدعوة ثم دَع صديقك يضغط زر الانضمام ليكون ❌.\n`;

      const resultX = {
        type: 'article',
        id: `${baseId}:X`,
        title: 'بدء لعبة XO (أنت ❌)',
        description: 'أرسل التحدي ثم انتظر خصمك',
        input_message_content: { message_text: textX },
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 انضم كخصم', callback_data: `join:${baseId}` }],
          ],
        },
      };

      const resultO = {
        type: 'article',
        id: `${baseId}:O`,
        title: 'بدء لعبة XO (أنت ⭕)',
        description: 'أرسل التحدي ثم انتظر خصمك',
        input_message_content: { message_text: textO },
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 انضم كخصم', callback_data: `join:${baseId}` }],
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

// عند إرسال نتيجة inline فعلياً
bot.on('chosen_inline_result', async (res) => {
  try {
    const { result_id, from, inline_message_id } = res;
    if (!result_id || !inline_message_id) return;

    const [gameId, symbol] = result_id.split(':');
    if (!gameId || (symbol !== 'X' && symbol !== 'O')) return;

    const p1 = {
      id: from.id,
      name: from.first_name || from.username || 'لاعب',
      username: from.username || null,
    };
    ensurePlayer(from);

    games[gameId] = {
      id: gameId,
      inline_message_id,
      status: 'waiting_opponent',
      board: newBoard(),
      turn: null,
      pX: symbol === 'X' ? p1 : null,
      pO: symbol === 'O' ? p1 : null,
      p1,
      p2: null,
      icons: {
        X: '❌',
        O: '⭕',
        empty: '⬜',
      },
    };

    const mySymbol = symbol === 'X' ? '❌' : '⭕';
    const oppSymbol = symbol === 'X' ? '⭕' : '❌';

    const text =
      `🎮 تحدي XO جديد\n` +
      `${mySymbol} ${p1.name} هو اللاعب الأول.\n` +
      `👤 أول شخص يضغط الزر يصبح ${oppSymbol} الخصم.\n`;

    await bot.editMessageText(text, {
      inline_message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 انضم كخصم', callback_data: `join:${gameId}` }],
        ],
      },
    });
  } catch (err) {
    console.error('chosen_inline_result error:', err.message);
  }
});

// ==================================================
// 🧠 ذكاء البوت البسيط
// ==================================================

function getAvailableMoves(board) {
  const moves = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i][j] === ' ') moves.push([i, j]);
    }
  }
  return moves;
}

function botSmartMove(board, botSymbol, humanSymbol) {
  // حاول الفوز
  for (const [i, j] of getAvailableMoves(board)) {
    board[i][j] = botSymbol;
    if (checkWinner(board) === botSymbol) {
      board[i][j] = ' ';
      return [i, j];
    }
    board[i][j] = ' ';
  }
  // حاول صد الفوز
  for (const [i, j] of getAvailableMoves(board)) {
    board[i][j] = humanSymbol;
    if (checkWinner(board) === humanSymbol) {
      board[i][j] = ' ';
      return [i, j];
    }
    board[i][j] = ' ';
  }
  // غير ذلك عشوائي
  const moves = getAvailableMoves(board);
  if (!moves.length) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}

function getBotMove(board, level) {
  const moves = getAvailableMoves(board);
  if (!moves.length) return null;
  if (level === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  if (level === 'medium') {
    const best = botSmartMove(board, 'O', 'X');
    return best || moves[Math.floor(Math.random() * moves.length)];
  }
  // hard
  const best = botSmartMove(board, 'O', 'X');
  return best || moves[Math.floor(Math.random() * moves.length)];
}

// ==================================================
// 🎯 Callback Query Handler واحد
// ==================================================

bot.on('callback_query', async (query) => {
  const { from, data, message, inline_message_id, id } = query;
  if (!data) {
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  const user = ensurePlayer(from);

  // ========== MENUS ==========
  if (data === 'menu:home') {
    if (message) {
      await bot.editMessageText('🏠 القائمة الرئيسية', {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'HTML',
        reply_markup: mainMenuKeyboard(),
      }).catch(() => {});
    } else if (inline_message_id && from.id) {
      await sendMainMenu(from.id, user.name).catch(() => {});
    }
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  if (data === 'menu:bot') {
    if (message) {
      const txt =
        '🤖 <b>تحدي البوت</b>\nاختر مستوى الصعوبة:';
      await bot.editMessageText(txt, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🟢 سهل', callback_data: `botlvl:easy:${user.id}` },
              { text: '🟡 متوسط', callback_data: `botlvl:medium:${user.id}` },
              { text: '🔴 صعب', callback_data: `botlvl:hard:${user.id}` },
            ],
            [{ text: '🏠 رجوع', callback_data: 'menu:home' }],
          ],
        },
      }).catch(() => {});
    }
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  if (data === 'menu:friend') {
    if (message) {
      const txt =
        '👥 <b>اللعب مع صديق</b>\n' +
        'في أي قروب أو خاص اكتب:\n' +
        `<code>@${botUsername} play</code>\n` +
        'ثم اختر أن تكون ❌ أو ⭕ من الاقتراحات.\n' +
        'بعد الإرسال، أول من يضغط زر "انضم كخصم" يصبح اللاعب الثاني.';
      await bot.editMessageText(txt, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'HTML',
        reply_markup: backHomeKeyboard(),
      }).catch(() => {});
    }
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  if (data === 'menu:bank') {
    if (message) {
      const txt =
        '🏦 <b>البنك الذهبي</b>\n' +
        `👤 ${escapeHTML(user.name)}\n\n` +
        `🏅 نقاطك: <code>${user.points}</code>\n` +
        `💰 عملاتك: <code>${user.coins}</code>`;
      await bot.editMessageText(txt, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'HTML',
        reply_markup: backHomeKeyboard(),
      }).catch(() => {});
    }
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  if (data === 'menu:board') {
    const list = Object.values(players)
      .sort((a, b) => (b.points || 0) - (a.points || 0));
    let txt;
    if (!list.length) {
      txt = 'لا توجد بيانات بعد.\nابدأ أول تحدي عبر @' + botUsername + ' play';
    } else {
      const top = list.slice(0, 20);
      const lines = top.map(
        (p, i) => `${i + 1}. ${p.name} — ${p.points} نقطة (${getTitle(p)})`
      );
      txt = '🌍 التصنيف العالمي:\n' + lines.join('\n');
    }
    if (message) {
      await bot.editMessageText(txt, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        reply_markup: backHomeKeyboard(),
      }).catch(() => {});
    }
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  if (data === 'menu:shop') {
    if (message) {
      await bot.editMessageText(
        '🛍 المتجر',
        {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: buildShopKeyboard(user),
          parse_mode: 'HTML',
        }
      ).catch(() => {});
    }
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  if (data === 'menu:gift') {
    if (message) {
      const txt =
        '🎁 <b>الهدايا</b>\n' +
        'استخدم الأمر:\n' +
        '<code>/gift @username 10</code>\n' +
        'لإهداء عملات لصديقك.\n';
      await bot.editMessageText(txt, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'HTML',
        reply_markup: backHomeKeyboard(),
      }).catch(() => {});
    }
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  if (data === 'menu:help') {
    if (message) {
      const txt =
        'ℹ️ <b>مساعدة سريعة</b>\n' +
        '• اللعب مع صديق: @' + botUsername + ' play\n' +
        '• اللعب مع بوت: من القائمة أو /bot\n' +
        '• المتجر: شراء سكينات وتأثيرات.\n' +
        '• الهدايا: /gift @user amount\n' +
        '• لوحة المتصدرين: /board\n';
      await bot.editMessageText(txt, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'HTML',
        reply_markup: backHomeKeyboard(),
      }).catch(() => {});
    }
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  // ========== SHOP ==========
  if (data.startsWith('shop:')) {
    const parts = data.split(':'); // shop:action:skinId
    const action = parts[1];
    const skinId = parts[2];
    const chatId = message ? message.chat.id : null;

    if (!SHOP_SKINS[skinId]) {
      await bot.answerCallbackQuery(id, {
        text: '❌ هذا السكين غير موجود.',
        show_alert: true,
      }).catch(() => {});
      return;
    }

    if (action === 'buy') {
      const skin = SHOP_SKINS[skinId];
      if (user.ownedSkins.includes(skinId)) {
        await bot.answerCallbackQuery(id, { text: '✅ تملكه بالفعل.' }).catch(() => {});
        return;
      }
      if (user.coins < skin.price) {
        await bot.answerCallbackQuery(id, {
          text: '💰 رصيدك لا يكفي.',
          show_alert: true,
        }).catch(() => {});
        return;
      }
      user.coins -= skin.price;
      if (!user.ownedSkins.includes(skinId)) user.ownedSkins.push(skinId);
      savePlayers();
      if (chatId) {
        await bot.editMessageReplyMarkup(buildShopKeyboard(user), {
          chat_id: chatId,
          message_id: message.message_id,
        }).catch(() => {});
      }
      await bot.answerCallbackQuery(id, {
        text: `✅ تم شراء ${skin.name}.`,
      }).catch(() => {});
      return;
    }

    if (action === 'use') {
      if (!user.ownedSkins.includes(skinId)) {
        await bot.answerCallbackQuery(id, {
          text: '❌ لم تشتر هذا السكين بعد.',
          show_alert: true,
        }).catch(() => {});
        return;
      }
      user.activeSkin = skinId;
      savePlayers();
      if (chatId) {
        await bot.editMessageReplyMarkup(buildShopKeyboard(user), {
          chat_id: chatId,
          message_id: message.message_id,
        }).catch(() => {});
      }
      await bot.answerCallbackQuery(id, {
        text: `🎨 تم تفعيل ${SHOP_SKINS[skinId].name}.`,
      }).catch(() => {});
      return;
    }

    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  // ========== JOIN PvP ==========
  if (data.startsWith('join:')) {
    const gameId = data.split(':')[1];
    const game = games[gameId];

    if (!game || game.status !== 'waiting_opponent') {
      await bot.answerCallbackQuery(id, {
        text: '❌ هذا التحدي غير متاح الآن.',
        show_alert: false,
      }).catch(() => {});
      return;
    }

    if (from.id === game.p1.id) {
      await bot.answerCallbackQuery(id, {
        text: '⚠️ لا يمكنك أن تكون خصم نفسك.',
        show_alert: false,
      }).catch(() => {});
      return;
    }

    if (game.p2) {
      await bot.answerCallbackQuery(id, {
        text: '⚠️ الخصم تم اختياره بالفعل.',
        show_alert: false,
      }).catch(() => {});
      return;
    }

    // تسجيل الخصم
    const p2 = {
      id: from.id,
      name: from.first_name || from.username || 'لاعب',
      username: from.username || null,
    };
    ensurePlayer(from);
    game.p2 = p2;

    // من هو X ومن هو O؟
    if (!game.pX) game.pX = p2;
    else game.pO = p2;

    game.status = 'playing';
    game.turn = 'X';

    // بناء السكينات
    buildIconsForGame(game);

    const header =
      `🎮 لعبة XO بدأت!\n` +
      `❌ ${game.pX.name}\n` +
      `⭕ ${game.pO.name}\n` +
      `🎯 دور ${game.turn === 'X' ? game.pX.name : game.pO.name}`;

    await bot.editMessageText(header, {
      inline_message_id: game.inline_message_id,
      reply_markup: renderBoardInline(game),
    }).catch(() => {});

    await bot.answerCallbackQuery(id, {
      text: `✅ أصبحت الخصم!`,
      show_alert: false,
    }).catch(() => {});
    return;
  }

  // ========== حركات PvP mv: ==========
  if (data.startsWith('mv:')) {
    const [, gameId, si, sj] = data.split(':');
    const i = Number(si);
    const j = Number(sj);
    const game = games[gameId];

    if (!game || game.status !== 'playing') {
      await bot.answerCallbackQuery(id, {
        text: '❌ لا توجد لعبة نشطة.',
        show_alert: false,
      }).catch(() => {});
      return;
    }

    // تأكد أن هذا من نفس رسالة الـ inline
    if (inline_message_id && inline_message_id !== game.inline_message_id) {
      await bot.answerCallbackQuery(id).catch(() => {});
      return;
    }

    if (!game.board[i] || game.board[i][j] === undefined) {
      await bot.answerCallbackQuery(id, { text: '⚠️ حركة غير صالحة.' }).catch(() => {});
      return;
    }
    if (game.board[i][j] !== ' ') {
      await bot.answerCallbackQuery(id, { text: '❗ هذه الخانة مشغولة.' }).catch(() => {});
      return;
    }

    const currentId = game.turn === 'X' ? game.pX.id : game.pO.id;
    if (from.id !== currentId) {
      await bot.answerCallbackQuery(id, { text: '⚠️ ليس دورك الآن.' }).catch(() => {});
      return;
    }

    game.board[i][j] = game.turn;

    const winner = checkWinner(game.board);
    const full = game.board.flat().every((c) => c !== ' ');

    if (winner || full) {
      game.status = 'finished';
      let txt;
      if (winner) {
        const winPlayer = winner === 'X' ? game.pX : game.pO;
        awardPoints(game, winner);
        txt =
          `🏆 انتهت المباراة!\n` +
          `الفائز: ${winPlayer.name} (${winner === 'X' ? '❌' : '⭕'})`;
      } else {
        awardPoints(game, null);
        txt = '🤝 انتهت المباراة بالتعادل!';
      }

      await bot.editMessageText(txt, {
        inline_message_id: game.inline_message_id,
        reply_markup: renderBoardInline(game),
      }).catch(() => {});

      delete games[gameId];
      await bot.answerCallbackQuery(id).catch(() => {});
      return;
    }

    // استمرار اللعبة
    game.turn = game.turn === 'X' ? 'O' : 'X';
    const turnName = game.turn === 'X' ? game.pX.name : game.pO.name;

    const header =
      `🎮 لعبة XO\n` +
      `❌ ${game.pX.name} — ⭕ ${game.pO.name}\n` +
      `🎯 دور ${turnName}`;

    await bot.editMessageText(header, {
      inline_message_id: game.inline_message_id,
      reply_markup: renderBoardInline(game),
    }).catch(() => {});

    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  // ========== botlvl: اختيار مستوى البوت ==========
  if (data.startsWith('botlvl:')) {
    const [, level, userId] = data.split(':');
    if (String(from.id) !== String(userId)) {
      await bot.answerCallbackQuery(id, {
        text: '⚠️ هذا الاختيار لصاحب الطلب فقط.',
      }).catch(() => {});
      return;
    }
    if (!message) {
      await bot.answerCallbackQuery(id).catch(() => {});
      return;
    }
    const gameId = 'b_' + generateGameId();
    const board = newBoard();
    botGames[gameId] = {
      id: gameId,
      chatId: message.chat.id,
      messageId: message.message_id,
      board,
      turn: 'X', // اللاعب دائماً X
      userId: from.id,
      level,
    };

    const txt =
      `🤖 تحدي البوت (${level})\n` +
      `أنت ❌ ، البوت ⭕\n` +
      'ابدأ بالضغط على أي خانة.';

    const icons = SHOP_SKINS[ensurePlayer(from).activeSkin] || SHOP_SKINS.default;

    const reply_markup = {
      inline_keyboard: board.map((row, i) =>
        row.map((cell, j) => ({
          text: cell === ' ' ? icons.icons.empty : cell,
          callback_data: `botmv:${gameId}:${i}:${j}`,
        }))
      ),
    };

    await bot.editMessageText(txt, {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reply_markup,
    }).catch(() => {});

    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  // ========== botmv: حركات ضد البوت ==========
  if (data.startsWith('botmv:')) {
    const [, gameId, si, sj] = data.split(':');
    const i = Number(si);
    const j = Number(sj);
    const game = botGames[gameId];

    if (!game) {
      await bot.answerCallbackQuery(id, { text: '❌ لا توجد لعبة.', show_alert: false }).catch(() => {});
      return;
    }
    if (!message || message.chat.id !== game.chatId) {
      await bot.answerCallbackQuery(id).catch(() => {});
      return;
    }
    if (from.id !== game.userId) {
      await bot.answerCallbackQuery(id, {
        text: '⚠️ هذه المباراة ليست لك.',
        show_alert: false,
      }).catch(() => {});
      return;
    }
    if (game.board[i][j] !== ' ' || game.turn !== 'X') {
      await bot.answerCallbackQuery(id, { text: '⚠️ حركة غير صالحة.' }).catch(() => {});
      return;
    }

    // حركة اللاعب
    game.board[i][j] = 'X';

    let winner = checkWinner(game.board);
    let full = game.board.flat().every((c) => c !== ' ');

    const p = ensurePlayer(from);

    const icons = SHOP_SKINS[p.activeSkin] || SHOP_SKINS.default;
    function buildBotKeyboard() {
      return {
        inline_keyboard: game.board.map((row, ii) =>
          row.map((cell, jj) => ({
            text:
              cell === ' '
                ? icons.icons.empty
                : cell === 'X'
                ? icons.icons.X
                : '⭕',
            callback_data: `botmv:${gameId}:${ii}:${jj}`,
          }))
        ),
      };
    }

    if (winner || full) {
      let txt;
      if (winner === 'X') {
        p.points += 5;
        p.coins += 5;
        p.wins += 1;
        txt = '🏆 فزت على البوت! (+5 نقاط)';
      } else if (winner === 'O') {
        p.losses += 1;
        txt = '😅 البوت فاز عليك!';
      } else {
        p.draws += 1;
        p.coins += 1;
        txt = '🤝 تعادل مع البوت (+1 عملة).';
      }
      savePlayers();
      await bot.editMessageText(txt, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        reply_markup: buildBotKeyboard(),
      }).catch(() => {});
      delete botGames[gameId];
      await bot.answerCallbackQuery(id).catch(() => {});
      return;
    }

    // دور البوت
    game.turn = 'O';
    const [bi, bj] = getBotMove(game.board, game.level) || [];
    if (bi !== undefined && game.board[bi][bj] === ' ') {
      game.board[bi][bj] = 'O';
    }

    winner = checkWinner(game.board);
    full = game.board.flat().every((c) => c !== ' ');

    if (winner || full) {
      let txt;
      if (winner === 'X') {
        p.points += 5;
        p.coins += 5;
        p.wins += 1;
        txt = '🏆 فزت على البوت! (+5 نقاط)';
      } else if (winner === 'O') {
        p.losses += 1;
        txt = '😅 البوت فاز عليك!';
      } else {
        p.draws += 1;
        p.coins += 1;
        txt = '🤝 تعادل مع البوت (+1 عملة).';
      }
      savePlayers();
      await bot.editMessageText(txt, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        reply_markup: buildBotKeyboard(),
      }).catch(() => {});
      delete botGames[gameId];
      await bot.answerCallbackQuery(id).catch(() => {});
      return;
    }

    // استمرار
    game.turn = 'X';
    const txt =
      `🤖 تحدي البوت (${game.level})\n` +
      'أنت ❌ ، البوت ⭕\n' +
      '🎯 دورك الآن.';

    await bot.editMessageText(txt, {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reply_markup: buildBotKeyboard(),
    }).catch(() => {});
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  // أي شيء غير معروف
  await bot.answerCallbackQuery(id, { text: '⚠️ إجراء غير معروف.' }).catch(() => {});
});

console.log('🚀 XO Inline Play Bot يعمل باستخدام @Bot play فقط مع قائمة وأزرار ومتجر وهدايا وبوت AI');
