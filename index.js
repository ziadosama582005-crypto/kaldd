// ==================================================
// 🤖 XO BOT — Inline Only (@Bot play) — Ready to Run
// ==================================================

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// ===== Env & Boot =====
const token = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.trim() : null;
if (!token) {
  console.error('❌ BOT_TOKEN غير موجود في البيئة!');
  process.exit(1);
}
const bot = new TelegramBot(token, { polling: true });
let botUsername = null;

// ===== Helpers =====
function uid(x) { return String(x ?? ''); }

function newBoard() {
  return [[' ', ' ', ' '], [' ', ' ', ' '], [' ', ' ', ' ']];
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
function targetOf(game, query){
  if (game?.inline_message_id) return { inline_message_id: game.inline_message_id };
  const m = query?.message;
  if (m && m.chat && m.message_id) return { chat_id: m.chat.id, message_id: m.message_id };
  return null;
}
async function safeEditText(tg, target, text, extra={}) {
  if (!target) return;
  try { await tg.editMessageText(text, { ...target, ...extra }); } catch(e){}
}
async function safeEditMarkup(tg, target, reply_markup) {
  if (!target) return;
  try { await tg.editMessageReplyMarkup(reply_markup, target); } catch(e){}
}
function generateGameId() {
  return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ===== In-Memory store =====
/**
 * games[gameId] = {
 *   id,
 *   inline_message_id? | chatId? | messageId?,
 *   host: { id, name },
 *   hostSymbol: 'X'|'O',
 *   opp: { id, name } | null,
 *   oppSymbol: 'X'|'O' | null,
 *   pX, pO,                // {id, name}
 *   board, turn,           // 'X' | 'O'
 *   status                 // 'waiting' | 'playing' | 'finished'
 * }
 */
const games = {};

// ===== Bot Ready =====
bot.getMe().then((me) => {
  botUsername = me.username;
  console.log(`✅ البوت جاهز: @${botUsername}`);
  bot.setMyCommands([
    { command: 'start', description: 'شرح سريع عن طريقة اللعب' },
    { command: 'board', description: 'لوحة المتصدرين (تجريبية محلية)' },
    { command: 'profile', description: 'عرض ملفك (تجريبي محلي)' },
  ]);
});

// (اختياري) ملف شخصي ومتصدّرين — محلي دون تخزين دائم
const players = {};
function ensurePlayer(u){
  const id = uid(u?.id);
  if (!players[id]) {
    players[id] = { id, name: u?.first_name || u?.username || 'لاعب', points: 0, wins: 0, losses: 0, draws: 0 };
  } else {
    players[id].name = u?.first_name || u?.username || players[id].name;
  }
  return players[id];
}
function awardPoints(game, winnerSymbol){
  if (!game?.pX || !game?.pO) return;
  const pX = ensurePlayer({ id: game.pX.id, first_name: game.pX.name });
  const pO = ensurePlayer({ id: game.pO.id, first_name: game.pO.name });
  if (!winnerSymbol) {
    pX.draws++; pO.draws++;
  } else if (winnerSymbol === 'X') {
    pX.wins++; pX.points += 10; pO.losses++;
  } else {
    pO.wins++; pO.points += 10; pX.losses++;
  }
}

// ===== /start (خاص فقط) =====
bot.onText(/\/start(?:\s+.*)?/, (msg) => {
  if (msg.chat.type !== 'private') return;
  const p = ensurePlayer(msg.from);
  const txt =
    `👋 أهلاً <b>${p.name}</b>\n` +
    `اللعب يتم عبر <b>Inline Mode</b> فقط:\n\n` +
    `1) في أي محادثة اكتب: <code>@${botUsername} play</code>\n` +
    `2) اختر نتيحة "<b>اختر ❌</b>" أو "<b>اختر ⭕</b>" من شريط الاقتراح ثم أرسل.\n` +
    `3) سيظهر زر "<b>انضم كخصم</b>" — أول شخص يضغطه يصبح الخصم وتبدأ المباراة.\n\n` +
    `❌ يبدأ دائماً. اللعب يكون على نفس الرسالة عبر الأزرار.`;
  bot.sendMessage(msg.chat.id, txt, { parse_mode: 'HTML' });
});

// ===== /profile (اختياري) =====
bot.onText(/^\/(?:profile|ملفي)(?:@\w+)?$/, (msg) => {
  const p = ensurePlayer(msg.from);
  const text =
    `👤 <b>${p.name}</b>\n` +
    `🏅 النقاط: <code>${p.points}</code>\n` +
    `✅ فوز: <code>${p.wins}</code>\n` +
    `❌ خسارة: <code>${p.losses}</code>\n` +
    `🤝 تعادل: <code>${p.draws}</code>`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ===== /board (اختياري) =====
bot.onText(/^\/(?:board|اللوحة)(?:@\w+)?$/, (msg) => {
  const list = Object.values(players).sort((a,b)=> (b.points||0)-(a.points||0));
  if (!list.length) return bot.sendMessage(msg.chat.id, 'لا توجد بيانات بعد. ابدأ أول تحدي عبر @' + botUsername + ' play');
  const top = list.slice(0, 20).map((p,i)=> `${i+1}. ${p.name} — ${p.points} نقطة (ف:${p.wins}/خ:${p.losses}/ت:${p.draws})`);
  bot.sendMessage(msg.chat.id, '📊 لوحة المتصدرين:\n' + top.join('\n'));
});

// ===== Inline Mode (@Bot play) =====
bot.on('inline_query', async (query) => {
  try {
    const q = (query.query || '').trim().toLowerCase();
    if (q && q !== 'play' && q !== 'xo') {
      await bot.answerInlineQuery(query.id, [], {
        switch_pm_text: 'اكتب play لبدء XO',
        switch_pm_parameter: 'start'
      });
      return;
    }

    // نُرجع نتيجتين: اختيار ❌ أو اختيار ⭕
    // نُضمّن في result_id: gameId ورمز المضيف لاستخدامه في chosen_inline_result
    const gameIdX = generateGameId();
    const gameIdO = generateGameId();

    const textTemplate =
      '🎮 تحدي XO جديد!\n' +
      '👤 المُضيف اختار رمزه.\n' +
      '🕹 اضغط "انضم كخصم" لتبدأ المباراة.\n' +
      'ملاحظة: ❌ يبدأ دائماً.';

    const results = [
      {
        type: 'article',
        id: `${gameIdX}:X`,
        title: 'اختر ❌ وابدأ التحدي',
        description: 'المضيف: ❌ — سيظهر زر للخصم للانضمام',
        input_message_content: { message_text: textTemplate },
        reply_markup: { inline_keyboard: [[{ text: '🕹 انضم كخصم ⭕', callback_data: `join:${gameIdX}:HOST_WILL_SET:X` }]] }
      },
      {
        type: 'article',
        id: `${gameIdO}:O`,
        title: 'اختر ⭕ وابدأ التحدي',
        description: 'المضيف: ⭕ — سيظهر زر للخصم للانضمام',
        input_message_content: { message_text: textTemplate },
        reply_markup: { inline_keyboard: [[{ text: '🕹 انضم كخصم ❌', callback_data: `join:${gameIdO}:HOST_WILL_SET:O` }]] }
      }
    ];

    await bot.answerInlineQuery(query.id, results, { cache_time: 0, is_personal: false });
  } catch (err) {
    console.error('inline_query error:', err);
  }
});

// بعد أن يختار المضيف ❌/⭕ ويرسل البطاقة، هذا الحدث يصلنا لنُسجّل اللعبة ونثبت hostId ونحدّث الزر ببيانات صحيحة.
bot.on('chosen_inline_result', async (result) => {
  try {
    const { from, result_id, inline_message_id } = result;
    const [gameId, symbol] = String(result_id || '').split(':'); // مثل g_abc:X
    const hostSymbol = (symbol === 'O') ? 'O' : 'X';

    // أنشئ اللعبة واحفظ inline_message_id
    games[gameId] = {
      id: gameId,
      inline_message_id,
      host: { id: uid(from.id), name: from.first_name || from.username || 'لاعب' },
      hostSymbol,
      opp: null,
      oppSymbol: null,
      pX: null,
      pO: null,
      board: newBoard(),
      turn: null,
      status: 'waiting'
    };

    // حدّث زر الانضمام ليحمل hostId الفعلي بدل placeholder
    const joinText = hostSymbol === 'X' ? '🕹 انضم كخصم ⭕' : '🕹 انضم كخصم ❌';
    await safeEditMarkup(
      bot,
      { inline_message_id },
      { inline_keyboard: [[{ text: joinText, callback_data: `join:${gameId}:${uid(from.id)}:${hostSymbol}` }]] }
    );
  } catch (err) {
    console.error('chosen_inline_result error:', err);
  }
});

// ===== Callback Handler (وحيد) =====
bot.on('callback_query', async (query) => {
  const { from, data } = query;

  // ---- انضمام الخصم ----
  if (data && data.startsWith('join:')) {
    try {
      // join:<gameId>:<hostId>|HOST_WILL_SET:<hostSymbol>
      const parts = data.split(':');
      if (parts.length < 4) {
        await bot.answerCallbackQuery(query.id, { text: 'بيانات الانضمام غير صالحة.' });
        return;
      }
      const gameId = parts[1];
      const hostIdFromBtn = parts[2] === 'HOST_WILL_SET' ? null : uid(parts[2]);
      const hostSymbolFromBtn = (parts[3] === 'O') ? 'O' : 'X';

      let game = games[gameId];

      // لو اللعبة غير موجودة في الذاكرة (إعادة تشغيل مثلاً) أعد إنشاءها من الزر والرسالة الحالية
      if (!game) {
        game = {
          id: gameId,
          host: { id: hostIdFromBtn || uid('0'), name: 'المضيف' },
          hostSymbol: hostSymbolFromBtn,
          opp: null,
          oppSymbol: null,
          pX: null, pO: null,
          board: newBoard(),
          turn: null,
          status: 'waiting'
        };
        if (query.inline_message_id) game.inline_message_id = query.inline_message_id;
        else if (query.message) { game.chatId = query.message.chat.id; game.messageId = query.message.message_id; }
        games[gameId] = game;
      }

      // لو لازال hostId placeholder (قبل chosen_inline_result)، امنع الانضمام برسالة لطيفة
      if (!game.host || !game.host.id || game.host.id === uid('0')) {
        await bot.answerCallbackQuery(query.id, { text: '⏳ لحظة.. يتم تهيئة التحدي الآن. جرّب بعد ثانية.' });
        return;
      }

      // منع المضيف من الانضمام كخصم
      if (uid(from.id) === uid(game.host.id)) {
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

      // سجّل الخصم وتثبيت pX/pO
      game.opp = { id: uid(from.id), name: from.first_name || from.username || 'لاعب' };
      game.oppSymbol = (game.hostSymbol === 'X') ? 'O' : 'X';
      if (game.hostSymbol === 'X') { game.pX = game.host; game.pO = game.opp; }
      else { game.pX = game.opp; game.pO = game.host; }

      game.status = 'playing';
      game.turn  = 'X'; // X يبدأ دائمًا

      const tgt = targetOf(game, query);
      const header =
        `🎮 لعبة XO بدأت!\n` +
        `❌ ${game.pX.name}\n` +
        `⭕ ${game.pO.name}\n` +
        `🎯 دور ${game.pX.name}`;

      await safeEditText(bot, tgt, header, { reply_markup: renderBoardInline(gameId, game.board) });
      await bot.answerCallbackQuery(query.id, { text: '✅ تم الانضمام. بدأ اللعب!' });
      return;
    } catch (e) {
      console.error('join error:', e);
      await bot.answerCallbackQuery(query.id, { text: 'حدث خطأ غير متوقع أثناء الانضمام.' });
      return;
    }
  }

  // ---- حركة على اللوحة mv:gameId:i:j ----
  if (data && data.startsWith('mv:')) {
    try {
      const [, gameId, si, sj] = data.split(':');
      const i = Number(si), j = Number(sj);
      const game = games[gameId];
      if (!game || game.status !== 'playing') {
        await bot.answerCallbackQuery(query.id, { text: '❌ لا توجد لعبة نشطة.' });
        return;
      }

      const tgt = targetOf(game, query);
      if (!Array.isArray(game.board?.[i]) || typeof game.board[i][j] === 'undefined') {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ خلية غير صالحة.' });
        return;
      }
      if (game.board[i][j] !== ' ') {
        await bot.answerCallbackQuery(query.id, { text: '❗ هذه الخانة مشغولة.' });
        return;
      }

      const expectedId = (game.turn === 'X') ? uid(game.pX?.id) : uid(game.pO?.id);
      if (uid(from.id) !== expectedId) {
        await bot.answerCallbackQuery(query.id, { text: '⚠️ ليس دورك الآن.' });
        return;
      }

      // تنفيذ الحركة
      game.board[i][j] = game.turn;

      const winner = checkWinner(game.board);
      const full   = game.board.flat().every(c => c !== ' ');

      if (winner || full) {
        game.status = 'finished';
        let txt;
        if (winner) {
          const wName = (winner === 'X') ? game.pX.name : game.pO.name;
          awardPoints(game, winner);
          txt = `🏆 انتهت المباراة!\nالفائز: ${wName} (${winner === 'X' ? '❌' : '⭕'})`;
        } else {
          awardPoints(game, null);
          txt = '🤝 انتهت المباراة بالتعادل!';
        }
        await safeEditText(bot, tgt, txt, { reply_markup: renderBoardInline(gameId, game.board) });
        delete games[gameId];
        await bot.answerCallbackQuery(query.id);
        return;
      }

      // استمرار اللعب
      game.turn = (game.turn === 'X') ? 'O' : 'X';
      const turnName = (game.turn === 'X') ? game.pX.name : game.pO.name;
      const header = `🎮 لعبة XO\n❌ ${game.pX.name} — ⭕ ${game.pO.name}\n🎯 دور ${turnName}`;
      await safeEditText(bot, tgt, header, { reply_markup: renderBoardInline(gameId, game.board) });
      await bot.answerCallbackQuery(query.id);
      return;
    } catch (e) {
      console.error('move error:', e);
      await bot.answerCallbackQuery(query.id, { text: 'حدث خطأ غير متوقع أثناء الحركة.' });
      return;
    }
  }

  // غير ذلك
  await bot.answerCallbackQuery(query.id, { text: '⚠️ إجراء غير معروف.' });
});

console.log('🚀 XO Inline Play Bot يعمل الآن — اكتب @' + (botUsername || 'YourBot') + ' play');
