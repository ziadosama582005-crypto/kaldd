// ==================================================
// 🤖 XO BOT — نسخة مستقرة مبسّطة + قروبات + خاص + Inline 🇸🇦
// ==================================================

require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// ==================================================
// 🔐 التوكن من ملف .env
// ==================================================
const token = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.trim() : null;
console.log('🔍 فحص BOT_TOKEN...');
if (!token) {
  console.error('❌ BOT_TOKEN غير موجود في .env');
  process.exit(1);
}

// ==================================================
// 🚀 إنشاء البوت
// ==================================================
const bot = new TelegramBot(token, { polling: true });
let botUsername = null;

// ==================================================
// 💾 ملف اللاعبين
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
    console.error('⚠️ خطأ أثناء قراءة players.json:', err.message);
    players = {};
  }
}

function savePlayers() {
  try {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ خطأ أثناء حفظ players.json:', err.message);
  }
}

loadPlayers();

// ==================================================
// 📅 ملف بيانات الأسبوع (اختياري بسيط)
// ==================================================
const WEEKLY_FILE = 'weekly.json';
let weeklyData = { lastReset: 0, history: [] };

function loadWeekly() {
  try {
    if (!fs.existsSync(WEEKLY_FILE)) {
      fs.writeFileSync(WEEKLY_FILE, JSON.stringify(weeklyData, null, 2), 'utf8');
    }
    const data = fs.readFileSync(WEEKLY_FILE, 'utf8');
    weeklyData = data && data.trim() ? JSON.parse(data) : { lastReset: 0, history: [] };
  } catch (err) {
    console.error('⚠️ خطأ أثناء قراءة weekly.json:', err.message);
    weeklyData = { lastReset: 0, history: [] };
  }
}

function saveWeekly() {
  try {
    fs.writeFileSync(WEEKLY_FILE, JSON.stringify(weeklyData, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ خطأ أثناء حفظ weekly.json:', err.message);
  }
}

function checkWeeklyReset() {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (!weeklyData.lastReset || now - weeklyData.lastReset >= weekMs) {
    const top = Object.values(players)
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 3)
      .map((p) => ({ name: p.name, points: p.points || 0 }));

    weeklyData.history = weeklyData.history || [];
    weeklyData.history.push({ date: new Date().toISOString(), winners: top });
    weeklyData.lastReset = now;

    Object.values(players).forEach((p) => {
      p.points = 0;
    });

    saveWeekly();
    savePlayers();
  }
}

loadWeekly();

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
      points: 1,
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
  savePlayers();
  return players[id];
}

// ==================================================
// 🎮 اللوحة + التحقق من الفائز
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

// لوحة مرتبطة بمعرّف اللعبة (mv:gameId:i,j)
function buildKeyboard(game) {
  return {
    inline_keyboard: game.board.map((row, i) =>
      row.map((cell, j) => ({
        text: cell === ' ' ? '⬜' : cell === 'X' ? '❌' : '⭕',
        callback_data: `mv:${game.id}:${i},${j}`,
      }))
    ),
  };
}

