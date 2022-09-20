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
    ctx.wizard.state.stepError=false; 
    let curCoin = ctx.wizard.state.coins.find(item=>item.name==ctx.message.text);
    if(curCoin != undefined) ctx.wizard.state.pool = curCoin;
    else{
      ctx.reply('Mонета <b>«' + ctx.message.text + '» </b> не существует! Введите монету заново', {parse_mode: 'HTML'}); 
      return 
    }  
    ctx.reply('Подписаться на оповещение о блоке <b>' +ctx.message.text + '</b>' , {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        { text: "Да", callback_data: 'subBlock' }, 
        { text: "Нет", callback_data: 'back' }
      ])
    }) 
    return ctx.wizard.next();  
  },

  (ctx) => {
    ctx.wizard.state.stepError=false; 
    axios.get(api + '/api/pools/' + ctx.wizard.state.pool.id + '/miners/' + ctx.message.text)
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
      '<b>- монета: </b>'  + ctx.wizard.state.pool.name + ';\n' +
      '<b>- оповещение о новом блоке: </b>«'  + ctx.wizard.state.block + '»;\n' +
      '<b>- кошелек: </b>' + ctx.wizard.state.wallet + ';\n' +
      '<b>- воркер: «</b>'  + ctx.wizard.state.worker.name + '»;\n' +
      '<b>- оповещение об уровене хешрейта: </b>'  + ctx.wizard.state.worker.hashLevel + ' ' + ctx.wizard.state.worker.hashDev,
      {parse_mode: 'HTML'}
    )
  
    ctx.reply('Подписаться?', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        { text: "Да", callback_data: 'subHash' }, 
        { text: "Нет", callback_data: 'back' }
      ])
    })
     
  } 
);
// Ethereum ---------------------------------------------------------------------------------------

// Обработчик подписки на блок Ethereum -----------------------------------------------------------
subscribe.action('subBlock',  (ctx)=>{
  ctx.wizard.state.block = 'да'
  ctx.reply('Введите кошелек ' + ctx.wizard.state.pool.name + ':');
});
// Обработчик подписки на блок Ethereum -----------------------------------------------------------

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
    pools:[
      {
        pool : ctx.wizard.state.pool,
        wallet : ctx.wizard.state.wallet,
        block  : ctx.wizard.state.block, 
        workers : [ctx.wizard.state.worker]
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


   
