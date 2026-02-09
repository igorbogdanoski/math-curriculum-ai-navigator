// services/apiErrors.ts

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message = "Премногу барања. Ве молиме обидете се повторно подоцна.") {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class AuthError extends ApiError {
    constructor(message = "Проблем со автентикација. Проверете го вашиот API клуч.") {
        super(message);
        this.name = 'AuthError';
    }
}

export class BadInputError extends ApiError {
    constructor(message = "Невалидно барање. Проверете ги влезните податоци.") {
        super(message);
        this.name = 'BadInputError';
    }
}

export class ServerError extends ApiError {
    constructor(message = "Серверот на AI врати грешка. Ве молиме обидете се повторно.") {
        super(message);
        this.name = 'ServerError';
    }
}