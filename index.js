// ==================================================
// 🤖 XO BOT — نسخة مبسّطة + Inline + تحديات خاصة 🇸🇦
// ==================================================

require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// ==================================================
// 🔐 تحميل التوكن
// ==================================================
const token = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.trim() : null;
console.log('🔍 فحص BOT_TOKEN...');
if (!token) {
  console.error('❌ BOT_TOKEN غير موجود في .env!');
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

function loadPlayers() {
  try {
    if (!fs.existsSync(PLAYERS_FILE)) {
      fs.writeFileSync(PLAYERS_FILE, '{}', 'utf8');
    }
    const data = fs.readFileSync(PLAYERS_FILE, 'utf8');
    players = data && data.trim() ? JSON.parse(data) : {};
  } catch {
    players = {};
    savePlayers();
  }
}

loadPlayers();

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

    Object.values(players).forEach((p) => {
      p.points = 0;
    });

    saveWeeklyData();
    savePlayers();
  }
}

// ==================================================
// 🧍‍♂️ تأكيد / إنشاء لاعب
// ==================================================
function ensurePlayer(user) {
  if (!user || !user.id) return null;
  const id = String(user.id);

  if (!players[id]) {
    players[id] = {
      id: user.id,
      name: user.first_name || user.username || 'مستخدم',
      points: 1,
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
// 🎮 لوحة XO
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

// لوحة مرتبطة بمعرّف اللعبة (عشان ما نطيح في "لا توجد لعبة")
function buildKeyboard(game) {
  return {
    reply_markup: {
      inline_keyboard: game.board.map((row, i) =>
        row.map((cell, j) => ({
          text: cell === ' ' ? '⬜' : cell === 'X' ? '❌' : '⭕',
          callback_data: `mv:${game.id}:${i},${j}`,
        }))
      ),
    },
  };
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
    p1.draws += 1;
    p2.draws += 1;
  } else if (winnerSymbol === 'X') {
    p1.points += 10;
    p1.wins += 1;
    p2.losses += 1;
  } else {
    p2.points += 10;
    p2.wins += 1;
    p1.losses += 1;
  }

  savePlayers();
}

function awardPointsTwoPlayerGame(game, winnerSymbol) {
  checkWeeklyReset();
  if (!game || !game.players || game.players.length !== 2) return;

  const pxUser = game.players.find((p) => p.symbol === 'X') || game.players[0];
  const poUser = game.players.find((p) => p.symbol === 'O') || game.players[1];

  const px = ensurePlayer({ id: pxUser.id, name: pxUser.name });
  const po = ensurePlayer({ id: poUser.id, name: poUser.name });

  if (!winnerSymbol) {
    px.draws += 1;
    po.draws += 1;
  } else if (winnerSymbol === 'X') {
    px.points += 10;
    px.wins += 1;
    po.losses += 1;
  } else {
    po.points += 10;
    po.wins += 1;
    px.losses += 1;
  }

  savePlayers();
}

// ==================================================
// 🧠 تخزين الألعاب والتحديات
// ==================================================
const games = {};       // gameId -> game object
const challenges = {};  // challengeId -> { p1 }

// game = {
//   id, type: 'private' | 'group',
//   board, turn,
//   p1, p2, msgs (للخاص),
//   chatId, messageId, players:[{id,name,symbol}] (للقروبات/inline)
// };

function generateGameId() {
  return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
    { command: 'challenge', description: 'تحدي صديق في الخاص' },
    { command: 'profile', description: 'عرض ملفك الشخصي' },
    { command: 'board', description: 'عرض لوحة النتائج' },
  ]);
});

