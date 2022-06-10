 let formatHashrate = function(rate) {
    rate= parseFloat(rate); let unit= 'H/s';
    if(rate >= 1000) { rate /= 1000; unit= 'KH/s'; }
    if(rate >= 1000) { rate /= 1000; unit= 'MH/s'; }
    if(rate >= 1000) { rate /= 1000; unit= 'GH/s'; }
    if(rate >= 1000) { rate /= 1000; unit= 'TH/s'; }
    if(rate >= 1000) { rate /= 1000; unit= 'PH/s'; }
    return (rate.toFixed(2) + ' ' + unit);
  };

let koeff = function(def){
    let k = 1;
    switch (def){
        case 'КH/s' : k = Math.pow(10, 3);
            break;
        case 'MH/s' : k = Math.pow(10, 6);
          break;
        case 'GH/s' : k = Math.pow(10, 9);
          break;
        case 'TH/s' : k = Math.pow(10, 12);
          break;
        case 'PH/s' : k = Math.pow(10, 15);
          break;
      }
      return k
  };
  module.exports = {koeff, formatHashrate}
