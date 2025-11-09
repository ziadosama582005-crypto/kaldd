// ==================================================
// 🤖 XO BOT — نسخة مبسّطة: اللعب فقط عبر @Bot play
// ==================================================

require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// ==================================================
// 🔐 تحميل التوكن من البيئة
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
      wins: 0,
      losses: 0,
      draws: 0,
    };
  } else {
    players[id].name = user.first_name || user.username || players[id].name;
    players[id].points = players[id].points || 0;
    players[id].wins = players[id].wins || 0;
    players[id].losses = players[id].losses || 0;
    players[id].draws = players[id].draws || 0;
  }
  return players[id];
}

loadPlayers();

// ==================================================
// 🎮 لوحة XO
function newBoard() {
  return [
    [' ', ' ', ' '],
    [' ', ' ', ' '],
    [' ', ' ', ' '],
  ];
}

function renderBoardInline(gameId, board) {
  return {
    inline_keyboard: board.map((row, i) =>
      row.map((cell, j) => ({
        text: cell === ' ' ? '⬜' : cell === 'X' ? '❌' : '⭕',
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
// 🧠 إدارة الألعاب
// game = { id, inline_message_id, board, turn, pX, pO, status }
const games = {};

function generateGameId() {
  return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function awardPoints(game, winnerSymbol) {
  if (!game.pX || !game.pO) return;
  const pX = ensurePlayer({ id: game.pX.id, first_name: game.pX.name });
  const pO = ensurePlayer({ id: game.pO.id, first_name: game.pO.name });

  if (!winnerSymbol) {
    pX.draws++;
    pO.draws++;
  } else if (winnerSymbol === 'X') {
    pX.wins++;
    pX.points += 10;
    pO.losses++;
  } else if (winnerSymbol === 'O') {
    pO.wins++;
    pO.points += 10;
    pX.losses++;
  }
  savePlayers();
}

// ==================================================
// 🔔 جاهزية البوت + أوامر بسيطة
bot.getMe().then((me) => {
  botUsername = me.username;
  console.log(`✅ البوت جاهز: @${botUsername}`);

  bot.setMyCommands([
    { command: 'start', description: 'شرح استخدام البوت' },
    { command: 'profile', description: 'عرض ملفك الشخصي' },
    { command: 'board', description: 'عرض قائمة المتصدرين' },
  ]);
});

// ==================================================
// /start — في الخاص فقط
bot.onText(/\/start(?:\s+(.+))?/, (msg) => {
  if (msg.chat.type !== 'private') return;
  const player = ensurePlayer(msg.from);

  const text =
    '👋 أهلاً <b>' + escapeHTML(player.name) + '</b>\n' +
    'كل اللعب الآن يتم عبر <b>Inline Mode</b> فقط.\n\n' +
    '⚙️ الطريقة:\n' +
    '1️⃣ في أي قروب أو خاص اكتب: <code>@' + escapeHTML(botUsername) + ' play</code>\n' +
    '2️⃣ اختر بطاقة "بدء لعبة XO".\n' +
    '3️⃣ أرسلها، أول لاعب يختار ❌، والثاني يختار ⭕.\n' +
    '4️⃣ العبوا من نفس الرسالة عن طريق الأزرار.\n\n' +
    '🏅 يوجد نظام نقاط وانتصارات وخسائر وتعادلات.\n' +
    'استخدم /profile لعرض ملفك و /board لعرض المتصدرين.';

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ==================================================
// /profile — ملف اللاعب
bot.onText(/^\/(?:profile|ملفي)(?:@\w+)?$/, (msg) => {
  const p = ensurePlayer(msg.from);
  const text =
    `👤 <b>${escapeHTML(p.name)}</b>\n` +
    `🏅 النقاط: <code>${p.points}</code>\n` +
    `✅ الانتصارات: <code>${p.wins}</code>\n` +
    `❌ الخسائر: <code>${p.losses}</code>\n` +
    `🤝 التعادلات: <code>${p.draws}</code>`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ==================================================
// /board — المتصدرين
bot.onText(/^\/(?:board|اللوحة)(?:@\w+)?$/, (msg) => {
  const list = Object.values(players).sort((a, b) => (b.points || 0) - (a.points || 0));
  if (!list.length) {
    return bot.sendMessage(
      msg.chat.id,
      'لا توجد بيانات بعد.\nابدأ أول مباراة عبر @' + botUsername + ' play'
    );
  }
  const top = list.slice(0, 20);
  const lines = top.map(
    (p, i) =>
      `${i + 1}. ${p.name} — ${p.points} نقطة (فوز:${p.wins} / خسارة:${p.losses} / تعادل:${p.draws})`
  );
  bot.sendMessage(msg.chat.id, '📊 لوحة المتصدرين:\n' + lines.join('\n'));
});

// ==================================================
// 🎮 Inline Mode — @Bot play
bot.on('inline_query', async (query) => {
  try {
    const q = (query.query || '').trim().toLowerCase();

    if (!q || q === 'play' || q === 'xo') {
      const gameId = generateGameId();
      games[gameId] = {
        id: gameId,
        inline_message_id: null,
        board: newBoard(),
        turn: null,
        pX: null,
        pO: null,
        status: 'waiting',
      };

      const text =
        '🎮 لعبة XO جاهزة!\n' +
        'اختر ❌ أو ⭕ للانضمام.\n' +
        'أول لاعبين ينضمون تُبدأ بينهم المباراة.';

      const result = {
        type: 'article',
        id: gameId,
        title: 'بدء لعبة XO',
        description: 'أرسل الدعوة ثم اختر ❌ أو ⭕ مع صديقك',
        input_message_content: { message_text: text },
        reply_markup: {
          inline_keyboard: [
            [
              { text: '❌ اختر هذا', callback_data: `pick:${gameId}:X` },
              { text: '⭕ اختر هذا', callback_data: `pick:${gameId}:O` },
            ],
          ],
        },
      };

      await bot.answerInlineQuery(query.id, [result], {
        cache_time: 0,
        is_personal: false,
      });
    } else {
      await bot.answerInlineQuery(query.id, [], {
        switch_pm_text: 'اكتب play لبدء لعبة XO',
        switch_pm_parameter: 'start',
      });
    }
  } catch (err) {
    console.error('inline_query error:', err.message);
  }
});

// ==================================================
// 🎯 التعامل مع أزرار الاختيار والحركات
bot.on('callback_query', async (query) => {
  const { from, data, inline_message_id, message } = query;

  // ---------------- اختيار الرمز ----------------
  if (data && data.startsWith('pick:')) {
    const [, gameId, symbol] = data.split(':'); // pick:gameId:X
    const game = games[gameId];

    if (!game) {
      await bot.answerCallbackQuery(query.id, { text: '❌ اللعبة انتهت أو غير موجودة.' });
      return;
    }
    if (game.status !== 'waiting') {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ تم بدء اللعبة بالفعل.' });
      return;
    }

    // حفظ inline_message_id أول مرة
    if (!game.inline_message_id) {
      if (inline_message_id) {
        game.inline_message_id = inline_message_id;
      } else if (message) {
        game.chatId = message.chat.id;
        game.messageId = message.message_id;
      }
    }

    if (symbol !== 'X' && symbol !== 'O') {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ اختيار غير صحيح.' });
      return;
    }

    // هل الرمز مأخوذ؟
    if ((symbol === 'X' && game.pX) || (symbol === 'O' && game.pO)) {
      await bot.answerCallbackQuery(query.id, { text: '🚫 هذا الرمز مأخوذ بالفعل.' });
      return;
    }

    // هل اللاعب حجز من قبل؟
    if ((game.pX && game.pX.id === from.id) || (game.pO && game.pO.id === from.id)) {
      await bot.answerCallbackQuery(query.id, { text: '✅ أنت مشارك بالفعل.' });
      return;
    }

    const player = {
      id: from.id,
      name: from.first_name || from.username || 'لاعب',
    };
    ensurePlayer(from);

    if (symbol === 'X') game.pX = player;
    if (symbol === 'O') game.pO = player;

    await bot.answerCallbackQuery(query.id, {
      text: `✅ انضممت بالرمز ${symbol === 'X' ? '❌' : '⭕'}`,
      show_alert: false,
    });

    const target = game.inline_message_id
      ? { inline_message_id: game.inline_message_id }
      : { chat_id: game.chatId, message_id: game.messageId };

    // حالة: لاعب واحد فقط
    if (game.pX && !game.pO) {
      const txt = `🎮 لعبة XO\n❌ ${game.pX.name} انضم\n🕓 بانتظار لاعب يختار ⭕`;
      try {
        await bot.editMessageText(txt, {
          ...target,
          reply_markup: {
            inline_keyboard: [
              [{ text: '⭕ انضم كلاعب ثاني', callback_data: `pick:${gameId}:O` }],
            ],
          },
        });
      } catch (_) {}
      return;
    }

    if (game.pO && !game.pX) {
      const txt = `🎮 لعبة XO\n⭕ ${game.pO.name} انضم\n🕓 بانتظار لاعب يختار ❌`;
      try {
        await bot.editMessageText(txt, {
          ...target,
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ انضم كلاعب أول', callback_data: `pick:${gameId}:X` }],
            ],
          },
        });
      } catch (_) {}
      return;
    }

    // حالة: لاعبان جاهزان → نبدأ اللعبة
    if (game.pX && game.pO) {
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
          reply_markup: renderBoardInline(gameId, game.board),
        });
      } catch (_) {}
    }
    return;
  }

  // ---------------- تنفيذ حركة mv:gameId:i:j ----------------
  if (data && data.startsWith('mv:')) {
    const [, gameId, si, sj] = data.split(':');
    const i = Number(si);
    const j = Number(sj);
    const game = games[gameId];

    if (!game || game.status !== 'playing') {
      await bot.answerCallbackQuery(query.id, { text: '❌ لا توجد لعبة نشطة.' });
      return;
    }

    const target = game.inline_message_id
      ? { inline_message_id: game.inline_message_id }
      : { chat_id: game.chatId, message_id: game.messageId };

    if (!game.board[i] || game.board[i][j] === undefined) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ حركة غير صالحة.' });
      return;
    }
    if (game.board[i][j] !== ' ') {
      await bot.answerCallbackQuery(query.id, { text: '❗ هذه الخانة مشغولة.' });
      return;
    }

    // تحقق من أن اللاعب الصحيح يلعب
    const expectedId =
      game.turn === 'X'
        ? (game.pX && game.pX.id)
        : (game.pO && game.pO.id);

    if (from.id !== expectedId) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ ليس دورك الآن.' });
      return;
    }

    // نفّذ الحركة
    game.board[i][j] = game.turn;

    const winnerSymbol = checkWinner(game.board);
    const isFull = game.board.flat().every((c) => c !== ' ');

    if (winnerSymbol || isFull) {
      game.status = 'finished';
      let txt;
      if (winnerSymbol) {
        const winner = winnerSymbol === 'X' ? game.pX : game.pO;
        awardPoints(game, winnerSymbol);
        txt =
          `🏆 انتهت المباراة!\n` +
          `الفائز: ${winner.name} (${winnerSymbol === 'X' ? '❌' : '⭕'})`;
      } else {
        awardPoints(game, null);
        txt = '🤝 انتهت المباراة بالتعادل!';
      }

      try {
        await bot.editMessageText(txt, {
          ...target,
          reply_markup: renderBoardInline(gameId, game.board),
        });
      } catch (_) {}

      delete games[gameId];
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // إذا اللعبة مستمرة
    game.turn = game.turn === 'X' ? 'O' : 'X';
    const turnName = game.turn === 'X' ? game.pX.name : game.pO.name;
    const header =
      `🎮 لعبة XO\n` +
      `❌ ${game.pX.name} — ⭕ ${game.pO.name}\n` +
      `🎯 دور ${turnName}`;

    try {
      await bot.editMessageText(header, {
        ...target,
        reply_markup: renderBoardInline(gameId, game.board),
      });
    } catch (_) {}

    await bot.answerCallbackQuery(query.id);
    return;
  }

  // أي شيء آخر
  await bot.answerCallbackQuery(query.id, { text: '⚠️ إجراء غير معروف.' });
});

console.log('🚀 XO Inline Play Bot يعمل باستخدام @Bot play فقط');
