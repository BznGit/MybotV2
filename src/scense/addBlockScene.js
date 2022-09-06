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
      ctx.reply('Выберите одну из монет пула на выпадающей клавиатуре:',
      Markup.keyboard(buttons, { wrap: (btn, index, currentRow) => currentRow.length >= 5 })
      .oneTime().resize());     
    });
    
    return ctx.wizard.next();  
  },
  // Шаг 2: Ввод кошелька -------------------------------------------------------------------------
  (ctx) => {
   // console.log(ctx.chat.type, ctx.chat.id)
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
    ctx.wizard.state.curCoin = curCoin;
    //console.log('addBlock curCoin:', ctx.wizard.state.curCoin);
    let index = users.findIndex(item=>item.userId==ctx.chat.id);
    ///console.log('index User->', index);
    let tryCoin = users[index].pools.find(item=>item.pool.id==curCoin.id);
    //console.log('tryCoin User->', tryCoin);
    if (tryCoin != undefined){
      ctx.reply('Mонета <b>«' + ctx.message.text + '» </b> уже добавлена! Выберете другую монету', {parse_mode: 'HTML'});
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
  let index = users.findIndex(item=>item.userId==ctx.chat.id);
  //console.log('index User->', index);
  let tryCoin = users[index].pools.find(item=>item.pool.id==ctx.wizard.state.curCoin.id);
  //console.log('tryCoin User->', tryCoin);
  let addingCoin={};
  if (tryCoin == undefined){
    addingCoin =  
    {
      pool : ctx.wizard.state.pool,
      wallet : null,
      block  : 'да', 
      workers : []
    }
    users[index].pools.push(addingCoin);
    //Запись данных пользователя в файл -------------------------------------------------------------
    try{
      fs.writeFileSync('./src/storage/users.json', JSON.stringify(users));
      console.log('New coin "', addingCoin.pool.name, '" added for a block control by user ', users[index].userId);
      logIt('New coin "', addingCoin.pool.name, '" added for a block control by user ', users[index].userId);
    }catch(err){
      console.log('Error writing a new coin block to file: ', err);
      logIt('Error writing new coin block to file: ', err);
    }
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


   
