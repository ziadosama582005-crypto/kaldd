// ==================================================
// 🤖 XO Inline Bot — لعب بالتحديات + متجر + بنك
// كل اللعب يتم عبر: @YourBot play
// ==================================================

require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// ======================= الإعداد الأساسي =======================

const token = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.trim() : null;
if (!token) {
  console.error('❌ BOT_TOKEN غير موجود في ملف .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
let botUsername = 'BOTRTM_BOt';

// ======================= تخزين اللاعبين =======================

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
      items: [],            // المنتجات التي يملكها
      boost_x2: 0,          // عدد مباريات مضاعف النقاط
      boost_safe: 0,        // عدد مباريات حماية من خسارة النقاط
      loanRemaining: 0      // المتبقي من القرض
    };
  } else {
    players[id].name = user.first_name || user.username || players[id].name;
    players[id].points ??= 0;
    players[id].wins ??= 0;
    players[id].losses ??= 0;
    players[id].draws ??= 0;
    players[id].items ??= [];
    players[id].boost_x2 ??= 0;
    players[id].boost_safe ??= 0;
    players[id].loanRemaining ??= 0;
  }
  return players[id];
}

loadPlayers();

// ======================= دوال مساعدة =======================

function escapeHTML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

function generateGameId() {
  return 'g' + Math.random().toString(36).slice(2, 10);
}

// ======================= نظام المتجر =======================

// صفحات المتجر (تقدر تزيد لاحقاً براحتك)
const SHOP_PAGES = [
  // صفحة 1: سكينات وألقاب
  [
    {
      id: 'skin_red',
      name: '🎨 سكين XO حمراء',
      price: 150,
      desc: 'تضيف لمسة حمراء على رموزك في الرسائل (شكل تجميلي).',
    },
    {
      id: 'skin_gold',
      name: '🥇 XO ذهبية',
      price: 300,
      desc: 'مظهر ذهبي مميز يظهر في مبارياتك القادمة.',
    },
    {
      id: 'title_king',
      name: '👑 لقب "ملك XO"',
      price: 250,
      desc: 'يظهر بجانب اسمك في لوحة المتصدرين (تأثير اجتماعي).',
    },
  ],
  // صفحة 2: بوستات (Boosts)
  [
    {
      id: 'boost_x2',
      name: '⚡ مضاعِف نقاط ×2 (5 مباريات)',
      price: 220,
      desc: 'أول 5 انتصارات قادمة تُحتسب بنقاط مضاعفة.',
    },
    {
      id: 'boost_safe',
      name: '🛡 حماية من الخسارة (3 مباريات)',
      price: 180,
      desc: '3 مباريات، لو خسرت لا تُخصم نقاط (لما نطبق نظام خصم لاحقاً).',
    },
  ],
  // صفحة 3: إضافات شكلية
  [
    {
      id: 'emoji_win',
      name: '🎉 إيموجي احتفال بالفوز',
      price: 80,
      desc: 'يظهر إيموجي مميز في رسائل فوزك.',
    },
    {
      id: 'badge_pro',
      name: '💠 شارة لاعب محترف',
      price: 120,
      desc: 'شارة بجانب اسمك في /board.',
    },
  ],
  // صفحة 4: البنك والقرض
  [
    {
      id: 'loan_1000',
      name: '💳 قرض 1000 عملة',
      price: 0,
      desc: 'تحصل على 1000 فوراً، يتم سدادها تلقائياً من نقاط الفوز القادمة.',
    },
  ],
];

