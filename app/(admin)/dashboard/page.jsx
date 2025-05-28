// app/(admin)/dashboard/page.jsx
"use client";

import { useState, useEffect } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, UserPlus, ListChecks, AlertTriangle, BarChart3 } from "lucide-react";

// Updated initialStats with more descriptive analyticsText for Total Users
const initialStats = [
  { id: 1, title: "Total Users (Artisans + Customers)", value: "0", analyticsText: "Loading...", icon: <Users className="h-5 w-5 text-gray-400" />, dataKey: "totalUsers" },
  { id: 2, title: "Artisan Signups", value: "0", analyticsText: "Loading...", icon: <UserCheck className="h-5 w-5 text-gray-400" />, dataKey: "artisanSignups" },
  { id: 3, title: "Customer Signups", value: "0", analyticsText: "Loading...", icon: <UserPlus className="h-5 w-5 text-gray-400" />, dataKey: "customerSignups" },
  { id: 4, title: "Active Listings", value: "N/A", analyticsText: "Feature coming soon", icon: <ListChecks className="h-5 w-5 text-gray-400" />, dataKey: "activeListings" },
  { id: 5, title: "Pending Approvals", value: "N/A", analyticsText: "Feature coming soon", icon: <AlertTriangle className="h-5 w-5 text-gray-400" />, dataKey: "pendingApprovals" },
  { id: 6, title: "Total Revenue (Month)", value: "₵0.00", analyticsText: "Feature coming soon", icon: <BarChart3 className="h-5 w-5 text-gray-400" />, dataKey: "totalRevenue" },
];

const StatCardSkeleton = () => (
  <div className="rounded-xl border border-gray-700/50 bg-black/30 backdrop-blur-md shadow-lg p-6">
    <Skeleton className="h-5 w-3/5 mb-2 rounded" /> {/* Adjusted width for longer title */}
    <Skeleton className="h-8 w-1/3 mb-1.5 rounded" />
    <Skeleton className="h-3 w-3/5 rounded" />
  </div>
);

export default function AdminDashboardPage() {
  const [dashboardStats, setDashboardStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch artisan users count
        const artisanUsersResponse = await fetch('/api/users?role=ARTISAN&limit=1'); // limit=1 to get totalItems
        if (!artisanUsersResponse.ok) throw new Error(`Failed to fetch artisan users (Status: ${artisanUsersResponse.status})`);
        const artisanUsersData = await artisanUsersResponse.json();
        const artisanSignupsCount = artisanUsersData.totalItems || 0;

        // Fetch customer users count
        const customerUsersResponse = await fetch('/api/users?role=CUSTOMER&limit=1');
        if (!customerUsersResponse.ok) throw new Error(`Failed to fetch customer users (Status: ${customerUsersResponse.status})`);
        const customerUsersData = await customerUsersResponse.json();
        const customerSignupsCount = customerUsersData.totalItems || 0;
        
        // Calculate "Total Users" as sum of artisans and customers for this dashboard display
        const totalMarketplaceUsersCount = artisanSignupsCount + customerSignupsCount;
        
        setDashboardStats(prevStats => prevStats.map(stat => {
          switch (stat.dataKey) {
            case "totalUsers":
              return { ...stat, value: totalMarketplaceUsersCount.toString(), analyticsText: "Sum of artisans & customers" };
            case "artisanSignups":
              return { ...stat, value: artisanSignupsCount.toString(), analyticsText: "Registered artisans" };
            case "customerSignups":
              return { ...stat, value: customerSignupsCount.toString(), analyticsText: "Registered customers" };
            default:
              return stat;
          }
        }));

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError(err.message);
        setDashboardStats(prevStats => prevStats.map(stat => {
          if (["totalUsers", "artisanSignups", "customerSignups"].includes(stat.dataKey)) {
            return { ...stat, value: "Error", analyticsText: "Failed to load" };
          }
          return stat;
        }));
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2 text-white">Admin Dashboard</h1>
      <p className="text-gray-300 mb-8">Welcome! Overview of the Artisan Platform.</p>

      {error && (
        <div className="mb-6 p-4 rounded-md bg-red-900/50 border border-red-700 text-red-300">
          <p className="font-semibold">Error loading dashboard stats:</p>
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {isLoading ? (
          initialStats.map((stat) => <StatCardSkeleton key={stat.id} />)
        ) : (
          dashboardStats.map((stat) => (
            <div
              key={stat.id}
              className="rounded-xl border border-gray-700/50 bg-black/30 
                         backdrop-blur-md shadow-lg p-6 hover:bg-black/50 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-medium text-gray-400 tracking-wider uppercase">{stat.title}</h3>
                {stat.icon}
              </div>
              <p className={`mt-1 text-3xl font-semibold ${stat.value === "Error" ? "text-red-400" : "text-white"}`}>
                {stat.value}
              </p>
              <p className={`mt-1 text-xs ${stat.analyticsText === "Failed to load" ? "text-red-500" : "text-gray-500"}`}>
                {stat.analyticsText}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 rounded-xl border border-gray-700/50 bg-black/30 
                      backdrop-blur-md shadow-lg p-6 min-h-[200px]">
        <h2 className="text-xl font-semibold mb-4 text-white">Activity Feed / Reports</h2>
        <p className="text-gray-400">Future charts and reports will appear here...</p>
      </div>
    </div>
  );
}