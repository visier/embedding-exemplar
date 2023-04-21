# Installation
```bash
npm install
npm run generate-certs country state city organization_name organization_url
```

# Configuration
## In this repo
You must configure 2 URLs in this application to values specific for your organization's sandbox tenant. Obtain the vanity name for your sandbox tenant from your Visier Implementation Consultant, and replace `{{vanityName}}` in the following locations:
1. In `./config.js` --> `saml.visierAcsUrl`
   1. SAML assertions must be sent to this URL to create Visier user sessions.
2. In `./public/embed-chart.html`  --> `visierConfig` and `visierConfigSingleChart`
   1. Used by Visier's scripts to verify if a user session already exists.
   
## In your Visier sandbox tenant
You must add an SSO configuration and embeddable domain to your Visier sandbox tenant.
### SSO Configuration
1. In Visier, navigate to Studio for your sandbox tenant.
2. Navigate to `Settings > Tenant Single Sign-On.`
3. Create an SSO configuration with the following values taken from `config.js`:
   - **Issuer:** `saml.samlIssuerUrl` (default is `https://www.visier-exemplar.com`)
   - **IdP URL:** `{{hostname}}/connectVisierSession` (using default value yields `https://127.0.0.1/connectVisierSession`)
   - **Certificate:** set to the value of the file at `saml.cert` (ensure you have already run the `generate-certs` script as described above)
4. Navigate back to `Tenant Single Sign-on` and toggle on `Enable SSO` and then `Auto Provision`
### Embeddable Domain
1. In Studio in your sanbox tenant, navigate to `Settings > Embeddable Domains`
2. Add an entry for the `hostname` specified in `config.js` (default is `https:127.0.0.1`).

# Running the Application
```bash
npm start
```
The `start` script will automatically open a browser tab for the application, but you can also navigate to `https://127.0.0.1` if this fails.

# To Use a Different Hostname
1. Change the value of `hostname` in `./config.js`
2. Add an entry to your `/etc/hosts` file to direct this hostname to your localhost. E.g.,
       127.0.0.1        www.visier-exemplar.com
3. Add an entry to your Visier sandbox tenant's "embeddable domains" (see above) that matches the new hostname.
4. In `./public/embed-chart.html`, change the `visierConfig` objects to use your new hostname for the `idpUrl`
   property.

