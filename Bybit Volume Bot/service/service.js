const chalk = require('chalk');

class Service{
    createSeparator() {
        const separator = chalk.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(separator);
    }

    logInformation(info, color = 'white', bgColor = 'bgBlack', symbol = '•') {
        const styledInfo = chalk[color][bgColor](symbol + ' ' + info);
        console.log(styledInfo);
    }

    roundDown(number, decimalPlaces) {
        const factor = Math.pow(10, decimalPlaces);
        return Math.floor(number * factor) / factor;
    }
    
    async findBasePrecision(token, client){
        try {
            const response = await client.getInstrumentsInfo({category: 'spot',symbol: token + "USDT"});
            const basePrecision = response.result.list[0].lotSizeFilter.basePrecision;
            const tickSize = response.result.list[0].priceFilter.tickSize;
            const basePrecisionLength  = basePrecision.length -2;
            const tickSizeLength  = tickSize.length -2;
            if (basePrecision) {
                return [basePrecisionLength, tickSizeLength]
            } else {
                console.log(chalk.white.bgRed.bold('•' + ' ' + 'basePrecision не найден'));
            }
        }
        catch(error){
            console.log(chalk.white.bgRed.bold('•' + ' ' +'Ошибка при получении basePrecision:', error.message));
        }
    }

    async getAccountBalance(token, client) {
        try {
            const response = await client.getWalletBalance({accountType: "UNIFIED", coin: token});
            const tokenBalance = response.result.list[0].coin[0].availableToWithdraw;
            const intBalance = parseFloat(tokenBalance)
            if (tokenBalance) {
                return intBalance
            } else {
                console.log(chalk.white.bgRed.bold('•' + ' ' + ' ' + `Монеты ${token} не найдены в балансе.`));
            }

        } catch (error) {
            console.log(chalk.white.bgRed.bold('•' + ' ' +'Ошибка при получении баланса:', error.message));
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async cancelOrder(client, token){
        try {    
            const response = await client.getActiveOrders({
                category: 'spot',
                symbol: token.toUpperCase() + 'USDT',
                openOnly: 0,
                limit: 1,
            })
            const orderId = response.result.list[0].orderId
            try { 
                const cancelOrder = await client.cancelOrder({
                    category: 'spot',
                    symbol: token.toUpperCase() + 'USDT',
                    orderId: orderId,
                })
                if(cancelOrder.retMsg == 'OK'){
                    console.log(chalk.white.bgBlack.bold('•' + ' ' + `Ордер с id: ${orderId}, успешно отменен из-за не выполнения`));
                }
            }
            catch(e){
                console.log(chalk.white.bgRed.bold('•' + ' ' + `Не получилось отменить ордер. \n Ошибка: ${e}`));
            }
        }catch(e){
            console.log(chalk.white.bgRed.bold('•' + ' ' + e));
        }
    }

    async findOrderPrice(client, token, orderId){
        const orders = await client.getExecutionList({
          category: 'spot',
          symbol: token.toUpperCase() + 'USDT',
        })
        let ordersArr = orders.result.list;
        return parseFloat(ordersArr[0].execPrice);
    }
    
    async findLastOrder(client, token) {
        try{
          const orders = await client.getExecutionList({
              category: 'spot',
              symbol: token.toUpperCase() + 'USDT',
          })
          const lastOrderId = orders.result.list[0].orderId
          return lastOrderId
        }
        catch(e){
          console.log("FindLastOrder error: ", e);
        }
      }
      async getOpenOrdersValue(client, token){
        const responce = await client.getActiveOrders({
          category: 'spot',
          symbol: token.toUpperCase() + 'USDT',
          openOnly: 0,
          limit: 1,
        })
        if(responce.result.list.length != 0){
            let openOrdersValue = responce.result.list[0].leavesValue;
            console.log(openOrdersValue)
            return openOrdersValue;
        }
        else{
            return 0;
        }
      }
}

module.exports = new Service();