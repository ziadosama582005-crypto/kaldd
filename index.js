// ==================================================
// 🤖 XO BOT v10 — نسخة محسّنة + Inline Mode 🇸🇦
// ==================================================

require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// ==================================================
// 🔐 تحميل التوكن من البيئة
// ==================================================
const token = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.trim() : null;
console.log('🔍 فحص BOT_TOKEN...');
if (!token) {
  console.error('❌ BOT_TOKEN غير موجود في البيئة!');
  process.exit(1);
}

// ==================================================
// 🚀 إنشاء البوت
// ==================================================
const bot = new TelegramBot(token, { polling: true });
let botUsername = null;

// ==================================================
// 💾 بيانات اللاعبين
// ==================================================
let players = {};
const PLAYERS_FILE = 'players.json';

function savePlayers() {
  try {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ خطأ أثناء حفظ بيانات اللاعبين:', err.message);
  }
}

try {
  if (!fs.existsSync(PLAYERS_FILE)) fs.writeFileSync(PLAYERS_FILE, '{}', 'utf8');
  const data = fs.readFileSync(PLAYERS_FILE, 'utf8');
  players = data && data.trim() ? JSON.parse(data) : {};
} catch {
  players = {};
  savePlayers();
}

// ==================================================
// 📅 بيانات الأسبوع (إعادة تعيين أسبوعية)
// ==================================================
const WEEKLY_DATA_FILE = 'weekly.json';
let weeklyData = { lastReset: 0, history: [] };

function loadWeeklyData() {
  try {
    if (!fs.existsSync(WEEKLY_DATA_FILE)) {
      fs.writeFileSync(WEEKLY_DATA_FILE, JSON.stringify(weeklyData, null, 2), 'utf8');
    }
    const data = fs.readFileSync(WEEKLY_DATA_FILE, 'utf8');
    weeklyData = data && data.trim() ? JSON.parse(data) : { lastReset: 0, history: [] };
  } catch {
    weeklyData = { lastReset: 0, history: [] };
    saveWeeklyData();
  }
}

