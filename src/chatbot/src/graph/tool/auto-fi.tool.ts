import { tool } from "@langchain/core/tools";
import { Command, getCurrentTaskInput, LangGraphRunnableConfig } from "@langchain/langgraph";
import z from "zod";
import { getNatsConnection } from "../../common/nats.js";
import { ToolMessage } from "@langchain/core/messages";
import { ConversationCard, ConversationCardType, DashboardCard, DashboardCardType } from "../../types/state.js";
import { SuperGraphAnnotation } from "../chatbot-graph.js";
import { StrategyMapping } from "../../common/constant.js";
import { formatUnits } from "../../common/helper.js";

export const showUserPositions = tool(
  async ({}, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const nats = await getNatsConnection();
      const userPositions = await nats.getUserPositions({ uid: userId, req_id: reqId, with_relative_instruments: false });
      const showUserPositionCard: DashboardCard = {
        type: DashboardCardType.ShowUserPosition,
        args: [userPositions],
      };
      console.log("showUserPositions", showUserPositionCard);
      config.writer?.({ dashboardCardExtractor: showUserPositionCard });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
              The UI to show user the information of the user's positions has been display to the user.
              The UI contains the following information:
              ${
                userPositions.positions.length > 0
                  ? userPositions.positions
                      .map(
                        (position, index) =>
                          `- position ${index}
                      asset: ${position.position_meta.asset}
                      instrument: ${position.position_meta.instrument_type}
                      instrument Id: ${position.position_meta.instrument_id}
                      chain id: ${position.position_meta.chain_id}
                      asset amount: $${position.position_data.asset_amount_usd}
                      PNL: $${position.position_data.pnl_usd}
                      ROE: $${position.position_data.roe_usd}
                `
                      )
                      .join("\n")
                  : "(The user currently has no positions)"
              }
              `,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Show User Positions Failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "show_user_positions",
    description: "use this to trigger UI to display the information of the user's positions.",
    schema: z.object({}),
  }
);
export const showUserPositionRoeChart = tool(
  async ({}, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const nats = await getNatsConnection();
      const userPositions = await nats.getUserPositions({ uid: userId, req_id: reqId, with_relative_instruments: false });
      const instrumentIds = Array.from(new Set(userPositions.positions.map((position) => position.position_meta.instrument_id)));
      const userPositionChartDatas = await Promise.all(instrumentIds.map((instrumentId) => nats.getUserPositionsChartData({ uid: userId, req_id: reqId, instrument_id: instrumentId, days_of_verbose_data: 7 })));
      const roeData = userPositionChartDatas.map((userPositionChartData) => {
        const verboseData = userPositionChartData.verbose_time_position_data;
        if (verboseData && Object.keys(verboseData).length > 0) {
          return {
            position: userPositionChartData.position_meta,
            instrument: userPositionChartData.instrument_meta,
            data: Object.entries(verboseData)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([ts, posData]) => {
                // console.log(`Timestamp: ${ts} (${new Date(Number(ts) * 1000).toISOString()})`);
                return { timestamp: ts, roe_usd: posData.roe_usd };
              }),
          };
        } else {
          return { position: userPositionChartData.position_meta, instrument: userPositionChartData.instrument_meta, data: [] };
        }
      });
      const card: DashboardCard = {
        type: DashboardCardType.ShowUserPositionRoeChart,
        args: [roeData],
      };
      config.writer?.({ dashboardCardExtractor: card });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
The UI to show the ROE time-series of the user's current positions has been displayed.
Summary:
- positions: ${roeData.length}
- time window: last 7 days (UTC), points per series vary

Series detail:
${
  roeData.length > 0
    ? roeData
        .map((s, idx) => {
          const head = s.data
            .slice(0, 3)
            .map((p) => `(${p.timestamp}, roe_usd=${p.roe_usd})`)
            .join(", ");
          const tail = s.data
            .slice(-3)
            .map((p) => `(${p.timestamp}, roe_usd=${p.roe_usd})`)
            .join(", ");
          return `  * [series ${idx + 1}] instrument_id=${s.position.instrument_id}, name=${s.instrument.instrument_name ?? s.instrument.symbol ?? ""}, points=${s.data.length}
      head: ${head || "[]"}
      tail: ${tail || "[]"}
`;
        })
        .join("\n")
    : "(The user currently has no position ROE data)"
}
Legend: one line per position; color-coded by instrument. Hover tooltip shows timestamp + roe_usd.
`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Show instrument apy chart failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "show_user_positions_roe_chart",
    description: "use this to trigger UI to display the ROE timing chart of the user's current position.",
    schema: z.object({}),
  }
);

