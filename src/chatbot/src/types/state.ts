export enum DashboardCardType {
  Webpage = "webpage",
  ShowUserInfo = "show_user_info",
  ShowUserPosition = "show_user_positions",
  ShowUserPositionRoeChart = "show_user_positions_roe_chart",
  ShowUserPositionPnlChart = "show_user_positions_pnl_chart",
  ShowProjectTvlChart = "show_project_tvl_chart",
  ShowProjectApyChart = "show_project_apy_chart",
  ShowHotInstruments = "show_hot_instruments",
  ShowInstrumentApyChart = "show_instrument_apy_chart",
  ShowInstrumentTvlChart = "show_instrument_tvl_chart",
  ShowStrategy = "show_strategy",
  ShowAssets = "show_assets",
}
export type DashboardCard = {
  type: DashboardCardType;
  args: any[];
};

export enum ConversationCardType {
  ChangeSmartAccount = "change_smart_account",
  ChangeStrategy = "change_strategy",
  Deposit = "deposit",
  Withdraw = "withdraw",
}
export type ConversationCard = {
  type: ConversationCardType;
  args: any[];
};

export enum UserActionType {
  ChangeSmartAccount = "change_smart_account",
  ChangeStrategy = "change_strategy",
  Deposit = "deposit",
  Withdraw = "withdraw",
}

export type UserAction = {
  type: UserActionType;
  args: any[];
};

export enum UserDirectRequestType {
  Deposit = "deposit",
  Withdraw = "withdraw",
}

export type UserDirectRequest = {
  type: UserDirectRequestType;
  args: any[];
};

export type Team = {
  name: string;
  description: string;
  workers: { name: string; description: string }[];
};
