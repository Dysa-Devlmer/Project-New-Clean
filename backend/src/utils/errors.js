/**
 * DYSA Point - Clases de Error Personalizadas
 * Manejo de errores específicos del sistema POS
 * Fecha: 19 de Octubre 2025
 */

class ValidationError extends Error {
  constructor(message, field = null, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message, resource = null, id = null) {
    super(message);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.id = id;
    this.code = 'NOT_FOUND';
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message, conflictReason = null) {
    super(message);
    this.name = 'ConflictError';
    this.conflictReason = conflictReason;
    this.code = 'CONFLICT';
    this.statusCode = 409;
  }
}

class DatabaseError extends Error {
  constructor(message, query = null, originalError = null) {
    super(message);
    this.name = 'DatabaseError';
    this.query = query;
    this.originalError = originalError;
    this.code = 'DATABASE_ERROR';
    this.statusCode = 500;
  }
}

class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    this.code = 'AUTHENTICATION_ERROR';
    this.statusCode = 401;
  }
}

class AuthorizationError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
    this.code = 'AUTHORIZATION_ERROR';
    this.statusCode = 403;
  }
}

class BusinessLogicError extends Error {
  constructor(message, rule = null) {
    super(message);
    this.name = 'BusinessLogicError';
    this.rule = rule;
    this.code = 'BUSINESS_LOGIC_ERROR';
    this.statusCode = 422;
  }
}

module.exports = {
  ValidationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  BusinessLogicError,
  BusinessError: BusinessLogicError // Alias for compatibility
};