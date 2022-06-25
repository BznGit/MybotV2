const fs = require('fs');
const axios = require('axios');
const settings = require('../../botSettings.json');
const api = settings.MiningCoreApiEndpoints;
const users = require('../storage/users.json');
const { Scenes, Markup } = require("telegraf");
const {logIt} = require('../libs/loger');
// Сцена изменения данных пользователя ------------------------------------------------------------
const chengeSubscribe = new Scenes.WizardScene(
    "chengeSubSceneWizard", 
    // Шаг 0 --------------------------------------------------------------------------------------
    (ctx)=>{
      ctx.wizard.state.stepError=false; 
      ctx.reply(`Выберите необходимое действие:`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [ { text: "Добавить монету", callback_data: "addCoin" },{ text: "Удалить монету", callback_data: "delCoin" },{ text: "Изменить монету", callback_data: "changeCoin" }],
          [{ text: "Назад", callback_data: "back" }],                
        ]) 
      })       
   
    },

    // Шаг 1 --------------------------------------------------------------------------------------
    (ctx)=>{
      ctx.wizard.state.stepError=false;
      if (ctx.message==undefined){
        ctx.reply('Вы ничего не ввели! Введите монету заново', {parse_mode: 'HTML'});
        return
      }
      let curCoin = ctx.wizard.state.pools.find(item=>item.pool.name==ctx.message.text);
      if(curCoin != undefined) ctx.wizard.state.pool = curCoin;
      else{
        ctx.reply('Mонета <b>«' + ctx.message.text + '» </b> не существует! Введите монету заново', {parse_mode: 'HTML'}); 
        return 
      } 
      if(curCoin.wallet==null){
        ctx.reply(`Выберите параметр монеты <b>${ctx.wizard.state.pool.pool.name}</b>, который необходимо изменить:`, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [ { text: "Кошелек", callback_data: "chooseWallet" },{ text: "Оповещение о блоке", callback_data: "chooseblock" }],
                           
          ]) 
        }) 
      }else{
         ctx.reply(`Выберите параметр монеты <b>${ctx.wizard.state.pool.pool.name}</b>, который необходимо изменить:`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [ { text: "Кошелек", callback_data: "chooseWallet" },{ text: "Воркеры", callback_data: "chooseWorker" }],
          [{ text: "Оповещение о блоке", callback_data: "chooseblock" }],                
        ]) 
      }) 
      }
     
      
    },
     // Шаг 2: Изменение кошелька ------------------------------------------------------------------
    (ctx) => {
       axios.get(api + '/api/pools/' + ctx.wizard.state.pool.pool.id + '/miners/' + ctx.message.text)
      .then((response)=> {
        // handle success
        //console.log(response.data.performance);
        if (response.data.performance == undefined){
          ctx.reply('Этот кошелек неактуален или введен с ошибкой!');
          ctx.reply('Введите кошелек заново');
          return
        }
        ctx.wizard.state.pool.wallet = ctx.message.text;   
        let wrk= Object.keys(response.data.performance.workers);
        ctx.wizard.state.tempWorkerNames = wrk;
        if (wrk[0]=='') wrk[0] = 'default';
        let text='';
        for(let i=0; i<wrk.length; i++){
          text += `${i+1}) «`+ `${wrk[i]}` +'»\n'
        }
        ctx.reply('Ваши актуальные воркеры:\n' + text);
        ctx.reply('Выберите нужный на выпадающей клавиатуре или наберите вручную:', Markup.keyboard(wrk).oneTime().resize())
        return ctx.wizard.next();        
         
      }).catch(function (error) {   
        console.log('Request error while updating wallet: ', error);
        logIt('Request error while updating wallet: ', error);
        ctx.reply('Введены неверные данные попробуйте еще раз!');
        return
      })    
    }, 
    // Шаг 3: Изменение воркера и единицы измерения -----------------------------------------------
    (ctx) => {
      if (!ctx.wizard.state.tempWorkerNames.includes(ctx.message.text) && !ctx.wizard.state.stepError){
        ctx.reply(`Воркера «${ctx.message.text}» не существует!`);
        return 
      }
      let currWorkers = ctx.wizard.state.pool.workers;
      let choosedWorker = ctx.message.text;
      
      let curWorkerIndex = currWorkers.findIndex(item=>item.name == choosedWorker);
      if (curWorkerIndex!=-1){
        ctx.wizard.state.curWorkerIndex = curWorkerIndex;
      } else {  
        let worker = {
          name: ctx.message.text,
          hashLevel: null,
          hashDev: null,
          delivered: false
        }
        ctx.wizard.state.tempWorker = worker;
      }
      ctx.wizard.state.stepError = true;
      ctx.reply('Выберите размерность порогового уровня хешрейта:', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [{ text: "KH/s", callback_data: "chooseK" },{ text: "MH/s", callback_data: "chooseM" },{ text: "GH/s", callback_data: "chooseG" }],
          [{ text: "TH/s", callback_data: "chooseT" },{ text: "PH/s", callback_data: "chooseP" }],      
        ])
      })
      return ctx.wizard.next()
    },     
    // Шаг 4: Изменение хешрейта ------------------------------------------------------------------
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
      //Проверка на существующий воркер ----------------------------
      if (ctx.wizard.state.curWorkerIndex!=undefined){
        ctx.wizard.state.pool.workers[ctx.wizard.state.curWorkerIndex].hashLevel = ctx.message.text;
        ctx.wizard.state.pool.workers[ctx.wizard.state.curWorkerIndex].delivered = false;
        let text='';
        let item = ctx.wizard.state.pool.workers;
   
        for(let i=0; i<item.length; i++){
          text += `${i+1}) «`+ item[i].name +'» : ограничение - ' + item[i].hashLevel +' '+ item[i].hashDev + `, оповещение: «${item[i].delivered? 'отключено':'включено'}` + '»;\n'
        }
        ctx.reply('<u>Ваши новые данные:</u>\n' +
          '<b>- монета: </b>'   + ctx.wizard.state.pool.pool.name +  ';\n' +
          '<b>- оповещение о новом блоке:</b> «'  + ctx.wizard.state.pool.block + '»;\n' +
          '<b>- кошелек: </b>'  + ctx.wizard.state.pool.wallet + ';\n' +
          '<b>- контролируемые воркеры:</b> \n'  + text + 
                  
          '<b>Выберите:</b>',  {
            parse_mode: 'HTML',
          }).then(
            ctx.reply('Подписаться?', {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                { text: "Да", callback_data: "subHash" }, 
                { text: "Нет", callback_data: "back" }
              ])
            }) 
          );
      } else{
        //Проверка на несуществующий воркер -------------------------------------------------------
        ctx.wizard.state.tempWorker.hashLevel =  ctx.message.text;
        ctx.wizard.state.tempWorker.delivered = false;
        ctx.reply('<u>Ваши новые данные:</u>\n'+ 
          '<b>- монета: </b>' + ctx.wizard.state.pool.pool.name + ';\n' +
          '<b>- оповещение о новом блоке: </b>«'  +ctx.wizard.state.pool.block  + '»;\n' +
          '<b>- кошелек: </b>' + ctx.wizard.state.pool.wallet  + ';\n' +
          '<b>- воркер: </b>«' + ctx.wizard.state.tempWorker.name  + '»;\n' +
          '<b>- оповещение об уровене хешрейта: </b>'  + ctx.wizard.state.tempWorker.hashLevel + ' ' + ctx.wizard.state.tempWorker.hashDev,
          {parse_mode: 'HTML'}
        ).then(
          ctx.reply('Подписаться?', {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              { text: "Да", callback_data: "subHash" }, 
              { text: "Нет", callback_data: "back" }
            ])
          }) 
        );
      }       
    }, 
);
// Обработчик добавления моненты ------------------------------------------------------------------
chengeSubscribe.action('addCoin',  (ctx)=>{
  ctx.scene.leave();
  ctx.scene.enter("addCoinSceneWizard") 
});
// Обработчик добавления моненты ------------------------------------------------------------------
chengeSubscribe.action('delCoin',  (ctx)=>{
  ctx.scene.leave();
  ctx.scene.enter("delCoinSceneWizard") 
});
// Обработчик добавления моненты ------------------------------------------------------------------
chengeSubscribe.action('changeCoin',  (ctx)=>{
  let  curUser = users.find(item=>item.userId == ctx.chat.id); 
  ctx.wizard.state.pools = JSON.parse(JSON.stringify(curUser.pools));
  let buttons = [];
  curUser.pools.forEach(item=>{buttons.push(item.pool.name)});
  ctx.reply('Выберите одну из монет пула кнопками на клавиатуре:',
  Markup.keyboard(buttons, { wrap: (btn, index, currentRow) => currentRow.length >= 5 })
  .oneTime().resize());
  return ctx.wizard.next();
});
// Обработчик изменения кошелька ------------------------------------------------------------------
chengeSubscribe.action('chooseWallet',  (ctx)=>{
  ctx.wizard.state.pool.wallet = null;
  ctx.wizard.state.pool.workers = [];
  ctx.reply('Введите кошелек:')
  ctx.wizard.selectStep(2);
});
// Обработчик изменения воркера -------------------------------------------------------------------
chengeSubscribe.action('chooseWorker',  (ctx)=>{
  axios.get(api + '/api/pools/' + ctx.wizard.state.pool.pool.id + '/miners/' + ctx.wizard.state.pool.wallet)
  .then((response)=> {
    if (response.data.performance == undefined){
      ctx.reply('Такого кошелька нет!');
      ctx.reply('Введите кошелек заново');
      return
    }
    ctx.wizard.selectStep(2);
    let wrk= Object.keys(response.data.performance.workers);
    ctx.wizard.state.tempWorkerNames = wrk;
    let text='';
    for(let i=0; i<wrk.length; i++){
      text += `${i+1}) «`+ `${wrk[i]}` +'»\n'
    }
    ctx.reply('Ваши воркеры:\n' + text);
    ctx.reply('Выберите нужный на выпадающей клавиатуре или наберите вручную:',
      Markup.keyboard(wrk,{ wrap: (btn, index, currentRow) => currentRow.length >=4 }).oneTime().resize()
    );
    return ctx.wizard.next();          
  }).catch(function (error){
    console.log('request error when updating worker: ', error);
    logIt('request error when updating worker: ', error);
    ctx.reply('Введены неверные данные попробуйте еще раз!');
    return
  }) 
});
// Обработчик изменения подписки на блок ----------------------------------------------------------
chengeSubscribe.action('chooseblock',  (ctx)=>{
  if (ctx.wizard.state.pool.block =='нет'){
    ctx.wizard.state.pool.block ='да'
      ctx.reply('Оповещение о новом блоке', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          { text: "Подписаться", callback_data: "subHash" }
        ])
     }) 
  } else{
    ctx.wizard.state.pool.block ='нет'
    ctx.reply('Оповещение о новом блоке', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        { text: "Отписаться", callback_data: "subHash" }
      ])
   }) 
  } 
});