export const showUserPositionPnlChart = tool(
  async ({}, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const nats = await getNatsConnection();
      const userPositions = await nats.getUserPositions({ uid: userId, req_id: reqId, with_relative_instruments: false });
      const instrumentIds = Array.from(new Set(userPositions.positions.map((position) => position.position_meta.instrument_id)));
      const userPositionChartDatas = await Promise.all(instrumentIds.map((instrumentId) => nats.getUserPositionsChartData({ uid: userId, req_id: reqId, instrument_id: instrumentId, days_of_verbose_data: 7 })));
      const data = userPositionChartDatas.map((userPositionChartData) => {
        const verboseData = userPositionChartData.verbose_time_position_data;
        if (verboseData && Object.keys(verboseData).length > 0) {
          return {
            position: userPositionChartData.position_meta,
            instrument: userPositionChartData.instrument_meta,
            data: Object.entries(verboseData)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([ts, posData]) => {
                // console.log(`Timestamp: ${ts} (${new Date(Number(ts) * 1000).toISOString()})`);
                return { timestamp: ts, pnl_usd: posData.pnl_usd };
              }),
          };
        } else {
          return { position: userPositionChartData.position_meta, instrument: userPositionChartData.instrument_meta, data: [] };
        }
      });
      const card: DashboardCard = {
        type: DashboardCardType.ShowUserPositionPnlChart,
        args: [data],
      };
      config.writer?.({ dashboardCardExtractor: card });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
The UI to show the PNL time-series of the user's current positions has been displayed.
Summary:
- positions: ${data.length}
- time window: last 7 days (UTC)

Series detail:
${
  data.length > 0
    ? data
        .map((s, idx) => {
          const head = s.data
            .slice(0, 3)
            .map((p) => `(${p.timestamp}, pnl_usd=${p.pnl_usd})`)
            .join(", ");
          const tail = s.data
            .slice(-3)
            .map((p) => `(${p.timestamp}, pnl_usd=${p.pnl_usd})`)
            .join(", ");
          return `  * [series ${idx + 1}] instrument_id=${s.position.instrument_id}, name=${s.instrument.instrument_name ?? s.instrument.symbol ?? ""}, points=${s.data.length}
      head: ${head || "[]"}
      tail: ${tail || "[]"}
`;
        })
        .join("\n")
    : "(The user currently has no position PNL data)"
}
Legend: one line per position; color-coded by instrument; tooltip shows timestamp + pnl_usd.
`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `display the PNL timing chart of the user's current position failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "show_user_positions_pnl_chart",
    description: "use this to trigger UI to display the PNL timing chart of the user's current position.",
    schema: z.object({}),
  }
);
export const showProjectTvlChart = tool(
  async ({}, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const nats = await getNatsConnection();
      const globalInfoData = await nats.getGlobalInfo({ req_id: reqId, days_of_verbose_data: 7 });
      const global_infos = globalInfoData.global_infos;
      let data: { timestamp: string; tvl_usd: number }[] = [];
      if (global_infos && Object.keys(global_infos).length > 0) {
        data = Object.entries(global_infos)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([ts, info]) => {
            return { timestamp: ts, tvl_usd: info.tvl_usd };
          });
      }
      const card: DashboardCard = {
        type: DashboardCardType.ShowProjectTvlChart,
        args: [data],
      };
      config.writer?.({ dashboardCardExtractor: card });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
The UI to show the Aegis-Agents project's TVL time-series has been displayed.
Summary:
- points: ${data.length}
- time window: last 7 days (UTC)

Preview:
  head: ${
    data
      .slice(0, 3)
      .map((p) => `(${p.timestamp}, tvl_usd=${p.tvl_usd})`)
      .join(", ") || "[]"
  }
  tail: ${
    data
      .slice(-3)
      .map((p) => `(${p.timestamp}, tvl_usd=${p.tvl_usd})`)
      .join(", ") || "[]"
  }

This single-line chart reflects protocol-level liquidity trend (TVL in USD).
`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `display the TVL timing chart of the project failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "show_project_tvl_chart",
    description: "use this to trigger UI to display the TVL timing chart of the project.",
    schema: z.object({}),
  }
);

