/** Wrong usage (unknown flag, missing argument...): exit code 2. */
export class UsageError extends Error {
    command;
    constructor(message, command) {
        super(message);
        this.command = command;
        this.name = "UsageError";
    }
}
/** An error answered by the PostArgo API (the message is the API's `error`). */
export class ApiError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = "ApiError";
    }
}
/** Any other failure the user can act on (exit code 1, message printed as is). */
export class CliError extends Error {
    constructor(message) {
        super(message);
        this.name = "CliError";
    }
}
