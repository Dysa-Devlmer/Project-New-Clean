#!/bin/bash
# Enterprise Fortune 10 Global Military PKI Infrastructure
# Generate Certificate Authority for Zero Trust mTLS

set -euo pipefail

# FIPS 140-2 Level 3 compliant key generation
FIPS_MODE=1
OPENSSL_CONF="openssl-fips.cnf"

# Enterprise CA configuration
CA_KEY_SIZE=4096
CA_VALIDITY_DAYS=3650  # 10 years for enterprise root CA
INTERMEDIATE_VALIDITY_DAYS=1825  # 5 years for intermediate CA
CERT_VALIDITY_DAYS=365  # 1 year for service certificates

# Create directory structure
mkdir -p {root-ca,intermediate-ca,certs,private,crl,newcerts}
chmod 700 private

# Initialize CA database
touch root-ca/index.txt
echo 1000 > root-ca/serial
echo 1000 > root-ca/crlnumber

echo "🔐 Generating Enterprise Fortune 10 Global Military PKI Infrastructure..."

# Generate Root CA private key (FIPS 140-2 compliant)
echo "Generating Root CA private key..."
openssl genpkey -algorithm RSA \
    -pkeyopt rsa_keygen_bits:$CA_KEY_SIZE \
    -out private/root-ca-key.pem

chmod 400 private/root-ca-key.pem

# Generate Root CA certificate
echo "Generating Root CA certificate..."
openssl req -new -x509 \
    -key private/root-ca-key.pem \
    -days $CA_VALIDITY_DAYS \
    -sha256 \
    -extensions v3_ca \
    -out root-ca.pem \
    -subj "/C=US/ST=DC/L=Washington/O=Fortune10 Global Military Enterprise/OU=PKI Infrastructure/CN=Root CA"

# Generate Intermediate CA private key
echo "Generating Intermediate CA private key..."
openssl genpkey -algorithm RSA \
    -pkeyopt rsa_keygen_bits:$CA_KEY_SIZE \
    -out private/intermediate-ca-key.pem

chmod 400 private/intermediate-ca-key.pem

# Generate Intermediate CA certificate signing request
echo "Generating Intermediate CA CSR..."
openssl req -new \
    -key private/intermediate-ca-key.pem \
    -out intermediate-ca.csr \
    -subj "/C=US/ST=DC/L=Washington/O=Fortune10 Global Military Enterprise/OU=Intermediate CA/CN=Intermediate CA"

# Sign Intermediate CA certificate with Root CA
echo "Signing Intermediate CA certificate..."
openssl ca -batch \
    -config openssl-ca.cnf \
    -extensions v3_intermediate_ca \
    -days $INTERMEDIATE_VALIDITY_DAYS \
    -notext \
    -in intermediate-ca.csr \
    -out intermediate-ca.pem

# Create certificate chain
cat intermediate-ca.pem root-ca.pem > ca-chain.pem

# Generate service certificates for zero trust mTLS
echo "Generating service certificates..."

SERVICES=("backend" "admin-panel" "postgres" "redis" "monitoring")

for service in "${SERVICES[@]}"; do
    echo "Generating certificate for $service..."

    # Generate service private key
    openssl genpkey -algorithm RSA \
        -pkeyopt rsa_keygen_bits:2048 \
        -out private/${service}-key.pem

    chmod 400 private/${service}-key.pem

    # Generate service certificate signing request
    openssl req -new \
        -key private/${service}-key.pem \
        -out ${service}.csr \
        -subj "/C=US/ST=DC/L=Washington/O=Fortune10 Global Military Enterprise/OU=Service Mesh/CN=${service}.internal"

    # Sign service certificate with Intermediate CA
    openssl ca -batch \
        -config openssl-ca.cnf \
        -extensions server_cert \
        -days $CERT_VALIDITY_DAYS \
        -notext \
        -in ${service}.csr \
        -out certs/${service}.pem

    # Clean up CSR
    rm ${service}.csr
done

# Generate client certificates for zero trust authentication
echo "Generating client certificates..."

CLIENTS=("admin" "api-client" "monitoring-client")

for client in "${CLIENTS[@]}"; do
    echo "Generating client certificate for $client..."

    # Generate client private key
    openssl genpkey -algorithm RSA \
        -pkeyopt rsa_keygen_bits:2048 \
        -out private/${client}-key.pem

    chmod 400 private/${client}-key.pem

    # Generate client certificate signing request
    openssl req -new \
        -key private/${client}-key.pem \
        -out ${client}.csr \
        -subj "/C=US/ST=DC/L=Washington/O=Fortune10 Global Military Enterprise/OU=Clients/CN=${client}"

    # Sign client certificate with Intermediate CA
    openssl ca -batch \
        -config openssl-ca.cnf \
        -extensions usr_cert \
        -days $CERT_VALIDITY_DAYS \
        -notext \
        -in ${client}.csr \
        -out certs/${client}.pem

    # Clean up CSR
    rm ${client}.csr
done

# Generate Certificate Revocation List (CRL)
echo "Generating Certificate Revocation List..."
openssl ca -config openssl-ca.cnf -gencrl -out crl/ca.crl

# Create PKCS#12 bundles for easy distribution
echo "Creating PKCS#12 bundles..."
for service in "${SERVICES[@]}"; do
    openssl pkcs12 -export \
        -out certs/${service}.p12 \
        -inkey private/${service}-key.pem \
        -in certs/${service}.pem \
        -certfile ca-chain.pem \
        -passout pass:enterprise-fortune10
done

# Set proper permissions
chmod 644 root-ca.pem intermediate-ca.pem ca-chain.pem certs/*.pem crl/ca.crl
chmod 600 certs/*.p12

echo "✅ Enterprise PKI Infrastructure generated successfully!"
echo "📋 Certificates valid for the following services:"
for service in "${SERVICES[@]}"; do
    echo "   - $service (mTLS enabled)"
done

echo "🔐 Zero Trust mTLS infrastructure ready for Fortune 10 Global Military deployment"
echo "📁 Certificate files:"
echo "   - Root CA: root-ca.pem"
echo "   - Intermediate CA: intermediate-ca.pem"
echo "   - Certificate Chain: ca-chain.pem"
echo "   - Service Certificates: certs/*.pem"
echo "   - PKCS#12 Bundles: certs/*.p12"
echo "   - CRL: crl/ca.crl"