function saveWeeklyData() {
  try {
    fs.writeFileSync(WEEKLY_DATA_FILE, JSON.stringify(weeklyData, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ خطأ أثناء حفظ بيانات الأسبوع:', err.message);
  }
}

loadWeeklyData();

function checkWeeklyReset() {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (!weeklyData.lastReset || now - weeklyData.lastReset >= weekMs) {
    const sorted = Object.values(players)
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 3)
      .map((p) => ({ name: p.name, points: p.points || 0 }));

    weeklyData.history = weeklyData.history || [];
    weeklyData.history.push({
      date: new Date().toISOString(),
      winners: sorted,
    });

    weeklyData.lastReset = now;

    // تصفير نقاط كل اللاعبين
    Object.values(players).forEach((p) => {
      p.points = 0;
    });

    saveWeeklyData();
    savePlayers();
  }
}

// ==================================================
// 🧍‍♂️ إنشاء/تحديث لاعب
// ==================================================
function ensurePlayer(user) {
  if (!user || !user.id) return null;
  const id = String(user.id);
  if (!players[id]) {
    players[id] = {
      id: user.id,
      name: user.first_name || user.username || 'مستخدم',
      points: 1, // نقطة ترحيبية
      wins: 0,
      losses: 0,
      draws: 0,
    };
  } else {
    players[id].name = user.first_name || user.username || players[id].name;
    players[id].wins = players[id].wins || 0;
    players[id].losses = players[id].losses || 0;
    players[id].draws = players[id].draws || 0;
  }
  savePlayers();
  return players[id];
}

// ==================================================
// 🎮 وظائف لوحة XO
// ==================================================
function newBoard() {
  return [
    [' ', ' ', ' '],
    [' ', ' ', ' '],
    [' ', ' ', ' '],
  ];
}

function renderBoard(board) {
  return {
    reply_markup: {
      inline_keyboard: board.map((row, i) =>
        row.map((cell, j) => ({
          text: cell === ' ' ? '⬜' : cell === 'X' ? '❌' : '⭕',
          callback_data: `${i},${j}`,
        }))
      ),
    },
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

// ==================================================
// 🧼 أدوات
// ==================================================
function escapeHTML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeMarkdownV2(text) {
  return String(text).replace(/([_*!\[\]()~`>#+=|{}\.!\-])/g, '\\$1');
}

// ==================================================
// 🏅 منح نقاط
// ==================================================
function awardPointsPrivateGame(gameId, winnerSymbol) {
  checkWeeklyReset();
  const game = games[gameId];
  if (!game || !game.p1 || !game.p2) return;
  const p1 = ensurePlayer(game.p1);
  const p2 = ensurePlayer(game.p2);

  if (!winnerSymbol) {
    p1.draws++;
    p2.draws++;
  } else if (winnerSymbol === 'X') {
    p1.points += 10;
    p1.wins++;
    p2.losses++;
  } else {
    p2.points += 10;
    p2.wins++;
    p1.losses++;
  }
  savePlayers();
}

function awardPointsTwoPlayerGame(game, winnerSymbol) {
  checkWeeklyReset();
  if (!game || !game.players || game.players.length !== 2) return;

  const p1User = game.players[0];
  const p2User = game.players[1];
  const p1 = ensurePlayer({ id: p1User.id, name: p1User.name });
  const p2 = ensurePlayer({ id: p2User.id, name: p2User.name });

  if (!winnerSymbol) {
    p1.draws++;
    p2.draws++;
  } else if (winnerSymbol === 'X') {
    p1.points += 10;
    p1.wins++;
    p2.losses++;
  } else {
    p2.points += 10;
    p2.wins++;
    p1.losses++;
  }
  savePlayers();
}

// (موجود لكن حالياً للاستخدام فى الأنماط الجماعية)
function awardPointsGroup6Game(game, winnerSymbol) {
  checkWeeklyReset();
  if (!game || !game.teams || !game.teams.X || !game.teams.O) return;

  if (!winnerSymbol) {
    const all = [...game.teams.X, ...game.teams.O];
    all.forEach((u) => {
      const p = ensurePlayer({ id: u.id, name: u.name });
      p.draws++;
    });
  } else {
    const winners = winnerSymbol === 'X' ? game.teams.X : game.teams.O;
    const losers = winnerSymbol === 'X' ? game.teams.O : game.teams.X;
    winners.forEach((u) => {
      const p = ensurePlayer({ id: u.id, name: u.name });
      p.points += 10;
      p.wins++;
    });
    losers.forEach((u) => {
      const p = ensurePlayer({ id: u.id, name: u.name });
      p.losses++;
    });
  }
  savePlayers();
}

// ==================================================
// 🧠 الذاكرة العامة
// ==================================================
const games = {};        // كل الألعاب (خاص + قروبات + inline)
const challenges = {};   // تحديات /challenge
const tournaments = {};  // البطولات

function generateGameId() {
  return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function generateTournamentId() {
  return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ==================================================
// 🔔 جاهزية البوت + الأوامر
// ==================================================
bot.getMe().then((me) => {
  botUsername = me.username;
  console.log(`✅ البوت جاهز: @${botUsername}`);

  bot.setMyCommands([
    { command: 'start', description: 'بدء الاستخدام والترحيب' },
    { command: 'newgame', description: 'بدء لعبة ثنائية في القروب' },
    { command: 'newgame6', description: 'بدء تحدي 2 ضد 2 في القروب' },
    { command: 'challenge', description: 'تحدي صديق في الخاص' },
    { command: 'profile', description: 'عرض ملفك الشخصي وإحصائياتك' },
    { command: 'board', description: 'عرض لوحة النتائج' },
    { command: 'tournament', description: 'بدء بطولة في القروب' },
  ]);
});

// ==================================================
// 🏁 /start — ترحيب
// ==================================================
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const user = msg.from;
  const chatId = msg.chat.id;
  const param = match[1];

  if (msg.chat.type !== 'private') return;

  const player = ensurePlayer(user);

  // تحدي خاص
  if (param && param.startsWith('ch_')) {
    const id = param.replace('ch_', '');
    const ch = challenges[id];
    if (!ch) return bot.sendMessage(chatId, '❌ هذا التحدي غير صالح أو انتهى.');
    if (ch.p1.id === user.id)
      return bot.sendMessage(chatId, '⚠️ لا يمكنك تحدي نفسك.');

    ch.p2 = { id: user.id, name: user.first_name || user.username || 'مستخدم' };
    ch.board = newBoard();
    ch.turn = 'X';

    const msg1 = await bot.sendMessage(
      ch.p1.id,
      `🎮 ضد ${ch.p2.name}\n🎯 دورك أنت (❌)`,
      { ...renderBoard(ch.board) }
    );
    const msg2 = await bot.sendMessage(
      ch.p2.id,
      `🎮 ضد ${ch.p1.name}\n🎯 دور خصمك الآن`,
      { ...renderBoard(ch.board) }
    );

    games[id] = {
      type: 'private',
      board: ch.board,
      turn: 'X',
      p1: ch.p1,
      p2: ch.p2,
      msgs: {
        [ch.p1.id]: msg1.message_id,
        [ch.p2.id]: msg2.message_id,
      },
    };
    delete challenges[id];
    return;
  }

  const welcome =
    '👋 أهلاً <b>' +
    escapeHTML(player.name) +
    '</b>\n' +
    'مرحباً بك في <b>XO Bot</b> — التحدي الذكي 🤖🎮\n\n' +
    '🎯 <b>نقاطك الحالية:</b> <code>' +
    player.points +
    '</code>\n' +
    '✨ الفوز = +10 نقاط\n\n' +
    '🧠 الأوامر:\n' +
    '• /newgame — لعبة ثنائية في القروب\n' +
    '• /newgame6 — تحدي 2 ضد 2 في القروب\n' +
    '• /challenge — تحدي صديق في الخاص\n' +
    '• /profile — ملفك الشخصي\n' +
    '• /board — لوحة النتائج\n' +
    '• /tournament — بطولة داخل القروب\n\n' +
    '🎮 تقدر كمان تلعب مباشرة في أي محادثة باستخدام:\n' +
    '<code>@' + botUsername + ' play</code>\nثم اختر الرمز ❌ أو ⭕️';
  bot.sendMessage(chatId, welcome, { parse_mode: 'HTML' });
});

// ==================================================
// ⚔️ /challenge — تحدي خاص
// ==================================================
bot.onText(/\/challenge/, (msg) => {
  if (msg.chat.type !== 'private') {
    return bot.sendMessage(msg.chat.id, '❗ هذا الأمر في الخاص فقط.');
  }
  const user = msg.from;
  const id = Math.random().toString(36).slice(2, 10);
  challenges[id] = {
    p1: { id: user.id, name: user.first_name || user.username || 'مستخدم' },
  };
  const startLink = `https://t.me/${botUsername}?start=ch_${id}`;
  const shareLink =
    'https://t.me/share/url?url=' +
    encodeURIComponent(startLink) +
    '&text=' +
    encodeURIComponent('🎮 تحدي XO خاص');

  bot.sendMessage(
    msg.chat.id,
    '🎮 تم إنشاء التحدي!\nشارك الرابط مع صديقك:',
    {
      reply_markup: {
        inline_keyboard: [[{ text: '🔗 مشاركة التحدي', url: shareLink }]],
      },
    }
  );
});

// ==================================================
// 👥 /newgame — لعبة ثنائية في القروب
// ==================================================
bot.onText(/^\/newgame(?:@\w+)?(?:\s|$)/, (msg) => {
  if (msg.chat.type === 'private') {
    return bot.sendMessage(msg.chat.id, '🚫 استخدم هذا الأمر في القروب فقط.');
  }
  const chatId = msg.chat.id;
  const user = msg.from;
  ensurePlayer(user);

  const gameId = generateGameId();
  games[gameId] = {
    id: gameId,
    type: 'group',
    chatId,
    board: newBoard(),
    players: [{ id: user.id, name: user.first_name || user.username || 'مستخدم' }],
    turn: null,
    messageId: null,
    timer: null,
  };

  bot
    .sendMessage(
      chatId,
      `👤 ${user.first_name} بدأ لعبة جديدة!\n🕓 أمامكم 15 ثانية لانضمام لاعب آخر.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🎮 انضمام إلى اللعبة', callback_data: 'join:' + gameId }]],
        },
      }
    )
    .then((sent) => {
      games[gameId].messageId = sent.message_id;
      games[gameId].timer = setTimeout(() => {
        const g = games[gameId];
        if (!g) return;
        if (g.players.length < 2) {
          bot
            .editMessageText('⏰ انتهى الوقت! لم يكتمل عدد اللاعبين.', {
              chat_id: chatId,
              message_id: sent.message_id,
            })
            .catch(() => {});
          clearTimeout(g.timer);
          delete games[gameId];
        } else if (!g.turn) {
          // اكتمال اللاعبين
          g.turn = 'X';
          g.players[0].symbol = 'X';
          g.players[1].symbol = 'O';
          try {
            bot.editMessageText(
              `🎮 ${g.players[0].name} vs ${g.players[1].name}\n🎯 دور ${g.players[0].name} (❌)`,
              {
                chat_id: chatId,
                message_id: sent.message_id,
                ...renderBoard(g.board),
              }
            );
          } catch {}
          clearTimeout(g.timer);
        }
      }, 15000);
    });
});

// ==================================================
// 👥 /newgame6 — 2 ضد 2 (مبني على group4)
// ==================================================
bot.onText(/^\/newgame6(?:@\w+)?(?:\s|$)/, (msg) => {
  if (msg.chat.type === 'private') {
    return bot.sendMessage(msg.chat.id, '❗ هذا الأمر في القروبات فقط.');
  }
  const chatId = msg.chat.id;
  const user = msg.from;
  ensurePlayer(user);

  const gameId = generateGameId();
  games[gameId] = {
    id: gameId,
    type: 'group4',
    chatId,
    board: newBoard(),
    players: [{ id: user.id, name: user.first_name || user.username || 'مستخدم' }],
    teams: null,
    turn: null,
    messageId: null,
    timer: null,
  };

  bot
    .sendMessage(
      chatId,
      `👤 ${user.first_name} بدأ تحدي 2 ضد 2!\nاضغط للانضمام حتى يكتمل العدد (4 لاعبين).`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🎮 انضمام إلى التحدي', callback_data: 'join6:' + gameId }]],
        },
      }
    )
    .then((sent) => {
      games[gameId].messageId = sent.message_id;
    });
});

// ==================================================
// 🧾 /profile — عرض ملف اللاعب
// ==================================================
bot.onText(/^(?:\/profile(?:@\w+)?|\/ملفي(?:@\w+)?)/, (msg) => {
  const player = ensurePlayer(msg.from);
  checkWeeklyReset();
  const text =
    `👤 <b>${escapeHTML(player.name)}</b>\n` +
    `🏅 النقاط: <code>${player.points}</code>\n` +
    `✅ الفوز: <code>${player.wins}</code>\n` +
    `❌ الخسارة: <code>${player.losses}</code>\n` +
    `🤝 التعادل: <code>${player.draws}</code>\n`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ==================================================
// 📊 /board — لوحة النتائج
// ==================================================
bot.onText(/^(?:\/board(?:@\w+)?|\/اللوحة(?:@\w+)?)/, (msg) => {
  checkWeeklyReset();
  const sorted = Object.values(players).sort(
    (a, b) => (b.points || 0) - (a.points || 0)
  );
  if (!sorted.length) {
    return bot.sendMessage(msg.chat.id, 'لا توجد بيانات بعد.');
  }
  const lines = sorted.map((p, i) => `${i + 1}. ${p.name}: ${p.points || 0} نقطة`);

  loadWeeklyData();
  let historyText = '';
  if (weeklyData.history && weeklyData.history.length) {
    const last = weeklyData.history[weeklyData.history.length - 1];
    if (last.winners && last.winners.length) {
      const wLines = last.winners.map(
        (p, i) => `${i + 1}. ${p.name}: ${p.points} نقطة`
      );
      historyText = '\n\n🥇 أفضل لاعبي الأسبوع الماضي:\n' + wLines.join('\n');
    }
  }

  bot.sendMessage(msg.chat.id, `📊 لوحة النتائج:\n${lines.join('\n')}${historyText}`);
});

// ==================================================
// 🏆 /tournament — (نظام بطولة مبسط / placeholder كما في v9.1)
// ==================================================
bot.onText(/^(?:\/tournament(?:@\w+)?|\/بطولة(?:@\w+)?)/, (msg) => {
  if (msg.chat.type === 'private') {
    return bot.sendMessage(msg.chat.id, '❗ هذا الأمر في القروبات فقط.');
  }
  const chatId = msg.chat.id;
  const user = msg.from;
  ensurePlayer(user);

  const tId = generateTournamentId();
  tournaments[tId] = {
    id: tId,
    chatId,
    participants: [
      { id: user.id, name: user.first_name || user.username || 'مستخدم' },
    ],
    stage: 'waiting',
    matchList: [],
    currentMatchIndex: 0,
    currentPlayers: null,
    winners: [],
    byePlayer: null,
    board: null,
    turn: null,
    messageId: null,
  };

  bot
    .sendMessage(
      chatId,
      `👤 ${user.first_name} بدأ بطولة!\nاضغط للانضمام حتى يكتمل عدد اللاعبين (6).`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🎮 انضمام إلى البطولة', callback_data: 'joinT:' + tId }]],
        },
      }
    )
    .then((sent) => {
      tournaments[tId].messageId = sent.message_id;
    });
});

// ==================================================
// 🎮 Inline Mode — @BotUsername play (اختيار الرمز)
// ==================================================
bot.on('inline_query', async (query) => {
  try {
    const q = (query.query || '').trim().toLowerCase();
    if (!q || q === 'play' || q === 'xo') {
      const gameId = generateGameId();
      games[gameId] = {
        id: gameId,
        type: 'group', // نفس منطق اللعبة الثنائية
        chatId: null,
        board: newBoard(),
        players: [],    // {id, name, symbol}
        turn: null,
        messageId: null,
      };

      const text =
        '🎮 لعبة XO مباشرة هنا.\n' +
        'اختر ❌ أو ⭕️ لبدء اللعبة.\n' +
        'أول لاعب يختار رمز، وثاني لاعب يأخذ الرمز الآخر وتبدأ الجولة.';

      const result = {
        type: 'article',
        id: gameId,
        title: 'بدء لعبة XO هنا',
        description: 'اختر ❌ أو ⭕️ ثم ابدأ اللعب مع صديقك.',
        input_message_content: { message_text: text },
        reply_markup: {
          inline_keyboard: [
            [
              { text: '❌', callback_data: `pick:X:${gameId}` },
              { text: '⭕️', callback_data: `pick:O:${gameId}` },
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
        cache_time: 5,
      });
    }
  } catch (err) {
    console.error('خطأ inline_query:', err.message);
    try {
      await bot.answerInlineQuery(query.id, [], { cache_time: 1 });
    } catch {}
  }
});

// ==================================================
// 🎯 callback_query — الأزرار كلها
// ==================================================
bot.on('callback_query', async (query) => {
  const { message, from, data } = query;

  try {
    // ----------------------------------------------
    // 🧩 اختيار الرمز (Inline)
    // pick:X:gameId  أو pick:O:gameId
    // ----------------------------------------------
    if (data && data.startsWith('pick:')) {
      const [, symbol, gameId] = data.split(':');
      const game = games[gameId];
      if (!game) {
        await bot.answerCallbackQuery(query.id, { text: '❌ اللعبة غير موجودة.' });
        return;
      }

      // لو أول مرة نحدد chat/message
      if (!game.chatId) {
        game.chatId = message.chat.id;
        game.messageId = message.message_id;
      }

      const name = from.first_name || from.username || 'لاعب';
      // تحقق: لاعب مختار نفس الرمز؟
      if (game.players.find((p) => p.symbol === symbol)) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ هذا الرمز تم اختياره.' });
        return;
      }
      // تحقق: نفس الشخص داخل مسبقاً؟
      if (game.players.find((p) => p.id === from.id)) {
        await bot.answerCallbackQuery(query.id, { text: '✅ أنت مشارك بالفعل.' });
        return;
      }

      game.players.push({ id: from.id, name, symbol });
      ensurePlayer(from);
      await bot.answerCallbackQuery(query.id, { text: `✅ اخترت ${symbol}` });

      if (game.players.length === 1) {
        const remainingSymbol = symbol === 'X' ? 'O' : 'X';
        await bot.editMessageText(
          `✅ ${name} اختار ${symbol}\n🕓 بانتظار لاعب آخر يختار ${remainingSymbol}.`,
          {
            chat_id: game.chatId,
            message_id: game.messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: remainingSymbol === 'X' ? '❌' : '⭕️', callback_data: `pick:${remainingSymbol}:${gameId}` }],
              ],
            },
          }
        );
      }

      if (game.players.length === 2) {
        // بدأ اللعب
        game.turn = 'X'; // X يبدأ دائماً
        const px = game.players.find((p) => p.symbol === 'X');
        const po = game.players.find((p) => p.symbol === 'O');

        if (!px || !po) {
          await bot.editMessageText('⚠️ خطأ في تعيين اللاعبين، تم إلغاء اللعبة.', {
            chat_id: game.chatId,
            message_id: game.messageId,
          });
          delete games[gameId];
          return;
        }

        const text =
          `🎮 لعبة XO بدأت!\n` +
          `❌ ${px.name}\n` +
          `⭕️ ${po.name}\n\n` +
          `🎯 دور ${px.name}`;
        await bot.editMessageText(text, {
          chat_id: game.chatId,
          message_id: game.messageId,
          ...renderBoard(game.board),
        });
      }

      return;
    }

    // ----------------------------------------------
    // 🏆 الانضمام إلى بطولة joinT:
    // ----------------------------------------------
    if (data && data.startsWith('joinT:')) {
      const tId = data.split(':')[1];
      const t = tournaments[tId];
      if (!t) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ لا توجد بطولة.' });
        return;
      }
      if (t.participants.find((p) => p.id === from.id)) {
        await bot.answerCallbackQuery(query.id, { text: '✅ أنت منضم مسبقاً.' });
        return;
      }
      if (t.participants.length >= 6) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ البطولة مكتملة.' });
        return;
      }
      t.participants.push({
        id: from.id,
        name: from.first_name || from.username || 'مستخدم',
      });
      ensurePlayer(from);
      await bot.answerCallbackQuery(query.id, { text: '✅ تم الانضمام.' });

      try {
        await bot.editMessageText(
          `👥 المشاركون: ${t.participants.map((p) => p.name).join(' • ')}\n(${t.participants.length}/6)`,
          {
            chat_id: t.chatId,
            message_id: t.messageId,
            reply_markup: {
              inline_keyboard: [[{ text: '🎮 انضمام إلى البطولة', callback_data: 'joinT:' + tId }]],
            },
          }
        );
      } catch {}
      return;
    }

    // ----------------------------------------------
    // 👥 join/join6 للألعاب العادية في القروبات
    // ----------------------------------------------
    if (data && (data.startsWith('join:') || data.startsWith('join6:'))) {
      const partsJoin = data.split(':');
      const joinCmd = partsJoin[0];
      const gameId = partsJoin[1];
      const game = games[gameId];
      if (!game) {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ لا توجد لعبة متاحة هنا.',
        });
        return;
      }

      // لو جاءت من inline ولم نضبط بعد
      if (!game.chatId) {
        game.chatId = message.chat.id;
        game.messageId = message.message_id;
      }

      if (joinCmd === 'join' && game.type !== 'group') {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ هذه ليست لعبة ثنائية.' });
        return;
      }
      if (joinCmd === 'join6' && game.type !== 'group4') {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ هذه ليست لعبة 2 ضد 2.' });
        return;
      }

      if (game.players.find((p) => p.id === from.id)) {
        await bot.answerCallbackQuery(query.id, { text: '✅ أنت منضم مسبقاً.' });
        return;
      }

      let maxPlayers = game.type === 'group' ? 2 : 4;
      if (game.players.length >= maxPlayers) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ اللعبة مكتملة.' });
        return;
      }

      game.players.push({
        id: from.id,
        name: from.first_name || from.username || 'مستخدم',
      });
      ensurePlayer(from);
      await bot.answerCallbackQuery(query.id, { text: '✅ تم الانضمام.' });

      // لعبة ثنائية
      if (game.type === 'group') {
        if (game.players.length === 2) {
          if (game.timer) {
            clearTimeout(game.timer);
            game.timer = null;
          }
          game.turn = 'X';
          game.players[0].symbol = 'X';
          game.players[1].symbol = 'O';
          try {
            await bot.editMessageText(
              `🎮 ${game.players[0].name} vs ${game.players[1].name}\n🎯 دور ${game.players[0].name} (❌)`,
              {
                chat_id: game.chatId,
                message_id: game.messageId,
                ...renderBoard(game.board),
              }
            );
          } catch {}
        } else {
          try {
            await bot.editMessageText(
              `👤 ${game.players.map((p) => p.name).join(' • ')}\n🕓 بانتظار لاعب آخر...`,
              {
                chat_id: game.chatId,
                message_id: game.messageId,
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🎮 انضمام إلى اللعبة', callback_data: 'join:' + gameId }],
                  ],
                },
              }
            );
          } catch {}
        }
      }

      // لعبة 2 ضد 2
      if (game.type === 'group4') {
        const required = 4;
        if (game.players.length === required) {
          // تقسيم الفرق عشوائي
          const shuffled = [...game.players].sort(() => Math.random() - 0.5);
          game.teams = {
            X: shuffled.slice(0, 2),
            O: shuffled.slice(2, 4),
          };
          game.turn = 'X';
          game.board = newBoard();
          const teamXNames = game.teams.X.map((u) => u.name).join('، ');
          const teamONames = game.teams.O.map((u) => u.name).join('، ');
          const header =
            `🎮 2 ضد 2\n` +
            `فريق X: ${teamXNames}\n` +
            `فريق O: ${teamONames}\n` +
            `🎯 دور فريق X`;

          try {
            await bot.editMessageText(header, {
              chat_id: game.chatId,
              message_id: game.messageId,
              ...renderBoard(game.board),
            });
          } catch {}
        } else {
          try {
            await bot.editMessageText(
              `👤 ${game.players.map((p) => p.name).join(' • ')}\n(${game.players.length}/4) بانتظار لاعبين...`,
              {
                chat_id: game.chatId,
                message_id: game.messageId,
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🎮 انضمام إلى التحدي', callback_data: 'join6:' + gameId }],
                  ],
                },
              }
            );
          } catch {}
        }
      }

      return;
    }

    // ----------------------------------------------
    // 👇 هنا تعامل مع ضغط مربعات XO (i,j)
    // ----------------------------------------------
    const parts = (data || '').split(',');
    if (parts.length !== 2) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ اختيار غير صالح.' });
      return;
    }
    const i = Number(parts[0]);
    const j = Number(parts[1]);
    if (Number.isNaN(i) || Number.isNaN(j)) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ خطأ في البيانات.' });
      return;
    }

    // إيجاد اللعبة
    let gameId =
      Object.keys(games).find((id) => {
        const g = games[id];
        return (
          g.type === 'private' &&
          g.msgs &&
          (g.msgs[g.p1.id] === message.message_id ||
            g.msgs[g.p2.id] === message.message_id)
        );
      }) || null;

    if (!gameId) {
      gameId = Object.keys(games).find((id) => {
        const g = games[id];
        return (
          (g.type === 'group' || g.type === 'group4') &&
          g.chatId === message.chat.id &&
          g.messageId === message.message_id
        );
      }) || null;
    }

    if (!gameId) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ لا توجد لعبة لهذه الرسالة.' });
      return;
    }

    const game = games[gameId];
    if (!game.board || !game.board[i] || game.board[i][j] === undefined) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ خلية غير صالحة.' });
      return;
    }
    if (game.board[i][j] !== ' ') {
      await bot.answerCallbackQuery(query.id, { text: '❗ هذه الخانة مشغولة.' });
      return;
    }

    // تحديد الرمز حسب نوع اللعبة
    let symbol = null;

    if (game.type === 'private') {
      if (from.id === game.p1.id) symbol = 'X';
      else if (from.id === game.p2.id) symbol = 'O';
      else {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ لست ضمن هذه اللعبة.' });
        return;
      }
      if (symbol !== game.turn) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ ليس دورك الآن.' });
        return;
      }
    } else if (game.type === 'group4') {
      if (!game.teams || !game.teams.X || !game.teams.O) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ لم تُقسم الفرق بعد.' });
        return;
      }
      if (game.teams.X.some((p) => p.id === from.id)) symbol = 'X';
      else if (game.teams.O.some((p) => p.id === from.id)) symbol = 'O';
      else {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ لست في هذه اللعبة.' });
        return;
      }
      if (symbol !== game.turn) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ ليس دور فريقك.' });
        return;
      }
    } else if (game.type === 'group') {
      // ثنائية (قروب أو inline)
      const p = game.players.find((pl) => pl.id === from.id);
      if (!p) {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ انضم للعبة أولاً.',
        });
        return;
      }

      if (p.symbol) {
        symbol = p.symbol;
      } else {
        // fallback قديم لو بدون symbol
        const idx = game.players.findIndex((pl) => pl.id === from.id);
        symbol = idx === 0 ? 'X' : 'O';
      }

      if (symbol !== game.turn) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ ليس دورك الآن.' });
        return;
      }
    } else {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ نوع لعبة غير مدعوم.' });
      return;
    }

    // تنفيذ الحركة
    game.board[i][j] = symbol;
    game.turn = symbol === 'X' ? 'O' : 'X';

    const winnerSymbol = checkWinner(game.board);
    let resultText = '';

    if (winnerSymbol) {
      // فوز
      if (game.type === 'private') {
        const winnerName = winnerSymbol === 'X' ? game.p1.name : game.p2.name;
        resultText = `🏆 الفائز: ${winnerName}!`;
        awardPointsPrivateGame(gameId, winnerSymbol);
      } else if (game.type === 'group4') {
        const teamXNames = game.teams.X.map((u) => u.name).join('، ');
        const teamONames = game.teams.O.map((u) => u.name).join('، ');
        resultText =
          `🏆 الفريق الفائز: ` +
          (winnerSymbol === 'X'
            ? `فريق X (${teamXNames})`
            : `فريق O (${teamONames})`);
        awardPointsGroup6Game(game, winnerSymbol);
      } else {
        const px = game.players.find((p) => p.symbol === 'X') || game.players[0];
        const po = game.players.find((p) => p.symbol === 'O') || game.players[1];
        const winnerName = winnerSymbol === 'X' ? px.name : po.name;
        resultText = `🏆 الفائز: ${winnerName}!`;
        awardPointsTwoPlayerGame(game, winnerSymbol);
      }

      // تحديث الرسالة
      await editGameMessage(game, resultText);
      delete games[gameId];
    } else if (game.board.flat().every((c) => c !== ' ')) {
      // تعادل
      resultText = '🤝 انتهت اللعبة بالتعادل!';
      if (game.type === 'private') {
        awardPointsPrivateGame(gameId, null);
      } else if (game.type === 'group4') {
        awardPointsGroup6Game(game, null);
      } else {
        awardPointsTwoPlayerGame(game, null);
      }
      await editGameMessage(game, resultText);
      delete games[gameId];
    } else {
      // مستمرة
      if (game.type === 'private') {
        const nextName = game.turn === 'X' ? game.p1.name : game.p2.name;
        resultText = `🎯 دور ${nextName}`;
      } else if (game.type === 'group4') {
        resultText = `🎯 دور فريق ${game.turn}`;
      } else {
        const px = game.players.find((p) => p.symbol === 'X') || game.players[0];
        const po = game.players.find((p) => p.symbol === 'O') || game.players[1];
        const nextName = game.turn === 'X' ? px.name : po.name;
        resultText = `🎯 دور ${nextName}`;
      }
      await editGameMessage(game, resultText);
    }

    await bot.answerCallbackQuery(query.id);
  } catch (err) {
    console.error('callback_query error:', err.message);
    try {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ حدث خطأ.' });
    } catch {}
  }
});

// ==================================================
// 📝 دالة موحّدة لتحديث رسالة اللعبة
// ==================================================
async function editGameMessage(game, text) {
  try {
    if (game.type === 'private') {
      await bot.editMessageText(text, {
        chat_id: game.p1.id,
        message_id: game.msgs[game.p1.id],
        ...renderBoard(game.board),
      });
      await bot.editMessageText(text, {
        chat_id: game.p2.id,
        message_id: game.msgs[game.p2.id],
        ...renderBoard(game.board),
      });
    } else {
      await bot.editMessageText(text, {
        chat_id: game.chatId,
        message_id: game.messageId,
        ...renderBoard(game.board),
      });
    }
  } catch {
    // نتجاهل أخطاء التحرير
  }
}

console.log('🚀 XO Bot v10 قيد التشغيل...');
