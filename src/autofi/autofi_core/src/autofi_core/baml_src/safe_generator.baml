function Generate(messages: string, summary: string?) -> string {
    // This function generates the system prompt for the Generator.
    client AegisGPT4oCreative

    prompt #"
    You are the Generator serving the "Aegis Agents" system. Working with other "Workers", your task is to respond to user inquiries based on the context provided in the conversation.

    Background:

    - "Aegis Agents": An AI agent system specializing in Web3 and crypto domains, helping users via the Telegram client.
      Aegis has already implemented the following feature:
      - Safe Wallet Helper: An AI agent that helps users subscribe to Safe Wallet (previously known as Gnosis Safe), ensuring they are promptly notified via Telegram when transactions or signing requests occur on their subscribed wallets, enabling users to verify that the transaction data matches their expectations.

    - "Workers": Workers are specialized agents capable of handling specific tasks. Currently available workers are:
      - AegisSafeWalletAgent: Handles requests related to Safe Wallet. Responsibilities include:
        - Introducing multisig wallet technology and the features of Safe Wallet, answering users' questions about Safe Wallet, and advising users on best practices for securely using Safe Wallet.
        - Assisting users in subscribing to or unsubscribing from Safe Wallet notifications. Once subscribed, users will receive timely Telegram notifications from Aegis when a transaction or signing request occurs in their Safe Global account.
        - Assisting users in adding whitelisted addresses. (In Aegis Safe notifications: Addresses that are not whitelisted will have a warning emoji ⚠️ suffix, and whitelisted addresses will have a green check emoji ✅ suffix.)

      - Generator: You, the special worker responsible for generating the final response for the user. Responses from other workers will not be sent directly to users; instead, the Generator processes these responses and creates a unified final message.

      - Supervisor: The supervisor is responsible for managing the overall conversation and ensuring that the correct worker is assigned to each user query. The supervisor will not be directly involved in the conversation but will oversee the interactions between users and workers.

    Your Responsibilities:

    1. Maintain your identity as "Aegis Agents" and never reveal your role or that of the other workers. You are the user's crypto companion.
    2. In the conversation, it's possible that other workers may have already addressed user inquiries by performing tasks and reporting back information or the status of their work(please note that any responses or data provided by these workers are not visible to the user; interacting with the user is solely your responsibility). Please make effective use of this information to organize your responses.
    3. If a user's question is unclear and no worker has effectively responded, ask clarifying questions to ensure you can provide the best possible response.
    4. If the user's request exceeds the capabilities of you and the other worker partners in the "Aegis Agents" system, truthfully inform the user about this situation and also communicate what the "Aegis Agents" system is capable of doing.
    5. Aim to be concise, helpful, and professional in all interactions.
    6. As a context, you are an agent from "Aegis Agents", an AI agent system developed by Aegis, designed to assist users in navigating the world of crypto and providing improved usability for web3 and DeFi.

    Conversation:

    ---
    {{ messages }}
    ---

    {% if summary %}

    Summary of Historical Conversation (While this summary may provide additional context, your decisions should primarily be based on the content of the current conversation):

    ---

    {{ summary }}

    ---

    {% endif %}

    {{ ctx.output_format }}
  "#
}

test TestGenerateSubscriptionResponse {
    functions [Generate]
    args {
        messages #"
            User: Hi Aegis! I'd like to subscribe to notifications for my Safe Wallet. How do I set that up?

            AegisSafeWalletAgent: I've processed the user's request for Safe Wallet subscription. The user needs to provide their Safe Wallet address to complete the subscription process. They should also be informed about the types of notifications they'll receive (transaction proposals, execution confirmations) and how they'll appear in Telegram.
        "#
        summary #"
            This is the user's first interaction with Aegis Agents. They previously mentioned being new to multisig wallets but having set up a Safe Wallet recently for their DAO treasury management.
        "#
    }
}

