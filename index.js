// ==================================================
// 🤖 XO Inline Bot — تحديات + رهانات + متجر + بوت AI
// كل اللعب عبر @<botUsername> play
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
      points: 0,
      coins: 0,
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
        winX2: 0,
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
    .replace(/</g, '<')
    .replace(/>/g, '>');
}

// ==================================================
// 🛍 المتجر (سكينات + ألقاب + Taunts + Boosts بسيطة)
// ==================================================
const SHOP_SKINS = {
  default: { id: 'default', name: '🎲 النمط العادي', price: 0, icons: { X: '❌', O: '⭕', empty: '⬜' } },
  fire: { id: 'fire', name: '🔥 لهب النار', price: 40, icons: { X: '🔥', O: '⚡', empty: '⬛' } },
  ice: { id: 'ice', name: '❄️ الجليد', price: 40, icons: { X: '❄️', O: '💙', empty: '🧊' } },
  skull: { id: 'skull', name: '💀 الظلام', price: 60, icons: { X: '💀', O: '☠️', empty: '⬛' } },
  neon: { id: 'neon', name: '🌈 نيون', price: 70, icons: { X: '🟩', O: '🟦', empty: '⬜' } },
  crown: { id: 'crown', name: '👑 الملكي', price: 100, icons: { X: '👑', O: '⚜️', empty: '⬜' } },
  hero: { id: 'hero', name: '🦸 البطل', price: 80, icons: { X: '🦸', O: '⭐', empty: '⬜' } },
  space: { id: 'space', name: '🌌 الفضاء', price: 90, icons: { X: '🌕', O: '🪐', empty: '⬛' } },
};

const SHOP_EXTRA = [
  { id: 'title_king', type: 'title', name: '👑 لقب الملك', price: 50 },
  { id: 'title_legend', type: 'title', name: '💎 الأسطورة', price: 80 },
  { id: 'title_hunter', type: 'title', name: '🔥 صائد الانتصارات', price: 60 },
  { id: 'title_wolf', type: 'title', name: '🐺 الذيب', price: 40 },
  { id: 'title_brain', type: 'title', name: '🧠 المخطط', price: 40 },
  { id: 'taunt_fire', type: 'taunt', name: '🔥 أحرقك بالذكاء!', price: 25 },
  { id: 'taunt_king', type: 'taunt', name: '👑 لا تلعب مع الملوك.', price: 25 },
  { id: 'taunt_skull', type: 'taunt', name: '💀 نهايتك قريبة.', price: 25 },
  { id: 'boost_x2_3', type: 'boost_winX2', name: '🎯 مضاعف فوز ×2 (3 مباريات)', price: 60, amount: 3 },
  { id: 'boost_x2_1', type: 'boost_winX2', name: '⚡ مضاعف فوز ×2 (مباراة واحدة)', price: 25, amount: 1 },
];

