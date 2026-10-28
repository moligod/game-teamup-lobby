function sendError(res, error, fallback, fallbackStatus = 500) {
    return res.status(error.statusCode || fallbackStatus).json({ error: error.message || fallback });
}

function createRequestAbortScope(req, res) {
    const controller = new AbortController();
    const abort = () => controller.abort(new Error('Client disconnected'));
    const abortOnClose = () => {
        if (!res.writableEnded) abort();
    };
    req.once('aborted', abort);
    res.once('close', abortOnClose);
    return {
        signal: controller.signal,
        dispose() {
            req.removeListener('aborted', abort);
            res.removeListener('close', abortOnClose);
        }
    };
}

function registerMarketRoutes(app, service, { requireAdmin, requireUser, upload, logger = console }) {
    app.get('/api/market/listings', async (req, res) => {
        try {
            if (Object.keys(req.query).length === 0) {
                res.json(await service.listPublicListings());
                return;
            }
            res.json(await service.listPublicListingsPage(
                req.query.category,
                req.query.query,
                req.query.page,
                req.query.limit
            ));
        }
        catch (error) {
            logger.error('Failed to list market listings:', error);
            sendError(res, error, 'Failed to list market listings');
        }
    });

    app.get('/api/market/dishonesty-reports', async (req, res) => {
        try { res.json(await service.listPublicDishonestyReports(req.query.query, req.query.page, req.query.limit)); }
        catch (error) {
            logger.error('Failed to list dishonesty reports:', error);
            sendError(res, error, 'Failed to list dishonesty reports');
        }
    });

    app.post('/api/market/dishonesty-reports', requireUser, async (req, res) => {
        if (!Number.isInteger(req.user?.userId)) return res.status(401).json({ error: 'Login required' });
        try { res.status(201).json(await service.createDishonestyReport(req.body, req.user.userId)); }
        catch (error) {
            logger.error('Failed to create dishonesty report:', error);
            sendError(res, error, 'Failed to create dishonesty report', 400);
        }
    });

    app.post('/api/market/uploads/dishonesty-evidence', requireUser, upload.array('files', 4), async (req, res) => {
        const request = createRequestAbortScope(req, res);
        try { res.status(201).json(await service.uploadDishonestyEvidence(req.files, { signal: request.signal })); }
        catch (error) {
            logger.error('Failed to upload dishonesty evidence:', error);
            if (!request.signal.aborted && !res.headersSent) {
                sendError(res, error, 'Failed to upload dishonesty evidence', 400);
            }
        }
        finally { request.dispose(); }
    });

    app.get('/api/market/listings/mine', requireUser, async (req, res) => {
        try { res.json(await service.listSellerListings(req.user.userId)); }
        catch (error) {
            logger.error('Failed to list seller market listings:', error);
            sendError(res, error, 'Failed to list seller market listings');
        }
    });

    app.post('/api/market/listings', requireUser, async (req, res) => {
        try { res.status(201).json(await service.createListing(req.body, req.user.userId)); }
        catch (error) {
            logger.error('Failed to create market listing:', error);
            sendError(res, error, 'Failed to create market listing', 400);
        }
    });

    app.put('/api/market/listings/:id', requireUser, async (req, res) => {
        try { res.json(await service.updateSellerListing(req.params.id, req.body, req.user.userId)); }
        catch (error) {
            logger.error('Failed to update market listing:', error);
            sendError(res, error, 'Failed to update market listing', 400);
        }
    });

    app.get('/api/market/conversations', requireUser, async (req, res) => {
        try { res.json(await service.listConversations(req.user.userId)); }
        catch (error) {
            logger.error('Failed to list market conversations:', error);
            sendError(res, error, 'Failed to list market conversations');
        }
    });

    app.post('/api/market/conversations', requireUser, async (req, res) => {
        try { res.status(201).json(await service.openConversation(req.body.listing_id, req.user.userId)); }
        catch (error) {
            logger.error('Failed to open market conversation:', error);
            sendError(res, error, 'Failed to open market conversation', 400);
        }
    });

    app.get('/api/market/conversations/:id/messages', requireUser, async (req, res) => {
        try { res.json(await service.listConversationMessages(req.params.id, req.user.userId, req.query.limit)); }
        catch (error) {
            logger.error('Failed to list market conversation messages:', error);
            sendError(res, error, 'Failed to list market conversation messages');
        }
    });

    app.post('/api/market/conversations/:id/messages', requireUser, async (req, res) => {
        try { res.status(201).json(await service.sendConversationMessage(req.params.id, req.body.body, req.user.userId)); }
        catch (error) {
            logger.error('Failed to send market conversation message:', error);
            sendError(res, error, 'Failed to send market conversation message', 400);
        }
    });

    app.get('/api/market/sellers/:sellerId/reviews', async (req, res) => {
        try { res.json(await service.listSellerReviews(req.params.sellerId, req.query.limit)); }
        catch (error) {
            logger.error('Failed to list seller reviews:', error);
            sendError(res, error, 'Failed to list seller reviews');
        }
    });

    app.post('/api/market/reviews', requireUser, async (req, res) => {
        try { res.status(201).json(await service.createReview(req.body, req.user.userId)); }
        catch (error) {
            logger.error('Failed to create market review:', error);
            sendError(res, error, 'Failed to create market review', 400);
        }
    });

    app.post('/api/market/uploads/review-images', requireUser, upload.array('files', 4), async (req, res) => {
        const request = createRequestAbortScope(req, res);
        try { res.status(201).json(await service.uploadReviewImages(req.files, { signal: request.signal })); }
        catch (error) {
            logger.error('Failed to upload market review images:', error);
            if (!request.signal.aborted && !res.headersSent) {
                sendError(res, error, 'Failed to upload market review images', 400);
            }
        }
        finally { request.dispose(); }
    });

    app.get('/api/admin/market/listings', requireAdmin, async (req, res) => {
        try { res.json(await service.listAdminListings(req.query.query, req.query.page, req.query.limit)); }
        catch (error) {
            logger.error('Failed to list market listings for administration:', error);
            sendError(res, error, 'Failed to list market listings');
        }
    });

    app.put('/api/admin/market/listings/:id/pin', requireAdmin, async (req, res) => {
        try { res.json(await service.setListingPinned(req.params.id, req.body.is_pinned)); }
        catch (error) {
            logger.error('Failed to update market listing pin:', error);
            sendError(res, error, 'Failed to update market listing pin', 400);
        }
    });

    app.delete('/api/admin/market/listings/:id', requireAdmin, async (req, res) => {
        try { res.json(await service.deleteAdminListing(req.params.id)); }
        catch (error) {
            logger.error('Failed to delete market listing:', error);
            sendError(res, error, 'Failed to delete market listing', 400);
        }
    });

    app.get('/api/admin/market/dishonesty-reports', requireAdmin, async (req, res) => {
        try { res.json(await service.listAdminDishonestyReports(req.query.query, req.query.status, req.query.page, req.query.limit)); }
        catch (error) {
            logger.error('Failed to list dishonesty reports for administration:', error);
            sendError(res, error, 'Failed to list dishonesty reports');
        }
    });

    app.put('/api/admin/market/dishonesty-reports/:id/review', requireAdmin, async (req, res) => {
        try { res.json(await service.reviewDishonestyReport(req.params.id, req.body.status, req.user.userId)); }
        catch (error) {
            logger.error('Failed to review dishonesty report:', error);
            sendError(res, error, 'Failed to review dishonesty report', 400);
        }
    });
}

module.exports = { registerMarketRoutes, createRequestAbortScope };