export const showProjectApyChart = tool(
  async ({}, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const nats = await getNatsConnection();
      const globalInfoData = await nats.getGlobalInfo({ req_id: reqId, days_of_verbose_data: 7 });
      const global_infos = globalInfoData.global_infos;
      let data: { timestamp: string; apy: string }[] = [];
      if (global_infos && Object.keys(global_infos).length > 0) {
        data = Object.entries(global_infos)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([ts, info]) => {
            return { timestamp: ts, apy: info.conservative_apy };
          });
      }
      const card: DashboardCard = {
        type: DashboardCardType.ShowProjectApyChart,
        args: [data],
      };
      config.writer?.({ dashboardCardExtractor: card });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
The UI to show the project's APY time-series (conservative_apy) has been displayed.
Summary:
- points: ${data.length}
- time window: last 7 days (UTC)
- value format: apy is a string decimal (e.g., "0.045" => 4.5%)

Preview:
  head: ${
    data
      .slice(0, 3)
      .map((p) => `(${p.timestamp}, apy=${p.apy})`)
      .join(", ") || "[]"
  }
  tail: ${
    data
      .slice(-3)
      .map((p) => `(${p.timestamp}, apy=${p.apy})`)
      .join(", ") || "[]"
  }
`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `display the APY timing chart of the project failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "show_project_apy_chart",
    description: "use this to trigger UI to display the APY timing chart of the project.",
    schema: z.object({}),
  }
);

