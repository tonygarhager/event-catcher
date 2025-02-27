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
            console.log("waiting...");
        } else {
            try {
                console.log(`delay = ${latestBlock - currentBlock}`);
                console.log(`⛓ Processing Block #${currentBlock}`);

                // Fetch block with transactions
                const block = await provider.getBlock(currentBlock);
                if (!block || !block.transactions) {
                    console.log(`❌ Block #${currentBlock} not found or no transactions`);
                    currentBlock++;
                    continue;
                }
                /*
                const filteredTxs = block.transactions.filter(tx =>
                    (tx.address.toLowerCase() === TOKEN_ADDR.toLowerCase())
                );
                */
                // Process each transaction in the block
                for (let txHash of block.transactions) {
                    try {
                        // Get transaction receipt (to check events)
                        const receipt = await provider.getTransactionReceipt(txHash);
                        if (receipt && receipt.logs.length > 0) {
                            let first = true;
                            // Enumerate all events (logs)
                            receipt.logs.forEach((log) => {
                                try {
                                    // Check if the log is from the token contract
                                    if (log.address.toLowerCase() === TOKEN_ADDR.toLowerCase()) {
                                        // Parse the log with contract interface
                                        const parsedLog = contractInterface.parseLog(log);

                                        // Check if the event is a Transfer event
                                        if (parsedLog.name === "Transfer") {
                                            if (first) {
                                                console.log(`🔍 Tx Hash: ${txHash}`);
                                                first = false;
                                            }
                                            console.log(`📢 Transfer Event Detected:`);
                                            console.log(`   - From: ${parsedLog.args.from}`);
                                            console.log(`   - To: ${parsedLog.args.to}`);
                                            console.log(`   - Value: ${ethers.formatUnits(parsedLog.args.value, 6)} USDT`);
                                            console.log(`   - Contract Address: ${log.address}`);
                                            console.log("--------------------------------------");
                                        }
                                    }
                                } catch (error) {
                                    console.log("⚠️ Could not decode log event");
                                }
                            });
                        }
                    } catch (error) {
                        console.error(`❌ Error fetching tx receipt for ${txHash}: ${error.message}`);
                    }
                }

                // Move to the next block
                currentBlock++;
            } catch (error) {
                console.error(`❌ Error fetching block #${currentBlock}: ${error.message}`);
                break; // Exit loop in case of critical error
            }
        }
    }
}
checkBlocksFrom(START_BLOCK_INDEX); 
