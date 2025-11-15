// ==================================================
// 🤖 XO BOT v9.1 — نسخة محسّنة بالكامل بالعربية 🇸🇦
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
// 💾 تحميل بيانات اللاعبين
let players = {};
function savePlayers() {
  try {
    fs.writeFileSync('players.json', JSON.stringify(players, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ خطأ أثناء حفظ البيانات:', err.message);
  }
}

// ==================================================
// 📅 تحميل بيانات الأسبوع الماضي ومراقبة إعادة التعيين الأسبوعية
const WEEKLY_DATA_FILE = 'weekly.json';
let weeklyData = { lastReset: 0, history: [] };
function loadWeeklyData() {
  try {
    if (!fs.existsSync(WEEKLY_DATA_FILE)) fs.writeFileSync(WEEKLY_DATA_FILE, JSON.stringify(weeklyData, null, 2), 'utf8');
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
    // حساب أفضل 3 لاعبين قبل إعادة التعيين
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
    // إعادة تعيين النقاط لكل اللاعبين
    Object.values(players).forEach((p) => {
      // إعادة تعيين نقاط اللاعبين فقط. تم إزالة weeklyWins.
      p.points = 0;
    });
    saveWeeklyData();
    savePlayers();
  }
}
try {
  if (!fs.existsSync('players.json')) fs.writeFileSync('players.json', '{}', 'utf8');
  const data = fs.readFileSync('players.json', 'utf8');
  players = data && data.trim() ? JSON.parse(data) : {};
} catch {
  players = {};
  savePlayers();
}

// ==================================================
// 🧍‍♂️ دالة تأكيد أو إنشاء لاعب جديد
function ensurePlayer(user) {
  if (!user || !user.id) return null;
  const id = String(user.id);
  if (!players[id]) {
    players[id] = {
      id: user.id,
      name: user.first_name || user.username || 'مستخدم',
      points: 1, // 🌟 نقطة ترحيب أول مرة
      wins: 0,
      losses: 0,
      draws: 0,
      // تمت إزالة الخصائص المرتبطة بنظام 3 ضد 3 والإنجازات والاحصاءات الأسبوعية
    };
  } else {
    players[id].name = user.first_name || user.username || players[id].name;
    // تأكد من وجود الحقول الجديدة للمستخدمين الحاليين
    players[id].wins = players[id].wins || 0;
    players[id].losses = players[id].losses || 0;
    players[id].draws = players[id].draws || 0;
    // لم نعد نستخدم group6Wins أو weeklyWins أو achievements
  }
  savePlayers();
  return players[id];
}

// ==================================================
// 🎮 وظائف اللعبة
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
// ❌ لم يعد هناك نظام إنجازات فى هذه النسخة، لذا أزلنا ACHIEVEMENTS وcheckAchievements.

/**
 * تهرّب الأحرف الخاصة فى HTML (مثل < و > و &).
 * تُستخدم هذه الدالة عند إرسال رسائل بصيغة HTML لتجنب مشاكل التفسير.
 */
function escapeHTML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ==================================================
// 🏅 دالة منح النقاط بعد اللعبة الخاصة
function awardPointsPrivateGame(gameId, winnerSymbol) {
  // تحقق من إعادة التعيين الأسبوعية قبل منح النقاط
  checkWeeklyReset();
  const game = games[gameId];
  if (!game || !game.p1 || !game.p2) return;
  const p1 = ensurePlayer(game.p1);
  const p2 = ensurePlayer(game.p2);

  // تحديث الإحصائيات والنقاط بناءً على النتيجة
  if (!winnerSymbol) {
    // تعادل: زيادة عدد التعادلات لكلا اللاعبين
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

// ==================================================
// 🏅 دالة منح النقاط بعد لعبة جماعية من لاعبين اثنين (فى القروبات)
function awardPointsTwoPlayerGame(game, winnerSymbol) {
  // تحقق من إعادة التعيين الأسبوعية قبل منح النقاط
  checkWeeklyReset();
  if (!game || !game.players || game.players.length !== 2) return;
  const pXUser = { id: game.players[0].id, name: game.players[0].name };
  const pOUser = { id: game.players[1].id, name: game.players[1].name };
  const pX = ensurePlayer(pXUser);
  const pO = ensurePlayer(pOUser);
  // تحديث الإحصائيات والنقاط بناءً على النتيجة
  if (!winnerSymbol) {
    // تعادل: زيادة عدد التعادلات لكلا اللاعبين
    pX.draws += 1;
    pO.draws += 1;
  } else if (winnerSymbol === 'X') {
    pX.points += 10;
    pX.wins += 1;
    pO.losses += 1;
  } else {
    pO.points += 10;
    pO.wins += 1;
    pX.losses += 1;
  }
  savePlayers();
}

// ==================================================
// 🏅 دالة منح النقاط بعد لعبة جماعية ستة لاعبين (3 ضد 3)
function awardPointsGroup6Game(game, winnerSymbol) {
  // تحقق من إعادة التعيين الأسبوعية قبل منح النقاط
  checkWeeklyReset();
  if (!game || !game.teams || !game.teams.X || !game.teams.O) return;
  // تحديث الإحصائيات والنقاط لكل اللاعبين فى التحدى 3 ضد 3
  if (!winnerSymbol) {
    // التعادل: زيادة عدد التعادلات لجميع اللاعبين
    const all = [...(game.teams && game.teams.X ? game.teams.X : []), ...(game.teams && game.teams.O ? game.teams.O : [])];
    all.forEach((u) => {
      const p = ensurePlayer({ id: u.id, name: u.name });
      p.draws += 1;
    });
  } else {
    const winners = winnerSymbol === 'X' ? game.teams.X : game.teams.O;
    const losers = winnerSymbol === 'X' ? game.teams.O : game.teams.X;
    winners.forEach((u) => {
      const p = ensurePlayer({ id: u.id, name: u.name });
      p.points += 10;
      p.wins += 1;
    });
    losers.forEach((u) => {
      const p = ensurePlayer({ id: u.id, name: u.name });
      p.losses += 1;
    });
  }
  savePlayers();
}

// ==================================================
// ⚙️ بدء لعبة التحدي 3 ضد 3 بعد اكتمال اللاعبين
function startGroup6Game(gameId) {
  const game = games[gameId];
  if (!game || game.type !== 'group6') return;
  if (!game.players || game.players.length < 6) return;
  // عيّن الفرق عشوائياً
  const shuffled = [...game.players].sort(() => Math.random() - 0.5);
  game.teams = {
    X: shuffled.slice(0, 3),
    O: shuffled.slice(3, 6),
  };
  game.turn = 'X';
  game.board = newBoard();
  // إنشاء نص الفرق
  const teamXNames = game.teams.X.map((u) => u.name).join('، ');
  const teamONames = game.teams.O.map((u) => u.name).join('، ');
  const msgText = `🎮 فريق X: ${teamXNames} vs فريق O: ${teamONames}\n🎯 دور فريق X`;
  bot.editMessageText(msgText, {
    chat_id: game.chatId,
    message_id: game.messageId,
    ...renderBoard(game.board),
  });
}

// ==================================================
// 🧠 بيانات الذاكرة
// نحتفظ بكل الألعاب في هذا الكائن. كل لعبة لها معرّف فريد (gameId)
// مما يسمح بوجود أكثر من لعبة فى نفس القروب فى الوقت ذاته بدون تعارض.
const games = {};
const challenges = {};

// 🏟️ تخزين البطولات القائمة. يحتوى على كل بطولة حسب معرفها.
const tournaments = {};

// دالة توليد معرف فريد لكل بطولة يبدأ بحرف t
function generateTournamentId() {
  return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// دالة توليد معرف فريد لكل لعبة (يبدأ بحرف g ليكون مختلفاً عن معرفات التحدي الخاصة ch_)
function generateGameId() {
  return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ==================================================
// 🔔 جاهزية البوت
bot.getMe().then((me) => {
  botUsername = me.username;
  console.log(`✅ البوت جاهز: @${botUsername}`);

  // تسجيل أوامر البوت لتظهر في قائمة الأوامر داخل Telegram
  // أوامر البوت يجب أن تكون بحروف إنجليزية صغيرة أو أرقام أو شرطات سفلية. لا يمكن استخدام أحرف عربية هنا.
  bot.setMyCommands([
    { command: 'start', description: 'بدء الاستخدام والترحيب' },
    { command: 'newgame', description: 'بدء لعبة ثنائية في القروب' },
    { command: 'newgame6', description: 'بدء تحدي 3 ضد 3 في القروب' },
    { command: 'challenge', description: 'تحدي صديق في الخاص' },
    { command: 'profile', description: 'عرض ملفك الشخصي وإحصائياتك' },
    { command: 'board', description: 'عرض لوحة النتائج' },
    { command: 'tournament', description: 'بدء بطولة 4 ضد 4 فى القروب' },
  ]);
});

// ==================================================
// 🧰 أدوات مساعدة
/**
 * تهريب جميع الأحرف الخاصة فى MarkdownV2. استخدم هذه الدالة
 * عند إدراج نصوص ديناميكية مثل أسماء المستخدمين لضمان أن
 * Telegram لا يعالجها كتنسيق.
 *
 * المرجع: https://core.telegram.org/bots/api#markdownv2-style
 */
function escapeMarkdownV2(text) {
  return String(text).replace(/([_*!\[\]()~`>#+=|{}\.!\-])/g, '\\$1');
}

// ==================================================
// 🏁 /start — ترحيب محسّن بالكامل
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const user = msg.from;
  const chatId = msg.chat.id;
  const param = match[1];
  // تجاهل أمر /start إذا تم استدعاؤه فى القروبات؛ يعمل فقط فى الخاص
  if (msg.chat.type !== 'private') {
    return;
  }
  const player = ensurePlayer(user);

  // إذا كان هناك تحدي خاص
  if (param && param.startsWith('ch_')) {
    const id = param.replace('ch_', '');
    const ch = challenges[id];
    if (!ch) return bot.sendMessage(chatId, '❌ هذا التحدي غير صالح أو انتهى.');

    if (ch.p1.id === user.id) return bot.sendMessage(chatId, '⚠️ لا يمكنك تحدي نفسك.');

    ch.p2 = { id: user.id, name: user.first_name };
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

  // رسالة الترحيب بصيغة HTML لتجنب مشاكل تهريب Markdown. نستخدم <b> للنصوص الغامقة و<code> لعرض النقاط.
  const welcome =
    '👋 أهلاً وسهلاً بك يا <b>' +
    escapeHTML(player.name) +
    '</b>\n' +
    'مرحباً بك في لعبة <b>XO Bot</b> — التحدي الذكي 🤖🎮\n\n' +
    '🎯 <b>نقاطك الحالية:</b> <code>' +
    player.points +
    '</code> نقطة\n' +
    '✨ الفوز يمنح +10 نقاط، التعادل لا نقاط، ولا نقاط للخاسر\n\n' +
    '🧠 الأوامر المتاحة:\n' +
    '• /newgame — بدء لعبة ثنائية في القروب\n' +
    '• /newgame6 — بدء تحدي 3 ضد 3 في القروب\n' +
    '• /challenge — تحدي صديق في الخاص\n' +
    '• /profile — عرض ملفك وإحصائياتك\n' +
    '• /board — عرض لوحة النتائج (الترتيب العام وأفضل لاعبي الأسبوع)\n' +
    '• /tournament — بدء بطولة 4 ضد 4 في القروب\n\n' +
    '🏆 ابدأ اللعب الآن وكن أسطورة XO!';
  bot.sendMessage(chatId, welcome, { parse_mode: 'HTML' });
});

// ==================================================
// ⚔️ /challenge — إنشاء رابط تحدي خاص
bot.onText(/\/challenge/, (msg) => {
  // التحدي متاح فقط فى المحادثات الخاصة
  if (msg.chat.type !== 'private') {
    return bot.sendMessage(msg.chat.id, '❗ هذا الأمر متاح في الخاص فقط.');
  }
  const user = msg.from;
  const id = Math.random().toString(36).slice(2, 10);
  // عند إنشاء التحدي نسجّل فقط الخصائص الضرورية (الهوية والاسم) حتى تُعرض أسماء اللاعبين لاحقاً
  challenges[id] = { p1: { id: user.id, name: user.first_name || user.username || 'مستخدم' } };
  // إنشاء الرابط ولينك المشاركة. الزر يستخدم t.me/share/url لفتح نافذة اختيار المشاركة فى تيليجرام.
  const startLink = `https://t.me/${botUsername}?start=ch_${id}`;
  const shareLink =
    'https://t.me/share/url?url=' +
    encodeURIComponent(startLink) +
    '&text=' +
    encodeURIComponent('🎮 تحدي XO خاص');
  bot.sendMessage(
    msg.chat.id,
    `🎮 تم إنشاء التحدي!\nاضغط على زر المشاركة أدناه لدعوة صديقك.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔗 مشاركة التحدي',
              url: shareLink,
            },
          ],
        ],
      },
    }
  );
});

// ==================================================
// 👥 /newgame (فى القروبات فقط). نقبل أيضًا الصيغة مع @اسم_البوت
bot.onText(/^\/newgame(?:@\w+)?(?:\s|$)/, (msg) => {
  if (msg.chat.type === 'private') {
    return bot.sendMessage(msg.chat.id, '🚫 استخدم هذا الأمر في القروب فقط.');
  }
  const chatId = msg.chat.id;
  const user = msg.from;
  ensurePlayer(user);
  // إنشاء معرف فريد للعبة
  const gameId = generateGameId();
  games[gameId] = {
    id: gameId,
    type: 'group',
    chatId: chatId,
    board: newBoard(),
    players: [{ id: user.id, name: user.first_name || user.username || 'مستخدم' }],
    turn: null,
    messageId: null,
    timer: null,
  };
  bot
    .sendMessage(
      chatId,
      `👤 ${user.first_name} بدأ لعبة جديدة!\n🕓 أمام اللاعبين 15 ثانية للانضمام.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🎮 انضمام إلى اللعبة', callback_data: 'join:' + gameId }]],
        },
      }
    )
    .then((sent) => {
      games[gameId].messageId = sent.message_id;
      // مؤقت الانضمام للعبة الثنائيّة: إذا لم يكتمل العدد خلال 15 ثانية تُلغى اللعبة
      games[gameId].timer = setTimeout(() => {
        const currentGame = games[gameId];
        if (!currentGame) return;
        if (currentGame.players.length < 2) {
          bot
            .editMessageText('⏰ انتهى الوقت! لم ينضم أحد.', {
              chat_id: chatId,
              message_id: sent.message_id,
            })
            .catch(() => {});
          clearTimeout(currentGame.timer);
          delete games[gameId];
        } else {
          currentGame.turn = 'X';
          // ابدأ اللعبة بإظهار اللوحة الحالية
          bot.editMessageText(
            `🎮 لعبة بدأت بين ${currentGame.players[0].name} و ${currentGame.players[1].name}\n🎯 دور ${currentGame.players[0].name} (❌)`,
            {
              chat_id: chatId,
              message_id: sent.message_id,
              ...renderBoard(currentGame.board),
            }
          ).catch(() => {});
        }
      }, 15000);
    });
});

// ==================================================
// 🥅 /newgame6 — لعبة 3 ضد 3 فى القروبات. نقبل أيضًا الصيغة مع @اسم_البوت
bot.onText(/^\/newgame6(?:@\w+)?(?:\s|$)/, (msg) => {
  // هذا الأمر متاح فقط فى القروبات
  if (msg.chat.type === 'private') {
    return bot.sendMessage(msg.chat.id, '❗ هذا الأمر متاح في القروبات فقط.');
  }
  const chatId = msg.chat.id;
  const user = msg.from;
  ensurePlayer(user);
  // إنشاء معرف فريد للعبة 3 ضد 3
  const gameId = generateGameId();
  games[gameId] = {
    id: gameId,
    type: 'group6',
    chatId: chatId,
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
      `👤 ${user.first_name} بدأ تحدي 3 ضد 3!\nاضغط للانضمام حتى يكتمل عدد اللاعبين.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🎮 انضمام إلى التحدي', callback_data: 'join6:' + gameId }]],
        },
      }
    )
    .then((sent) => {
      games[gameId].messageId = sent.message_id;
      // فى لعبة 3 ضد 3 لا يوجد مؤقِّت؛ يبدأ اللعب فقط عند اكتمال 6 لاعبين.
    });
});

// ==================================================
// 🏆 عرض النقاط
// ==================================================
// 📄 ملف اللاعب — يعرض معلومات اللاعب وإحصائياته. نقبل أيضًا الصيغة مع @اسم_البوت
bot.onText(/^(?:\/profile(?:@\w+)?|\/ملفي(?:@\w+)?)(?:\s|$)/, (msg) => {
  const player = ensurePlayer(msg.from);
  checkWeeklyReset();
  const text =
    `👤 <b>${escapeHTML(player.name)}</b>\n` +
    `🏅 النقاط: <code>${player.points}</code>\n` +
    `✅ الانتصارات: <code>${player.wins}</code>\n` +
    `❌ الخسائر: <code>${player.losses}</code>\n` +
    `🤝 التعادلات: <code>${player.draws}</code>\n`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ==================================================
// ❌ تمت إزالة أوامر الإنجازات والنتائج الأسبوعية وترتيب 3 ضد 3.

// ==================================================
// 🏆 نظام البطولة (قيد التطوير)
// ==================================================
// 🏆 نظام البطولة — بطولة 4 ضد 4 مع خروج المغلوب
// يمكن للاعبين الانضمام حتى يكتمل العدد (8 لاعبين)، ثم تبدأ المراحل: 4 ضد 4، ثم 2 ضد 2، ثم 1 ضد 1.
bot.onText(/^(?:\/tournament(?:@\w+)?|\/بطولة(?:@\w+)?)(?:\s|$)/, (msg) => {
  // البطولة متاحة فى القروبات فقط
  if (msg.chat.type === 'private') {
    return bot.sendMessage(msg.chat.id, '❗ هذا الأمر متاح في القروبات فقط.');
  }
  const chatId = msg.chat.id;
  const user = msg.from;
  ensurePlayer(user);
  const tId = generateTournamentId();
  tournaments[tId] = {
    id: tId,
    chatId: chatId,
    participants: [
      { id: user.id, name: user.first_name || user.username || 'مستخدم' },
    ],
    stage: 'waiting',
    teams: null,
    board: null,
    turn: null,
    messageId: null,
    p1: null,
    p2: null,
  };
  bot
    .sendMessage(
      chatId,
      `👤 ${user.first_name} بدأ بطولة 4 ضد 4!\nاضغط للانضمام حتى يكتمل عدد اللاعبين (8).`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎮 انضمام إلى البطولة',
                callback_data: 'joinT:' + tId,
              },
            ],
          ],
        },
      }
    )
    .then((sent) => {
      tournaments[tId].messageId = sent.message_id;
    });
});

// ==================================================
// 📊 لوحة النتائج — تعرض ترتيب جميع اللاعبين وأفضل لاعبي الأسبوع الماضي. نقبل أيضًا الصيغة مع @اسم_البوت
bot.onText(/^(?:\/board(?:@\w+)?|\/اللوحة(?:@\w+)?)$/, (msg) => {
  checkWeeklyReset();
  const sortedPlayers = Object.values(players).sort(
    (a, b) => (b.points || 0) - (a.points || 0)
  );
  if (!sortedPlayers.length) {
    return bot.sendMessage(msg.chat.id, 'لا توجد بيانات بعد.');
  }
  const lines = sortedPlayers.map(
    (p, i) => `${i + 1}. ${p.name}: ${p.points || 0} نقطة`
  );
  loadWeeklyData();
  let historyText = '';
  if (weeklyData.history && weeklyData.history.length) {
    const last = weeklyData.history[weeklyData.history.length - 1];
    if (last.winners && last.winners.length) {
      const winnersLines = last.winners.map(
        (p, i) => `${i + 1}. ${p.name}: ${p.points} نقطة`
      );
      historyText =
        '\n\n🥇 أفضل لاعبي الأسبوع الماضي:\n' + winnersLines.join('\n');
    }
  }
  bot.sendMessage(
    msg.chat.id,
    `📊 لوحة النتائج:\n${lines.join('\n')}${historyText}`
  );
});

// ==================================================
// 🏟️ وظائف إدارة البطولة متعددة المراحل

/**
 * بدء مرحلة من البطولة. تُستخدم هذه الدالة بعد اكتمال عدد اللاعبين أو بعد انتهاء جولة.
 * تتحكم فى توزيع الفرق وبناء اللوحة حسب المرحلة الحالية.
 * @param {string} tId معرف البطولة
 */
function startTournamentStage(tId) {
  const t = tournaments[tId];
  if (!t) return;
  // إذا كانت البطولة فى وضع الانتظار، ابدأ المرحلة 4 ضد 4
  if (t.stage === 'waiting') {
    const shuffled = [...t.participants].sort(() => Math.random() - 0.5);
    t.stage = '4v4';
    t.teams = {
      X: shuffled.slice(0, 4),
      O: shuffled.slice(4, 8),
    };
    t.board = newBoard();
    t.turn = 'X';
    // أنشئ النص للفرق
    const teamXNames = t.teams.X.map((u) => u.name).join('، ');
    const teamONames = t.teams.O.map((u) => u.name).join('، ');
    const header = `🎮 بطولة 4 ضد 4\nفريق X: ${teamXNames} vs فريق O: ${teamONames}\n🎯 دور فريق X`;
    try {
      bot.editMessageText(header, {
        chat_id: t.chatId,
        message_id: t.messageId,
        ...renderBoard(t.board),
      });
    } catch (e) {
      // تجاهل أى خطأ فى التحرير
    }
  }
}

/**
 * منح النقاط للفائز فى نهاية البطولة.
 * @param {object} winnerUser كائن يضم هوية واسم الفائز
 */
function awardTournamentWinner(winnerUser) {
  checkWeeklyReset();
  const p = ensurePlayer({ id: winnerUser.id, name: winnerUser.name });
  p.points += 50;
  p.wins += 1;
  savePlayers();
}

// ==================================================
// 🎯 التفاعل مع الأزرار
bot.on('callback_query', async (query) => {
  const { message, from, data } = query;
  // معالجة زر الانضمام فى القروب أو البطولة. يتضمن callback_data المعرّف.
  if (data && (data.startsWith('joinT:'))) {
    // الانضمام إلى بطولة 4 ضد 4
    const tId = data.split(':')[1];
    const t = tournaments[tId];
    if (!t) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ لا توجد بطولة للانضمام هنا.' });
      return;
    }
    // تحقق من عدم الانضمام مسبقاً
    if (t.participants.find((p) => p.id === from.id)) {
      await bot.answerCallbackQuery(query.id, { text: '✅ أنت بالفعل في البطولة.' });
      return;
    }
    // حد اللاعبين فى البطولة 8 لاعبين
    if (t.participants.length >= 8) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ البطولة مكتملة بالفعل.' });
      return;
    }
    t.participants.push({ id: from.id, name: from.first_name || from.username || 'مستخدم' });
    ensurePlayer(from);
    await bot.answerCallbackQuery(query.id, { text: '✅ تم الانضمام إلى البطولة.' });
    if (t.participants.length === 8) {
      // عند اكتمال اللاعبين، ابدأ البطولة
      startTournamentStage(tId);
    } else {
      // حدّث الرسالة لعرض عدد المنضمين
      try {
        await bot.editMessageText(
          `👤 ${t.participants.map((p) => p.name).join(' • ')}\n🕓 بانتظار لاعبين آخرين... (${t.participants.length}/8)`,
          {
            chat_id: t.chatId,
            message_id: t.messageId,
          }
        );
      } catch (e) {
        // تجاهل أخطاء التحرير
      }
    }
    return;
  }
  if (data && (data.startsWith('join:') || data.startsWith('join6:'))) {
    // استخرج معرف اللعبة من callback_data
    const partsJoin = data.split(':');
    const joinCmd = partsJoin[0];
    const gameId = partsJoin[1];
    const game = games[gameId];
    if (!game) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ لا توجد لعبة للانضمام هنا.' });
      return;
    }
    // تحقق من نوع اللعبة مقابل الأمر
    if (joinCmd === 'join' && game.type !== 'group') {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ لا توجد لعبة ثنائية للانضمام هنا.' });
      return;
    }
    if (joinCmd === 'join6' && game.type !== 'group6') {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ لا توجد لعبة 3 ضد 3 للانضمام هنا.' });
      return;
    }
    // منع الانضمام مرتين
    if (game.players.find((p) => p.id === from.id)) {
      await bot.answerCallbackQuery(query.id, { text: '✅ أنت بالفعل في اللعبة.' });
      return;
    }
    // حد اللاعبين
    const maxPlayers = game.type === 'group' ? 2 : 6;
    if (game.players.length >= maxPlayers) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ اللعبة امتلأت بالفعل.' });
      return;
    }
    game.players.push({ id: from.id, name: from.first_name || from.username || 'مستخدم' });
    ensurePlayer(from);
    await bot.answerCallbackQuery(query.id, { text: '✅ تم الانضمام.' });
    // التحديثات حسب نوع اللعبة
    if (game.type === 'group') {
      if (game.players.length === 2) {
        game.turn = 'X';
        await bot.editMessageText(
          `🎮 لعبة بدأت بين ${game.players[0].name} و ${game.players[1].name}\n🎯 دور ${game.players[0].name} (❌)`,
          {
            chat_id: game.chatId,
            message_id: game.messageId,
            ...renderBoard(game.board),
          }
        );
      } else {
        await bot.editMessageText(
          `👤 ${game.players.map((p) => p.name).join(' • ')}\n🕓 بانتظار لاعب آخر...`,
          {
            chat_id: game.chatId,
            message_id: game.messageId,
          }
        );
      }
    } else if (game.type === 'group6') {
      if (game.players.length === 6) {
        // عند اكتمال اللاعبين، ابدأ اللعبة مباشرة بدون مؤقِّت
        startGroup6Game(gameId);
      } else {
        await bot.editMessageText(
          `👤 ${game.players.map((p) => p.name).join(' • ')}\n🕓 بانتظار لاعبين آخرين... (${game.players.length}/6)`,
          {
            chat_id: game.chatId,
            message_id: game.messageId,
          }
        );
      }
    }
    return;
  }

  // معالجة اللعب الخاص أو القروب
  const parts = (data || '').split(',');
  if (parts.length !== 2) {
    await bot.answerCallbackQuery(query.id, { text: '⚠️ بيانات غير صالحة.' });
    return;
  }
  const [i, j] = parts.map((n) => Number(n));
  if (Number.isNaN(i) || Number.isNaN(j)) {
    await bot.answerCallbackQuery(query.id, { text: '⚠️ بيانات غير صالحة.' });
    return;
  }

  // تحديد معرف اللعبة بناءً على الرسالة. أولاً ابحث فى الألعاب الخاصة، ثم الألعاب الجماعية حسب chatId و messageId
  let gameId =
    Object.keys(games).find((id) => {
      const g = games[id];
      return (
        g.type === 'private' &&
        g.msgs &&
        (g.msgs[g.p1.id] === message.message_id || g.msgs[g.p2.id] === message.message_id)
      );
    }) || null;
  if (!gameId) {
    const candidate = Object.keys(games).find((id) => {
      const g = games[id];
      return (
        (g.type === 'group' || g.type === 'group6') &&
        g.chatId === message.chat.id &&
        g.messageId === message.message_id
      );
    });
    if (candidate) gameId = candidate;
  }
  // إذا لم يتم العثور على لعبة، حاول العثور على بطولة
  if (!gameId) {
    const tId = Object.keys(tournaments).find((tid) => {
      const t = tournaments[tid];
      return t.chatId === message.chat.id && t.messageId === message.message_id;
    });
    if (tId) {
      // معالجة تفاعل البطولة
      const t = tournaments[tId];
      // تحقق من صحة الخانة
      if (!t.board || t.board[i][j] === undefined) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ خلية غير صالحة.' });
        return;
      }
      if (t.board[i][j] !== ' ') {
        await bot.answerCallbackQuery(query.id, { text: '❗ هذه الخانة مشغولة!' });
        return;
      }
      // تحديد الرمز (X أو O) حسب المرحلة والفريق
      let tSymbol = null;
      if (t.stage === '4v4' || t.stage === '2v2') {
        if (!t.teams || !t.teams.X || !t.teams.O) {
          await bot.answerCallbackQuery(query.id, { text: '⚠️ لم تُقسم الفرق بعد.' });
          return;
        }
        if (t.teams.X.some((p) => p.id === from.id)) {
          tSymbol = 'X';
        } else if (t.teams.O.some((p) => p.id === from.id)) {
          tSymbol = 'O';
        } else {
          await bot.answerCallbackQuery(query.id, { text: '⚠️ أنت لست جزءاً من هذه البطولة.' });
          return;
        }
        if (tSymbol !== t.turn) {
          await bot.answerCallbackQuery(query.id, { text: '⚠️ ليس دور فريقك الآن.' });
          return;
        }
      } else if (t.stage === '1v1') {
        if (!t.p1 || !t.p2) {
          await bot.answerCallbackQuery(query.id, { text: '⚠️ البطولة غير جاهزة.' });
          return;
        }
        if (from.id === t.p1.id) tSymbol = 'X';
        else if (from.id === t.p2.id) tSymbol = 'O';
        else {
          await bot.answerCallbackQuery(query.id, { text: '⚠️ أنت لست جزءاً من هذه البطولة.' });
          return;
        }
        if (tSymbol !== t.turn) {
          await bot.answerCallbackQuery(query.id, { text: '⚠️ ليس دورك الآن.' });
          return;
        }
      } else {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ لا يمكن تحديد مرحلة البطولة.' });
        return;
      }
      // ضع العلامة وغيّر الدور
      t.board[i][j] = tSymbol;
      t.turn = tSymbol === 'X' ? 'O' : 'X';
      const winnerSymbolT = checkWinner(t.board);
      let tournamentHeader = '';
      if (winnerSymbolT) {
        // فوز فى هذه الجولة
        if (t.stage === '4v4') {
          // تأهل الفريق الفائز (4 لاعبين) إلى مرحلة 2 ضد 2
          const winners = winnerSymbolT === 'X' ? t.teams.X : t.teams.O;
          const shuffledW = [...winners].sort(() => Math.random() - 0.5);
          t.stage = '2v2';
          t.teams = {
            X: shuffledW.slice(0, 2),
            O: shuffledW.slice(2, 4),
          };
          t.board = newBoard();
          t.turn = 'X';
          const txNames = t.teams.X.map((u) => u.name).join('، ');
          const toNames = t.teams.O.map((u) => u.name).join('، ');
          tournamentHeader = `🎮 مرحلة نصف النهائية (2 ضد 2)\nفريق X: ${txNames} vs فريق O: ${toNames}\n🎯 دور فريق X`;
        } else if (t.stage === '2v2') {
          // تأهل الفريق الفائز (2 لاعبين) إلى مرحلة 1 ضد 1
          const winners = winnerSymbolT === 'X' ? t.teams.X : t.teams.O;
          t.stage = '1v1';
          t.p1 = winners[0];
          t.p2 = winners[1];
          t.board = newBoard();
          t.turn = 'X';
          tournamentHeader = `🎮 الجولة النهائية (1 ضد 1)\n${t.p1.name} vs ${t.p2.name}\n🎯 دور ${t.p1.name} (❌)`;
        } else if (t.stage === '1v1') {
          // فاز أحد اللاعبين بالبطولة
          const winnerUser = winnerSymbolT === 'X' ? t.p1 : t.p2;
          awardTournamentWinner(winnerUser);
          tournamentHeader = `🏆 الفائز بالبطولة: ${winnerUser.name}!`;
          // احذف البطولة بعد النهاية
          delete tournaments[tId];
        }
      } else if (t.board.flat().every((c) => c !== ' ')) {
        // تعادل: إعادة الجولة بنفس المرحلة
        t.board = newBoard();
        t.turn = 'X';
        if (t.stage === '4v4') {
          const txNames = t.teams.X.map((u) => u.name).join('، ');
          const toNames = t.teams.O.map((u) => u.name).join('، ');
          tournamentHeader = `🤝 تعادل!\nفريق X: ${txNames} vs فريق O: ${toNames}\n🎯 دور فريق X`;
        } else if (t.stage === '2v2') {
          const txNames = t.teams.X.map((u) => u.name).join('، ');
          const toNames = t.teams.O.map((u) => u.name).join('، ');
          tournamentHeader = `🤝 تعادل!\nفريق X: ${txNames} vs فريق O: ${toNames}\n🎯 دور فريق X`;
        } else if (t.stage === '1v1') {
          tournamentHeader = `🤝 تعادل!\n${t.p1.name} vs ${t.p2.name}\n🎯 دور ${t.p1.name} (❌)`;
        }
      } else {
        // اللعبة مستمرة: إعداد العنوان للمرحلة الحالية
        if (t.stage === '4v4') {
          const txNames = t.teams.X.map((u) => u.name).join('، ');
          const toNames = t.teams.O.map((u) => u.name).join('، ');
          tournamentHeader = `🎮 بطولة 4 ضد 4\nفريق X: ${txNames} vs فريق O: ${toNames}\n🎯 دور فريق ${t.turn}`;
        } else if (t.stage === '2v2') {
          const txNames = t.teams.X.map((u) => u.name).join('، ');
          const toNames = t.teams.O.map((u) => u.name).join('، ');
          tournamentHeader = `🎮 مرحلة نصف النهائية (2 ضد 2)\nفريق X: ${txNames} vs فريق O: ${toNames}\n🎯 دور فريق ${t.turn}`;
        } else if (t.stage === '1v1') {
          tournamentHeader = `🎮 الجولة النهائية (1 ضد 1)\n${t.p1.name} vs ${t.p2.name}\n🎯 دور ${t.turn === 'X' ? t.p1.name : t.p2.name}`;
        }
      }
      // تحديث الرسالة بآخر حالة للبطولة
      try {
        await bot.editMessageText(tournamentHeader, {
          chat_id: t.chatId,
          message_id: t.messageId,
          ...renderBoard(t.board),
        });
      } catch (e) {
        // تجاهل أية أخطاء
      }
      await bot.answerCallbackQuery(query.id);
      return;
    } else {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ لا توجد لعبة نشطة لهذه الرسالة.' });
      return;
    }
  }
  const game = games[gameId];
  let symbol = null;
  if (game.type === 'private') {
    // لعب خاص: اللاعب الأول دائماً X والثاني O
    if (from.id === game.p1.id) symbol = 'X';
    else if (from.id === game.p2.id) symbol = 'O';
    else {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ أنت لم تشارك في هذه اللعبة.' });
      return;
    }
    if (symbol !== game.turn) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ ليس دورك الآن.' });
      return;
    }
  } else if (game.type === 'group6') {
    // لعبة 3 ضد 3: حدد الفريق الذي ينتمي إليه اللاعب
    if (!game.teams || !game.teams.X || !game.teams.O) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ لم تُقسم الفرق بعد.' });
      return;
    }
    if (game.teams.X.some((p) => p.id === from.id)) {
      symbol = 'X';
    } else if (game.teams.O.some((p) => p.id === from.id)) {
      symbol = 'O';
    } else {
      await bot.answerCallbackQuery(query.id, {
        text: '⚠️ أنت لست جزءاً من هذه اللعبة.',
      });
      return;
    }
    if (symbol !== game.turn) {
      await bot.answerCallbackQuery(query.id, {
        text: '⚠️ ليس دور فريقك الآن.',
      });
      return;
    }
  } else {
    // لعبة جماعية ثنائية
    const idx = game.players.findIndex((p) => p.id === from.id);
    if (idx === -1) {
      await bot.answerCallbackQuery(query.id, {
        text: '⚠️ انضم للعبة أولاً عبر زر الانضمام.',
      });
      return;
    }
    symbol = idx === 0 ? 'X' : 'O';
    if (symbol !== game.turn) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ ليس دورك الآن.' });
      return;
    }
  }

  if (!game.board || game.board[i][j] === undefined) {
    await bot.answerCallbackQuery(query.id, { text: '⚠️ خلية غير صالحة.' });
    return;
  }
  if (game.board[i][j] !== ' ') {
    await bot.answerCallbackQuery(query.id, { text: '❗ هذه الخانة مشغولة!' });
    return;
  }

  // ضع العلامة وغيّر الدور
  game.board[i][j] = symbol;
  game.turn = symbol === 'X' ? 'O' : 'X';

  const winnerSymbol = checkWinner(game.board);
  let resultText = '';
  if (winnerSymbol) {
    if (game.type === 'private') {
      const winnerName = winnerSymbol === 'X' ? game.p1.name : game.p2.name;
      resultText = `🏆 الفائز: ${winnerName}!`;
      awardPointsPrivateGame(gameId, winnerSymbol);
    } else if (game.type === 'group6') {
      // عند الفوز فى لعبة 3 ضد 3 أعلن الفريق الفائز وأسماء أعضائه
      const teamXNames = game.teams.X.map((u) => u.name).join('، ');
      const teamONames = game.teams.O.map((u) => u.name).join('، ');
      resultText =
        `🏆 الفريق الفائز: ` +
        (winnerSymbol === 'X'
          ? `فريق X (${teamXNames})`
          : `فريق O (${teamONames})`) +
        '!';
      awardPointsGroup6Game(game, winnerSymbol);
    } else {
      const winnerName = winnerSymbol === 'X' ? game.players[0].name : game.players[1].name;
      resultText = `🏆 الفائز: ${winnerName}!`;
      awardPointsTwoPlayerGame(game, winnerSymbol);
    }
    // حذف اللعبة بعد نهايتها
    delete games[gameId];
  } else if (game.board.flat().every((c) => c !== ' ')) {
    // التعادل
    resultText = '🤝 انتهت اللعبة بالتعادل!';
    if (game.type === 'private') {
      awardPointsPrivateGame(gameId, null);
    } else if (game.type === 'group6') {
      awardPointsGroup6Game(game, null);
    } else {
      awardPointsTwoPlayerGame(game, null);
    }
    delete games[gameId];
  } else {
    // اللعبة مستمرة
    if (game.type === 'private') {
      const nextPlayerName = game.turn === 'X' ? game.p1.name : game.p2.name;
      resultText = `🎯 دور ${nextPlayerName}`;
    } else if (game.type === 'group6') {
      resultText = `🎯 دور فريق ${game.turn}`;
    } else {
      const nextName = game.turn === 'X' ? game.players[0].name : game.players[1].name;
      resultText = `🎯 دور ${nextName}`;
    }
  }

  try {
    if (game.type === 'private') {
      // تحديث الرسائل الخاصة باللاعبين فى التحدي الخاص
      await bot.editMessageText(`🎮 ضد ${game.p2.name}\n${resultText}`, {
        chat_id: game.p1.id,
        message_id: game.msgs[game.p1.id],
        ...renderBoard(game.board),
      });
      await bot.editMessageText(`🎮 ضد ${game.p1.name}\n${resultText}`, {
        chat_id: game.p2.id,
        message_id: game.msgs[game.p2.id],
        ...renderBoard(game.board),
      });
    } else if (game.type === 'group6') {
      // نص الفرق لعرضه فى القروب 3 ضد 3
      const teamXNames = game.teams.X.map((u) => u.name).join('، ');
      const teamONames = game.teams.O.map((u) => u.name).join('، ');
      const header = `🎮 فريق X: ${teamXNames} vs فريق O: ${teamONames}\n`;
      await bot.editMessageText(header + resultText, {
        chat_id: game.chatId,
        message_id: game.messageId,
        ...renderBoard(game.board),
      });
    } else {
      // لعبة جماعية ثنائية
      await bot.editMessageText(
        `🎮 ${game.players[0].name} vs ${game.players[1].name}\n${resultText}`,
        {
          chat_id: game.chatId,
          message_id: game.messageId,
          ...renderBoard(game.board),
        }
      );
    }
  } catch (e) {
    // تجاهل أخطاء التحرير
  }
  await bot.answerCallbackQuery(query.id);
});

console.log('🚀 XO Bot v9.1 قيد التشغيل...');
