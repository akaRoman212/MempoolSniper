var Web3 = require("web3");
var url = "wss://speedy-nodes-nyc.moralis.io/b6905c301ad6187a708272d7/bsc/mainnet/ws";

var options = {
  timeout: 30000,
  clientConfig: {
    maxReceivedFrameSize: 100000000,
    maxReceivedMessageSize: 100000000,
  },
  reconnect: {
    auto: true,
    delay: 5000,
    maxAttempts: 15,
    onTimeout: false,
  },
};

var web3 = new Web3(new Web3.providers.WebsocketProvider(url, options));
const subscription = web3.eth.subscribe("pendingTransactions", (err, res) => {
  if (err) console.error(err);
});

var init = function () {
  subscription.on("data", (txHash) => {
    console.log(txHash)
    setTimeout(async () => {
      try {
        let tx = await web3.eth.getTransaction(txHash);
        
      } catch (err) {
        console.error(err);
      }
    });
  });
};

init();