const logger = require('./logger')
const yaml = require('js-yaml')

async function getStylefile({owner, repo, ref}, repos) {
  const stylefileName = '.clang-format'

  // try getting stylefile from default branch (master) first
  try {
    const stylefileResponse = await repos.getContents({
      owner,
      repo,
      path: stylefileName,
    })
    const buffer = Buffer.from(stylefileResponse.data.content, 'base64')
    const text = buffer.toString('utf8')

    // flatten YAML docs into single and convert YAML to JSON
    const json = JSON.stringify(yaml.safeLoadAll(text).reduce((acc, doc) => {
      Object.keys(doc).forEach((key) => acc[key] = doc[key])
      return acc
    }), {})

    logger.info(`Got stylefile from default branch : ${json}`)
    return json
  }
  // try getting stylefile from current branch
  catch (e) {
    logger.info('Could not get stylefile from default branch, trying PR branch.')
    try {
      const stylefileResponse = await repos.getContents({
        owner,
        repo,
        path: stylefileName,
        ref,
      })
      const buffer = Buffer.from(stylefileResponse.data.content, 'base64')
      const text = buffer.toString('utf8')

      // flatten YAML docs into single and convert YAML to JSON
      const json = JSON.stringify(yaml.safeLoadAll(text).reduce((acc, doc) => {
        Object.keys(doc).forEach((key) => acc[key] = doc[key])
        return acc
      }), {})

      logger.info(`Got stylefile from PR branch : ${json}`)
      return json
    }
    // no stylefile anywhere, use default styling
    catch (e) {
      logger.info('Could not get stylefile, falling back to defaults.')
      return null
    }
  }
}

async function getPRFileList (pulls, {owner, repo, pull_number}) {
  let page = 1
  const files = []

  let gotFiles
  do {
    const response = await pulls.listFiles({
      owner,
      repo,
      pull_number,
      page,
      per_page: 50,
    })
    response.data.forEach(({filename, sha}) => {
      files.push({filename, sha})
    })

    gotFiles = response.data.length > 0 ? true : false
    page++
  }
  while (gotFiles)

  return files
}
async function getFile (git, {owner, repo, filename, sha}) {
  return git
    .getBlob({
      owner,
      repo,
      file_sha: sha,
    })
    .then(({ data }) => {
      const buffer = Buffer.from(data.content, 'base64')
      const text = buffer.toString('utf8')
      return {
        filename,
        content: text,
      }
    })
    .catch(e => {
      return {
        filename,
        exception: e,
      }
    })
}

module.exports = {
  getStylefile,
  getPRFileList,
  getFile,
}
