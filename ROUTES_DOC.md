# Frontend Routing and Module Structure

## Route Hierarchy

```
/                                   # Root/Landing
├── /login                          # Login page
├── /forgot-password                # Password reset
├── /app                            # Authenticated layouts
│   ├── /super-admin                # Super Admin Module
│   │   ├── /dashboard              # Dashboard
│   │   ├── /companies              # Manage companies
│   │   │   ├── /[id]               # Company details
│   │   │   └── /new                # Create company
│   │   ├── /tenants                # View all tenants
│   │   ├── /subscriptions          # Subscriptions overview
│   │   └── /settings               # System settings
│   │
│   ├── /company-admin              # Company Admin Module
│   │   ├── /dashboard              # Company dashboard
│   │   ├── /branches               # Manage branches
│   │   │   ├── /[id]               # Branch details
│   │   │   └── /new                # Create branch
│   │   ├── /users                  # Manage users
│   │   │   ├── /[id]               # User details
│   │   │   └── /new                # Create user
│   │   ├── /customers              # Manage customers
│   │   │   ├── /[id]               # Customer details
│   │   │   └── /new                # Create customer
│   │   ├── /vehicles               # Manage vehicles
│   │   │   ├── /[id]               # Vehicle details
│   │   │   └── /new                # Add vehicle
│   │   ├── /pricing                # Configure pricing
│   │   │   ├── /rules              # Price rules
│   │   │   └── /zones              # Service zones
│   │   ├── /reports                # Reports
│   │   └── /settings               # Company settings
│   │
│   ├── /branch-manager             # Branch Manager Module
│   │   ├── /dashboard              # Branch dashboard
│   │   ├── /orders                 # Sales orders
│   │   │   ├── /[id]               # Order details
│   │   │   ├── /new                # Create order
│   │   │   └── /[id]/edit          # Edit order
│   │   ├── /customers              # View customers (read-only)
│   │   │   └── /[id]               # Customer details
│   │   └── /reports                # Branch reports
│   │
│   ├── /finance-manager            # Finance Manager Module
│   │   ├── /dashboard              # Finance dashboard
│   │   ├── /orders                 # Pending orders
│   │   │   ├── /pending            # Pending approval
│   │   │   ├── /approved           # Approved orders
│   │   │   ├── /rejected           # Rejected orders
│   │   │   └── /[id]               # Order details
│   │   ├── /pricing                # View pricing
│   │   └── /reports                # Financial reports
│   │
│   ├── /logistics-manager          # Logistics Manager Module
│   │   ├── /dashboard              # Logistics dashboard
│   │   ├── /trips                  # Trip plans
│   │   │   ├── /[id]               # Trip details
│   │   │   ├── /new                # Create trip
│   │   │   └── /[id]/edit          # Edit trip
│   │   ├── /vehicles               # Vehicle management
│   │   │   ├── /[id]               # Vehicle details
│   │   │   └── /new                # Add vehicle
│   │   ├── /drivers                # Driver management
│   │   ├── /orders                 # Approved orders for planning
│   │   └── /tracking               # Live tracking
│   │
│   └── /driver                     # Driver Module
│       ├── /dashboard              # Driver dashboard
│       ├── /trips                  # Assigned trips
│       │   └── /[id]               # Trip details with route
│       ├── /profile                # Driver profile
│       └── /completed              # Completed trips
```

## Component Structure

### Shared Components (`/src/components/shared`)
```
src/components/shared/
├── ui/                             # Base UI Components
│   ├── Button/
│   ├── Input/
│   ├── Select/
│   ├── Modal/
│   ├── Dropdown/
│   ├── DatePicker/
│   ├── Table/
│   ├── Card/
│   ├── Badge/
│   ├── Avatar/
│   └── Spinner/
├── layout/
│   ├── Sidebar/
│   ├── Header/
│   ├── Footer/
│   └── AppLayout/
├── forms/
│   ├── CustomerForm/
│   ├── OrderForm/
│   ├── VehicleForm/
│   ├── TripForm/
│   └── UserForm/
└── widgets/
    ├── KPICard/
    ├── ChartCard/
    ├── StatCard/
    └── AlertCard/
```

### Module-Specific Components (`/src/components/modules`)

#### Super Admin Components
```
src/components/modules/super-admin/
├── CompanyList/
├── CompanyCard/
├── TenantTable/
└── SubscriptionChart/
```

#### Company Admin Components
```
src/components/modules/company-admin/
├── BranchList/
├── BranchCard/
├── UserManagement/
├── CustomerTable/
├── VehicleGrid/
├── PricingRules/
└── Reports/
```

