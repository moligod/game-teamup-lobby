const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { createRequestAbortScope, registerMarketRoutes } = require('../src/modules/market/market-routes');
const { createMarketService } = require('../src/modules/market/market-service');
const { ExpiringStore } = require('../src/platform/expiring-store');

function createService(repositoryOverrides = {}, options = {}) {
    const repository = {
        listPublicListings: async () => [],
        countPublicListings: async () => ({ total: 0 }),
        listPublicListingsPage: async () => [],
        countAdminListings: async () => ({ total: 0 }),
        listAdminListings: async () => [],
        setListingPinned: async (id, isPinned) => ({ id, is_pinned: isPinned }),
        deleteAdminListing: async (id) => ({ id }),
        listSellerListings: async () => [],
        createListing: async (input) => ({ id: 1, ...input }),
        updateSellerListing: async (id, sellerId, input) => ({ id, seller_id: sellerId, ...input }),
        findActiveListingForConversation: async (id) => ({ id, seller_id: 9, title: 'Flux in stock' }),
        getOrCreateConversation: async (listingId, buyerId) => ({ id: 16, listing_id: listingId, buyer_id: buyerId, seller_id: 9 }),
        getConversationForUser: async (conversationId, userId) => ({ id: conversationId, listing_id: 2, buyer_id: userId, seller_id: 9 }),
        getConversationForBuyer: async (conversationId, buyerId) => ({ id: conversationId, buyer_id: buyerId, seller_id: 9 }),
        listConversationsForUser: async () => [],
        listConversationMessages: async () => [],
        createConversationMessage: async (conversationId, senderId, body) => ({ id: 20, conversation_id: conversationId, sender_id: senderId, body }),
        listSellerReviews: async () => [],
        createOrUpdateReview: async (input) => ({ id: 1, ...input }),
        countPublicDishonestyReports: async () => ({ total: 0 }),
        listPublicDishonestyReports: async () => [],
        createDishonestyReport: async (input) => ({ id: 1, ...input, status: 'pending' }),
        countAdminDishonestyReports: async () => ({ total: 0 }),
        listAdminDishonestyReports: async () => [],
        reviewDishonestyReport: async (id, status, reviewerId) => ({ id, status, reviewer_id: reviewerId }),
        ...repositoryOverrides
    };
    const events = [];
    const broadcaster = {
        sendMarketConversationUpdate: (userId, payload) => events.push({ type: 'update', userId, payload }),
        sendMarketConversationMessage: (userId, payload) => events.push({ type: 'message', userId, payload })
    };
    const mediaStorage = {
        uploadFiles: async (files) => files.map((file, index) => ({ id: index + 1, url: `https://images.example/${file.originalname}` }))
    };
    const playerProfile = options.playerProfile || (async (playerName) => ({ player: { display_name: playerName } }));
    return {
        service: createMarketService({
            repository,
            broadcaster,
            mediaStorage: options.mediaStorage || mediaStorage,
            playerProfile,
            publicListingsCache: options.publicListingsCache,
            publicListingsCacheTtlMs: options.publicListingsCacheTtlMs
        }),
        repository,
        events
    };
}

function publicListingsRoute(service) {
    const routes = new Map();
    const app = {};
    for (const method of ['get', 'post', 'put', 'delete']) {
        app[method] = (path, ...handlers) => routes.set(`${method.toUpperCase()} ${path}`, handlers.at(-1));
    }
    registerMarketRoutes(app, service, {
        requireAdmin: (_req, _res, next) => next(),
        requireUser: (_req, _res, next) => next(),
        upload: { array: () => (_req, _res, next) => next() }
    });
    return routes.get('GET /api/market/listings');
}

test('public listing route keeps no-query clients on the legacy array contract', async () => {
    let legacyCalls = 0;
    let pageArguments;
    const handler = publicListingsRoute({
        listPublicListings: async () => {
            legacyCalls += 1;
            return [{ id: 1 }];
        },
        listPublicListingsPage: async (...args) => {
            pageArguments = args;
            return { items: [], total: 0, page: 2, page_size: 10 };
        }
    });
    const response = { json(value) { this.body = value; return this; } };

    await handler({ query: {} }, response);
    assert.deepEqual(response.body, [{ id: 1 }]);
    assert.equal(legacyCalls, 1);
    assert.equal(pageArguments, undefined);

    await handler({ query: { category: 'items', query: 'ring', page: '2', limit: '10' } }, response);
    assert.deepEqual(pageArguments, ['items', 'ring', '2', '10']);
    assert.deepEqual(response.body, { items: [], total: 0, page: 2, page_size: 10 });
});

