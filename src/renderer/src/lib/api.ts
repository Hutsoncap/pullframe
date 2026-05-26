/**
 * Typed wrapper for the Electron preload API.
 * The actual typing comes from the preload declarations (window.api).
 * This module provides a single import point for renderer code.
 */
const api = window.api

export default api
