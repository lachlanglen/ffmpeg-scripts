const createFileInfo = (metadata) => {
  if (!metadata) throw new Error('Metadata must be provided in order to create file info!');

  let videoStreamIndex;
  for (let i = 0; i < metadata.streams.length; i++) {
    if (metadata.streams[i].codec_type === 'video') {
      videoStreamIndex = i;
      break;
    }
  };

  if (videoStreamIndex === undefined) throw new Error('Metadata must include a video stream!');

  const fileInfo = {
    // orientation: null,
    // framerate: null,
    height: null,
    width: null,
  };

  // const landscapeOrientations = ['90', '-90', 90, -90];

  const metadataVideoStream = metadata.streams[videoStreamIndex];

  // if (!metadataVideoStream.side_data_list) {
  //   fileInfo.orientation = metadataVideoStream.height > metadataVideoStream.width ? 'portrait' : 'landscape';
  // } else {
  //   fileInfo.orientation = landscapeOrientations.includes(metadataVideoStream.side_data_list[0].rotation) ? 'portrait' : 'landscape';
  // };

  fileInfo.width = metadataVideoStream.width;
  fileInfo.height = metadataVideoStream.height;

  // fileInfo.framerate = metadataVideoStream.r_frame_rate.split('/')[0];

  return fileInfo;
};

module.exports = {
  createFileInfo,
}