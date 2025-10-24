// Define SummarizeMessageHistory
// This function shortens the conversation history to save on LLM tokens
function SummarizeMessageHistory(messages: string, summary: string?) -> string {
  // Specifies the client to use for the LLM call.
  client AegisGPT4oCreative

  // Prompt definition using BAML's syntax
  prompt #"
    You are an expert summarization engine. Your goal is to provide a clear and concise summary of the given message history.

    Conversation:
    ---

    {{ messages }}

    ---

    {% if summary %}
    This is the existing summary of the history conversation up to date, extend it with the new messages above.

    Existing summary:

    ---

    {{ summary }}

    ---

    {% else %}

    Create a new summary of the conversation based on the messages above.

    {% endif %}
  "#
}


// Test cases for the SummarizeMessageHistory function

test SummarizeTest {
  functions [SummarizeMessageHistory]
  args {
    messages #"
      User: Hi there! I recently started using Safe Wallet and I'd like to set up notifications for my accounts.

      Assistant: Hello! I'd be happy to help you set up notifications for your Safe Wallet accounts. Safe Global (previously Gnosis Safe) offers various notification options. What specific activities would you like to be notified about?

      User: I'm primarily interested in monitoring when transactions are proposed on my multisig wallets. I have three different Safe accounts that I manage.

      Assistant: That's a great use case for notifications. You can subscribe to receive alerts whenever a new transaction is proposed on any of your multisig wallets. Would you like information on how to set this up through the Safe interface or are you looking to implement this programmatically?

      User: I'd like to do it through the interface first, but I'm also curious about the API options for later. Also, is there a way to filter notifications to only show token transfers?

      Assistant: Absolutely! For the interface setup, you can go to your Safe dashboard, select the account you want to monitor, go to Settings > Notifications, and enable transaction proposal alerts.

      As for filtering specifically for token transfers, you can examine the transaction data in the multisig. Token transfers will have specific method signatures and data patterns in the transaction payload. The data field will contain information about the token contract address, recipient address, and amount.

      If you're interested in the API approach, Safe Global offers a Transaction Service API that allows you to programmatically monitor and filter transactions. Would you like more details on how to identify token transfers in the transaction data?

      User: Yes, please! How can I tell if a proposed transaction in my Safe wallet is specifically for token transfers by looking at the data?

      Assistant: Great question! When examining multisig transaction data in Safe, you can identify token transfers by looking at these specific elements:

      1. For ERC-20 token transfers:
         - The "to" address will be the token contract address
         - The function signature in the data field will start with "0xa9059cbb" (for transfer) or "0x23b872dd" (for transferFrom)
         - The data field will contain the recipient address and amount encoded

      2. For native ETH transfers:
         - The data field will be empty (0x)
         - There will be a value field with the amount of ETH to transfer

      3. For ERC-721 NFT transfers:
         - Look for function signatures like "0x23b872dd" (transferFrom) or "0x42842e0e" (safeTransferFrom)
         - The data will include token ID information

      You can use Safe's transaction decoder in the UI to help interpret this data without having to decode the hex manually. Is there a specific type of token transfer you're monitoring for?
    "#
    summary #""#
  }
}