test('public listings preserve the legacy array and provide bounded filtered pages', async () => {
    let countStarted = false;
    let pageStarted = false;
    let received;
    const legacy = [{ id: 1, title: 'Legacy listing' }];
    const { service } = createService({
        listPublicListings: async () => legacy,
        countPublicListings: async (category, query) => {
            countStarted = true;
            received = { ...received, category, query };
            await Promise.resolve();
            assert.equal(pageStarted, true);
            return { total: 61 };
        },
        listPublicListingsPage: async (category, query, pageSize, offset) => {
            pageStarted = true;
            received = { ...received, category, query, pageSize, offset };
            await Promise.resolve();
            assert.equal(countStarted, true);
            return [{ id: 2, title: 'Paged listing' }];
        }
    });

    assert.equal(await service.listPublicListings(), legacy);
    const result = await service.listPublicListingsPage('flux', '  SellerA  ', '2', '999');
    assert.deepEqual(received, { category: 'flux', query: 'sellera', pageSize: 50, offset: 50 });
    assert.deepEqual(result, {
        items: [{ id: 2, title: 'Paged listing' }],
        total: 61,
        page: 2,
        page_size: 50
    });
});

test('public listing page validates category and bounded search input', () => {
    const { service } = createService();
    assert.throws(() => service.listPublicListingsPage('official', '', 1, 10), /category is invalid/);
    assert.throws(() => service.listPublicListingsPage('flux', 'x'.repeat(121), 1, 10), /query is too long/);
});

test('public listing cache coalesces same-key legacy and page loads', async () => {
    let legacyLoads = 0;
    let countLoads = 0;
    let pageLoads = 0;
    const { service } = createService({
        listPublicListings: async () => {
            legacyLoads += 1;
            return [{ id: 1 }];
        },
        countPublicListings: async () => {
            countLoads += 1;
            return { total: 1 };
        },
        listPublicListingsPage: async () => {
            pageLoads += 1;
            return [{ id: 1 }];
        }
    }, { publicListingsCache: new ExpiringStore({ maxEntries: 8 }) });

    await Promise.all([service.listPublicListings(), service.listPublicListings()]);
    await Promise.all([
        service.listPublicListingsPage('flux', '', 1, 10),
        service.listPublicListingsPage('flux', '', 1, 10)
    ]);
    await service.listPublicListingsPage('flux', '', 1, 10);

    assert.equal(legacyLoads, 1);
    assert.equal(countLoads, 1);
    assert.equal(pageLoads, 1);
});

test('successful listing and review writes invalidate public listing cache', async () => {
    let clearCount = 0;
    const cache = {
        getOrLoad: (_key, loader) => loader(),
        clear: () => { clearCount += 1; }
    };
    const { service } = createService({}, { publicListingsCache: cache });
    const input = { category: 'flux', title: 'Flux', price: 1 };

    await service.createListing(input, 2);
    await service.updateSellerListing(1, input, 2);
    await service.setListingPinned(1, true);
    await service.deleteAdminListing(1);
    await service.createReview({ conversation_id: 16, rating: 5, comment: 'Good', image_urls: [] }, 5);

    assert.equal(clearCount, 5);
});

test('administrators can query user listings with bounded pagination', async () => {
    let received;
    const { service } = createService({
        countAdminListings: async (query) => {
            received = { ...received, query };
            return { total: 43 };
        },
        listAdminListings: async (query, pageSize, offset) => {
            received = { ...received, query, pageSize, offset };
            return [{ id: 4, title: 'Flux in stock' }];
        }
    });

    const result = await service.listAdminListings('  SellerA  ', '2', '20');
    assert.deepEqual(received, { query: 'sellera', pageSize: 20, offset: 20 });
    assert.deepEqual(result, { items: [{ id: 4, title: 'Flux in stock' }], total: 43, page: 2, page_size: 20 });
});

test('administrators can pin an existing user listing only with a boolean state', async () => {
    const { service } = createService();
    const listing = await service.setListingPinned('12', true);
    assert.deepEqual(listing, { id: 12, is_pinned: true });
    assert.throws(() => service.setListingPinned('12', 'true'), /is_pinned must be a boolean/);
});

