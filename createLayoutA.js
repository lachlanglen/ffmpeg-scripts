const childProcessPromise = require('./utils/child_process_promise');
const { createFileInfo } = require('./utils/create_file_info');

const input1 = './reaction_for_video_compressed.mp4'; // reaction
const input2 = './landscape_video_compressed.mp4'; // content
const croppedOutput = './croppedOutput.mp4';
const scaledOutput = './scaledOutput.mp4';
const blurredOutput = './blurredOutput.mp4';
const stackedOutput = './stackedOutput.mp4';

const createLayoutA = async () => {
  try {
    let metadata1 = await childProcessPromise.spawn('ffprobe', ['-of', 'json', '-show_streams', '-show_format', input1], { env: process.env });
    metadata1 = JSON.parse(metadata1);

    let metadata2 = await childProcessPromise.spawn('ffprobe', ['-of', 'json', '-show_streams', '-show_format', input2], { env: process.env });
    metadata2 = JSON.parse(metadata2);

    const fileInfo1 = createFileInfo(metadata1);

    const fileInfo2 = createFileInfo(metadata2);

    if (fileInfo1.width > fileInfo2.width) fileInfo1.isWidest = true;
    else fileInfo2.isWidest = true;

    console.log('fileInfo1: ', fileInfo1);
    console.log('fileInfo2: ', fileInfo2);

    // STEP 1: crop reaction video to 1:1

    const cropOptions = {
      croppedWidth: fileInfo1.width,
      croppedHeight: fileInfo1.width,
      offset: (fileInfo1.height - fileInfo1.width) / 2,
    };

    const { croppedHeight, croppedWidth, offset } = cropOptions;

    // const cropArgs = [
    //   '-i', input1,
    //   '-filter_complex', `crop=${croppedWidth}:${croppedHeight}:0:${offset},fps=60`,
    //   // '-filter:v', `crop=${croppedWidth}:${croppedHeight}:0:${offset}`,
    //   // '-filter:v', 'fps=60', // 30 frames per second
    //   '-preset', 'ultrafast',
    //   croppedOutput,
    // ];
    // console.log('cropArgs: ', cropArgs)
    // await childProcessPromise.spawn('ffmpeg', cropArgs, { env: process.env });
    // console.log('successfully cropped file!');

    // // STEP 2: scale down whichever input is wider to match
    // let inputToScale, scaledWidth;
    // if (fileInfo1.isWidest) {
    //   inputToScale = input1;
    //   scaledWidth = fileInfo2.width;
    // }
    // else {
    //   inputToScale = input2;
    //   scaledWidth = fileInfo1.width;
    // };

    // console.log('inputToScale: ', inputToScale, 'scaledWidth: ', scaledWidth)

    // const scaleArgs = [
    //   '-i', inputToScale,
    //   '-filter_complex', `scale=${scaledWidth}:-2,fps=60`,
    //   // '-filter:v', `scale=${scaledWidth}:-2`,
    //   // '-filter:v', 'fps=60', // 30 frames per second
    //   '-preset', 'ultrafast',
    //   scaledOutput,
    // ];

    // console.log('scaleArgs: ', scaleArgs)
    // await childProcessPromise.spawn('ffmpeg', scaleArgs, { env: process.env });
    // console.log('successfully scaled file!');

    // // STEP 3: crop bottom portion of input2 (content) which will be blurred and attached to bottom of content
    // let goalHeight = scaledWidth / 9 * 16;

    // console.log('goalHeight: ', goalHeight);

    // let metadata3 = await childProcessPromise.spawn('ffprobe', ['-of', 'json', '-show_streams', '-show_format', scaledOutput], { env: process.env });
    // metadata3 = JSON.parse(metadata3);

    // const scaledFileInfo = createFileInfo(metadata3);

    // console.log('scaledFileInfo: ', scaledFileInfo);

    // const blurredVidHeight = goalHeight - (scaledFileInfo.height + croppedHeight);

    // console.log('blurredVidHeight: ', blurredVidHeight);

    // const blurArgs = [
    //   '-i', scaledOutput,
    //   '-filter_complex', `[0:v]crop=iw:${blurredVidHeight}:0:${scaledFileInfo.height - blurredVidHeight}[v0],[v0]boxblur=luma_radius=${blurredVidHeight / 2}:chroma_radius=10:luma_power=1[blurred]`, // crop & blur
    //   '-vsync', 2, // 
    //   '-map', '[blurred]',
    //   '-preset', 'ultrafast',
    //   blurredOutput,
    // ];
    // console.log('blurArgs: ', blurArgs)
    // await childProcessPromise.spawn('ffmpeg', blurArgs, { env: process.env });
    // console.log('successfully cropped content file for blurred padding!');

    // // STEP 4: combine videos vertically

    // const stackArgs = [
    //   '-i', croppedOutput, // top vid
    //   '-i', scaledOutput, // middle vid
    //   '-i', blurredOutput, // bottom vid
    //   '-filter_complex', '[0:v:0][1:v:0][2:v:0]vstack=inputs=3[v];[0:a][1:a]amix[a]', // vertically stack videos
    //   '-map', '[v]', // map video
    //   '-map', '[a]', // map audio
    //   '-preset', 'ultrafast',
    //   stackedOutput,
    // ];
    // console.log('stackArgs: ', stackArgs)
    // await childProcessPromise.spawn('ffmpeg', stackArgs, { env: process.env });
    // console.log('successfully stacked videos!');

    // COMBINED COMMANDS:

    const scaledWidth = fileInfo1.width;
    const scaledHeight = Math.floor(scaledWidth / 16 * 9);
    const goalHeight = Math.floor(scaledWidth / 9 * 16);
    const blurredVidHeight = goalHeight - (scaledHeight + croppedHeight);

    console.log('scaledWidth: ', scaledWidth, 'scaledHeight: ', scaledHeight)

    const combinedArgs = [
      '-i', input1, // reaction vid
      '-i', input2, // original content vid
      '-filter_complex', `[0:v]crop=${croppedWidth}:${croppedHeight}:0:${offset},fps=30[v0],[1:v]scale=${croppedWidth}:${scaledHeight},fps=30[v1],[1:v]scale=${croppedWidth}:${scaledHeight},fps=30,crop=iw:${blurredVidHeight}:0:${goalHeight - (scaledHeight + croppedHeight)}[v1c],[v1c]boxblur=luma_radius=${blurredVidHeight / 2}:chroma_radius=10:luma_power=1[blurred],[v0][v1][blurred]vstack=inputs=3[v];[0:a][1:a]amix[a]`,
      '-map', '[v]', // map video
      '-map', '[a]', // map audio
      // '-preset', 'ultrafast', // removed this as it is already fast and it was dramatically increasing final filesize
      stackedOutput,
    ];
    console.log('combinedArgs: ', combinedArgs)
    await childProcessPromise.spawn('ffmpeg', combinedArgs, { env: process.env });
    console.log('successfully stacked videos!');

  } catch (e) {
    console.log('error:', e);
  };
};

createLayoutA();