const fs = require('fs');
const users = require('../storage/users.json');
const settings = require('../../botSettings.json');
const { Scenes, Markup } = require("telegraf");
const {logIt} = require('../libs/loger');
// Сцена удаления данных пользователя -------------------------------------------------------------
const unSubscribe = new Scenes.WizardScene(
  "unSubSceneWizard", 
  // Шаг 1: Подтверждение удаления данных пользователя --------------------------------------------
  (ctx) => {
    ctx.reply('Вы действительно хотите отписатьcя от всех оповещений?', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback ('Да','chooseUnSub'),
        Markup.button.callback('Нет', 'back'),        
      ])    
    })
  }
);
// Обработчик удаления данных пользователя --------------------------------------------------------
unSubscribe.action('chooseUnSub', (ctx)=>{
  let  delUser = users.find(item=>item.userId == ctx.chat.id)
  let index = users.findIndex(item=>item.userId == ctx.chat.id);
  if (index != -1){
    users.splice(index, index+1);
    try{
      fs.writeFileSync('./src/storage/users.json', JSON.stringify(users));
      console.log('Removed user: Id -> ', delUser.userId);
      logIt('Removed user: Id -> ', delUser.userId);
      console.log('Total Users: ', users.length);
      logIt('Total Users: ', users.length);
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
    ctx.scene.leave();
    ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        { text: "Продолжить", callback_data: 'onStart' },    
      ])
    })
  }
});
// Обработчик кнопки "назад" --------------------------------------------------------------------- 
unSubscribe.action('back', (ctx)=> {
  ctx.scene.leave();
  ctx.scene.enter("homeSceneWizard");
});
// Обработчик команды "назад" --------------------------------------------------------------------
unSubscribe.command('/back', (ctx) => {
  ctx.scene.leave();
  ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
  ...Markup.inlineKeyboard([
    { text: "Продолжить", callback_data: 'onStart' },    
    ])
})
})

module.exports = unSubscribe;


   
