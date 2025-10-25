from langchain_core.prompts import ChatPromptTemplate
from langchain_core.prompts.base import PromptValue
from langgraph.prebuilt import create_react_agent
from langgraph.prebuilt.chat_agent_executor import AgentState
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.sessions import StdioConnection
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import AIMessage
from langchain_openai import ChatOpenAI
from pydantic import SecretStr
from abc import ABC, abstractmethod

from .prompt import RISK_ANALYST_SYSTEM_PROMPT


class CallableAgent(ABC):

    @abstractmethod
    def call_agent(self, state: AgentState, config: RunnableConfig) -> dict[str, list[str]] | dict[str, list[AIMessage]]: ...

    @abstractmethod
    async def a_call_agent(self, state: AgentState, config: RunnableConfig) -> (dict[str, list[str]] |
                                                                           dict[str, list[AIMessage]]): ...

    @property
    @abstractmethod
    def name(self) -> str: ...


class ExecutableAgent(CallableAgent):
    def __init__(self, graph):
        self.graph = graph

    def call_agent(self, state: AgentState, config: RunnableConfig) -> dict[str, list[str]]:
        return self.graph.invoke(input=state, config=config)

    async def a_call_agent(self, state: AgentState, config: RunnableConfig) -> dict[str, list[str]]:
        return await self.graph.ainvoke(input=state, config=config)

    @property
    def name(self) -> str:
        return self.graph.name


def prepare_risk_analyst_messages(state: AgentState) -> PromptValue:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", RISK_ANALYST_SYSTEM_PROMPT),
            ("placeholder", "{messages}"),
        ]
    )

    return prompt.invoke({
        "messages": state.get("messages"),
    })


async def build_risk_analyst_agent(model_name: str,
                                   api_key: SecretStr,
                                   base_url: str,
                                   mcp_config: dict[str, StdioConnection]):
    llm = ChatOpenAI(
        api_key=api_key,
        base_url=base_url,
        temperature=0.0,
        model=model_name,
    )

    client = MultiServerMCPClient(mcp_config)
    tools = await client.get_tools()

    agent = create_react_agent(
        tools=tools,
        prompt=prepare_risk_analyst_messages,
        model=llm,
        state_schema=AgentState,
        name="RiskAnalystAgent",
    )
    return ExecutableAgent(agent)
