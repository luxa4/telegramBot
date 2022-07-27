import TelegramBot from 'node-telegram-bot-api';
// import questions from './questions.json' assert { type: 'json' }; // For Server
import questions from './questions.json';
import { randomItems } from './helper.js';
import sequelize from './db.js';
import { User } from './models.js';
import { Op } from 'sequelize';

const token = '';
const bot = new TelegramBot(token, { polling: true });

const greetingText = '\ud83d\udc4b Привет! \n\n \ud83c\udf89 Добро пожаловать в викторину!';
const greetingSticker = 'https://cdn.tlgrm.app/stickers/79c/6bb/79c6bb77-f483-498d-9e3b-22ebcd5e5a0a/192/12.webp';
const endSticker = 'https://tlgrm.ru/_/stickers/79c/6bb/79c6bb77-f483-498d-9e3b-22ebcd5e5a0a/9.webp';

// SETTINGS
const questionAmount = questions.questions.length;
const questionArr = questions.questions;
const arrIds = [];

let i = 0;

do {
  arrIds.push(i);
  i = i + 1;
} while (i < questionAmount);

const SKIP_COUNT = 7;

const start =  () => {
  bot.setMyCommands([
    { command: '/start', description: 'Приветствие' }
  ]);

  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const user = await User.findOne({ where: { chatId: `${chatId}` } });
    user.phone = msg.contact.phone_number;
    user.save();

    if (!user.isStart) {
      await bot.sendSticker(chatId, greetingSticker, { reply_markup: JSON.stringify({
        hide_keyboard: true
      }) });
      await bot.sendMessage(chatId, greetingText);
      await bot.sendMessage(chatId, '*Как тебя зовут?*',  { parse_mode: 'Markdown' });
    }
  });


  bot.on('message', async (msg) => {
    if (msg.contact) return;

    try {
      await sequelize.authenticate();
      await sequelize.sync();
    } catch (e) {
      await bot.sendMessage(chatId, '*Что-то не так с базой данных...*',  { parse_mode: 'Markdown' });
      console.log('Ошибка подлюкчения к БД', e);
    }

    const text = msg.text;
    const chatId = msg.chat.id;

    if (text === '/start') {
      const user = await User.findOne({ where: { chatId: `${chatId}` } });

      if (user === null) {
        const user = await User.create({ chatId });
        user.quest = randomItems(arrIds);
        user.count = 0;
        user.skip = 0;
        user.right = 0;
        user.wrong = 0;
        user.isStart = false;
        user.isFinish = false;
        await user.save();
        await bot.sendMessage(chatId, '*Для прохождения викторины необходимо указать телефон*',  { parse_mode: 'Markdown' });
        await bot.sendMessage(chatId, 'Запрос номера телефона', keyboardPhone);
      } else {
        await bot.sendMessage(chatId, '*Ты уже прошел викторину или уже начал проходить*',  { parse_mode: 'Markdown' });
      }

      return;
    }

    if (text === '/info') {
      const user = await User.findOne({ where: { chatId: `${chatId}` } });

      await bot.sendMessage(chatId,
        `chartID - ${user.chatId},
             field - ${user.field},
             name - ${user.name},
             teamNumber - ${user.team},
             right - ${user.right},
             wrong - ${user.right}`
      );

      return;
    }

    if (text === '/vologda1') {
      const { count } = await User.findAndCountAll();

      await bot.sendMessage(chatId,
        `Проходят викторину - ${count}`
      );

      return;
    }

    if (text === '/vologda2') {
      const { count } = await User.findAndCountAll({ where: { isFinish: true } });

      await bot.sendMessage(chatId,
        `Закончили - ${count}`
      );

      return;
    }

    if (text === '/vologda3') {
      const { count } = await User.findAndCountAll({ where: { right: { [Op.gte]: questionAmount/2 + 1 } } });
      await bot.sendMessage(chatId,
        `Больше 50% - ${count}`
      );

      return;
    }

    if (text === '/kill') {
      await User.destroy({ where: { chatId: `${chatId}` } });
      await bot.sendMessage(chatId, 'Я вас удалил. Можете проходите снова!');

      return;
    }

    if (text === '/final') {
      const result = await User.findAll({
        where: { right: { [Op.gte]: questionAmount/2 + 1 } },
        order: [
          ['right', 'DESC'],
          ['time', 'ASC']
        ] });
      if (result.length) {
        await bot.sendMessage(chatId, `50% (${questionAmount/2} прав. ответов) + 1 набрали - ${result.length} человек`);

        for (let i = 0; i < result.length; i++) {
          await bot.sendMessage(chatId,
            `${i +1}) ${result[i].dataValues.name}, ${result[i].dataValues.phone},
               *правильных:* ${result[i].dataValues.right},  *направление:* ${result[i].dataValues.field},
                *номер команды:* ${result[i].dataValues.team}, *вр.посл.прав:* ${result[i].dataValues.time}`,
            { parse_mode: 'Markdown' });
        }
      } else {
        await bot.sendMessage(chatId, `Никто не набрал 50% (${questionAmount/2} прав. ответов) + 1`);
      }

      return;
    }

    const user = await User.findOne({ where: { chatId: `${chatId}` } });
    if (user.isFinish) return;

    if (user && !user.name) {
      user.name = text;
      user.save();
      await bot.sendMessage(chatId,
        '*Выбери направление*', { reply_markup: { inline_keyboard:  keyboardFields }, parse_mode: 'Markdown' });
      return;
    }

    if (user && !user.team) {
      user.team = isNaN(+text) ? 88 : +text;
      user.save();
      await bot.sendSticker(chatId, greetingSticker);
      await bot.sendMessage(chatId, 'Ура!!! Всё готово для начала игры!!!',
        { reply_markup: { inline_keyboard: keyboardStart } });
      return;
    }

    if (user.isStart) {
      if (text.toLowerCase().includes(questionArr[user.quest[user.count]].answer)) {
        await setRightAnswer(user);
        await sendMessage(user.chatId, user.count, user.skip, user.quest, user);
      } else {
        await setWrongAnswer(user);
        await sendMessage(user.chatId, user.count, user.skip, user.quest, user);
      }
    }
  });

  async function sendMessage(chatId, count, skip, quest, user) {
    if (count > questionAmount + skip - 1) {
      await bot.sendSticker(chatId, endSticker);
      await bot.sendMessage(chatId,
        `\ud83c\udf89 \ud83c\udf89 *Ты справился! Поздравляем!* \n\n \u2705 *Правильных ответов:* ${user.right}`,
        { parse_mode: 'Markdown' });
      user.isFinish = true;
      user.save();
    } else {
      const crtQuest = questionArr[quest[count]];
      let items = crtQuest.items;

      if (items.length) {
        items = randomItems(crtQuest.items);
      }

      if (crtQuest.withImg) {
        await bot.sendPhoto(chatId, `./image/${crtQuest.img}`);
      }

      await bot.sendMessage(chatId,  crtQuest.title,
        { reply_markup: { inline_keyboard: skip < SKIP_COUNT
          ? [...items, [{ text: `Пропустить вопрос (${skip}/7)`, callback_data: `skip_${ crtQuest.id}` }]]
          :items },
        parse_mode: 'Markdown' });
    }
  }

  bot.on('callback_query', async (msg) => {
    const data = msg.data;
    const chatId = msg.message.chat.id;

    const user = await User.findOne({ where: { chatId: `${chatId}` } });

    if (user.isFinish) return;

    const crtQuest = questionArr[user.quest[user.count]];

    if (data.includes('field_')) {
      user.field = data.slice(6);
      user.isStart = true;
      user.save();
      await bot.sendMessage(chatId, '*Укажи номер команды*', { parse_mode: 'Markdown' });
      return;
    }

    if (data === 'startQuiz') {
      await sendMessage(user.chatId, user.count, user.skip, user.quest, user);
      return;
    }

    if (data === `skip_${crtQuest.id}`) {
      await addSkip(user.chatId, user.quest[user.count]);
      user.skip += 1;
      user.count += 1;
      await user.save();
      await sendMessage(user.chatId, user.count, user.skip, user.quest, user);
      return;
    }

    if (data === `false_${crtQuest.id}`) {
      await setWrongAnswer(user);
      await sendMessage(user.chatId, user.count, user.skip, user.quest, user);
      return;
    }

    if (data === `true_${crtQuest.id}`) {
      await setRightAnswer(user);
      await sendMessage(user.chatId, user.count, user.skip, user.quest, user);
      return;
    }

  });

  async function setWrongAnswer(user) {
    user.wrong += 1;
    user.count += 1;
    await user.save();
  }

  async function setRightAnswer(user) {
    user.right += 1;
    user.count += 1;

    await User.update({ 'time': sequelize.fn('NOW') },  { 'where': { 'chatId': user.chatId } });
    await user.save();
  }

  async function addSkip (chatId, questionId) {
    await User.update(
      { 'quest': sequelize.fn('array_append', sequelize.col('quest'), questionId) },
      { 'where': { 'chatId': chatId } }
    );
  }

  const keyboardStart = [
    [
      {
        text: '\ud83c\udfae Начать викторину', // текст на кнопке
        callback_data: 'startQuiz' // данные для обработчика событий
      }
    ]
  ];

  const keyboardFields = [
    [
      {
        text: 'Наука',
        callback_data: 'field_science'
      },
      {
        text: 'Спорт',
        callback_data: 'field_sport'
      }
    ],
    [
      {
        text: 'Искусство',
        callback_data: 'field_art'
      }
    ]
  ];

  const keyboardPhone = {
    'parse_mode': 'Markdown',
    'reply_markup': JSON.stringify({
      'keyboard': [
        [{ text: 'Отравить контакт', request_contact: true }]
      ]
    })
  };
};

start();

