// app/api/services/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
// import { getArtisanIdFromAuth } from '@/lib/auth'; // Your actual auth utility

// Helper function (if needed, or ensure it's accessible)
// function generateSlug(name) { /* ... */ }

export async function POST(request) {
    // ... (Your POST logic for creating services)
    // This should be the code from our previous steps that sets status to PENDING_APPROVAL
}

// GET - Fetch Service Listings (Public view filters by ACTIVE, Admin can see others)
export async function GET(request) {
    // TODO: Implement admin role check to allow viewing non-ACTIVE statuses securely
    // const isAdmin = await checkAdminAuth(request); 

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const categoryId = searchParams.get('categoryId');
    const artisanIdParam = searchParams.get('artisanId');
    const statusParam = searchParams.get('status'); // This is what your approvals page uses
    const searchQuery = searchParams.get('search');
    // ... (other params like sortBy, sortOrder if you implemented them)

    const whereClause = {};

    if (statusParam && ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'REJECTED', 'ARCHIVED'].includes(statusParam.toUpperCase())) {
        // IMPORTANT: If statusParam is PENDING_APPROVAL (or anything not 'ACTIVE'),
        // you MUST ensure this request is coming from an authenticated admin.
        // This check needs to be implemented robustly.
        // if (statusParam.toUpperCase() !== 'ACTIVE' && !isAdmin) {
        //   return NextResponse.json({ error: 'Unauthorized to view this status' }, { status: 403 });
        // }
        whereClause.status = statusParam.toUpperCase();
    } else if (!statusParam) {
        // Default for general public GET /api/services without a status should be ACTIVE
        whereClause.status = 'ACTIVE';
    }
    // If statusParam is "ALL", and it's an admin, you might remove the status from whereClause.

    if (categoryId) whereClause.categoryId = categoryId;
    if (artisanIdParam) whereClause.artisanId = artisanIdParam;

    if (searchQuery) {
        whereClause.OR = [
            { title: { contains: searchQuery /* mode: 'insensitive' - removed for MySQL */ } },
            { description: { contains: searchQuery } },
        ];
    }

    const orderBy = { createdAt: 'desc' }; // Default order

    try {
        if (!prisma || !prisma.serviceListing) {
            console.error("Prisma client or prisma.serviceListing is undefined in GET /api/services");
            throw new Error("Database client is not available.");
        }

        const services = await prisma.serviceListing.findMany({
            where: whereClause,
            orderBy: [orderBy], // Prisma expects an array for orderBy
            skip: skip,
            take: limit,
            include: {
                artisan: { select: { id: true, name: true, email: true } },
                category: { select: { id: true, name: true } }
            }
        });

        const totalServices = await prisma.serviceListing.count({ where: whereClause });
        const totalPages = Math.ceil(totalServices / limit);

        return NextResponse.json({
            services, // Key for the list of services
            currentPage: page,
            totalPages,
            totalItems: totalServices,
            limit,
        });

    } catch (error) {
        console.error('**********************************************');
        console.error('API ERROR in GET /api/services:');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Request URL:', request.url);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');
        return NextResponse.json({ error: 'Internal Server Error. Failed to fetch services. Check server logs.' }, { status: 500 });
    }
}