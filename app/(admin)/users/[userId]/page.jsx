// app/(admin)/users/[userId]/page.jsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
// import Link from 'next/link'; // Not explicitly used if router.push is preferred
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Edit3, ShieldAlert, ShieldCheck, UserCircle2 } from 'lucide-react';

// Helper to format dates
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-GB', { // Using en-GB for dd/mm/yyyy, adjust as needed
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });
};

// DetailItem component for displaying user info
const DetailItem = ({ label, value, className = "" }) => (
  <div className={`mb-3 ${className}`}>
    <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
    <p className="text-base text-white break-words">{value || 'N/A'}</p>
  </div>
);

// Skeleton for the detail page
const UserDetailPageSkeleton = () => (
  <Card className="bg-black/30 border-gray-700/50 backdrop-blur-md shadow-lg text-white">
    <CardHeader className="border-b border-gray-700/50 pb-4">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div>
          <Skeleton className="h-7 w-48 mb-1 rounded" />
          <Skeleton className="h-4 w-64 rounded" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-6 grid gap-y-4 gap-x-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => ( // Create 6 skeleton detail items
        <div key={i} className="mb-3">
          <Skeleton className="h-3 w-20 mb-1.5 rounded" />
          <Skeleton className="h-5 w-full rounded" />
        </div>
      ))}
    </CardContent>
  </Card>
);


