![Visier Logo](./public/visier-logo.jpeg "Visier")
# Visier's Embedding Exemplar
# Introduction
Welcome to Visier's Embedding Exemplar. This repository is designed to make embedding easy for Visier Partners. With minimal configuration, this repository serves a mock web application that embeds Visier for an analytic tenant. The embedding exemplar is for Visier Partners that have a sandbox tenant and are embedding Visier for the first time or testing tenant single sign-on (SSO) configurations. The exemplar has three key features:
1. It contains extensive inline comments documenting each step of the embedding process.
2. It is a working application that embeds Visier that can serve as a reference, and little configuration is required. You may choose to copy some code snippets into your own applications.
3. The most recent SAML assertion sent to Visier is recorded in `/saml/saml-log.xml`. Use a successful SAML assertion as a guide if you encounter rejected SAML assertions in your own embedding application.

If you intend to use SSO for your own users (as opposed to your customers' users), speak with your Visier Implementation consultant.

# Table of Contents
1. [Embedding Overview](#embedding-overiew)
2. [Application Structure](#application-structure)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running Locally](#running-locally)

# Embedding Overview
## Required Components
To embed Visier, the partner application must include three elements:
1. JavaScript code that fetches and bootstraps the Visier SDK as a usable API.
   1. See `embedded-application.js` 
2. An iframe that will house Visier.
   1. See `iframe#visier-app` in `embed-application.html`.
3. A handler for each message type that Visier may post.
   1. See `embedded-application.js`
   
## Workflow
 As an example of how these three components work together to embed Visier, consider the sequence of events that occurs when Visier is successfully embedded in this application for an existing Visier user:
 1. The JavaScript code fetches and bootstraps the Visier SDK with a `visierConfig` containing the `visierUrl`.
 2. The JavaScript code calls embedApp, passing in the ID for the iframe that will house Visier (here, `#visier-app`).
 3. The API kicks off authenticating in the background on a hidden session iframe. Upon successful authentication, it receives authentication tokens.
 4. The API sets up a service worker and passes the authentication tokens to it. This service worker intercepts any requests from the embedded app to Visier servers and attaches the tokens as headers. With the headers, the requests can be authenticated properly.
 5. Optionally, the JavaScript code calls `get("APPLICATION_SECTIONS")` and uses the response to build the navigation bar.
Visier is now successfully embedded in the partner application! Be aware that there are other workflows that may take place, such as when an error occurs. See `embed-application.js` for documentation and implementation of other workflows.

For more detailed documentation on embedding Visier, see https://docs.visier.com/embedded/Visier%20API/integration/embed-visier-home.htm.

# Application Structure
The directory hierarchy is structured as follows:
 - `/`
   - `app.js` &#8594; Contains the Express server with middleware and endpoints.
   - `config.js` &#8594; Must be configured for the sandbox tenant you will embed.
 - `public/`
   - `index.html` &#8594; Allows a "user" to log into the "partner" application. The credentials used to log in are picked up by Express middleware and used in the SAML assertion sent to Visier.
   - `embed-application.html` and `embed-application.js` &#8594; Embed Visier with navigation, auto-provisioning, and error handling.
   - `embed-chart.html` &#8594; Embeds selected Visier content in a containing web page.
 - `views/` &#8594; Handlebars templates.
   - `form.hbs` &#8594; Renders a form with specified attributes that immediately submits a POST request to a specified URL. It is used primarily by the `connectVisierSession` endpoint to automatically submit a POST request containing a SAML response to Visier from the client.
 - `saml/`
   - `visierSession.js` &#8594; Generates a SAML response for the user credentials entered on the sign in page. It depends on `samlp`.
   - `visierProfileMapper.js` &#8594; Maps user credentials to SAML claims; Required by `samlp`.
   - `saml-log.xml` &#8594; Contains the most recent SAML assertion sent by this application.
 - `bin/`
   - `generate-certs.sh` &#8594; Generates the public key infrastructure (PKI) required for generating SAML assertions and serving an HTTPS application. Called form `npm run generate-certs`.
   - `www` &#8594; Bootstraps the application. Called from `npm start`.
 - `certificates/` &#8594; Contains the PKI required to generate SAML assertions and serve an HTTPS application. Generated by `npm run generate-certs`.



# Installation
```bash
yarn install
npm run generate-certs country state city organization_name organization_url
```

# Configuration
## In this repo
You must configure a URL in this application to values specific for your organization's sandbox tenant. Obtain the vanity URL for your sandbox tenant from your Visier Implementation Consultant. This URL will look similar to `https://example.visier.com`. Replace `{{vanityName}}` in the following locations:
1. In `./config.js`, replace for `saml.visierAcsUrl`
   1. SAML assertions must be sent to this URL to create Visier user sessions.
2. In `./public/embed-application.js` and `./public/embed-chart.html`, replace for `visierConfig.visierUrl`
   1. Used to load the SDK and authenticate the user.

## Change the Hostname for the Exemplar App
1. Change the value of `hostname` in `./config.js`.
2. Add an entry to your `/etc/hosts` file to direct this hostname to your localhost. For example,
   127.0.0.1        www.visier-exemplar.com.
3. Add an entry to your Visier sandbox tenant's "embeddable domains" (see below) that matches the new hostname.
4. In `./public/embed-chart.html`, change the `visierConfig` objects to use your new hostname for the `idpUrl`
   property.

## In Your Visier Sandbox Tenant
You must add a SSO configuration and embeddable domain to your Visier sandbox tenant.
### SSO Configuration
1. In Visier, open the studio experience in your sandbox tenant.
2. On the global navigation bar, click `Settings > Tenant Single Sign-On.`
3. Create an SSO configuration with the following values taken from `config.js`:
   - **Issuer:** `saml.samlIssuerUrl` Default is `https://www.visier-exemplar.com`.
   - **IdP URL:** `{{hostname}}/connectVisierSession` Using the default value yields `https://127.0.0.1/connectVisierSession`.
   - **Certificate:** Set to the value of the file at `saml-cert.pem`. Ensure you have already run the `generate-certs` script as described above.
4. Navigate back to `Tenant Single Sign-On`. Turn on `Enable SSO` and then turn on `Auto Provision`.
### Embeddable Domain
1. In your sandbox tenant, on the global navigation bar, click `Settings > Embeddable Domains`.
2. Add an entry for the `hostname` specified in `config.js` (default is `https://127.0.0.1`).

# Running Locally
```bash
npm start
```
The `start` script will automatically open a browser tab for the application, but you can also navigate to `https://127.0.0.1` if this fails.