test SummarizeTest2 {
  functions [SummarizeMessageHistory]
  args {
    messages #"
      User: I'm mostly interested in ERC-20 transfers for now. I need to monitor when someone proposes large transfers of our treasury tokens. Can I set up notifications specifically for transactions that match those function signatures you mentioned?

      Assistant: Yes, you can set up specific monitoring for large ERC-20 treasury transfers, though you'll need a combination of Safe's notification system and some custom filtering. Here's how:

      1. First, enable general transaction proposal notifications through the Safe interface

      2. For targeted monitoring of large ERC-20 transfers specifically:
         - Use the Safe Transaction Service API to programmatically check new proposals
         - Filter transactions where the "to" field is your treasury token contract address
         - Look for the "0xa9059cbb" function signature in the data field
         - Decode the amount parameter to identify large transfers

      You could build a simple script that:
      - Polls the Safe API periodically
      - Decodes the transaction data
      - Alerts you when it finds proposals matching your criteria

      Would you like me to outline a basic structure for such a monitoring script?

      User: Yes, that would be great! And what API endpoint should I use to get pending transactions for my Safe wallets?

      Assistant: Here's a basic structure for a monitoring script and the relevant API endpoint information:

      To get pending transactions for your Safe wallets, you'll use the Safe Transaction Service API endpoint:
      ```
      GET https://safe-transaction-mainnet.safe.global/api/v1/safes/{safeAddress}/multisig-transactions/
      ```

      Replace `{safeAddress}` with your actual Safe address. You can also filter by adding query parameters like `?executed=false` to only get pending transactions.

      Here's a basic Python script structure to monitor for large ERC-20 transfers:

      ```python
      import requests
      import time
      from web3 import Web3
      from decimal import Decimal

      # Configuration
      SAFE_ADDRESSES = ["0xYourSafe1Address", "0xYourSafe2Address", "0xYourSafe3Address"]
      TOKEN_ADDRESS = "0xYourTreasuryTokenAddress"
      TRANSFER_SIGNATURE = "0xa9059cbb"  # ERC-20 transfer signature
      THRESHOLD_AMOUNT = Decimal("1000")  # Set your threshold amount
      TOKEN_DECIMALS = 18  # Most ERC-20 tokens use 18 decimals

      # API base URL
      API_BASE = "https://safe-transaction-mainnet.safe.global/api/v1"

      def get_pending_transactions(safe_address):
          url = f"{API_BASE}/safes/{safe_address}/multisig-transactions/?executed=false"
          response = requests.get(url)
          return response.json()["results"] if response.status_code == 200 else []

      def is_large_token_transfer(tx):
          # Check if it's a token transfer transaction
          if tx["to"] != TOKEN_ADDRESS:
              return False

          # Check for transfer function signature
          data = tx["data"]
          if not data.startswith(TRANSFER_SIGNATURE):
              return False

          # Decode recipient address and amount
          # Remove function signature (first 10 characters including 0x)
          data = data[10:]

          # Recipient is the first parameter (32 bytes)
          # Amount is the second parameter (32 bytes)
          amount_hex = "0x" + data[64:128]
          amount = Decimal(int(amount_hex, 16)) / Decimal(10**TOKEN_DECIMALS)

          return amount >= THRESHOLD_AMOUNT

      def monitor_safes():
          while True:
              for safe_address in SAFE_ADDRESSES:
                  txs = get_pending_transactions(safe_address)
                  for tx in txs:
                      if is_large_token_transfer(tx):
                          print(f"ALERT: Large transfer of {tx['value']} tokens detected in Safe {safe_address}")
                          print(f"Transaction details: {tx['safeTxHash']}")
                          # Here you could send an email, Slack notification, etc.

              # Check every 5 minutes
              time.sleep(300)

      if __name__ == "__main__":
          monitor_safes()
      ```

      This script:
      1. Polls the Safe Transaction Service API for pending transactions
      2. Checks if they match your criteria for large token transfers
      3. Alerts when matching transactions are found

      You'd need to:
      - Install dependencies (`pip install requests web3`)
      - Replace the placeholder addresses with your actual Safe and token addresses
      - Adjust the threshold amount and token decimals based on your needs
      - Implement your preferred notification method (email, SMS, etc.)

      Would you like me to explain any part of this script in more detail?

      User: This is really helpful. One quick question - I noticed in the script that you're checking if "to" equals the token address. But wouldn't the "to" in the Safe transaction be the token contract address, and then the actual recipient is encoded in the data field? Can you clarify this?

      Assistant: You're absolutely right, and that's an important clarification. I made an error in my example script. Let me correct it:

      In ERC-20 token transfers:
      1. The `to` field in the Safe transaction points to the token contract address
      2. The actual recipient address is encoded as the first parameter in the data field
      3. The amount is encoded as the second parameter in the data field

      Here's the corrected function:

      ```python
      def is_large_token_transfer(tx):
          # Check if it's a transaction to the token contract
          if tx["to"].lower() != TOKEN_ADDRESS.lower():
              return False

          # Check data field exists and has sufficient length
          data = tx.get("data", "")
          if not data or len(data) < 138:  # 0x + 8 bytes function sig + 64 bytes address + 64 bytes amount
              return False

          # Check for transfer function signature
          if not data.startswith(TRANSFER_SIGNATURE):
              return False

          # Decode amount (second parameter)
          # Remove function signature (first 10 characters including 0x)
          data = data[10:]

          # Amount is the second parameter (32 bytes, positions 64-128)
          amount_hex = "0x" + data[64:128]
          amount = Decimal(int(amount_hex, 16)) / Decimal(10**TOKEN_DECIMALS)

          # For debugging, you could also decode the recipient
          # recipient = "0x" + data[24:64]  # Remove leading zeros from the first parameter

          return amount >= THRESHOLD_AMOUNT
      ```

      You're correct that:
      1. The transaction's `to` field should equal the token contract address
      2. The function checks that we're interacting with the token contract
      3. The actual recipient is encoded in the data field (first parameter after the function signature)
      4. The amount is also encoded in the data field (second parameter)

      Thank you for catching that important distinction!

      User: Perfect, that makes sense. I think I need to test this with some real transaction data. Is there an easy way to get an example of the raw transaction data from a Safe multisig transaction that's transferring ERC-20 tokens?
    "#
    summary #"The user is seeking assistance in setting up notifications for their Safe Wallet, specifically for when transactions are proposed on their multisig wallets. They manage three Safe accounts and are interested in both using the Safe interface and exploring API options. The assistant explains how to enable transaction proposal alerts through the Safe interface and describes how to identify token transfers in transaction data. For ERC-20 transfers, the data field will include specific function signatures and encoded recipient and amount information. Native ETH transfers will have an empty data field and a value field, while ERC-721 transfers have different function signatures and include token ID information. The assistant also mentions Safe's transaction decoder tool for easier interpretation."#
  }
}