import os
import asyncio
from pydantic import SecretStr
from uagents_adapter import LangchainRegisterTool, cleanup_uagent
from uagents_adapter.langchain import AgentManager
from dotenv import load_dotenv

from autofi_uagent.graph.graph import build_risk_analyst_agent
from autofi_uagent.common.conf import build_mcp_config


load_dotenv()

OPENAI_API_KEY = SecretStr(os.getenv("OPENAI_API_KEY"))
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
API_TOKEN = os.getenv("AGENTVERSE_API_KEY")
MODEL_NAME = os.getenv("OPENAI_MODEL_NAME", "asi1-mini")


# Store the graph globally so it can be accessed by the wrapper function
_global_graph = None
# Add an event to signal when the graph is ready
graph_ready = asyncio.Event()


async def setup_multi_server_graph_agent():
    global _global_graph

    print("Setting up multi-server graph agent...")
    try:
        _global_graph = await build_risk_analyst_agent(model_name=MODEL_NAME,
                                                       api_key=OPENAI_API_KEY,
                                                       base_url=OPENAI_BASE_URL,
                                                       mcp_config=build_mcp_config(["risk_analyst_helper"]))
        print("Graph successfully compiled")

        # Test the graph
        try:
            print("Testing...")
            risk_response = await _global_graph.a_call_agent({"messages": "How's the risk status of DeFi protocols?"},
                                                             {})
            print(f"Risk test response: {risk_response['messages'][-1].content}")

        except Exception as e:
            print(f"Error during testing: {e}")

        # Signal that the graph is ready
        graph_ready.set()

        # Keep the connection alive
        while True:
            await asyncio.sleep(1)
    except Exception as e:
        print(f"Error setting up graph: {e}")
        # Set the event even in case of error to avoid deadlock
        graph_ready.set()


async def main():
    print("Initializing agent...")
    # Initialize agent manager
    manager = AgentManager()
    global _global_graph

    # Create graph wrapper with proper error handling
    async def graph_func(x):
        # Wait for the graph to be ready before trying to use it
        await graph_ready.wait()

        if _global_graph is None:
            error_msg = "Error: Graph not initialized properly. Please try again later."
            print(f"Response: {error_msg}")
            return error_msg

        try:
            # Print the incoming message
            print(f"\nReceived query: {x}")

            # Process the message
            if isinstance(x, str):
                response = await _global_graph.a_call_agent({"messages": x}, {})
            else:
                response = await _global_graph.a_call_agent({"messages": x}, {})

            # Extract and print the response
            result = response["messages"][-1].content
            print(f"\n✅ Response: {result}\n")
            return result
        except Exception as e:
            error_msg = f"Error processing request: {str(e)}"
            print(f"\n❌ {error_msg}\n")
            return error_msg

    agent_wrapper = manager.create_agent_wrapper(graph_func)

    # Start the graph in background
    manager.start_agent(setup_multi_server_graph_agent)

    # Register with uAgents
    print("Registering multi-server graph agent...")
    tool = LangchainRegisterTool()
    try:
        agent_info = tool.invoke(
            {
                "agent_obj": agent_wrapper,
                "name": "multi_server_graph_agent_math_langchain_mcp",
                "port": 8080,
                "description": "A multi-service graph agent that can handle math calculations and weather queries",
                "api_token": API_TOKEN,
                "mailbox": True
            }
        )
        print(f"✅ Registered multi-server graph agent: {agent_info}")
    except Exception as e:
        print(f"⚠️ Error registering agent: {e}")
        print("Continuing with local agent only...")
    try:
        manager.run_forever()
    except KeyboardInterrupt:
        print("🛑 Shutting down...")
        cleanup_uagent("multi_server_graph_agent")

        print("✅ Agent stopped.")


if __name__ == "__main__":
    asyncio.run(main())
