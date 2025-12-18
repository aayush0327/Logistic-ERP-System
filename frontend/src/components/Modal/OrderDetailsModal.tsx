"use client";

import { useRef, useState } from "react";
import { ModalLayout } from "./ModalLayout";
import { Badge } from "@/components/ui/Badge";
import { useOutsideClick } from "@/components/Hooks/useOutsideClick";
import { Order } from "@/types";
import {
  Package,
  Calendar,
  DollarSign,
  User,
  MapPin,
  Phone,
  Truck,
  Clock,
  CheckCircle,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

// Mock additional order details for demonstration
const mockOrderDetails = {
  "ORD-001": {
    customerDetails: {
      phone: "+201000000001",
      email: "john@johnsfarm.com",
      address: "123 Farm Road, Rural Area, Cairo, Egypt",
      businessType: "Agriculture",
    },
    items: [
      {
        id: 1,
        name: "Animal Feed Premium",
        quantity: 10,
        unit: "kg",
        price: 15.5,
        total: 155,
      },
      {
        id: 2,
        name: "Vitamin Supplement",
        quantity: 5,
        unit: "bottle",
        price: 120,
        total: 600,
      },
      {
        id: 3,
        name: "Animal Feed Standard",
        quantity: 5,
        unit: "kg",
        price: 12.5,
        total: 62.5,
      },
    ],
    delivery: {
      driver: "Mike Johnson",
      truck: "ABC-1234 (Ford Transit)",
      estimatedDelivery: "2024-01-10 14:30",
      actualDelivery: "2024-01-10 14:25",
    },
  },
  "ORD-002": {
    customerDetails: {
      phone: "+201000000002",
      email: "contact@greenvalley.com",
      address: "456 Market St, City Center, Giza, Egypt",
      businessType: "Retail",
    },
    items: [
      {
        id: 1,
        name: "Animal Feed Premium",
        quantity: 8,
        unit: "kg",
        price: 15.5,
        total: 124,
      },
    ],
    delivery: {
      driver: "Sarah Ahmed",
      truck: "XYZ-5678 (Mercedes Sprinter)",
      estimatedDelivery: "2024-01-10 16:00",
      actualDelivery: null,
    },
  },
  "ORD-003": {
    customerDetails: {
      phone: "+201000000003",
      email: "info@citymart.net",
      address: "789 Commercial Ave, Alexandria, Egypt",
      businessType: "Retail",
    },
    items: [
      {
        id: 1,
        name: "Animal Feed Premium",
        quantity: 15,
        unit: "kg",
        price: 15.5,
        total: 232.5,
      },
      {
        id: 2,
        name: "Vitamin Supplement",
        quantity: 7,
        unit: "bottle",
        price: 120,
        total: 840,
      },
    ],
    delivery: {
      driver: "Ali Hassan",
      truck: "DEF-9012 (Iveco Daily)",
      estimatedDelivery: "2024-01-11 18:00",
      actualDelivery: null,
    },
  },
};

type TabType = "details" | "customer" | "items" | "delivery" | "status";

export function OrderDetailsModal({
  isOpen,
  onClose,
  order,
}: OrderDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("details");
  useOutsideClick(modalRef, onClose, isOpen);

  if (!order) return null;

  const orderDetails =
    mockOrderDetails[order.id as keyof typeof mockOrderDetails];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "on-route":
        return "info";
      case "loading":
        return "warning";
      case "pending":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "on-route":
        return <Truck className="w-4 h-4" />;
      case "loading":
        return <Package className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const tabs = [
    { id: "details" as TabType, label: "Order Details", icon: Package },
    { id: "customer" as TabType, label: "Customer Info", icon: User },
    { id: "items" as TabType, label: "Order Items", icon: ShoppingBag },
    { id: "delivery" as TabType, label: "Delivery", icon: Truck },
    { id: "status" as TabType, label: "Order Status", icon: TrendingUp },
  ];

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={onClose}
      title={`Order Details - ${order.id}`}
      size="xl"
      className="flex flex-col  h-[90vh] max-h-[800px]"
    >
      <div className="flex flex-col h-full" ref={modalRef}>
        {/* Order Header Summary */}
        <div className="flex items-center justify-between px-6 pt-2 pb-4 border-b">
          <div className="flex items-center gap-3">
            <Badge
              variant={getStatusVariant(order.status)}
              className="flex items-center gap-2"
            >
              {getStatusIcon(order.status)}
              {order.status.charAt(0).toUpperCase() +
                order.status.slice(1).replace("-", " ")}
            </Badge>
            <span className="text-sm text-gray-500">{order.date}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${order.total.toFixed(2)}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 px-6 pt-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex cursor-pointer  border border-[#1ab052]
  hover:bg-[#1ab052]/10
  hover:border-[#1ab052]
  hover:shadow-[0_0_0_1px_rgba(26,176,82,0.25)]
  transition-all duration-200 ease-in-out items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors
                  ${
                    activeTab === tab.id
                      ? "bg-[#1ab052] text-white border-[#1ab052] hover:bg-[#1ab052]"
                      : "bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:text-gray-800"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Order Details Tab */}
          {activeTab === "details" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Order Information
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Order ID
                  </span>
                  <span className="text-sm text-gray-900">{order.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Status
                  </span>
                  <Badge variant={getStatusVariant(order.status)}>
                    {order.status.charAt(0).toUpperCase() +
                      order.status.slice(1).replace("-", " ")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Customer
                  </span>
                  <span className="text-sm text-gray-900">
                    {order.customer}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Date
                  </span>
                  <span className="text-sm text-gray-900">{order.date}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Total Items
                  </span>
                  <span className="text-sm text-gray-900">
                    {order.items} items
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Total Amount
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    ${order.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Customer Info Tab */}
          {activeTab === "customer" && orderDetails && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Customer Information
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Name
                  </span>
                  <span className="text-sm text-gray-900">
                    {order.customer}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    Phone
                  </span>
                  <span className="text-sm text-gray-900">
                    {orderDetails.customerDetails.phone}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Email
                  </span>
                  <span className="text-sm text-gray-900">
                    {orderDetails.customerDetails.email}
                  </span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Address
                  </span>
                  <span className="text-sm text-gray-900 text-right max-w-xs">
                    {orderDetails.customerDetails.address}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Business Type
                  </span>
                  <span className="text-sm text-gray-900">
                    {orderDetails.customerDetails.businessType}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Order Items Tab */}
          {activeTab === "items" && orderDetails && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Order Items ({order.items} items)
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orderDetails.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 text-center">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 text-right">
                          ${item.price.toFixed(2)}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-gray-900 text-right">
                          ${item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-3 text-sm font-semibold text-gray-700"
                      >
                        Total Amount
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                        ${order.total.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Delivery Tab */}
          {activeTab === "delivery" && orderDetails && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Delivery Information
              </h3>
              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Driver
                  </span>
                  <span className="text-sm text-gray-900">
                    {orderDetails.delivery.driver}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Truck
                  </span>
                  <span className="text-sm text-gray-900">
                    {orderDetails.delivery.truck}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Estimated Delivery
                  </span>
                  <span className="text-sm text-gray-900">
                    {orderDetails.delivery.estimatedDelivery}
                  </span>
                </div>
                {orderDetails.delivery.actualDelivery && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Actual Delivery
                    </span>
                    <span className="text-sm text-green-600 font-medium">
                      {orderDetails.delivery.actualDelivery}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Status Tab */}
          {activeTab === "status" && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Order Status Tracking
              </h3>

              {/* Status Workflow */}
              <div className="relative">
                {/* Progress Line */}
                <div className="absolute left-6 top-8 bottom-0 w-0.5 bg-gray-300"></div>

                <div className="space-y-6">
                  {/* Submitted Status */}
                  <div className="flex items-start gap-4">
                    <div className="relative z-10 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">
                          Submitted
                        </h4>
                        <Badge variant="success" className="text-xs">
                          Completed
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Order has been successfully submitted and is awaiting
                        finance approval.
                      </p>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Time:</span> {order.date}{" "}
                        at 10:30 AM
                      </div>
                    </div>
                  </div>

                  {/* Finance Status */}
                  <div className="flex items-start gap-4">
                    <div
                      className={`relative z-10 w-12 h-12 ${
                        order.status === "completed" ||
                        order.status === "on-route"
                          ? "bg-green-500"
                          : order.status === "loading"
                          ? "bg-yellow-500"
                          : "bg-gray-300"
                      } rounded-full flex items-center justify-center`}
                    >
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">Finance</h4>
                        {order.status === "completed" ||
                        order.status === "on-route" ? (
                          <Badge variant="success" className="text-xs">
                            Approved
                          </Badge>
                        ) : order.status === "loading" ? (
                          <Badge variant="warning" className="text-xs">
                            In Review
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {order.status === "completed" ||
                        order.status === "on-route"
                          ? "Payment has been verified and approved."
                          : order.status === "loading"
                          ? "Payment is currently being reviewed and verified."
                          : "Awaiting payment verification and approval."}
                      </p>
                      <div className="text-xs text-gray-500">
                        {order.status === "completed" ||
                        order.status === "on-route" ? (
                          <span>
                            <span className="font-medium">Approved by:</span>{" "}
                            Sarah Chen •{" "}
                            <span className="font-medium">Time:</span>{" "}
                            {order.date} at 2:15 PM
                          </span>
                        ) : order.status === "loading" ? (
                          <span>
                            <span className="font-medium">
                              Est. completion:
                            </span>{" "}
                            Today by 6:00 PM
                          </span>
                        ) : (
                          <span>
                            <span className="font-medium">Est. start:</span>{" "}
                            Within 2 hours
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Logistics Status */}
                  <div className="flex items-start gap-4">
                    <div
                      className={`relative z-10 w-12 h-12 ${
                        order.status === "completed"
                          ? "bg-green-500"
                          : order.status === "on-route"
                          ? "bg-blue-500"
                          : "bg-gray-300"
                      } rounded-full flex items-center justify-center`}
                    >
                      <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">
                          Logistics
                        </h4>
                        {order.status === "completed" ? (
                          <Badge variant="success" className="text-xs">
                            Dispatched
                          </Badge>
                        ) : order.status === "on-route" ? (
                          <Badge variant="info" className="text-xs">
                            In Progress
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {order.status === "completed"
                          ? "Order has been dispatched and assigned to driver."
                          : order.status === "on-route"
                          ? "Order is in transit to delivery location."
                          : "Awaiting logistics planning and driver assignment."}
                      </p>
                      <div className="text-xs text-gray-500">
                        {order.status === "completed" ? (
                          <span>
                            <span className="font-medium">Driver:</span>{" "}
                            {orderDetails?.delivery.driver || "Assigned"} •{" "}
                            <span className="font-medium">Truck:</span>{" "}
                            {orderDetails?.delivery.truck || "Assigned"}
                          </span>
                        ) : order.status === "on-route" ? (
                          <span>
                            <span className="font-medium">
                              Current location:
                            </span>{" "}
                            5 km away •{" "}
                            <span className="font-medium">ETA:</span> 30 minutes
                          </span>
                        ) : (
                          <span>
                            <span className="font-medium">Est. dispatch:</span>{" "}
                            Tomorrow by 9:00 AM
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Driver Status */}
                  <div className="flex items-start gap-4">
                    <div
                      className={`relative z-10 w-12 h-12 ${
                        order.status === "completed"
                          ? "bg-green-500"
                          : order.status === "on-route"
                          ? "bg-blue-500 animate-pulse"
                          : "bg-gray-300"
                      } rounded-full flex items-center justify-center`}
                    >
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">Driver</h4>
                        {order.status === "completed" ? (
                          <Badge variant="success" className="text-xs">
                            Delivered
                          </Badge>
                        ) : order.status === "on-route" ? (
                          <Badge variant="info" className="text-xs">
                            On Route
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {order.status === "completed"
                          ? "Order has been successfully delivered to customer."
                          : order.status === "on-route"
                          ? "Driver is currently delivering the order to the customer."
                          : "Waiting for driver assignment and route planning."}
                      </p>
                      <div className="text-xs text-gray-500">
                        {order.status === "completed" ? (
                          <span>
                            <span className="font-medium">Delivery time:</span>{" "}
                            {orderDetails?.delivery.actualDelivery ||
                              "Completed"}
                          </span>
                        ) : order.status === "on-route" ? (
                          <span>
                            <span className="font-medium">
                              Estimated delivery:
                            </span>{" "}
                            {orderDetails?.delivery.estimatedDelivery ||
                              "Today"}
                          </span>
                        ) : (
                          <span>
                            <span className="font-medium">Waiting for:</span>{" "}
                            Finance approval → Logistics assignment
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">
                  Current Status Summary
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">
                      Order Progress
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            order.status === "completed"
                              ? "bg-green-500 w-full"
                              : order.status === "on-route"
                              ? "bg-blue-500 w-3/4"
                              : order.status === "loading"
                              ? "bg-yellow-500 w-1/2"
                              : "bg-gray-400 w-1/4"
                          }`}
                        ></div>
                      </div>
                      <span className="text-xs font-medium text-gray-700">
                        {order.status === "completed"
                          ? "100%"
                          : order.status === "on-route"
                          ? "75%"
                          : order.status === "loading"
                          ? "50%"
                          : "25%"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">
                      Estimated Completion
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {order.status === "completed"
                        ? "Delivered"
                        : order.status === "on-route"
                        ? "Today"
                        : order.status === "loading"
                        ? "Tomorrow"
                        : "2-3 Business Days"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          {/* <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Close
          </button> */}
          {order.status === "pending" && (
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
              Process Order
            </button>
          )}
          {order.status === "completed" && (
            <button className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
              Download Invoice
            </button>
          )}
        </div>
      </div>
    </ModalLayout>
  );
}