// ==================================================
// 🧠 تخزين الألعاب والتحديات
// ==================================================
const games = {}; // gameId -> { ... }
const challenges = {}; // chId -> { p1 }

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ==================================================
// أدوات نصية بسيطة
// ==================================================
function escapeHTML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/<//g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ==================================================
// 🏅 منح نقاط
// ==================================================
function awardPrivate(gameId, winnerSymbol) {
  checkWeeklyReset();
  const g = games[gameId];
  if (!g || !g.p1 || !g.p2) return;
  const p1 = ensurePlayer(g.p1);
  const p2 = ensurePlayer(g.p2);

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

function awardGroup(g, winnerSymbol) {
  checkWeeklyReset();
  if (!g || !g.players || g.players.length !== 2) return;
  const pxUser = g.players.find((p) => p.symbol === 'X') || g.players[0];
  const poUser = g.players.find((p) => p.symbol === 'O') || g.players[1];
  const px = ensurePlayer({ id: pxUser.id, first_name: pxUser.name });
  const po = ensurePlayer({ id: poUser.id, first_name: poUser.name });

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
// 🔔 جاهزية البوت + أوامر القائمة
// ==================================================
bot.getMe().then((me) => {
  botUsername = me.username;
  console.log(`✅ البوت جاهز: @${botUsername}`);
  bot.setMyCommands([
    { command: 'start', description: 'بدء الاستخدام والترحيب' },
    { command: 'newgame', description: 'بدء لعبة XO ثنائية في القروب' },
    { command: 'challenge', description: 'تحدّي صديق في الخاص' },
    { command: 'profile', description: 'عرض ملفك وإحصائياتك' },
    { command: 'board', description: 'لوحة النتائج' },
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

  // قبول تحدّي خاص: /start ch_<id>
  if (param && param.startsWith('ch_')) {
    const chId = param.slice(3);
    const ch = challenges[chId];
    if (!ch) {
      await bot.sendMessage(chatId, '❌ هذا التحدي غير صالح أو انتهى.');
      return;
    }
    if (ch.p1.id === user.id) {
      await bot.sendMessage(chatId, '⚠️ لا يمكنك تحدّي نفسك.');
      return;
    }

    const gameId = chId; // نستخدم نفس المعرّف
    const board = newBoard();
    games[gameId] = {
      id: gameId,
      type: 'private',
      board,
      turn: 'X',
      p1: ch.p1,
      p2: { id: user.id, name: user.first_name || user.username || 'مستخدم' },
      msgs: {},
    };
    const game = games[gameId];

    const msg1 = await bot.sendMessage(
      game.p1.id,
      `🎮 ضد ${game.p2.name}\n🎯 دورك أنت (❌)`,
      { reply_markup: buildKeyboard(game) }
    );
    const msg2 = await bot.sendMessage(
      game.p2.id,
      `🎮 ضد ${game.p1.name}\n🎯 دور خصمك الآن`,
      { reply_markup: buildKeyboard(game) }
    );

    game.msgs[game.p1.id] = msg1.message_id;
    game.msgs[game.p2.id] = msg2.message_id;
    delete challenges[chId];
    return;
  }

  const text =
    '👋 أهلاً <b>' +
    escapeHTML(player.name) +
    '</b>\n' +
    'مرحباً بك في <b>XO Bot</b> 🤖🎮\n\n' +
    '🏅 نقاطك الحالية: <code>' +
    player.points +
    '</code>\n' +
    '✨ الفوز = +10 نقاط\n\n' +
    '🧠 الأوامر:\n' +
    '• /newgame — لعبة ثنائية في القروب\n' +
    '• /challenge — تحدّي خاص برابط\n' +
    '• /profile — ملفك\n' +
    '• /board — لوحة النتائج\n\n' +
    '🎮 للّعب داخل أي محادثة مباشرة استخدم:\n' +
    '<code>@' +
    botUsername +
    ' play</code>';

  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// ==================================================
// ⚔️ /challenge — تحدّي خاص
// ==================================================
bot.onText(/\/challenge/, async (msg) => {
  if (msg.chat.type !== 'private') {
    await bot.sendMessage(msg.chat.id, '❗ هذا الأمر متاح في الخاص فقط.');
    return;
  }
  const user = msg.from;
  ensurePlayer(user);

  const chId = genId('ch');
  challenges[chId] = {
    p1: { id: user.id, name: user.first_name || user.username || 'مستخدم' },
  };

  const startLink = `https://t.me/${botUsername}?start=ch_${chId}`;
  const shareLink =
    'https://t.me/share/url?url=' +
    encodeURIComponent(startLink) +
    '&text=' +
    encodeURIComponent('🎮 تحدّي XO خاص');

  await bot.sendMessage(
    msg.chat.id,
    '🎮 تم إنشاء التحدّي!\nشارك الرابط مع صديقك:',
    {
      reply_markup: {
        inline_keyboard: [[{ text: '🔗 مشاركة التحدّي', url: shareLink }]],
      },
    }
  );
});

// ==================================================
// 👥 /newgame — لعبة ثنائية في القروب بزر انضمام
// ==================================================
bot.onText(/^\/newgame(?:@\w+)?(?:\s|$)/, async (msg) => {
  if (msg.chat.type === 'private') {
    await bot.sendMessage(msg.chat.id, '🚫 استخدم هذا الأمر في القروبات فقط.');
    return;
  }
  const chatId = msg.chat.id;
  const user = msg.from;
  ensurePlayer(user);

  const gameId = genId('g');
  games[gameId] = {
    id: gameId,
    type: 'group',
    chatId,
    messageId: null,
    board: newBoard(),
    turn: null,
    players: [
      { id: user.id, name: user.first_name || user.username || 'مستخدم', symbol: null },
    ],
    timer: null,
  };

  const sent = await bot.sendMessage(
    chatId,
    `👤 ${user.first_name} بدأ لعبة جديدة!\n🕓 أمامكم 20 ثانية لانضمام لاعب آخر.`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: '🎮 انضمام إلى اللعبة', callback_data: 'join:' + gameId }]],
      },
    }
  );

  const game = games[gameId];
  if (!game) return;
  game.messageId = sent.message_id;

  game.timer = setTimeout(async () => {
    const g = games[gameId];
    if (!g) return;
    if (g.players.length < 2) {
      try {
        await bot.editMessageText('⏰ انتهى الوقت! لم يكتمل عدد اللاعبين.', {
          chat_id: chatId,
          message_id: g.messageId,
        });
      } catch (e) {}
      delete games[gameId];
      return;
    }
    if (!g.turn) {
      g.turn = 'X';
      g.players[0].symbol = 'X';
      g.players[1].symbol = 'O';
      const text =
        `🎮 ${g.players[0].name} vs ${g.players[1].name}\n` +
        `🎯 دور ${g.players[0].name} (❌)`;
      try {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: g.messageId,
          reply_markup: buildKeyboard(g),
        });
      } catch (e) {}
    }
  }, 20000);
});

