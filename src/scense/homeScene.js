const fs = require('fs');
const axios = require('axios');
const users = require('../storage/users.json');
const settings = require('../../botSettings.json');
const api = settings.MiningCoreApiEndpoints;
const { Scenes, Markup } = require("telegraf");
const {logIt} = require('../libs/loger');
const {poolIdToCoin} = require('../libs/utils');
// Сцена пользователя (домашняя) ------------------------------------------------------------------
const home = new Scenes.WizardScene(
  "homeSceneWizard", 
  // Шаг 1: Получение исходных данных пользователя ------------------------------------------------
  (ctx)=>{
    let currUser = users.find(item=>item.userId == ctx.chat.id);
    // Если пользователь не найден ----------------------------------------------------------------
    if (currUser == undefined){
      // Если пользователь - это групповой чат ----------------------------------------------------
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
        // Если пользователь - это человек --------------------------------------------------------
        try{
          return  ctx.reply('Сейчас у Вас нет подписки на оповещение о появлении нового блока и падении текущего хешрейта воркеров', {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                       Markup.button.callback('Подписаться на хешрейт', 'onSub'),
                       Markup.button.callback('Подписаться на блок', 'blockSub'),       
                    ])
                  })
        }catch(err){
          console.log('Error sending message to user! HomeScene.js line 20', err);
          logIt('Error sending message to user! HomeScene.js line 20', err);
        }
      }
    }else{
    // Если пользователь найден -------------------------------------------------------------------
        try{
          
          axios.get(api + '/api/pools/')
          .then((response)=> {
            let pools = response.data.pools;
            let coins =[];
            pools.forEach(item=>{
              coins.push({id : item.id, name : item.coin.name});
            })
            return coins
          }).then((coins)=>{
         
              let text ='';
              let userPools = currUser.pools;
              for(let j=0; j<userPools.length; j++){
            
                let curCoin = coins.find(item=>item.id==userPools[j].pool.id);
                if (curCoin==undefined) {
                  text += j+1 + '. Монета «' + userPools[j].pool.name + '» - больше не поддерживается!\n'
                  continue
                } else {
                  text += j+1 + '. Монета: ' + userPools[j].pool.name +':\n' +
                      '  - оповещение о блоке: «'+ userPools[j].block +'»;\n' +
                      `${userPools[j].wallet==null? '' : '  - кошелек: ' + userPools[j].wallet + ';\n'}` +
                      `${userPools[j].wallet==null? '' : '  - контролируемые воркеры:\n'}` ; 
                  let item = userPools[j].workers
                  for(let i=0; i<item.length; i++){
                    text += `    ${i+1}) «`+ `${item[i].name ==''? 'default': item[i].name}` +'» : ограничение - ' + item[i].hashLevel +' '+ item[i].hashDev + `, оповещение: «${item[i].delivered? 'отключено':'включено'}` + '»;\n'
                  }
                }   
              }
              ctx.reply('<u>Вы подписаны на оповещение с параметрами:</u>\n' + text +
                'Выберите:',  {
                  parse_mode: 'HTML',
                  ...Markup.inlineKeyboard([
                      [{ text: "Отписаться от оповещения", callback_data: "unSub" },{ text: "Изменить параметры оповещения", callback_data: "chengeSub" }],
                      [{ text: "Назад", callback_data: "back" }], 
                    ])
              }); 
            }); 
         
        }catch(err){
          console.log('Error getting user info: homeScene.js line 45 ', err);
          logIt('Error getting user info: homeScene.js line 45', err);
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


   
