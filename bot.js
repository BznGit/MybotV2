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
const users = require('./src/storage/users.json');
const {formatHashrate} = require('./src/libs/utils.js');
const {koeff} = require('./src/libs/utils.js');
const {logIt} = require('./src/libs/loger.js');
const fs = require('fs');

// Создание менеджера сцен ------------------------------------------------------------------------
const stage = new Scenes.Stage();
stage.register(home, subscribe, unSubscribe, chengeSubscribe, onBlock, addCoin, delCoin);
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
// Обработчик события при старте ------------------------------------------------------------------
bot.action('onStart', (ctx)=>{
  ctx.scene.enter("homeSceneWizard")
})
// Запуск бота-------------------------------------------------------------------------------------
bot.launch();
// Установка параметров запуска бота --------------------------------------------------------------
function start(){
  //setInterval(getBlock, settings.monitoringPeriodSec*1000);
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
  console.log('lastBloks>---', lastBlocks);
  console.log('urls>---', urls);
  Promise.allSettled(urls.map(item =>
    axios.get(item.url)
  )).then(res => {
    res.forEach(item=>{
      if (item.status=='fulfilled'){
        let currBlock = item.value.data[0];
        console.log('currBlock**', currBlock);
        console.log('tempBlocks:::', tempBlocks);
        let tempCurBlock = tempBlocks.find(item=>item.blockId==currBlock.poolId);
        console.log('tempCurBlock__', tempCurBlock)
        if (tempCurBlock != undefined){   
          // Подтверждение нового блока ---------------------------------------------------------------
          if (currBlock.blockHeight==tempCurBlock.blockHeight && currBlock.status=='confirmed'){
            //console.log('Active users:', users);
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
                        console.log('Block confirmation message sent to user: Id -> ', curUser.userId);
                        logIt('Block confirmation message sent to user: Id ->', curUser.userId)
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
                        console.log('Sent message about new block to user: Id -> ', curUser.userId);
                        logIt('Sent message about new block to user: Id -> ', curUser.userId);
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
                    console.log('tempBlock++',tempBlocks)
                  }
                }
              }
            });
          });
        } 
      }
    })    
  }).then(()=>{
    console.log('lastBlocks!', lastBlocks);
    
  });
};

