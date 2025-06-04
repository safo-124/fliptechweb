 // app/api/products/[productId]/route.js
 import prisma from '@/lib/prisma';
 import { NextResponse } from 'next/server';
 // import { getAuthenticatedUser, checkOwnershipOrAdmin } from '@/lib/auth'; // Your auth utilities

 // Helper function (can be shared)
 function generateSlug(name) {
     if (!name) return '';
     return name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
 }

 // GET - Fetch a single product by ID
 export async function GET(request, { params }) {
     const { productId } = params;
     // const authenticatedUser = await getAuthenticatedUser(request); // Get current user (if any)

     try {
         const product = await prisma.productListing.findUnique({
             where: { id: productId },
             include: {
                 artisan: { select: { id: true, name: true } },
                 category: { select: { id: true, name: true, slug: true } }
             }
         });

         if (!product) {
             return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
         }

         // For public view, only show active products.
         // Admins or owners might be able to see non-active products.
         // This needs robust auth check:
         // if (product.status !== 'ACTIVE' && (!authenticatedUser || (authenticatedUser.id !== product.artisanId && authenticatedUser.role !== 'ADMIN'))) {
         //   return NextResponse.json({ error: 'Product not available.' }, { status: 404 });
         // }
         // Simplified for now: Public only sees active
         if (product.status !== 'ACTIVE') {
             // TODO: Implement logic to allow admin/owner to see non-active products
             // For now, if not ACTIVE, treat as not found for public.
             return NextResponse.json({ error: 'Product not available.' }, { status: 404 });
         }


         return NextResponse.json(product);

     } catch (error) {
         console.error(`API ERROR in GET /api/products/${productId}:`, error);
         return NextResponse.json({ error: 'Internal Server Error. Failed to fetch product.' }, { status: 500 });
     }
 }

 // PUT - Update an existing product by ID (by owner or admin)
 export async function PUT(request, { params }) {
     const { productId } = params;
     // --- CRITICAL: Authentication and Authorization ---
     // const authResult = await checkOwnershipOrAdmin(request, 'productListing', productId);
     // if (!authResult.authorized) {
     //   return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 403 });
     // }
     // const { userId: performingUserId, role: performingUserRole } = authResult;

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
             categoryId
             // Note: 'status' is generally not updated here by artisans directly after it's ACTIVE/PENDING.
             // Status changes are primarily through the admin approval route or specific artisan actions (e.g., set to INACTIVE).
         } = body;

         const existingProduct = await prisma.productListing.findUnique({ where: { id: productId } });
         if (!existingProduct) {
             return NextResponse.json({ error: 'Product not found to update.' }, { status: 404 });
         }

         // --- Authorization Check ---
         // if (performingUserRole !== 'ADMIN' && existingProduct.artisanId !== performingUserId) {
         //    return NextResponse.json({ error: 'You are not authorized to update this product.' }, { status: 403 });
         // }

         const updateData = {};
         // ... (logic for populating updateData based on changes, as in previous version) ...
         // Example for title:
         if (title !== undefined && title !== existingProduct.title) updateData.title = title.trim();
         if (description !== undefined && description !== existingProduct.description) updateData.description = description.trim();
         if (price !== undefined) {
             const parsedPrice = parseFloat(price);
             if (isNaN(parsedPrice) || parsedPrice < 0) return NextResponse.json({ error: 'Price must be valid.' }, { status: 400 });
             if (parsedPrice !== existingProduct.price) updateData.price = parsedPrice;
         }
         if (currency !== undefined && currency !== existingProduct.currency) updateData.currency = currency;
         if (images !== undefined) updateData.images = Array.isArray(images) ? images : [];
         if (stockQuantity !== undefined) {
             const parsedStock = stockQuantity === null ? null : parseInt(stockQuantity);
             if (parsedStock !== null && (isNaN(parsedStock) || parsedStock < 0)) return NextResponse.json({ error: 'Stock must be valid.' }, { status: 400 });
             if (parsedStock !== existingProduct.stockQuantity) updateData.stockQuantity = parsedStock;
         }
         if (materials !== undefined) updateData.materials = Array.isArray(materials) ? materials : [];
         if (dimensions !== undefined && dimensions !== existingProduct.dimensions) updateData.dimensions = dimensions;
         if (sku !== undefined && sku !== existingProduct.sku) {
             if (sku) {
                 const skuOwner = await prisma.productListing.findFirst({ where: { sku, NOT: { id: productId } } });
                 if (skuOwner) return NextResponse.json({ error: 'This SKU is already in use.' }, { status: 409 });
             }
             updateData.sku = sku || null;
         }
         if (shippingDetails !== undefined && shippingDetails !== existingProduct.shippingDetails) updateData.shippingDetails = shippingDetails;
         if (categoryId !== undefined && categoryId !== existingProduct.categoryId) {
             const categoryExists = await prisma.category.findUnique({ where: { id: categoryId } });
             if (!categoryExists || categoryExists.type !== 'PRODUCT') return NextResponse.json({ error: 'Invalid or non-PRODUCT category.' }, { status: 400 });
             updateData.categoryId = categoryId;
         }
         // If an edit is made to an ACTIVE product, it might need re-approval or stay active based on your rules.
         // For now, edits don't change status from ACTIVE automatically.
         // If product was DRAFT and edited, artisan might want to submit it for approval.
         // If product was PENDING_APPROVAL, admin edit might keep it PENDING or move to DRAFT.
         // If product was REJECTED, edit by artisan might move it to DRAFT or PENDING_APPROVAL again.
         // This logic can be complex. For now, admin primarily controls ACTIVE/REJECTED via the status route.
         // An artisan editing their product that is DRAFT or REJECTED might resubmit it, changing status to PENDING_APPROVAL.

         if (Object.keys(updateData).length === 0) {
             return NextResponse.json({ message: 'No changes provided.', product: existingProduct }, { status: 200 });
         }

         // If product was ACTIVE, and significant changes are made, you might want to set status to PENDING_APPROVAL again.
         // This is a business rule. For now, we assume edits to an active product keep it active.
         // if (existingProduct.status === 'ACTIVE' && (updateData.title || updateData.description || updateData.price || updateData.images)) {
         //    updateData.status = 'PENDING_APPROVAL'; // Example: force re-approval on major edits
         // }


         const updatedProduct = await prisma.productListing.update({
             where: { id: productId },
             data: updateData,
             include: { artisan: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } }
         });
         return NextResponse.json(updatedProduct);

     } catch (error) {
         console.error(`API ERROR in PUT /api/products/${productId}:`, error);
         console.error('Request Body Logged:', requestBodyText);
         // ... (detailed error handling)
         if (error.code === 'P2002') return NextResponse.json({ error: 'Unique constraint failed (e.g. SKU).' }, { status: 409 });
         return NextResponse.json({ error: 'Internal Server Error. Failed to update product.' }, { status: 500 });
     }
 }

 // DELETE - Delete a product by ID (by owner or admin)
 export async function DELETE(request, { params }) {
     const { productId } = params;
     // --- CRITICAL: Authentication and Authorization ---
     // const authResult = await checkOwnershipOrAdmin(request, 'productListing', productId);
     // if (!authResult.authorized) {
     //   return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 403 });
     // }

     try {
         // Add authorization: check if user is owner or admin
         await prisma.productListing.delete({
             where: { id: productId },
         });
         return NextResponse.json({ message: 'Product deleted successfully.' }, { status: 200 });
     } catch (error) {
         console.error(`API ERROR in DELETE /api/products/${productId}:`, error);
         if (error.code === 'P2025') return NextResponse.json({ error: 'Product not found to delete.' }, { status: 404 });
         return NextResponse.json({ error: 'Internal Server Error. Failed to delete product.' }, { status: 500 });
     }
 }