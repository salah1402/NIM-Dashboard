import pytest
from backend.tools import execute_python, PYTHON_TOOL_SCHEMA


def test_execute_python_basic_math():
    code = "print(2 + 2)"
    result = execute_python(code)
    assert result.strip() == "4"


def test_execute_python_fibonacci():
    code = """
a, b = 0, 1
for _ in range(10):
    a, b = b, a + b
print(a)
"""
    result = execute_python(code)
    assert result.strip() == "55"


def test_execute_python_stderr_captured():
    code = "import sys; sys.stderr.write('Warning message\\n'); print('Normal output')"
    result = execute_python(code)
    assert "Warning message" in result
    assert "Normal output" in result


def test_execute_python_timeout():
    code = "import time; time.sleep(5)"
    result = execute_python(code, timeout_s=1)
    assert "timed out" in result.lower()


def test_execute_python_empty():
    result = execute_python("")
    assert "No code provided" in result


def test_python_tool_schema():
    assert PYTHON_TOOL_SCHEMA["type"] == "function"
    assert PYTHON_TOOL_SCHEMA["function"]["name"] == "execute_python"
    assert "code" in PYTHON_TOOL_SCHEMA["function"]["parameters"]["properties"]
