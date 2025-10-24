from langchain_core.prompts import ChatPromptTemplate
from langchain_core.prompts.base import PromptValue
from langgraph.prebuilt import create_react_agent
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.sessions import StdioConnection
from langgraph.checkpoint.mongodb import MongoDBSaver

from .state import State, SelectedInstruments
from .misc import load_chat_model, ExecutableAgent
from autofi_agent.prompt import INVESTMENT_EXPERT_SYSTEM_PROMPT
from autofi_core import config as aegis_config


def prepare_investment_expert_messages(state: State) -> PromptValue:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", INVESTMENT_EXPERT_SYSTEM_PROMPT),
            ("placeholder", "{messages}"),
        ]
    )

    return prompt.invoke({
        "messages": state.get("messages"),
        "risk_reports": state.get("risk_reports"),
        "current_time": state.get("current_time"),
    })


async def build_investment_expert_agent(memory: MongoDBSaver, mcp_config: dict[str, StdioConnection]):
    llm = load_chat_model(aegis_config.llm.investment_expert_model, 0.0)
    client = MultiServerMCPClient(mcp_config)
    tools = await client.get_tools()

    agent = create_react_agent(
        tools=tools,
        prompt=prepare_investment_expert_messages,
        checkpointer=memory,
        model=llm,
        response_format=SelectedInstruments,
        state_schema=State,
        name="InvestmentExpertAgent",
    )
    return ExecutableAgent(agent)
