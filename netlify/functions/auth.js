const { getSupabaseAnonClient, jsonResponse, handleCors } = require('./utils');

/**
 * Auth API (Admin login via Supabase Auth)
 *
 * POST /api/auth   body: { action: 'login', email, password }
 * POST /api/auth   body: { action: 'verify', token }
 * POST /api/auth   body: { action: 'logout' }
 */
exports.handler = async (event) => {
    const cors = handleCors(event);
    if (cors) return cors;

    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    try {
        const body = JSON.parse(event.body);
        const supabase = getSupabaseAnonClient();

        switch (body.action) {
            case 'login': {
                if (!body.email || !body.password) {
                    return jsonResponse(400, { error: 'Email and password required' });
                }

                const { data, error } = await supabase.auth.signInWithPassword({
                    email: body.email,
                    password: body.password
                });

                if (error) {
                    return jsonResponse(401, { error: 'Invalid credentials' });
                }

                return jsonResponse(200, {
                    success: true,
                    token: data.session.access_token,
                    user: {
                        id: data.user.id,
                        email: data.user.email
                    }
                });
            }

            case 'verify': {
                if (!body.token) {
                    return jsonResponse(400, { error: 'Token required' });
                }

                const { data: { user }, error } = await supabase.auth.getUser(body.token);

                if (error || !user) {
                    return jsonResponse(401, { error: 'Invalid or expired token' });
                }

                return jsonResponse(200, {
                    valid: true,
                    user: {
                        id: user.id,
                        email: user.email
                    }
                });
            }

            case 'logout': {
                return jsonResponse(200, { success: true });
            }

            default:
                return jsonResponse(400, { error: 'Invalid action. Use: login, verify, or logout' });
        }

    } catch (err) {
        console.error('Auth handler error:', err);
        return jsonResponse(500, { error: 'Internal server error' });
    }
};
