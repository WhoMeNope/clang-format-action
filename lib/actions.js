const logger = require('./logger')

const formatFile = require('./format')
const { getStylefile, getPRFileList, getFile, generateAnnotations }
  = require('./hub')

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

async function format(
  {owner, repo, pull_number, sha, ref},
  {git, pulls, repos},
  status
) {
  // In progress
  await status.progress(new Date())
  logger.info('In Progress')

  // Check if exists and get /.clang-format
  const style = await getStylefile({owner, repo, ref}, repos, logger.info)

  // Get PR file list
  pr_filenames = await getPRFileList(pulls, {owner, repo, pull_number})
  const filenames = pr_filenames.reduce((acc, {filename}) => `${acc}${filename};`, '')
  logger.info(`Got PR's changed files : ${filenames}`)

  // Process files
  skipped_filenames = []
  pushed_blobs = []
  await asyncForEach(pr_filenames, async ({filename, sha}) => {
    logger.info(`Processing ${filename}`)

    // Get file
    const file = await getFile(git, {owner, repo, filename, sha})
    if (file.exception || !file.content) {
      logger.error(`Error getting ${filename}`)
      skipped_filenames.push(filename)
      return
    }

    // Format file
    const transformed = await formatFile(file, style)
    if (!transformed) {
      logger.error(`Error transforming ${filename}`)
      skipped_filenames.push(filename)
      return
    }

    if (!transformed.touched) {
      return
    }

    // Push blob
    const blob = await git
      .createBlob({
        owner,
        repo,
        content: transformed.content,
        encoding: "utf-8",
      })
      .then(({data}) => {
        return { sha: data.sha, filename }
      })
      .catch((err) => err)
    if (blob instanceof Error) {
      logger.error(`Error pushing blob for ${filename}`)
      skipped_filenames.push(filename)
      return
    }
    logger.info(`Created blob for: ${filename}`)
    pushed_blobs.push(blob)
  })
  const filenamesErrored =
    skipped_filenames.reduce((acc, filename) => `${acc}${filename};`, '')
  filenamesErrored.length && logger.info(`Couldn't get PR files : ${filenamesErrored}`)

  // create tree
  const tree = []
  pushed_blobs.forEach(({ sha, filename }) => {
    tree.push({
      mode: '100644', // blob (file)
      type: 'blob',
      path: filename,
      sha,
    })
  })
  const treeResponse = await git.createTree({
    owner,
    repo,
    tree,
    base_tree: sha,
  })
  logger.info('Created tree')

  // create commit
  const commitResponse = await git.createCommit({
    owner,
    repo,
    message: 'gitbot-format: automated code format',
    tree: treeResponse.data.sha,
    parents: [sha],
  })
  logger.info('Created commit')

  // update branch reference
  const referenceResponse = await git.updateRef({
    owner,
    repo,
    ref: `heads/${ref}`,
    sha: commitResponse.data.sha,
    force: false,
  })
  logger.info('Updated ref')

  // Completed
  if (skipped_filenames.length > 0) {
    await status.warningSkipped(skipped_filenames)
  }
  else {
    await status.success()
  }
  logger.info('Completed')
}

async function lint(
  {owner, repo, pull_number, sha, ref},
  {git, pulls, repos},
  status
) {

  // In progress
  await status.progress(new Date())
  logger.info('In Progress')

  // Check if exists and get /.clang-format
  const style = await getStylefile({owner, repo, ref}, repos, logger.info)

  // Get PR file list
  pr_filenames = await getPRFileList(pulls, {owner, repo, pull_number})
  const filenames = pr_filenames.reduce((acc, {filename}) => `${acc}${filename};`, '')
  logger.info(`Got PR's changed files : ${filenames}`)

  // Process files
  skipped_filenames = []
  touched_lines = []
  annotations = []
  await asyncForEach(pr_filenames, async ({filename, sha}) => {
    logger.info(`Processing ${filename}`)

    // Get file
    const file = await getFile(git, {owner, repo, filename, sha})
    if (file.exception || !file.content) {
      logger.error(`Error getting ${filename}`)
      skipped_filenames.push(filename)
      return
    }

    // Format file
    const transformed = await formatFile(file, style)
    if (!transformed) {
      logger.error(`Error transforming ${filename}`)
      skipped_filenames.push(filename)
      return
    }
    if (!transformed.touched) {
      return
    }

    // Generate annotations
    const file_annotations = generateAnnotations(transformed, file)

    touched_lines = Number(file_annotations.lines) + Number(touched_lines)
    annotations = annotations.concat(file_annotations.annotations)
  })
  const filenamesErrored =
    skipped_filenames.reduce((acc, filename) => `${acc}${filename};`, '')
  filenamesErrored.length && logger.info(`Couldn't get PR files : ${filenamesErrored}`)

  // If files touched -> check status annotations
  if (touched_lines > 0 || annotations.length > 0) {
    logger.info(`Touched ${touched_lines} lines`)
    await status.failure(annotations, touched_lines, skipped_filenames)
  }
  else if (skipped_filenames.length > 0) {
    logger.info (`Skipped ${skipped_filenames.length} files`)
    await status.warningSkipped(skipped_filenames)
  }
  else {
    logger.info('No files touched')
    await status.success()
  }
  logger.info('Completed')
}

module.exports = {
  lint,
  format,
}
