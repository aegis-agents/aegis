import { blockscoutTools } from "../../mcp-client/blockscout.js";

export const getTeamMembers = () => {
  return [
    {
      name: "KnowledgeTeam",
      description: 'Responsible for answering questions about general project and concept, such as "What is Auto-Fi?" or "How does sub account work?".',
      workers: [
        {
          name: "SelfRAG",
          description: "a research assistant who can search for information related to (aegis-agent, smart wallet, and sub account) from the built-in official documents using self-reflective RAG engine.",
        },
        {
          name: "OnChainDataWorker",
          description: `
a query assistant who can fetch blockchain data (balances, tokens, NFTs, contract metadata) via the Model Context Protocol to access and analyze blockchain information contextually.
OnChainDataWorker has the following tools:
${blockscoutTools.join("\n")}
        `,
        },
      ],
    },
    {
      name: "AccountTeam",
      description: 'Responsible for management of user account and smart account, such as "What is my user information?".',
      workers: [
        {
          name: "SmartAccountWorker",
          description: "Handles management of smart account, including change smart account (not available yet)",
        },
        {
          name: "AccountWorker",
          description:
            "Handles management of user account, including query user info (user address, smart account address and so on). AccountWorker has the following tools:\n - [show_user_info]: Use this to trigger UI to show information of the user.",
        },
      ],
    },
    {
      name: "AutoFiTeam",
      description:
        "Responsible for user auto-fi management, including helping users to view or manage their strategy, holdings(deposit or withdraw assets), profits, change their strategy and query overall market/instrument and project data information, such as TVL, APY and other charts.",
      workers: [
        {
          name: "QueryWorker",
          description: `
A query assistant belonging to the auto-fi team, helping users view their positions and profits, as well as displaying overall market/instrument and project data information, such as TVL, APY and other charts.
NOT responsible for data analysis.
QueryWorker has the following tools:
- [show_user_positions]: use this to trigger UI to display the information of the user's positions.
- [show_user_positions_roe_chart]: use this to trigger UI to display the ROE time-series chart of the user's current position.
- [show_user_positions_pnl_chart]: use this to trigger UI to display the PNL time-series chart of the user's current position.
- [show_project_tvl_chart]: use this to trigger UI to display the TVL time-series chart of the project.
- [show_project_apy_chart]: use this to trigger UI to display the APY time-series chart of the project.
- [show_hot_instruments]: use this to trigger UI to display the currently popular/hot instruments.
- [show_instrument_apy_chart]: use this to trigger UI to display the APY time-series chart of the instrument.
- [show_instrument_tvl_chart]: use this to trigger UI to display the TVL time-series chart of the instrument.`,
        },
        {
          name: "StrategyWorker",
          description: `
An assistant that help users query and modify their current auto-fi investment strategies.
StrategyWorker has the following tools:
- [show_strategy]: use this to trigger UI to show the current auto-fi investment strategy of the user.This UI only displays current auto-fi strategy of user and does not have the function to change the strategy.
- [change_strategy]: use this to trigger UI to help user change the auto-fi investment strategy.`,
        },
        {
          name: "AssetsWorker",
          description: `
An assistant that can help query the user's current assets, deposit assets to smart account, and withdraw assets.
AssetsWorker has the following tools:
- [show_assets]: use this to trigger UI to show users their current assets.
- [deposit]: use this to trigger UI to help user deposit assets.
- [withdraw]: use this to trigger UI to help user withdraw assets.`,
        },
      ],
    },
  ];
};
