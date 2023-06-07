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
 * This script contains the logic required to embed the Visier application.
 * The bulk of this file is dedicated to handling messages that may be emitted by either of the Visier iframes.
 * However, there are also actions that must be initiated by the partner. This script is organized by the following
 * logical sections:
 *   1. Bootstrap Visier
 *          - Handle message types:
 *              SESSION_CONNECTED, USER_AUTOPROVISION_SUCCESS, VISIER_APP_LOADED
 *   2. Manage Partner and Visier Sessions
 *          - Handle message types:
 *              VISIER_SESSION_ALIVE, VISIER_SESSION_EXPIRED
*           - Partner-initiated actions:
 *              Keep the Visier session alive, session cleanup (log out of Visier)
 *   3. Navigate Visier
 *          - Create a Visier navigation menu that posts messages to the Visier application iframe
 *   4. Handle Errors
 *          - Handle message types:
 *              AUTHENTICATION_ERROR, VISIER_APP_DOWN, USER_AUTOPROVISION_FAILED
 *   5. Register Message Handlers
 */

/**
 * Globals
 */
const visierGlobals = {
    isAppLoaded: false,
    endpoints: undefined,       // Set while bootstrapping Visier.
    navigationLinks: undefined, // Set while bootstrapping Visier.
    keepSessionAliveTimer: undefined, // Set while bootstrapping Visier.
    appIframe: document.getElementById('visier-app'),
    appLoadingImg: document.getElementById('visier-app-loading'),
    sessionIframe: document.getElementById('visier-session')
}

/**
 * ****************************** 1. Bootstrap Visier ******************************
 */

/**
 * Handle `SESSION_CONNECTED` messages.
 * This message is emitted after an authenticated session is established with Visier for the current user.
 * The message has the following form:
 * {
 *     messageType: 'SESSION_CONNECTED',
 *     data: {
 *         applicationSectionsUrl: ..., // Call this URL to get information about the application sections the current user has access to.
 *         logOffUrl: ...,              // Call this URL to end the Visier session for this user.
 *         sharedLinkPrefix: ...,       // Prefix an `analysis_url` with this value to get a URL for a specific analysis for the `visier-app` iframe.
 *                                      // See Visier's Integration Guide for more details on redirecting users to your application.
 *     }
 * }
 *
 * This function responds to `SESSION_CONNECTED` events in this way:
 *   1. Call the `applicationSectionsUrl`.
 *   2. Build a navigation menu integrated with the partner application.
 *   3. Check if a click-through link is defined and load the Visier application frame at either the click-through
 *      target or at the first application section available to this user.
 */
function handleVisierSessionConnectedEvent(visierMessage) {
    // Obtain data from `SESSION_CONNECTED` message.
    visierGlobals.endpoints = visierMessage.data;
    // Create new AJAX request.
    const xmlHttpReq = new XMLHttpRequest();
    // Set request method and URL.
    xmlHttpReq.open('GET', visierGlobals.endpoints.applicationSectionsUrl);
    // Include cookies in request—we need to send the VisierASIDToken and CSRFToken.
    xmlHttpReq.withCredentials = true;
    // Expect a JSON response.
    xmlHttpReq.setRequestHeader('Accept', 'application/json');
    xmlHttpReq.responseType = "json"; // Automatically parses the response from JSON.
    // On successful response, set the `src` attribute of the Visier App iframe.
    xmlHttpReq.addEventListener('load', (loadEvent) => {
        if (xmlHttpReq.status === 200) {
            const availableSections = xmlHttpReq.response.availableSections;

            if (!availableSections || !availableSections[0] || !availableSections[0].sectionUrl) {
                applicationSectionsErrorHandler(availableSections);
                return;
            }

            loadVisierApp(availableSections); // Load the Visier App, default to loading first available section.
            if (!visierGlobals.isAppLoaded){ // Avoid recreating Visier menu if app is already loaded.
                createVisierMenu(availableSections); // Add Visier navigation to partner application.
                visierGlobals.keepSessionAliveTimer = setInterval(() => keepVisierSessionAlive(), 600000) // 10 minute interval. See `keepVisierSessionAlive()` for more details.
            }
        } else {
            applicationSectionsErrorHandler(loadEvent);
        }
    });

    function loadVisierApp(availableSections) {
        // Check if an analysis click-through link is defined. Consult the README for more details.
        const params = new URLSearchParams(window.location.search);
        const analysis_url = params.get("analysis_url");

        if (analysis_url) {
            // A click-through link was used. Prepend the value provided with the `sharedLinkPrefix` provided in the
            // `SESSION_CONNECTED` message.
            // Navigate to target specified in URL query parameter.
            renderVisierAppIframe(decodeURI(visierGlobals.endpoints.sharedLinkPrefix + analysis_url));
        } else { // A click-through link was not used.
            // Find the "analytics" section home.
            const analytics = availableSections.find(section => section.sectionId === "analytics") || availableSections[0]
            const home = analytics.availableRooms.find(room => room.roomId === "home")
            // Load first application section.
            renderVisierAppIframe(home.roomUrl);
        }
    }

    function applicationSectionsErrorHandler(errorEvent) {
        renderVisierErrorMessage("Could not retrieve application sections.", errorEvent);
    }
    xmlHttpReq.addEventListener('error', applicationSectionsErrorHandler);
    xmlHttpReq.send();
}

