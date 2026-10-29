import sys
import subprocess
import logging

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
