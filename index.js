const core = require('@actions/core')
const github = require('@actions/github')

const Status = require('./lib/status')
const {lint} = require('./lib/actions')

async function run () {
  // Get clang-format config path
  const config_path = core.getInput('config-path')
  console.log(`Using config at '${config_path}'`)

  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`)

  // Get authenticated API
  const repoToken = core.getInput('repo-token');
  const octokit = new github.GitHub(repoToken);

  // Get PR details
  const {context} = octokit
  const {owner, repo} = context.repo
  const {number} = context.payload
  const {sha, ref} = context.payload.pull_request.head

  // Setup PR status check
  const status = Status(octokit.checks, {
      owner,
      repo,
      name: 'clang-format',
      head_sha: sha,
    })
  await status.queued()

  // Lint
  try {
    await lint({ owner, repo, pull_number: number, sha, ref }, github, status)
  }
  catch (error) {
    status.error(error)
    throw error
  }
}

// Run action
run().catch((error) => core.setFailed(error.message))
