import ethers from 'ethers';
import express from 'express';
import chalk from 'chalk';
import dotenv from 'dotenv';
import abiDecoder from 'abi-decoder' 
import { createRequire, syncBuiltinESMExports } from "module"; 
const require = createRequire(import.meta.url);
const panabi = require('./PancakeRouter.json');




const app = express();
dotenv.config();

const data = {
  BUSD: process.env.BUSD_CONTRACT, //bnb

  to_PURCHASE: process.env.TO_PURCHASE, // token that you will purchase = BUSD for test '0xe9e7cea3dedca5984780bafc599bd69add087d56'

  AMOUNT_OF_BUSD : process.env.AMOUNT_OF_BUSD, // how much you want to buy in BNB

  router: process.env.ROUTER, //PancakeSwap V2 router

  recipient: process.env.YOUR_ADDRESS, //your wallet address,

  gasLimit : process.env.GAS_LIMIT, //at least 21000

  minBusd : process.env.MIN_BUSD_LIQUIDITY_ADDED //min liquidity added

}




const url = process.env.WSS_NODE;
const mnemonic = process.env.YOUR_MNEMONIC //your memonic;
const tokenIn = data.BUSD;
const tokenOut = data.to_PURCHASE;
// const provider = new ethers.providers.JsonRpcProvider(bscMainnetUrl)

const wallet = new ethers.Wallet(mnemonic);





//We buy x amount of the new token for our bnb
const amountIn = ethers.utils.parseUnits(`${data.AMOUNT_OF_BUSD}`, 'ether');
const amountOutMin = 0
const path = [tokenOut.toLowerCase(), tokenIn.toLowerCase()]

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

var txn = false
var checkToken = false
var newliquidity = ''
var gasPrice = ''

var run = async () => {

  var provider = new ethers.providers.WebSocketProvider(url);
 
  var account = wallet.connect(provider);
  var router = new ethers.Contract(
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



  console.log("WAITING FOR LIQUIDITY...............................................")
  provider.on("pending", async (transaction) => {
    var tx = await provider.getTransaction(transaction)

    if(tx?.to?.toLowerCase() === data.router.toLowerCase()){
      
      var txInputDecoded = decoder(tx?.data)
      
      if (txInputDecoded?.name === 'addLiquidity'){              
        
        var [token,token2,amountAdesired, amountBdesired] = txInputDecoded.params
        checkToken = path.includes(token?.value.toLowerCase()) && path.includes(token2?.value.toLowerCase())

        if (checkToken){

          
          gasPrice = Number(tx?.gasPrice)
                        
          console.log(checkToken)
          newliquidity = (token?.value.toLowerCase() === tokenIn.toLowerCase() ) 
          ? amountAdesired?.value
          : amountBdesired?.value

          
          if((parseFloat(ethers.utils.formatEther(newliquidity))) > (parseFloat(data.minBusd))){
          
            buyAction();
            if(txn){
              process.exit(0)
            }
            
          }
          else{
            
            console.log(chalk.yellow(`Insufficient liquidity ADDED`))
          }

        }
      }                
    }
  });
 
  provider._websocket.on("close", async (code) => {
    console.log(
      `Connection lost with code ${code}! Attempting reconnect in 20s...`
    );
    provider._websocket.terminate();
    setTimeout(run, 20000);
  });
  provider._websocket.on("error", async (er) => {
    console.log(`Unable to connect for reason: ${er}retrying in 10s...`);
    setTimeout(run, 10000);
  });
  

  let buyAction = async() => {
 
      // const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens( //uncomment this if you want to buy deflationary token
      const tx = await router.swapExactTokensForTokens( //uncomment here if you want to buy token
        amountIn,
        amountOutMin,
        [tokenIn, tokenOut],
        data.recipient,
        Date.now() + 1000 * 60 * 5, //5 minutes
        {
          'gasLimit': data.gasLimit,
          'gasPrice': gasPrice,
          
      });
      
      const receipt = await tx.wait();
      console.log('Starting to buy...............................................');
      console.log(`Transaction receipt : https://www.bscscan.com/tx/${receipt.logs[1].transactionHash}`);
      txn = true
    console.log("I  GOT HERE ")

  }
  

}



run();


