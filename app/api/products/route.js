// app/api/products/route.js
import prisma from '@/lib/prisma'; // Ensure this path is correct for your Prisma client
import { NextResponse } from 'next/server';
// import { getArtisanIdFromTokenAndVerifyRole } from '@/lib/auth'; // Placeholder for your actual auth utility

// Helper function to generate a slug (ensure it's robust for your needs)
function generateSlug(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove non-word characters
        .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with a hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// POST - Create a new Product Listing
export async function POST(request) {
    // --- CRITICAL: Authentication and Authorization ---
    // This section MUST be implemented to securely get the artisanId of the logged-in user
    // and verify they have the 'ARTISAN' role.
    // Example (replace with your actual authentication logic):
    // const authResult = await getArtisanIdFromTokenAndVerifyRole(request);
    // if (!authResult.artisanId) {
    //   return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 });
    // }
    // const artisanId = authResult.artisanId;
    // For now, relying on artisanId being passed in the body for dev purposes ONLY.
    // THIS IS NOT SECURE FOR PRODUCTION.

    let requestBodyText = 'Could not parse or clone request body.';
    try {
        const requestClone = request.clone();
        requestBodyText = await requestClone.text();
        const body = await request.json();

        // Destructure all expected fields, providing defaults where appropriate
        const {
            title,
            description,
            price,
            currency = "GHS", // Default currency
            images, // Expected: array of image URLs
            stockQuantity,
            materials, // Expected: array of material names
            dimensions,
            sku,
            shippingDetails,
            categoryId,
            status = 'DRAFT', // Default status for new products
            artisanId // TEMPORARY: Remove this from body and get from auth token in production
        } = body;

        // --- Validation ---
        if (!artisanId) { // This check will be redundant once auth supplies artisanId
            return NextResponse.json({ error: 'Artisan ID is required (must be derived from authenticated session in production).' }, { status: 400 });
        }
        if (!title || !description || price === undefined || !categoryId) {
            return NextResponse.json({ error: 'Missing required fields: title, description, price, categoryId.' }, { status: 400 });
        }
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return NextResponse.json({ error: 'Price must be a valid non-negative number.' }, { status: 400 });
        }
        const parsedStockQuantity = stockQuantity !== undefined && stockQuantity !== null ? parseInt(stockQuantity) : null;
        if (parsedStockQuantity !== null && (isNaN(parsedStockQuantity) || parsedStockQuantity < 0)) {
            return NextResponse.json({ error: 'Stock quantity must be a valid non-negative integer if provided.' }, { status: 400 });
        }
        if (images && !Array.isArray(images)) { // And ensure elements are strings
            return NextResponse.json({ error: 'Images must be an array of strings (URLs).' }, { status: 400 });
        }
        if (materials && !Array.isArray(materials)) { // And ensure elements are strings
            return NextResponse.json({ error: 'Materials must be an array of strings.' }, { status: 400 });
        }

        // Verify categoryId exists and is of type 'PRODUCT'
        const categoryExists = await prisma.category.findUnique({ where: { id: categoryId } });
        if (!categoryExists) {
            return NextResponse.json({ error: 'Invalid Category ID. Category does not exist.' }, { status: 400 });
        }
        if (categoryExists.type !== 'PRODUCT') {
            return NextResponse.json({ error: `Category type must be PRODUCT for product listings. Selected category is ${categoryExists.type}.` }, { status: 400 });
        }

        // Verify artisanId exists (User model) and has ARTISAN role (this part becomes part of auth check)
        const artisanUser = await prisma.user.findUnique({ where: { id: artisanId } });
        if (!artisanUser) {
            return NextResponse.json({ error: 'Artisan user not found for the provided artisanId.' }, { status: 404 });
        }
        if (artisanUser.role !== 'ARTISAN') {
            return NextResponse.json({ error: 'User creating product must have ARTISAN role.' }, { status: 403 });
        }

        // --- Prepare Data ---
        const productData = {
            title: title.trim(),
            description: description.trim(),
            price: parsedPrice,
            currency,
            images: images || [], // Stored as JSON in DB, Prisma handles array -> JSON
            stockQuantity: parsedStockQuantity,
            materials: materials || [], // Stored as JSON in DB
            dimensions: dimensions || null,
            sku: sku || null, // Consider adding uniqueness check for SKU if it's not null
            shippingDetails: shippingDetails || null,
            status: status.toUpperCase(),
            artisan: { connect: { id: artisanId } },
            category: { connect: { id: categoryId } },
        };

        // --- Create Product Listing ---
        const newProductListing = await prisma.productListing.create({
            data: productData,
        });

        return NextResponse.json(newProductListing, { status: 201 });

    } catch (error) {
        console.error('**********************************************');
        console.error('API ERROR in POST /api/products:');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Request URL:', request.url);
        console.error('Request Body Logged:', requestBodyText);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Prisma Error Code (if available):', error.code);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');

        if (error.code === 'P2002' && error.message.includes('sku')) {
            return NextResponse.json({ error: 'This SKU is already in use.' }, { status: 409 });
        }
        if (error.code === 'P2025') { // Foreign key constraint failed
            return NextResponse.json({ error: 'Failed to create product: Related artisan or category not found.' }, { status: 400 });
        }
        if (error instanceof SyntaxError && error.message.includes("JSON")) {
            return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
        }
        if (error.name === 'PrismaClientValidationError') {
            const validationErrorMessage = error.message.split('\n').find(line => line.startsWith('Unknown argument') || line.startsWith('Invalid value')) || error.message;
            return NextResponse.json({ error: `Validation error creating product: ${validationErrorMessage}`, detail: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error. Failed to create product listing. Check server logs.' }, { status: 500 });
    }
}

// GET - Fetch all Product Listings (with pagination, filtering, searching, sorting)
export async function GET(request) {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const categoryId = searchParams.get('categoryId');
    const artisanId = searchParams.get('artisanId'); // For admin or specific artisan views
    const statusParam = searchParams.get('status');
    const searchQuery = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const whereClause = {};

    if (categoryId) whereClause.categoryId = categoryId;
    if (artisanId) whereClause.artisanId = artisanId;

    // Status filtering: Default to ACTIVE for public, allow 'ALL' or specific status for admin/authenticated views
    if (statusParam) {
        const upperStatus = statusParam.toUpperCase();
        if (['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'REJECTED', 'ARCHIVED'].includes(upperStatus)) {
            whereClause.status = upperStatus;
        } else if (upperStatus !== 'ALL') {
            console.warn(`Invalid status filter: '${statusParam}', defaulting to ACTIVE or applying no status filter if not intended for public.`);
            whereClause.status = 'ACTIVE'; // Default for invalid status for safety if it's a public query
        }
        // If upperStatus === 'ALL', no status filter is added to whereClause
    } else {
        // Default to ACTIVE if no status parameter is provided (common for public Browse)
        whereClause.status = 'ACTIVE';
    }


    if (searchQuery) {
        whereClause.OR = [
            { title: { contains: searchQuery /* mode: 'insensitive' // MySQL often case-insensitive by default */ } },
            { description: { contains: searchQuery /* mode: 'insensitive' */ } },
            // { materials: { array_contains: searchQuery } } // This syntax is for native array types, for JSON you'd need different querying if searching inside JSON array
        ];
    }

    const orderByClause = {};
    const validSortByFields = ['createdAt', 'updatedAt', 'title', 'price'];
    if (validSortByFields.includes(sortBy)) {
        orderByClause[sortBy] = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
        orderByClause['createdAt'] = 'desc'; // Default sort
    }

    try {
        if (!prisma || !prisma.productListing) {
            console.error("Prisma client or prisma.productListing is undefined in GET /api/products");
            throw new Error("Database client is not available.");
        }

        const products = await prisma.productListing.findMany({
            where: whereClause,
            orderBy: [orderByClause],
            skip: skip,
            take: limit,
            include: {
                artisan: { select: { id: true, name: true, email: true } }, // Select fields you want to expose
                category: { select: { id: true, name: true } }
            }
        });

        const totalProducts = await prisma.productListing.count({
            where: whereClause,
        });

        const totalPages = Math.ceil(totalProducts / limit);

        return NextResponse.json({
            products,
            currentPage: page,
            totalPages,
            totalItems: totalProducts,
            limit,
        });

    } catch (error) {
        console.error('**********************************************');
        console.error('API ERROR in GET /api/products:');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Request URL:', request.url);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Prisma Error Code (if available):', error.code);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');
        return NextResponse.json({ error: 'Internal Server Error. Failed to fetch products. Check server logs.' }, { status: 500 });
    }
}