// Проверка хешрета воркеров ----------------------------------------------------------------------
function  getHash(){
  let urls2=[];
  users.forEach(user =>{
    let pools = user.pools;
    pools.forEach(coin=>{
      if(coin.wallet==null && coin.workers==null) return
      urls2.push(api + coin.pool.id + '/miners/' + coin.wallet) 
     
    })
    console.log(urls2);
    Promise.allSettled(urls2.map(item =>
    axios.get(item)
    )).then(res => {
      res.forEach(item=>{
       
        console.log('++>>>',item.value.headers);
        console.log('---->>>',item.value.request);
        if (item.status=='fulfilled'){
          let currCoin = item.value.data.performance;
          console.log('currCoin>', currCoin)
        }
      });
    });
    
  });




  users.forEach(item =>{
    if(item.wallet==null && item.workers==null) return
    axios({
      url: api2  + item.pools.pool.id + '/miners/' + item.pools.wallet,
      method: 'get',
      timeout: 2000})
    .then((response)=> {
      if(response.data.performance==undefined){
        try{
          bot.telegram.sendMessage(item.userId,
            '<b>Внимание!</b>\n' +
            'Ваш кошелек <b>' + item.wallet   + '</b>\n' +
            'неактуален!\n' +
            'Пользователь с этим кошельком автоматически <b>удален</b> из списка оповещения.' + 
            'Для возобновления оповещения подпишитесь снова', 
            {parse_mode: 'HTML'}  
          );
          let index = users.findIndex(user => user.userId == item.userId);
          if (index != -1){
            users.splice(index, index+1);

            console.log('Wallet ' + item.wallet + ' of user ' + item.userId +' is invalid!');
            console.log('Removed user: Id -> ', item.userId);
            console.log('Total Users: ', users.length);
            logIt('Broken wallet ' + item.wallet + ' of user ' + item.userId +' is invalid!');       
            logIt('Removed user: Id -> ', item.userId);
            logIt('Total Users: ', users.length);

            saveChanges();
         }
        }catch(err){
          console.log('API ERORR! Performance request: ', err);
          logIt('API ERORR! Performance request: ', err);
        }
        return
      }
      let allWorkers = response.data.performance.workers; // Все сущесивующие воркеры
      let controlledWorkers = item.workers; // Все контрорлируемые воркеры
      // Цикл проверки воркеров -------------------------------------------------------------------
      controlledWorkers.forEach(itemCW=>{
        if (itemCW.name=='default') itemCW.name= '';
          if (allWorkers[itemCW.name]!=undefined){
            let itemAWhash = allWorkers[itemCW.name].hashrate;
            let itemPorog = itemCW.hashLevel*koeff(itemCW.hashDev)
            if (itemAWhash<itemPorog && itemCW.delivered==false){    
              try{
                bot.telegram.sendMessage(item.userId,
                  '<b>Предупреждение!</b>\n' +
                  'Хешрейт воркера '   + '«<b>' +  `${itemCW.name ==''? 'default': itemCW.name}` + '</b>»' + '\n' +
                  'кошелька: <b>' + item.wallet   + '</b> \n' +
                  'опустился ниже установленного в <b>'  +  itemCW.hashLevel   +' '  +  itemCW.hashDev + '</b>\n' +
                  'и составляет <b>'  +  formatHashrate(itemAWhash)+ '</b>\n' +
                  'Оповещение об уровне хешрейта этого воркера <b>отключено!</b>.\n' +
                  'Для возобновления оповещения для этого воркера устовновите новый уровень хешрейта', 
                  {parse_mode: 'HTML'}
                );
                itemCW.delivered = true;
                console.log('A hashrate message has been sent to the user: Id -> ', item.userId);
                logIt('A hashrate message has been sent to the user: Id -> ', item.userId);
                saveChanges()
              }catch(err){
                console.log('Error sending message about hashrate! ', err);
                logIt('Error sending message about hashrate! ', err);
                bot.telegram.sendMessage(settings.adminId, 'Error sending message about hashrate!  \n' + err);
              }    
            }
        }else{
          if (itemCW.delivered==false){
            bot.telegram.sendMessage(item.userId,  
              '<b>Внимание!</b>\n' +        
              'Воркер '   + '«<b>' +  `${itemCW.name ==''? 'default': itemCW.name}` + '</b>»' + ' для кошелька' +'\n' +
              '<b>' + item.wallet  + '</b>' +'\n' +
              '<b><u>не функционирует</u>!</b> \n' +
              'Он автоматически <b>удален</b> из Вашего списка контролируемых воркеров.\n' + 
              'Для возобновления оповещения для этого воркера устовновите новый уровень хешрейта',
              {parse_mode: 'HTML'}
            );
            let index = controlledWorkers.findIndex(item=>item.name == itemCW.name);
            if (index != -1){
              controlledWorkers.splice(index, index+1);
              console.log('Broken worker: «' + itemCW.name + '» of wallet: "' + item.wallet + ' deleted!');
              logIt('Broken worker: «' + itemCW.name + '» of wallet ' + item.wallet + ' deleted!');
              saveChanges();
           }
          }
        }
      })
      //-------------------------------------------------------------------------------------------
      if (response.data.performance == undefined){
        console.log('Hash polling error!');
        logIt('Hash polling error! bot.js 194 стр');
        return
      }
    }).catch(function (error){
       console.log('API ERORR! Hashrate request: ', error);
       logIt('API ERORR! Hashrate request: ', error);
       bot.telegram.sendMessage(settings.adminId, 'API ERORR! Hashrate request: \n' + error);
      return
     })
  })
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

