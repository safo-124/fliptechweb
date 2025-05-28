// app/api/users/[userId]/status/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
// Assuming your middleware already protects API routes intended for admins
// and potentially adds admin user info to the request if needed for audit logs.

export async function PUT(request, { params }) {
    const { userId } = params;
    const { isActive } = await request.json();

    if (typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'Invalid isActive value. Must be true or false.' }, { status: 400 });
    }

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    try {
        // Optional: Prevent deactivating/activating the logged-in admin themselves through this generic endpoint
        // You might need to get the current admin's ID from their session/token if you implement this check.
        // For example, if middleware adds `request.adminUserId`:
        // if (userId === request.adminUserId) {
        //   return NextResponse.json({ error: 'Cannot change your own status through this endpoint.' }, { status: 403 });
        // }

        const userToUpdate = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!userToUpdate) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        // Optional: Prevent changing status of other ADMINS if not a super-super admin or specific logic
        if (userToUpdate.role === 'ADMIN' /* && loggedInAdmin.role !== 'SUPER_ADMIN' */ ) {
            // Add logic here if there are restrictions on modifying other admins
            // For now, we'll allow it if the requester is an admin.
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { isActive: isActive },
            select: { // Return only necessary and safe fields
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json(updatedUser);

    } catch (error) {
        console.error(`Failed to update user ${userId} status:`, error);
        // Check for specific Prisma errors if needed, e.g., P2025 (Record not found)
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'User not found to update.' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Internal Server Error. Failed to update user status.' }, { status: 500 });
    }
}