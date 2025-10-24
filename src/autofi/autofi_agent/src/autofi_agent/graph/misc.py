from datetime import datetime
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import AIMessage

from .state import State
from abc import ABC, abstractmethod


class CallableAgent(ABC):

    @abstractmethod
    def call_agent(self, state: State, config: RunnableConfig) -> dict[str, list[str]] | dict[str, list[AIMessage]]: ...

    @abstractmethod
    async def a_call_agent(self, state: State, config: RunnableConfig) -> (dict[str, list[str]] |
                                                                           dict[str, list[AIMessage]]): ...

    @property
    @abstractmethod
    def name(self) -> str: ...


class ExecutableAgent(CallableAgent):
    def __init__(self, graph):
        self.graph = graph

    def call_agent(self, state: State, config: RunnableConfig) -> dict[str, list[str]]:
        return self.graph.invoke(input=state, config=config)

    async def a_call_agent(self, state: State, config: RunnableConfig) -> dict[str, list[str]]:
        return await self.graph.ainvoke(input=state, config=config)

    @property
    def name(self) -> str:
        return self.graph.name


def load_chat_model(fully_specified_name: str, temperature: float | None) -> BaseChatModel:
    """Load a chat model from a fully specified name.

    Args:
        fully_specified_name (str): String in the format 'provider/model'.
        temperature(int): The temperature to use for the model.
    """
    if "/" in fully_specified_name:
        provider, model = fully_specified_name.split("/", maxsplit=1)
    else:
        provider = ""
        model = fully_specified_name

    if not temperature:
        return init_chat_model(model, model_provider=provider)
    return init_chat_model(model, model_provider=provider, temperature=temperature)


def get_human_readable_time(timestamp: int) -> str:
    try:
        dt = datetime.fromtimestamp(timestamp)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        return str(timestamp)
