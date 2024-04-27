const { RestClientV5 } = require('bybit-api');
const readline = require('readline');
const tradeController = require("./controllers/trade-controller");
const Service = require("./service/service");
const chalk = require('chalk');
let api_key = "";
let secret_api_key = "";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
    return new Promise((resolve, reject) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
}
  
async function getTokenInfoToBuy(token, client) {
    try {
      const response = await client.getTickers({ category: "spot", symbol: token.toUpperCase() + "USDT" });
      const buyPrice = response.result.list[0].ask1Price;
      return buyPrice;
    } catch (error) {
      console.error(error);
      throw error;
    }
}

async function countVolume(client, lastOrderId, token){
  let volume = 0;
  const orders = await client.getExecutionList({
    category: 'spot',
    symbol: token.toUpperCase() + 'USDT',
  })
  let ordersarr = orders.result.list;
  const lastOrderIndex = ordersarr.findIndex(order => order.orderId === lastOrderId);
  for(let i = 0; i<=lastOrderIndex; i++){
      volume+= parseFloat(ordersarr[i].execValue)
  }
  console.log(chalk.white.bgGreen.bold('•' + ' ' + `Общий объем: ${Service.roundDown(volume, 2)}$`));
  return volume;
}

async function countLoss(client, token, startBalance){
  const r1 = await client.getWalletBalance({accountType: "UNIFIED", coin: "USDT"});
  const Balance = r1.result.list[0].totalWalletBalance;
  const intBalance = parseFloat(Balance);
  const r2 = await client.getWalletBalance({accountType: "UNIFIED", coin: token.toUpperCase()});
  const TokenBalance = r2.result.list[0].coin[0].usdValue;
  const intTokenBalance = parseFloat(TokenBalance);
  let loss = startBalance - intBalance - intTokenBalance;
  return {loss: loss, Balance: Balance};
}

async function getApiKeys(){
  api_key = await askQuestion('Укажите ваш api key: ');;
  secret_api_key = await askQuestion('Укажите ваш secret api key: ');;
}

function createLogo() {
    const logo = `
    __           __                     __               __                                               __
    .--------..---.-..--|  |.-----.  |  |--..--.--.  .-----.|  |--..---.-..--|  |.-----..--.--.--.  .----..----..--.--..-----.|  |_ .-----.
    |        ||  _  ||  _  ||  -__|  |  _  ||  |  |  |__ --||     ||  _  ||  _  ||  _  ||  |  |  |  |  __||   _||  |  ||  _  ||   _||  _  |
    |__|__|__||___._||_____||_____|  |_____||___  |  |_____||__|__||___._||_____||_____||________|  |____||__|  |___  ||   __||____||_____|
                                            |_____|                                                             |_____||__|
`;
    return chalk.cyanBright.bold(logo);
}

console.log(createLogo());

async function trade() {
  
  let firstBuy = true;
  let volume = 0;
  let lastSellPrice = 0;
  let lastOrderId = "";

  await getApiKeys();
  const client = new RestClientV5({
    key: api_key,
    secret: secret_api_key,
    recvWindow: 60000,
  });

  const token = await askQuestion('В каком токене торговать: ');
  const stop = await askQuestion('Какой оборот наторговать: ');
  rl.close();

  const basePrecisionLength = await Service.findBasePrecision(token, client);
  let startBalance = await Service.getAccountBalance("USDT", client);

  while(volume < parseFloat(stop)){
    Service.createSeparator();
    const response = await getTokenInfoToBuy(token, client);
    if(firstBuy){
      const lastBuyPrice = await tradeController.buyTokenMarket(client, token, response, basePrecisionLength);
      lastOrderId = await Service.findLastOrder(client, token);
      lastSellPrice = await tradeController.sellToken(client, token, response, basePrecisionLength, lastBuyPrice);
    }
    else{
        if(lastSellPrice > 0 && lastSellPrice <= parseFloat(response) ){
          const lastBuyPrice = await tradeController.buyToken(client, token, lastSellPrice, basePrecisionLength);
          const tokenBalance = await Service.getAccountBalance(token.toUpperCase(), client);
          const salableTokenBalance = Service.roundDown(tokenBalance, basePrecisionLength[0]);
          await Service.sleep(200);
          Service.logInformation(`Check: ${parseFloat(response) * salableTokenBalance}`)
          if(parseFloat(response) * salableTokenBalance >  5){
            lastSellPrice = await tradeController.sellToken(client, token, response, basePrecisionLength, lastBuyPrice);
          }
          else{
            await Service.cancelOrder(client, token);
            const lastBuyPrice = await tradeController.buyTokenMarket(client, token, response, basePrecisionLength);
            lastSellPrice = await tradeController.sellToken(client, token, response, basePrecisionLength, lastBuyPrice);
          }  
        }
        else{
          Service.logInformation(`Ставим новую лимитку `);
          const lastBuyPrice = await tradeController.buyTokenMarket(client, token, response, basePrecisionLength);
          lastSellPrice = await tradeController.sellToken(client, token, response, basePrecisionLength, lastBuyPrice);
        }
    }
    firstBuy = false;

    let {loss, Balance} = await countLoss(client, token, startBalance);
    console.log(chalk.white.bgRed.bold('•' + ' ' + `Затраты: ~ ${Service.roundDown(loss, 2)}$`));

    if(Balance < (startBalance / 2) - loss - 5){
      const cancelOrders = await client
      .cancelAllOrders({
        category: 'spot',
        settleCoin: 'USDT',
      })
      const ordersQuantity = cancelOrders.result.list.length;
      if(ordersQuantity != undefined && ordersQuantity != 0){
        Service.logInformation(`Количество отмененных ордеров ${ordersQuantity}`);
      }
      lastSellPrice = await tradeController.sellHalfTokenMarket(client, token, response, basePrecisionLength, startBalance, loss);
    } 

    volume = await countVolume(client, lastOrderId, token);
    Service.createSeparator();
    console.log("\n");
    await Service.sleep(200);
  }

  Service.createSeparator();
  const cancelFinalOrders = await client.cancelAllOrders({
    category: 'spot',
    settleCoin: 'USDT',
  })
  const ordersQuantity = cancelFinalOrders.result.list.length;
  if(ordersQuantity != undefined && ordersQuantity != 0){
    Service.logInformation(`Количество отмененных ордеров ${ordersQuantity}`);
    await tradeController.sellTokenMarket(client, token, basePrecisionLength);
  }

  let {loss, Balance} = await countLoss(client, token, startBalance);
  console.log(chalk.white.bgRed.bold('•' + ' ' + `Финальные Затраты: ~ ${Service.roundDown(loss, 2)}$`));
  volume = await countVolume(client, lastOrderId, token);
}

trade();