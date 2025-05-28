// app/(admin)/users/page.jsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // For linking to user detail page
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreHorizontal, Search, RotateCw } from "lucide-react"; // UserPlus icon can be added back if "Add User" is implemented
import { Label } from '@/components/ui/label';

const ROWS_PER_PAGE = 10;
const ALL_ROLES_VALUE = "ALL_ROLES_FILTER_VALUE"; // Unique value for "All Roles" in filter
const ALL_STATUSES_VALUE = "ALL_STATUSES_FILTER_VALUE"; // Unique value for "All Statuses" in filter

// Skeleton Row Component for Users Table
const UserSkeletonRow = () => (
  <TableRow className="border-b-gray-700/30">
    <TableCell className="py-3"><Skeleton className="h-4 w-32 rounded" /></TableCell> {/* Name */}
    <TableCell className="py-3"><Skeleton className="h-4 w-40 rounded" /></TableCell> {/* Email */}
    <TableCell className="py-3"><Skeleton className="h-6 w-20 rounded-full" /></TableCell> {/* Role Badge */}
    <TableCell className="py-3"><Skeleton className="h-6 w-16 rounded-full" /></TableCell> {/* Status Badge */}
    <TableCell className="py-3 hidden md:table-cell"><Skeleton className="h-4 w-28 rounded" /></TableCell> {/* Last Login */}
    <TableCell className="py-3 hidden lg:table-cell"><Skeleton className="h-4 w-28 rounded" /></TableCell> {/* Joined */}
    <TableCell className="text-right py-3"><Skeleton className="h-8 w-8 rounded-md ml-auto" /></TableCell> {/* Actions */}
  </TableRow>
);