// Обработчики изменения единиц измерения ---------------------------------------------------------
chengeSubscribe.action('chooseK',  (ctx)=>{
  ctx.wizard.state.stepError = false;
  if (ctx.wizard.state.curWorkerIndex!==undefined)
    ctx.wizard.state.pool.workers[ctx.wizard.state.curWorkerIndex].hashDev = 'KH/s';
  else ctx.wizard.state.tempWorker.hashDev  = 'KH/s';
  ctx.reply('Введите значение порогового уровня хешрейта в KH/s:');
});
chengeSubscribe.action('chooseM',  (ctx)=>{
  ctx.wizard.state.stepError = false;
  if (ctx.wizard.state.curWorkerIndex!=undefined)
    ctx.wizard.state.pool.workers[ctx.wizard.state.curWorkerIndex].hashDev = 'MH/s';
  else ctx.wizard.state.tempWorker.hashDev  = 'MH/s';
  ctx.reply('Введите значение порогового уровня хешрейта в MH/s:');
});
chengeSubscribe.action('chooseG',  (ctx)=>{
  ctx.wizard.state.stepError = false;
  if (ctx.wizard.state.curWorkerIndex!=undefined)
    ctx.wizard.state.pool.workers[ctx.wizard.state.curWorkerIndex].hashDev = 'GH/s';
  else ctx.wizard.state.tempWorker.hashDev  = 'GH/s';
  ctx.reply('Введите значение порогового уровня хешрейта в GH/s:');
});
chengeSubscribe.action('chooseT',  (ctx)=>{
  ctx.wizard.state.stepError = false;
  if (ctx.wizard.state.curWorkerIndex!=undefined)
    ctx.wizard.state.pool.workers[ctx.wizard.state.curWorkerIndex].hashDev = 'TH/s';
  else ctx.wizard.state.tempWorker.hashDev  = 'TH/s';
  ctx.reply('Введите значение порогового уровня хешрейта в TH/s:');
  });
