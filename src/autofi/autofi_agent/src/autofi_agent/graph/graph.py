import json
import uuid
from datetime import datetime
from typing import Tuple
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import HumanMessage, RemoveMessage
from langgraph.checkpoint.mongodb import MongoDBSaver
from pymongo import MongoClient
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command

from .state import State, SelectedInstruments, OperatorWork
from .investment_expert_agent import build_investment_expert_agent
from .operator_agent import build_operator_agent
from .misc import get_human_readable_time
from autofi_agent.mcp.operator_helper import send_intent_transaction, get_all_investments_with_offset
from autofi_agent.mcp.investment_expert_helper import send_investment_recommendations, send_querier_immediate_query
from autofi_core import config as aegis_config
from autofi_core import logger, build_mcp_config
from autofi_core.common.messages import UserInstrumentsIntent, HelperGetInvestment
from autofi_core.common.model import InvestmentExpertSelectedModel


InvestmentsByInclination = dict[str, dict[str, HelperGetInvestment]]
current_batch_data: InvestmentsByInclination = {}


async def init_state(state: State, config: RunnableConfig):
    global current_batch_data
    current_batch_data = {}
    batch_id = str(uuid.uuid4())
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    inclinations = [
        "1",  # Conservative
        "2",  # Balanced
        "3"  # Aggressive
    ]

    """Clear messages and add placeholder for Anthropic compatibility"""
    messages = state["messages"]

    # Remove all messages
    removal_operations = [RemoveMessage(id=m.id) for m in messages]

    # Add a minimal placeholder message
    placeholder = HumanMessage(content="Continue")
    logger.debug("[init_state] Initialized state with batch_id: %s, current_time: %s", batch_id, current_time)

    return {
        "messages": removal_operations + [placeholder],
        "batch_id": batch_id,
        "current_time": current_time,
        "risk_reports": "No risk reports available now.",  # Placeholder for risk reports
        "investment_recommendations": {inc: [] for inc in inclinations},
        "work_done": {inc: False for inc in inclinations},
        "structured_response": None,
        "message_delete_cursor": None,
        "user_investments": None,
    }


async def after_investment_expert(state: State, config: RunnableConfig):
    try:
        selected: SelectedInstruments = state.get("structured_response")

        selected_conservative_instrument_ids = [i.instrument_id for i in selected.selection_for_conservative_clients]
        selected_balanced_instrument_ids = [i.instrument_id for i in selected.selection_for_balanced_clients]
        selected_aggressive_instrument_ids = [i.instrument_id for i in selected.selection_for_aggressive_clients]

        selection = InvestmentExpertSelectedModel(
            selected_conservative_instrument_ids=selected_conservative_instrument_ids,
            selected_balanced_instrument_ids=selected_balanced_instrument_ids,
            selected_aggressive_instrument_ids=selected_aggressive_instrument_ids,
        )
        await send_investment_recommendations(selection)

        return Command(
            goto="prepare_user_investments",
            update={"investment_recommendations": selected.to_state(),
                    "structured_response": None},
        )
    except Exception as e:
        logger.error("[after_investment_expert] Exception: %s", e)
        return Command(
            goto=END
        )


async def prepare_user_investments(state: State, config: RunnableConfig):
    global current_batch_data
    batch_data: dict = {}
    offset = 0
    while True:
        resp = await get_all_investments_with_offset(offset)
        if not resp or not resp.investments_by_inclination:
            break
        for inclination, users_investments in resp.investments_by_inclination.items():
            if inclination not in batch_data:
                batch_data[inclination] = {}
            for uid, investments in users_investments.items():
                batch_data[inclination][uid] = investments
        if resp.has_more:
            offset = resp.next_offset
        else:
            break
    current_batch_data = batch_data


