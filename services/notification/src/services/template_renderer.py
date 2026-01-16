# Template Renderer - Renders notification message templates
import logging
from typing import Dict, Any
import re

logger = logging.getLogger(__name__)


class TemplateRenderer:
    """
    Simple template renderer for notification messages.

    Uses {{variable}} syntax for template variables.
    """

    def render(self, template: str, data: Dict[str, Any]) -> str:
        """
        Render a template with the provided data.

        Example:
            template = "Order #{{order_number}} has been approved"
            data = {"order_number": "ORD-001"}
            result = "Order #ORD-001 has been approved"

        Args:
            template: Template string with {{variable}} placeholders
            data: Dictionary of values to substitute

        Returns:
            Rendered string
        """
        try:
            # Find all {{variable}} patterns
            pattern = r"\{\{(\w+)\}\}"

            def replace_var(match):
                var_name = match.group(1)
                value = data.get(var_name, "")
                return str(value) if value is not None else match.group(0)

            result = re.sub(pattern, replace_var, template)
            return result

        except Exception as e:
            logger.error(f"Error rendering template: {e}")
            # Return template as-is if rendering fails
            return template
