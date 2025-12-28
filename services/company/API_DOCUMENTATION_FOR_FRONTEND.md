# Employee Profile Management API Documentation

## Overview
This document provides the frontend team with the correct API endpoints to use for employee profile management, including profile statistics, role-based grouping, and profile completion tracking.

## Base URL
```
/api/company
```

## Available Endpoints

### 1. Get Users Grouped by Role
**Endpoint**: `GET /api/company/profiles/by-role`

**Description**: Get all users grouped by their roles with optional profile completion statistics.

**Query Parameters**:
- `include_inactive` (boolean, optional, default: false) - Include inactive users in the response
- `include_completion_stats` (boolean, optional, default: true) - Include profile completion statistics

**Response Structure**:
```json
{
  "roles": [
    {
      "role_id": "string",
      "role_name": "string",
      "role_display_name": "string",
      "users": [
        {
          "id": "string",
          "user_id": "string",
          "employee_code": "string",
          "first_name": "string",
          "last_name": "string",
          "email": "string",
          "phone": "string",
          "department": "string",
          "designation": "string",
          "branch_id": "string",
          "branch_name": "string",
          "is_active": boolean,
          "created_at": "datetime",
          "updated_at": "datetime",
          "profile_completion": {
            "completion_percentage": number,
            "completed_sections": ["string"],
            "missing_sections": ["string"],
            "total_sections": number,
            "is_complete": boolean
          }
        }
      ],
      "total_count": number,
      "active_count": number,
      "inactive_count": number
    }
  ],
  "total_users": number,
  "total_active": number,
  "total_inactive": number,
  "completion_stats": {
    "total_profiles": number,
    "fully_complete": number,
    "partially_complete": number,
    "not_started": number,
    "average_completion_percentage": number
  },
  "generated_at": "datetime"
}
```

**Example Request**:
```javascript
// Get active users grouped by role with completion stats
GET /api/company/profiles/by-role?include_inactive=false&include_completion_stats=true

// Get all users (including inactive) grouped by role
GET /api/company/profiles/by-role?include_inactive=true
```

---

### 2. Get Profile Statistics
**Endpoint**: `GET /api/company/profiles/stats`

**Description**: Get comprehensive profile statistics including totals, by type, by branch, and completion metrics.

**Response Structure**:
```json
{
  "total_profiles": number,
  "active_profiles": number,
  "inactive_profiles": number,
  "profiles_by_type": {
    "employee": number,
    "driver": number,
    "finance_manager": number,
    "branch_manager": number,
    "logistics_manager": number
  },
  "profiles_by_branch": {
    "branch_name": number
  },
  "profiles_by_department": {
    "department_name": number
  },
  "recent_additions": number,
  "documents_total": number,
  "documents_verified": number,
  "documents_pending": number,
  "documents_expiring_soon": number,
  "documents_expired": number,
  "avg_completion_percentage": number
}
```

**Example Request**:
```javascript
GET /api/company/profiles/stats
```

---

### 3. Get Individual Profile Completion
**Endpoint**: `GET /api/company/profiles/{profile_type}/{profile_id}/completion`

**Description**: Get completion percentage for a specific profile.

**Path Parameters**:
- `profile_type` (string) - Type of profile (employee, driver, finance_manager, branch_manager, logistics_manager)
- `profile_id` (string) - ID of the profile

**Response Structure**:
```json
{
  "profile_id": "string",
  "profile_type": "string",
  "completion_percentage": number,
  "completed_sections": ["string"],
  "missing_sections": ["string"],
  "total_sections": number,
  "last_updated": "datetime"
}
```

**Example Request**:
```javascript
GET /api/company/profiles/employee/12345/completion
GET /api/company/profiles/driver/67890/completion
```

---

### 4. Get Batch Profile Completion
**Endpoint**: `POST /api/company/profiles/batch-completion`

**Description**: Get completion percentage for multiple profiles at once (max 100 profiles).

**Query Parameters**:
- `profile_type` (string, default: "employee") - Profile type for all provided IDs

**Request Body**:
```json
["profile_id_1", "profile_id_2", "profile_id_3"]
```

**Response Structure**:
```json
[
  {
    "profile_id": "string",
    "profile_type": "string",
    "completion_percentage": number,
    "completed_sections": ["string"],
    "missing_sections": ["string"],
    "total_sections": number,
    "last_updated": "datetime"
  }
]
```

**Example Request**:
```javascript
POST /api/company/profiles/batch-completion?profile_type=employee
Content-Type: application/json

["12345", "67890", "11111"]
```

---

