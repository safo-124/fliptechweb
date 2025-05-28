// app/api/users/route.js
import prisma from '@/lib/prisma'; // Ensure this path is correct for your Prisma client
import { NextResponse } from 'next/server';

// GET - Fetch all users with pagination, filtering, and search
export async function GET(request) {
    // TODO: Add robust admin authentication/authorization check here.

    try {
        const { searchParams } = new URL(request.url);

        // Pagination parameters
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const skip = (page - 1) * limit;

        // Filter parameters
        const roleFromQuery = searchParams.get('role');
        const roleParam = roleFromQuery ? roleFromQuery.toUpperCase() : null; // Corrected and safer way

        const isActiveParam = searchParams.get('isActive');

        // Search parameter
        const searchQuery = searchParams.get('search');

        // Sorting
        const orderBy = { createdAt: 'desc' };

        const whereClause = {};

        // Apply role filter
        if (roleParam && ['ADMIN', 'ARTISAN', 'CUSTOMER'].includes(roleParam)) {
            whereClause.role = roleParam;
        }

        // Apply isActive filter
        if (isActiveParam !== null && isActiveParam !== undefined && isActiveParam !== "") {
            whereClause.isActive = isActiveParam === 'true';
        }

        // Apply search query filter
        if (searchQuery) {
            whereClause.OR = [
                { name: { contains: searchQuery /* Rely on DB collation for case-insensitivity */ } },
                { email: { contains: searchQuery } },
            ];
        }

        if (!prisma || !prisma.user) {
            console.error("Prisma client or prisma.user is undefined in GET /api/users. Check lib/prisma.js and its import.");
            throw new Error("Database client is not available.");
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
                phoneNumber: true,
                nationalId: true,
            },
            orderBy: orderBy,
            skip: skip,
            take: limit,
        });

        const totalUsersCount = await prisma.user.count({
            where: whereClause,
        });

        const totalPages = Math.ceil(totalUsersCount / limit);

        return NextResponse.json({
            users,
            currentPage: page,
            totalPages,
            totalItems: totalUsersCount,
            limit,
        });

    } catch (error) {
        console.error('**********************************************');
        console.error('API ERROR in GET /api/users:');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Request URL:', request.url);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Prisma Error Code (if available):', error.code);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');

        return NextResponse.json({ error: 'Internal Server Error. Failed to fetch users. Check server logs for details.' }, { status: 500 });
    }
}

// Note: The POST handler for creating products would typically be in /api/products/route.js,
// and user registration in /api/auth/... routes. This file is for listing users.
// If you need a POST to /api/users (e.g., for admin to create a user), you can add it here.