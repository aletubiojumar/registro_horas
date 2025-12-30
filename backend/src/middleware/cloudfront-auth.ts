// src/middleware/cloudfront-auth.ts
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware que valida que todas las requests vengan de CloudFront
 * usando un header secreto compartido
 */
export function cloudfrontAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    // Health checks no requieren auth (para ALB health checks)
    if (req.path === '/health' || req.path === '/api/health') {
        return next();
    }

    const cloudfront_secret = process.env.CLOUDFRONT_SECRET;

    if (!cloudfront_secret) {
        console.error('⚠️ CLOUDFRONT_SECRET no configurado');
        return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const header_value = req.get('CloudFront-Secret');

    if (header_value !== cloudfront_secret) {
        console.warn('🚫 Acceso bloqueado - Header CloudFront inválido:', {
            ip: req.ip,
            path: req.path,
            hasHeader: !!header_value
        });

        return res.status(403).json({
            error: 'Forbidden',
            message: 'Access must be through CloudFront'
        });
    }

    // Header válido, continuar
    next();
}