const { RestClientV5 } = require('bybit-api');
const Service = require("../service/service");
const chalk = require('chalk');

let lastSellPrice = 0;
let sellPrice;

class tradeController{

    async buyTokenMarket( client, token, price, basePrecision) {

      const balance = await Service.getAccountBalance("USDT", client);
      const ammount = (balance / 2);
      const buyableAmmount = Service.roundDown(ammount, basePrecision[0])
      const strBuyableAmmount = buyableAmmount.toString();
      try {     
        const response = await client.submitOrder({
          category: 'spot',
          symbol: token.toUpperCase() + 'USDT',
          side: 'Buy',
          orderType: 'Market',
          qty: strBuyableAmmount,
        })
        const lastBuyPrice = await Service.findOrderPrice(client, token);
        Service.logInformation(`Куплено ${buyableAmmount / parseFloat(price)} ${token} (~${buyableAmmount}$) по маркету ~${lastBuyPrice}$`);
        return lastBuyPrice
      } catch (error) {
        console.log(chalk.white.bgRed.bold('•' + ' ' +'Ошибка при получении информации об ордере:', error));
      } 
    }

    async buyToken( client, token, price, basePrecision, startBalance, loss) {
        let strBayableTokenBalance = "";
        let bayableTokenBalance = 0;
        const balance = await Service.getAccountBalance("USDT", client);
        if(balance > (startBalance / 2)){
          const ammount = (startBalance / 2 - loss) / parseFloat(price);
          bayableTokenBalance = Service.roundDown(ammount, basePrecision[0]);
          strBayableTokenBalance = bayableTokenBalance.toString();
        }
        else{
          const ammount = balance / parseFloat(price);
          bayableTokenBalance = Service.roundDown(ammount, basePrecision[0]);
          strBayableTokenBalance = bayableTokenBalance.toString();
        } 
        let lastBuyPrice = parseFloat(price);

        try {     
          const response = await client.submitOrder({
            category: 'spot',
            symbol: token.toUpperCase() + 'USDT',
            side: 'Buy',
            orderType: 'Limit',
            qty: strBayableTokenBalance,
            price: price.toString(),
          })
          Service.logInformation(`Поставлена лимитка на покупку ${bayableTokenBalance} $${token} (~${bayableTokenBalance*parseFloat(price)}$) по цене: ${price}$`);

          const orderResponse = await client.getActiveOrders({category: "spot", orderId: response.result.orderId});
          if(orderResponse.result && orderResponse.result.list && orderResponse.result.list[0] == undefined){
            Service.logInformation(`Не удалось купить`)
          }

          return lastBuyPrice

        } catch (error) {
          console.log(chalk.white.bgRed.bold('•' + ' ' +'Ошибка при получении информации об ордере:', error));
        } 
    }

    async sellHalfTokenMarket(client, token, price, basePrecision, startBalance, loss) {

      const tokenBalance = await Service.getAccountBalance(token.toUpperCase(), client);
      const usdtAmmount = (startBalance / 2) - loss;
      const tokenAmmount = (parseFloat(tokenBalance) - (usdtAmmount / parseFloat(price)));
      const salableTokenBalance = Service.roundDown(tokenAmmount, basePrecision[0]);
      const strSalableTokenBalance = salableTokenBalance.toString();
      if(salableTokenBalance > 0){
        try {       
          const response = await client.submitOrder({
              category: 'spot',
              symbol: token.toUpperCase() + 'USDT',
              side: 'Sell',
              orderType: 'Market',
              qty: strSalableTokenBalance,
            })
            lastSellPrice = await Service.findOrderPrice(client, token);
            Service.logInformation(`Проданно ${salableTokenBalance} $${ token } (~${salableTokenBalance * lastSellPrice}$) по маркету ~${lastSellPrice}$ из-за не достатка usdt для продолжения набивания оборота`);
            return lastSellPrice
          } catch (error) {
            console.log(chalk.white.bgRed.bold('•' + ' ' +'Ошибка при получении информации об ордере:', error));
          } 
      }
  }

  async sellTokenMarket(client, token, basePrecision) {

    const tokenBalance = await Service.getAccountBalance(token.toUpperCase(), client);
    const sellableAmmount = Service.roundDown(tokenBalance, basePrecision[0])
    const strBuyableAmmount = sellableAmmount.toString();
    if(sellableAmmount > 0){
      try {       
        const response = await client.submitOrder({
            category: 'spot',
            symbol: token.toUpperCase() + 'USDT',
            side: 'Sell',
            orderType: 'Market',
            qty: strBuyableAmmount,
          })
          lastSellPrice = await Service.findOrderPrice(client, token);
          Service.logInformation(`Проданно ${sellableAmmount} $${ token } (~${sellableAmmount * lastSellPrice}$) по маркету ~${lastSellPrice}$`);
          return lastSellPrice
        } catch (error) {
          console.log(chalk.white.bgRed.bold('•' + ' ' +'Ошибка при получении информации об ордере:', error));
        } 
    }
  }

  async sellToken(client, token, price, basePrecision, lastBuyPrice) {

    if(lastSellPrice == lastBuyPrice){
      sellPrice = lastBuyPrice;
    }
    else{
      sellPrice = parseFloat(price) * 0.999;
    }

    const salableSellPrice = Service.roundDown(sellPrice, basePrecision[1]);
    const strsalableSellPrice = salableSellPrice.toString();
    const tokenBalance = await Service.getAccountBalance(token.toUpperCase(), client);
    const salableTokenBalance = Service.roundDown(tokenBalance, basePrecision[0]);
    const strSalableTokenBalance = salableTokenBalance.toString();

    try {       
      const response = await client.submitOrder({
          category: 'spot',
          symbol: token.toUpperCase() + 'USDT',
          side: 'Sell',
          orderType: 'Limit',
          qty: strSalableTokenBalance,
          price: strsalableSellPrice,
        })
        Service.logInformation(`Поставлена лимитка на продажу ${salableTokenBalance} $${ token } (~${salableTokenBalance * salableSellPrice}$) по цене: ${salableSellPrice}$`);

        lastSellPrice = salableSellPrice;

        return lastSellPrice
      } catch (error) {
        console.log(chalk.white.bgRed.bold('•' + ' ' +'Ошибка при получении информации об ордере:', error));
      } 
    }

}

module.exports = new tradeController();