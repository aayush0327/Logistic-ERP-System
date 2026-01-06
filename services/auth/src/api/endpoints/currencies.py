"""
Currencies endpoint - provides ISO 4217 currency data from pycountry
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import pycountry
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Currency symbol mapping for common currencies (pycountry doesn't provide symbols)
CURRENCY_SYMBOLS = {
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "JPY": "¥",
    "INR": "₹",
    "CNY": "¥",
    "RUB": "₽",
    "KRW": "₽",
    "TRY": "₺",
    "UAH": "₴",
    "THB": "฿",
    "VND": "₫",
    "IDR": "Rp",
    "MYR": "RM",
    "PHP": "₱",
    "SGD": "S$",
    "HKD": "HK$",
    "AUD": "A$",
    "CAD": "C$",
    "NZD": "NZ$",
    "CHF": "Fr",
    "SEK": "kr",
    "NOK": "kr",
    "DKK": "kr",
    "PLN": "zł",
    "CZK": "Kč",
    "HUF": "Ft",
    "RON": "lei",
    "BGN": "лв",
    # East African currencies
    "TZS": "TSh",  # Tanzanian Shilling
    "KES": "KSh",  # Kenyan Shilling
    "UGX": "USh",  # Ugandan Shilling
    "RWF": "RF",   # Rwandan Franc
    "BIF": "FBu",  # Burundian Franc
    "SOS": "Sh",   # Somali Shilling
    "ETB": "Br",   # Ethiopian Birr
    # Middle East currencies
    "AED": "د.إ",  # UAE Dirham
    "SAR": "ر.س",  # Saudi Riyal
    "QAR": "ر.ق",  # Qatari Riyal
    "KWD": "د.ك",  # Kuwaiti Dinar
    "BHD": "د.ب",  # Bahraini Dinar
    "OMR": "ر.ع.",  # Omani Rial
    "EGP": "Egp",  # Egyptian Pound
    # Other common currencies
    "ZAR": "R",
    "NGN": "₦",
    "GHS": "₵",
    "XOF": "CFA",
    "XAF": "FCFA",
    "XCD": "$",
    "BRL": "R$",
    "ARS": "$",
    "CLP": "$",
    "COP": "$",
    "MXN": "$",
    "PEN": "S/",
    "BOB": "Bs.",
    "PYG": "₲",
    "UYU": "$",
    "CUP": "$",
    "DOP": "$",
    # Nordic
    "ISK": "kr",
    # Others
    "ILS": "₪",
    "CZK": "Kč",
}


@router.get("/currencies")
async def get_all_currencies() -> List[Dict[str, Any]]:
    """
    Get all supported currencies from pycountry (ISO 4217)

    Returns a list of currencies with:
    - code: ISO 4217 currency code (e.g., "USD", "EUR")
    - symbol: Currency symbol (e.g., "$", "€")
    - name: Currency name (e.g., "US Dollar", "Euro")
    - numeric_code: ISO 4217 numeric code
    - decimal_places: Standard decimal places (2 for most, 0 for JPY, etc.)
    """
    currencies = []

    try:
        for currency in pycountry.currencies:
            code = currency.alpha_3
            symbol = CURRENCY_SYMBOLS.get(code, code)  # Use code as fallback

            # Determine standard decimal places
            decimal_places = 2  # Default
            if code in ["JPY", "ISK"]:  # Currencies with no decimal places
                decimal_places = 0

            currencies.append({
                "code": code,
                "symbol": symbol,
                "name": currency.name,
                "numeric_code": getattr(currency, 'numeric', None),
                "decimal_places": decimal_places,
            })

        # Sort by currency code
        currencies.sort(key=lambda x: x["code"])

        return currencies

    except Exception as e:
        logger.error(f"Error fetching currencies: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch currencies: {str(e)}"
        )


@router.get("/currencies/{currency_code}")
async def get_currency(currency_code: str) -> Dict[str, Any]:
    """
    Get details for a specific currency

    Args:
        currency_code: ISO 4217 currency code (e.g., "USD", "EUR")

    Returns:
        Currency details including symbol, name, decimal places
    """
    try:
        currency = pycountry.currencies.get(alpha_3=currency_code.upper())

        if not currency:
            raise HTTPException(
                status_code=404,
                detail=f"Currency code '{currency_code}' not found"
            )

        symbol = CURRENCY_SYMBOLS.get(currency_code.upper(), currency_code.upper())

        # Determine standard decimal places
        decimal_places = 2
        if currency_code.upper() in ["JPY", "ISK"]:
            decimal_places = 0

        return {
            "code": currency.alpha_3,
            "symbol": symbol,
            "name": currency.name,
            "numeric_code": getattr(currency, 'numeric', None),
            "decimal_places": decimal_places,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching currency {currency_code}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch currency: {str(e)}"
        )
