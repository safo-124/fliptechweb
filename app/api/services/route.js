// app/api/services/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
// import { getArtisanIdFromAuth } from '@/lib/auth'; // Your actual auth utility

export async function POST(request) {
    // --- CRITICAL: Authentication and Authorization ---
    // const artisanId = await getArtisanIdFromAuth(request);
    // if (!artisanId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let requestBodyText = 'Could not parse or clone request body.';
    try {
        const requestClone = request.clone();
        requestBodyText = await requestClone.text();
        const body = await request.json();

        // Destructure all expected fields for ServiceListing
        const {
            title,
            description,
            priceType,
            price,
            priceUnit,
            currency = "GHS",
            images,
            locationType,
            serviceArea,
            typicalDuration,
            categoryId,
            artisanId // TEMPORARY: MUST come from auth token in production
        } = body;

        if (!artisanId) return NextResponse.json({ error: 'Artisan ID is required.' }, { status: 400 });
        if (!title || !description || !priceType || !locationType || !categoryId) {
            return NextResponse.json({ error: 'Missing required fields for service listing.' }, { status: 400 });
        }
        if (price !== undefined && price !== null && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) {
            return NextResponse.json({ error: 'If price is provided, it must be a valid non-negative number.' }, { status: 400 });
        }

        const categoryExists = await prisma.category.findUnique({ where: { id: categoryId } });
        if (!categoryExists || categoryExists.type !== 'SERVICE') {
            return NextResponse.json({ error: 'Invalid or non-SERVICE category ID.' }, { status: 400 });
        }
        const artisanUser = await prisma.user.findUnique({ where: { id: artisanId } });
        if (!artisanUser || artisanUser.role !== 'ARTISAN') {
            return NextResponse.json({ error: 'Invalid Artisan ID or user is not an artisan.' }, { status: 403 });
        }

        const serviceData = {
            title: title.trim(),
            description: description.trim(),
            priceType: priceType.toUpperCase(),
            price: price !== undefined && price !== null ? parseFloat(price) : null,
            priceUnit: priceUnit || null,
            currency,
            images: images || [], // Stored as JSON
            locationType: locationType.toUpperCase(),
            serviceArea: serviceArea || null,
            typicalDuration: typicalDuration || null,
            status: 'PENDING_APPROVAL', // Default status for new service submissions
            artisan: { connect: { id: artisanId } },
            category: { connect: { id: categoryId } },
            // rejectionReason is null by default
        };

        const newServiceListing = await prisma.serviceListing.create({
            data: serviceData,
        });

        return NextResponse.json(newServiceListing, { status: 201 });

    } catch (error) {
        console.error('API ERROR in POST /api/services:', error, "Request Body:", requestBodyText);
        // ... (add detailed error logging as in product API)
        if (error.code === 'P2025') return NextResponse.json({ error: 'Related record (artisan/category) not found.' }, { status: 400 });
        if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
        return NextResponse.json({ error: 'Internal Server Error. Failed to create service listing.' }, { status: 500 });
    }
}

// GET - Fetch Service Listings (Public view filters by ACTIVE)
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;
    const categoryId = searchParams.get('categoryId');
    const statusParam = searchParams.get('status');
    const searchQuery = searchParams.get('search');
    // Add other filters like locationType, priceType if needed

    const whereClause = {};
    // --- Status Filter Logic (Same as for products) ---
    if (statusParam && ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'REJECTED', 'ARCHIVED'].includes(statusParam.toUpperCase())) {
        // TODO: Add admin auth check if status is not 'ACTIVE'
        whereClause.status = statusParam.toUpperCase();
    } else if (!statusParam) {
        whereClause.status = 'ACTIVE'; // Default for public
    }

    if (categoryId) whereClause.categoryId = categoryId;
    if (searchQuery) {
        whereClause.OR = [
            { title: { contains: searchQuery } },
            { description: { contains: searchQuery } },
        ];
    }

    try {
        const services = await prisma.serviceListing.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            skip: skip,
            take: limit,
            include: {
                artisan: { select: { id: true, name: true, email: true } },
                category: { select: { id: true, name: true } }
            }
        });
        const totalServices = await prisma.serviceListing.count({ where: whereClause });
        return NextResponse.json({
            services, // Note: key is 'services'
            currentPage: page,
            totalPages: Math.ceil(totalServices / limit),
            totalItems: totalServices,
            limit,
        });
    } catch (error) {
        console.error('API ERROR in GET /api/services:', error);
        return NextResponse.json({ error: 'Internal Server Error. Failed to fetch services.' }, { status: 500 });
    }
}