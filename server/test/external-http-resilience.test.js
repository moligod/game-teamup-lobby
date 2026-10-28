const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {
    ImageHostClient
} = require('../src/infrastructure/uploads/image-host-client');
const {
    createUploadBulkhead
} = require('../src/infrastructure/uploads/image-host-upload');

function imageHostConfig() {
    return {
        base_url: 'https://images.example.test',
        api_key: 'image_test_key',
        review_folder_id: 'reviews'
    };
}

function fakeRequest() {
    return new EventEmitter();
}

function fakeResponse() {
    const response = new EventEmitter();
    response.statusCode = 200;
    response.payload = null;
    response.status = (statusCode) => {
        response.statusCode = statusCode;
        return response;
    };
    response.json = (payload) => {
        response.payload = payload;
        response.emit('finish');
        return response;
    };
    return response;
}

test('image host requests abort at the configured deadline', async () => {
    let requestSignal = null;
    const client = new ImageHostClient({
        getConfig: imageHostConfig,
        requestTimeoutMs: 10,
        fetchImpl: async (_url, options) => {
            requestSignal = options.signal;
            return new Promise(() => undefined);
        }
    });

    await assert.rejects(
        () => client.listFolders({ page: 1 }),
        (error) => error.code === 'ETIMEDOUT'
            && error.statusCode === 504
            && error.message === 'Image host request timed out after 10ms'
    );
    assert.equal(requestSignal.aborted, true);
});

test('image uploads keep the multipart contract and release Multer buffers', async () => {
    let request = null;
    const files = [
        { buffer: Buffer.from('first-image'), mimetype: 'image/png', originalname: 'first.png' },
        { buffer: Buffer.from('second-image'), mimetype: 'image/webp', originalname: 'second.webp' }
    ];
    const client = new ImageHostClient({
        getConfig: imageHostConfig,
        uploadTimeoutMs: 100,
        fetchImpl: async (url, options) => {
            request = { url: url.toString(), options };
            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({
                    success: true,
                    files: [
                        { id: 'one', url: 'https://images.example.test/one.png' },
                        { id: 'two', url: 'https://images.example.test/two.webp' }
                    ]
                })
            };
        }
    });

    const uploaded = await client.uploadFiles(files);

    assert.equal(new URL(request.url).pathname, '/api/v1/upload/');
    assert.equal(request.options.headers['X-API-Key'], 'image_test_key');
    assert.equal(request.options.body.getAll('files').length, 2);
    assert.equal(request.options.body.get('folder_id'), 'reviews');
    assert.equal(request.options.signal.aborted, false);
    assert.deepEqual(files.map((file) => file.buffer), [null, null]);
    assert.deepEqual(uploaded.map((file) => file.id), ['one', 'two']);
});

test('image upload timeout aborts the request after transferring buffer ownership', async () => {
    let requestSignal = null;
    const files = [{ buffer: Buffer.from('image'), mimetype: 'image/png', originalname: 'image.png' }];
    const client = new ImageHostClient({
        getConfig: imageHostConfig,
        uploadTimeoutMs: 10,
        fetchImpl: async (_url, options) => {
            requestSignal = options.signal;
            return new Promise(() => undefined);
        }
    });

    await assert.rejects(
        () => client.uploadFiles(files),
        (error) => error.code === 'ETIMEDOUT' && error.message === 'Image upload timed out after 10ms'
    );
    assert.equal(requestSignal.aborted, true);
    assert.equal(files[0].buffer, null);
});

test('upload bulkhead rejects excess work and releases capacity on every exit path', () => {
    const bulkhead = createUploadBulkhead(1);
    const successful = bulkhead.wrap((_req, _res, next) => next());
    const firstRequest = fakeRequest();
    const firstResponse = fakeResponse();
    let firstNextCalls = 0;

    successful(firstRequest, firstResponse, () => { firstNextCalls += 1; });
    assert.equal(firstNextCalls, 1);
    assert.equal(bulkhead.activeCount(), 1);

    const rejectedResponse = fakeResponse();
    successful(fakeRequest(), rejectedResponse, () => assert.fail('rejected upload must not continue'));
    assert.equal(rejectedResponse.statusCode, 503);
    assert.deepEqual(rejectedResponse.payload, { error: 'Image upload capacity is temporarily full' });

    firstResponse.emit('finish');
    assert.equal(bulkhead.activeCount(), 0);

    const parserError = new Error('multipart failed');
    const failing = bulkhead.wrap((_req, _res, next) => next(parserError));
    let forwardedError = null;
    failing(fakeRequest(), fakeResponse(), (error) => { forwardedError = error; });
    assert.equal(forwardedError, parserError);
    assert.equal(bulkhead.activeCount(), 0);

    const finalResponse = fakeResponse();
    successful(fakeRequest(), finalResponse, () => undefined);
    assert.equal(bulkhead.activeCount(), 1);
    finalResponse.emit('close');
    assert.equal(bulkhead.activeCount(), 0);
});
