require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// ==================================================
// 🤖 XO BOT v9.0 — يعمل في الخاص + القروب + استجابة كاملة للأزرار
// ==================================================
const token = process.env.BOT_TOKEN;
if (!token) throw new Error("❌ BOT_TOKEN غير موجود في البيئة!");

const bot = new TelegramBot(token, { polling: true });
let botUsername = null;

// ==================================================
// 💾 بيانات اللاعبين
let players = {};
try {
  if (fs.existsSync('players.json')) {
    players = JSON.parse(fs.readFileSync('players.json', 'utf8') || '{}');
  } else fs.writeFileSync('players.json', '{}');
} catch {
  fs.writeFileSync('players.json', '{}');
}
function savePlayers() {
  fs.writeFileSync('players.json', JSON.stringify(players, null, 2));
}

// ==================================================
// 🎮 وظائف اللعبة
function newBoard() {
  return [[' ', ' ', ' '], [' ', ' ', ' '], [' ', ' ', ' ']];
}
function renderBoard(board) {
  return {
    reply_markup: {
      inline_keyboard: board.map((row, i) =>
        row.map((cell, j) => ({
          text: cell === ' ' ? '⬜' : (cell === 'X' ? '❌' : '⭕'),
          callback_data: `${i},${j}`
        }))
      )
    }
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
const games = {};
const challenges = {};

// ==================================================
bot.getMe().then(me => {
  botUsername = me.username;
  console.log(`✅ البوت جاهز: @${botUsername}`);
});

// ==================================================
// /start
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const param = match[1];

  if (param && param.startsWith('ch_')) {
    const id = param.replace('ch_', '');
    const ch = challenges[id];
    if (!ch) return bot.sendMessage(chatId, '❌ هذا التحدي انتهى أو غير صالح.');
    if (ch.p1.id === user.id) return bot.sendMessage(chatId, '⚠️ لا يمكنك تحدي نفسك.');

    ch.p2 = { id: user.id, name: user.first_name };
    ch.board = newBoard();
    ch.turn = 'X';

    const msg1 = await bot.sendMessage(ch.p1.id, `🎮 ضد ${ch.p2.name}\n🎯 دورك أنت (❌)`, renderBoard(ch.board));
    const msg2 = await bot.sendMessage(ch.p2.id, `🎮 ضد ${ch.p1.name}\n🎯 دور خصمك الآن`, renderBoard(ch.board));

    games[id] = {
      type: 'private',
      board: ch.board,
      turn: 'X',
      p1: ch.p1,
      p2: ch.p2,
      msgs: {
        [ch.p1.id]: msg1.message_id,
        [ch.p2.id]: msg2.message_id
      }
    };
    delete challenges[id];
    return;
  }

  bot.sendMessage(chatId, `👋 أهلاً ${user.first_name}!\n🎮 استخدم /newgame في القروب أو /challenge لتحدي صديق في الخاص`);
});

// ==================================================
// /challenge
bot.onText(/\/challenge/, msg => {
  if (msg.chat.type !== 'private') return bot.sendMessage(msg.chat.id, '🚫 استخدم هذا الأمر في الخاص فقط.');
  const user = msg.from;
  const id = Math.random().toString(36).slice(2, 10);
  challenges[id] = { p1: user };
  bot.sendMessage(msg.chat.id, `⚔️ أرسل هذا الرابط لصديقك:\nhttps://t.me/${botUsername}?start=ch_${id}`);
});

// ==================================================
// /newgame (القروب)
bot.onText(/\/newgame/, msg => {
  if (msg.chat.type === 'private') return bot.sendMessage(msg.chat.id, '🚫 هذا الأمر يعمل فقط في القروب.');
  const chatId = msg.chat.id;
  const user = msg.from;
  if (games[chatId]) return bot.sendMessage(chatId, '⚠️ هناك لعبة قيد التشغيل بالفعل!');

  games[chatId] = {
    type: 'group',
    board: newBoard(),
    players: [{ id: user.id, name: user.first_name }],
    turn: null,
    messageId: null,
    timer: null
  };

  bot.sendMessage(chatId, `👤 ${user.first_name} بدأ لعبة جديدة!\n🕓 أمام اللاعبين 15 ثانية للانضمام...`, {
    reply_markup: {
      inline_keyboard: [[{ text: '🎮 انضمام إلى اللعبة', callback_data: 'join' }]]
    }
  }).then(sent => {
    games[chatId].messageId = sent.message_id;
    games[chatId].timer = setTimeout(() => {
      if (games[chatId] && games[chatId].players.length < 2) {
        bot.editMessageText('⏰ انتهى الوقت! لم ينضم أحد.', {
          chat_id: chatId,
          message_id: sent.message_id
        }).catch(() => {});
        delete games[chatId];
      }
    }, 15000);
  });
});