function getShopPage(pageIndex) {
  const total = SHOP_PAGES.length;
  if (pageIndex < 0) pageIndex = 0;
  if (pageIndex >= total) pageIndex = total - 1;

  const items = SHOP_PAGES[pageIndex];
  let text = `🛒 <b>متجر XO</b>\nصفحة ${pageIndex + 1} من ${total}\n\n`;

  items.forEach((item, idx) => {
    text += `#${idx + 1} — <b>${escapeHTML(item.name)}</b>\n`;
    text += `💰 السعر: ${item.price} عملة\n`;
    text += `ℹ️ ${escapeHTML(item.desc)}\n\n`;
  });

  const inline_keyboard = items.map((item, idx) => [
    {
      text: `شراء #${idx + 1}`,
      callback_data: `buy:${pageIndex}:${idx}`,
    },
  ]);

  const navRow = [];
  if (pageIndex > 0) {
    navRow.push({ text: '⬅️ السابق', callback_data: `shop:${pageIndex - 1}` });
  }
  if (pageIndex < total - 1) {
    navRow.push({ text: 'التالي ➡️', callback_data: `shop:${pageIndex + 1}` });
  }
  if (navRow.length) inline_keyboard.push(navRow);

  inline_keyboard.push([
    { text: '💼 رصيدي', callback_data: 'wallet' },
    { text: '❓ شرح المتجر', callback_data: 'shop_help' },
  ]);

  return { text, reply_markup: { inline_keyboard }, pageIndex };
}

function applyLoanIfAny(player, gainedPoints) {
  // سداد تلقائي من النقاط المكتسبة
  if (player.loanRemaining > 0 && gainedPoints > 0) {
    const repay = Math.min(gainedPoints, player.loanRemaining);
    player.loanRemaining -= repay;
    gainedPoints -= repay;
  }
  player.points += gainedPoints;
}

// كسب النقاط بعد المباراة مع مراعاة البوستات والقرض
function rewardPlayer(player, basePoints, { isWin = false, isLoss = false } = {}) {
  let points = basePoints;

  // مضاعف نقاط
  if (isWin && player.boost_x2 > 0 && basePoints > 0) {
    points *= 2;
    player.boost_x2 -= 1;
  }

  // حماية من الخسارة (في حال مستقبلاً خصم نقاط عند الخسارة)
  if (isLoss && player.boost_safe > 0 && points < 0) {
    player.boost_safe -= 1;
    points = 0;
  }

  applyLoanIfAny(player, points);
}

// ======================= إدارة الألعاب =======================

// game:
// {
//   id,
//   host: {id,name},
//   hostSymbol: 'X' | 'O',
//   opp: {id,name} | null,
//   oppSymbol: 'X'|'O'|null,
//   board,
//   turn: 'X'|'O'|null,
//   status: 'waiting' | 'playing' | 'finished',
//   inline_message_id OR (chatId,messageId)
// }

const games = {};

// ======================= جاهزية البوت =======================

bot.getMe().then((me) => {
  botUsername = me.username;
  console.log(`✅ البوت جاهز: @${botUsername}`);

  bot.setMyCommands([
    { command: 'start', description: 'شرح استخدام البوت' },
    { command: 'profile', description: 'عرض ملف اللاعب' },
    { command: 'board', description: 'عرض المتصدرين' },
    { command: 'shop', description: 'الدخول إلى متجر XO' },
  ]);
});

// ======================= /start في الخاص =======================