export default function AdminUsersPage() {
  const router = useRouter(); // Initialize useRouter for navigation

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(null); // Tracks userId being updated
  const [error, setError] = useState(null); // For page-level errors

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Filters and Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState(''); // Empty string for placeholder "All Roles"
  const [statusFilter, setStatusFilter] = useState(''); // Empty string for placeholder "Any Status"

  const fetchData = useCallback(async (page = 1, limit = ROWS_PER_PAGE, search = searchTerm, role = roleFilter, status = statusFilter) => {
    setIsLoading(true);
    setError(null); // Clear previous page errors
    try {
      // Simulate delay for testing skeleton (remove for production)
      // await new Promise(resolve => setTimeout(resolve, 1000));

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.append('search', search);
      // Only append if a specific filter is selected (not the "ALL" placeholder which results in "")
      if (role && role !== ALL_ROLES_VALUE) params.append('role', role);
      if (status && status !== ALL_STATUSES_VALUE) params.append('isActive', status);

      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) {
        let errorMsg = 'Failed to fetch users.';
        try { 
          const errData = await response.json(); 
          errorMsg = errData.error || errorMsg; 
        } catch (e) { /* Response might not be JSON */ }
        throw new Error(errorMsg);
      }
      const data = await response.json();
      setUsers(data.users);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
      setTotalUsers(data.totalUsers);
    } catch (errCatch) { // Renamed to avoid conflict with state 'error'
      console.error("Error in fetchData (Users):", errCatch);
      setError(errCatch.message); // Set page-level error
      toast.error("Failed to load users: " + errCatch.message); // Show toast
      setUsers([]); // Clear users on error
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, roleFilter, statusFilter]); // fetchData re-created if these change

  useEffect(() => {
    // Fetch data when component mounts or when fetchData function reference changes
    // (which happens if its dependencies - searchTerm, roleFilter, statusFilter - change)
    fetchData(1, ROWS_PER_PAGE, searchTerm, roleFilter, statusFilter);
  }, [fetchData]);

  const handleSearchInput = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleApplyFilters = () => {
      setCurrentPage(1); // Reset to first page when filters are applied
      // fetchData will be called by useEffect due to its dependencies changing if states are set
      // Or call explicitly to ensure immediate fetch with current states:
      fetchData(1, ROWS_PER_PAGE, searchTerm, roleFilter, statusFilter);
  };
  
  const handleResetFilters = () => {
    setSearchTerm('');
    setRoleFilter(''); // Resets to show placeholder "All Roles"
    setStatusFilter(''); // Resets to show placeholder "Any Status"
    setCurrentPage(1);
    // fetchData will be called due to state changes impacting useEffect, or call explicitly:
    fetchData(1, ROWS_PER_PAGE, '', '', '');
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      // setCurrentPage(newPage); // fetchData will update this based on its 'page' param
      fetchData(newPage, ROWS_PER_PAGE, searchTerm, roleFilter, statusFilter);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  const handleToggleUserStatus = async (userId, userName, currentIsActive) => {
    const newIsActive = !currentIsActive;
    setIsUpdatingStatus(userId); // Indicate which user's status is being updated

    const promiseAction = () => new Promise(async (resolve, reject) => {
        const response = await fetch(`/api/users/${userId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: newIsActive }),
        });
        if (!response.ok) {
            const errData = await response.json();
            reject(new Error(errData.error || 'Failed to update user status.'));
        } else {
            const updatedUser = await response.json();
            resolve(updatedUser);
        }
    });

    toast.promise(promiseAction(), {
        loading: `${newIsActive ? 'Activating' : 'Deactivating'} user ${userName}...`,
        success: (updatedUser) => {
            setUsers(prevUsers =>
                prevUsers.map(user =>
                    user.id === updatedUser.id ? { ...user, isActive: updatedUser.isActive, updatedAt: updatedUser.updatedAt } : user
                )
            );
            return `User ${updatedUser.name || userName} ${newIsActive ? 'activated' : 'deactivated'} successfully!`;
        },
        error: (err) => `Error toggling status: ${err.message}`,
        finally: () => setIsUpdatingStatus(null) // Clear updating status for any user
    });
  };

  // Prepare skeleton rows for loading state
  const skeletonUserRows = Array.from({ length: ROWS_PER_PAGE }).map((_, index) => (
    <UserSkeletonRow key={`skeleton-user-${index}`} />
  ));

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        {/* Optional: Add New User Button 
        <Button 
          className="bg-white/10 hover:bg-white/20 text-white border border-gray-700/50" 
          disabled={isLoading}
        >
          <UserPlus className="mr-2 h-4 w-4" /> Add New User
        </Button> */}
      </div>

      {/* Filters and Search Section */}
      <div className="mb-6 p-4 rounded-lg border border-gray-700/50 bg-black/30 backdrop-blur-md shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Search Input */}
          <div className="relative">
            <Label htmlFor="search" className="text-xs text-gray-400">Search (Name/Email)</Label>
            <Input
              id="search"
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={handleSearchInput}
              className="bg-black/50 border-gray-600 text-white placeholder-gray-500 focus:ring-white/50 focus:border-white/50 mt-1 pr-10"
              disabled={isLoading}
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 mt-[calc(0.125rem+1px)] h-4 w-4 text-gray-500" />
          </div>
          {/* Role Filter Select */}
          <div>
            <Label htmlFor="roleFilter" className="text-xs text-gray-400">Role</Label>
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value === ALL_ROLES_VALUE ? "" : value)} disabled={isLoading}>
              <SelectTrigger id="roleFilter" className="bg-black/50 border-gray-600 text-white mt-1 disabled:opacity-70 disabled:cursor-not-allowed">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent className="bg-black/80 border-gray-700 text-white backdrop-blur-md">
                <SelectItem value={ALL_ROLES_VALUE} className="hover:bg-white/10 focus:!bg-white/10">All Roles</SelectItem>
                <SelectItem value="ARTISAN" className="hover:bg-white/10 focus:!bg-white/10">Artisan</SelectItem>
                <SelectItem value="CUSTOMER" className="hover:bg-white/10 focus:!bg-white/10">Customer</SelectItem>
                <SelectItem value="ADMIN" className="hover:bg-white/10 focus:!bg-white/10">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Status Filter Select */}
          <div>
            <Label htmlFor="statusFilter" className="text-xs text-gray-400">Status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value === ALL_STATUSES_VALUE ? "" : value)} disabled={isLoading}>
              <SelectTrigger id="statusFilter" className="bg-black/50 border-gray-600 text-white mt-1 disabled:opacity-70 disabled:cursor-not-allowed">
                <SelectValue placeholder="Any Status" />
              </SelectTrigger>
              <SelectContent className="bg-black/80 border-gray-700 text-white backdrop-blur-md">
                <SelectItem value={ALL_STATUSES_VALUE} className="hover:bg-white/10 focus:!bg-white/10">Any Status</SelectItem>
                <SelectItem value="true" className="hover:bg-white/10 focus:!bg-white/10">Active</SelectItem>
                <SelectItem value="false" className="hover:bg-white/10 focus:!bg-white/10">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Filter Buttons */}
          <div className="flex space-x-2">
            <Button onClick={handleApplyFilters} className="w-full bg-white/10 hover:bg-white/20 text-white border border-gray-700/50" disabled={isLoading}>Apply Filters</Button>
            <Button onClick={handleResetFilters} variant="outline" title="Reset Filters" className="w-auto p-2 text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white" disabled={isLoading}>
              <RotateCw className="h-4 w-4"/>
            </Button>
          </div>
        </div>
      </div>

      {/* Page-level Error Display */}
      {!isLoading && error && ( 
        <div className="text-center py-4 my-4 p-3 rounded-md bg-red-900/50 border border-red-700 text-red-300">
            <p className="font-semibold">Page Error:</p>
            <p>{error}</p> {/* This 'error' is the state variable */}
        </div>
      )}

      {/* Table Section */}
      <div className="rounded-lg border border-gray-700/50 bg-black/30 backdrop-blur-md shadow-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b-gray-700/50 hover:bg-black/0"> {/* No hover effect for header */}
              <TableHead className="text-white/80 whitespace-nowrap">Name</TableHead>
              <TableHead className="text-white/80 whitespace-nowrap">Email</TableHead>
              <TableHead className="text-white/80 whitespace-nowrap">Role</TableHead>
              <TableHead className="text-white/80 whitespace-nowrap">Status</TableHead>
              <TableHead className="text-white/80 hidden md:table-cell whitespace-nowrap">Last Login</TableHead>
              <TableHead className="text-white/80 hidden lg:table-cell whitespace-nowrap">Joined</TableHead>
              <TableHead className="text-white/80 text-right whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <>
                {skeletonUserRows}
              </>
            ) : !error && users.length > 0 ? (
              users.map((user) => (
                <TableRow key={user.id} className={`border-b-gray-700/30 hover:bg-black/40 ${isUpdatingStatus === user.id ? 'opacity-50 animate-pulse' : ''}`}>
                  <TableCell className="font-medium text-white py-3">{user.name || 'N/A'}</TableCell>
                  <TableCell className="text-gray-300 py-3">{user.email}</TableCell>
                  <TableCell className="py-3">
                    <span className={`px-2.5 py-1 text-xs rounded-full font-semibold
                      ${user.role === 'ADMIN' ? 'bg-red-400/20 text-red-300 border border-red-400/30' :
                        user.role === 'ARTISAN' ? 'bg-sky-400/20 text-sky-300 border border-sky-400/30' :
                        'bg-green-400/20 text-green-300 border border-green-400/30'}`}>
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className={`px-2.5 py-1 text-xs rounded-full font-semibold
                      ${user.isActive ? 'bg-green-400/20 text-green-300 border border-green-400/30' : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-400 hidden md:table-cell py-3">{formatDate(user.lastLogin)}</TableCell>
                  <TableCell className="text-gray-400 hidden lg:table-cell py-3">{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="text-right py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-white data-[state=open]:bg-white/10" disabled={!!isUpdatingStatus}>
                          <span className="sr-only">Open menu for {user.name}</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-black/80 border-gray-700 text-white backdrop-blur-md shadow-xl">
                        <DropdownMenuLabel className="text-gray-400">Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-gray-700/50"/>
                        <DropdownMenuItem
                          className="hover:!bg-white/10 focus:!bg-white/10 cursor-pointer"
                          onClick={() => router.push(`/users/${user.id}`)} // Navigate to user detail page
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="hover:!bg-white/10 focus:!bg-white/10 cursor-pointer">
                          Edit User (Coming Soon)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-gray-700/50"/>
                        <DropdownMenuItem
                          className={`cursor-pointer ${user.isActive ? 'text-orange-400 hover:!text-orange-300 focus:!text-orange-300' : 'text-green-400 hover:!text-green-300 focus:!text-green-300'} hover:!bg-white/10 focus:!bg-white/10`}
                          onClick={() => handleToggleUserStatus(user.id, user.name || user.email, user.isActive)}
                          disabled={isUpdatingStatus === user.id}
                        >
                          {isUpdatingStatus === user.id ? (user.isActive ? 'Deactivating...' : 'Activating...') : (user.isActive ? 'Deactivate' : 'Activate')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : null } {/* No explicit "No users" message inside TableBody if error or loading handles it */}
          </TableBody>
        </Table>
        {/* "No users" message, shown only if not loading, no error, and no users */}
        {!isLoading && !error && users.length === 0 && (
             <div className="text-center py-10">
                <p className="text-gray-400">No users found matching your criteria.</p>
            </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!isLoading && !error && users.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 text-sm text-gray-300">
          <span className="text-xs sm:text-sm">Page {currentPage} of {totalPages} (Total: {totalUsers} users)</span>
          <div className="space-x-1 sm:space-x-2">
            <Button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading || !!isUpdatingStatus}
              variant="outline"
              size="sm"
              className="text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white disabled:opacity-50"
            >
              Previous
            </Button>
            <Button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isLoading || !!isUpdatingStatus}
              variant="outline"
              size="sm"
              className="text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white disabled:opacity-50"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}