/**
 * Handle `USER_AUTOPROVISION_SUCCESS` messages.
 * This message emits when a new Visier user is created automatically for the current user. Auto-provisioning must
 * be enabled in your Visier tenant's settings in "Tenant Single Sign-On" and it must be the first time this user is
 * using Visier. If the IdP URL is configured properly for your Visier tenant in "Tenant Single Sign-On", no action
 * is needed for this message. Set the IdP URL to the same value as the original URL you set for the Visier session
 * iframe (`#visier-session`). When the user auto-provisions and the message emits, Visier
 * redirects the Visier session iframe to the IdP URL and the normal, successful session creation workflow will begin.
 *
 * Note: When auto-provisioning occurs, the session iframe redirects from a Visier URL to the IdP URL you set
 * in your SSO configuration. In order for your user's session cookies to be sent with the redirect, they must have the
 * `sameSite` attribute set to `none` (and therefore also `secure: true`). To avoid using those settings, you can
 * manually reload the Visier session iframe in this message handler.
 */
function handleAutoprovisionSuccess(visierMessage) {
    console.log("User successfully auto-provisioned!");
    // Manually reload the Visier session iframe if you cannot use session cookies with `sameSite: none`
    // if (visierGlobals.appIframe.src === './connectVisierSession') {
    //     visierGlobals.appIframe.contentWindow.location.reload();
    // } else {
    //     renderVisierAppIframe('./connectVisierSession');
    // }
}

/**
 * Handle `VISIER_APP_LOADED` events.
 * This event prevents partners from loading the Visier solution multiple times and supports session
 * clean up. See `navigateVisier()` and `cleanUpVisierSession()` for more details.
 */
function handleVisierAppLoadedEvent(visierMessage) {
    visierGlobals.isAppLoaded = true;
}

/**
 * ****************************** 2. Manage Partner and Visier Sessions ******************************
 */

/**
 * Handle `VISIER_SESSION_ALIVE` events.
 * These events are emitted when the user is active in the Visier application. This allows the parent application to
 * keep its own user session alive when the user is active in Visier but not in the parent application.
 *
 * By default, these messages are emitted once every five minutes, but this can configured in your Visier tenant under
 * "Embedded App Config".
 */
function handleVisierSessionAliveEvent(visierMessage) {
    // For this example application, user sessions do not expire, so no action is needed.
}

/**
 * Handle `VISIER_SESSION_EXPIRED` messages.
 * If the user is active in the parent application but not in Visier, the user's session in Visier can expire. The
 * partner should renew the Visier session the same way it was originally established: send a SAML assertion to Visier's
 * ACS URL.
 *
 * Note: Sending the Visier application iframe `PARENT_SESSION_ALIVE` messages, as in `keepVisierSessionAlive()`,
 * prevents the Visier session from expiring. Best practice is to handle expired Visier sessions nonetheless.
 */
function handleVisierSessionExpired(visierMessage) {
    if (visierGlobals.appIframe.src === './connectVisierSession') {
        visierGlobals.appIframe.contentWindow.location.reload();
    } else {
        renderVisierAppIframe('./connectVisierSession');
    }
}

/**
 * Prevent the Visier session from expiring to provide a smooth user experience. Visier sessions last 55 minutes. It is
 * recommended you renew the Visier session every 10-15 minutes (see `handleVisierSessionConnected()`).
 */