// ==================================================
// 🏁 /start
// ==================================================
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const user = msg.from;
  const chatId = msg.chat.id;
  const param = match[1];

  if (msg.chat.type !== 'private') return;

  const player = ensurePlayer(user);

  // /start ch_<id> = قبول تحدي خاص
  if (param && param.startsWith('ch_')) {
    const id = param.replace('ch_', '');
    const ch = challenges[id];
    if (!ch) return bot.sendMessage(chatId, '❌ هذا التحدي غير صالح أو انتهى.');

    if (ch.p1.id === user.id) {
      return bot.sendMessage(chatId, '⚠️ لا يمكنك تحدي نفسك.');
    }

    ch.p2 = { id: user.id, name: user.first_name || user.username || 'مستخدم' };
    ch.board = newBoard();
    ch.turn = 'X';

    // إنشاء اللعبة وتخزينها أولاً
    games[id] = {
      id,
      type: 'private',
      board: ch.board,
      turn: 'X',
      p1: ch.p1,
      p2: ch.p2,
      msgs: {},
    };
    const game = games[id];

    const msg1 = await bot.sendMessage(
      ch.p1.id,
      `🎮 ضد ${ch.p2.name}\n🎯 دورك أنت (❌)`,
      buildKeyboard(game)
    );
    const msg2 = await bot.sendMessage(
      ch.p2.id,
      `🎮 ضد ${ch.p1.name}\n🎯 دور خصمك الآن`,
      buildKeyboard(game)
    );

    game.msgs[game.p1.id] = msg1.message_id;
    game.msgs[game.p2.id] = msg2.message_id;

    delete challenges[id];
    return;
  }

  const welcome =
    '👋 أهلاً <b>' +
    escapeHTML(player.name) +
    '</b>\n' +
    'مرحباً بك في <b>XO Bot</b> 🤖🎮\n\n' +
    '🎯 <b>نقاطك الحالية:</b> <code>' +
    player.points +
    '</code>\n' +
    '✨ الفوز = +10 نقاط\n\n' +
    '🧠 الأوامر:\n' +
    '• /newgame — لعبة ثنائية في القروب\n' +
    '• /challenge — تحدي صديق في الخاص\n' +
    '• /profile — ملفك الشخصي\n' +
    '• /board — لوحة النتائج\n\n' +
    '🎮 تقدر تلعب مباشرة داخل أي محادثة باستخدام:\n' +
    '<code>@' + botUsername + ' play</code>\nثم اختر ❌ أو ⭕️';
  bot.sendMessage(chatId, welcome, { parse_mode: 'HTML' });
});

// ==================================================
// ⚔️ /challenge — إنشاء تحدي خاص
// ==================================================
bot.onText(/\/challenge/, (msg) => {
  if (msg.chat.type !== 'private') {
    return bot.sendMessage(msg.chat.id, '❗ هذا الأمر متاح في الخاص فقط.');
  }

  const user = msg.from;
  ensurePlayer(user);

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
    players: [{ id: user.id, name: user.first_name || user.username || 'مستخدم', symbol: null }],
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
      const g = games[gameId];
      if (!g) return;
      g.messageId = sent.message_id;

      g.timer = setTimeout(() => {
        const game = games[gameId];
        if (!game) return;

        if (game.players.length < 2) {
          bot
            .editMessageText('⏰ انتهى الوقت! لم يكتمل عدد اللاعبين.', {
              chat_id: chatId,
              message_id: sent.message_id,
            })
            .catch(() => {});
          clearTimeout(game.timer);
          delete games[gameId];
        } else if (!game.turn) {
          game.turn = 'X';
          game.players[0].symbol = 'X';
          game.players[1].symbol = 'O';
          const text =
            `🎮 ${game.players[0].name} vs ${game.players[1].name}\n` +
            `🎯 دور ${game.players[0].name} (❌)`;
          bot
            .editMessageText(text, {
              chat_id: chatId,
              message_id: sent.message_id,
              ...buildKeyboard(game),
            })
            .catch(() => {});
          clearTimeout(game.timer);
        }
      }, 15000);
    });
});

// ==================================================
// 🧾 /profile — ملف اللاعب
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

  bot.sendMessage(
    msg.chat.id,
    `📊 لوحة النتائج:\n${lines.join('\n')}${historyText}`
  );
});

