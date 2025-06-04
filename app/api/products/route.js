// app/api/products/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
// import { getArtisanIdFromAuth } from '@/lib/auth'; // Your actual auth utility

// Helper function to generate a slug
function generateSlug(name) {
    if (!name) return '';
    return name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// POST - Artisan creates a new Product Listing
export async function POST(request) {
    // --- CRITICAL: Authentication and Authorization ---
    // const artisanId = await getArtisanIdFromAuth(request); // Get ID from verified token
    // if (!artisanId) {
    //   return NextResponse.json({ error: 'Unauthorized. Artisan login required.' }, { status: 401 });
    // }
    // For now, expecting artisanId in body - THIS IS NOT SECURE FOR PRODUCTION

    let requestBodyText = 'Could not parse or clone request body.';
    try {
        const requestClone = request.clone();
        requestBodyText = await requestClone.text();
        const body = await request.json();

        const {
            title,
            description,
            price,
            currency = "GHS",
            images,
            stockQuantity,
            materials,
            dimensions,
            sku,
            shippingDetails,
            categoryId,
            artisanId // MUST be replaced by authenticated artisanId from token
        } = body;

        if (!artisanId) {
            return NextResponse.json({ error: 'Artisan ID is required (must be derived from session).' }, { status: 400 });
        }
        if (!title || !description || price === undefined || !categoryId) {
            return NextResponse.json({ error: 'Missing required fields: title, description, price, categoryId.' }, { status: 400 });
        }
        // Further validation (price, stock, arrays, category type etc. from previous version)
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) return NextResponse.json({ error: 'Price must be valid.' }, { status: 400 });
        const parsedStockQuantity = stockQuantity !== undefined && stockQuantity !== null ? parseInt(stockQuantity) : null;
        if (parsedStockQuantity !== null && (isNaN(parsedStockQuantity) || parsedStockQuantity < 0)) return NextResponse.json({ error: 'Stock must be valid.' }, { status: 400 });


        const categoryExists = await prisma.category.findUnique({ where: { id: categoryId } });
        if (!categoryExists || categoryExists.type !== 'PRODUCT') {
            return NextResponse.json({ error: 'Invalid or non-PRODUCT category ID.' }, { status: 400 });
        }
        const artisanUser = await prisma.user.findUnique({ where: { id: artisanId } });
        if (!artisanUser || artisanUser.role !== 'ARTISAN') {
            return NextResponse.json({ error: 'Invalid Artisan ID or user is not an artisan.' }, { status: 403 });
        }


        const productData = {
            title: title.trim(),
            description: description.trim(),
            price: parsedPrice,
            currency,
            images: images || [],
            stockQuantity: parsedStockQuantity,
            materials: materials || [],
            dimensions: dimensions || null,
            sku: sku || null,
            shippingDetails: shippingDetails || null,
            status: 'PENDING_APPROVAL', // <-- Default status for new artisan submissions
            artisan: { connect: { id: artisanId } },
            category: { connect: { id: categoryId } },
            // rejectionReason is null by default
        };

        const newProductListing = await prisma.productListing.create({
            data: productData,
        });

        return NextResponse.json(newProductListing, { status: 201 });

    } catch (error) {
        console.error('API ERROR in POST /api/products:', error, "Request Body:", requestBodyText);
        // ... (detailed error handling from previous versions)
        if (error.code === 'P2002') return NextResponse.json({ error: `Unique constraint failed: ${error.meta?.target?.join(', ')}` }, { status: 409 });
        if (error.code === 'P2025') return NextResponse.json({ error: 'Related record (artisan/category) not found.' }, { status: 400 });
        if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
        return NextResponse.json({ error: 'Internal Server Error. Failed to create product.' }, { status: 500 });
    }
}

// GET - Fetch Product Listings (Public view filters by ACTIVE, Admin can see others)
export async function GET(request) {
    // TODO: Implement admin role check to allow viewing non-ACTIVE statuses
    // const isAdmin = await checkAdminAuth(request); // Your auth check

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const categoryId = searchParams.get('categoryId');
    const artisanIdParam = searchParams.get('artisanId'); // For admin filtering or artisan's own list
    const statusParam = searchParams.get('status'); // For admin filtering
    const searchQuery = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const whereClause = {};

    // --- Status Filter Logic ---
    // By default, public users only see ACTIVE products.
    // Admins (after authentication check) could pass a status param to see others.
    // For this example, we'll assume an admin would explicitly pass status=PENDING_APPROVAL for the approvals page.
    if (statusParam && ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'REJECTED', 'ARCHIVED'].includes(statusParam.toUpperCase())) {
        // TODO: Add a check here: if statusParam is anything other than 'ACTIVE', ensure request is from an admin.
        // if (statusParam.toUpperCase() !== 'ACTIVE' && !isAdmin) {
        //   return NextResponse.json({ error: 'Unauthorized to view non-active products.' }, { status: 403 });
        // }
        whereClause.status = statusParam.toUpperCase();
    } else if (!statusParam) {
        // Default for public: only ACTIVE products
        whereClause.status = 'ACTIVE';
    }
    // If statusParam is "ALL" or invalid and not handled above, it won't filter by status (admins might want this)


    if (categoryId) whereClause.categoryId = categoryId;
    if (artisanIdParam) whereClause.artisanId = artisanIdParam; // If admin wants to see products by specific artisan

    if (searchQuery) {
        whereClause.OR = [
            { title: { contains: searchQuery /* mode: 'insensitive' removed for MySQL */ } },
            { description: { contains: searchQuery } },
        ];
    }

    const orderByClause = {};
    if (['createdAt', 'updatedAt', 'title', 'price'].includes(sortBy)) {
        orderByClause[sortBy] = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
        orderByClause['createdAt'] = 'desc';
    }

    try {
        const products = await prisma.productListing.findMany({
            where: whereClause,
            orderBy: [orderByClause],
            skip: skip,
            take: limit,
            include: {
                artisan: { select: { id: true, name: true, email: true } },
                category: { select: { id: true, name: true } }
            }
        });

        const totalProducts = await prisma.productListing.count({ where: whereClause });
        const totalPages = Math.ceil(totalProducts / limit);

        return NextResponse.json({
            products,
            currentPage: page,
            totalPages,
            totalItems: totalProducts,
            limit,
        });

    } catch (error) {
        console.error('API ERROR in GET /api/products:', error);
        return NextResponse.json({ error: 'Internal Server Error. Failed to fetch products.' }, { status: 500 });
    }
}