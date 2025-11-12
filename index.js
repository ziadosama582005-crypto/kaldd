// ==================================================
// 🤖 XO Inline Bot — تحديات + رهانات + متجر + بوت AI
// كل اللعب عبر @Bot play
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
// 🧾 إدارة اللاعبين
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
      points: 0,         // تستخدم للرهانات والترتيب
      coins: 0,          // عملات المتجر
      wins: 0,
      losses: 0,
      draws: 0,
      ownedSkins: ['default'],
      activeSkin: 'default',
      ownedTitles: [],
      activeTitle: null,
      ownedTaunts: [],
      activeTaunt: null,
      boosts: {
        winX2: 0,        // مباريات فوز بنقاط مضاعفة
      },
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
    players[id].ownedTitles = players[id].ownedTitles || [];
    players[id].ownedTaunts = players[id].ownedTaunts || [];
    players[id].boosts = players[id].boosts || { winX2: 0 };
  }
  return players[id];
}

loadPlayers();

function escapeHTML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ==================================================
// 🛍 المتجر (سكينات + ألقاب + Taunts + Boosts بسيطة)
// ==================================================

// سكينات فعّالة
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
  hero: {
    id: 'hero',
    name: '🦸 البطل',
    price: 80,
    icons: { X: '🦸', O: '⭐', empty: '⬜' },
  },
  space: {
    id: 'space',
    name: '🌌 الفضاء',
    price: 90,
    icons: { X: '🌕', O: '🪐', empty: '⬛' },
  },
};

// عناصر أخرى (اقتراحات كثيرة، بعضها تجميلي)
const SHOP_EXTRA = [
  // ألقاب
  { id: 'title_king', type: 'title', name: '👑 لقب الملك', price: 50 },
  { id: 'title_legend', type: 'title', name: '💎 الأسطورة', price: 80 },
  { id: 'title_hunter', type: 'title', name: '🔥 صائد الانتصارات', price: 60 },
  { id: 'title_wolf', type: 'title', name: '🐺 الذيب', price: 40 },
  { id: 'title_brain', type: 'title', name: '🧠 المخطط', price: 40 },
  // Taunts
  { id: 'taunt_fire', type: 'taunt', name: '🔥 أحرقك بالذكاء!', price: 25 },
  { id: 'taunt_king', type: 'taunt', name: '👑 لا تلعب مع الملوك.', price: 25 },
  { id: 'taunt_skull', type: 'taunt', name: '💀 نهايتك قريبة.', price: 25 },
  // Boosts بسيطة
  { id: 'boost_x2_3', type: 'boost_winX2', name: '🎯 مضاعف فوز ×2 (3 مباريات)', price: 60, amount: 3 },
  { id: 'boost_x2_1', type: 'boost_winX2', name: '⚡ مضاعف فوز ×2 (مباراة واحدة)', price: 25, amount: 1 },
];

// عنوان حسب النقاط
function getTitle(p) {
  const pts = p.points || 0;
  if (p.activeTitle) return p.activeTitle;
  if (pts >= 300) return '🔥 أسطورة XO';
  if (pts >= 150) return '👑 محترف XO';
  if (pts >= 50) return '🎯 لاعب نشيط';
  return '🌱 مبتدئ';
}

// تطبيق البوست على نقاط الفوز
function applyWinBoost(p, base) {
  let extra = 0;
  if (p.boosts && p.boosts.winX2 > 0) {
    extra = base; // x2 → تضيف نفس المقدار مرة ثانية
    p.boosts.winX2 -= 1;
    if (p.boosts.winX2 < 0) p.boosts.winX2 = 0;
  }
  return base + extra;
}

// ==================================================
// 🎮 أساس XO
// ==================================================

