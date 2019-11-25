const core = require('@actions/core')
const github = require('@actions/github')

try {
  const config_path = core.getInput('config-path')
  console.log(`Using config at '${config_path}'`)

  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`)
}
catch (error) {
  core.setFailed(error.message)
}
