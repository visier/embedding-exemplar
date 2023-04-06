/*
 * Copyright © [2010-2023] Visier Solutions Inc. All rights reserved.
 */

/**
 * This file contains logic required by the SAML library (`samlp`) used to map `user` objects to SAML claims.
 * See `saml-log.xml` for the most recent SAML Response sent by this server.
 */

function VisierProfileMapper (pu) {
    if(!(this instanceof VisierProfileMapper)) {
        return new VisierProfileMapper(pu);
    }
    this._pu = pu;
}

// Convert user attributes to SAML claims.
VisierProfileMapper.prototype.getClaims = function() {
    // In addition to the 3 claims provided here, Visier requires the "NameID" claim, provided by `getNameIdentifier` below
    return {
        userEmail: this._pu.userEmail || this._pu.id,
        displayName: this._pu.displayName || this._pu.id,
        tenantCode: this._pu.tenantCode,
    };
};

// Get the NameID with optional `Format` attribute from the user.
VisierProfileMapper.prototype.getNameIdentifier = function() {
    return {
        nameIdentifier: this._pu.userEmail || this._pu.id,
        nameIdentifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'
    };
};

module.exports = VisierProfileMapper;