function newBoard() {
  return [[' ', ' ', ' '], [' ', ' ', ' '], [' ', ' ', ' ']];
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
  return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// PvP inline games
// game = { id, inline_message_id, status, board, turn, pX, pO, p1, p2, icons, bet, stakeActive }
const games = {};

// vs Bot
// botGame = { id, chatId, messageId, board, turn, userId, level }
const botGames = {};
// --- robust inline mapping to avoid "challenge unavailable" when process restarts or multiple instances ---
const inlineToGameId = {};

/** Resolve a game by explicit gameId (preferred) or by inline_message_id fallback */

// --- simple persistence to survive restarts ---
const GAMES_FILE = 'games.json';

function loadGamesFromDisk() {
  try {
    if (!fs.existsSync(GAMES_FILE)) fs.writeFileSync(GAMES_FILE, JSON.stringify({ games: {}, inlineToGameId: {} }, null, 2), 'utf8');
    const raw = fs.readFileSync(GAMES_FILE, 'utf8');
    const parsed = raw && raw.trim() ? JSON.parse(raw) : { games: {}, inlineToGameId: {} };
    Object.assign(games, parsed.games || {});
    Object.assign(inlineToGameId, parsed.inlineToGameId || {});
    console.log('💾 استعادة', Object.keys(games).length, 'لعبة من القرص.');
  } catch (e) {
    console.error('⚠️ تعذر قراءة ملف الألعاب:', e.message);
  }
}

function saveGamesToDisk() {
  try {
    const data = { games, inlineToGameId };
    fs.writeFileSync(GAMES_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('⚠️ تعذر حفظ ملف الألعاب:', e.message);
  }
}

function resolveGame(gameId, inlineId) {
  let g = gameId ? games[gameId] : null;
  if (!g && inlineId && inlineToGameId[inlineId]) {
    const altId = inlineToGameId[inlineId];
    g = games[altId] || null;
  }
  return g;
}

loadGamesFromDisk();


// بناء سكينات اللعبة
function buildIconsForGame(game) {
  const pXFull = ensurePlayer({ id: game.pX.id, first_name: game.pX.name, username: game.pX.username });
  const pOFull = ensurePlayer({ id: game.pO.id, first_name: game.pO.name, username: game.pO.username });

  const skinX = SHOP_SKINS[pXFull.activeSkin] || SHOP_SKINS.default;
  const skinO = SHOP_SKINS[pOFull.activeSkin] || SHOP_SKINS.default;

  game.icons = {
    X: skinX.icons.X,
    O: skinO.icons.O,
    empty: '⬜',
  };
}

// لوحة مخصصة حسب اللعبة
function renderBoardInline(game) {
  return {
    inline_keyboard: game.board.map((row, i) =>
      row.map((cell, j) => {
        let t = game.icons.empty;
        if (cell === 'X') t = game.icons.X;
        else if (cell === 'O') t = game.icons.O;
        return {
          text: t,
          callback_data: `mv:${game.id}:${i}:${j}`,
        };
      })
    ),
  };
}

// نقاط + رهان
function awardPointsAndBet(game, winnerSymbol) {
  if (!game.pX || !game.pO) return;

  const pX = ensurePlayer({ id: game.pX.id, first_name: game.pX.name, username: game.pX.username });
  const pO = ensurePlayer({ id: game.pO.id, first_name: game.pO.name, username: game.pO.username });

  const bet = game.bet || 0;
  const stakeActive = !!game.stakeActive;

  if (!winnerSymbol) {
    // تعادل
    pX.draws++;
    pO.draws++;
    pX.coins += 3;
    pO.coins += 3;
    if (stakeActive && bet > 0) {
      pX.points += bet;
      pO.points += bet;
    }
  } else {
    if (winnerSymbol === 'X') {
      pX.wins++;
      pO.losses++;
      let base = 10;
      base = applyWinBoost(pX, base);
      pX.points += base;
      pX.coins += 10;
      if (stakeActive && bet > 0) pX.points += bet * 2;
    } else {
      pO.wins++;
      pX.losses++;
      let base = 10;
      base = applyWinBoost(pO, base);
      pO.points += base;
      pO.coins += 10;
      if (stakeActive && bet > 0) pO.points += bet * 2;
    }
  }

  savePlayers();
}

// ==================================================
// 🏠 القائمة الرئيسية وواجهات
// ==================================================

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '👥 كيف أتحدى صديقي؟', callback_data: 'menu:friend' }],
      [{ text: '🤖 اللعب مع البوت', callback_data: 'menu:bot' }],
      [
        { text: '🏦 البنك', callback_data: 'menu:bank' },
        { text: '🌍 المتصدرين', callback_data: 'menu:board' },
      ],
      [{ text: '🛍 المتجر', callback_data: 'menu:shop' }],
      [{ text: '🎁 الهدايا', callback_data: 'menu:gift' }],
      [{ text: 'ℹ️ مساعدة', callback_data: 'menu:help' }],
    ],
  };
}

function backHomeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🏠 رجوع للقائمة', callback_data: 'menu:home' }],
    ],
  };
}

