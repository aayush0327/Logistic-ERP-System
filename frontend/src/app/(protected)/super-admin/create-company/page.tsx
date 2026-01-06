"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { showSuccessToast, showErrorToast } from "@/utils/toast";
import { Building2, Plus, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";

interface Currency {
  code: string;
  symbol: string;
  name: string;
  decimal_places: number;
}

interface Timezone {
  iana: string;
  offset: string;
  label: string;
}

interface CompanyForm {
  name: string;
  domain: string;
  currency: string;
  timezone: string;
  timezoneEnabled: boolean;
  admin_email: string;
  admin_first_name: string;
  admin_last_name: string;
  admin_password: string;
}

export default function CreateCompanyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [timezones, setTimezones] = useState<Timezone[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    name: "",
    domain: "",
    currency: "TZS", // Default: Tanzanian Shilling
    timezone: "Africa/Dar_es_Salaam", // Default: East Africa Time
    timezoneEnabled: true,
    admin_email: "",
    admin_first_name: "",
    admin_last_name: "",
    admin_password: "temp123456",
  });

  // Fetch currencies and timezones on component mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoadingOptions(true);

        // Fetch currencies from backend
        const currenciesResponse = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL}/api/v1/currencies`);
        if (currenciesResponse.ok) {
          const currenciesData = await currenciesResponse.json();
          setCurrencies(currenciesData);
        } else {
          console.error("Failed to fetch currencies");
          // Fallback to common currencies if fetch fails
          setCurrencies([
            { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling", decimal_places: 2 },
            { code: "KES", symbol: "KSh", name: "Kenyan Shilling", decimal_places: 2 },
            { code: "UGX", symbol: "USh", name: "Ugandan Shilling", decimal_places: 2 },
            { code: "RWF", symbol: "RF", name: "Rwandan Franc", decimal_places: 0 },
            { code: "USD", symbol: "$", name: "US Dollar", decimal_places: 2 },
            { code: "EUR", symbol: "€", name: "Euro", decimal_places: 2 },
            { code: "GBP", symbol: "£", name: "British Pound", decimal_places: 2 },
            { code: "INR", symbol: "₹", name: "Indian Rupee", decimal_places: 2 },
            { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimal_places: 2 },
            { code: "SAR", symbol: "ر.س", name: "Saudi Riyal", decimal_places: 2 },
          ]);
        }

        // Fetch timezones from backend
        const timezonesResponse = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL}/api/v1/timezones?grouped=true`);
        if (timezonesResponse.ok) {
          const timezonesData = await timezonesResponse.json();
          // Flatten grouped timezones
          const flatTimezones = timezonesData.flatMap((group: any) => group.timezones);
          setTimezones(flatTimezones);
        } else {
          console.error("Failed to fetch timezones");
          // Fallback to common timezones if fetch fails
          setTimezones([
            { iana: "Africa/Dar_es_Salaam", offset: "+03:00", label: "Africa/Dar_es_Salaam (EAT) +03:00" },
            { iana: "Africa/Nairobi", offset: "+03:00", label: "Africa/Nairobi (EAT) +03:00" },
            { iana: "Africa/Kampala", offset: "+03:00", label: "Africa/Kampala (EAT) +03:00" },
            { iana: "Africa/Kigali", offset: "+02:00", label: "Africa/Kigali (CAT) +02:00" },
            { iana: "Europe/London", offset: "+00:00", label: "Europe/London (GMT) +00:00" },
            { iana: "America/New_York", offset: "-05:00", label: "America/New_York (EST) -05:00" },
            { iana: "Europe/Paris", offset: "+01:00", label: "Europe/Paris (CET) +01:00" },
            { iana: "Asia/Dubai", offset: "+04:00", label: "Asia/Dubai (GST) +04:00" },
            { iana: "Asia/Kolkata", offset: "+05:30", label: "Asia/Kolkata (IST) +05:30" },
            { iana: "Asia/Tokyo", offset: "+09:00", label: "Asia/Tokyo (JST) +09:00" },
          ]);
        }
      } catch (error) {
        console.error("Error fetching options:", error);
        showErrorToast("Failed to load currency and timezone options");
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  const handleCreateCompany = async (formData: CompanyForm) => {
    try {
      const data = {
        name: formData.name,
        domain: formData.domain,
        currency: formData.currency,
        timezone: formData.timezone,
        timezone_enabled: formData.timezoneEnabled,
        admin: {
          email: formData.admin_email,
          first_name: formData.admin_first_name,
          last_name: formData.admin_last_name,
          password: formData.admin_password,
        },
      };
      const response = await api.createCompanyWithAdmin(data);
      showSuccessToast("Company and admin created successfully!");
      return response;
    } catch (error) {
      console.error("Failed to create company:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create company";
      showErrorToast(errorMessage);
      throw error;
    }
  };

  const handleCompanyFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await handleCreateCompany(companyForm);
      // Redirect back to dashboard after successful creation
      router.push("/super-admin/dashboard");
    } catch (error) {
      // Error is already handled in handleCreateCompany
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setCompanyForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Get selected currency info
  const selectedCurrency = currencies.find(c => c.code === companyForm.currency);

  return (
    <div className="space-y-6 max-w-4xl mx-auto inline">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            Create New Company
          </h1>
        </div>
      </div>

      {/* Create Company Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-gray-800">
            <Building2 className="w-5 h-5 text-blue-600" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCompanyFormSubmit}>
            <div className="space-y-6">
              {/* Company Details Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">
                  Company Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      name="name"
                      value={companyForm.name}
                      onChange={handleInputChange}
                      placeholder="Enter company name"
                      required
                      className="w-full focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Domain <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      name="domain"
                      value={companyForm.domain}
                      onChange={handleInputChange}
                      placeholder="e.g., company.logistics.com"
                      required
                      className="w-full focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Regional Settings Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">
                  Regional Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Currency Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency <span className="text-red-500">*</span>
                    </label>
                    {loadingOptions ? (
                      <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-gray-500">Loading currencies...</span>
                      </div>
                    ) : (
                      <>
                        <select
                          name="currency"
                          value={companyForm.currency}
                          onChange={handleInputChange}
                          required
                          disabled={loadingOptions}
                          className="w-full px-3 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          {currencies.map((currency) => (
                            <option key={currency.code} value={currency.code}>
                              {currency.symbol} {currency.code} - {currency.name}
                            </option>
                          ))}
                        </select>
                        {selectedCurrency && (
                          <p className="text-xs text-gray-500 mt-1">
                            Example: {selectedCurrency.symbol}1,234{selectedCurrency.decimal_places > 0 ? ".56" : ""}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Timezone Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timezone <span className="text-red-500">*</span>
                    </label>
                    {loadingOptions ? (
                      <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-gray-500">Loading timezones...</span>
                      </div>
                    ) : (
                      <>
                        <select
                          name="timezone"
                          value={companyForm.timezone}
                          onChange={handleInputChange}
                          required
                          disabled={loadingOptions}
                          className="w-full px-3 py-2 border text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          {timezones.slice(0, 50).map((timezone) => (
                            <option key={timezone.iana} value={timezone.iana}>
                              {timezone.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Primary timezone for this company
                        </p>
                      </>
                    )}
                  </div>

                  {/* Timezone Enabled Toggle */}
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="timezoneEnabled"
                        checked={companyForm.timezoneEnabled}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Enable timezone conversion
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      When disabled, all times will be displayed in UTC
                    </p>
                  </div>
                </div>
              </div>

              {/* Admin Details Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">
                  Company Admin Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin First Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      name="admin_first_name"
                      value={companyForm.admin_first_name}
                      onChange={handleInputChange}
                      placeholder="Enter first name"
                      required
                      className="w-full focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Last Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      name="admin_last_name"
                      value={companyForm.admin_last_name}
                      onChange={handleInputChange}
                      placeholder="Enter last name"
                      required
                      className="w-full focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      name="admin_email"
                      value={companyForm.admin_email}
                      onChange={handleInputChange}
                      placeholder="admin@company.com"
                      required
                      className="w-full focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        name="admin_password"
                        value={companyForm.admin_password}
                        onChange={handleInputChange}
                        placeholder="Enter password"
                        required
                        minLength={8}
                        className="w-full focus:ring-2 focus:ring-blue-500/20 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Password must be at least 8 characters
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                  className="min-w-[100px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || loadingOptions}
                  className="min-w-[100px] bg-[#1f40ae] text-white hover:bg-[#1f40ae]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Create Company
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
