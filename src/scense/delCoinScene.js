const fs = require('fs');
const users = require('../storage/users.json');
const axios = require('axios');
const settings = require('../../botSettings.json');
const api = settings.MiningCoreApiEndpoints;
const { Scenes, Markup } = require("telegraf");
const {logIt} = require('../libs/loger');
// Сцена удаления данных пользователя -------------------------------------------------------------

const delCoin = new Scenes.WizardScene(
  "delCoinSceneWizard", 
  // Шаг 1: Подтверждение удаления данных пользователя --------------------------------------------
  (ctx) => { 
    ctx.wizard.state.stepError=false; 
    let  curUser = users.find(item=>item.userId == ctx.chat.id); 
    ctx.wizard.state.pools = JSON.parse(JSON.stringify(curUser.pools));
    let buttons = [];
    curUser.pools.forEach(item=>{buttons.push(item.pool.name)});
    ctx.reply('Выберите одну из монет пула на выпадающей клавиатуре:',
    Markup.keyboard(buttons, { wrap: (btn, index, currentRow) => currentRow.length >= 5 })
    .oneTime().resize());
    return ctx.wizard.next();    
  },
  // Шаг 2: Ввод кошелька -------------------------------------------------------------------------
  (ctx) => {
    ctx.wizard.state.stepError=false; 
    if (ctx.message==undefined){
      ctx.reply('Вы ничего не ввели! Введите монету заново', {parse_mode: 'HTML'});
      return
    }
    let curCoin = ctx.wizard.state.pools.find(item=>item.pool.name==ctx.message.text)
    //console.log('curCoin',curCoin)
    if(curCoin != undefined) ctx.wizard.state.pool = curCoin;
    else{
      ctx.reply('Mонета <b>«' + ctx.message.text + '» </b> не существует! Введите монету заново', {parse_mode: 'HTML'}); 
      return 
    }  

    ctx.reply(`${ctx.wizard.state.pools.length==1?'При удалении последней монеты вы будете полностью удалены из списка оповещения' :  'Удалить монету <b>'   + ctx.message.text + '</b>'}` , {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        { text: "Да", callback_data: 'delBlock' }, 
        { text: "Нет", callback_data: 'back' }
      ])
    }) 
    return ctx.wizard.next();  
  },
);

// Обработчик удаления данных пользователя --------------------------------------------------------
delCoin.action('delBlock', (ctx)=>{
  let index = users.findIndex(item=>item.userId == ctx.chat.id);
  if (index != -1){
    let indexCoin = users[index].pools.findIndex(item=>item.pool.id==ctx.wizard.state.pool.pool.id)
    //console.log('ctx.wizard.state.pool.id>>',ctx.wizard.state.pool.pool.id);
    let delCoin = users[index].pools[indexCoin];
    users[index].pools.splice(indexCoin, indexCoin+1);
    let delUser = users[index];
    if (users[index].pools.length==0) {
      users.splice(index, index+1)
      try{
        fs.writeFileSync('./src/storage/users.json', JSON.stringify(users));
        console.log('All users coins and user ', delUser.userId, ' removed!');
        logIt('All users coins and user ', delUser.userId, ' removed!' );
        console.log('Total users ',  users.length);
        logIt('Total users: ', users.length);
        ctx.reply('Вы отписались от всех оповещений!')
        ctx.scene.leave();
        ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            { text: "Продолжить", callback_data: 'onStart' },    
          ])
        })
      }catch(err){
        console.log('error writing user deletion information to file: ', err);
        logIt('error writing user deletion information to file: ', err);
      }
    }else{
      try{
        fs.writeFileSync('./src/storage/users.json', JSON.stringify(users));
        console.log('Coin "', delCoin.pool.name, '"  of user ', delUser.userId, ' removed!');
        logIt('Coin "', delCoin.pool.name, '"  of user ', delUser.userId, ' removed!');
        console.log('Total users coins: ', delUser.pools.length);
        logIt('Total useres coins: ',  delUser.pools.length);
        ctx.reply('Вы отписались от всех оповещений!')
        ctx.scene.leave();
        ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            { text: "Продолжить", callback_data: 'onStart' },    
          ])
        })
      }catch(err){
        console.log('error writing user deletion information to file: ', err);
        logIt('error writing user deletion information to file: ', err);
      }
    }
  
    ctx.scene.leave();
    ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        { text: "Продолжить", callback_data: 'onStart' },    
      ])
    })
  }
});

// Обработчик кнопки "назад" --------------------------------------------------------------------- 
delCoin.action('back', (ctx)=> {
  ctx.scene.leave();
  ctx.scene.enter("homeSceneWizard");
});
// Обработчик команды "назад" --------------------------------------------------------------------
delCoin.command('/back', (ctx) => {
  ctx.scene.leave();
  ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
  ...Markup.inlineKeyboard([
    { text: "Продолжить", callback_data: 'onStart' },    
    ])
  })
});

module.exports = delCoin;


   