test('administrators can delete an existing listing with a validated id', async () => {
    let receivedId = null;
    const { service } = createService({
        deleteAdminListing: async (id) => {
            receivedId = id;
            return { id };
        }
    });

    assert.deepEqual(await service.deleteAdminListing('12'), { id: 12 });
    assert.equal(receivedId, 12);
    assert.throws(() => service.deleteAdminListing('0'), /listing_id is invalid/);

    const missing = createService({ deleteAdminListing: async () => undefined });
    await assert.rejects(() => missing.service.deleteAdminListing(12), {
        message: 'Market listing not found',
        statusCode: 404
    });
});

test('personal listings derive the seller from the authenticated session', async () => {
    let received;
    const { service } = createService({
        createListing: async (input) => {
            received = input;
            return { id: 8, ...input };
        }
    });

    const listing = await service.createListing({
        category: 'flux',
        title: ' Flux in stock ',
        description: ' Fast in-game trade ',
        price: '3.8',
        price_unit: '1M Flux',
        stock: '50M',
        delivery_method: 'Trade in hub'
    }, '19');

    assert.equal(listing.id, 8);
    assert.deepEqual(received, {
        seller_id: 19,
        category: 'flux',
        title: 'Flux in stock',
        description: 'Fast in-game trade',
        price: 3.8,
        price_unit: '1M Flux',
        stock: '50M',
        player_name: '',
        delivery_method: 'Trade in hub',
        is_active: true
    });
});

test('personal listing updates reject invalid categories and foreign listings', async () => {
    const { service } = createService({ updateSellerListing: async () => undefined });
    assert.throws(
        () => service.createListing({ category: 'official', title: 'Not allowed', price: 1 }, 2),
        /category is invalid/
    );
    await assert.rejects(
        () => service.updateSellerListing(3, { category: 'flux', title: 'Flux', price: 1 }, 2),
        { message: 'Market listing not found', statusCode: 404 }
    );
});

test('item listings validate units and accounts accept unverified game names', async () => {
    let received;
    const { service } = createService({
        createListing: async (input) => {
            received = input;
            return { id: 8, ...input };
        }
    });

    await service.createListing({
        category: 'items',
        title: 'Crystal Ring',
        price: 12.5,
        price_unit: '万',
        stock: '0012'
    }, 19);
    assert.equal(received.price_unit, '万');
    assert.equal(received.stock, '0012');

    assert.throws(
        () => service.createListing({ category: 'items', title: 'Crystal Ring', price: 12.5, price_unit: 'each', stock: '12' }, 19),
        /price_unit must be one of/
    );
    assert.throws(
        () => service.createListing({ category: 'items', title: 'Crystal Ring', price: 12.5, price_unit: '个', stock: '12 pieces' }, 19),
        /stock must contain only digits/
    );

    await service.createListing({ category: 'accounts', title: 'Account', price: 99, player_name: 'AccountHero' }, 19);
    assert.equal(received.stock, '');
    assert.equal(received.player_name, 'AccountHero');

    const independent = createService({ createListing: async (input) => input }, {
        playerProfile: async () => { throw new Error('must not be called'); }
    });
    const result = await independent.service.createListing({ category: 'accounts', title: 'Account', price: 99, player_name: 'AnyGamePlayer' }, 19);
    assert.equal(result.player_name, 'AnyGamePlayer');

});

test('market conversations derive buyer identity and notify only both participants', async () => {
    let received;
    const { service, events } = createService({
        getOrCreateConversation: async (listingId, buyerId) => {
            received = { listingId, buyerId };
            return { id: 16, listing_id: listingId, buyer_id: buyerId, seller_id: 9 };
        }
    });

    const conversation = await service.openConversation('2', '5');
    assert.equal(conversation.id, 16);
    assert.deepEqual(received, { listingId: 2, buyerId: 5 });
    assert.deepEqual(events.map((event) => event.userId), [5, 9]);
});

test('market conversations reject opening a listing owned by the buyer', async () => {
    const { service } = createService({ findActiveListingForConversation: async () => ({ id: 2, seller_id: 5 }) });
    await assert.rejects(() => service.openConversation(2, 5), /own listing/);
});

