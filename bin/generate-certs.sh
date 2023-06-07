#!/usr/bin/env bash

# This file is part of visier-embedding-exemplar.
#
# visier-embedding-exemplar is free software: you can redistribute it and/or modify
# it under the terms of the Apache License, Version 2.0 (the "License").
#
# visier-embedding-exemplar is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# Apache License, Version 2.0 for more details.
#
# You should have received a copy of the Apache License, Version 2.0
# along with visier-embedding-exemplar. If not, see <https://www.apache.org/licenses/LICENSE-2.0>. 

set -euo pipefail
trap "echo 'Unable to generate public/private keys'; exit 1" ERR

function print_usage() {
    echo "Usage:"
    echo -e "\tnpm run generate-certs state country org_short org_long"
    echo -e "\tnpm run generate-certs -- --default"
    echo ""
    echo -e "This script generates the public key infrastructure required to run an HTTPS server and to generate SAML assertions."
    echo -e "You must provide the following information about your organization as command line arguments (in this order):"
    echo -e "\t1. Country (2 letter code)"
    echo -e "\t2. State/province (Full name)"
    echo -e "\t3. City"
    echo -e "\t4. Organization name"
    echo -e "\t5. Common name (The fully-qualified domain name; for example, www.visier-exemplar.com)"
    echo ""
    echo "Use option --default to use dummy values. (See above for syntax)"
}

# Check for command line args.
if [[ $# != 5 && "${1:-}" != '--default' ]]; then
  print_usage
  exit 1
fi

if [[ "$1" == '--default' ]]; then
  # Use default values.
   COUNTRY='CA'
   STATE='British Columbia'
   CITY='Vancouver'
   ORG='Visier Exemplar'
   COMMON='www.visier-exemplar.com'
else
  # Use command line args.
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

# Set certificates directory.
CERTIFICATES_DIR='./certificates';

# Make certificates directory if it does not already exist.
if [[ ! -d "$CERTIFICATES_DIR" ]]; then
  mkdir "$CERTIFICATES_DIR"
fi

##### Create certificates #####

# This certificate generates the SAML responses that creates a Visier session.
openssl req -x509 -new -newkey rsa:2048 -nodes -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/CN=$COMMON" \
   -keyout "$CERTIFICATES_DIR"/saml-key.pem -out "$CERTIFICATES_DIR"/saml-cert.pem -days 9999

# This certificate creates an HTTPS server. Visier does not allow embedding over HTTP.
openssl req -x509 -new -newkey rsa:2048 -nodes -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/CN=$COMMON" \
   -keyout "$CERTIFICATES_DIR"/https-key.pem -out "$CERTIFICATES_DIR"/https-cert.pem -days 9999

