"use client";

import { useState } from "react";
import {
  MarketingPerson,
  CustomerForAssignment,
  MarketingPersonAssignment,
} from "@/services/api/companyApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import {
  Search,
  UserPlus,
  Users,
  Building2,
  Check,
  X,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useGetMarketingPersonsQuery,
  useGetCustomersForAssignmentQuery,
  useGetMarketingPersonAssignmentsQuery,
  useCreateMarketingPersonAssignmentMutation,
  useDeleteMarketingPersonAssignmentMutation,
} from "@/services/api/companyApi";
import { toast } from "react-hot-toast";

export default function MarketingPersonAssignmentsPage() {
  const router = useRouter();
  const [selectedMarketingPersonId, setSelectedMarketingPersonId] = useState<string>("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [marketingPersonSearch, setMarketingPersonSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [page, setPage] = useState(1);

  // Fetch marketing persons with search
  const {
    data: marketingPersons = [],
    isLoading: marketingPersonsLoading,
  } = useGetMarketingPersonsQuery(marketingPersonSearch ? { search: marketingPersonSearch } : undefined);

  // Fetch customers with assignment info
  const {
    data: customersData,
    isLoading: customersLoading,
    refetch: refetchCustomers,
  } = useGetCustomersForAssignmentQuery({ is_active: true, per_page: 100, search: searchQuery || undefined });

  const customers = customersData?.items || [];

  // Fetch assignments for selected marketing person
  const {
    data: assignmentsData,
    isLoading: assignmentsLoading,
    refetch: refetchAssignments,
  } = useGetMarketingPersonAssignmentsQuery(
    selectedMarketingPersonId
      ? {
          marketing_person_id: selectedMarketingPersonId,
          page,
          per_page: 100,
        }
      : skipToken
  );

  const [createAssignment, { isLoading: isCreating }] =
    useCreateMarketingPersonAssignmentMutation();

  const [deleteAssignment, { isLoading: isDeleting }] =
    useDeleteMarketingPersonAssignmentMutation();

  // Get assigned customers for selected marketing person
  const assignments = assignmentsData?.items || [];
  const assignedCustomerIds = new Set(assignments.map((a) => a.customer.id));

  // Filter customers based on search
  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(searchLower) ||
      customer.code?.toLowerCase().includes(searchLower) ||
      customer.city?.toLowerCase().includes(searchLower)
    );
  });

  // Handle marketing person selection
  const handleMarketingPersonChange = (personId: string) => {
    setSelectedMarketingPersonId(personId);
    setSelectedCustomerIds(new Set());
    setNotes("");
    setPage(1);
  };

  // Toggle customer selection
  const toggleCustomerSelection = (customerId: string) => {
    const newSelection = new Set(selectedCustomerIds);
    if (newSelection.has(customerId)) {
      newSelection.delete(customerId);
    } else {
      newSelection.add(customerId);
    }
    setSelectedCustomerIds(newSelection);
  };

  // Select all visible customers
  const selectAllVisible = () => {
    const newSelection = new Set(selectedCustomerIds);
    filteredCustomers.forEach((customer) => {
      if (!assignedCustomerIds.has(customer.id)) {
        newSelection.add(customer.id);
      }
    });
    setSelectedCustomerIds(newSelection);
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedCustomerIds(new Set());
  };

  // Assign selected customers
  const handleAssignCustomers = async () => {
    if (!selectedMarketingPersonId || selectedCustomerIds.size === 0) {
      toast.error("Please select a marketing person and at least one customer");
      return;
    }

    try {
      await createAssignment({
        marketing_person_id: selectedMarketingPersonId,
        customer_ids: Array.from(selectedCustomerIds),
        notes: notes || undefined,
      }).unwrap();

      toast.success(`Assigned ${selectedCustomerIds.size} customer(s) successfully`);
      setSelectedCustomerIds(new Set());
      setNotes("");
      refetchCustomers();
      refetchAssignments();
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to assign customers");
    }
  };

  // Remove assignment
  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await deleteAssignment(assignmentId).unwrap();
      toast.success("Assignment removed successfully");
      refetchCustomers();
      refetchAssignments();
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to remove assignment");
    }
  };

  // Get selected marketing person details
  const selectedMarketingPerson = marketingPersons.find(
    (p) => p.id === selectedMarketingPersonId
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Marketing Person Assignments
            </h1>
            <p className="text-gray-500 mt-1">
              Assign customers to marketing persons
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#edf0f7] border-2 border-[#c4cde9]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Total Marketing Persons
            </p>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {marketingPersonsLoading ? "..." : marketingPersons.length}
            </p>
          </div>
        </div>

        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#f0f7f0] border-2 border-[#c5edd6]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Total Active Customers
            </p>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Building2 className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {customersLoading ? "..." : customers.length}
            </p>
          </div>
        </div>

        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#f0f7fa] border-2 border-[#c0e5f7]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Assigned Customers
            </p>
            <div className="p-2 bg-sky-100 rounded-lg">
              <Check className="w-5 h-5 md:w-6 md:h-6 text-sky-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {assignmentsLoading ? "..." : assignments.length}
            </p>
          </div>
        </div>

        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#fff8f0] border-2 border-[#f8e4c2]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Unassigned Customers
            </p>
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {customersLoading
                ? "..."
                : customers.filter((c) => !c.assigned_marketing_person_id).length}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Marketing Person Selector */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Select Marketing Person</CardTitle>
              {/* Search for marketing persons */}
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search marketing persons..."
                  value={marketingPersonSearch}
                  onChange={(e) => setMarketingPersonSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {marketingPersonsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 bg-gray-200 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : marketingPersons.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No marketing persons found</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {marketingPersonSearch
                      ? "Try a different search term"
                      : "Create users with Marketing Person role"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {marketingPersons.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => handleMarketingPersonChange(person.id)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        selectedMarketingPersonId === person.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {person.first_name} {person.last_name}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {person.email}
                          </p>
                        </div>
                        <Badge
                          variant={
                            selectedMarketingPersonId === person.id
                              ? "success"
                              : "default"
                          }
                          className="ml-2 flex-shrink-0"
                        >
                          {person.assigned_customers_count}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Assignments Card */}
          {selectedMarketingPerson && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Assigned Customers</span>
                  <Badge variant="info">{assignments.length}</Badge>
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Customers assigned to {selectedMarketingPerson.first_name} {selectedMarketingPerson.last_name}
                </p>
              </CardHeader>
              <CardContent>
                {assignmentsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-14 bg-gray-200 rounded-lg animate-pulse"
                      />
                    ))}
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">
                      No customers assigned yet
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {assignment.customer.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {assignment.customer.code} • {assignment.customer.city || 'No city'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          disabled={isDeleting}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0 ml-2"
                          title="Remove assignment"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Customer Selection */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle>Assign Customers</CardTitle>
                {!selectedMarketingPerson && (
                  <p className="text-sm text-amber-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Select a marketing person first
                  </p>
                )}
              </div>

              {/* Search and Actions */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search customers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    disabled={!selectedMarketingPerson}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllVisible}
                    disabled={!selectedMarketingPerson || customersLoading}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAll}
                    disabled={!selectedMarketingPerson}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              {/* Selection Summary */}
              {selectedCustomerIds.size > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-900">
                      {selectedCustomerIds.size} customer(s) selected
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add notes (optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-48"
                      />
                      <Button
                        size="sm"
                        onClick={handleAssignCustomers}
                        disabled={isCreating}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isCreating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-1" />
                            Assign
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 bg-gray-200 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : !selectedMarketingPerson ? (
                <div className="text-center py-12">
                  <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select a Marketing Person
                  </h3>
                  <p className="text-gray-500">
                    Choose a marketing person from the left panel to assign customers
                  </p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No customers found
                  </h3>
                  <p className="text-gray-500">
                    {searchQuery
                      ? "Try adjusting your search query"
                      : "Create customers to get started"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredCustomers.map((customer) => {
                    const isAssigned = assignedCustomerIds.has(customer.id);
                    const isSelected = selectedCustomerIds.has(customer.id);
                    // Get assigned marketing persons (array or single)
                    const assignedMps = customer.assigned_marketing_persons || [];
                    const assignedMpName = assignedMps.length > 0
                      ? assignedMps.join(", ")
                      : (customer.assigned_marketing_person_name || null);

                    return (
                      <div
                        key={customer.id}
                        onClick={() =>
                          !isAssigned && toggleCustomerSelection(customer.id)
                        }
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isAssigned
                            ? "border-green-200 bg-green-50 opacity-60"
                            : isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected
                                  ? "border-blue-500 bg-blue-500"
                                  : isAssigned
                                  ? "border-green-400 bg-green-400"
                                  : "border-gray-300"
                              }`}
                            >
                              {(isSelected || isAssigned) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {customer.name}
                              </p>
                              <div className="flex items-center space-x-3 text-sm text-gray-500">
                                <span>{customer.code}</span>
                                {customer.city && (
                                  <>
                                    <span>•</span>
                                    <span>{customer.city}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {isAssigned && assignedMpName && (
                              <Badge variant="success" className="text-xs max-w-[200px] truncate">
                                {assignedMpName}
                              </Badge>
                            )}
                            {isSelected && !isAssigned && (
                              <Badge variant="info" className="text-xs">
                                Selected
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// For skipToken in query
const skipToken = { skip: true } as any;
