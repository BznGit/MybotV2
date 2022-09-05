const fs = require('fs');
const axios = require('axios');
const settings = require('../../botSettings.json');
const api = settings.MiningCoreApiEndpoints;
const users = require('../storage/users.json');
const { Scenes, Markup } = require("telegraf");
const {logIt} = require('../libs/loger');

// Сцена регистрации нового пользователя ----------------------------------------------------------
const addOnBlock = new Scenes.WizardScene(
  "addBlockSceneWizard", 
   // Шаг 1: Ввод монеты -------------------------------------------------------------------------
  (ctx) => {
    ctx.wizard.state.stepError=false; 
    axios.get(api + '/api/pools/')
    .then((response)=> {
      let pools = response.data.pools;
      let coins =[];
      pools.forEach(item=>{
        coins.push({id : item.id, name : item.coin.name});
      });
      ctx.wizard.state.coins = coins;
      let buttons = [];
      coins.forEach(item=>{buttons.push(item.name)});
      ctx.reply('Выберите одну из монет пула кнопками на клавиатуре:',
      Markup.keyboard(buttons, { wrap: (btn, index, currentRow) => currentRow.length >= 5 })
      .oneTime().resize());     
    });
    
    return ctx.wizard.next();  
  },
  // Шаг 2: Ввод кошелька -------------------------------------------------------------------------
  (ctx) => {
    console.log(ctx.chat.type, ctx.chat.id)
    ctx.wizard.state.stepError=false; 
    if (ctx.message==undefined){
      ctx.reply('Вы ничего не ввели! Введите монету заново', {parse_mode: 'HTML'});
      return
    }
    let curCoin = ctx.wizard.state.coins.find(item=>item.name==ctx.message.text);
    if(curCoin != undefined) ctx.wizard.state.pool = curCoin;
    else{
      ctx.reply('Mонета <b>«' + ctx.message.text + '» </b> не существует! Введите монету заново', {parse_mode: 'HTML'}); 
      return 
    }  
    ctx.reply('Подписаться на оповщение о блоке <b>' + ctx.message.text + '</b>', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        { text: "Да", callback_data: 'subBlock' }, 
        { text: "Нет", callback_data: 'back' }
      ])
    })
    return ctx.wizard.next();  
  },
);

// Обработчик добавления пользователя -------------------------------------------------------------
addOnBlock.action('subBlock', (ctx)=>{
  ctx.reply('Вы подписаны на оповещение о блоке!')
  let curUser = {
    userId : ctx.chat.id,
    pools:[
      {
        pool : ctx.wizard.state.pool,
        wallet : null,
        block  : 'да', 
        workers : []
      }
    ]
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
 addOnBlock.action('back', (ctx)=> {
  ctx.scene.leave();
  ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
     { text: "Продолжить", callback_data: 'onStart' },    
      ])
  })
});
 // Обработчик команды "назад" --------------------------------------------------------------------
 addOnBlock.command('/back', (ctx) => {
  ctx.scene.leave();
  ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
     { text: "Продолжить", callback_data: 'onStart' },    
      ])
  })
})

module.exports = addOnBlock;


   
