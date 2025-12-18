"""
Order service - Business logic for order management
"""
from datetime import datetime
from typing import List, Tuple, Optional, Dict, Any
from uuid import UUID, uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, asc, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from src.models.order import Order, OrderStatus, OrderType, PaymentType
from src.models.order_item import OrderItem
from src.models.order_status_history import OrderStatusHistory
from src.schemas import (
    OrderCreate,
    OrderUpdate,
    OrderQueryParams,
)
from src.config_local import OrdersSettings

settings = OrdersSettings()


class OrderService:
    """Service for managing orders"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_orders_paginated(
        self,
        filters: List = None,
        order_by: Any = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[Order], int]:
        """Get paginated orders with filters"""
        query = select(Order)

        if filters:
            query = query.where(and_(*filters))

        # Get total count
        count_query = select(func.count(Order.id))
        if filters:
            count_query = count_query.where(and_(*filters))
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        # Apply ordering and pagination
        if order_by is not None:
            query = query.order_by(order_by)


        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        orders = result.scalars().unique().all()

        return list(orders), total

    async def get_order_by_id(
        self,
        order_id: UUID,
        tenant_id: UUID
    ) -> Optional[Order]:
        """Get order by ID and tenant"""
        query = select(Order).where(
            and_(
                Order.id == order_id,
                Order.tenant_id == tenant_id,
                Order.is_active == True
            )
        ).options(
            selectinload(Order.items),
            selectinload(Order.documents),
            selectinload(Order.status_history)
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _fetch_product_details(self, product_id: UUID) -> Dict[str, Any]:
        """
        Fetch product details from product service.
        This is a mock implementation - replace with actual API call to product service.
        """
        # TODO: Replace with actual product service API call
        # For now, return mock data
        return {
            "id": str(product_id),
            "name": "Mock Product",
            "code": "MP-001",
            "description": "Mock product description",
            "unit_price": 100.0,
            "weight": 1.5,
            "volume": 0.002,
            "unit": "pcs"
        }

    async def create_order(
        self,
        order_data: OrderCreate,
        user_id: UUID
    ) -> Order:
        """Create a new order with items in a transaction-safe manner"""
        try:
            # Validate order_number uniqueness within tenant
            existing_order_query = select(Order.id).where(
                and_(
                    Order.tenant_id == order_data.tenant_id,
                    Order.order_number == order_data.order_number
                )
            )
            existing_result = await self.db.execute(existing_order_query)
            if existing_result.scalar():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Order number '{order_data.order_number}' already exists"
                )

            # Initialize order totals (will be calculated from items)
            total_weight = 0.0
            total_volume = 0.0
            package_count = 0
            total_amount = 0.0

            # Process items and calculate totals
            order_items = []
            if order_data.items:
                for item_data in order_data.items:
                    # Fetch product details from product service
                    product = await self._fetch_product_details(item_data.product_id)

                    # Calculate item totals
                    item_total_price = product["unit_price"] * item_data.quantity
                    item_total_weight = product["weight"] * item_data.quantity
                    item_total_volume = product["volume"] * item_data.quantity

                    # Update order totals
                    total_weight += item_total_weight
                    total_volume += item_total_volume
                    package_count += item_data.quantity
                    total_amount += item_total_price

                    # Create order item with product snapshot
                    order_item = OrderItem(
                        product_id=item_data.product_id,
                        product_name=product["name"],
                        product_code=product.get("code", ""),
                        description=product.get("description", ""),
                        quantity=item_data.quantity,
                        unit=product.get("unit", "pcs"),
                        unit_price=product["unit_price"],
                        total_price=item_total_price,
                        weight=product["weight"],
                        volume=product["volume"],
                    )
                    order_items.append(order_item)

            # Create order with calculated totals
            order = Order(
                order_number=order_data.order_number,  # Use frontend order number
                tenant_id=order_data.tenant_id,
                customer_id=order_data.customer_id,
                branch_id=order_data.branch_id,
                order_type=order_data.order_type,
                status=OrderStatus.DRAFT,
                priority=order_data.priority,
                pickup_address=order_data.pickup_address,
                pickup_contact_name=order_data.pickup_contact_name,
                pickup_contact_phone=order_data.pickup_contact_phone,
                pickup_city=order_data.pickup_city,
                pickup_state=order_data.pickup_state,
                pickup_pincode=order_data.pickup_pincode,
                delivery_address=order_data.delivery_address,
                delivery_contact_name=order_data.delivery_contact_name,
                delivery_contact_phone=order_data.delivery_contact_phone,
                delivery_city=order_data.delivery_city,
                delivery_state=order_data.delivery_state,
                delivery_pincode=order_data.delivery_pincode,
                # Use calculated totals from items
                total_weight=total_weight,
                total_volume=total_volume,
                package_count=package_count,
                total_amount=total_amount,
                payment_type=order_data.payment_type,
                special_instructions=order_data.special_instructions,
                delivery_instructions=order_data.delivery_instructions,
                pickup_date=order_data.pickup_date,
                delivery_date=order_data.delivery_date,
                created_by=user_id,
                updated_by=user_id
            )

            # Add order to session
            self.db.add(order)

            # Flush to get order ID
            await self.db.flush()

            # Add all order items with the order_id
            for item in order_items:
                item.order_id = order.id
                self.db.add(item)

            # Create status history entry
            status_history = OrderStatusHistory(
                order_id=order.id,
                from_status=None,  # Initial creation
                to_status=OrderStatus.DRAFT,
                changed_by=user_id,
                reason="Order created",
                notes=f"Order {order.order_number} created with {len(order_items)} items"
            )
            self.db.add(status_history)

            # Commit transaction
            await self.db.commit()

            # Query the order back with all relationships loaded
            result = await self.db.execute(
                select(Order)
                .options(
                    selectinload(Order.items),
                    selectinload(Order.documents),
                    selectinload(Order.status_history)
                )
                .where(Order.id == order.id)
            )
            order_with_relationships = result.scalar_one()

            return order_with_relationships

        except Exception as e:
            # Rollback transaction on error
            await self.db.rollback()
            raise e

    async def update_order(
        self,
        order_id: UUID,
        order_data: OrderUpdate,
        user_id: UUID
    ) -> Order:
        """Update an existing order"""
        query = select(Order).where(Order.id == order_id)
        result = await self.db.execute(query)
        order = result.scalar_one_or_none()

        if not order:
            raise ValueError("Order not found")

        # Update order fields
        update_data = order_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(order, field, value)

        order.updated_by = user_id
        order.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(order)

        return order

    async def delete_order(self, order_id: UUID) -> None:
        """Soft delete an order"""
        query = select(Order).where(Order.id == order_id)
        result = await self.db.execute(query)
        order = result.scalar_one_or_none()

        if not order:
            raise ValueError("Order not found")

        order.is_active = False
        order.updated_at = datetime.utcnow()

        await self.db.commit()

    async def submit_order(
        self,
        order_id: UUID,
        user_id: UUID,
        tenant_id: UUID
    ) -> Order:
        """Submit order for finance approval"""
        order = await self.get_order_by_id(order_id, tenant_id)
        if not order:
            raise ValueError("Order not found")

        if order.status != OrderStatus.DRAFT:
            raise ValueError("Order cannot be submitted in current status")

        # Update status
        await self._update_order_status(
            order,
            OrderStatus.SUBMITTED,
            user_id,
            "Order submitted for finance approval"
        )

        await self.db.commit()
        await self.db.refresh(order)

        # TODO: Send notification to finance manager

        return order

    async def finance_approval(
        self,
        order_id: UUID,
        approved: bool,
        user_id: UUID,
        tenant_id: UUID,
        reason: Optional[str] = None,
        notes: Optional[str] = None,
        payment_type: Optional[PaymentType] = None
    ) -> Order:
        """Approve or reject order in finance"""
        order = await self.get_order_by_id(order_id, tenant_id)
        if not order:
            raise ValueError("Order not found")

        if order.status != OrderStatus.SUBMITTED:
            raise ValueError("Order is not ready for finance approval")

        if approved:
            new_status = OrderStatus.FINANCE_APPROVED
            order.finance_approved_by = user_id
            order.finance_approved_at = datetime.utcnow()
            if payment_type:
                order.payment_type = payment_type
            message = "Order approved by finance"
        else:
            new_status = OrderStatus.FINANCE_REJECTED
            order.finance_rejected_reason = reason
            message = "Order rejected by finance"

        await self._update_order_status(
            order,
            new_status,
            user_id,
            message,
            reason
        )

        await self.db.commit()
        await self.db.refresh(order)

        # TODO: Send notification to relevant parties

        return order

    async def logistics_approval(
        self,
        order_id: UUID,
        approved: bool,
        user_id: UUID,
        tenant_id: UUID,
        reason: Optional[str] = None,
        notes: Optional[str] = None,
        driver_id: Optional[UUID] = None,
        trip_id: Optional[UUID] = None
    ) -> Order:
        """Approve or reject order in logistics"""
        order = await self.get_order_by_id(order_id, tenant_id)
        if not order:
            raise ValueError("Order not found")

        if order.status != OrderStatus.FINANCE_APPROVED:
            raise ValueError("Order is not ready for logistics approval")

        if approved:
            new_status = OrderStatus.LOGISTICS_APPROVED
            order.logistics_approved_by = user_id
            order.logistics_approved_at = datetime.utcnow()
            if driver_id:
                order.driver_id = driver_id
            if trip_id:
                order.trip_id = trip_id
            message = "Order approved by logistics"
        else:
            new_status = OrderStatus.LOGISTICS_REJECTED
            order.logistics_rejected_reason = reason
            message = "Order rejected by logistics"

        await self._update_order_status(
            order,
            new_status,
            user_id,
            message,
            reason
        )

        await self.db.commit()
        await self.db.refresh(order)

        # TODO: Send notification to driver and branch manager

        return order

    async def update_order_status(
        self,
        order_id: UUID,
        new_status: OrderStatus,
        user_id: UUID,
        tenant_id: UUID,
        reason: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Order:
        """Update order status"""
        order = await self.get_order_by_id(order_id, tenant_id)
        if not order:
            raise ValueError("Order not found")

        # Validate status transition
        if not self._is_valid_status_transition(order.status, new_status):
            raise ValueError(f"Invalid status transition from {order.status} to {new_status}")

        await self._update_order_status(
            order,
            new_status,
            user_id,
            f"Status updated to {new_status}",
            reason,
            notes
        )

        await self.db.commit()
        await self.db.refresh(order)

        return order

    async def get_order_status_history(
        self,
        order_id: UUID
    ) -> List[OrderStatusHistory]:
        """Get order status history"""
        query = select(OrderStatusHistory).where(
            OrderStatusHistory.order_id == order_id
        ).order_by(desc(OrderStatusHistory.created_at))

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def cancel_order(
        self,
        order_id: UUID,
        user_id: UUID,
        tenant_id: UUID,
        reason: Optional[str] = None
    ) -> Order:
        """Cancel an order"""
        order = await self.get_order_by_id(order_id, tenant_id)
        if not order:
            raise ValueError("Order not found")

        # Check if order can be cancelled
        if order.status in [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED]:
            raise ValueError("Order cannot be cancelled in current status")

        await self._update_order_status(
            order,
            OrderStatus.CANCELLED,
            user_id,
            "Order cancelled",
            reason
        )

        await self.db.commit()
        await self.db.refresh(order)

        return order

    async def _update_order_status(
        self,
        order: Order,
        new_status: OrderStatus,
        user_id: UUID,
        notes: str,
        reason: Optional[str] = None,
        extra_notes: Optional[str] = None
    ) -> None:
        """Update order status and create history entry"""
        old_status = order.status
        order.status = new_status
        order.updated_by = user_id
        order.updated_at = datetime.utcnow()

        # Update specific timestamps based on status
        if new_status == OrderStatus.PICKED_UP:
            order.picked_up_at = datetime.utcnow()
        elif new_status == OrderStatus.DELIVERED:
            order.delivered_at = datetime.utcnow()

        # Create status history entry
        history = OrderStatusHistory(
            order_id=order.id,
            changed_by=user_id,
            from_status=old_status,
            to_status=new_status,
            reason=reason,
            notes=extra_notes or notes
        )
        self.db.add(history)

    def _is_valid_status_transition(
        self,
        from_status: OrderStatus,
        to_status: OrderStatus
    ) -> bool:
        """Check if status transition is valid"""
        valid_transitions = {
            OrderStatus.DRAFT: [OrderStatus.SUBMITTED, OrderStatus.CANCELLED],
            OrderStatus.SUBMITTED: [OrderStatus.FINANCE_APPROVED, OrderStatus.FINANCE_REJECTED, OrderStatus.CANCELLED],
            OrderStatus.FINANCE_APPROVED: [OrderStatus.LOGISTICS_APPROVED, OrderStatus.LOGISTICS_REJECTED, OrderStatus.CANCELLED],
            OrderStatus.FINANCE_REJECTED: [OrderStatus.SUBMITTED, OrderStatus.CANCELLED],
            OrderStatus.LOGISTICS_APPROVED: [OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
            OrderStatus.LOGISTICS_REJECTED: [OrderStatus.FINANCE_APPROVED, OrderStatus.CANCELLED],
            OrderStatus.ASSIGNED: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
            OrderStatus.PICKED_UP: [OrderStatus.IN_TRANSIT],
            OrderStatus.IN_TRANSIT: [OrderStatus.DELIVERED],
            OrderStatus.DELIVERED: [],  # Terminal state
            OrderStatus.CANCELLED: [],  # Terminal state
        }

        return to_status in valid_transitions.get(from_status, [])