"""Resources API endpoints - dummy data service"""

from datetime import date
from fastapi import APIRouter

from src.schemas import Truck, Driver, Order, Branch

router = APIRouter()

# Dummy data - in production, this would come from other services
TRUCKS = [
    Truck(id="TRK-001", plate="ABC-1234", model="Ford Transit", capacity=2000, status="available"),
    Truck(id="TRK-002", plate="XYZ-5678", model="Mercedes Sprinter", capacity=3000, status="available"),
    Truck(id="TRK-003", plate="DEF-9012", model="Iveco Daily", capacity=5000, status="available"),
    Truck(id="TRK-004", plate="GHI-3456", model="Isuzu NPR", capacity=2500, status="available"),
    Truck(id="TRK-005", plate="JKL-7890", model="Ford Transit", capacity=2000, status="available"),
]

DRIVERS = [
    Driver(id="DRV-001", name="Mike Johnson", phone="+201234567890", license="DL-001234", experience="5 years", status="active"),
    Driver(id="DRV-002", name="Sarah Ahmed", phone="+201112223333", license="DL-002345", experience="3 years", status="active"),
    Driver(id="DRV-003", name="Ali Hassan", phone="+201445556666", license="DL-003456", experience="7 years", status="active"),
    Driver(id="DRV-004", name="Mohamed Ali", phone="+201556667778", license="DL-004567", experience="4 years", status="active"),
]

ORDERS = [
    Order(
        id="ORD-001",
        customer="John's Farm",
        customerAddress="123 Farm Road, Rural Area, Cairo",
        status="approved",
        total=2500,
        weight=850,
        volume=1200,
        date=date(2024, 1, 15),
        priority="high",
        items=15,
        address="123 Farm Road, Rural Area, Cairo"
    ),
    Order(
        id="ORD-002",
        customer="Green Valley Store",
        customerAddress="456 Market St, City Center",
        status="approved",
        total=1800,
        weight=650,
        volume=950,
        date=date(2024, 1, 16),
        priority="medium",
        items=8,
        address="456 Market St, City Center"
    ),
    Order(
        id="ORD-003",
        customer="City Mart",
        customerAddress="789 Main St, Downtown",
        status="approved",
        total=3200,
        weight=1200,
        volume=1800,
        date=date(2024, 1, 17),
        priority="high",
        items=22,
        address="789 Main St, Downtown"
    ),
    Order(
        id="ORD-004",
        customer="SuperStore Chain",
        customerAddress="321 Commercial Ave, Industrial Zone",
        status="approved",
        total=4500,
        weight=1800,
        volume=2400,
        date=date(2024, 1, 18),
        priority="low",
        items=35,
        address="321 Commercial Ave, Industrial Zone"
    ),
    Order(
        id="ORD-005",
        customer="Local Pharmacy",
        customerAddress="555 Health St, Medical District",
        status="approved",
        total=1500,
        weight=300,
        volume=450,
        date=date(2024, 1, 19),
        priority="high",
        items=12,
        address="555 Health St, Medical District"
    ),
    Order(
        id="ORD-006",
        customer="Heavy Industry Corp",
        customerAddress="789 Industrial Blvd, Manufacturing Zone",
        status="approved",
        total=50000,
        weight=10000,
        volume=2500,
        date=date(2024, 1, 20),
        priority="high",
        items=50,
        address="789 Industrial Blvd, Manufacturing Zone"
    ),
]

BRANCHES = [
    Branch(id="BR-001", code="NB001", name="North Branch", location="Cairo, Egypt", manager="Ahmed Ali", phone="+201000000010", status="active"),
    Branch(id="BR-002", code="SB001", name="South Branch", location="Giza, Egypt", manager="Mohamed Hassan", phone="+201000000011", status="active"),
    Branch(id="BR-003", code="EB001", name="East Branch", location="Suez, Egypt", manager="Khalid Omar", phone="+201000000012", status="active"),
    Branch(id="BR-004", code="WB001", name="West Branch", location="Alexandria, Egypt", manager="Sami Mahmoud", phone="+201000000013", status="active"),
]


@router.get("/trucks", response_model=list[Truck])
async def get_trucks():
    """Get all available trucks"""
    return [truck for truck in TRUCKS if truck.status == "available"]


@router.get("/drivers", response_model=list[Driver])
async def get_drivers():
    """Get all available drivers"""
    return [driver for driver in DRIVERS if driver.status == "active"]


@router.get("/orders", response_model=list[Order])
async def get_orders():
    """Get all approved orders"""
    return [order for order in ORDERS if order.status == "approved"]


@router.get("/branches", response_model=list[Branch])
async def get_branches():
    """Get all active branches"""
    return [branch for branch in BRANCHES if branch.status == "active"]