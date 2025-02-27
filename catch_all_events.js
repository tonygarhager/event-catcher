require("dotenv").config();
const { ethers } = require("ethers");
//const { MongoClient } = require("mongodb");

// Load environment variables
const RPC_URL = process.env.RPC_URL;
const CONTRACT_ABI = [
    "event Transfer(address indexed from, address indexed to, uint value)",
    // "event Approval(address indexed owner, address indexed spender, uint value)",
    // "event Pause()",
    // "event Unpause()",
    // "event DestroyedBlackFunds(address _blackListedUser, uint _balance)",
    // "event AddedBlackList(address _user)",
    // "event RemovedBlackList(address _user)",
    // "event Issue(uint amount)",
    // "event Redeem(uint amount)",
    // "event Deprecate(address newAddress)",
    // "event Params(uint feeBasisPoints, uint maxFee)"
];

const TOKEN_ADDR = process.env.TOKEN_ADDRESS;

// Create an Interface for decoding USDT events
const contractInterface = new ethers.Interface(CONTRACT_ABI);

// Function to create WebSocket provider (handles auto-reconnect)
const provider = new ethers.JsonRpcProvider(RPC_URL);
let START_BLOCK_INDEX = process.env.LAST_BLOCK_INDEX;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkBlocksFrom(startBlockIndex) {
    if (startBlockIndex == undefined)
        startBlockIndex = await provider.getBlockNumber();
    console.log(`⛓ Checking blocks starting from #${startBlockIndex} for events...`);

    let currentBlock = startBlockIndex;
    
    // Loop through each block until the latest block
    while (true) {

        const latestBlock = await provider.getBlockNumber(); // Get latest block number
        if (currentBlock > latestBlock) {
            await sleep(100);
        } else {
            try {
                const logs = await provider.getLogs({
                    fromBlock: currentBlock,
                    toBlock: currentBlock,
                    address: TOKEN_ADDR,
                    topics: [
                        ethers.id("Transfer(address,address,uint256)")
                    ]
                });

                console.log(`delay = ${latestBlock - currentBlock}`);
                console.log(`⛓ Processing Block #${currentBlock}`);

                logs.forEach(log => {
                    const parsedLog = contractInterface.parseLog(log);
                    
                    // Extract 'from' and 'to' addresses from the parsed log
                    const fromAddress = parsedLog.args.from;
                    const toAddress = parsedLog.args.to;
                    const value = ethers.formatUnits(parsedLog.args.value, 6);  // Format for USDT (6 decimals)
                    
                    console.log(`📢 Transfer Event Detected:`);
                    console.log(`   - From: ${fromAddress}`);
                    console.log(`   - To: ${toAddress}`);
                    console.log(`   - Value: ${value} USDT`);
                    console.log("--------------------------------------");
                });

                currentBlock++;
            } catch (error) {
                console.error(`❌ Error fetching block #${currentBlock}: ${error.message}`);
                //console.log(`Attempt ${attempt + 1} failed, retrying in ${retryTimeout / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, 1000));  // Delay before retry
            
                //break; // Exit loop in case of critical error
            }
        }
    }
}
checkBlocksFrom(START_BLOCK_INDEX); 
