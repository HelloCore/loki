const fs = require('fs-extra');
const { slugify } = require('transliteration');
const glob = require('glob');
const { ReferenceImageError } = require('../../errors');
const { getImageDiffer } = require('../../diffing');

const SLUGIFY_OPTIONS = {
  lowercase: false,
  separator: '_',
};

const getBaseName = (configurationName, kind, story) =>
  slugify(`${configurationName} ${kind} ${story}`, SLUGIFY_OPTIONS);

async function testStory(
  target,
  options,
  tolerance,
  configuration,
  configurationName,
  kind,
  story
) {
  const basename = getBaseName(configurationName, kind, story);
  const locale = `${options.locale}`;
  const filename = `${basename}_${locale}.png`;
  const outputPath = `${options.outputDir}/${filename}`;
  const referencePath = `${options.referenceDir}/${filename}`;
  // const diffPath = `${options.differenceDir}/${filename}`;
  // const referenceExists = await fs.pathExists(referencePathForChecking);
  const referenceExists = await new Promise(resolve => {
    glob(
      `${options.referenceDir}/${basename}*_${locale}.png`,
      (error, files) => {
        if (error) {
          resolve(false);
          return;
        }
        if (files != null && files.length > 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    );
  });

  const shouldUpdateReference =
    options.updateReference || (!options.requireReference && !referenceExists);
  await target.captureScreenshotForStory(
    kind,
    story,
    shouldUpdateReference ? referencePath : outputPath,
    options,
    configuration
  );

  if (shouldUpdateReference) {
    return;
  }

  if (!referenceExists) {
    throw new ReferenceImageError('No reference image found', kind, story);
  }

  const outputFileNames = await new Promise(resolve => {
    glob(`${options.outputDir}/${basename}*_${locale}.png`, (error, files) => {
      if (error) {
        resolve([]);
        return;
      }
      if (files != null && files.length > 0) {
        resolve(
          files.map(file => {
            const fileArr = file.split('/');
            return fileArr[fileArr.length - 1];
          })
        );
      } else {
        resolve([]);
      }
    });
  });

  if (outputFileNames.length === 0) {
    throw new ReferenceImageError('No output image found', kind, story);
  }

  const comparedResults = outputFileNames.map(async fileName => {
    const isRefExists = fs.pathExists(`${options.referenceDir}/${fileName}`);
    if (!isRefExists) {
      return null;
    }

    const isEqual = await getImageDiffer(
      options.diffingEngine,
      options[options.diffingEngine]
    )(
      `${options.referenceDir}/${fileName}`,
      `${options.outputDir}/${fileName}`,
      `${options.differenceDir}/${fileName}`,
      tolerance
    );

    if (isEqual) {
      return null;
    }
    return `${options.differenceDir}/${fileName}`;
  });

  const results = await Promise.all(comparedResults);
  const message = results.reduce((acc, value) => {
    if (value != null) {
      if (acc != null) {
        return `Screenshot differs from reference, see ${value}`;
      }
      return `${acc}, value`;
    }
    return acc;
  }, '');

  if (message.length > 0) {
    throw new ReferenceImageError(message, kind, story);
  }
  // const isEqual = await getImageDiffer(
  //   options.diffingEngine,
  //   options[options.diffingEngine]
  // )(referencePath, outputPath, diffPath, tolerance);

  // if (!isEqual) {
  //   throw new ReferenceImageError(
  //     `Screenshot differs from reference, see ${path.relative(
  //       path.resolve('./'),
  //       diffPath
  //     )}`,
  //     kind,
  //     story
  //   );
  // }
}

module.exports = testStory;
