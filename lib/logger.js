const { createLogger, format, transports } = require('winston')
const { combine, timestamp, printf } = format

const name = process.env.PROGRAM_ALIAS ? process.env.PROGRAM_ALIAS + ':' : ''

const logFormat = printf(info => {
  return `${name}${info.timestamp}:${info.level}: ${info.message}`
})

const logger = createLogger({
  level: process.env.LOG_LEVEL === 'debug' ? 'debug' : 'info',
  format: combine(
    timestamp(),
    logFormat
  ),
  transports: [
    new transports.Console(),
  ],
})

logger.info('logger started up')
module.exports = logger