bot.onText(/\/start(?:\s+.*)?/, (msg) => {
  if (msg.chat.type !== 'private') return;

  const p = ensurePlayer(msg.from);

  const text =
    '👋 أهلاً <b>' + escapeHTML(p.name) + '</b>\n\n' +
    '🎮 <b>طريقة اللعب الأساسية:</b>\n' +
    '1️⃣ في أي قروب أو محادثة، اكتب: <code>@' + escapeHTML(botUsername) + ' play</code>\n' +
    '2️⃣ ستظهر لك بطاقتان:\n' +
    '   • اختر أن تبدأ التحدي وأنت ❌ أو ⭕.\n' +
    '3️⃣ أرسل البطاقة.\n' +
    '4️⃣ سيظهر زر واحد "انضم كـ خصم". أول من يضغطه يصبح خصمك.\n' +
    '5️⃣ تبدأ اللعبة مباشرة بلوحة XO في نفس الرسالة.\n\n' +
    '💰 <b>النقاط:</b>\n' +
    '• الفوز: +10 عملات (تتأثر بالبوستات والقرض).\n' +
    '• التعادل: +2 عملات لكل لاعب.\n\n' +
    '🛒 <b>المتجر:</b> سكينات، ألقاب، بوستات نقاط، وقسم بنك مع قرض 1000 عملة.\n' +
    '💳 القرض يتم سداده تلقائياً من أرباحك المستقبلية.\n\n' +
    'استخدم:\n' +
    '• /profile لعرض ملفك.\n' +
    '• /board لعرض أفضل اللاعبين.\n' +
    '• /shop لفتح المتجر.';

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ======================= /profile =======================

bot.onText(/^\/(?:profile|ملفي)(?:@\w+)?$/, (msg) => {
  const p = ensurePlayer(msg.from);
  const text =
    `👤 <b>${escapeHTML(p.name)}</b>\n` +
    `💰 الرصيد: <code>${p.points}</code>\n` +
    `✅ فوز: <code>${p.wins}</code>\n` +
    `❌ خسارة: <code>${p.losses}</code>\n` +
    `🤝 تعادل: <code>${p.draws}</code>\n` +
    `💳 قرض متبقّي: <code>${p.loanRemaining}</code>`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ======================= /board =======================

bot.onText(/^\/(?:board|اللوحة)(?:@\w+)?$/, (msg) => {
  const list = Object.values(players).sort((a, b) => (b.points || 0) - (a.points || 0)).reverse();
  if (!list.length) {
    return bot.sendMessage(
      msg.chat.id,
      `لا توجد بيانات بعد.\nابدأ أول تحدي عبر @${botUsername} play`
    );
  }
  const top = list.slice(0, 20);
  const lines = top.map(
    (p, i) =>
      `${i + 1}. ${p.name} — ${p.points} 💰 (فوز:${p.wins} / خسارة:${p.losses} / تعادل:${p.draws})`
  );
  bot.sendMessage(msg.chat.id, '📊 <b>لوحة المتصدرين:</b>\n' + lines.join('\n'), {
    parse_mode: 'HTML',
  });
});

// ======================= /shop =======================

bot.onText(/^\/shop(?:@\w+)?$/, (msg) => {
  const { text, reply_markup } = getShopPage(0);
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML', reply_markup });
});

// ======================= Inline Mode: @Bot play =======================

bot.on('inline_query', async (query) => {
  try {
    const q = (query.query || '').trim().toLowerCase();

    if (!q || q === 'play' || q === 'xo') {
      const res = [];

      // بطاقة: أنا ❌
      {
        const gameId = generateGameId();
        res.push({
          type: 'article',
          id: `${gameId}:X`,
          title: 'بدء لعبة XO (أنت ❌)',
          description: 'أرسل الدعوة، خصمك ينضم بزر واحد.',
          input_message_content: {
            message_text:
              `🎮 تحدي XO رقم ${gameId}\n` +
              `❌ محجوزة لصاحب الدعوة.\n` +
              `👤 اضغط الزر بالأسفل للانضمام كخصم بالرمز ⭕.`,
          },
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🕹 انضم كخصم ⭕',
                  callback_data: `join:${gameId}`,
                },
              ],
            ],
          },
        });
      }

      // بطاقة: أنا ⭕
      {
        const gameId = generateGameId();
        res.push({
          type: 'article',
          id: `${gameId}:O`,
          title: 'بدء لعبة XO (أنت ⭕)',
          description: 'أرسل الدعوة، خصمك ينضم بزر واحد.',
          input_message_content: {
            message_text:
              `🎮 تحدي XO رقم ${gameId}\n` +
              `⭕ محجوزة لصاحب الدعوة.\n` +
              `👤 اضغط الزر بالأسفل للانضمام كخصم بالرمز ❌.`,
          },
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🕹 انضم كخصم ❌',
                  callback_data: `join:${gameId}`,
                },
              ],
            ],
          },
        });
      }

      await bot.answerInlineQuery(query.id, res, {
        cache_time: 0,
        is_personal: true,
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

// ======================= chosen_inline_result =======================
bot.on('chosen_inline_result', async (result) => {
  try {
    const { from, result_id, inline_message_id } = result;
    const parts = (result_id || '').split(':'); // مثل gabc123:X
    if (parts.length !== 2) return;
    const [gameId, symbol] = parts;
    const hostSymbol = symbol === 'O' ? 'O' : 'X';

    // احفظ اللعبة في الذاكرة
    games[gameId] = {
      id: gameId,
      host: { id: uid(from.id), name: from.first_name || from.username || 'لاعب' },
      hostSymbol,
      opp: null,
      oppSymbol: null,
      board: newBoard(),
      turn: null,
      status: 'waiting',
      inline_message_id
    };

    // عدّل زر الانضمام ليحمل الهوية والرمز
    const joinText = hostSymbol === 'X' ? '🕹 انضم كخصم ⭕' : '🕹 انضم كخصم ❌';
    await bot.editMessageReplyMarkup({
      inline_keyboard: [[
        { text: joinText, callback_data: `join:${gameId}:${uid(from.id)}:${hostSymbol}` }
      ]]
    }, { inline_message_id });
  } catch (err) {
    console.error('chosen_inline_result error:', err.message);
  }
});

// ======================= التعامل مع جميع الأزرار =======================

bot.on('callback_query', async (query) => {
  try {
    const { from, data, inline_message_id, message } = query;

    // -------- المتجر: تنقل بين الصفحات --------
    if (data && data.startsWith('shop:')) {
      const pageIndex = Number(data.split(':')[1]) || 0;
      const { text, reply_markup } = getShopPage(pageIndex);
      const target = inline_message_id
        ? { inline_message_id }
        : { chat_id: message.chat.id, message_id: message.message_id };

      await bot.editMessageText(text, {
        ...target,
        parse_mode: 'HTML',
        reply_markup,
      });
      return bot.answerCallbackQuery(query.id);
    }

    // -------- المتجر: شراء عنصر --------
    if (data && data.startsWith('buy:')) {
      const parts = data.split(':'); // buy:page:idx
      const pageIndex = Number(parts[1]) || 0;
      const itemIndex = Number(parts[2]) || 0;
      const items = SHOP_PAGES[pageIndex] || [];
      const item = items[itemIndex];

      const p = ensurePlayer(from);
      if (!item) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ هذا المنتج غير متاح.',
          show_alert: true,
        });
        return;
      }

      // قرض له منطق خاص
      if (item.id === 'loan_1000') {
        if (p.loanRemaining > 0) {
          await bot.answerCallbackQuery(query.id, {
            text: '⚠️ لديك قرض مفتوح بالفعل، سدده أولاً.',
            show_alert: true,
          });
          return;
        }
        p.points += 1000;
        p.loanRemaining = 1000;
        savePlayers();
        await bot.answerCallbackQuery(query.id, {
          text: '✅ تم إضافة قرض 1000 عملة إلى رصيدك.\nسيتم السداد تلقائياً من أرباحك القادمة.',
          show_alert: true,
        });
        return;
      }

      if (p.points < item.price) {
        await bot.answerCallbackQuery(query.id, {
          text: '💸 رصيدك لا يكفي للشراء.',
          show_alert: true,
        });
        return;
      }

      p.points -= item.price;
      p.items.push(item.id);
      if (item.id === 'boost_x2') p.boost_x2 += 5;
      if (item.id === 'boost_safe') p.boost_safe += 3;
      if (item.id === 'badge_pro') p.badge_pro = true;

      savePlayers();

      await bot.answerCallbackQuery(query.id, {
        text: `✅ تم شراء: ${item.name}`,
        show_alert: true,
      });

      return;
    }

    // -------- المتجر: عرض رصيدي --------
    if (data === 'wallet') {
      const p = ensurePlayer(from);
      await bot.answerCallbackQuery(query.id, {
        text:
          `رصيدك: ${p.points} 💰\n` +
          `قرض متبقّي: ${p.loanRemaining}\n` +
          `مضاعِف نقاط: ${p.boost_x2} مباراة\n` +
          `حماية خسارة: ${p.boost_safe} مباراة`,
        show_alert: true,
      });
      return;
    }

    // -------- المتجر: شرح --------
    if (data === 'shop_help') {
      await bot.answerCallbackQuery(query.id, {
        text:
          'كل منتج يعطيك ميزة تجميلية أو مساعدة:\n' +
          '- السكينات/الألقاب: شكل وهيبة.\n' +
          '- البوستات: مضاعفة نقاط أو حماية.\n' +
          '- القرض: 1000 عملة تُسدد تلقائياً من أرباحك.',
        show_alert: true,
      });
      return;
    }

    // -------- الانضمام للتحدي --------
    if (data && data.startsWith('join:')) {
      // join:<gameId>:<hostId>:<hostSymbol>
      const parts = data.split(':');
      const gameId = parts[1];
      const hostId = parts[2] ? Number(parts[2]) : null;
      const hostSymbolFromBtn = parts[3] === 'O' ? 'O' : 'X';

      let game = games[gameId];

      // إعادة بناء اللعبة لو الذاكرة فاضية
      if (!game) {
        game = {
          id: gameId,
          host: { id: uid(hostId || 0), name: 'المضيف' },
          hostSymbol: hostSymbolFromBtn,
          opp: null,
          oppSymbol: null,
          board: newBoard(),
          turn: null,
          status: 'waiting',
          // سيتم ربط الهدف أدناه
        };
        if (inline_message_id) {
          game.inline_message_id = inline_message_id;
        } else if (message) {
          game.chatId = message.chat.id;
          game.messageId = message.message_id;
        }
        games[gameId] = game;
      }

      // منع المضيف من الانضمام كخصم
      if (uid(from.id) === uid(game.host?.id)) {
        await bot.answerCallbackQuery(query.id, { text: 'أنت صاحب التحدي بالفعل.' });
        return;
      }

      if (game.status !== 'waiting') {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ هذا التحدي غير متاح الآن.' });
        return;
      }
      if (game.opp) {
        await bot.answerCallbackQuery(query.id, { text: '🚫 تم حجز مقعد الخصم بالفعل.' });
        return;
      }

      // سجّل الخصم
      game.opp = { id: uid(from.id), name: from.first_name || from.username || 'لاعب' };
      game.oppSymbol = (game.hostSymbol === 'X') ? 'O' : 'X';

      // ✨ مهم: عيّن pX و pO ليستخدمهما هاندلر الحركات
      if (game.hostSymbol === 'X') {
        game.pX = game.host;
        game.pO = game.opp;
      } else {
        game.pX = game.opp;
        game.pO = game.host;
      }

      // ابدأ المباراة
      game.status = 'playing';
      game.turn  = 'X';               // X يبدأ دائمًا
      const target = game.inline_message_id
        ? { inline_message_id: game.inline_message_id }
        : { chat_id: (game.chatId || message.chat.id), message_id: (game.messageId || message.message_id) };

      const header =
        `🎮 لعبة XO بدأت!
` +
        `❌ ${game.pX.name}
` +
        `⭕ ${game.pO.name}
` +
        `🎯 دور ${game.turn === 'X' ? game.pX.name : game.pO.name}`;

      await bot.editMessageText(header, {
        ...target,
        reply_markup: renderBoardInline(gameId, game.board),
      });

      // تنبيه فوري لمن ضغط الزر بوضع الدور
      await bot.answerCallbackQuery(query.id, {
        text: `✅ تم الانضمام. الآن دور: ${game.turn === 'X' ? game.pX.name : game.pO.name}`,
        show_alert: false,
      });
      return;
    }

    // -------- تنفيذ حركة mv:gameId:i:j --------
    if (data && data.startsWith('mv:')) {
      const [, gameId, si, sj] = data.split(':');
      const i = Number(si);
      const j = Number(sj);
      const game = games[gameId];

      if (!game || game.status !== 'playing') {
        await bot.answerCallbackQuery(query.id, {
          text: '⚠️ لا توجد مباراة نشطة لهذه الرسالة.',
          show_alert: false,
        });
        return;
      }

      const target = game.inline_message_id
        ? { inline_message_id: game.inline_message_id }
        : { chat_id: game.chatId, message_id: game.messageId };

      if (!game.board[i] || game.board[i][j] === undefined) {
        await bot.answerCallbackQuery(query.id, { text: '❌ حركة غير صالحة.' });
        return;
      }
      if (game.board[i][j] !== ' ') {
        await bot.answerCallbackQuery(query.id, { text: '❗ هذه الخانة مشغولة.' });
        return;
      }

      const expectedId = game.turn === 'X' ? uid(game.pX?.id) : uid(game.pO?.id);
      if (uid(from.id) !== expectedId) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ ليس دورك الآن.' });
        return;
      }

      // تنفيذ الحركة
      game.board[i][j] = game.turn;

      const winnerSymbol = checkWinner(game.board);
      const full = game.board.flat().every((c) => c !== ' ');

      const pHost = ensurePlayer({ id: game.host.id, first_name: game.host.name });
      const pOpp = ensurePlayer({ id: game.opp.id, first_name: game.opp.name });

      if (winnerSymbol || full) {
        game.status = 'finished';

        let msg;
        if (winnerSymbol) {
          const winnerIsHost = (winnerSymbol === game.hostSymbol);
          const winner = winnerIsHost ? game.host : game.opp;
          const loser = winnerIsHost ? game.opp : game.host;

          const pWinner = winnerIsHost ? pHost : pOpp;
          const pLoser = winnerIsHost ? pOpp : pHost;

          pWinner.wins += 1;
          pLoser.losses += 1;
          rewardPlayer(pWinner, 10, { isWin: true });

          msg =
            `🏆 انتهت المباراة!
` +
            `الفائز: ${winner.name} (${winnerSymbol === 'X' ? '❌' : '⭕'})`;
        } else {
          pHost.draws += 1;
          pOpp.draws += 1;
          rewardPlayer(pHost, 2);
          rewardPlayer(pOpp, 2);
          msg = '🤝 انتهت المباراة بالتعادل!';
        }

        savePlayers();

        await bot.editMessageText(msg, {
          ...target,
          reply_markup: renderBoardInline(gameId, game.board),
        });

        delete games[gameId];
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // استمرار اللعبة
      game.turn = game.turn === 'X' ? 'O' : 'X';

      const pXName = game.hostSymbol === 'X' ? game.host.name : game.opp.name;
      const pOName = game.hostSymbol === 'O' ? game.host.name : game.opp.name;
      const turnName = game.turn === 'X' ? pXName : pOName;

      const header =
        `🎮 لعبة XO
` +
        `❌ ${pXName} — ⭕ ${pOName}
` +
        `🎯 دور ${turnName}`;

      await bot.editMessageText(header, {
        ...target,
        reply_markup: renderBoardInline(gameId, game.board),
      });

      await bot.answerCallbackQuery(query.id);
      return;
    }

    // أي زر غير معروف
    await bot.answerCallbackQuery(query.id, { text: '⚠️ هذا الزر غير مدعوم حالياً.' });
  } catch (err) {
    console.error('callback_query error:', err.message);
    try {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ حدث خطأ غير متوقع.' });
    } catch (_) {}
  }
});

console.log('🚀 XO Inline Bot يعمل الآن باستخدام @' + (botUsername || 'YourBot') + ' play فقط');
