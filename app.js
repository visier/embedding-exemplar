/*
 * Copyright © [2010-2023] Visier Solutions Inc. All rights reserved.
 */

/**
 * The Visier Embedding Exemplar Application.
 * This script contains the middleware and endpoints for an Express server that embeds Visier in a partner application.
 * Launch the server with the `www` script.
 */

/**
 * External dependencies
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const path = require('path');
const crypto = require('crypto');

/**
 * Globals
 */
const { postSamlResponseToVisier } = require(path.join(__dirname, 'saml', 'visierSession'));
const { sessionCookie } = require('./config');
const sessions = {};
const app = express();

/**
 * Middleware
 */
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static('public'));
// Use Handlebars to render dynamic pages
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
// Set user based on a mock "session"
app.use((req, res, next) => {
  const sid = req.cookies[sessionCookie];  // Get `sid` from cookies
  if (sid && sessions[sid]) {
    req.user = sessions[sid] // If session exists in memory, retrieve user details
  }
  next();
});

/**
 * Routes
 */
// Create a user session based on the login information.
// The user is immediately redirected to the `redirect` URL provided
app.post('/signin/:redirect', (req, res, next) => {
  const user = req.body;                          // Get user details from POST request body
  const sid = crypto.randomUUID();                // Create session id
  sessions[sid] = user;                           // Record session in memory
  // Set session cookie. `sameSite: none` is required for the auto-provision workflow. See comments for `handleAutoprovisionSucess()` in `embed-application.js` for more information.
  res.cookie(sessionCookie, sid, { sameSite: "none", secure: true });
  res.redirect('../' + req.params.redirect);  // Send redirect response
});

// Embed Visier visuals in the partner application
app.get('/embed-chart', (req, res) => {
  res.render('embed-chart');
});


// Create an authenticated session with Visier. When embedded in the partner application
// as an `iframe`, this endpoint creates a Visier session and emits a message on completion.
//
// The SAML Response sent to Visier is recorded in `saml-log.xml`. See `saml/visierSession.js`
// for more details.
app.get('/connectVisierSession', (req, res, next) => {
  postSamlResponseToVisier(req, res, next);
});

// Shows an error page when the Visier Solution cannot be loaded
app.get('/visierError', (req, res) => {
  res.render('error', { message: "Sorry, Visier is currently unavailable." });
});

/**
 * Error handling
 */
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next({ statusCode: 404, message: `Route not found: ${req.url}`});
});

/**
 * Error handler. Show detailed error info if in dev environment.
 */
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = err;

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
