import { MultiServerMCPClient } from "@langchain/mcp-adapters";

let blockscoutMcpClient: MultiServerMCPClient | null = null;
export const getBlockscoutMcpClient = () => {
  if (!blockscoutMcpClient) {
    blockscoutMcpClient = new MultiServerMCPClient({
      mcpServers: {
        blockscout: {
          url: "https://mcp.blockscout.com/mcp",
          transport: "http",
        },
      },
    });
  }
  return blockscoutMcpClient;
};

export const blockscoutTools = [
  "- [__unlock_blockchain_analysis__]:Unlocks access to other MCP tools.\n" +
    "\n" +
    '    All tools remain locked with a "Session Not Initialized" error until this\n' +
    "    function is successfully called. Skipping this explicit initialization step\n" +
    "    will cause all subsequent tool calls to fail.\n" +
    "\n" +
    "    MANDATORY FOR AI AGENTS: The returned instructions contain ESSENTIAL rules\n" +
    "    that MUST govern ALL blockchain data interactions. Failure to integrate these\n" +
    "    rules will result in incorrect data retrieval, tool failures and invalid\n" +
    "    responses. Always apply these guidelines when planning queries, processing\n" +
    "    responses or recommending blockchain actions.\n" +
    "\n" +
    "    COMPREHENSIVE DATA SOURCES: Provides an extensive catalog of specialized\n" +
    "    blockchain endpoints to unlock sophisticated, multi-dimensional blockchain\n" +
    "    investigations across all supported networks.\n" +
    "    \n",
  "- [get_block_info]:\n" +
    "    Get block information like timestamp, gas used, burnt fees, transaction count etc.\n" +
    "    Can optionally include the list of transaction hashes contained in the block. Transaction hashes are omitted by default; request them only when you truly need them, because on high-traffic chains the list may exhaust the context.\n" +
    "    \n",
  "- [get_latest_block]:\n" +
    "    Get the latest indexed block number and timestamp, which represents the most recent state of the blockchain.\n" +
    "    No transactions or token transfers can exist beyond this point, making it useful as a reference timestamp for other API calls.\n" +
    "    \n",
  "- [get_address_by_ens_name]:\n" + '    Useful for when you need to convert an ENS domain name (e.g. "blockscout.eth")\n' + "    to its corresponding Ethereum address.\n" + "    \n",
  "- [get_transactions_by_address]:\n" +
    "    Retrieves native currency transfers and smart contract interactions (calls, internal txs) for an address.\n" +
    "    **EXCLUDES TOKEN TRANSFERS**: Filters out direct token balance changes (ERC-20, etc.). You'll see calls *to* token contracts, but not the `Transfer` events. For token history, use `get_token_transfers_by_address`.\n" +
    "    A single tx can have multiple records from internal calls; use `internal_transaction_index` for execution order.\n" +
    "    Use cases:\n" +
    "      - `get_transactions_by_address(address, age_from)` - get all txs to/from the address since a given date.\n" +
    "      - `get_transactions_by_address(address, age_from, age_to)` - get all txs to/from the address between given dates.\n" +
    "      - `get_transactions_by_address(address, age_from, age_to, methods)` - get all txs to/from the address between given dates, filtered by method.\n" +
    "    **SUPPORTS PAGINATION**: If response includes 'pagination' field, use the provided next_call to get additional pages.\n" +
    "    \n",
  "- [get_token_transfers_by_address]:\n" +
    "    Get ERC-20 token transfers for an address within a specific time range.\n" +
    "    Use cases:\n" +
    "      - `get_token_transfers_by_address(address, age_from)` - get all transfers of any ERC-20 token to/from the address since the given date up to the current time\n" +
    "      - `get_token_transfers_by_address(address, age_from, age_to)` - get all transfers of any ERC-20 token to/from the address between the given dates\n" +
    "      - `get_token_transfers_by_address(address, age_from, age_to, token)` - get all transfers of the given ERC-20 token to/from the address between the given dates\n" +
    "    **SUPPORTS PAGINATION**: If response includes 'pagination' field, use the provided next_call to get additional pages.\n" +
    "    \n",
  "- [lookup_token_by_symbol]:\n" +
    "    Search for token addresses by symbol or name. Returns multiple potential\n" +
    "    matches based on symbol or token name similarity. Only the first\n" +
    "    ``TOKEN_RESULTS_LIMIT`` matches from the Blockscout API are returned.\n" +
    "    \n",
  "- [get_contract_abi]:\n" +
    "    Get smart contract ABI (Application Binary Interface).\n" +
    "    An ABI defines all functions, events, their parameters, and return types. The ABI is required to format function calls or interpret contract data.\n" +
    "    \n",
  "- [inspect_contract_code]:Inspects a verified contract's source code or metadata.\n",
  "- [read_contract]:\n" +
    "        Calls a smart contract function (view/pure, or non-view/pure simulated via eth_call) and returns the\n" +
    "        decoded result.\n" +
    "\n" +
    "        This tool provides a direct way to query the state of a smart contract.\n" +
    "\n" +
    "        Example:\n" +
    "        To check the USDT balance of an address on Ethereum Mainnet, you would use the following arguments:\n" +
    "    {{\n" +
    '      "tool_name": "read_contract",\n' +
    '      "params": {{\n' +
    '        "chain_id": "1",\n' +
    '        "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",\n' +
    '        "abi": {{\n' +
    '          "constant": true,\n' +
    '          "inputs": [{{"name": "_owner", "type": "address"}}],\n' +
    '          "name": "balanceOf",\n' +
    '          "outputs": [{{"name": "balance", "type": "uint256"}}],\n' +
    '          "payable": false,\n' +
    '          "stateMutability": "view",\n' +
    '          "type": "function"\n' +
    "        }},\n" +
    '        "function_name": "balanceOf",\n' +
    '        "args": "["0xF977814e90dA44bFA03b6295A0616a897441aceC"]"\n' +
    "      }}\n" +
    "    }}\n" +
    "    \n",
  "- [get_address_info]:\n" +
    "    Get comprehensive information about an address, including:\n" +
    "    - Address existence check\n" +
    "    - Native token (ETH) balance (provided as is, without adjusting by decimals)\n" +
    "    - ENS name association (if any)\n" +
    "    - Contract status (whether the address is a contract, whether it is verified)\n" +
    "    - Proxy contract information (if applicable): determines if a smart contract is a proxy contract (which forwards calls to implementation contracts), including proxy type and implementation addresses\n" +
    "    - Token details (if the contract is a token): name, symbol, decimals, total supply, etc.\n" +
    "    Essential for address analysis, contract investigation, token research, and DeFi protocol analysis.\n" +
    "    \n",
  "- [get_tokens_by_address]:\n" +
    "    Get comprehensive ERC20 token holdings for an address with enriched metadata and market data.\n" +
    "    Returns detailed token information including contract details (name, symbol, decimals), market metrics (exchange rate, market cap, volume), holders count, and actual balance (provided as is, without adjusting by decimals).\n" +
    "    Essential for portfolio analysis, wallet auditing, and DeFi position tracking.\n" +
    "    **SUPPORTS PAGINATION**: If response includes 'pagination' field, use the provided next_call to get additional pages.\n" +
    "    \n",
  "- [transaction_summary]:\n" +
    "    Get human-readable transaction summaries from Blockscout Transaction Interpreter.\n" +
    "    Automatically classifies transactions into natural language descriptions (transfers, swaps, NFT sales, DeFi operations)\n" +
    "    Essential for rapid transaction comprehension, dashboard displays, and initial analysis.\n" +
    "    Note: Not all transactions can be summarized and accuracy is not guaranteed for complex patterns.\n" +
    "    \n",
  "- [nft_tokens_by_address]:\n" +
    "    Retrieve NFT tokens (ERC-721, ERC-404, ERC-1155) owned by an address, grouped by collection.\n" +
    "    Provides collection details (type, address, name, symbol, total supply, holder count) and individual token instance data (ID, name, description, external URL, metadata attributes).\n" +
    "    Essential for a detailed overview of an address's digital collectibles and their associated collection data.\n" +
    "    **SUPPORTS PAGINATION**: If response includes 'pagination' field, use the provided next_call to get additional pages.\n" +
    "    \n",
  "- [get_transaction_info]:\n" +
    "    Get comprehensive transaction information.\n" +
    "    Unlike standard eth_getTransactionByHash, this tool returns enriched data including decoded input parameters, detailed token transfers with token metadata, transaction fee breakdown (priority fees, burnt fees) and categorized transaction types.\n" +
    "    By default, the raw transaction input is omitted if a decoded version is available to save context; request it with `include_raw_input=True` only when you truly need the raw hex data.\n" +
    "    Essential for transaction analysis, debugging smart contract interactions, tracking DeFi operations.\n" +
    "    \n",
  "- [get_transaction_logs]:\n" +
    "    Get comprehensive transaction logs.\n" +
    "    Unlike standard eth_getLogs, this tool returns enriched logs, primarily focusing on decoded event parameters with their types and values (if event decoding is applicable).\n" +
    "    Essential for analyzing smart contract events, tracking token transfers, monitoring DeFi protocol interactions, debugging event emissions, and understanding complex multi-contract transaction flows.\n" +
    "    **SUPPORTS PAGINATION**: If response includes 'pagination' field, use the provided next_call to get additional pages.\n" +
    "    \n",
  "- [get_chains_list]:\n" +
    "    Get the list of known blockchain chains with their IDs.\n" +
    "    Useful for getting a chain ID when the chain name is known. This information can be used in other tools that require a chain ID to request information.\n" +
    "    \n",
  "- [direct_api_call]:Call a raw Blockscout API endpoint for advanced or chain-specific data.\n" +
    "\n" +
    "    Do not include query strings in ``endpoint_path``; pass all query parameters via\n" +
    "    ``query_params`` to avoid double-encoding.\n" +
    "\n" +
    "    **SUPPORTS PAGINATION**: If response includes 'pagination' field,\n" +
    "    use the provided next_call to get additional pages.\n" +
    "\n" +
    "    Returns:\n" +
    "        ToolResponse[Any]: Must return ToolResponse[Any] (not ToolResponse[BaseModel])\n" +
    "        because specialized handlers can return lists or other types that don't inherit\n" +
    "        from BaseModel. The dispatcher system supports flexible data structures.\n" +
    "    \n",
];
