// app/(admin)/categories/page.jsx
"use client";

import { useState, useEffect, useCallback } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  // AlertDialogTrigger, // Not explicitly used as trigger is programmatic
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton component
import { PlusCircle, MoreHorizontal, Edit2, Trash2, ChevronDown, ChevronRight } from "lucide-react";

const NO_PARENT_CATEGORY_VALUE = "NO_PARENT_ID_SELECTED";

// Helper to render categories, potentially recursively for hierarchy
const CategoryRow = ({ category, level = 0, onEdit, onDeleteTrigger, allCategories }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasSubcategories = category.subCategories && category.subCategories.length > 0;

  return (
    <>
      <TableRow className="border-b-gray-700/30 hover:bg-black/40">
        <TableCell className="font-medium text-white py-3" style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}>
          <div className="flex items-center">
            {hasSubcategories && (
              <button onClick={() => setIsExpanded(!isExpanded)} className="mr-2 p-0.5 rounded hover:bg-white/10">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            {(!hasSubcategories && level > 0) && <span className="w-[calc(1rem+4px)] mr-2 inline-block"></span>}
            {(!hasSubcategories && level === 0) && <span className="w-[calc(1rem+4px)] mr-2 inline-block"></span>}
            {category.name}
          </div>
        </TableCell>
        <TableCell className="text-gray-300 py-3 hidden sm:table-cell">{category.type}</TableCell>
        <TableCell className="text-gray-400 py-3 hidden md:table-cell truncate max-w-xs">{category.description || 'N/A'}</TableCell>
        <TableCell className="text-right py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-white data-[state=open]:bg-white/10">
                <span className="sr-only">Open menu for {category.name}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/80 border-gray-700 text-white backdrop-blur-md shadow-xl">
              <DropdownMenuLabel className="text-gray-400">Actions</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-700/50"/>
              <DropdownMenuItem
                className="hover:!bg-white/10 focus:!bg-white/10 cursor-pointer"
                onClick={() => onEdit(category)}
              >
                <Edit2 className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-400 hover:!text-red-300 focus:!text-red-300 hover:!bg-red-500/10 focus:!bg-red-500/10 cursor-pointer"
                onClick={() => onDeleteTrigger(category)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      {hasSubcategories && isExpanded && category.subCategories.map(subCat => (
        <CategoryRow
          key={subCat.id}
          category={subCat}
          level={level + 1}
          onEdit={onEdit}
          onDeleteTrigger={onDeleteTrigger}
          allCategories={allCategories}
        />
      ))}
    </>
  );
};

// Skeleton Row Component for loading state
const CategorySkeletonRow = ({ indentLevel = 0 }) => (
  <TableRow className="border-b-gray-700/30">
    <TableCell className="py-3" style={{ paddingLeft: `${indentLevel * 1.5 + 0.75}rem` }}>
      <div className="flex items-center">
        <Skeleton className="h-4 w-4 mr-2 rounded" /> {/* Icon/Expander placeholder */}
        <Skeleton className="h-4 w-3/5 rounded" /> {/* Name placeholder */}
      </div>
    </TableCell>
    <TableCell className="py-3 hidden sm:table-cell"><Skeleton className="h-4 w-20 rounded" /></TableCell>
    <TableCell className="py-3 hidden md:table-cell"><Skeleton className="h-4 w-4/5 rounded" /></TableCell>
    <TableCell className="text-right py-3"><Skeleton className="h-8 w-8 rounded-md ml-auto" /></TableCell>
  </TableRow>
);


export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [allCategoriesFlat, setAllCategoriesFlat] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryType, setCategoryType] = useState('');
  const [categoryParentId, setCategoryParentId] = useState('');
  const [error, setError] = useState(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Simulate a longer delay for testing skeleton
      // await new Promise(resolve => setTimeout(resolve, 2000)); 

      const hierarchyResponse = await fetch('/api/categories?hierarchy=true');
      if (!hierarchyResponse.ok) {
        let errorMsg = 'Failed to fetch hierarchical categories.';
        try { const errData = await hierarchyResponse.json(); errorMsg = errData.error || errorMsg; } catch (e) {/* ignore */}
        throw new Error(errorMsg);
      }
      const hierarchicalData = await hierarchyResponse.json();
      setCategories(hierarchicalData);

      const flatResponse = await fetch('/api/categories');
      if (!flatResponse.ok) {
        let errorMsg = 'Failed to fetch flat list of categories.';
        try { const errData = await flatResponse.json(); errorMsg = errData.error || errorMsg; } catch (e) {/* ignore */}
        throw new Error(errorMsg);
      }
      const flatData = await flatResponse.json();
      setAllCategoriesFlat(flatData);

    } catch (errCatch) {
      console.error("Error in fetchCategories:", errCatch);
      setError(errCatch.message);
      toast.error("Data Loading Error: " + errCatch.message);
      setCategories([]);
      setAllCategoriesFlat([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const resetForm = () => {
    setCategoryName('');
    setCategoryDescription('');
    setCategoryType('');
    setCategoryParentId('');
    setEditingCategory(null);
  };

  const handleOpenFormDialog = (categoryToEdit = null) => {
    resetForm();
    if (categoryToEdit) {
      setEditingCategory(categoryToEdit);
      setCategoryName(categoryToEdit.name);
      setCategoryDescription(categoryToEdit.description || '');
      setCategoryType(categoryToEdit.type);
      setCategoryParentId(categoryToEdit.parentId || '');
    }
    setIsFormDialogOpen(true);
  };

  const handleSubmitCategory = async (event) => {
    event.preventDefault();
    if (!categoryName || !categoryType) {
      toast.error("Category name and type are required.");
      return;
    }
    const payload = { name: categoryName, description: categoryDescription, type: categoryType, parentId: categoryParentId || null };
    const url = editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories';
    const method = editingCategory ? 'PUT' : 'POST';
    const promiseAction = () => new Promise(async (resolve, reject) => {
      const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const responseData = await response.json();
      if (!response.ok) reject(new Error(responseData.error || `Failed action`)); else resolve(responseData);
    });
    toast.promise(promiseAction(), {
      loading: `${editingCategory ? 'Updating' : 'Creating'} category...`,
      success: (data) => { fetchCategories(); setIsFormDialogOpen(false); return `Category ${editingCategory ? 'updated' : 'created'}!`; },
      error: (err) => `Error: ${err.message}`,
    });
  };

  const handleDeleteTrigger = (category) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const promiseAction = () => new Promise(async (resolve, reject) => {
      const response = await fetch(`/api/categories/${categoryToDelete.id}`, { method: 'DELETE' });
      if (response.status === 204 || response.ok) {
        const text = await response.text();
        resolve(text ? JSON.parse(text) : { message: 'Category deleted successfully' });
      } else {
        const errData = await response.json();
        reject(new Error(errData.error || 'Failed to delete category.'));
      }
    });
    toast.promise(promiseAction(), {
      loading: `Deleting category "${categoryToDelete.name}"...`,
      success: (data) => { fetchCategories(); return data.message || `Category "${categoryToDelete.name}" deleted.`; },
      error: (err) => `Error: ${err.message}`,
      finally: () => {
        setIsDeleteDialogOpen(false);
        setCategoryToDelete(null);
      }
    });
  };
  
  const availableParentCategories = allCategoriesFlat.filter(cat => {
    if (editingCategory && cat.id === editingCategory.id) return false;
    if (categoryType && cat.type !== categoryType) return false;
    // A more robust circular dependency check might be needed for very deep hierarchies
    // This basic check prevents a direct child from being a parent if editingCategory.subCategories was available
    if (editingCategory && editingCategory.subCategories && editingCategory.subCategories.find(sub => sub.id === cat.id)) return false;
    return true;
  });

  // Prepare skeleton rows
  const skeletonRows = Array.from({ length: 5 }).map((_, index) => (
    <CategorySkeletonRow key={`skeleton-${index}`} />
  ));

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-white">Category Management</h1>
        <Dialog open={isFormDialogOpen} onOpenChange={(open) => {
            setIsFormDialogOpen(open);
            if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => handleOpenFormDialog()}
              className="bg-white/10 hover:bg-white/20 text-white border border-gray-700/50"
              disabled={isLoading}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Category
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black/80 border-gray-700 text-white backdrop-blur-md shadow-xl sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle className="text-white text-xl">{editingCategory ? 'Edit Category' : 'Create New Category'}</DialogTitle>
              <DialogDescription className="text-gray-400">
                {editingCategory ? 'Update the details of this category.' : 'Fill in the details for the new category.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitCategory} id="category-form" className="grid gap-4 py-4">
              {/* Name */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right text-gray-300 col-span-1">Name</Label>
                <Input id="name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="col-span-3 bg-black/50 border-gray-600 text-white" required />
              </div>
              {/* Type */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right text-gray-300 col-span-1">Type</Label>
                <Select value={categoryType} onValueChange={setCategoryType} required>
                  <SelectTrigger id="type" className="col-span-3 bg-black/50 border-gray-600 text-white"><SelectValue placeholder="Select category type" /></SelectTrigger>
                  <SelectContent className="bg-black/80 border-gray-700 text-white backdrop-blur-md">
                    <SelectItem value="PRODUCT" className="hover:bg-white/10 focus:!bg-white/10">Product</SelectItem>
                    <SelectItem value="SERVICE" className="hover:bg-white/10 focus:!bg-white/10">Service</SelectItem>
                    <SelectItem value="TRAINING" className="hover:bg-white/10 focus:!bg-white/10">Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Parent Category */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="parentId" className="text-right text-gray-300 col-span-1">Parent Category</Label>
                <Select value={categoryParentId} onValueChange={(value) => setCategoryParentId(value === NO_PARENT_CATEGORY_VALUE ? "" : value)}>
                  <SelectTrigger id="parentId" className="col-span-3 bg-black/50 border-gray-600 text-white" disabled={!categoryType}><SelectValue placeholder="None (Top Level)" /></SelectTrigger>
                  <SelectContent className="bg-black/80 border-gray-700 text-white backdrop-blur-md">
                    <SelectItem value={NO_PARENT_CATEGORY_VALUE} className="hover:bg-white/10 focus:!bg-white/10">None (Top Level)</SelectItem>
                    {availableParentCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id} className="hover:bg-white/10 focus:!bg-white/10">{cat.name} ({cat.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Description */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right text-gray-300 col-span-1">Description</Label>
                <Textarea id="description" value={categoryDescription} onChange={(e) => setCategoryDescription(e.target.value)} placeholder="Optional short description..." className="col-span-3 bg-black/50 border-gray-600 text-white min-h-[80px]" />
              </div>
            </form>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" className="text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white">Cancel</Button></DialogClose>
              <Button type="submit" form="category-form" className="bg-white/10 hover:bg-white/20 text-white border border-gray-700/50">{editingCategory ? 'Save Changes' : 'Create Category'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Error Display */}
      {!isLoading && error && ( 
        <div className="text-center py-4 my-4 p-3 rounded-md bg-red-900/50 border border-red-700 text-red-300">
            <p className="font-semibold">Page Error:</p>
            <p>{error}</p>
        </div>
      )}

      {/* Main Content: Skeleton or Table or No Data Message */}
      <div className="rounded-lg border border-gray-700/50 bg-black/30 backdrop-blur-md shadow-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-gray-700/50 hover:bg-black/0">
              <TableHead className="text-white/80 whitespace-nowrap pl-4">Name</TableHead>
              <TableHead className="text-white/80 whitespace-nowrap hidden sm:table-cell">Type</TableHead>
              <TableHead className="text-white/80 whitespace-nowrap hidden md:table-cell">Description</TableHead>
              <TableHead className="text-white/80 text-right whitespace-nowrap pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <>
                {skeletonRows}
              </>
            ) : !error && categories.length > 0 ? (
              categories.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  onEdit={handleOpenFormDialog}
                  onDeleteTrigger={handleDeleteTrigger}
                  allCategories={allCategoriesFlat}
                />
              ))
            ) : null } {/* No explicit "No categories" message here if error or loading handles it */}
          </TableBody>
        </Table>
        {/* No categories message, shown only if not loading and no error and no categories */}
        {!isLoading && !error && categories.length === 0 && (
             <div className="text-center py-10">
                <p className="text-gray-400">No categories found. Create one to get started!</p>
            </div>
        )}
      </div>


      {/* AlertDialog for Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setCategoryToDelete(null);
      }}>
        <AlertDialogContent className="bg-black/80 border-gray-700 text-white backdrop-blur-md shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This action cannot be undone. This will permanently delete the category
              "{categoryToDelete?.name}". Ensure this category has no subcategories or associated items before proceeding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCategory}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, delete category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}