function keepVisierSessionAlive() {
    const message = {
        'visier': {
            messageType: 'PARENT_SESSION_ALIVE'
        }
    };
    console.log("PARENT_SESSION_ALIVE message posted to the Visier application iframe.");
    visierGlobals.appIframe.contentWindow.postMessage(JSON.stringify(message), "*");
}

/**
 * Stop renewing the Visier user session. Used during partner session clean up.
 */
function removeKeepVisierSessionAliveTimer() {
    clearTimeout(visierGlobals.keepSessionAliveTimer);
}

/**
 * Clean up the Visier user session. The partner application should call this method when it ends its own user session.
 */
function cleanUpVisierSession() {
    removeKeepVisierSessionAliveTimer(); // Stop keeping the Visier session alive.
    // If Visier is not loaded yet, query the logout URL directly.
    // If Visier is loaded, post a message to the Visier iframe.
    if (!visierGlobals.isAppLoaded) { // Call logOffUrl directly.
        if (visierGlobals.endpoints) {
            console.error("Cannot clean up Visier session as it is not connected");
            return;
        }
        // Call the Visier public client API to clean up the session.
        // Create a new AJAX request.
        const xmlHttpReq = new XMLHttpRequest();
        // Set request method and URL.
        xmlHttpReq.open('GET', visierGlobals.endpoints);
        // Include cookies in request—we need to send the Visier Tokens.
        xmlHttpReq.withCredentials = true;
        // Expect text response
        xmlHttpReq.responseType = 'text';
        xmlHttpReq.addEventListener('load', (loadEvent) => {
            if (xmlHttpReq.status === 200) {
                //Handles success. This is where your application performs cleanup on logoff.
                location.assign('../'); // Navigate back to the partner's sign in page.
            } else {
                // Handle error.
                console.error("There was an error logging the user out of Visier.");
                console.error(loadEvent.data);
            }
        });
    } else { // Post message to `#visier-app`.
        const message = {
            "visier": {
                "messageType": "PARENT_SESSION_CLEANUP",
                "data": {}
            }
        };
        // Post the message to the `#visier-app` iframe.
        visierGlobals.appIframe.contentWindow.postMessage(JSON.stringify(message), "*");
    }

    setTimeout(() => {
        location.assign('../'); // Navigate back to the partner sign in page.
    }, 0);
    return;
}

/**
 * ****************************** 3. Navigate Visier ******************************
 */

/**
 * Add Visier navigation to the partner's application.
 * Each Visier application section has a root URL/ID and any number of "rooms", each with their own URL and ID. Use the
 * URL and ID of a section or room to navigate the Visier application (see `navigateVisier()` for more details).
 * The available sections payload has the following schema:
 * [
 *      {
 *          availableRooms: [
 *              { roomId: ..., roomName, ..., roomUrl: ... },
 *              ...
 *          ],
 *          sectionId: "analytics",
 *          sectionName: "Analytics",
 *          sectionUrl: ...
 *      },
 *      ...
 * ]
 */
function createVisierMenu(sections) {
    sections.forEach((section) => {
        // Find the Visier navigation container.
        const visierNavigationSection = document.getElementById('visier-navigation-section');

        // Create an element for the application section title/root.
        const sectionHeader = document.createElement('button');
        sectionHeader.className = 'navigation-header'
        sectionHeader.id = section.sectionId;
        sectionHeader.innerHTML = section.sectionName;
        sectionHeader.addEventListener('click', () => {
            navigateVisier(section.sectionUrl, section.sectionId)
        });

        // Create a section for the "rooms" (that is, subsections).
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'navigation-section';
        // Create links for each room.
        section.availableRooms.forEach(room => {
            const navLink = document.createElement('button');
            navLink.className = 'navigation-link'
            navLink.id = room.roomId;
            navLink.innerHTML = room.roomName;
            navLink.addEventListener('click', () => navigateVisier(room.roomUrl, room.roomId));

            sectionDiv.appendChild(navLink);
        });

        visierNavigationSection.appendChild(sectionHeader);
        visierNavigationSection.appendChild(sectionDiv);
    });
}

/**
 * Navigate Visier from the partner application.
 */
