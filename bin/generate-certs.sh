#!/usr/bin/env bash

#
# Copyright © [2010-2023] Visier Solutions Inc. All rights reserved.
#

set -euo pipefail
trap "echo 'Unable to generate public/private keys'; exit 1" ERR

function print_usage() {
    echo "Usage:"
    echo -e "\tnpm run generate-certs state country org_short org_long"
    echo -e "\tnpm run generate-certs -- --default"
    echo ""
    echo -e "This script generates the public key infrastructure required to run an https server and to generate SAML assertions."
    echo -e "You must provide the following information about your organization as command line arguments (in this order):"
    echo -e "\t1. Country (2 letter code)"
    echo -e "\t2. State/province (full name)"
    echo -e "\t3. City"
    echo -e "\t4. Organization name"
    echo -e "\t5. Common name (The fully-qualified domain name. E.g., www.visier-exemplar.com)"
    echo ""
    echo "Use option --default to use dummy values. (See above for syntax)"
}

# Check for command line args
if [[ $# != 5 && "${1:-}" != '--default' ]]; then
  print_usage
  exit 1
fi

if [[ "$1" == '--default' ]]; then
  # Use default values
   COUNTRY='CA'
   STATE='British Columbia'
   CITY='Vancouver'
   ORG='Visier Exemplar'
   COMMON='www.visier-exemplar.com'
else
  # Use command line args
  COUNTRY=$1
  STATE=$2
  CITY=$3
  ORG=$4
  COMMON=$5
fi

if (( ${#COUNTRY} != 2 )); then
  echo "ERROR: Country (first command line arg) must be a two letter country code."
  echo ""
  print_usage
  exit 1
fi

# Set certificates directory
CERTIFICATES_DIR='./certificates';

# Make certificates directory if it does not already exist
if [[ ! -d "$CERTIFICATES_DIR" ]]; then
  mkdir "$CERTIFICATES_DIR"
fi

##### Create certificates #####

# This certificate is used to generate the SAML responses used to create a Visier session
openssl req -x509 -new -newkey rsa:2048 -nodes -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/CN=$COMMON" \
   -keyout "$CERTIFICATES_DIR"/saml-key.pem -out "$CERTIFICATES_DIR"/saml-cert.pem -days 9999

# This certificate is used to create an https server (Visier does not allow embedding over http)
openssl req -x509 -new -newkey rsa:2048 -nodes -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/CN=$COMMON" \
   -keyout "$CERTIFICATES_DIR"/https-key.pem -out "$CERTIFICATES_DIR"/https-cert.pem -days 9999

