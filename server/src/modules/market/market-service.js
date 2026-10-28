const { MarketError } = require('./market-error');

const MARKET_CATEGORIES = new Set(['flux', 'items', 'boosting', 'accounts', 'codes']);
const ITEM_PRICE_UNITS = new Set(['个', '千', '万']);

function optionalString(value, fieldName, maxLength, fallback = '') {
    const normalized = value === undefined || value === null ? fallback : String(value).trim();
    if (normalized.length > maxLength) throw new MarketError(`${fieldName} is too long`);
    return normalized;
}

function requiredString(value, fieldName, maxLength) {
    const normalized = optionalString(value, fieldName, maxLength);
    if (!normalized) throw new MarketError(`${fieldName} is required`);
    return normalized;
}

function priceValue(value) {
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0 || price > 999999999.99) {
        throw new MarketError('price must be between 0 and 999999999.99');
    }
    return Math.round(price * 100) / 100;
}

function positiveId(value, fieldName) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) throw new MarketError(`${fieldName} is invalid`);
    return parsed;
}

function categoryValue(value) {
    const category = requiredString(value, 'category', 16);
    if (!MARKET_CATEGORIES.has(category)) throw new MarketError('category is invalid');
    return category;
}

function itemPriceUnit(value) {
    const priceUnit = requiredString(value, 'price_unit', 4);
    if (!ITEM_PRICE_UNITS.has(priceUnit)) throw new MarketError('price_unit must be one of: 个, 千, 万');
    return priceUnit;
}

function itemStock(value) {
    const stock = requiredString(value, 'stock', 100);
    if (!/^\d+$/.test(stock)) throw new MarketError('stock must contain only digits');
    return stock;
}

function limit(value, fallback = 50, max = 100) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function page(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100000) : 1;
}

function reviewRating(value) {
    if (value === 'positive') return 5;
    if (value === 'negative' || value === -1 || value === '-1') return 1;
    const rating = Number(value);
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) return rating;
    throw new MarketError('rating is invalid');
}

function imageUrls(value) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.length > 4) throw new MarketError('image_urls must contain at most 4 images');
    const urls = value.map((item) => requiredString(item, 'image_url', 500));
    for (const item of urls) {
        try {
            const url = new URL(item);
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        } catch {
            throw new MarketError('image_url must be a valid http(s) URL');
        }
    }
    return Array.from(new Set(urls));
}

function dishonestReportStatus(value, allowAll = false) {
    const status = optionalString(value, 'status', 16, allowAll ? 'pending' : '');
    const allowed = allowAll ? new Set(['pending', 'approved', 'rejected', 'all']) : new Set(['approved', 'rejected']);
    if (!allowed.has(status)) throw new MarketError('status is invalid');
    return status;
}

function normalizeDishonestyReportInput(body) {
    const dishonestQq = optionalString(body.dishonest_qq, 'dishonest_qq', 32) || null;
    const dishonestPlayerName = optionalString(body.dishonest_player_name, 'dishonest_player_name', 80) || null;
    if (!dishonestQq && !dishonestPlayerName) {
        throw new MarketError('dishonest_qq or dishonest_player_name is required');
    }
    const evidenceUrls = imageUrls(body.evidence_urls);
    if (evidenceUrls.length === 0) throw new MarketError('At least one evidence image is required');
    return {
        dishonest_qq: dishonestQq,
        dishonest_player_name: dishonestPlayerName,
        reason: requiredString(body.reason, 'reason', 1000),
        evidence_urls: evidenceUrls
    };
}

function normalizeListingInput(body) {
    const category = categoryValue(body.category);
    return {
        category,
        title: requiredString(body.title, 'title', 120),
        description: optionalString(body.description, 'description', 1000),
        price: priceValue(body.price),
        price_unit: category === 'items' ? itemPriceUnit(body.price_unit) : requiredString(body.price_unit || 'each', 'price_unit', 60),
        stock: category === 'accounts' ? '' : category === 'items' ? itemStock(body.stock) : requiredString(body.stock || 'Available', 'stock', 100),
        player_name: category === 'accounts' ? requiredString(body.player_name, 'player_name', 128) : '',
        delivery_method: optionalString(body.delivery_method, 'delivery_method', 600),
        is_active: body.is_active !== false
    };
}

function listingOrNotFound(listing) {
    if (!listing) throw new MarketError('Market listing not found', 404);
    return listing;
}

function reportOrNotFound(report) {
    if (!report) throw new MarketError('Dishonesty report not found or already reviewed', 404);
    return report;
}

function conversationOrNotFound(conversation) {
    if (!conversation) throw new MarketError('Market conversation not found', 404);
    return conversation;
}

