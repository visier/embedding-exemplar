/**
 * This file is part of visier-embedding-exemplar.
 *
 * visier-embedding-exemplar is free software: you can redistribute it and/or modify
 * it under the terms of the Apache License, Version 2.0 (the "License").
 *
 * visier-embedding-exemplar is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * Apache License, Version 2.0 for more details.
 *
 * You should have received a copy of the Apache License, Version 2.0
 * along with visier-embedding-exemplar. If not, see <https://www.apache.org/licenses/LICENSE-2.0>.
 */

/**
 * This script contains the logic required to embed the Visier application.
 *
 * This script is organized by the following logical sections:
 *  1. Create the container
 *  2. Bootstrap Visier
 *  3. Manage Partner and Visier Sessions
 *  4. Add event handlers
 *  5. Navigate with Visier
 *  6. Call embedApp
 */


/**
 * ************************************************************************************************
 * 1. Create the container
 * ************************************************************************************************
 */

// We've put an iframe with id `visier-app` in the embed-application.html,
// and will be using it for various calls below in this script.
const visierIframeId = "visier-app";


/**
 * Globals
 */
const visierGlobals = {
    /**
     * Set enableDebugLogging to true to add extra debug logging for local development. Disabled by default.
     */
    enableDebugLogging: false,
    isAppLoaded: false,
    keepSessionAliveTimer: undefined, // Set while bootstrapping Visier.
    appIframe: document.getElementById(visierIframeId),
    appLoadingImg: document.getElementById('visier-app-loading')
};


/**
 * ************************************************************************************************
 * 2. Bootstrap Visier
 * ************************************************************************************************
 */

// Set up the `visierConfig`. The `visierConfig` bootstraps the SDK.
const visierConfig = {
    // Set the URL to use for logging into Visier.
    visierUrl: "https://{{vanityName}}.visier.com/hr",

    // Optional: Set the URL for your IDP.
    // The IdP URL that handles hidden sessions and posts valid SAML assertions.
    idpUrl: "https://127.0.0.1/connectVisierSession"
};

// Copy the following function and use it to embed the full Visier application into your
// application. This function is the same for embedding visualizations. The function fetches
// Visier's SDK, adds the SDK as a script element, and makes Visier's embedding API available
// through a `visier` function.
(function(w, d, t, s, c, v, e, x) {
    w['VisierEmbedder'] = v;
    w[v] = w[v] || function() {
        (w[v].q = w[v].q || []).push(arguments)
    };
    e = d.createElement(t);
    x = d.getElementsByTagName(t)[0];
    e.async = true;
    e.src = c.visierUrl ? c.visierUrl + s : (c.loginUrl ? c.loginUrl.split("/auth/embedded")[0] + s : s);
    x.parentNode.insertBefore(e, x)
})(window, document, 'script', '/assets/embedded/webAssets/sdk.v2.js', visierConfig, 'visier');

// Bootstrap must always be the first call to `visier()`.
visier('bootstrap', visierConfig, async function(app) {
    attachSessionEventHandlers(app);
    attachErrorEventHandlers(app);
    attachInfoEventHandlers(app);
    attachDebugEventHandlers(app);
    await buildVisierNavigationMenu(app);
    embed(app);
});


/**
 * ************************************************************************************************
 * 3. Manage Partner and Visier Sessions
 * ************************************************************************************************
 */

/**
 * Prevent the Visier session from expiring to provide a smooth user experience. Visier sessions
 * last 55 minutes. It is recommended you renew the Visier session every 10-15 minutes.
 */
function keepVisierSessionAlive() {
    visier("trigger", "PARENT_SESSION_ALIVE");
}

/**
 * Clean up the Visier user session.
 * The partner application should call this method when it ends its own user session.
 */
function cleanUpVisierSession() {
    // Stop renewing the Visier user session. Used during partner session clean up.
    clearTimeout(visierGlobals.keepSessionAliveTimer);

    // Trigger clean up through the API.
    visier("trigger", "PARENT_SESSION_CLEANUP", function (error) {
        if (error) {
            renderVisierErrorMessage("Error while cleaning up Visier session", error);
        } else {
            location.assign('../');
        }
    });
}

/**
 * Add event handlers for session events
 */
