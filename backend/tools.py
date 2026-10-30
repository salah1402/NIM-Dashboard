import sys
import subprocess
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

PYTHON_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "execute_python",
        "description": "Execute Python code locally and return the stdout/stderr. Use this for math, data analysis, and logic.",
        "parameters": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "The Python code to execute."}
            },
            "required": ["code"]
        }
    }
}

WEB_SEARCH_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the live web for current events, news, facts, and fresh information. Returns the top 5 results with titles, URLs, and snippets.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query string."}
            },
            "required": ["query"]
        }
    }
}


def execute_python(code: str, timeout_s: int = 10) -> str:
    """Executes Python code locally using sys.executable and captures stdout/stderr.
    
    Protected by a subprocess timeout.
    """
    if not code:
        return "Error: No code provided to execute."

    try:
        res = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
        output = []
        if res.stdout:
            output.append(res.stdout)
        if res.stderr:
            output.append(res.stderr)

        result_str = "\n".join(output).strip()
        if not result_str and res.returncode == 0:
            return "Code executed successfully with no output."
        elif res.returncode != 0 and not result_str:
            return f"Process exited with error code {res.returncode}"
        return result_str

    except subprocess.TimeoutExpired:
        logger.warning("execute_python: timed out after %ds", timeout_s)
        return f"Execution timed out after {timeout_s} seconds."
    except Exception as exc:
        logger.error("execute_python error: %s", exc)
        return f"Execution error: {str(exc)}"


def web_search(query: str, max_results: int = 5) -> str:
    """Search the web using DuckDuckGo and return top formatted results."""
    query_str = (query or "").strip()
    if not query_str:
        return "Error: No search query provided."

    try:
        # Try ddgs first, fallback to duckduckgo_search
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS

        results = []
        try:
            raw_results = DDGS().text(query_str, max_results=max_results)
            if raw_results:
                results = list(raw_results)
        except Exception as ddg_err:
            logger.warning("DDGS text search error: %s. Attempting fallback...", ddg_err)
            # Try news search if text search is blocked or empty
            try:
                raw_news = DDGS().news(query_str, max_results=max_results)
                if raw_news:
                    results = list(raw_news)
            except Exception:
                pass

        if not results:
            return f"No results found for query: '{query_str}'"

        formatted = []
        for i, r in enumerate(results[:max_results], 1):
            title = r.get("title") or "No title"
            url = r.get("href") or r.get("url") or ""
            snippet = r.get("body") or r.get("snippet") or ""
            formatted.append(f"{i}. Title: {title}\n   URL: {url}\n   Snippet: {snippet}")

        return "\n\n".join(formatted)

    except Exception as exc:
        logger.error("web_search failed: %s", exc)
        return f"Search failed: {str(exc)}"
