"""
Timezones endpoint - provides IANA timezone data from pytz
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from datetime import datetime
import pytz
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Common timezone groupings for better UI organization
TIMEZONE_GROUPS = {
    "Africa": [
        "Africa/Cairo",
        "Africa/Casablanca",
        "Africa/Johannesburg",
        "Africa/Lagos",
        "Africa/Nairobi",
        "Africa/Tripoli",
        # East Africa
        "Africa/Dar_es_Salaam",  # Tanzania
        "Africa/Kampala",         # Uganda
        "Africa/Kigali",          # Rwanda
        "Africa/Bujumbura",       # Burundi
        "Africa/Mogadishu",       # Somalia
        "Africa/Addis_Ababa",     # Ethiopia
    ],
    "Americas": [
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/Toronto",
        "America/Vancouver",
        "America/Mexico_City",
        "America/Sao_Paulo",
        "America/Buenos_Aires",
        "America/Lima",
        "America/Bogota",
        "America/Santiago",
    ],
    "Asia": [
        "Asia/Dubai",
        "Asia/Riyadh",
        "Asia/Qatar",
        "Asia/Kuwait",
        "Asia/Bahrain",
        "Asia/Muscat",
        "Asia/Tehran",
        "Asia/Karachi",
        "Asia/Mumbai",
        "Asia/Delhi",
        "Asia/Kolkata",
        "Asia/Dhaka",
        "Asia/Bangkok",
        "Asia/Singapore",
        "Asia/Hong_Kong",
        "Asia/Shanghai",
        "Asia/Tokyo",
        "Asia/Seoul",
        "Asia/Manila",
        "Asia/Jakarta",
        "Asia/Kathmandu",
        "Asia/Colombo",
    ],
    "Europe": [
        "Europe/London",
        "Europe/Paris",
        "Europe/Berlin",
        "Europe/Rome",
        "Europe/Madrid",
        "Europe/Amsterdam",
        "Europe/Brussels",
        "Europe/Vienna",
        "Europe/Zurich",
        "Europe/Stockholm",
        "Europe/Oslo",
        "Europe/Copenhagen",
        "Europe/Helsinki",
        "Europe/Athens",
        "Europe/Moscow",
        "Europe/Istanbul",
        "Europe/Warsaw",
        "Europe/Prague",
    ],
    "Oceania": [
        "Australia/Sydney",
        "Australia/Melbourne",
        "Australia/Brisbane",
        "Australia/Perth",
        "Australia/Adelaide",
        "Pacific/Auckland",
        "Pacific/Fiji",
    ],
}


@router.get("/timezones")
async def get_all_timezones(grouped: bool = False) -> List[Dict[str, Any]]:
    """
    Get all supported IANA timezones from pytz

    Args:
        grouped: If true, return timezones grouped by region (Africa, Americas, Asia, etc.)
                If false, return flat list with all timezones

    Returns:
        List of timezones with:
        - iana: IANA timezone identifier (e.g., "Africa/Nairobi", "America/New_York")
        - offset: Current UTC offset in hours (e.g., "+03:00", "-05:00")
        - label: Human-readable label (e.g., "EAT - East Africa Time (+03:00)")
    """
    try:
        if grouped:
            return get_grouped_timezones()
        else:
            return get_flat_timezone_list()

    except Exception as e:
        logger.error(f"Error fetching timezones: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch timezones: {str(e)}"
        )


def get_flat_timezone_list() -> List[Dict[str, Any]]:
    """Get flat list of all timezones"""
    timezones = []
    now = datetime.now()

    for tz_name in sorted(pytz.all_timezones):
        try:
            tz = pytz.timezone(tz_name)
            # Get current offset
            offset = tz.utcoffset(now)
            offset_hours = offset.total_seconds() / 3600

            # Format offset as +HH:MM or -HH:MM
            offset_str = format_offset(offset_hours)

            # Get timezone abbreviation
            tz_abbrev = now.astimezone(tz).tzname()

            timezones.append({
                "iana": tz_name,
                "offset": offset_str,
                "label": f"{tz_name} ({tz_abbrev}) {offset_str}",
            })
        except Exception as e:
            logger.warning(f"Error processing timezone {tz_name}: {e}")
            continue

    return timezones


def get_grouped_timezones() -> List[Dict[str, Any]]:
    """Get timezones grouped by region"""
    grouped = []
    now = datetime.now()

    for region, tz_names in TIMEZONE_GROUPS.items():
        region_timezones = []
        for tz_name in tz_names:
            try:
                tz = pytz.timezone(tz_name)
                offset = tz.utcoffset(now)
                offset_hours = offset.total_seconds() / 3600
                offset_str = format_offset(offset_hours)
                tz_abbrev = now.astimezone(tz).tzname()

                region_timezones.append({
                    "iana": tz_name,
                    "offset": offset_str,
                    "label": f"{tz_name} ({tz_abbrev}) {offset_str}",
                })
            except Exception as e:
                logger.warning(f"Error processing timezone {tz_name}: {e}")
                continue

        if region_timezones:
            grouped.append({
                "region": region,
                "timezones": region_timezones,
            })

    return grouped


def format_offset(hours: float) -> str:
    """Format offset as +HH:MM or -HH:MM"""
    sign = "+" if hours >= 0 else "-"
    hours_abs = abs(hours)
    h = int(hours_abs)
    m = int((hours_abs - h) * 60)
    return f"{sign}{h:02d}:{m:02d}"


@router.get("/timezones/{timezone_iana}")
async def get_timezone(timezone_iana: str) -> Dict[str, Any]:
    """
    Get details for a specific timezone

    Args:
        timezone_iana: IANA timezone identifier (e.g., "Africa/Nairobi", "America/New_York")

    Returns:
        Timezone details including current offset and label
    """
    try:
        if timezone_iana not in pytz.all_timezones:
            raise HTTPException(
                status_code=404,
                detail=f"Timezone '{timezone_iana}' not found"
            )

        tz = pytz.timezone(timezone_iana)
        now = datetime.now()

        # Get current offset
        offset = tz.utcoffset(now)
        offset_hours = offset.total_seconds() / 3600
        offset_str = format_offset(offset_hours)

        # Get timezone abbreviation
        tz_abbrev = now.astimezone(tz).tzname()

        return {
            "iana": timezone_iana,
            "offset": offset_str,
            "abbreviation": tz_abbrev,
            "label": f"{timezone_iana} ({tz_abbrev}) {offset_str}",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching timezone {timezone_iana}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch timezone: {str(e)}"
        )
