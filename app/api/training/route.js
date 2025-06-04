// app/api/training/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
// import { getArtisanIdFromAuth } from '@/lib/auth'; // Your actual auth utility

// POST - Artisan creates a new Training Offer
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
            isFree = false,
            images,
            duration,
            scheduleDetails,
            location,
            capacity,
            prerequisites,
            whatYouWillLearn,
            categoryId,
            artisanId // MUST be replaced by authenticated artisanId from token
        } = body;

        // --- Validation ---
        if (!artisanId) {
            return NextResponse.json({ error: 'Artisan ID is required (must be derived from session).' }, { status: 400 });
        }
        if (!title || !description || !duration || !location || !categoryId) {
            return NextResponse.json({ error: 'Missing required fields: title, description, duration, location, categoryId.' }, { status: 400 });
        }
        if (!isFree && (price === undefined || price === null || isNaN(parseFloat(price)) || parseFloat(price) < 0)) {
            return NextResponse.json({ error: 'Price must be a valid non-negative number if not free.' }, { status: 400 });
        }
        if (capacity !== undefined && capacity !== null && (isNaN(parseInt(capacity)) || parseInt(capacity) <= 0)) {
            return NextResponse.json({ error: 'Capacity must be a valid positive integer if provided.' }, { status: 400 });
        }
        if (images && !Array.isArray(images)) {
            return NextResponse.json({ error: 'Images must be an array of strings (URLs).' }, { status: 400 });
        }
        if (whatYouWillLearn && !Array.isArray(whatYouWillLearn)) {
            return NextResponse.json({ error: 'What you will learn must be an array of strings.' }, { status: 400 });
        }

        const categoryExists = await prisma.category.findUnique({ where: { id: categoryId } });
        if (!categoryExists || categoryExists.type !== 'TRAINING') {
            return NextResponse.json({ error: 'Invalid or non-TRAINING category ID.' }, { status: 400 });
        }
        const artisanUser = await prisma.user.findUnique({ where: { id: artisanId } });
        if (!artisanUser || artisanUser.role !== 'ARTISAN') {
            return NextResponse.json({ error: 'Invalid Artisan ID or user is not an artisan.' }, { status: 403 });
        }

        // --- Prepare Data ---
        const trainingData = {
            title: title.trim(),
            description: description.trim(),
            price: isFree ? null : parseFloat(price),
            currency: isFree ? null : currency,
            isFree,
            images: images || [], // Stored as JSON
            duration,
            scheduleDetails: scheduleDetails || null,
            location,
            capacity: capacity !== undefined && capacity !== null ? parseInt(capacity) : null,
            prerequisites: prerequisites || null,
            whatYouWillLearn: whatYouWillLearn || [], // Stored as JSON
            status: 'PENDING_APPROVAL', // Default status for new artisan submissions
            artisan: { connect: { id: artisanId } },
            category: { connect: { id: categoryId } },
        };

        const newTrainingOffer = await prisma.trainingOffer.create({
            data: trainingData,
        });

        return NextResponse.json(newTrainingOffer, { status: 201 });

    } catch (error) {
        console.error('API ERROR in POST /api/training:', error, "Request Body:", requestBodyText);
        if (error.code === 'P2025') return NextResponse.json({ error: 'Related record (artisan/category) not found.' }, { status: 400 });
        if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
        // Add other specific Prisma error checks if needed
        return NextResponse.json({ error: 'Internal Server Error. Failed to create training offer.' }, { status: 500 });
    }
}

// GET - Fetch Training Offers (Public view filters by ACTIVE, Admin can see others)
export async function GET(request) {
    // TODO: Implement admin role check to allow viewing non-ACTIVE statuses securely
    // const isAdmin = await checkAdminAuth(request); 

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const categoryId = searchParams.get('categoryId');
    const artisanIdParam = searchParams.get('artisanId');
    const statusParam = searchParams.get('status');
    const searchQuery = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const whereClause = {};

    // --- Status Filter Logic ---
    if (statusParam && ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'REJECTED', 'ARCHIVED'].includes(statusParam.toUpperCase())) {
        // TODO: Add a check here: if statusParam is anything other than 'ACTIVE', ensure request is from an admin.
        // if (statusParam.toUpperCase() !== 'ACTIVE' && !isAdmin) {
        //   return NextResponse.json({ error: 'Unauthorized to view non-active training offers.' }, { status: 403 });
        // }
        whereClause.status = statusParam.toUpperCase();
    } else if (!statusParam) {
        whereClause.status = 'ACTIVE'; // Default for public
    }
    // If statusParam is "ALL" or invalid and not handled, it won't filter by status (admins might want this)

    if (categoryId) whereClause.categoryId = categoryId;
    if (artisanIdParam) whereClause.artisanId = artisanIdParam;

    if (searchQuery) {
        whereClause.OR = [
            { title: { contains: searchQuery } },
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
        if (!prisma || !prisma.trainingOffer) {
            console.error("Prisma client or prisma.trainingOffer is undefined in GET /api/training");
            throw new Error("Database client is not available.");
        }

        const trainingOffers = await prisma.trainingOffer.findMany({
            where: whereClause,
            orderBy: [orderByClause],
            skip: skip,
            take: limit,
            include: {
                artisan: { select: { id: true, name: true, email: true } },
                category: { select: { id: true, name: true } }
            }
        });

        const totalTrainingOffers = await prisma.trainingOffer.count({ where: whereClause });
        const totalPages = Math.ceil(totalTrainingOffers / limit);

        return NextResponse.json({
            trainingOffers, // Key for the list of training offers
            currentPage: page,
            totalPages,
            totalItems: totalTrainingOffers,
            limit,
        });

    } catch (error) {
        console.error('API ERROR in GET /api/training:', error);
        // Add detailed error logging (name, message, stack, prisma code)
        return NextResponse.json({ error: 'Internal Server Error. Failed to fetch training offers. Check server logs.' }, { status: 500 });
    }
}