test TestGenerateTechnicalResponse {
    functions [Generate]
    args {
        messages #"
            User: I received a notification about a pending transaction in my Safe Wallet. The data field shows "0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc454e4438f44e0000000000000000000000000000000000000000000000056bc75e2d63100000". What does this mean and should I approve it?

            AegisSafeWalletAgent: I've analyzed the transaction data the user provided. This is an ERC-20 token transfer transaction. The function signature "0xa9059cbb" corresponds to the "transfer" function. The recipient address is "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" and the amount is 100 tokens (assuming 18 decimals, as the hex value decodes to 100000000000000000000). The recipient address is not currently whitelisted in the user's settings, which is why they received a notification with a warning symbol. I've verified this is a standard token transfer with no suspicious parameters.
        "#
        summary #"
            The user has been using Aegis for Safe Wallet notifications for approximately 3 weeks. They are part of a 3/5 multisig setup for their project and are generally cautious about approving transactions. They've previously asked questions about how to interpret transaction data and have whitelisted two exchange addresses in the past.
        "#
    }
}

test TestGenerateBeyondCapabilities {
    functions [Generate]
    args {
        messages #"
            User: Can Aegis automatically execute transactions on my Safe Wallet when ETH price drops below $2000? I want to set up automatic buy orders through my multisig.

            AegisSafeWalletAgent: I've reviewed the user's request for automatic transaction execution based on ETH price triggers. This functionality is beyond our current capabilities. Aegis can only provide notifications about existing transactions in Safe Wallet, not create or execute transactions automatically. Additionally, price-triggered actions would require integration with price oracles and automated execution systems, which we don't currently support. The user should be informed about what Aegis can actually do regarding Safe Wallet notifications.
        "#
        summary #"
            The user has been actively using Aegis for Safe Wallet notifications for about 2 months. They've previously asked about various advanced features and automation possibilities. They manage multiple Safe Wallets for different purposes, including personal funds and a small investment DAO.
        "#
    }
}

test TestGenerateWhitelistingConfirmation {
    functions [Generate]
    args {
        messages #"
            User: I want to whitelist my Binance deposit address so I don't get warning symbols every time we send funds there from our multisig.

            AegisSafeWalletAgent: I've processed the user's request to whitelist an address. However, they need to provide the specific Binance deposit address they want to whitelist. Once they provide this address, we can add it to their whitelist so future notifications involving this address will show a green checkmark (✅) instead of a warning symbol (⚠️).

            User: The address is 0x89e51fA8CA5D66cd220bAed62ED01e8951aa7c40

            AegisSafeWalletAgent: I've successfully added the address 0x89e51fA8CA5D66cd220bAed62ED01e8951aa7c40 to the user's whitelist. This address has been labeled as "Binance Deposit" in their settings. Future Safe Wallet notifications involving this address will now display a green checkmark (✅) instead of a warning symbol (⚠️). The change is effective immediately for all new notifications.
        "#
        summary #"
            The user manages a community treasury using a Safe Wallet and frequently transfers funds to exchanges. They've previously whitelisted several other addresses and are familiar with the notification system. They generally prefer to keep their whitelist well-maintained to reduce false alarms.
        "#
    }
}

test TestGenerateEducationalContent {
    functions [Generate]
    args {
        messages #"
            User: Can you explain how multisig security works in Safe Wallet? I'm trying to decide how many signers and what threshold to use for our team treasury.

            AegisSafeWalletAgent: I've reviewed the user's question about multisig security in Safe Wallet. They're specifically asking about signer configuration and thresholds. The user should be informed about:

            1. The security model of M-of-N multisig (where M signers out of N total signers must approve)
            2. Common configurations (2/3, 3/5, etc.) and their security/convenience tradeoffs
            3. Best practices for different use cases (small team vs large organization)
            4. Key management recommendations for signers
            5. Recovery considerations if signers lose access

            The response should be educational in nature, helping them make an informed decision based on their team treasury needs.
        "#
        summary #"
            The user is new to Safe Wallet but has been exploring various web3 security options. They're setting up a treasury for a team of 7 people working on a new DeFi project. They've previously asked about hardware wallet integration with Safe Wallet.
        "#
    }
}
