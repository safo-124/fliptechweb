// app/api/categories/[categoryId]/route.js
import prisma from '@/lib/prisma'; // Ensure this path is correct
import { NextResponse } from 'next/server';

// Helper function to generate a slug (can be shared or defined here if not imported)
function generateSlug(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// GET a single category by ID
export async function GET(request, { params }) {
    const { categoryId } = params;
    // TODO: Add admin authentication/authorization check

    try {
        if (!prisma || !prisma.category) {
            console.error("Prisma client or prisma.category is undefined in GET /api/categories/[categoryId]");
            throw new Error("Database client is not available.");
        }
        const category = await prisma.category.findUnique({
            where: { id: categoryId },
            include: {
                parent: true, // Include parent category details
                // subCategories: true, // Optionally include direct subcategories
            }
        });

        if (!category) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }
        return NextResponse.json(category);

    } catch (error) {
        console.error('**********************************************');
        console.error(`API ERROR in GET /api/categories/${categoryId}:`);
        console.error('Timestamp:', new Date().toISOString());
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');
        return NextResponse.json({ error: 'Internal Server Error. Failed to fetch category.' }, { status: 500 });
    }
}

// PUT (Update) a category by ID
export async function PUT(request, { params }) {
    const { categoryId } = params;
    // TODO: Add admin authentication/authorization check

    let requestBodyText = 'Could not parse or clone request body.';
    try {
        const requestClone = request.clone();
        requestBodyText = await requestClone.text();
        const body = await request.json();
        const { name, description, type, parentId } = body;

        if (!prisma || !prisma.category) {
            console.error("Prisma client or prisma.category is undefined in PUT /api/categories/[categoryId]");
            throw new Error("Database client is not available.");
        }

        const existingCategory = await prisma.category.findUnique({ where: { id: categoryId } });
        if (!existingCategory) {
            return NextResponse.json({ error: 'Category not found to update.' }, { status: 404 });
        }

        const updateData = {};

        if (name && name !== existingCategory.name) {
            updateData.name = name;
            let newSlug = generateSlug(name);
            // Ensure new slug is unique if it changed, excluding the current category
            if (newSlug !== existingCategory.slug) {
                let uniqueSlug = newSlug;
                let suffix = 1;
                while (await prisma.category.findFirst({ where: { slug: uniqueSlug, NOT: { id: categoryId } } })) {
                    uniqueSlug = `${newSlug}-${suffix}`;
                    suffix++;
                }
                updateData.slug = uniqueSlug;
            }
        }

        if (description !== undefined) { // Allow setting description to "" or null
            updateData.description = description === "" ? null : description;
        }

        if (type) {
            const upperCaseType = type.toUpperCase();
            if (!['PRODUCT', 'SERVICE', 'TRAINING'].includes(upperCaseType)) {
                return NextResponse.json({ error: 'Invalid category type.' }, { status: 400 });
            }
            updateData.type = upperCaseType;
            // If type changes, the parentId might need revalidation or clearing
            if (upperCaseType !== existingCategory.type) {
                // If type changes, and a parentId is provided, it must match the new type.
                // If no parentId is provided with type change, clear existing parentId.
                if (parentId) {
                    const parentCategory = await prisma.category.findUnique({ where: { id: parentId } });
                    if (parentCategory && parentCategory.type !== upperCaseType) {
                        return NextResponse.json({ error: 'Parent category must be of the new type.' }, { status: 400 });
                    }
                    updateData.parentId = parentId;
                } else {
                    updateData.parentId = null;
                }
            }
        }

        if (parentId !== undefined) { // Allows setting parentId to null or a new ID
            if (parentId === categoryId) { // Check for self-parenting
                return NextResponse.json({ error: 'A category cannot be its own parent.' }, { status: 400 });
            }
            if (parentId === "") { // UI sends "" for "None (Top Level)"
                updateData.parentId = null;
            } else if (parentId) { // If a specific parentId is given
                const parentCategory = await prisma.category.findUnique({ where: { id: parentId } });
                if (!parentCategory) {
                    return NextResponse.json({ error: 'Parent category not found.' }, { status: 400 });
                }
                // Ensure parent is of the correct type (either existing type or new type if type is also being updated)
                const targetType = updateData.type || existingCategory.type;
                if (parentCategory.type !== targetType) {
                    return NextResponse.json({ error: `Parent category must be of type ${targetType}.` }, { status: 400 });
                }
                // More advanced: Check for circular dependencies (prevent making a category a child of its own descendant)
                // This can be complex. For now, simple parent check.
                updateData.parentId = parentId;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ message: 'No changes provided.', category: existingCategory }, { status: 200 });
        }

        const updatedCategory = await prisma.category.update({
            where: { id: categoryId },
            data: updateData,
        });

        return NextResponse.json(updatedCategory);

    } catch (error) {
        console.error('**********************************************');
        console.error(`API ERROR in PUT /api/categories/${categoryId}:`);
        console.error('Timestamp:', new Date().toISOString());
        console.error('Request URL:', request.url);
        console.error('Request Body Logged:', requestBodyText);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Prisma Error Code (if available):', error.code);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'A category with the updated name or slug already exists.' }, { status: 409 });
        }
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Category not found to update.' }, { status: 404 });
        }
        if (error instanceof SyntaxError && error.message.includes("JSON")) {
            return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
        }
        if (error.name === 'PrismaClientValidationError') {
            return NextResponse.json({ error: `Validation error updating category: ${error.message.split('\n').pop()}`, detail: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error. Failed to update category.' }, { status: 500 });
    }
}

// DELETE a category by ID
export async function DELETE(request, { params }) {
    const { categoryId } = params;
    // TODO: Add admin authentication/authorization check

    try {
        if (!prisma || !prisma.category) {
            console.error("Prisma client or prisma.category is undefined in DELETE /api/categories/[categoryId]");
            throw new Error("Database client is not available.");
        }

        // Check if the category has any subcategories
        const subCategoryCount = await prisma.category.count({
            where: { parentId: categoryId },
        });
        if (subCategoryCount > 0) {
            return NextResponse.json({ error: 'Cannot delete category with subcategories. Please delete or reassign them first.' }, { status: 400 });
        }

        // TODO: Check if category is associated with any products, services, or training offers.
        // Example (assuming you have ProductListing model linked to Category):
        // const associatedProductsCount = await prisma.productListing.count({ where: { categoryId: categoryId } });
        // if (associatedProductsCount > 0) {
        //   return NextResponse.json({ error: 'Cannot delete category: It is still associated with products.' }, { status: 400 });
        // }
        // Repeat for services and training offers.

        await prisma.category.delete({
            where: { id: categoryId },
        });

        return NextResponse.json({ message: 'Category deleted successfully' }, { status: 200 }); // Or status 204 (No Content)

    } catch (error) {
        console.error('**********************************************');
        console.error(`API ERROR in DELETE /api/categories/${categoryId}:`);
        console.error('Timestamp:', new Date().toISOString());
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Prisma Error Code (if available):', error.code);
        console.error('Error Stack:', error.stack);
        console.error('**********************************************');
        if (error.code === 'P2025') { // Prisma's "Record to delete does not exist"
            return NextResponse.json({ error: 'Category not found to delete.' }, { status: 404 });
        }
        // P2003: Foreign key constraint failed (e.g., if onDelete behavior in schema is Restrict and items still link to it)
        if (error.code === 'P2003') {
            return NextResponse.json({ error: 'Cannot delete category. It is still referenced by other items or subcategories (database constraint).' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error. Failed to delete category.' }, { status: 500 });
    }
}