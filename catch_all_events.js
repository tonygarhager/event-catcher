require("dotenv").config();
const { ethers } = require("ethers");
//const { MongoClient } = require("mongodb");

// Load environment variables
const WS_URL = process.env.WS_URL;
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
function createProvider() {
    return new ethers.WebSocketProvider(WS_URL);
}

// Start watching new blocks
async function watchBlocks() {
    console.log("🔗 Connecting to Ethereum WebSocket...");

    let provider = createProvider();
    // const dburi = "mongodb+srv://tonygarhager:kkndkknd823@cluster0.k3tc3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
    // const dbClient = new MongoClient(dburi);
    // await dbClient.connect();
    
    // Listen for new blocks
    provider.on("block", async (blockNumber) => {
        console.log(`⛓  New Block: #${blockNumber}`);

        // Fetch block details
        const block = await provider.getBlock(blockNumber, true);
        if (!block) return;

        // Process each transaction in the block
        for (let tx of block.transactions) {
            try {
                if (tx) {
                    // Get transaction receipt (to check events)
                    const receipt = await provider.getTransactionReceipt(tx);
                    if (receipt && receipt.logs.length > 0) {
                        
                        let first = true;

                        // Enumerate all events (logs)
                        receipt.logs.forEach((log, index) => {
                            if (log.address.toLowerCase() === TOKEN_ADDR.toLowerCase()) {
                                try {

                                    const parsedLog = contractInterface.parseLog(log);
                                    
                                    if (first) {
                                        console.log(`🔍 Tx Hash: ${tx}`);
                                        first = false;
                                    }
                                    console.log(`📢 Event: ${parsedLog.name}`);
                                    console.log(`   - From: ${parsedLog.args.from}`);
                                    console.log(`   - To: ${parsedLog.args.to}`);
                                    console.log(`   - Value: ${ethers.formatUnits(parsedLog.args.value, 6)} USDT`);

                                    // console.log(`   - Contract Address: ${log.address}`);
                                    // console.log(`   - Topics: ${JSON.stringify(log.topics)}`);
                                    // console.log(`   - Data: ${log.data}`);
                                    console.log("--------------------------------------");
                                } catch (error) {
                                    /*console.log(`📢 Event: ${log.index + 1}`);
                                    console.log(`   - Contract Address: ${log.address}`);
                                    console.log(`   - Topics: ${JSON.stringify(log.topics)}`);
                                    console.log(`   - Data: ${log.data}`);
                                    console.log("--------------------------------------");
                                    */
                                }
                            }
                    });
                    }
                }
            } catch (error) {
                console.error(`❌ Error fetching tx receipt for ${tx.hash}: ${error.message}`);
            }
        }
    });

    // Handle WebSocket disconnects
    provider.websocket.on("close", () => {
        console.error("❌ WebSocket disconnected! Reconnecting...");
        setTimeout(() => {
            provider.removeAllListeners(); // Remove old listeners
            watchBlocks(); // Restart connection
        }, 5000);
    });

    provider.websocket.on("error", (error) => {
        console.error("❌ WebSocket error:", error.message);
    });

    console.log("🎧 Watching Ethereum blocks & events...");
}

// Start watching
watchBlocks();