function attachSessionEventHandlers(embeddingApp) {
    embeddingApp.on("session", function(msg) {
        switch (msg?.code?.toUpperCase()) {
            case "EJECT_SESSION":
                /**
                 * This message is emitted if the user opens another tab that embeds content for a different user or tenant.
                 * The session on this tab will be cleaned up. Any continued attempts to use this session will result in
                 * unexpected behavior such as showing data for the other user or tenant.
                 *
                 * A partner application must handle this event gracefully and prevent further embedding interactions
                 * such as by removing the iframes or disabling navigation actions.
                 */

                renderVisierErrorMessage("The user logged into another tenant on another tab or window.");
                hideNavigationSection();
                break;
            case "SESSION_ERROR":
                /**
                 * Scenarios in which this message may be emitted include, but are not limited to:
                 *   1. The SSO configuration for the specified Visier tenant is incorrect or disabled.
                 *   2. Auto-provisioning is disabled and the user does not have a Visier profile.
                 *   3. The `tenantCode` claim in the SAML assertion was invalid.
                 *   4. The SAML assertion sent to Visier's ACS URL was malformed
                 *
                 * A partner application must handle this event gracefully, as it represents a blocked user flow.
                 */
                renderVisierErrorMessage("The user could not be logged into Visier.", msg.message);
                break;
            case "SESSION_ESTABLISHED":
                /**
                 * This message is emitted once an authenticated session has been established with Visier for the current user.
                 */
                // 10 minute interval. See `keepVisierSessionAlive()` for more details.
                visierGlobals.keepSessionAliveTimer = setInterval(() => keepVisierSessionAlive(), 600000);
                showAppIframe();
                break;
            case "USER_AUTO_PROVISION_FAILED":
                /**
                 * A partner application must handle this event gracefully, as it represents a blocked user flow.
                 */
                renderVisierErrorMessage("Auto-provisioning failed.", msg.message);
                break;
            case "USER_AUTO_PROVISION_SUCCESS":
                /**
                 * This message is emitted when a new Visier user is created automatically for the current user.
                 * Auto-provisioning must be enabled in your Visier tenant's settings under "Tenant Single Sign-On"
                 * and it must be the first time this user is using Visier.
                 */
                console.log("User successfully auto-provisioned!");
                break;
            case "VISIER_SESSION_ALIVE":
                /**
                 * These events are emitted when the user is active in the Visier application. This allows the parent application to
                 * keep its own user session alive when the user is active in Visier but not in the parent application. By default,
                 * these messages are emitted once every five minutes, but this can be configured in your Visier tenant under "Embedded App Config".
                 */
                // For this example application, user sessions do not expire, so no action is needed.
                break;
            case "VISIER_SESSION_EXPIRED":
                /**
                 * If the user is active in the parent application but not in Visier, the user's session in Visier can expire.
                 * Note: Sending the Visier application iframe `PARENT_SESSION_ALIVE` messages, as in `keepVisierSessionAlive()`,
                 * prevents the Visier session from expiring. Best practice is to handle expired Visier sessions nonetheless.
                 */
                // Call `embeddingApp.bootstrapSession();` to create a new session in the background.
                // Once complete, new requests will pick up the new authentication tokens.
                // Alternatively, call embedApp to restart the process again, including authentication.
                // This will reload the application, which will help clear any errors surface earlier due to the session expiry.
                embeddingApp.embedApp(visierIframeId);
                break;
            default:
                console.log("Received session message from Visier", msg);
                break;
        }
    });
}


/**
 * ************************************************************************************************
 * 4. Add event handlers
 * ************************************************************************************************
 */

/**
 * Add event handlers for error events
 */
function attachErrorEventHandlers(embeddingApp) {
    embeddingApp.on("error", function(msg) {
        switch (msg?.code?.toUpperCase()) {
            case "CONTAINER_MISSING":
                /**
                 * If the container to embed the content in cannot be found.
                 */
                renderVisierErrorMessage("Invalid container", msg);
                break;
            case "FAILED_TO_EJECT_PREVIOUS_SESSION":
                /**
                 * If the user opens a second tab that embeds content for a different user or tenant, this error is emitted
                 * in the case of unexpected errors while performing cleanup on the first tab.
                 *
                 * The partner application can clean up the other session and attempt embedding once again.
                 */
                renderVisierErrorMessage("Multiple users are not supported. Clean up previous user sessions before establishing a new user's session.")
                break;
            case "INVALID_APP_URL":
                /**
                 * Either an invalid URL was passed to the embedApp method or no default URL could be found.
                 */
                renderVisierErrorMessage("Invalid Visier app url found", msg);
                break;
            /**
             * These timeout errors emit if there are unexpected issues with the authentication set up or if the set up took
             * longer than expected, such as due to network latency. Possible causes include:
             *  - The IdP failed to authenticate the user. Check the Network tab.
             *  - The service worker failed to load. Look for errors in the Console tab and turn on enableDebugLogging.
             */
            case "SW_LOADER_TIMEOUT":
            case "SW_LOADING_TIMEOUT":
                renderVisierErrorMessage("Unexpected error loading the embedded app. Try extending the requestTimeout in case of network latency.");
                break;
            case "VISIER_APP_DOWN":
                /**
                 * When Visier is unavailable, render and log an error message.
                 */
                renderVisierErrorMessage("Visier currently unavailable", msg);
                break;
            default:
                console.log("Received error message from Visier:", msg);
                break;
        }
    });
}

/**
 * Add event handlers for info events
 */
