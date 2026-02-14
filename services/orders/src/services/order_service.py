"""
Order service - Business logic for order management
"""
from datetime import datetime
from typing import List, Tuple, Optional, Dict, Any
from uuid import uuid4
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
from src.services.audit_client import AuditClient

settings = OrdersSettings()


class OrderService:
    """Service for managing orders"""

    def __init__(self, db: AsyncSession, auth_headers: dict = None, tenant_id: str = None):
        self.db = db
        self.auth_headers = auth_headers or {}
        self.tenant_id = tenant_id

    async def generate_order_number(self, tenant_id: str) -> str:
        """
        Generate order number: ORD-DDMMYYYY-{sequence}
        Sequence resets to 1 for each new day
        """
        # Get current date in DDMMYYYY format
        today_date = datetime.now().strftime("%d%m%Y")

        # Find last order number for today's date for this tenant
        prefix = f"ORD-{today_date}"
        last_order_query = select(Order.order_number).where(
            and_(
                Order.tenant_id == tenant_id,
                Order.order_number.like(f"{prefix}-%")
            )
        ).order_by(desc(Order.order_number)).limit(1)

        result = await self.db.execute(last_order_query)
        last_order_number = result.scalar()

        # Extract sequence number and increment
        if last_order_number:
            last_seq = int(last_order_number.split("-")[-1])
            new_seq = last_seq + 1
        else:
            new_seq = 1

        return f"{prefix}-{new_seq}"

    async def get_orders_paginated(
        self,
        filters: List = None,
        order_by: Any = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[Order], int]:
        """Get paginated orders with filters"""
        query = select(Order).options(
            selectinload(Order.items),
            selectinload(Order.documents),
            selectinload(Order.status_history)
        )

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
        order_id: str,
        tenant_id: str
    ) -> Optional[Order]:
        """Get order by ID and tenant"""
        query = select(Order).where(
            and_(
                # Convert to string to match VARCHAR column
                Order.id == str(order_id),
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

    async def get_order_by_order_number(
        self,
        order_number: str,
        tenant_id: str
    ) -> Optional[Order]:
        """Get order by order_number and tenant"""
        query = select(Order).where(
            and_(
                Order.order_number == order_number,
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

    async def _fetch_product_details(self, product_id: str) -> Dict[str, Any]:
        """
        Fetch product details from company service.
        Uses the existing products endpoint and searches for the specific product.
        """
        from httpx import AsyncClient
        import logging
        logger = logging.getLogger(__name__)

        print(
            f"DEBUG: _fetch_product_details called for product_id: {product_id}")
        COMPANY_SERVICE_URL = "http://company-service:8002"

        async with AsyncClient(timeout=30.0) as client:
            try:
                # Get all products (company service doesn't have get by ID endpoint)
                response = await client.get(
                    f"{COMPANY_SERVICE_URL}/products/",
                    params={
                        "tenant_id": self.tenant_id or "default-tenant",
                        "is_active": True,
                        "per_page": 100  # Max allowed by the API
                    },
                    headers=self.auth_headers
                )

                if response.status_code == 200:
                    data = response.json()
                    products = data.get("items", [])
                    print(
                        f"DEBUG: Fetched {len(products)} products from company service")

                    if products:
                        # Log first product for debugging
                        print(
                            f"DEBUG: Sample product structure: {products[0]}")

                    # Find the product by ID
                    product = None
                    print(
                        f"DEBUG: Searching for product_id: {product_id} (type: {type(product_id)})")
                    # Log first 5 for debugging
                    print(
                        f"DEBUG: Available product IDs: {[str(p.get('id')) for p in products[:5]]}...")

                    for p in products:
                        if str(p.get("id")) == str(product_id):
                            product = p
                            print(
                                f"DEBUG: Found product: {product.get('name', 'Unknown')}")
                            break

                    if not product:
                        print(
                            f"DEBUG: Product {product_id} not found in {len(products)} products")

                    if product:
                        return {
                            "id": str(product["id"]),
                            "name": product["name"],
                            "code": product.get("code", ""),
                            "description": product.get("description", ""),
                            "unit_price": float(product.get("unit_price") or 0),
                            "weight": float(product.get("weight") or 0),
                            "volume": float(product.get("volume") or 0),
                            "weight_type": product.get("weight_type", "fixed"),
                            "fixed_weight": float(product.get("fixed_weight") or 0),
                            "weight_unit": product.get("weight_unit", "kg"),
                            "unit": "pcs"  # Default unit, can be customized later
                        }
                    else:
                        logger.error(
                            f"Product {product_id} not found in company service")
                        return {
                            "id": str(product_id),
                            "name": "Unknown Product",
                            "code": "NOT_FOUND",
                            "description": "Product not found",
                            "unit_price": 0.0,
                            "weight": 0.0,
                            "volume": 0.0,
                            "unit": "pcs"
                        }
                else:
                    error_text = response.text
                    logger.error(
                        f"Failed to fetch products from company service: {response.status_code} - {error_text}")
                    return {
                        "id": str(product_id),
                        "name": "Service Error",
                        "code": "ERROR",
                        "description": f"Service error: {response.status_code}",
                        "unit_price": 0.0,
                        "weight": 0.0,
                        "volume": 0.0,
                        "unit": "pcs"
                    }
            except Exception as e:
                logger.error(f"Error fetching product {product_id}: {str(e)}")
                return {
                    "id": str(product_id),
                    "name": "Network Error",
                    "code": "ERROR",
                    "description": f"Network error: {str(e)}",
                    "unit_price": 0.0,
                    "weight": 0.0,
                    "volume": 0.0,
                    "unit": "pcs"
                }

    async def create_order(
        self,
        order_data: OrderCreate,
        user_id: str,
        tenant_id: str,
        created_by_role: str = 'admin'
    ) -> Order:
        """Create a new order with items in a transaction-safe manner"""
        try:
            # Generate order number if not provided
            if order_data.order_number:
                # Frontend provided order_number - validate uniqueness
                existing_order_query = select(Order.id).where(
                    and_(
                        Order.tenant_id == tenant_id,
                        Order.order_number == order_data.order_number
                    )
                )
                existing_result = await self.db.execute(existing_order_query)
                if existing_result.scalar():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Order number '{order_data.order_number}' already exists"
                    )
                order_number = order_data.order_number
            else:
                # Generate new order number with DDMMYYYY-{sequence} format
                order_number = await self.generate_order_number(tenant_id)

            # Initialize order totals (will be calculated from items)
            total_weight = 0.0
            total_volume = 0.0
            package_count = 0
            total_amount = 0.0

            # Process items and calculate totals
            order_items = []
            if order_data.items:
                for i, item_data in enumerate(order_data.items):
                    # Fetch product details from product service
                    product = await self._fetch_product_details(item_data.product_id)

                    # Use user-entered weight if provided (for variable weight products),
                    # otherwise use product weight (for fixed weight products)
                    item_weight = item_data.weight if hasattr(item_data, 'weight') and item_data.weight and item_data.weight > 0 else product.get("weight", 0)

                    # Calculate item totals
                    item_total_price = product["unit_price"] * \
                        item_data.quantity
                    item_total_weight = item_weight * item_data.quantity
                    item_total_volume = product.get("volume", 0) * item_data.quantity

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
                        unit="pcs",  # Default unit since it's not in product schema
                        unit_price=product["unit_price"],
                        total_price=item_total_price,
                        weight=item_weight,  # Use the calculated item weight
                        volume=product.get("volume", 0),
                    )
                    order_items.append(order_item)

            # Create order with calculated totals
            order = Order(
                order_number=order_number,  # Use generated or provided order number
                tenant_id=tenant_id,
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
                due_days=order_data.due_days if hasattr(order_data, 'due_days') else 7,
                created_by=user_id,
                created_by_role=created_by_role,
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

            # Send audit log
            audit_client = AuditClient(self.auth_headers)
            await audit_client.log_event(
                tenant_id=tenant_id,
                user_id=user_id,
                action="create",
                module="orders",
                entity_type="order",
                entity_id=str(order.id),
                description=f"Order {order.order_number} created",
                new_values={
                    "order_number": order.order_number,
                    "status": order.status,
                    "total_amount": str(total_amount),
                    "customer_id": order.customer_id,
                    "branch_id": order.branch_id
                }
            )
            await audit_client.close()

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
        order_id: str,
        order_data: OrderUpdate,
        user_id: str
    ) -> Order:
        """Update an existing order (including items for draft orders)"""
        query = select(Order).where(
            Order.id == str(order_id))  # Convert to string
        result = await self.db.execute(query)
        order = result.scalar_one_or_none()

        if not order:
            raise ValueError("Order not found")

        # Extract items from update data before processing other fields
        items_data = order_data.items if hasattr(order_data, 'items') else None

        # Update order fields (excluding items which are handled separately)
        update_data = order_data.model_dump(exclude_unset=True, exclude={'items'})

        # Recalculate totals if items are being updated
        if items_data is not None:
            total_weight = 0.0
            total_volume = 0.0
            package_count = 0
            total_amount = 0.0

            # Process new items
            order_items = []
            for i, item_data in enumerate(items_data):
                # Fetch product details
                product = await self._fetch_product_details(item_data.product_id)

                # Use user-entered weight if provided, otherwise use product weight
                item_weight = item_data.weight if hasattr(item_data, 'weight') and item_data.weight and item_data.weight > 0 else product.get("weight", 0)

                # Calculate item totals
                item_total_price = product["unit_price"] * item_data.quantity
                item_total_weight = item_weight * item_data.quantity
                item_total_volume = product.get("volume", 0) * item_data.quantity

                # Update order totals
                total_weight += item_total_weight
                total_volume += item_total_volume
                package_count += item_data.quantity
                total_amount += item_total_price

                # Create OrderItem object (only use fields that exist in OrderItem model)
                order_item = OrderItem(
                    id=str(uuid4()),
                    order_id=str(order.id),
                    product_id=item_data.product_id,
                    product_name=product.get("name", ""),
                    product_code=product.get("code", ""),
                    description=product.get("description", ""),
                    quantity=item_data.quantity,
                    unit=product.get("unit", "pcs"),
                    unit_price=product.get("unit_price", 0),
                    total_price=item_total_price,
                    weight=item_weight,
                    volume=item_total_volume,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                order_items.append(order_item)

            # Delete existing items and add new ones
            from sqlalchemy import delete
            delete_query = delete(OrderItem).where(OrderItem.order_id == str(order.id))
            await self.db.execute(delete_query)

            # Add new items
            for order_item in order_items:
                self.db.add(order_item)

            # Update calculated totals in the order data
            update_data['total_weight'] = total_weight
            update_data['total_volume'] = total_volume
            update_data['package_count'] = package_count
            update_data['total_amount'] = total_amount

        # Apply other field updates
        for field, value in update_data.items():
            setattr(order, field, value)

        order.updated_by = user_id
        order.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(order)

        return order

    async def delete_order(self, order_id: str) -> None:
        """Soft delete an order"""
        query = select(Order).where(
            Order.id == str(order_id))  # Convert to string
        result = await self.db.execute(query)
        order = result.scalar_one_or_none()

        if not order:
            raise ValueError("Order not found")

        order.is_active = False
        order.updated_at = datetime.utcnow()

        await self.db.commit()

    async def submit_order(
        self,
        order_id: str,
        user_id: str,
        tenant_id: str
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
            "Order submitted for finance approval",
            tenant_id=tenant_id
        )

        await self.db.commit()
        await self.db.refresh(order)

        # Send audit log
        audit_client = AuditClient(self.auth_headers)
        await audit_client.log_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="submit",
            module="orders",
            entity_type="order",
            entity_id=str(order.id),
            description=f"Order {order.order_number} submitted for finance approval",
            from_status="draft",
            to_status="submitted"
        )
        await audit_client.close()

        # Publish Kafka event for notification service
        try:
            from src.services.kafka_producer import order_event_producer
            order_event_producer.publish_order_submitted(
                order_id=str(order.id),
                order_number=order.order_number,
                tenant_id=tenant_id,
                branch_id=str(order.branch_id),
                customer_id=str(order.customer_id),
                total_amount=float(order.total_amount),
                created_by=user_id,
                created_by_role=None  # Role not available in submit_order
            )
        except Exception as e:
            # Log but don't fail the order submission
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to publish order.submitted event: {e}")

        return order

    async def finance_approval(
        self,
        order_id: str,
        approved: bool,
        user_id: str,
        tenant_id: str,
        reason: Optional[str] = None,
        notes: Optional[str] = None,
        payment_type: Optional[PaymentType] = None,
        user_role: Optional[str] = None
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
            reason,
            tenant_id=tenant_id
        )

        await self.db.commit()
        await self.db.refresh(order)

        # Send audit log
        audit_client = AuditClient(self.auth_headers)
        await audit_client.log_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="approve" if approved else "reject",
            module="orders",
            entity_type="order",
            entity_id=str(order.id),
            description=f"Order {order.order_number} {'approved' if approved else 'rejected'} by finance",
            from_status="submitted",
            to_status=new_status,
            approval_status="approved" if approved else "rejected",
            reason=reason
        )
        await audit_client.close()

        # Publish Kafka event for notification service
        try:
            from src.services.kafka_producer import order_event_producer
            if approved:
                order_event_producer.publish_order_approved(
                    order_id=str(order.id),
                    order_number=order.order_number,
                    tenant_id=tenant_id,
                    approved_by=user_id,
                    approved_by_role=user_role,
                    total_amount=float(order.total_amount),
                    payment_type=order.payment_type if order.payment_type else None
                )
            else:
                order_event_producer.publish_order_rejected(
                    order_id=str(order.id),
                    order_number=order.order_number,
                    tenant_id=tenant_id,
                    rejected_by=user_id,
                    rejected_by_role=user_role,
                    reason=reason
                )
        except Exception as e:
            # Log but don't fail the order approval
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to publish order approval event: {e}")

        # If admin performed finance approval, notify managers
        if user_role == "Admin":
            try:
                from src.services.kafka_producer import order_event_producer
                order_event_producer.publish_admin_action(
                    order_id=str(order.id),
                    order_number=order.order_number,
                    tenant_id=tenant_id,
                    performed_by=user_id,
                    performed_by_role=user_role,
                    action="finance_approve" if approved else "finance_reject",
                    created_by=order.created_by,
                    notify_roles=["finance_manager", "logistics_manager", "branch_manager"]
                )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to publish admin action notification: {e}")

        return order

    async def logistics_approval(
        self,
        order_id: str,
        approved: bool,
        user_id: str,
        tenant_id: str,
        reason: Optional[str] = None,
        notes: Optional[str] = None,
        driver_id: Optional[str] = None,
        trip_id: Optional[str] = None,
        user_role: Optional[str] = None
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
            reason,
            tenant_id=tenant_id
        )

        await self.db.commit()
        await self.db.refresh(order)

        # Send audit log
        new_values = {}
        if driver_id or trip_id:
            new_values = {"driver_id": driver_id, "trip_id": trip_id}

        audit_client = AuditClient(self.auth_headers)
        await audit_client.log_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="approve" if approved else "reject",
            module="orders",
            entity_type="order",
            entity_id=str(order.id),
            description=f"Order {order.order_number} {'approved' if approved else 'rejected'} by logistics",
            from_status="finance_approved",
            to_status=new_status,
            approval_status="approved" if approved else "rejected",
            reason=reason,
            new_values=new_values if new_values else None
        )
        await audit_client.close()

        # Publish Kafka event for notification service
        try:
            from src.services.kafka_producer import order_event_producer
            if approved:
                order_event_producer.publish_order_logistics_approved(
                    order_id=str(order.id),
                    order_number=order.order_number,
                    tenant_id=tenant_id,
                    approved_by=user_id,
                    approved_by_role=user_role,
                    driver_id=driver_id,
                    trip_id=trip_id
                )

                # Publish order.assigned event if driver/trip assigned
                if driver_id and trip_id:
                    order_event_producer.publish_order_assigned(
                        order_id=str(order.id),
                        order_number=order.order_number,
                        tenant_id=tenant_id,
                        driver_id=driver_id,
                        trip_id=trip_id,
                        trip_number=f"TRIP-{trip_id[:8]}"
                    )
        except Exception as e:
            # Log but don't fail the order approval
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to publish order logistics approval event: {e}")

        # If admin performed logistics approval, notify managers
        if user_role == "Admin":
            try:
                from src.services.kafka_producer import order_event_producer
                order_event_producer.publish_admin_action(
                    order_id=str(order.id),
                    order_number=order.order_number,
                    tenant_id=tenant_id,
                    performed_by=user_id,
                    performed_by_role=user_role,
                    action="logistics_approve" if approved else "logistics_reject",
                    created_by=order.created_by,
                    notify_roles=["logistics_manager", "branch_manager"]
                )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to publish admin action notification: {e}")

        return order

    async def update_order_status(
        self,
        order_id: str,
        new_status: OrderStatus,
        user_id: str,
        tenant_id: str,
        reason: Optional[str] = None,
        notes: Optional[str] = None,
        user_role: Optional[str] = None
    ) -> Order:
        """Update order status"""
        order = await self.get_order_by_id(order_id, tenant_id)
        if not order:
            raise ValueError("Order not found")

        # Validate status transition
        if not self._is_valid_status_transition(order.status, new_status):
            raise ValueError(
                f"Invalid status transition from {order.status} to {new_status}")

        await self._update_order_status(
            order,
            new_status,
            user_id,
            f"Status updated to {new_status}",
            reason,
            notes,
            tenant_id=tenant_id
        )

        await self.db.commit()
        await self.db.refresh(order)

        return order

    async def get_order_status_history(
        self,
        order_id: str
    ) -> List[OrderStatusHistory]:
        """Get order status history"""
        query = select(OrderStatusHistory).where(
            OrderStatusHistory.order_id == str(order_id)  # Convert to string
        ).order_by(desc(OrderStatusHistory.created_at))

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def cancel_order(
        self,
        order_id: str,
        user_id: str,
        tenant_id: str,
        reason: Optional[str] = None,
        user_role: Optional[str] = None
    ) -> Order:
        """Cancel an order"""
        order = await self.get_order_by_id(order_id, tenant_id)
        if not order:
            raise ValueError("Order not found")

        # Check if order can be cancelled
        if order.status in [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED]:
            raise ValueError("Order cannot be cancelled in current status")

        old_status = order.status
        await self._update_order_status(
            order,
            OrderStatus.CANCELLED,
            user_id,
            "Order cancelled",
            reason,
            tenant_id=tenant_id
        )

        await self.db.commit()
        await self.db.refresh(order)

        # Send audit log
        audit_client = AuditClient(self.auth_headers)
        await audit_client.log_event(
            tenant_id=tenant_id,
            user_id=user_id,
            action="cancel",
            module="orders",
            entity_type="order",
            entity_id=str(order.id),
            description=f"Order {order.order_number} cancelled",
            from_status=old_status,
            to_status="cancelled",
            reason=reason
        )
        await audit_client.close()

        # Publish Kafka event for cancellation
        try:
            from src.services.kafka_producer import order_event_producer
            order_event_producer.publish_order_cancelled(
                order_id=str(order.id),
                order_number=order.order_number,
                tenant_id=tenant_id,
                cancelled_by=user_id,
                cancelled_by_role=user_role,
                reason=reason
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to publish order.cancelled event: {e}")

        return order

    async def _update_order_status(
        self,
        order: Order,
        new_status: OrderStatus,
        user_id: str,
        notes: str,
        reason: Optional[str] = None,
        extra_notes: Optional[str] = None,
        tenant_id: Optional[str] = None
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

        # Write audit log to company_db
        try:
            from src.database import write_audit_log_to_company
            await write_audit_log_to_company(
                entity_id=str(order.id),
                entity_type="order",
                module="orders",
                action="status_change",
                from_status=str(old_status.value) if old_status else None,
                to_status=str(new_status.value) if new_status else None,
                description=f"Order {order.order_number} status changed from {old_status.value if old_status else 'None'} to {new_status.value}",
                user_id=user_id,
                tenant_id=tenant_id
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to write audit log to company_db: {e}")

        # Publish Kafka events for status changes
        status_to_event_type = {
            OrderStatus.PICKED_UP: "picked_up",
            OrderStatus.IN_TRANSIT: "in_transit",
            OrderStatus.DELIVERED: "delivered",
            OrderStatus.PARTIAL_IN_TRANSIT: "partial_in_transit",
            OrderStatus.PARTIAL_DELIVERED: "partial_delivered",
        }

        if new_status in status_to_event_type and tenant_id:
            try:
                from src.services.kafka_producer import order_event_producer

                additional_data = {}
                if new_status == OrderStatus.PICKED_UP:
                    additional_data = {
                        "picked_up_at": order.picked_up_at.isoformat() if order.picked_up_at else None,
                        "driver_id": str(order.driver_id) if order.driver_id else None
                    }
                elif new_status in [OrderStatus.IN_TRANSIT, OrderStatus.PARTIAL_IN_TRANSIT]:
                    additional_data = {
                        "driver_id": str(order.driver_id) if order.driver_id else None,
                        "trip_id": str(order.trip_id) if order.trip_id else None
                    }
                elif new_status in [OrderStatus.DELIVERED, OrderStatus.PARTIAL_DELIVERED]:
                    additional_data = {
                        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
                        "driver_id": str(order.driver_id) if order.driver_id else None,
                        "trip_id": str(order.trip_id) if order.trip_id else None
                    }

                order_event_producer.publish_order_status_changed(
                    order_id=str(order.id),
                    order_number=order.order_number,
                    tenant_id=tenant_id,
                    status=status_to_event_type[new_status],
                    additional_data=additional_data
                )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to publish order.{status_to_event_type[new_status]} event: {e}")

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
            OrderStatus.LOGISTICS_APPROVED: [OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
            OrderStatus.LOGISTICS_REJECTED: [OrderStatus.SUBMITTED, OrderStatus.CANCELLED],
            OrderStatus.ASSIGNED: [OrderStatus.PARTIAL_IN_TRANSIT, OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED],
            OrderStatus.PICKED_UP: [OrderStatus.PARTIAL_IN_TRANSIT, OrderStatus.IN_TRANSIT],
            OrderStatus.PARTIAL_IN_TRANSIT: [OrderStatus.PARTIAL_DELIVERED, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED],
            OrderStatus.IN_TRANSIT: [OrderStatus.PARTIAL_DELIVERED, OrderStatus.DELIVERED],
            OrderStatus.PARTIAL_DELIVERED: [OrderStatus.DELIVERED],
            OrderStatus.DELIVERED: [],  # Terminal state
            OrderStatus.CANCELLED: [],  # Terminal state
        }

        return to_status in valid_transitions.get(from_status, [])
