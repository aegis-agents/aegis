import { StrategyMapping } from "../../common/constant.js";
import { formatUnits } from "../../common/helper.js";
import { getNatsConnection } from "../../common/nats.js";
import { UserAction, UserActionType } from "../../types/state.js";

export const handleUserAction = (userAction: UserAction, userId: string, requestId: string) => {
  switch (userAction.type) {
    case UserActionType.ChangeStrategy:
      return handleUpdateStrategy(userAction, userId, requestId);
    case UserActionType.Deposit:
      return handleDeposit(userAction, userId, requestId);
    case UserActionType.Withdraw:
      return handleWithdraw(userAction, userId, requestId);
    case UserActionType.ChangeSmartAccount:
      return handleChangeSmartAccount(userAction, userId, requestId);
  }
};

async function handleUpdateStrategy(userAction: UserAction, userId: string, requestId: string) {
  const [strategy, immediately_scheduling, signature] = userAction.args;
  try {
    const nats = await getNatsConnection();
    const userAssets = await nats.getUserAssets({ uid: userId, req_id: requestId, force_update: true });
    if (Number(userAssets.portfolio.smart_address_total_value_usd) <= 1) {
      return `[User Action] The user has confirmed to change the strategy to ${StrategyMapping[strategy]} but failed. Because the assets in the smart account are less than or equal to the threshold of $1.00. The current assets of smart account are $${userAssets.portfolio.smart_address_total_value_usd}.`;
    }

    await nats.updateUserStrategy({ uid: userId, req_id: requestId, strategy, immediately_scheduling: immediately_scheduling ?? false, signature: signature ?? "" });

    return `[User Action] The user has confirmed to change the strategy to ${StrategyMapping[strategy]}.`; // 0 - disable, 1 - conservative, 2 - balanced (not supported), 3 - aggressive (not supported)
  } catch (error: any) {
    return `[User Action] The user has confirmed to change the strategy to ${StrategyMapping[strategy]} but failed.
    Error:${error.toString()}.`; // 0 - disable, 1 - conservative, 2 - balanced (not supported), 3 - aggressive (not supported)
  }
}
async function handleDeposit(userAction: UserAction, userId: string, requestId: string) {
  const [amount, asset, chainId, txHash] = userAction.args;
  return `[User Action] The user has deposited ${amount} USDC on BASE (Chain ID: ${chainId}). 
  The transaction hash is [${txHash}](https://basescan.org/tx/${txHash}).`;
}

async function handleWithdraw(userAction: UserAction, userId: string, requestId: string) {
  const [chainId, tokenAddress, amount, nonce, signature] = userAction.args;
  try {
    const nats = await getNatsConnection();
    const { transaction_hash, actual_withdraw_amount } = await nats.withdraw({
      uid: userId,
      req_id: requestId,
      chain_id: `${chainId}`,
      token_address: tokenAddress,
      token_amount: amount,
      nonce: `${nonce}`,
      signature: signature ?? "",
    });
    // TODO: multi-chain, multi assets, decimals support.
    return `[User Action] The user just requested to withdraw ${formatUnits(amount, 6)} USDC on BASE (Chain ID: ${chainId}). 
  And then actual ${formatUnits(actual_withdraw_amount ?? "0", 6)} USDC has withdrawn.
  The transaction hash is [${transaction_hash}](https://basescan.org/tx/${transaction_hash}).`;
  } catch (error: any) {
    return `[User Action] The user just requested to withdraw ${formatUnits(amount, 6)} USDC on BASE (Chain ID: ${chainId}) but failed.
    Error:${error.toString()}.`;
  }
}

function handleChangeSmartAccount(userAction: UserAction, userId: string, requestId: string) {
  throw new Error("Function not implemented.");
}
