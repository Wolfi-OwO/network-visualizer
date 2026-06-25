// Tiny structured logger — swap for pino/winston later without touching callers.
import winston from 'winston';

const customFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
    if (stack) {
        // print log trace
        return `${timestamp} ${level}: ${message} - ${stack}`;
    }
    return `${timestamp} ${level}: ${message}`;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        new winston.transports.Console(),
    ],
    format:
        winston.format.combine(
            winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.mmm" }),
            winston.format.colorize(),
            customFormat
        )
});

export { logger };

