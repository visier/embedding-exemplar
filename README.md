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
1. A hidden iframe that sends a SAML assertion to Visier's Assertion Consumer Service (ACS) URL.
   1. See `iframe#visier-session` in `embed-application.html`.
2. An iframe that will house Visier.
   1. See `iframe#visier-app` in `embed-application.html`.
3. A handler for each message type that Visier may post.
   1. See `embedded-application.js`
   
## Workflow
 As an example of how these three components work together to embed Visier, consider the sequence of events that occurs
 when Visier is successfully embedded in this application for an existing Visier user:
 1. The hidden session iframe (`#visier-session`) sends a SAML assertion for the current user to Visier's ACS URL. It does this by querying the `/connectVisierSession` endpoint, which renders and immediately posts a pre-filled form containing the SAML assertion.
 2. Visier's ACS URL responds with a script that posts a message from the hidden `#visier-session` iframe to the the partner's application. When a user session was successfully created in Visier, the posted message has the following form:
```javascript
{
   visier: {
      messageType: 'SESSION_CONNECTED',
      data: {   
         applicationSectionsUrl: ...,   // Call this URL to get information about the application sections the current user has access to.
         logOffUrl: ...,                // Call this URL to end the Visier session for this user.
         sharedLinkPrefix: ...,         // Prefix an `analysis_url` with this value to get a URL for a specific analysis for the `visier-app` iframe.
                                        // See Visier's Integration Guide for more details on redirecting users to your application.
      }
   }
 }
```
3. The partner application sends an AJAX request to the `applicationSectionsUrl`. The response contains an `availableSections` property, which is used to load Visier in the application iframe (for example, set the `src` attribute of `#visier-app`) and to build a Visier navigation menu within the parent app. The initial URL used to load Visier can be determined in two ways.
   1. The partner sets a click-through link through the studio experience in Visier. To ensure that users are directed into your application when content is shared with them, and not redirected to Visier, you must configure a click-through link in a project in Visier under `Model > Settings > Navigation, Notices & Links`. Set the click-through link to the URL of the partner application that hosts Visier. Visier sharing links will now direct the user to the your application with a query parameter named `analysis_url` specifying the content to  display. If an `analysis_url` is provided, set the `src` of the Visier app iframe to `<sharedLinkPrefix><analysis_url>`. `sharedLinkPrefix` is provided in the `SESSION_CONNECTED` message.
      1. **NOTE:** The partner application must be able to handle the user being directed to the click-through link you specify without being signed in to the partner application. In this exemplar, the user is redirected to the sign in page with the click-through link query parameter included in the URL. The parameter is forwarded throughout the sign in process so that when the user is redirected to `/embed-application.html` the original click-through link parameter is maintained.
   2. The partner application sets the Visier app iframe `src` to any of the URLs in the `availableSections` property described above. See `loadVisierApp()` in `embed-application.js` for an example.

Visier is now successfully embedded in the partner application! Be aware that there are other workflows that may take place, such as when an error occurs or when a new user is auto-provisioned. See `embed-application.js` for documentation and implementation of other workflows.

For more detailed documentation on embedding Visier, see the Visier Integration Guide.
To access the Visier Integration Guide, please reach out to your Visier Implementation Consultant.

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
npm install
npm run generate-certs country state city organization_name organization_url
```

# Configuration
## In this repo
You must configure 2 URLs in this application to values specific for your organization's sandbox tenant. Obtain the vanity name for your sandbox tenant from your Visier Implementation Consultant and replace `{{vanityName}}` in the following locations:
1. In `./config.js` --> `saml.visierAcsUrl`
   1. SAML assertions must be sent to this URL to create Visier user sessions.
2. In `./public/embed-chart.html`  --> `visierConfig` and `visierConfigSingleChart`
   1. Used by Visier's scripts to verify if a user session already exists.

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
   - **Certificate:** Set to the value of the file at `saml.cert`. Ensure you have already run the `generate-certs` script as described above.
4. Navigate back to `Tenant Single Sign-On`. Turn on `Enable SSO` and then turn on `Auto Provision`.
### Embeddable Domain
1. In the studio experience in your sandbox tenant, open a project and navigate to `Settings > Embeddable Domains`.
2. Add an entry for the `hostname` specified in `config.js` (default is `https:127.0.0.1`).
### Click-Through Link
To enable the use of click-through links:
1. In the studio experience in your sandbox tenant, open a project and navigate to `Model > Settings > Navigation, Notices, Links`.
2. Set "Sharing click-through link" to `https://127.0.0.1/embed-application.html`.
3. Publish the project to production.

# Running Locally
```bash
npm start
```
The `start` script will automatically open a browser tab for the application, but you can also navigate to `https://127.0.0.1` if this fails.