#### Branch Manager Components
```
src/components/modules/branch-manager/
├── OrderCard/
├── OrderForm/
├── OrderTable/
├── CustomerCard/
└── OrderStatusBadge/
```

#### Finance Manager Components
```
src/components/modules/finance-manager/
├── OrderApproval/
├── OrderReview/
├── PricingView/
├── PaymentStatus/
└── FinanceDashboard/
```

#### Logistics Manager Components
```
src/components/modules/logistics-manager/
├── TripPlanner/
├── TripCard/
├── VehicleSelector/
├── OrderMap/
├── RouteOptimization/
└── DriverAssignment/
```

#### Driver Components
```
src/components/modules/driver/
├── TripDetails/
├── RouteMap/
├── StatusUpdate/
├── PODUpload/
└── DeliveryStops/
```

### State Management Structure (`/src/store`)
```
src/store/
├── index.ts                        # Store configuration
├── slices/
│   ├── authSlice.ts                # Authentication state
│   ├── userSlice.ts                # User info & permissions
│   ├── companySlice.ts             # Current company context
│   ├── orderSlice.ts               # Order management
│   ├── tripSlice.ts                # Trip management
│   ├── vehicleSlice.ts             # Vehicle data
│   ├── customerSlice.ts            # Customer data
│   ├── notificationSlice.ts        # Notifications
│   └── kpiSlice.ts                 # Dashboard KPIs
└── api/
    ├── authApi.ts                  # Auth service API
    ├── orderApi.ts                 # Order service API
    ├── logisticsApi.ts             # Logistics service API
    ├── billingApi.ts               # Billing service API
    └── analyticsApi.ts             # Analytics service API
```

## Permission-Based Routing

### Route Guards
```typescript
// Route protection based on user roles
const protectedRoutes = {
  '/app/super-admin': ['super_admin'],
  '/app/company-admin': ['company_admin'],
  '/app/branch-manager': ['branch_manager'],
  '/app/finance-manager': ['finance_manager'],
  '/app/logistics-manager': ['logistics_manager'],
  '/app/driver': ['driver']
};

// Permission-based component access
const permissions = {
  'view_orders': ['company_admin', 'branch_manager', 'finance_manager', 'logistics_manager'],
  'create_orders': ['branch_manager'],
  'approve_orders': ['finance_manager'],
  'create_trips': ['logistics_manager'],
  'manage_vehicles': ['company_admin', 'logistics_manager'],
  'manage_users': ['company_admin', 'super_admin']
};
```

### Navigation Menu by Role
```typescript
const navigationMenus = {
  super_admin: [
    { href: '/app/super-admin/dashboard', label: 'Dashboard' },
    { href: '/app/super-admin/companies', label: 'Companies' },
    { href: '/app/super-admin/tenants', label: 'Tenants' },
    { href: '/app/super-admin/subscriptions', label: 'Subscriptions' }
  ],
  company_admin: [
    { href: '/app/company-admin/dashboard', label: 'Dashboard' },
    { href: '/app/company-admin/branches', label: 'Branches' },
    { href: '/app/company-admin/users', label: 'Users' },
    { href: '/app/company-admin/customers', label: 'Customers' },
    { href: '/app/company-admin/vehicles', label: 'Vehicles' },
    { href: '/app/company-admin/pricing', label: 'Pricing' },
    { href: '/app/company-admin/reports', label: 'Reports' }
  ],
  // ... other roles
};
```

## Key Features Implementation

### 1. Real-time Updates
- WebSocket connection for live notifications
- Real-time GPS tracking for drivers
- Live order status updates

### 2. Offline Support
- Service worker for caching
- Offline data storage (IndexedDB)
- Sync when online

### 3. Responsive Design
- Mobile-first approach
- Tablet layouts for field use
- Desktop layouts for office use

### 4. Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- High contrast mode

### 5. Performance
- Code splitting by module
- Lazy loading of components
- Image optimization
- Bundle size optimization

## Testing Strategy

### Unit Tests
- Component testing with Jest & React Testing Library
- Utility function tests
- Hook tests

### Integration Tests
- API integration tests
- Form submission flows
- Navigation tests

### E2E Tests
- User journey tests
- Cross-browser tests
- Mobile responsive tests

## Deployment Configuration

### Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_MAP_API_KEY=your_map_api_key
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

### Build Configuration
```javascript
// next.config.js
module.exports = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client']
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false,
        has: [
          {
            type: 'cookie',
            key: 'auth-token',
            value: 'undefined'
          }
        ]
      }
    ];
  }
};
```