function sendMainMenu(chatId, name) {
  const text =
    '👋 أهلاً <b>' + escapeHTML(name || '') + '</b>\n\n' +
    'كل اللعب هنا يكون عن طريق <b>Inline</b>:\n' +
    `✅ اكتب في أي مكان: <code>@${escapeHTML(botUsername || 'Bot')} play</code>\n` +
    `✅ أو: <code>@${escapeHTML(botUsername || 'Bot')} play 10</code> لرهان 10 نقاط.\n\n` +
    '👇 استخدم الأزرار للتحكم:\n' +
    '• 👥 شرح اللعب مع صديق\n' +
    '• 🤖 تحدي البوت\n' +
    '• 🛍 متجر السكينات والمزايا\n' +
    '• 🏦 البنك الذهبي\n' +
    '• 🌍 لوحة المتصدرين\n' +
    '• 🎁 الهدايا بين اللاعبين\n';

  return bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: mainMenuKeyboard(),
  });
}

// متجر سكينات + عناصر إضافية
function buildShopKeyboard(user) {
  const rows = [];

  // سكينات
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
          callback_data: `shop:buySkin:${skin.id}`,
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
          callback_data: `shop:useSkin:${skin.id}`,
        },
      ]);
    }
  });

  // عناصر إضافية (ألقاب / Taunts / Boosts)
  SHOP_EXTRA.forEach((item) => {
    rows.push([
      {
        text: `${item.name} — ${item.price}💰`,
        callback_data: `shop:buyExtra:${item.id}`,
      },
    ]);
  });

  rows.push([{ text: '🏠 رجوع', callback_data: 'menu:home' }]);

  return { inline_keyboard: rows };
}

function sendShop(chatId, user) {
  const text =
    '🛍 <b>متجر XO</b>\n' +
    `💰 رصيدك: <code>${user.coins}</code> عملة\n\n` +
    '• اشترِ سكينات لتغيير شكل اللعبة.\n' +
    '• ألقاب وعبارات وBoosts لتميز حسابك.';

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
    { command: 'profile', description: 'عرض ملفك' },
    { command: 'board', description: 'لوحة المتصدرين' },
    { command: 'shop', description: 'متجر XO' },
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
    `🏆 اللقب: <b>${escapeHTML(title)}</b>\n` +
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
  const list = Object.values(players).sort((a, b) => (b.points || 0) - (a.points || 0));
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
    'يمكنك استخدام النقاط للرهان، والعملات للمتجر.\n' +
    'إذا رصيدك أقل من الرهان → ما تقدر تدخل التحدي.';

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
// /bot — اختيار مستوى البوت
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
// Inline Mode — @Bot play (+ رهان اختياري)
// ==================================================

bot.on('inline_query', async (query) => {
  try {
    const q = (query.query || '').trim().toLowerCase();
    let bet = 0;
    let m;

    if (/^\d+$/.test(q)) {
      bet = parseInt(q, 10);
    } else if ((m = q.match(/^(?:play|xo)\s+(\d+)$/))) {
      bet = parseInt(m[1], 10);
    }

    if (bet < 0 || isNaN(bet)) bet = 0;
    if (bet > 100000) bet = 100000;

    if (!q || q === 'play' || q === 'xo' || /^\d+$/.test(q) || /^(?:play|xo)\s+\d+$/.test(q)) {
      const baseId = generateGameId();
      const fromName = query.from.first_name || query.from.username || 'لاعب';

      const betLine = bet > 0
        ? `💰 رهان: ${bet} نقطة من كل لاعب.\n`
        : '';

      const textX =
        `🎮 تحدي XO\n` +
        `❌ ${fromName} هو اللاعب الأول.\n` +
        betLine +
        `أرسل التحدي، وأول من يضغط "انضم كخصم" يصبح ⭕.\n`;

      const textO =
        `🎮 تحدي XO\n` +
        `⭕ ${fromName} هو اللاعب الأول.\n` +
        betLine +
        `أرسل التحدي، وأول من يضغط "انضم كخصم" يصبح ❌.\n`;

      const resultX = {
        type: 'article',
        id: `${baseId}:X:${bet}`,
        title: bet > 0
          ? `أنت ❌ — رهان ${bet}`
          : 'بدء تحدي XO (أنت ❌)',
        description: bet > 0
          ? `تحدي برهان ${bet} نقطة`
          : 'تحدي بدون رهان',
        input_message_content: { message_text: textX },
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 انضم كخصم', callback_data: `join:${baseId}` }],
          ],
        },
      };

      const resultO = {
        type: 'article',
        id: `${baseId}:O:${bet}`,
        title: bet > 0
          ? `أنت ⭕ — رهان ${bet}`
          : 'بدء تحدي XO (أنت ⭕)',
        description: bet > 0
          ? `تحدي برهان ${bet} نقطة`
          : 'تحدي بدون رهان',
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
        switch_pm_text: 'اكتب play أو play 10 لبدء XO',
        switch_pm_parameter: 'start',
      });
    }
  } catch (err) {
    console.error('inline_query error:', err.message);
  }
});

