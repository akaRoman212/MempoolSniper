import ethers from 'ethers';
import express from 'express';
import chalk from 'chalk';
import dotenv from 'dotenv';
import inquirer from 'inquirer';
import abiDecoder from 'abi-decoder' 
import { createRequire } from "module"; 
const require = createRequire(import.meta.url);
const panabi = require('./PancakeRouter.json');




const app = express();
dotenv.config();

const data = {
  BNB: process.env.BNB_CONTRACT, //bnb

  to_PURCHASE: process.env.TO_PURCHASE, // token that you will purchase = BUSD for test '0xe9e7cea3dedca5984780bafc599bd69add087d56'

  AMOUNT_OF_BNB : process.env.AMOUNT_OF_BNB, // how much you want to buy in BNB

  router: process.env.ROUTER, //PancakeSwap V2 router

  recipient: process.env.YOUR_ADDRESS, //your wallet address,

  gasLimit : process.env.GAS_LIMIT, //at least 21000

  minBnb : process.env.MIN_LIQUIDITY_ADDED //min liquidity added

}




const url = process.env.WSS_NODE;
const mnemonic = process.env.YOUR_MNEMONIC //your memonic;
const tokenIn = data.BNB;
const tokenOut = data.to_PURCHASE;
// const provider = new ethers.providers.JsonRpcProvider(bscMainnetUrl)
const provider = new ethers.providers.WebSocketProvider(url);
const wallet = new ethers.Wallet(mnemonic);
const account = wallet.connect(provider);

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


//We buy x amount of the new token for our bnb
const amountIn = ethers.utils.parseUnits(`${data.AMOUNT_OF_BNB}`, 'ether');
const amountOutMin = 0


const decoder = (input) => {
  if (input === undefined) {
    return
  }

  try {
    abiDecoder.addABI(panabi)
  
    const result = abiDecoder.decodeMethod(input);
  
    return result
  }
  catch (err) {
    console.log(err)
    return
  }
}

let done = false
let checkToken = false
let newliquidity = ''
let gasPrice = ''

const run = async () => {
  console.log("WAITING FOR LIQUIDITY...............................................")
      provider.on("pending", (transaction) => {
       
        provider.getTransaction(transaction).then(function (tx) {
          
          if(tx?.to?.toLowerCase() === data.router.toLowerCase()){
            gasPrice = Number(tx?.gasPrice)
            const txInputDecoded = decoder(tx?.data)
            
            if (txInputDecoded?.name === 'addLiquidityETH'){
              
              
              const [token, , , amountBdesired] = txInputDecoded.params
              
              if (token?.value.toLowerCase() === tokenOut.toLowerCase() ){
                
                checkToken = true
                if(checkToken){
                  newliquidity = amountBdesired?.value
                }
                
              if (checkToken && (parseFloat(ethers.utils.formatEther(newliquidity)) > parseFloat(data.minBnb) )){
                
                buyAction();
                
              }
              else{
                
                console.log(chalk.yellow(`Insufficient liquidity ADDED`))
              }
              }                
               
            }
          }
        });
      });
    }

let buyAction = async() => {
    try{
           
      // const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens( //uncomment this if you want to buy deflationary token
      const tx = await router.swapExactETHForTokens( //uncomment here if you want to buy token
        amountOutMin,
        [tokenIn, tokenOut],
        data.recipient,
        Date.now() + 1000 * 60 * 5, //5 minutes
        {
          'gasLimit': data.gasLimit,
          'gasPrice': gasPrice,
          'value' : amountIn
      });

      const receipt = await tx.wait();
      console.log('Starting to buy...............................................');
      console.log(`Transaction receipt : https://www.bscscan.com/tx/${receipt.logs[1].transactionHash}`);
      done = true
      process.exit(0)
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

const PORT = 5010;

app.listen(PORT, console.log(chalk.yellow(`Listening for Liquidity Addition to token ${data.to_PURCHASE}`)));
