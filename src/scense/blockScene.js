const fs = require('fs');
const axios = require('axios');
const settings = require('../../botSettings.json');
const api = settings.MiningCoreApiEndpoints;
const users = require('../storage/users.json');
const { Scenes, Markup } = require("telegraf");
const {logIt} = require('../libs/loger');

// Сцена регистрации нового пользователя ----------------------------------------------------------
const onBlock = new Scenes.WizardScene(
  "blockSceneWizard", 
    // Шаг 1: Ввод монеты -------------------------------------------------------------------------
    (ctx) => {
    ctx.wizard.state.stepError=false; 
    ctx.reply('Выберите одну из монет пула:', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        { text: 'Ethereum', callback_data: 'chooseEth'}, 
        { text: 'Ergo', callback_data: 'chooseErgo' },  
        { text: 'Vertcoin', callback_data: 'chooseVert' }           
      ])    
    })
    return ctx.wizard.next(); 
  },
);
// Ethereum ---------------------------------------------------------------------------------------
// Обработчик выбра монеты Ethereum ---------------------------------------------------------------
onBlock.action('chooseEth', (ctx)=>{
  ctx.wizard.state.poolId = 'ethpool';
  ctx.reply('Подписаться на оповещение о новом блоке Ethereum?', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      { text: "Да", callback_data: 'subBlock' }, 
      { text: "Нет", callback_data: 'back' }
    ])
  }) 
});
// Обработчик выбра монеты Ergo -------------------------------------------------------------------
onBlock.action('chooseErgo',  (ctx)=>{
  ctx.wizard.state.poolId = 'ergopool'
  ctx.reply('Подписаться на оповещение о новом блоке Ergo?', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      { text: "Да", callback_data: 'subBlock' }, 
      { text: "Нет", callback_data: 'back' }
    ])
  }) 
});
// Обработчик выбра монеты Vertcoin ---------------------------------------------------------------
onBlock.action('chooseVert', (ctx)=>{
  ctx.wizard.state.poolId = 'vtcpool';
  ctx.reply('Подписаться на оповещение о новом блоке Vertcoin?', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      { text: "Да", callback_data: 'subBlock' }, 
      { text: "Нет", callback_data: 'back' }
    ])
  }) 
});
// Обработчик добавления пользователя -------------------------------------------------------------
onBlock.action('subBlock', (ctx)=>{
  ctx.reply('Вы подписаны на оповещение о хешрейте!')
  let curUser = {
    userId : ctx.chat.id,
    poolId : ctx.wizard.state.poolId,
    block  : 'да',
    wallet : null, 
    workers : null
  };
  users.push(curUser);
  //Запись данных пользователя в файл -------------------------------------------------------------
  try{
    fs.writeFileSync('./src/storage/users.json', JSON.stringify(users));
    console.log('New user added: Id -> ', curUser.userId);
    logIt('New user added: Id -> ', curUser.userId);
    console.log('Total Users: ', users.length);
    logIt('Total Users: ', users.length);
  }catch(err){
    console.log('Error writing to new user file: ', err);
    logIt('Error writing to new user file: ', err);
  }
   ctx.scene.leave();
   ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
   ...Markup.inlineKeyboard([
    { text: "Продолжить", callback_data: 'onStart' },    
     ])
 })
});
 // Обработчик кнопки "назад" ---------------------------------------------------------------------
 onBlock.action('back', (ctx)=> {
  ctx.scene.leave();
  ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
     { text: "Продолжить", callback_data: 'onStart' },    
      ])
  })
});
 // Обработчик команды "назад" --------------------------------------------------------------------
 onBlock.command('/back', (ctx) => {
  ctx.scene.leave();
  ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
     { text: "Продолжить", callback_data: 'onStart' },    
      ])
  })
})

module.exports = onBlock;


   
