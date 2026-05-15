const fs = require('fs');
const https = require('https');
const path = require('path');
const { AppError } = require('../errors/appError');

/**
 * TLS Manager - handles HTTPS server setup with optional mutual TLS (mTLS)
 * Validates client certificates if REQUIRE_CLIENT_CERT is true
 */
class TLSManager {
  constructor(config) {
    this.config = config;
    this.serverOptions = null;
  }

  /**
   * Initialize TLS options from environment or test certificates
   * Required: TLS_KEY_PATH, TLS_CERT_PATH
   * Optional: TLS_CA_PATH (for mTLS client verification)
   */
  init() {
    const { TLS_KEY_PATH, TLS_CERT_PATH, TLS_CA_PATH, REQUIRE_CLIENT_CERT } = this.config;

    // If TLS not configured, server will use HTTP (handled by caller)
    if (!TLS_KEY_PATH || !TLS_CERT_PATH) {
      console.log('TLS_KEY_PATH or TLS_CERT_PATH not set, server will use HTTP');
      return null;
    }

    // Verify certificate files exist
    if (!fs.existsSync(TLS_KEY_PATH)) {
      throw new Error(`TLS key file not found: ${TLS_KEY_PATH}`);
    }
    if (!fs.existsSync(TLS_CERT_PATH)) {
      throw new Error(`TLS certificate file not found: ${TLS_CERT_PATH}`);
    }

    this.serverOptions = {
      key: fs.readFileSync(TLS_KEY_PATH),
      cert: fs.readFileSync(TLS_CERT_PATH)
    };

    // Enable mutual TLS (mTLS) if configured
    if (REQUIRE_CLIENT_CERT) {
      if (!TLS_CA_PATH) {
        throw new Error('REQUIRE_CLIENT_CERT=true but TLS_CA_PATH not set');
      }
      if (!fs.existsSync(TLS_CA_PATH)) {
        throw new Error(`TLS CA file not found: ${TLS_CA_PATH}`);
      }

      this.serverOptions.ca = fs.readFileSync(TLS_CA_PATH);
      this.serverOptions.requestCert = true;
      this.serverOptions.rejectUnauthorized = true;
    }

    console.log('TLS initialized:', {
      tlsEnabled: true,
      mtlsEnabled: !!REQUIRE_CLIENT_CERT
    });

    return this.serverOptions;
  }

  /**
   * Create HTTPS server with TLS options
   */
  createServer(app) {
    if (!this.serverOptions) {
      throw new Error('TLS not initialized. Call init() first.');
    }
    return https.createServer(this.serverOptions, app);
  }

  /**
   * Middleware to verify client certificate (for mTLS endpoints)
   * Throws AppError if certificate validation fails
   */
  static mTLSMiddleware(req, res, next) {
    if (!req.client.authorized) {
      const error = req.socket.authorizationError;
      throw new AppError(
        401,
        'MTLS_VERIFICATION_FAILED',
        `Client certificate verification failed: ${error?.message || 'unknown error'}`
      );
    }

    // Attach certificate details for logging/auditing
    const cert = req.socket.getPeerCertificate();
    if (cert && cert.subject) {
      req.clientCert = {
        subject: cert.subject.CN || cert.subject,
        issuer: cert.issuer,
        validFrom: cert.valid_from,
        validTo: cert.valid_to
      };
    }

    next();
  }

  /**
   * Get server TLS options (if initialized)
   */
  getOptions() {
    return this.serverOptions;
  }

  /**
   * Check if TLS is enabled
   */
  isEnabled() {
    return this.serverOptions !== null;
  }
}

module.exports = TLSManager;
