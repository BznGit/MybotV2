const settings = require('./botSettings.json');
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const bot = new Telegraf(settings.telegramBotToken);
const axios = require('axios');
const api = settings.MiningCoreApiEndpoints +'/api/pools/';
const home = require('./src/scense/homeScene');
const unSubscribe = require('./src/scense/unSubScene');
const subscribe = require('./src/scense/subScene');
const chengeSubscribe = require('./src/scense/chengeSubScene');
const addCoin = require('./src/scense/addCoinScene');
const delCoin = require('./src/scense/delCoinScene');
const onBlock = require('./src/scense/blockScene');
const addOnBlock = require('./src/scense/addBlockScene');
const users = require('./src/storage/users.json');
const {formatHashrate} = require('./src/libs/utils.js');
const {koeff} = require('./src/libs/utils.js');
const {logIt} = require('./src/libs/loger.js');
const fs = require('fs');
const { brotliCompress } = require('zlib');

// Создание менеджера сцен ------------------------------------------------------------------------
const stage = new Scenes.Stage();
stage.register(home, subscribe, unSubscribe, chengeSubscribe, onBlock, addCoin, delCoin, addOnBlock);
// Непосредственный запуск опроса------------------------------------------------------------------
let urls = [];
begin();
// Создание менеджера сцен ------------------------------------------------------------------------
bot.use(session());
bot.use(stage.middleware());
// Действия бота при старте -----------------------------------------------------------------------
bot.start((ctx) =>{
  if (ctx.from.id != settings.adminId && ctx.chat.type =='group'){
    ctx.reply('У Вас недостаточно прав для выполнения этой команды');
    return; 
  }
  ctx.reply(settings.wellcomeText, {parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
     { text: "Продолжить", callback_data: 'onStart' },    
      ])
  })
})
//Запрос админа на количестово пользователей ------------------------------------------------------
bot.hears('total', ctx => {
  if(ctx.chat.id==settings.adminId) {
    ctx.telegram.sendMessage(ctx.chat.id, `Total users: ${users.length}` )
    bot.telegram.sendMessage(settings.channelId, `Hello everyone!`)
  }
  else 
    bot.telegram.sendMessage(ctx.chat.id, `How did you know a secret command?`)
})
// Обработчик события при старте ------------------------------------------------------------------
bot.action('onStart', (ctx)=>{
  ctx.scene.enter("homeSceneWizard")

})
// Запуск бота-------------------------------------------------------------------------------------
bot.launch();
// Установка параметров запуска бота --------------------------------------------------------------
function start(){
  setInterval(getBlock, settings.monitoringPeriodSec*1000);
  setInterval(getHash, settings.monitoringPeriodSec*1000)
  console.log('Bot started');
  logIt('Bot started');
};
// Получение номера последнего блока---------------------------------------------------------------
var tempBlocks = [];
let lastBlocks = [];
let coins =[];
function begin(){
  users.forEach(item=>{
    item.pools.forEach(coin=>{
      let poolInfo = {
        url :`${api + coin.pool.id}/blocks/`,
        id : coin.pool.id
      };
      urls.push(poolInfo);
    })
  });

  Promise.allSettled(urls.map(item =>
    axios.get(item.url)
  )).then(res => {
    res.forEach(item=>{
      if (item.status=='fulfilled'){
        let block = item.value.data[0];
        let lastBlock = {
          poolId : block.poolId,
          blockHeight : block.blockHeight,
          status : block.status
        }
        lastBlocks.push(lastBlock);
      }
    })    
  }).then(()=>{
    axios.get(api)
    .then((response)=> {
      let pools = response.data.pools;
      pools.forEach(item=>{
        coins.push({id : item.id, name : item.coin.name});
      });    
    })
    .then(()=>{
      start();
    })
  })
};
// Проверка появления нового блок -----------------------------------------------------------------
function getBlock(){
  Promise.allSettled(urls.map(item =>
    axios.get(item.url)
  )).then(res => {
    res.forEach(item=>{
      if (item.status=='fulfilled'){
        let currBlock = item.value.data[0];
        let tempCurBlock = tempBlocks.find(item=>item.blockId==currBlock.poolId);
        if (tempCurBlock != undefined){   
          // Подтверждение нового блока ---------------------------------------------------------------
          if (currBlock.blockHeight==tempCurBlock.blockHeight && currBlock.status=='confirmed'){   
            if (users.length!=0){        
              users.forEach(curUser => {
                curUser.pools.forEach(curUserCoin=>{
                  if(curUserCoin.pool.id==currBlock.poolId){
                    if (curUserCoin.block =='да'){
                      try{
                        let curBlockName = coins.find(item=>item.id==currBlock.poolId);
                        bot.telegram.sendMessage(curUser.userId,
                          '<b>Новый блок ' + curBlockName.name + ' подтвержден!</b>\n'+
                          'Параметры блока:\n' +
                          "<b>- высота блока: </b>"  + currBlock.blockHeight +";\n" +
                          "<b>- сложность сети: </b>" + currBlock.networkDifficulty +";\n"+
                          `<b>- тип: </b>  ${currBlock.type==undefined? 'block': currBlock.type};\n`+
                          "<b>- усилие: </b>" + Math.trunc(currBlock.effort*100)+"%" +";\n"+
                          "<b>- награда: </b>" + currBlock.reward +";\n"+
                          "<b>- ссылка: </b>" +    currBlock.infoLink +";\n"+
                          "<b>- майнер: </b>" +    currBlock.miner +";\n"+
                          "<b>- создан: </b>" +    currBlock.created, {parse_mode: 'HTML'}
                        ); 
                        
                        console.log('Block confirmation message sent to user: ', curUser.userId);
                        logIt('Block confirmation message sent to user: ', curUser.userId)
                      }catch(err){
                        console.log('Error sending message about confirmed block! ', err);
                        logIt('Error sending message about confirmed block! ', err);
                        bot.telegram.sendMessage(settings.adminId, 'Error sending message about confirmed block! \n' + err);
                      }
                    }
                  }
                })
              });
            }
            let lastBlockIndex = lastBlocks.findIndex(item=>item.poolId==currBlock.poolId);
            lastBlocks[lastBlockIndex].blockHeight = currBlock.blockHeight;
            lastBlocks[lastBlockIndex].status = currBlock.status;
            let tempCurBlockIndex = tempBlocks.findIndex(item=>item.blockId==currBlock.poolId);
            tempBlocks.splice(tempCurBlockIndex, tempCurBlockIndex+1)
          }
        } else {
          // Проверка появления нового блока ----------------------------------------------------------
          users.forEach(curUser => {
            curUser.pools.forEach(curUserCoin=>{
              if(curUserCoin.pool.id==currBlock.poolId){
                let lastBlockCurCoin = lastBlocks.find(item=>item.poolId==curUserCoin.pool.id);
                if (lastBlockCurCoin!=-1){
                  if (lastBlockCurCoin.blockHeight != currBlock.blockHeight){           
                    if (curUserCoin.block =='да'){
                      try{
                        let curBlockName = coins.find(item=>item.id==currBlock.poolId);
                        bot.telegram.sendMessage(curUser.userId,
                          '<b>Найден новый блок ' + curBlockName.name + '!</b>\n' +
                          'Параметры блока:\n' +
                          "<b>- высота блока: </b>"  + currBlock.blockHeight +";\n" +
                          "<b>- сложность сети: </b>" + currBlock.networkDifficulty +";\n"+
                          "<b>- ссылка: </b>" +    currBlock.infoLink +";\n"+
                          "<b>- майнер: </b>" +    currBlock.miner +"\n", {parse_mode: 'HTML'}
                        );
                        console.log('Sent message about new block ',curBlockName.name, ' to user: Id -> ', curUser.userId);
                        logIt('Sent message about new block ',curBlockName.name, ' to user: Id -> ', curUser.userId);
                      }catch(err){
                        console.log('Error sending message about new block! ', err);
                        logIt('Error sending message about new block! ', err());
                        bot.telegram.sendMessage(settings.adminId, 'Error sending message about new block! \n' + err);
                      }
                    }
                    let tempBlock = {
                      blockId: currBlock.poolId,
                      blockHeight: currBlock.blockHeight,
                      status: currBlock.status
                    } 
                    tempBlocks.push(tempBlock)
                  }
                }
              }
            });
          });
        } 
      }
    })    
  })
};