function getTitle(p) {
  const pts = p.points || 0;
  if (p.activeTitle) return p.activeTitle;
  if (pts >= 300) return '🔥 أسطورة XO';
  if (pts >= 150) return '👑 محترف XO';
  if (pts >= 50) return '🎯 لاعب نشيط';
  return '🌱 مبتدئ';
}
function applyWinBoost(p, base) {
  let extra = 0;
  if (p.boosts && p.boosts.winX2 > 0) {
    extra = base;
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

const games = {};
const botGames = {};
const inlineToGameId = {};

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

function awardPointsAndBet(game, winnerSymbol) {
  if (!game.pX || !game.pO) return;
  const pX = ensurePlayer({ id: game.pX.id, first_name: game.pX.name, username: game.pX.username });
  const pO = ensurePlayer({ id: game.pO.id, first_name: game.pO.name, username: game.pO.username });
  const bet = game.bet || 0;
  const stakeActive = !!game.stakeActive;
  if (!winnerSymbol) {
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
    '👋 أهلاً <b>' + escapeHTML(name || '') + '</b>\n' +
    'كل اللعب هنا يكون عن طريق <b>Inline</b>:\n' +
    `✅ اكتب في أي مكان: <code>@${escapeHTML(botUsername || 'Bot')} play</code>\n` +
    `✅ أو: <code>@${escapeHTML(botUsername || 'Bot')} play 10</code> لرهان 10 نقاط.\n` +
    '👇 استخدم الأزرار للتحكم:';
  return bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: mainMenuKeyboard(),
  });
}

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
    `💰 رصيدك: <code>${user.coins}</code> عملة\n` +
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
// الأوامر البسيطة (/start, /profile, /board, /bank, /shop, /gift, /bot)
// ==================================================
bot.onText(/\/start(?:\s+.*)?/, (msg) => {
  if (msg.chat.type !== 'private') return;
  const p = ensurePlayer(msg.from);
  sendMainMenu(msg.chat.id, p.name);
});

// ... (بقية الأوامر تبقى كما هي دون تغيير كبير - تم حذفها هنا للاختصار فقط، لكنها موجودة في الملف الكامل المرفق فعليًا)

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
      const botHint = botUsername
        ? `\n⚠️ تأكد من استخدام: <code>@${escapeHTML(botUsername)} play</code>`
        : '';

      const textX =
        `🎮 تحدي XO\n` +
        `❌ ${fromName} هو اللاعب الأول.\n` +
        betLine +
        `أرسل التحدي، وأول من يضغط "انضم كخصم" يصبح ⭕.${botHint}`;
      const textO =
        `🎮 تحدي XO\n` +
        `⭕ ${fromName} هو اللاعب الأول.\n` +
        betLine +
        `أرسل التحدي، وأول من يضغط "انضم كخصم" يصبح ❌.${botHint}`;

      const resultX = {
        type: 'article',
        id: `${baseId}:X:${bet}`,
        title: bet > 0 ? `أنت ❌ — رهان ${bet}` : 'بدء تحدي XO (أنت ❌)',
        description: bet > 0 ? `تحدي برهان ${bet} نقطة` : 'تحدي بدون رهان',
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
        title: bet > 0 ? `أنت ⭕ — رهان ${bet}` : 'بدء تحدي XO (أنت ⭕)',
        description: bet > 0 ? `تحدي برهان ${bet} نقطة` : 'تحدي بدون رهان',
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

bot.on('chosen_inline_result', async (res) => {
  try {
    const { result_id, from, inline_message_id } = res;
    if (!result_id || !inline_message_id) return;
    const parts = result_id.split(':');
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
      botUsername: botUsername, // <<<--- إضافة اسم البوت هنا
    };
  } catch (err) {
    console.error('chosen_inline_result error:', err.message);
  }
});

// ==================================================
// 🎯 Callback واحد (مع التعديل على "join:")
// ==================================================
bot.on('callback_query', async (query) => {
  const { from, data, message, inline_message_id, id } = query;
  if (!data) {
    await bot.answerCallbackQuery(id).catch(() => {});
    return;
  }
  const user = ensurePlayer(from);

  // ---------- JOIN PVP ----------
  if (data.startsWith('join:')) {
    const gameId = data.split(':')[1];
    const game = resolveGame(gameId, inline_message_id);
    
    // ⚠️ التحقق من اسم البوت إذا كان معروفًا
    if (game && game.botUsername && game.botUsername !== botUsername) {
      await bot.answerCallbackQuery(id, {
        text: `❌ هذا التحدي تم إنشاؤه بواسطة بوت آخر (@${game.botUsername}).\nاستخدم البوت الحالي (@${botUsername}) لبدء تحدي جديد.`,
        show_alert: true,
      }).catch(() => {});
      return;
    }

    if (!game || game.status !== 'waiting_opponent') {
      const reason = !game
        ? '❌ التحدي غير موجود أو أُنشئ بواسطة بوت مختلف.'
        : '❌ التحدي لم يعد متاحًا (ربما انتهى أو بدأ بالفعل).';
      await bot.answerCallbackQuery(id, {
        text: reason,
        show_alert: true,
      }).catch(() => {});
      return;
    }
    if (from.id === game.p1.id) {
      await bot.answerCallbackQuery(id, { text: '⚠️ لا يمكنك تحدي نفسك.' }).catch(() => {});
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
    const betLine = bet > 0 ? `💰 رهان: ${bet} نقطة لكل لاعب (المجموع ${bet * 2}).\n` : '';
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
    await bot.answerCallbackQuery(id, { text: '✅ تم انضمامك كتحدي، بالتوفيق!' }).catch(() => {});
    return;
  }

  // ... (بقية معالجات callback مثل shop, menu, mv, botlvl, botmv — بدون تغيير مطلوب)
});

console.log('🚀 XO Inline Bot يعمل بـ @' + (botUsername || 'Bot') + ' play');