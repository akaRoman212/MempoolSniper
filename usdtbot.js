import ethers from 'ethers';
import express from 'express';
import chalk from 'chalk';
import dotenv from 'dotenv';
import inquirer from 'inquirer';

const app = express();
dotenv.config();

const data = {
  BUSD: process.env.USDT_CONTRACT, //bnb

  to_PURCHASE: process.env.TO_PURCHASE, // token that you will purchase = BUSD for test '0xe9e7cea3dedca5984780bafc599bd69add087d56'

  AMOUNT_OF_BUSD : process.env.AMOUNT_OF_BUSD, // how much you want to buy in BNB

  factory: process.env.FACTORY,  //PancakeSwap V2 factory

  router: process.env.ROUTER, //PancakeSwap V2 router

  recipient: process.env.YOUR_ADDRESS, //your wallet address,

  Slippage : process.env.SLIPPAGE, //in Percentage

  gasPrice : ethers.utils.parseUnits(`${process.env.GWEI}`, 'gwei'), //in gwei

  gasLimit : process.env.GAS_LIMIT, //at least 21000

  minBUSD : process.env.MIN_BUSD_LIQUIDITY_ADDED //min liquidity added
}

let initialLiquidityDetected = false;
let jmlBusd = 0;

const url = process.env.WSS_NODE;
const mnemonic = process.env.YOUR_MNEMONIC //your memonic;
const tokenIn = data.BUSD;
const tokenOut = data.to_PURCHASE;
// const provider = new ethers.providers.JsonRpcProvider(bscMainnetUrl)
const provider = new ethers.providers.WebSocketProvider(url);
const wallet = new ethers.Wallet(mnemonic);
const account = wallet.connect(provider);


const factory = new ethers.Contract(
  data.factory,
  [
    'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
    'function getPair(address tokenA, address tokenB) external view returns (address pair)'
  ],
  account
);

const router = new ethers.Contract(
  data.router,
  [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external  payable returns (uint[] memory amounts)',
    'function swapExactETHForTokens( uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  ],
  account
);

const erc = new ethers.Contract(
  data.BUSD,
  [{"constant": true,"inputs": [{"name": "_owner","type": "address"}],"name": "balanceOf","outputs": [{"name": "balance","type": "uint256"}],"payable": false,"type": "function"}],
  account
);

const run = async () => {
    await checkLiq();
}

  let checkLiq = async() => {
    const pairAddressx = await factory.getPair(tokenIn, tokenOut);
    console.log(chalk.blue(`pairAddress: ${pairAddressx}`));
    if (pairAddressx !== null && pairAddressx !== undefined) {
      // console.log("pairAddress.toString().indexOf('0x0000000000000')", pairAddress.toString().indexOf('0x0000000000000'));
      if (pairAddressx.toString().indexOf('0x0000000000000') > -1) {
        console.log(chalk.cyan(`pairAddress ${pairAddressx} not detected. Auto restart`));
        return await run();
      }
    }
    const pairBUSDvalue = await erc.balanceOf(pairAddressx);
    jmlBusd = ethers.utils.formatEther(pairBUSDvalue);
    console.log(`value BUSD : ${jmlBusd}`);

    if(parseFloat(jmlBusd) > parseFloat(data.minBUSD)){
        setTimeout(() => buyAction(), 3000);
    }
    else{
        initialLiquidityDetected = false;
        console.log(' run again...');
        return await run();
      }
  }

  let buyAction = async() => {
    if(initialLiquidityDetected === true) {
      console.log('not buy cause already buy');
        return null;
    }

    console.log('ready to buy');
    try{
      initialLiquidityDetected = true;

      let amountOutMin = 0;
      //We buy x amount of the new token for our bnb
      const amountIn = ethers.utils.parseUnits(`${data.AMOUNT_OF_BUSD}`, 'ether');
      if ( parseInt(data.Slippage) !== 0 ){
        const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
        //Our execution price will be a bit different, we need some flexibility
        amountOutMin = amounts[1].sub(amounts[1].div(`${data.Slippage}`))
      }

      console.log(
       chalk.green.inverse(`Start to buy \n`)
        +
        `Buying Token
        =================
        tokenIn: ${(amountIn * 1e-18).toString()} ${tokenIn} (BUSD)
        tokenOut: ${amountOutMin.toString()} ${tokenOut}
      `);

      console.log('Processing Transaction.....');
      console.log(chalk.yellow(`amountIn: ${(amountIn * 1e-18)} ${tokenIn} (BUSD)`));
      console.log(chalk.yellow(`amountOutMin: ${amountOutMin}`));
      console.log(chalk.yellow(`tokenIn: ${tokenIn}`));
      console.log(chalk.yellow(`tokenOut: ${tokenOut}`));
      console.log(chalk.yellow(`data.recipient: ${data.recipient}`));
      console.log(chalk.yellow(`data.gasLimit: ${data.gasLimit}`));
      console.log(chalk.yellow(`data.gasPrice: ${data.gasPrice}`));

      // const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens( //uncomment this if you want to buy deflationary token
      const tx = await router.swapExactTokensForTokens( //uncomment here if you want to buy token
        amountIn,
        amountOutMin,
        [tokenIn, tokenOut],
        data.recipient,
        Date.now() + 1000 * 60 * 5, //5 minutes
        {
          'gasLimit': data.gasLimit,
          'gasPrice': data.gasPrice,
          
      });

      const receipt = await tx.wait();
      console.log(`Transaction receipt : https://www.bscscan.com/tx/${receipt.logs[1].transactionHash}`);
      setTimeout(() => {process.exit()},2000);
    }catch(err){
      let error = JSON.parse(JSON.stringify(err));
        console.log(`Error caused by : 
        {
        reason : ${error.reason},
        transactionHash : ${error.transactionHash}
        message : ${error}
        }`);
        console.log(error);

        inquirer.prompt([
    {
      type: 'confirm',
      name: 'runAgain',
      message: 'Do you want to run again thi bot?',
    },
  ])
  .then(answers => {
    if(answers.runAgain === true){
      console.log('= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =');
      console.log('Run again');
      console.log('= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =');
      initialLiquidityDetected = false;
      run();
    }else{
      process.exit();
    }

  });

    }
  }

run();

const PORT = 5002;

app.listen(PORT, console.log(chalk.yellow(`Listening for Liquidity Addition to token ${data.to_PURCHASE}`)));
