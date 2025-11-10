// ==================================================
// 🤖 XO BOT — اللعب فقط عبر Inline: @Bot play
// ==================================================

require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// ==================================================
// 🔐 تحميل التوكن
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
// 🎮 XO Board Helpers
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
// game: { id, inline_message_id, board, status, turn, pX, pO }
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
// 🔔 جاهزية البوت
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
    'اللعب يتم عبر <b>Inline Mode</b> فقط.\n\n' +
    '⚙️ الطريقة:\n' +
    '1️⃣ في أي قروب أو خاص اكتب: <code>@' + escapeHTML(botUsername) + ' play</code>\n' +
    '2️⃣ اختر "بدء لعبة XO (أنا ❌)" أو "بدء لعبة XO (أنا ⭕)". (هذا يحددك كلاعب أول)\n' +
    '3️⃣ أرسل البطاقة.\n' +
    '4️⃣ أي صديق يضغط زر الانضمام الوحيد يصبح الخصم.\n' +
    '5️⃣ بعد الانضمام تبدأ اللعبة في نفس الرسالة.\n\n' +
    '🏅 فوز +10 نقاط. استخدم /profile لملفك و /board للمتصدرين.';

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
// هنا نخزن هوية اللاعب الأول داخل الـ id و الـ callback_data
bot.on('inline_query', async (query) => {
  try {
    const q = (query.query || '').trim().toLowerCase();
    const host = query.from; // الشخص اللي كتب @bot play

    if (!q || q === 'play' || q === 'xo') {
      const baseId = generateGameId();
      const hostId = host.id;
      const hostName = host.first_name || host.username || 'لاعب';

      const resultX = {
        type: 'article',
        id: `${baseId}:X:${hostId}`,
        title: 'بدء لعبة XO (أنا ❌)',
        description: 'أرسل الدعوة، أنت ❌ والخصم ⭕',
        input_message_content: {
          message_text:
            `🎮 تحدي XO جديد!\n` +
            `👤 اللاعب الأول: ${hostName} (❌)\n` +
            `🕓 بانتظار لاعب يضغط زر ⭕ للانضمام.\n` +
            `⬜ اللعب سيتم في هذه الرسالة بعد انضمام الخصم.`,
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '⭕ انضم كخصم',
                // نحفظ gameId + hostId + رمز الخصم المطلوب
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
        description: 'أرسل الدعوة، أنت ⭕ والخصم ❌',
        input_message_content: {
          message_text:
            `🎮 تحدي XO جديد!\n` +
            `👤 اللاعب الأول: ${hostName} (⭕)\n` +
            `🕓 بانتظار لاعب يضغط زر ❌ للانضمام.\n` +
            `⬜ اللعب سيتم في هذه الرسالة بعد انضمام الخصم.`,
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

// ==================================================
// 🎮 chosen_inline_result — تسجيل اللاعب الأول (مصدر موثوق)
// نستخدمه لوصل، ولو ما وصل نعتمد على بيانات join كـ fallback
bot.on('chosen_inline_result', (res) => {
  try {
    const { from, result_id, inline_message_id } = res;
    const parts = result_id.split(':'); // baseId, symbol, hostId
    if (parts.length < 3) return;
    const [gameId, symbol, hostIdStr] = parts;
    const hostId = Number(hostIdStr);

    // تأكيد أن اللي اختار هو نفس الهوست (حماية بسيطة)
    const hostUser = {
      id: hostId,
      name: from.first_name || from.username || 'لاعب',
    };
    ensurePlayer(hostUser);

    games[gameId] = {
      id: gameId,
      inline_message_id,
      board: newBoard(),
      status: 'waiting_opponent',
      turn: null,
      pX: symbol === 'X' ? hostUser : null,
      pO: symbol === 'O' ? hostUser : null,
    };

    console.log(`🎮 [chosen] لعبة ${gameId} أنشأها ${hostUser.name} كـ ${symbol}`);
  } catch (err) {
    console.error('chosen_inline_result error:', err.message);
  }
});

// ==================================================
// 🎯 callback_query — join + moves
bot.on('callback_query', async (query) => {
  const { from, data, inline_message_id, message } = query;

  try {
    // ---------- انضمام الخصم ----------
    if (data && data.startsWith('join:')) {
      // join:gameId:hostId:neededSymbolForJoin
      const [, gameId, hostIdStr, needSymbol] = data.split(':');
      const hostId = Number(hostIdStr);
      let game = games[gameId];

      // حدد هدف الرسالة
      const target = inline_message_id
        ? { inline_message_id }
        : { chat_id: message.chat.id, message_id: message.message_id };

      // إذا اللعبة غير موجودة (fallback): نبنيها من جديد من البيانات
      if (!game) {
        // نحاول جلب بيانات الهوست من players أو نخليه باسم افتراضي
        const hostPlayer =
          players[String(hostId)] || {
            id: hostId,
            name: 'اللاعب الأول',
          };

        const hostUser = {
          id: hostPlayer.id,
          name: hostPlayer.name,
        };

        ensurePlayer(hostUser);

        // host هو صاحب الرمز العكسي لـ needSymbol
        const hostSymbol = needSymbol === 'X' ? 'O' : 'X';

        game = games[gameId] = {
          id: gameId,
          inline_message_id: inline_message_id || null,
          board: newBoard(),
          status: 'waiting_opponent',
          turn: null,
          pX: hostSymbol === 'X' ? hostUser : null,
          pO: hostSymbol === 'O' ? hostUser : null,
        };

        console.log(`🎮 [fallback] إنشاء لعبة ${gameId} تلقائياً للهوست ${hostUser.name}`);
      }

      // إذا اللعبة ليست فى حالة انتظار خصم
      if (game.status !== 'waiting_opponent') {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ هذا التحدي لم يعد متاحاً.' });
        return;
      }

      // منع الهوست من الانضمام كخصم لنفسه
      if (
        (game.pX && game.pX.id === from.id) ||
        (game.pO && game.pO.id === from.id)
      ) {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ لا يمكنك أن تكون خصماً لنفسك.',
        });
        return;
      }

      // تحقق أن needSymbol فعلاً هو الرمز المتاح للخصم
      if (needSymbol === 'X' && game.pX) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ الرمز ❌ محجوز بالفعل.' });
        return;
      }
      if (needSymbol === 'O' && game.pO) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ الرمز ⭕ محجوز بالفعل.' });
        return;
      }

      const opponent = {
        id: from.id,
        name: from.first_name || from.username || 'لاعب',
      };
      ensurePlayer(opponent);

      if (needSymbol === 'X') game.pX = opponent;
      if (needSymbol === 'O') game.pO = opponent;

      // الآن يجب أن يكون عندنا pX و pO → نبدأ
      if (game.pX && game.pO) {
        game.status = 'playing';
        game.turn = 'X';
        game.board = newBoard();

        const header =
          `🎮 لعبة XO بدأت!\n` +
          `❌ ${game.pX.name}\n` +
          `⭕ ${game.pO.name}\n` +
          `🎯 دور ${game.pX.id === game.turnId ? game.pX.name : game.pX.name}`;

        // header الصحيح:
        const startHeader =
          `🎮 لعبة XO بدأت!\n` +
          `❌ ${game.pX.name}\n` +
          `⭕ ${game.pO.name}\n` +
          `🎯 دور ${game.pX.name}`;

        try {
          await bot.editMessageText(startHeader, {
            ...target,
            reply_markup: renderBoardInline(gameId, game.board),
          });
        } catch (e) {
          console.error('edit start game error:', e.message);
        }

        await bot.answerCallbackQuery(query.id, { text: '✅ انضممت للتحدي.' });
      } else {
        await bot.answerCallbackQuery(query.id, {
          text: '✅ تم تسجيل انضمامك، بانتظار إكمال اللاعبين.',
        });
      }

      return;
    }

    // ---------- حركة اللعب ----------
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
        : { chat_id: message.chat.id, message_id: message.message_id };

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
          reply_markup: renderBoardInline(gameId, game.board),
        });
      } catch (e) {
        console.error('edit move error:', e.message);
      }

      await bot.answerCallbackQuery(query.id);
      return;
    }

    await bot.answerCallbackQuery(query.id, { text: '⚠️ إجراء غير معروف.' });
  } catch (err) {
    console.error('callback_query error:', err.message);
  }
});

console.log('🚀 XO Inline Play Bot يعمل الآن باستخدام @Bot play فقط');
