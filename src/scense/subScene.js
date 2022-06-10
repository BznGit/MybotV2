const fs = require('fs');
const axios = require('axios');
const settings = require('../../botSettings.json');
const api = settings.MiningCoreApiEndpoints;
const users = require('../storage/users.json');
const { Scenes, Markup } = require("telegraf");
const {logIt} = require('../libs/loger');

// Сцена регистрации нового пользователя ----------------------------------------------------------
const subscribe = new Scenes.WizardScene(
  "subSceneWizard", 
    // Шаг 1: Ввод монеты -------------------------------------------------------------------------
    (ctx) => {
    ctx.wizard.state.stepError=false; 
    ctx.reply('Выберите одну из монет пула:', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback ('Ethereum','chooseEth'),
        Markup.button.callback('Ergo', 'chooseErgo'),
        Markup.button.callback('Vertcoin', 'chooseVert'),              
      ])    
    })
    return ctx.wizard.next(); 
  },
  // Шаг 2: Ввод кошелька -------------------------------------------------------------------------
  (ctx) => {
      axios.get(api + '/api/pools/' + ctx.wizard.state.poolId + '/miners/' + ctx.message.text)
    .then((response)=> {
      if (response.data.performance == undefined){
        ctx.reply('Этот кошелек неактуален или введен с ошибкой!');
        ctx.reply('Введите кошелек заново');
        return
      }
      ctx.wizard.state.wallet =  ctx.message.text;
      
      let wrk = Object.keys(response.data.performance.workers);
      ctx.wizard.state.tempWorkerNames = wrk;
      if (wrk[0]=='') wrk[0] = 'default';
      let text='';
      for(let i=0; i<wrk.length; i++){
        text += `${i+1}) «`+ `${wrk[i]}` +'»\n'
      }
      ctx.reply('Ваши актуальные воркеры:\n' + text);
      ctx.reply('Выберите нужный на выпадающей клавиатуре или наберите вручную:',
        Markup.keyboard(wrk,{ wrap: (btn, index, currentRow) => currentRow.length >=4 })
        .oneTime().resize())
      return ctx.wizard.next();        
        
    }).catch(function (error) {
      // handle error
      console.log('Wallet registration request error: ', error);
      logIt('Wallet registration request error: ', error);
      ctx.reply('Введены неверные данные попробуйте еще раз!');
      return
    })   
  },
  // Шаг 3: Ввод воркера и единицы измерения ------------------------------------------------------
  (ctx) => {
    if (!ctx.wizard.state.tempWorkerNames.includes(ctx.message.text) && !ctx.wizard.state.stepError){
      ctx.reply(`Воркера «${ctx.message.text}» не существует!`);
      return 
    }
    ctx.wizard.state.worker = {
      name: ctx.message.text,
      hashLevel: null,
      hashDev: null,
      delivered: false
    }
    ctx.wizard.state.stepError = true;
    ctx.reply('Выберите размерность порогового уровня хешрейта:', {
      parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
        [{ text: "KH/s", callback_data: "chooseK" }, { text: "MH/s", callback_data: "chooseM" },{ text: "GH/s", callback_data: "chooseG" }],
        [{ text: "TH/s", callback_data: "chooseT" }, { text: "PH/s", callback_data: "chooseP" }],      
      ])          
    })
    return ctx.wizard.next(); 
  },     
  // Шаг 4: Ввод хешрейта -------------------------------------------------------------------------
  (ctx) => {
    if (ctx.wizard.state.stepError) {
      ctx.reply('Выберите кнопками выше!'); 
      ctx.wizard.state.stepError = true;
      return 
    } 
    let regexp = /^[0-9]+$/;
    if(!regexp.test(ctx.message.text)){
      ctx.reply('Введите число!');
      return 
    } 
    ctx.wizard.state.worker.hashLevel =  ctx.message.text;
    ctx.wizard.state.worker.delivered = false;
    ctx.reply('<u>Ваши данные:</u>\n'+ 
      '<b>- монета: </b>'  + ctx.wizard.state.poolId + ';\n' +
      '<b>- оповещение о новом блоке: </b>«'  + ctx.wizard.state.block + '»;\n' +
      '<b>- кошелек: </b>' + ctx.wizard.state.wallet + ';\n' +
      '<b>- воркер: «</b>'  + ctx.wizard.state.worker.name + '»;\n' +
      '<b>- оповещение об уровене хешрейта: </b>'  + ctx.wizard.state.worker.hashLevel + ' ' + ctx.wizard.state.worker.hashDev,
      {parse_mode: 'HTML'}
    ).then(
      ctx.reply('Подписаться?', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          { text: "Да", callback_data: 'subHash' }, 
          { text: "Нет", callback_data: 'back' }
        ])
      })
    )     
  } 
);
// Ethereum ---------------------------------------------------------------------------------------
// Обработчик выбра монеты Ethereum ---------------------------------------------------------------
subscribe.action('chooseEth', (ctx)=>{
  ctx.wizard.state.poolId = 'ethpool';
  ctx.reply('Подписаться на оповещение о новом блоке Ethereum?', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      { text: "Да", callback_data: 'subBlockEth' }, 
      { text: "Нет", callback_data: 'notSubBlockEth' }
    ])
  }) 
});
// Обработчик подписки на блок Ethereum -----------------------------------------------------------
subscribe.action('subBlockEth',  (ctx)=>{
  ctx.wizard.state.block = 'да'
  ctx.reply('Введите Ethereum кошелек:');
});
// Обработчик подписки на блок Ethereum -----------------------------------------------------------
subscribe.action('notSubBlockEth',  (ctx)=>{
  ctx.wizard.state.block = 'нет'
  ctx.reply('Введите Ethereum кошелек:');
});
// Ergo -------------------------------------------------------------------------------------------
// Обработчик выбра монеты Ergo -------------------------------------------------------------------
subscribe.action('chooseErgo',  (ctx)=>{
  ctx.wizard.state.poolId = 'ergopool'
  ctx.reply('Подписаться на оповещение о новом блоке Ergo?', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      { text: "Да", callback_data: 'subBlockErgo' }, 
      { text: "Нет", callback_data: 'notSubBlockErgo' }
    ])
  }) 
});
// Обработчик подписки на блок Ergo ---------------------------------------------------------------
subscribe.action('subBlockErgo',  (ctx)=>{
  ctx.wizard.state.block = 'да'
  ctx.reply('Введите Ergo кошелек:');
});
// Обработчик подписки на блок Ergo ---------------------------------------------------------------
subscribe.action('notSubBlockErgo',  (ctx)=>{
  ctx.wizard.state.block = 'нет'
  ctx.reply('Введите Ergo кошелек:');
});
// Vertcoin ---------------------------------------------------------------------------------------
// Обработчик выбра монеты Vertcoin ---------------------------------------------------------------
subscribe.action('chooseVert', (ctx)=>{
  ctx.wizard.state.poolId = 'vtcpool';
  ctx.reply('Подписаться на оповещение о новом блоке Vertcoin?', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      { text: "Да", callback_data: 'subBlockVert' }, 
      { text: "Нет", callback_data: 'notSubBlockVert' }
    ])
  }) 
});
// Обработчик подписки на блок Vertcoin -----------------------------------------------------------
subscribe.action('subBlockVert',  (ctx)=>{
  ctx.wizard.state.block = 'да'
  ctx.reply('Введите Vertcoin кошелек:');
});
// Обработчик подписки на блок Vertcoin -----------------------------------------------------------
subscribe.action('notSubBlockVert',  (ctx)=>{
  ctx.wizard.state.block = 'нет'
  ctx.reply('Введите Vertcoin кошелек:');
});
//-------------------------------------------------------------------------------------------------
// Обработчики выбора единиц измерения ------------------------------------------------------------
subscribe.action('chooseK',  (ctx)=>{
  ctx.wizard.state.stepError = false;
  ctx.wizard.state.worker.hashDev = 'KH/s'
  ctx.reply('Введите значение порогового уровня хашрейта в KH/s:');
});
subscribe.action('chooseM',  (ctx)=>{
  ctx.wizard.state.stepError = false;
  ctx.wizard.state.worker.hashDev = 'MH/s'
  ctx.reply('Введите значение порогового уровня хешрейта в MH/s:');
});
subscribe.action('chooseG',  (ctx)=>{
  ctx.wizard.state.stepError = false;
  ctx.wizard.state.worker.hashDev = 'GH/s'
  ctx.reply('Введите значение порогового уровня хешрейта в GH/s:');
});
subscribe.action('chooseT',  (ctx)=>{
  ctx.wizard.state.stepError = false;
  ctx.wizard.state.worker.hashDev = 'TH/s'
  ctx.reply('Введите значение порогового уровня хешрейта в TH/s:');
});
subscribe.action('chooseP',  (ctx)=>{
  ctx.wizard.state.stepError = false;
  ctx.wizard.state.worker.hashDev = 'PH/s'
  ctx.reply('Введите значение порогового уровня хешрейта в PH/s:');
});
// Обработчик добавления пользователя -------------------------------------------------------------
subscribe.action('subHash', (ctx)=>{
  ctx.reply('Вы подписаны на оповещение о хешрейте!')
  let curUser = {
    userId : ctx.chat.id,
    poolId : ctx.wizard.state.poolId,
    wallet : ctx.wizard.state.wallet,
    block  : ctx.wizard.state.block, 
    workers : [ctx.wizard.state.worker]
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
subscribe.action('back', (ctx)=> {
  ctx.scene.leave();
  ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
     { text: "Продолжить", callback_data: 'onStart' },    
      ])
  })
});
 // Обработчик команды "назад" --------------------------------------------------------------------
subscribe.command('/back', (ctx) => {
  ctx.scene.leave();
  ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
     { text: "Продолжить", callback_data: 'onStart' },    
      ])
  })
})

module.exports = subscribe;


   