// ==================================================
// 🎮 Inline Mode — @Bot play
// ==================================================
bot.on('inline_query', async (query) => {
  try {
    const q = (query.query || '').trim().toLowerCase();

    if (!q || q === 'play' || q === 'xo') {
      const gameId = generateGameId();
      games[gameId] = {
        id: gameId,
        type: 'group',
        chatId: null,
        board: newBoard(),
        players: [], // {id,name,symbol}
        turn: null,
        messageId: null,
      };

      const text =
        '🎮 لعبة XO هنا.\n' +
        'اختر ❌ أو ⭕️ لبدء اللعبة.\n' +
        'أول لاعب يختار رمز، ثاني لاعب يأخذ الرمز الآخر.';

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
        switch_pm_text: 'اكتب play لبدء XO',
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
// 📝 تحديث رسالة اللعبة
// ==================================================
async function editGameMessage(game, text) {
  try {
    if (game.type === 'private') {
      await bot.editMessageText(text, {
        chat_id: game.p1.id,
        message_id: game.msgs[game.p1.id],
        ...buildKeyboard(game),
      });
      await bot.editMessageText(text, {
        chat_id: game.p2.id,
        message_id: game.msgs[game.p2.id],
        ...buildKeyboard(game),
      });
    } else {
      await bot.editMessageText(text, {
        chat_id: game.chatId,
        message_id: game.messageId,
        ...buildKeyboard(game),
      });
    }
  } catch {
    // تجاهل أخطاء التحرير
  }
}

// ==================================================
// 🎯 callback_query — كل الأزرار
// ==================================================
bot.on('callback_query', async (query) => {
  const { message, from, data } = query;

  try {
    // ----------------------------------------------
    // اختيار الرمز في inline: pick:X:gameId
    // ----------------------------------------------
    if (data && data.startsWith('pick:')) {
      const [, symbol, gameId] = data.split(':');
      const game = games[gameId];
      if (!game) {
        await bot.answerCallbackQuery(query.id, { text: '❌ اللعبة غير موجودة.' });
        return;
      }

      if (!game.chatId) {
        game.chatId = message.chat.id;
        game.messageId = message.message_id;
      }

      const name = from.first_name || from.username || 'لاعب';

      if (game.players.find((p) => p.symbol === symbol)) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ هذا الرمز تم اختياره.' });
        return;
      }

      if (game.players.find((p) => p.id === from.id)) {
        await bot.answerCallbackQuery(query.id, { text: '✅ أنت مشارك بالفعل.' });
        return;
      }

      game.players.push({ id: from.id, name, symbol });
      ensurePlayer(from);
      await bot.answerCallbackQuery(query.id, { text: `✅ اخترت ${symbol}` });

      if (game.players.length === 1) {
        const remaining = symbol === 'X' ? 'O' : 'X';
        await bot.editMessageText(
          `✅ ${name} اختار ${symbol}\n🕓 بانتظار لاعب آخر يختار ${remaining}.`,
          {
            chat_id: game.chatId,
            message_id: game.messageId,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: remaining === 'X' ? '❌' : '⭕️',
                    callback_data: `pick:${remaining}:${gameId}`,
                  },
                ],
              ],
            },
          }
        );
      }

      if (game.players.length === 2) {
        game.turn = 'X';
        const px = game.players.find((p) => p.symbol === 'X');
        const po = game.players.find((p) => p.symbol === 'O');
        const text =
          `🎮 لعبة XO بدأت!\n` +
          `❌ ${px.name}\n` +
          `⭕️ ${po.name}\n\n` +
          `🎯 دور ${px.name}`;
        await bot.editMessageText(text, {
          chat_id: game.chatId,
          message_id: game.messageId,
          ...buildKeyboard(game),
        });
      }

      return;
    }

    // ----------------------------------------------
    // /newgame join:gameId
    // ----------------------------------------------
    if (data && data.startsWith('join:')) {
      const gameId = data.split(':')[1];
      const game = games[gameId];
      if (!game || game.type !== 'group') {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ لا توجد لعبة ثنائية هنا.' });
        return;
      }

      if (!game.chatId) {
        game.chatId = message.chat.id;
        game.messageId = message.message_id;
      }

      if (game.players.find((p) => p.id === from.id)) {
        await bot.answerCallbackQuery(query.id, { text: '✅ أنت منضم مسبقاً.' });
        return;
      }

      if (game.players.length >= 2) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ اللعبة مكتملة.' });
        return;
      }

      game.players.push({
        id: from.id,
        name: from.first_name || from.username || 'مستخدم',
        symbol: null,
      });
      ensurePlayer(from);
      await bot.answerCallbackQuery(query.id, { text: '✅ تم الانضمام.' });

      if (game.players.length === 2) {
        if (game.timer) {
          clearTimeout(game.timer);
          game.timer = null;
        }
        game.turn = 'X';
        game.players[0].symbol = 'X';
        game.players[1].symbol = 'O';

        const text =
          `🎮 ${game.players[0].name} vs ${game.players[1].name}\n` +
          `🎯 دور ${game.players[0].name} (❌)`;

        await bot.editMessageText(text, {
          chat_id: game.chatId,
          message_id: game.messageId,
          ...buildKeyboard(game),
        });
      } else {
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
      }

      return;
    }

    // ----------------------------------------------
    // mv:gameId:i,j — حركة ضمن لعبة واضحة
    // ----------------------------------------------
    if (data && data.startsWith('mv:')) {
      const [, gameId, coords] = data.split(':');
      const [i, j] = (coords || '').split(',').map(Number);

      const game = games[gameId];
      if (!game || !game.board || Number.isNaN(i) || Number.isNaN(j)) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ لا توجد لعبة صالحة.' });
        return;
      }

      if (game.board[i][j] !== ' ') {
        await bot.answerCallbackQuery(query.id, { text: '❗ هذه الخانة مشغولة!' });
        return;
      }

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
      } else if (game.type === 'group') {
        const p = game.players.find((pl) => pl.id === from.id);
        if (!p) {
          await bot.answerCallbackQuery(query.id, { text: '⚠️ انضم للعبة أولاً.' });
          return;
        }
        symbol = p.symbol || (game.players.findIndex((pl) => pl.id === from.id) === 0 ? 'X' : 'O');
        if (symbol !== game.turn) {
          await bot.answerCallbackQuery(query.id, { text: '⚠️ ليس دورك الآن.' });
          return;
        }
      } else {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ نوع لعبة غير مدعوم.' });
        return;
      }

      game.board[i][j] = symbol;
      game.turn = symbol === 'X' ? 'O' : 'X';

      const winnerSymbol = checkWinner(game.board);
      let resultText = '';

      if (winnerSymbol) {
        if (game.type === 'private') {
          const winnerName = winnerSymbol === 'X' ? game.p1.name : game.p2.name;
          resultText = `🏆 الفائز: ${winnerName}!`;
          awardPointsPrivateGame(gameId, winnerSymbol);
        } else {
          const px = game.players.find((p) => p.symbol === 'X') || game.players[0];
          const po = game.players.find((p) => p.symbol === 'O') || game.players[1];
          const winnerName = winnerSymbol === 'X' ? px.name : po.name;
          resultText = `🏆 الفائز: ${winnerName}!`;
          awardPointsTwoPlayerGame(game, winnerSymbol);
        }

        await editGameMessage(game, resultText);
        delete games[gameId];
      } else if (game.board.flat().every((c) => c !== ' ')) {
        resultText = '🤝 انتهت اللعبة بالتعادل!';
        if (game.type === 'private') {
          awardPointsPrivateGame(gameId, null);
        } else {
          awardPointsTwoPlayerGame(game, null);
        }
        await editGameMessage(game, resultText);
        delete games[gameId];
      } else {
        if (game.type === 'private') {
          const nextName = game.turn === 'X' ? game.p1.name : game.p2.name;
          resultText = `🎯 دور ${nextName}`;
        } else {
          const px = game.players.find((p) => p.symbol === 'X') || game.players[0];
          const po = game.players.find((p) => p.symbol === 'O') || game.players[1];
          const nextName = game.turn === 'X' ? px.name : po.name;
          resultText = `🎯 دور ${nextName}`;
        }
        await editGameMessage(game, resultText);
      }

      await bot.answerCallbackQuery(query.id);
      return;
    }

    // أي شيء ثاني نتجاهله
    await bot.answerCallbackQuery(query.id, { text: '⚠️ زر غير معروف.' });
  } catch (err) {
    console.error('callback_query error:', err.message);
    try {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ حدث خطأ.' });
    } catch {}
  }
});

console.log('🚀 XO Bot (نسخة مبسطة + Inline + تحديات) قيد التشغيل...');
