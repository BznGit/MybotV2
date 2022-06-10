const fs = require('fs');
const settings = require('../../botSettings.json');
// Проверака наличая файла для записи логов -------------------------------------------------------
if(!fs.existsSync('./logs.txt')) fs.openSync('./logs.txt','w');
 // Функция записи логов --------------------------------------------------------------------------
let logIt = function(log, ...obj){
  // Проверака разрешения на запись логов ---------------------------------------------------------
  if(!settings.eventsLoger) return;
  // Чтение файла предыдущих логов ----------------------------------------------------------------
  let oldLogs=null
  try{
    oldLogs = fs.readFileSync('./logs.txt', "utf8");
  }catch(err){
    console.log('Ошибка чтения файла логов: ./logs.txt ', err)
  }
  // Подготовка формата текущей даты и времени ----------------------------------------------------
  let date = new Date()
  let year  = date.getFullYear();
  let month = (date.getMonth()+1) < 10 ? '0' + (date.getMonth()+1) : (date.getMonth()+1);
  let day = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
  let hour = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
  let min = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
  let time  = `${hour}:${min}`;
  let data = `${day}.${month}.${year} \n`
  // Проверака начала нового дня ------------------------------------------------------------------
  if(oldLogs.indexOf(data)==-1){
    try{
      fs.appendFileSync('./logs.txt', data);
    }catch(err){console.log('Ошибка записи файла логов: ./logs.txt ', err)}
  }
  // Запись логов в файл --------------------------------------------------------------------------
  try{
    fs.appendFileSync('./logs.txt', '     ' +  time +' > ' + log + obj.toString() +'\n'); 
  }catch(err){
    console.log('Error writing log file: ./logs.txt ', err)
  }
};

 module.exports = {logIt}
