const core = require('@actions/core')
const github = require('@actions/github')

const Status = require('./lib/status')
const {lint, format} = require('./lib/actions')

async function run () {
  // Get clang-format config path
  const config_path = core.getInput('config-path')
  console.log(`Using config at '${config_path}'`)

  // Get authenticated API
  const repoToken = core.getInput('repo-token')
  const octokit = new github.GitHub(repoToken)

  // Check permissions
  const proactive = process.env.TAKE_ACTION ? process.env.TAKE_ACTION : false

  proactive && console.log(`${JSON.stringify(github.context.payload)}`)

  // Get PR details
  const context = github.context
  const {owner, repo} = context.repo
  const {number: pull_number} = context.payload.issue || context.payload

  const pr = await octokit.pulls.get({
    owner,
    repo,
    pull_number,
  })
  const {sha, ref} = pr.data.head

  // Setup PR status check
  const status = Status(octokit.checks, {
    owner,
    repo,
    name: 'clang-format',
    head_sha: sha,
  })
  await status.queued()

  // Run
  try {
    const details = { owner, repo, pull_number, sha, ref }

    if (!proactive) {
      await lint(details, octokit, status)
    }
    else {
      await format(details, octokit, status)
    }
  }
  catch (error) {
    status.error(error)
  }
}

// Run action
run().catch((error) => core.setFailed(error.message))