// ==================================================
// الضغط على الأزرار
bot.on('callback_query', async q => {
  const data = q.data;
  const user = q.from;

  // 🎮 القروب
  const g = games[q.message.chat.id];
  if (g && g.type === 'group') {
    if (data === 'join') {
      if (g.players.length < 2 && !g.players.find(p => p.id === user.id)) {
        g.players.push({ id: user.id, name: user.first_name });
        g.turn = g.players[0].id;
        clearTimeout(g.timer);
        await bot.editMessageText(
          `✅ ${user.first_name} انضم!\n${g.players[0].name} (❌) vs ${g.players[1].name} (⭕)\n🎯 دور ${g.players[0].name}`,
          { chat_id: q.message.chat.id, message_id: q.message.message_id, ...renderBoard(g.board) }
        ).catch(() => {});
      }
      return;
    }

    const [i, j] = data.split(',').map(Number);
    const player = g.players.find(p => p.id === user.id);
    if (!player) return bot.answerCallbackQuery(q.id, { text: '🚫 لست ضمن اللعبة.' });
    if (user.id !== g.turn) return bot.answerCallbackQuery(q.id, { text: '⏳ ليس دورك.' });
    if (g.board[i][j] !== ' ') return bot.answerCallbackQuery(q.id, { text: '❗ محجوز.' });

    const symbol = user.id === g.players[0].id ? 'X' : 'O';
    g.board[i][j] = symbol;

    const winner = checkWinner(g.board);
    const draw = g.board.flat().every(c => c !== ' ');
    if (winner || draw) {
      const text = winner ? `🏆 ${player.name} فاز!` : '😐 تعادل!';
      await bot.editMessageText(text, { chat_id: q.message.chat.id, message_id: q.message.message_id }).catch(() => {});
      delete games[q.message.chat.id];
      return;
    }

    g.turn = g.turn === g.players[0].id ? g.players[1].id : g.players[0].id;
    const next = g.players.find(p => p.id === g.turn);
    await bot.editMessageText(`🎯 دور ${next.name}`, {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      ...renderBoard(g.board)
    }).catch(() => {});
    return;
  }

  // 🎮 الخاص
  const privateGame = Object.values(games).find(
    g => g.type === 'private' && (g.msgs[user.id] === q.message.message_id)
  );
  if (!privateGame) return;

  const [i, j] = data.split(',').map(Number);
  const symbol = user.id === privateGame.p1.id ? 'X' : 'O';
  if (privateGame.board[i][j] !== ' ' || privateGame.turn !== symbol)
    return bot.answerCallbackQuery(q.id, { text: '🚫 ليس دورك أو الخانة محجوزة.' });

  privateGame.board[i][j] = symbol;
  privateGame.turn = symbol === 'X' ? 'O' : 'X';

  const winner = checkWinner(privateGame.board);
  const draw = privateGame.board.flat().every(c => c !== ' ');
  const opts = renderBoard(privateGame.board);

  if (winner || draw) {
    const msg = winner
      ? `🏆 ${(winner === 'X' ? privateGame.p1.name : privateGame.p2.name)} فاز!`
      : '😐 تعادل!';
    for (const p of [privateGame.p1, privateGame.p2]) {
      await bot.editMessageText(msg, {
        chat_id: p.id,
        message_id: privateGame.msgs[p.id]
      }).catch(() => {});
    }
    delete games[Object.keys(games).find(k => games[k] === privateGame)];
    return;
  }

  const turnPlayer = privateGame.turn === 'X' ? privateGame.p1 : privateGame.p2;
  for (const p of [privateGame.p1, privateGame.p2]) {
    await bot.editMessageText(`🎯 دور ${turnPlayer.name}`, {
      chat_id: p.id,
      message_id: privateGame.msgs[p.id],
      ...opts
    }).catch(() => {});
  }
});
