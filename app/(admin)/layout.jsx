// app/(admin)/layout.jsx
"use client";

import { Fragment, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toaster, toast } from 'sonner'; // <-- Import Toaster and toast
import {
  Home,
  Users,
  Briefcase,
  ShoppingBag,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  X,
  TicketX
} from 'lucide-react';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/admin/logout', { method: 'POST' });
      toast.success('Logged out successfully!'); // <-- Example toast on logout
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error('Logout failed. Please try again.'); // <-- Example error toast
    } finally {
      router.push('/login');
    }
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/users', label: 'Users', icon: Users },
    { href: '/categories', label: 'Categories', icon: Briefcase },
    { href: '/approvals', label: 'Approvals', icon: TicketX },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const sidebarContent = (
    <>
      <div className="px-6 py-4">
        <Link href="/dashboard" className="flex items-center space-x-2 group">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white group-hover:text-gray-300 transition-colors">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
          <h1 className="text-xl font-semibold text-white group-hover:text-gray-300 transition-colors">Admin Panel</h1>
        </Link>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            onClick={() => isSidebarOpen && setIsSidebarOpen(false)}
            className={`flex items-center px-3 py-2.5 rounded-lg transition-colors
              ${pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                ? 'bg-white/20 text-white font-medium shadow-sm'
                : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }
            `}
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-4 mt-auto border-t border-gray-700/50">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2.5 rounded-lg text-white bg-black/30 hover:bg-white/20 hover:text-white transition-colors border border-gray-700/50"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </button>
      </div>
    </>
  );

  if (pathname.startsWith('/login')) {
      return <>{children} <Toaster richColors position="top-right" theme="dark" /> </>; // Also add Toaster on login page if needed for login errors
  }

  return (
    <div className="flex h-screen bg-black text-gray-100">
      {/* ... (sidebar and mobile overlay code remains the same) ... */}
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0
                        border-r border-gray-700/60 
                        bg-black/50 backdrop-blur-lg shadow-2xl">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col w-64
                    transform transition-transform duration-300 ease-in-out md:hidden
                    border-r border-gray-700/60
                    bg-black/70 backdrop-blur-xl shadow-2xl 
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {sidebarContent}
      </aside>
      
      <div className="flex flex-col flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 md:hidden flex items-center justify-between px-4 h-16
                           border-b border-gray-700/60
                           bg-black/70 backdrop-blur-md shadow-lg">
          <Link href="/dashboard" className="flex items-center space-x-2 group">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white group-hover:text-gray-300 transition-colors">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
            <span className="text-lg font-semibold text-white group-hover:text-gray-300 transition-colors">Admin</span>
          </Link>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-md text-gray-300 hover:bg-white/10 hover:text-white"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <Toaster richColors closeButton position="top-right" theme="dark" /> {/* <-- Add Toaster here */}
    </div>
  );
}