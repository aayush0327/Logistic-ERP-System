# User Management Frontend Integration

This directory contains the frontend implementation for the User Management module of the Logistics ERP System. It's fully integrated with the backend APIs and provides a comprehensive interface for managing users, roles, profiles, and documents.

## Features

### 1. User List Page (`/masters/users`)
- **Advanced Filtering**: Filter users by role, branch, status, and search query
- **Pagination**: Navigate through large lists of users
- **Bulk Operations**: Select multiple users for bulk actions (activate, deactivate, delete)
- **Export Functionality**: Export users to Excel or CSV
- **Quick Actions**: View details, edit, activate/deactivate, or delete individual users
- **Real-time Statistics**: Display total, active, inactive, and admin user counts

### 2. User Creation Page (`/masters/users/new`)
- **Form Validation**: Zod-based schema validation with React Hook Form
- **Role Assignment**: Dynamic role selection with auto-selection based on profile type
- **Branch Assignment**: Optional branch assignment for users
- **Invitation System**: Option to send invitation email to new users
- **Profile Types**: Support for staff, driver, and admin profile types

### 3. User Detail Page (`/masters/users/[id]`)
- **Comprehensive View**: Display all user information including profile details
- **Profile Integration**: Shows profile data if available
- **System Information**: Role, status, branch, last login, etc.
- **Quick Edit Access**: Direct link to edit page

### 4. User Edit Page (`/masters/users/[id]/edit`)
- **Smart Updates**: Only send changed fields to the API
- **Read-only Fields**: Profile type and superuser status cannot be modified
- **Validation**: Ensure data integrity with form validation
- **Status Management**: Toggle active status

### 5. User Profile Component (`UserProfile.tsx`)
- **Modal Interface**: Full-screen modal for detailed profile management
- **Tabbed Interface**: Personal info, professional details, and documents
- **Profile Completion**: Visual indicator of profile completion percentage
- **Edit Mode**: Toggle between view and edit modes
- **Address Management**: Current and permanent addresses
- **Document Management**: Upload, view, and manage user documents

### 6. Profile Completion Component (`ProfileCompletion.tsx`)
- **Visual Progress**: Progress bar showing completion percentage
- **Status Indicators**: Color-coded status (Excellent, Good, Fair, Poor)
- **Missing Fields List**: Shows which fields need to be completed
- **Compact Design**: Fits well in sidebars and headers

### 7. Document Manager (`DocumentManager.tsx`)
- **Multiple Document Types**: Support for various document types (Aadhar, PAN, Passport, etc.)
- **Upload Validation**: File type and size validation
- **Progress Tracking**: Visual feedback during upload
- **Document Verification**: Admin can verify uploaded documents
- **Search & Filter**: Find documents quickly
- **Preview & Download**: View documents in browser or download

### 8. User Invitation Modal (`UserInvitationModal.tsx`)
- **Bulk Invitations**: Send multiple invitations at once
- **Custom Messages**: Add personalized messages to invitations
- **Role & Branch Assignment**: Set role and branch during invitation
- **Form Validation**: Ensure all required fields are filled

### 9. Role Management (`RoleSelector.tsx`)
- **Role Selection**: Dropdown component for role selection
- **Role Badges**: Visual badges for roles with system indicators
- **Role Manager**: Full interface for creating and managing roles
- **Permission Management**: Assign permissions to roles
- **System Roles Protection**: Prevents modification of system roles

## API Integration

### Redux Toolkit Query Configuration
The user management is integrated with Redux Toolkit Query in `companyApi.ts`:

```typescript
// User endpoints
- useGetUsersQuery: Fetch paginated users with filters
- useGetUserQuery: Fetch single user details
- useCreateUserMutation: Create new user
- useUpdateUserMutation: Update existing user
- useDeleteUserMutation: Delete user
- useUpdateUserStatusMutation: Activate/deactivate user
- useInviteUserMutation: Send user invitation
- useBulkInviteUsersMutation: Send multiple invitations
- useExportUsersMutation: Export users to Excel/CSV
- useBulkUpdateUsersMutation: Bulk update users

// Profile endpoints
- useGetUserProfileQuery: Get user profile
- useUpdateUserProfileMutation: Update user profile
- useGetProfileCompletionQuery: Get profile completion percentage

// Document endpoints
- useGetUserDocumentsQuery: Get user documents
- useUploadUserDocumentMutation: Upload document
- useDeleteUserDocumentMutation: Delete document
- useVerifyUserDocumentMutation: Verify document

// Role endpoints
- useGetRolesQuery: Get all roles
- useGetPermissionsQuery: Get all permissions
- useCreateRoleMutation: Create new role
- useUpdateRoleMutation: Update role
- useDeleteRoleMutation: Delete role
```

## Type Safety

All components use TypeScript types defined in `companyApi.ts`:

```typescript
- User: Basic user information
- UserProfile: Extended profile details
- UserDocument: Document metadata
- Role: Role definition with permissions
- Permission: Individual permission
- Branch: Branch information
- And many more form and response types
```

## Best Practices Implemented

1. **Error Handling**: Comprehensive error handling with toast notifications
2. **Loading States**: Loading indicators for all async operations
3. **Form Validation**: Zod schemas for robust validation
4. **Caching**: RTK Query caching with proper tag invalidation
5. **Optimistic Updates**: Where applicable for better UX
6. **Responsive Design**: Mobile-friendly interfaces
7. **Accessibility**: Proper ARIA labels and keyboard navigation
8. **Code Organization**: Modular components with clear responsibilities

## Dependencies

Make sure these packages are installed:

```json
{
  "react-hook-form": "^7.0.0",
  "@hookform/resolvers": "^3.0.0",
  "zod": "^3.0.0",
  "@radix-ui/react-progress": "^1.0.0",
  "@radix-ui/react-checkbox": "^1.0.0",
  "@radix-ui/react-separator": "^1.0.0",
  "react-hot-toast": "^2.0.0",
  "lucide-react": "^0.263.0",
  "@reduxjs/toolkit": "^1.9.0"
}
```

## Usage

1. **Viewing Users**: Navigate to `/masters/users` to see the user list
2. **Creating Users**: Click "New User" button or go to `/masters/users/new`
3. **Editing Users**: Click "Edit" on any user or go to `/masters/users/[id]/edit`
4. **Viewing Details**: Click "View Details" or go to `/masters/users/[id]`
5. **Managing Profiles**: Click on user profile to open detailed view
6. **Managing Documents**: Access through user profile modal
7. **Inviting Users**: Click "Invite Users" button on the user list page

## Customization

The components are designed to be easily customizable:

- Modify the theme by updating Tailwind classes
- Add new document types in the DocumentManager component
- Extend validation schemas as needed
- Add new fields to profile forms
- Customize role permissions in the RoleManager

## Notes

- All API endpoints are properly configured with authentication
- Components handle edge cases like empty states and errors
- The integration follows RESTful principles
- Pagination and filtering are handled efficiently on the backend
- File uploads include progress tracking and validation