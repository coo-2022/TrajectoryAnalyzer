"""
失效分析引擎
"""
import re
from typing import Callable, Dict, Any, Tuple, List


class FailureAnalysisEngine:
    """失效分析引擎"""

    def __init__(self, max_turn_limit: int = 8, context_char_limit: int = 32000):
        self.config = {
            "max_turn_limit": max_turn_limit,
            "context_char_limit": context_char_limit
        }
        self._rules = []

    def register_rule(self, name: str, check_func: Callable, priority: int = 10):
        """注册分析规则"""
        self._rules.append({"name": name, "func": check_func, "priority": priority})
        self._rules.sort(key=lambda x: x['priority'])

    def analyze(self, steps: List[Dict], stats_context: Dict[str, Any]) -> Tuple[str, str]:
        """分析轨迹"""
        full_context = {**self.config, **stats_context}

        for rule in self._rules:
            category, root_cause = rule['func'](steps, full_context)
            if category:
                return category, root_cause

        return "4. Model Capability Issue", "4.0 Unknown Error / General Response Error"


# 规则检测函数
def check_format_error(steps: List[Dict], ctx: Dict) -> Tuple[str, str]:
    """检测格式错误（不匹配的工具标签）"""
    VALID_TOOL_PATTERNS = [r"<\w+>.*?</\w+>"]
    STRONG_INTENT_KEYWORDS = ["<ctrl3605>", "</ctrl3613>", "[tool]", "<function>"]

    for step in steps:
        role = step.get('role', '')
        content = str(step.get('content', ''))

        if role != 'assistant':
            continue

        has_intent = any(k in content for k in STRONG_INTENT_KEYWORDS)
        if not has_intent:
            continue

        is_valid_format = False
        for pattern in VALID_TOOL_PATTERNS:
            if re.search(pattern, content, re.DOTALL):
                is_valid_format = True
                break

        if not is_valid_format:
            if content.count('<ctrl3614>') != content.count('</ctrl3615>'):
                return "1. Trajectory Anomaly (Format)", "1.1 Mismatched Tool Tags"
            else:
                return "1. Trajectory Anomaly (Format)", "1.3 Invalid Tool Format"

    return None, None


def check_repeated_tool_error(steps: List[Dict], ctx: Dict) -> Tuple[str, str]:
    """检测重复工具错误"""
    if not steps:
        return None, None

    ERROR_KEYWORDS = ["tool call parsing failed", "execution failed", "error:"]
    error_count = 0

    for step in steps:
        role = step.get('role', '')
        content = str(step.get('content', '')).lower().strip()

        if role in ['tool', 'user'] and any(k in content for k in ERROR_KEYWORDS):
            error_count += 1

    last_step = steps[-1]
    last_content = str(last_step.get('content', '')).lower()
    has_finished = 'finish' in last_content and '<ctrl3616>' in last_content

    if error_count > 2 and not has_finished:
        return "1. Trajectory Anomaly (Loop)", f"3.2 Lengthy due to Repeated Tool Failures (> 2 errors)"

    return None, None


def check_repeater(steps: List[Dict], ctx: Dict) -> Tuple[str, str]:
    """检测重复输出模式"""
    if len(steps) < 4:
        return None, None

    last_assistant_contents = [s['content'] for s in steps if s['role'] == 'assistant'][-3:]

    if len(last_assistant_contents) >= 3:
        if len(set(last_assistant_contents)) == 1:
            return "1. Trajectory Anomaly (Loop)", "3.1 Repetitive Output / Repeater"

    return None, None


def check_hanging_assistant(steps: List[Dict], ctx: Dict) -> Tuple[str, str]:
    """检测助手挂起（没有action）"""
    if not steps:
        return None, None

    last_step = steps[-1]
    if last_step.get('role') != 'assistant':
        return None, None

    content = str(last_step.get('content', ''))
    has_action = '<ctrl3617>' in content

    if not has_action:
        return "1. Trajectory Anomaly (Truncated)", "4.3 No Action after Thought / Abnormal Stop (Possible Truncation)"

    return None, None


def check_unverified_success(steps: List[Dict], ctx: Dict) -> Tuple[str, str]:
    """检测过度自信（未验证就声称成功）"""
    if not steps:
        return None, None

    last_step = steps[-1]
    if last_step.get('role') != 'assistant':
        return None, None

    content = str(last_step.get('content', '')).lower()
    is_finish_call = False

    if '<ctrl3618>' in content and 'finish' in content:
        is_finish_call = True

    if is_finish_call:
        if "假设" in content or "无法验证" in content or "assume" in content:
            return "2. Trajectory Error (Logic)", "7.1 Model Overconfidence / False Positive Finish"

    return None, None


def check_context_limit(steps: List[Dict], ctx: Dict) -> Tuple[str, str]:
    """检测上下文长度超限"""
    if len(steps) > ctx.get('max_turn_limit', 99) * 2:
        return "1. Trajectory Anomaly (Length)", "3.3 Turn Limit Exceeded"

    return None, None


def is_success_or_failed(reward: float, threshold: float = 0.5) -> bool:
    """判断是否成功"""
    return float(reward) > threshold


def setup_engine() -> FailureAnalysisEngine:
    """创建并配置分析引擎"""
    engine = FailureAnalysisEngine()
    engine.register_rule("Format Error", check_format_error, 10)
    engine.register_rule("Tool Exec Error", check_repeated_tool_error, 20)
    engine.register_rule("Repeater", check_repeater, 30)
    engine.register_rule("Hanging", check_hanging_assistant, 45)
    engine.register_rule("Overconfidence", check_unverified_success, 50)
    engine.register_rule("Context Limit", check_context_limit, 40)
    return engine