function navigateVisier(menuUrl, menuId) {
    // The first click on any navigation menu will load the Visier application iframe with the provided section/room URL/ID.
    // Subsequent clicks post a navigation message to the Visier application iframe.
    if (!visierGlobals.isAppLoaded) {
        renderVisierAppIframe(menuUrl);
        return;
    }

    // Create navigation message.
    if (menuId) {
        const message = {
            "visier": {
                "messageType": "NAVIGATION",
                "data": {
                    "targetRoom": menuId
                }
            }
        };

        // Post the message to Visier application iframe window.
        visierGlobals.appIframe.contentWindow.postMessage(JSON.stringify(message), "*");
    }
}

/**
 * ****************************** 4. Handle Errors ******************************
 */

/**
 * Handle `AUTHENTICATION_ERROR` messages.
 * Scenarios in which this message may be emitted include, but are not limited to:
 *   1. The SSO configuration for the specified Visier tenant is incorrect or disabled.
 *   2. Auto-provisioning is disabled and the user does not have a Visier profile.
 *   3. The `tenantCode` claim in the SAML assertion was invalid.
 *   4. The SAML assertion sent to Visier's ACS URL was malformed.
 *
 * A partner application must handle this event gracefully, as it represents a blocked user flow.
 */
function handleVisierAuthenticationErrorEvent(visierMessage) {
    renderVisierErrorMessage("The user could not be logged into Visier.", visierMessage.data);
}

/**
 * Handle `VISIER_APP_DOWN` events.
 * When Visier is unavailable, render and log an error message.
 */
function handleVisierAppDownEvent(visierMessage) {
    renderVisierErrorMessage(visierMessage);
    console.log("Visier is unavailable");
}

/**
 * Handle `USER_AUTOPROVISION_FAILED` messages.
 * A partner application must handle this event gracefully, as it represents a blocked user flow.
 */
function handleAutoprovisionFailure(visierMessage) {
    renderVisierErrorMessage("Auto-provisioning failed.", visierMessage);
}

/**
 * ****************************** 5. Register Message Handlers ******************************
 */
// Create IE + other browser compatible window postMessage event handler.
const eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
const eventer = window[eventMethod];
const messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

// Window postMessage event listener: Listen to message from child iframes (`#visier-session` and `#visier-app`).
eventer(messageEvent, function (e) {
    // Check if received message is from a trusted window.
    if (e.source.parent === window) {
        let message;
        try {
            message = JSON.parse(e.data);
        } catch (e) {
            console.log("message is not a valid json");
        }

        if (message && message.visier) {
            const visierMessage = message.visier;
            console.log(`${visierMessage.messageType} received from Visier.`, message);
            if (visierMessage.messageType) {
                switch (visierMessage.messageType.toUpperCase()) {
                    case "SESSION_CONNECTED":
                        handleVisierSessionConnectedEvent(visierMessage);
                        break;
                    case "AUTHENTICATION_ERROR":
                        handleVisierAuthenticationErrorEvent(visierMessage);
                        break;
                    case "VISIER_SESSION_ALIVE":
                        handleVisierSessionAliveEvent(visierMessage);
                        break;
                    case "VISIER_APP_LOADED":
                        handleVisierAppLoadedEvent(visierMessage);
                        break;
                    case "VISIER_APP_DOWN":
                        handleVisierAppDownEvent(visierMessage);
                        break;
                    case "VISIER_SESSION_EXPIRED":
                        handleVisierSessionExpired(visierMessage);
                        break;
                    case "USER_AUTOPROVISION_FAILED":
                        handleAutoprovisionFailure(visierMessage);
                        break;
                    case "USER_AUTOPROVISION_SUCCESS":
                        handleAutoprovisionSuccess(visierMessage);
                        break;
                    default:
                }
            }
        }
    }
}, false);

/**
 * ****************************** Helper Functions ******************************
 */

/**
 * A partner must handle errors embedding the Visier application gracefully, as these errors will block user flows. In this
 * example application, we render an error message in place of the Visier application.
 */
function renderVisierErrorMessage(message, data) {
    renderVisierAppIframe('./visierError');
    if (message) {
        console.error(message, data || "No additional information supplied.");
        alert(message);
    }
}

/**
 * When the application loads for the first time, the `src` attribute of the Visier application iframe must be set
 * as desired. In this example application, the placeholder loading animation must also be removed.
 */
function renderVisierAppIframe(url) {
    // Hide loading GIF.
    visierGlobals.appLoadingImg.style.display = "none";
    // Render `#visier-app` iframe.
    visierGlobals.appIframe.src = url;
    visierGlobals.appIframe.style.display = "block";
}