// إنشاء اللعبة عند إرسال النتيجة فعلاً
bot.on('chosen_inline_result', async (res) => {
  try {
    const { result_id, from, inline_message_id } = res;
    if (!result_id || !inline_message_id) return;

    const parts = result_id.split(':'); // baseId : X|O : bet
    const gameId = parts[0];
    const symbol = parts[1];
    const bet = parseInt(parts[2] || '0', 10) || 0;

    if (!gameId || (symbol !== 'X' && symbol !== 'O')) return;

    const p1 = {
      id: from.id,
      name: from.first_name || from.username || 'لاعب',
      username: from.username || null,
    };
    ensurePlayer(from);

    inlineToGameId[inline_message_id] = gameId;
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
      icons: { X: '❌', O: '⭕', empty: '⬜' },
      bet: bet > 0 ? bet : 0,
      stakeActive: false,
    };
  } catch (err) {
    console.error('chosen_inline_result error:', err.message);
  }
});

// ==================================================
// 🤖 منطق البوت
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
  for (const [i, j] of getAvailableMoves(board)) {
    board[i][j] = botSymbol;
    if (checkWinner(board) === botSymbol) {
      board[i][j] = ' ';
      return [i, j];
    }
    board[i][j] = ' ';
  }
  for (const [i, j] of getAvailableMoves(board)) {
    board[i][j] = humanSymbol;
    if (checkWinner(board) === humanSymbol) {
      board[i][j] = ' ';
      return [i, j];
    }
    board[i][j] = ' ';
  }
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
    return botSmartMove(board, 'O', 'X') || moves[Math.floor(Math.random() * moves.length)];
  }
  return botSmartMove(board, 'O', 'X') || moves[Math.floor(Math.random() * moves.length)];
}

// ==================================================
// 🎯 Callback واحد
// ==================================================

