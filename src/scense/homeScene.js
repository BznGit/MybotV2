const fs = require('fs');
const users = require('../storage/users.json');
const settings = require('../../botSettings.json');
const { Scenes, Markup } = require("telegraf");
const {logIt} = require('../libs/loger');
// Сцена пользователя (домашняя) ------------------------------------------------------------------
const home = new Scenes.WizardScene(
  "homeSceneWizard", 
  // Шаг 1: Получение исходных данных пользователя ------------------------------------------------
  (ctx)=>{
    let currUser = users.find(item=>item.userId == ctx.chat.id);
    
    if (currUser == undefined){
      if (ctx.chat.type =='group'){
        try{
          return  ctx.reply('Сейчас у Вас нет подписки на оповещение о появлении нового блока', {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                       Markup.button.callback('Подписаться на оповещение о новом блоке', 'blockSub'),       
                    ])
                  })
      }catch(err){
        console.log('Error sending message to user! HomeScene.js line 20', err);
        logIt('Error sending message to user! HomeScene.js line 20', err);
      }
      }else{
        try{
          return  ctx.reply('Сейчас у Вас нет подписки на оповещение о появлении нового блока и падении текущего хешрейта воркеров', {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                       Markup.button.callback('Подписаться на оповещение о хешрейте', 'onSub'),
                       Markup.button.callback('Подписаться на оповещение о блоке', 'blockSub'),       
                    ])
                  })
      }catch(err){
        console.log('Error sending message to user! HomeScene.js line 20', err);
        logIt('Error sending message to user! HomeScene.js line 20', err);
      }
      }
      
    }
    else {
      if(currUser.wallet==null && currUser.workers==null){
        try{
          let coin = null;
          switch (currUser.poolId){
            case 'ethpool' : coin ='Ethereum';
                break;
            case 'ergopool' : coin ='Ergo';
              break;
            case 'vtcpool' : coin ='Vertcoin';
              break;
          }
          ctx.reply('Вы подписаны на оповещение о новом блоке монеты <b>' + coin + '</b>',
              { parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                { text: "Отписаться от оповещения", callback_data: "unSub" },
                { text: "Нет", callback_data: "back" }, 
              ])
            });       
        }catch(err){
          console.log('Error getting user info: homeScene.js line 62 ', err);
          logIt('Error getting user info: homeScene.js line 62', err);
        }
      }else{
        let text='';
        let item = currUser.workers
        for(let i=0; i<item.length; i++){
          text += `${i+1}) «`+ `${item[i].name ==''? 'default': item[i].name}` +'» : ограничение - ' + item[i].hashLevel +' '+ item[i].hashDev + `, оповещение: «${item[i].delivered? 'отключено':'включено'}` + '»;\n'
        }
        try{
          ctx.reply('<u>Вы подписаны на оповещение с параметрами:</u>\n' +
            '<b>- монета: </b>'   + currUser.poolId  + ';\n' +
            '<b>- оповещение о новом блоке: </b>«'  + currUser.block + '»;\n' +
            '<b>- кошелек: </b>'  + currUser.wallet + ';\n' +
            '<b>- контролируемые воркеры: </b>\n'  + text + 
            'Выберите:',  {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                  [{ text: "Отписаться от оповещения", callback_data: "unSub" },{ text: "Изменить параметры оповещения", callback_data: "chengeSub" }],
                  [{ text: "Назад", callback_data: "back" }], 
                ])
            });       
        }catch(err){
          console.log('Error getting user info: homeScene.js line 45 ', err);
          logIt('Error getting user info: homeScene.js line 45', err);
        }
      }
    } 
});
// Обработчик кнопки "Подписаться" ----------------------------------------------------------------
home.action('onSub', (ctx)=>{
  ctx.scene.enter("subSceneWizard")  
});
// Обработчик кнопки "Отписаться" -----------------------------------------------------------------
home.action('unSub', (ctx)=>{
  ctx.scene.enter("unSubSceneWizard")  
});
// Обработчик кнопки "Изменить..." ----------------------------------------------------------------
home.action('chengeSub', (ctx)=>{
  ctx.scene.enter("chengeSubSceneWizard")  
});
// Обработчик кнопки "... о новом блоке" ----------------------------------------------------------------
home.action('blockSub', (ctx)=>{
  ctx.scene.enter("blockSceneWizard")  
});
 // Обработчик кнопки "назад" ---------------------------------------------------------------------
home.action('back', (ctx)=>{
  ctx.scene.leave();
  ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
     { text: "Продолжить", callback_data: 'onStart' },    
      ])
  }) 
});
// Обработчик команды "назад" --------------------------------------------------------------------
home.command('/back', (ctx) => {
  ctx.scene.leave();
  ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
     { text: "Продолжить", callback_data: 'onStart' },    
      ])
  })
})

module.exports = home;


   
