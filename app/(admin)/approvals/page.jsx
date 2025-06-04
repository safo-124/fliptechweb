// app/(admin)/approvals/page.jsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Eye, AlertTriangle, Package, SettingsIcon as SettingsIconLucide, BookOpenIcon as BookOpenIconLucide, Clock } from "lucide-react"; // Renamed to avoid conflict if any

const ROWS_PER_PAGE = 9; // Number of cards per page

// Helper function for capitalizing strings
function capitalizeString(str) {
  if (!str || typeof str !== 'string' || str.trim() === '') return str;
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.substring(1).toLowerCase())
    .join(' ');
}

// Skeleton for a Listing Card
const ListingCardSkeleton = () => (
    <div className="rounded-xl border border-gray-700/40 bg-black/40 backdrop-blur-md shadow-lg p-4 space-y-3 flex flex-col justify-between min-h-[220px]">
        <div>
            <Skeleton className="h-5 w-3/4 mb-2 rounded" /> {/* Title */}
            <Skeleton className="h-3 w-1/2 mb-1 rounded" /> {/* Artisan */}
            <Skeleton className="h-3 w-1/3 mb-1 rounded" /> {/* Category */}
            <Skeleton className="h-3 w-1/4 mb-3 rounded" /> {/* Price/Type */}
            <Skeleton className="h-3 w-full rounded" /> {/* Description line 1 */}
            <Skeleton className="h-3 w-5/6 rounded mt-1" /> {/* Description line 2 */}
        </div>
        <div className="border-t border-gray-700/50 pt-3 mt-3 space-y-2">
             <Skeleton className="h-3 w-1/2 rounded" /> {/* Submitted Date */}
            <div className="flex justify-end items-center space-x-2 pt-1">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
            </div>
        </div>
    </div>
);

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState("products"); // "products", "services", "training"
  
  const [pendingListings, setPendingListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [listingToReject, setListingToReject] = useState(null); // Will store {id, title, listingType}
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchPendingListings = useCallback(async (type, page = 1) => {
    setIsLoading(true);
    setError(null);
    if (page === 1) {
        setPendingListings([]); // Clear for new tab or first page of current tab
        setTotalItems(0);
        setTotalPages(1);
    }

    let endpoint = '';
    let listKey = ''; // Key in the JSON response that holds the array of listings

    switch (type) {
      case 'products':
        endpoint = `/api/products?status=PENDING_APPROVAL&page=${page}&limit=${ROWS_PER_PAGE}&sortBy=createdAt&sortOrder=asc`;
        listKey = 'products';
        break;
      case 'services':
        endpoint = `/api/services?status=PENDING_APPROVAL&page=${page}&limit=${ROWS_PER_PAGE}&sortBy=createdAt&sortOrder=asc`;
        listKey = 'services';
        break;
      case 'training':
        endpoint = `/api/training?status=PENDING_APPROVAL&page=${page}&limit=${ROWS_PER_PAGE}&sortBy=createdAt&sortOrder=asc`;
        listKey = 'trainingOffers'; // Or 'training' - adjust based on your API response
        break;
      default:
        console.error("Invalid approval type:", type);
        setIsLoading(false);
        setError(`Invalid approval type: ${type}`);
        return;
    }

    try {
      // IMPORTANT: Ensure this API call is authenticated and authorized for admin access.
      const response = await fetch(endpoint);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: `Failed to fetch pending ${type}. Status: ${response.status}` }));
        throw new Error(errData.error || `Failed to fetch pending ${type}`);
      }
      const data = await response.json();
      
      setPendingListings(data[listKey] || []); 
      setTotalItems(data.totalItems || 0);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.currentPage || 1);
    } catch (err) {
      console.error(`Error fetching pending ${type}:`, err);
      setError(err.message);
      toast.error(`Error loading pending ${type}: ${err.message}`);
      setPendingListings([]); // Clear on error
    } finally {
      setIsLoading(false);
    }
  }, []); // currentPage is managed via handlePageChange

  useEffect(() => {
    fetchPendingListings(activeTab, 1); // Fetch first page when activeTab changes
  }, [activeTab, fetchPendingListings]);

  const handleStatusUpdate = async (listingId, listingType, newStatus, reason = null) => {
    let url = '';
    switch (listingType) {
      case 'products': url = `/api/admin/products/${listingId}/status`; break;
      case 'services': url = `/api/admin/services/${listingId}/status`; break;
      case 'training': url = `/api/admin/training/${listingId}/status`; break;
      default: toast.error("Invalid listing type for status update."); return;
    }

    const payload = { status: newStatus };
    if (newStatus === 'REJECTED' && reason) {
      payload.rejectionReason = reason;
    }

    const promise = () => new Promise(async (resolve, reject) => {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null); // Catch JSON parse error for empty/non-JSON responses
      if (!response.ok) {
        reject(new Error(data?.error || 'Failed to update status'));
      } else {
        resolve(data);
      }
    });

    toast.promise(promise(), {
      loading: `Updating ${listingType} status...`,
      success: (data) => {
        fetchPendingListings(activeTab, currentPage); // Refresh current tab and page
        if (isRejectDialogOpen) setIsRejectDialogOpen(false);
        setListingToReject(null);
        return `Listing status updated to ${newStatus.toLowerCase()}!`;
      },
      error: (err) => `Update Error: ${err.message}`,
    });
  };
  
  const openRejectDialog = (listing, type) => {
    setListingToReject({ ...listing, listingType: type });
    setRejectionReason(listing.rejectionReason || ''); // Pre-fill if editing a previous rejection
    setIsRejectDialogOpen(true);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && !isLoading) {
      fetchPendingListings(activeTab, newPage);
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return 'Invalid Date'; }
  };

  const renderListingCard = (listing, type) => {
    let priceOrTypeDisplay = 'N/A';
    let currencySymbol = listing.currency || '₵'; // Default to GHS symbol if not present

    if (type === 'products' && listing.price !== null && listing.price !== undefined) {
        priceOrTypeDisplay = `${currencySymbol} ${Number(listing.price).toFixed(2)}`;
    } else if (type === 'services') {
        priceOrTypeDisplay = listing.priceType ? capitalizeString(listing.priceType.replace(/_/g, ' ')) : 'N/A';
        if (listing.price !== null && listing.price !== undefined && (listing.priceType === 'FIXED' || listing.priceType === 'PER_HOUR' || listing.priceType === 'PER_DAY')) {
             priceOrTypeDisplay += `: ${currencySymbol} ${Number(listing.price).toFixed(2)}${listing.priceUnit ? `/${listing.priceUnit}` : '' }`;
        }
    } else if (type === 'training') {
        priceOrTypeDisplay = listing.isFree ? 'Free' : (listing.price !== null && listing.price !== undefined ? `${currencySymbol} ${Number(listing.price).toFixed(2)}` : 'Contact for Price');
    }

    return (
        <div key={listing.id} className="rounded-xl border border-gray-700/40 bg-black/50 backdrop-blur-lg shadow-xl p-4 flex flex-col justify-between space-y-3 hover:border-gray-600/60 transition-all duration-300 min-h-[240px]">
            <div>
                <h3 className="text-md font-semibold text-white truncate mb-0.5" title={listing.title}>{listing.title}</h3>
                <p className="text-xs text-gray-400 mb-1">
                    By: {listing.artisan?.name || 'Unknown Artisan'} 
                </p>
                <p className="text-xs text-gray-500 mb-2">
                    Category: {listing.category?.name || 'N/A'}
                </p>
                <p className="text-sm text-gray-300 mb-2 line-clamp-2" title={listing.description}>{listing.description || "No description available."}</p>
                <p className="text-sm font-medium text-teal-400 mb-2">{priceOrTypeDisplay}</p>
            </div>
            <div className="border-t border-gray-700/50 pt-3 mt-auto space-y-2">
                <div className="flex items-center text-xs text-gray-500">
                    <Clock size={14} className="mr-1.5 flex-shrink-0" />
                    Submitted: {formatDate(listing.createdAt)}
                </div>
                <div className="flex items-center justify-end space-x-2">
                    <Button variant="outline" size="sm" className="text-sky-400 border-sky-400/50 hover:bg-sky-400/10 hover:text-sky-300 px-2 py-1 h-auto" onClick={() => toast.info("View Details for \""+listing.title+"\" (TBD)")}>
                        <Eye size={14} className="mr-1 sm:mr-1.5" /> <span className="hidden sm:inline">Details</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(listing.id, type, 'ACTIVE')} className="text-green-400 border-green-400/50 hover:bg-green-400/10 hover:text-green-300 px-2 py-1 h-auto">
                        <CheckCircle size={14} className="mr-1 sm:mr-1.5" /> <span className="hidden sm:inline">Approve</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openRejectDialog(listing, type)} className="text-red-400 border-red-400/50 hover:bg-red-400/10 hover:text-red-300 px-2 py-1 h-auto">
                        <XCircle size={14} className="mr-1 sm:mr-1.5" /> <span className="hidden sm:inline">Reject</span>
                    </Button>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Listing Approvals</h1>
        <p className="text-gray-400">Review and manage listings submitted by artisans for products, services, and training offers.</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); setCurrentPage(1); }} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-black/30 border border-gray-700/50 backdrop-blur-md shadow-sm h-auto p-1">
          <TabsTrigger value="products" className="data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-300 hover:text-white text-xs sm:text-sm py-2.5">
            <Package className="mr-1.5 h-4 w-4"/> Products
          </TabsTrigger>
          <TabsTrigger value="services" className="data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-300 hover:text-white text-xs sm:text-sm py-2.5">
            <SettingsIconLucide className="mr-1.5 h-4 w-4"/> Services
          </TabsTrigger>
          <TabsTrigger value="training" className="data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-300 hover:text-white text-xs sm:text-sm py-2.5">
            <BookOpenIconLucide className="mr-1.5 h-4 w-4"/> Training
          </TabsTrigger>
        </TabsList>
        
        {["products", "services", "training"].map(tabValue => (
          <TabsContent key={tabValue} value={tabValue} className="mt-6 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0">
            {/* Conditional rendering based on activeTab is implicitly handled by TabsContent showing only its matching value */}
            {/* We only fetch data for the activeTab, so pendingListings will be relevant to activeTab */}
            <>
              {error && activeTab === tabValue && (
                <div className="p-4 mb-4 rounded-md bg-red-900/50 border border-red-700 text-red-300">
                  <p className="font-semibold">Error loading pending {tabValue}:</p>
                  <p>{error}</p>
                  <Button onClick={() => fetchPendingListings(activeTab, 1)} variant="outline" className="mt-2 text-white">Retry</Button>
                </div>
              )}
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {Array.from({ length: ROWS_PER_PAGE }).map((_, index) => <ListingCardSkeleton key={`${tabValue}-skeleton-${index}`} />)}
                </div>
              ) : pendingListings.length === 0 && !error ? (
                <div className="text-center py-16 rounded-lg border-2 border-dashed border-gray-700/50 bg-black/20 backdrop-blur-sm shadow-inner min-h-[200px] flex flex-col justify-center items-center">
                  <AlertTriangle className="h-16 w-16 text-gray-600 mb-4" />
                  <p className="text-xl font-semibold text-gray-300">No {capitalizeString(tabValue)} pending approval.</p>
                  <p className="text-sm text-gray-500">All caught up!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {pendingListings.map((listing) => renderListingCard(listing, tabValue))}
                </div>
              )}
              {!isLoading && !error && totalItems > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between mt-8 text-sm text-gray-300">
                  <span className="text-xs sm:text-sm">Page {currentPage} of {totalPages} ({totalItems} pending {activeTab})</span>
                  <div className="space-x-1 sm:space-x-2">
                    <Button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} variant="outline" size="sm" className="text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white">Previous</Button>
                    <Button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} variant="outline" size="sm" className="text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white">Next</Button>
                  </div>
                </div>
              )}
            </>
          </TabsContent>
        ))}
      </Tabs>

      {/* Reject Listing Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={(open) => {
          setIsRejectDialogOpen(open);
          if (!open) setListingToReject(null);
      }}>
        <DialogContent className="bg-black/80 border-gray-700 text-white backdrop-blur-md shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">Reject Listing: {listingToReject?.title}</DialogTitle>
            <DialogDescription className="text-gray-400">
              Please provide a reason for rejecting this "{listingToReject?.listingType}" listing. This may be visible to the artisan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="rejectionReason" className="text-gray-300">Rejection Reason (Required)</Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Images unclear, description insufficient, policy violation..."
              className="bg-black/50 border-gray-600 text-white placeholder-gray-500 min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline" className="text-gray-300 border-gray-600 hover:bg-gray-700/50 hover:text-white">Cancel</Button>
            </DialogClose>
            <Button 
                onClick={() => {
                    if (!listingToReject || !rejectionReason.trim()) { // Check listingToReject as well
                        toast.error("Rejection reason is required.");
                        return;
                    }
                    handleStatusUpdate(listingToReject.id, listingToReject.listingType, 'REJECTED', rejectionReason);
                }} 
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!rejectionReason.trim()}
            >
                Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}