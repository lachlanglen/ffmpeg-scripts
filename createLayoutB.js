const childProcessPromise = require('./utils/child_process_promise');
const { createFileInfo } = require('./utils/create_file_info');

// const input1 = './trimmed.mp4'; // reaction video trimmed to exactly the same length as content video
const input1 = './reaction_for_video_compressed.mp4'; // reaction
// const input2 = './portrait_video_compressed.mp4'; // content
const input2 = './video-content-almost-square.mp4';
// const input2 = './video-content-perfect-square.mp4';
const stackedOutput = './stackedOutput.mp4';
const overlay = './glancyLogo.png';

const createLayoutB = async () => {
  try {
    let metadata1 = await childProcessPromise.spawn('ffprobe', ['-of', 'json', '-show_streams', '-show_format', input1], { env: process.env });
    metadata1 = JSON.parse(metadata1);

    let metadata2 = await childProcessPromise.spawn('ffprobe', ['-of', 'json', '-show_streams', '-show_format', input2], { env: process.env });
    metadata2 = JSON.parse(metadata2);

    const fileInfo1 = createFileInfo(metadata1);

    const fileInfo2 = createFileInfo(metadata2);

    let areSameWidth;
    if (fileInfo1.width > fileInfo2.width) fileInfo1.isWidest = true;
    else if (fileInfo1.width < fileInfo2.width) fileInfo2.isWidest = true;
    else areSameWidth = true;

    let areSameDuration, fillerLengthToGenerate, shouldTrimContentToReactionLength;
    if (fileInfo1.duration > fileInfo2.duration) { // if reaction is longer than content
      fileInfo1.isLongestDuration = true;
      fillerLengthToGenerate = fileInfo1.duration - fileInfo2.duration;
    }
    else if (fileInfo1.duration < fileInfo2.duration) { // if content is longer than reaction
      fileInfo2.isLongestDuration = true;
      shouldTrimContentToReactionLength = true;
    }
    else areSameDuration = true;

    console.log('fileInfo1: ', fileInfo1);
    console.log('fileInfo2: ', fileInfo2);
    console.log('areSameWidth: ', areSameWidth)
    console.log('areSameDuration: ', areSameDuration)

    // STEP 1: crop reaction video to 1:1

    const cropOptions = {
      croppedWidth: fileInfo1.width,
      croppedHeight: fileInfo1.width,
      offset: (fileInfo1.height - fileInfo1.width) / 2,
    };

    const { croppedHeight, croppedWidth, offset } = cropOptions;

    const contentRatio = fileInfo2.width / fileInfo2.height;

    let inputToScale, scaledWidth, scaledHeight, totalHeight;

    if (!areSameWidth) {
      // STEP 2: scale down whichever input is wider to match
      if (fileInfo1.isWidest) {
        inputToScale = input1;
        scaledWidth = fileInfo2.width;
        scaledHeight = fileInfo2.width;
        totalHeight = fileInfo2.height + scaledHeight;
      }
      else {
        inputToScale = input2;
        scaledWidth = fileInfo1.width;
        scaledHeight = Math.floor(fileInfo1.width / contentRatio);
        if (scaledHeight % 2 !== 0) scaledHeight--; // needs to be an even number to be able to be combined with blurred strips later, or you'll get a 'not divisible by 2' error
        totalHeight = scaledHeight + fileInfo1.width;
      };
    } else {
      scaledWidth = croppedWidth;
      totalHeight = fileInfo2.height + fileInfo2.width;
    };

    console.log('inputToScale: ', inputToScale, 'scaledWidth: ', scaledWidth, 'totalHeight: ', totalHeight)

    const goalWidth = Math.floor(totalHeight / 16 * 9);
    console.log('goalWidth: ', goalWidth);

    let mainVideoWidth;
    if (areSameWidth) mainVideoWidth = croppedWidth;
    else mainVideoWidth = scaledWidth;

    console.log('mainVideoWidth: ', mainVideoWidth)

    const totalBlurredAreasWidth = goalWidth - mainVideoWidth;
    const singleBlurWidth = totalBlurredAreasWidth / 2;

    const getVideoInputArgs = () => {
      const args = [];
      args.push('-i', input1);
      if (shouldTrimContentToReactionLength) args.push('-t', fileInfo1.duration);
      args.push('-i', input2);
      return args;
    };

    const generateFillerCommand = ({ outputName }) => {
      let command = '';
      if (fillerLengthToGenerate) {
        command += `color=c=black:s=${fileInfo2.width}x${fileInfo2.height}:r=30:d=${fillerLengthToGenerate}[black],[1:v][black]concat=n=2:v=1:a=0,fps=30[${outputName}],`
      };
      return command;
    };

    const generateCropCommand = ({ inputName, outputName }) => {
      return `[${inputName}]crop=${croppedWidth}:${croppedHeight}:0:${offset},fps=30[${outputName}]`;
    };

    const generateScaleCommand = ({ inputName }) => {
      let command = '';
      let scaleOutput = 'scaled';
      if (!areSameWidth) {
        command += `[${inputName}]`;
        command += `scale=${scaledWidth}:${scaledHeight}`; // add scale command
        if (!fileInfo1.isWidest) { // input1 (reaction) has already been transcoded to 30fps, so we only need to do it here if it's input2 (content) which is being scaled
          command += ',fps=30';
        };
        command += `[${scaleOutput}];`;
      } else { // all we need to do is transcode content video to 30fps if it has not already had this applied in filler command
        if (!fillerLengthToGenerate) command += `[1:v]fps=30[v1]`
      }

      let vstackInput1, vstackInput2;
      if (!areSameWidth) {
        if (fileInfo1.isWidest) { // input1 has been scaled down
          vstackInput1 = scaleOutput;
          if (fillerLengthToGenerate) vstackInput2 = 'v1filled'; // reaction is longer than content, so bottom vstack video will be content with black filler at end
          else vstackInput2 = '1:v'; // content is longer than reaction, so we will use the original input (which was trimmed at the time of inputting)
        } else { // input2 has been scaled down
          vstackInput1 = 'v0';
          vstackInput2 = scaleOutput;
        }
      } else { // inputs are same width
        vstackInput1 = 'v0';
        vstackInput2 = fillerLengthToGenerate ? 'v1filled' : 'v1';
      };

      return {
        scaleCommand: command,
        vstackInput1,
        vstackInput2,
      }
    };

    const { scaleCommand, vstackInput1, vstackInput2 } = generateScaleCommand({ inputName: fileInfo1.isWidest ? 'v0' : fillerLengthToGenerate ? 'v1filled' : '1:v', outputName: 'v1' });

    const fadeDuration = 0.5;

    const combinedArgs = [
      ...getVideoInputArgs(),
      '-i', overlay,
      '-filter_complex', `${generateFillerCommand({ outputName: 'v1filled' })}${generateCropCommand({ inputName: '0:v', outputName: 'v0' })};${scaleCommand}[${vstackInput1}][${vstackInput2}]vstack=inputs=2,split=3[lc][m][rc];[lc]crop=${singleBlurWidth}:ih:0:0,boxblur=luma_radius=${Math.floor(singleBlurWidth / 2)}:chroma_radius=${Math.floor(singleBlurWidth / 4)}:luma_power=1[blurredA];[rc]crop=${singleBlurWidth}:ih:${scaledWidth - singleBlurWidth}:0,boxblur=luma_radius=${Math.floor(singleBlurWidth / 2)}:chroma_radius=${Math.floor(singleBlurWidth / 4)}:luma_power=1[blurredB];[blurredA][m][blurredB]hstack=inputs=3,fade=t=out:start_time=${fileInfo1.duration - fadeDuration}:duration=${fadeDuration}[combined];[combined][2]overlay=10:main_h-overlay_h-10[v];[0:a][1:a]amix[a]`,
      '-map', '[v]', // map video
      '-map', '[a]', // map audio
      stackedOutput,
    ];
    console.log('combinedArgs: ', combinedArgs)
    await childProcessPromise.spawn('ffmpeg', combinedArgs, { env: process.env });
    console.log('successfully stacked videos!');

  } catch (e) {
    console.log('error:', e);
  };
};

createLayoutB();