### 5. List Users (with Filtering)
**Endpoint**: `GET /api/company/users/`

**Description**: List all users with pagination and filtering support.

**Query Parameters**:
- `page` (integer, default: 1) - Page number
- `per_page` (integer, default: 20, max: 100) - Items per page
- `search` (string, optional) - Search term (searches in name, email, phone, employee_code)
- `role_id` (string, optional) - Filter by role ID
- `branch_id` (string, optional) - Filter by branch ID
- `is_active` (boolean, optional) - Filter by active status

**Response Structure**:
```json
{
  "items": [
    {
      "id": "string",
      "user_id": "string",
      "employee_code": "string",
      "first_name": "string",
      "last_name": "string",
      "email": "string",
      "phone": "string",
      "department": "string",
      "designation": "string",
      "branch_id": "string",
      "is_active": boolean,
      "role": {
        "id": "string",
        "role_name": "string",
        "display_name": "string"
      },
      "branch": {
        "id": "string",
        "name": "string",
        "code": "string"
      }
    }
  ],
  "total": number,
  "page": number,
  "per_page": number,
  "pages": number
}
```

**Example Requests**:
```javascript
// Get all active users
GET /api/company/users/?is_active=true

// Get users in a specific role
GET /api/company/users/?role_id=12345

// Search users by name or email
GET /api/company/users/?search=john

// Get users with pagination
GET /api/company/users/?page=2&per_page=50
```

---

### 6. Get Single User
**Endpoint**: `GET /api/company/users/{user_id}`

**Description**: Get detailed information for a specific user.

**Path Parameters**:
- `user_id` (string) - ID of the user

**Response Structure**: Same as individual user object in the list endpoint above.

---

## Profile Completion Criteria

### Employee Profile Completion
The following fields are checked for employee profile completion:
1. **Personal Information**: first_name
2. **Contact Details**: phone
3. **Address**: address
4. **Employment Details**: department, designation, hire_date
5. **Financial Information**: pan_number

A profile is considered complete when all required fields have valid values.

## Recommended Frontend Implementation

### For Dashboard/Statistics View:
1. Use `GET /api/company/profiles/stats` to get overall statistics
2. Display metrics like:
   - Total/Active/Inactive users
   - Users by role (pie chart)
   - Users by department (bar chart)
   - Average completion percentage

### For Employee List View:
1. Use `GET /api/company/profiles/by-role` to get users grouped by role
2. This endpoint provides:
   - Users organized by roles
   - Profile completion status for each user
   - Active/inactive counts per role
   - Overall completion statistics

### For Profile Detail View:
1. Use `GET /api/company/profiles/employee/{id}/completion` to get detailed completion status
2. Show which sections are complete/missing
3. Provide visual progress indicators

### For Bulk Operations:
1. Use `POST /api/company/profiles/batch-completion` to check completion for multiple users
2. Useful for dashboard widgets showing multiple profiles

## Performance Considerations

1. **Use pagination** when listing users to avoid loading all users at once
2. **Batch completion checks** when displaying multiple profiles
3. **Filter on the server** using the provided query parameters
4. **Cache statistics data** as they don't change frequently

## Error Handling

Common HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (user/profile not found)
- `500` - Internal Server Error

Error Response Format:
```json
{
  "detail": "Error message description"
}
```

## Example Frontend Implementation (React)

```javascript
// Fetch users grouped by role
const fetchUsersByRole = async (includeInactive = false) => {
  try {
    const response = await fetch(
      `/api/company/profiles/by-role?include_inactive=${includeInactive}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching users by role:', error);
    throw error;
  }
};

// Fetch profile statistics
const fetchProfileStats = async () => {
  try {
    const response = await fetch('/api/company/profiles/stats');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching profile stats:', error);
    throw error;
  }
};

// Usage in React component
const EmployeeDashboard = () => {
  const [usersByRole, setUsersByRole] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const [usersData, statsData] = await Promise.all([
        fetchUsersByRole(),
        fetchProfileStats()
      ]);
      setUsersByRole(usersData);
      setStats(statsData);
    };
    loadData();
  }, []);

  // Render your dashboard using the data
  return (
    <div>
      {/* Your dashboard UI */}
    </div>
  );
};
```

## Summary

The frontend should use:
- `/api/company/profiles/stats` for dashboard statistics (exists and working)
- `/api/company/profiles/by-role` for users grouped by role (newly added)
- `/api/company/profiles/employee/{id}/completion` for individual profile completion
- `/api/company/profiles/batch-completion` for bulk completion checks (newly added)
- `/api/company/users/` for standard user listing with filtering