// ==================================================
// 🧾 /profile — ملف اللاعب
// ==================================================
bot.onText(/^(?:\/profile(?:@\w+)?|\/ملفي(?:@\w+)?)/, async (msg) => {
  const player = ensurePlayer(msg.from);
  checkWeeklyReset();

  const text =
    `👤 <b>${escapeHTML(player.name)}</b>\n` +
    `🏅 النقاط: <code>${player.points}</code>\n` +
    `✅ الفوز: <code>${player.wins}</code>\n` +
    `❌ الخسارة: <code>${player.losses}</code>\n` +
    `🤝 التعادل: <code>${player.draws}</code>`;

  await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ==================================================
// 📊 /board — لوحة النتائج
// ==================================================
bot.onText(/^(?:\/board(?:@\w+)?|\/اللوحة(?:@\w+)?)/, async (msg) => {
  checkWeeklyReset();
  const list = Object.values(players).sort(
    (a, b) => (b.points || 0) - (a.points || 0)
  );
  if (!list.length) {
    await bot.sendMessage(msg.chat.id, 'لا توجد بيانات بعد.');
    return;
  }
  const lines = list.map((p, i) => `${i + 1}. ${p.name}: ${p.points || 0} نقطة`);

  let historyText = '';
  if (weeklyData.history && weeklyData.history.length) {
    const last = weeklyData.history[weeklyData.history.length - 1];
    if (last.winners && last.winners.length) {
      const w = last.winners
        .map((p, i) => `${i + 1}. ${p.name}: ${p.points} نقطة`)
        .join('\n');
      historyText = '\n\n🥇 أفضل لاعبي الأسبوع الماضي:\n' + w;
    }
  }

  await bot.sendMessage(
    msg.chat.id,
    `📊 لوحة النتائج:\n${lines.join('\n')}${historyText}`
  );
});

// ==================================================
// 🎮 Inline Mode — @bot play
// ==================================================
bot.on('inline_query', async (query) => {
  try {
    const q = (query.query || '').trim().toLowerCase();

    if (!q || q === 'play' || q === 'xo') {
      const gameId = genId('in');
      games[gameId] = {
        id: gameId,
        type: 'inline',
        inline_message_id: null,
        chatId: null,
        messageId: null,
        board: newBoard(),
        turn: null,
        players: [], // {id,name,symbol}
      };
      const text =
        '🎮 لعبة XO هنا.\n' +
        'اختر ❌ أو ⭕️ لبدء اللعبة مع صديقك.\n' +
        'أول لاعب يختار رمز، الثاني يأخذ الرمز الآخر.';

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
    } catch (e) {}
  }
});

// ==================================================
// 📝 تحديث رسالة اللعبة (خاص/قروب/inline)
// ==================================================
async function editGameMessage(game, text) {
  try {
    if (game.type === 'private') {
      // تحديث رسالتين في الخاص
      await bot.editMessageText(text, {
        chat_id: game.p1.id,
        message_id: game.msgs[game.p1.id],
        reply_markup: buildKeyboard(game),
      });
      await bot.editMessageText(text, {
        chat_id: game.p2.id,
        message_id: game.msgs[game.p2.id],
        reply_markup: buildKeyboard(game),
      });
    } else if (game.inline_message_id) {
      await bot.editMessageText(text, {
        inline_message_id: game.inline_message_id,
        reply_markup: buildKeyboard(game),
      });
    } else if (game.chatId && game.messageId) {
      await bot.editMessageText(text, {
        chat_id: game.chatId,
        message_id: game.messageId,
        reply_markup: buildKeyboard(game),
      });
    }
  } catch (e) {
    // تجاهل أخطاء التحرير
  }
}

// ==================================================
// 🎯 أزرار الكولباك (join / pick / mv)
// ==================================================
bot.on('callback_query', async (query) => {
  const { message, from, data, inline_message_id } = query;
  try {
    // ------------------------------------------
    // الانضمام للعبة القروب /newgame
    // ------------------------------------------
    if (data && data.startsWith('join:')) {
      const gameId = data.split(':')[1];
      const game = games[gameId];
      if (!game || game.type !== 'group') {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ لا توجد لعبة للانضمام.' });
        return;
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

      // إذا اكتمل لاعبان نبدأ فوراً
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
        try {
          await bot.editMessageText(text, {
            chat_id: game.chatId,
            message_id: game.messageId,
            reply_markup: buildKeyboard(game),
          });
        } catch (e) {}
      } else {
        // لاعب واحد فقط بعد الانضمام
        const txt =
          `👤 ${game.players.map((p) => p.name).join(' • ')}\n` +
          '🕓 بانتظار لاعب آخر...';
        try {
          await bot.editMessageText(txt, {
            chat_id: game.chatId,
            message_id: game.messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎮 انضمام إلى اللعبة', callback_data: 'join:' + gameId }],
              ],
            },
          });
        } catch (e) {}
      }
      return;
    }

    // ------------------------------------------
    // اختيار الرمز في inline: pick:X:gameId
    // ------------------------------------------
    if (data && data.startsWith('pick:')) {
      const [, symbol, gameId] = data.split(':');
      const game = games[gameId];
      if (!game) {
        await bot.answerCallbackQuery(query.id, { text: '❌ اللعبة غير موجودة.' });
        return;
      }

      // ثبت مكان الرسالة (inline أو عادي)
      if (!game.inline_message_id && inline_message_id) {
        game.inline_message_id = inline_message_id;
      }
      if (!game.chatId && message) {
        game.chatId = message.chat.id;
        game.messageId = message.message_id;
      }

      const name = from.first_name || from.username || 'لاعب';

      // ممنوع اختيار نفس الرمز مرتين
      if (game.players.find((p) => p.symbol === symbol)) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ هذا الرمز تم اختياره.' });
        return;
      }
      // ممنوع نفس اللاعب يدخل مرتين
      if (game.players.find((p) => p.id === from.id)) {
        await bot.answerCallbackQuery(query.id, { text: '✅ أنت مشارك بالفعل.' });
        return;
      }

      game.players.push({ id: from.id, name, symbol });
      ensurePlayer(from);
      await bot.answerCallbackQuery(query.id, { text: `✅ اخترت ${symbol}` });

      // أول لاعب فقط
      if (game.players.length === 1) {
        const remaining = symbol === 'X' ? 'O' : 'X';
        const txt =
          `✅ ${name} اختار ${symbol}\n` +
          `🕓 بانتظار لاعب آخر يختار ${remaining}.`;
        const kb = {
          inline_keyboard: [[
            {
              text: remaining === 'X' ? '❌' : '⭕️',
              callback_data: `pick:${remaining}:${gameId}`,
            },
          ]],
        };
        try {
          if (game.inline_message_id) {
            await bot.editMessageText(txt, {
              inline_message_id: game.inline_message_id,
              reply_markup: kb,
            });
          } else if (game.chatId && game.messageId) {
            await bot.editMessageText(txt, {
              chat_id: game.chatId,
              message_id: game.messageId,
              reply_markup: kb,
            });
          }
        } catch (e) {}
        return;
      }

      // إذا صار عندنا لاعبان، نبدأ اللعبة
      if (game.players.length === 2) {
        let pX = game.players.find((p) => p.symbol === 'X');
        let pO = game.players.find((p) => p.symbol === 'O');

        // لو حصل لخبطة في الرموز، نصلّحها بدل ما نرجع خطأ
        if (!pX || !pO) {
          const [u1, u2] = game.players;
          if (!u1 || !u2) {
            await bot.answerCallbackQuery(query.id, {
              text: '⚠️ حدث خطأ، أعد إرسال اللعبة من جديد.',
            });
            delete games[gameId];
            return;
          }
          pX = { id: u1.id, name: u1.name, symbol: 'X' };
          pO = { id: u2.id, name: u2.name, symbol: 'O' };
          game.players = [pX, pO];
        }

        game.type = 'group'; // نعاملها كلعبة ثنائية عادية
        game.turn = 'X';
        game.board = newBoard();

        const startText =
          `🎮 لعبة XO بدأت!\n` +
          `❌ ${pX.name}\n` +
          `⭕️ ${pO.name}\n\n` +
          `🎯 دور ${pX.name}`;

        try {
          if (game.inline_message_id) {
            await bot.editMessageText(startText, {
              inline_message_id: game.inline_message_id,
              reply_markup: buildKeyboard(game),
            });
          } else if (game.chatId && game.messageId) {
            await bot.editMessageText(startText, {
              chat_id: game.chatId,
              message_id: game.messageId,
              reply_markup: buildKeyboard(game),
            });
          }
        } catch (e) {}
      }

      return;
    }

    // ------------------------------------------
    // حركة في اللعبة: mv:gameId:i,j
    // ------------------------------------------
    if (data && data.startsWith('mv:')) {
      const [, gameId, coords] = data.split(':');
      const [iStr, jStr] = (coords || '').split(',');
      const i = Number(iStr);
      const j = Number(jStr);
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
          await bot.answerCallbackQuery(query.id, { text: '⚠️ لست مشاركاً في هذه اللعبة.' });
          return;
        }
        symbol = p.symbol || (game.players[0].id === from.id ? 'X' : 'O');
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
          awardPrivate(gameId, winnerSymbol);
        } else {
          const pxUser = game.players.find((p) => p.symbol === 'X') || game.players[0];
          const poUser = game.players.find((p) => p.symbol === 'O') || game.players[1];
          const winnerName = winnerSymbol === 'X' ? pxUser.name : poUser.name;
          resultText = `🏆 الفائز: ${winnerName}!`;
          awardGroup(game, winnerSymbol);
        }
        await editGameMessage(game, resultText);
        delete games[gameId];
      } else if (game.board.flat().every((c) => c !== ' ')) {
        resultText = '🤝 انتهت اللعبة بالتعادل!';
        if (game.type === 'private') awardPrivate(gameId, null);
        else awardGroup(game, null);
        await editGameMessage(game, resultText);
        delete games[gameId];
      } else {
        if (game.type === 'private') {
          const nextName = game.turn === 'X' ? game.p1.name : game.p2.name;
          resultText = `🎯 دور ${nextName}`;
        } else {
          const pxUser = game.players.find((p) => p.symbol === 'X') || game.players[0];
          const poUser = game.players.find((p) => p.symbol === 'O') || game.players[1];
          const nextName = game.turn === 'X' ? pxUser.name : poUser.name;
          resultText = `🎯 دور ${nextName}`;
        }
        await editGameMessage(game, resultText);
      }

      await bot.answerCallbackQuery(query.id);
      return;
    }

    // أي زر آخر
    await bot.answerCallbackQuery(query.id, { text: '⚠️ زر غير معروف.' });
  } catch (err) {
    console.error('خطأ callback_query:', err.message);
    try {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ حدث خطأ.' });
    } catch (e) {}
  }
});

console.log('🚀 XO Bot — نسخة مستقرة قيد التشغيل...');