test('market messages are stored and pushed to the buyer and seller', async () => {
    const { service, events } = createService({
        getConversationForUser: async () => ({ id: 16, buyer_id: 5, seller_id: 9 })
    });

    const message = await service.sendConversationMessage(16, '  Meet in hub  ', 5);
    assert.equal(message.body, 'Meet in hub');
    assert.deepEqual(events.map((event) => event.userId), [5, 9]);
});

test('only conversation buyers can submit bounded reviews with image URLs', async () => {
    let received;
    const { service } = createService({
        createOrUpdateReview: async (input) => {
            received = input;
            return { id: 7, ...input };
        }
    });

    await service.createReview({
        conversation_id: 16,
        rating: 4,
        comment: '  Fast delivery  ',
        image_urls: ['https://images.example/proof.png']
    }, 5);
    assert.deepEqual(received, {
        conversation_id: 16,
        buyer_id: 5,
        seller_id: 9,
        rating: 4,
        comment: 'Fast delivery',
        image_urls: ['https://images.example/proof.png']
    });

    await assert.rejects(
        () => service.createReview({ conversation_id: 16, rating: 4, comment: 'fine', image_urls: ['not-a-url'] }, 5),
        /image_url must be/
    );

    await assert.rejects(
        () => service.createReview({ conversation_id: 16, rating: 6, comment: 'fine', image_urls: [] }, 5),
        /rating is invalid/
    );
});

test('users can submit a bounded dishonesty report with an identifier and evidence', async () => {
    let received;
    const { service } = createService({
        createDishonestyReport: async (input) => {
            received = input;
            return { id: 3, ...input, status: 'pending' };
        }
    });

    const report = await service.createDishonestyReport({
        dishonest_qq: ' 123456 ',
        dishonest_player_name: ' Player One ',
        reason: '  Did not deliver after payment. ',
        evidence_urls: ['https://images.example/proof.png']
    }, 5);

    assert.equal(report.status, 'pending');
    assert.deepEqual(received, {
        reporter_id: 5,
        dishonest_qq: '123456',
        dishonest_player_name: 'Player One',
        reason: 'Did not deliver after payment.',
        evidence_urls: ['https://images.example/proof.png']
    });
    assert.throws(
        () => service.createDishonestyReport({ reason: 'missing identifier', evidence_urls: ['https://images.example/proof.png'] }, 5),
        /dishonest_qq or dishonest_player_name is required/
    );
    assert.throws(
        () => service.createDishonestyReport({ dishonest_qq: '123456', reason: 'missing proof', evidence_urls: [] }, 5),
        /At least one evidence image is required/
    );
});

test('administrators can page and review pending dishonesty reports', async () => {
    let received;
    const { service } = createService({
        countAdminDishonestyReports: async (query, status) => {
            received = { query, status };
            return { total: 21 };
        },
        listAdminDishonestyReports: async (query, status, pageSize, offset) => {
            received = { ...received, query, status, pageSize, offset };
            return [{ id: 8 }];
        }
    });

    const result = await service.listAdminDishonestyReports(' Player ', 'pending', 2, 20);
    assert.deepEqual(received, { query: 'player', status: 'pending', pageSize: 20, offset: 20 });
    assert.deepEqual(result, { items: [{ id: 8 }], total: 21, page: 2, page_size: 20 });
    const reviewed = await service.reviewDishonestyReport(8, 'approved', 2);
    assert.deepEqual(reviewed, { id: 8, status: 'approved', reviewer_id: 2 });
});

test('image uploads receive the request cancellation signal', async () => {
    let receivedOptions;
    const { service } = createService({}, {
        mediaStorage: {
            async uploadFiles(files, options) {
                receivedOptions = options;
                return files.map((file) => ({ url: `https://images.example/${file.originalname}` }));
            }
        }
    });
    const controller = new AbortController();

    await service.uploadReviewImages([{ originalname: 'proof.png' }], { signal: controller.signal });

    assert.equal(receivedOptions.purpose, 'market-reviews');
    assert.equal(receivedOptions.signal, controller.signal);
});

test('upload request scope aborts remote work when the client disconnects', () => {
    const request = new EventEmitter();
    const response = new EventEmitter();
    response.writableEnded = false;
    const scope = createRequestAbortScope(request, response);

    response.emit('close');

    assert.equal(scope.signal.aborted, true);
    scope.dispose();
});