export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userId } = params; // userId will be a string from the URL

  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null); // For page-level fetch errors

  // State for Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: '',
    isActive: true, // Default to true
  });

  const fetchUserDetails = useCallback(async () => {
    if (!userId) {
      setError("User ID is missing from URL.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        let errorMsg = `Failed to fetch user details. Status: ${response.status}`;
        try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch (e) {/* ignore if not json */}
        throw new Error(errorMsg);
      }
      const data = await response.json();
      setUser(data);
      // Initialize edit form data when user data is successfully fetched
      setEditFormData({
        name: data.name || '',
        email: data.email || '',
        role: data.role || '',
        isActive: data.isActive === undefined ? true : data.isActive,
      });
    } catch (errCatch) {
      console.error("Error fetching user details:", errCatch);
      setError(errCatch.message);
      toast.error("Fetch Error: " + errCatch.message);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  // Handler for text input changes in the edit form
  const handleEditFormInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Specific handler for the Shadcn Switch component
  const handleEditFormSwitchChange = (checked) => {
    setEditFormData(prev => ({ ...prev, isActive: checked }));
  };

  // Specific handler for the Shadcn Select component (for role)
  const handleEditFormRoleChange = (value) => {
    setEditFormData(prev => ({ ...prev, role: value }));
  };

  const handleOpenEditDialog = () => {
    if (user) { // Ensure user data is loaded before populating form
      setEditFormData({
        name: user.name || '',
        email: user.email || '',
        role: user.role || '',
        isActive: user.isActive,
      });
      setIsEditDialogOpen(true);
    } else {
      toast.error("User data not available to edit.");
    }
  };

  const handleEditUserSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    // Only send fields that have actually changed or all fields if API expects full object
    // For simplicity, sending all fields from editFormData.
    // The backend will handle checking if they differ from existingUser.
    const payload = {
        name: editFormData.name.trim() === "" ? null : editFormData.name.trim(), // Allow unsetting name if field can be null
        email: editFormData.email.trim(),
        role: editFormData.role,
        isActive: editFormData.isActive,
    };

    if (!payload.email) {
        toast.error("Email cannot be empty.");
        return;
    }

    const promiseAction = () => new Promise(async (resolve, reject) => {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json();
      if (!response.ok) {
        reject(new Error(responseData.error || 'Failed to update user.'));
      } else {
        resolve(responseData); // API should return the updated user object (or {message, user})
      }
    });

    toast.promise(promiseAction(), {
      loading: 'Updating user details...',
      success: (updatedData) => {
        // API might return just the updated user, or an object like { message, user }
        const updatedUserObject = updatedData.user || updatedData;
        setUser(updatedUserObject); // Update local state with the full updated user from response
        setEditFormData({ // Also reset edit form to new truth
            name: updatedUserObject.name || '',
            email: updatedUserObject.email || '',
            role: updatedUserObject.role || '',
            isActive: updatedUserObject.isActive,
        });
        setIsEditDialogOpen(false);
        return updatedData.message || 'User details updated successfully!';
      },
      error: (err) => `Update Error: ${err.message}`,
    });
  };

  if (isLoading) {
    return (
      <div>
        <Button variant="outline" onClick={() => router.push('/users')} className="mb-6 text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users List
        </Button>
        <UserDetailPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Button variant="outline" onClick={() => router.push('/users')} className="mb-6 text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users List
        </Button>
        <Card className="bg-red-900/30 border-red-700/50 text-red-300">
          <CardHeader><CardTitle className="text-red-200">Error Loading User</CardTitle></CardHeader>
          <CardContent><p>{error}</p></CardContent>
        </Card>
      </div>
    );
  }

  if (!user) { // Should be caught by error state if fetch fails, but good fallback
    return (
      <div>
        <Button variant="outline" onClick={() => router.push('/users')} className="mb-6 text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users List
        </Button>
        <Card className="bg-black/30 border-gray-700/50 text-white">
          <CardHeader><CardTitle>User Not Found</CardTitle></CardHeader>
          <CardContent><p>The requested user could not be found.</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <Button variant="outline" onClick={() => router.push('/users')} className="text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white self-start sm:self-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users List
        </Button>
        
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            // If closing dialog without saving, reset form to current user details
            if (!open && user) {
                setEditFormData({ name: user.name || '', email: user.email || '', role: user.role || '', isActive: user.isActive });
            }
        }}>
          <DialogTrigger asChild>
            <Button 
                className="bg-white/10 hover:bg-white/20 text-white border border-gray-700/50 self-end sm:self-center"
                onClick={handleOpenEditDialog} // Opens the dialog
            >
              <Edit3 className="mr-2 h-4 w-4" /> Edit User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black/80 border-gray-700 text-white backdrop-blur-md shadow-xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white text-xl">Edit User: {user.name || user.email}</DialogTitle>
              <DialogDescription className="text-gray-400">
                Modify the user's details below.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditUserSubmit} id="edit-user-form" className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-name" className="text-gray-300">Full Name</Label>
                <Input
                  id="edit-name"
                  name="name" // Used by handleEditFormInputChange
                  value={editFormData.name}
                  onChange={handleEditFormInputChange}
                  className="mt-1 bg-black/50 border-gray-600 text-white placeholder-gray-500"
                />
              </div>
              <div>
                <Label htmlFor="edit-email" className="text-gray-300">Email Address</Label>
                <Input
                  id="edit-email"
                  name="email" // Used by handleEditFormInputChange
                  type="email"
                  value={editFormData.email}
                  onChange={handleEditFormInputChange}
                  className="mt-1 bg-black/50 border-gray-600 text-white placeholder-gray-500"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-role" className="text-gray-300">Role</Label>
                <Select name="role" value={editFormData.role} onValueChange={handleEditFormRoleChange}>
                  <SelectTrigger id="edit-role" className="mt-1 bg-black/50 border-gray-600 text-white">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="bg-black/80 border-gray-700 text-white backdrop-blur-md">
                    <SelectItem value="CUSTOMER" className="hover:bg-white/10 focus:!bg-white/10">Customer</SelectItem>
                    <SelectItem value="ARTISAN" className="hover:bg-white/10 focus:!bg-white/10">Artisan</SelectItem>
                    <SelectItem value="ADMIN" className="hover:bg-white/10 focus:!bg-white/10">Admin (Caution!)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="edit-isActive"
                  name="isActive" // Not directly used by handler, but good for consistency
                  checked={editFormData.isActive}
                  onCheckedChange={handleEditFormSwitchChange} // Specific handler for Switch
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-600"
                />
                <Label htmlFor="edit-isActive" className="text-gray-300 select-none cursor-pointer">
                  {editFormData.isActive ? 'User is Active' : 'User is Inactive'}
                </Label>
              </div>
            </form>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white">Cancel</Button>
              </DialogClose>
              <Button type="submit" form="edit-user-form" className="bg-white/10 hover:bg-white/20 text-white border border-gray-700/50">Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-black/30 border-gray-700/50 backdrop-blur-md shadow-lg text-white">
        <CardHeader className="border-b border-gray-700/50 pb-4">
          <div className="flex items-center space-x-3">
            <UserCircle2 className="h-10 w-10 text-gray-400" />
            <div>
              <CardTitle className="text-2xl">{user.name || 'Unnamed User'}</CardTitle>
              <CardDescription className="text-gray-400">{user.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 grid gap-y-4 gap-x-6 md:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="User ID" value={user.id} className="lg:col-span-1 md:col-span-2 break-all" />
          <DetailItem label="Role" value={user.role} />
          <DetailItem label="Status">
            {user.isActive ? (
              <span className="flex items-center text-green-400"><ShieldCheck className="mr-1.5 h-4 w-4" /> Active</span>
            ) : (
              <span className="flex items-center text-orange-400"><ShieldAlert className="mr-1.5 h-4 w-4" /> Inactive</span>
            )}
          </DetailItem>
          <DetailItem label="Joined Date" value={formatDate(user.createdAt)} />
          <DetailItem label="Last Login" value={formatDate(user.lastLogin)} />
          <DetailItem label="Profile Last Updated" value={formatDate(user.updatedAt)} />
          
          {/* Placeholder for future related data */}
        </CardContent>
      </Card>
    </div>
  );
}