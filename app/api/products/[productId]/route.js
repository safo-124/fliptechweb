// app/api/products/[productId]/route.js
import prisma from '@/lib/prisma'; // Ensure this path is correct
import { NextResponse } from 'next/server';
// import { getArtisanIdFromTokenAndVerifyRole, checkOwnershipOrAdmin } from '@/lib/auth'; // Placeholder for actual auth utilities

// Helper function to generate a slug (if not globally available or imported)
function generateSlug(name) {
    if (!name) return '';
    return name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// GET - Fetch a single product by ID
export async function GET(request, { params }) {
    const { productId } = params;
    // No specific auth needed for public to view a product, but you might add checks if some products are private.

    try {
        if (!prisma || !prisma.productListing) {
            console.error("Prisma client or prisma.productListing is undefined in GET /api/products/[productId]");
            throw new Error("Database client is not available.");
        }
        if (!productId) {
            return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });
        }

        const product = await prisma.productListing.findUnique({
            where: { id: productId },
            include: {
                artisan: { // Include public artisan details
                    select: { id: true, name: true /* other public fields like profile image URL, etc. */ }
                },
                category: { // Include category details
                    select: { id: true, name: true, slug: true }
                }
            }
        });

        if (!product) {
            return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
        }
        // Optionally, only return ACTIVE products unless an admin/owner is viewing
        // if (product.status !== 'ACTIVE' && !isOwnerOrAdmin) {
        //   return NextResponse.json({ error: 'Product not available.' }, { status: 404 });
        // }

        return NextResponse.json(product);

    } catch (error) {
        console.error(`API ERROR in GET /api/products/${productId}:`, error);
        // Add more specific error logging similar to the previous files
        return NextResponse.json({ error: 'Internal Server Error. Failed to fetch product. Check server logs.' }, { status: 500 });
    }
}


// PUT - Update an existing product by ID
export async function PUT(request, { params }) {
    const { productId } = params;

    // --- CRITICAL: Authentication and Authorization ---
    // 1. Get authenticated user ID (e.g., artisanId) from token.
    // 2. Verify user is an ARTISAN.
    // 3. Fetch the product to check if the authenticated artisan is the owner OR if the user is an ADMIN.
    // const authResult = await checkOwnershipOrAdmin(request, 'productListing', productId);
    // if (!authResult.authorized) {
    //   return NextResponse.json({ error: authResult.error || 'Unauthorized to update this product.' }, { status: authResult.status || 403 });
    // }
    // For now, this check is a placeholder.

    let requestBodyText = 'Could not parse or clone request body.';
    try {
        const requestClone = request.clone();
        requestBodyText = await requestClone.text();
        const body = await request.json();

        const {
            title,
            description,
            price,
            currency,
            images,
            stockQuantity,
            materials,
            dimensions,
            sku,
            shippingDetails,
            categoryId,
            status
        } = body;

        if (!prisma || !prisma.productListing) {
            console.error("Prisma client or prisma.productListing is undefined in PUT /api/products/[productId]");
            throw new Error("Database client is not available.");
        }

        const existingProduct = await prisma.productListing.findUnique({ where: { id: productId } });
        if (!existingProduct) {
            return NextResponse.json({ error: 'Product not found to update.' }, { status: 404 });
        }

        // --- Authorization Check (Example - replace with your actual logic) ---
        // const authenticatedArtisanId = "get-this-from-token"; // Replace this
        // if (existingProduct.artisanId !== authenticatedArtisanId /* && !isAdmin(authenticatedArtisanId) */) {
        //     return NextResponse.json({ error: 'You are not authorized to update this product.' }, { status: 403 });
        // }

        const updateData = {};

        if (title !== undefined && title !== existingProduct.title) updateData.title = title.trim();
        if (description !== undefined && description !== existingProduct.description) updateData.description = description.trim();

        if (price !== undefined) {
            const parsedPrice = parseFloat(price);
            if (isNaN(parsedPrice) || parsedPrice < 0) {
                return NextResponse.json({ error: 'Price must be a valid non-negative number.' }, { status: 400 });
            }
            if (parsedPrice !== existingProduct.price) updateData.price = parsedPrice;
        }
        if (currency !== undefined && currency !== existingProduct.currency) updateData.currency = currency;
        if (images !== undefined) updateData.images = Array.isArray(images) ? images : []; // Ensure it's an array

        if (stockQuantity !== undefined) {
            const parsedStock = stockQuantity === null ? null : parseInt(stockQuantity);
            if (parsedStock !== null && (isNaN(parsedStock) || parsedStock < 0)) {
                return NextResponse.json({ error: 'Stock quantity must be a valid non-negative integer or null.' }, { status: 400 });
            }
            if (parsedStock !== existingProduct.stockQuantity) updateData.stockQuantity = parsedStock;
        }

        if (materials !== undefined) updateData.materials = Array.isArray(materials) ? materials : [];
        if (dimensions !== undefined && dimensions !== existingProduct.dimensions) updateData.dimensions = dimensions;
        if (sku !== undefined && sku !== existingProduct.sku) {
            if (sku) { // Check SKU uniqueness if new SKU is provided and different
                const skuOwner = await prisma.productListing.findUnique({ where: { sku } });
                if (skuOwner && skuOwner.id !== productId) {
                    return NextResponse.json({ error: 'This SKU is already in use by another product.' }, { status: 409 });
                }
            }
            updateData.sku = sku || null; // Allow unsetting SKU
        }
        if (shippingDetails !== undefined && shippingDetails !== existingProduct.shippingDetails) updateData.shippingDetails = shippingDetails;

        if (categoryId !== undefined && categoryId !== existingProduct.categoryId) {
            const categoryExists = await prisma.category.findUnique({ where: { id: categoryId } });
            if (!categoryExists) return NextResponse.json({ error: 'Invalid Category ID.' }, { status: 400 });
            if (categoryExists.type !== 'PRODUCT') return NextResponse.json({ error: 'Category type must be PRODUCT.' }, { status: 400 });
            updateData.categoryId = categoryId;
        }

        if (status !== undefined && status.toUpperCase() !== existingProduct.status) {
            const upperStatus = status.toUpperCase();
            if (!['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'REJECTED', 'ARCHIVED'].includes(upperStatus)) {
                return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 });
            }
            updateData.status = upperStatus;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ message: 'No changes provided.', product: existingProduct }, { status: 200 });
        }

        const updatedProduct = await prisma.productListing.update({
            where: { id: productId },
            data: updateData,
            include: { // Return the updated product with relations for consistency
                artisan: { select: { id: true, name: true } },
                category: { select: { id: true, name: true } }
            }
        });

        return NextResponse.json(updatedProduct);

    } catch (error) {
        console.error(`API ERROR in PUT /api/products/${productId}:`, error);
        console.error('Request Body Logged:', requestBodyText);
        // ... (Add detailed error logging similar to POST /api/products)
        if (error.code === 'P2002' && error.message.includes('sku')) return NextResponse.json({ error: 'This SKU is already in use.' }, { status: 409 });
        if (error.code === 'P2025') return NextResponse.json({ error: 'Product not found or related record (category/artisan) missing.' }, { status: 404 });
        if (error instanceof SyntaxError && error.message.includes("JSON")) return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
        return NextResponse.json({ error: 'Internal Server Error. Failed to update product. Check server logs.' }, { status: 500 });
    }
}


