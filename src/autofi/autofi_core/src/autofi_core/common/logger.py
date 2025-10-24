from rich.console import Console
from rich.logging import RichHandler
import logging


console = Console(
    width=180,
)
logger_level = logging.DEBUG

logging.basicConfig(
    level=logger_level,
    format="%(message)s",
    datefmt="[%Y-%m-%d %H:%M:%S]",
    handlers=[RichHandler(
        console=console,
        rich_tracebacks=True,
        show_time=True,
        show_level=True,
        show_path=True,
    )]
)

logger = logging.getLogger("rich_logger")
logging.getLogger("pymongo").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

logger.info("Rich logging with custom format!")
