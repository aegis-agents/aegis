// Define the possible route options
enum NextStep {
  AegisSafeWalletAgent // For handling requests related to Safe Wallet
  Generator // For generating the final response
}

// Define the router function
function RouteRequest(messages: string, summary: string?) -> NextStep {
  client AegisFallback

  prompt #"
    You are a supervisor serving the "Aegis Agents" system, tasked with managing a conversation between "Workers".

    Background:

    - "Aegis Agents": An AI agent system specializing in Web3 and crypto domains, helping users via the Telegram client.
      Aegis has already implemented the following feature:
      - Safe Wallet Helper: An AI agent that helps users subscribe to Safe Wallet (previously known as Gnosis Safe), ensuring they are promptly notified via Telegram when transactions or signing requests occur on their subscribed wallets, enabling users to verify that the transaction data matches their expectations.

    - "Workers": Workers are specialized agents capable of handling specific tasks. Currently available workers are:
      - AegisSafeWalletAgent: Handles requests related to Safe Wallet. Responsibilities include:
        - Introducing multisig wallet technology and the features of Safe Wallet, answering users' questions about Safe Wallet, and advising users on best practices for securely using Safe Wallet.
        - Assisting users in subscribing to or unsubscribing from Safe Wallet notifications. Once subscribed, users will receive timely Telegram notifications from Aegis when a transaction or signing request occurs in their Safe Global account.
        - Assisting users in adding whitelisted addresses. (In Aegis Safe notifications: Addresses that are not whitelisted will have a warning emoji ⚠️ suffix, and whitelisted addresses will have a green check emoji ✅ suffix.)

      - Generator: A special worker responsible for generating the final response for the user. Responses from other workers will not be sent directly to users; instead, the Generator processes these responses and creates a unified final message.

      - Supervisor: You, the supervisor, who manages the conversation and assigns tasks to the appropriate workers.

    Your Responsibilities:

    1. Act as a supervisor, assigning tasks to appropriate workers to resolve user issues.
    2. Each worker has specific capabilities. Based on the user's request, assign the appropriate worker to handle the issue. The assigned worker will execute the task based on the conversation and return their results within the conversation.
    3. When you determine:
        a. The information provided by workers is sufficient to resolve the user's issue, or
        b. There is no suitable worker available to handle the user's request,
       you must assign the task to the Generator (the special worker) to generate a final response for the user.

    User Message:
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


test TestSafeWalletSubscription {
    functions [RouteRequest]
    args {
        messages #"
            User: Hello! I have a Safe Wallet and I'd like to receive notifications when there are new transactions to sign. Can Aegis help me with that?
        "#
        summary #"
            The user is new to the system and has previously asked general questions about what Aegis can do. They mentioned owning some crypto assets and using multisig wallets.
        "#
    }
    @@assert( {{ this == "AegisSafeWalletAgent" }})
}

test TestSafeWalletQuestions {
    functions [RouteRequest]
    args {
        messages #"
            User: Can you explain how the Safe Wallet multisig works? I'm confused about the threshold concept and how many people need to sign transactions.
        "#
        summary #"
            The user recently subscribed to Safe Wallet notifications through Aegis. They have a 2/3 multisig setup but haven't used it much yet.
        "#
    }
    @@assert( {{ this == "AegisSafeWalletAgent" }})
}

test TestAddressWhitelisting {
    functions [RouteRequest]
    args {
        messages #"
            User: I keep getting notifications with ⚠️ next to an address, but it's actually my exchange deposit address. How can I whitelist it so it shows a ✅ instead?

            Assistant: I'll help you whitelist that address. Could you please provide the address you'd like to whitelist?

            User: Yes, the address is 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
        "#
        summary #"
            The user has been subscribed to Safe Wallet notifications for about 2 weeks. They frequently interact with exchanges and have reported receiving many notifications with warning symbols.
        "#
    }
    @@assert( {{ this == "AegisSafeWalletAgent" }})
}

test TestUnsubscribeRequest {
    functions [RouteRequest]
    args {
        messages #"
            User: I'm getting too many notifications from my Safe Wallet. I want to unsubscribe from one of my wallets.

            Assistant: I understand you'd like to unsubscribe from notifications for one of your Safe Wallets. Could you please provide the address of the Safe Wallet you'd like to unsubscribe from?

            User: Yes, I want to stop notifications for 0x1234567890123456789012345678901234567890
        "#
        summary #"
            The user has multiple Safe Wallets subscribed (at least 3). They previously complained about receiving too many notifications but didn't take action at that time.
        "#
    }
    @@assert( {{ this == "AegisSafeWalletAgent" }})
}

test TestNonSafeWalletQuestion {
    functions [RouteRequest]
    args {
        messages #"
            User: What is the current price of Ethereum? Has it been going up lately?
        "#
        summary #"
            The user has a Safe Wallet subscription but frequently asks about market conditions and general crypto questions.
        "#
    }
    @@assert( {{ this == "Generator" }})
}

test TestMixedQuery {
    functions [RouteRequest]
    args {
        messages #"
            User: I'm wondering if I should move my ETH to a Safe Wallet. Are there any transaction fees for setting it up? Also, would I get notifications from Aegis if someone tries to send tokens from the wallet?
        "#
        summary #"
            The user is new to Safe Wallet but has been using other crypto services. They previously asked about security features for different wallet types.
        "#
    }
    @@assert( {{ this == "AegisSafeWalletAgent" }})
}

test TestTransactionVerification {
    functions [RouteRequest]
    args {
        messages #"
            User: I just got a notification from Aegis about a pending transaction in my Safe Wallet. The transaction data has a function signature "0xa9059cbb" - what does this mean? Is it sending tokens somewhere?

            Assistant: I see you received a notification about a pending transaction. The function signature "0xa9059cbb" is indeed for an ERC-20 token transfer. Would you like me to help you decode more details about this transaction?

            User: Yes please, I want to make sure it's legitimate before I approve it.
        "#
        summary #"
            The user has been using Aegis notifications for Safe Wallet for about a month. They're security-conscious and always verify transactions carefully before signing.
        "#
    }
    @@assert( {{ this == "AegisSafeWalletAgent" }})
}

test TestFollowupAfterSubscription {
    functions [RouteRequest]
    args {
        messages #"
            User: I subscribed to notifications for my Safe Wallet yesterday. How can I test if it's working properly?

            Assistant: To test if your Safe Wallet notifications are working properly, you could create a small test transaction in your Safe Wallet. Would you like guidance on how to do that?

            User: Yes, that would be helpful. I'm not very familiar with creating test transactions.
        "#
        summary #"
            The user successfully subscribed to Safe Wallet notifications yesterday using Aegis. This is their first time using a multisig wallet system.
        "#
    }
    @@assert( {{ this == "AegisSafeWalletAgent" }})
}

test TestComplexMultiPartQuery {
    functions [RouteRequest]
    args {
        messages #"
            User: I have three questions: 1) How do I add a new owner to my Safe Wallet? 2) Will I get notifications when ownership changes? 3) What's the best practice for key management with multisig wallets?
        "#
        summary #"
            The user manages a DAO treasury using Safe Wallet and has been subscribed to notifications for about 3 months. They recently onboarded new team members who need access to the treasury.
        "#
    }
    @@assert( {{ this == "AegisSafeWalletAgent" }})
}

test TestCompletionAfterWorkerResponse {
    functions [RouteRequest]
    args {
        messages #"
            User: How do I update my notification preferences for my Safe Wallet?

            Assistant: To update your notification preferences for Safe Wallet through Aegis, I'll need to know what specific changes you'd like to make. Would you like to:
            1. Change which events trigger notifications
            2. Adjust how notifications are delivered
            3. Something else?

            User: I only want to receive notifications for transactions above 1 ETH in value. Is that possible?

            AegisSafeWalletAgent: I've checked our notification capabilities. Currently, Aegis sends notifications for all transaction signing requests regardless of value. We don't yet support value-based filtering. However, I can offer you these alternatives:
            1. Continue receiving all notifications
            2. Unsubscribe completely from this Safe Wallet
            3. We can add this to our feature request list

            Would any of these options work for you?
        "#
        summary #"
            The user manages multiple Safe Wallets with varying levels of activity. They've previously mentioned that some wallets have many small transactions that aren't important to them.
        "#
    }
    @@assert( {{ this == "Generator" }})
}
