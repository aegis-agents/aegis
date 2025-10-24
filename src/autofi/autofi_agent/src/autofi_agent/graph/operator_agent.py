from langchain_core.prompts import ChatPromptTemplate
from langchain_core.prompts.base import PromptValue
from langgraph.prebuilt import create_react_agent
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.sessions import StdioConnection
from langgraph.checkpoint.mongodb import MongoDBSaver

from .state import State, OperatorWork
from .misc import load_chat_model, ExecutableAgent
from autofi_agent.prompt import AEGIS_OPERATOR_SYSTEM_PROMPT
from autofi_core import config as aegis_config


def prepare_conservative_operator_messages(state: State) -> PromptValue:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", AEGIS_OPERATOR_SYSTEM_PROMPT),
            ("placeholder", "{messages}"),
        ]
    )

    return prompt.invoke({
        "messages": state.get("messages"),
        "strategy_type": "conservative",
        "investment_recommendations": state.get("investment_recommendations")["1"],
        "user_investments": state.get("user_investments"),
        "current_time": state.get("current_time"),
    })


def prepare_balanced_operator_messages(state: State) -> PromptValue:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", AEGIS_OPERATOR_SYSTEM_PROMPT),
            ("placeholder", "{messages}"),
        ]
    )

    return prompt.invoke({
        "messages": state.get("messages"),
        "strategy_type": "balanced",
        "investment_recommendations": state.get("investment_recommendations")["2"],
        "user_investments": state.get("user_investments"),
        "current_time": state.get("current_time"),
    })


def prepare_aggressive_operator_messages(state: State) -> PromptValue:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", AEGIS_OPERATOR_SYSTEM_PROMPT),
            ("placeholder", "{messages}"),
        ]
    )

    return prompt.invoke({
        "messages": state.get("messages"),
        "strategy_type": "aggressive",
        "investment_recommendations": state.get("investment_recommendations")["3"],
        "user_investments": state.get("user_investments"),
        "current_time": state.get("current_time"),
    })


async def build_operator_agent(memory: MongoDBSaver, mcp_config: dict[str, StdioConnection], strategy_type: str):
    llm = load_chat_model(aegis_config.llm.operator_model, 0.0)
    client = MultiServerMCPClient(mcp_config)
    tools = await client.get_tools()

    if strategy_type == "1":
        name = "ConservativeOperatorAgent"
        prompt = prepare_conservative_operator_messages
    elif strategy_type == "2":
        name = "BalancedOperatorAgent"
        prompt = prepare_balanced_operator_messages
    elif strategy_type == "3":
        name = "AggressiveOperatorAgent"
        prompt = prepare_aggressive_operator_messages
    else:
        raise ValueError(f"Unknown strategy type: {strategy_type}")

    agent = create_react_agent(
        tools=tools,
        prompt=prompt,
        checkpointer=memory,
        model=llm,
        response_format=OperatorWork,
        state_schema=State,
        name=name,
    )
    return ExecutableAgent(agent)
