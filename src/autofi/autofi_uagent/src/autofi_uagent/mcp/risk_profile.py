from contextlib import asynccontextmanager
from fastmcp import FastMCP, Context
import httpx
import json

from autofi_uagent.common.types import GetRiskProfilesResponse
from autofi_uagent.common.conf import config


mcp = FastMCP(
    name="AutoFiRiskMCPServer",
    instructions="This server handles risk profile requests related to specified DeFi protocols.",
)


@mcp.tool()
async def get_risk_profiles(ctx: Context) -> str:
    """Fetch the risk profiles for DeFi protocols."""
    async with httpx.AsyncClient() as client:
        response = await client.get(config.agent.risk_api_uri)
        response.raise_for_status()
        response_json = response.json()
        resp = GetRiskProfilesResponse.model_validate(response_json)
        if resp.return_code != 20000:
            await ctx.error(f"server return code: {resp.return_code}, message: {resp.message}")
            raise ValueError("Error fetching risk profiles")
        if not resp.data.risk_profiles:
            return "No risk found currently."

        lines = [
            f"Found {len(resp.data.risk_profiles)} risk(s):"
        ]

        for profile in resp.data.risk_profiles:
            i: dict = {
                "instrument_id": profile.instrument_id,
                "underlying_asset_symbol": profile.symbol,
                "protocol_name": profile.protocol_name,
                "instrument_name": profile.instrument_name,
                "risk": profile.risk,
                "risk_level": profile.risk_level,
                "timestamp": profile.timestamp,
            }
            lines.append(json.dumps(i, ensure_ascii=False, indent=2))
        return "\n".join(lines)


# Run the server
if __name__ == "__main__":
    print("Starting MCP server with stdio transport")
    mcp.run(transport='stdio')