// Проверка хешрейта воркеров ----------------------------------------------------------------------
function  getHash(){
  let urls2=[];
  users.forEach(user =>{
    let pools = user.pools;
    //подготовка адресов опроса ----
    pools.forEach(coin=>{
      if(coin.wallet==null && coin.workers.length==0) return
      let obj ={
        coin : coin.pool.id,
        url2: api + coin.pool.id + '/miners/' + coin.wallet
      }
      urls2.push(obj) 
    })
    //опрос адресов ----
    Promise.allSettled(urls2.map(item =>
      axios.get(item.url2)
    )).then(res => {
      res.forEach(item=>{
        if (item.status=='fulfilled'){
          if(item.value.data.performance!=undefined){
            let currCoin = item.value.data.performance.workers;
            let currCoinId = item.value.config.url.match(new RegExp("pools/(.*)/miners"))[1];
            let userCoin = user.pools.find(item2 => item2.pool.id==currCoinId);
            if(userCoin==undefined) return
            userCoin.workers.forEach(item=>{           
              if (currCoin[(item.name =='default'? '': item.name)]!=undefined){
                if (item.hashLevel*koeff(item.hashDev)>currCoin[(item.name =='default'? '': item.name)].hashrate && item.delivered==false) {
                  console.log('ALARM!');
                  try{
                    bot.telegram.sendMessage(user.userId,
                    '<b>Предупреждение!</b>\n' +
                    'Хешрейт воркера '   + '«<b>' +  `${item.name ==''? 'default': item.name}` + '</b>»' + '\n' +
                    'кошелька: <b>' + userCoin.wallet   + '</b> \n' +
                    'монеты: <b>' + userCoin.pool.name + '</b> \n' +
                    'опустился ниже установленного в <b>'  +  item.hashLevel   + ' '  +  item.hashDev + '</b>\n' +
                    'и составляет <b>'  +  formatHashrate(currCoin[(item.name =='default'? '': item.name)].hashrate)+ '</b>\n' +
                    'Оповещение об уровне хешрейта этого воркера <b>отключено!</b>\n' +
                    'Для возобновления оповещения для этого воркера устовновите новый уровень хешрейта', 
                    { parse_mode: 'HTML' }
                  );
                  item.delivered = true;
                  saveChanges(); 
                  }catch(err){
                    console.log('Send hashrate massege error:  ', err);
                    logIt('Send hashrate massege error:  ', err);
                  }
                }
              } 
              else
              {
                if (item.delivered==false  && item.name!=''){
                  try{
                    bot.telegram.sendMessage(user.userId,  
                      '<b>Внимание!</b>\n' +        
                      'Воркер '   + '«<b>' +  `${item.name ==''? 'default': item.name}` + '</b>»' + ' для кошелька' +'\n' +
                      '<b>' + userCoin.wallet  + '</b>' +'\n' +
                      'монеты: <b>' + userCoin.pool.name + '</b> \n' +
                      '<b><u>не функционирует</u>!</b> \n' +
                      'Он автоматически <b>удален</b> из Вашего списка контролируемых воркеров.\n' + 
                      'Для возобновления оповещения для этого воркера устовновите новый уровень хешрейта',
                      {parse_mode: 'HTML'}
                    );
                    let index2 = userCoin.workers.findIndex(item1=>item1.name == item.name);
                    if (index2 != -1){
                      userCoin.workers.splice(index2, index2+1);
                      if(userCoin.workers.length == 0){
                        let index3 =user.pools.findIndex(item2=>item2.pool.name == userCoin.pool.name);
                        if (index3 != -1) {
                          user.pools.splice(index3, index3+1);
                          console.log('Coin  «' + userCoin.pool.name + '» hase not conrolled workers and deleted!');
                          logIt('Coin  «' + userCoin.pool.name + '» hase not conrolled workers and deleted!');
                          if(user.pools.length==0){
                            console.log('....>>',pools.length)
                            let index1 =users.findIndex(item=>item.userId == user.userId);
                            if (index1 != -1) users.splice(index1, index1+1);
                          }
                        }
                      }
                      console.log('Broken worker: «' + item.name + '» of wallet: "' + item.wallet + ' deleted!');
                      logIt('Broken worker: «' + item.name + '» of wallet ' + item.wallet + ' deleted!');
                      saveChanges();
                    }                   
                  }catch(err){
                    console.log('Send broken worker massege error:  ', err);
                    logIt('Send broken worker massege error:  ', err);
                  }
                }
              }
            })
          }
          else
          {
            let currCoinId = item.value.config.url.match(new RegExp("pools/(.*)/miners"))[1];
            let userCoin = user.pools.find(item => item.pool.id==currCoinId)
            try{
              bot.telegram.sendMessage(user.userId,
                '<b>Внимание!</b>\n' +
                'Ваш кошелек <b>' + userCoin.wallet   + '</b>\n' +
                'монеты: <b>' + userCoin.pool.name + '</b> \n' +
                'неактуален!\n' +
                'Этот кошелек автоматически <b>удален</b> из списка оповещения.' + 
                'Для возобновления оповещения подпишитесь снова', 
                {parse_mode: 'HTML'}  
              );
              let index = user.pools.findIndex(item => item.pool.id == userCoin.pool.id);
              if (index != -1){
                user.pools.splice(index, index+1);
                if(user.pools.length==0){
                // console.log('....>>',pools.length)
                  let index1 =users.findIndex(item=>item.userId == user.userId);
                  if (index1 != -1) users.splice(index1, index1+1);
                }
                console.log('Wallet ' + userCoin.wallet + ' of user ' + user.userId +' is invalid!');
                console.log('Removed user: Id -> ', user.userId);
                console.log('Total Users: ', users.length);
                logIt('Broken wallet ' + item.wallet + ' of user ' + user.userId +' is invalid!');       
                logIt('Removed user: Id -> ', user.userId);
                logIt('Total Users: ', users.length);
    
                saveChanges(); 
              }
            }catch(err){
              console.log('Send broken wallet massege error: ', err);
              logIt('Send broken wallet massege error: ', err);
            }
            return
          }
        } 
      });
    }); 
  });
}
// Запись новых данных о пользователях в файл -----------------------------------------------------
function saveChanges(){
  try{
    fs.writeFileSync('./src/storage/users.json', JSON.stringify(users));
  }catch(err){
    console.log('Error writing to the information file of the delivered message: ', err);
    logIt('Error writing to the information file of the delivered message: ', err);
  }
}
// ------------------------------------------------------------------------------------------------  
module.exports = bot;