// DELETE - Delete a product by ID
export async function DELETE(request, { params }) {
    const { productId } = params;

    // --- CRITICAL: Authentication and Authorization ---
    // 1. Get authenticated user ID from token.
    // 2. Verify user is an ARTISAN or ADMIN.
    // 3. If ARTISAN, fetch the product to ensure they own it before deleting.
    // const authResult = await checkOwnershipOrAdmin(request, 'productListing', productId);
    // if (!authResult.authorized) {
    //   return NextResponse.json({ error: authResult.error || 'Unauthorized to delete this product.' }, { status: authResult.status || 403 });
    // }
    // For now, this check is a placeholder.

    try {
        if (!prisma || !prisma.productListing) {
            console.error("Prisma client or prisma.productListing is undefined in DELETE /api/products/[productId]");
            throw new Error("Database client is not available.");
        }
        if (!productId) {
            return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });
        }

        // Optional: Check if product exists before attempting delete to provide a 404 if not found.
        const existingProduct = await prisma.productListing.findUnique({ where: { id: productId } });
        if (!existingProduct) {
            return NextResponse.json({ error: 'Product not found to delete.' }, { status: 404 });
        }

        // --- Authorization Check (Example - replace with your actual logic) ---
        // const authenticatedArtisanId = "get-this-from-token"; // Replace this
        // if (existingProduct.artisanId !== authenticatedArtisanId /* && !isAdmin(authenticatedArtisanId) */) {
        //     return NextResponse.json({ error: 'You are not authorized to delete this product.' }, { status: 403 });
        // }


        // TODO: Consider implications of deleting a product:
        // - What happens to existing orders containing this product? (Soft delete product? Prevent deletion?)
        // - Are there related reviews or other data that need handling?
        // For now, direct hard delete.

        await prisma.productListing.delete({
            where: { id: productId },
        });

        return NextResponse.json({ message: 'Product deleted successfully.' }, { status: 200 });
        // Alternatively, return 204 No Content (NextResponse.next({ status: 204 }) might be tricky with some clients)

    } catch (error) {
        console.error(`API ERROR in DELETE /api/products/${productId}:`, error);
        // ... (Add detailed error logging)
        if (error.code === 'P2025') { // Record to delete not found
            return NextResponse.json({ error: 'Product not found to delete.' }, { status: 404 });
        }
        // P2003: Foreign key constraint fails (e.g., if order items link to this product and onDelete is Restrict)
        if (error.code === 'P2003') {
            return NextResponse.json({ error: 'Cannot delete product. It is still referenced by other items (e.g., orders).' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error. Failed to delete product. Check server logs.' }, { status: 500 });
    }
}