async def withdraw_who_disable_strategy(state: State, config: RunnableConfig):
    global current_batch_data
    message_delete_cursor = None
    try:
        investments = current_batch_data.get("0")  # Users who have disabled strategy
        if investments:
            logger.debug("[withdraw_who_disable_strategy] Found investments to withdraw: %s", investments)
            user_intents = []
            for uid, investment in investments.items():
                user_intent = UserInstrumentsIntent(
                    uid=uid,
                    inclined_instrument_id=0,
                    reason="Strategy disabled",
                )
                user_intents.append(user_intent)
            if user_intents:
                resp = await send_intent_transaction(user_intents)
                if resp.error:
                    logger.info("[withdraw_who_disable_strategy] Error sending intent transaction: %s", resp.error)
                if resp.intents:
                    for intent in resp.intents:
                        logger.debug("[withdraw_who_disable_strategy] Intent execution report: %s", intent)
        # set message delete cursor for concentrating operator
        messages = state["messages"]
        if messages:
            message_delete_cursor = len(messages)

        return Command(
            goto="before_operator",
            update={
                "message_delete_cursor": message_delete_cursor,
            }
        )
    except Exception as e:
        logger.error("[withdraw_who_disable_strategy] Exception: %s", e)
        return Command(
            goto=END,
        )


async def before_operator(state: State, config: RunnableConfig):
    update = {}
    message_delete_cursor = state.get("message_delete_cursor")
    if message_delete_cursor:
        messages = state["messages"]
        if messages and message_delete_cursor <= len(messages):
            removal_operations = [RemoveMessage(id=m.id) for m in messages[message_delete_cursor:]]
            update["messages"] = removal_operations

    # figure out which strategy_type phase are we in
    if not state.get("structured_response"):
        strategy_type = "conservative"
    else:
        operator_work: OperatorWork = state.get("structured_response")
        strategy_type = operator_work.strategy_type

    result = get_some_investments(strategy_type)
    if not result:
        # all done
        logger.debug("[before_operator] No more investments to process, moving to clean up phase.")
        return Command(
            goto="clean_up_phase",
            update=update
        )
    (investments_info, current_strategy_type) = result
    logger.debug(f"[before_operator] get user investments info: {investments_info} for strategy type "
                 f"{current_strategy_type}")
    update["user_investments"] = investments_info
    match current_strategy_type:
        case "conservative":
            goto = "conservative_operator"
        case "balanced":
            goto = "balanced_operator"
        case "aggressive":
            goto = "aggressive_operator"
        case _:
            goto = "conservative_operator"
    logger.debug(f"[before_operator] Moving to {goto} with new investments.")
    return Command(
        goto=goto,
        update=update
    )


async def clean_up_phase(state: State, config: RunnableConfig):
    await send_querier_immediate_query()
    return Command(
        goto=END,
    )


def get_some_investments(strategy_type: str) -> Tuple[str, str] | None:
    current_strategy_type = strategy_type
    match strategy_type:
        case "conservative":
            inclination_code = 1
        case "balanced":
            inclination_code = 2
        case "aggressive":
            inclination_code = 3
        case _:
            inclination_code = 1

    while True:
        result = _get_some_investments(str(inclination_code))
        if not result:
            inclination_code += 1
            if inclination_code > 3:
                return None
            else:
                continue
        break

    match inclination_code:
        case 1:
            current_strategy_type = "conservative"
        case 2:
            current_strategy_type = "balanced"
        case 3:
            current_strategy_type = "aggressive"

    return result, current_strategy_type