chengeSubscribe.action('chooseP',  (ctx)=>{
  ctx.wizard.state.stepError = false;
  if (ctx.wizard.state.curWorkerIndex!=undefined)
    ctx.wizard.state.pool.workers[ctx.wizard.state.curWorkerIndex].hashDev = 'PH/s';
  else  ctx.wizard.state.tempWorker.hashDev  = 'PH/s';
  ctx.reply('Введите значение порогового уровня хашрейта в PH/s:');
});
// Обработчик добавления изменений пользователя ---------------------------------------------------
chengeSubscribe.action('subHash', (ctx)=>{
  if(ctx.wizard.state.tempWorker!=undefined){
    ctx.wizard.state.pool.workers.push(ctx.wizard.state.tempWorker) 
  }
  console.log('ctx.wizard.state.pool.workers>>>',ctx.wizard.state.pool.workers);
  let changedCoin = {
    pool : ctx.wizard.state.pool.pool,
    wallet : ctx.wizard.state.pool.wallet,
    block  : ctx.wizard.state.pool.block, 
    workers : JSON.parse(JSON.stringify(ctx.wizard.state.pool.workers))
  };
  let index = users.findIndex(item=>item.userId == ctx.chat.id);
  if (index != -1){
    let indexCoin = users[index].pools.findIndex(item=>item.pool.id==changedCoin.pool.id);
    users[index].pools.splice(indexCoin, indexCoin + 1);
    users[index].pools.push(changedCoin);
    //Запись изменений пользователя в файл --------------------------------------------------------
    try{
      fs.writeFileSync('./src/storage/users.json', JSON.stringify(users));
      console.log('User data changed: Id -> ', changedCoin.pool.name);
      logIt('User data changed: Id -> ', changedCoin.pool.name);
    }catch(err){
      console.log('Error writing to user changes file: ', err);
      logIt('Error writing to user changes file: ', err);
    }
    ctx.reply('Ваши данные изменены!');
    ctx.scene.leave();
    ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
     { text: "Продолжить", callback_data: 'onStart' },    
      ])
    })
  }
});
 // Обработчик кнопки "назад" ---------------------------------------------------------------------
chengeSubscribe.action('back', (ctx)=> {
  ctx.scene.leave();
  ctx.scene.enter("homeSceneWizard")  
});
// Обработчик команды "назад" --------------------------------------------------------------------
chengeSubscribe.command('/back', (ctx) => {
  ctx.scene.leave();
  ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
     { text: "Продолжить", callback_data: 'onStart' },    
      ])
  })
})

module.exports = chengeSubscribe;


   