function createMarketService({
    repository,
    broadcaster = null,
    mediaStorage = null,
    playerProfile = null,
    publicListingsCache = null,
    publicListingsCacheTtlMs = 15000
}) {
    const publicCacheTtlMs = Math.min(Math.max(Number(publicListingsCacheTtlMs) || 15000, 1000), 60000);

    function loadPublicListings(key, loader) {
        if (typeof publicListingsCache?.getOrLoad !== 'function') return loader();
        return publicListingsCache.getOrLoad(key, loader, publicCacheTtlMs);
    }

    function invalidatePublicListings(value) {
        publicListingsCache?.clear?.();
        return value;
    }

    function notifyConversationUpdate(conversation) {
        if (!broadcaster) return;
        const payload = { type: 'market_conversation_update', conversation_id: conversation.id };
        broadcaster.sendMarketConversationUpdate(conversation.buyer_id, payload);
        broadcaster.sendMarketConversationUpdate(conversation.seller_id, payload);
    }

    return {
        listPublicListings() {
            return loadPublicListings('public-market-listings:legacy', () => repository.listPublicListings());
        },

        listPublicListingsPage(categoryValueInput, queryValue, requestedPage, requestedLimit) {
            const category = categoryValue(categoryValueInput);
            const query = optionalString(queryValue, 'query', 120).toLowerCase();
            const currentPage = page(requestedPage);
            const pageSize = limit(requestedLimit, 10, 50);
            const offset = (currentPage - 1) * pageSize;
            const cacheKey = `public-market-listings:page:${JSON.stringify([category, query, currentPage, pageSize])}`;

            return loadPublicListings(cacheKey, async () => {
                const [totalRow, items] = await Promise.all([
                    repository.countPublicListings(category, query),
                    repository.listPublicListingsPage(category, query, pageSize, offset)
                ]);
                return {
                    items,
                    total: Number(totalRow?.total ?? 0),
                    page: currentPage,
                    page_size: pageSize
                };
            });
        },

        async listPublicDishonestyReports(queryValue, requestedPage, requestedLimit) {
            const query = optionalString(queryValue, 'query', 120).toLowerCase();
            const currentPage = page(requestedPage);
            const pageSize = limit(requestedLimit, 10, 50);
            const totalRow = await repository.countPublicDishonestyReports(query);
            const total = Number(totalRow?.total ?? 0);
            const items = await repository.listPublicDishonestyReports(query, pageSize, (currentPage - 1) * pageSize);
            return { items, total, page: currentPage, page_size: pageSize };
        },

        createDishonestyReport(body, reporterIdValue) {
            return repository.createDishonestyReport({
                ...normalizeDishonestyReportInput(body),
                reporter_id: positiveId(reporterIdValue, 'reporter_id')
            });
        },

        async uploadDishonestyEvidence(files, options = {}) {
            if (!mediaStorage) throw new MarketError('Image storage is unavailable', 503);
            if (!Array.isArray(files) || files.length === 0) throw new MarketError('At least one evidence image is required');
            return mediaStorage.uploadFiles(files, { purpose: 'dishonesty-evidence', signal: options.signal });
        },

        async listAdminDishonestyReports(queryValue, statusValue, requestedPage, requestedLimit) {
            const query = optionalString(queryValue, 'query', 120).toLowerCase();
            const status = dishonestReportStatus(statusValue, true);
            const currentPage = page(requestedPage);
            const pageSize = limit(requestedLimit, 20, 100);
            const totalRow = await repository.countAdminDishonestyReports(query, status);
            const total = Number(totalRow?.total ?? 0);
            const items = await repository.listAdminDishonestyReports(query, status, pageSize, (currentPage - 1) * pageSize);
            return { items, total, page: currentPage, page_size: pageSize };
        },

        reviewDishonestyReport(idValue, statusValue, reviewerIdValue) {
            return repository.reviewDishonestyReport(
                positiveId(idValue, 'report_id'),
                dishonestReportStatus(statusValue),
                positiveId(reviewerIdValue, 'reviewer_id')
            ).then(reportOrNotFound);
        },

        async listAdminListings(queryValue, requestedPage, requestedLimit) {
            const query = optionalString(queryValue, 'query', 120).toLowerCase();
            const currentPage = page(requestedPage);
            const pageSize = limit(requestedLimit, 20, 100);
            const totalRow = await repository.countAdminListings(query);
            const total = Number(totalRow?.total ?? 0);
            const items = await repository.listAdminListings(query, pageSize, (currentPage - 1) * pageSize);
            return { items, total, page: currentPage, page_size: pageSize };
        },

        setListingPinned(idValue, isPinned) {
            const id = positiveId(idValue, 'listing_id');
            if (typeof isPinned !== 'boolean') throw new MarketError('is_pinned must be a boolean');
            return repository.setListingPinned(id, isPinned)
                .then(listingOrNotFound)
                .then(invalidatePublicListings);
        },

        deleteAdminListing(idValue) {
            return repository.deleteAdminListing(positiveId(idValue, 'listing_id'))
                .then(listingOrNotFound)
                .then(invalidatePublicListings);
        },

        listSellerListings(sellerIdValue) {
            return repository.listSellerListings(positiveId(sellerIdValue, 'seller_id'));
        },

        createListing(body, sellerIdValue) {
            const input = normalizeListingInput(body);
            const sellerId = positiveId(sellerIdValue, 'seller_id');
            return Promise.resolve(input)
                .then((listing) => repository.createListing({ ...listing, seller_id: sellerId }))
                .then(invalidatePublicListings);
        },

        updateSellerListing(idValue, body, sellerIdValue) {
            const id = positiveId(idValue, 'listing_id');
            const sellerId = positiveId(sellerIdValue, 'seller_id');
            const input = normalizeListingInput(body);
            return Promise.resolve(input)
                .then((listing) => repository.updateSellerListing(id, sellerId, listing))
                .then(listingOrNotFound)
                .then(invalidatePublicListings);
        },

        async listConversations(userIdValue) {
            return repository.listConversationsForUser(positiveId(userIdValue, 'user_id'));
        },

        async openConversation(listingIdValue, buyerIdValue) {
            const listingId = positiveId(listingIdValue, 'listing_id');
            const buyerId = positiveId(buyerIdValue, 'buyer_id');
            const listing = await repository.findActiveListingForConversation(listingId);
            if (!listing) throw new MarketError('Market listing not found', 404);
            if (listing.seller_id === buyerId) throw new MarketError('You cannot open a conversation for your own listing');
            const conversation = await repository.getOrCreateConversation(listingId, buyerId);
            notifyConversationUpdate(conversation);
            return repository.getConversationForUser(conversation.id, buyerId).then(conversationOrNotFound);
        },

        async listConversationMessages(conversationIdValue, userIdValue, requestedLimit) {
            const conversationId = positiveId(conversationIdValue, 'conversation_id');
            const userId = positiveId(userIdValue, 'user_id');
            await repository.getConversationForUser(conversationId, userId).then(conversationOrNotFound);
            return repository.listConversationMessages(conversationId, limit(requestedLimit));
        },

        async sendConversationMessage(conversationIdValue, body, senderIdValue) {
            const conversationId = positiveId(conversationIdValue, 'conversation_id');
            const senderId = positiveId(senderIdValue, 'sender_id');
            const conversation = await repository.getConversationForUser(conversationId, senderId).then(conversationOrNotFound);
            const message = await repository.createConversationMessage(
                conversationId,
                senderId,
                requiredString(body, 'body', 2000)
            );
            if (broadcaster) {
                const payload = { conversation_id: conversationId, message };
                broadcaster.sendMarketConversationMessage(conversation.buyer_id, payload);
                broadcaster.sendMarketConversationMessage(conversation.seller_id, payload);
            }
            return message;
        },

        listSellerReviews(sellerIdValue, requestedLimit) {
            return repository.listSellerReviews(positiveId(sellerIdValue, 'seller_id'), limit(requestedLimit, 30, 100));
        },

        async createReview(body, buyerIdValue) {
            const buyerId = positiveId(buyerIdValue, 'buyer_id');
            const conversationId = positiveId(body.conversation_id, 'conversation_id');
            const conversation = await repository.getConversationForBuyer(conversationId, buyerId);
            if (!conversation) throw new MarketError('Only the buyer in this conversation can leave a review', 403);
            const review = await repository.createOrUpdateReview({
                conversation_id: conversationId,
                buyer_id: buyerId,
                seller_id: conversation.seller_id,
                rating: reviewRating(body.rating),
                comment: requiredString(body.comment, 'comment', 1000),
                image_urls: imageUrls(body.image_urls)
            });
            return invalidatePublicListings(review);
        },

        async uploadReviewImages(files, options = {}) {
            if (!mediaStorage) throw new MarketError('Image storage is unavailable', 503);
            if (!Array.isArray(files) || files.length === 0) throw new MarketError('At least one image is required');
            return mediaStorage.uploadFiles(files, { purpose: 'market-reviews', signal: options.signal });
        }
    };
}

module.exports = { createMarketService };