bot.on('callback_query', async (query) => {
  const { from, data, message, inline_message_id, id } = query;
  if (!data) {
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  const user = ensurePlayer(from);

  // ---------- MENUS ----------
  if (data === 'menu:home') {
    if (message) {
      await bot.editMessageText(
        '🏠 القائمة الرئيسية',
        {
          chat_id: message.chat.id,
          message_id: message.message_id,
          parse_mode: 'HTML',
          reply_markup: mainMenuKeyboard(),
        }
      ).catch(() => {});
    } else if (from.id) {
      await sendMainMenu(from.id, user.name).catch(() => {});
    }
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  if (data === 'menu:friend') {
    if (message) {
      const txt =
        '👥 <b>اللعب مع صديق</b>\n\n' +
        `1️⃣ اكتب: <code>@${botUsername} play</code> أو <code>@${botUsername} play 10</code>\n` +
        '2️⃣ اختر بطاقة (أنت ❌) أو (أنت ⭕) من الشريط.\n' +
        '3️⃣ أرسل البطاقة في القروب.\n' +
        '4️⃣ يظهر زر "🎮 انضم كخصم" — أول من يضغطه يصبح اللاعب الثاني.\n' +
        '5️⃣ بعدها تبدأ اللعبة من نفس الرسالة.';

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
    const list = Object.values(players).sort((a, b) => (b.points || 0) - (a.points || 0));
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
          parse_mode: 'HTML',
          reply_markup: buildShopKeyboard(user),
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
        'استخدم:\n' +
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
        'ℹ️ <b>مختصر XO Bot</b>\n' +
        `• تحدي صديق: @${botUsername} play أو @${botUsername} play 10\n` +
        '• اللعب ضد البوت: من القائمة أو /bot\n' +
        '• المتجر: /shop — سكينات + ألقاب + Boosts\n' +
        '• البنك: /bank — رصيدك\n' +
        '• الهدايا: /gift\n';
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

  // ---------- SHOP ----------
  if (data.startsWith('shop:')) {
    const parts = data.split(':'); // shop:action:id
    const action = parts[1];
    const itemId = parts[2];
    const chatId = message ? message.chat.id : null;

    // سكينات
    if (action === 'buySkin' || action === 'useSkin') {
      const skin = SHOP_SKINS[itemId];
      if (!skin) {
        await bot.answerCallbackQuery(id, { text: '❌ سكين غير موجود.' }).catch(() => {});
        return;
      }
      if (action === 'buySkin') {
        if (user.ownedSkins.includes(itemId)) {
          await bot.answerCallbackQuery(id, { text: '✅ تملكه بالفعل.' }).catch(() => {});
          return;
        }
        if (user.coins < skin.price) {
          await bot.answerCallbackQuery(id, { text: '💰 رصيدك لا يكفي.', show_alert: true }).catch(() => {});
          return;
        }
        user.coins -= skin.price;
        user.ownedSkins.push(itemId);
        savePlayers();
        if (chatId) {
          await bot.editMessageReplyMarkup(buildShopKeyboard(user), {
            chat_id: chatId,
            message_id: message.message_id,
          }).catch(() => {});
        }
        await bot.answerCallbackQuery(id, { text: `✅ تم شراء ${skin.name}.` }).catch(() => {});
        return;
      }
      if (action === 'useSkin') {
        if (!user.ownedSkins.includes(itemId)) {
          await bot.answerCallbackQuery(id, { text: '❌ لم تشتر هذا السكين.' }).catch(() => {});
          return;
        }
        user.activeSkin = itemId;
        savePlayers();
        if (chatId) {
          await bot.editMessageReplyMarkup(buildShopKeyboard(user), {
            chat_id: chatId,
            message_id: message.message_id,
          }).catch(() => {});
        }
        await bot.answerCallbackQuery(id, { text: `🎨 تم تفعيل ${skin.name}.` }).catch(() => {});
        return;
      }
    }

    // شراء عناصر إضافية
    if (action === 'buyExtra') {
      const item = SHOP_EXTRA.find((x) => x.id === itemId);
      if (!item) {
        await bot.answerCallbackQuery(id, { text: '❌ عنصر غير موجود.' }).catch(() => {});
        return;
      }
      if (user.coins < item.price) {
        await bot.answerCallbackQuery(id, { text: '💰 رصيدك لا يكفي.', show_alert: true }).catch(() => {});
        return;
      }
      user.coins -= item.price;

      if (item.type === 'title') {
        if (!user.ownedTitles.includes(item.name)) user.ownedTitles.push(item.name);
        user.activeTitle = item.name;
      } else if (item.type === 'taunt') {
        if (!user.ownedTaunts.includes(item.name)) user.ownedTaunts.push(item.name);
        user.activeTaunt = item.name;
      } else if (item.type === 'boost_winX2') {
        user.boosts.winX2 = (user.boosts.winX2 || 0) + (item.amount || 1);
      }

      savePlayers();
      if (chatId) {
        await bot.editMessageReplyMarkup(buildShopKeyboard(user), {
          chat_id: chatId,
          message_id: message.message_id,
        }).catch(() => {});
      }

      await bot.answerCallbackQuery(id, {
        text: `✅ تم شراء ${item.name}.`,
      }).catch(() => {});
      return;
    }

    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  // ---------- JOIN PVP ----------
  if (data.startsWith('join:')) {
    const gameId = data.split(':')[1];
    const game = resolveGame(gameId, inline_message_id);

    if (!game || game.status !== 'waiting_opponent') {
      const reason = !game
        ? '❌ التحدي غير موجود. تأكد من أنك تستخدم نفس البوت في المجموعة.'
        : '❌ التحدي لم يعد متاحًا (ربما انتهى أو بدأ بالفعل).';
      await bot.answerCallbackQuery(id, {
        text: reason,
        show_alert: true,
      }).catch(() => {});
      return;
    }

    if (from.id === game.p1.id) {
      await bot.answerCallbackQuery(id, {
        text: '⚠️ لا يمكنك تحدي نفسك.',
      }).catch(() => {});
      return;
    }

    if (game.p2) {
      await bot.answerCallbackQuery(id, {
        text: '⚠️ تم اختيار الخصم بالفعل. لا يمكنك الانضمام.',
        show_alert: true,
      }).catch(() => {});
      return;
    }

    const bet = game.bet || 0;

    const p1 = ensurePlayer({ id: game.p1.id, first_name: game.p1.name, username: game.p1.username });
    const p2 = ensurePlayer(from);

    if (bet > 0) {
      if (p1.points < bet) {
        await bot.answerCallbackQuery(id, {
          text: '❌ صاحب التحدي لا يملك نقاط كافية.',
          show_alert: true,
        }).catch(() => {});
        return;
      }
      if (p2.points < bet) {
        await bot.answerCallbackQuery(id, {
          text: 'رصيدك لا يكفي، العب مباريات لزيادة نقاطك.',
          show_alert: true,
        }).catch(() => {});
        return;
      }

      p1.points -= bet;
      p2.points -= bet;
      if (p1.points < 0) p1.points = 0;
      if (p2.points < 0) p2.points = 0;
      savePlayers();
      game.stakeActive = true;
    }

    const p2Data = {
      id: from.id,
      name: from.first_name || from.username || 'لاعب',
      username: from.username || null,
    };
    game.p2 = p2Data;

    if (!game.pX && game.pO) game.pX = p2Data;
    if (!game.pO && game.pX) game.pO = p2Data;

    game.status = 'playing';
    game.turn = 'X';

    buildIconsForGame(game);

    const betLine =
      bet > 0
        ? `💰 رهان: ${bet} نقطة لكل لاعب (المجموع ${bet * 2}).\n`
        : '';

    const header =
      `🎮 لعبة XO بدأت!\n` +
      `❌ ${game.pX.name}\n` +
      `⭕ ${game.pO.name}\n` +
      betLine +
      `🎯 دور ${game.turn === 'X' ? game.pX.name : game.pO.name}`;

    await bot.editMessageText(header, {
      inline_message_id: game.inline_message_id,
      reply_markup: renderBoardInline(game),
    }).catch(() => {});

    saveGamesToDisk();
    await bot.answerCallbackQuery(id, {
      text: '✅ تم انضمامك كتحدي، بالتوفيق!',
    }).catch(() => {});
    return;
  }

  // ---------- حركات PVP ----------
  if (data.startsWith('mv:')) {
    const [, gameId, si, sj] = data.split(':');
    const i = Number(si);
    const j = Number(sj);
    const game = resolveGame(gameId, inline_message_id);

    if (!game || game.status !== 'playing') {
      await bot.answerCallbackQuery(id, {
        text: '❌ لا توجد لعبة نشطة.',
      }).catch(() => {});
      return;
    }

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

    const winnerSymbol = checkWinner(game.board);
    const full = game.board.flat().every((c) => c !== ' ');

    if (winnerSymbol || full) {
      game.status = 'finished';
      let txt;

      if (winnerSymbol) {
        const winPlayer = winnerSymbol === 'X' ? game.pX : game.pO;
        awardPointsAndBet(game, winnerSymbol);
        txt =
          `🏆 انتهت المباراة!\n` +
          `الفائز: ${winPlayer.name} (${winnerSymbol === 'X' ? '❌' : '⭕'})`;
      } else {
        awardPointsAndBet(game, null);
        txt = '🤝 انتهت المباراة بالتعادل!';
      }

      await bot.editMessageText(txt, {
        inline_message_id: game.inline_message_id,
        reply_markup: renderBoardInline(game),
      }).catch(() => {});

      delete games[gameId];
      if (inline_message_id && inlineToGameId[inline_message_id]) delete inlineToGameId[inline_message_id];
      saveGamesToDisk();
      await bot.answerCallbackQuery(id).catch(() => {});
      return;
    }

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

    saveGamesToDisk();
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  // ---------- botlvl ----------
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
      turn: 'X',
      userId: from.id,
      level,
    };

    const p = ensurePlayer(from);
    const skin = SHOP_SKINS[p.activeSkin] || SHOP_SKINS.default;

    const txt =
      `🤖 تحدي البوت (${level})\n` +
      `أنت ${skin.icons.X || '❌'} ، البوت ⭕\n` +
      'اضغط على خانة للبدء.';

    const reply_markup = {
      inline_keyboard: board.map((row, i) =>
        row.map((cell, j) => ({
          text: cell === ' ' ? (skin.icons.empty || '⬜') : cell,
          callback_data: `botmv:${gameId}:${i}:${j}`,
        }))
      ),
    };

    await bot.editMessageText(txt, {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reply_markup,
      parse_mode: 'HTML',
    }).catch(() => {});

    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  // ---------- botmv ----------
  if (data.startsWith('botmv:')) {
    const [, gameId, si, sj] = data.split(':');
    const i = Number(si);
    const j = Number(sj);
    const game = botGames[gameId];

    if (!game) {
      await bot.answerCallbackQuery(id, {
        text: '❌ لا توجد لعبة.',
      }).catch(() => {});
      return;
    }
    if (!message || message.chat.id !== game.chatId) {
      await bot.answerCallbackQuery(id).catch(() => {});
      return;
    }
    if (from.id !== game.userId) {
      await bot.answerCallbackQuery(id, {
        text: '⚠️ هذه المباراة ليست لك.',
      }).catch(() => {});
      return;
    }
    if (game.board[i][j] !== ' ' || game.turn !== 'X') {
      await bot.answerCallbackQuery(id, {
        text: '⚠️ حركة غير صالحة.',
      }).catch(() => {});
      return;
    }

    const p = ensurePlayer(from);
    const skin = SHOP_SKINS[p.activeSkin] || SHOP_SKINS.default;

    function buildKeyboard() {
      return {
        inline_keyboard: game.board.map((row, ii) =>
          row.map((cell, jj) => ({
            text:
              cell === ' '
                ? (skin.icons.empty || '⬜')
                : cell === 'X'
                ? (skin.icons.X || '❌')
                : '⭕',
            callback_data: `botmv:${gameId}:${ii}:${jj}`,
          }))
        ),
      };
    }

    // حركة اللاعب
    game.board[i][j] = 'X';

    let winner = checkWinner(game.board);
    let full = game.board.flat().every((c) => c !== ' ');

    if (winner || full) {
      let txt;
      if (winner === 'X') {
        p.points += 5;
        p.coins += 5;
        p.wins++;
        txt = '🏆 فزت على البوت! (+5 نقاط)';
      } else if (winner === 'O') {
        p.losses++;
        txt = '😅 البوت فاز عليك!';
      } else {
        p.draws++;
        p.coins += 1;
        txt = '🤝 تعادل مع البوت (+1 عملة).';
      }
      savePlayers();
      await bot.editMessageText(txt, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        reply_markup: buildKeyboard(),
      }).catch(() => {});
      delete botGames[gameId];
      await bot.answerCallbackQuery(id).catch(() => {});
      return;
    }

    // حركة البوت
    game.turn = 'O';
    const botMove = getBotMove(game.board, game.level);
    if (botMove) {
      const [bi, bj] = botMove;
      if (game.board[bi] && game.board[bi][bj] === ' ') {
        game.board[bi][bj] = 'O';
      }
    }

    winner = checkWinner(game.board);
    full = game.board.flat().every((c) => c !== ' ');

    if (winner || full) {
      let txt;
      if (winner === 'X') {
        p.points += 5;
        p.coins += 5;
        p.wins++;
        txt = '🏆 فزت على البوت! (+5 نقاط)';
      } else if (winner === 'O') {
        p.losses++;
        txt = '😅 البوت فاز عليك!';
      } else {
        p.draws++;
        p.coins += 1;
        txt = '🤝 تعادل مع البوت (+1 عملة).';
      }
      savePlayers();
      await bot.editMessageText(txt, {
        chat_id: message.chat.id,
        message_id: message.message_id,
        reply_markup: buildKeyboard(),
      }).catch(() => {});
      delete botGames[gameId];
      await bot.answerCallbackQuery(id).catch(() => {});
      return;
    }

    // استمرار
    game.turn = 'X';
    const txt =
      `🤖 تحدي البوت (${game.level})\n` +
      `أنت ${skin.icons.X || '❌'} ، البوت ⭕\n` +
      '🎯 دورك الآن.';

    await bot.editMessageText(txt, {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reply_markup: buildKeyboard(),
      parse_mode: 'HTML',
    }).catch(() => {});
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }

  // أي شيء آخر
  await bot.answerCallbackQuery(id, { text: '⚠️ إجراء غير معروف.' }).catch(() => {});
});

console.log('🚀 XO Inline Bot يعمل بـ @' + (botUsername || 'Bot') + ' play');
