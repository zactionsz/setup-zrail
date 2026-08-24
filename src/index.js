'use strict'

const { runAction } = require('./action')
const { setFailed } = require('./github')

runAction().catch(setFailed)