export const showHotInstruments = tool(
  async ({}, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const nats = await getNatsConnection();
      const data = await nats.getHotInstruments({ req_id: reqId, days_of_verbose_data: 3 });
      const card: DashboardCard = {
        type: DashboardCardType.ShowHotInstruments,
        args: [data],
      };
      config.writer?.({ dashboardCardExtractor: card });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
The UI to show currently popular (hot) instruments has been displayed.
Data window: last 3 days (UTC).
Groups: conservative | balanced | aggressive.

${(() => {
  const fmtGroup = (label: string, arr: any[]) => {
    if (!arr || arr.length === 0) return `- ${label}: (empty)\n`;
    return `- ${label}: ${arr.length} instruments
${arr
  .slice(0, 5)
  .map((ins: any, i: number) => {
    const keys = Object.keys(ins.verbose_instrument_data || {}).sort((a, b) => Number(a) - Number(b));
    const head = keys
      .slice(0, 2)
      .map((k) => `(${k}, apy=${ins.verbose_instrument_data[k].apy}, tvl_usd=${ins.verbose_instrument_data[k].supply_amount_usd})`)
      .join(", ");
    const tail = keys
      .slice(-2)
      .map((k) => `(${k}, apy=${ins.verbose_instrument_data[k].apy}, tvl_usd=${ins.verbose_instrument_data[k].supply_amount_usd})`)
      .join(", ");
    return `    * [${i + 1}] id=${ins.instrument_id}, chain=${ins.chain_id}, proto=${ins.protocol_name}, asset=${ins.symbol || ins.underlying_asset}
        head: ${head || "[]"}
        tail: ${tail || "[]"}`;
  })
  .join("\n")}
`;
  };
  return [fmtGroup("conservative", data.conservative_hot_instruments), fmtGroup("balanced", data.balanced_hot_instruments), fmtGroup("aggressive", data.aggressive_hot_instruments)].join("\n");
})()}
`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Display the currently popular/hot instruments failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "show_hot_instruments",
    description: "use this to trigger UI to display the currently popular/hot instruments.",
    schema: z.object({}),
  }
);

export const showInstrumentApyChart = tool(
  async ({ instrumentId }, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const nats = await getNatsConnection();
      const instrumentChartData = await nats.getInstrumentChartData({ req_id: reqId, instrument_id: instrumentId, days_of_verbose_data: 7 });
      const instrument = instrumentChartData.instrument;
      const verboseData = instrument.verbose_instrument_data;
      let data = { instrument: { ...instrument, verbose_instrument_data: [] }, data: [] as { timestamp: string; apy: string }[] };
      if (verboseData && Object.keys(verboseData).length > 0) {
        data = {
          instrument: { ...instrument, verbose_instrument_data: [] },
          data: Object.entries(verboseData)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([ts, data]) => {
              // console.log(`Timestamp: ${ts} (${new Date(Number(ts) * 1000).toISOString()})`);
              return { timestamp: ts, apy: data.apy };
            }),
        };
      }

      const card: DashboardCard = {
        type: DashboardCardType.ShowInstrumentApyChart,
        args: [data],
      };
      config.writer?.({ dashboardCardExtractor: card });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
The UI to show the APY time-series of the selected instrument has been displayed.
Instrument:
- id=${data.instrument.instrument_id}, chain=${data.instrument.chain_id}, protocol=${data.instrument.protocol_name}, strategy=${data.instrument.strategy_type}, symbol=${data.instrument.symbol}, asset=${
                data.instrument.underlying_asset
              }, curator=${data.instrument.curator}

Series:
- points: ${data.data.length}, window: last 7 days (UTC), apy is string decimal.

Preview:
  head: ${
    data.data
      .slice(0, 4)
      .map((p) => `(${p.timestamp}, apy=${p.apy})`)
      .join(", ") || "[]"
  }
  tail: ${
    data.data
      .slice(-4)
      .map((p) => `(${p.timestamp}, apy=${p.apy})`)
      .join(", ") || "[]"
  }
`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Show instrument apy chart failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "show_instrument_apy_chart",
    description: "use this to trigger UI to display the APY timing chart of the instrument.",
    schema: z.object({
      instrumentId: z.number().describe("the id of the instrument."),
    }),
  }
);

