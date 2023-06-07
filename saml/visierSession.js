/*
    This file is part of visier-embedding-exemplar.

    visier-embedding-exemplar is free software: you can redistribute it and/or modify
    it under the terms of the Apache License, Version 2.0 (the "License").

    visier-embedding-exemplar is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    Apache License, Version 2.0 for more details.

    You should have received a copy of the Apache License, Version 2.0
    along with visier-embedding-exemplar. If not, see <https://www.apache.org/licenses/LICENSE-2.0>. 
*/

/**
 * This file contains the endpoint that creates authenticated user sessions with Visier. The endpoint gets user
 * information from an authenticated request and posts a SAML assertion to Visier's ACS URL.
 */

/**
 * Third Party Imports
 */
const fs = require("fs");
const profileMapper = require("./visierProfileMapper");
const samlp = require('samlp');
const xmlFormat = require('xml-formatter');
const path = require('path');

/**
 * Internal Imports and Constants
 */
const saml = require(path.join(__dirname, '..', 'config')).saml;

/**
 * SAML Assertion Options
 */
const authOptions = {
    cert: saml.cert,                // Your Visier tenant's SSO configuration must specify the contents of this file as the IdP Certificate.
    key:  saml.key,                 // Do not share this with Visier or any other third party.
    getPostURL: (audience, samlRequestDom, req, cb) => cb(null, saml.visierAcsUrl), // The URL the SAML assertion will be sent to. Note that this application only sends SAML responses to Visier, so a constant value is used.
    issuer: saml.samlIssuerUrl,     // Your Visier tenant's SSO configuration must specify this value as the SSO Issuer.
    audience: saml.visierAcsUrl,    // This value must be Visier's ACS URL. Consult your Implementation Consultant if you require help.
    recipient: saml.visierAcsUrl,   // Identical to `audience`.
    profileMapper,                  // A constructor required by `samlp` that maps a user object to claims and a name identifier.
    responseHandler                // Handle generated SAML assertions by POSTing them to Visier's ACS URL.
}

/**
 * An endpoint that creates an authenticated session with Visier for the current user.
 * It renders a preloaded form that POSTs a SAML assertion to Visier's assertion consumer URL. The `authOptions` object
 * determines the following properties of the SAML assertion:
 *   - `cert` is the certificate to sign the SAML assertion. Your Visier tenant's SSO configuration must specify
 *      the contents of this file as the IdP Certificate.
 *   - `getPostURL` is used by `assertionHandler()` to determine where the SAML response is sent. Since this application
 *      only sends SAML assertions to Visier, a hardcoded value is used.
 *   - `issuer` determines the "Issuer" parameters of the SAML assertion. Your Visier tenant's SSO configuration must
 *      specify this value as the SSO Issuer.
 *   - `audience` is Visier's assertion consumer URL.
 *   - `recipient` is Visier's assertion consumer URL.
 *   - `getUserFromRequest` determines the user for which to establish a Visier session. A partner application should
 *      send authenticated requests to this `connectVisierSession` endpoint, so retrieving user data is as simple as
 *      obtaining it from the authenticated request.
 *   - `profileMapper` determines the claims included in the SAML assertion. Visier requires the following claims:
 *          1. NameID
 *          2. userEmail
 *          3. displayName
 *          4. tenantCode
 *   - `assertionHandler` posts the assertion to Visier's ACS URL (via preloaded HTML form) and logs the generated
 *      SAML assertion to `saml.samlLogFilePath`.
 */
const postSamlResponseToVisier = samlp.auth(authOptions);

/**
 * Renders a preloaded form that POSTs the SAML assertion to Visier's assertion consumer URL.
 * The most recent SAML assertion is recorded in `saml.samlLogFilePath`.
 */
function responseHandler(SAMLResponse, opts, req, res) {
    writeSamlLogFile(SAMLResponse, opts);
    res.set('Content-Type', 'text/html');
    res.render('form', {
        acsUrl: opts.postUrl,
        properties: [
            { key: 'SAMLResponse', value: SAMLResponse.toString('base64') },
            { key: 'RelayState', value: opts.RelayState || (req.query || {}).RelayState || (req.body || {}).RelayState || '' }
        ]
    });
}

/**
 * Log the most recent SAML assertion sent by this server to `saml.samlLogFilePath`.
 * Overwrite any previously recorded SAML assertion.
 */
function writeSamlLogFile(assertion, opts) {
    const formattedXml = xmlFormat(assertion.toString(), {indentation: '  '});
    fs.writeFile(saml.samlLogFilePath, formattedXml, (err) => {
        if (err != null) {
            console.error("There was an error writing the last SAML assertion to " + saml.samlLogFilePath);
        } else {
            console.log(`A SAML assertion was sent to ${opts.postUrl} with relay state ${opts.RelayState}. ` +
                `The SAML assertion is recorded in ${saml.samlLogFilePath}`);
        }
    });
}

module.exports = { postSamlResponseToVisier };