def _get_some_investments(inclination_code: str) -> str | None:
    global current_batch_data
    user_investments_should_be_returned = {}
    returned = 0
    max_return = 15
    investments_dict = current_batch_data.get(inclination_code, {})
    if not investments_dict:
        return None

    uids = list(investments_dict.keys())
    for uid in uids[:max_return]:
        user_investments_should_be_returned[uid] = investments_dict[uid]
        del investments_dict[uid]
        returned += 1

    if not investments_dict:
        del current_batch_data[inclination_code]

    lines = [
        f"Investment information for {returned} user(s) retrieved.",
        "You may use these details to create intent transactions and help users discover "
        "better investment opportunities.",
        "Details for each user:",
    ]
    for uid, investment in user_investments_should_be_returned.items():
        i: dict = {
            "uid": uid,
            "strategy_type_user_chosen": investment.mandate.next_strategy,
            "existed_positions": []
        }
        if investment.blacklist_protocol_names:
            i["blacklist_protocol_names"] = [b for b in investment.blacklist_protocol_names]

        if investment.positions:
            for position in investment.positions:
                i["existed_positions"].append({
                    "chain_id": position.position_data.chain_id,
                    "instrument_id": position.position_data.instrument_id,
                    "asset": position.position_data.asset,
                    "asset_amount": position.position_data.asset_amount,
                    "asset_amount_in_usd": f'${position.position_data.asset_amount_usd}',
                    "pnl_in_usd": f'${position.position_data.pnl_usd}',
                    "timestamp": get_human_readable_time(position.position_data.timestamp),
                })
        if investment.last_transaction:
            i["last_transaction_dealt_by_you"] = get_human_readable_time(investment.last_transaction.tx_time)
        if investment.uninvested_value:
            i["uninvested_value_in_usd"] = f'${investment.uninvested_value}'
        lines.append(json.dumps(i, ensure_ascii=False, indent=2))
    lines.append("Strategy type codes:\n"
                 "  '0' - DISABLED\n"
                 "  '1' - CONSERVATIVE\n"
                 "  '2' - BALANCED\n"
                 "  '3' - AGGRESSIVE\n")

    return "\n".join(lines)


"""
[START] 
   |
   v
init_state --> investment_expert --> after_investment_expert --> prepare_user_investments
   |
   v
withdraw_who_disable_strategy
   |
   v
before_operator
   |
   +--------> conservative_operator ------+
   |                                      |
   +--------> balanced_operator ----------+----> (back to "before_operator")
   |                                      |
   +--------> aggressive_operator --------+
   |
   +--------> clean_up_phase --> [END]
"""


async def build_graph():
    # build memory checkpoint
    mongo_client = MongoClient(aegis_config.mongo.url)
    memory = MongoDBSaver(mongo_client, db_name="aegis")

    # build agents
    invest_helper_config = build_mcp_config(["investment_expert_helper"])
    operator_helper_config = build_mcp_config(["operator_helper"])
    investment_expert_agent = await build_investment_expert_agent(memory, invest_helper_config)
    conservative_operator_agent = await build_operator_agent(memory, operator_helper_config, "1")
    balanced_operator_agent = await build_operator_agent(memory, operator_helper_config, "2")
    aggressive_operator_agent = await build_operator_agent(memory, operator_helper_config, "3")

    # build state graph
    builder = StateGraph(State, config_schema=RunnableConfig)
    builder.add_node(init_state)
    builder.add_node("investment_expert", investment_expert_agent.a_call_agent)
    builder.add_node(after_investment_expert)
    builder.add_node(prepare_user_investments)
    builder.add_node(withdraw_who_disable_strategy)
    builder.add_node(before_operator)
    builder.add_node(clean_up_phase)
    builder.add_node("conservative_operator", conservative_operator_agent.a_call_agent)
    builder.add_node("balanced_operator", balanced_operator_agent.a_call_agent)
    builder.add_node("aggressive_operator", aggressive_operator_agent.a_call_agent)

    builder.add_edge(START, "init_state")
    builder.add_edge("init_state", "investment_expert")
    builder.add_edge("investment_expert", "after_investment_expert")
    builder.add_edge("prepare_user_investments", "withdraw_who_disable_strategy")
    builder.add_edge("conservative_operator", "before_operator")
    builder.add_edge("balanced_operator", "before_operator")
    builder.add_edge("aggressive_operator", "before_operator")

    return builder.compile(checkpointer=memory)
