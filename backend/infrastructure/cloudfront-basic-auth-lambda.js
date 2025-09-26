// CloudFront Basic Auth Lambda@Edge (Node.js 14+)
// Setze USERNAME und PASSWORD unten!
exports.handler = async (event) => {
    const request = event.Records[0].cf.request;
    const headers = request.headers;
    const uri = request.uri;

    // --- HIER ANPASSEN ---
    const USERNAME = "hapkec";
    const PASSWORD = "HawXC7780!";
    // ---------------------

    // API-Pfade von Basic Auth ausnehmen
    const apiPaths = ['/jobs', '/list-videos', '/analyze', '/health', '/ask', '/job-status'];
    const isApiRequest = apiPaths.some(path => uri.startsWith(path));
    
    if (isApiRequest) {
        // API-Requests durchlassen ohne Basic Auth
        return request;
    }

    const authString = 'Basic ' + Buffer.from(USERNAME + ':' + PASSWORD).toString('base64');
    const authHeader = headers['authorization'] && headers['authorization'][0].value;

    if (authHeader === authString) {
        return request;
    }
    return {
        status: '401',
        statusDescription: 'Unauthorized',
        headers: {
            'www-authenticate': [{ key: 'WWW-Authenticate', value: 'Basic realm="Login Required"' }],
        },
        body: 'Authentication required',
    };
};