export const showInstrumentTvlChart = tool(
  async ({ instrumentId }, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const nats = await getNatsConnection();
      const instrumentChartData = await nats.getInstrumentChartData({ req_id: reqId, instrument_id: instrumentId, days_of_verbose_data: 7 });
      const instrument = instrumentChartData.instrument;
      const verboseData = instrument.verbose_instrument_data;
      let data = { instrument: { ...instrument, verbose_instrument_data: [] }, data: [] as { timestamp: string; tvl: string }[] };
      if (verboseData && Object.keys(verboseData).length > 0) {
        data = {
          instrument: { ...instrument, verbose_instrument_data: [] },
          data: Object.entries(verboseData)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([ts, data]) => {
              // console.log(`Timestamp: ${ts} (${new Date(Number(ts) * 1000).toISOString()})`);
              return { timestamp: ts, tvl: data.supply_amount_usd };
            }),
        };
      }
      const card: DashboardCard = {
        type: DashboardCardType.ShowInstrumentTvlChart,
        args: [data],
      };
      console.log("showUserPositions", card);
      config.writer?.({ dashboardCardExtractor: card });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
The UI to show the TVL time-series of the selected instrument has been displayed.
Instrument:
- id=${data.instrument.instrument_id}, chain=${data.instrument.chain_id}, protocol=${data.instrument.protocol_name}, strategy=${data.instrument.strategy_type}, symbol=${data.instrument.symbol}, asset=${
                data.instrument.underlying_asset
              }, curator=${data.instrument.curator}

Series (USD from supply_amount_usd):
- points: ${data.data.length}, window: last 7 days (UTC)

Preview:
  head: ${
    data.data
      .slice(0, 4)
      .map((p) => `(${p.timestamp}, tvl=${p.tvl})`)
      .join(", ") || "[]"
  }
  tail: ${
    data.data
      .slice(-4)
      .map((p) => `(${p.timestamp}, tvl=${p.tvl})`)
      .join(", ") || "[]"
  }
`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Show instrument tvl chart failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "show_instrument_tvl_chart",
    description: "use this to trigger UI to display the TVL timing chart of the instrument.",
    schema: z.object({
      instrumentId: z.number().describe("the id of the instrument."),
    }),
  }
);

export const showAssets = tool(
  async ({}, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const nats = await getNatsConnection();
      const userAssets = await nats.getUserAssets({ uid: userId, req_id: reqId, force_update: true });
      const showAssetsCard: DashboardCard = {
        type: DashboardCardType.ShowAssets,
        args: [userAssets],
      };
      console.log("showAssets", showAssetsCard);
      config.writer?.({ dashboardCardExtractor: showAssetsCard });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
The UI to show user assets has been display to the user.
The UI contains the following information:
- User Assets (${userAssets.portfolio.user_address})
  ${
    userAssets.portfolio.user_address_portfolio && Object.keys(userAssets.portfolio.user_address_portfolio).length > 0
      ? Object.entries(userAssets.portfolio.user_address_portfolio)
          .map(
            ([key, asset], index) => `
    * [${index + 1}]
      asset key: ${key}
      name: ${asset.symbol}
      chain_id: ${asset.chain_id}
      token address: ${asset.token_address}
      decimals: ${asset.decimals}
      price: ${asset.price}
      balance: ${formatUnits(asset.balance, asset.decimals)}
      balance in USD: ${asset.value_usd}
      supported in auto-fi: ${asset.whitelisted} \n
`
          )
          .join("\n")
      : "(The user currently has no assets)"
  }

- Smart Account Assets (${userAssets.portfolio.smart_address})
  ${
    userAssets.portfolio.smart_address_portfolio && Object.keys(userAssets.portfolio.smart_address_portfolio).length > 0
      ? Object.entries(userAssets.portfolio.smart_address_portfolio)
          .map(
            ([key, asset], index) => `
    * [${index + 1}]
      asset key: ${key}
      name: ${asset.symbol}
      chain_id: ${asset.chain_id}
      token address: ${asset.token_address}
      decimals: ${asset.decimals}
      price: ${asset.price}
      balance: ${formatUnits(asset.balance, asset.decimals)}
      balance in USD: ${asset.value_usd}
      supported in auto-fi: ${asset.whitelisted} \n
`
          )
          .join("\n")
      : "(The smart account of user currently has no assets)"
  }

- Smart Account Positions
  ${
    userAssets.portfolio.smart_address_position && userAssets.portfolio.smart_address_position.length > 0
      ? userAssets.portfolio.smart_address_position
          .map(
            (position, index) =>
              `- position ${index}
                      asset: ${position.position_meta.asset}
                      instrument: ${position.position_meta.instrument_type}
                      instrument Id: ${position.position_meta.instrument_id}
                      chain id: ${position.position_meta.chain_id}
                      asset amount: $${position.position_data.asset_amount_usd}
                      PNL: $${position.position_data.pnl_usd}
                      ROE: $${position.position_data.roe_usd}
                `
          )
          .join("\n")
      : "(The user currently has no positions)"
  }
`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Show User Assets Failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "show_assets",
    description: "use this to trigger UI to help user show their assets.",
    schema: z.object({}),
  }
);

