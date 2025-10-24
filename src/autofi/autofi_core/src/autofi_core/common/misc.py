cdp_chain_id_network_map = {
    "1": "ethereum-mainnet",
    "8453": "base",
    "84532": "base-sepolia",
}


def get_cdp_chain_id_network(chain_id: str) -> str | None:
    """Get the network name for a given chain ID."""
    return cdp_chain_id_network_map.get(chain_id, None)
