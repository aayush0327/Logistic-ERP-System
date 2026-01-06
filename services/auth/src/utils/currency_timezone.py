"""
Shared utilities for currency and timezone handling
Can be used across all microservices
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import json


def format_currency(
    amount: float,
    currency_config: Dict[str, Any],
    locale: str = "en-US"
) -> str:
    """
    Format currency amount according to tenant configuration

    Args:
        amount: The amount to format
        currency_config: Currency config from tenant.settings
        locale: Locale for number formatting (default: en-US)

    Returns:
        Formatted currency string
    """
    symbol = currency_config.get("symbol", "$")
    position = currency_config.get("position", "before")
    decimal_places = currency_config.get("decimal_places", 2)
    thousands_sep = currency_config.get("thousands_separator", ",")
    decimal_sep = currency_config.get("decimal_separator", ".")

    # Format number with specified separators
    formatted_number = f"{amount:,.{decimal_places}f}"
    # Replace default separators with custom ones
    formatted_number = formatted_number.replace(",", "X").replace(".", "Y")
    formatted_number = formatted_number.replace("X", thousands_sep).replace("Y", decimal_sep)

    # Add symbol
    if position == "before":
        return f"{symbol}{formatted_number}"
    else:
        return f"{formatted_number}{symbol}"


def convert_utc_to_tenant_timezone(
    utc_datetime: datetime,
    timezone_iana: str,
    timezone_enabled: bool = True
) -> datetime:
    """
    Convert UTC datetime to tenant timezone

    Args:
        utc_datetime: UTC datetime object
        timezone_iana: IANA timezone identifier (e.g., "Africa/Dar_es_Salaam")
        timezone_enabled: Whether timezone conversion is enabled

    Returns:
        Datetime in tenant timezone (or UTC if disabled)
    """
    if not timezone_enabled:
        return utc_datetime

    # Ensure input is timezone-aware UTC
    if utc_datetime.tzinfo is None:
        utc_datetime = utc_datetime.replace(tzinfo=timezone.utc)

    # Convert to tenant timezone
    try:
        import pytz
        tz = pytz.timezone(timezone_iana)
        return utc_datetime.astimezone(tz)
    except ImportError:
        # If pytz not available, return UTC
        return utc_datetime


def parse_tenant_settings(settings_json: Optional[str]) -> Dict[str, Any]:
    """
    Parse tenant settings JSON

    Args:
        settings_json: JSON string from tenant.settings column

    Returns:
        Parsed settings dict with defaults
    """
    if not settings_json:
        return get_default_tenant_settings()

    try:
        settings = json.loads(settings_json)
        # Ensure required keys exist
        if "currency" not in settings:
            settings["currency"] = get_default_currency_config()
        if "timezone" not in settings:
            settings["timezone"] = get_default_timezone_config()
        return settings
    except json.JSONDecodeError:
        return get_default_tenant_settings()


def get_default_tenant_settings() -> Dict[str, Any]:
    """Get default tenant settings"""
    return {
        "currency": get_default_currency_config(),
        "timezone": get_default_timezone_config()
    }


def get_default_currency_config() -> Dict[str, Any]:
    """Get default currency config (TZS for Tanzania)"""
    return {
        "code": "TZS",
        "symbol": "TSh",
        "name": "Tanzanian Shilling",
        "position": "before",
        "decimal_places": 2,
        "thousands_separator": ",",
        "decimal_separator": "."
    }


def get_default_timezone_config() -> Dict[str, Any]:
    """Get default timezone config (Africa/Dar_es_Salaam)"""
    return {
        "iana": "Africa/Dar_es_Salaam",
        "enabled": True
    }


def format_datetime_for_tenant(
    datetime_obj: datetime,
    timezone_config: Dict[str, Any],
    format_string: str = "%Y-%m-%d %H:%M:%S %Z"
) -> str:
    """
    Format datetime according to tenant timezone configuration

    Args:
        datetime_obj: Datetime object (should be UTC)
        timezone_config: Timezone config from tenant.settings
        format_string: Python strftime format string

    Returns:
        Formatted datetime string
    """
    if not timezone_config.get("enabled", True):
        # Return UTC if timezone disabled
        if datetime_obj.tzinfo is None:
            datetime_obj = datetime_obj.replace(tzinfo=timezone.utc)
        return datetime_obj.strftime(format_string)

    # Convert to tenant timezone
    converted_dt = convert_utc_to_tenant_timezone(
        datetime_obj,
        timezone_config.get("iana", "Africa/Dar_es_Salaam"),
        timezone_config.get("enabled", True)
    )

    return converted_dt.strftime(format_string)


def validate_currency_code(currency_code: str) -> bool:
    """
    Validate ISO 4217 currency code

    Args:
        currency_code: 3-letter currency code

    Returns:
        True if valid, False otherwise
    """
    try:
        import pycountry
        return pycountry.currencies.get(alpha_3=currency_code.upper()) is not None
    except ImportError:
        # If pycountry not available, just check format
        return len(currency_code) == 3 and currency_code.isalpha()


def validate_timezone(timezone_iana: str) -> bool:
    """
    Validate IANA timezone identifier

    Args:
        timezone_iana: IANA timezone identifier (e.g., "Africa/Dar_es_Salaam")

    Returns:
        True if valid, False otherwise
    """
    try:
        import pytz
        return timezone_iana in pytz.all_timezones
    except ImportError:
        # If pytz not available, assume valid
        return True