function attachInfoEventHandlers(embeddingApp) {
    embeddingApp.on("info", function(msg) {
        switch (msg?.code?.toUpperCase()) {
            case "VISIER_APP_LOADED":
                /**
                 * This event is intended to prevent partners from loading the Visier solution multiple times and to support session
                 * clean up. See `cleanUpVisierSession()` for more details.
                 */
                visierGlobals.isAppLoaded = true;
                break;
            default:
                console.log("Received info message from Visier:", msg);
                break;
        }
    });
}

/**
 * Add event handlers for debug events.
 * These are short messages to help better facilitate joint debugging between teams.
 * We've set this up so that it only logs if you set enableDebugLogging to true.
 */
function attachDebugEventHandlers(embeddingApp) {
    if (visierGlobals.enableDebugLogging) {
        embeddingApp.on("debug", function(msg) {
            console.debug("Received debug message from Visier:", msg);
        });
    }
}


/**
 * ************************************************************************************************
 * 5. Navigate with Visier
 *    Build a navigation menu using the sections and rooms from getting APPLICATION_SECTIONS.
 *
 *    Note: This step does not necessarily have to happen before embedApp. It is listed here as
 *          step 3 to help better break down the code into steps.
 * ************************************************************************************************
 */

function navigateVisier(url) {
    visier("trigger", "NAVIGATE", url);
}

async function buildVisierNavigationMenu(embeddingApp) {
    if (visierGlobals.isAppLoaded) {
        // Avoid recreating Visier menu.
        return;
    }

    let sections = [];
    try {
        sections = await embeddingApp.get("APPLICATION_SECTIONS");
    } catch (err) {
        renderVisierErrorMessage("Could not retrieve application sections.", err);
    }

    // Find the Visier navigation container.
    const visierNavigationSection = document.getElementById('visier-navigation-section');
    visierNavigationSection.style.display = "flex";

    sections.forEach((section) => {
        // Create an element for the application section title/root.
        const sectionHeader = document.createElement('button');
        sectionHeader.className = 'navigation-header';
        sectionHeader.id = section.sectionId;
        sectionHeader.innerHTML = section.sectionName;
        sectionHeader.addEventListener('click', () => navigateVisier(section.sectionUrl));

        // Create a section for the "rooms" (i.e., subsections).
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'navigation-section';
        // Create links for each room.
        section.availableRooms.forEach(room => {
            const navLink = document.createElement('button');
            navLink.className = 'navigation-link'
            navLink.id = room.roomId;
            navLink.innerHTML = room.roomName;
            navLink.addEventListener('click', () => navigateVisier(room.roomUrl));

            sectionDiv.appendChild(navLink);
        });

        visierNavigationSection.appendChild(sectionHeader);
        visierNavigationSection.appendChild(sectionDiv);
    });
}

function hideNavigationSection() {
    const visierNavigationSection = document.getElementById('visier-navigation-section');
    visierNavigationSection.style.display = "none";
}


/**
 * ************************************************************************************************
 * 6. Call embedApp
 *    This will render the application in the given iframe. Check for query parameters and pass in
 *    an optional URL to your call to specify where to start.
 * ************************************************************************************************
 */

async function embed(embeddingApp) {
    // Check if an analysis or user preferences URL was provided.
    // This applies for workflows where a user has clicked on link such as in through an
    // embedded chart, an analysis share link, or an analysis email link.
    const params = new URLSearchParams(window.location.search);
    const landingUrl = params.get("analysis_url") || params.get("user_preferences_url");

    if (landingUrl) {
        // If it exists, load the Visier app with the analysis as the landing page.
        embeddingApp.embedApp(visierIframeId, landingUrl);
    } else {
        // Otherwise, load the Visier app with its default landing page.
        embeddingApp.embedApp(visierIframeId);
        // To start on a different landing page, get the APPLICATION_SECTIONS and
        // use it to specify the landing page. For example:
        // const sections = await visier.get("APPLICATION_SECTIONS");
        // visier.embedApp(visierIframeId, sections[0].availableRooms[0].roomUrl);
        // Note: This `embed` method would then need to be `async` due to the `await` above.
    }
}


/**
 * ************************************************************************************************
 * Helper Functions
 * ************************************************************************************************
 */

/**
 * A partner must handle errors embedding the Visier application gracefully, as they will block user flows.
 * In this example application, we render an error message in place of the Visier application.
 */
function renderVisierErrorMessage(message, data) {
    visierGlobals.appIframe.src = "./visierError";
    showAppIframe();

    if (message) {
        console.error(message, data || "No additional information supplied.");
        showErrorModal(message);
    }
}

function showErrorModal(message) {
    const modal = document.getElementById("error-modal");
    modal.style.display = "flex";
    document.getElementById("error-modal-content").innerText = message;
}

function hideErrorModal() {
    const modal = document.getElementById("error-modal");
    modal.style.display = "none";
}

function showAppIframe() {
    // Hide loading gif
    visierGlobals.appLoadingImg.style.display = "none";
    // Show iframe
    visierGlobals.appIframe.style.display = "block";
}