export const deposit = tool(
  async ({ amount, name }, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const depositCard: ConversationCard = {
        type: ConversationCardType.Deposit,
        args: [amount, name],
      };
      console.log("depositCard", depositCard);
      config.writer?.({ conversationCardExtractor: depositCard });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
              The UI to deposit assets has been display to the user. Users need to continue operating and confirming on the front-end.
              The UI contains the following information:
              - Selection box containing asset names ${name ? `(The current selection is '${name}')` : ``}.
              - Input box for asset amount ${amount ? `(The current input amount is '${amount}')` : ``}.
              `,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Deposit Failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "deposit",
    description: "use this to trigger UI to help user deposit assets.",
    schema: z.object({
      amount: z.number().optional().describe("the amount of the asset."),
      name: z.enum(["USDC"]).optional().describe("the name of the asset."),
    }),
  }
);

export const withdraw = tool(
  async ({ amount, name }, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const withdrawCard: ConversationCard = {
        type: ConversationCardType.Withdraw,
        args: [amount, name],
      };
      console.log("depositCard", withdrawCard);
      config.writer?.({ conversationCardExtractor: withdrawCard });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
              The UI to withdraw assets has been display to the user. Users need to continue operating and confirming on the front-end.
              The UI contains the following information:
              - Selection box containing asset names ${name ? `(The current selection is '${name}')` : ``}.
              - Input box for asset amount ${amount ? `(The current input amount is '${amount}')` : ``}.
              `,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Withdraw Failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "withdraw",
    description: "use this to trigger UI to help user withdraw assets.",
    schema: z.object({
      amount: z.number().optional().describe("the amount of the asset to withdraw."),
      name: z.enum(["USDC"]).optional().describe("the name of the asset to withdraw."),
    }),
  }
);

export const showStrategy = tool(
  async ({}, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const nats = await getNatsConnection();
      const userStrategy = await nats.getUserStrategy({ uid: userId, req_id: reqId });

      const showStrategyCard: DashboardCard = {
        type: DashboardCardType.ShowStrategy,
        args: [userStrategy.mandate],
      };
      console.log("showStrategyCard", showStrategyCard);
      config.writer?.({ dashboardCardExtractor: showStrategyCard });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
              The UI to show current auto-fi strategy has been display to the user.
              The UI contains the following information:
              - User current strategy: ${StrategyMapping[userStrategy.mandate.current_strategy]}
              - User next strategy about to take effect: ${StrategyMapping[userStrategy.mandate.next_strategy]}
              
              This UI only displays current auto-fi strategy of user and does not have the function to change the strategy. (change strategy is another tool)
              `,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Show Strategy Failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "show_strategy",
    description: "Use this to trigger UI when the user wants to show strategy explicitly.",
    schema: z.object({}),
  }
);

export const changeStrategy = tool(
  async ({ newStrategy }, config: LangGraphRunnableConfig) => {
    const userId = config.configurable?.user_id;
    const reqId = config.configurable?.req_id;
    try {
      const nats = await getNatsConnection();
      const userAssets = await nats.getUserAssets({ uid: userId, req_id: reqId, force_update: true });
      if (Number(userAssets.portfolio.smart_address_total_value_usd) <= 1) {
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: `Failed to display the UI to change autofi strategy to the user. Unable to process user request to change strategy, because the assets in the smart account of the user are less than or equal to the threshold of $1.00. The current assets of smart account are $${userAssets.portfolio.smart_address_total_value_usd}.`,
                tool_call_id: (config as any).toolCall.id,
              }),
            ],
          },
        });
      }
      const userStrategy = await nats.getUserStrategy({ uid: userId, req_id: reqId });

      const changeStrategyCard: ConversationCard = {
        type: ConversationCardType.ChangeStrategy,
        args: [userStrategy.mandate, newStrategy],
      };
      console.log("changeStrategyCard", changeStrategyCard);
      config.writer?.({ conversationCardExtractor: changeStrategyCard });
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `
              The UI to change autofi strategy has been display to the user.
              The UI includes these strategy options:
              - 0: disable
              - 1: conservative
              - 2: balanced (not supported)
              - 3: aggressive (not supported)
              `,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    } catch (error) {
      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `Change Strategy Failed. ${error}`,
              tool_call_id: (config as any).toolCall.id,
            }),
          ],
        },
      });
    }
  },
  {
    name: "change_strategy",
    description: "Use this to trigger UI when the user wants to change strategy explicitly.",
    schema: z.object({
      newStrategy: z
        .enum(["0", "1", "2", "3"])
        .optional()
        .describe(
          `The new strategy user want to change.
           Auto-fi strategy contains following options:
              - 0: disable
              - 1: conservative
              - 2: balanced (not supported)
              - 3: aggressive (not supported)`
        ),
    }),
  }
);
