import  winston from 'winston';
import os from 'os';

const label = (value: string) => winston.format.label({ label: `${value}` });

const customFormat = winston.format.printf(({ level, message, label, timestamp, stack }) => {
  if (stack) {
    return `${timestamp} [${label}] ${level}: ${message}\n${stack}`;
  }
  return `${timestamp} [${label}] ${level}: ${message}`;
});

export const logger = winston.createLogger({
    defaultMeta: {
      host: os.hostname,
      env: process.env.NODE_ENV ? process.env.NODE_ENV : 'local'
    },
    format: winston.format.combine(
      label('Master4Novice'),
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.errors({stack: true}),
      customFormat
    ),
    transports: [
      new winston.transports.Console(),
    ]
});