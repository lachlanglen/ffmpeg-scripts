const childProcessPromise = require('./utils/child_process_promise');
const { createFileInfo } = require('./utils/create_file_info');

const input1 = './reaction_for_video_compressed.mp4'; // reaction
// const input2 = './portrait_video_compressed.mp4'; // content
// const input2 = './video-content--almost-square.mp4';
const input2 = './video-content-perfect-square.mp4';
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

    console.log('fileInfo1: ', fileInfo1);
    console.log('fileInfo2: ', fileInfo2);
    console.log('areSameWidth: ', areSameWidth)

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
        scaledHeight = fileinfo2.width;
        totalHeight = fileInfo2.height + scaledHeight;
      }
      else {
        inputToScale = input2;
        scaledWidth = fileInfo1.width;
        scaledHeight = Math.floor(fileInfo1.width / contentRatio);
        if (scaledHeight % 2 !== 0) scaledHeight--; // needs to be an even number to be able to be combined with blurred strips later
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

    let vstackInput1, vstackInput2;
    if (!areSameWidth) {
      if (fileInfo1.isWidest) { // input1 has been scaled down
        vstackInput1 = 'v0s'; // "Video Zero Scaled"
        vstackInput2 = 'v1'; // input2 video stream at 30fps
      } else { // input2 has been scaled down
        vstackInput1 = 'v0';
        vstackInput2 = 'v1';
      }

    } else { // inputs are same width
      vstackInput1 = 'v0';
      vstackInput2 = 'v1';
    };

    const combinedArgs = [
      '-i', input1, // reaction vid
      '-i', input2, // original content vid
      '-i', overlay,
      '-filter_complex', `[0:v]crop=${croppedWidth}:${croppedHeight}:0:${offset},fps=30[v0];${!areSameWidth ? `[${fileInfo1.isWidest ? 'v0' : '1:v'}]scale=${scaledWidth}:${scaledHeight},fps=30[${fileInfo1.isWidest ? 'v0s' : 'v1'}];` : '[1:v]fps=30[v1];'}[${vstackInput1}][${vstackInput2}]vstack=inputs=2,split=3[lc][m][rc];[lc]crop=${singleBlurWidth}:ih:0:0,boxblur=luma_radius=${Math.floor(singleBlurWidth / 2)}:chroma_radius=${Math.floor(singleBlurWidth / 4)}:luma_power=1[blurredA];[rc]crop=${singleBlurWidth}:ih:${scaledWidth - singleBlurWidth}:0,boxblur=luma_radius=${Math.floor(singleBlurWidth / 2)}:chroma_radius=${Math.floor(singleBlurWidth / 4)}:luma_power=1[blurredB];[blurredA][m][blurredB]hstack=inputs=3[combined];[combined][2]overlay=10:main_h-overlay_h-10[v];[0:a][1:a]amix[a]`,
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