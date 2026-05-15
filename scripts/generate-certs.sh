#!/bin/bash

# Generate self-signed TLS certificates for local development and testing
# Usage: ./scripts/generate-certs.sh
# Creates certs/server.* (server cert/key) and certs/client.* (client cert/key)

set -e

CERTS_DIR="./certs"
DAYS=365

echo "Generating TLS certificates for local development..."

# Create certs directory if it doesn't exist
mkdir -p "$CERTS_DIR"

# Generate server private key
echo "1. Generating server private key..."
openssl genrsa -out "$CERTS_DIR/server.key" 2048 2>/dev/null

# Generate server certificate signing request
echo "2. Generating server CSR..."
openssl req -new \
  -key "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.csr" \
  -subj "/CN=localhost/O=UPI-Without-Internet/C=IN" \
  2>/dev/null

# Generate self-signed server certificate
echo "3. Generating server certificate..."
openssl x509 -req -days $DAYS \
  -in "$CERTS_DIR/server.csr" \
  -signkey "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.crt" \
  2>/dev/null

# Generate client private key
echo "4. Generating client private key..."
openssl genrsa -out "$CERTS_DIR/client.key" 2048 2>/dev/null

# Generate client certificate signing request
echo "5. Generating client CSR..."
openssl req -new \
  -key "$CERTS_DIR/client.key" \
  -out "$CERTS_DIR/client.csr" \
  -subj "/CN=bridge-client/O=UPI-Without-Internet/C=IN" \
  2>/dev/null

# Generate self-signed client certificate
echo "6. Generating client certificate..."
openssl x509 -req -days $DAYS \
  -in "$CERTS_DIR/client.csr" \
  -signkey "$CERTS_DIR/client.key" \
  -out "$CERTS_DIR/client.crt" \
  2>/dev/null

# Create CA certificate (for mTLS validation, we use server cert as CA for self-signed setup)
echo "7. Creating CA certificate..."
cp "$CERTS_DIR/server.crt" "$CERTS_DIR/ca.crt"

# Clean up CSR files
rm -f "$CERTS_DIR/server.csr" "$CERTS_DIR/client.csr"

# Set restrictive permissions
chmod 600 "$CERTS_DIR/server.key" "$CERTS_DIR/client.key"
chmod 644 "$CERTS_DIR/server.crt" "$CERTS_DIR/client.crt" "$CERTS_DIR/ca.crt"

echo ""
echo "✓ Certificates generated successfully!"
echo ""
echo "Files created:"
echo "  Server key:     $CERTS_DIR/server.key"
echo "  Server cert:    $CERTS_DIR/server.crt"
echo "  Client key:     $CERTS_DIR/client.key"
echo "  Client cert:    $CERTS_DIR/client.crt"
echo "  CA cert:        $CERTS_DIR/ca.crt"
echo ""
echo "For development (TLS only, no mTLS):"
echo "  export TLS_KEY_PATH='$CERTS_DIR/server.key'"
echo "  export TLS_CERT_PATH='$CERTS_DIR/server.crt'"
echo "  npm start"
echo ""
echo "For testing with mTLS:"
echo "  export TLS_KEY_PATH='$CERTS_DIR/server.key'"
echo "  export TLS_CERT_PATH='$CERTS_DIR/server.crt'"
echo "  export TLS_CA_PATH='$CERTS_DIR/ca.crt'"
echo "  export REQUIRE_CLIENT_CERT=true"
echo "  npm start"
echo ""
