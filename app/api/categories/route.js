// app/api/categories/route.js
import prisma from '@/lib/prisma'; // Ensure this path is correct for your Prisma client
import { NextResponse } from 'next/server';

// Helper function to generate a slug
function generateSlug(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove non-word characters except spaces and hyphens
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with a single hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

export async function POST(request) {
    // TODO: Implement proper admin authentication/authorization check here
    // e.g., verify a token from request.headers or a session.
    // const isAdmin = await checkAdminAuth(request); // Placeholder
    // if (!isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    let requestBodyText = 'Could not parse or clone request body.'; // Default for logging
    try {
        const requestClone = request.clone(); // Clone for logging body in case of error
        requestBodyText = await requestClone.text();

        const body = await request.json(); // Parse original request
        const { name, description, type, parentId } = body;

        if (!name || !type) {
            return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
        }

        const upperCaseType = type.toUpperCase();
        if (!['PRODUCT', 'SERVICE', 'TRAINING'].includes(upperCaseType)) {
            return NextResponse.json({ error: 'Invalid category type. Must be PRODUCT, SERVICE, or TRAINING.' }, { status: 400 });
        }

        let slug = generateSlug(name);

        // Check for existing category with the same name and type
        // NOTE: `mode: 'insensitive'` was removed as it's not supported for MySQL in this Prisma query context.
        // MySQL's default collation often handles case-insensitivity for string comparisons.
        const existingCategoryByNameAndType = await prisma.category.findFirst({
            where: {
                name: { equals: name }, // Case sensitivity depends on your MySQL column collation
                type: upperCaseType,
                // Consider scoping by parentId if names should be unique per parent:
                // parentId: parentId || null,
            },
        });

        if (existingCategoryByNameAndType) {
            return NextResponse.json({ error: `A category with the name "${name}" and type "${type}" already exists.` }, { status: 409 });
        }

        // Ensure slug is unique, append suffix if needed
        let uniqueSlug = slug;
        let suffix = 1;
        if (prisma && prisma.category) { // Defensive check for Prisma client
            while (await prisma.category.findUnique({ where: { slug: uniqueSlug } })) {
                uniqueSlug = `${slug}-${suffix}`;
                suffix++;
            }
            slug = uniqueSlug;
        } else {
            console.error("Prisma client or prisma.category is undefined during slug generation in POST /api/categories.");
            // This indicates a critical setup issue if prisma is not available
            throw new Error("Database client not available for slug generation.");
        }

        const categoryData = {
            name,
            slug,
            description: description || null,
            type: upperCaseType,
        };

        if (parentId) {
            const parentCategory = await prisma.category.findUnique({ where: { id: parentId } });
            if (!parentCategory) {
                return NextResponse.json({ error: 'Parent category not found' }, { status: 400 });
            }
            if (parentCategory.type !== categoryData.type) {
                return NextResponse.json({ error: 'Parent category must be of the same type.' }, { status: 400 });
            }
            categoryData.parentId = parentId;
        }

        const newCategory = await prisma.category.create({
            data: categoryData,
        });

        return NextResponse.json(newCategory, { status: 201 });

    } catch (error) {
        console.error('**********************************************');
        console.error('API ERROR in POST /api/categories:');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Request URL:', request.url);
        console.error('Request Body Logged:', requestBodyText);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Prisma Error Code (if available):', error.code);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');

        if (error.code === 'P2002') { // Prisma unique constraint violation
            return NextResponse.json({ error: 'A category with this name or generated slug already exists.' }, { status: 409 });
        }
        if (error instanceof SyntaxError && error.message.includes("JSON")) { // Error parsing request.json()
            return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
        }
        // Handle PrismaClientValidationError specifically if it's not caught by other checks
        if (error.name === 'PrismaClientValidationError') {
            return NextResponse.json({ error: `Validation error creating category: ${error.message.split('\n').pop()}`, detail: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error. Failed to create category. Check server logs.' }, { status: 500 });
    }
}

export async function GET(request) {
    // TODO: Add admin authentication/authorization check here

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const hierarchy = searchParams.get('hierarchy') === 'true';

    const whereClause = {};
    if (typeParam) {
        const upperCaseType = typeParam.toUpperCase();
        if (['PRODUCT', 'SERVICE', 'TRAINING'].includes(upperCaseType)) {
            whereClause.type = upperCaseType;
        } else {
            // Optionally, return a 400 error for invalid type, or just ignore it
            console.warn(`Invalid category type provided in filter: ${typeParam}`);
            // return NextResponse.json({ error: `Invalid category type: ${typeParam}` }, { status: 400 });
        }
    }

    try {
        if (!prisma || !prisma.category) { // Defensive check
            console.error("Prisma client or prisma.category is undefined in GET /api/categories");
            throw new Error("Database client is not available.");
        }

        if (hierarchy) {
            // Fetch only top-level categories and include their subcategories recursively
            const topLevelCategories = await prisma.category.findMany({
                where: {...whereClause, parentId: null }, // Key for top-level
                orderBy: { name: 'asc' },
                include: { // Adjust depth as needed, mindful of performance
                    subCategories: {
                        orderBy: { name: 'asc' },
                        include: {
                            subCategories: { // Level 2
                                orderBy: { name: 'asc' },
                                include: {
                                    subCategories: true // Level 3 
                                }
                            }
                        }
                    }
                }
            });
            return NextResponse.json(topLevelCategories);

        } else {
            // Fetch a flat list of all categories matching the type filter
            const categories = await prisma.category.findMany({
                where: whereClause,
                orderBy: [
                    { type: 'asc' },
                    { name: 'asc' }
                ],
            });
            return NextResponse.json(categories);
        }

    } catch (error) {
        console.error('**********************************************');
        console.error('API ERROR in GET /api/categories:');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Request URL:', request.url);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Prisma Error Code (if available):', error.code);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');

        return NextResponse.json({ error: 'Internal Server Error. Failed to fetch categories. Check server logs for details.' }, { status: 500 });
    }
}